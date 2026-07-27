const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('../../backend/node_modules/pg');
const { runCleanup } = require('./cleanup-phase1-qa');
const { createManifest, appendManifestResource, readManifest } = require('./phase1-qa-manifest');

const tenantId = '70000000-0000-4000-8000-000000000751';
const userId = '70000000-0000-4000-8000-000000000752';
const workflowId = '70000000-0000-4000-8000-000000000753';
const versionId = '70000000-0000-4000-8000-000000000754';
const stateId = '70000000-0000-4000-8000-000000000755';
const requestId = '70000000-0000-4000-8000-000000000756';
const bootstrapId = '70000000-0000-4000-8000-000000000757';
const runId = 'cleanup-integration';

async function main() {
  const pool = new Pool();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-cleanup-integration-'));
  const manifestPath = path.join(directory, 'manifest.json');
  try {
    await pool.query('INSERT INTO tenants (id, name) VALUES ($1::uuid, $2)', [tenantId, 'Phase 1 cleanup integration']);
    await pool.query('INSERT INTO users (id, tenant_id, email) VALUES ($1::uuid, $2::uuid, $3)', [userId, tenantId, 'phase1-cleanup@test.invalid']);
    await pool.query(
      `INSERT INTO grc_workflow_definitions (id, tenant_id, code, name, entity_type, status, created_by)
       VALUES ($1::uuid, $2::uuid, 'phase1r_qa_cleanup_integration', 'QA cleanup', 'audit', 'active', $3::uuid)`,
      [workflowId, tenantId, userId],
    );
    await pool.query(
      `INSERT INTO grc_workflow_versions
       (id, tenant_id, definition_id, version, status, published_by, published_at, created_by)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'published', $4::uuid, now(), $4::uuid)`,
      [versionId, tenantId, workflowId, userId],
    );
    await pool.query('UPDATE grc_workflow_definitions SET active_version_id = $1::uuid WHERE id = $2::uuid', [versionId, workflowId]);
    await pool.query(
      `INSERT INTO grc_workflow_states (id, tenant_id, version_id, code, name, state_type)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'initial', 'Inicial', 'initial')`,
      [stateId, tenantId, versionId],
    );
    await pool.query(
      `INSERT INTO grc_evidence_requests (id, tenant_id, title, status, created_by)
       VALUES ($1::uuid, $2::uuid, 'PHASE1R_QA_cleanup-integration', 'requested', $3::uuid)`,
      [requestId, tenantId, userId],
    );
    await pool.query(
      `INSERT INTO grc_bootstrap_runs
       (id, tenant_id, idempotency_key, status, response, requested_by)
       VALUES ($1::uuid, $2::uuid, $3, 'completed', '{}'::jsonb, $4::uuid)`,
      [bootstrapId, tenantId, `phase1-${runId}`, userId],
    );
    await pool.query(
      `INSERT INTO audit_event_log (table_name, record_id, tenant_id, action, changed_by)
       VALUES ('grc_bootstrap_runs', $1::uuid, $2::uuid, 'grc.bootstrap.completed', $3::uuid)`,
      [bootstrapId, tenantId, userId],
    );

    createManifest({ tenantId, runId, file: manifestPath });
    appendManifestResource(manifestPath, tenantId, 'workflow_definition_ids', workflowId);
    appendManifestResource(manifestPath, tenantId, 'evidence_request_ids', requestId);
    const manifest = readManifest(manifestPath, tenantId);

    const first = await runCleanup({ manifest, pool });
    assert.strictEqual(first.status, 'CLEANED');
    assert.strictEqual(first.deleted.workflow_definitions, 1);
    assert.strictEqual(first.deleted.workflow_versions, 1);
    assert.strictEqual(first.deleted.workflow_states, 1);
    assert.strictEqual(first.deleted.evidence_requests, 1);
    assert.strictEqual(first.deleted.bootstrap_runs, 1);
    assert.strictEqual(first.deleted.bootstrap_audit_events, 1);
    assert.deepStrictEqual(first.remaining, {
      workflow_definitions: 0,
      evidence_requests: 0,
      workflow_instances: 0,
      bootstrap_runs: 0,
    });
    assert.strictEqual(first.immutability_triggers, 'enabled');

    const second = await runCleanup({ manifest, pool });
    assert.strictEqual(second.status, 'ALREADY_CLEAN');
    assert.strictEqual(second.immutability_triggers, 'enabled');

    const triggerState = await pool.query(
      `SELECT COUNT(*)::int AS enabled
       FROM pg_trigger
       WHERE tgname IN (
         'trg_grc_published_workflow_immutable',
         'trg_grc_readiness_snapshot_immutable',
         'trg_grc_readiness_result_immutable'
       ) AND tgenabled = 'O'`,
    );
    assert.strictEqual(triggerState.rows[0].enabled, 3);
    process.stdout.write('Phase 1 QA cleanup PostgreSQL integration: OK cleaned=1 idempotent=1 triggers=3\n');
  } finally {
    await pool.query('DELETE FROM users WHERE id = $1::uuid', [userId]);
    await pool.query('DELETE FROM tenants WHERE id = $1::uuid', [tenantId]);
    await pool.end();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`Phase 1 QA cleanup PostgreSQL integration failed: ${error.message}`);
  process.exit(1);
});
