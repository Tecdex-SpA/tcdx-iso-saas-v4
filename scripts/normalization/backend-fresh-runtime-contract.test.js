#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const migration = read('database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql');
const userRoutes = read('backend/src/routes/user.routes.js');
const adminSaasRoutes = read('backend/src/routes/admin-saas.routes.js');
const governanceService = read('backend/src/services/governance.service.js');
const entitlementResolver = read('backend/src/services/commercial/entitlementResolver.service.js');
const adminSaasPage = read('frontend/src/app/admin-saas/page.tsx');

for (const column of ['phone', 'job_title', 'avatar']) {
  assert.match(userRoutes, new RegExp(`\\b${column}\\b`), `user.routes must still expose ${column}`);
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `fresh migration must provide users.${column}`);
}
console.log('BACKEND_USER_ME_PROFILE_CONTRACT=PASS');

for (const token of ['get_user_effective_permissions', 'user_has_permission']) {
  assert.match(governanceService + entitlementResolver + adminSaasRoutes, new RegExp(`${token}\\(`), `runtime must call ${token}`);
  assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION ${token}\\b`), `fresh migration must define ${token}`);
}
assert.match(migration, /WHEN 'superadmin' THEN 'platform_admin'/, 'RBAC resolver may preserve explicit superadmin alias');
assert.doesNotMatch(migration, /UPDATE\s+users[\s\S]*platform_admin[\s\S]*superadmin/i, 'migration must not rewrite platform_admin users to superadmin');
console.log('BACKEND_GOVERNANCE_RBAC_FRESH_CONTRACT=PASS');

for (const token of [
  'v_tenant_modules',
  'dealer_tenants',
  'v_dealer_tenants',
  'tenant_contracts',
  'v_commercial_tenant_subscription',
  'tenant_subscription_addons',
  'log_admin_audit_event',
  'saas_price_catalog',
]) {
  assert.match(adminSaasRoutes, new RegExp(`\\b${token}\\b`), `admin-saas runtime must reference ${token}`);
  assert.match(migration, new RegExp(`\\b${token}\\b`), `fresh migration must provide ${token}`);
}
console.log('BACKEND_ADMIN_SAAS_RUNTIME_CONTRACT=PASS');

for (const column of [
  'rut',
  'business',
  'address',
  'branches',
  'logo',
  'logo_url',
  'ai_enabled',
  'ai_web_enabled',
  'ai_report_enabled',
  'ai_auditor_enabled',
  'ai_monthly_quota',
  'ai_quota_used',
  'ai_features_json',
]) {
  assert.match(adminSaasRoutes, new RegExp(`\\bt\\.${column}\\b|\\b${column}\\b`), `admin-saas runtime must reference tenants.${column}`);
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `fresh migration must provide tenants.${column}`);
}
console.log('BACKEND_METRICS_TENANT_DISCOVERY_CONTRACT=PASS');

assert.doesNotMatch(adminSaasPage, /const\s+\[isSuperadminUi\]\s*=\s*useState\(false\)/, 'isSuperadminUi must not be hardcoded false');
assert.match(adminSaasPage, /const\s+isSuperadminUi\s*=\s*isPlatform;/, 'isSuperadminUi must derive from canonical platform governance');
console.log('FRONTEND_PLATFORM_ADMIN_UI_GATE=PASS');
