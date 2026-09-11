#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const v1Path = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql');
const v2Path = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql');
const v3Path = path.join(root, 'database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql');
const freshPath = path.join(root, 'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql');
const rbacPath = path.join(root, 'database/migrations/20260910_release_rbac_capability_systemic_closeout.sql');
const commercialPath = path.join(root, 'database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql');
const migrationPath = path.join(root, 'database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js');
const checkerPath = path.join(root, 'scripts/normalization/check-fresh-baseline-runtime-dependencies.js');

const runner = require('./apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout');
const checker = require('./check-fresh-baseline-runtime-dependencies');

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const sql = {
  schema: readSql(schemaPath),
  seed: readSql(seedPath),
  v1: readSql(v1Path),
  v2: readSql(v2Path),
  v3: readSql(v3Path),
  fresh: readSql(freshPath),
  rbac: readSql(rbacPath),
  commercial: readSql(commercialPath),
  migration: readSql(migrationPath),
};

for (const [name, text] of Object.entries(sql)) {
  assert.doesNotMatch(text, /\btecdex_saas\b/i, `${name} must not reference legacy DB`);
  assert.doesNotMatch(text, /\btcdx_saasv2\b/i, `${name} must not reference real fresh DB`);
  assert.doesNotMatch(text, /@[a-z0-9.-]*tcdx\.local\b/i, `${name} must not hardcode demo email`);
}

assert.match(sql.migration, /BEGIN;/, 'runtime dependency migration must be transactional');
assert.match(sql.migration, /COMMIT;/, 'runtime dependency migration must commit');
assert.match(sql.migration, /pg_try_advisory_xact_lock\(844332,\s*2026091007\)/, 'runtime dependency migration must use its own advisory lock');
assert.doesNotMatch(sql.migration, /GRANT\s+ALL\b/i, 'must not grant all privileges');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'must not grant all tables');
assert.doesNotMatch(sql.migration, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, 'must not grant all functions');
assert.doesNotMatch(sql.migration, /\bINSERT\s+INTO\s+(?:public\.)?(tenants|users|tenant_subscriptions|tenant_subscription_addons)\b/i, 'must not seed tenant/user/commercial tenant rows');
assert.doesNotMatch(sql.migration, /\bcontrol_health_scores\b/i, 'must not reintroduce control_health_scores');
assert.doesNotMatch(sql.migration, /\bKPI-HLT\b/i, 'must not reintroduce KPI-HLT control health authority');
assert.doesNotMatch(sql.migration, /ALTER\s+TABLE\s+tenant_controls[\s\S]*ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?notes\b/i, 'must not add tenant_controls.notes');

runner.validateSql(sql.migration);
assert.equal(runner.LOCK_KEY, 2026091007);
assert.equal(runner.MIGRATION.id, '20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout');
assert.match(runner.readMigration().checksum, /^[a-f0-9]{64}$/);
assert.equal(runner.migrationStateFromRows([], runner.readMigration()), 'pending');
assert.equal(runner.migrationStateFromRows([{ status: 'failed', checksum: 'x' }], runner.readMigration()), 'pending');
assert.equal(runner.migrationStateFromRows([{ status: 'running', checksum: 'x' }], runner.readMigration()), 'running');
assert.equal(
  runner.migrationStateFromRows([{ status: 'applied', checksum: runner.readMigration().checksum }], runner.readMigration()),
  'already_applied'
);
assert.equal(
  runner.migrationStateFromRows([{ status: 'applied', checksum: '0'.repeat(64) }], runner.readMigration()),
  'checksum_mismatch'
);

assert.ok(
  checker.REQUIRED_RELATIONS.some((relation) => relation.name === 'report_access_rules'),
  'checker must require report_access_rules'
);
assert.ok(
  checker.REQUIRED_RELATIONS.some((relation) => relation.name === 'iso_operational_suggestion_audit_log'),
  'checker must require iso_operational_suggestion_audit_log'
);
assert.ok(
  checker.REQUIRED_RELATIONS.some((relation) => relation.name === 'iso_recommended_action_conversions'),
  'checker must require iso_recommended_action_conversions'
);
assert.ok(
  checker.REQUIRED_RELATIONS
    .find((relation) => relation.name === 'tenant_controls')
    .columns.includes('tenant_standard_id'),
  'checker must require tenant_controls.tenant_standard_id'
);
assert.ok(
  !checker.REQUIRED_RELATIONS
    .find((relation) => relation.name === 'tenant_controls')
    .columns.includes('notes'),
  'checker must not require tenant_controls.notes'
);

function databaseUrl(pg) {
  if (pg.container) return `postgres://postgres@127.0.0.1:${pg.port}/postgres`;
  return `postgres://postgres@/postgres?host=${encodeURIComponent(pg.socketDir)}&port=${pg.port}`;
}

function runNode(pg, scriptPath, args, allowFailure = false) {
  const result = spawnSync('node', [scriptPath, ...args], {
    cwd: root,
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl(pg) },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure) {
    assert.equal(result.status, 0, `node ${path.relative(root, scriptPath)} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=/i, 'script output must not leak connection strings');
  return result;
}

function quoteList(values) {
  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(',');
}

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=PASS`);
}

function assertRelations(pg, name, relationNames) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM unnest(ARRAY[${quoteList(relationNames)}]) AS required(name)
    WHERE to_regclass('public.' || required.name) IS NOT NULL;
    `,
    relationNames.length
  );
}

const pg = createPostgres();
try {
  psqlExec(pg, sql.schema);
  psqlExec(pg, sql.seed);
  psqlExec(pg, sql.v1);
  psqlExec(pg, sql.v2);
  psqlExec(pg, sql.v3);
  psqlExec(pg, sql.fresh);
  psqlExec(pg, sql.rbac);
  psqlExec(pg, sql.commercial);
  console.log('FRESH_BASELINE_PRIOR_RUNTIME_CHAIN=PASS');

  const checksum = runNode(pg, runnerPath, ['--checksum']).stdout.trim();
  assert.match(checksum, /20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout checksum=[a-f0-9]{64}/);
  console.log('FRESH_RUNTIME_DEPENDENCY_CHECKSUM=PASS');

  const preflight = runNode(pg, runnerPath, ['--preflight']);
  assert.match(preflight.stdout, /migration_state=pending/);
  console.log('FRESH_RUNTIME_DEPENDENCY_PREFLIGHT_PENDING=PASS');

  runNode(pg, runnerPath, ['--apply']);
  console.log('FRESH_RUNTIME_DEPENDENCY_APPLY_1=PASS');
  const secondApply = runNode(pg, runnerPath, ['--apply']);
  assert.match(secondApply.stdout, /already_applied/);
  console.log('FRESH_RUNTIME_DEPENDENCY_REAPPLY=PASS');

  assertRelations(pg, 'FRESH_RUNTIME_DEPENDENCY_RELATIONS', [
    'notifications',
    'document_index',
    'tenant_document_index_exclusions',
    'report_types',
    'report_access_rules',
    'report_exports',
    'iso_catalog_sync_status',
    'iso_express_assessments',
    'iso_express_assessment_items',
    'iso_express_assessment_gaps',
    'iso_express_assessment_answers',
    'iso_express_assessment_audit_log',
    'iso_operational_suggestion_audit_log',
    'v_iso_control_effective_health',
    'v_iso_control_catalog_coverage',
    'v_iso_express_tenant_standard_readiness',
    'v_health_root_causes_by_tenant',
    'v_iso_operational_suggestions_queue',
    'v_iso_operational_suggestions_summary',
  ]);
  assertScalar(pg, 'NO_TENANT_CONTROLS_NOTES', `SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_controls' AND column_name='notes';`, '0');
  assertScalar(pg, 'REPORT_TYPES_SEEDED', `SELECT count(*)::int >= 7 FROM report_types WHERE code IN ('executive_iso_status','maturity_gap_diagnostic','control_health_report','iso_risk_report','action_plan_report','internal_audit_report','platform_client_monthly');`, 't');
  assertScalar(pg, 'REPORT_ACCESS_RULES_SEEDED', `SELECT count(*)::int >= 20 FROM report_access_rules WHERE can_view IS TRUE;`, 't');
  assertScalar(pg, 'BACKEND_RUNTIME_NO_LOGIN', `SELECT (rolcanlogin IS FALSE)::text FROM pg_roles WHERE rolname='tcdx_backend_runtime';`, 'true');
  assertScalar(pg, 'HEALTH_VIEW_NO_LEGACY_AUTHORITY', `SELECT (position('control_health_scores' in pg_get_viewdef('public.v_iso_control_effective_health'::regclass)) = 0 AND position('KPI-HLT' in pg_get_viewdef('public.v_iso_control_effective_health'::regclass)) = 0)::text;`, 'true');
  assertScalar(pg, 'ISO_EXPRESS_SAME_TENANT_CONSTRAINT', `SELECT count(*)::int >= 4 FROM pg_constraint WHERE conname IN ('fk_iso_express_items_assessment_same_tenant','fk_iso_express_gaps_assessment_same_tenant','fk_iso_express_answers_assessment_same_tenant','fk_iso_express_audit_assessment_same_tenant');`, 't');

  const checkerRun = runNode(pg, checkerPath, ['--mutation-probes']);
  assert.match(checkerRun.stdout, /FRESH_RUNTIME_MUTATION_PROBES=PASS/);
  assert.match(checkerRun.stdout, /FRESH_BASELINE_RUNTIME_DEPENDENCY_CHECK=PASS/);
  console.log('FRESH_RUNTIME_DEPENDENCY_CHECKER=PASS');

  psqlExec(pg, `
    UPDATE schema_migrations
    SET checksum = repeat('0', 64)
    WHERE migration_id = '20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout';
  `);
  const mismatch = runNode(pg, runnerPath, ['--preflight'], true);
  assert.notEqual(mismatch.status, 0, 'checksum mismatch preflight must fail closed');
  assert.match(mismatch.stderr, /checksum differs/i);
  console.log('FRESH_RUNTIME_DEPENDENCY_CHECKSUM_MISMATCH_FAIL_CLOSED=PASS');
  console.log('TCDX_FRESH_BASELINE_RUNTIME_DEPENDENCY_SYSTEMIC_CLOSEOUT_POSTGRES_TEST=PASS');
} finally {
  stopPostgres(pg);
}
