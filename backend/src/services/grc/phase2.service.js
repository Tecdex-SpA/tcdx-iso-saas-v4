const {
  assertTransition,
  calculateIncidentSeverity,
  evaluateRules,
  scoreSupplierAssessment,
} = require('./phase2Rules');
const {
  decryptCredential,
  encryptCredential,
  hashToken,
  randomToken,
  redactIntegration,
} = require('./phase2Crypto');
const { normalizeRecord, pullConnectorRecords } = require('./phase2ConnectorAdapters');
const crypto = require('crypto');

const PLATFORM_ROLES = new Set([
  'superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner',
]);

class Phase2Error extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function uuid(value, code = 'PHASE2_ID_REQUIRED') {
  const normalized = String(value || '').trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalized)) {
    throw new Phase2Error(code, 'Identificador inválido.', 400);
  }
  return normalized;
}

function requiredText(value, code, max = 500) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) {
    throw new Phase2Error(code, 'Valor requerido o fuera de rango.', 400);
  }
  return normalized;
}

function optionalText(value, max = 5000) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new Phase2Error('PHASE2_TEXT_TOO_LONG', 'Texto fuera de rango.', 400);
  return normalized;
}

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function object(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function clampLimit(value, maximum = 200) {
  return Math.max(1, Math.min(maximum, Number(value) || 50));
}

function asBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function createPhase2Service(pool, { clock = Date.now, environment = process.env } = {}) {
  async function withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function audit(client, {
    tenantId, userId, action, tableName, recordId, oldData = null, newData = null, metadata = {},
  }) {
    await client.query(
      `INSERT INTO audit_event_log (
         table_name, record_id, tenant_id, action, changed_by, old_data, new_data, metadata
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5::uuid, $6::jsonb, $7::jsonb, $8::jsonb)`,
      [tableName, recordId, tenantId, action, userId || null, json(oldData, null), json(newData, null), json(metadata)]
    );
  }

  async function assertModuleEnabled(tenantId) {
    const result = await pool.query(
      `SELECT COALESCE(tms.is_enabled, sm.default_enabled, FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key = sm.module_key AND tms.tenant_id = $1::uuid
       WHERE sm.module_key = 'grc_phase2_integrated' AND sm.is_active = TRUE`,
      [tenantId]
    );
    if (result.rows[0]?.is_enabled !== true) {
      throw new Phase2Error('GRC_PHASE2_DISABLED', 'La Fase 2 GRC no está habilitada para esta empresa.', 403);
    }
  }

  async function assertPermission({ userId, role, permission }) {
    if (PLATFORM_ROLES.has(String(role || '').toLowerCase())) return;
    if (!userId) throw new Phase2Error('PHASE2_USER_REQUIRED', 'Usuario no identificado.', 401);
    const result = await pool.query(
      'SELECT user_has_permission($1::uuid, $2::text) AS allowed',
      [userId, permission]
    );
    if (result.rows[0]?.allowed !== true) {
      throw new Phase2Error('PHASE2_PERMISSION_DENIED', `Permiso requerido: ${permission}.`, 403);
    }
  }

  async function recordEvent(client, {
    tenantId,
    userId,
    eventName,
    aggregateType,
    aggregateId,
    aggregateVersion = 1,
    payload = {},
    provenance = { source: 'tcdx_phase2' },
    correlationId = null,
    causationId = null,
    idempotencyKey,
  }) {
    const inserted = await client.query(
      `INSERT INTO grc_domain_events (
         tenant_id, event_name, aggregate_type, aggregate_id, aggregate_version,
         payload, provenance, correlation_id, causation_id, idempotency_key, recorded_by
       ) VALUES (
         $1::uuid, $2, $3, $4::uuid, $5, $6::jsonb, $7::jsonb, $8, $9::uuid, $10, $11::uuid
       )
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        tenantId, eventName, aggregateType, aggregateId, aggregateVersion,
        json(payload), json(provenance), correlationId, causationId, idempotencyKey, userId || null,
      ]
    );
    if (!inserted.rowCount) {
      const existing = await client.query(
        'SELECT * FROM grc_domain_events WHERE tenant_id=$1::uuid AND idempotency_key=$2',
        [tenantId, idempotencyKey]
      );
      return { event: existing.rows[0], reused: true, effects: [] };
    }

    const event = inserted.rows[0];
    const effects = evaluateRules(eventName, payload, new Date(clock()));
    for (let index = 0; index < effects.length; index += 1) {
      const effect = effects[index];
      let output = effect;
      if (effect.kind === 'alert') {
        const alert = await client.query(
          `INSERT INTO grc_operational_alerts (
             tenant_id, code, severity, title, description, entity_type, entity_id,
             source_event_id, due_at, owner_user_id, metadata
           ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$8::uuid,$9::timestamptz,$10::uuid,$11::jsonb)
           RETURNING id, code, severity, status`,
          [
            tenantId, effect.code, effect.severity, effect.title, effect.description,
            aggregateType, aggregateId, event.id, effect.dueAt || null,
            payload.owner_user_id || null, json(effect.metadata),
          ]
        );
        output = { ...effect, alert: alert.rows[0] };
      }
      if (effect.kind === 'metric') {
        const provenanceValue = {
          source_event_id: event.id,
          event_name: eventName,
          ...(effect.provenance || {}),
        };
        const metric = await client.query(
          `INSERT INTO grc_metric_observations (
             tenant_id, metric_code, metric_type, numeric_value, unit, observed_at,
             entity_type, entity_id, source_type, source_id, provenance
           ) VALUES ($1::uuid,$2,$3,$4,$5,$6::timestamptz,$7,$8::uuid,'domain_event',$9::uuid,$10::jsonb)
           RETURNING id, metric_code, numeric_value, unit`,
          [
            tenantId, effect.code, effect.metricType, effect.numericValue, effect.unit,
            event.occurred_at, aggregateType, aggregateId, event.id, json(provenanceValue),
          ]
        );
        output = { ...effect, metric: metric.rows[0] };
      }
      if (effect.kind === 'assurance' && payload.tenant_control_id) {
        const assurance = await client.query(
          `INSERT INTO grc_control_assurance (
             tenant_id, tenant_control_id, assurance_status, score, reason_codes, source_event_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4,ARRAY[$5]::text[],$6::uuid)
           ON CONFLICT (tenant_id, tenant_control_id) DO UPDATE SET
             assurance_status=EXCLUDED.assurance_status,
             score=EXCLUDED.score,
             reason_codes=EXCLUDED.reason_codes,
             source_event_id=EXCLUDED.source_event_id,
             calculated_at=now()
           RETURNING id, assurance_status, score`,
          [tenantId, payload.tenant_control_id, effect.status, effect.score, effect.reason, event.id]
        );
        output = { ...effect, assurance: assurance.rows[0] };
      }
      if (effect.kind === 'event') {
        const nested = await recordEvent(client, {
          tenantId,
          userId,
          eventName: effect.eventName,
          aggregateType,
          aggregateId,
          payload: { ...payload, source_event_id: event.id },
          provenance: { source: 'phase2_rule', rule_code: effect.ruleCode },
          correlationId,
          causationId: event.id,
          idempotencyKey: `${idempotencyKey}:effect:${index + 1}`,
        });
        output = { ...effect, event: nested.event };
      }
      await client.query(
        `INSERT INTO grc_rule_executions (
           tenant_id, event_id, rule_code, rule_version, matched, explanation, inputs, outputs
         ) VALUES ($1::uuid,$2::uuid,$3,$4,TRUE,$5,$6::jsonb,$7::jsonb)`,
        [
          tenantId, event.id, effect.ruleCode, effect.ruleVersion,
          effect.explanation, json(payload), json(output),
        ]
      );
    }
    return { event, reused: false, effects };
  }

  async function getMeta({ tenantId, userId, role }) {
    const moduleResult = await pool.query(
      `SELECT sm.module_key, sm.display_name,
              COALESCE(tms.is_enabled, sm.default_enabled, FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key=sm.module_key AND tms.tenant_id=$1::uuid
       WHERE sm.module_key='grc_phase2_integrated' AND sm.is_active=TRUE`,
      [tenantId]
    );
    const permissions = PLATFORM_ROLES.has(String(role || '').toLowerCase())
      ? { platform: true }
      : (await pool.query(
        `SELECT p.permission_key, user_has_permission($1::uuid,p.permission_key) AS allowed
         FROM permissions p
         WHERE p.permission_group IN ('privacy','incidents','suppliers','connectors','reporting')
           AND p.is_active=TRUE ORDER BY p.permission_key`,
        [userId]
      )).rows.reduce((map, row) => ({ ...map, [row.permission_key]: row.allowed === true }), {});
    return {
      module: moduleResult.rows[0] || { module_key: 'grc_phase2_integrated', is_enabled: false },
      permissions,
    };
  }

  async function assertTenantEntity(client, tenantId, entityType, entityId) {
    const registry = {
      requirement: { table: 'grc_framework_requirements', tenant: '(tenant_id=$1::uuid OR tenant_id IS NULL)' },
      obligation: { table: 'grc_obligations', tenant: 'tenant_id=$1::uuid' },
      process: { table: 'tenant_processes', tenant: 'tenant_id=$1::uuid' },
      operation: { table: 'tenant_operations', tenant: 'tenant_id=$1::uuid' },
      asset: { table: 'assets', tenant: 'tenant_id=$1::uuid' },
      supplier: { table: 'grc_suppliers', tenant: 'tenant_id=$1::uuid' },
      processing_activity: { table: 'privacy_processing_activities', tenant: 'tenant_id=$1::uuid' },
      dpia: { table: 'privacy_dpias', tenant: 'tenant_id=$1::uuid' },
      privacy_request: { table: 'privacy_data_subject_requests', tenant: 'tenant_id=$1::uuid' },
      privacy_breach: { table: 'privacy_breaches', tenant: 'tenant_id=$1::uuid' },
      incident: { table: 'grc_incidents', tenant: 'tenant_id=$1::uuid' },
      control: { table: 'tenant_controls', tenant: 'tenant_id=$1::uuid' },
      evidence: { table: 'evidences', tenant: 'tenant_id=$1::uuid' },
      metric: { table: 'grc_metric_observations', tenant: 'tenant_id=$1::uuid' },
      audit: { table: 'audits', tenant: 'tenant_id=$1::uuid' },
      finding: { table: 'findings', tenant: 'tenant_id=$1::uuid' },
      nonconformity: { table: 'tenant_nonconformities', tenant: 'tenant_id=$1::uuid' },
      action: { table: 'action_plans', tenant: 'tenant_id=$1::uuid' },
      connector: { table: 'tenant_integrations', tenant: 'tenant_id=$1::uuid' },
      external_record: { table: 'grc_external_records', tenant: 'tenant_id=$1::uuid' },
    };
    const target = registry[entityType];
    if (!target) throw new Phase2Error('PHASE2_ENTITY_TYPE_INVALID', 'Tipo de entidad no permitido.', 400);
    const result = await client.query(
      `SELECT id FROM ${target.table} WHERE ${target.tenant} AND id=$2::uuid LIMIT 1`,
      [tenantId, uuid(entityId)]
    );
    if (!result.rowCount) throw new Phase2Error('PHASE2_ENTITY_NOT_FOUND', 'Entidad no encontrada en el tenant.', 404);
  }

  async function createRelation({ tenantId, userId, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, body.source_type, body.source_id);
      await assertTenantEntity(client, tenantId, body.target_type, body.target_id);
      const result = await client.query(
        `INSERT INTO grc_phase2_relations (
           tenant_id, source_type, source_id, target_type, target_id, relation_type,
           status, valid_from, valid_to, provenance, confidence, created_by
         ) VALUES (
           $1::uuid,$2,$3::uuid,$4,$5::uuid,$6,'active',
           COALESCE($7::timestamptz,now()),$8::timestamptz,$9::jsonb,$10,$11::uuid
         ) RETURNING *`,
        [
          tenantId, body.source_type, body.source_id, body.target_type, body.target_id,
          requiredText(body.relation_type, 'PHASE2_RELATION_TYPE_REQUIRED', 120),
          body.valid_from || null, body.valid_to || null,
          json(object(body.provenance, { source: 'manual' })),
          Math.max(0, Math.min(100, Number(body.confidence ?? 100))), userId || null,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_phase2_relations',
        recordId: result.rows[0].id, newData: result.rows[0],
      });
      return result.rows[0];
    });
  }

  async function listProcessingActivities(tenantId, filters = {}) {
    const limit = clampLimit(filters.limit);
    const values = [tenantId, limit];
    const clauses = ['p.tenant_id=$1::uuid'];
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`p.status=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT p.*,
              tp.name AS process_name, op.name AS operation_name,
              u.full_name AS owner_name, s.legal_name AS supplier_name,
              (SELECT COUNT(*)::int FROM privacy_dpias d WHERE d.processing_activity_id=p.id) AS dpia_count,
              (SELECT COUNT(*)::int FROM privacy_processors pr WHERE pr.processing_activity_id=p.id AND pr.status='active') AS processor_count
       FROM privacy_processing_activities p
       LEFT JOIN tenant_processes tp ON tp.id=p.process_id AND tp.tenant_id=p.tenant_id
       LEFT JOIN tenant_operations op ON op.id=p.operation_id AND op.tenant_id=p.tenant_id
       LEFT JOIN users u ON u.id=p.owner_user_id
       LEFT JOIN grc_suppliers s ON s.id=p.primary_supplier_id AND s.tenant_id=p.tenant_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY p.updated_at DESC LIMIT $2`,
      values
    );
    return result.rows;
  }

  async function createProcessingActivity({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      const code = requiredText(body.code, 'PRIVACY_ACTIVITY_CODE_REQUIRED', 80);
      const name = requiredText(body.name, 'PRIVACY_ACTIVITY_NAME_REQUIRED', 240);
      const result = await client.query(
        `INSERT INTO privacy_processing_activities (
           tenant_id, code, name, description, process_id, operation_id, owner_user_id,
           legal_basis, legal_basis_source, purposes, data_subject_categories,
           data_categories, sensitive_data_categories, data_sources, recipients,
           retention_period, retention_basis, deletion_method, international_transfers,
           systems, asset_ids, primary_supplier_id, dpia_required, next_review_at,
           metadata, created_by
         ) VALUES (
           $1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10::jsonb,$11::jsonb,
           $12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19::jsonb,
           $20::jsonb,$21::uuid[],$22::uuid,$23,$24::timestamptz,$25::jsonb,$26::uuid
         ) RETURNING *`,
        [
          tenantId, code, name, optionalText(body.description), body.process_id || null,
          body.operation_id || null, body.owner_user_id || userId || null,
          optionalText(body.legal_basis, 500), optionalText(body.legal_basis_source, 1000),
          json(array(body.purposes), []), json(array(body.data_subject_categories), []),
          json(array(body.data_categories), []), json(array(body.sensitive_data_categories), []),
          json(array(body.data_sources), []), json(array(body.recipients), []),
          optionalText(body.retention_period, 500), optionalText(body.retention_basis, 1000),
          optionalText(body.deletion_method, 1000), json(array(body.international_transfers), []),
          json(array(body.systems), []), array(body.asset_ids), body.primary_supplier_id || null,
          asBoolean(body.dpia_required) || array(body.sensitive_data_categories).length > 0,
          body.next_review_at || null, json(object(body.metadata)), userId || null,
        ]
      );
      const row = result.rows[0];
      await client.query(
        `INSERT INTO privacy_processing_versions (
           tenant_id, processing_activity_id, version, snapshot, change_reason, created_by
         ) VALUES ($1::uuid,$2::uuid,1,$3::jsonb,'initial',$4::uuid)`,
        [tenantId, row.id, json(row), userId || null]
      );
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'privacy_processing_activities',
        recordId: row.id, newData: row,
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'privacy.processing.created',
        aggregateType: 'processing_activity', aggregateId: row.id,
        payload: {
          sensitive_data: row.sensitive_data_categories.length > 0,
          retention_period: row.retention_period,
          dpia_approved: false,
          owner_user_id: row.owner_user_id,
        },
        correlationId, idempotencyKey: `privacy.processing.created:${row.id}:1`,
      });
      return row;
    });
  }

  async function getProcessing360(tenantId, id) {
    const activity = await pool.query(
      `SELECT p.*,tp.name AS process_name,op.name AS operation_name,u.full_name AS owner_name
       FROM privacy_processing_activities p
       LEFT JOIN tenant_processes tp ON tp.id=p.process_id AND tp.tenant_id=p.tenant_id
       LEFT JOIN tenant_operations op ON op.id=p.operation_id AND op.tenant_id=p.tenant_id
       LEFT JOIN users u ON u.id=p.owner_user_id
       WHERE p.tenant_id=$1::uuid AND p.id=$2::uuid`,
      [tenantId, uuid(id)]
    );
    if (!activity.rowCount) throw new Phase2Error('PRIVACY_ACTIVITY_NOT_FOUND', 'Actividad no encontrada.', 404);
    const [dpias, processors, versions, requests, breaches, relations, alerts] = await Promise.all([
      pool.query('SELECT * FROM privacy_dpias WHERE tenant_id=$1::uuid AND processing_activity_id=$2::uuid ORDER BY created_at DESC', [tenantId, id]),
      pool.query(`SELECT pr.*,s.legal_name,s.criticality,a.status AS assessment_status,a.expires_at
                  FROM privacy_processors pr JOIN grc_suppliers s ON s.id=pr.supplier_id
                  LEFT JOIN grc_supplier_assessments a ON a.id=pr.tprm_assessment_id
                  WHERE pr.tenant_id=$1::uuid AND pr.processing_activity_id=$2::uuid`, [tenantId, id]),
      pool.query('SELECT * FROM privacy_processing_versions WHERE tenant_id=$1::uuid AND processing_activity_id=$2::uuid ORDER BY version DESC', [tenantId, id]),
      pool.query('SELECT * FROM privacy_data_subject_requests WHERE tenant_id=$1::uuid AND $2::uuid=ANY(processing_activity_ids) ORDER BY received_at DESC', [tenantId, id]),
      pool.query('SELECT * FROM privacy_breaches WHERE tenant_id=$1::uuid AND processing_activity_id=$2::uuid ORDER BY detected_at DESC', [tenantId, id]),
      pool.query(`SELECT * FROM grc_phase2_relations WHERE tenant_id=$1::uuid
                  AND ((source_type='processing_activity' AND source_id=$2::uuid)
                    OR (target_type='processing_activity' AND target_id=$2::uuid))
                  ORDER BY created_at DESC`, [tenantId, id]),
      pool.query(`SELECT * FROM grc_operational_alerts WHERE tenant_id=$1::uuid
                  AND entity_type='processing_activity' AND entity_id=$2::uuid ORDER BY created_at DESC`, [tenantId, id]),
    ]);
    return {
      activity: activity.rows[0],
      dpias: dpias.rows,
      processors: processors.rows,
      versions: versions.rows,
      requests: requests.rows,
      breaches: breaches.rows,
      relations: relations.rows,
      alerts: alerts.rows,
    };
  }

  async function transitionProcessing({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM privacy_processing_activities WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('PRIVACY_ACTIVITY_NOT_FOUND', 'Actividad no encontrada.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'PRIVACY_STATUS_REQUIRED', 40);
      assertTransition('processing', row.status, next);
      if (next === 'approved') {
        if (!row.legal_basis || !row.retention_period) {
          throw new Phase2Error('PRIVACY_APPROVAL_PREREQUISITES', 'Base jurídica y retención son obligatorias.', 409);
        }
        if (row.dpia_required) {
          const dpia = await client.query(
            `SELECT 1 FROM privacy_dpias WHERE tenant_id=$1::uuid
             AND processing_activity_id=$2::uuid AND status='approved' LIMIT 1`,
            [tenantId, id]
          );
          if (!dpia.rowCount) throw new Phase2Error('PRIVACY_DPIA_REQUIRED', 'La DPIA aprobada es obligatoria.', 409);
        }
      }
      const version = Number(row.version) + 1;
      const updated = await client.query(
        `UPDATE privacy_processing_activities SET status=$3,version=$4,
           approved_by=CASE WHEN $3='approved' THEN $5::uuid ELSE approved_by END,
           approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, id, next, version, userId || null]
      );
      await client.query(
        `INSERT INTO privacy_processing_versions (
           tenant_id,processing_activity_id,version,snapshot,change_reason,created_by
         ) VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5,$6::uuid)`,
        [tenantId, id, version, json(updated.rows[0]), requiredText(body.reason, 'PRIVACY_TRANSITION_REASON_REQUIRED', 1000), userId || null]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'privacy_processing_activities',
        recordId: id, oldData: row, newData: updated.rows[0],
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'privacy.processing.reviewed',
        aggregateType: 'processing_activity', aggregateId: id, aggregateVersion: version,
        payload: { status: next, processor_without_current_tprm: false },
        correlationId, idempotencyKey: `privacy.processing.reviewed:${id}:${version}`,
      });
      return updated.rows[0];
    });
  }

  async function createDpia({ tenantId, userId, id, body }) {
    return withTransaction(async client => {
      const activity = await client.query(
        'SELECT id FROM privacy_processing_activities WHERE tenant_id=$1::uuid AND id=$2::uuid',
        [tenantId, uuid(id)]
      );
      if (!activity.rowCount) throw new Phase2Error('PRIVACY_ACTIVITY_NOT_FOUND', 'Actividad no encontrada.', 404);
      const result = await client.query(
        `INSERT INTO privacy_dpias (
           tenant_id,processing_activity_id,screening,necessity_assessment,
           proportionality_assessment,consultation,residual_risk_level,conditions,
           owner_user_id,next_review_at
         ) VALUES ($1::uuid,$2::uuid,$3::jsonb,$4,$5,$6::jsonb,$7,$8::jsonb,$9::uuid,$10::timestamptz)
         RETURNING *`,
        [
          tenantId, id, json(object(body.screening)), optionalText(body.necessity_assessment),
          optionalText(body.proportionality_assessment), json(object(body.consultation)),
          body.residual_risk_level || null, json(array(body.conditions), []),
          body.owner_user_id || userId || null, body.next_review_at || null,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'privacy_dpias',
        recordId: result.rows[0].id, newData: result.rows[0],
      });
      return result.rows[0];
    });
  }

  async function listDpias(tenantId, filters = {}) {
    const result = await pool.query(
      `SELECT d.*,p.code AS processing_code,p.name AS processing_name,
              COUNT(r.id)::int AS risk_count,
              COALESCE(MAX(r.residual_score),0)::int AS maximum_residual_score
       FROM privacy_dpias d
       JOIN privacy_processing_activities p
         ON p.id=d.processing_activity_id AND p.tenant_id=d.tenant_id
       LEFT JOIN privacy_dpia_risks r ON r.dpia_id=d.id AND r.tenant_id=d.tenant_id
       WHERE d.tenant_id=$1::uuid AND ($2::text IS NULL OR d.status=$2)
       GROUP BY d.id,p.code,p.name
       ORDER BY d.updated_at DESC LIMIT $3`,
      [tenantId, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function addProcessingProcessor({ tenantId, id, body }) {
    const result = await pool.query(
      `INSERT INTO privacy_processors (
         tenant_id,processing_activity_id,supplier_id,role,purpose,contract_id,
         tprm_assessment_id,valid_from,valid_to,status
       )
       SELECT $1::uuid,p.id,s.id,$4,$5,$6::uuid,$7::uuid,$8::date,$9::date,COALESCE($10,'active')
       FROM privacy_processing_activities p
       JOIN grc_suppliers s ON s.tenant_id=p.tenant_id AND s.id=$3::uuid
       WHERE p.tenant_id=$1::uuid AND p.id=$2::uuid
       RETURNING *`,
      [
        tenantId, uuid(id), uuid(body.supplier_id, 'PRIVACY_PROCESSOR_SUPPLIER_REQUIRED'),
        body.role || 'processor', requiredText(body.purpose, 'PRIVACY_PROCESSOR_PURPOSE_REQUIRED', 2000),
        body.contract_id || null, body.tprm_assessment_id || null,
        body.valid_from || null, body.valid_to || null, body.status || null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('PRIVACY_PROCESSOR_PREREQUISITES', 'Actividad o proveedor no disponible.', 404);
    return result.rows[0];
  }

  async function createConsent({ tenantId, body }) {
    const result = await pool.query(
      `INSERT INTO privacy_consents (
         tenant_id,processing_activity_id,subject_reference_hash,purpose_code,status,
         captured_at,withdrawn_at,source,evidence_id,provenance
       )
       SELECT $1::uuid,p.id,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9::uuid,$10::jsonb
       FROM privacy_processing_activities p
       WHERE p.tenant_id=$1::uuid AND p.id=$2::uuid RETURNING *`,
      [
        tenantId, uuid(body.processing_activity_id),
        hashToken(requiredText(body.subject_reference, 'PRIVACY_CONSENT_SUBJECT_REQUIRED', 500)),
        requiredText(body.purpose_code, 'PRIVACY_CONSENT_PURPOSE_REQUIRED', 100),
        body.status || 'granted', body.captured_at || new Date(clock()).toISOString(),
        body.withdrawn_at || null, requiredText(body.source, 'PRIVACY_CONSENT_SOURCE_REQUIRED', 500),
        body.evidence_id || null, json(object(body.provenance, { source: 'manual' })),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('PRIVACY_ACTIVITY_NOT_FOUND', 'Actividad no encontrada.', 404);
    return result.rows[0];
  }

  async function transitionDpia({ tenantId, userId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM privacy_dpias WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('PRIVACY_DPIA_NOT_FOUND', 'DPIA no encontrada.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'PRIVACY_DPIA_STATUS_REQUIRED', 40);
      assertTransition('dpia', row.status, next);
      if (next === 'approved') {
        const risks = await client.query(
          'SELECT COUNT(*)::int AS count FROM privacy_dpia_risks WHERE tenant_id=$1::uuid AND dpia_id=$2::uuid',
          [tenantId, id]
        );
        if (!row.necessity_assessment || !row.proportionality_assessment || Number(risks.rows[0].count) < 1) {
          throw new Phase2Error('PRIVACY_DPIA_INCOMPLETE', 'Necesidad, proporcionalidad y riesgos son obligatorios.', 409);
        }
      }
      const updated = await client.query(
        `UPDATE privacy_dpias SET status=$3,
           approved_by=CASE WHEN $3='approved' THEN $4::uuid ELSE approved_by END,
           approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, id, next, userId || null]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'privacy_dpias',
        recordId: id, oldData: row, newData: updated.rows[0],
      });
      return updated.rows[0];
    });
  }

  async function addDpiaRisk({ tenantId, userId, id, body }) {
    const result = await pool.query(
      `INSERT INTO privacy_dpia_risks (
         tenant_id,dpia_id,title,description,likelihood,impact,residual_likelihood,
         residual_impact,tenant_control_id,treatment,owner_user_id
       )
       SELECT $1::uuid,d.id,$3,$4,$5,$6,$7,$8,$9::uuid,$10,$11::uuid
       FROM privacy_dpias d WHERE d.tenant_id=$1::uuid AND d.id=$2::uuid
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.title, 'PRIVACY_DPIA_RISK_TITLE_REQUIRED', 240),
        optionalText(body.description), Number(body.likelihood), Number(body.impact),
        Number(body.residual_likelihood), Number(body.residual_impact),
        body.tenant_control_id || null, optionalText(body.treatment), body.owner_user_id || userId || null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('PRIVACY_DPIA_NOT_FOUND', 'DPIA no encontrada.', 404);
    return result.rows[0];
  }

  async function createPrivacyRequest({ tenantId, userId, correlationId, body }) {
    const dueDays = Math.max(1, Math.min(365, Number(body.due_days) || 30));
    return withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO privacy_data_subject_requests (
           tenant_id,request_number,request_type,subject_reference,identity_verification,
           received_at,due_at,owner_user_id,processing_activity_ids,systems,
           normative_source,created_by
         ) VALUES (
           $1::uuid,$2,$3,$4,$5::jsonb,COALESCE($6::timestamptz,now()),
           COALESCE($6::timestamptz,now()) + ($7::text || ' days')::interval,
           $8::uuid,$9::uuid[],$10::jsonb,$11,$12::uuid
         ) RETURNING *`,
        [
          tenantId, requiredText(body.request_number, 'PRIVACY_REQUEST_NUMBER_REQUIRED', 100),
          requiredText(body.request_type, 'PRIVACY_REQUEST_TYPE_REQUIRED', 40),
          requiredText(body.subject_reference, 'PRIVACY_SUBJECT_REFERENCE_REQUIRED', 240),
          json(object(body.identity_verification)), body.received_at || null, dueDays,
          body.owner_user_id || userId || null, array(body.processing_activity_ids),
          json(array(body.systems), []),
          requiredText(body.normative_source, 'PRIVACY_NORMATIVE_SOURCE_REQUIRED', 500),
          userId || null,
        ]
      );
      const row = result.rows[0];
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'privacy_data_subject_requests',
        recordId: row.id, newData: row,
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'privacy.request.opened',
        aggregateType: 'privacy_request', aggregateId: row.id,
        payload: { due_at: row.due_at, owner_user_id: row.owner_user_id },
        correlationId, idempotencyKey: `privacy.request.opened:${row.id}`,
      });
      return row;
    });
  }

  async function transitionPrivacyRequest({ tenantId, userId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM privacy_data_subject_requests WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('PRIVACY_REQUEST_NOT_FOUND', 'Solicitud no encontrada.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'PRIVACY_REQUEST_STATUS_REQUIRED', 40);
      assertTransition('privacy_request', row.status, next);
      const closingResponse = row.response_summary || optionalText(body.response_summary);
      const closingEvidence = row.response_evidence_ids.length
        ? row.response_evidence_ids
        : array(body.response_evidence_ids);
      if (next === 'closed' && (!closingResponse || !closingEvidence.length)) {
        throw new Phase2Error('PRIVACY_REQUEST_CLOSURE_EVIDENCE_REQUIRED', 'Respuesta y evidencia son obligatorias para cerrar.', 409);
      }
      const updated = await client.query(
        `UPDATE privacy_data_subject_requests SET status=$3,
           identity_verification=COALESCE($4::jsonb,identity_verification),
           extension_until=COALESCE($5::timestamptz,extension_until),
           extension_reason=COALESCE($6,extension_reason),
           response_summary=COALESCE($7,response_summary),
           response_evidence_ids=CASE WHEN cardinality($8::uuid[])>0 THEN $8::uuid[] ELSE response_evidence_ids END,
           approved_by=CASE WHEN $3='responded' THEN $9::uuid ELSE approved_by END,
           approved_at=CASE WHEN $3='responded' THEN now() ELSE approved_at END,
           closed_at=CASE WHEN $3='closed' THEN now() ELSE closed_at END,
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [
          tenantId, id, next,
          body.identity_verification ? json(object(body.identity_verification)) : null,
          body.extension_until || null, optionalText(body.extension_reason),
          optionalText(body.response_summary), array(body.response_evidence_ids), userId || null,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'privacy_data_subject_requests',
        recordId: id, oldData: row, newData: updated.rows[0],
      });
      return updated.rows[0];
    });
  }

  async function createPrivacyBreach({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO privacy_breaches (
           tenant_id,breach_number,processing_activity_id,incident_id,occurred_at,
           data_categories,affected_subjects_estimate,impact_summary,
           notification_assessment,notification_due_at,owner_user_id
         ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5::timestamptz,$6::jsonb,$7,$8,$9::jsonb,$10::timestamptz,$11::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.breach_number, 'PRIVACY_BREACH_NUMBER_REQUIRED', 100),
          body.processing_activity_id || null, body.incident_id || null, body.occurred_at || null,
          json(array(body.data_categories), []), body.affected_subjects_estimate ?? null,
          requiredText(body.impact_summary, 'PRIVACY_BREACH_IMPACT_REQUIRED', 5000),
          json(object(body.notification_assessment)), body.notification_due_at || null,
          body.owner_user_id || userId || null,
        ]
      );
      const row = result.rows[0];
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'privacy_breaches',
        recordId: row.id, newData: row,
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'privacy.breach.opened',
        aggregateType: 'privacy_breach', aggregateId: row.id,
        payload: {
          severity: body.severity || 'high',
          notification_due_at: row.notification_due_at,
          owner_user_id: row.owner_user_id,
        },
        correlationId, idempotencyKey: `privacy.breach.opened:${row.id}`,
      });
      return row;
    });
  }

  async function privacyOverview(tenantId) {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM privacy_processing_activities WHERE tenant_id=$1::uuid AND status='active') AS active_activities,
        (SELECT COUNT(*)::int FROM privacy_processing_activities WHERE tenant_id=$1::uuid AND legal_basis IS NULL AND status<>'retired') AS activities_without_legal_basis,
        (SELECT COUNT(*)::int FROM privacy_processing_activities WHERE tenant_id=$1::uuid AND retention_period IS NULL AND status<>'retired') AS activities_without_retention,
        (SELECT COUNT(*)::int FROM privacy_processing_activities p WHERE p.tenant_id=$1::uuid AND p.dpia_required=TRUE AND NOT EXISTS (
          SELECT 1 FROM privacy_dpias d WHERE d.processing_activity_id=p.id AND d.status='approved'
        )) AS dpia_required,
        (SELECT COUNT(*)::int FROM privacy_data_subject_requests WHERE tenant_id=$1::uuid AND status NOT IN ('closed','rejected')) AS open_requests,
        (SELECT COUNT(*)::int FROM privacy_data_subject_requests WHERE tenant_id=$1::uuid AND due_at<now() AND status NOT IN ('closed','rejected')) AS overdue_requests,
        (SELECT COUNT(*)::int FROM privacy_breaches WHERE tenant_id=$1::uuid AND status<>'closed') AS open_breaches`,
      [tenantId]
    );
    return result.rows[0];
  }

  async function listIncidents(tenantId, filters = {}) {
    const values = [tenantId, clampLimit(filters.limit)];
    const clauses = ['i.tenant_id=$1::uuid'];
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`i.status=$${values.length}`);
    }
    if (filters.severity) {
      values.push(filters.severity);
      clauses.push(`COALESCE(i.confirmed_severity,i.calculated_severity)=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT i.*,u.full_name AS commander_name,tp.name AS process_name,
              a.name AS asset_name,s.legal_name AS supplier_name
       FROM grc_incidents i
       LEFT JOIN users u ON u.id=i.commander_user_id
       LEFT JOIN tenant_processes tp ON tp.id=i.process_id AND tp.tenant_id=i.tenant_id
       LEFT JOIN assets a ON a.id=i.asset_id AND a.tenant_id=i.tenant_id
       LEFT JOIN grc_suppliers s ON s.id=i.supplier_id AND s.tenant_id=i.tenant_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY i.reported_at DESC LIMIT $2`,
      values
    );
    return result.rows;
  }

  async function createIncident({ tenantId, userId, correlationId, body }) {
    const severity = calculateIncidentSeverity(object(body.severity_inputs));
    return withTransaction(async client => {
      let recurrenceCount = 1;
      if (body.recurrence_key) {
        const recurrent = await client.query(
          `SELECT COUNT(*)::int AS count FROM grc_incidents
           WHERE tenant_id=$1::uuid AND recurrence_key=$2
             AND reported_at>=now()-interval '365 days'`,
          [tenantId, body.recurrence_key]
        );
        recurrenceCount += Number(recurrent.rows[0].count);
      }
      const result = await client.query(
        `INSERT INTO grc_incidents (
           tenant_id,incident_number,title,description,category,priority,
           calculated_severity,severity_inputs,severity_formula_version,
           commander_user_id,reported_by,detected_at,recurrence_key,
           process_id,operation_id,asset_id,supplier_id,privacy_impact,
           regulatory_impact,customer_impact,financial_impact,duration_minutes,metadata
         ) VALUES (
           $1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::uuid,$11::uuid,
           $12::timestamptz,$13,$14::uuid,$15::uuid,$16::uuid,$17::uuid,
           $18,$19,$20,$21,$22,$23::jsonb
         ) RETURNING *`,
        [
          tenantId, requiredText(body.incident_number, 'INCIDENT_NUMBER_REQUIRED', 100),
          requiredText(body.title, 'INCIDENT_TITLE_REQUIRED', 300), optionalText(body.description),
          requiredText(body.category, 'INCIDENT_CATEGORY_REQUIRED', 100),
          body.priority || 'medium', severity.severity, json(severity),
          severity.formulaVersion, body.commander_user_id || null, userId || null,
          body.detected_at || null, optionalText(body.recurrence_key, 200),
          body.process_id || null, body.operation_id || null, body.asset_id || null,
          body.supplier_id || null, asBoolean(body.privacy_impact),
          asBoolean(body.regulatory_impact), asBoolean(body.customer_impact),
          body.financial_impact ?? null, body.duration_minutes ?? null,
          json(object(body.metadata)),
        ]
      );
      const row = result.rows[0];
      await client.query(
        `INSERT INTO grc_incident_history (
           tenant_id,incident_id,to_status,to_severity,note,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,'reported',$3,$4,$5::uuid,$6::jsonb)`,
        [tenantId, row.id, row.calculated_severity, 'Incident reported', userId || null, json(row)]
      );
      await client.query(
        `INSERT INTO grc_incident_timeline (
           tenant_id,incident_id,event_type,occurred_at,description,actor_user_id,source
         ) VALUES ($1::uuid,$2::uuid,'reported',$3::timestamptz,$4,$5::uuid,'tcdx')`,
        [tenantId, row.id, row.reported_at, 'Incidente reportado.', userId || null]
      );
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_incidents',
        recordId: row.id, newData: row,
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'incident.opened',
        aggregateType: 'incident', aggregateId: row.id,
        payload: {
          recurrence_count: recurrenceCount,
          severity: row.calculated_severity,
          owner_user_id: row.commander_user_id,
        },
        correlationId, idempotencyKey: `incident.opened:${row.id}`,
      });
      return { ...row, severity_explanation: severity, recurrence_count: recurrenceCount };
    });
  }

  async function getIncident360(tenantId, id) {
    const incident = await pool.query(
      `SELECT i.*,u.full_name AS commander_name,tp.name AS process_name,
              op.name AS operation_name,a.name AS asset_name,s.legal_name AS supplier_name
       FROM grc_incidents i
       LEFT JOIN users u ON u.id=i.commander_user_id
       LEFT JOIN tenant_processes tp ON tp.id=i.process_id AND tp.tenant_id=i.tenant_id
       LEFT JOIN tenant_operations op ON op.id=i.operation_id AND op.tenant_id=i.tenant_id
       LEFT JOIN assets a ON a.id=i.asset_id AND a.tenant_id=i.tenant_id
       LEFT JOIN grc_suppliers s ON s.id=i.supplier_id AND s.tenant_id=i.tenant_id
       WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid`,
      [tenantId, uuid(id)]
    );
    if (!incident.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    const queries = await Promise.all([
      pool.query('SELECT * FROM grc_incident_history WHERE tenant_id=$1::uuid AND incident_id=$2::uuid ORDER BY changed_at', [tenantId, id]),
      pool.query('SELECT * FROM grc_incident_timeline WHERE tenant_id=$1::uuid AND incident_id=$2::uuid ORDER BY occurred_at', [tenantId, id]),
      pool.query('SELECT * FROM grc_incident_impacts WHERE tenant_id=$1::uuid AND incident_id=$2::uuid ORDER BY severity DESC', [tenantId, id]),
      pool.query('SELECT * FROM grc_incident_notifications WHERE tenant_id=$1::uuid AND incident_id=$2::uuid ORDER BY due_at', [tenantId, id]),
      pool.query('SELECT * FROM grc_incident_root_causes WHERE tenant_id=$1::uuid AND incident_id=$2::uuid ORDER BY created_at', [tenantId, id]),
      pool.query('SELECT * FROM grc_incident_postmortems WHERE tenant_id=$1::uuid AND incident_id=$2::uuid', [tenantId, id]),
      pool.query(`SELECT * FROM grc_phase2_relations WHERE tenant_id=$1::uuid
                  AND ((source_type='incident' AND source_id=$2::uuid)
                    OR (target_type='incident' AND target_id=$2::uuid)) ORDER BY created_at`, [tenantId, id]),
      pool.query(`SELECT * FROM grc_operational_alerts WHERE tenant_id=$1::uuid
                  AND entity_type='incident' AND entity_id=$2::uuid ORDER BY created_at DESC`, [tenantId, id]),
    ]);
    return {
      incident: incident.rows[0],
      history: queries[0].rows,
      timeline: queries[1].rows,
      impacts: queries[2].rows,
      notifications: queries[3].rows,
      root_causes: queries[4].rows,
      postmortem: queries[5].rows[0] || null,
      relations: queries[6].rows,
      alerts: queries[7].rows,
    };
  }

  function eventForIncidentStatus(status) {
    if (status === 'classified') return 'incident.classified';
    if (status === 'contained') return 'incident.containment.completed';
    if (status === 'resolved') return 'incident.recovery.completed';
    if (status === 'closed') return 'incident.closed';
    return null;
  }

  async function transitionIncident({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM grc_incidents WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'INCIDENT_STATUS_REQUIRED', 40);
      assertTransition('incident', row.status, next);
      const confirmedSeverity = body.confirmed_severity || row.confirmed_severity;
      if (next === 'classified' && !confirmedSeverity) {
        throw new Phase2Error('INCIDENT_SEVERITY_CONFIRMATION_REQUIRED', 'La severidad debe confirmarse.', 409);
      }
      if (next === 'closed') {
        const postmortem = await client.query(
          `SELECT 1 FROM grc_incident_postmortems WHERE tenant_id=$1::uuid
           AND incident_id=$2::uuid AND status='approved'`,
          [tenantId, id]
        );
        const blockingActions = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM grc_phase2_relations r
           JOIN action_plans a ON a.id=r.target_id AND a.tenant_id=r.tenant_id
           WHERE r.tenant_id=$1::uuid AND r.source_type='incident' AND r.source_id=$2::uuid
             AND r.target_type='action' AND r.status='active'
             AND COALESCE(a.priority,'') IN ('alta','high','critical')
             AND COALESCE(a.status,'') NOT IN ('completado','completed','closed','cancelado','cancelled')`,
          [tenantId, id]
        );
        if (!row.effectiveness_verified || !postmortem.rowCount || Number(blockingActions.rows[0].count) > 0) {
          throw new Phase2Error(
            'INCIDENT_CLOSURE_BLOCKED',
            'El cierre exige postmortem aprobado, eficacia verificada y remediales severos cerrados.',
            409
          );
        }
      }
      const severityOverridden = Boolean(
        body.confirmed_severity && body.confirmed_severity !== row.calculated_severity
      );
      if (severityOverridden && !body.severity_override_reason) {
        throw new Phase2Error('INCIDENT_SEVERITY_OVERRIDE_REASON_REQUIRED', 'El override requiere motivo.', 409);
      }
      const updated = await client.query(
        `UPDATE grc_incidents SET
           status=$3,
           confirmed_severity=COALESCE($4,confirmed_severity),
           severity_overridden=$5,
           severity_override_reason=CASE WHEN $5 THEN $6 ELSE severity_override_reason END,
           severity_approved_by=CASE WHEN $4 IS NOT NULL THEN $7::uuid ELSE severity_approved_by END,
           severity_confirmed_at=CASE WHEN $4 IS NOT NULL THEN now() ELSE severity_confirmed_at END,
           contained_at=CASE WHEN $3='contained' THEN now() ELSE contained_at END,
           recovered_at=CASE WHEN $3='resolved' THEN now() ELSE recovered_at END,
           resolved_at=CASE WHEN $3='resolved' THEN now() ELSE resolved_at END,
           closed_at=CASE WHEN $3='closed' THEN now() ELSE closed_at END,
           closure_summary=COALESCE($8,closure_summary),
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [
          tenantId, id, next, body.confirmed_severity || null, severityOverridden,
          optionalText(body.severity_override_reason, 1000), userId || null,
          optionalText(body.closure_summary),
        ]
      );
      const nextRow = updated.rows[0];
      await client.query(
        `INSERT INTO grc_incident_history (
           tenant_id,incident_id,from_status,to_status,from_severity,to_severity,
           note,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::uuid,$9::jsonb)`,
        [
          tenantId, id, row.status, next,
          row.confirmed_severity || row.calculated_severity,
          nextRow.confirmed_severity || nextRow.calculated_severity,
          requiredText(body.note, 'INCIDENT_TRANSITION_NOTE_REQUIRED', 2000),
          userId || null, json(nextRow),
        ]
      );
      await client.query(
        `INSERT INTO grc_incident_timeline (
           tenant_id,incident_id,event_type,occurred_at,description,actor_user_id,source
         ) VALUES ($1::uuid,$2::uuid,$3,now(),$4,$5::uuid,'tcdx')`,
        [tenantId, id, next, body.note, userId || null]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'grc_incidents',
        recordId: id, oldData: row, newData: nextRow,
      });
      const eventName = eventForIncidentStatus(next);
      if (eventName) {
        await recordEvent(client, {
          tenantId, userId, eventName, aggregateType: 'incident', aggregateId: id,
          payload: {
            severity: nextRow.confirmed_severity || nextRow.calculated_severity,
            owner_user_id: nextRow.commander_user_id,
          },
          correlationId, idempotencyKey: `${eventName}:${id}:${next}`,
        });
      }
      return nextRow;
    });
  }

  async function addIncidentTimeline({ tenantId, userId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_incident_timeline (
         tenant_id,incident_id,event_type,occurred_at,description,actor_user_id,
         source,evidence_ids,metadata
       )
       SELECT $1::uuid,i.id,$3,COALESCE($4::timestamptz,now()),$5,$6::uuid,$7,$8::uuid[],$9::jsonb
       FROM grc_incidents i WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.event_type, 'INCIDENT_TIMELINE_TYPE_REQUIRED', 100),
        body.occurred_at || null, requiredText(body.description, 'INCIDENT_TIMELINE_DESCRIPTION_REQUIRED', 5000),
        userId || null, body.source || 'manual', array(body.evidence_ids), json(object(body.metadata)),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    return result.rows[0];
  }

  async function addIncidentImpact({ tenantId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_incident_impacts (
         tenant_id,incident_id,impact_type,entity_id,severity,description,started_at,ended_at,metadata
       )
       SELECT $1::uuid,i.id,$3,$4::uuid,$5,$6,$7::timestamptz,$8::timestamptz,$9::jsonb
       FROM grc_incidents i WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.impact_type, 'INCIDENT_IMPACT_TYPE_REQUIRED', 100),
        body.entity_id || null, body.severity || 'medium',
        requiredText(body.description, 'INCIDENT_IMPACT_DESCRIPTION_REQUIRED', 3000),
        body.started_at || null, body.ended_at || null, json(object(body.metadata)),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    return result.rows[0];
  }

  async function addIncidentNotification({ tenantId, userId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_incident_notifications (
         tenant_id,incident_id,obligation_id,recipient_type,recipient,status,due_at,sent_at,
         evidence_id,approved_by,message_hash
       )
       SELECT $1::uuid,i.id,$3::uuid,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::uuid,
              CASE WHEN $6='approved' OR $6='sent' THEN $10::uuid ELSE NULL END,$11
       FROM grc_incidents i WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid RETURNING *`,
      [
        tenantId, uuid(id), body.obligation_id || null,
        requiredText(body.recipient_type, 'INCIDENT_NOTIFICATION_TYPE_REQUIRED', 100),
        requiredText(body.recipient, 'INCIDENT_NOTIFICATION_RECIPIENT_REQUIRED', 500),
        body.status || 'planned', body.due_at || null, body.sent_at || null,
        body.evidence_id || null, userId || null,
        body.message ? hashToken(String(body.message)) : null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    return result.rows[0];
  }

  async function addIncidentRootCause({ tenantId, userId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_incident_root_causes (
         tenant_id,incident_id,method,cause_category,description,contributing_factors,
         confirmed,confirmed_by,confirmed_at
       )
       SELECT $1::uuid,i.id,$3,$4,$5,$6::jsonb,$7,
              CASE WHEN $7 THEN $8::uuid ELSE NULL END,
              CASE WHEN $7 THEN now() ELSE NULL END
       FROM grc_incidents i WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.method, 'INCIDENT_CAUSE_METHOD_REQUIRED', 100),
        requiredText(body.cause_category, 'INCIDENT_CAUSE_CATEGORY_REQUIRED', 100),
        requiredText(body.description, 'INCIDENT_CAUSE_DESCRIPTION_REQUIRED', 5000),
        json(array(body.contributing_factors), []), asBoolean(body.confirmed), userId || null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    return result.rows[0];
  }

  async function upsertPostmortem({ tenantId, userId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_incident_postmortems (
         tenant_id,incident_id,summary,what_worked,what_failed,lessons,action_plan_ids,status,
         approved_by,approved_at
       )
       SELECT $1::uuid,i.id,$3,$4,$5,$6::jsonb,$7::uuid[],$8,
              CASE WHEN $8='approved' THEN $9::uuid ELSE NULL END,
              CASE WHEN $8='approved' THEN now() ELSE NULL END
       FROM grc_incidents i WHERE i.tenant_id=$1::uuid AND i.id=$2::uuid
       ON CONFLICT (tenant_id,incident_id) DO UPDATE SET
         summary=EXCLUDED.summary,what_worked=EXCLUDED.what_worked,
         what_failed=EXCLUDED.what_failed,lessons=EXCLUDED.lessons,
         action_plan_ids=EXCLUDED.action_plan_ids,status=EXCLUDED.status,
         approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at,updated_at=now()
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.summary, 'INCIDENT_POSTMORTEM_SUMMARY_REQUIRED', 10000),
        optionalText(body.what_worked), optionalText(body.what_failed),
        json(array(body.lessons), []), array(body.action_plan_ids),
        body.status === 'approved' ? 'approved' : body.status === 'under_review' ? 'under_review' : 'draft',
        userId || null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
    return result.rows[0];
  }

  async function verifyIncidentEffectiveness({ tenantId, userId, id, body }) {
    return withTransaction(async client => {
      const incident = await client.query(
        'SELECT * FROM grc_incidents WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!incident.rowCount) throw new Phase2Error('INCIDENT_NOT_FOUND', 'Incidente no encontrado.', 404);
      if (incident.rows[0].status !== 'post_incident_review') {
        throw new Phase2Error('INCIDENT_EFFECTIVENESS_STATE_INVALID', 'La eficacia se verifica en revisión post incidente.', 409);
      }
      const verified = asBoolean(body.effective);
      const updated = await client.query(
        `UPDATE grc_incidents SET effectiveness_verified=$3,updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, id, verified]
      );
      await audit(client, {
        tenantId, userId, action: 'effectiveness_verify', tableName: 'grc_incidents',
        recordId: id, oldData: incident.rows[0], newData: updated.rows[0],
        metadata: { criteria: requiredText(body.criteria, 'INCIDENT_EFFECTIVENESS_CRITERIA_REQUIRED', 5000) },
      });
      return updated.rows[0];
    });
  }

  async function incidentDashboard(tenantId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status<>'closed')::int AS open_incidents,
        COUNT(*) FILTER (WHERE COALESCE(confirmed_severity,calculated_severity)='critical' AND status<>'closed')::int AS critical_incidents,
        COUNT(*) FILTER (WHERE COALESCE(confirmed_severity,calculated_severity)='high' AND status<>'closed')::int AS high_incidents,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(severity_confirmed_at,now())-reported_at))/60)
          FILTER (WHERE severity_confirmed_at IS NOT NULL),2) AS mtta_minutes,
        ROUND(AVG(EXTRACT(EPOCH FROM (contained_at-reported_at))/60)
          FILTER (WHERE contained_at IS NOT NULL),2) AS mttc_minutes,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-reported_at))/60)
          FILTER (WHERE resolved_at IS NOT NULL),2) AS mttr_minutes,
        COUNT(*) FILTER (WHERE recurrence_key IS NOT NULL AND EXISTS (
          SELECT 1 FROM grc_incidents x WHERE x.tenant_id=$1::uuid
          AND x.recurrence_key=grc_incidents.recurrence_key AND x.id<>grc_incidents.id
        ))::int AS repeated_incidents
       FROM grc_incidents WHERE tenant_id=$1::uuid`,
      [tenantId]
    );
    return result.rows[0];
  }

  async function incidentWorkspace(tenantId, filters = {}) {
    const [metrics, incidents] = await Promise.all([
      incidentDashboard(tenantId),
      listIncidents(tenantId, filters),
    ]);
    return { metrics, incidents };
  }

  async function listSuppliers(tenantId, filters = {}) {
    const values = [tenantId, clampLimit(filters.limit)];
    const clauses = ['s.tenant_id=$1::uuid'];
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`s.status=$${values.length}`);
    }
    if (filters.criticality) {
      values.push(filters.criticality);
      clauses.push(`s.criticality=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT s.*,u.full_name AS owner_name,
              (SELECT COUNT(*)::int FROM grc_supplier_services x WHERE x.supplier_id=s.id AND x.active=TRUE) AS service_count,
              (SELECT COUNT(*)::int FROM grc_supplier_assessments a WHERE a.supplier_id=s.id) AS assessment_count,
              (SELECT MAX(a.expires_at) FROM grc_supplier_assessments a WHERE a.supplier_id=s.id AND a.status='approved') AS latest_assessment_expiry
       FROM grc_suppliers s LEFT JOIN users u ON u.id=s.owner_user_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY
         CASE s.criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         s.updated_at DESC LIMIT $2`,
      values
    );
    return result.rows;
  }

  async function createSupplier({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO grc_suppliers (
           tenant_id,code,legal_name,trade_name,tax_identifier,country_code,
           criticality,inherent_risk_score,residual_risk_score,risk_level,
           owner_user_id,data_access_level,access_summary,next_assessment_at,
           metadata,created_by
         ) VALUES (
           $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12,$13,$14::timestamptz,$15::jsonb,$16::uuid
         ) RETURNING *`,
        [
          tenantId, requiredText(body.code, 'SUPPLIER_CODE_REQUIRED', 80),
          requiredText(body.legal_name, 'SUPPLIER_NAME_REQUIRED', 300),
          optionalText(body.trade_name, 300), optionalText(body.tax_identifier, 100),
          optionalText(body.country_code, 3), body.criticality || 'medium',
          body.inherent_risk_score ?? null, body.residual_risk_score ?? null,
          body.risk_level || null, body.owner_user_id || userId || null,
          body.data_access_level || 'none', optionalText(body.access_summary),
          body.next_assessment_at || null, json(object(body.metadata)), userId || null,
        ]
      );
      const row = result.rows[0];
      await client.query(
        `INSERT INTO grc_supplier_history (
           tenant_id,supplier_id,to_status,reason,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,'draft','created',$3::uuid,$4::jsonb)`,
        [tenantId, row.id, userId || null, json(row)]
      );
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_suppliers',
        recordId: row.id, newData: row,
      });
      await recordEvent(client, {
        tenantId, userId, eventName: 'supplier.created',
        aggregateType: 'supplier', aggregateId: row.id,
        payload: {
          criticality: row.criticality,
          current_assessment: false,
          owner_user_id: row.owner_user_id,
        },
        correlationId, idempotencyKey: `supplier.created:${row.id}`,
      });
      return row;
    });
  }

  async function getSupplier360(tenantId, id) {
    const supplier = await pool.query(
      `SELECT s.*,u.full_name AS owner_name FROM grc_suppliers s
       LEFT JOIN users u ON u.id=s.owner_user_id
       WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid`,
      [tenantId, uuid(id)]
    );
    if (!supplier.rowCount) throw new Phase2Error('SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.', 404);
    const result = await Promise.all([
      pool.query(`SELECT ss.*,p.name AS process_name,op.name AS operation_name,a.name AS asset_name
                  FROM grc_supplier_services ss
                  LEFT JOIN tenant_processes p ON p.id=ss.process_id
                  LEFT JOIN tenant_operations op ON op.id=ss.operation_id
                  LEFT JOIN assets a ON a.id=ss.asset_id
                  WHERE ss.tenant_id=$1::uuid AND ss.supplier_id=$2::uuid ORDER BY ss.created_at`, [tenantId, id]),
      pool.query('SELECT * FROM grc_supplier_contracts WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid ORDER BY starts_on DESC NULLS LAST', [tenantId, id]),
      pool.query('SELECT * FROM grc_supplier_assessments WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid ORDER BY created_at DESC', [tenantId, id]),
      pool.query('SELECT * FROM grc_supplier_exit_checks WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid ORDER BY check_type', [tenantId, id]),
      pool.query('SELECT * FROM grc_supplier_history WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid ORDER BY changed_at', [tenantId, id]),
      pool.query(`SELECT * FROM grc_incidents WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid ORDER BY reported_at DESC`, [tenantId, id]),
      pool.query(`SELECT * FROM grc_phase2_relations WHERE tenant_id=$1::uuid
                  AND ((source_type='supplier' AND source_id=$2::uuid)
                    OR (target_type='supplier' AND target_id=$2::uuid)) ORDER BY created_at`, [tenantId, id]),
      pool.query(`SELECT * FROM grc_operational_alerts WHERE tenant_id=$1::uuid
                  AND entity_type='supplier' AND entity_id=$2::uuid ORDER BY created_at DESC`, [tenantId, id]),
    ]);
    return {
      supplier: supplier.rows[0],
      services: result[0].rows,
      contracts: result[1].rows,
      assessments: result[2].rows,
      exit_checks: result[3].rows,
      history: result[4].rows,
      incidents: result[5].rows,
      relations: result[6].rows,
      alerts: result[7].rows,
    };
  }

  async function transitionSupplier({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM grc_suppliers WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'SUPPLIER_STATUS_REQUIRED', 40);
      assertTransition('supplier', row.status, next);
      if (next === 'approved') {
        const assessment = await client.query(
          `SELECT 1 FROM grc_supplier_assessments
           WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid
             AND status='approved' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`,
          [tenantId, id]
        );
        if (!assessment.rowCount || row.residual_risk_score === null) {
          throw new Phase2Error('SUPPLIER_APPROVAL_PREREQUISITES', 'Se requiere evaluación aprobada y riesgo residual.', 409);
        }
      }
      if (next === 'exited') {
        const checks = await client.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status='verified')::int AS verified
           FROM grc_supplier_exit_checks WHERE tenant_id=$1::uuid AND supplier_id=$2::uuid`,
          [tenantId, id]
        );
        if (Number(checks.rows[0].total) < 3 || checks.rows[0].total !== checks.rows[0].verified) {
          throw new Phase2Error('SUPPLIER_EXIT_EVIDENCE_REQUIRED', 'La salida exige controles de revocación, devolución y eliminación verificados.', 409);
        }
      }
      const updated = await client.query(
        `UPDATE grc_suppliers SET status=$3,
           approved_by=CASE WHEN $3='approved' THEN $4::uuid ELSE approved_by END,
           approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, id, next, userId || null]
      );
      await client.query(
        `INSERT INTO grc_supplier_history (
           tenant_id,supplier_id,from_status,to_status,reason,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7::jsonb)`,
        [
          tenantId, id, row.status, next,
          requiredText(body.reason, 'SUPPLIER_TRANSITION_REASON_REQUIRED', 2000),
          userId || null, json(updated.rows[0]),
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'grc_suppliers',
        recordId: id, oldData: row, newData: updated.rows[0],
      });
      const eventName = next === 'exit_in_progress'
        ? 'supplier.exit.started'
        : next === 'exited'
          ? 'supplier.exit.completed'
          : null;
      if (eventName) {
        await recordEvent(client, {
          tenantId, userId, eventName, aggregateType: 'supplier', aggregateId: id,
          payload: { criticality: row.criticality, owner_user_id: row.owner_user_id },
          correlationId, idempotencyKey: `${eventName}:${id}`,
        });
      }
      return updated.rows[0];
    });
  }

  async function addSupplierService({ tenantId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_supplier_services (
         tenant_id,supplier_id,name,description,service_criticality,process_id,
         operation_id,asset_id,dependency_type,metadata
       )
       SELECT $1::uuid,s.id,$3,$4,$5,$6::uuid,$7::uuid,$8::uuid,$9,$10::jsonb
       FROM grc_suppliers s WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.name, 'SUPPLIER_SERVICE_NAME_REQUIRED', 300),
        optionalText(body.description), body.service_criticality || 'medium',
        body.process_id || null, body.operation_id || null, body.asset_id || null,
        body.dependency_type || 'supporting', json(object(body.metadata)),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.', 404);
    return result.rows[0];
  }

  async function addSupplierContract({ tenantId, id, body }) {
    const result = await pool.query(
      `INSERT INTO grc_supplier_contracts (
         tenant_id,supplier_id,contract_number,title,starts_on,ends_on,renewal_on,status,
         security_terms,privacy_terms,exit_terms,owner_user_id,document_id
       )
       SELECT $1::uuid,s.id,$3,$4,$5::date,$6::date,$7::date,$8,
              $9::jsonb,$10::jsonb,$11::jsonb,$12::uuid,$13::uuid
       FROM grc_suppliers s WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.contract_number, 'SUPPLIER_CONTRACT_NUMBER_REQUIRED', 100),
        requiredText(body.title, 'SUPPLIER_CONTRACT_TITLE_REQUIRED', 300),
        body.starts_on || null, body.ends_on || null, body.renewal_on || null,
        body.status || 'draft', json(object(body.security_terms)), json(object(body.privacy_terms)),
        json(object(body.exit_terms)), body.owner_user_id || null, body.document_id || null,
      ]
    );
    if (!result.rowCount) throw new Phase2Error('SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.', 404);
    return result.rows[0];
  }

  async function createQuestionnaireTemplate({ tenantId, userId, body }) {
    return withTransaction(async client => {
      const template = await client.query(
        `INSERT INTO grc_questionnaire_templates (tenant_id,code,name,domain,created_by)
         VALUES ($1::uuid,$2,$3,$4,$5::uuid) RETURNING *`,
        [
          tenantId, requiredText(body.code, 'QUESTIONNAIRE_CODE_REQUIRED', 80),
          requiredText(body.name, 'QUESTIONNAIRE_NAME_REQUIRED', 240),
          requiredText(body.domain, 'QUESTIONNAIRE_DOMAIN_REQUIRED', 100), userId || null,
        ]
      );
      const version = await client.query(
        `INSERT INTO grc_questionnaire_versions (
           tenant_id,template_id,version,status,scoring_model,published_by,published_at
         ) VALUES ($1::uuid,$2::uuid,1,'published',$3::jsonb,$4::uuid,now()) RETURNING *`,
        [tenantId, template.rows[0].id, json(object(body.scoring_model)), userId || null]
      );
      for (let sectionIndex = 0; sectionIndex < array(body.sections).length; sectionIndex += 1) {
        const inputSection = body.sections[sectionIndex];
        const section = await client.query(
          `INSERT INTO grc_questionnaire_sections (
             tenant_id,version_id,code,title,sort_order,condition
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb) RETURNING *`,
          [
            tenantId, version.rows[0].id,
            requiredText(inputSection.code, 'QUESTIONNAIRE_SECTION_CODE_REQUIRED', 80),
            requiredText(inputSection.title, 'QUESTIONNAIRE_SECTION_TITLE_REQUIRED', 240),
            sectionIndex, json(object(inputSection.condition)),
          ]
        );
        for (let questionIndex = 0; questionIndex < array(inputSection.questions).length; questionIndex += 1) {
          const question = inputSection.questions[questionIndex];
          await client.query(
            `INSERT INTO grc_questionnaire_questions (
               tenant_id,section_id,code,prompt,answer_type,required,weight,options,
               condition,evidence_required,risk_mapping,control_mapping,sort_order
             ) VALUES (
               $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13
             )`,
            [
              tenantId, section.rows[0].id,
              requiredText(question.code, 'QUESTIONNAIRE_QUESTION_CODE_REQUIRED', 80),
              requiredText(question.prompt, 'QUESTIONNAIRE_PROMPT_REQUIRED', 2000),
              question.answer_type || 'text', question.required !== false,
              Number(question.weight ?? 1), json(array(question.options), []),
              json(object(question.condition)), asBoolean(question.evidence_required),
              json(object(question.risk_mapping)), json(object(question.control_mapping)), questionIndex,
            ]
          );
        }
      }
      return { template: template.rows[0], version: version.rows[0] };
    });
  }

  async function listQuestionnaires(tenantId) {
    const result = await pool.query(
      `SELECT t.*,v.id AS version_id,v.version,v.status AS version_status,
              (SELECT COUNT(*)::int FROM grc_questionnaire_sections s WHERE s.version_id=v.id) AS section_count,
              (SELECT COUNT(*)::int FROM grc_questionnaire_questions q
               JOIN grc_questionnaire_sections s ON s.id=q.section_id WHERE s.version_id=v.id) AS question_count
       FROM grc_questionnaire_templates t
       JOIN LATERAL (
         SELECT * FROM grc_questionnaire_versions x WHERE x.template_id=t.id
         ORDER BY x.version DESC LIMIT 1
       ) v ON TRUE
       WHERE t.tenant_id=$1::uuid OR t.tenant_id IS NULL
       ORDER BY t.name`,
      [tenantId]
    );
    return result.rows;
  }

  async function createSupplierAssessment({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO grc_supplier_assessments (
           tenant_id,supplier_id,questionnaire_version_id,status,due_at,
           inherent_risk_score,reviewer_user_id,created_by
         )
         SELECT $1::uuid,s.id,$3::uuid,'draft',$4::timestamptz,$5,$6::uuid,$7::uuid
         FROM grc_suppliers s
         JOIN grc_questionnaire_versions v ON v.id=$3::uuid
           AND (v.tenant_id=$1::uuid OR v.tenant_id IS NULL) AND v.status='published'
         WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid
         RETURNING *`,
        [
          tenantId, uuid(id), uuid(body.questionnaire_version_id, 'QUESTIONNAIRE_VERSION_REQUIRED'),
          body.due_at || null, body.inherent_risk_score ?? null,
          body.reviewer_user_id || userId || null, userId || null,
        ]
      );
      if (!result.rowCount) throw new Phase2Error('SUPPLIER_ASSESSMENT_PREREQUISITES', 'Proveedor o cuestionario no disponible.', 404);
      const row = result.rows[0];
      await client.query(
        `INSERT INTO grc_supplier_assessment_history (
           tenant_id,assessment_id,to_status,comment,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,'draft','created',$3::uuid,$4::jsonb)`,
        [tenantId, row.id, userId || null, json(row)]
      );
      await recordEvent(client, {
        tenantId, userId, eventName: 'supplier.assessment.started',
        aggregateType: 'supplier', aggregateId: id,
        payload: { assessment_id: row.id },
        correlationId, idempotencyKey: `supplier.assessment.started:${row.id}`,
      });
      return row;
    });
  }

  async function saveSupplierAnswer({ tenantId, assessmentId, body }) {
    const result = await pool.query(
      `INSERT INTO grc_supplier_answers (
         tenant_id,assessment_id,question_id,answer,score,observation,evidence_ids
       )
       SELECT $1::uuid,a.id,q.id,$4::jsonb,$5,$6,$7::uuid[]
       FROM grc_supplier_assessments a
       JOIN grc_questionnaire_questions q ON q.id=$3::uuid
       JOIN grc_questionnaire_sections s ON s.id=q.section_id
       WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid
         AND s.version_id=a.questionnaire_version_id
         AND a.status IN ('draft','invited','in_progress','remediation_required')
       ON CONFLICT (tenant_id,assessment_id,question_id) DO UPDATE SET
         answer=EXCLUDED.answer,score=EXCLUDED.score,observation=EXCLUDED.observation,
         evidence_ids=EXCLUDED.evidence_ids,updated_at=now()
       RETURNING *`,
      [
        tenantId, uuid(assessmentId), uuid(body.question_id, 'QUESTIONNAIRE_QUESTION_REQUIRED'),
        json(body.answer, null), body.score ?? null, optionalText(body.observation),
        array(body.evidence_ids),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('SUPPLIER_ANSWER_REJECTED', 'Evaluación, pregunta o estado inválido.', 409);
    return result.rows[0];
  }

  async function transitionAssessment({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        `SELECT a.*,s.criticality FROM grc_supplier_assessments a
         JOIN grc_suppliers s ON s.id=a.supplier_id AND s.tenant_id=a.tenant_id
         WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid FOR UPDATE`,
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('SUPPLIER_ASSESSMENT_NOT_FOUND', 'Evaluación no encontrada.', 404);
      const row = current.rows[0];
      const next = requiredText(body.to_status, 'SUPPLIER_ASSESSMENT_STATUS_REQUIRED', 40);
      assertTransition('assessment', row.status, next);
      const questions = await client.query(
        `SELECT q.* FROM grc_questionnaire_questions q
         JOIN grc_questionnaire_sections s ON s.id=q.section_id
         WHERE s.version_id=$1::uuid ORDER BY s.sort_order,q.sort_order`,
        [row.questionnaire_version_id]
      );
      const answers = await client.query(
        'SELECT * FROM grc_supplier_answers WHERE tenant_id=$1::uuid AND assessment_id=$2::uuid',
        [tenantId, id]
      );
      const requiredIds = new Set(questions.rows.filter(question => question.required).map(question => String(question.id)));
      const answeredIds = new Set(answers.rows.map(answer => String(answer.question_id)));
      if (next === 'submitted' && [...requiredIds].some(questionId => !answeredIds.has(questionId))) {
        throw new Phase2Error('SUPPLIER_ASSESSMENT_INCOMPLETE', 'Todas las preguntas obligatorias deben responderse.', 409);
      }
      const scoring = scoreSupplierAssessment({ questions: questions.rows, answers: answers.rows });
      const residualRisk = body.residual_risk_score ?? row.residual_risk_score;
      if (next === 'approved') {
        if (residualRisk === null || residualRisk === undefined) {
          throw new Phase2Error('SUPPLIER_RESIDUAL_RISK_REQUIRED', 'El riesgo residual es obligatorio.', 409);
        }
        if (row.criticality === 'critical' && Number(residualRisk) >= 50 && !body.risk_acceptance_reason) {
          throw new Phase2Error('SUPPLIER_HIGH_RISK_DECISION_REQUIRED', 'El riesgo alto requiere decisión explícita.', 409);
        }
      }
      const updated = await client.query(
        `UPDATE grc_supplier_assessments SET status=$3,score=$4,
           residual_risk_score=COALESCE($5,residual_risk_score),
           submitted_at=CASE WHEN $3='submitted' THEN now() ELSE submitted_at END,
           approved_by=CASE WHEN $3='approved' THEN $6::uuid ELSE approved_by END,
           approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,
           expires_at=CASE WHEN $3='approved' THEN COALESCE($7::timestamptz,now()+interval '365 days') ELSE expires_at END,
           decision_reason=COALESCE($8,decision_reason),updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [
          tenantId, id, next, scoring.score, residualRisk ?? null, userId || null,
          body.expires_at || null,
          optionalText(body.decision_reason || body.risk_acceptance_reason, 3000),
        ]
      );
      await client.query(
        `INSERT INTO grc_supplier_assessment_history (
           tenant_id,assessment_id,from_status,to_status,comment,changed_by,snapshot
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7::jsonb)`,
        [
          tenantId, id, row.status, next,
          requiredText(body.comment, 'SUPPLIER_ASSESSMENT_COMMENT_REQUIRED', 2000),
          userId || null, json({ ...updated.rows[0], scoring }),
        ]
      );
      if (next === 'approved') {
        await client.query(
          `UPDATE grc_suppliers SET residual_risk_score=$3::numeric,
             risk_level=CASE WHEN $3::numeric>=75 THEN 'critical' WHEN $3::numeric>=50 THEN 'high'
               WHEN $3::numeric>=25 THEN 'medium' ELSE 'low' END,
             next_assessment_at=$4::timestamptz,updated_at=now()
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [tenantId, row.supplier_id, Number(residualRisk), updated.rows[0].expires_at]
        );
      }
      const eventName = next === 'submitted'
        ? 'supplier.assessment.submitted'
        : next === 'approved'
          ? 'supplier.assessment.approved'
          : next === 'expired'
            ? 'supplier.assessment.expired'
            : null;
      if (eventName) {
        await recordEvent(client, {
          tenantId, userId, eventName, aggregateType: 'supplier',
          aggregateId: row.supplier_id,
          payload: { assessment_id: id, score: scoring.score, residual_risk_score: residualRisk },
          correlationId, idempotencyKey: `${eventName}:${id}`,
        });
      }
      return { ...updated.rows[0], scoring };
    });
  }

  async function createPortalInvitation({ tenantId, userId, assessmentId, body }) {
    const oneTimeToken = randomToken();
    return withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO grc_supplier_portal_invitations (
           tenant_id,supplier_id,assessment_id,invited_email,token_hash,expires_at,
           max_file_bytes,allowed_mime_types,created_by
         )
         SELECT a.tenant_id,a.supplier_id,a.id,$3,$4,
                COALESCE($5::timestamptz,now()+interval '7 days'),$6,$7::text[],$8::uuid
         FROM grc_supplier_assessments a
         WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid
           AND a.status IN ('draft','invited','in_progress','remediation_required')
         RETURNING id,tenant_id,supplier_id,assessment_id,invited_email,status,
                   expires_at,max_file_bytes,allowed_mime_types,created_at`,
        [
          tenantId, uuid(assessmentId), requiredText(body.email, 'SUPPLIER_PORTAL_EMAIL_REQUIRED', 320),
          hashToken(oneTimeToken), body.expires_at || null,
          Math.max(1024, Math.min(52428800, Number(body.max_file_bytes) || 10485760)),
          array(body.allowed_mime_types).length
            ? array(body.allowed_mime_types)
            : ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'],
          userId || null,
        ]
      );
      if (!result.rowCount) throw new Phase2Error('SUPPLIER_PORTAL_INVITATION_REJECTED', 'Evaluación no disponible para invitación.', 409);
      await client.query(
        `UPDATE grc_supplier_assessments SET status='invited',updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='draft'`,
        [tenantId, assessmentId]
      );
      await audit(client, {
        tenantId, userId, action: 'invite', tableName: 'grc_supplier_portal_invitations',
        recordId: result.rows[0].id, newData: result.rows[0],
      });
      return { invitation: result.rows[0], one_time_token: oneTimeToken };
    });
  }

  async function upsertExitCheck({ tenantId, userId, id, body }) {
    const status = body.status || 'submitted';
    const evidenceIds = array(body.evidence_ids);
    if (status === 'verified' && !evidenceIds.length) {
      throw new Phase2Error('SUPPLIER_EXIT_EVIDENCE_REQUIRED', 'La verificación exige evidencia.', 409);
    }
    const result = await pool.query(
      `INSERT INTO grc_supplier_exit_checks (
         tenant_id,supplier_id,check_type,status,evidence_ids,verified_by,verified_at,notes
       )
       SELECT $1::uuid,s.id,$3,$4,$5::uuid[],
              CASE WHEN $4='verified' THEN $6::uuid ELSE NULL END,
              CASE WHEN $4='verified' THEN now() ELSE NULL END,$7
       FROM grc_suppliers s WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid
       ON CONFLICT (tenant_id,supplier_id,check_type) DO UPDATE SET
         status=EXCLUDED.status,evidence_ids=EXCLUDED.evidence_ids,
         verified_by=EXCLUDED.verified_by,verified_at=EXCLUDED.verified_at,notes=EXCLUDED.notes
       RETURNING *`,
      [
        tenantId, uuid(id), requiredText(body.check_type, 'SUPPLIER_EXIT_CHECK_TYPE_REQUIRED', 100),
        status, evidenceIds, userId || null, optionalText(body.notes),
      ]
    );
    if (!result.rowCount) throw new Phase2Error('SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.', 404);
    return result.rows[0];
  }

  async function supplierPortfolio(tenantId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('exited'))::int AS total_suppliers,
        COUNT(*) FILTER (WHERE criticality='critical' AND status NOT IN ('exited'))::int AS critical_suppliers,
        COUNT(*) FILTER (WHERE status NOT IN ('draft','exited') AND NOT EXISTS (
          SELECT 1 FROM grc_supplier_assessments a WHERE a.supplier_id=grc_suppliers.id
          AND a.status='approved' AND (a.expires_at IS NULL OR a.expires_at>now())
        ))::int AS suppliers_without_current_assessment,
        COUNT(*) FILTER (WHERE residual_risk_score>=50 AND status NOT IN ('exited'))::int AS high_residual_risk,
        COUNT(*) FILTER (WHERE next_assessment_at<now() AND status='active')::int AS overdue_reassessments
       FROM grc_suppliers WHERE tenant_id=$1::uuid`,
      [tenantId]
    );
    return result.rows[0];
  }

  async function supplierWorkspace(tenantId, filters = {}) {
    const [metrics, suppliers] = await Promise.all([
      supplierPortfolio(tenantId),
      listSuppliers(tenantId, filters),
    ]);
    return { metrics, suppliers };
  }

  async function listPrivacyRequests(tenantId, filters = {}) {
    const result = await pool.query(
      `SELECT * FROM privacy_data_subject_requests
       WHERE tenant_id=$1::uuid
         AND ($2::text IS NULL OR status=$2)
       ORDER BY received_at DESC LIMIT $3`,
      [tenantId, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function listPrivacyBreaches(tenantId, filters = {}) {
    const result = await pool.query(
      `SELECT b.*,
              COUNT(*) FILTER (WHERE r.target_type='obligation' AND r.status='active')::int AS obligation_count,
              COUNT(*) FILTER (WHERE r.target_type='action' AND r.status='active')::int AS remedial_count
       FROM privacy_breaches b
       LEFT JOIN grc_phase2_relations r
         ON r.tenant_id=b.tenant_id AND r.source_type='privacy_breach'
        AND r.source_id=b.id
       WHERE b.tenant_id=$1::uuid AND ($2::text IS NULL OR b.status=$2)
       GROUP BY b.id ORDER BY b.detected_at DESC LIMIT $3`,
      [tenantId, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function transitionPrivacyBreach({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM privacy_breaches WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('PRIVACY_BREACH_NOT_FOUND', 'Brecha no encontrada.', 404);
      const target = requiredText(body.to_status || body.status, 'PRIVACY_BREACH_STATUS_REQUIRED', 40);
      try {
        assertTransition('privacy_breach', current.rows[0].status, target);
      } catch (error) {
        throw new Phase2Error(error.code || 'PHASE2_TRANSITION_INVALID', 'Transición de brecha inválida.', 409);
      }
      if (target === 'closed') {
        const blockers = await client.query(
          `SELECT
             NOT EXISTS (
               SELECT 1 FROM grc_phase2_relations
               WHERE tenant_id=$1::uuid AND source_type='privacy_breach' AND source_id=$2::uuid
                 AND target_type='evidence' AND status='active'
             ) AS missing_evidence,
             EXISTS (
               SELECT 1 FROM grc_phase2_relations r
               JOIN action_plans a ON a.id=r.target_id AND a.tenant_id=r.tenant_id
               WHERE r.tenant_id=$1::uuid AND r.source_type='privacy_breach' AND r.source_id=$2::uuid
                 AND r.target_type='action' AND r.status='active'
                 AND COALESCE(a.status,'') NOT IN ('completed','closed')
             ) AS open_remedial`,
          [tenantId, id]
        );
        if (blockers.rows[0].missing_evidence || blockers.rows[0].open_remedial) {
          throw new Phase2Error('PRIVACY_BREACH_CLOSE_BLOCKED', 'El cierre exige evidencia y remediales resueltos.', 409, blockers.rows[0]);
        }
      }
      const changed = await client.query(
        `UPDATE privacy_breaches SET status=$3,
           closed_at=CASE WHEN $3='closed' THEN now() ELSE closed_at END,
           updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, id, target]
      );
      const eventName = target === 'closed' ? 'privacy.breach.closed' : 'privacy.breach.opened';
      await recordEvent(client, {
        tenantId, userId, eventName, aggregateType: 'privacy_breach', aggregateId: id,
        payload: changed.rows[0], correlationId,
        idempotencyKey: `privacy-breach:${id}:${current.rows[0].status}:${target}`,
      });
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: 'privacy_breaches',
        recordId: id, oldData: current.rows[0], newData: changed.rows[0],
      });
      return changed.rows[0];
    });
  }

  async function listAssessments(tenantId, filters = {}) {
    const result = await pool.query(
      `SELECT a.*,s.legal_name AS supplier_name,qv.version AS questionnaire_version,
              qt.name AS questionnaire_name
       FROM grc_supplier_assessments a
       JOIN grc_suppliers s ON s.id=a.supplier_id AND s.tenant_id=a.tenant_id
       JOIN grc_questionnaire_versions qv ON qv.id=a.questionnaire_version_id
       JOIN grc_questionnaire_templates qt ON qt.id=qv.template_id
       WHERE a.tenant_id=$1::uuid
         AND ($2::uuid IS NULL OR a.supplier_id=$2)
         AND ($3::text IS NULL OR a.status=$3)
       ORDER BY a.created_at DESC LIMIT $4`,
      [tenantId, filters.supplier_id || null, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function getAssessment(tenantId, id) {
    const assessment = await pool.query(
      `SELECT a.*,s.legal_name AS supplier_name,qv.version AS questionnaire_version,
              qt.name AS questionnaire_name
       FROM grc_supplier_assessments a
       JOIN grc_suppliers s ON s.id=a.supplier_id AND s.tenant_id=a.tenant_id
       JOIN grc_questionnaire_versions qv ON qv.id=a.questionnaire_version_id
       JOIN grc_questionnaire_templates qt ON qt.id=qv.template_id
       WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid`,
      [tenantId, uuid(id)]
    );
    if (!assessment.rowCount) throw new Phase2Error('SUPPLIER_ASSESSMENT_NOT_FOUND', 'Evaluación no encontrada.', 404);
    const questions = await pool.query(
      `SELECT q.*,s.code AS section_code,s.title AS section_title,
              a.answer,a.score AS answer_score,a.observation,a.evidence_ids,a.answered_at
       FROM grc_questionnaire_questions q
       JOIN grc_questionnaire_sections s ON s.id=q.section_id
       LEFT JOIN grc_supplier_answers a
         ON a.question_id=q.id AND a.tenant_id=$1::uuid AND a.assessment_id=$2::uuid
       WHERE q.tenant_id=$1::uuid
         AND s.version_id=$3::uuid
       ORDER BY s.sort_order,q.sort_order`,
      [tenantId, id, assessment.rows[0].questionnaire_version_id]
    );
    const history = await pool.query(
      `SELECT * FROM grc_supplier_assessment_history
       WHERE tenant_id=$1::uuid AND assessment_id=$2::uuid ORDER BY changed_at`,
      [tenantId, id]
    );
    return { assessment: assessment.rows[0], questions: questions.rows, history: history.rows };
  }

  async function connectorCatalog() {
    const result = await pool.query(
      `SELECT provider,version,display_name,capabilities,supported_scopes,default_mapping,status
       FROM grc_connector_definitions WHERE status='active' ORDER BY display_name`
    );
    return result.rows;
  }

  async function listConnectors(tenantId) {
    const result = await pool.query(
      `SELECT * FROM tenant_integrations WHERE tenant_id=$1::uuid ORDER BY updated_at DESC`,
      [tenantId]
    );
    return result.rows.map(redactIntegration);
  }

  async function createConnector({ tenantId, userId, body }) {
    const provider = requiredText(body.provider, 'CONNECTOR_PROVIDER_REQUIRED', 80);
    const definition = await pool.query(
      `SELECT * FROM grc_connector_definitions
       WHERE provider=$1 AND version=COALESCE($2,version) AND status='active'
       ORDER BY version DESC LIMIT 1`,
      [provider, body.connector_version || null]
    );
    if (!definition.rowCount) throw new Phase2Error('CONNECTOR_PROVIDER_UNSUPPORTED', 'Conector no soportado.', 400);
    const mode = body.execution_mode === 'live' ? 'live' : 'sandbox';
    if (mode === 'live' && !Object.keys(object(body.credentials)).length) {
      throw new Phase2Error('CONNECTOR_CREDENTIALS_REQUIRED', 'El modo live exige credenciales.', 400);
    }
    const envelope = Object.keys(object(body.credentials)).length
      ? encryptCredential(object(body.credentials), environment)
      : {};
    const result = await pool.query(
      `INSERT INTO tenant_integrations (
         tenant_id,provider,status,display_name,connected_by_user_id,scopes,metadata_json,
         connector_version,execution_mode,credential_envelope,schedule,webhook_config,
         rate_limit_config,retry_config,health_status,next_sync_at
       ) VALUES (
         $1::uuid,$2,'connected',$3,$4::uuid,$5,$6::jsonb,$7,$8,$9::jsonb,
         $10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,'unknown',$14::timestamptz
       ) RETURNING *`,
      [
        tenantId, provider, optionalText(body.display_name, 180) || definition.rows[0].display_name,
        userId || null, array(body.scopes).join(' '), json(object(body.metadata)),
        definition.rows[0].version, mode, json(envelope),
        json(object(body.schedule, { enabled: false })), json(object(body.webhook_config)),
        json(object(body.rate_limit_config)), json(object(body.retry_config, { max_attempts: 5, base_seconds: 30 })),
        body.next_sync_at || null,
      ]
    );
    return redactIntegration(result.rows[0]);
  }

  async function updateConnector({ tenantId, userId, id, body }) {
    return withTransaction(async client => {
      const current = await client.query(
        'SELECT * FROM tenant_integrations WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(id)]
      );
      if (!current.rowCount) throw new Phase2Error('CONNECTOR_NOT_FOUND', 'Conector no encontrado.', 404);
      const mode = body.execution_mode || current.rows[0].execution_mode;
      const envelope = Object.keys(object(body.credentials)).length
        ? encryptCredential(object(body.credentials), environment)
        : current.rows[0].credential_envelope;
      const updated = await client.query(
        `UPDATE tenant_integrations SET
           display_name=COALESCE($3,display_name),status=COALESCE($4,status),
           execution_mode=$5,credential_envelope=$6::jsonb,
           scopes=COALESCE($7,scopes),schedule=COALESCE($8::jsonb,schedule),
           webhook_config=COALESCE($9::jsonb,webhook_config),
           rate_limit_config=COALESCE($10::jsonb,rate_limit_config),
           retry_config=COALESCE($11::jsonb,retry_config),updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [
          tenantId, id, optionalText(body.display_name, 180), body.status || null, mode, json(envelope),
          Array.isArray(body.scopes) ? body.scopes.join(' ') : null,
          body.schedule ? json(object(body.schedule)) : null,
          body.webhook_config ? json(object(body.webhook_config)) : null,
          body.rate_limit_config ? json(object(body.rate_limit_config)) : null,
          body.retry_config ? json(object(body.retry_config)) : null,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'update', tableName: 'tenant_integrations',
        recordId: id, oldData: redactIntegration(current.rows[0]), newData: redactIntegration(updated.rows[0]),
      });
      return redactIntegration(updated.rows[0]);
    });
  }

  function oauthProvider(provider) {
    if (['microsoft_graph', 'microsoft_365', 'entra_id', 'onedrive', 'sharepoint'].includes(provider)) return 'microsoft';
    if (['google_workspace', 'google_drive'].includes(provider)) return 'google';
    if (['jira', 'confluence'].includes(provider)) return 'atlassian';
    if (provider === 'github') return 'github';
    throw new Phase2Error('CONNECTOR_OAUTH_UNSUPPORTED', 'OAuth no soportado para el conector.', 400);
  }

  async function prepareConnectorOAuth({ tenantId, id }) {
    const result = await pool.query(
      `SELECT * FROM tenant_integrations
       WHERE tenant_id=$1::uuid AND id=$2::uuid AND execution_mode='live' AND status='connected'`,
      [tenantId, uuid(id)]
    );
    if (!result.rowCount) throw new Phase2Error('CONNECTOR_LIVE_NOT_FOUND', 'Conector live no disponible.', 404);
    const integration = result.rows[0];
    const credentials = decryptCredential(integration.credential_envelope, environment);
    const clientId = requiredText(credentials.client_id, 'CONNECTOR_OAUTH_CLIENT_ID_REQUIRED', 500);
    const redirectUri = requiredText(credentials.redirect_uri, 'CONNECTOR_OAUTH_REDIRECT_URI_REQUIRED', 2000);
    if (!/^https:\/\//i.test(redirectUri)) {
      throw new Phase2Error('CONNECTOR_OAUTH_REDIRECT_HTTPS_REQUIRED', 'El redirect URI debe usar HTTPS.', 400);
    }
    const state = randomToken();
    await pool.query(
      `UPDATE tenant_integrations SET oauth_state_hash=$3,updated_at=now()
       WHERE tenant_id=$1::uuid AND id=$2::uuid`,
      [tenantId, integration.id, hashToken(state)]
    );
    const scopes = String(integration.scopes || '').trim();
    const provider = oauthProvider(integration.provider);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
    });
    if (scopes) params.set('scope', scopes);
    let authorizationEndpoint;
    if (provider === 'microsoft') {
      authorizationEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(credentials.directory_id || 'common')}/oauth2/v2.0/authorize`;
      params.set('response_mode', 'query');
    } else if (provider === 'google') {
      authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else if (provider === 'atlassian') {
      authorizationEndpoint = 'https://auth.atlassian.com/authorize';
      params.set('audience', 'api.atlassian.com');
      params.set('prompt', 'consent');
    } else {
      authorizationEndpoint = 'https://github.com/login/oauth/authorize';
    }
    return { authorization_url: `${authorizationEndpoint}?${params.toString()}`, provider };
  }

  async function requestOAuthToken(integration, credentials, values) {
    const provider = oauthProvider(integration.provider);
    let endpoint;
    let options;
    if (provider === 'atlassian') {
      endpoint = 'https://auth.atlassian.com/oauth/token';
      options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: values.grant_type,
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          redirect_uri: credentials.redirect_uri,
          code: values.code,
          refresh_token: values.refresh_token,
        }),
      };
    } else {
      endpoint = provider === 'microsoft'
        ? `https://login.microsoftonline.com/${encodeURIComponent(credentials.directory_id || 'common')}/oauth2/v2.0/token`
        : provider === 'google'
          ? 'https://oauth2.googleapis.com/token'
          : 'https://github.com/login/oauth/access_token';
      const form = new URLSearchParams({
        grant_type: values.grant_type,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      });
      if (credentials.redirect_uri) form.set('redirect_uri', credentials.redirect_uri);
      if (values.code) form.set('code', values.code);
      if (values.refresh_token) form.set('refresh_token', values.refresh_token);
      options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
      };
    }
    const response = await fetch(endpoint, { ...options, signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Phase2Error('CONNECTOR_OAUTH_TOKEN_EXCHANGE_FAILED', 'El proveedor rechazó el intercambio OAuth.', 502);
    }
    return payload;
  }

  async function completeConnectorOAuth({ state, code }) {
    const result = await pool.query(
      `SELECT * FROM tenant_integrations
       WHERE oauth_state_hash=$1 AND execution_mode='live' AND status='connected'
         AND updated_at>now()-interval '15 minutes'`,
      [hashToken(requiredText(state, 'CONNECTOR_OAUTH_STATE_REQUIRED', 500))]
    );
    if (!result.rowCount) throw new Phase2Error('CONNECTOR_OAUTH_STATE_INVALID', 'Estado OAuth inválido o consumido.', 410);
    const integration = result.rows[0];
    const credentials = decryptCredential(integration.credential_envelope, environment);
    const token = await requestOAuthToken(integration, credentials, {
      grant_type: 'authorization_code',
      code: requiredText(code, 'CONNECTOR_OAUTH_CODE_REQUIRED', 4000),
    });
    const expiresAt = new Date(clock() + Math.max(60, Number(token.expires_in) || 3600) * 1000);
    const updatedCredentials = {
      ...credentials,
      access_token: token.access_token,
      refresh_token: token.refresh_token || credentials.refresh_token,
      token_type: token.token_type || 'Bearer',
    };
    await pool.query(
      `UPDATE tenant_integrations SET credential_envelope=$2::jsonb,oauth_state_hash=NULL,
         token_expires_at=$3::timestamptz,refresh_after=$3::timestamptz-interval '5 minutes',
         health_status='unknown',updated_at=now()
       WHERE id=$1::uuid`,
      [integration.id, json(encryptCredential(updatedCredentials, environment)), expiresAt]
    );
    return { connector_id: integration.id, provider: integration.provider, authorized: true };
  }

  async function credentialsForRun(client, integration) {
    let credentials = Object.keys(object(integration.credential_envelope)).length
      ? decryptCredential(integration.credential_envelope, environment)
      : {};
    if (
      integration.execution_mode === 'live'
      && integration.refresh_after
      && new Date(integration.refresh_after).getTime() <= clock()
      && credentials.refresh_token
    ) {
      const token = await requestOAuthToken(integration, credentials, {
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
      });
      credentials = {
        ...credentials,
        access_token: token.access_token,
        refresh_token: token.refresh_token || credentials.refresh_token,
        token_type: token.token_type || credentials.token_type || 'Bearer',
      };
      const expiresAt = new Date(clock() + Math.max(60, Number(token.expires_in) || 3600) * 1000);
      await client.query(
        `UPDATE tenant_integrations SET credential_envelope=$3::jsonb,
           token_expires_at=$4::timestamptz,refresh_after=$4::timestamptz-interval '5 minutes',
           updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [integration.tenant_id, integration.id, json(encryptCredential(credentials, environment)), expiresAt]
      );
    }
    return credentials;
  }

  function connectorAlert(record) {
    const data = record.data || {};
    if (record.external_type === 'identity_user' && data.active === false) {
      return { code: 'INACTIVE_EXTERNAL_ACCOUNT', severity: 'medium', title: 'Cuenta externa inactiva', description: 'La fuente externa reporta una cuenta inactiva.' };
    }
    if (record.external_type === 'identity_user' && data.privileged && !data.mfa) {
      return { code: 'PRIVILEGED_ACCOUNT_WITHOUT_MFA', severity: 'high', title: 'Cuenta privilegiada sin MFA', description: 'La fuente externa contradice el control de acceso fuerte.' };
    }
    if (record.external_type === 'issue' && data.overdue) {
      return { code: 'EXTERNAL_REMEDIAL_OVERDUE', severity: 'high', title: 'Remedial externo vencido', description: 'Jira reporta un remedial vencido; requiere verificación TCDX.' };
    }
    if (record.external_type === 'branch_protection' && data.protected === false) {
      return { code: 'BRANCH_PROTECTION_DISABLED', severity: 'high', title: 'Protección de rama deshabilitada', description: 'GitHub contradice el control de desarrollo seguro.' };
    }
    if (record.external_type === 'security_alert' && data.state === 'open') {
      return { code: 'SOURCE_SECURITY_ALERT', severity: data.severity || 'high', title: 'Alerta de seguridad externa', description: 'La fuente externa mantiene una alerta abierta.' };
    }
    return null;
  }

  async function runConnector({ tenantId, userId, correlationId, id, idempotencyKey, runType = 'sync' }) {
    const integrationId = uuid(id);
    const key = requiredText(idempotencyKey, 'CONNECTOR_IDEMPOTENCY_KEY_REQUIRED', 240);
    return withTransaction(async client => {
      const integrationResult = await client.query(
        'SELECT * FROM tenant_integrations WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, integrationId]
      );
      if (!integrationResult.rowCount) throw new Phase2Error('CONNECTOR_NOT_FOUND', 'Conector no encontrado.', 404);
      const integration = integrationResult.rows[0];
      if (integration.status !== 'connected') throw new Phase2Error('CONNECTOR_NOT_CONNECTED', 'Conector no disponible.', 409);
      const existing = await client.query(
        `SELECT * FROM grc_connector_runs
         WHERE tenant_id=$1::uuid AND integration_id=$2::uuid AND idempotency_key=$3`,
        [tenantId, integrationId, key]
      );
      if (existing.rowCount) return { run: existing.rows[0], reused: true };
      const run = await client.query(
        `INSERT INTO grc_connector_runs (
           tenant_id,integration_id,run_type,status,idempotency_key,cursor_before,
           triggered_by,correlation_id
         ) VALUES ($1::uuid,$2::uuid,$3,'started',$4,$5::jsonb,$6::uuid,$7)
         RETURNING *`,
        [tenantId, integrationId, runType, key, json(integration.cursor), userId || null, correlationId]
      );
      await recordEvent(client, {
        tenantId, userId, eventName: 'connector.sync.started', aggregateType: 'connector',
        aggregateId: integrationId, payload: { run_id: run.rows[0].id, provider: integration.provider },
        correlationId, idempotencyKey: `${key}:started`,
      });
      try {
        const credentials = await credentialsForRun(client, integration);
        const pulled = await pullConnectorRecords({
          provider: integration.provider,
          mode: integration.execution_mode,
          credentials,
          cursor: integration.cursor,
          clock,
        });
        let normalized = 0;
        let alertsCreated = 0;
        for (const record of pulled.records) {
          const inserted = await client.query(
            `INSERT INTO grc_external_records (
               tenant_id,integration_id,run_id,provider,external_type,external_id,
               external_version,observed_at,payload_hash,normalized_payload,provenance,mapping_status
             ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz,$9,$10::jsonb,$11::jsonb,'mapped')
             ON CONFLICT (tenant_id,integration_id,external_type,external_id,payload_hash)
             DO NOTHING RETURNING *`,
            [
              tenantId, integrationId, run.rows[0].id, integration.provider,
              record.external_type, record.external_id, record.external_version,
              record.observed_at, record.payload_hash, json(record.data), json(record.provenance),
            ]
          );
          if (!inserted.rowCount) continue;
          normalized += 1;
          const alert = connectorAlert(record);
          const eventResult = await recordEvent(client, {
            tenantId, userId, eventName: 'connector.record.normalized',
            aggregateType: 'external_record', aggregateId: inserted.rows[0].id,
            payload: { ...record, alert }, provenance: record.provenance,
            correlationId, idempotencyKey: `${key}:record:${record.external_type}:${record.external_id}:${record.payload_hash}`,
          });
          alertsCreated += eventResult.effects.filter(effect => effect.kind === 'alert').length;
          if (alert) {
            await recordEvent(client, {
              tenantId, userId, eventName: 'connector.alert.created',
              aggregateType: 'external_record', aggregateId: inserted.rows[0].id,
              payload: { alert, provider: integration.provider }, provenance: record.provenance,
              correlationId, idempotencyKey: `${key}:alert:${record.external_type}:${record.external_id}:${record.payload_hash}`,
            });
          }
        }
        const finished = await client.query(
          `UPDATE grc_connector_runs SET status='completed',cursor_after=$3::jsonb,
             records_seen=$4,records_normalized=$5,alerts_created=$6,finished_at=now(),
             metrics=$7::jsonb
           WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
          [
            tenantId, run.rows[0].id, json(pulled.cursor), pulled.records.length,
            normalized, alertsCreated,
            json({ duplicate_records: pulled.records.length - normalized, provider: integration.provider }),
          ]
        );
        await client.query(
          `UPDATE tenant_integrations SET cursor=$3::jsonb,last_sync_at=now(),
             health_status='healthy',last_error_code=NULL,updated_at=now()
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [tenantId, integrationId, json(pulled.cursor)]
        );
        await recordEvent(client, {
          tenantId, userId, eventName: 'connector.sync.completed', aggregateType: 'connector',
          aggregateId: integrationId,
          payload: { run_id: run.rows[0].id, records_seen: pulled.records.length, records_normalized: normalized },
          correlationId, idempotencyKey: `${key}:completed`,
        });
        return { run: finished.rows[0], reused: false };
      } catch (error) {
        const retryConfig = object(integration.retry_config, { max_attempts: 5, base_seconds: 30 });
        const nextRetryAt = new Date(clock() + Math.max(1, Number(retryConfig.base_seconds) || 30) * 1000);
        const failed = await client.query(
          `UPDATE grc_connector_runs SET status='failed',error_code=$3,error_message=$4,
             finished_at=now(),next_retry_at=$5::timestamptz
           WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
          [tenantId, run.rows[0].id, error.code || 'CONNECTOR_SYNC_FAILED', String(error.message || 'Connector failure').slice(0, 1000), nextRetryAt]
        );
        await client.query(
          `UPDATE tenant_integrations SET health_status='failed',last_error_code=$3,updated_at=now()
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [tenantId, integrationId, error.code || 'CONNECTOR_SYNC_FAILED']
        );
        await client.query(
          `INSERT INTO grc_connector_dead_letters (
             tenant_id,integration_id,run_id,error_code,error_message,payload,attempts,next_retry_at
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,'{}'::jsonb,1,$6::timestamptz)`,
          [tenantId, integrationId, run.rows[0].id, error.code || 'CONNECTOR_SYNC_FAILED', String(error.message || 'Connector failure').slice(0, 1000), nextRetryAt]
        );
        await recordEvent(client, {
          tenantId, userId, eventName: 'connector.sync.failed', aggregateType: 'connector',
          aggregateId: integrationId, payload: { run_id: run.rows[0].id, error_code: error.code || 'CONNECTOR_SYNC_FAILED' },
          correlationId, idempotencyKey: `${key}:failed`,
        });
        return { run: failed.rows[0], reused: false };
      }
    });
  }

  async function connector360(tenantId, id) {
    const integration = await pool.query(
      'SELECT * FROM tenant_integrations WHERE tenant_id=$1::uuid AND id=$2::uuid',
      [tenantId, uuid(id)]
    );
    if (!integration.rowCount) throw new Phase2Error('CONNECTOR_NOT_FOUND', 'Conector no encontrado.', 404);
    const [runs, records, deadLetters, metrics, alerts] = await Promise.all([
      pool.query('SELECT * FROM grc_connector_runs WHERE tenant_id=$1::uuid AND integration_id=$2::uuid ORDER BY started_at DESC LIMIT 50', [tenantId, id]),
      pool.query('SELECT * FROM grc_external_records WHERE tenant_id=$1::uuid AND integration_id=$2::uuid ORDER BY received_at DESC LIMIT 100', [tenantId, id]),
      pool.query("SELECT * FROM grc_connector_dead_letters WHERE tenant_id=$1::uuid AND integration_id=$2::uuid AND status IN ('open','retrying') ORDER BY created_at DESC", [tenantId, id]),
      pool.query("SELECT * FROM grc_metric_observations WHERE tenant_id=$1::uuid AND provenance->>'provider'=$2 ORDER BY observed_at DESC LIMIT 100", [tenantId, integration.rows[0].provider]),
      pool.query("SELECT * FROM grc_operational_alerts WHERE tenant_id=$1::uuid AND entity_type='external_record' ORDER BY created_at DESC LIMIT 100", [tenantId]),
    ]);
    return {
      connector: redactIntegration(integration.rows[0]),
      runs: runs.rows, records: records.rows, dead_letters: deadLetters.rows,
      metrics: metrics.rows, alerts: alerts.rows,
    };
  }

  async function ingestConnectorWebhook({ integrationId, signature, rawBody, eventType }) {
    const integrationResult = await pool.query(
      `SELECT * FROM tenant_integrations
       WHERE id=$1::uuid AND status='connected' AND execution_mode='live'`,
      [uuid(integrationId)]
    );
    if (!integrationResult.rowCount) throw new Phase2Error('CONNECTOR_WEBHOOK_NOT_FOUND', 'Webhook no disponible.', 404);
    const integration = integrationResult.rows[0];
    const credentials = decryptCredential(integration.credential_envelope, environment);
    const webhookSecret = requiredText(credentials.webhook_secret, 'CONNECTOR_WEBHOOK_SECRET_REQUIRED', 2000);
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const supplied = String(signature || '').replace(/^sha256=/i, '').trim().toLowerCase();
    if (
      !/^[0-9a-f]{64}$/.test(supplied)
      ||
      expected.length !== supplied.length
      || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'))
    ) {
      throw new Phase2Error('CONNECTOR_WEBHOOK_SIGNATURE_INVALID', 'Firma de webhook inválida.', 401);
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new Phase2Error('CONNECTOR_WEBHOOK_JSON_INVALID', 'Payload de webhook inválido.', 400);
    }
    const normalized = normalizeRecord(integration.provider, {
      type: eventType || payload.event_type || payload.type || 'webhook_event',
      id: payload.id || payload.delivery_id || payload.key || crypto.createHash('sha256').update(rawBody).digest('hex'),
      version: payload.updated_at || payload.version || '1',
      observed_at: payload.occurred_at || payload.updated_at || new Date(clock()).toISOString(),
      data: payload,
      provenance: { provider: integration.provider, mode: 'live', transport: 'webhook', adapter_version: integration.connector_version },
    });
    const key = `webhook:${integration.id}:${normalized.external_type}:${normalized.external_id}:${normalized.payload_hash}`;
    return withTransaction(async client => {
      const prior = await client.query(
        `SELECT * FROM grc_connector_runs
         WHERE tenant_id=$1::uuid AND integration_id=$2::uuid AND idempotency_key=$3`,
        [integration.tenant_id, integration.id, key]
      );
      if (prior.rowCount) return { run: prior.rows[0], reused: true };
      const run = await client.query(
        `INSERT INTO grc_connector_runs (
           tenant_id,integration_id,run_type,status,idempotency_key,records_seen,
           records_normalized,started_at,finished_at,metrics
         ) VALUES ($1::uuid,$2::uuid,'webhook','completed',$3,1,1,now(),now(),$4::jsonb)
         RETURNING *`,
        [integration.tenant_id, integration.id, key, json({ event_type: normalized.external_type })]
      );
      const record = await client.query(
        `INSERT INTO grc_external_records (
           tenant_id,integration_id,run_id,provider,external_type,external_id,
           external_version,observed_at,payload_hash,normalized_payload,provenance,mapping_status
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz,$9,$10::jsonb,$11::jsonb,'mapped')
         ON CONFLICT (tenant_id,integration_id,external_type,external_id,payload_hash)
         DO NOTHING RETURNING *`,
        [
          integration.tenant_id, integration.id, run.rows[0].id, integration.provider,
          normalized.external_type, normalized.external_id, normalized.external_version,
          normalized.observed_at, normalized.payload_hash, json(normalized.data), json(normalized.provenance),
        ]
      );
      if (record.rowCount) {
        await recordEvent(client, {
          tenantId: integration.tenant_id,
          userId: null,
          eventName: 'connector.record.normalized',
          aggregateType: 'external_record',
          aggregateId: record.rows[0].id,
          payload: { ...normalized, alert: connectorAlert(normalized) },
          provenance: normalized.provenance,
          correlationId: key,
          idempotencyKey: `${key}:normalized`,
        });
      }
      await client.query(
        `UPDATE tenant_integrations SET last_sync_at=now(),health_status='healthy',updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [integration.tenant_id, integration.id]
      );
      return { run: run.rows[0], reused: false };
    });
  }

  async function listConnectorRuns(tenantId, filters = {}) {
    const result = await pool.query(
      `SELECT r.*,i.provider,i.display_name
       FROM grc_connector_runs r
       JOIN tenant_integrations i ON i.id=r.integration_id AND i.tenant_id=r.tenant_id
       WHERE r.tenant_id=$1::uuid
         AND ($2::uuid IS NULL OR r.integration_id=$2)
         AND ($3::text IS NULL OR r.status=$3)
       ORDER BY r.started_at DESC LIMIT $4`,
      [tenantId, filters.integration_id || null, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function integrationHealth(tenantId) {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS connectors,
         COUNT(*) FILTER (WHERE health_status='healthy')::int AS healthy,
         COUNT(*) FILTER (WHERE health_status IN ('degraded','failed'))::int AS unhealthy,
         MAX(last_sync_at) AS last_sync_at,
         COALESCE((
           SELECT ROUND(100.0*COUNT(*) FILTER (WHERE status='failed')/NULLIF(COUNT(*),0),2)
           FROM grc_connector_runs WHERE tenant_id=$1::uuid
         ),0) AS failure_rate,
         (SELECT COUNT(*)::int FROM grc_external_records WHERE tenant_id=$1::uuid) AS records_normalized,
         (SELECT COUNT(*)::int FROM grc_connector_dead_letters WHERE tenant_id=$1::uuid AND status IN ('open','retrying')) AS mapping_errors,
         (SELECT COUNT(*)::int FROM grc_operational_alerts WHERE tenant_id=$1::uuid AND entity_type='external_record' AND status='open') AS alerts_generated
       FROM tenant_integrations WHERE tenant_id=$1::uuid`,
      [tenantId]
    );
    return result.rows[0];
  }

  async function exchangePortalInvitation(token) {
    const tokenHash = hashToken(requiredText(token, 'SUPPLIER_PORTAL_TOKEN_REQUIRED', 500));
    return withTransaction(async client => {
      const invitation = await client.query(
        `SELECT * FROM grc_supplier_portal_invitations
         WHERE token_hash=$1 AND status IN ('active','accepted') AND expires_at>now()
         FOR UPDATE`,
        [tokenHash]
      );
      if (!invitation.rowCount) throw new Phase2Error('SUPPLIER_PORTAL_LINK_INVALID', 'Enlace inválido o vencido.', 410);
      const sessionToken = randomToken();
      const session = await client.query(
        `INSERT INTO grc_supplier_portal_sessions (
           tenant_id,supplier_id,assessment_id,invitation_id,session_hash,expires_at,last_seen_at
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,LEAST($6::timestamptz,now()+interval '12 hours'),now())
         RETURNING id,expires_at`,
        [
          invitation.rows[0].tenant_id, invitation.rows[0].supplier_id,
          invitation.rows[0].assessment_id, invitation.rows[0].id,
          hashToken(sessionToken), invitation.rows[0].expires_at,
        ]
      );
      await client.query(
        `UPDATE grc_supplier_portal_invitations SET status='accepted',accepted_at=COALESCE(accepted_at,now())
         WHERE id=$1::uuid`,
        [invitation.rows[0].id]
      );
      return { session_token: sessionToken, expires_at: session.rows[0].expires_at };
    });
  }

  async function portalContext(sessionToken) {
    const result = await pool.query(
      `SELECT ps.*,pi.invited_email,pi.max_file_bytes,pi.allowed_mime_types,
              s.legal_name AS supplier_name,a.status AS assessment_status
       FROM grc_supplier_portal_sessions ps
       JOIN grc_supplier_portal_invitations pi ON pi.id=ps.invitation_id
       JOIN grc_suppliers s ON s.id=ps.supplier_id AND s.tenant_id=ps.tenant_id
       JOIN grc_supplier_assessments a ON a.id=ps.assessment_id AND a.tenant_id=ps.tenant_id
       WHERE ps.session_hash=$1 AND ps.revoked_at IS NULL AND ps.expires_at>now()
         AND pi.status='accepted' AND pi.expires_at>now()`,
      [hashToken(requiredText(sessionToken, 'SUPPLIER_PORTAL_SESSION_REQUIRED', 500))]
    );
    if (!result.rowCount) throw new Phase2Error('SUPPLIER_PORTAL_SESSION_INVALID', 'Sesión inválida o vencida.', 401);
    await pool.query('UPDATE grc_supplier_portal_sessions SET last_seen_at=now() WHERE id=$1::uuid', [result.rows[0].id]);
    return result.rows[0];
  }

  async function portalAssessment(sessionToken) {
    const context = await portalContext(sessionToken);
    const detail = await getAssessment(context.tenant_id, context.assessment_id);
    const evidence = await pool.query(
      `SELECT id,question_id,file_name,mime_type,size_bytes,content_hash,status,uploaded_at
       FROM grc_supplier_portal_evidence
       WHERE tenant_id=$1::uuid AND assessment_id=$2::uuid AND status<>'deleted'
       ORDER BY uploaded_at`,
      [context.tenant_id, context.assessment_id]
    );
    return {
      supplier: { name: context.supplier_name },
      assessment: {
        id: detail.assessment.id,
        status: detail.assessment.status,
        due_at: detail.assessment.due_at,
        submitted_at: detail.assessment.submitted_at,
        questionnaire_name: detail.assessment.questionnaire_name,
        questionnaire_version: detail.assessment.questionnaire_version,
      },
      questions: detail.questions.map(question => ({
        id: question.id,
        section_code: question.section_code,
        section_title: question.section_title,
        code: question.code,
        prompt: question.prompt,
        answer_type: question.answer_type,
        required: question.required,
        options: question.options,
        condition: question.condition,
        evidence_required: question.evidence_required,
        answer: question.answer,
        observation: question.observation,
        evidence_ids: question.evidence_ids,
        answered_at: question.answered_at,
      })),
      history: detail.history.map(item => ({
        from_status: item.from_status,
        to_status: item.to_status,
        changed_at: item.changed_at,
      })),
      evidence: evidence.rows,
    };
  }

  async function portalSaveAnswer(sessionToken, body) {
    const context = await portalContext(sessionToken);
    if (!['invited', 'in_progress', 'remediation_required'].includes(context.assessment_status)) {
      throw new Phase2Error('SUPPLIER_PORTAL_ASSESSMENT_LOCKED', 'La evaluación no admite respuestas.', 409);
    }
    await pool.query(
      `UPDATE grc_supplier_assessments SET status='in_progress',updated_at=now()
       WHERE tenant_id=$1::uuid AND id=$2::uuid AND status IN ('invited','remediation_required')`,
      [context.tenant_id, context.assessment_id]
    );
    const question = await pool.query(
      `SELECT q.answer_type,q.options
       FROM grc_questionnaire_questions q
       JOIN grc_questionnaire_sections s ON s.id=q.section_id
       JOIN grc_supplier_assessments a ON a.questionnaire_version_id=s.version_id
       WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid AND q.id=$3::uuid`,
      [context.tenant_id, context.assessment_id, uuid(body.question_id, 'QUESTIONNAIRE_QUESTION_REQUIRED')]
    );
    if (!question.rowCount) throw new Phase2Error('SUPPLIER_PORTAL_QUESTION_INVALID', 'Pregunta fuera de la evaluación.', 400);
    const answerType = question.rows[0].answer_type;
    const submittedAnswer = body.answer;
    let calculatedScore = null;
    if (answerType === 'boolean') {
      calculatedScore = submittedAnswer === true || submittedAnswer === 'true' ? 100 : 0;
    } else if (answerType === 'number') {
      calculatedScore = Math.max(0, Math.min(100, Number(submittedAnswer) || 0));
    }
    return saveSupplierAnswer({
      tenantId: context.tenant_id,
      assessmentId: context.assessment_id,
      body: { ...body, score: calculatedScore },
    });
  }

  async function portalSubmit(sessionToken, body = {}) {
    const context = await portalContext(sessionToken);
    return transitionAssessment({
      tenantId: context.tenant_id,
      userId: null,
      correlationId: `supplier-portal:${context.id}`,
      id: context.assessment_id,
      body: { to_status: 'submitted', comment: optionalText(body.comment) || 'Enviado por portal de proveedor.' },
    });
  }

  async function recordPortalEvidence(sessionToken, file) {
    const context = await portalContext(sessionToken);
    if (!context.allowed_mime_types.includes(file.mime_type)) {
      throw new Phase2Error('SUPPLIER_PORTAL_FILE_TYPE_REJECTED', 'Tipo de archivo no permitido.', 415);
    }
    if (Number(file.size_bytes) > Number(context.max_file_bytes)) {
      throw new Phase2Error('SUPPLIER_PORTAL_FILE_TOO_LARGE', 'Archivo supera el límite permitido.', 413);
    }
    if (file.question_id) {
      const question = await pool.query(
        `SELECT q.id FROM grc_questionnaire_questions q
         JOIN grc_questionnaire_sections s ON s.id=q.section_id
         JOIN grc_supplier_assessments a ON a.questionnaire_version_id=s.version_id
         WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid AND q.id=$3::uuid`,
        [context.tenant_id, context.assessment_id, uuid(file.question_id)]
      );
      if (!question.rowCount) throw new Phase2Error('SUPPLIER_PORTAL_QUESTION_INVALID', 'Pregunta fuera de la evaluación.', 400);
    }
    const result = await pool.query(
      `INSERT INTO grc_supplier_portal_evidence (
         tenant_id,supplier_id,assessment_id,invitation_id,question_id,
         file_name,mime_type,size_bytes,content_hash,storage_path
       ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id,assessment_id,content_hash) DO UPDATE SET
         question_id=COALESCE(EXCLUDED.question_id,grc_supplier_portal_evidence.question_id)
       RETURNING id,question_id,file_name,mime_type,size_bytes,content_hash,status,uploaded_at,storage_path`,
      [
        context.tenant_id, context.supplier_id, context.assessment_id, context.invitation_id,
        file.question_id || null, requiredText(file.file_name, 'SUPPLIER_PORTAL_FILE_NAME_REQUIRED', 255),
        file.mime_type, Number(file.size_bytes), file.content_hash, file.storage_path,
      ]
    );
    const row = result.rows[0];
    const duplicateUpload = row.storage_path !== file.storage_path;
    delete row.storage_path;
    return { ...row, duplicate_upload: duplicateUpload };
  }

  async function executiveGlobalView(tenantId) {
    const [privacy, incidents, suppliers, integrations, assurance, actions, obligations, relations] = await Promise.all([
      privacyOverview(tenantId),
      incidentDashboard(tenantId),
      supplierPortfolio(tenantId),
      integrationHealth(tenantId),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE assurance_status IN ('degraded','ineffective'))::int AS degraded_controls,
                COUNT(*) FILTER (WHERE assurance_status='effective')::int AS effective_controls
         FROM grc_control_assurance WHERE tenant_id=$1::uuid`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE COALESCE(status,'') NOT IN ('completed','closed'))::int AS open_actions,
                COUNT(*) FILTER (WHERE due_date<current_date AND COALESCE(status,'') NOT IN ('completed','closed'))::int AS overdue_actions
         FROM action_plans WHERE tenant_id=$1::uuid`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status='open')::int AS open_obligations,
                COUNT(*) FILTER (WHERE status='open' AND due_at<now())::int AS overdue_obligations
         FROM grc_obligations WHERE tenant_id=$1::uuid`,
        [tenantId]
      ),
      pool.query(
        `SELECT source_type,target_type,COUNT(*)::int AS relations
         FROM grc_phase2_relations WHERE tenant_id=$1::uuid AND status='active'
         GROUP BY source_type,target_type ORDER BY source_type,target_type`,
        [tenantId]
      ),
    ]);
    return {
      generated_at: new Date(clock()).toISOString(),
      privacy,
      incidents,
      suppliers,
      integrations,
      controls: assurance.rows[0],
      remedials: actions.rows[0],
      obligations: obligations.rows[0],
      relationship_map: relations.rows,
    };
  }

  const REPORT_QUERIES = Object.freeze({
    privacy_inventory: `SELECT id,code,name,status,legal_basis,retention_period,dpia_required,created_at AS recorded_at FROM privacy_processing_activities WHERE tenant_id=$1::uuid`,
    privacy_risk: `SELECT r.id,r.status,d.status AS dpia_status,r.title,r.inherent_score,r.residual_score,r.treatment,d.created_at AS recorded_at FROM privacy_dpia_risks r JOIN privacy_dpias d ON d.id=r.dpia_id AND d.tenant_id=r.tenant_id WHERE r.tenant_id=$1::uuid`,
    dpia_status: `SELECT d.id,p.code,p.name,d.status,d.residual_risk_level,d.next_review_at,d.created_at AS recorded_at FROM privacy_dpias d JOIN privacy_processing_activities p ON p.id=d.processing_activity_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=$1::uuid`,
    privacy_requests: `SELECT id,request_number,request_type,status,received_at,due_at,extension_until,normative_source,created_at AS recorded_at FROM privacy_data_subject_requests WHERE tenant_id=$1::uuid`,
    incidents: `SELECT id,incident_number,title,status,category,priority,calculated_severity,confirmed_severity,reported_at AS recorded_at,contained_at,resolved_at,closed_at FROM grc_incidents WHERE tenant_id=$1::uuid`,
    postmortem: `SELECT p.id,i.incident_number,p.status,p.summary,p.what_worked,p.what_failed,p.lessons,p.created_at AS recorded_at FROM grc_incident_postmortems p JOIN grc_incidents i ON i.id=p.incident_id AND i.tenant_id=p.tenant_id WHERE p.tenant_id=$1::uuid`,
    suppliers: `SELECT id,code,legal_name,status,criticality,inherent_risk_score,residual_risk_score,risk_level,data_access_level,created_at AS recorded_at FROM grc_suppliers WHERE tenant_id=$1::uuid`,
    supplier_assessments: `SELECT a.id,s.code,s.legal_name,a.status,a.score,a.inherent_risk_score,a.residual_risk_score,a.due_at,a.expires_at,a.created_at AS recorded_at FROM grc_supplier_assessments a JOIN grc_suppliers s ON s.id=a.supplier_id AND s.tenant_id=a.tenant_id WHERE a.tenant_id=$1::uuid`,
    supplier_evidence: `SELECT e.id,s.code,s.legal_name,e.file_name,e.mime_type,e.size_bytes,e.content_hash,e.status,e.uploaded_at AS recorded_at FROM grc_supplier_portal_evidence e JOIN grc_suppliers s ON s.id=e.supplier_id AND s.tenant_id=e.tenant_id WHERE e.tenant_id=$1::uuid`,
    connectors_health: `SELECT id,provider,display_name,status,execution_mode,connector_version,health_status,last_sync_at,last_error_code,updated_at AS recorded_at FROM tenant_integrations WHERE tenant_id=$1::uuid`,
  });

  function csvCell(value) {
    const raw = value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
    return `"${raw.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
  }

  async function generateReport({ tenantId, userId, correlationId, domain, filters = {} }) {
    let rows;
    if (domain === 'executive_phase2') {
      rows = [await executiveGlobalView(tenantId)];
    } else {
      const query = REPORT_QUERIES[domain];
      if (!query) throw new Phase2Error('PHASE2_REPORT_DOMAIN_INVALID', 'Reporte no soportado.', 422);
      rows = (await pool.query(
        `SELECT * FROM (${query}) scoped
         WHERE ($2::text IS NULL OR scoped.status::text=$2)
           AND ($3::timestamptz IS NULL OR scoped.recorded_at>=$3::timestamptz)
           AND ($4::timestamptz IS NULL OR scoped.recorded_at<$4::timestamptz+interval '1 day')
         ORDER BY scoped.recorded_at DESC LIMIT 10000`,
        [tenantId, filters.status || null, filters.from || null, filters.to || null]
      )).rows;
    }
    if (!rows.length) throw new Phase2Error('PHASE2_REPORT_EMPTY', 'No existen datos para los filtros indicados.', 422);
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const content = [
      columns.map(csvCell).join(','),
      ...rows.map(row => columns.map(column => csvCell(row[column])).join(',')),
    ].join('\n');
    const buffer = Buffer.from(`\uFEFF${content}`, 'utf8');
    const sourceSnapshot = {
      tenant_id: tenantId,
      domain,
      filters,
      row_count: rows.length,
      generated_at: new Date(clock()).toISOString(),
    };
    const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sourceSnapshot)).digest('hex');
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    return withTransaction(async client => {
      const record = await client.query(
        `INSERT INTO grc_exports (
           tenant_id,domain,format,filters,source_snapshot,source_hash,content_hash,
           file_name,mime_type,file_size_bytes,file_content,version,correlation_id,
           generated_by,generated_at
         ) VALUES ($1::uuid,$2,'csv',$3::jsonb,$4::jsonb,$5,$6,$7,'text/csv; charset=utf-8',
           $8,$9,1,$10,$11::uuid,$12::timestamptz)
         RETURNING id,tenant_id,domain,format,filters,source_hash,content_hash,file_name,
                   mime_type,file_size_bytes,version,correlation_id,generated_by,generated_at`,
        [
          tenantId, domain, json(filters), json(sourceSnapshot), sourceHash, contentHash,
          `tcdx-phase2-${domain}-${sourceSnapshot.generated_at.slice(0, 10)}.csv`,
          buffer.length, buffer, correlationId, userId || null, sourceSnapshot.generated_at,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'grc.phase2.export.generated', tableName: 'grc_exports',
        recordId: record.rows[0].id, newData: record.rows[0],
        metadata: { domain, filters, correlation_id: correlationId },
      });
      return { record: record.rows[0], buffer };
    });
  }

  async function getPhase2Export(tenantId, id) {
    const result = await pool.query(
      `SELECT * FROM grc_exports
       WHERE tenant_id=$1::uuid AND id=$2::uuid
         AND domain IN ('privacy_inventory','privacy_risk','dpia_status','privacy_requests',
           'incidents','postmortem','suppliers','supplier_assessments','supplier_evidence',
           'connectors_health','executive_phase2')`,
      [tenantId, uuid(id)]
    );
    if (!result.rowCount) throw new Phase2Error('PHASE2_EXPORT_NOT_FOUND', 'Exportación no encontrada.', 404);
    return result.rows[0];
  }

  return {
    assertModuleEnabled,
    assertPermission,
    connector360,
    connectorCatalog,
    createConnector,
    createDpia,
    createIncident,
    createPortalInvitation,
    createPrivacyBreach,
    createPrivacyRequest,
    createProcessingActivity,
    createQuestionnaireTemplate,
    createRelation,
    createSupplier,
    createSupplierAssessment,
    completeConnectorOAuth,
    executiveGlobalView,
    generateReport,
    exchangePortalInvitation,
    getAssessment,
    getPhase2Export,
    getIncident360,
    getMeta,
    getProcessing360,
    getSupplier360,
    incidentDashboard,
    incidentWorkspace,
    integrationHealth,
    ingestConnectorWebhook,
    listAssessments,
    listConnectorRuns,
    listConnectors,
    listIncidents,
    listPrivacyBreaches,
    listPrivacyRequests,
    listProcessingActivities,
    listQuestionnaires,
    listSuppliers,
    portalAssessment,
    portalContext,
    portalSaveAnswer,
    portalSubmit,
    prepareConnectorOAuth,
    privacyOverview,
    recordPortalEvidence,
    runConnector,
    saveSupplierAnswer,
    supplierPortfolio,
    supplierWorkspace,
    transitionAssessment,
    transitionDpia,
    transitionIncident,
    transitionPrivacyBreach,
    transitionPrivacyRequest,
    transitionProcessing,
    transitionSupplier,
    updateConnector,
    upsertExitCheck,
    addDpiaRisk,
    addIncidentImpact,
    addIncidentNotification,
    addIncidentRootCause,
    addIncidentTimeline,
    addProcessingProcessor,
    addSupplierContract,
    addSupplierService,
    createConsent,
    listDpias,
    upsertPostmortem,
    verifyIncidentEffectiveness,
  };
}

module.exports = {
  Phase2Error,
  createPhase2Service,
};
