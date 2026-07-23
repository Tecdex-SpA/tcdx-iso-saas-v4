const ADAPTERS = Object.freeze({
  document: {
    domain: 'documents',
    permission: 'workflow.read',
    query: 'SELECT * FROM iso_generated_documents WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  evidence: {
    domain: 'evidence',
    permission: 'evidence.request.read',
    query: 'SELECT * FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  control: {
    domain: 'controls',
    permission: 'workflow.read',
    query: 'SELECT * FROM tenant_controls WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  risk: {
    domain: 'risks',
    permission: 'workflow.read',
    query: 'SELECT ar.*, a.tenant_id, a.name AS asset_name FROM asset_risks ar JOIN assets a ON a.id = ar.asset_id WHERE a.tenant_id = $1::uuid AND ar.id = $2::uuid',
  },
  audit: {
    domain: 'audits',
    permission: 'audit.plan.read',
    query: 'SELECT * FROM audits WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  finding: {
    domain: 'findings_nonconformities_actions',
    permission: 'workflow.read',
    query: 'SELECT * FROM findings WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  nonconformity: {
    domain: 'findings_nonconformities_actions',
    permission: 'workflow.read',
    query: 'SELECT * FROM tenant_nonconformities WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
  action: {
    domain: 'findings_nonconformities_actions',
    permission: 'workflow.read',
    query: 'SELECT * FROM action_plans WHERE tenant_id = $1::uuid AND id = $2::uuid',
  },
});

function adapterFor(entityType) {
  const adapter = ADAPTERS[String(entityType || '').toLowerCase()];
  if (!adapter) {
    const error = new Error('GRC_ADAPTER_ENTITY_TYPE_INVALID');
    error.code = 'GRC_ADAPTER_ENTITY_TYPE_INVALID';
    throw error;
  }
  return adapter;
}

async function readRuntimeEntity(pool, { tenantId, entityType, entityId }) {
  const adapter = adapterFor(entityType);
  const entity = (await pool.query(adapter.query, [tenantId, entityId])).rows[0];
  if (!entity) return null;
  const runtime = (await pool.query(
    `SELECT i.id, i.status, i.due_at, i.lock_version, s.code AS state_code, s.name AS state_name,
            d.code AS workflow_code, v.version AS workflow_version
     FROM grc_workflow_instances i
     JOIN grc_workflow_states s ON s.id = i.current_state_id
     JOIN grc_workflow_definitions d ON d.id = i.definition_id AND d.tenant_id = i.tenant_id
     JOIN grc_workflow_versions v ON v.id = i.version_id AND v.tenant_id = i.tenant_id
     WHERE i.tenant_id = $1::uuid AND i.entity_type = $2 AND i.entity_id = $3::uuid
     ORDER BY i.updated_at DESC LIMIT 1`,
    [tenantId, entityType, entityId]
  )).rows[0] || null;
  const evidence = (await pool.query(
    `SELECT COUNT(*)::int AS linked_count
     FROM grc_evidence_links
     WHERE tenant_id = $1::uuid AND entity_type = $2 AND entity_id = $3::uuid`,
    [tenantId, entityType, entityId]
  )).rows[0];
  const readiness = (await pool.query(
    `SELECT id, score, formula_version, generated_at
     FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid ORDER BY generated_at DESC LIMIT 1`,
    [tenantId]
  )).rows[0] || null;
  return {
    adapter: adapter.domain,
    entity,
    workflow: runtime,
    sla: { due_at: runtime?.due_at || entity.due_at || null },
    evidence: { linked_count: Number(evidence?.linked_count || 0) },
    readiness,
  };
}

module.exports = { ADAPTERS, adapterFor, readRuntimeEntity };
