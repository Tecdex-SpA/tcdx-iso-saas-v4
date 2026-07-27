#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { readManifest } = require('./phase2-qa-manifest');

const REQUIRED = Object.freeze([
  'WEB_BASE_URL', 'API_BASE_URL',
  'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD',
  'E2E_RESTRICTED_EMAIL', 'E2E_RESTRICTED_PASSWORD',
  'E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD', 'E2E_TENANT_B_ID',
  'E2E_EVIDENCE_ID',
  'PHASE2_QA_ENV', 'PHASE2_QA_RUN_ID', 'PHASE2_QA_MANIFEST', 'PHASE2_TENANT_ID',
]);

function validateEnvironment(environment = process.env, options = {}) {
  const errors = [];
  const missing = REQUIRED.filter(name => !String(environment[name] || '').trim());
  if (missing.length) errors.push(`missing variables: ${missing.join(', ')}`);
  if (String(environment.PHASE2_QA_ENV || '').toLowerCase() !== 'qa') errors.push('PHASE2_QA_ENV must equal qa');
  if (environment.E2E_TENANT_A_ID && environment.PHASE2_TENANT_ID
      && environment.E2E_TENANT_A_ID !== environment.PHASE2_TENANT_ID) {
    errors.push('E2E_TENANT_A_ID must equal PHASE2_TENANT_ID');
  }
  for (const name of ['WEB_BASE_URL', 'API_BASE_URL']) {
    if (!environment[name]) continue;
    try {
      const parsed = new URL(environment[name]);
      if (parsed.protocol !== 'https:' && environment.PHASE2_QA_ENV === 'qa') errors.push(`${name} must use HTTPS in qa`);
    } catch {
      errors.push(`${name} must be a valid URL`);
    }
  }
  if (!options.allowMissingManifest && environment.PHASE2_QA_MANIFEST) {
    const manifestPath = path.resolve(environment.PHASE2_QA_MANIFEST);
    if (!fs.existsSync(manifestPath)) {
      errors.push(`PHASE2_QA_MANIFEST does not exist: ${manifestPath}`);
    } else {
      try {
        const manifest = readManifest(manifestPath, environment.PHASE2_TENANT_ID);
        if (manifest.run_id !== environment.PHASE2_QA_RUN_ID) errors.push('PHASE2_QA_RUN_ID does not match manifest');
      } catch (error) {
        errors.push(error.message);
      }
    }
  }
  if (errors.length) throw new Error(`Phase 2 runtime environment invalid: ${errors.join('; ')}`);
  return { ok: true, variables: REQUIRED.length };
}

if (require.main === module) {
  try {
    const result = validateEnvironment(process.env, { allowMissingManifest: process.argv.includes('--allow-missing-manifest') });
    process.stdout.write(`Phase 2 runtime environment: VERIFIED variables=${result.variables}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { REQUIRED, validateEnvironment };
