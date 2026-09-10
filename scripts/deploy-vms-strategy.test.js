#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const deployScript = path.join(root, 'scripts/deploy-vms.sh');
const scriptText = fs.readFileSync(deployScript, 'utf8');

const missingStrategy = spawnSync('env', ['-u', 'TCDX_DB_DEPLOY_STRATEGY', 'bash', deployScript], {
  cwd: root,
  env: {
    ...process.env,
    TCDX_DEPLOY_GUARD_SELF_TEST: '',
  },
  encoding: 'utf8',
});

assert.notEqual(missingStrategy.status, 0, 'deploy must fail closed when TCDX_DB_DEPLOY_STRATEGY is missing');
assert.match(
  missingStrategy.stdout + missingStrategy.stderr,
  /TCDX_DB_DEPLOY_STRATEGY no definida/,
  'missing strategy must produce explicit fail-closed error'
);
assert.doesNotMatch(
  missingStrategy.stdout + missingStrategy.stderr,
  /Preflight remoto|git fetch|MIGRATION_DATABASE_URL=/,
  'missing strategy must abort before remote/git migration work'
);

const result = spawnSync('bash', [deployScript], {
  cwd: root,
  env: {
    ...process.env,
    TCDX_DEPLOY_GUARD_SELF_TEST: '1',
  },
  encoding: 'utf8',
});

assert.equal(result.status, 0, `self-test failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);

const requiredPasses = [
  'STRATEGY_MISSING_ABORTS=PASS',
  'FRESH_MODE_ACCEPTS_TCDX_SAASV2=PASS',
  'HISTORICAL_MODE_ACCEPTS_LEGACY_DB=PASS',
  'FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=PASS',
  'TCDX_SAASV2_REJECTS_HISTORICAL_UPGRADE=PASS',
  'FRESH_MODE_REQUIRES_TCDX_SAASV2=PASS',
  'WRONG_MIGRATION_DATABASE_ABORTS=PASS',
  'WRONG_BACKEND_RUNTIME_DATABASE_ABORTS=PASS',
  'BACKEND_DOTENV_PARSER_SPACES=PASS',
  'SECRETS_NOT_PRINTED=PASS',
  'NO_BOOTSTRAP_ON_NORMAL_DEPLOY=PASS',
  'NO_HISTORICAL_PHASE_RUNNER_ON_FRESH_DEPLOY=PASS',
  'DEPLOY_CONTINUES_WITH_ZERO_PENDING_FORWARD_MIGRATIONS=PASS',
];

for (const marker of requiredPasses) {
  assert.match(result.stdout, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${marker} missing`);
}

const freshArray = scriptText.match(/FRESH_PRODUCTION_MIGRATION_RUNNERS=\([\s\S]*?\n\)/);
assert.ok(freshArray, 'fresh production migration runner registry must exist');
assert.doesNotMatch(freshArray[0], /scripts\/phase[0-9-]/, 'fresh deploy must not include historical phase runners');
assert.doesNotMatch(freshArray[0], /production_schema_v1\.sql|production_seed_v1\.sql|load-production-reference-catalogs\.js/, 'fresh deploy must not run bootstrap assets');

const historicalArray = scriptText.match(/HISTORICAL_MIGRATION_RUNNERS=\([\s\S]*?\n\)/);
assert.ok(historicalArray, 'historical migration runner registry must exist');
for (const expected of [
  'scripts/phase3/apply-phase3-migration.js',
  'scripts/phase4/apply-phase4-migration.js',
  'scripts/phase5/apply-phase5-migration.js',
  'scripts/phase5-c2/apply-phase5-c2-migration.js',
  'scripts/phase5-c3/apply-phase5-c3-migration.js',
  'scripts/f6-8/apply-f6-8-migration.js',
  'scripts/f6-10/apply-f6-10-migration.js',
  'scripts/f6-11/apply-f6-11-migration.js',
  'scripts/f6-13/apply-f6-13-migration.js',
  'scripts/rbac01/apply-rbac01-migration.js',
  'scripts/rbac02/apply-rbac02-migration.js',
  'scripts/commercial-plan/apply-commercial-plan-matrix-migration.js',
  'scripts/ai-addon/apply-ai-addon-migration.js',
  'scripts/normalization/apply-ai-addon-reconciliation-migration.js',
  'scripts/normalization/apply-normalization-01-migration.js',
  'scripts/normalization/apply-normalization-02-migration.js',
  'scripts/normalization/apply-hotfix-postdeploy-01-migration.js',
]) {
  assert.match(historicalArray[0], new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${expected} missing from historical registry`);
}

assert.match(scriptText, /current_database\(\)/, 'deploy must query current_database');
assert.match(scriptText, /inet_server_addr\(\)/, 'deploy must query inet_server_addr');
assert.match(scriptText, /inet_server_port\(\)/, 'deploy must query inet_server_port');
assert.doesNotMatch(scriptText, /source\s+"\$backend_env_file"/, 'backend .env must not be sourced as shell');
assert.doesNotMatch(scriptText, /\beval\b/, 'deploy must not use eval');
assert.doesNotMatch(scriptText, /TCDX_DB_DEPLOY_STRATEGY:-historical-upgrade/, 'deploy strategy must not default to historical-upgrade');
assert.match(scriptText, /dotenv\.config\(\{\s*path:\s*envFile,\s*quiet:\s*true\s*\}\)/, 'backend env parser must use dotenv quiet mode');
assert.doesNotMatch(
  result.stdout + result.stderr + missingStrategy.stdout + missingStrategy.stderr,
  /DB_PASSWORD|test_password|postgres:\/\/|postgresql:\/\/|MIGRATION_DATABASE_URL=|JWT_SECRET|CLIENT_SECRET|TOKEN_ENCRYPTION_KEY/,
  'self-test output must not print secrets'
);

console.log('DEPLOY_VM_STRATEGY_TEST_PASS');
