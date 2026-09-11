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
const dependencyPath = path.join(root, 'database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql');
const lifecyclePath = path.join(root, 'database/migrations/20260911_tcdx_control_lifecycle_systemic_closeout.sql');
const migrationPath = path.join(root, 'database/migrations/20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js');

const runner = require('./apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout');

const TENANT_EMPTY = '10000000-0000-4000-8000-000000000091';
const STANDARD = 'ISO_EMPTY_2026';

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
  dependency: readSql(dependencyPath),
  lifecycle: readSql(lifecyclePath),
  migration: readSql(migrationPath),
};

runner.validateSql(sql.migration);
assert.equal(runner.LOCK_KEY, 2026091102);
assert.equal(runner.MIGRATION.id, '20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout');
assert.match(runner.readMigration().checksum, /^[a-f0-9]{64}$/);
assert.doesNotMatch(sql.migration, new RegExp('refresh_' + 'kpi_health_snapshots', 'i'));
assert.doesNotMatch(sql.migration, /control_health_scores/i);
assert.match(sql.migration, /CREATE OR REPLACE VIEW public\.v_health_remediation_plan/i);
assert.match(sql.migration, /GRANT SELECT ON[\s\S]*TO tcdx_backend_runtime/i);

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

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=${actual}`);
}

function assertNoRequiredViews(pg, label) {
  assertScalar(pg, label, `
    WITH required(name) AS (
      VALUES
        ('v_control_health_risks'),
        ('v_health_root_causes_by_standard'),
        ('v_health_remediation_summary_by_tenant'),
        ('v_health_remediation_plan'),
        ('v_remediation_executive_by_tenant'),
        ('v_remediation_executive_by_standard'),
        ('v_evidence_approval_queue'),
        ('v_audit_evidence_timeline'),
        ('v_audit_action_plan_timeline'),
        ('v_audit_event_log_enriched'),
        ('v_controls_recovered_by_remediation')
    )
    SELECT COUNT(*)::int
    FROM required
    WHERE to_regclass('public.' || name) IS NOT NULL;
  `, '0');
}

function setupEmptyTenant(pg) {
  psqlExec(pg, `
    INSERT INTO standards (standard_code, family, display_name, version_label, is_active)
    VALUES ('${STANDARD}', 'test', 'Empty Test Standard', '2026', true)
    ON CONFLICT (standard_code) DO UPDATE SET is_active = true;

    INSERT INTO tenants (id, slug, name)
    VALUES ('${TENANT_EMPTY}', 'post-lifecycle-empty', 'Post Lifecycle Empty Tenant')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_standards (tenant_id, standard_code, catalog_mode, is_active, lifecycle_status)
    VALUES ('${TENANT_EMPTY}', '${STANDARD}', 'generic', true, 'active')
    ON CONFLICT (tenant_id, standard_code)
    DO UPDATE SET is_active = true, lifecycle_status = 'active';
  `);
}

async function main() {
  let pg;
  try {
    pg = await createPostgres({ name: 'tcdx-post-lifecycle-runtime-consumers-test' });
    psqlExec(pg, sql.schema, { timeout: 120000 });
    psqlExec(pg, sql.seed, { timeout: 120000 });
    for (const key of ['v1', 'v2', 'v3', 'fresh', 'rbac', 'commercial', 'dependency', 'lifecycle']) {
      psqlExec(pg, sql[key], { timeout: 120000 });
    }
    setupEmptyTenant(pg);

    const checksum = runNode(pg, runnerPath, ['--checksum']).stdout.trim();
    assert.match(checksum, /^[a-f0-9]{64}$/);
    console.log(`POST_LIFECYCLE_RUNTIME_CONSUMERS_CHECKSUM=${checksum}`);

    assertNoRequiredViews(pg, 'POST_LIFECYCLE_PENDING_PREFLIGHT_INITIAL_VIEWS');
    const pendingPreflight = runNode(pg, runnerPath, ['--preflight']);
    assert.match(pendingPreflight.stdout, /migration_state=pending/);
    assert.match(pendingPreflight.stdout, /postconditions_deferred_until_apply=true/);
    assert.match(pendingPreflight.stdout, /POST_LIFECYCLE_RUNTIME_CONSUMERS_PREFLIGHT_PASS/);
    assertNoRequiredViews(pg, 'POST_LIFECYCLE_PENDING_PREFLIGHT_CREATED_VIEWS');
    console.log('POST_LIFECYCLE_PENDING_PREFLIGHT_WITHOUT_VIEWS_PASS');

    const first = runNode(pg, runnerPath, ['--apply']);
    assert.match(first.stdout, /POST_LIFECYCLE_RUNTIME_CONSUMERS_APPLY_PASS/);

    const appliedPreflight = runNode(pg, runnerPath, ['--preflight']);
    assert.match(appliedPreflight.stdout, /migration_state=already_applied/);
    assert.match(appliedPreflight.stdout, /required_views_ready=true/);
    assert.match(appliedPreflight.stdout, /backend_select_ready=true/);
    assert.match(appliedPreflight.stdout, /backend_runtime_can_login=false/);
    assert.match(appliedPreflight.stdout, /POST_LIFECYCLE_RUNTIME_CONSUMERS_PREFLIGHT_PASS/);
    console.log('POST_LIFECYCLE_ALREADY_APPLIED_PREFLIGHT_POSTCONDITIONS_PASS');

    const second = runNode(pg, runnerPath, ['--apply']);
    assert.match(second.stdout, /POST_LIFECYCLE_RUNTIME_CONSUMERS_ALREADY_APPLIED/);

    assertScalar(pg, 'POST_LIFECYCLE_REQUIRED_VIEWS_READY', `
      WITH required(name) AS (
        VALUES
          ('v_control_health_risks'),
          ('v_health_root_causes_by_standard'),
          ('v_health_remediation_summary_by_tenant'),
          ('v_health_remediation_plan'),
          ('v_remediation_executive_by_tenant'),
          ('v_remediation_executive_by_standard'),
          ('v_evidence_approval_queue'),
          ('v_audit_evidence_timeline'),
          ('v_audit_action_plan_timeline'),
          ('v_audit_event_log_enriched'),
          ('v_controls_recovered_by_remediation')
      )
      SELECT bool_and(to_regclass('public.' || name) IS NOT NULL) FROM required;
    `, 't');

    assertScalar(pg, 'POST_LIFECYCLE_EMPTY_TENANT_HEALTH_200_ROWS', `
      SELECT COUNT(*)::int
      FROM public.v_health_remediation_plan
      WHERE tenant_id = '${TENANT_EMPTY}'::uuid;
    `, '0');

    assertScalar(pg, 'POST_LIFECYCLE_EMPTY_TENANT_AUDIT_QUEUE_200_ROWS', `
      SELECT COUNT(*)::int
      FROM public.v_evidence_approval_queue
      WHERE tenant_id = '${TENANT_EMPTY}'::uuid;
    `, '0');

    assertScalar(pg, 'POST_LIFECYCLE_NO_SCORE_INVENTED', `
      SELECT COUNT(*)::int
      FROM public.v_control_health_risks
      WHERE tenant_id = '${TENANT_EMPTY}'::uuid
        AND health_score = 0;
    `, '0');

    psqlExec(pg, `
      UPDATE schema_migrations
      SET checksum = repeat('0', 64)
      WHERE migration_id = '${runner.MIGRATION.id}';
    `);
    const mismatch = runNode(pg, runnerPath, ['--apply'], true);
    assert.notEqual(mismatch.status, 0, 'checksum mismatch must fail closed');
    assert.match(mismatch.stderr + mismatch.stdout, /checksum differs/i);
    console.log('POST_LIFECYCLE_CHECKSUM_MISMATCH_REJECTED=PASS');

    console.log('POST_LIFECYCLE_RUNTIME_CONSUMERS_ISOLATED_POSTGRES_TEST_PASS');
  } finally {
    if (pg) await stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
