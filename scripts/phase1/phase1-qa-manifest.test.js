const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  appendManifestResource,
  createManifest,
  readManifest,
  validateManifest,
} = require('./phase1-qa-manifest');

const tenantId = '70000000-0000-4000-8000-000000000701';
const workflowId = '70000000-0000-4000-8000-000000000702';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-manifest-'));
const file = path.join(directory, 'manifest.json');

try {
  const created = createManifest({ tenantId, runId: 'unit-test-1', file });
  assert.strictEqual(created.prefix, 'PHASE1R_QA_unit-test-1');
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);

  appendManifestResource(file, tenantId, 'workflow_definition_ids', workflowId);
  appendManifestResource(file, tenantId, 'workflow_definition_ids', workflowId);
  const updated = readManifest(file, tenantId);
  assert.deepStrictEqual(updated.resources.workflow_definition_ids, [workflowId]);
  assert.throws(() => appendManifestResource(file, tenantId, 'workflow_definition_ids', 'invalid'));
  assert.throws(() => readManifest(file, '70000000-0000-4000-8000-000000000799'));
  assert.throws(() => validateManifest({ ...updated, prefix: 'unsafe' }, tenantId));

  const cleanupSource = fs.readFileSync(path.join(__dirname, 'cleanup-phase1-qa.js'), 'utf8');
  for (const required of [
    'pg_advisory_xact_lock',
    'CREATE TEMP TABLE',
    'DISABLE TRIGGER trg_grc_published_workflow_immutable',
    'ENABLE TRIGGER trg_grc_published_workflow_immutable',
    "tgenabled !== 'O'",
    "await client.query('ROLLBACK')",
  ]) {
    assert(cleanupSource.includes(required), `cleanup safety contract missing: ${required}`);
  }
  process.stdout.write('Phase 1 QA manifest and cleanup safety contracts: OK\n');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
