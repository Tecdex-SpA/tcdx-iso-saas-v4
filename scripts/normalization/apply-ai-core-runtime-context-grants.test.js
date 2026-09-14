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
const runtimeSchemaPrivilegePath = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql');
const runtimeContractV2Path = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql');
const grcRuntimeContractV3Path = path.join(root, 'database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql');
const migrationPath = path.join(root, 'database/migrations/20260914_ai_core_runtime_context_view_grants.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-ai-core-runtime-context-grants.js');
const freshRuntimeRunnerPath = path.join(root, 'scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js');

const runner = require('./apply-ai-core-runtime-context-grants');

const REQUIRED_VIEWS = [
  'ai_core.v_tenant_health_context',
  'ai_core.v_control_context',
  'ai_core.v_finding_context',
  'ai_core.v_kpi_context',
];

const PREEXISTING_EXTERNAL_LOOKUP_RUNTIME_SELECT = [
  'ai_core.external_lookup_extra_charges',
  'ai_core.external_lookup_logs',
  'ai_core.external_lookup_quota_audit',
  'ai_core.external_lookup_quotas',
  'ai_core.v_external_lookup_usage_monthly',
];

const AUTHORIZED_AI_CORE_RUNTIME_SELECT = [
  ...PREEXISTING_EXTERNAL_LOOKUP_RUNTIME_SELECT,
  ...REQUIRED_VIEWS,
];

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const sql = {
  schema: readSql(schemaPath),
  seed: readSql(seedPath),
  runtimeSchemaPrivilege: readSql(runtimeSchemaPrivilegePath),
  runtimeContractV2: readSql(runtimeContractV2Path),
  grcRuntimeContractV3: readSql(grcRuntimeContractV3Path),
  migration: readSql(migrationPath),
  runner: readSql(runnerPath),
};

runner.validateSql(sql.migration);
assert.equal(runner.LOCK_KEY, 2026091401);
assert.equal(runner.MIGRATION.id, '20260914_ai_core_runtime_context_view_grants');
assert.deepEqual(runner.AI_CORE_CONTEXT_VIEWS, REQUIRED_VIEWS);
assert.deepEqual(runner.PREEXISTING_AI_CORE_RUNTIME_SELECT_RELATIONS, PREEXISTING_EXTERNAL_LOOKUP_RUNTIME_SELECT);
assert.deepEqual(runner.AUTHORIZED_AI_CORE_RUNTIME_SELECT_RELATIONS, AUTHORIZED_AI_CORE_RUNTIME_SELECT);
assert.match(runner.readMigration().checksum, /^[a-f0-9]{64}$/);
assert.doesNotMatch(sql.runner, /c\.relname\s*<>\s*'v_external_lookup_usage_monthly'/, 'runner must not use ad hoc single-object exclusions');

for (const view of REQUIRED_VIEWS) {
  assert.match(
    sql.migration,
    new RegExp(`GRANT\\s+SELECT\\s+ON\\s+${view.replace('.', '\\.')}\\s+TO\\s+tcdx_backend_runtime`, 'i'),
    `${view} SELECT grant missing`
  );
}

assert.equal(
  (sql.migration.match(/GRANT\s+SELECT\s+ON\s+ai_core\./gi) || []).length,
  REQUIRED_VIEWS.length,
  'migration must contain exactly the four AI Core context view SELECT grants'
);
assert.doesNotMatch(sql.migration, /GRANT\s+ALL/i, 'must not grant ALL');
assert.doesNotMatch(sql.migration, /ON\s+ALL\s+TABLES\s+IN\s+SCHEMA/i, 'must not grant schema-wide SELECT');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bTO\s+tcdx_backend_app\b/i, 'must not grant directly to app login role');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bTO\s+ai_reader\b/i, 'must not grant to ai_reader');
assert.doesNotMatch(sql.migration, /ALTER\s+(VIEW|TABLE|SCHEMA|ROLE)|OWNER\s+TO/i, 'must not alter ownership or roles');
assert.doesNotMatch(sql.migration, /CREATE\s+(VIEW|TABLE|SCHEMA|ROLE)|DROP\s+/i, 'must not create/drop objects');
assert.match(sql.migration, /rolcanlogin[\s\S]*tcdx_backend_runtime/i, 'runtime NOLOGIN postcondition missing');
assert.match(sql.migration, /pg_has_role\('tcdx_backend_app',\s*'tcdx_backend_runtime',\s*'member'\)/i, 'app membership postcondition missing');
assert.match(sql.runner, /sanitize\(error\)/, 'runner must sanitize errors');

function databaseUrl(pg) {
  if (pg.container) return `postgres://postgres@127.0.0.1:${pg.port}/postgres`;
  return `postgres://postgres@/postgres?host=${encodeURIComponent(pg.socketDir)}&port=${pg.port}`;
}

function runNode(pg, args, allowFailure = false) {
  const result = spawnSync('node', [runnerPath, ...args], {
    cwd: root,
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl(pg) },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure) {
    assert.equal(result.status, 0, `node ${path.relative(root, runnerPath)} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=/i, 'script output must not leak connection strings');
  return result;
}

function runFreshRuntimeCloseout(pg) {
  const result = spawnSync('node', [freshRuntimeRunnerPath, '--apply'], {
    cwd: root,
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl(pg) },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `fresh runtime closeout setup failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=/i, 'fresh setup output must not leak connection strings');
  assert.match(result.stdout, /FRESH_RUNTIME_CONTRACT_MIGRATION_APPLIED|FRESH_RUNTIME_CONTRACT_ALREADY_APPLIED/);
  console.log('AI_CORE_CONTEXT_PREVIOUS_FRESH_RUNTIME_CONTRACT_SETUP=PASS');
}

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=${actual}`);
}

function setupBackendAppRole(pg) {
  psqlExec(pg, `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tcdx_backend_app') THEN
        CREATE ROLE tcdx_backend_app LOGIN INHERIT;
      END IF;
    END $$;
    GRANT tcdx_backend_runtime TO tcdx_backend_app;
  `);
}

function namesValues(relations) {
  return relations.map((relation) => `('${relation}')`).join(',\n        ');
}

function assertRuntimeSelectRelations(pg, name, relations, expected) {
  assertScalar(pg, name, `
    WITH required(name) AS (
      VALUES
        ${namesValues(relations)}
    )
    SELECT bool_and(has_table_privilege('tcdx_backend_runtime', name, 'SELECT')) FROM required;
  `, expected);
}

function assertViewPrivileges(pg, prefix) {
  assertScalar(pg, `${prefix}_RUNTIME_SCHEMA_USAGE`, `
    SELECT has_schema_privilege('tcdx_backend_runtime', 'ai_core', 'USAGE');
  `, 't');
  assertScalar(pg, `${prefix}_RUNTIME_NOLOGIN`, `
    SELECT rolcanlogin FROM pg_roles WHERE rolname = 'tcdx_backend_runtime';
  `, 'f');
  assertScalar(pg, `${prefix}_APP_INHERIT`, `
    SELECT rolinherit FROM pg_roles WHERE rolname = 'tcdx_backend_app';
  `, 't');
  assertScalar(pg, `${prefix}_APP_MEMBER_RUNTIME`, `
    SELECT pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member');
  `, 't');
  assertScalar(pg, `${prefix}_RUNTIME_SELECT_FOUR_VIEWS`, `
    WITH required(name) AS (
      VALUES
        ('ai_core.v_tenant_health_context'),
        ('ai_core.v_control_context'),
        ('ai_core.v_finding_context'),
        ('ai_core.v_kpi_context')
    )
    SELECT bool_and(has_table_privilege('tcdx_backend_runtime', name, 'SELECT')) FROM required;
  `, 't');
  assertScalar(pg, `${prefix}_APP_INHERITED_SELECT_FOUR_VIEWS`, `
    WITH required(name) AS (
      VALUES
        ('ai_core.v_tenant_health_context'),
        ('ai_core.v_control_context'),
        ('ai_core.v_finding_context'),
        ('ai_core.v_kpi_context')
    )
    SELECT bool_and(has_table_privilege('tcdx_backend_app', name, 'SELECT')) FROM required;
  `, 't');
  assertScalar(pg, `${prefix}_AI_READER_SELECT_FOUR_VIEWS`, `
    WITH required(name) AS (
      VALUES
        ('ai_core.v_tenant_health_context'),
        ('ai_core.v_control_context'),
        ('ai_core.v_finding_context'),
        ('ai_core.v_kpi_context')
    )
    SELECT count(*)::int FROM required WHERE has_table_privilege('ai_reader', name, 'SELECT');
  `, '0');
  assertScalar(pg, `${prefix}_RUNTIME_DML_FOUR_VIEWS`, `
    WITH required(name) AS (
      VALUES
        ('ai_core.v_tenant_health_context'),
        ('ai_core.v_control_context'),
        ('ai_core.v_finding_context'),
        ('ai_core.v_kpi_context')
    )
    SELECT count(*)::int
    FROM required
    WHERE has_table_privilege('tcdx_backend_runtime', name, 'INSERT')
       OR has_table_privilege('tcdx_backend_runtime', name, 'UPDATE')
       OR has_table_privilege('tcdx_backend_runtime', name, 'DELETE');
  `, '0');
  assertScalar(pg, `${prefix}_UNEXPECTED_RUNTIME_AI_CORE_SELECT`, `
    WITH allowed(name) AS (
      VALUES
        ${namesValues(AUTHORIZED_AI_CORE_RUNTIME_SELECT)}
    )
    SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ai_core'
      AND c.relkind IN ('r','v','m','p')
      AND has_table_privilege('tcdx_backend_runtime', c.oid, 'SELECT')
      AND NOT EXISTS (
        SELECT 1
        FROM allowed
        WHERE to_regclass(allowed.name) = c.oid
      );
  `, '0');
}

async function main() {
  let pg;
  try {
    pg = await createPostgres({ name: 'tcdx-ai-core-runtime-context-grants-test' });
    psqlExec(pg, sql.schema, { timeout: 120000 });
    psqlExec(pg, sql.seed, { timeout: 120000 });
    psqlExec(pg, sql.runtimeSchemaPrivilege, { timeout: 120000 });
    psqlExec(pg, sql.runtimeContractV2, { timeout: 120000 });
    psqlExec(pg, sql.grcRuntimeContractV3, { timeout: 120000 });
    runFreshRuntimeCloseout(pg);
    setupBackendAppRole(pg);

    assertRuntimeSelectRelations(
      pg,
      'AI_CORE_CONTEXT_PREEXISTING_EXTERNAL_LOOKUP_RUNTIME_SELECT',
      PREEXISTING_EXTERNAL_LOOKUP_RUNTIME_SELECT,
      't'
    );
    assertScalar(pg, 'AI_CORE_CONTEXT_INITIAL_RUNTIME_SELECT_FOUR_VIEWS', `
      WITH required(name) AS (
        VALUES
          ('ai_core.v_tenant_health_context'),
          ('ai_core.v_control_context'),
          ('ai_core.v_finding_context'),
          ('ai_core.v_kpi_context')
      )
      SELECT count(*)::int FROM required WHERE has_table_privilege('tcdx_backend_runtime', name, 'SELECT');
    `, '0');

    const checksum = runNode(pg, ['--checksum']).stdout.trim();
    assert.match(checksum, /^[a-f0-9]{64}$/);
    console.log(`AI_CORE_RUNTIME_CONTEXT_GRANTS_CHECKSUM=${checksum}`);

    const pendingPreflight = runNode(pg, ['--preflight']);
    assert.match(pendingPreflight.stdout, /migration_state=pending/);
    assert.match(pendingPreflight.stdout, /postconditions_deferred_until_apply=true/);
    assert.match(pendingPreflight.stdout, /AI_CORE_RUNTIME_CONTEXT_GRANTS_PREFLIGHT_PASS/);
    console.log('AI_CORE_RUNTIME_CONTEXT_GRANTS_PENDING_PREFLIGHT_PASS');

    const first = runNode(pg, ['--apply']);
    assert.match(first.stdout, /AI_CORE_RUNTIME_CONTEXT_GRANTS_APPLY_PASS/);
    assertViewPrivileges(pg, 'AI_CORE_CONTEXT_AFTER_APPLY');

    psqlExec(pg, `
      SET ROLE tcdx_backend_app;
      SELECT count(*) FROM ai_core.v_tenant_health_context;
      SELECT count(*) FROM ai_core.v_control_context;
      SELECT count(*) FROM ai_core.v_finding_context;
      SELECT count(*) FROM ai_core.v_kpi_context;
      RESET ROLE;
    `);
    console.log('AI_CORE_CONTEXT_BACKEND_APP_INHERITED_SELECT_EXECUTION_PASS');

    const appliedPreflight = runNode(pg, ['--preflight']);
    assert.match(appliedPreflight.stdout, /migration_state=already_applied/);
    assert.match(appliedPreflight.stdout, /runtime_select_ready=true/);
    assert.match(appliedPreflight.stdout, /app_inherited_select_ready=true/);
    assert.match(appliedPreflight.stdout, /ai_reader_select_any=false/);
    assert.match(appliedPreflight.stdout, /AI_CORE_RUNTIME_CONTEXT_GRANTS_PREFLIGHT_PASS/);
    console.log('AI_CORE_RUNTIME_CONTEXT_GRANTS_ALREADY_APPLIED_PREFLIGHT_PASS');

    const second = runNode(pg, ['--apply']);
    assert.match(second.stdout, /AI_CORE_RUNTIME_CONTEXT_GRANTS_ALREADY_APPLIED/);
    assertViewPrivileges(pg, 'AI_CORE_CONTEXT_AFTER_REAPPLY');

    psqlExec(pg, `
      CREATE TABLE ai_core.runtime_grants_negative_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      );
      GRANT SELECT ON ai_core.runtime_grants_negative_probe TO tcdx_backend_runtime;
    `);
    const unexpectedGrant = runNode(pg, ['--preflight'], true);
    assert.notEqual(unexpectedGrant.status, 0, 'unexpected ai_core SELECT grant must fail closed');
    assert.match(unexpectedGrant.stdout + unexpectedGrant.stderr, /unexpected_runtime_ai_core_select_count=1/);
    console.log('AI_CORE_RUNTIME_CONTEXT_GRANTS_UNEXPECTED_SELECT_REJECTED=PASS');
    psqlExec(pg, `
      REVOKE SELECT ON ai_core.runtime_grants_negative_probe FROM tcdx_backend_runtime;
      DROP TABLE ai_core.runtime_grants_negative_probe;
    `);

    psqlExec(pg, `
      UPDATE public.schema_migrations
      SET checksum = repeat('0', 64)
      WHERE migration_id = '${runner.MIGRATION.id}';
    `);
    const mismatch = runNode(pg, ['--apply'], true);
    assert.notEqual(mismatch.status, 0, 'checksum mismatch must fail closed');
    assert.match(mismatch.stderr + mismatch.stdout, /checksum differs/i);
    console.log('AI_CORE_RUNTIME_CONTEXT_GRANTS_CHECKSUM_MISMATCH_REJECTED=PASS');

    console.log('AI_CORE_RUNTIME_CONTEXT_GRANTS_ISOLATED_POSTGRES_TEST_PASS');
  } finally {
    if (pg) await stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
