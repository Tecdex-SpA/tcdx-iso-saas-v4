const fs = require('fs');
const path = require('path');

const MANIFEST_VERSION = 1;
const RESOURCE_KEYS = Object.freeze([
  'processing_activity_ids',
  'privacy_request_ids',
  'privacy_breach_ids',
  'incident_ids',
  'supplier_ids',
  'questionnaire_template_ids',
  'connector_ids',
  'export_ids',
]);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeManifest(input) {
  const resources = input.resources && typeof input.resources === 'object' ? input.resources : {};
  for (const key of RESOURCE_KEYS) {
    resources[key] = [...new Set((Array.isArray(resources[key]) ? resources[key] : []).map(String))];
  }
  return {
    manifest_version: Number(input.manifest_version || MANIFEST_VERSION),
    tenant_id: String(input.tenant_id || ''),
    run_id: String(input.run_id || ''),
    prefix: String(input.prefix || ''),
    created_at: String(input.created_at || ''),
    updated_at: String(input.updated_at || input.created_at || ''),
    resources,
  };
}

function validateManifest(input, expectedTenantId) {
  const manifest = normalizeManifest(structuredClone(input));
  const errors = [];
  if (manifest.manifest_version !== MANIFEST_VERSION) errors.push(`manifest_version must equal ${MANIFEST_VERSION}`);
  if (!isUuid(manifest.tenant_id)) errors.push('tenant_id must be a UUID');
  if (expectedTenantId && manifest.tenant_id !== expectedTenantId) errors.push('tenant_id does not match PHASE2_TENANT_ID');
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(manifest.run_id)) errors.push('run_id is invalid');
  if (manifest.prefix !== `PHASE2_QA_${manifest.run_id}`) errors.push('prefix does not match run_id');
  if (!manifest.created_at || Number.isNaN(Date.parse(manifest.created_at))) errors.push('created_at is invalid');
  for (const key of RESOURCE_KEYS) {
    if (manifest.resources[key].some(value => !isUuid(value))) errors.push(`${key} contains invalid UUIDs`);
  }
  if (errors.length) throw new Error(`Invalid Phase 2 QA manifest: ${errors.join('; ')}`);
  return manifest;
}

function writeManifest(file, input) {
  const output = path.resolve(file);
  const manifest = validateManifest(input, input.tenant_id);
  manifest.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, output);
  fs.chmodSync(output, 0o600);
  return manifest;
}

function readManifest(file, expectedTenantId) {
  const output = path.resolve(file);
  if (!fs.existsSync(output)) throw new Error(`Phase 2 QA manifest does not exist: ${output}`);
  return validateManifest(JSON.parse(fs.readFileSync(output, 'utf8')), expectedTenantId);
}

function createManifest({ tenantId, runId, file }) {
  const output = path.resolve(file);
  if (fs.existsSync(output)) {
    const existing = readManifest(output, tenantId);
    if (existing.run_id !== runId) {
      throw new Error(`Existing Phase 2 QA manifest belongs to ${existing.run_id}; clean it before starting ${runId}`);
    }
    return existing;
  }
  const now = new Date().toISOString();
  return writeManifest(output, {
    manifest_version: MANIFEST_VERSION,
    tenant_id: tenantId,
    run_id: runId,
    prefix: `PHASE2_QA_${runId}`,
    created_at: now,
    updated_at: now,
    resources: Object.fromEntries(RESOURCE_KEYS.map(key => [key, []])),
  });
}

function appendManifestResource(file, expectedTenantId, key, id) {
  if (!RESOURCE_KEYS.includes(key)) throw new Error(`Unsupported Phase 2 manifest resource: ${key}`);
  if (!isUuid(id)) throw new Error(`Invalid UUID for ${key}`);
  const manifest = readManifest(file, expectedTenantId);
  if (!manifest.resources[key].includes(id)) manifest.resources[key].push(id);
  return writeManifest(file, manifest);
}

module.exports = {
  MANIFEST_VERSION,
  RESOURCE_KEYS,
  appendManifestResource,
  createManifest,
  isUuid,
  normalizeManifest,
  readManifest,
  validateManifest,
  writeManifest,
};
