#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runnerPath = path.join(__dirname, 'apply-normalization-01-migration.js');
const migrationPath = path.join(__dirname, '../../database/migrations/20260901_normalization01_db_backend_authority.sql');
const runner = fs.readFileSync(runnerPath, 'utf8');
const sql = fs.readFileSync(migrationPath, 'utf8');

assert.match(runner, /crypto\.createHash\('sha256'\)/, 'runner must compute SHA256 checksum');
assert.match(runner, /schema_migrations/, 'runner must use schema_migrations ledger');
assert.match(runner, /applied_by/, 'runner must populate applied_by');
assert.match(runner, /current_user/, 'runner must use current_user for applied_by');
assert.match(runner, /pg_try_advisory_xact_lock/, 'runner must use advisory lock');
assert.match(runner, /--preflight/, 'runner must expose preflight');
assert.match(runner, /--apply/, 'runner must expose apply');
assert.match(runner, /already_applied/, 'runner must preserve idempotent already_applied path');
assert.match(runner, /checksum mismatch|checksum differs/i, 'runner must fail fast on checksum mismatch');

for (const token of [
  'AI_COMPLIANCE_PERMISSION_CANONICAL',
  'ISO_ACTIONS_PERMISSION_CANONICAL',
  'AI_COMPLIANCE_ORPHAN_PERMISSION_REFERENCE',
  'ISO_ACTIONS_ORPHAN_PERMISSION_REFERENCE',
  'STANDARD_PLAN_AI_CAPABILITY_COUNT',
  'DUPLICATE_EFFECTIVE_AI_ADDONS',
  'AI_ADDON_CAPABILITIES_OK',
  'AI_ADDON_REQUIRED_FOR_AI',
  'NO_USER_MUTATION',
  'NO_ROLE_MUTATION',
  'NO_SCOPE_MUTATION',
]) {
  assert.match(runner, new RegExp(token), `runner must report ${token}`);
}

assert.match(sql, /BEGIN;/, 'migration must have outer transaction');
assert.match(sql, /COMMIT;/, 'migration must have outer transaction');
assert.match(sql, /required_permission = 'ai\.view'/, 'migration must canonicalize ai.compliance permission');
assert.match(sql, /required_permission = 'actions\.view'/, 'migration must canonicalize iso.actions permission');
assert.match(sql, /UPDATE tenant_subscription_addons[\s\S]*status = 'cancelled'/, 'migration must close duplicate add-ons without deleting history');
assert.match(sql, /UPDATE plan_version_modules[\s\S]*module_key = 'ai_compliance'/, 'migration must remove plan-level AI module authority');
assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, 'migration must not delete history');
assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE)\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts|tenant_subscriptions)\b/i, 'migration must not mutate users, roles, permissions, contracts or subscriptions');

process.stdout.write('NORMALIZATION01_MIGRATION_CONTRACT_PASS\n');
