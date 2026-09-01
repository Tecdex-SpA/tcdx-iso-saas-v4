'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ADDON_CAPABILITIES,
  classifyCapability,
  planAllowsCapability,
} = require('./commercialPlanMatrix.service');

const repoRoot = path.resolve(__dirname, '../../../..');
const migrationSql = fs.readFileSync(
  path.join(repoRoot, 'database/migrations/20260901_normalization01_db_backend_authority.sql'),
  'utf8',
);
const runner = fs.readFileSync(
  path.join(repoRoot, 'scripts/normalization/apply-normalization-01-migration.js'),
  'utf8',
);
const phase5Service = fs.readFileSync(
  path.join(repoRoot, 'backend/src/services/phase5/phase5.service.js'),
  'utf8',
);

assert.equal(classifyCapability('ai.compliance').required_permission, 'ai.view');
assert.equal(classifyCapability('iso.actions').required_permission, 'actions.view');
assert.deepStrictEqual(ADDON_CAPABILITIES.ai, ['ai.compliance', 'ai.auditor']);
assert.equal(planAllowsCapability('pyme', 'ai.compliance'), false);
assert.equal(planAllowsCapability('empresa', 'ai.compliance'), false);
assert.equal(planAllowsCapability('enterprise', 'ai.compliance'), false);

assert.match(migrationSql, /required_permission = 'ai\.view'/);
assert.match(migrationSql, /required_permission = 'actions\.view'/);
assert.match(migrationSql, /UPDATE tenant_subscription_addons[\s\S]*status = 'cancelled'/);
assert.doesNotMatch(migrationSql, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(migrationSql, /\b(?:INSERT\s+INTO|UPDATE)\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts|tenant_subscriptions)\b/i);

assert.match(runner, /AI_COMPLIANCE_PERMISSION_CANONICAL/);
assert.match(runner, /ISO_ACTIONS_PERMISSION_CANONICAL/);
assert.match(runner, /DUPLICATE_EFFECTIVE_AI_ADDONS/);
assert.match(runner, /STANDARD_PLAN_AI_CAPABILITY_COUNT/);

const getOverview = phase5Service.match(/async function getGrcOverview[\s\S]*?\n}\n\nmodule\.exports/);
assert.ok(getOverview, 'getGrcOverview must remain present');
assert.doesNotMatch(
  getOverview[0],
  /recalculateOfficialAnalytics/,
  'GET /api/grc/overview read path must not call persistent recalculation',
);
assert.match(
  getOverview[0],
  /readPackage3OverviewOfficialCalculations/,
  'GET /api/grc/overview must consume persisted official calculations',
);

process.stdout.write('NORMALIZATION01_AUTHORITY_CONTRACT_PASS\n');
