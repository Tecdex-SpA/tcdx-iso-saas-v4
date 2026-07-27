const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  RESOURCE_KEYS, appendManifestResource, createManifest, readManifest, validateManifest,
} = require('./phase2-qa-manifest');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-manifest-'));
const file = path.join(directory, 'manifest.json');
const tenantId = '82000000-0000-4000-8000-000000000001';
const id = '82000000-0000-4000-8000-000000000101';
const manifest = createManifest({ tenantId, runId: 'contract-test', file });
assert.strictEqual(manifest.prefix, 'PHASE2_QA_contract-test');
assert.deepStrictEqual(Object.keys(manifest.resources), [...RESOURCE_KEYS]);
appendManifestResource(file, tenantId, 'incident_ids', id);
appendManifestResource(file, tenantId, 'incident_ids', id);
assert.deepStrictEqual(readManifest(file, tenantId).resources.incident_ids, [id]);
assert.throws(() => validateManifest({ ...manifest, prefix: 'unsafe' }, tenantId), /prefix/);
assert.throws(() => appendManifestResource(file, tenantId, 'unknown_ids', id), /Unsupported/);
fs.rmSync(directory, { recursive: true, force: true });
process.stdout.write('Phase 2 QA manifest safety contracts: OK\n');
