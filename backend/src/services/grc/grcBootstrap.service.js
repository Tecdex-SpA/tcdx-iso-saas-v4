const BOOTSTRAP_VERSION = 1;

const WORKFLOW_TEMPLATES = Object.freeze([
  { code: 'phase1-evidence', name: 'Evidencia continua', entityType: 'evidence', mode: 'simple' },
  { code: 'phase1-audit', name: 'Auditoría avanzada', entityType: 'audit', mode: 'sequential' },
  { code: 'phase1-approval-simple', name: 'Aprobación simple', entityType: 'action', mode: 'simple' },
  { code: 'phase1-approval-sequential', name: 'Aprobación secuencial', entityType: 'action', mode: 'sequential' },
  { code: 'phase1-approval-parallel', name: 'Aprobación paralela', entityType: 'action', mode: 'parallel' },
  { code: 'phase1-approval-quorum', name: 'Aprobación por quorum', entityType: 'action', mode: 'quorum' },
  { code: 'phase1-approval-unanimous', name: 'Aprobación unánime', entityType: 'action', mode: 'unanimous' },
]);

const READINESS_RULES = Object.freeze([
  ['requirements', 'tenant_applicable_controls', 15],
  ['controls', 'tenant_controls', 20],
  ['evidence', 'evidences', 20],
  ['risks', 'asset_risks/assets', 10],
  ['actions', 'action_plans', 10],
  ['audits', 'audits', 10],
  ['documents', 'iso_generated_documents', 10],
  ['objectives', 'management_objectives', 5],
]);

const ADMIN_ROLES = Object.freeze([
  'admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'auditor',
]);

function json(value) {
  return JSON.stringify(value);
}

function approvalConfig(mode) {
  if (mode === 'sequential') {
    return {
      required_count: 2,
      steps: [
        { sequence_no: 1, role: 'tenant_admin' },
        { sequence_no: 2, role: 'auditor' },
      ],
    };
  }
  if (mode === 'parallel' || mode === 'unanimous') {
    return { required_count: 2, roles: ['tenant_admin', 'auditor'] };
  }
  if (mode === 'quorum') {
    return { required_count: 2, quorum: 2, roles: ['tenant_admin', 'auditor', 'compliance_admin'] };
  }
  return { required_count: 1, roles: ADMIN_ROLES };
}

function createGrcBootstrapService(pool, { GrcError, observe }) {
  async function moduleEnabled(database, tenantId) {
    const result = await database.query(
      `SELECT COALESCE(tms.is_enabled, sm.default_enabled, FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key = sm.module_key AND tms.tenant_id = $1::uuid
       WHERE sm.module_key = 'grc_phase1_core' AND sm.is_active = TRUE`,
      [tenantId]
    );
    return result.rows[0]?.is_enabled === true;
  }

  async function status(tenantId, database = pool) {
    const enabled = await moduleEnabled(database, tenantId);
    const result = (await database.query(
      `SELECT
         (SELECT COUNT(*)::int FROM grc_tenant_configurations WHERE tenant_id = $1::uuid) AS configurations,
         (SELECT COUNT(*)::int FROM grc_workflow_definitions
          WHERE tenant_id = $1::uuid AND code = ANY($2::text[]) AND status = 'active') AS workflows,
         (SELECT COUNT(*)::int FROM grc_escalation_policies
          WHERE tenant_id = $1::uuid AND code = ANY($3::text[]) AND is_active = TRUE) AS escalation_policies,
         (SELECT COUNT(*)::int FROM grc_readiness_rules
          WHERE tenant_id = $1::uuid AND code = ANY($4::text[]) AND is_active = TRUE) AS readiness_rules,
         (SELECT COUNT(*)::int FROM grc_frameworks
          WHERE tenant_id IS NULL AND is_active = TRUE) AS frameworks,
         (SELECT COUNT(*)::int FROM grc_requirement_control_mappings
          WHERE tenant_id = $1::uuid AND metadata->>'bootstrap_version' = $5) AS mappings`,
      [
        tenantId,
        WORKFLOW_TEMPLATES.map(item => item.code),
        ['phase1-evidence-default', 'phase1-action-default'],
        READINESS_RULES.map(item => item[0]),
        String(BOOTSTRAP_VERSION),
      ]
    )).rows[0];
    const checks = {
      module_enabled: enabled,
      configuration: Number(result.configurations) === 1,
      workflows: Number(result.workflows) === WORKFLOW_TEMPLATES.length,
      escalation_policies: Number(result.escalation_policies) === 2,
      readiness_rules: Number(result.readiness_rules) === READINESS_RULES.length,
      frameworks: Number(result.frameworks) >= 9,
    };
    const missing = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
    const configuration = (await database.query(
      `SELECT status, bootstrap_version, scheduler_config, settings, initialized_by,
              initialized_at, validated_at, validation_result, updated_at
       FROM grc_tenant_configurations WHERE tenant_id = $1::uuid`,
      [tenantId]
    )).rows[0] || null;
    return {
      tenant_id: tenantId,
      initialized: checks.configuration,
      ready: missing.length === 0,
      checks,
      missing,
      counts: {
        workflows: Number(result.workflows),
        escalation_policies: Number(result.escalation_policies),
        readiness_rules: Number(result.readiness_rules),
        frameworks: Number(result.frameworks),
        mappings: Number(result.mappings),
      },
      configuration,
    };
  }

  async function insertWorkflow(client, { tenantId, userId, template, created, reused }) {
    const existing = (await client.query(
      `SELECT id FROM grc_workflow_definitions WHERE tenant_id = $1::uuid AND code = $2`,
      [tenantId, template.code]
    )).rows[0];
    if (existing) {
      reused.push(`workflow:${template.code}`);
      return;
    }
    const definition = (await client.query(
      `INSERT INTO grc_workflow_definitions (
         tenant_id, code, name, description, entity_type, status, created_by
       ) VALUES ($1::uuid,$2,$3,$4,$5,'active',$6::uuid) RETURNING id`,
      [tenantId, template.code, template.name, 'Configuración base Fase 1R', template.entityType, userId]
    )).rows[0];
    const config = approvalConfig(template.mode);
    const version = (await client.query(
      `INSERT INTO grc_workflow_versions (
         tenant_id, definition_id, version, status, approval_mode, quorum, config,
         published_by, published_at, created_by
       ) VALUES ($1::uuid,$2::uuid,1,'published',$3,$4,$5::jsonb,$6::uuid,now(),$6::uuid)
       RETURNING id`,
      [tenantId, definition.id, template.mode, template.mode === 'quorum' ? 2 : null, json(config), userId]
    )).rows[0];
    const stateRows = (await client.query(
      `INSERT INTO grc_workflow_states (
         tenant_id, version_id, code, name, state_type, sort_order
       ) VALUES
         ($1::uuid,$2::uuid,'draft','Borrador','initial',1),
         ($1::uuid,$2::uuid,'under_review','En revisión','active',2),
         ($1::uuid,$2::uuid,'approved','Aprobado','terminal',3),
         ($1::uuid,$2::uuid,'rejected','Rechazado','rejected',4)
       RETURNING id, code`,
      [tenantId, version.id]
    )).rows;
    const states = Object.fromEntries(stateRows.map(item => [item.code, item.id]));
    const transitions = [
      ['submit', 'Enviar a revisión', 'draft', 'under_review', 'none', null, []],
      ['approve', 'Aprobar', 'under_review', 'approved', template.mode, template.mode === 'quorum' ? 2 : null, ['comment_required']],
      ['reject', 'Rechazar', 'under_review', 'rejected', 'simple', null, ['comment_required']],
      ['return', 'Devolver', 'under_review', 'draft', 'none', null, ['comment_required']],
      ['reopen', 'Reabrir', 'approved', 'under_review', 'none', null, ['comment_required']],
    ];
    for (const [code, name, from, to, mode, quorum, preconditions] of transitions) {
      const transition = (await client.query(
        `INSERT INTO grc_workflow_transitions (
           tenant_id, version_id, code, name, from_state_id, to_state_id,
           required_permission, approval_mode, quorum, approval_config, sla_hours, preconditions
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,'workflow.transition',
           $7,$8,$9::jsonb,24,$10::jsonb) RETURNING id`,
        [
          tenantId, version.id, code, name, states[from], states[to], mode, quorum,
          json(mode === 'none' ? {} : config), json(preconditions),
        ]
      )).rows[0];
      await client.query(
        `INSERT INTO grc_workflow_transition_roles (transition_id, role_key, tenant_id)
         SELECT $1::uuid, role_key, $2::uuid FROM app_roles WHERE role_key = ANY($3::text[])
         ON CONFLICT DO NOTHING`,
        [transition.id, tenantId, ADMIN_ROLES]
      );
    }
    await client.query(
      `UPDATE grc_workflow_definitions SET active_version_id = $3::uuid, updated_at = now()
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, definition.id, version.id]
    );
    created.push(`workflow:${template.code}`);
  }

  async function initialize({ tenantId, userId, confirmation, idempotencyKey, correlationId }) {
    if (confirmation !== 'INITIALIZE_GRC') {
      throw new GrcError('GRC_BOOTSTRAP_CONFIRMATION_REQUIRED', 'Confirma la inicialización con INITIALIZE_GRC.', 422);
    }
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(String(idempotencyKey || ''))) {
      throw new GrcError('GRC_IDEMPOTENCY_KEY_REQUIRED', 'Se requiere Idempotency-Key válido.', 422);
    }
    const client = await pool.connect();
    const started = Date.now();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`grc-bootstrap:${tenantId}`]
      );
      if (!(await moduleEnabled(client, tenantId))) {
        throw new GrcError('GRC_PHASE1_DISABLED', 'Habilita el módulo antes de inicializar GRC.', 403);
      }
      const existingRun = (await client.query(
        `SELECT response FROM grc_bootstrap_runs
         WHERE tenant_id = $1::uuid AND idempotency_key = $2 AND status = 'completed'`,
        [tenantId, idempotencyKey]
      )).rows[0];
      if (existingRun) {
        await client.query('COMMIT');
        observe('bootstrap', { tenantId, correlationId, status: 'reused', durationMs: Date.now() - started });
        return { ...existingRun.response, idempotent_replay: true };
      }

      const created = [];
      const reused = [];
      const warnings = [];
      const configuration = (await client.query(
        `INSERT INTO grc_tenant_configurations (
           tenant_id, status, bootstrap_version, initialized_by, settings
         ) VALUES ($1::uuid,'initialized',$2,$3::uuid,$4::jsonb)
         ON CONFLICT (tenant_id) DO NOTHING RETURNING tenant_id`,
        [tenantId, BOOTSTRAP_VERSION, userId, json({ source: 'explicit_admin_bootstrap' })]
      )).rows[0];
      (configuration ? created : reused).push('configuration');

      for (const template of WORKFLOW_TEMPLATES) {
        await insertWorkflow(client, { tenantId, userId, template, created, reused });
      }

      const policies = [
        ['phase1-evidence-default', 'evidence_request', 24, 0, 24],
        ['phase1-action-default', 'action', 24, 0, 48],
      ];
      for (const [code, entityType, prior, first, second] of policies) {
        const policy = (await client.query(
          `INSERT INTO grc_escalation_policies (
             tenant_id, code, entity_type, prior_notice_hours, first_escalation_hours,
             second_escalation_hours, role_keys, recipient_config, created_by
           ) VALUES ($1::uuid,$2,$3,$4,$5,$6,'["tenant_admin"]'::jsonb,
             '{"strategy":"role_and_owner"}'::jsonb,$7::uuid)
           ON CONFLICT (tenant_id, code) DO NOTHING RETURNING id`,
          [tenantId, code, entityType, prior, first, second, userId]
        )).rows[0];
        (policy ? created : reused).push(`escalation:${code}`);
      }

      for (const [code, sourceTable, weight] of READINESS_RULES) {
        const rule = (await client.query(
          `INSERT INTO grc_readiness_rules (
             tenant_id, code, description, dimension, source_table, formula,
             weight, threshold, version
           ) VALUES ($1::uuid,$2,$3,$2,$4,'achieved / total * 100',$5,70,1)
           ON CONFLICT (tenant_id, code, version) DO NOTHING RETURNING id`,
          [tenantId, code, `Preparación basada en ${sourceTable}.`, sourceTable, weight]
        )).rows[0];
        (rule ? created : reused).push(`readiness:${code}`);
      }

      const mapping = (await client.query(
        `INSERT INTO grc_requirement_control_mappings (
           tenant_id, requirement_id, tenant_control_id, mapping_type, coverage_level,
           justification, source_type, status, created_by, metadata
         )
         SELECT $1::uuid, requirement.id, control.id, 'pending_review', 0,
           'Mapping inicial explícito pendiente de revisión humana.',
           'tcdx_interpretation', 'draft', $2::uuid,
           jsonb_build_object('bootstrap_version', $3::text)
         FROM grc_framework_requirements requirement
         CROSS JOIN LATERAL (
           SELECT id FROM tenant_controls WHERE tenant_id = $1::uuid ORDER BY id LIMIT 1
         ) control
         WHERE requirement.tenant_id IS NULL
           AND requirement.reference_code = 'FRAMEWORK-ROOT'
         ORDER BY requirement.id
         LIMIT 1
         ON CONFLICT (tenant_id, requirement_id, tenant_control_id, catalog_control_id)
         DO NOTHING RETURNING id`,
        [tenantId, userId, BOOTSTRAP_VERSION]
      )).rows[0];
      if (mapping) created.push('mapping:framework-root');
      else {
        const existingMapping = (await client.query(
          `SELECT id FROM grc_requirement_control_mappings
           WHERE tenant_id = $1::uuid AND metadata->>'bootstrap_version' = $2 LIMIT 1`,
          [tenantId, String(BOOTSTRAP_VERSION)]
        )).rows[0];
        if (existingMapping) reused.push('mapping:framework-root');
        else warnings.push('No existe control tenant elegible; el mapping inicial se creará cuando exista uno.');
      }

      const validation = await status(tenantId, client);
      await client.query(
        `UPDATE grc_tenant_configurations SET status = $2, validated_at = now(),
           validation_result = $3::jsonb, updated_at = now()
         WHERE tenant_id = $1::uuid`,
        [tenantId, validation.ready ? 'ready' : 'degraded', json(validation)]
      );
      const response = {
        ok: true,
        tenant_id: tenantId,
        created,
        reused,
        warnings,
        ready: validation.ready,
      };
      const run = (await client.query(
        `INSERT INTO grc_bootstrap_runs (
           tenant_id, idempotency_key, status, bootstrap_version, response,
           requested_by, correlation_id
         ) VALUES ($1::uuid,$2,'completed',$3,$4::jsonb,$5::uuid,$6) RETURNING id`,
        [tenantId, idempotencyKey, BOOTSTRAP_VERSION, json(response), userId, correlationId]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_event_log (
           table_name, record_id, tenant_id, action, changed_by, new_data, metadata
         ) VALUES ('grc_bootstrap_runs',$1::uuid,$2::uuid,'grc.bootstrap.completed',
           $3::uuid,$4::jsonb,$5::jsonb)`,
        [run.id, tenantId, userId, json({ created, reused, warnings, ready: validation.ready }), json({ correlation_id: correlationId })]
      );
      await client.query('COMMIT');
      observe('bootstrap', { tenantId, correlationId, status: validation.ready ? 'completed' : 'degraded', durationMs: Date.now() - started });
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      observe('bootstrap', { tenantId, correlationId, status: 'failed', durationMs: Date.now() - started, errorCode: error.code || 'GRC_BOOTSTRAP_FAILED' });
      throw error;
    } finally {
      client.release();
    }
  }

  async function validate({ tenantId, userId, correlationId }) {
    const current = await status(tenantId);
    await pool.query(
      `UPDATE grc_tenant_configurations SET status = $2, validated_at = now(),
         validation_result = $3::jsonb, updated_at = now()
       WHERE tenant_id = $1::uuid`,
      [tenantId, current.ready ? 'ready' : 'degraded', json(current)]
    );
    await pool.query(
      `INSERT INTO audit_event_log (
         table_name, record_id, tenant_id, action, changed_by, new_data, metadata
       ) VALUES ('grc_tenant_configurations',$1::uuid,$1::uuid,
         'grc.bootstrap.validated',$2::uuid,$3::jsonb,$4::jsonb)`,
      [tenantId, userId, json({ ready: current.ready, missing: current.missing }), json({ correlation_id: correlationId })]
    );
    observe('bootstrap_validation', { tenantId, correlationId, status: current.ready ? 'success' : 'degraded' });
    return current;
  }

  return { initialize, status, validate };
}

module.exports = {
  BOOTSTRAP_VERSION,
  READINESS_RULES,
  WORKFLOW_TEMPLATES,
  createGrcBootstrapService,
};
