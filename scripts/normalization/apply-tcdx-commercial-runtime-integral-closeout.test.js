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
const migrationPath = path.join(root, 'database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js');
const deployScriptPath = path.join(root, 'scripts/deploy-vms.sh');

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
  migration: readSql(migrationPath),
};

for (const [name, text] of Object.entries(sql)) {
  assert.doesNotMatch(text, /\btecdex_saas\b/i, `${name} must not reference legacy DB`);
  assert.doesNotMatch(text, /\btcdx_saasv2\b/i, `${name} must not reference real fresh DB`);
  assert.doesNotMatch(text, /@[a-z0-9.-]*tcdx\.local\b/i, `${name} must not hardcode demo email`);
}

assert.match(sql.migration, /BEGIN;/, 'commercial runtime migration must be transactional');
assert.match(sql.migration, /COMMIT;/, 'commercial runtime migration must commit');
assert.match(sql.migration, /pg_try_advisory_xact_lock\(844332,\s*2026091006\)/, 'commercial runtime migration must use its own advisory lock');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'must not grant all tables');
assert.doesNotMatch(sql.migration, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, 'must not grant all functions');
assert.doesNotMatch(sql.migration, /\bINSERT\s+INTO\s+(?:public\.)?(tenants|users|tenant_subscriptions|tenant_subscription_addons)\b/i, 'must not seed tenant/user/commercial tenant rows');

const deployScript = readSql(deployScriptPath);
const freshArray = deployScript.match(/FRESH_PRODUCTION_MIGRATION_RUNNERS=\([\s\S]*?\n\)/);
assert.ok(freshArray, 'fresh migration runner registry must exist');
assert.match(freshArray[0], /apply-tcdx-commercial-runtime-integral-closeout\.js/, 'new runner must be registered for fresh production');

function databaseUrl(pg) {
  if (pg.container) return `postgres://postgres@127.0.0.1:${pg.port}/postgres`;
  return `postgres://postgres@/postgres?host=${encodeURIComponent(pg.socketDir)}&port=${pg.port}`;
}

function runRunner(pg, mode, allowFailure = false) {
  const result = spawnSync('node', [runnerPath, mode], {
    cwd: root,
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl(pg) },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!allowFailure) {
    assert.equal(result.status, 0, `runner ${mode} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=/i, 'runner output must not leak connection strings');
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

function assertColumns(pg, name, tableName, columns) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      AND column_name = ANY(ARRAY[${quoteList(columns)}]);
    `,
    columns.length
  );
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
  console.log('FRESH_BASELINE_SEED_V1_V2_V3_FRESH_RBAC=PASS');

  const checksum = runRunner(pg, '--checksum').stdout.trim();
  assert.match(checksum, /20260910_tcdx_commercial_runtime_integral_closeout checksum=[a-f0-9]{64}/);
  console.log('COMMERCIAL_RUNTIME_CHECKSUM=PASS');

  const preflight = runRunner(pg, '--preflight');
  assert.match(preflight.stdout, /migration_state=pending/);
  console.log('COMMERCIAL_RUNTIME_PREFLIGHT_PENDING=PASS');

  runRunner(pg, '--apply');
  console.log('COMMERCIAL_RUNTIME_APPLY_1=PASS');
  const secondApply = runRunner(pg, '--apply');
  assert.match(secondApply.stdout, /already_applied/);
  console.log('COMMERCIAL_RUNTIME_REAPPLY=PASS');

  assertColumns(pg, 'FINDINGS_RUNTIME_COLUMNS', 'findings', [
    'description', 'finding_type', 'source_type', 'source_id', 'owner', 'detected_by', 'due_date', 'created_by',
  ]);
  assertRelations(pg, 'COMMERCIAL_RUNTIME_RELATIONS', [
    'tenant_standard_audit',
    'tenant_company_profiles',
    'tenant_applicability_profiles',
    'tenant_applicable_controls',
    'tenant_applicable_kpis',
    'tenant_applicable_evidence_requirements',
    'tenant_applicability_exclusions',
    'tenant_applicability_runs',
    'tenant_document_object_links',
    'tenant_evidence_semantic_profiles',
    'tenant_evidence_chunks',
    'tenant_evidence_applicability_suggestions',
  ]);

  assertScalar(pg, 'NO_SEARCH_HISTORY_CONTRACT_REQUIRED', `SELECT (to_regclass('public.search_history') IS NULL)::text;`, 'true');
  assertScalar(pg, 'NO_TENANT_SEED', `SELECT count(*)::int FROM tenants;`, '0');
  assertScalar(pg, 'BACKEND_STANDARD_AUDIT_INSERT', `SELECT has_table_privilege('tcdx_backend_runtime','tenant_standard_audit','INSERT')::text;`, 'true');
  assertScalar(pg, 'BACKEND_APPLICABLE_CONTROLS_SELECT', `SELECT has_table_privilege('tcdx_backend_runtime','tenant_applicable_controls','SELECT')::text;`, 'true');
  assertScalar(pg, 'BACKEND_DOCUMENT_LINKS_SELECT', `SELECT has_table_privilege('tcdx_backend_runtime','tenant_document_object_links','SELECT')::text;`, 'true');

  psqlExec(pg, `
    UPDATE schema_migrations
    SET checksum = repeat('0', 64)
    WHERE migration_id = '20260910_tcdx_commercial_runtime_integral_closeout';
  `);
  const mismatch = runRunner(pg, '--preflight', true);
  assert.notEqual(mismatch.status, 0, 'checksum mismatch preflight must fail closed');
  assert.match(mismatch.stderr, /checksum differs/i);
  console.log('COMMERCIAL_RUNTIME_CHECKSUM_MISMATCH_FAIL_CLOSED=PASS');
  console.log('TCDX_COMMERCIAL_RUNTIME_INTEGRAL_CLOSEOUT_POSTGRES_TEST=PASS');
} finally {
  stopPostgres(pg);
}
