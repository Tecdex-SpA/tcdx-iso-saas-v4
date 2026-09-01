#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _private } = require('./apply-hotfix-postdeploy-01-migration');

const repoRoot = path.resolve(__dirname, '../..');
const migrationSql = fs.readFileSync(
  path.join(repoRoot, 'database/migrations/20260901_hotfix_postdeploy01_ai_view_rbac.sql'),
  'utf8',
);
const runner = fs.readFileSync(
  path.join(repoRoot, 'scripts/normalization/apply-hotfix-postdeploy-01-migration.js'),
  'utf8',
);

const correctState = Object.freeze({
  ai_permission_active: true,
  ai_compliance_permission_canonical: true,
  tenant_expected_role_count: 3,
  tenant_expected_ai_view_count: 3,
  unauthorized_ai_view_role_count: 0,
});

const repairableState = Object.freeze({
  ...correctState,
  tenant_expected_ai_view_count: 0,
});

assert.deepStrictEqual(_private.TENANT_AI_VIEW_ROLES, ['admin', 'tenant_admin', 'auditor']);
assert.ok(_private.ALLOWED_AI_VIEW_ROLES.includes('platform_admin'));
assert.ok(_private.ALLOWED_AI_VIEW_ROLES.includes('superadmin'));
assert.equal(_private.ALLOWED_AI_VIEW_ROLES.includes('area_owner'), false);
assert.equal(_private.ALLOWED_AI_VIEW_ROLES.includes('executive'), false);
assert.equal(_private.ALLOWED_AI_VIEW_ROLES.includes('dealer'), false);

assert.equal(_private.isPostconditionSatisfied(correctState), true);
assert.equal(_private.isRepairableState(repairableState), true);
assert.doesNotThrow(() => _private.assertPreflightState(repairableState));
assert.doesNotThrow(() => _private.assertPostconditions(correctState));

assert.throws(
  () => _private.assertPreflightState({ ...repairableState, unauthorized_ai_view_role_count: 1 }),
  /unsupported RBAC state/,
  'unexpected ai.view role grants fail closed',
);
assert.throws(
  () => _private.assertPreflightState({ ...repairableState, tenant_expected_role_count: 2 }),
  /unsupported RBAC state/,
  'missing expected role fails closed',
);
assert.throws(
  () => _private.assertPreflightState({ ...repairableState, ai_compliance_permission_canonical: false }),
  /unsupported RBAC state/,
  'non-canonical ai.compliance permission fails closed',
);

assert.equal(
  _private.migrationStateFromRows([{ checksum: 'expected', status: 'applied' }], { checksum: 'expected' }),
  'already_applied',
);
assert.equal(
  _private.migrationStateFromRows([{ checksum: 'wrong', status: 'applied' }], { checksum: 'expected' }),
  'checksum_mismatch',
);
assert.equal(_private.migrationStateFromRows([], { checksum: 'expected' }), 'pending');

assert.match(runner, /crypto\.createHash\('sha256'\)/);
assert.match(runner, /schema_migrations/);
assert.match(runner, /pg_try_advisory_lock/);
assert.match(runner, /HOTFIX_POSTDEPLOY_01_PREFLIGHT_OK/);
assert.match(runner, /user_mutation_count/);
assert.match(runner, /commercial_mutation_count/);
assert.doesNotMatch(runner, /\bai_plan\b/);

assert.match(migrationSql, /INSERT INTO role_permissions/);
assert.match(migrationSql, /'admin'/);
assert.match(migrationSql, /'tenant_admin'/);
assert.match(migrationSql, /'auditor'/);
assert.match(migrationSql, /unauthorized roles have ai\.view/);
assert.doesNotMatch(migrationSql, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(migrationSql, /\b(?:INSERT\s+INTO|UPDATE)\s+(?:public\.)?(users|app_roles|permissions|tenant_contracts|tenant_subscriptions|tenant_subscription_addons|commercial_plans|commercial_plan_versions|plan_version_modules|plan_version_addons|commercial_technical_capabilities)\b/i);
assert.doesNotMatch(migrationSql, /\bai_plan\b/i);

process.stdout.write('HOTFIX_POSTDEPLOY_01_MIGRATION_CONTRACT_PASS\n');
