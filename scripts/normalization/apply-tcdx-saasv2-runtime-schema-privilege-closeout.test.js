#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const migrationPath = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const schemaSql = readSql(schemaPath);
const seedSql = readSql(seedPath);
const migrationSql = readSql(migrationPath);

for (const [name, sql] of [
  ['schema', schemaSql],
  ['seed', seedSql],
  ['migration', migrationSql],
]) {
  assert.doesNotMatch(sql, /\btecdex_saas\b/i, `${name} must not reference tecdex_saas`);
}

assert.match(migrationSql, /BEGIN;/, 'closeout migration must be transactional');
assert.match(migrationSql, /COMMIT;/, 'closeout migration must close transaction');
assert.match(migrationSql, /pg_try_advisory_xact_lock\(844332,\s*2026090901\)/, 'closeout migration must use advisory lock');
assert.doesNotMatch(migrationSql, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'migration must not grant all tables');
assert.doesNotMatch(migrationSql, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, 'migration must not grant all functions');

function quoteList(values) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(',');
}

function assertScalar(pg, name, sql, expected) {
  const actual = psqlExec(pg, sql).stdout.trim();
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name} PASS`);
}

function assertSql(pg, name, sql) {
  psqlExec(pg, sql);
  console.log(`${name} PASS`);
}

function assertSqlFails(pg, name, sql, pattern = /violates foreign key constraint|permission denied/i) {
  const result = psqlExec(pg, sql, { allowFailure: true });
  assert.notEqual(result.status, 0, `${name}: SQL unexpectedly succeeded`);
  assert.match(result.stderr, pattern, `${name}: unexpected failure: ${result.stderr}`);
  console.log(`${name} PASS`);
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

function assertBackendPrivilege(pg, name, relationName, privileges) {
  for (const privilege of privileges) {
    assertScalar(
      pg,
      `${name}_${privilege}`,
      `SELECT has_table_privilege('tcdx_backend_runtime', '${relationName}', '${privilege}')::text;`,
      'true'
    );
  }
}

const pg = createPostgres();
try {
  psqlExec(pg, schemaSql);
  psqlExec(pg, seedSql);
  console.log('BASELINE_AND_SEED_FRESH PASS');

  psqlExec(pg, migrationSql);
  console.log('CLOSEOUT_MIGRATION_APPLY_1 PASS');
  psqlExec(pg, migrationSql);
  console.log('CLOSEOUT_MIGRATION_APPLY_2 PASS');

  assertColumns(pg, 'TENANT_LIFECYCLE_COLUMNS', 'tenants', [
    'suspended_at',
    'suspension_reason',
    'deleted_at',
    'deletion_reason',
  ]);

  assertRelations(pg, 'OPERATIONAL_TABLES_AND_VIEWS', [
    'tenant_operations',
    'tenant_standard_operations',
    'assets',
    'asset_standards',
    'asset_risks',
    'audits',
    'risks',
    'risk_control_relations',
    'v_iso_control_effective_health',
  ]);

  assertRelations(pg, 'COMMERCIAL_VIEWS', [
    'v_commercial_tenant_subscription',
    'v_commercial_tenant_modules',
    'v_commercial_tenant_capabilities',
    'v_tenant_commercial_entitlements',
    'v_commercial_tenant_health',
  ]);

  assertRelations(pg, 'KPI_SUMMARY_VIEW', ['v_iso_effective_kpi_summary']);
  assertColumns(pg, 'KPI_SUMMARY_RUNTIME_COLUMNS', 'v_iso_effective_kpi_summary', [
    'tenant_id',
    'iso',
    'standard_code',
    'operation_id',
    'operation_name',
    'operation_code',
    'operation_type',
    'total_controls',
    'controls_count',
    'avg_effective_health_score',
    'effective_health_score',
    'effective_health_status',
    'kpi_health_status',
  ]);

  assertScalar(
    pg,
    'KPI_SUMMARY_AUTHORITY',
    `
    SELECT (
      pg_get_viewdef('public.v_iso_effective_kpi_summary'::regclass) ~ 'v_iso_control_effective_health'
      AND pg_get_viewdef('public.v_iso_effective_kpi_summary'::regclass) !~* 'control_health_scores|KPI-HLT'
      AND pg_get_viewdef('public.v_iso_effective_kpi_summary'::regclass) ~ 'F5_5_CONTROL_EFFECTIVENESS'
    )::text;
    `,
    'true'
  );

  assertRelations(pg, 'ISO_RISK_MATRIX_OBJECTS', [
    'iso_risk_templates',
    'iso_risk_matrix_runs',
    'iso_risk_matrix_items',
    'iso_risk_matrix_actions',
    'iso_risk_matrix_audit_log',
    'v_iso_risk_matrix_latest_runs',
    'v_iso_risk_matrix_summary',
  ]);

  assertScalar(
    pg,
    'ISO_RISK_MATRIX_NO_PUBLIC_CONTROLS_DEPENDENCY',
    `
    SELECT (
      pg_get_viewdef('public.v_iso_risk_matrix_summary'::regclass) !~* '\\mcontrols\\M'
      AND pg_get_viewdef('public.v_iso_risk_matrix_latest_runs'::regclass) !~* '\\mcontrols\\M'
    )::text;
    `,
    'true'
  );

  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const operationA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const operationB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  assertSql(
    pg,
    'TENANT_STANDARD_OPERATIONS_VALID_INSERT',
    `
    INSERT INTO tenants(id, slug, name) VALUES
      ('${tenantA}', 'runtime-closeout-a', 'Runtime Closeout A'),
      ('${tenantB}', 'runtime-closeout-b', 'Runtime Closeout B');
    INSERT INTO tenant_standards(tenant_id, standard_code) VALUES
      ('${tenantA}', 'ISO_27001_2022'),
      ('${tenantB}', 'ISO_27001_2022');
    INSERT INTO tenant_operations(id, tenant_id, operation_key, name) VALUES
      ('${operationA}', '${tenantA}', 'op-a', 'Operation A'),
      ('${operationB}', '${tenantB}', 'op-b', 'Operation B');
    INSERT INTO tenant_standard_operations(tenant_id, standard_code, operation_id)
    VALUES ('${tenantA}', 'ISO_27001_2022', '${operationA}');
    `
  );

  assertSqlFails(
    pg,
    'TENANT_STANDARD_OPERATIONS_CROSS_TENANT_FK_BLOCK',
    `
    INSERT INTO tenant_standard_operations(tenant_id, standard_code, operation_id)
    VALUES ('${tenantA}', 'ISO_27001_2022', '${operationB}');
    `,
    /fk_runtime_tso_operation_same_tenant|violates foreign key constraint/i
  );

  const runB = '33333333-3333-4333-8333-333333333333';
  const assetB = '44444444-4444-4444-8444-444444444444';
  assertSql(
    pg,
    'ISO_RISK_MATRIX_TENANT_FIXTURE',
    `
    INSERT INTO assets(id, tenant_id, asset_key, name) VALUES ('${assetB}', '${tenantB}', 'asset-b', 'Asset B');
    INSERT INTO iso_risk_matrix_runs(id, tenant_id, standard_code, version_code)
    VALUES ('${runB}', '${tenantB}', 'ISO27001', '2022');
    `
  );
  assertSqlFails(
    pg,
    'ISO_RISK_MATRIX_CROSS_TENANT_RUN_FK_BLOCK',
    `
    INSERT INTO iso_risk_matrix_items(run_id, tenant_id, standard_code, version_code, risk_title)
    VALUES ('${runB}', '${tenantA}', 'ISO27001', '2022', 'Cross tenant run');
    `,
    /fk_iso_risk_matrix_items_run_same_tenant|violates foreign key constraint/i
  );
  assertSqlFails(
    pg,
    'ISO_RISK_MATRIX_CROSS_TENANT_ASSET_FK_BLOCK',
    `
    INSERT INTO iso_risk_matrix_items(run_id, tenant_id, standard_code, version_code, asset_id, risk_title)
    VALUES ('${runB}', '${tenantB}', 'ISO27001', '2022', '${assetB}', 'Valid item');
    INSERT INTO iso_risk_matrix_items(run_id, tenant_id, standard_code, version_code, asset_id, risk_title)
    VALUES ('${runB}', '${tenantA}', 'ISO27001', '2022', '${assetB}', 'Cross tenant asset');
    `,
    /fk_iso_risk_matrix_items_run_same_tenant|fk_iso_risk_matrix_items_asset_same_tenant|violates foreign key constraint/i
  );

  for (const table of [
    'tenant_operations',
    'tenant_standard_operations',
    'assets',
    'asset_standards',
    'asset_risks',
    'risks',
    'risk_control_relations',
    'audits',
    'iso_risk_templates',
    'iso_risk_matrix_runs',
    'iso_risk_matrix_items',
    'iso_risk_matrix_actions',
    'iso_risk_matrix_audit_log',
  ]) {
    assertBackendPrivilege(pg, `RUNTIME_GRANTS_${table}`, table, ['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
  }

  for (const view of [
    'v_iso_control_effective_health',
    'v_iso_effective_kpi_summary',
    'v_iso_risk_matrix_latest_runs',
    'v_iso_risk_matrix_summary',
    'v_commercial_tenant_subscription',
    'v_commercial_tenant_modules',
    'v_commercial_tenant_capabilities',
    'v_tenant_commercial_entitlements',
    'v_commercial_tenant_health',
    'commercial_addons',
  ]) {
    assertBackendPrivilege(pg, `RUNTIME_GRANTS_${view}`, view, ['SELECT']);
  }

  assertScalar(
    pg,
    'LEGACY_PROHIBITED_OBJECTS_ABSENT',
    `
    WITH forbidden(name) AS (
      VALUES
        ('controls'),
        ('control_health_scores'),
        ('v_latest_health_kpi_snapshots'),
        ('refresh_control_health_scores_v2_1')
    )
    SELECT count(*)::int
    FROM forbidden f
    WHERE to_regclass('public.' || f.name) IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = f.name
       );
    `,
    0
  );

  assertSql(pg, 'TENANT_FIXTURE_CLEANUP', "DELETE FROM tenants WHERE slug LIKE 'runtime-closeout-%';");
  assertScalar(pg, 'FINAL_TENANTS_ZERO', 'SELECT count(*)::int FROM tenants;', 0);

  console.log('TCDX_SAASV2_RUNTIME_CLOSEOUT_MIGRATION_TEST PASS');
} finally {
  stopPostgres(pg);
}
