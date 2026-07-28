const { assertTransition, evaluatePhase3Rules } = require('./phase3Rules');

const PLATFORM_ROLES = new Set([
  'superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner',
]);

class Phase3Error extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function uuid(value, code = 'PHASE3_ID_REQUIRED') {
  const normalized = String(value || '').trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalized)) {
    throw new Phase3Error(code, 'Identificador inválido.', 400);
  }
  return normalized;
}

function requiredText(value, code, max = 2000) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) {
    throw new Phase3Error(code, 'Valor requerido o fuera de rango.', 400);
  }
  return normalized;
}

function optionalText(value, max = 10000) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length > max) {
    throw new Phase3Error('PHASE3_TEXT_TOO_LONG', 'Texto fuera de rango.', 400);
  }
  return normalized;
}

function asNumber(value, code, { minimum = null, maximum = null, required = true } = {}) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const number = Number(value);
  if (
    !Number.isFinite(number)
    || (minimum !== null && number < minimum)
    || (maximum !== null && number > maximum)
  ) {
    throw new Phase3Error(code, 'Valor numérico fuera de rango.', 400);
  }
  return number;
}

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function object(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function clampLimit(value, maximum = 200) {
  return Math.max(1, Math.min(maximum, Number(value) || 50));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

const ENTITY_REGISTRY = Object.freeze({
  organization: { table: 'grc_organizational_units', tenant: 'tenant_id=$1::uuid' },
  process: { table: 'tenant_processes', tenant: 'tenant_id=$1::uuid' },
  service: { table: 'grc_operational_services', tenant: 'tenant_id=$1::uuid' },
  bia: { table: 'grc_bia_assessments', tenant: 'tenant_id=$1::uuid' },
  continuity_plan: { table: 'grc_continuity_plans', tenant: 'tenant_id=$1::uuid' },
  continuity_test: { table: 'grc_continuity_tests', tenant: 'tenant_id=$1::uuid' },
  crisis: { table: 'grc_crisis_activations', tenant: 'tenant_id=$1::uuid' },
  metric: { table: 'grc_metric_definitions', tenant: 'tenant_id=$1::uuid' },
  quantitative_risk: { table: 'grc_quantitative_risk_assessments', tenant: 'tenant_id=$1::uuid' },
  requirement: { table: 'grc_framework_requirements', tenant: '(tenant_id=$1::uuid OR tenant_id IS NULL)' },
  process_operation: { table: 'tenant_operations', tenant: 'tenant_id=$1::uuid' },
  asset: { table: 'assets', tenant: 'tenant_id=$1::uuid' },
  system: { table: 'assets', tenant: 'tenant_id=$1::uuid' },
  location: { table: 'grc_organizational_units', tenant: "tenant_id=$1::uuid AND unit_type='location'" },
  supplier: { table: 'grc_suppliers', tenant: 'tenant_id=$1::uuid' },
  incident: { table: 'grc_incidents', tenant: 'tenant_id=$1::uuid' },
  risk: { table: 'iso_risk_matrix_items', tenant: 'tenant_id=$1::uuid' },
  control: { table: 'tenant_controls', tenant: 'tenant_id=$1::uuid' },
  evidence: { table: 'evidences', tenant: 'tenant_id=$1::uuid' },
  audit: { table: 'audits', tenant: 'tenant_id=$1::uuid' },
  finding: { table: 'findings', tenant: 'tenant_id=$1::uuid' },
  nonconformity: { table: 'tenant_nonconformities', tenant: 'tenant_id=$1::uuid' },
  action: { table: 'action_plans', tenant: 'tenant_id=$1::uuid' },
});

const TRANSITION_TABLES = Object.freeze({
  organization: { table: 'grc_organizational_units', status: 'status' },
  process: { table: 'tenant_processes', status: 'lifecycle_status' },
  service: { table: 'grc_operational_services', status: 'status' },
  bia: { table: 'grc_bia_assessments', status: 'status' },
  continuity_plan: { table: 'grc_continuity_plans', status: 'status' },
  continuity_test: { table: 'grc_continuity_tests', status: 'status' },
  crisis: { table: 'grc_crisis_activations', status: 'status' },
  metric: { table: 'grc_metric_definitions', status: 'status' },
  quantitative_risk: { table: 'grc_quantitative_risk_assessments', status: 'status' },
});

const DEPENDENCY_CONTRACTS = new Set([
  'organization:process:unit_to_process',
  'process:process:process_to_process',
  'process:service:process_to_service',
  'process:asset:process_to_asset',
  'process:system:process_to_system',
  'process:location:process_to_location',
  'process:supplier:process_to_supplier',
  'service:asset:service_to_asset',
  'service:system:service_to_system',
  'service:supplier:service_to_supplier',
  'service:location:service_to_location',
  'service:control:service_to_control',
  'service:requirement:service_to_requirement',
]);

const IMPORT_TEMPLATE_VERSION = 'phase3-operational-v1';
const IMPORT_DEFINITIONS = Object.freeze({
  organizations: {
    creator: 'createOrganization',
    table: 'grc_organizational_units',
    type: 'organization',
    columns: ['code', 'name', 'description', 'unit_type', 'owner_email', 'location_reference', 'next_review_at'],
    example: ['TI', 'Tecnología', 'Unidad de tecnología', 'department', 'responsable@empresa.cl', 'Santiago', '2027-01-31T12:00:00Z'],
  },
  processes: {
    creator: 'createProcess',
    table: 'tenant_processes',
    type: 'process',
    columns: ['code', 'name', 'description', 'process_type', 'unit_code', 'owner_email', 'criticality', 'criticality_score', 'objective', 'scope', 'review_due_at'],
    example: ['PROC-001', 'Operación tecnológica', 'Proceso crítico', 'operational', 'TI', 'responsable@empresa.cl', 'high', '80', 'Mantener servicios', 'Servicios TI', '2027-01-31T12:00:00Z'],
  },
  services: {
    creator: 'createService',
    table: 'grc_operational_services',
    type: 'service',
    columns: ['code', 'name', 'description', 'unit_code', 'process_code', 'owner_email', 'minimum_service_level', 'criticality', 'rto_minutes', 'rpo_minutes', 'mtpd_minutes', 'next_review_at'],
    example: ['SRV-001', 'Servicio principal', 'Servicio operativo', 'TI', 'PROC-001', 'responsable@empresa.cl', '80%', 'high', '240', '60', '480', '2027-01-31T12:00:00Z'],
  },
  bia: {
    creator: 'createBia',
    table: 'grc_bia_assessments',
    type: 'bia',
    columns: ['code', 'process_code', 'service_code', 'owner_email', 'assessment_date', 'assumptions', 'estimated_financial_impact', 'mtpd_minutes', 'rto_minutes', 'rpo_minutes', 'minimum_service_level', 'required_people', 'alternative_resources', 'next_review_at'],
    example: ['BIA-001', 'PROC-001', 'SRV-001', 'responsable@empresa.cl', '2026-07-28', 'Operación normal', '1000000', '480', '240', '60', '80%', '3', 'Sitio alternativo', '2027-01-31T12:00:00Z'],
  },
  continuity_plans: {
    creator: 'createContinuityPlan',
    table: 'grc_continuity_plans',
    type: 'continuity_plan',
    columns: ['code', 'name', 'scope', 'process_code', 'service_code', 'bia_code', 'activation_authority_email', 'activation_criteria', 'procedures', 'recovery_sequence', 'communication_plan', 'return_to_operation_criteria', 'valid_from', 'valid_until', 'next_review_at'],
    example: ['PCN-001', 'Plan principal', 'Servicio principal', 'PROC-001', 'SRV-001', 'BIA-001', 'responsable@empresa.cl', 'Interrupción mayor', 'Aplicar recuperación', 'Servicio prioritario', 'Notificar comité', 'Validar estabilidad', '2026-07-28', '2027-07-28', '2027-01-31T12:00:00Z'],
  },
  metrics: {
    creator: 'createMetric',
    table: 'grc_metric_definitions',
    type: 'metric',
    columns: ['code', 'name', 'description', 'metric_type', 'entity_type', 'entity_code', 'owner_email', 'formula_definition', 'source_description', 'frequency', 'unit', 'expected_direction', 'target_value', 'warning_threshold', 'critical_threshold', 'measurement_window'],
    example: ['KPI-001', 'Disponibilidad', 'Disponibilidad mensual', 'kpi', 'service', 'SRV-001', 'responsable@empresa.cl', 'Horas disponibles / horas totales', 'Monitoreo operativo', 'monthly', '%', 'higher_is_better', '99.9', '99.5', '99', 'month'],
  },
});

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeImportRow(row) {
  return Object.fromEntries(
    Object.entries(object(row)).map(([key, value]) => [
      String(key).trim(),
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
    ])
  );
}

const UPDATE_CONFIG = Object.freeze({
  organization: {
    table: 'grc_organizational_units',
    versioned: true,
    fields: ['name', 'description', 'unit_type', 'parent_unit_id', 'owner_user_id',
      'backup_owner_user_id', 'location_reference', 'valid_from', 'valid_until', 'next_review_at'],
  },
  process: {
    table: 'tenant_processes',
    versioned: true,
    fields: ['name', 'description', 'area', 'owner_user_id', 'criticality',
      'organizational_unit_id', 'parent_process_id', 'backup_owner_user_id',
      'process_type', 'objective', 'scope', 'criticality_score',
      'criticality_confirmed', 'criticality_override_reason', 'valid_from',
      'valid_until', 'review_due_at'],
  },
  service: {
    table: 'grc_operational_services',
    versioned: true,
    fields: ['name', 'description', 'organizational_unit_id', 'primary_process_id',
      'owner_user_id', 'backup_owner_user_id', 'minimum_service_level',
      'critical_schedule', 'criticality', 'rto_minutes', 'rpo_minutes',
      'mtpd_minutes', 'next_review_at'],
  },
  bia: {
    table: 'grc_bia_assessments',
    versioned: true,
    fields: ['organizational_unit_id', 'process_id', 'service_id', 'owner_user_id',
      'assessment_date', 'assumptions', 'estimated_financial_impact', 'mtpd_minutes',
      'rto_minutes', 'rpo_minutes', 'minimum_service_level', 'required_people',
      'alternative_resources', 'next_review_at'],
  },
  continuity_plan: {
    table: 'grc_continuity_plans',
    versioned: true,
    fields: ['name', 'scope', 'organizational_unit_id', 'process_id', 'service_id',
      'bia_id', 'activation_criteria', 'activation_authority_user_id', 'procedures',
      'recovery_sequence', 'communication_plan', 'return_to_operation_criteria',
      'valid_from', 'valid_until', 'next_review_at'],
  },
  continuity_test: {
    table: 'grc_continuity_tests',
    versioned: false,
    fields: ['test_type', 'objective', 'scenario', 'scope', 'scheduled_at',
      'expected_result', 'actual_result', 'target_rto_minutes', 'observed_rto_minutes',
      'target_rpo_minutes', 'observed_rpo_minutes', 'next_test_at'],
  },
  crisis: {
    table: 'grc_crisis_activations',
    versioned: false,
    fields: ['plan_id', 'incident_id', 'organizational_unit_id', 'process_id',
      'service_id', 'crisis_level', 'activation_reason', 'recovery_status', 'lessons_learned'],
  },
  metric: {
    table: 'grc_metric_definitions',
    versioned: true,
    fields: ['name', 'description', 'metric_type', 'entity_type', 'entity_id',
      'formula_definition', 'source_description', 'frequency', 'owner_user_id',
      'unit', 'expected_direction', 'target_value', 'warning_threshold',
      'critical_threshold', 'measurement_window', 'valid_from', 'valid_until'],
  },
  quantitative_risk: {
    table: 'grc_quantitative_risk_assessments',
    versioned: true,
    fields: ['organizational_unit_id', 'process_id', 'service_id', 'scenario',
      'minimum_impact', 'most_likely_impact', 'maximum_impact', 'estimated_frequency',
      'residual_annualized_loss', 'treatment_annualized_loss', 'control_cost',
      'expected_reduction', 'sensitivity_notes', 'treatment_comparison',
      'assumptions', 'source_description', 'expected_impact', 'annualized_loss',
      'net_expected_benefit'],
  },
});

function createPhase3Service(pool, { clock = Date.now } = {}) {
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

  async function withImportLock(tenantId, batchId, work) {
    const client = await pool.connect();
    let acquired = false;
    try {
      const lock = await client.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',
        [`phase3-import:${tenantId}:${batchId}`]
      );
      acquired = lock.rows[0]?.acquired === true;
      if (!acquired) {
        throw new Phase3Error(
          'PHASE3_IMPORT_IN_PROGRESS',
          'El lote ya está siendo procesado por otra solicitud.',
          409
        );
      }
      return await work();
    } finally {
      let unlockError = null;
      if (acquired) {
        await client.query(
          'SELECT pg_advisory_unlock(hashtextextended($1,0))',
          [`phase3-import:${tenantId}:${batchId}`]
        ).catch(error => {
          unlockError = error;
        });
      }
      client.release(unlockError || undefined);
    }
  }

  async function audit(client, {
    tenantId, userId, action, tableName, recordId, oldData = null, newData = null, metadata = {},
  }) {
    await client.query(
      `INSERT INTO audit_event_log (
         table_name, record_id, tenant_id, action, changed_by, old_data, new_data, metadata
       ) VALUES ($1,$2::uuid,$3::uuid,$4,$5::uuid,$6::jsonb,$7::jsonb,$8::jsonb)`,
      [
        tableName, recordId, tenantId, action, userId || null,
        json(oldData, null), json(newData, null), json(metadata),
      ]
    );
  }

  async function assertModuleEnabled(tenantId) {
    const result = await pool.query(
      `SELECT COALESCE(tms.is_enabled,sm.default_enabled,FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key=sm.module_key AND tms.tenant_id=$1::uuid
       WHERE sm.module_key='grc_phase3_operations' AND sm.is_active=TRUE`,
      [tenantId]
    );
    if (result.rows[0]?.is_enabled !== true) {
      throw new Phase3Error(
        'GRC_PHASE3_DISABLED',
        'La operación integrada al GRC no está habilitada para esta empresa.',
        403
      );
    }
  }

  async function assertPermission({ userId, role, permission }) {
    if (PLATFORM_ROLES.has(String(role || '').toLowerCase())) return;
    if (!userId) throw new Phase3Error('PHASE3_USER_REQUIRED', 'Usuario no identificado.', 401);
    const result = await pool.query(
      'SELECT user_has_permission($1::uuid,$2::text) AS allowed',
      [userId, permission]
    );
    if (result.rows[0]?.allowed !== true) {
      throw new Phase3Error('PHASE3_PERMISSION_DENIED', `Permiso requerido: ${permission}.`, 403);
    }
  }

  async function assertTenantEntity(client, tenantId, entityType, entityId) {
    const target = ENTITY_REGISTRY[entityType];
    if (!target) {
      throw new Phase3Error('PHASE3_ENTITY_TYPE_INVALID', 'Tipo de entidad no permitido.', 400);
    }
    const result = await client.query(
      `SELECT id FROM ${target.table} WHERE ${target.tenant} AND id=$2::uuid LIMIT 1`,
      [tenantId, uuid(entityId)]
    );
    if (!result.rowCount) {
      throw new Phase3Error('PHASE3_ENTITY_NOT_FOUND', 'Entidad no encontrada en la empresa.', 404);
    }
  }

  async function assertTenantUser(client, tenantId, candidateUserId) {
    if (!candidateUserId) return null;
    const result = await client.query(
      `SELECT id FROM users
       WHERE id=$1::uuid AND tenant_id=$2::uuid
       LIMIT 1`,
      [uuid(candidateUserId, 'PHASE3_USER_ID_INVALID'), tenantId]
    );
    if (!result.rowCount) {
      throw new Phase3Error('PHASE3_USER_NOT_IN_TENANT', 'El usuario indicado no pertenece a la empresa.', 400);
    }
    return candidateUserId;
  }

  async function applyEffect(client, {
    tenantId, userId, event, aggregateType, aggregateId, ownerUserId, effect,
  }) {
    let output = effect;
    if (effect.kind === 'alert') {
      const result = await client.query(
        `INSERT INTO grc_operational_alerts (
           tenant_id,code,severity,title,description,entity_type,entity_id,
           source_event_id,owner_user_id,metadata
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$8::uuid,$9::uuid,$10::jsonb)
         RETURNING id,code,severity,status`,
        [
          tenantId, effect.code, effect.severity, effect.title, effect.description,
          aggregateType, aggregateId, event.id, ownerUserId || null, json(effect.metadata),
        ]
      );
      output = { ...effect, alert: result.rows[0] };
    }
    if (effect.kind === 'metric') {
      const result = await client.query(
        `INSERT INTO grc_metric_observations (
           tenant_id,metric_code,metric_type,numeric_value,unit,observed_at,
           entity_type,entity_id,source_type,source_id,provenance
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::uuid,'domain_event',$9::uuid,$10::jsonb)
         RETURNING id,metric_code,numeric_value,unit`,
        [
          tenantId, effect.code, effect.metricType, effect.numericValue, effect.unit,
          event.occurred_at, aggregateType, aggregateId, event.id,
          json({ source_event_id: event.id, event_name: event.event_name }),
        ]
      );
      output = { ...effect, observation: result.rows[0] };
    }
    if (effect.kind === 'readiness') {
      const current = await client.query(
        `SELECT new_score FROM grc_phase3_readiness_impacts
         WHERE tenant_id=$1::uuid AND entity_type=$2 AND entity_id=$3::uuid
           AND dimension=$4 AND active=TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, aggregateType, aggregateId, effect.dimension]
      );
      const previousScore = Number(current.rows[0]?.new_score ?? 100);
      const newScore = clampScore(previousScore + Number(effect.delta));
      const result = await client.query(
        `INSERT INTO grc_phase3_readiness_impacts (
           tenant_id,source_event_id,entity_type,entity_id,dimension,
           previous_score,new_score,reason_code,explanation,owner_user_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7,$8,$9,$10::uuid)
         RETURNING *`,
        [
          tenantId, event.id, aggregateType, aggregateId, effect.dimension,
          previousScore, newScore, effect.reasonCode, effect.explanation, ownerUserId || null,
        ]
      );
      output = { ...effect, readiness: result.rows[0] };
    }
    if (effect.kind === 'assurance' && event.payload?.tenant_control_id) {
      const result = await client.query(
        `INSERT INTO grc_control_assurance (
           tenant_id,tenant_control_id,assurance_status,score,reason_codes,source_event_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,ARRAY[$5]::text[],$6::uuid)
         ON CONFLICT (tenant_id,tenant_control_id) DO UPDATE SET
           assurance_status=EXCLUDED.assurance_status,
           score=EXCLUDED.score,
           reason_codes=EXCLUDED.reason_codes,
           source_event_id=EXCLUDED.source_event_id,
           calculated_at=now()
         RETURNING id,assurance_status,score`,
        [
          tenantId, event.payload.tenant_control_id, effect.status,
          effect.score, effect.reason, event.id,
        ]
      );
      output = { ...effect, assurance: result.rows[0] };
    }
    if (effect.kind === 'recommendation') {
      output = {
        ...effect,
        materialization: {
          requires_human_review: true,
          allowed_actions: effect.allowedActions,
          source_event_id: event.id,
        },
      };
    }
    return output;
  }

  async function recordEvent(client, {
    tenantId,
    userId,
    eventName,
    aggregateType,
    aggregateId,
    aggregateVersion = 1,
    payload = {},
    correlationId = null,
    idempotencyKey,
    ownerUserId = null,
  }) {
    const result = await client.query(
      `INSERT INTO grc_domain_events (
         tenant_id,event_name,aggregate_type,aggregate_id,aggregate_version,
         payload,provenance,correlation_id,idempotency_key,recorded_by
       ) VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8,$9,$10::uuid)
       ON CONFLICT (tenant_id,idempotency_key) DO NOTHING
       RETURNING *`,
      [
        tenantId, eventName, aggregateType, aggregateId, aggregateVersion,
        json(payload), json({ source: 'tcdx_phase3' }), correlationId,
        requiredText(idempotencyKey, 'PHASE3_IDEMPOTENCY_KEY_REQUIRED', 300),
        userId || null,
      ]
    );
    if (!result.rowCount) {
      const existing = await client.query(
        'SELECT * FROM grc_domain_events WHERE tenant_id=$1::uuid AND idempotency_key=$2',
        [tenantId, idempotencyKey]
      );
      return { event: existing.rows[0], reused: true, effects: [] };
    }

    const event = result.rows[0];
    const effects = evaluatePhase3Rules(eventName, payload, new Date(clock()));
    const outputs = [];
    for (let index = 0; index < effects.length; index += 1) {
      const effect = effects[index];
      const output = await applyEffect(client, {
        tenantId, userId, event, aggregateType, aggregateId, ownerUserId, effect,
      });
      outputs.push(output);
      await client.query(
        `INSERT INTO grc_rule_executions (
           tenant_id,event_id,rule_code,rule_version,matched,explanation,inputs,outputs
         ) VALUES ($1::uuid,$2::uuid,$3,1,TRUE,$4,$5::jsonb,$6::jsonb)
         ON CONFLICT (tenant_id,event_id,rule_code,rule_version) DO NOTHING`,
        [
          tenantId, event.id, `${eventName}:${effect.kind}:${index}`,
          effect.explanation || effect.description || effect.title || eventName,
          json(payload), json(output),
        ]
      );
    }
    return { event, reused: false, effects: outputs };
  }

  async function replayMutation(client, tenantId, idempotencyKey) {
    const key = requiredText(
      idempotencyKey,
      'PHASE3_IDEMPOTENCY_KEY_REQUIRED',
      300
    );
    const result = await client.query(
      `SELECT * FROM grc_domain_events
       WHERE tenant_id=$1::uuid AND idempotency_key=$2
       LIMIT 1`,
      [tenantId, key]
    );
    if (!result.rowCount) return null;
    return {
      entity: result.rows[0].payload,
      impact: { event: result.rows[0], reused: true, effects: [] },
    };
  }

  async function getMeta({ tenantId, userId, role }) {
    const [moduleResult, permissionResult] = await Promise.all([
      pool.query(
        `SELECT sm.module_key,sm.display_name,
                COALESCE(tms.is_enabled,sm.default_enabled,FALSE) AS is_enabled
         FROM saas_modules sm
         LEFT JOIN tenant_module_settings tms
           ON tms.module_key=sm.module_key AND tms.tenant_id=$1::uuid
         WHERE sm.module_key='grc_phase3_operations' AND sm.is_active=TRUE`,
        [tenantId]
      ),
      PLATFORM_ROLES.has(String(role || '').toLowerCase())
        ? Promise.resolve({ rows: [{ permission_key: 'platform', allowed: true }] })
        : pool.query(
          `SELECT p.permission_key,user_has_permission($1::uuid,p.permission_key) AS allowed
           FROM permissions p
           WHERE p.permission_group IN ('operations','continuity','metrics','risk')
             AND p.is_active=TRUE ORDER BY p.permission_key`,
          [userId]
        ),
    ]);
    return {
      module: moduleResult.rows[0] || {
        module_key: 'grc_phase3_operations',
        is_enabled: false,
      },
      permissions: permissionResult.rows.reduce(
        (map, row) => ({ ...map, [row.permission_key]: row.allowed === true }),
        {}
      ),
    };
  }

  async function getLookups(tenantId) {
    const [
      users, organizations, processes, services, bias, plans, assets, locations, incidents, risks,
      controls, suppliers, requirements, evidences, audits, findings,
      nonconformities, actions,
    ] = await Promise.all([
      pool.query(
        `SELECT u.id,u.email,
                COALESCE(NULLIF(TRIM(to_jsonb(u)->>'full_name'),''),
                         NULLIF(TRIM(to_jsonb(u)->>'name'),''),u.email) AS name
         FROM users u
         WHERE u.tenant_id=$1::uuid
           AND COALESCE((to_jsonb(u)->>'is_active')::boolean,TRUE)
         ORDER BY name,email LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,name FROM grc_organizational_units
         WHERE tenant_id=$1::uuid AND status<>'retired' ORDER BY code,name LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,name FROM tenant_processes
         WHERE tenant_id=$1::uuid AND COALESCE(is_active,TRUE) ORDER BY code,name LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,name FROM grc_operational_services
         WHERE tenant_id=$1::uuid AND status<>'retired' ORDER BY code,name LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,COALESCE(process_id::text,service_id::text) AS name
         FROM grc_bia_assessments WHERE tenant_id=$1::uuid
         ORDER BY code LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,name FROM grc_continuity_plans
         WHERE tenant_id=$1::uuid AND status NOT IN ('closed','superseded')
         ORDER BY code,name LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT a.id,
                COALESCE(to_jsonb(a)->>'code',to_jsonb(a)->>'asset_code',a.id::text) AS code,
                COALESCE(to_jsonb(a)->>'name',to_jsonb(a)->>'asset_name',a.id::text) AS name
         FROM assets a WHERE a.tenant_id=$1::uuid ORDER BY a.id LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,name FROM grc_organizational_units
         WHERE tenant_id=$1::uuid AND unit_type='location' AND status<>'retired'
         ORDER BY code,name LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,incident_number AS code,title AS name FROM grc_incidents
         WHERE tenant_id=$1::uuid ORDER BY created_at DESC LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT r.id,
                COALESCE(to_jsonb(r)->>'risk_code',r.id::text) AS code,
                COALESCE(to_jsonb(r)->>'risk_title',to_jsonb(r)->>'risk_description',r.id::text) AS name
         FROM iso_risk_matrix_items r WHERE r.tenant_id=$1::uuid
         ORDER BY r.updated_at DESC LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT c.id,
                COALESCE(to_jsonb(c)->>'control_code',to_jsonb(c)->>'code',c.id::text) AS code,
                COALESCE(to_jsonb(c)->>'control_name',to_jsonb(c)->>'name',
                  to_jsonb(c)->>'control_code',c.id::text) AS name
         FROM tenant_controls c WHERE c.tenant_id=$1::uuid LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,code,COALESCE(trade_name,legal_name,code) AS name
         FROM grc_suppliers WHERE tenant_id=$1::uuid ORDER BY code LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT r.id,r.reference_code AS code,
                COALESCE(r.permitted_title,r.tcdx_interpretation,r.reference_code) AS name
         FROM grc_framework_requirements r
         WHERE r.tenant_id=$1::uuid OR r.tenant_id IS NULL ORDER BY r.reference_code LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT e.id,
                COALESCE(to_jsonb(e)->>'title',to_jsonb(e)->>'name',e.id::text) AS code,
                COALESCE(to_jsonb(e)->>'title',to_jsonb(e)->>'name',e.id::text) AS name
         FROM evidences e WHERE e.tenant_id=$1::uuid ORDER BY e.id LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT a.id,
                COALESCE(to_jsonb(a)->>'code',to_jsonb(a)->>'audit_code',a.id::text) AS code,
                COALESCE(to_jsonb(a)->>'title',to_jsonb(a)->>'name',a.id::text) AS name
         FROM audits a WHERE a.tenant_id=$1::uuid ORDER BY a.created_at DESC LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT f.id,
                COALESCE(to_jsonb(f)->>'code',to_jsonb(f)->>'finding_number',f.id::text) AS code,
                COALESCE(to_jsonb(f)->>'title',to_jsonb(f)->>'description',f.id::text) AS name
         FROM findings f WHERE f.tenant_id=$1::uuid ORDER BY f.id LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT n.id,
                COALESCE(to_jsonb(n)->>'code',to_jsonb(n)->>'nonconformity_number',n.id::text) AS code,
                COALESCE(to_jsonb(n)->>'title',to_jsonb(n)->>'description',n.id::text) AS name
         FROM tenant_nonconformities n WHERE n.tenant_id=$1::uuid
         ORDER BY n.id LIMIT 500`,
        [tenantId]
      ),
      pool.query(
        `SELECT a.id,
                COALESCE(to_jsonb(a)->>'code',to_jsonb(a)->>'action_number',a.id::text) AS code,
                COALESCE(to_jsonb(a)->>'title',to_jsonb(a)->>'description',a.id::text) AS name
         FROM action_plans a WHERE a.tenant_id=$1::uuid ORDER BY a.created_at DESC LIMIT 500`,
        [tenantId]
      ),
    ]);
    return {
      users: users.rows,
      organization: organizations.rows,
      process: processes.rows,
      service: services.rows,
      bia: bias.rows,
      continuity_plan: plans.rows,
      asset: assets.rows,
      system: assets.rows,
      location: locations.rows,
      incident: incidents.rows,
      risk: risks.rows,
      control: controls.rows,
      supplier: suppliers.rows,
      requirement: requirements.rows,
      evidence: evidences.rows,
      audit: audits.rows,
      finding: findings.rows,
      nonconformity: nonconformities.rows,
      action: actions.rows,
    };
  }

  async function activationReadiness(tenantId) {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM grc_organizational_units
          WHERE tenant_id=$1::uuid AND status<>'retired') AS units_configured,
        (SELECT COUNT(*)::int FROM tenant_processes
          WHERE tenant_id=$1::uuid AND COALESCE(is_active,TRUE)
            AND owner_user_id IS NOT NULL) AS processes_with_owner,
        (SELECT COUNT(*)::int FROM tenant_processes p
          WHERE p.tenant_id=$1::uuid AND p.criticality_score>=75
            AND NOT EXISTS (
              SELECT 1 FROM grc_bia_assessments b
              WHERE b.tenant_id=p.tenant_id AND b.process_id=p.id
                AND b.status IN ('approved','current') AND b.next_review_at>now()
            )) AS critical_processes_without_bia,
        (SELECT COUNT(*)::int FROM grc_operational_services
          WHERE tenant_id=$1::uuid AND status<>'retired'
            AND (rto_minutes IS NULL OR rpo_minutes IS NULL)) AS services_without_rto_rpo,
        (SELECT COUNT(*)::int FROM tenant_processes p
          WHERE p.tenant_id=$1::uuid AND COALESCE(p.is_active,TRUE)
            AND NOT EXISTS (
              SELECT 1 FROM grc_continuity_plans cp
              WHERE cp.tenant_id=p.tenant_id AND cp.process_id=p.id
                AND cp.status NOT IN ('closed','superseded')
            )) AS processes_without_plan,
        (SELECT COUNT(*)::int FROM grc_continuity_plans cp
          WHERE cp.tenant_id=$1::uuid AND cp.status NOT IN ('closed','superseded')
            AND NOT EXISTS (
              SELECT 1 FROM grc_continuity_tests ct
              WHERE ct.tenant_id=cp.tenant_id AND ct.plan_id=cp.id
            )) AS plans_without_tests,
        (SELECT COUNT(*)::int FROM grc_metric_definitions md
          WHERE md.tenant_id=$1::uuid AND md.status<>'retired'
            AND NOT EXISTS (
              SELECT 1 FROM grc_metric_measurements mm
              WHERE mm.tenant_id=md.tenant_id AND mm.metric_id=md.id
            )) AS metrics_without_measurements,
        (SELECT COUNT(*)::int FROM grc_phase2_relations
          WHERE tenant_id=$1::uuid AND status='pending') AS pending_relations,
        (SELECT COUNT(*)::int FROM tenant_processes
          WHERE tenant_id=$1::uuid AND COALESCE(is_active,TRUE)) AS total_processes,
        (SELECT COUNT(*)::int FROM grc_operational_services
          WHERE tenant_id=$1::uuid AND status<>'retired') AS total_services,
        (SELECT COUNT(*)::int FROM grc_metric_definitions
          WHERE tenant_id=$1::uuid AND status<>'retired') AS total_metrics,
        (
          (SELECT COUNT(*) FROM grc_organizational_units
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM tenant_processes
            WHERE tenant_id=$1::uuid AND metadata->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_operational_services
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_bia_assessments
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_continuity_plans
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_metric_definitions
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_quantitative_risk_assessments
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
          + (SELECT COUNT(*) FROM grc_crisis_activations
            WHERE tenant_id=$1::uuid AND provenance->>'source'='demo')
        )::int AS demo_records,
        (
          (SELECT COUNT(*) FROM grc_organizational_units
            WHERE tenant_id=$1::uuid AND status NOT IN ('active','retired'))
          + (SELECT COUNT(*) FROM tenant_processes
            WHERE tenant_id=$1::uuid AND COALESCE(is_active,TRUE)
              AND lifecycle_status<>'active')
          + (SELECT COUNT(*) FROM grc_operational_services
            WHERE tenant_id=$1::uuid AND status NOT IN ('active','retired'))
          + (SELECT COUNT(*) FROM grc_bia_assessments
            WHERE tenant_id=$1::uuid AND status NOT IN ('current','superseded'))
          + (SELECT COUNT(*) FROM grc_continuity_plans
            WHERE tenant_id=$1::uuid
              AND status NOT IN ('active','closed','superseded'))
          + (SELECT COUNT(*) FROM grc_continuity_tests
            WHERE tenant_id=$1::uuid
              AND status NOT IN ('passed','passed_with_observations','cancelled'))
          + (SELECT COUNT(*) FROM grc_metric_definitions
            WHERE tenant_id=$1::uuid AND status NOT IN ('active','retired'))
          + (SELECT COUNT(*) FROM grc_quantitative_risk_assessments
            WHERE tenant_id=$1::uuid AND status NOT IN ('current','superseded'))
        )::int AS pending_operational_states`,
      [tenantId]
    );
    const metrics = result.rows[0];
    const blockers = [
      Number(metrics.units_configured) === 0,
      Number(metrics.total_processes) === 0,
      Number(metrics.critical_processes_without_bia) > 0,
      Number(metrics.services_without_rto_rpo) > 0,
      Number(metrics.processes_without_plan) > 0,
    ];
    const pending = [
      Number(metrics.plans_without_tests),
      Number(metrics.metrics_without_measurements),
      Number(metrics.pending_relations),
    ].some(value => value > 0);
    const state = Number(metrics.demo_records) > 0
      ? 'demo'
      : blockers.some(Boolean)
        ? (Number(metrics.units_configured) === 0 ? 'bloqueado' : 'incompleto')
        : pending || Number(metrics.pending_operational_states) > 0
          ? 'configurado'
          : 'operativo';
    return {
      state,
      metrics,
      ready_to_operate: state === 'operativo',
      items: [
        { key: 'units_configured', label: 'Unidades configuradas', value: metrics.units_configured, href: '/unidades' },
        { key: 'processes_with_owner', label: 'Procesos con responsable', value: metrics.processes_with_owner, href: '/procesos' },
        { key: 'critical_processes_without_bia', label: 'Procesos críticos sin BIA', value: metrics.critical_processes_without_bia, href: '/bia' },
        { key: 'services_without_rto_rpo', label: 'Servicios sin RTO/RPO', value: metrics.services_without_rto_rpo, href: '/servicios' },
        { key: 'processes_without_plan', label: 'Procesos sin plan de continuidad', value: metrics.processes_without_plan, href: '/continuidad' },
        { key: 'plans_without_tests', label: 'Planes sin pruebas', value: metrics.plans_without_tests, href: '/continuidad/pruebas' },
        { key: 'metrics_without_measurements', label: 'Indicadores sin mediciones', value: metrics.metrics_without_measurements, href: '/indicadores' },
        { key: 'pending_relations', label: 'Relaciones pendientes', value: metrics.pending_relations, href: '/procesos' },
      ],
    };
  }

  async function list(table, tenantId, filters = {}, {
    alias = 'e', statusColumn = 'status', orderBy = 'updated_at DESC', searchColumns = ['code', 'name'],
  } = {}) {
    const limit = clampLimit(filters.limit);
    const offset = Math.max(0, Number(filters.offset) || 0);
    const values = [tenantId];
    const clauses = [`${alias}.tenant_id=$1::uuid`];
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`${alias}.${statusColumn}=$${values.length}`);
    }
    if (filters.search) {
      values.push(`%${String(filters.search).trim().slice(0, 200)}%`);
      clauses.push(
        `(${searchColumns.map(column => `${alias}.${column} ILIKE $${values.length}`).join(' OR ')})`
      );
    }
    values.push(limit, offset);
    const rows = await pool.query(
      `SELECT ${alias}.* FROM ${table} ${alias}
       WHERE ${clauses.join(' AND ')}
       ORDER BY ${orderBy} LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    return rows.rows;
  }

  async function getEntity360(tenantId, entityType, entityId) {
    const client = pool;
      await assertTenantEntity(client, tenantId, entityType, entityId);
      const target = ENTITY_REGISTRY[entityType];
      const [
        entity, outgoing, incoming, dependenciesOut, dependenciesIn,
        alerts, readiness, history, events, biaImpacts,
      ] = await Promise.all([
        client.query(`SELECT * FROM ${target.table} WHERE ${target.tenant} AND id=$2::uuid`, [tenantId, entityId]),
        client.query(
          `SELECT * FROM grc_phase2_relations
           WHERE tenant_id=$1::uuid AND source_type=$2 AND source_id=$3::uuid
           ORDER BY created_at DESC`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_phase2_relations
           WHERE tenant_id=$1::uuid AND target_type=$2 AND target_id=$3::uuid
           ORDER BY created_at DESC`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_operational_dependencies
           WHERE tenant_id=$1::uuid AND source_type=$2 AND source_id=$3::uuid
           ORDER BY created_at DESC`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_operational_dependencies
           WHERE tenant_id=$1::uuid AND target_type=$2 AND target_id=$3::uuid
           ORDER BY created_at DESC`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_operational_alerts
           WHERE tenant_id=$1::uuid AND entity_type=$2 AND entity_id=$3::uuid
           ORDER BY created_at DESC LIMIT 100`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_phase3_readiness_impacts
           WHERE tenant_id=$1::uuid AND entity_type=$2 AND entity_id=$3::uuid
           ORDER BY created_at DESC LIMIT 100`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT * FROM grc_phase3_state_history
           WHERE tenant_id=$1::uuid AND entity_type=$2 AND entity_id=$3::uuid
           ORDER BY changed_at DESC LIMIT 100`,
          [tenantId, entityType, entityId]
        ),
        client.query(
          `SELECT id,event_name,payload,occurred_at,recorded_by
           FROM grc_domain_events
           WHERE tenant_id=$1::uuid AND aggregate_type=$2 AND aggregate_id=$3::uuid
           ORDER BY occurred_at DESC LIMIT 100`,
          [tenantId, entityType, entityId]
        ),
        entityType === 'bia'
          ? client.query(
            `SELECT * FROM grc_bia_impacts
             WHERE tenant_id=$1::uuid AND bia_id=$2::uuid
             ORDER BY duration_minutes,dimension`,
            [tenantId, entityId]
          )
          : Promise.resolve({ rows: [] }),
      ]);
      const row = entity.rows[0];
      const planId = entityType === 'continuity_plan'
        ? row.id
        : row.plan_id || null;
      const linkedPlan = planId
        ? await client.query(
          `SELECT * FROM grc_continuity_plans
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [tenantId, planId]
        )
        : { rows: [] };
      const plan = linkedPlan.rows[0] || null;
      const processId = entityType === 'process'
        ? row.id
        : row.process_id || row.primary_process_id || plan?.process_id || null;
      const serviceId = entityType === 'service'
        ? row.id
        : row.service_id || plan?.service_id || null;
      const biaId = entityType === 'bia' ? row.id : row.bia_id || plan?.bia_id || null;
      const organizationId = entityType === 'organization'
        ? row.id
        : row.organizational_unit_id || plan?.organizational_unit_id || null;
      const linked = await Promise.all([
        organizationId
          ? client.query(
            'SELECT id,code,name,status,owner_user_id,version FROM grc_organizational_units WHERE tenant_id=$1::uuid AND id=$2::uuid',
            [tenantId, organizationId]
          )
          : Promise.resolve({ rows: [] }),
        processId
          ? client.query(
            'SELECT id,code,name,lifecycle_status AS status,owner_user_id,version FROM tenant_processes WHERE tenant_id=$1::uuid AND id=$2::uuid',
            [tenantId, processId]
          )
          : Promise.resolve({ rows: [] }),
        serviceId
          ? client.query(
            'SELECT id,code,name,status,owner_user_id,version,rto_minutes,rpo_minutes,mtpd_minutes FROM grc_operational_services WHERE tenant_id=$1::uuid AND id=$2::uuid',
            [tenantId, serviceId]
          )
          : Promise.resolve({ rows: [] }),
        (processId || serviceId || biaId)
          ? client.query(
            `SELECT id,code,status,owner_user_id,version,process_id,service_id,
                    rto_minutes,rpo_minutes,mtpd_minutes
             FROM grc_bia_assessments
             WHERE tenant_id=$1::uuid
               AND ($2::uuid IS NULL OR process_id=$2::uuid)
               AND ($3::uuid IS NULL OR service_id=$3::uuid)
               AND ($4::uuid IS NULL OR id=$4::uuid)
             ORDER BY updated_at DESC LIMIT 50`,
            [tenantId, processId, serviceId, biaId]
          )
          : Promise.resolve({ rows: [] }),
        (processId || serviceId || biaId || planId)
          ? client.query(
            `SELECT id,code,name,status,version,process_id,service_id,bia_id
             FROM grc_continuity_plans
             WHERE tenant_id=$1::uuid
               AND (
                 ($2::uuid IS NOT NULL AND process_id=$2::uuid)
                 OR ($3::uuid IS NOT NULL AND service_id=$3::uuid)
                 OR ($4::uuid IS NOT NULL AND bia_id=$4::uuid)
                 OR ($5::uuid IS NOT NULL AND id=$5::uuid)
               )
             ORDER BY updated_at DESC LIMIT 50`,
            [tenantId, processId, serviceId, biaId, planId]
          )
          : Promise.resolve({ rows: [] }),
        planId
          ? client.query(
            `SELECT id,plan_id,test_type,status,scheduled_at,completed_at,
                    target_rto_minutes,observed_rto_minutes,target_rpo_minutes,observed_rpo_minutes
             FROM grc_continuity_tests
             WHERE tenant_id=$1::uuid AND plan_id=$2::uuid
             ORDER BY scheduled_at DESC LIMIT 50`,
            [tenantId, planId]
          )
          : Promise.resolve({ rows: [] }),
        client.query(
          `SELECT id,code,name,metric_type,entity_type,entity_id,status,version
           FROM grc_metric_definitions
           WHERE tenant_id=$1::uuid AND (
             (entity_type=$2 AND entity_id=$3::uuid)
             OR ($4::uuid IS NOT NULL AND entity_type='process' AND entity_id=$4::uuid)
             OR ($5::uuid IS NOT NULL AND entity_type='service' AND entity_id=$5::uuid)
             OR ($6::uuid IS NOT NULL AND entity_type='continuity_plan' AND entity_id=$6::uuid)
           ) ORDER BY updated_at DESC LIMIT 50`,
          [tenantId, entityType, entityId, processId, serviceId, planId]
        ),
        (processId || serviceId || entityType === 'quantitative_risk')
          ? client.query(
            `SELECT id,code,risk_id,scenario,status,version,annualized_loss,
                    process_id,service_id
             FROM grc_quantitative_risk_assessments
             WHERE tenant_id=$1::uuid AND (
               ($2::uuid IS NOT NULL AND process_id=$2::uuid)
               OR ($3::uuid IS NOT NULL AND service_id=$3::uuid)
               OR ($4::uuid IS NOT NULL AND id=$4::uuid)
             ) ORDER BY updated_at DESC LIMIT 50`,
            [
              tenantId,
              processId,
              serviceId,
              entityType === 'quantitative_risk' ? entityId : null,
            ]
          )
          : Promise.resolve({ rows: [] }),
        (processId || serviceId || planId || entityType === 'crisis')
          ? client.query(
            `SELECT id,code,crisis_level,status,recovery_status,plan_id,process_id,service_id
             FROM grc_crisis_activations
             WHERE tenant_id=$1::uuid AND (
               ($2::uuid IS NOT NULL AND process_id=$2::uuid)
               OR ($3::uuid IS NOT NULL AND service_id=$3::uuid)
               OR ($4::uuid IS NOT NULL AND plan_id=$4::uuid)
               OR ($5::uuid IS NOT NULL AND id=$5::uuid)
             ) ORDER BY activated_at DESC LIMIT 50`,
            [
              tenantId,
              processId,
              serviceId,
              planId,
              entityType === 'crisis' ? entityId : null,
            ]
          )
          : Promise.resolve({ rows: [] }),
      ]);
      const allRelations = [...outgoing.rows, ...incoming.rows];
      const governanceTypes = [
        'risk', 'control', 'finding', 'nonconformity', 'action', 'supplier',
        'incident', 'audit', 'evidence', 'requirement',
      ];
      const governance = Object.fromEntries(governanceTypes.map(type => [
        type === 'nonconformity' ? 'nonconformities' : `${type}s`,
        allRelations.filter(relation => (
          relation.source_type === type || relation.target_type === type
        )),
      ]));
      return {
        entity: row,
        relations: { outgoing: outgoing.rows, incoming: incoming.rows },
        dependencies: { outgoing: dependenciesOut.rows, incoming: dependenciesIn.rows },
        alerts: alerts.rows,
        readiness_impacts: readiness.rows,
        history: history.rows,
        events: events.rows,
        bia_impacts: biaImpacts.rows,
        linked_context: {
          units: linked[0].rows,
          processes: linked[1].rows,
          services: linked[2].rows,
          bia: linked[3].rows,
          plans: linked[4].rows,
          tests: linked[5].rows,
          metrics: linked[6].rows,
          quantitative_risks: linked[7].rows,
          crises: linked[8].rows,
          alerts: alerts.rows,
          readiness: readiness.rows,
          ...governance,
        },
      };
  }

  async function createRelation({ tenantId, userId, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, body.source_type, body.source_id);
      await assertTenantEntity(client, tenantId, body.target_type, body.target_id);
      const result = await client.query(
        `INSERT INTO grc_phase2_relations (
           tenant_id,source_type,source_id,target_type,target_id,relation_type,
           status,provenance,confidence,created_by
         ) VALUES ($1::uuid,$2,$3::uuid,$4,$5::uuid,$6,'active',$7::jsonb,$8,$9::uuid)
         ON CONFLICT (
           tenant_id,source_type,source_id,target_type,target_id,relation_type,version
         ) DO UPDATE SET status='active',updated_at=now()
         RETURNING *`,
        [
          tenantId, body.source_type, body.source_id, body.target_type, body.target_id,
          requiredText(body.relation_type, 'PHASE3_RELATION_TYPE_REQUIRED', 120),
          json(object(body.provenance, { source: 'manual' })),
          asNumber(body.confidence ?? 100, 'PHASE3_CONFIDENCE_INVALID', { minimum: 0, maximum: 100 }),
          userId || null,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'upsert', tableName: 'grc_phase2_relations',
        recordId: result.rows[0].id, newData: result.rows[0],
      });
      return result.rows[0];
    });
  }

  async function createDependency({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      const sourceType = requiredText(body.source_type, 'PHASE3_DEPENDENCY_SOURCE_TYPE_REQUIRED', 80);
      const targetType = requiredText(body.target_type, 'PHASE3_DEPENDENCY_TARGET_TYPE_REQUIRED', 80);
      const dependencyType = requiredText(body.dependency_type, 'PHASE3_DEPENDENCY_TYPE_REQUIRED', 120);
      if (!DEPENDENCY_CONTRACTS.has(`${sourceType}:${targetType}:${dependencyType}`)) {
        throw new Phase3Error(
          'PHASE3_DEPENDENCY_CONTRACT_INVALID',
          'La relación de dependencia no corresponde al origen y destino.',
          409
        );
      }
      await assertTenantEntity(client, tenantId, sourceType, body.source_id);
      await assertTenantEntity(client, tenantId, targetType, body.target_id);
      const result = await client.query(
        `INSERT INTO grc_operational_dependencies (
           tenant_id,source_type,source_id,target_type,target_id,dependency_type,
           criticality,is_mandatory,alternative_description,max_tolerable_minutes,
           source_reference,provenance,created_by
         ) VALUES ($1::uuid,$2,$3::uuid,$4,$5::uuid,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::uuid)
         ON CONFLICT (tenant_id,source_type,source_id,target_type,target_id,dependency_type)
         DO UPDATE SET criticality=EXCLUDED.criticality,is_mandatory=EXCLUDED.is_mandatory,
           alternative_description=EXCLUDED.alternative_description,
           max_tolerable_minutes=EXCLUDED.max_tolerable_minutes,
           source_reference=EXCLUDED.source_reference,provenance=EXCLUDED.provenance,
           updated_at=now()
         RETURNING *`,
        [
          tenantId, sourceType, body.source_id, targetType, body.target_id,
          dependencyType, body.criticality || 'medium',
          body.is_mandatory !== false, optionalText(body.alternative_description),
          asNumber(body.max_tolerable_minutes, 'PHASE3_DEPENDENCY_TIME_INVALID', { minimum: 0, required: false }),
          requiredText(body.source_reference, 'PHASE3_DEPENDENCY_SOURCE_REQUIRED', 500),
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'dependency.changed',
        aggregateType: body.source_type, aggregateId: body.source_id,
        payload: row, correlationId,
        idempotencyKey: `dependency.changed:${row.id}:${row.updated_at}`,
      });
      await audit(client, {
        tenantId, userId, action: 'upsert', tableName: 'grc_operational_dependencies',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { dependency: row, impact: event };
    });
  }

  async function createOrganization({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.parent_unit_id) {
        await assertTenantEntity(client, tenantId, 'organization', body.parent_unit_id);
      }
      await assertTenantUser(client, tenantId, body.owner_user_id || userId);
      await assertTenantUser(client, tenantId, body.backup_owner_user_id);
      const result = await client.query(
        `INSERT INTO grc_organizational_units (
           tenant_id,code,name,description,unit_type,parent_unit_id,owner_user_id,
           backup_owner_user_id,location_reference,status,valid_from,valid_until,
           next_review_at,provenance,created_by,updated_by
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8::uuid,$9,'draft',
           $10::date,$11::date,$12::timestamptz,$13::jsonb,$14::uuid,$14::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_UNIT_CODE_REQUIRED', 80),
          requiredText(body.name, 'PHASE3_UNIT_NAME_REQUIRED', 240),
          optionalText(body.description), body.unit_type || 'area', body.parent_unit_id || null,
          body.owner_user_id || userId || null, body.backup_owner_user_id || null,
          optionalText(body.location_reference, 500), body.valid_from || null,
          body.valid_until || null, body.next_review_at || null,
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const impact = await recordEvent(client, {
        tenantId, userId, eventName: 'organization.created',
        aggregateType: 'organization', aggregateId: row.id, payload: row,
        ownerUserId: row.owner_user_id, correlationId,
        idempotencyKey: `organization.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_organizational_units',
        recordId: row.id, newData: row, metadata: { event_id: impact.event.id },
      });
      return { entity: row, impact };
    });
  }

  async function createProcess({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.organizational_unit_id) {
        await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      }
      if (body.parent_process_id) {
        await assertTenantEntity(client, tenantId, 'process', body.parent_process_id);
      }
      await assertTenantUser(client, tenantId, body.owner_user_id || userId);
      await assertTenantUser(client, tenantId, body.backup_owner_user_id);
      const criticalityScore = asNumber(
        body.criticality_score ?? 0,
        'PHASE3_PROCESS_CRITICALITY_INVALID',
        { minimum: 0, maximum: 100 }
      );
      const result = await client.query(
        `INSERT INTO tenant_processes (
           tenant_id,code,name,description,area,owner_user_id,criticality,is_active,
           organizational_unit_id,parent_process_id,backup_owner_user_id,process_type,
           objective,scope,lifecycle_status,criticality_score,criticality_confirmed,
           valid_from,valid_until,review_due_at,version,metadata
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7,TRUE,$8::uuid,$9::uuid,$10::uuid,
           $11,$12,$13,'draft',$14,$15,$16::date,$17::date,$18::timestamptz,1,$19::jsonb)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_PROCESS_CODE_REQUIRED', 80),
          requiredText(body.name, 'PHASE3_PROCESS_NAME_REQUIRED', 240),
          optionalText(body.description), optionalText(body.area, 200),
          body.owner_user_id || userId || null, body.criticality || 'medium',
          body.organizational_unit_id || null, body.parent_process_id || null,
          body.backup_owner_user_id || null, body.process_type || 'operational',
          optionalText(body.objective), optionalText(body.scope), criticalityScore,
          body.criticality_confirmed || null, body.valid_from || null,
          body.valid_until || null, body.review_due_at || null,
          json(object(body.metadata)),
        ]
      );
      const row = result.rows[0];
      const bia = await client.query(
        `SELECT 1 FROM grc_bia_assessments
         WHERE tenant_id=$1::uuid AND process_id=$2::uuid
           AND status IN ('approved','current') AND next_review_at>now() LIMIT 1`,
        [tenantId, row.id]
      );
      const impact = await recordEvent(client, {
        tenantId, userId, eventName: 'process.created',
        aggregateType: 'process', aggregateId: row.id,
        payload: {
          ...row,
          is_critical: criticalityScore >= 75 || row.criticality === 'critical',
          has_current_bia: bia.rowCount > 0,
        },
        ownerUserId: row.owner_user_id, correlationId,
        idempotencyKey: `process.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'tenant_processes',
        recordId: row.id, newData: row, metadata: { event_id: impact.event.id },
      });
      return { entity: row, impact };
    });
  }

  async function createService({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.organizational_unit_id) {
        await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      }
      if (body.primary_process_id) {
        await assertTenantEntity(client, tenantId, 'process', body.primary_process_id);
      }
      await assertTenantUser(client, tenantId, body.owner_user_id || userId);
      await assertTenantUser(client, tenantId, body.backup_owner_user_id);
      const result = await client.query(
        `INSERT INTO grc_operational_services (
           tenant_id,code,name,description,organizational_unit_id,primary_process_id,
           owner_user_id,backup_owner_user_id,minimum_service_level,critical_schedule,
           criticality,rto_minutes,rpo_minutes,mtpd_minutes,status,next_review_at,
           provenance,created_by,updated_by
         ) VALUES ($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9,$10,$11,
           $12,$13,$14,'draft',$15::timestamptz,$16::jsonb,$17::uuid,$17::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_SERVICE_CODE_REQUIRED', 80),
          requiredText(body.name, 'PHASE3_SERVICE_NAME_REQUIRED', 240),
          optionalText(body.description), body.organizational_unit_id || null,
          body.primary_process_id || null, body.owner_user_id || userId || null,
          body.backup_owner_user_id || null, optionalText(body.minimum_service_level, 1000),
          optionalText(body.critical_schedule, 1000), body.criticality || 'medium',
          asNumber(body.rto_minutes, 'PHASE3_RTO_INVALID', { minimum: 0, required: false }),
          asNumber(body.rpo_minutes, 'PHASE3_RPO_INVALID', { minimum: 0, required: false }),
          asNumber(body.mtpd_minutes, 'PHASE3_MTPD_INVALID', { minimum: 0, required: false }),
          body.next_review_at || null, json(object(body.provenance, { source: 'manual' })),
          userId || null,
        ]
      );
      const row = result.rows[0];
      const impact = await recordEvent(client, {
        tenantId, userId, eventName: 'service.created',
        aggregateType: 'service', aggregateId: row.id, payload: row,
        ownerUserId: row.owner_user_id, correlationId,
        idempotencyKey: `service.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_operational_services',
        recordId: row.id, newData: row, metadata: { event_id: impact.event.id },
      });
      return { entity: row, impact };
    });
  }

  async function createBia({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.process_id) await assertTenantEntity(client, tenantId, 'process', body.process_id);
      if (body.service_id) await assertTenantEntity(client, tenantId, 'service', body.service_id);
      if (body.organizational_unit_id) await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      await assertTenantUser(client, tenantId, body.owner_user_id || userId);
      const mtpd = asNumber(body.mtpd_minutes, 'PHASE3_BIA_MTPD_REQUIRED', { minimum: 0 });
      const rto = asNumber(body.rto_minutes, 'PHASE3_BIA_RTO_REQUIRED', { minimum: 0 });
      const rpo = asNumber(body.rpo_minutes, 'PHASE3_BIA_RPO_REQUIRED', { minimum: 0 });
      if (rto > mtpd) {
        throw new Phase3Error('PHASE3_BIA_RTO_EXCEEDS_MTPD', 'RTO no puede superar MTPD/MAO.', 409);
      }
      const result = await client.query(
        `INSERT INTO grc_bia_assessments (
           tenant_id,code,organizational_unit_id,process_id,service_id,version,
           owner_user_id,assessment_date,assumptions,estimated_financial_impact,
           mtpd_minutes,rto_minutes,rpo_minutes,minimum_service_level,required_people,
           alternative_resources,status,next_review_at,provenance,created_by,updated_by
         ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,1,$6::uuid,
           COALESCE($7::date,CURRENT_DATE),$8,$9,$10,$11,$12,$13,$14,$15,'draft',
           $16::timestamptz,$17::jsonb,$18::uuid,$18::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_BIA_CODE_REQUIRED', 80),
          body.organizational_unit_id || null, body.process_id || null,
          body.service_id || null, body.owner_user_id || userId || null,
          body.assessment_date || null, optionalText(body.assumptions),
          asNumber(body.estimated_financial_impact, 'PHASE3_BIA_FINANCIAL_INVALID', { minimum: 0, required: false }),
          mtpd, rto, rpo, optionalText(body.minimum_service_level, 1000),
          asNumber(body.required_people, 'PHASE3_BIA_PEOPLE_INVALID', { minimum: 0, required: false }),
          optionalText(body.alternative_resources), body.next_review_at,
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      for (const impact of Array.isArray(body.impacts) ? body.impacts : []) {
        const impactResult = await client.query(
          `INSERT INTO grc_bia_impacts (
             tenant_id,bia_id,dimension,duration_minutes,impact_level,estimated_amount,
             rationale,provenance,created_by
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::uuid)
           ON CONFLICT (tenant_id,bia_id,dimension,duration_minutes) DO UPDATE SET
             impact_level=EXCLUDED.impact_level,
             estimated_amount=EXCLUDED.estimated_amount,
             rationale=EXCLUDED.rationale,
             provenance=EXCLUDED.provenance
           RETURNING *`,
          [
            tenantId, row.id, impact.dimension,
            asNumber(impact.duration_minutes, 'PHASE3_BIA_DURATION_INVALID', { minimum: 0 }),
            impact.impact_level,
            asNumber(impact.estimated_amount, 'PHASE3_BIA_AMOUNT_INVALID', { minimum: 0, required: false }),
            requiredText(impact.rationale, 'PHASE3_BIA_RATIONALE_REQUIRED'),
            json(object(impact.provenance, { source: 'manual' })), userId || null,
          ]
        );
        await audit(client, {
          tenantId, userId, action: 'upsert', tableName: 'grc_bia_impacts',
          recordId: impactResult.rows[0].id, newData: impactResult.rows[0],
        });
      }
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'bia.created', aggregateType: 'bia',
        aggregateId: row.id, payload: row, ownerUserId: row.owner_user_id,
        correlationId, idempotencyKey: `bia.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_bia_assessments',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  async function createBiaImpact({
    tenantId, userId, correlationId, biaId, body, idempotencyKey,
  }) {
    return withTransaction(async client => {
      const replay = await replayMutation(client, tenantId, idempotencyKey);
      if (replay) return replay;
      await assertTenantEntity(client, tenantId, 'bia', biaId);
      const result = await client.query(
        `INSERT INTO grc_bia_impacts (
           tenant_id,bia_id,dimension,duration_minutes,impact_level,estimated_amount,
           rationale,provenance,created_by
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::uuid)
         ON CONFLICT (tenant_id,bia_id,dimension,duration_minutes) DO UPDATE SET
           impact_level=EXCLUDED.impact_level,
           estimated_amount=EXCLUDED.estimated_amount,
           rationale=EXCLUDED.rationale,
           provenance=EXCLUDED.provenance
         RETURNING *`,
        [
          tenantId, biaId, body.dimension,
          asNumber(body.duration_minutes, 'PHASE3_BIA_DURATION_INVALID', { minimum: 0 }),
          body.impact_level,
          asNumber(body.estimated_amount, 'PHASE3_BIA_AMOUNT_INVALID', { minimum: 0, required: false }),
          requiredText(body.rationale, 'PHASE3_BIA_RATIONALE_REQUIRED'),
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'bia.impact.recorded',
        aggregateType: 'bia', aggregateId: biaId, payload: row, correlationId,
        idempotencyKey: requiredText(idempotencyKey, 'PHASE3_IDEMPOTENCY_KEY_REQUIRED', 300),
      });
      await audit(client, {
        tenantId, userId, action: 'upsert', tableName: 'grc_bia_impacts',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  async function createContinuityPlan({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.process_id) await assertTenantEntity(client, tenantId, 'process', body.process_id);
      if (body.service_id) await assertTenantEntity(client, tenantId, 'service', body.service_id);
      if (body.bia_id) await assertTenantEntity(client, tenantId, 'bia', body.bia_id);
      if (body.organizational_unit_id) await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      await assertTenantUser(client, tenantId, body.activation_authority_user_id || userId);
      const result = await client.query(
        `INSERT INTO grc_continuity_plans (
           tenant_id,code,name,scope,organizational_unit_id,process_id,service_id,bia_id,
           activation_criteria,activation_authority_user_id,procedures,recovery_sequence,
           communication_plan,return_to_operation_criteria,version,status,valid_from,
           valid_until,next_review_at,provenance,created_by,updated_by
         ) VALUES ($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9,$10::uuid,
           $11,$12,$13,$14,1,'draft',$15::date,$16::date,$17::timestamptz,$18::jsonb,
           $19::uuid,$19::uuid) RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_PLAN_CODE_REQUIRED', 80),
          requiredText(body.name, 'PHASE3_PLAN_NAME_REQUIRED', 240),
          requiredText(body.scope, 'PHASE3_PLAN_SCOPE_REQUIRED'),
          body.organizational_unit_id || null, body.process_id || null, body.service_id || null,
          body.bia_id || null, requiredText(body.activation_criteria, 'PHASE3_PLAN_ACTIVATION_REQUIRED'),
          body.activation_authority_user_id || userId || null,
          requiredText(body.procedures, 'PHASE3_PLAN_PROCEDURES_REQUIRED'),
          requiredText(body.recovery_sequence, 'PHASE3_PLAN_SEQUENCE_REQUIRED'),
          optionalText(body.communication_plan),
          requiredText(body.return_to_operation_criteria, 'PHASE3_PLAN_RETURN_REQUIRED'),
          body.valid_from || null, body.valid_until || null, body.next_review_at,
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'continuity.plan.created',
        aggregateType: 'continuity_plan', aggregateId: row.id, payload: row,
        correlationId, idempotencyKey: `continuity.plan.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_continuity_plans',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  async function createContinuityTest({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, 'continuity_plan', body.plan_id);
      const result = await client.query(
        `INSERT INTO grc_continuity_tests (
           tenant_id,plan_id,test_type,objective,scenario,scope,scheduled_at,
           expected_result,target_rto_minutes,target_rpo_minutes,status,next_test_at,
           provenance,created_by,updated_by
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,
           'planned',$11::timestamptz,$12::jsonb,$13::uuid,$13::uuid) RETURNING *`,
        [
          tenantId, body.plan_id, body.test_type,
          requiredText(body.objective, 'PHASE3_TEST_OBJECTIVE_REQUIRED'),
          requiredText(body.scenario, 'PHASE3_TEST_SCENARIO_REQUIRED'),
          requiredText(body.scope, 'PHASE3_TEST_SCOPE_REQUIRED'),
          body.scheduled_at,
          requiredText(body.expected_result, 'PHASE3_TEST_EXPECTED_REQUIRED'),
          asNumber(body.target_rto_minutes, 'PHASE3_TEST_RTO_INVALID', { minimum: 0, required: false }),
          asNumber(body.target_rpo_minutes, 'PHASE3_TEST_RPO_INVALID', { minimum: 0, required: false }),
          body.next_test_at || null, json(object(body.provenance, { source: 'manual' })),
          userId || null,
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'continuity.test.created',
        aggregateType: 'continuity_test', aggregateId: row.id, payload: row,
        correlationId, idempotencyKey: `continuity.test.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_continuity_tests',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  async function createCrisis({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      if (body.plan_id) await assertTenantEntity(client, tenantId, 'continuity_plan', body.plan_id);
      if (body.incident_id) await assertTenantEntity(client, tenantId, 'incident', body.incident_id);
      if (body.organizational_unit_id) await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      if (body.process_id) await assertTenantEntity(client, tenantId, 'process', body.process_id);
      if (body.service_id) await assertTenantEntity(client, tenantId, 'service', body.service_id);
      await assertTenantUser(client, tenantId, userId);
      const result = await client.query(
        `INSERT INTO grc_crisis_activations (
           tenant_id,code,plan_id,incident_id,organizational_unit_id,process_id,service_id,
           crisis_level,activation_reason,recovery_status,status,activated_by,provenance
         ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,
           'activated','active',$10::uuid,$11::jsonb) RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_CRISIS_CODE_REQUIRED', 80),
          body.plan_id || null, body.incident_id || null, body.organizational_unit_id || null,
          body.process_id || null, body.service_id || null, body.crisis_level,
          requiredText(body.activation_reason, 'PHASE3_CRISIS_REASON_REQUIRED'),
          userId || null, json(object(body.provenance, { source: 'manual' })),
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'crisis.activated', aggregateType: 'crisis',
        aggregateId: row.id, payload: row, correlationId,
        idempotencyKey: `crisis.activated:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_crisis_activations',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  async function addCrisisLog({ tenantId, userId, correlationId, id, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, 'crisis', id);
      const result = await client.query(
        `INSERT INTO grc_crisis_log (
           tenant_id,crisis_id,entry_type,entry_text,occurred_at,recorded_by,provenance
         ) VALUES ($1::uuid,$2::uuid,$3,$4,COALESCE($5::timestamptz,now()),$6::uuid,$7::jsonb)
         RETURNING *`,
        [
          tenantId, id, body.entry_type,
          requiredText(body.entry_text, 'PHASE3_CRISIS_ENTRY_REQUIRED'),
          body.occurred_at || null, userId || null,
          json(object(body.provenance, { source: 'manual' })),
        ]
      );
      const row = result.rows[0];
      await recordEvent(client, {
        tenantId, userId, eventName: 'crisis.decision.recorded',
        aggregateType: 'crisis', aggregateId: id, payload: row, correlationId,
        idempotencyKey: `crisis.decision.recorded:${row.id}:1`,
      });
      return row;
    });
  }

  async function createMetric({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, body.entity_type, body.entity_id);
      await assertTenantUser(client, tenantId, body.owner_user_id || userId);
      const result = await client.query(
        `INSERT INTO grc_metric_definitions (
           tenant_id,code,name,description,metric_type,entity_type,entity_id,
           formula_definition,source_description,frequency,owner_user_id,unit,
           expected_direction,target_value,warning_threshold,critical_threshold,
           measurement_window,status,valid_from,valid_until,version,provenance,
           created_by,updated_by
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$8,$9,$10,$11::uuid,$12,$13,
           $14,$15,$16,$17,'draft',$18::date,$19::date,1,$20::jsonb,$21::uuid,$21::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_METRIC_CODE_REQUIRED', 80),
          requiredText(body.name, 'PHASE3_METRIC_NAME_REQUIRED', 240),
          optionalText(body.description), body.metric_type, body.entity_type, body.entity_id,
          requiredText(body.formula_definition, 'PHASE3_METRIC_FORMULA_REQUIRED'),
          requiredText(body.source_description, 'PHASE3_METRIC_SOURCE_REQUIRED'),
          requiredText(body.frequency, 'PHASE3_METRIC_FREQUENCY_REQUIRED', 120),
          body.owner_user_id || userId || null,
          requiredText(body.unit, 'PHASE3_METRIC_UNIT_REQUIRED', 80),
          body.expected_direction,
          asNumber(body.target_value, 'PHASE3_METRIC_TARGET_INVALID'),
          asNumber(body.warning_threshold, 'PHASE3_METRIC_WARNING_INVALID'),
          asNumber(body.critical_threshold, 'PHASE3_METRIC_CRITICAL_INVALID'),
          requiredText(body.measurement_window, 'PHASE3_METRIC_WINDOW_REQUIRED', 120),
          body.valid_from || null, body.valid_until || null,
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const event = await recordEvent(client, {
        tenantId, userId, eventName: 'metric.created', aggregateType: 'metric',
        aggregateId: row.id, payload: row, ownerUserId: row.owner_user_id,
        correlationId, idempotencyKey: `metric.created:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create', tableName: 'grc_metric_definitions',
        recordId: row.id, newData: row, metadata: { event_id: event.event.id },
      });
      return { entity: row, impact: event };
    });
  }

  function measurementImpact(definition, value) {
    const critical = Number(definition.critical_threshold);
    const warning = Number(definition.warning_threshold);
    const direction = definition.expected_direction;
    if (direction === 'higher_is_better') {
      if (value <= critical) return 'critical';
      if (value <= warning) return 'warning';
      return 'normal';
    }
    if (direction === 'lower_is_better') {
      if (value >= critical) return 'critical';
      if (value >= warning) return 'warning';
      return 'normal';
    }
    const distance = Math.abs(value - Number(definition.target_value));
    if (distance >= Math.abs(critical)) return 'critical';
    if (distance >= Math.abs(warning)) return 'warning';
    return 'normal';
  }

  async function recordMeasurement({ tenantId, userId, correlationId, metricId, body, idempotencyKey }) {
    return withTransaction(async client => {
      const definition = await client.query(
        'SELECT * FROM grc_metric_definitions WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [tenantId, uuid(metricId)]
      );
      if (!definition.rowCount) {
        throw new Phase3Error('PHASE3_METRIC_NOT_FOUND', 'Indicador no encontrado.', 404);
      }
      const metricDefinition = definition.rows[0];
      if (!metricDefinition.owner_user_id) {
        throw new Phase3Error('PHASE3_METRIC_OWNER_REQUIRED', 'El indicador requiere responsable.', 409);
      }
      if (!body.source_description || !object(body.provenance, null)) {
        throw new Phase3Error('PHASE3_MEASUREMENT_SOURCE_REQUIRED', 'La medición requiere fuente y provenance.', 409);
      }
      const value = asNumber(body.numeric_value, 'PHASE3_MEASUREMENT_VALUE_REQUIRED');
      const impactStatus = body.quality === 'rejected'
        ? 'excluded'
        : measurementImpact(metricDefinition, value);
      const result = await client.query(
        `INSERT INTO grc_metric_measurements (
           tenant_id,metric_id,period_start,period_end,numeric_value,source_description,
           measured_at,provenance,evidence_id,quality,validation_status,comment,trend,
           impact_status,idempotency_key,created_by
         ) VALUES ($1::uuid,$2::uuid,$3::timestamptz,$4::timestamptz,$5,$6,
           COALESCE($7::timestamptz,now()),$8::jsonb,$9::uuid,$10,$11,$12,$13,$14,$15,$16::uuid)
         ON CONFLICT (tenant_id,metric_id,idempotency_key) DO UPDATE SET
           source_description=EXCLUDED.source_description
         RETURNING *`,
        [
          tenantId, metricId, body.period_start, body.period_end, value,
          requiredText(body.source_description, 'PHASE3_MEASUREMENT_SOURCE_REQUIRED'),
          body.measured_at || null, json(object(body.provenance)),
          body.evidence_id || null, body.quality || 'valid',
          body.validation_status || 'pending', optionalText(body.comment),
          body.trend || null, impactStatus,
          requiredText(idempotencyKey, 'PHASE3_IDEMPOTENCY_KEY_REQUIRED', 300),
          userId || null,
        ]
      );
      const row = result.rows[0];
      let impact = null;
      if (row.impact_status !== 'excluded') {
        const eventName = row.impact_status === 'critical'
          ? 'metric.threshold.critical'
          : row.impact_status === 'warning'
            ? 'metric.threshold.warning'
            : 'metric.measurement.recorded';
        impact = await recordEvent(client, {
          tenantId, userId, eventName, aggregateType: 'metric',
          aggregateId: metricId, aggregateVersion: metricDefinition.version,
          payload: {
            ...row,
            metric_type: metricDefinition.metric_type,
            affected_entity_type: metricDefinition.entity_type,
            affected_entity_id: metricDefinition.entity_id,
          },
          ownerUserId: metricDefinition.owner_user_id, correlationId,
          idempotencyKey: `metric.measurement:${row.id}:${eventName}`,
        });
      }
      await audit(client, {
        tenantId, userId, action: 'record', tableName: 'grc_metric_measurements',
        recordId: row.id, newData: row, metadata: { event_id: impact?.event?.id || null },
      });
      return { measurement: row, impact };
    });
  }

  async function createQuantitativeRisk({ tenantId, userId, correlationId, body }) {
    return withTransaction(async client => {
      await assertTenantEntity(client, tenantId, 'risk', body.risk_id);
      if (body.organizational_unit_id) await assertTenantEntity(client, tenantId, 'organization', body.organizational_unit_id);
      if (body.process_id) await assertTenantEntity(client, tenantId, 'process', body.process_id);
      if (body.service_id) await assertTenantEntity(client, tenantId, 'service', body.service_id);
      const minimum = asNumber(body.minimum_impact, 'PHASE3_QUANT_MIN_REQUIRED', { minimum: 0 });
      const likely = asNumber(body.most_likely_impact, 'PHASE3_QUANT_LIKELY_REQUIRED', { minimum: 0 });
      const maximum = asNumber(body.maximum_impact, 'PHASE3_QUANT_MAX_REQUIRED', { minimum: 0 });
      if (!(minimum <= likely && likely <= maximum)) {
        throw new Phase3Error(
          'PHASE3_QUANT_RANGE_INVALID',
          'Se requiere mínimo <= más probable <= máximo.',
          409
        );
      }
      const frequency = asNumber(body.estimated_frequency, 'PHASE3_QUANT_FREQUENCY_REQUIRED', { minimum: 0 });
      const controlCost = asNumber(body.control_cost ?? 0, 'PHASE3_CONTROL_COST_INVALID', { minimum: 0 });
      const expectedReduction = asNumber(body.expected_reduction ?? 0, 'PHASE3_REDUCTION_INVALID', { minimum: 0 });
      const expectedImpact = (minimum + (4 * likely) + maximum) / 6;
      const annualizedLoss = expectedImpact * frequency;
      const netExpectedBenefit = expectedReduction - controlCost;
      const result = await client.query(
        `INSERT INTO grc_quantitative_risk_assessments (
           tenant_id,code,risk_id,organizational_unit_id,process_id,service_id,scenario,
           minimum_impact,most_likely_impact,maximum_impact,estimated_frequency,
           expected_impact,annualized_loss,residual_annualized_loss,treatment_annualized_loss,
           control_cost,expected_reduction,net_expected_benefit,sensitivity_notes,
           treatment_comparison,assumptions,source_description,status,version,provenance,
           created_by,updated_by
         ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9,$10,$11,
           $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'draft',1,$23::jsonb,$24::uuid,$24::uuid)
         RETURNING *`,
        [
          tenantId, requiredText(body.code, 'PHASE3_QUANT_CODE_REQUIRED', 80),
          body.risk_id, body.organizational_unit_id || null, body.process_id || null,
          body.service_id || null, requiredText(body.scenario, 'PHASE3_QUANT_SCENARIO_REQUIRED'),
          minimum, likely, maximum, frequency, expectedImpact, annualizedLoss,
          asNumber(body.residual_annualized_loss, 'PHASE3_RESIDUAL_LOSS_INVALID', { minimum: 0, required: false }),
          asNumber(body.treatment_annualized_loss, 'PHASE3_TREATMENT_LOSS_INVALID', { minimum: 0, required: false }),
          controlCost, expectedReduction, netExpectedBenefit,
          optionalText(body.sensitivity_notes), optionalText(body.treatment_comparison),
          requiredText(body.assumptions, 'PHASE3_QUANT_ASSUMPTIONS_REQUIRED'),
          requiredText(body.source_description, 'PHASE3_QUANT_SOURCE_REQUIRED'),
          json(object(body.provenance, { source: 'manual' })), userId || null,
        ]
      );
      const row = result.rows[0];
      const impact = await recordEvent(client, {
        tenantId, userId, eventName: 'quantitative_risk.assessed',
        aggregateType: 'quantitative_risk', aggregateId: row.id, payload: row,
        correlationId, idempotencyKey: `quantitative_risk.assessed:${row.id}:1`,
      });
      await audit(client, {
        tenantId, userId, action: 'create',
        tableName: 'grc_quantitative_risk_assessments',
        recordId: row.id, newData: row, metadata: { event_id: impact.event.id },
      });
      return { entity: row, impact };
    });
  }


  async function updateEntity({
    tenantId, userId, correlationId, entityType, entityId, body, idempotencyKey,
  }) {
    return withTransaction(async client => {
      const replay = await replayMutation(client, tenantId, idempotencyKey);
      if (replay) return replay;
      const config = UPDATE_CONFIG[entityType];
      if (!config) {
        throw new Phase3Error('PHASE3_UPDATE_ENTITY_INVALID', 'Entidad no actualizable.', 400);
      }
      const current = await client.query(
        `SELECT * FROM ${config.table}
         WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE`,
        [tenantId, uuid(entityId)]
      );
      if (!current.rowCount) {
        throw new Phase3Error('PHASE3_ENTITY_NOT_FOUND', 'Entidad no encontrada.', 404);
      }

      const relationFields = {
        parent_unit_id: 'organization',
        organizational_unit_id: 'organization',
        parent_process_id: 'process',
        primary_process_id: 'process',
        process_id: 'process',
        service_id: 'service',
        bia_id: 'bia',
        plan_id: 'continuity_plan',
        incident_id: 'incident',
        entity_id: body.entity_type,
      };
      for (const [field, relationType] of Object.entries(relationFields)) {
        if (body[field]) {
          await assertTenantEntity(client, tenantId, relationType, body[field]);
        }
      }
      for (const field of [
        'owner_user_id', 'backup_owner_user_id', 'activation_authority_user_id',
      ]) {
        if (body[field]) await assertTenantUser(client, tenantId, body[field]);
      }

      const normalized = { ...body };
      if (entityType === 'bia') {
        const mtpd = Number(body.mtpd_minutes ?? current.rows[0].mtpd_minutes);
        const rto = Number(body.rto_minutes ?? current.rows[0].rto_minutes);
        if (rto > mtpd) {
          throw new Phase3Error('PHASE3_BIA_RTO_EXCEEDS_MTPD', 'RTO no puede superar MTPD/MAO.', 409);
        }
      }
      if (entityType === 'quantitative_risk') {
        const minimum = Number(body.minimum_impact ?? current.rows[0].minimum_impact);
        const likely = Number(body.most_likely_impact ?? current.rows[0].most_likely_impact);
        const maximum = Number(body.maximum_impact ?? current.rows[0].maximum_impact);
        if (!(minimum <= likely && likely <= maximum)) {
          throw new Phase3Error(
            'PHASE3_QUANT_RANGE_INVALID',
            'Se requiere mínimo <= más probable <= máximo.',
            409
          );
        }
        const frequency = Number(body.estimated_frequency ?? current.rows[0].estimated_frequency);
        const controlCost = Number(body.control_cost ?? current.rows[0].control_cost);
        const expectedReduction = Number(body.expected_reduction ?? current.rows[0].expected_reduction);
        normalized.expected_impact = (minimum + (4 * likely) + maximum) / 6;
        normalized.annualized_loss = normalized.expected_impact * frequency;
        normalized.net_expected_benefit = expectedReduction - controlCost;
      }

      const entries = config.fields
        .filter(field => Object.prototype.hasOwnProperty.call(normalized, field))
        .map(field => [field, normalized[field]]);
      if (!entries.length) {
        throw new Phase3Error('PHASE3_UPDATE_EMPTY', 'No se informaron cambios permitidos.', 400);
      }
      const values = [tenantId, entityId];
      const assignments = entries.map(([field, value]) => {
        values.push(value === '' ? null : value);
        return `${field}=$${values.length}`;
      });
      values.push(userId || null);
      assignments.push(`updated_by=$${values.length}::uuid`, 'updated_at=now()');
      if (config.versioned) assignments.push('version=version+1');

      const result = await client.query(
        `UPDATE ${config.table} SET ${assignments.join(',')}
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        values
      );
      const row = result.rows[0];
      let eventName = `${entityType}.updated`;
      let eventPayload = row;
      if (
        entityType === 'process'
        && ['criticality', 'criticality_score', 'criticality_confirmed']
          .some(field => Object.prototype.hasOwnProperty.call(body, field))
      ) {
        eventName = 'process.criticality.changed';
        const bia = await client.query(
          `SELECT 1 FROM grc_bia_assessments
           WHERE tenant_id=$1::uuid AND process_id=$2::uuid
             AND status IN ('approved','current') AND next_review_at>now()
           LIMIT 1`,
          [tenantId, row.id]
        );
        eventPayload = {
          ...row,
          is_critical: Number(row.criticality_score) >= 75 || row.criticality === 'critical',
          has_current_bia: bia.rowCount > 0,
        };
      }
      if (entityType === 'service' && Object.prototype.hasOwnProperty.call(body, 'criticality')) {
        eventName = 'service.criticality.changed';
      }
      if (entityType === 'bia' && row.next_review_at && new Date(row.next_review_at).getTime() <= clock()) {
        eventName = 'bia.review.required';
      }
      if (entityType === 'continuity_plan' && row.next_review_at && new Date(row.next_review_at).getTime() <= clock()) {
        eventName = 'continuity.plan.expired';
      }
      const impact = await recordEvent(client, {
        tenantId, userId, eventName, aggregateType: entityType, aggregateId: row.id,
        aggregateVersion: Number(row.version || 1), payload: eventPayload, correlationId,
        idempotencyKey: requiredText(idempotencyKey, 'PHASE3_IDEMPOTENCY_KEY_REQUIRED', 300),
        ownerUserId: row.owner_user_id,
      });
      await audit(client, {
        tenantId, userId, action: 'update', tableName: config.table,
        recordId: row.id, oldData: current.rows[0], newData: row,
        metadata: { event_id: impact.event.id },
      });
      return { entity: row, impact };
    });
  }
  async function transitionEntity({
    tenantId, userId, correlationId, entityType, entityId, body, idempotencyKey,
  }) {
    return withTransaction(async client => {
      const replay = await replayMutation(client, tenantId, idempotencyKey);
      if (replay) return replay;
      const config = TRANSITION_TABLES[entityType];
      if (!config) {
        throw new Phase3Error('PHASE3_TRANSITION_ENTITY_INVALID', 'Entidad no transicionable.', 400);
      }
      const current = await client.query(
        `SELECT * FROM ${config.table}
         WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE`,
        [tenantId, uuid(entityId)]
      );
      if (!current.rowCount) {
        throw new Phase3Error('PHASE3_ENTITY_NOT_FOUND', 'Entidad no encontrada.', 404);
      }
      const fromStatus = current.rows[0][config.status];
      const toStatus = requiredText(body.to_status, 'PHASE3_STATUS_REQUIRED', 80);
      try {
        assertTransition(entityType, fromStatus, toStatus);
      } catch (error) {
        if (error.code === 'PHASE3_INVALID_TRANSITION') {
          throw new Phase3Error(error.code, error.message, error.status);
        }
        throw error;
      }
      const approval = ['approved', 'current', 'active', 'passed', 'passed_with_observations'].includes(toStatus);
      const updated = await client.query(
        `UPDATE ${config.table} SET ${config.status}=$3,
           updated_at=now(),updated_by=$4::uuid
           ${approval && config.table !== 'tenant_processes' ? ',approved_by=$4::uuid,approved_at=now()' : ''}
           ${approval && config.table === 'tenant_processes' ? ',approved_by=$4::uuid,approved_at=now()' : ''}
         WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
        [tenantId, entityId, toStatus, userId || null]
      );
      const eventName = transitionEventName(entityType, toStatus);
      const payload = {
        ...updated.rows[0],
        ...(entityType === 'continuity_test' ? {
          observed_rto_minutes: body.observed_rto_minutes ?? updated.rows[0].observed_rto_minutes,
          observed_rpo_minutes: body.observed_rpo_minutes ?? updated.rows[0].observed_rpo_minutes,
          target_rto_minutes: updated.rows[0].target_rto_minutes,
          target_rpo_minutes: updated.rows[0].target_rpo_minutes,
        } : {}),
      };
      if (entityType === 'continuity_test' && ['passed', 'passed_with_observations', 'failed'].includes(toStatus)) {
        await client.query(
          `UPDATE grc_continuity_tests SET
             actual_result=COALESCE($3,actual_result),
             observed_rto_minutes=COALESCE($4,observed_rto_minutes),
             observed_rpo_minutes=COALESCE($5,observed_rpo_minutes),
             completed_at=COALESCE(completed_at,now())
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [
            tenantId, entityId, optionalText(body.actual_result),
            asNumber(body.observed_rto_minutes, 'PHASE3_TEST_RTO_INVALID', { minimum: 0, required: false }),
            asNumber(body.observed_rpo_minutes, 'PHASE3_TEST_RPO_INVALID', { minimum: 0, required: false }),
          ]
        );
      }
      const event = await recordEvent(client, {
        tenantId, userId, eventName, aggregateType: entityType,
        aggregateId: entityId, aggregateVersion: Number(updated.rows[0].version || 1),
        payload, correlationId,
        idempotencyKey: requiredText(idempotencyKey, 'PHASE3_IDEMPOTENCY_KEY_REQUIRED', 300),
        ownerUserId: updated.rows[0].owner_user_id,
      });
      await client.query(
        `INSERT INTO grc_phase3_state_history (
           tenant_id,entity_type,entity_id,from_status,to_status,reason,changed_by,source_event_id
         ) VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7::uuid,$8::uuid)`,
        [
          tenantId, entityType, entityId, fromStatus, toStatus,
          requiredText(body.reason, 'PHASE3_TRANSITION_REASON_REQUIRED'),
          userId || null, event.event.id,
        ]
      );
      await audit(client, {
        tenantId, userId, action: 'transition', tableName: config.table,
        recordId: entityId, oldData: current.rows[0], newData: updated.rows[0],
        metadata: { event_id: event.event.id, reason: body.reason },
      });
      return { entity: updated.rows[0], impact: event };
    });
  }

  function transitionEventName(entityType, toStatus) {
    if (entityType === 'bia' && ['approved', 'current'].includes(toStatus)) return 'bia.approved';
    if (entityType === 'bia' && toStatus === 'expired') return 'bia.expired';
    if (entityType === 'continuity_plan' && toStatus === 'approved') return 'continuity.plan.approved';
    if (entityType === 'continuity_plan' && toStatus === 'activated') return 'continuity.plan.activated';
    if (entityType === 'continuity_plan' && toStatus === 'expired') return 'continuity.plan.expired';
    if (entityType === 'continuity_test' && toStatus === 'failed') return 'continuity.test.failed';
    if (entityType === 'continuity_test') return `continuity.test.${toStatus}`;
    if (entityType === 'crisis' && toStatus === 'closed') return 'crisis.closed';
    if (entityType === 'quantitative_risk' && ['approved', 'current'].includes(toStatus)) {
      return 'quantitative_risk.approved';
    }
    return `${entityType}.${toStatus}`;
  }

  function getImportTemplate(entityType) {
    const definition = IMPORT_DEFINITIONS[entityType];
    if (!definition) {
      throw new Phase3Error(
        'PHASE3_IMPORT_ENTITY_INVALID',
        'La entidad no admite importación operacional.',
        400
      );
    }
    return {
      entity_type: entityType,
      template_version: IMPORT_TEMPLATE_VERSION,
      file_name: `tcdx-${entityType}-${IMPORT_TEMPLATE_VERSION}.csv`,
      mime_type: 'text/csv;charset=utf-8',
      content: [
        definition.columns.map(csvCell).join(','),
        definition.example.map(csvCell).join(','),
      ].join('\n'),
      columns: definition.columns,
    };
  }

  function importIssue(column, code, message) {
    return { column, code, message };
  }

  function validImportDate(value) {
    if (!value) return true;
    const normalized = String(value).trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!match) return false;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getUTCFullYear() === Number(match[1])
      && parsed.getUTCMonth() + 1 === Number(match[2])
      && parsed.getUTCDate() === Number(match[3]);
  }

  async function createImportPreview({
    tenantId, userId, body,
  }) {
    const entityType = requiredText(body.entity_type, 'PHASE3_IMPORT_ENTITY_REQUIRED', 80);
    const definition = IMPORT_DEFINITIONS[entityType];
    if (!definition) {
      throw new Phase3Error(
        'PHASE3_IMPORT_ENTITY_INVALID',
        'La entidad no admite importación operacional.',
        400
      );
    }
    if (body.template_version !== IMPORT_TEMPLATE_VERSION) {
      throw new Phase3Error(
        'PHASE3_IMPORT_TEMPLATE_VERSION_INVALID',
        `La plantilla debe usar la versión ${IMPORT_TEMPLATE_VERSION}.`,
        409
      );
    }
    const inputRows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
    if (!inputRows.length) {
      throw new Phase3Error(
        'PHASE3_IMPORT_ROWS_REQUIRED',
        'La importación debe contener al menos una fila.',
        400
      );
    }
    if (Array.isArray(body.rows) && body.rows.length > 1000) {
      throw new Phase3Error(
        'PHASE3_IMPORT_ROW_LIMIT',
        'Cada lote admite un máximo de 1000 filas.',
        413
      );
    }
    const tenantState = await activationReadiness(tenantId);
    if (tenantState.state === 'demo') {
      throw new Phase3Error(
        'PHASE3_IMPORT_DEMO_DATA_PRESENT',
        'Separa o retira los datos demo antes de importar datos operacionales reales.',
        409
      );
    }

    const lookups = await getLookups(tenantId);
    const lookupMaps = Object.fromEntries(
      Object.entries(lookups).map(([type, rows]) => [
        type,
        new Map(rows.flatMap(row => {
          const entries = [];
          if (row.code) entries.push([String(row.code).trim().toLowerCase(), row]);
          if (row.email) entries.push([String(row.email).trim().toLowerCase(), row]);
          return entries;
        })),
      ])
    );
    const codes = inputRows
      .map(row => String(object(row).code || '').trim())
      .filter(Boolean);
    const existing = codes.length
      ? await pool.query(
        `SELECT code FROM ${definition.table}
         WHERE tenant_id=$1::uuid AND lower(code)=ANY($2::text[])`,
        [tenantId, codes.map(code => code.toLowerCase())]
      )
      : { rows: [] };
    const existingCodes = new Set(existing.rows.map(row => String(row.code).toLowerCase()));
    const seenCodes = new Set();
    const requiredByEntity = {
      organizations: ['code', 'name', 'unit_type'],
      processes: ['code', 'name', 'process_type', 'criticality_score'],
      services: ['code', 'name', 'minimum_service_level', 'criticality'],
      bia: ['code', 'assumptions', 'mtpd_minutes', 'rto_minutes', 'rpo_minutes', 'next_review_at'],
      continuity_plans: [
        'code', 'name', 'scope', 'activation_criteria', 'procedures',
        'recovery_sequence', 'return_to_operation_criteria', 'next_review_at',
      ],
      metrics: [
        'code', 'name', 'metric_type', 'entity_type', 'entity_code',
        'formula_definition', 'source_description', 'frequency', 'unit',
        'expected_direction', 'target_value', 'warning_threshold',
        'critical_threshold', 'measurement_window',
      ],
    };

    function resolve(type, value, column, errors, required = false) {
      const reference = String(value || '').trim().toLowerCase();
      if (!reference) {
        if (required) {
          errors.push(importIssue(column, 'REQUIRED', `${column} es obligatorio.`));
        }
        return null;
      }
      const resolved = lookupMaps[type]?.get(reference);
      if (!resolved) {
        errors.push(importIssue(
          column,
          'REFERENCE_NOT_FOUND',
          `${column} no existe dentro de esta empresa.`
        ));
        return null;
      }
      return resolved.id;
    }

    const preparedRows = inputRows.map((rawRow, index) => {
      const normalized = normalizeImportRow(rawRow);
      const errors = [];
      const code = String(normalized.code || '').trim();
      for (const field of requiredByEntity[entityType] || []) {
        if (normalized[field] === undefined || normalized[field] === null || normalized[field] === '') {
          errors.push(importIssue(field, 'REQUIRED', `${field} es obligatorio.`));
        }
      }
      const codeKey = code.toLowerCase();
      if (codeKey && (seenCodes.has(codeKey) || existingCodes.has(codeKey))) {
        errors.push(importIssue('code', 'DUPLICATE', 'El código está duplicado en el lote o ya existe.'));
      }
      if (codeKey) seenCodes.add(codeKey);

      const ownerId = resolve(
        'users',
        normalized.owner_email,
        'owner_email',
        errors,
        false
      );
      const bodyRow = {
        ...normalized,
        ...(ownerId ? { owner_user_id: ownerId } : {}),
      };
      delete bodyRow.owner_email;

      if (entityType === 'processes') {
        bodyRow.organizational_unit_id = resolve(
          'organization', normalized.unit_code, 'unit_code', errors, false
        );
      }
      if (entityType === 'services') {
        bodyRow.organizational_unit_id = resolve(
          'organization', normalized.unit_code, 'unit_code', errors, false
        );
        bodyRow.primary_process_id = resolve(
          'process', normalized.process_code, 'process_code', errors, false
        );
      }
      if (entityType === 'bia') {
        bodyRow.process_id = resolve(
          'process', normalized.process_code, 'process_code', errors, false
        );
        bodyRow.service_id = resolve(
          'service', normalized.service_code, 'service_code', errors, false
        );
        if (!bodyRow.process_id && !bodyRow.service_id) {
          errors.push(importIssue(
            'process_code',
            'RELATION_REQUIRED',
            'Se requiere process_code o service_code válido.'
          ));
        }
      }
      if (entityType === 'continuity_plans') {
        bodyRow.process_id = resolve(
          'process', normalized.process_code, 'process_code', errors, false
        );
        bodyRow.service_id = resolve(
          'service', normalized.service_code, 'service_code', errors, false
        );
        bodyRow.bia_id = resolve('bia', normalized.bia_code, 'bia_code', errors, false);
        bodyRow.activation_authority_user_id = resolve(
          'users',
          normalized.activation_authority_email,
          'activation_authority_email',
          errors,
          false
        );
        if (!bodyRow.process_id && !bodyRow.service_id) {
          errors.push(importIssue(
            'process_code',
            'RELATION_REQUIRED',
            'Se requiere process_code o service_code válido.'
          ));
        }
      }
      if (entityType === 'metrics') {
        const metricEntityType = String(normalized.entity_type || '').trim();
        bodyRow.entity_id = resolve(
          metricEntityType,
          normalized.entity_code,
          'entity_code',
          errors,
          true
        );
      }
      for (const alias of [
        'unit_code', 'process_code', 'service_code', 'bia_code',
        'activation_authority_email', 'entity_code',
      ]) {
        delete bodyRow[alias];
      }

      const numericFields = [
        'criticality_score', 'rto_minutes', 'rpo_minutes', 'mtpd_minutes',
        'estimated_financial_impact', 'required_people', 'target_value',
        'warning_threshold', 'critical_threshold',
      ];
      for (const field of numericFields) {
        if (bodyRow[field] === '' || bodyRow[field] === undefined) {
          delete bodyRow[field];
          continue;
        }
        if (bodyRow[field] !== null) {
          const numeric = Number(bodyRow[field]);
          if (!Number.isFinite(numeric)) {
            errors.push(importIssue(field, 'NUMBER_INVALID', `${field} debe ser numérico.`));
          } else {
            bodyRow[field] = numeric;
          }
        }
      }
      for (const [field, value] of Object.entries(bodyRow)) {
        if ((field.endsWith('_at') || field.endsWith('_date') || field === 'valid_from' || field === 'valid_until')
          && !validImportDate(value)) {
          errors.push(importIssue(field, 'DATE_INVALID', `${field} contiene una fecha inválida.`));
        }
        if (value === '') delete bodyRow[field];
      }
      bodyRow.provenance = {
        source: 'phase3_import',
        template_version: IMPORT_TEMPLATE_VERSION,
        source_row: index + 2,
      };
      if (entityType === 'processes') {
        bodyRow.metadata = bodyRow.provenance;
      }
      return {
        row_number: index + 2,
        raw_data: normalized,
        normalized_data: bodyRow,
        errors,
        status: errors.length ? 'invalid' : 'valid',
      };
    });

    return withTransaction(async client => {
      const batch = await client.query(
        `INSERT INTO grc_phase3_import_batches (
           tenant_id,entity_type,template_version,file_name,status,total_rows,
           valid_rows,invalid_rows,summary,created_by
         ) VALUES ($1::uuid,$2,$3,$4,'preview_ready',$5,$6,$7,$8::jsonb,$9::uuid)
         RETURNING *`,
        [
          tenantId, entityType, IMPORT_TEMPLATE_VERSION,
          optionalText(body.file_name, 300) || `import-${entityType}.csv`,
          preparedRows.length,
          preparedRows.filter(row => row.status === 'valid').length,
          preparedRows.filter(row => row.status === 'invalid').length,
          json({ source: 'web_preview', confirmation_required: true }),
          userId || null,
        ]
      );
      for (const row of preparedRows) {
        const importProvenance = {
          ...row.normalized_data.provenance,
          import_batch_id: batch.rows[0].id,
        };
        await client.query(
          `INSERT INTO grc_phase3_import_rows (
             tenant_id,batch_id,row_number,raw_data,normalized_data,errors,status
           ) VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7)`,
          [
            tenantId, batch.rows[0].id, row.row_number, json(row.raw_data),
            json({
              ...row.normalized_data,
              provenance: importProvenance,
              ...(entityType === 'processes' ? { metadata: importProvenance } : {}),
            }),
            json(row.errors, []), row.status,
          ]
        );
      }
      await audit(client, {
        tenantId, userId, action: 'preview', tableName: 'grc_phase3_import_batches',
        recordId: batch.rows[0].id,
        newData: {
          entity_type: entityType,
          total_rows: preparedRows.length,
          valid_rows: preparedRows.filter(row => row.status === 'valid').length,
          invalid_rows: preparedRows.filter(row => row.status === 'invalid').length,
        },
      });
      return {
        batch: batch.rows[0],
        rows: preparedRows,
        can_confirm: preparedRows.some(row => row.status === 'valid'),
      };
    });
  }

  async function getImportBatch(tenantId, batchId) {
    const [batch, rows] = await Promise.all([
      pool.query(
        'SELECT * FROM grc_phase3_import_batches WHERE tenant_id=$1::uuid AND id=$2::uuid',
        [tenantId, uuid(batchId)]
      ),
      pool.query(
        `SELECT * FROM grc_phase3_import_rows
         WHERE tenant_id=$1::uuid AND batch_id=$2::uuid ORDER BY row_number`,
        [tenantId, uuid(batchId)]
      ),
    ]);
    if (!batch.rowCount) {
      throw new Phase3Error('PHASE3_IMPORT_NOT_FOUND', 'Lote de importación no encontrado.', 404);
    }
    return { batch: batch.rows[0], rows: rows.rows };
  }

  async function confirmImport({
    tenantId, userId, correlationId, batchId, confirmed,
  }) {
    if (confirmed !== true) {
      throw new Phase3Error(
        'PHASE3_IMPORT_CONFIRMATION_REQUIRED',
        'Confirma explícitamente que revisaste la previsualización.',
        409
      );
    }
    return withImportLock(tenantId, batchId, async () => {
    const loaded = await getImportBatch(tenantId, batchId);
    if (loaded.batch.status !== 'preview_ready') {
      throw new Phase3Error(
        'PHASE3_IMPORT_STATE_INVALID',
        'El lote ya fue confirmado, revertido o no está disponible.',
        409
      );
    }
    const definition = IMPORT_DEFINITIONS[loaded.batch.entity_type];
    const creators = {
      createOrganization,
      createProcess,
      createService,
      createBia,
      createContinuityPlan,
      createMetric,
    };
    const creator = creators[definition.creator];
    let imported = 0;
    let failed = 0;
    for (const row of loaded.rows.filter(item => item.status === 'valid')) {
      let createdEntityId = null;
      try {
        const result = await creator({
          tenantId,
          userId,
          correlationId,
          body: row.normalized_data,
        });
        createdEntityId = result.entity.id;
        await pool.query(
          `UPDATE grc_phase3_import_rows SET status='imported',
             created_entity_type=$4,created_entity_id=$5::uuid,processed_at=now()
           WHERE tenant_id=$1::uuid AND batch_id=$2::uuid AND id=$3::uuid`,
          [tenantId, batchId, row.id, definition.type, result.entity.id]
        );
        imported += 1;
      } catch (error) {
        if (createdEntityId) {
          const provenanceColumn = definition.type === 'process' ? 'metadata' : 'provenance';
          await pool.query(
            `DELETE FROM ${definition.table}
             WHERE tenant_id=$1::uuid AND id=$2::uuid
               AND ${provenanceColumn}->>'import_batch_id'=$3`,
            [tenantId, createdEntityId, batchId]
          ).catch(() => undefined);
        }
        await pool.query(
          `UPDATE grc_phase3_import_rows SET status='failed',
             errors=$4::jsonb,processed_at=now()
           WHERE tenant_id=$1::uuid AND batch_id=$2::uuid AND id=$3::uuid`,
          [
            tenantId, batchId, row.id,
            json([{
              column: null,
              code: error.code || 'IMPORT_ROW_FAILED',
              message: error instanceof Phase3Error
                ? error.message
                : 'La fila no pudo importarse por una restricción de datos.',
            }]),
          ]
        );
        failed += 1;
      }
    }
    const status = failed ? 'partial' : 'confirmed';
    await withTransaction(async client => {
      await client.query(
        `UPDATE grc_phase3_import_batches SET status=$3,imported_rows=$4,
           failed_rows=$5,confirmed_by=$6::uuid,confirmed_at=now(),updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [tenantId, batchId, status, imported, failed, userId || null]
      );
      await audit(client, {
        tenantId,
        userId,
        action: 'confirm',
        tableName: 'grc_phase3_import_batches',
        recordId: batchId,
        newData: { status, imported_rows: imported, failed_rows: failed },
        metadata: { correlation_id: correlationId || null },
      });
    });
    return getImportBatch(tenantId, batchId);
    });
  }

  async function rollbackImport({ tenantId, userId, batchId }) {
    return withImportLock(tenantId, batchId, async () => {
    const loaded = await getImportBatch(tenantId, batchId);
    if (!['confirmed', 'partial'].includes(loaded.batch.status)) {
      throw new Phase3Error(
        'PHASE3_IMPORT_ROLLBACK_STATE_INVALID',
        'Solo se puede revertir un lote confirmado.',
        409
      );
    }
    const definition = IMPORT_DEFINITIONS[loaded.batch.entity_type];
    let rolledBack = 0;
    let blocked = 0;
    const statusColumn = definition.type === 'process' ? 'lifecycle_status' : 'status';
    const provenanceColumn = definition.type === 'process' ? 'metadata' : 'provenance';
    for (const row of loaded.rows.filter(item => item.status === 'imported')) {
      try {
        const removed = await withTransaction(async client => {
          const result = await client.query(
            `DELETE FROM ${definition.table}
             WHERE tenant_id=$1::uuid AND id=$2::uuid
               AND ${provenanceColumn}->>'import_batch_id'=$3
               AND version=1 AND ${statusColumn}='draft'
             RETURNING id`,
            [tenantId, row.created_entity_id, batchId]
          );
          if (!result.rowCount) return false;
          await audit(client, {
            tenantId,
            userId,
            action: 'rollback',
            tableName: definition.table,
            recordId: row.created_entity_id,
            oldData: row.normalized_data,
            metadata: { import_batch_id: batchId },
          });
          await client.query(
            `UPDATE grc_phase3_import_rows SET status='rolled_back',rolled_back_at=now()
             WHERE tenant_id=$1::uuid AND id=$2::uuid`,
            [tenantId, row.id]
          );
          return true;
        });
        if (removed) {
          rolledBack += 1;
        } else {
          blocked += 1;
          await pool.query(
            `UPDATE grc_phase3_import_rows SET status='rollback_blocked'
             WHERE tenant_id=$1::uuid AND id=$2::uuid`,
            [tenantId, row.id]
          );
        }
      } catch {
        blocked += 1;
        await pool.query(
          `UPDATE grc_phase3_import_rows SET status='rollback_blocked'
           WHERE tenant_id=$1::uuid AND id=$2::uuid`,
          [tenantId, row.id]
        );
      }
    }
    await withTransaction(async client => {
      await client.query(
        `UPDATE grc_phase3_import_batches SET status=$3,rolled_back_rows=$4,
           rollback_blocked_rows=$5,rolled_back_by=$6::uuid,rolled_back_at=now(),updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [
          tenantId, batchId, blocked ? 'rollback_partial' : 'rolled_back',
          rolledBack, blocked, userId || null,
        ]
      );
      await audit(client, {
        tenantId,
        userId,
        action: 'rollback',
        tableName: 'grc_phase3_import_batches',
        recordId: batchId,
        newData: {
          status: blocked ? 'rollback_partial' : 'rolled_back',
          rolled_back_rows: rolledBack,
          rollback_blocked_rows: blocked,
        },
      });
    });
    return getImportBatch(tenantId, batchId);
    });
  }

  async function operationsOverview(tenantId) {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM grc_organizational_units WHERE tenant_id=$1::uuid AND status<>'retired') AS units,
        (SELECT COUNT(*)::int FROM grc_organizational_units WHERE tenant_id=$1::uuid AND owner_user_id IS NULL AND status<>'retired') AS units_without_owner,
        (SELECT COUNT(*)::int FROM tenant_processes WHERE tenant_id=$1::uuid AND COALESCE(is_active,TRUE)) AS processes,
        (SELECT COUNT(*)::int FROM tenant_processes WHERE tenant_id=$1::uuid AND criticality_score>=75) AS critical_processes,
        (SELECT COUNT(*)::int FROM tenant_processes p WHERE p.tenant_id=$1::uuid AND p.criticality_score>=75
          AND NOT EXISTS (
            SELECT 1 FROM grc_bia_assessments b
            WHERE b.tenant_id=p.tenant_id AND b.process_id=p.id
              AND b.status IN ('approved','current') AND b.next_review_at>now()
          )) AS critical_processes_without_bia,
        (SELECT COUNT(*)::int FROM tenant_processes p
          WHERE p.tenant_id=$1::uuid AND p.criticality_score>=75
            AND NOT EXISTS (
              SELECT 1 FROM grc_continuity_plans cp
              WHERE cp.tenant_id=p.tenant_id AND cp.process_id=p.id
                AND cp.status IN ('approved','active') AND cp.next_review_at>now()
            )) AS critical_processes_without_plan,
        (SELECT COUNT(*)::int FROM grc_operational_services WHERE tenant_id=$1::uuid AND status<>'retired') AS services,
        (SELECT COUNT(*)::int FROM grc_continuity_plans WHERE tenant_id=$1::uuid AND status IN ('approved','active')) AS current_plans,
        (SELECT COUNT(*)::int FROM grc_continuity_plans WHERE tenant_id=$1::uuid AND (status='expired' OR next_review_at<now())) AS expired_plans,
        (SELECT COUNT(*)::int FROM grc_continuity_tests WHERE tenant_id=$1::uuid AND status='failed') AS failed_tests,
        (SELECT COUNT(*)::int FROM grc_continuity_tests WHERE tenant_id=$1::uuid
          AND observed_rto_minutes>target_rto_minutes) AS rto_breaches,
        (SELECT COUNT(*)::int FROM grc_continuity_tests WHERE tenant_id=$1::uuid
          AND observed_rpo_minutes>target_rpo_minutes) AS rpo_breaches,
        (SELECT COUNT(*)::int FROM grc_metric_measurements WHERE tenant_id=$1::uuid AND impact_status='critical') AS critical_metrics,
        (SELECT COUNT(*)::int FROM grc_operational_dependencies WHERE tenant_id=$1::uuid
          AND target_type='supplier' AND criticality='critical') AS critical_supplier_dependencies,
        (SELECT COUNT(*)::int FROM grc_control_assurance WHERE tenant_id=$1::uuid
          AND assurance_status IN ('incomplete','degraded','ineffective')) AS degraded_controls,
        (SELECT COUNT(*)::int FROM findings WHERE tenant_id=$1::uuid
          AND lower(COALESCE(status,'')) NOT IN ('cerrado','cerrada','closed','completado','completada','completed','resuelto','resuelta')) AS open_findings,
        (SELECT COUNT(*)::int FROM tenant_nonconformities WHERE tenant_id=$1::uuid
          AND lower(COALESCE(status,'')) NOT IN ('cerrado','cerrada','closed','completado','completada','completed','resuelto','resuelta')) AS open_nonconformities,
        (SELECT COUNT(*)::int FROM action_plans WHERE tenant_id=$1::uuid
          AND due_date<CURRENT_DATE
          AND lower(COALESCE(status,'')) NOT IN ('cerrado','cerrada','closed','completado','completada','completed')) AS overdue_actions,
        (SELECT COUNT(*)::int FROM grc_operational_alerts WHERE tenant_id=$1::uuid AND status='open') AS open_alerts,
        (SELECT COUNT(*)::int FROM grc_phase3_readiness_impacts WHERE tenant_id=$1::uuid AND active=TRUE AND new_score<70) AS degraded_readiness,
        (SELECT COALESCE(SUM(annualized_loss),0) FROM grc_quantitative_risk_assessments
          WHERE tenant_id=$1::uuid AND status IN ('approved','current')) AS annualized_exposure`,
      [tenantId]
    );
    const [alerts, impacts, events] = await Promise.all([
      pool.query(
        `SELECT * FROM grc_operational_alerts
         WHERE tenant_id=$1::uuid AND status='open'
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
           created_at DESC LIMIT 30`,
        [tenantId]
      ),
      pool.query(
        `SELECT * FROM grc_phase3_readiness_impacts
         WHERE tenant_id=$1::uuid AND active=TRUE
         ORDER BY created_at DESC LIMIT 30`,
        [tenantId]
      ),
      pool.query(
        `SELECT id,event_name,aggregate_type,aggregate_id,occurred_at
         FROM grc_domain_events WHERE tenant_id=$1::uuid
         ORDER BY occurred_at DESC LIMIT 30`,
        [tenantId]
      ),
    ]);
    return {
      summary: result.rows[0],
      alerts: alerts.rows,
      readiness_impacts: impacts.rows,
      recent_events: events.rows,
    };
  }

  async function continuityOverview(tenantId) {
    const [summary, tests, plans] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('approved','active'))::int AS current_plans,
           COUNT(*) FILTER (WHERE status='expired' OR next_review_at<now())::int AS expired_plans,
           COUNT(*) FILTER (WHERE status='review_required')::int AS review_required
         FROM grc_continuity_plans WHERE tenant_id=$1::uuid`,
        [tenantId]
      ),
      pool.query(
        `SELECT t.*,p.code AS plan_code,p.name AS plan_name
         FROM grc_continuity_tests t
         JOIN grc_continuity_plans p ON p.id=t.plan_id AND p.tenant_id=t.tenant_id
         WHERE t.tenant_id=$1::uuid ORDER BY t.scheduled_at DESC LIMIT 50`,
        [tenantId]
      ),
      pool.query(
        `SELECT p.*,b.rto_minutes,b.rpo_minutes,b.mtpd_minutes
         FROM grc_continuity_plans p
         LEFT JOIN grc_bia_assessments b ON b.id=p.bia_id AND b.tenant_id=p.tenant_id
         WHERE p.tenant_id=$1::uuid ORDER BY p.updated_at DESC LIMIT 50`,
        [tenantId]
      ),
    ]);
    return { summary: summary.rows[0], plans: plans.rows, tests: tests.rows };
  }

  async function metric360(tenantId, metricId) {
    const base = await getEntity360(tenantId, 'metric', metricId);
    const measurements = await pool.query(
      `SELECT * FROM grc_metric_measurements
       WHERE tenant_id=$1::uuid AND metric_id=$2::uuid
       ORDER BY measured_at DESC LIMIT 100`,
      [tenantId, metricId]
    );
    return { ...base, measurements: measurements.rows };
  }

  return {
    assertModuleEnabled,
    assertPermission,
    getMeta,
    getLookups,
    activationReadiness,
    createRelation,
    createDependency,
    createOrganization,
    createProcess,
    createService,
    createBia,
    createBiaImpact,
    createContinuityPlan,
    createContinuityTest,
    createCrisis,
    updateEntity,
    addCrisisLog,
    createMetric,
    recordMeasurement,
    createQuantitativeRisk,
    transitionEntity,
    getImportTemplate,
    createImportPreview,
    getImportBatch,
    confirmImport,
    rollbackImport,
    operationsOverview,
    continuityOverview,
    metric360,
    getEntity360,
    listOrganizations: (tenantId, filters) => list('grc_organizational_units', tenantId, filters),
    listProcesses: (tenantId, filters) => list(
      'tenant_processes', tenantId, filters,
      { statusColumn: 'lifecycle_status', orderBy: 'updated_at DESC' }
    ),
    listServices: (tenantId, filters) => list('grc_operational_services', tenantId, filters),
    listBias: (tenantId, filters) => list(
      'grc_bia_assessments', tenantId, filters,
      { orderBy: 'assessment_date DESC,updated_at DESC', searchColumns: ['code'] }
    ),
    listPlans: (tenantId, filters) => list('grc_continuity_plans', tenantId, filters),
    listTests: (tenantId, filters) => list(
      'grc_continuity_tests', tenantId, filters,
      { orderBy: 'scheduled_at DESC', searchColumns: ['objective', 'scenario'] }
    ),
    listCrises: (tenantId, filters) => list(
      'grc_crisis_activations', tenantId, filters,
      { orderBy: 'activated_at DESC', searchColumns: ['code'] }
    ),
    listMetrics: (tenantId, filters) => list('grc_metric_definitions', tenantId, filters),
    listQuantitativeRisks: (tenantId, filters) => list(
      'grc_quantitative_risk_assessments', tenantId, filters,
      { orderBy: 'annualized_loss DESC,updated_at DESC', searchColumns: ['code', 'scenario'] }
    ),
  };
}

module.exports = {
  ENTITY_REGISTRY,
  Phase3Error,
  createPhase3Service,
};
