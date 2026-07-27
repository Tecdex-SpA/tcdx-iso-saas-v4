#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { readManifest } = require('./phase1-qa-manifest');

const REQUIRED = Object.freeze([
  'WEB_BASE_URL', 'API_BASE_URL', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD',
  'E2E_RESTRICTED_EMAIL', 'E2E_RESTRICTED_PASSWORD',
  'E2E_TENANT_A_EMAIL', 'E2E_TENANT_A_PASSWORD', 'E2E_TENANT_A_ID',
  'E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD', 'E2E_TENANT_B_ID',
  'E2E_REVIEWER_EMAIL', 'E2E_REVIEWER_PASSWORD', 'E2E_REVIEWER_ID',
  'E2E_AUDIT_ID', 'E2E_EVIDENCE_ID', 'E2E_CONTROL_ID',
  'PHASE1_QA_ENV', 'PHASE1_QA_RUN_ID', 'PHASE1_QA_MANIFEST', 'PHASE1_TENANT_ID',
]);

function validateEnvironment(environment = process.env, options = {}) {
  const missing = REQUIRED.filter(name => !String(environment[name] || '').trim());
  const errors = [];
  if (missing.length) errors.push(`missing variables: ${missing.join(', ')}`);
  if (String(environment.PHASE1_QA_ENV || '').toLowerCase() !== 'qa') errors.push('PHASE1_QA_ENV must equal qa');
  if (environment.E2E_TENANT_A_ID && environment.PHASE1_TENANT_ID
    && environment.E2E_TENANT_A_ID !== environment.PHASE1_TENANT_ID) {
    errors.push('E2E_TENANT_A_ID must equal PHASE1_TENANT_ID');
  }
  for (const name of ['WEB_BASE_URL', 'API_BASE_URL']) {
    if (!environment[name]) continue;
    try {
      const parsed = new URL(environment[name]);
      if (parsed.protocol !== 'https:' && environment.PHASE1_QA_ENV === 'qa') errors.push(`${name} must use HTTPS in qa`);
    } catch {
      errors.push(`${name} must be a valid URL`);
    }
  }
  if (!options.allowMissingManifest && environment.PHASE1_QA_MANIFEST) {
    const manifestPath = path.resolve(environment.PHASE1_QA_MANIFEST);
    if (!fs.existsSync(manifestPath)) {
      errors.push(`PHASE1_QA_MANIFEST does not exist: ${manifestPath}`);
    } else {
      try {
        const manifest = readManifest(manifestPath, environment.PHASE1_TENANT_ID);
        if (manifest.run_id !== environment.PHASE1_QA_RUN_ID) errors.push('PHASE1_QA_RUN_ID does not match the manifest');
      } catch (error) {
        errors.push(error.message);
      }
    }
  }
  if (errors.length) throw new Error(`Phase 1 runtime environment invalid: ${errors.join('; ')}`);
  return { ok: true, variables: REQUIRED.length };
}

if (require.main === module) {
  try {
    const result = validateEnvironment(process.env, { allowMissingManifest: process.argv.includes('--allow-missing-manifest') });
    process.stdout.write(`Phase 1 runtime environment: VERIFIED variables=${result.variables}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { REQUIRED, validateEnvironment };
