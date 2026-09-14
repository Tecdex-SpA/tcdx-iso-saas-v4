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
const migrationPath = path.join(root, 'database/migrations/20260914_ai_guided_canonical_knowledge_runtime_grants.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js');

const setupRunnerPaths = [
  path.join(root, 'scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js'),
  path.join(root, 'scripts/release-rbac/apply-release-rbac-capability-closeout.js'),
  path.join(root, 'scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js'),
  path.join(root, 'scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js'),
  path.join(root, 'scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js'),
  path.join(root, 'scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js'),
  path.join(root, 'scripts/normalization/apply-ai-core-runtime-context-grants.js'),
];

const runner = require('./apply-ai-guided-canonical-knowledge-runtime-grants');

const CANONICAL_GRANT_RELATIONS = [
  'public.knowledge_audit_questions',
  'public.knowledge_common_gaps',
  'public.knowledge_evidence_expectations',
  'public.knowledge_mappings',
  'public.knowledge_recommended_actions',
  'public.knowledge_rule_hints',
  'public.knowledge_rules',
];

const PREEXISTING_RUNTIME_SELECT = [
  'public.iso_evidence_expectations',
  'public.knowledge_items',
  'public.knowledge_sources',
  'public.recommendation_decision_ledger',
  'public.tenant_applicable_evidence_requirements',
];

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const sql = {
  schema: readSql(schemaPath),
  seed: readSql(seedPath),
  migration: readSql(migrationPath),
  runner: readSql(runnerPath),
};

runner.validateSql(sql.migration);
assert.equal(runner.LOCK_KEY, 2026091402);
assert.equal(runner.MIGRATION.id, '20260914_ai_guided_canonical_knowledge_runtime_grants');
assert.deepEqual(runner.CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS, CANONICAL_GRANT_RELATIONS);
assert.deepEqual(runner.PREEXISTING_CANONICAL_KNOWLEDGE_RUNTIME_SELECT_RELATIONS, PREEXISTING_RUNTIME_SELECT);
assert.match(runner.readMigration().checksum, /^[a-f0-9]{64}$/);

for (const relation of CANONICAL_GRANT_RELATIONS) {
  assert.match(
    sql.migration,
    new RegExp(`GRANT\\s+SELECT\\s+ON\\s+${relation.replace('.', '\\.')}\\s+TO\\s+tcdx_backend_runtime`, 'i'),
    `${relation} SELECT grant missing`
  );
  assert.ok(
    runner.AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS.includes(relation),
    `${relation} must be in derived runtime public SELECT allowlist`
  );
}

for (const relation of PREEXISTING_RUNTIME_SELECT) {
  assert.ok(
    runner.AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS.includes(relation),
    `${relation} preexisting SELECT contract must be in derived allowlist`
  );
}

assert.equal(
  (sql.migration.match(/GRANT\s+SELECT\s+ON\s+public\.knowledge_/gi) || []).length,
  CANONICAL_GRANT_RELATIONS.length,
  'migration must contain exactly the seven canonical knowledge SELECT grants'
);
assert.doesNotMatch(sql.migration, /GRANT\s+ALL/i, 'must not grant ALL');
assert.doesNotMatch(sql.migration, /ON\s+ALL\s+TABLES\s+IN\s+SCHEMA/i, 'must not grant schema-wide SELECT');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bTO\s+tcdx_backend_app\b/i, 'must not grant directly to app login role');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bTO\s+ai_reader\b/i, 'must not grant to ai_reader');
assert.doesNotMatch(sql.migration, /ALTER\s+(VIEW|TABLE|SCHEMA|ROLE)|OWNER\s+TO/i, 'must not alter ownership or roles');
assert.doesNotMatch(sql.migration, /CREATE\s+(VIEW|TABLE|SCHEMA|ROLE)|DROP\s+/i, 'must not create/drop objects');
assert.match(sql.migration, /rolcanlogin[\s\S]*tcdx_backend_runtime/i, 'runtime NOLOGIN postcondition missing');
assert.match(sql.migration, /rolinherit[\s\S]*tcdx_backend_app/i, 'app INHERIT postcondition missing');
assert.match(sql.migration, /pg_has_role\('tcdx_backend_app',\s*'tcdx_backend_runtime',\s*'member'\)/i, 'app membership postcondition missing');
assert.match(sql.runner, /extractRuntimeSelectRelationsFromSql/, 'runner must derive public SELECT allowlist from versioned SQL');
assert.match(sql.runner, /sanitize\(error\)/, 'runner must sanitize errors');

assert.deepEqual(runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON foo TO tcdx_backend_runtime;'), ['public.foo']);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON foo, public.bar TO tcdx_backend_runtime;'),
  ['public.bar', 'public.foo']
);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT, INSERT, UPDATE ON foo TO tcdx_backend_runtime;'),
  ['public.foo']
);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON TABLE public.foo TO tcdx_backend_runtime;'),
  ['public.foo']
);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON\n  public.foo,\n  bar\nTO tcdx_backend_runtime;'),
  ['public.bar', 'public.foo']
);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON VIEW public.foo TO tcdx_backend_runtime;'),
  ['public.foo']
);
assert.deepEqual(
  runner.extractRuntimeSelectRelationsFromSql('GRANT SELECT ON SCHEMA public TO tcdx_backend_runtime;'),
  []
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

function runSetupRunner(pg, scriptPath) {
  const result = runNode(pg, scriptPath, ['--apply']);
  assert.match(
    result.stdout,
    /APPLY|APPLIED|OK|PASS|already_applied/i,
    `${path.relative(root, scriptPath)} must report an apply marker`
  );
  console.log(`AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_SETUP_${path.basename(scriptPath, '.js').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}=PASS`);
}

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=${actual}`);
}

function namesValues(relations) {
  return relations.map((relation) => `('${relation}')`).join(',\n        ');
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

function assertAllPrivileges(pg, prefix, relations, role, privilege, expected) {
  assertScalar(pg, `${prefix}_${role.toUpperCase()}_${privilege}`, `
    WITH required(name) AS (
      VALUES
        ${namesValues(relations)}
    )
    SELECT bool_and(has_table_privilege('${role}', name, '${privilege}')) FROM required;
  `, expected);
}

function assertNoPrivilegeCount(pg, prefix, relations, role, privileges) {
  assertScalar(pg, `${prefix}_${role.toUpperCase()}_${privileges.join('_')}_COUNT`, `
    WITH required(name) AS (
      VALUES
        ${namesValues(relations)}
    )
    SELECT count(*)::int
    FROM required
    WHERE ${privileges.map((privilege) => `has_table_privilege('${role}', name, '${privilege}')`).join('\n       OR ')};
  `, '0');
}

function assertDirectAppSelectCount(pg, prefix) {
  assertScalar(pg, `${prefix}_APP_DIRECT_SELECT_COUNT`, `
    WITH required(name) AS (
      VALUES
        ${namesValues(CANONICAL_GRANT_RELATIONS)}
    )
    SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
    JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname || '.' || c.relname IN (SELECT name FROM required)
      AND grantee.rolname = 'tcdx_backend_app'
      AND acl.privilege_type = 'SELECT';
  `, '0');
}

function assertUnexpectedPublicSelectCount(pg, prefix, expected) {
  assertScalar(pg, `${prefix}_UNEXPECTED_RUNTIME_PUBLIC_SELECT`, `
    WITH allowed(name) AS (
      VALUES
        ${namesValues(runner.AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS)}
    )
    SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','v','m','p')
      AND has_table_privilege('tcdx_backend_runtime', c.oid, 'SELECT')
      AND NOT EXISTS (
        SELECT 1
        FROM allowed
        WHERE to_regclass(allowed.name) = c.oid
      );
  `, expected);
}

function assertRoleContract(pg, prefix) {
  assertScalar(pg, `${prefix}_RUNTIME_SCHEMA_USAGE_PUBLIC`, `
    SELECT has_schema_privilege('tcdx_backend_runtime', 'public', 'USAGE');
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
}

async function main() {
  let pg;
  try {
    pg = await createPostgres({ name: 'tcdx-ai-guided-canonical-knowledge-runtime-grants-test' });
    psqlExec(pg, sql.schema, { timeout: 120000 });
    psqlExec(pg, sql.seed, { timeout: 120000 });
    setupBackendAppRole(pg);
    for (const scriptPath of setupRunnerPaths) runSetupRunner(pg, scriptPath);

    assertRoleContract(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE');
    assertAllPrivileges(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE_PREEXISTING', PREEXISTING_RUNTIME_SELECT, 'tcdx_backend_runtime', 'SELECT', 't');
    assertAllPrivileges(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE_PREEXISTING_APP', PREEXISTING_RUNTIME_SELECT, 'tcdx_backend_app', 'SELECT', 't');
    assertScalar(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE_NEW_SELECT_COUNT', `
      WITH required(name) AS (
        VALUES
          ${namesValues(CANONICAL_GRANT_RELATIONS)}
      )
      SELECT count(*)::int
      FROM required
      WHERE has_table_privilege('tcdx_backend_runtime', name, 'SELECT')
         OR has_table_privilege('tcdx_backend_app', name, 'SELECT');
    `, '0');
    assertNoPrivilegeCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE', CANONICAL_GRANT_RELATIONS, 'ai_reader', ['SELECT']);
    assertUnexpectedPublicSelectCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BEFORE', '0');

    psqlExec(pg, 'GRANT SELECT ON public.knowledge_audit_questions TO tcdx_backend_runtime;');
    assertScalar(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_PARTIAL_PREGRANT_SELECT_COUNT', `
      WITH required(name) AS (
        VALUES
          ${namesValues(CANONICAL_GRANT_RELATIONS)}
      )
      SELECT count(*)::int
      FROM required
      WHERE has_table_privilege('tcdx_backend_runtime', name, 'SELECT');
    `, '1');

    const checksum = runNode(pg, runnerPath, ['--checksum']).stdout.trim();
    assert.match(checksum, /^[a-f0-9]{64}$/);
    console.log(`AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_CHECKSUM=${checksum}`);

    const pendingPreflight = runNode(pg, runnerPath, ['--preflight']);
    assert.match(pendingPreflight.stdout, /migration_state=pending/);
    assert.match(pendingPreflight.stdout, /runtime_select_count=1/);
    assert.match(pendingPreflight.stdout, /AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_PREFLIGHT_PASS/);
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_PENDING_PREFLIGHT_PARTIAL_CONVERGENCE_PASS');

    const first = runNode(pg, runnerPath, ['--apply']);
    assert.match(first.stdout, /AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_APPLY_PASS/);
    assertRoleContract(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER');
    assertAllPrivileges(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER', CANONICAL_GRANT_RELATIONS, 'tcdx_backend_runtime', 'SELECT', 't');
    assertAllPrivileges(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER_APP', CANONICAL_GRANT_RELATIONS, 'tcdx_backend_app', 'SELECT', 't');
    assertNoPrivilegeCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER_RUNTIME', CANONICAL_GRANT_RELATIONS, 'tcdx_backend_runtime', ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
    assertNoPrivilegeCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER_AI_READER', CANONICAL_GRANT_RELATIONS, 'ai_reader', ['SELECT']);
    assertDirectAppSelectCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER');
    assertUnexpectedPublicSelectCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER', '0');

    psqlExec(pg, `
      SET ROLE tcdx_backend_app;
      SELECT count(*) FROM public.knowledge_audit_questions;
      SELECT count(*) FROM public.knowledge_common_gaps;
      SELECT count(*) FROM public.knowledge_evidence_expectations;
      SELECT count(*) FROM public.knowledge_mappings;
      SELECT count(*) FROM public.knowledge_recommended_actions;
      SELECT count(*) FROM public.knowledge_rule_hints;
      SELECT count(*) FROM public.knowledge_rules;
      RESET ROLE;
    `);
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_BACKEND_APP_INHERITED_SELECT_EXECUTION_PASS');

    const appliedPreflight = runNode(pg, runnerPath, ['--preflight']);
    assert.match(appliedPreflight.stdout, /migration_state=already_applied/);
    assert.match(appliedPreflight.stdout, /runtime_select_ready=true/);
    assert.match(appliedPreflight.stdout, /app_inherited_select_ready=true/);
    assert.match(appliedPreflight.stdout, /ai_reader_select_count=0/);
    assert.match(appliedPreflight.stdout, /AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_PREFLIGHT_PASS/);
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_ALREADY_APPLIED_PREFLIGHT_PASS');

    const second = runNode(pg, runnerPath, ['--apply']);
    assert.match(second.stdout, /AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_ALREADY_APPLIED/);
    assertUnexpectedPublicSelectCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_AFTER_REAPPLY', '0');
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_REAPPLY_IDEMPOTENT_PASS');

    psqlExec(pg, `
      CREATE TABLE public.ai_guided_canonical_knowledge_runtime_grants_negative_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      );
      GRANT SELECT ON public.ai_guided_canonical_knowledge_runtime_grants_negative_probe TO tcdx_backend_runtime;
    `);
    assertUnexpectedPublicSelectCount(pg, 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_NEGATIVE_PROBE', '1');
    const unexpectedGrant = runNode(pg, runnerPath, ['--preflight'], true);
    assert.notEqual(unexpectedGrant.status, 0, 'unexpected public SELECT grant must fail closed');
    assert.match(unexpectedGrant.stdout + unexpectedGrant.stderr, /unexpected_runtime_public_select_count=1/);
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_UNEXPECTED_SELECT_REJECTED=PASS');
    psqlExec(pg, `
      REVOKE SELECT ON public.ai_guided_canonical_knowledge_runtime_grants_negative_probe FROM tcdx_backend_runtime;
      DROP TABLE public.ai_guided_canonical_knowledge_runtime_grants_negative_probe;
    `);

    psqlExec(pg, `
      UPDATE public.schema_migrations
      SET checksum = repeat('0', 64)
      WHERE migration_id = '${runner.MIGRATION.id}';
    `);
    const mismatch = runNode(pg, runnerPath, ['--apply'], true);
    assert.notEqual(mismatch.status, 0, 'checksum mismatch must fail closed');
    assert.match(mismatch.stderr + mismatch.stdout, /checksum differs/i);
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_CHECKSUM_MISMATCH_REJECTED=PASS');

    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_ISOLATED_POSTGRES_TEST_PASS');
  } finally {
    if (pg) await stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
