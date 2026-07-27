const fs = require('fs');
const path = require('path');

const MANIFEST_VERSION = 2;
const RESOURCE_KEYS = Object.freeze([
  'workflow_definition_ids',
  'evidence_request_ids',
  'workflow_instance_ids',
  'readiness_snapshot_ids',
  'audit_annual_plan_ids',
  'escalation_policy_ids',
  'scheduler_run_ids',
  'audit_workpaper_ids',
  'mapping_ids',
  'audit_program_ids',
  'audit_team_member_ids',
  'audit_sample_plan_ids',
  'export_ids',
]);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeManifest(manifest) {
  const resources = manifest.resources && typeof manifest.resources === 'object' ? manifest.resources : {};
  for (const key of RESOURCE_KEYS) {
    const legacy = Array.isArray(manifest[key]) ? manifest[key] : [];
    const current = Array.isArray(resources[key]) ? resources[key] : [];
    resources[key] = [...new Set([...legacy, ...current].map(String))];
    delete manifest[key];
  }
  return {
    manifest_version: Number(manifest.manifest_version || MANIFEST_VERSION),
    tenant_id: String(manifest.tenant_id || ''),
    run_id: String(manifest.run_id || ''),
    prefix: String(manifest.prefix || ''),
    created_at: String(manifest.created_at || ''),
    updated_at: String(manifest.updated_at || manifest.created_at || ''),
    resources,
  };
}

function validateManifest(manifest, expectedTenantId) {
  const normalized = normalizeManifest(structuredClone(manifest));
  const errors = [];
  if (normalized.manifest_version !== MANIFEST_VERSION) errors.push(`manifest_version must equal ${MANIFEST_VERSION}`);
  if (!isUuid(normalized.tenant_id)) errors.push('tenant_id must be a UUID');
  if (expectedTenantId && normalized.tenant_id !== expectedTenantId) errors.push('tenant_id does not match PHASE1_TENANT_ID');
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(normalized.run_id)) errors.push('run_id is invalid');
  if (normalized.prefix !== `PHASE1R_QA_${normalized.run_id}`) errors.push('prefix does not match run_id');
  if (!normalized.created_at || Number.isNaN(Date.parse(normalized.created_at))) errors.push('created_at is invalid');
  for (const key of RESOURCE_KEYS) {
    if (normalized.resources[key].some(value => !isUuid(value))) errors.push(`${key} contains invalid UUIDs`);
  }
  if (errors.length) throw new Error(`Invalid Phase 1 QA manifest: ${errors.join('; ')}`);
  return normalized;
}

function writeManifest(file, manifest) {
  const output = path.resolve(file);
  const normalized = validateManifest(manifest, manifest.tenant_id);
  normalized.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, output);
  fs.chmodSync(output, 0o600);
  return normalized;
}

function readManifest(file, expectedTenantId) {
  const output = path.resolve(file);
  if (!fs.existsSync(output)) throw new Error(`QA manifest does not exist: ${output}`);
  return validateManifest(JSON.parse(fs.readFileSync(output, 'utf8')), expectedTenantId);
}

function createManifest({ tenantId, runId, file }) {
  const output = path.resolve(file);
  if (fs.existsSync(output)) {
    const existing = readManifest(output, tenantId);
    if (existing.run_id !== runId) throw new Error(`Existing QA manifest belongs to run ${existing.run_id}; clean it before starting ${runId}`);
    return existing;
  }
  const now = new Date().toISOString();
  return writeManifest(output, {
    manifest_version: MANIFEST_VERSION,
    tenant_id: tenantId,
    run_id: runId,
    prefix: `PHASE1R_QA_${runId}`,
    created_at: now,
    updated_at: now,
    resources: Object.fromEntries(RESOURCE_KEYS.map(key => [key, []])),
  });
}

function appendManifestResource(file, expectedTenantId, key, id) {
  if (!RESOURCE_KEYS.includes(key)) throw new Error(`Unsupported manifest resource key: ${key}`);
  if (!isUuid(id)) throw new Error(`Invalid UUID for ${key}`);
  const manifest = readManifest(file, expectedTenantId);
  if (!manifest.resources[key].includes(id)) manifest.resources[key].push(id);
  return writeManifest(file, manifest);
}

module.exports = {
  MANIFEST_VERSION, RESOURCE_KEYS, appendManifestResource, createManifest, isUuid,
  normalizeManifest, readManifest, validateManifest, writeManifest,
};
