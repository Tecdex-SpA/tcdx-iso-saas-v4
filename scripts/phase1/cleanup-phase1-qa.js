#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('../../backend/node_modules/pg');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (!['qa', 'test', 'local'].includes(required('PHASE1_QA_ENV').toLowerCase())) {
    throw new Error('PHASE1_QA_ENV must be qa, test or local');
  }
  if (required('PHASE1_QA_CONFIRM') !== 'CLEAN_PHASE1_QA') {
    throw new Error('PHASE1_QA_CONFIRM must equal CLEAN_PHASE1_QA');
  }
  const tenantId = required('PHASE1_TENANT_ID');
  const manifestPath = path.resolve(required('PHASE1_QA_MANIFEST'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.tenant_id !== tenantId || !String(manifest.prefix || '').startsWith('PHASE1R_QA_')) {
    throw new Error('Manifest tenant or synthetic prefix is invalid');
  }
  const workflowIds = Array.isArray(manifest.workflow_definition_ids) ? manifest.workflow_definition_ids : [];
  const evidenceIds = Array.isArray(manifest.evidence_request_ids) ? manifest.evidence_request_ids : [];
  const pool = new Pool({ connectionString: required('DATABASE_URL') });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const transitionRoles = await client.query(
      `DELETE FROM grc_workflow_transition_roles r
       USING grc_workflow_transitions t, grc_workflow_versions v, grc_workflow_definitions d
       WHERE r.transition_id = t.id
         AND t.version_id = v.id
         AND v.definition_id = d.id
         AND d.tenant_id = $1::uuid
         AND d.id = ANY($2::uuid[])
         AND d.code LIKE 'phase1r_qa_%'
         AND v.status = 'draft'`,
      [tenantId, workflowIds]
    );
    const transitions = await client.query(
      `DELETE FROM grc_workflow_transitions t
       USING grc_workflow_versions v, grc_workflow_definitions d
       WHERE t.version_id = v.id
         AND v.definition_id = d.id
         AND d.tenant_id = $1::uuid
         AND d.id = ANY($2::uuid[])
         AND d.code LIKE 'phase1r_qa_%'
         AND v.status = 'draft'`,
      [tenantId, workflowIds]
    );
    const states = await client.query(
      `DELETE FROM grc_workflow_states s
       USING grc_workflow_versions v, grc_workflow_definitions d
       WHERE s.version_id = v.id
         AND v.definition_id = d.id
         AND d.tenant_id = $1::uuid
         AND d.id = ANY($2::uuid[])
         AND d.code LIKE 'phase1r_qa_%'
         AND v.status = 'draft'`,
      [tenantId, workflowIds]
    );
    const versions = await client.query(
      `DELETE FROM grc_workflow_versions v
       USING grc_workflow_definitions d
       WHERE v.definition_id = d.id
         AND d.tenant_id = $1::uuid
         AND d.id = ANY($2::uuid[])
         AND d.code LIKE 'phase1r_qa_%'
         AND v.status = 'draft'`,
      [tenantId, workflowIds]
    );
    const workflows = await client.query(
      `DELETE FROM grc_workflow_definitions
       WHERE tenant_id = $1::uuid
         AND id = ANY($2::uuid[])
         AND code LIKE 'phase1r_qa_%'
         AND status = 'draft'`,
      [tenantId, workflowIds]
    );
    const evidence = await client.query(
      `DELETE FROM grc_evidence_requests
       WHERE tenant_id = $1::uuid AND id = ANY($2::uuid[]) AND title LIKE 'PHASE1R_QA_%'`,
      [tenantId, evidenceIds]
    );
    await client.query('COMMIT');
    process.stdout.write(`${JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      deleted: {
        workflow_transition_roles: transitionRoles.rowCount,
        workflow_transitions: transitions.rowCount,
        workflow_states: states.rowCount,
        workflow_versions: versions.rowCount,
        workflows: workflows.rowCount,
        evidence_requests: evidence.rowCount,
      },
    }, null, 2)}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Phase 1 QA cleanup failed: ${error.message}`);
  process.exit(1);
});
