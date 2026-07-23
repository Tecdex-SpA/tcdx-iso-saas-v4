#!/usr/bin/env node
const { spawnSync } = require('child_process');

const required = [
  'WEB_BASE_URL', 'API_BASE_URL', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD',
  'E2E_RESTRICTED_EMAIL', 'E2E_RESTRICTED_PASSWORD',
  'E2E_TENANT_A_EMAIL', 'E2E_TENANT_A_PASSWORD', 'E2E_TENANT_A_ID',
  'E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD', 'E2E_TENANT_B_ID',
  'E2E_REVIEWER_EMAIL', 'E2E_REVIEWER_PASSWORD', 'E2E_REVIEWER_ID',
  'E2E_AUDIT_ID', 'E2E_EVIDENCE_ID', 'E2E_CONTROL_ID',
];
const missing = required.filter(name => !String(process.env[name] || '').trim());
if (missing.length) {
  console.error(`Phase 1 runtime local requires isolated local/QA services. Missing: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' || process.env.PHASE1_QA_ENV === 'production') {
  console.error('Phase 1 runtime local refuses production');
  process.exit(1);
}
const result = spawnSync('npm', ['run', 'phase1:e2e'], {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status === null ? 1 : result.status);
