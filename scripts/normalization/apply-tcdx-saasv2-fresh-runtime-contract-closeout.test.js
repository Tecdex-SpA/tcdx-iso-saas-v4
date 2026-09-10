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
const migrationPath = path.join(root, 'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js');
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
  migration: readSql(migrationPath),
};

for (const [name, text] of Object.entries(sql)) {
  assert.doesNotMatch(text, /\btecdex_saas\b/i, `${name} must not reference legacy DB`);
  assert.doesNotMatch(text, /\btcdx_saasv2\b/i, `${name} must not reference real fresh DB`);
  assert.doesNotMatch(text, /andres\.barouh@tecdex\.net/i, `${name} must not hardcode user email`);
  assert.doesNotMatch(text, /70000000-0000-0000-0000-000000000701/i, `${name} must not hardcode QA tenant id`);
}

assert.match(sql.migration, /BEGIN;/, 'fresh runtime migration must be transactional');
assert.match(sql.migration, /COMMIT;/, 'fresh runtime migration must commit');
assert.match(sql.migration, /pg_try_advisory_xact_lock\(844332,\s*2026091004\)/, 'fresh runtime migration must use own advisory lock');
assert.doesNotMatch(sql.migration, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'fresh runtime migration must not grant all tables');
assert.doesNotMatch(sql.migration, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, 'fresh runtime migration must not grant all functions');
assert.doesNotMatch(sql.migration, /DROP\s+VIEW[\s\S]*?\bCASCADE\b/i, 'fresh runtime migration must not cascade-drop views');
assert.doesNotMatch(sql.migration, /INSERT\s+INTO\s+saas_price_catalog\b/i, 'fresh runtime migration must not seed invented price catalog data');
assert.doesNotMatch(sql.migration, /INSERT\s+INTO\s+ai_core\.external_lookup_quotas\b/i, 'fresh runtime migration must not seed default external lookup quota data');

const deployScript = fs.readFileSync(deployScriptPath, 'utf8');
const freshArray = deployScript.match(/FRESH_PRODUCTION_MIGRATION_RUNNERS=\([\s\S]*?\n\)/);
assert.ok(freshArray, 'fresh migration runner registry must exist');
assert.doesNotMatch(freshArray[0], /scripts\/phase[0-9-]/, 'fresh runner must not include historical phase runners');
assert.doesNotMatch(freshArray[0], /production_schema_v1\.sql|production_seed_v1\.sql|load-production-reference-catalogs\.js/, 'fresh runner must not replay bootstrap assets');

function databaseUrl(pg) {
  if (pg.container) return `postgres://postgres@127.0.0.1:${pg.port}/postgres`;
  return `postgres://postgres@/postgres?host=${encodeURIComponent(pg.socketDir)}&port=${pg.port}`;
}

function runRunner(pg, mode, allowFailure = false) {
  const result = spawnSync('node', [runnerPath, mode], {
    cwd: root,
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: databaseUrl(pg),
    },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!allowFailure) {
    assert.equal(result.status, 0, `runner ${mode} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=|DB_PASSWORD|JWT_SECRET/i, 'runner output must not leak secrets');
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

function assertSql(pg, name, query) {
  psqlExec(pg, query);
  console.log(`${name}=PASS`);
}

function assertSqlFails(pg, name, query, pattern = /permission denied|checksum differs|violates|ERROR/i) {
  const result = psqlExec(pg, query, { allowFailure: true });
  assert.notEqual(result.status, 0, `${name}: SQL unexpectedly succeeded`);
  assert.match(result.stderr, pattern, `${name}: unexpected failure: ${result.stderr}`);
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

function assertRelations(pg, name, schemaName, relationNames) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM unnest(ARRAY[${quoteList(relationNames)}]) AS required(name)
    WHERE to_regclass('${schemaName}.' || required.name) IS NOT NULL;
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
  console.log('FRESH_BASELINE_SEED_V1_V2_V3=PASS');

  const checksum = runRunner(pg, '--checksum').stdout.trim();
  assert.match(checksum, /20260910_tcdx_saasv2_fresh_runtime_contract_closeout checksum=[a-f0-9]{64}/);
  console.log('FRESH_MIGRATION_LEDGER_CHECKSUM=PASS');

  const preflight = runRunner(pg, '--preflight');
  assert.match(preflight.stdout, /migration_state=pending/);
  console.log('FRESH_MIGRATION_PREFLIGHT_PENDING=PASS');

  runRunner(pg, '--apply');
  console.log('FRESH_MIGRATION_APPLY_1=PASS');
  const secondApply = runRunner(pg, '--apply');
  assert.match(secondApply.stdout, /already_applied|pending=none/);
  console.log('FRESH_MIGRATION_IDEMPOTENCY=PASS');

  assertColumns(pg, 'FRESH_RUNTIME_USERS_CONTRACT', 'users', ['phone', 'job_title', 'avatar']);
  assertColumns(pg, 'FRESH_RUNTIME_TENANTS_CONTRACT', 'tenants', [
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
  ]);

  assertRelations(pg, 'FRESH_RUNTIME_ADMIN_SAAS_CONTRACT', 'public', [
    'tenant_contracts',
    'dealer_tenants',
    'admin_audit_log',
    'v_admin_saas_summary',
    'v_tenant_contract_overview',
    'saas_price_catalog',
    'saas_monthly_prebilling',
    'saas_monthly_prebilling_lines',
    'v_saas_prebilling_tenant_context',
  ]);
  assertRelations(pg, 'FRESH_RUNTIME_COMMERCIAL_CONTRACT', 'public', [
    'product_families',
    'commercial_editions',
    'commercial_modules',
    'commercial_features',
    'plan_version_modules',
    'plan_version_addons',
    'module_features',
    'feature_capabilities',
    'tenant_feature_overrides',
    'usage_measurements',
    'trials',
    'pack_definitions',
    'pack_versions',
    'pack_items',
    'tenant_pack_installations',
    'risk_methodology_versions',
    'audit_workpaper_template_versions',
    'v_commercial_plan_capabilities',
  ]);
  assertRelations(pg, 'FRESH_RUNTIME_DEALER_CONTRACT', 'public', ['dealer_tenants', 'v_dealer_tenants']);
  assertRelations(pg, 'FRESH_RUNTIME_MODULES_CONTRACT', 'public', ['v_tenant_modules']);
  assertRelations(pg, 'FRESH_RUNTIME_AUDIT_CONTRACT', 'public', ['admin_audit_log']);
  assertRelations(pg, 'FRESH_RUNTIME_EXTERNAL_LOOKUP_CONTRACT', 'ai_core', [
    'external_lookup_quotas',
    'external_lookup_logs',
    'external_lookup_quota_audit',
    'external_lookup_extra_charges',
    'v_external_lookup_usage_monthly',
  ]);

  assertScalar(
    pg,
    'FRESH_RUNTIME_RBAC_FUNCTIONS',
    `
    SELECT (
      to_regprocedure('public.user_has_permission(uuid,text)') IS NOT NULL
      AND to_regprocedure('public.get_user_effective_permissions(uuid)') IS NOT NULL
      AND to_regprocedure('public.log_admin_audit_event(uuid,text,uuid,text,uuid,jsonb)') IS NOT NULL
    )::text;
    `,
    'true'
  );

  assertSql(
    pg,
    'PLATFORM_ADMIN_CANONICAL_ROLE',
    `
    INSERT INTO tenants (name, rut) VALUES ('Runtime Contract Tenant', 'RUNTIME-1') RETURNING id;
    INSERT INTO users (id, email, full_name, role, effective_role, status)
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'platform.runtime@example.test', 'Platform Runtime', 'platform_admin', 'platform_admin', 'active'),
      ('10000000-0000-4000-8000-000000000002', 'tenant.runtime@example.test', 'Tenant Runtime', 'tenant_admin', 'tenant_admin', 'active'),
      ('10000000-0000-4000-8000-000000000003', 'viewer.runtime@example.test', 'Viewer Runtime', 'viewer', 'viewer', 'active');
    `
  );

  assertScalar(
    pg,
    'FRESH_RUNTIME_GOVERNANCE_CONTRACT',
    `
    SELECT (
      user_has_permission('10000000-0000-4000-8000-000000000001'::uuid, 'admin_saas.manage') = true
      AND user_has_permission('10000000-0000-4000-8000-000000000002'::uuid, 'admin_saas.manage') = false
      AND user_has_permission('10000000-0000-4000-8000-000000000003'::uuid, 'controls.manage') = false
      AND user_has_permission('10000000-0000-4000-8000-000000000003'::uuid, 'permission.never.exists') = false
      AND user_has_permission('10000000-0000-4000-8000-000000000099'::uuid, 'admin_saas.manage') = false
    )::text;
    `,
    'true'
  );

  assertSql(
    pg,
    'ADMIN_SAAS_TENANTS_QUERY_COMPILES',
    `
    PREPARE admin_saas_tenants_contract AS
    SELECT
      t.id,
      t.name,
      t.rut,
      t.business,
      t.address,
      t.branches,
      t.logo,
      t.logo_url,
      t.ai_enabled,
      t.ai_plan,
      t.ai_web_enabled,
      t.ai_report_enabled,
      t.ai_auditor_enabled,
      t.ai_monthly_quota,
      t.ai_quota_used,
      t.ai_features_json,
      COALESCE(mods.enabled_modules, 0)::int AS enabled_modules,
      COALESCE(dealers.dealer_count, 0)::int AS dealer_count,
      contract.plan_key,
      subscription.plan_display_name
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT count(*) AS enabled_modules
      FROM v_tenant_modules vm
      WHERE vm.tenant_id = t.id AND vm.is_enabled = true
    ) mods ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS dealer_count
      FROM dealer_tenants dt
      WHERE dt.tenant_id = t.id AND dt.status = 'active'
    ) dealers ON true
    LEFT JOIN LATERAL (
      SELECT *
      FROM tenant_contracts tc
      WHERE tc.tenant_id = t.id
      ORDER BY tc.updated_at DESC NULLS LAST
      LIMIT 1
    ) contract ON true
    LEFT JOIN v_commercial_tenant_subscription subscription ON subscription.tenant_id = t.id
    ORDER BY t.name;
    EXECUTE admin_saas_tenants_contract;
    `
  );

  assertSql(pg, 'FRESH_RUNTIME_METRICS_TENANT_DISCOVERY', 'SELECT id, name, service_status FROM tenants ORDER BY name LIMIT 10;');
  assertSql(pg, 'FRESH_RUNTIME_PREBILLING_CONTRACT', 'SELECT * FROM v_saas_prebilling_tenant_context LIMIT 5; SELECT * FROM saas_price_catalog ORDER BY item_type, item_key LIMIT 5;');
  assertScalar(pg, 'FRESH_RUNTIME_PRICE_CATALOG_NOT_SEEDED', 'SELECT count(*)::int FROM saas_price_catalog;', '0');
  assertScalar(pg, 'FRESH_RUNTIME_EXTERNAL_LOOKUP_DEFAULT_NOT_SEEDED', 'SELECT count(*)::int FROM ai_core.external_lookup_quotas WHERE is_default = true;', '0');
  assertSql(pg, 'FRESH_RUNTIME_AUDIT_FUNCTION', "SELECT log_admin_audit_event('10000000-0000-4000-8000-000000000001'::uuid, 'contract.test', NULL::uuid, 'test', NULL::uuid, '{}'::jsonb);");

  assertSql(
    pg,
    'FRESH_RUNTIME_PRIVILEGES',
    `
    SET ROLE tcdx_backend_runtime;
    SELECT count(*) FROM users;
    SELECT count(*) FROM v_tenant_modules;
    INSERT INTO tenants (name, rut) VALUES ('Runtime Privilege Tenant', 'RUNTIME-PRIV') RETURNING id;
    INSERT INTO tenant_contracts (tenant_id, plan_key, contract_status)
    SELECT id, 'demo', 'active' FROM tenants WHERE rut = 'RUNTIME-PRIV' LIMIT 1;
    INSERT INTO ai_core.external_lookup_quotas (tenant_id, monthly_limit, is_active)
    SELECT id, 25, true FROM tenants WHERE rut = 'RUNTIME-PRIV' LIMIT 1
    ON CONFLICT (tenant_id) WHERE tenant_id IS NOT NULL DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit;
    RESET ROLE;
    `
  );
  assertSqlFails(pg, 'FRESH_RUNTIME_PRIVILEGES_DENY_CREATE', 'SET ROLE tcdx_backend_runtime; CREATE TABLE runtime_contract_forbidden(id int);', /permission denied/i);

  psqlExec(pg, `
    UPDATE schema_migrations
    SET checksum = repeat('f', 64)::char(64)
    WHERE migration_id = '20260910_tcdx_saasv2_fresh_runtime_contract_closeout';
  `);
  const mismatch = runRunner(pg, '--preflight', true);
  assert.notEqual(mismatch.status, 0, 'checksum mismatch preflight must fail');
  assert.match(mismatch.stderr, /checksum differs/i);
  console.log('FRESH_MIGRATION_CHECKSUM_MISMATCH_ABORTS=PASS');

  console.log('NO_TENANT_SPECIFIC_FIX=PASS');
  console.log('NO_SECRET_OUTPUT=PASS');
  console.log('NO_BOOTSTRAP_REPLAY_ON_DEPLOY=PASS');
  console.log('FRESH_REJECTS_HISTORICAL_CHAIN=PASS');
} finally {
  stopPostgres(pg);
}
