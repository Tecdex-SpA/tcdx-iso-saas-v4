const { calculateReadiness, nextOccurrence, scoreEvidence, validateWorkflowDraft } = require('./grcRules');
const { APPROVAL_DECISIONS, assertApprovalActor, evaluateApproval } = require('./grcApprovalRules');
const { readRuntimeEntity } = require('./grcRuntimeAdapters');
const { buildGrcExport, FORMATS } = require('./grcExport.service');
const { escalationStages, occurrenceKey, retryBackoffSeconds, schedulerWindow } = require('./grcSchedulerRules');
const { observe, snapshot: observabilitySnapshot } = require('./grcObservability');
const { createGrcBootstrapService } = require('./grcBootstrap.service');
const { createGrcObservationService } = require('./grcObservation.service');
const { createGrcGapService } = require('./grcGap.service');
const { createImpactGraphService } = require('./impactGraph.service');
const { createPriorityEngineService } = require('./priorityEngine.service');

const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);

class GrcError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function assertUuid(value, code = 'GRC_ID_REQUIRED') {
  const text = String(value || '').trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text)) {
    throw new GrcError(code, 'Identificador inválido.', 400);
  }
  return text;
}

function clampLimit(value) {
  return Math.max(1, Math.min(Number(value) || 50, 100));
}

function createGrcService(pool, asyncJobs) {
  const bootstrapService = createGrcBootstrapService(pool, { GrcError, observe });
  let observationService = null;
  let gapService = null;
  let impactGraphService = null;
  let priorityEngineService = null;

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

  async function audit(client, { tenantId, userId, action, tableName, recordId, oldData = null, newData = null, metadata = {} }) {
    await client.query(
      `INSERT INTO audit_event_log (
         table_name, record_id, tenant_id, action, changed_by, old_data, new_data, metadata
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5::uuid, $6::jsonb, $7::jsonb, $8::jsonb)`,
      [tableName, recordId, tenantId, action, userId, json(oldData, null), json(newData, null), json(metadata)]
    );
  }

  async function assertModuleEnabled(tenantId) {
    const result = await pool.query(
      `SELECT COALESCE(tms.is_enabled, sm.default_enabled, FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key = sm.module_key AND tms.tenant_id = $1::uuid
       WHERE sm.module_key = 'grc_phase1_core' AND sm.is_active = TRUE
       LIMIT 1`,
      [tenantId]
    );
    if (result.rows[0]?.is_enabled !== true) {
      throw new GrcError('GRC_PHASE1_DISABLED', 'La capacidad GRC avanzada no está habilitada para esta empresa.', 403);
    }
  }

  async function assertPermission({ userId, role, permission }) {
    if (PLATFORM_ROLES.has(String(role || '').toLowerCase())) return;
    if (!userId) throw new GrcError('GRC_USER_REQUIRED', 'Usuario no identificado.', 401);
    const result = await pool.query('SELECT user_has_permission($1::uuid, $2::text) AS allowed', [userId, permission]);
    if (result.rows[0]?.allowed !== true) {
      throw new GrcError('GRC_PERMISSION_DENIED', `Permiso requerido: ${permission}.`, 403);
    }
  }

  async function getMeta({ tenantId, userId, role }) {
    const moduleResult = await pool.query(
      `SELECT sm.module_key, sm.display_name,
              COALESCE(tms.is_enabled, sm.default_enabled, FALSE) AS is_enabled
       FROM saas_modules sm
       LEFT JOIN tenant_module_settings tms
         ON tms.module_key = sm.module_key AND tms.tenant_id = $1::uuid
       WHERE sm.module_key = 'grc_phase1_core' AND sm.is_active = TRUE`,
      [tenantId]
    );
    const permissions = PLATFORM_ROLES.has(String(role || '').toLowerCase())
      ? { platform: true }
      : (await pool.query(
        `SELECT p.permission_key, user_has_permission($1::uuid, p.permission_key) AS allowed
         FROM permissions p
         WHERE p.is_active = TRUE
           AND p.permission_group IN ('workflow', 'evidence', 'readiness', 'framework', 'audit', 'observation', 'gap')
         ORDER BY p.permission_key`,
        [userId]
      )).rows.reduce((map, item) => ({ ...map, [item.permission_key]: item.allowed === true }), {});
    return { module: moduleResult.rows[0] || { module_key: 'grc_phase1_core', is_enabled: false }, permissions };
  }

  async function getSummary(tenantId) {
    await assertModuleEnabled(tenantId);
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM grc_workflow_instances WHERE tenant_id = $1::uuid AND status = 'active') AS active_workflows,
         (SELECT COUNT(*)::int FROM grc_evidence_requests WHERE tenant_id = $1::uuid AND status IN ('requested','submitted','under_review')) AS open_evidence_requests,
         (SELECT COUNT(*)::int FROM grc_evidence_requests WHERE tenant_id = $1::uuid AND due_at < now() AND status NOT IN ('approved','cancelled','superseded')) AS overdue_evidence_requests,
         (SELECT score FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid ORDER BY generated_at DESC LIMIT 1) AS readiness_score,
         (SELECT COUNT(*)::int FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND status IN ('submitted','changes_requested')) AS pending_workpaper_reviews,
         (SELECT COUNT(*)::int FROM grc_requirement_control_mappings WHERE (tenant_id = $1::uuid OR tenant_id IS NULL) AND status IN ('draft','reviewed')) AS framework_mappings`,
      [tenantId]
    );
    return result.rows[0];
  }

  async function listWorkflowDefinitions(tenantId, filters = {}) {
    await assertModuleEnabled(tenantId);
    const limit = clampLimit(filters.limit);
    const result = await pool.query(
      `SELECT d.*, v.version AS active_version, v.status AS active_version_status,
              (SELECT COUNT(*)::int FROM grc_workflow_instances i WHERE i.definition_id = d.id) AS instance_count
       FROM grc_workflow_definitions d
       LEFT JOIN grc_workflow_versions v ON v.id = d.active_version_id
       WHERE d.tenant_id = $1::uuid
         AND ($2::text IS NULL OR d.entity_type = $2)
       ORDER BY d.updated_at DESC
       LIMIT $3`,
      [tenantId, filters.entity_type || null, limit]
    );
    return result.rows;
  }

  async function createWorkflowDefinition({ tenantId, userId, body, correlationId }) {
    const validation = validateWorkflowDraft(body);
    if (!validation.valid) throw new GrcError('WORKFLOW_DRAFT_INVALID', 'La definición de workflow no es válida.', 422, validation.errors);
    return withTransaction(async (client) => {
      const definition = (await client.query(
        `INSERT INTO grc_workflow_definitions (tenant_id, code, name, description, entity_type, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid) RETURNING *`,
        [tenantId, body.code, body.name, body.description || null, body.entity_type, userId]
      )).rows[0];
      const version = (await client.query(
        `INSERT INTO grc_workflow_versions (tenant_id, definition_id, version, approval_mode, quorum, config, created_by)
         VALUES ($1::uuid, $2::uuid, 1, $3, $4, $5::jsonb, $6::uuid) RETURNING *`,
        [tenantId, definition.id, body.approval_mode || 'simple', body.quorum || null, json(body.config || {}), userId]
      )).rows[0];
      const stateIds = new Map();
      for (const [index, state] of body.states.entries()) {
        const row = (await client.query(
          `INSERT INTO grc_workflow_states (tenant_id, version_id, code, name, state_type, sort_order, metadata)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
          [tenantId, version.id, state.code, state.name, state.state_type, index, json(state.metadata || {})]
        )).rows[0];
        stateIds.set(state.code, row.id);
      }
      for (const transition of body.transitions) {
        const row = (await client.query(
          `INSERT INTO grc_workflow_transitions (
             tenant_id, version_id, code, name, from_state_id, to_state_id, required_permission,
             approval_mode, quorum, approval_config, sla_hours, preconditions, actions
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb) RETURNING id`,
          [tenantId, version.id, transition.code, transition.name, stateIds.get(transition.from_state),
            stateIds.get(transition.to_state), transition.required_permission || 'workflow.transition',
            transition.approval_mode || 'none', transition.quorum || null, json(transition.approval_config || {}), transition.sla_hours || null,
            json(transition.preconditions || []), json(transition.actions || [])]
        )).rows[0];
        for (const role of transition.roles || []) {
          await client.query(
            `INSERT INTO grc_workflow_transition_roles (transition_id, role_key, tenant_id)
             VALUES ($1::uuid, $2, $3::uuid)`,
            [row.id, role, tenantId]
          );
        }
      }
      await audit(client, { tenantId, userId, action: 'workflow.definition.created', tableName: 'grc_workflow_definitions', recordId: definition.id, newData: definition, metadata: { correlation_id: correlationId } });
      return { definition, version };
    });
  }

  function validateWorkflow(body) {
    const validation = validateWorkflowDraft(body);
    if (!validation.valid) throw new GrcError('WORKFLOW_DRAFT_INVALID', 'La definición de workflow no es válida.', 422, validation.errors);
    return { valid: true, errors: [] };
  }

  async function getWorkflowDefinition(tenantId, definitionId) {
    const definition = (await pool.query(
      `SELECT * FROM grc_workflow_definitions WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, assertUuid(definitionId)]
    )).rows[0];
    if (!definition) throw new GrcError('WORKFLOW_DEFINITION_NOT_FOUND', 'Workflow no encontrado.', 404);
    const versions = (await pool.query(
      `SELECT v.*,
        COALESCE((SELECT json_agg(s ORDER BY s.sort_order) FROM grc_workflow_states s
          WHERE s.tenant_id = v.tenant_id AND s.version_id = v.id), '[]') AS states,
        COALESCE((SELECT json_agg(json_build_object(
          'id', t.id, 'code', t.code, 'name', t.name,
          'from_state_id', t.from_state_id, 'to_state_id', t.to_state_id,
          'required_permission', t.required_permission, 'approval_mode', t.approval_mode,
          'quorum', t.quorum, 'approval_config', t.approval_config,
          'sla_hours', t.sla_hours, 'preconditions', t.preconditions, 'actions', t.actions,
          'roles', COALESCE((SELECT json_agg(r.role_key) FROM grc_workflow_transition_roles r
            WHERE r.tenant_id = t.tenant_id AND r.transition_id = t.id), '[]'::json)
        ) ORDER BY t.code) FROM grc_workflow_transitions t
          WHERE t.tenant_id = v.tenant_id AND t.version_id = v.id), '[]') AS transitions
       FROM grc_workflow_versions v
       WHERE v.tenant_id = $1::uuid AND v.definition_id = $2::uuid ORDER BY v.version DESC`,
      [tenantId, definitionId]
    )).rows;
    return { ...definition, versions };
  }

  async function saveWorkflowDraft({ tenantId, userId, definitionId, body, correlationId }) {
    validateWorkflow(body);
    return withTransaction(async (client) => {
      const definition = (await client.query(
        `SELECT * FROM grc_workflow_definitions
         WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(definitionId)]
      )).rows[0];
      if (!definition) throw new GrcError('WORKFLOW_DEFINITION_NOT_FOUND', 'Workflow no encontrado.', 404);

      const requestedRoles = [
        ...new Set(
          body.transitions.flatMap(transition => transition.roles || [])
        ),
      ];

      if (requestedRoles.length) {
        const validRoles = (await client.query(
          `SELECT role_key
           FROM app_roles
           WHERE role_key = ANY($1::text[])
             AND is_active = true`,
          [requestedRoles]
        )).rows.map(row => row.role_key);

        const invalidRoles = requestedRoles.filter(
          role => !validRoles.includes(role)
        );

        if (invalidRoles.length) {
          throw new GrcError(
            'WORKFLOW_INVALID_ROLES',
            `Los roles de transición no son válidos o están inactivos: ${invalidRoles.join(', ')}.`,
            422
          );
        }
      }

      let version = (await client.query(
        `SELECT * FROM grc_workflow_versions
         WHERE tenant_id = $1::uuid AND definition_id = $2::uuid AND status = 'draft'
         ORDER BY version DESC LIMIT 1 FOR UPDATE`,
        [tenantId, definitionId]
      )).rows[0];
      if (version) {
        await client.query(
          `DELETE FROM grc_workflow_transition_roles
           WHERE tenant_id = $1::uuid
             AND transition_id IN (
               SELECT id
               FROM grc_workflow_transitions
               WHERE tenant_id = $1::uuid
                 AND version_id = $2::uuid
             )`,
          [tenantId, version.id]
        );
        await client.query(
          `DELETE FROM grc_workflow_transitions
           WHERE tenant_id = $1::uuid
             AND version_id = $2::uuid`,
          [tenantId, version.id]
        );
        await client.query(
          `DELETE FROM grc_workflow_states
           WHERE tenant_id = $1::uuid
             AND version_id = $2::uuid`,
          [tenantId, version.id]
        );
        version = (await client.query(
          `UPDATE grc_workflow_versions SET approval_mode = $3, quorum = $4, config = $5::jsonb
           WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
          [tenantId, version.id, body.approval_mode || 'simple', body.quorum || null, json(body.config || {})]
        )).rows[0];
      } else {
        const next = Number((await client.query(
          `SELECT COALESCE(MAX(version),0)::int + 1 AS version FROM grc_workflow_versions
           WHERE tenant_id = $1::uuid AND definition_id = $2::uuid`,
          [tenantId, definitionId]
        )).rows[0].version);
        version = (await client.query(
          `INSERT INTO grc_workflow_versions (
             tenant_id, definition_id, version, approval_mode, quorum, config, created_by
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7::uuid) RETURNING *`,
          [tenantId, definitionId, next, body.approval_mode || 'simple', body.quorum || null, json(body.config || {}), userId]
        )).rows[0];
      }
      await client.query(
        `UPDATE grc_workflow_definitions SET name = $3, description = $4, entity_type = $5,
           status = 'draft', updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, definitionId, body.name, body.description || null, body.entity_type]
      );
      const stateIds = new Map();
      for (const [index, state] of body.states.entries()) {
        const stored = (await client.query(
          `INSERT INTO grc_workflow_states (
             tenant_id, version_id, code, name, state_type, sort_order, metadata
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
          [tenantId, version.id, state.code, state.name, state.state_type, index, json(state.metadata || {})]
        )).rows[0];
        stateIds.set(state.code, stored.id);
      }
      for (const transition of body.transitions) {
        const stored = (await client.query(
          `INSERT INTO grc_workflow_transitions (
             tenant_id, version_id, code, name, from_state_id, to_state_id,
             required_permission, approval_mode, quorum, approval_config, sla_hours,
             preconditions, actions
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb)
           RETURNING id`,
          [tenantId, version.id, transition.code, transition.name, stateIds.get(transition.from_state),
            stateIds.get(transition.to_state), transition.required_permission || 'workflow.transition',
            transition.approval_mode || 'none', transition.quorum || null,
            json(transition.approval_config || {}), transition.sla_hours || null,
            json(transition.preconditions || []), json(transition.actions || [])]
        )).rows[0];
        for (const role of transition.roles || []) {
          await client.query(
            `INSERT INTO grc_workflow_transition_roles (transition_id, role_key, tenant_id)
             VALUES ($1::uuid,$2,$3::uuid)`,
            [stored.id, role, tenantId]
          );
        }
      }
      await audit(client, { tenantId, userId, action: 'workflow.draft.saved', tableName: 'grc_workflow_versions', recordId: version.id, newData: version, metadata: { correlation_id: correlationId } });
      return { definition_id: definitionId, version };
    });
  }

  async function archiveWorkflow({ tenantId, userId, definitionId, correlationId }) {
    return withTransaction(async (client) => {
      const active = await client.query(
        `SELECT 1 FROM grc_workflow_instances
         WHERE tenant_id = $1::uuid AND definition_id = $2::uuid AND status = 'active' LIMIT 1`,
        [tenantId, assertUuid(definitionId)]
      );
      if (active.rowCount) throw new GrcError('WORKFLOW_ARCHIVE_ACTIVE_INSTANCES', 'No se puede archivar con instancias activas.', 409);
      const updated = (await client.query(
        `UPDATE grc_workflow_definitions SET status = 'archived', updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, definitionId]
      )).rows[0];
      if (!updated) throw new GrcError('WORKFLOW_DEFINITION_NOT_FOUND', 'Workflow no encontrado.', 404);
      await audit(client, { tenantId, userId, action: 'workflow.archived', tableName: 'grc_workflow_definitions', recordId: definitionId, newData: updated, metadata: { correlation_id: correlationId } });
      return updated;
    });
  }

  async function publishWorkflow({ tenantId, userId, definitionId, correlationId }) {
    assertUuid(definitionId);
    return withTransaction(async (client) => {
      const version = (await client.query(
        `SELECT v.* FROM grc_workflow_versions v
         JOIN grc_workflow_definitions d ON d.id = v.definition_id AND d.tenant_id = v.tenant_id
         WHERE v.tenant_id = $1::uuid AND v.definition_id = $2::uuid AND v.status = 'draft'
         ORDER BY v.version DESC LIMIT 1 FOR UPDATE OF v`,
        [tenantId, definitionId]
      )).rows[0];
      if (!version) throw new GrcError('WORKFLOW_DRAFT_NOT_FOUND', 'No existe una versión borrador publicable.', 404);
      const stateCount = await client.query('SELECT COUNT(*)::int AS count FROM grc_workflow_states WHERE tenant_id = $1::uuid AND version_id = $2::uuid', [tenantId, version.id]);
      const transitionCount = await client.query('SELECT COUNT(*)::int AS count FROM grc_workflow_transitions WHERE tenant_id = $1::uuid AND version_id = $2::uuid', [tenantId, version.id]);
      if (stateCount.rows[0].count < 2 || transitionCount.rows[0].count < 1) {
        throw new GrcError('WORKFLOW_VERSION_INCOMPLETE', 'La versión requiere estados y transiciones válidas.', 422);
      }
      const published = (await client.query(
        `UPDATE grc_workflow_versions SET status = 'published', published_by = $3::uuid, published_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, version.id, userId]
      )).rows[0];
      await client.query(
        `UPDATE grc_workflow_definitions SET active_version_id = $3::uuid, status = 'active', updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, definitionId, version.id]
      );
      await audit(client, { tenantId, userId, action: 'workflow.version.published', tableName: 'grc_workflow_versions', recordId: version.id, oldData: version, newData: published, metadata: { correlation_id: correlationId } });
      return published;
    });
  }

  async function startWorkflow({ tenantId, userId, body, correlationId }) {
    return withTransaction(async (client) => {
      const definition = (await client.query(
        `SELECT d.*, v.id AS version_id FROM grc_workflow_definitions d
         JOIN grc_workflow_versions v ON v.id = d.active_version_id AND v.status = 'published'
         WHERE d.tenant_id = $1::uuid AND d.id = $2::uuid AND d.status = 'active' FOR SHARE`,
        [tenantId, assertUuid(body.definition_id)]
      )).rows[0];
      if (!definition) throw new GrcError('WORKFLOW_DEFINITION_NOT_ACTIVE', 'Workflow no disponible.', 404);
      if (definition.entity_type !== body.entity_type) throw new GrcError('WORKFLOW_ENTITY_TYPE_MISMATCH', 'Tipo de entidad no compatible.', 422);
      const initial = (await client.query(
        `SELECT * FROM grc_workflow_states WHERE tenant_id = $1::uuid AND version_id = $2::uuid AND state_type = 'initial' LIMIT 1`,
        [tenantId, definition.version_id]
      )).rows[0];
      if (!initial) throw new GrcError('WORKFLOW_INITIAL_STATE_MISSING', 'Workflow sin estado inicial.', 422);
      const instance = (await client.query(
        `INSERT INTO grc_workflow_instances (
           tenant_id, organization_id, unit_id, definition_id, version_id, current_state_id,
           entity_type, entity_id, due_at, correlation_id, context, created_by
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8::uuid,$9,$10,$11::jsonb,$12::uuid)
         RETURNING *`,
        [tenantId, body.organization_id || null, body.unit_id || null, definition.id, definition.version_id,
          initial.id, body.entity_type, assertUuid(body.entity_id), body.due_at || null, correlationId,
          json(body.context || {}), userId]
      )).rows[0];
      await client.query(
        `INSERT INTO grc_workflow_history (tenant_id, instance_id, to_state_id, actor_id, actor_role, correlation_id, result)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::jsonb)`,
        [tenantId, instance.id, initial.id, userId, body.actor_role || null, correlationId, json({ event: 'started' })]
      );
      await audit(client, { tenantId, userId, action: 'workflow.instance.started', tableName: 'grc_workflow_instances', recordId: instance.id, newData: instance, metadata: { correlation_id: correlationId } });
      return instance;
    });
  }

  async function getWorkflowInstance(tenantId, instanceId) {
    const result = await pool.query(
      `SELECT i.*, s.code AS current_state_code, s.name AS current_state_name,
              COALESCE(json_agg(json_build_object(
                'id', t.id, 'code', t.code, 'name', t.name, 'to_state', target.code,
                'required_permission', t.required_permission, 'approval_mode', t.approval_mode
              ) ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]') AS available_transitions
       FROM grc_workflow_instances i
       JOIN grc_workflow_states s ON s.id = i.current_state_id
       LEFT JOIN grc_workflow_transitions t ON t.tenant_id = i.tenant_id AND t.version_id = i.version_id AND t.from_state_id = i.current_state_id AND t.is_active
       LEFT JOIN grc_workflow_states target ON target.id = t.to_state_id
       WHERE i.tenant_id = $1::uuid AND i.id = $2::uuid
       GROUP BY i.id, s.code, s.name`,
      [tenantId, assertUuid(instanceId)]
    );
    if (!result.rows[0]) throw new GrcError('WORKFLOW_INSTANCE_NOT_FOUND', 'Instancia no encontrada.', 404);
    const history = (await pool.query(
      `SELECT * FROM grc_workflow_history
       WHERE tenant_id = $1::uuid AND instance_id = $2::uuid ORDER BY created_at`,
      [tenantId, instanceId]
    )).rows;
    const approvals = (await pool.query(
      `SELECT id, transition_id, sequence_no, reviewer_role, reviewer_id, assigned_reviewer_id,
              acted_by, delegated_to, substitute_for, decision, comment, evidence_id, expires_at,
              decided_at, created_at, metadata
       FROM grc_workflow_approvals
       WHERE tenant_id = $1::uuid AND instance_id = $2::uuid ORDER BY created_at`,
      [tenantId, instanceId]
    )).rows;
    const comments = (await pool.query(
      `SELECT id, author_id, comment, created_at FROM grc_workflow_comments
       WHERE tenant_id = $1::uuid AND instance_id = $2::uuid ORDER BY created_at`,
      [tenantId, instanceId]
    )).rows;
    const attachments = (await pool.query(
      `SELECT id, evidence_id, document_id, attached_by, metadata, created_at
       FROM grc_workflow_attachments
       WHERE tenant_id = $1::uuid AND instance_id = $2::uuid ORDER BY created_at`,
      [tenantId, instanceId]
    )).rows;
    return { ...result.rows[0], history, approvals, comments, attachments };
  }

  async function executeTransition({ tenantId, userId, role, instanceId, body, correlationId }) {
    return withTransaction(async (client) => {
      const row = (await client.query(
        `SELECT i.*, t.id AS transition_id, t.to_state_id, t.required_permission, t.approval_mode,
                t.quorum, t.approval_config, t.sla_hours, t.preconditions, t.actions, target.state_type AS target_type
         FROM grc_workflow_instances i
         JOIN grc_workflow_transitions t ON t.tenant_id = i.tenant_id AND t.version_id = i.version_id
           AND t.from_state_id = i.current_state_id AND t.code = $3 AND t.is_active
         JOIN grc_workflow_states target ON target.id = t.to_state_id
         WHERE i.tenant_id = $1::uuid AND i.id = $2::uuid
           AND (i.status = 'active' OR (i.status IN ('completed','rejected') AND t.code IN ('reopen','return')))
         FOR UPDATE OF i`,
        [tenantId, assertUuid(instanceId), body.transition_code]
      )).rows[0];
      if (!row) throw new GrcError('WORKFLOW_TRANSITION_NOT_AVAILABLE', 'Transición no disponible.', 409);
      const allowedRole = await client.query(
        `SELECT COUNT(*)::int AS configured,
                COUNT(*) FILTER (WHERE role_key = $3)::int AS matching
         FROM grc_workflow_transition_roles WHERE tenant_id = $1::uuid AND transition_id = $2::uuid`,
        [tenantId, row.transition_id, role]
      );
      if (allowedRole.rows[0].configured > 0 && allowedRole.rows[0].matching === 0 && !PLATFORM_ROLES.has(role)) throw new GrcError('WORKFLOW_ROLE_DENIED', 'El rol no puede ejecutar esta transición.', 403);
      if (!PLATFORM_ROLES.has(role)) {
        const permission = await client.query('SELECT user_has_permission($1::uuid, $2::text) AS allowed', [userId, row.required_permission || 'workflow.transition']);
        if (permission.rows[0]?.allowed !== true) throw new GrcError('WORKFLOW_PERMISSION_DENIED', `Permiso requerido: ${row.required_permission}.`, 403);
      }
      const preconditions = Array.isArray(row.preconditions) ? row.preconditions : [];
      const failures = [];
      if (preconditions.includes('comment_required') && !String(body.comment || '').trim()) failures.push('comment_required');
      if (preconditions.includes('attachment_required')) {
        const attachment = await client.query('SELECT 1 FROM grc_workflow_attachments WHERE tenant_id = $1::uuid AND instance_id = $2::uuid LIMIT 1', [tenantId, instanceId]);
        if (!attachment.rowCount) failures.push('attachment_required');
      }
      if (failures.length) throw new GrcError('WORKFLOW_PRECONDITION_FAILED', 'No se cumplen las precondiciones.', 422, failures);
      if (row.approval_mode !== 'none') {
        const requestedDecision = String(body.decision || 'pending').toLowerCase();
        if (!APPROVAL_DECISIONS.has(requestedDecision)) throw new GrcError('WORKFLOW_APPROVAL_DECISION_INVALID', 'Decisión de aprobación inválida.', 422);
        if (['rejected', 'returned', 'reopened'].includes(requestedDecision) && !String(body.comment || '').trim()) {
          throw new GrcError('WORKFLOW_APPROVAL_COMMENT_REQUIRED', 'El rechazo o devolución requiere comentario.', 422);
        }
        const decision = requestedDecision === 'reopened' ? 'pending' : requestedDecision;
        try {
          assertApprovalActor({ mode: row.approval_mode, config: row.approval_config || {}, userId, role, sequenceNo: body.sequence_no || 1 });
        } catch (error) {
          throw new GrcError(error.message, 'El usuario no corresponde al aprobador configurado.', 403);
        }
        const approval = (await client.query(
          `INSERT INTO grc_workflow_approvals (
             tenant_id, instance_id, transition_id, sequence_no, reviewer_role, reviewer_id,
             assigned_reviewer_id, acted_by, decision, comment, evidence_id, expires_at, decided_at, metadata
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7::uuid,$6::uuid,$8,$9,$10::uuid,$11,
             CASE WHEN $8 = 'pending' THEN NULL ELSE now() END,$12::jsonb)
           ON CONFLICT (tenant_id, instance_id, transition_id, sequence_no, reviewer_id)
           DO UPDATE SET decision = EXCLUDED.decision, comment = EXCLUDED.comment,
             evidence_id = EXCLUDED.evidence_id, acted_by = EXCLUDED.acted_by,
             decided_at = EXCLUDED.decided_at, metadata = EXCLUDED.metadata RETURNING *`,
          [tenantId, instanceId, row.transition_id, body.sequence_no || 1, role, userId,
            body.assigned_reviewer_id || userId, decision, body.comment || null, body.evidence_id || null,
            body.expires_at || null, json({ correlation_id: correlationId })]
        )).rows[0];
        const approvals = (await client.query(
          `SELECT * FROM grc_workflow_approvals
           WHERE tenant_id = $1::uuid AND instance_id = $2::uuid AND transition_id = $3::uuid
           ORDER BY sequence_no, created_at`,
          [tenantId, instanceId, row.transition_id]
        )).rows;
        const evaluation = evaluateApproval({ mode: row.approval_mode, approvals, quorum: row.quorum, config: row.approval_config || {} });
        await audit(client, { tenantId, userId, action: `workflow.approval.${requestedDecision}`, tableName: 'grc_workflow_approvals', recordId: approval.id, newData: approval, metadata: { correlation_id: correlationId, evaluation } });
        observe('approval', { tenantId, correlationId, entityType: row.entity_type, entityId: row.entity_id, status: evaluation.outcome });
        if (!evaluation.complete) return { pending_approval: evaluation.outcome === 'pending', outcome: evaluation.outcome, approval, evaluation };
      }
      const nextStatus = row.target_type === 'terminal' ? 'completed' : row.target_type === 'rejected' ? 'rejected' : 'active';
      const updated = (await client.query(
        `UPDATE grc_workflow_instances SET current_state_id = $3::uuid, status = $4,
           due_at = CASE WHEN $5::int IS NULL THEN due_at ELSE now() + make_interval(hours => $5::int) END,
           lock_version = lock_version + 1, updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, instanceId, row.to_state_id, nextStatus, row.sla_hours]
      )).rows[0];
      await client.query(
        `INSERT INTO grc_workflow_history (
           tenant_id, instance_id, transition_id, from_state_id, to_state_id, actor_id, actor_role,
           permission_key, correlation_id, comment, precondition_result, result
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
        [tenantId, instanceId, row.transition_id, row.current_state_id, row.to_state_id, userId, role,
          row.required_permission, correlationId, body.comment || null, json({ passed: true }), json({ status: nextStatus })]
      );
      await audit(client, { tenantId, userId, action: 'workflow.transition.executed', tableName: 'grc_workflow_instances', recordId: instanceId, oldData: row, newData: updated, metadata: { correlation_id: correlationId, transition_id: row.transition_id } });
      observe('transition', { tenantId, correlationId, entityType: row.entity_type, entityId: row.entity_id });
      return updated;
    });
  }

  async function listEvidenceRequests(tenantId, filters = {}) {
    await assertModuleEnabled(tenantId);
    const result = await pool.query(
      `SELECT r.*,
              COUNT(s.id)::int AS submission_count,
              MAX(q.score) AS latest_quality_score
       FROM grc_evidence_requests r
       LEFT JOIN grc_evidence_submissions s ON s.request_id = r.id AND s.tenant_id = r.tenant_id
       LEFT JOIN grc_evidence_quality_scores q ON q.evidence_id = s.evidence_id AND q.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1::uuid AND ($2::text IS NULL OR r.status = $2)
       GROUP BY r.id ORDER BY r.due_at NULLS LAST, r.created_at DESC LIMIT $3`,
      [tenantId, filters.status || null, clampLimit(filters.limit)]
    );
    return result.rows;
  }

  async function createEvidenceRequest({ tenantId, userId, body, correlationId }) {
    if (!String(body.title || '').trim()) {
      throw new GrcError('EVIDENCE_REQUEST_TITLE_REQUIRED', 'El título es obligatorio.', 422);
    }
    return withTransaction(async (client) => {
      const request = (await client.query(
        `INSERT INTO grc_evidence_requests (
           tenant_id, title, instructions, status, owner_id, reviewer_id, approver_id, due_at, valid_until, created_by
         ) VALUES ($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10::uuid) RETURNING *`,
        [tenantId, body.title, body.instructions || null, body.status || 'requested', body.owner_id || null,
          body.reviewer_id || null, body.approver_id || null, body.due_at || null, body.valid_until || null, userId]
      )).rows[0];
      if (body.schedule) {
        const next = nextOccurrence({
          frequency: body.schedule.frequency,
          intervalValue: body.schedule.interval_value,
          from: body.schedule.start_at,
          customDays: body.schedule.custom_days,
        });
        await client.query(
          `INSERT INTO grc_evidence_schedules (
             tenant_id, request_template_id, frequency, interval_value, start_at, next_run_at, event_key
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7)`,
          [tenantId, request.id, body.schedule.frequency, body.schedule.interval_value || 1,
            body.schedule.start_at, next ? next.toISOString() : null, body.schedule.event_key || null]
        );
      }
      for (const requirement of body.requirements || []) {
        await client.query(
          `INSERT INTO grc_evidence_requirements (tenant_id, request_id, requirement_type, requirement_id, mandatory)
           VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5)`,
          [tenantId, request.id, requirement.type, requirement.id, requirement.mandatory !== false]
        );
      }
      await audit(client, { tenantId, userId, action: 'evidence.request.created', tableName: 'grc_evidence_requests', recordId: request.id, newData: request, metadata: { correlation_id: correlationId } });
      observe('evidence_request', { tenantId, correlationId, entityType: 'evidence_request', entityId: request.id });
      return request;
    });
  }

  async function getEvidenceRequest(tenantId, requestId) {
    const request = (await pool.query(
      `SELECT * FROM grc_evidence_requests WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, assertUuid(requestId)]
    )).rows[0];
    if (!request) throw new GrcError('EVIDENCE_REQUEST_NOT_FOUND', 'Solicitud no encontrada.', 404);
    const submissions = (await pool.query(
      `SELECT s.*,
              COALESCE((SELECT json_agg(v ORDER BY v.version) FROM grc_evidence_versions v
                WHERE v.tenant_id = s.tenant_id AND v.submission_id = s.id), '[]') AS versions,
              COALESCE((SELECT json_agg(r ORDER BY r.created_at) FROM grc_evidence_reviews r
                WHERE r.tenant_id = s.tenant_id AND r.submission_id = s.id), '[]') AS reviews
       FROM grc_evidence_submissions s
       WHERE s.tenant_id = $1::uuid AND s.request_id = $2::uuid
       ORDER BY s.submitted_at DESC`,
      [tenantId, requestId]
    )).rows;
    const requirements = (await pool.query(
      `SELECT * FROM grc_evidence_requirements
       WHERE tenant_id = $1::uuid AND request_id = $2::uuid ORDER BY requirement_type`,
      [tenantId, requestId]
    )).rows;
    return { ...request, submissions, requirements };
  }

  async function submitEvidence({ tenantId, userId, requestId, body, correlationId }) {
    return withTransaction(async (client) => {
      const request = (await client.query(
        `SELECT * FROM grc_evidence_requests
         WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(requestId)]
      )).rows[0];
      if (!request) throw new GrcError('EVIDENCE_REQUEST_NOT_FOUND', 'Solicitud no encontrada.', 404);
      if (['approved', 'cancelled', 'superseded'].includes(request.status)) {
        throw new GrcError('EVIDENCE_REQUEST_CLOSED', 'La solicitud no acepta nuevas entregas.', 409);
      }
      const evidenceId = assertUuid(body.evidence_id, 'EVIDENCE_ID_REQUIRED');
      const evidence = await client.query(
        'SELECT 1 FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid',
        [tenantId, evidenceId]
      );
      if (!evidence.rowCount) throw new GrcError('EVIDENCE_NOT_FOUND', 'Evidencia no encontrada.', 404);
      let submission = (await client.query(
        `INSERT INTO grc_evidence_submissions (
           tenant_id, request_id, evidence_id, status, submitted_by
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,'submitted',$4::uuid)
         ON CONFLICT (tenant_id, request_id, evidence_id) DO NOTHING RETURNING *`,
        [tenantId, requestId, evidenceId, userId]
      )).rows[0];
      let reused = false;
      if (!submission) {
        reused = true;
        submission = (await client.query(
          `SELECT * FROM grc_evidence_submissions
           WHERE tenant_id = $1::uuid AND request_id = $2::uuid AND evidence_id = $3::uuid`,
          [tenantId, requestId, evidenceId]
        )).rows[0];
      } else {
        await client.query(
          `INSERT INTO grc_evidence_versions (
             tenant_id, submission_id, version, evidence_id, content_hash, source_type,
             integrity_metadata, created_by
           ) VALUES ($1::uuid,$2::uuid,1,$3::uuid,$4,$5,$6::jsonb,$7::uuid)`,
          [tenantId, submission.id, evidenceId, body.content_hash || null, body.source_type || 'manual',
            json(body.integrity_metadata || {}), userId]
        );
        await client.query(
          `UPDATE grc_evidence_requests SET status = 'submitted', updated_at = now()
           WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [tenantId, requestId]
        );
        await audit(client, { tenantId, userId, action: 'evidence.submitted', tableName: 'grc_evidence_submissions', recordId: submission.id, newData: submission, metadata: { correlation_id: correlationId } });
      }
      observe('evidence_submission', { tenantId, correlationId, entityType: 'evidence', entityId: evidenceId, status: reused ? 'reused' : 'success' });
      return { ...submission, reused };
    });
  }

  async function createEvidenceVersion({ tenantId, userId, submissionId, body, correlationId }) {
    return withTransaction(async (client) => {
      const submission = (await client.query(
        `SELECT * FROM grc_evidence_submissions
         WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(submissionId)]
      )).rows[0];
      if (!submission) throw new GrcError('EVIDENCE_SUBMISSION_NOT_FOUND', 'Entrega no encontrada.', 404);
      const evidenceId = assertUuid(body.evidence_id, 'EVIDENCE_ID_REQUIRED');
      const evidence = await client.query(
        'SELECT 1 FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid',
        [tenantId, evidenceId]
      );
      if (!evidence.rowCount) throw new GrcError('EVIDENCE_NOT_FOUND', 'Evidencia no encontrada.', 404);
      const nextVersion = Number((await client.query(
        `SELECT COALESCE(MAX(version),0)::int + 1 AS version
         FROM grc_evidence_versions WHERE tenant_id = $1::uuid AND submission_id = $2::uuid`,
        [tenantId, submissionId]
      )).rows[0].version);
      const version = (await client.query(
        `INSERT INTO grc_evidence_versions (
           tenant_id, submission_id, version, evidence_id, content_hash, source_type,
           integrity_metadata, created_by
         ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7::jsonb,$8::uuid) RETURNING *`,
        [tenantId, submissionId, nextVersion, evidenceId, body.content_hash || null,
          body.source_type || 'manual', json(body.integrity_metadata || {}), userId]
      )).rows[0];
      await client.query(
        `UPDATE grc_evidence_submissions SET evidence_id = $3::uuid, status = 'submitted',
           submitted_by = $4::uuid, submitted_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, submissionId, evidenceId, userId]
      );
      await audit(client, { tenantId, userId, action: 'evidence.version.created', tableName: 'grc_evidence_versions', recordId: version.id, newData: version, metadata: { correlation_id: correlationId } });
      return version;
    });
  }

  async function linkEvidence({ tenantId, userId, evidenceId, body, correlationId }) {
    return withTransaction(async (client) => {
      const present = await client.query(
        'SELECT 1 FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid',
        [tenantId, assertUuid(evidenceId)]
      );
      if (!present.rowCount) throw new GrcError('EVIDENCE_NOT_FOUND', 'Evidencia no encontrada.', 404);
      const entityType = String(body.entity_type || '').toLowerCase();
      const entityId = assertUuid(body.entity_id, 'GRC_ENTITY_ID_REQUIRED');
      const runtime = await readRuntimeEntity(client, { tenantId, entityType, entityId });
      if (!runtime) throw new GrcError('GRC_RUNTIME_ENTITY_NOT_FOUND', 'Entidad no encontrada.', 404);
      const link = (await client.query(
        `INSERT INTO grc_evidence_links (tenant_id, evidence_id, entity_type, entity_id, created_by)
         VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid)
         ON CONFLICT (tenant_id, evidence_id, entity_type, entity_id)
         DO UPDATE SET created_by = EXCLUDED.created_by RETURNING *`,
        [tenantId, evidenceId, entityType, entityId, userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'evidence.linked', tableName: 'grc_evidence_links', recordId: link.id, newData: link, metadata: { correlation_id: correlationId } });
      return link;
    });
  }

  async function reviewEvidence({ tenantId, userId, submissionId, body, correlationId }) {
    if (!['approved', 'rejected', 'reopened'].includes(body.decision)) throw new GrcError('EVIDENCE_REVIEW_DECISION_INVALID', 'Decisión inválida.', 422);
    if (body.decision === 'rejected' && !String(body.reason || '').trim()) throw new GrcError('EVIDENCE_REJECTION_REASON_REQUIRED', 'El rechazo requiere una causa.', 422);
    return withTransaction(async (client) => {
      const submission = (await client.query(
        `SELECT * FROM grc_evidence_submissions WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(submissionId)]
      )).rows[0];
      if (!submission) throw new GrcError('EVIDENCE_SUBMISSION_NOT_FOUND', 'Entrega no encontrada.', 404);
      const status = body.decision === 'reopened' ? 'under_review' : body.decision;
      await client.query('UPDATE grc_evidence_submissions SET status = $3 WHERE tenant_id = $1::uuid AND id = $2::uuid', [tenantId, submissionId, status]);
      await client.query(
        `UPDATE grc_evidence_requests SET status = $3, updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, submission.request_id, status]
      );
      const review = (await client.query(
        `INSERT INTO grc_evidence_reviews (tenant_id, submission_id, reviewer_id, decision, reason)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5) RETURNING *`,
        [tenantId, submissionId, userId, body.decision, body.reason || null]
      )).rows[0];
      await audit(client, { tenantId, userId, action: `evidence.${body.decision}`, tableName: 'grc_evidence_submissions', recordId: submissionId, oldData: submission, newData: { ...submission, status }, metadata: { correlation_id: correlationId } });
      observe('evidence_review', { tenantId, correlationId, entityType: 'evidence', entityId: submission.evidence_id, status: body.decision });
      return review;
    });
  }

  async function calculateEvidenceQuality({ tenantId, userId, evidenceId, body, correlationId }) {
    const evidence = (await pool.query(
      `SELECT e.*, COALESCE((e.metadata->>'owner_id')::uuid, e.reviewed_by) AS owner_id
       FROM evidences e WHERE e.tenant_id = $1::uuid AND e.id = $2::uuid`,
      [tenantId, assertUuid(evidenceId)]
    )).rows[0];
    if (!evidence) throw new GrcError('EVIDENCE_NOT_FOUND', 'Evidencia no encontrada.', 404);
    const score = scoreEvidence({
      status: evidence.status,
      validated: evidence.validated,
      expiresAt: evidence.expires_at,
      description: evidence.description,
      fileName: evidence.file_name,
      mimeType: evidence.file_mime_type,
      sourceType: evidence.metadata?.source_type || body.source_type || 'manual',
      contentHash: evidence.content_fingerprint,
      ownerId: evidence.owner_id,
      consistent: body.consistent,
      coverage: body.coverage,
    });
    return withTransaction(async (client) => {
      const stored = (await client.query(
        `INSERT INTO grc_evidence_quality_scores (tenant_id, evidence_id, score, formula_version, factors, limitations)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6::jsonb)
         ON CONFLICT (tenant_id, evidence_id, formula_version)
         DO UPDATE SET score = EXCLUDED.score, factors = EXCLUDED.factors,
           limitations = EXCLUDED.limitations, calculated_at = now()
         RETURNING *`,
        [tenantId, evidenceId, score.score, score.formulaVersion,
          json({ weights: score.weights, factors: score.factors, contributions: score.contributions }), json(score.limitations)]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'evidence.quality.calculated', tableName: 'grc_evidence_quality_scores', recordId: stored.id, newData: stored, metadata: { correlation_id: correlationId } });
      observe('evidence_quality', { tenantId, correlationId, entityType: 'evidence', entityId: evidenceId });
      return { ...stored, explanation: score };
    });
  }

  const READINESS_SOURCES = [
    { code: 'requirements', table: 'tenant_applicable_controls', weight: 15, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE tenant_control_id IS NOT NULL)::int achieved FROM tenant_applicable_controls WHERE tenant_id = $1::uuid AND active = TRUE AND visible_to_tenant = TRUE` },
    { code: 'controls', table: 'tenant_controls', weight: 20, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE COALESCE(score,0) >= 70 OR lower(COALESCE(health_status,'')) IN ('saludable','healthy','ok'))::int achieved FROM tenant_controls WHERE tenant_id = $1::uuid AND COALESCE(applicability,'aplicable') <> 'no_aplicable'` },
    { code: 'evidence', table: 'evidences', weight: 20, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE (validated = TRUE OR lower(COALESCE(status,'')) IN ('approved','aprobada')) AND (expires_at IS NULL OR expires_at >= CURRENT_DATE))::int achieved FROM evidences WHERE tenant_id = $1::uuid` },
    { code: 'risks', table: 'asset_risks/assets', weight: 10, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE lower(COALESCE(ar.level,'')) NOT IN ('alto','high','critico','critical'))::int achieved FROM asset_risks ar JOIN assets a ON a.id = ar.asset_id WHERE a.tenant_id = $1::uuid` },
    { code: 'actions', table: 'action_plans', weight: 10, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE lower(COALESCE(status,'')) IN ('completado','completada','completed','cerrado','cerrada'))::int achieved FROM action_plans WHERE tenant_id = $1::uuid` },
    { code: 'audits', table: 'audits', weight: 10, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE lower(COALESCE(status,'')) IN ('completada','completed','cerrada'))::int achieved FROM audits WHERE tenant_id = $1::uuid` },
    { code: 'documents', table: 'iso_generated_documents', weight: 10, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE lower(COALESCE(document_status,'')) IN ('approved','aprobado','published','publicado'))::int achieved FROM iso_generated_documents WHERE tenant_id = $1::uuid` },
    { code: 'objectives', table: 'management_objectives', weight: 5, sql: `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE COALESCE(progress_percent,0) >= 100 OR lower(COALESCE(status,'')) IN ('completed','cumplido','cerrado'))::int achieved FROM management_objectives WHERE tenant_id = $1::uuid AND is_active = TRUE` },
  ];

  async function generateReadinessSnapshot({ tenantId, userId, correlationId }) {
    const dimensions = [];
    for (const source of READINESS_SOURCES) {
      const counts = (await pool.query(source.sql, [tenantId])).rows[0];
      const total = Number(counts.total || 0);
      const achieved = Number(counts.achieved || 0);
      dimensions.push({
        code: source.code,
        source: source.table,
        total,
        achieved,
        pending: Math.max(0, total - achieved),
        score: total ? Number(((achieved / total) * 100).toFixed(2)) : 0,
        weight: source.weight,
      });
    }
    const readiness = calculateReadiness(dimensions);
    return withTransaction(async (client) => {
      const snapshot = (await client.query(
        `INSERT INTO grc_readiness_snapshots (
           tenant_id, score, formula_version, input_hash, generated_by, metadata
         ) VALUES ($1::uuid,$2,$3,$4,$5::uuid,$6::jsonb)
         ON CONFLICT (tenant_id, input_hash) DO NOTHING RETURNING *`,
        [tenantId, readiness.score, readiness.formulaVersion, readiness.inputHash, userId, json({ limitations: readiness.limitations })]
      )).rows[0] || (await client.query(
        'SELECT * FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid AND input_hash = $2',
        [tenantId, readiness.inputHash]
      )).rows[0];
      for (const dimension of dimensions) {
        const rule = (await client.query(
          `INSERT INTO grc_readiness_rules (
             tenant_id, code, description, dimension, source_table, formula, weight, threshold, version
           ) VALUES ($1::uuid,$2,$3,$2,$4,'achieved / total * 100',$5,70,1)
           ON CONFLICT (tenant_id, code, version) DO UPDATE SET weight = EXCLUDED.weight
           RETURNING *`,
          [tenantId, dimension.code, `Preparación basada en ${dimension.source}.`, dimension.source, dimension.weight]
        )).rows[0];
        await client.query(
          `INSERT INTO grc_readiness_results (
             tenant_id, snapshot_id, rule_id, dimension, score, weight,
             included_records, excluded_records, pending_records, source_as_of
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,'[]'::jsonb,$8::jsonb,now())
           ON CONFLICT (tenant_id, snapshot_id, rule_id) DO NOTHING`,
          [tenantId, snapshot.id, rule.id, dimension.code, dimension.score, dimension.weight,
            json({ count: dimension.achieved }), json({ count: dimension.pending })]
        );
      }
      await audit(client, { tenantId, userId, action: 'readiness.snapshot.generated', tableName: 'grc_readiness_snapshots', recordId: snapshot.id, newData: snapshot, metadata: { correlation_id: correlationId, formula_version: readiness.formulaVersion } });
      observe('readiness_snapshot', { tenantId, correlationId, entityType: 'readiness', entityId: snapshot.id });
      return { ...snapshot, dimensions, limitations: readiness.limitations };
    });
  }

  async function getReadiness(tenantId) {
    await assertModuleEnabled(tenantId);
    const snapshot = (await pool.query(
      `SELECT * FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid ORDER BY generated_at DESC LIMIT 1`,
      [tenantId]
    )).rows[0];
    if (!snapshot) return null;
    const results = (await pool.query(
      `SELECT rr.*, r.code AS rule_code, r.description AS rule_description, r.formula, r.threshold, r.source_table
       FROM grc_readiness_results rr JOIN grc_readiness_rules r ON r.id = rr.rule_id
       WHERE rr.tenant_id = $1::uuid AND rr.snapshot_id = $2::uuid ORDER BY rr.dimension`,
      [tenantId, snapshot.id]
    )).rows;
    return { ...snapshot, results };
  }

  async function listFrameworks(tenantId) {
    await assertModuleEnabled(tenantId);
    return (await pool.query(
      `SELECT f.*, COALESCE(json_agg(json_build_object(
          'id', v.id, 'version_label', v.version_label, 'status', v.status,
          'effective_from', v.effective_from, 'content_classification', f.content_classification
        ) ORDER BY v.effective_from DESC NULLS LAST) FILTER (WHERE v.id IS NOT NULL), '[]') AS versions
       FROM grc_frameworks f LEFT JOIN grc_framework_versions v ON v.framework_id = f.id
         AND (v.tenant_id = $1::uuid OR v.tenant_id IS NULL)
       WHERE (f.tenant_id = $1::uuid OR f.tenant_id IS NULL) AND f.is_active = TRUE
       GROUP BY f.id ORDER BY f.name`,
      [tenantId]
    )).rows;
  }

  async function createMapping({ tenantId, userId, body, correlationId }) {
    const mappingTypes = new Set(['exact', 'partial', 'related', 'support', 'not_equivalent', 'pending_review']);
    if (!mappingTypes.has(body.mapping_type)) throw new GrcError('MAPPING_TYPE_INVALID', 'Tipo de equivalencia inválido.', 422);
    if (!String(body.justification || '').trim()) throw new GrcError('MAPPING_JUSTIFICATION_REQUIRED', 'La justificación es obligatoria.', 422);
    return withTransaction(async (client) => {
      const requirement = await client.query(
        `SELECT 1 FROM grc_framework_requirements r
         JOIN grc_framework_versions v ON v.id = r.version_id
         JOIN grc_frameworks f ON f.id = v.framework_id
         WHERE r.id = $2::uuid
           AND (r.tenant_id = $1::uuid OR (r.tenant_id IS NULL AND v.tenant_id IS NULL AND f.tenant_id IS NULL))`,
        [tenantId, assertUuid(body.requirement_id)]
      );
      if (!requirement.rowCount) throw new GrcError('MAPPING_REQUIREMENT_NOT_FOUND', 'Requisito no encontrado.', 404);
      if (body.tenant_control_id) {
        const control = await client.query(
          'SELECT 1 FROM tenant_controls WHERE tenant_id = $1::uuid AND id = $2::uuid',
          [tenantId, assertUuid(body.tenant_control_id)]
        );
        if (!control.rowCount) throw new GrcError('MAPPING_CONTROL_NOT_FOUND', 'Control no encontrado.', 404);
      }
      const mapping = (await client.query(
        `INSERT INTO grc_requirement_control_mappings (
           tenant_id, requirement_id, tenant_control_id, catalog_control_id, mapping_type,
           coverage_level, justification, source_type, created_by
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::uuid) RETURNING *`,
        [tenantId, assertUuid(body.requirement_id), body.tenant_control_id || null, body.catalog_control_id || null,
          body.mapping_type, body.coverage_level || 0, body.justification, body.source_type || 'tcdx_interpretation', userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'mapping.created', tableName: 'grc_requirement_control_mappings', recordId: mapping.id, newData: mapping, metadata: { correlation_id: correlationId } });
      return mapping;
    });
  }

  async function listMappings(tenantId) {
    return (await pool.query(
      `SELECT m.*, r.reference_code, r.permitted_title, r.tcdx_interpretation,
              f.code AS framework_code, f.name AS framework_name, v.version_label,
              COALESCE((SELECT json_agg(rv ORDER BY rv.created_at)
                FROM grc_mapping_reviews rv
                WHERE rv.tenant_id = m.tenant_id AND rv.mapping_id = m.id), '[]') AS reviews
       FROM grc_requirement_control_mappings m
       JOIN grc_framework_requirements r ON r.id = m.requirement_id
       JOIN grc_framework_versions v ON v.id = r.version_id
       JOIN grc_frameworks f ON f.id = v.framework_id
       WHERE m.tenant_id = $1::uuid ORDER BY m.updated_at DESC LIMIT 100`,
      [tenantId]
    )).rows;
  }

  async function listFrameworkRequirements(tenantId, versionId = null) {
    return (await pool.query(
      `SELECT r.id, r.version_id, r.reference_code, r.permitted_title,
              r.tcdx_interpretation, r.content_classification,
              f.code AS framework_code, f.name AS framework_name, v.version_label
       FROM grc_framework_requirements r
       JOIN grc_framework_versions v ON v.id = r.version_id
       JOIN grc_frameworks f ON f.id = v.framework_id
       WHERE (r.tenant_id = $1::uuid OR (r.tenant_id IS NULL AND v.tenant_id IS NULL AND f.tenant_id IS NULL))
         AND ($2::uuid IS NULL OR r.version_id = $2::uuid)
       ORDER BY f.name, r.reference_code LIMIT 500`,
      [tenantId, versionId ? assertUuid(versionId) : null]
    )).rows;
  }

  async function reviewMapping({ tenantId, userId, mappingId, body, correlationId }) {
    if (!['approved', 'rejected', 'changes_requested'].includes(body.decision)) {
      throw new GrcError('MAPPING_REVIEW_DECISION_INVALID', 'Decisión de mapping inválida.', 422);
    }
    if (body.decision !== 'approved' && !String(body.comment || '').trim()) {
      throw new GrcError('MAPPING_REVIEW_COMMENT_REQUIRED', 'La decisión requiere comentario.', 422);
    }
    return withTransaction(async (client) => {
      const current = (await client.query(
        `SELECT * FROM grc_requirement_control_mappings
         WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(mappingId)]
      )).rows[0];
      if (!current) throw new GrcError('MAPPING_NOT_FOUND', 'Mapping no encontrado.', 404);
      const review = (await client.query(
        `INSERT INTO grc_mapping_reviews (tenant_id, mapping_id, reviewer_id, decision, comment)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5) RETURNING *`,
        [tenantId, mappingId, userId, body.decision, body.comment || null]
      )).rows[0];
      const status = body.decision === 'approved' ? 'published' : body.decision === 'rejected' ? 'rejected' : 'draft';
      const updated = (await client.query(
        `UPDATE grc_requirement_control_mappings SET status = $3, updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, mappingId, status]
      )).rows[0];
      await audit(client, { tenantId, userId, action: `mapping.${body.decision}`, tableName: 'grc_requirement_control_mappings', recordId: mappingId, oldData: current, newData: updated, metadata: { correlation_id: correlationId, review_id: review.id } });
      return { mapping: updated, review };
    });
  }

  async function getAuditWorkspace(tenantId, auditId = null) {
    await assertModuleEnabled(tenantId);
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM grc_audit_universe_entities WHERE tenant_id = $1::uuid AND is_active) AS universe_entities,
         (SELECT COUNT(*)::int FROM grc_audit_annual_plans WHERE tenant_id = $1::uuid AND status <> 'archived') AS annual_plans,
         (SELECT COUNT(*)::int FROM grc_audit_programs WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR audit_id = $2::uuid)) AS programs,
         (SELECT COUNT(*)::int FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR audit_id = $2::uuid)) AS workpapers,
         (SELECT COUNT(*)::int FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND status IN ('submitted','changes_requested') AND ($2::uuid IS NULL OR audit_id = $2::uuid)) AS pending_reviews,
         (SELECT COALESCE(json_agg(json_build_object(
            'id', wp.id, 'audit_id', wp.audit_id, 'code', wp.code, 'version', wp.version,
            'status', wp.status, 'objective', wp.objective, 'prepared_by', wp.prepared_by,
            'content_hash', wp.content_hash
          ) ORDER BY wp.updated_at DESC), '[]'::json)
          FROM grc_audit_workpapers wp
          WHERE wp.tenant_id = $1::uuid AND wp.status IN ('submitted','changes_requested')
            AND ($2::uuid IS NULL OR wp.audit_id = $2::uuid)) AS review_queue,
         (SELECT COUNT(*)::int FROM grc_audit_conflicts c JOIN grc_audit_team_members tm ON tm.id = c.team_member_id WHERE c.tenant_id = $1::uuid AND c.status = 'open' AND ($2::uuid IS NULL OR tm.audit_id = $2::uuid)) AS open_conflicts,
         (SELECT COUNT(*)::int FROM grc_audit_followups WHERE tenant_id = $1::uuid AND status NOT IN ('verified','closed') AND ($2::uuid IS NULL OR audit_id = $2::uuid)) AS open_followups`,
      [tenantId, auditId]
    );
    return result.rows[0];
  }

  async function createAuditPlan({ tenantId, userId, body, correlationId }) {
    return withTransaction(async (client) => {
      const plan = (await client.query(
        `INSERT INTO grc_audit_annual_plans (tenant_id, year, version, prioritization_criteria, created_by)
         VALUES ($1::uuid,$2,$3,$4::jsonb,$5::uuid) RETURNING *`,
        [tenantId, body.year, body.version || 1, json(body.prioritization_criteria || {}), userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.plan.created', tableName: 'grc_audit_annual_plans', recordId: plan.id, newData: plan, metadata: { correlation_id: correlationId } });
      return plan;
    });
  }

  async function assertAudit(client, tenantId, auditId) {
    const row = (await client.query(
      'SELECT * FROM audits WHERE tenant_id = $1::uuid AND id = $2::uuid',
      [tenantId, assertUuid(auditId)]
    )).rows[0];
    if (!row) throw new GrcError('AUDIT_NOT_FOUND', 'Auditoría no encontrada.', 404);
    return row;
  }

  async function getAuditOperations(tenantId, auditId) {
    await assertAudit(pool, tenantId, auditId);
    const [team, conflicts, programs, samples, workpapers, interviews, links, reviews, reports, followups] = await Promise.all([
      pool.query('SELECT * FROM grc_audit_team_members WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY team_role', [tenantId, auditId]),
      pool.query(`SELECT c.* FROM grc_audit_conflicts c JOIN grc_audit_team_members tm ON tm.id = c.team_member_id WHERE c.tenant_id = $1::uuid AND tm.audit_id = $2::uuid ORDER BY c.status, c.id`, [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_programs WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY version DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_sample_plans WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY created_at DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY updated_at DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_interviews WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY created_at DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_evidence_links WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY linked_at DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_supervisor_reviews WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY created_at DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_reports WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY version DESC', [tenantId, auditId]),
      pool.query('SELECT * FROM grc_audit_followups WHERE tenant_id = $1::uuid AND audit_id = $2::uuid ORDER BY created_at DESC', [tenantId, auditId]),
    ]);
    return {
      audit_id: auditId, team: team.rows, conflicts: conflicts.rows, programs: programs.rows,
      samples: samples.rows, workpapers: workpapers.rows, interviews: interviews.rows,
      evidence_links: links.rows, reviews: reviews.rows, reports: reports.rows, followups: followups.rows,
    };
  }

  async function assignAuditTeamMember({ tenantId, userId, auditId, body, correlationId }) {
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const memberUserId = assertUuid(body.user_id, 'AUDIT_TEAM_USER_REQUIRED');
      const memberUser = await client.query('SELECT 1 FROM users WHERE tenant_id = $1::uuid AND id = $2::uuid', [tenantId, memberUserId]);
      if (!memberUser.rowCount) throw new GrcError('AUDIT_TEAM_USER_NOT_FOUND', 'Usuario no encontrado en la empresa.', 404);
      const independence = ['pending', 'declared', 'conflict', 'cleared'].includes(body.independence_status) ? body.independence_status : 'pending';
      const member = (await client.query(
        `INSERT INTO grc_audit_team_members (
           tenant_id, audit_id, user_id, team_role, independence_status, declaration, declared_at
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,
           CASE WHEN $5 = 'pending' THEN NULL ELSE now() END)
         ON CONFLICT (tenant_id, audit_id, user_id) DO UPDATE SET
           team_role = EXCLUDED.team_role, independence_status = EXCLUDED.independence_status,
           declaration = EXCLUDED.declaration, declared_at = EXCLUDED.declared_at RETURNING *`,
        [tenantId, auditId, memberUserId, String(body.team_role || 'auditor'), independence, json(body.declaration || {})]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.team.assigned', tableName: 'grc_audit_team_members', recordId: member.id, newData: member, metadata: { correlation_id: correlationId } });
      return member;
    });
  }

  async function recordAuditConflict({ tenantId, userId, auditId, body, correlationId }) {
    if (!String(body.description || '').trim()) throw new GrcError('AUDIT_CONFLICT_DESCRIPTION_REQUIRED', 'La descripción es obligatoria.', 422);
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const member = await client.query(
        'SELECT 1 FROM grc_audit_team_members WHERE tenant_id = $1::uuid AND audit_id = $2::uuid AND id = $3::uuid',
        [tenantId, auditId, assertUuid(body.team_member_id)]
      );
      if (!member.rowCount) throw new GrcError('AUDIT_TEAM_MEMBER_NOT_FOUND', 'Miembro no encontrado.', 404);
      const conflict = (await client.query(
        `INSERT INTO grc_audit_conflicts (tenant_id, team_member_id, conflict_type, description)
         VALUES ($1::uuid,$2::uuid,$3,$4) RETURNING *`,
        [tenantId, body.team_member_id, String(body.conflict_type || 'independence'), body.description]
      )).rows[0];
      await client.query(`UPDATE grc_audit_team_members SET independence_status = 'conflict' WHERE tenant_id = $1::uuid AND id = $2::uuid`, [tenantId, body.team_member_id]);
      await audit(client, { tenantId, userId, action: 'audit.conflict.recorded', tableName: 'grc_audit_conflicts', recordId: conflict.id, newData: conflict, metadata: { correlation_id: correlationId } });
      return conflict;
    });
  }

  async function resolveAuditConflict({ tenantId, userId, conflictId, body, correlationId }) {
    if (!['mitigated', 'accepted', 'rejected'].includes(body.status) || !String(body.resolution || '').trim()) {
      throw new GrcError('AUDIT_CONFLICT_RESOLUTION_INVALID', 'Estado y resolución son obligatorios.', 422);
    }
    return withTransaction(async (client) => {
      const current = (await client.query(
        'SELECT * FROM grc_audit_conflicts WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE',
        [tenantId, assertUuid(conflictId)]
      )).rows[0];
      if (!current) throw new GrcError('AUDIT_CONFLICT_NOT_FOUND', 'Conflicto no encontrado.', 404);
      const updated = (await client.query(
        `UPDATE grc_audit_conflicts SET status = $3, resolution = $4, resolved_by = $5::uuid, resolved_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, conflictId, body.status, body.resolution, userId]
      )).rows[0];
      await client.query(`UPDATE grc_audit_team_members SET independence_status = 'cleared' WHERE tenant_id = $1::uuid AND id = $2::uuid`, [tenantId, current.team_member_id]);
      await audit(client, { tenantId, userId, action: 'audit.conflict.resolved', tableName: 'grc_audit_conflicts', recordId: conflictId, oldData: current, newData: updated, metadata: { correlation_id: correlationId } });
      return updated;
    });
  }

  async function createAuditProgram({ tenantId, userId, auditId, body, correlationId }) {
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const version = Number((await client.query('SELECT COALESCE(MAX(version),0)::int + 1 AS version FROM grc_audit_programs WHERE tenant_id = $1::uuid AND audit_id = $2::uuid', [tenantId, auditId])).rows[0].version);
      const program = (await client.query(
        `INSERT INTO grc_audit_programs (tenant_id, audit_id, version, objectives, scope, criteria, procedures)
         VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb) RETURNING *`,
        [tenantId, auditId, version, json(body.objectives || []), json(body.scope || {}), json(body.criteria || []), json(body.procedures || [])]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.program.created', tableName: 'grc_audit_programs', recordId: program.id, newData: program, metadata: { correlation_id: correlationId } });
      return program;
    });
  }

  async function createAuditUniverseEntity({ tenantId, userId, body, correlationId }) {
    const allowed = new Set(['process', 'unit', 'site', 'system', 'supplier', 'control', 'framework', 'risk']);
    if (!allowed.has(body.entity_type) || !String(body.name || '').trim()) {
      throw new GrcError('AUDIT_UNIVERSE_ENTITY_INVALID', 'Tipo y nombre del universo son obligatorios.', 422);
    }
    return withTransaction(async (client) => {
      const entity = (await client.query(
        `INSERT INTO grc_audit_universe_entities (
           tenant_id, entity_type, entity_id, name, risk_score, owner_id, metadata
         ) VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6::uuid,$7::jsonb)
         ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET
           name = EXCLUDED.name, risk_score = EXCLUDED.risk_score,
           owner_id = EXCLUDED.owner_id, metadata = EXCLUDED.metadata, is_active = TRUE
         RETURNING *`,
        [tenantId, body.entity_type, body.entity_id || null, body.name, body.risk_score || null,
          body.owner_id || null, json(body.metadata || {})]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.universe.upserted', tableName: 'grc_audit_universe_entities', recordId: entity.id, newData: entity, metadata: { correlation_id: correlationId } });
      return entity;
    });
  }

  async function createAuditInterview({ tenantId, userId, auditId, body, correlationId }) {
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const interview = (await client.query(
        `INSERT INTO grc_audit_interviews (
           tenant_id, audit_id, scheduled_at, participants, agenda,
           questions_answers, confirmation_status, confidentiality, created_by
         ) VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5,$6::jsonb,$7,$8,$9::uuid) RETURNING *`,
        [tenantId, auditId, body.scheduled_at || null, json(body.participants || []),
          body.agenda || null, json(body.questions_answers || []),
          body.confirmation_status || 'pending', body.confidentiality || null, userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.interview.created', tableName: 'grc_audit_interviews', recordId: interview.id, newData: interview, metadata: { correlation_id: correlationId } });
      return interview;
    });
  }

  async function createAuditSample({ tenantId, userId, auditId, body, correlationId }) {
    if (!String(body.population_description || '').trim() || Number(body.sample_size) < 1 || !String(body.limitation || '').trim()) {
      throw new GrcError('AUDIT_SAMPLE_INVALID', 'Población, tamaño y limitación son obligatorios.', 422);
    }
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const sample = (await client.query(
        `INSERT INTO grc_audit_sample_plans (
           tenant_id, audit_id, population_description, population_size, method,
           sample_size, selection_criteria, random_seed, limitation
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *`,
        [tenantId, auditId, body.population_description, body.population_size || null,
          String(body.method || 'judgmental'), body.sample_size, json(body.selection_criteria || {}),
          body.random_seed || null, body.limitation]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.sample.created', tableName: 'grc_audit_sample_plans', recordId: sample.id, newData: sample, metadata: { correlation_id: correlationId } });
      return sample;
    });
  }

  async function linkAuditEvidence({ tenantId, userId, auditId, body, correlationId }) {
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const evidenceId = assertUuid(body.evidence_id, 'EVIDENCE_ID_REQUIRED');
      const evidence = await client.query('SELECT 1 FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid', [tenantId, evidenceId]);
      if (!evidence.rowCount) throw new GrcError('EVIDENCE_NOT_FOUND', 'Evidencia no encontrada.', 404);
      const workpaperId = assertUuid(body.workpaper_id, 'AUDIT_WORKPAPER_REQUIRED');
      const wp = await client.query('SELECT 1 FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND audit_id = $2::uuid AND id = $3::uuid', [tenantId, auditId, workpaperId]);
      if (!wp.rowCount) throw new GrcError('AUDIT_WORKPAPER_NOT_FOUND', 'Papel de trabajo no encontrado.', 404);
      const linked = (await client.query(
        `INSERT INTO grc_audit_evidence_links (tenant_id, audit_id, evidence_id, workpaper_id, linked_by)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid)
         ON CONFLICT (tenant_id, audit_id, evidence_id, workpaper_id)
         DO UPDATE SET linked_by = EXCLUDED.linked_by, linked_at = now() RETURNING *`,
        [tenantId, auditId, evidenceId, workpaperId, userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.evidence.linked', tableName: 'grc_audit_evidence_links', recordId: evidenceId, newData: linked, metadata: { correlation_id: correlationId, audit_id: auditId } });
      return linked;
    });
  }

  async function createAuditFollowup({ tenantId, userId, auditId, body, correlationId }) {
    return withTransaction(async (client) => {
      await assertAudit(client, tenantId, auditId);
      const followup = (await client.query(
        `INSERT INTO grc_audit_followups (
           tenant_id, audit_id, finding_id, action_plan_id, owner_id, due_at, verification_notes
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7) RETURNING *`,
        [tenantId, auditId, body.finding_id || null, body.action_plan_id || null,
          body.owner_id || null, body.due_at || null, body.verification_notes || null]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.followup.created', tableName: 'grc_audit_followups', recordId: followup.id, newData: followup, metadata: { correlation_id: correlationId } });
      return followup;
    });
  }

  async function closeAudit({ tenantId, userId, auditId, correlationId }) {
    return withTransaction(async (client) => {
      const current = await assertAudit(client, tenantId, auditId);
      const readiness = await getAuditCloseReadiness(tenantId, auditId);
      if (!readiness.can_close) throw new GrcError('AUDIT_CLOSE_BLOCKED', 'La auditoría no cumple requisitos de cierre.', 409, readiness.blockers);
      const updated = (await client.query(
        `UPDATE audits SET status = 'completada' WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, auditId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.closed', tableName: 'audits', recordId: auditId, oldData: current, newData: updated, metadata: { correlation_id: correlationId } });
      return updated;
    });
  }

  async function createWorkpaper({ tenantId, userId, body, correlationId }) {
    return withTransaction(async (client) => {
      const conflict = await client.query(
        `SELECT 1 FROM grc_audit_team_members tm
         JOIN grc_audit_conflicts c ON c.team_member_id = tm.id AND c.status = 'open'
         WHERE tm.tenant_id = $1::uuid AND tm.audit_id = $2::uuid AND tm.user_id = $3::uuid LIMIT 1`,
        [tenantId, assertUuid(body.audit_id), userId]
      );
      if (conflict.rowCount) throw new GrcError('AUDIT_INDEPENDENCE_CONFLICT', 'Existe un conflicto de independencia pendiente.', 409);
      const workpaper = (await client.query(
        `INSERT INTO grc_audit_workpapers (
           tenant_id, audit_id, code, objective, procedure_text, population, sample_summary,
           result, conclusion, status, prepared_by, content_hash
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12) RETURNING *`,
        [tenantId, body.audit_id, body.code, body.objective, body.procedure_text, body.population || null,
          body.sample_summary || null, body.result || null, body.conclusion || null,
          body.status === 'submitted' ? 'submitted' : 'draft', userId, body.content_hash || null]
      )).rows[0];
      await audit(client, { tenantId, userId, action: 'audit.workpaper.created', tableName: 'grc_audit_workpapers', recordId: workpaper.id, newData: workpaper, metadata: { correlation_id: correlationId } });
      return workpaper;
    });
  }

  async function enqueueAutomation({ tenantId, userId, body, requestId }) {
    await assertModuleEnabled(tenantId);
    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (!idempotencyKey) throw new GrcError('GRC_IDEMPOTENCY_KEY_REQUIRED', 'Se requiere idempotency_key.', 422);
    const existing = await pool.query(
      `SELECT * FROM grc_workflow_automation_runs WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
      [tenantId, idempotencyKey]
    );
    if (existing.rows[0]) return { run: existing.rows[0], reused: true };
    const job = await asyncJobs.createJob({ tenant_id: tenantId, user_id: userId, job_type: body.job_type || 'grc_workflow_automation', source_module: 'grc_phase1_core', payload: body.payload || {}, request_id: requestId });
    const run = (await pool.query(
      `INSERT INTO grc_workflow_automation_runs (tenant_id, rule_id, instance_id, idempotency_key, job_id, run_after)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,COALESCE($6::timestamptz,now())) RETURNING *`,
      [tenantId, body.rule_id, body.instance_id, idempotencyKey, job.id, body.run_after || null]
    )).rows[0];
    return { run, job, reused: false };
  }

  async function delegateApproval({ tenantId, userId, role, approvalId, body, correlationId }) {
    const action = body.action === 'substitute' ? 'substituted' : 'delegated';
    const targetId = assertUuid(body.target_user_id, 'WORKFLOW_APPROVAL_TARGET_REQUIRED');
    return withTransaction(async (client) => {
      const current = (await client.query(
        `SELECT * FROM grc_workflow_approvals
         WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(approvalId)]
      )).rows[0];
      if (!current) throw new GrcError('WORKFLOW_APPROVAL_NOT_FOUND', 'Aprobación no encontrada.', 404);
      const owns = [current.reviewer_id, current.assigned_reviewer_id, current.delegated_to].filter(Boolean).map(String).includes(String(userId));
      if (!owns && !PLATFORM_ROLES.has(role)) throw new GrcError('WORKFLOW_APPROVAL_DELEGATION_DENIED', 'No puede delegar esta aprobación.', 403);
      if (current.decision !== 'pending') throw new GrcError('WORKFLOW_APPROVAL_ALREADY_DECIDED', 'La aprobación ya fue resuelta.', 409);
      const updated = (await client.query(
        `UPDATE grc_workflow_approvals SET decision = $3, acted_by = $4::uuid,
           delegated_to = CASE WHEN $3 = 'delegated' THEN $5::uuid ELSE delegated_to END,
           substitute_for = CASE WHEN $3 = 'substituted' THEN reviewer_id ELSE substitute_for END,
           comment = $6, decided_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, approvalId, action, userId, targetId, body.comment || null]
      )).rows[0];
      const replacement = (await client.query(
        `INSERT INTO grc_workflow_approvals (
           tenant_id, instance_id, transition_id, sequence_no, reviewer_role, reviewer_id,
           assigned_reviewer_id, substitute_for, decision, expires_at, metadata
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$6::uuid,$7::uuid,'pending',$8,$9::jsonb)
         ON CONFLICT (tenant_id, instance_id, transition_id, sequence_no, reviewer_id)
         DO UPDATE SET assigned_reviewer_id = EXCLUDED.assigned_reviewer_id,
           decision = 'pending', expires_at = EXCLUDED.expires_at, metadata = EXCLUDED.metadata
         RETURNING *`,
        [tenantId, current.instance_id, current.transition_id, current.sequence_no, current.reviewer_role,
          targetId, action === 'substituted' ? current.reviewer_id : null, current.expires_at,
          json({ delegated_from: current.id, correlation_id: correlationId })]
      )).rows[0];
      await audit(client, { tenantId, userId, action: `workflow.approval.${action}`, tableName: 'grc_workflow_approvals', recordId: current.id, oldData: current, newData: updated, metadata: { correlation_id: correlationId, replacement_id: replacement.id } });
      observe('approval_delegation', { tenantId, correlationId });
      return { approval: updated, replacement };
    });
  }

  async function addWorkflowContext({ tenantId, userId, instanceId, body, correlationId }) {
    if (!String(body.comment || '').trim() && !body.evidence_id && !body.document_id) {
      throw new GrcError('WORKFLOW_CONTEXT_REQUIRED', 'Se requiere comentario o evidencia.', 422);
    }
    return withTransaction(async (client) => {
      const instance = (await client.query(
        'SELECT id FROM grc_workflow_instances WHERE tenant_id = $1::uuid AND id = $2::uuid',
        [tenantId, assertUuid(instanceId)]
      )).rows[0];
      if (!instance) throw new GrcError('WORKFLOW_INSTANCE_NOT_FOUND', 'Instancia no encontrada.', 404);
      let comment = null;
      let attachment = null;
      if (String(body.comment || '').trim()) {
        comment = (await client.query(
          `INSERT INTO grc_workflow_comments (tenant_id, instance_id, author_id, comment)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4) RETURNING *`,
          [tenantId, instanceId, userId, body.comment.trim()]
        )).rows[0];
      }
      if (body.evidence_id || body.document_id) {
        attachment = (await client.query(
          `INSERT INTO grc_workflow_attachments (tenant_id, instance_id, evidence_id, document_id, attached_by, metadata)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::jsonb) RETURNING *`,
          [tenantId, instanceId, body.evidence_id || null, body.document_id || null, userId, json(body.metadata || {})]
        )).rows[0];
      }
      await audit(client, { tenantId, userId, action: 'workflow.context.added', tableName: 'grc_workflow_instances', recordId: instanceId, newData: { comment_id: comment?.id, attachment_id: attachment?.id }, metadata: { correlation_id: correlationId } });
      return { comment, attachment };
    });
  }

  async function createEscalationPolicy({ tenantId, userId, body, correlationId }) {
    if (!body.code || !body.entity_type) throw new GrcError('GRC_ESCALATION_POLICY_INVALID', 'Código y entidad son obligatorios.', 422);
    const policy = (await pool.query(
      `INSERT INTO grc_escalation_policies (
         tenant_id, code, entity_type, criticality, sla_hours, prior_notice_hours,
         first_escalation_hours, second_escalation_hours, responsible_id, supervisor_id,
         role_keys, recipient_config, created_by
       ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$10::uuid,$11::jsonb,$12::jsonb,$13::uuid)
       ON CONFLICT (tenant_id, code) DO UPDATE SET entity_type = EXCLUDED.entity_type,
         criticality = EXCLUDED.criticality, sla_hours = EXCLUDED.sla_hours,
         prior_notice_hours = EXCLUDED.prior_notice_hours,
         first_escalation_hours = EXCLUDED.first_escalation_hours,
         second_escalation_hours = EXCLUDED.second_escalation_hours,
         responsible_id = EXCLUDED.responsible_id, supervisor_id = EXCLUDED.supervisor_id,
         role_keys = EXCLUDED.role_keys, recipient_config = EXCLUDED.recipient_config,
         is_active = TRUE, updated_at = now() RETURNING *`,
      [tenantId, body.code, body.entity_type, body.criticality || null, body.sla_hours || null,
        body.prior_notice_hours ?? 24, body.first_escalation_hours ?? 0, body.second_escalation_hours ?? 24,
        body.responsible_id || null, body.supervisor_id || null, json(Array.isArray(body.role_keys) ? body.role_keys : []),
        json(body.recipient_config && typeof body.recipient_config === 'object' ? body.recipient_config : {}), userId]
    )).rows[0];
    observe('escalation_policy', { tenantId, correlationId });
    return policy;
  }

  async function listEscalationPolicies(tenantId) {
    return (await pool.query(
      'SELECT * FROM grc_escalation_policies WHERE tenant_id = $1::uuid ORDER BY code',
      [tenantId]
    )).rows;
  }

  const ESCALATION_SOURCES = Object.freeze({
    workflow: `SELECT id, entity_type, entity_id, due_at, created_at, status, context,
      COALESCE((context->>'criticality'), '') AS criticality,
      COALESCE((context->>'owner_id')::uuid, created_by) AS owner_id
      FROM grc_workflow_instances WHERE tenant_id = $1::uuid`,
    evidence: `SELECT id, 'evidence_request' AS entity_type, id AS entity_id, due_at, created_at, status, '{}'::jsonb AS context,
      '' AS criticality, owner_id FROM grc_evidence_requests WHERE tenant_id = $1::uuid`,
    action: `SELECT id, 'action' AS entity_type, id AS entity_id, due_date::timestamptz AS due_at, created_at, status,
      '{}'::jsonb AS context, COALESCE(priority,'') AS criticality, NULL::uuid AS owner_id
      FROM action_plans WHERE tenant_id = $1::uuid`,
    audit_followup: `SELECT id, 'audit_followup' AS entity_type, id AS entity_id, due_at, created_at, status,
      '{}'::jsonb AS context, '' AS criticality, owner_id FROM grc_audit_followups WHERE tenant_id = $1::uuid`,
  });

  async function processEscalations(client, tenantId, correlationId) {
    const policies = (await client.query(
      'SELECT * FROM grc_escalation_policies WHERE tenant_id = $1::uuid AND is_active = TRUE',
      [tenantId]
    )).rows;
    let created = 0;
    for (const policy of policies) {
      const sourceKey = policy.entity_type === 'evidence_request' ? 'evidence'
        : policy.entity_type === 'action' ? 'action'
          : policy.entity_type === 'audit_followup' ? 'audit_followup' : 'workflow';
      const entities = (await client.query(ESCALATION_SOURCES[sourceKey], [tenantId])).rows;
      for (const entity of entities) {
        if (sourceKey === 'workflow' && entity.entity_type !== policy.entity_type) continue;
        if (policy.criticality && String(entity.criticality) !== String(policy.criticality)) continue;
        const recipients = [entity.owner_id, policy.responsible_id, policy.supervisor_id, ...(Array.isArray(policy.role_keys) ? policy.role_keys : [])].filter(Boolean);
        const effectiveDueAt = entity.due_at || (policy.sla_hours && entity.created_at
          ? new Date(new Date(entity.created_at).getTime() + (Number(policy.sla_hours) * 3_600_000)).toISOString()
          : null);
        for (const stage of escalationStages({ dueAt: effectiveDueAt, policy, status: entity.status })) {
          const result = await client.query(
            `INSERT INTO grc_escalation_events (
               tenant_id, policy_id, entity_type, entity_id, stage, due_at, recipients, correlation_id, metadata
             ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7::jsonb,$8,$9::jsonb)
             ON CONFLICT (tenant_id, policy_id, entity_type, entity_id, stage) DO NOTHING RETURNING id`,
            [tenantId, policy.id, entity.entity_type, entity.entity_id, stage, effectiveDueAt,
              json(recipients), correlationId, json({ recipient_config: policy.recipient_config })]
          );
          created += result.rowCount;
        }
      }
    }
    observe('escalation', { tenantId, correlationId, status: 'success' });
    return { policies: policies.length, events_created: created };
  }

  async function runScheduler({ tenantId, userId, body, correlationId }) {
    const runType = String(body.run_type || 'phase1_recurring');
    const windowKey = String(body.window_key || schedulerWindow(new Date(), body.window_minutes || 5));
    const tasks = Array.isArray(body.tasks) && body.tasks.length
      ? body.tasks
      : ['evidence_requests', 'reminders_expirations', 'escalations', 'readiness_snapshots', 'audit_jobs', 'action_followup'];
    const allowedTasks = new Set(['evidence_requests', 'reminders_expirations', 'escalations', 'readiness_snapshots', 'audit_jobs', 'action_followup']);
    if (tasks.some(task => !allowedTasks.has(task))) throw new GrcError('GRC_SCHEDULER_TASK_INVALID', 'Job de scheduler inválido.', 422);
    const started = Date.now();
    let run;
    let taskResults = {};
    try {
      const transactionResult = await withTransaction(async (client) => {
        const lock = await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired', [`grc:${tenantId}:${runType}`]);
        if (lock.rows[0]?.acquired !== true) throw new GrcError('GRC_SCHEDULER_LOCKED', 'Ya existe una ejecución concurrente.', 409);
        const existing = (await client.query(
          `SELECT * FROM grc_scheduler_runs
           WHERE tenant_id = $1::uuid AND run_type = $2 AND window_key = $3 FOR UPDATE`,
          [tenantId, runType, windowKey]
        )).rows[0];
        if (existing?.status === 'completed') return { run: existing, reused: true, results: existing.task_results };
        if (existing && !body.retry) return { run: existing, reused: true, results: existing.task_results };
        if (existing?.next_retry_at && new Date(existing.next_retry_at) > new Date() && body.force !== true) {
          throw new GrcError('GRC_SCHEDULER_BACKOFF_ACTIVE', 'El retry aún está en período de backoff.', 409, { next_retry_at: existing.next_retry_at });
        }
        run = existing ? (await client.query(
          `UPDATE grc_scheduler_runs SET status = 'running', attempt_count = attempt_count + 1,
             correlation_id = $4, locked_by = $5, last_error_code = NULL, next_retry_at = NULL,
             started_at = now(), completed_at = NULL
           WHERE tenant_id = $1::uuid AND run_type = $2 AND window_key = $3 RETURNING *`,
          [tenantId, runType, windowKey, correlationId, body.worker_id || 'manual']
        )).rows[0] : (await client.query(
          `INSERT INTO grc_scheduler_runs (tenant_id, run_type, window_key, correlation_id, locked_by, created_by)
           VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid) RETURNING *`,
          [tenantId, runType, windowKey, correlationId, body.worker_id || 'manual', userId]
        )).rows[0];

        for (const task of tasks) {
          const savepoint = `grc_task_${task}`;
          await client.query(`SAVEPOINT ${savepoint}`);
          try {
            if (task === 'evidence_requests') {
              const schedules = (await client.query(
                `SELECT s.*, r.title, r.instructions, r.owner_id, r.reviewer_id, r.approver_id, r.valid_until
                 FROM grc_evidence_schedules s JOIN grc_evidence_requests r ON r.id = s.request_template_id AND r.tenant_id = s.tenant_id
                 WHERE s.tenant_id = $1::uuid AND s.is_active = TRUE AND s.next_run_at <= now()
                 ORDER BY s.next_run_at FOR UPDATE OF s`,
                [tenantId]
              )).rows;
              let created = 0;
              for (const schedule of schedules) {
                const key = occurrenceKey(schedule.id, schedule.next_run_at);
                const occurrence = await client.query(
                  `INSERT INTO grc_evidence_requests (
                     tenant_id, title, instructions, status, owner_id, reviewer_id, approver_id,
                     due_at, valid_until, schedule_id, occurrence_key, created_by
                   ) VALUES ($1::uuid,$2,$3,'requested',$4::uuid,$5::uuid,$6::uuid,$7,$8,$9::uuid,$10,$11::uuid)
                   ON CONFLICT (tenant_id, schedule_id, occurrence_key)
                   WHERE schedule_id IS NOT NULL AND occurrence_key IS NOT NULL
                   DO NOTHING RETURNING id`,
                  [tenantId, schedule.title, schedule.instructions, schedule.owner_id, schedule.reviewer_id,
                    schedule.approver_id, schedule.next_run_at, schedule.valid_until, schedule.id, key, userId]
                );
                created += occurrence.rowCount;
                const next = nextOccurrence({ frequency: schedule.frequency, intervalValue: schedule.interval_value, from: schedule.next_run_at });
                await client.query(
                  'UPDATE grc_evidence_schedules SET next_run_at = $3 WHERE tenant_id = $1::uuid AND id = $2::uuid',
                  [tenantId, schedule.id, next?.toISOString() || null]
                );
              }
              taskResults[task] = { status: 'completed', processed: schedules.length, created };
            }
            if (task === 'reminders_expirations') {
              const expiredRequests = await client.query(
                `UPDATE grc_evidence_requests SET status = 'expired', updated_at = now()
                 WHERE tenant_id = $1::uuid AND due_at < now()
                   AND status NOT IN ('approved','cancelled','superseded','expired')`, [tenantId]
              );
              const expiredApprovals = await client.query(
                `UPDATE grc_workflow_approvals SET decision = 'expired', decided_at = now()
                 WHERE tenant_id = $1::uuid AND decision = 'pending' AND expires_at < now()`, [tenantId]
              );
              taskResults[task] = { status: 'completed', requests_expired: expiredRequests.rowCount, approvals_expired: expiredApprovals.rowCount };
            }
            if (task === 'escalations') taskResults[task] = { status: 'completed', ...(await processEscalations(client, tenantId, correlationId)) };
            if (task === 'action_followup') {
              const result = await client.query(
                `UPDATE grc_audit_followups SET status = 'overdue', updated_at = now()
                 WHERE tenant_id = $1::uuid AND due_at < now() AND status IN ('open','in_progress')`, [tenantId]
              );
              taskResults[task] = { status: 'completed', marked_overdue: result.rowCount };
            }
            if (task === 'readiness_snapshots' || task === 'audit_jobs') {
              taskResults[task] = { status: 'queued' };
            }
            await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          } catch (error) {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            taskResults[task] = { status: 'failed', error_code: error.code || 'GRC_SCHEDULER_TASK_FAILED' };
          }
        }
        const hasFailures = Object.values(taskResults).some(result => result.status === 'failed');
        const updated = (await client.query(
          `UPDATE grc_scheduler_runs SET status = $4, task_results = $5::jsonb,
             last_error_code = $6, next_retry_at = CASE WHEN $4 = 'partial_failure'
               THEN now() + make_interval(secs => $7::int) ELSE NULL END,
             completed_at = now()
           WHERE tenant_id = $1::uuid AND run_type = $2 AND window_key = $3 RETURNING *`,
          [tenantId, runType, windowKey, hasFailures ? 'partial_failure' : 'completed', json(taskResults),
            hasFailures ? 'GRC_SCHEDULER_PARTIAL_FAILURE' : null, retryBackoffSeconds(run.attempt_count)]
        )).rows[0];
        await audit(client, { tenantId, userId, action: 'grc.scheduler.executed', tableName: 'grc_scheduler_runs', recordId: updated.id, newData: updated, metadata: { correlation_id: correlationId } });
        return { run: updated, reused: false, results: taskResults };
      });
      if (!transactionResult.reused && transactionResult.results.readiness_snapshots?.status === 'queued') {
        try {
          const readiness = await generateReadinessSnapshot({ tenantId, userId, correlationId });
          transactionResult.results.readiness_snapshots = { status: 'completed', snapshot_id: readiness.id };
        } catch (error) {
          transactionResult.results.readiness_snapshots = { status: 'failed', error_code: error.code || 'READINESS_SNAPSHOT_FAILED' };
        }
      }
      if (!transactionResult.reused && transactionResult.results.audit_jobs?.status === 'queued') {
        try {
          const job = await asyncJobs.createJob({ tenant_id: tenantId, user_id: userId, job_type: 'grc_audit_recurring', source_module: 'grc_phase1_core', payload: { window_key: windowKey }, request_id: correlationId });
          transactionResult.results.audit_jobs = { status: 'completed', job_id: job.id };
        } catch (error) {
          transactionResult.results.audit_jobs = { status: 'failed', error_code: error.code || 'AUDIT_JOB_QUEUE_FAILED' };
        }
      }
      const externalFailure = Object.values(transactionResult.results).some(result => result.status === 'failed');
      await pool.query(
        `UPDATE grc_scheduler_runs SET task_results = $4::jsonb,
           status = CASE WHEN $5 THEN 'partial_failure' ELSE status END,
           last_error_code = CASE WHEN $5 THEN 'GRC_SCHEDULER_PARTIAL_FAILURE' ELSE last_error_code END
         WHERE tenant_id = $1::uuid AND run_type = $2 AND window_key = $3`,
        [tenantId, runType, windowKey, json(transactionResult.results), externalFailure]
      );
      if (externalFailure) transactionResult.run.status = 'partial_failure';
      observe('scheduler', { tenantId, correlationId, status: transactionResult.reused ? 'reused' : transactionResult.run.status, durationMs: Date.now() - started, attempt: transactionResult.run.attempt_count });
      return transactionResult;
    } catch (error) {
      observe('scheduler', { tenantId, correlationId, status: 'failed', durationMs: Date.now() - started, errorCode: error.code });
      throw error;
    }
  }

  async function reviewWorkpaper({ tenantId, userId, workpaperId, body, correlationId }) {
    const decisions = new Set(['assigned', 'approved', 'returned', 'changes_requested', 'reopened', 'accepted']);
    if (!decisions.has(body.decision)) throw new GrcError('AUDIT_REVIEW_DECISION_INVALID', 'Decisión supervisora inválida.', 422);
    if (['returned', 'changes_requested', 'reopened'].includes(body.decision) && !String(body.observations || '').trim()) {
      throw new GrcError('AUDIT_REVIEW_OBSERVATION_REQUIRED', 'La devolución o reapertura requiere observaciones.', 422);
    }
    return withTransaction(async (client) => {
      const workpaper = (await client.query(
        `SELECT * FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND id = $2::uuid FOR UPDATE`,
        [tenantId, assertUuid(workpaperId)]
      )).rows[0];
      if (!workpaper) throw new GrcError('AUDIT_WORKPAPER_NOT_FOUND', 'Papel de trabajo no encontrado.', 404);
      if (String(workpaper.prepared_by) === String(userId)) throw new GrcError('AUDIT_REVIEW_INDEPENDENCE_REQUIRED', 'El preparador no puede revisar su propio papel.', 409);
      const conflict = await client.query(
        `SELECT 1 FROM grc_audit_team_members tm
         JOIN grc_audit_conflicts c ON c.team_member_id = tm.id AND c.tenant_id = tm.tenant_id
         WHERE tm.tenant_id = $1::uuid AND tm.audit_id = $2::uuid AND tm.user_id = $3::uuid
           AND c.status = 'open' LIMIT 1`, [tenantId, workpaper.audit_id, userId]
      );
      if (conflict.rowCount) throw new GrcError('AUDIT_REVIEW_CONFLICT', 'Existe un conflicto de independencia abierto.', 409);
      const previous = (await client.query(
        `SELECT * FROM grc_audit_supervisor_reviews
         WHERE tenant_id = $1::uuid AND workpaper_id = $2::uuid ORDER BY version DESC LIMIT 1`,
        [tenantId, workpaperId]
      )).rows[0];
      const confirmationHash = require('crypto').createHash('sha256').update(json({
        workpaper_id: workpaperId, content_hash: workpaper.content_hash, decision: body.decision,
        observations: body.observations || null, previous: previous?.confirmation_hash || null,
      })).digest('hex');
      const review = (await client.query(
        `INSERT INTO grc_audit_supervisor_reviews (
           tenant_id, audit_id, workpaper_id, reviewer_id, decision, observations, version,
           assigned_to, evidence_id, previous_review_id, confirmation_hash
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11) RETURNING *`,
        [tenantId, workpaper.audit_id, workpaperId, userId, body.decision, body.observations || null,
          Number(previous?.version || 0) + 1, body.assigned_to || userId, body.evidence_id || null,
          previous?.id || null, confirmationHash]
      )).rows[0];
      const status = body.decision === 'accepted' ? 'locked'
        : body.decision === 'approved' ? 'approved'
          : ['returned', 'changes_requested'].includes(body.decision) ? 'changes_requested'
            : body.decision === 'reopened' ? 'submitted' : workpaper.status;
      const updated = (await client.query(
        `UPDATE grc_audit_workpapers SET status = $3, reviewed_by = $4::uuid, reviewed_at = now(),
           version = CASE WHEN $3 = 'submitted' THEN version + 1 ELSE version END, updated_at = now()
         WHERE tenant_id = $1::uuid AND id = $2::uuid RETURNING *`,
        [tenantId, workpaperId, status, userId]
      )).rows[0];
      await audit(client, { tenantId, userId, action: `audit.supervisor.${body.decision}`, tableName: 'grc_audit_workpapers', recordId: workpaperId, oldData: workpaper, newData: updated, metadata: { correlation_id: correlationId, review_id: review.id, review_version: review.version } });
      observe('audit_review', { tenantId, correlationId, entityType: 'audit', entityId: workpaper.audit_id });
      return { review, workpaper: updated };
    });
  }

  async function getAuditCloseReadiness(tenantId, auditId) {
    const result = (await pool.query(
      `SELECT
         COUNT(*)::int AS workpaper_count,
         COUNT(*) FILTER (WHERE status NOT IN ('approved','locked'))::int AS unapproved_workpapers,
         (SELECT COUNT(*)::int FROM grc_audit_conflicts c
          JOIN grc_audit_team_members tm ON tm.id = c.team_member_id AND tm.tenant_id = c.tenant_id
          WHERE c.tenant_id = $1::uuid AND tm.audit_id = $2::uuid AND c.status = 'open') AS open_conflicts,
         COUNT(*) FILTER (WHERE status = 'changes_requested')::int AS returned_workpapers,
         (SELECT COUNT(*)::int FROM grc_audit_programs
          WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS program_count,
         (SELECT COUNT(*)::int FROM grc_audit_team_members
          WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS team_count,
         (SELECT COUNT(*)::int FROM grc_audit_team_members
          WHERE tenant_id = $1::uuid AND audit_id = $2::uuid
            AND independence_status IN ('pending','conflict')) AS unresolved_independence,
         (SELECT COUNT(*)::int FROM grc_audit_evidence_links
          WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS evidence_link_count
       FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND audit_id = $2::uuid`,
      [tenantId, assertUuid(auditId)]
    )).rows[0];
    const blockers = [];
    if (!result.program_count) blockers.push('missing_audit_program');
    if (!result.team_count) blockers.push('missing_audit_team');
    if (result.unresolved_independence) blockers.push('unresolved_independence');
    if (!result.workpaper_count) blockers.push('missing_required_workpapers');
    if (!result.evidence_link_count) blockers.push('missing_required_evidence');
    if (result.unapproved_workpapers) blockers.push('unapproved_workpapers');
    if (result.open_conflicts) blockers.push('open_independence_conflicts');
    if (result.returned_workpapers) blockers.push('returned_workpapers');
    return { can_close: blockers.length === 0, blockers, counts: result };
  }

  async function listWorkpaperReviews(tenantId, workpaperId) {
    const exists = await pool.query(
      'SELECT 1 FROM grc_audit_workpapers WHERE tenant_id = $1::uuid AND id = $2::uuid',
      [tenantId, assertUuid(workpaperId)]
    );
    if (!exists.rowCount) throw new GrcError('AUDIT_WORKPAPER_NOT_FOUND', 'Papel de trabajo no encontrado.', 404);
    return (await pool.query(
      `SELECT id, audit_id, workpaper_id, reviewer_id, decision, observations, version,
              assigned_to, evidence_id, previous_review_id, confirmation_hash, created_at
       FROM grc_audit_supervisor_reviews
       WHERE tenant_id = $1::uuid AND workpaper_id = $2::uuid ORDER BY version, created_at`,
      [tenantId, workpaperId]
    )).rows;
  }

  const EXPORT_QUERIES = Object.freeze({
    audit: `SELECT id, iso, status, start_date, end_date, requester_name, auditor_type, auditor_name, created_at AS recorded_at FROM audits WHERE tenant_id = $1::uuid`,
    evidence: `SELECT id, description, status, validated, expires_at, evidence_type, created_at AS recorded_at FROM evidences WHERE tenant_id = $1::uuid`,
    readiness: `SELECT id, NULL::text AS status, score, formula_version, input_hash, generated_at AS recorded_at, period_start, period_end FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid`,
    frameworks: `SELECT f.id, f.code, f.name, f.publisher, f.content_classification, f.is_active AS status, f.created_at AS recorded_at FROM grc_frameworks f WHERE f.tenant_id = $1::uuid OR f.tenant_id IS NULL`,
    mappings: `SELECT id, requirement_id, tenant_control_id, catalog_control_id, mapping_type, coverage_level, justification, source_type, status, created_at AS recorded_at FROM grc_requirement_control_mappings WHERE tenant_id = $1::uuid`,
    findings: `SELECT id, title, status, severity, source_type, due_date, created_at AS recorded_at FROM findings WHERE tenant_id = $1::uuid`,
    actions: `SELECT id, title, status, priority, due_date, approval_status, created_at AS recorded_at FROM action_plans WHERE tenant_id = $1::uuid`,
  });

  async function generateExport({ tenantId, userId, domain, format, filters, correlationId }) {
    if (!EXPORT_QUERIES[domain]) throw new GrcError('GRC_EXPORT_DOMAIN_INVALID', 'Dominio de exportación inválido.', 422);
    if (!FORMATS.has(format)) throw new GrcError('GRC_EXPORT_FORMAT_INVALID', 'Formato de exportación inválido.', 422);
    const status = String(filters.status || '').trim() || null;
    const from = filters.from || null;
    const to = filters.to || null;
    const id = filters.id ? assertUuid(filters.id) : null;
    const rows = (await pool.query(
      `SELECT * FROM (${EXPORT_QUERIES[domain]}) scoped
       WHERE ($2::text IS NULL OR scoped.status::text = $2)
         AND ($3::timestamptz IS NULL OR scoped.recorded_at >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR scoped.recorded_at < $4::timestamptz + interval '1 day')
         AND ($5::uuid IS NULL OR scoped.id = $5::uuid)
       ORDER BY scoped.recorded_at DESC, scoped.id LIMIT 10000`,
      [tenantId, status, from, to, id]
    )).rows;
    let artifact;
    try {
      artifact = await buildGrcExport({ domain, format, rows, tenantId, generatedAt: new Date().toISOString(), version: 1 });
    } catch (error) {
      if (error.message === 'GRC_EXPORT_EMPTY') throw new GrcError('GRC_EXPORT_EMPTY', 'No existen datos para los filtros indicados.', 422);
      throw error;
    }
    return withTransaction(async (client) => {
      const record = (await client.query(
        `INSERT INTO grc_exports (
           tenant_id, domain, format, filters, source_snapshot, source_hash, content_hash,
           file_name, mime_type, file_size_bytes, file_content, version, correlation_id, generated_by, generated_at
         ) VALUES ($1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14::uuid,$15) RETURNING *`,
        [tenantId, domain, format, json(filters || {}), json(artifact.sourceSnapshot), artifact.sourceHash,
          artifact.contentHash, artifact.fileName, artifact.mimeType, artifact.buffer.length, artifact.buffer,
          artifact.version, correlationId, userId, artifact.generatedAt]
      )).rows[0];
      if (domain === 'audit' && id && ['pdf', 'docx', 'xlsx'].includes(format)) {
        const version = Number((await client.query(
          `SELECT COALESCE(MAX(version),0)::int + 1 AS version
           FROM grc_audit_reports WHERE tenant_id = $1::uuid AND audit_id = $2::uuid AND report_format = $3`,
          [tenantId, id, format]
        )).rows[0].version);
        const report = (await client.query(
          `INSERT INTO grc_audit_reports (
             tenant_id, audit_id, version, status, report_format, file_url,
             content_hash, source_snapshot
           ) VALUES ($1::uuid,$2::uuid,$3,'draft',$4,$5,$6,$7::jsonb) RETURNING *`,
          [tenantId, id, version, format, `/api/grc/exports/${record.id}/download`,
            artifact.contentHash, json(artifact.sourceSnapshot)]
        )).rows[0];
        await audit(client, { tenantId, userId, action: 'audit.report.generated', tableName: 'grc_audit_reports', recordId: report.id, newData: report, metadata: { correlation_id: correlationId, export_id: record.id } });
      }
      await audit(client, { tenantId, userId, action: 'grc.export.generated', tableName: 'grc_exports', recordId: record.id, newData: { ...record, file_content: undefined }, metadata: { correlation_id: correlationId } });
      observe('export', { tenantId, correlationId, entityType: domain });
      return { record, buffer: artifact.buffer };
    });
  }

  async function getExport(tenantId, exportId) {
    const record = (await pool.query(
      'SELECT * FROM grc_exports WHERE tenant_id = $1::uuid AND id = $2::uuid',
      [tenantId, assertUuid(exportId)]
    )).rows[0];
    if (!record) throw new GrcError('GRC_EXPORT_NOT_FOUND', 'Exportación no encontrada.', 404);
    return record;
  }

  async function getRuntimeAdapter({ tenantId, userId, role, entityType, entityId, correlationId }) {
    const adapter = require('./grcRuntimeAdapters').adapterFor(entityType);
    await assertPermission({ userId, role, permission: adapter.permission });
    const result = await readRuntimeEntity(pool, { tenantId, entityType, entityId: assertUuid(entityId) });
    if (!result) throw new GrcError('GRC_RUNTIME_ENTITY_NOT_FOUND', 'Entidad no encontrada.', 404);
    await pool.query(
      `INSERT INTO audit_event_log (table_name, record_id, tenant_id, action, changed_by, new_data, metadata)
       VALUES ('grc_runtime_adapter',$1::uuid,$2::uuid,'grc.runtime.adapter.read',$3::uuid,$4::jsonb,$5::jsonb)`,
      [entityId, tenantId, userId, json({ adapter: result.adapter, entity_type: entityType }), json({ correlation_id: correlationId })]
    );
    observe('runtime_adapter_read', { tenantId, correlationId, entityType, entityId });
    return result;
  }

  async function startRuntimeWorkflow({ tenantId, userId, role, entityType, entityId, body, correlationId }) {
    const adapter = require('./grcRuntimeAdapters').adapterFor(entityType);
    await assertPermission({ userId, role, permission: 'workflow.transition' });
    const entity = await readRuntimeEntity(pool, { tenantId, entityType, entityId: assertUuid(entityId) });
    if (!entity) throw new GrcError('GRC_RUNTIME_ENTITY_NOT_FOUND', 'Entidad no encontrada.', 404);
    const instance = await startWorkflow({ tenantId, userId, correlationId, body: {
      ...body, entity_type: entityType, entity_id: entityId,
      due_at: body.due_at || entity.entity.due_at || null,
      context: { ...(body.context || {}), adapter: adapter.domain },
    } });
    observe('runtime_adapter_start', { tenantId, correlationId, entityType, entityId });
    return instance;
  }

  function observations() {
    if (!observationService) {
      observationService = createGrcObservationService(pool, {
        GrcError,
        assertUuid,
        observe,
        withTransaction,
        audit,
        json,
      });
    }
    return observationService;
  }

  function gaps() {
    if (!gapService) {
      gapService = createGrcGapService(pool, {
        GrcError,
        assertUuid,
        observe,
        audit,
        json,
      });
    }
    return gapService;
  }

  function impactGraph() {
    if (!impactGraphService) {
      impactGraphService = createImpactGraphService(pool, {
        GrcError,
        assertUuid,
      });
    }
    return impactGraphService;
  }

  function priorityEngine() {
    if (!priorityEngineService) {
      priorityEngineService = createPriorityEngineService(pool, {
        GrcError,
        assertUuid,
        impactGraph: impactGraph(),
      });
    }
    return priorityEngineService;
  }

  async function listObservations({ tenantId, filters }) {
    return observations().listObservations({ tenantId, filters });
  }

  async function getObservation({ tenantId, observationId }) {
    return observations().getObservation(tenantId, observationId);
  }

  async function createObservation({ tenantId, userId, body, correlationId }) {
    return observations().createObservation({ tenantId, userId, body, correlationId });
  }

  async function updateObservation({ tenantId, userId, observationId, body, correlationId }) {
    return observations().updateObservation({ tenantId, userId, observationId, body, correlationId });
  }

  async function transitionObservation({ tenantId, userId, observationId, body, correlationId }) {
    return observations().transitionObservation({ tenantId, userId, observationId, body, correlationId });
  }

  async function linkObservation({ tenantId, userId, observationId, body, correlationId }) {
    return observations().linkObservation({ tenantId, userId, observationId, body, correlationId });
  }

  async function listGaps({ tenantId, filters }) {
    return gaps().listGaps({ tenantId, filters });
  }

  async function getGap({ tenantId, gapId }) {
    return gaps().getGap(tenantId, gapId);
  }

  async function evaluateGapFromObservation({ tenantId, userId, body, correlationId }) {
    return gaps().evaluateObservation({
      tenantId,
      userId,
      observationId: body.observation_id,
      ruleCode: body.rule_code,
      ruleVersion: body.rule_version,
      correlationId: body.correlation_id || correlationId,
    });
  }

  async function transitionGap({ tenantId, userId, gapId, body, correlationId }) {
    return gaps().transitionGap({ tenantId, userId, gapId, body, correlationId });
  }

  async function listPriorities({ tenantId, filters }) {
    return priorityEngine().listPriorities({ tenantId, filters });
  }

  async function getPriority({ tenantId, entityType, entityId, filters }) {
    return priorityEngine().getPriority({ tenantId, entityType, entityId, filters });
  }

  async function getImpactGraphRelationships({ tenantId, entityType, entityId, filters }) {
    return impactGraph().getNodeRelationships({
      tenantId,
      entityType,
      entityId,
      direction: filters?.direction || 'both',
      limit: filters?.limit,
    });
  }

  async function getImpactGraphNeighborhood({ tenantId, entityType, entityId, filters }) {
    return impactGraph().getNeighborhood({
      tenantId,
      entityType,
      entityId,
      depth: filters?.depth,
      maxNodes: filters?.max_nodes,
      maxEdges: filters?.max_edges,
    });
  }

  return {
    GrcError,
    assertModuleEnabled,
    assertPermission,
    assignAuditTeamMember,
    addWorkflowContext,
    archiveWorkflow,
    calculateEvidenceQuality,
    bootstrapTenant: bootstrapService.initialize,
    createAuditPlan,
    createAuditProgram,
    createAuditSample,
    createAuditFollowup,
    createAuditInterview,
    createAuditUniverseEntity,
    createEscalationPolicy,
    createEvidenceRequest,
    createEvidenceVersion,
    createMapping,
    createObservation,
    createWorkflowDefinition,
    createWorkpaper,
    closeAudit,
    delegateApproval,
    enqueueAutomation,
    executeTransition,
    generateReadinessSnapshot,
    generateExport,
    evaluateGapFromObservation,
    getAuditWorkspace,
    getAuditOperations,
    getBootstrapStatus: bootstrapService.status,
    getAuditCloseReadiness,
    getExport,
    getEvidenceRequest,
    getGap,
    getImpactGraphNeighborhood,
    getImpactGraphRelationships,
    getMeta,
    getObservation,
    getPriority,
    getReadiness,
    getSummary,
    getWorkflowInstance,
    getWorkflowDefinition,
    getRuntimeAdapter,
    listGaps,
    listObservations,
    listPriorities,
    listEvidenceRequests,
    listEscalationPolicies,
    listFrameworkRequirements,
    listFrameworks,
    listMappings,
    listWorkpaperReviews,
    listWorkflowDefinitions,
    linkAuditEvidence,
    linkObservation,
    publishWorkflow,
    linkEvidence,
    reviewWorkpaper,
    reviewEvidence,
    reviewMapping,
    recordAuditConflict,
    resolveAuditConflict,
    validateBootstrap: bootstrapService.validate,
    runScheduler,
    saveWorkflowDraft,
    startRuntimeWorkflow,
    startWorkflow,
    submitEvidence,
    transitionGap,
    transitionObservation,
    updateObservation,
    validateWorkflow,
    observabilitySnapshot,
  };
}

module.exports = { GrcError, assertUuid, createGrcService };
