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
const migrationPath = path.join(root, 'database/migrations/20260911_tcdx_control_lifecycle_systemic_closeout.sql');
const runnerPath = path.join(root, 'scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js');

const runner = require('./apply-tcdx-control-lifecycle-systemic-closeout');
const {
  effectiveCatalogOrder,
  standardMembershipPredicate,
} = require(path.join(root, 'backend/src/services/controlCatalogLifecycle.service'));

const STANDARD = 'ISO_27001_2022';
const CROSS_PRIMARY_STANDARD = 'ISO_9001_2015';
const CROSS_REQUESTED_STANDARD = 'ISO_CROSS_STANDARD_2026';
const TENANT_A = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '10000000-0000-4000-8000-000000000002';
const TENANT_PERSONALIZED = '10000000-0000-4000-8000-000000000003';
const TENANT_CROSS_STANDARD = '10000000-0000-4000-8000-000000000004';
const OP_A = '20000000-0000-4000-8000-000000000001';
const OP_B = '20000000-0000-4000-8000-000000000002';
const OP_PERSONALIZED = '20000000-0000-4000-8000-000000000003';
const OP_CROSS_STANDARD = '20000000-0000-4000-8000-000000000004';

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
  migration: readSql(migrationPath),
};

assert.match(sql.migration, /CREATE OR REPLACE FUNCTION public\.tcdx_effective_control_catalog/i);
assert.match(sql.migration, /tenant_applicable_controls/i);
assert.doesNotMatch(sql.migration, /cc\.source_type\s*=\s*'generic'/i);
assert.doesNotMatch(sql.migration, /\bcontrol_health_scores\b/i);
assert.doesNotMatch(sql.migration, /\bKPI-HLT\b/i);
runner.validateSql(sql.migration);
assert.equal(runner.LOCK_KEY, 2026091101);
assert.equal(runner.MIGRATION.id, '20260911_tcdx_control_lifecycle_systemic_closeout');
assert.match(runner.readMigration().checksum, /^[a-f0-9]{64}$/);
assert.match(
  standardMembershipPredicate({ standardCodeSql: "' iso_27001_2022 '::text" }),
  /upper\(trim\(cc\.iso\)\)[\s\S]*upper\(trim\(' iso_27001_2022 '::text\)\)[\s\S]*upper\(trim\(ccs_scope\.standard_code\)\)/i
);
assert.match(
  effectiveCatalogOrder({ tenantIdSql: "'00000000-0000-4000-8000-000000000000'::uuid", standardCodeSql: "' iso_27001_2022 '::text" }),
  /upper\(trim\(cc\.iso\)\)\s*=\s*upper\(trim\(' iso_27001_2022 '::text\)\)/i
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

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=${actual}`);
}

function setupLifecycleFixture(pg) {
  psqlExec(pg, `
    DELETE FROM tenant_applicable_controls;
    DELETE FROM tenant_controls;
    DELETE FROM tenant_standard_operations;
    DELETE FROM tenant_operations;
    DELETE FROM tenant_standards;
    DELETE FROM controls_catalog_standards WHERE standard_code = '${STANDARD}';
    DELETE FROM controls_catalog WHERE iso = '${STANDARD}';
    INSERT INTO standards (standard_code, family, display_name, version_label, is_active)
    VALUES ('${STANDARD}', 'information_security', 'ISO 27001:2022', '2022', true)
    ON CONFLICT (standard_code) DO UPDATE SET is_active = true;

    INSERT INTO tenants (id, slug, name)
    VALUES
      ('${TENANT_A}', 'control-lifecycle-a', 'Control Lifecycle Tenant A'),
      ('${TENANT_B}', 'control-lifecycle-b', 'Control Lifecycle Tenant B'),
      ('${TENANT_PERSONALIZED}', 'control-lifecycle-personalized', 'Control Lifecycle Personalized Tenant')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_standards (tenant_id, standard_code, catalog_mode, is_active, lifecycle_status)
    VALUES
      ('${TENANT_A}', '${STANDARD}', 'generic', true, 'active'),
      ('${TENANT_B}', '${STANDARD}', 'mixed', true, 'active'),
      ('${TENANT_PERSONALIZED}', '${STANDARD}', 'personalized', true, 'active')
    ON CONFLICT (tenant_id, standard_code)
    DO UPDATE SET catalog_mode = EXCLUDED.catalog_mode, is_active = true, lifecycle_status = 'active';

    INSERT INTO tenant_operations (id, tenant_id, operation_key, code, name, operation_type, is_active, is_default)
    VALUES
      ('${OP_A}', '${TENANT_A}', 'op-a', 'op-a', 'Operation A', 'principal', true, true),
      ('${OP_B}', '${TENANT_B}', 'op-b', 'op-b', 'Operation B', 'principal', true, true),
      ('${OP_PERSONALIZED}', '${TENANT_PERSONALIZED}', 'op-p', 'op-p', 'Operation Personalized', 'principal', true, true)
    ON CONFLICT (tenant_id, operation_key) DO NOTHING;

    INSERT INTO tenant_standard_operations (tenant_id, standard_code, operation_id, is_active)
    VALUES
      ('${TENANT_A}', '${STANDARD}', '${OP_A}', true),
      ('${TENANT_B}', '${STANDARD}', '${OP_B}', true),
      ('${TENANT_PERSONALIZED}', '${STANDARD}', '${OP_PERSONALIZED}', true)
    ON CONFLICT (tenant_id, standard_code, operation_id) DO NOTHING;

    INSERT INTO controls_catalog (code, clause, category, title, description, iso, source_type, tenant_id, is_active)
    SELECT
      'LC-' || lpad(n::text, 3, '0'),
      'A.' || n::text,
      'Lifecycle',
      'Lifecycle control ' || n::text,
      'Lifecycle control ' || n::text,
      '${STANDARD}',
      CASE WHEN n <= 30 THEN 'knowledge_base_seed_v2' ELSE 'migrated_reference_from_qa' END,
      NULL::uuid,
      true
    FROM generate_series(1, 51) AS g(n);

    INSERT INTO controls_catalog (code, clause, category, title, description, iso, source_type, tenant_id, base_control_id, is_active)
    SELECT 'LC-B-REPL-001', 'A.1 tenant', 'Lifecycle', 'Tenant replacement control', 'Tenant replacement control',
      '${STANDARD}', 'personalized', '${TENANT_B}', id, true
    FROM controls_catalog
    WHERE iso = '${STANDARD}' AND code = 'LC-001';

    INSERT INTO controls_catalog (code, clause, category, title, description, iso, source_type, tenant_id, is_active)
    VALUES
      ('LC-B-EXTRA-001', 'B.1', 'Lifecycle', 'Tenant B extra 1', 'Tenant B extra 1', '${STANDARD}', 'custom_import', '${TENANT_B}', true),
      ('LC-B-EXTRA-002', 'B.2', 'Lifecycle', 'Tenant B extra 2', 'Tenant B extra 2', '${STANDARD}', 'personalized', '${TENANT_B}', true),
      ('LC-P-001', 'P.1', 'Lifecycle', 'Personalized only 1', 'Personalized only 1', '${STANDARD}', 'custom_import', '${TENANT_PERSONALIZED}', true),
      ('LC-P-002', 'P.2', 'Lifecycle', 'Personalized only 2', 'Personalized only 2', '${STANDARD}', 'personalized', '${TENANT_PERSONALIZED}', true),
      ('LC-A-PRIVATE-001', 'A-private', 'Lifecycle', 'Tenant A private should not leak', 'Tenant A private should not leak', '${STANDARD}', 'custom_import', '${TENANT_A}', true);

    INSERT INTO tenant_controls (
      tenant_id, control_id, tenant_standard_id, operation_id, status, score, health_status,
      applicability, priority, metadata
    )
    SELECT
      '${TENANT_A}',
      cc.id,
      ts.id,
      '${OP_A}',
      'pendiente',
      NULL::numeric,
      'sin_datos',
      'aplicable',
      'media',
      jsonb_build_object('source', 'broken_pre_backfill_fixture')
    FROM controls_catalog cc
    JOIN tenant_standards ts
      ON ts.tenant_id = '${TENANT_A}'::uuid
     AND ts.standard_code = '${STANDARD}'
    WHERE cc.iso = '${STANDARD}'
      AND cc.tenant_id IS NULL
      AND cc.is_active IS TRUE;
  `);
}

function setupCrossStandardFixture(pg) {
  psqlExec(pg, `
    INSERT INTO standards (standard_code, family, display_name, version_label, is_active)
    VALUES
      ('${CROSS_PRIMARY_STANDARD}', 'quality', 'ISO 9001:2015', '2015', true),
      ('${CROSS_REQUESTED_STANDARD}', 'cross_standard', 'Cross-standard requested context', '2026', true)
    ON CONFLICT (standard_code) DO UPDATE SET is_active = true;

    INSERT INTO tenants (id, slug, name)
    VALUES ('${TENANT_CROSS_STANDARD}', 'control-lifecycle-cross-standard', 'Control Lifecycle Cross Standard Tenant')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_standards (tenant_id, standard_code, catalog_mode, is_active, lifecycle_status)
    VALUES ('${TENANT_CROSS_STANDARD}', '${CROSS_REQUESTED_STANDARD}', 'generic', true, 'active')
    ON CONFLICT (tenant_id, standard_code)
    DO UPDATE SET catalog_mode = EXCLUDED.catalog_mode, is_active = true, lifecycle_status = 'active';

    INSERT INTO tenant_operations (id, tenant_id, operation_key, code, name, operation_type, is_active, is_default)
    VALUES ('${OP_CROSS_STANDARD}', '${TENANT_CROSS_STANDARD}', 'op-cross-standard', 'op-cross-standard', 'Operation Cross Standard', 'principal', true, true)
    ON CONFLICT (tenant_id, operation_key) DO NOTHING;

    INSERT INTO tenant_standard_operations (tenant_id, standard_code, operation_id, is_active)
    VALUES ('${TENANT_CROSS_STANDARD}', '${CROSS_REQUESTED_STANDARD}', '${OP_CROSS_STANDARD}', true)
    ON CONFLICT (tenant_id, standard_code, operation_id) DO NOTHING;

    WITH inserted_control AS (
      INSERT INTO controls_catalog (code, clause, category, title, description, iso, source_type, tenant_id, is_active)
      VALUES (
        'LC-XSTD-001',
        'X.1',
        'Lifecycle',
        'Cross-standard linked control',
        'Primary iso differs from requested standard',
        '${CROSS_PRIMARY_STANDARD}',
        'knowledge_base_seed_v2',
        NULL::uuid,
        true
      )
      RETURNING id
    )
    INSERT INTO controls_catalog_standards (control_id, standard_code, is_primary)
    SELECT id, '${CROSS_REQUESTED_STANDARD}', false
    FROM inserted_control;
  `);
}

function initializeControls(pg, tenantId, standard = STANDARD) {
  psqlExec(pg, `
    WITH standard_state AS (
      SELECT id, tenant_id, standard_code, catalog_mode
      FROM tenant_standards
      WHERE tenant_id = '${tenantId}'::uuid
        AND standard_code = '${standard}'
        AND is_active IS TRUE
        AND lifecycle_status = 'active'
    ),
    selected_operation AS (
      SELECT tso.tenant_id, tso.standard_code, tso.operation_id
      FROM tenant_standard_operations tso
      JOIN tenant_operations op
        ON op.tenant_id = tso.tenant_id
       AND op.id = tso.operation_id
       AND op.is_active IS TRUE
      JOIN standard_state ss
        ON ss.tenant_id = tso.tenant_id
       AND ss.standard_code = tso.standard_code
      WHERE tso.is_active IS TRUE
      ORDER BY op.is_default DESC, op.sort_order, op.id
      LIMIT 1
    )
    INSERT INTO tenant_controls (
      tenant_id, control_id, tenant_standard_id, operation_id, status, score, health_status,
      applicability, priority, metadata
    )
    SELECT
      ss.tenant_id,
      ec.control_catalog_id,
      ss.id,
      so.operation_id,
      'pendiente',
      NULL::numeric,
      'sin_datos',
      'aplicable',
      'media',
      jsonb_build_object('source', 'isolated_lifecycle_initialize')
    FROM standard_state ss
    JOIN selected_operation so
      ON so.tenant_id = ss.tenant_id
     AND so.standard_code = ss.standard_code
    JOIN LATERAL public.tcdx_effective_control_catalog(ss.tenant_id, ss.standard_code, ss.catalog_mode) ec ON TRUE
    WHERE NOT EXISTS (
      SELECT 1
      FROM tenant_controls tc
      WHERE tc.tenant_id = ss.tenant_id
        AND tc.control_id = ec.control_catalog_id
    );
  `);
}

function reconcileApplicability(pg, tenantId, standard = STANDARD) {
  psqlExec(pg, `
    WITH active_standards AS (
      SELECT id, tenant_id, standard_code, catalog_mode
      FROM tenant_standards
      WHERE tenant_id = '${tenantId}'::uuid
        AND standard_code = '${standard}'
        AND is_active IS TRUE
        AND lifecycle_status = 'active'
    ),
    effective_tenant_controls AS (
      SELECT tc.tenant_id, tc.id AS tenant_control_id, tc.control_id AS control_catalog_id,
        ast.standard_code, ec.control_code, COALESCE(ec.title, ec.description, ec.control_code, 'Control') AS control_name,
        tc.priority, ast.catalog_mode
      FROM active_standards ast
      JOIN tenant_controls tc
        ON tc.tenant_id = ast.tenant_id
       AND tc.tenant_standard_id = ast.id
      JOIN LATERAL public.tcdx_effective_control_catalog(ast.tenant_id, ast.standard_code, ast.catalog_mode) ec
        ON ec.control_catalog_id = tc.control_id
    )
    INSERT INTO tenant_applicable_controls (
      tenant_id, tenant_control_id, control_catalog_id, standard_code, control_code, control_name,
      applicability_status, applicability_reason, applicability_score, priority, profile_drivers,
      calculation_weight, must_exist, visible_to_tenant, active, source
    )
    SELECT
      etc.tenant_id, etc.tenant_control_id, etc.control_catalog_id, etc.standard_code, etc.control_code,
      etc.control_name, 'applicable', 'isolated_reconciliation', NULL::numeric,
      COALESCE(etc.priority, 'media'), jsonb_build_object('catalog_mode', etc.catalog_mode),
      1, true, true, true, 'isolated_lifecycle_reconciliation'
    FROM effective_tenant_controls etc
    WHERE NOT EXISTS (
      SELECT 1
      FROM tenant_applicable_controls tac
      WHERE tac.tenant_id = etc.tenant_id
        AND (
          tac.tenant_control_id = etc.tenant_control_id
          OR (
            tac.tenant_control_id IS NULL
            AND tac.control_catalog_id = etc.control_catalog_id
            AND COALESCE(tac.standard_code, etc.standard_code) = etc.standard_code
          )
        )
    );
  `);
}

function assertLifecycleCounts(pg, tenantId, expected) {
  assertScalar(pg, `${expected.label}_CATALOG_CONTROLS`, `SELECT COUNT(*)::int FROM public.tcdx_effective_control_catalog('${tenantId}'::uuid, '${STANDARD}', '${expected.mode}');`, expected.catalog);
  assertScalar(pg, `${expected.label}_TENANT_CONTROLS`, `SELECT COUNT(*)::int FROM tenant_controls WHERE tenant_id = '${tenantId}'::uuid;`, expected.tenantControls);
  assertScalar(pg, `${expected.label}_APPLICABLE_VISIBLE`, `SELECT COUNT(*)::int FROM tenant_applicable_controls WHERE tenant_id = '${tenantId}'::uuid AND active IS TRUE AND visible_to_tenant IS TRUE;`, expected.applicableVisible);
  assertScalar(pg, `${expected.label}_DUPLICATE_TENANT_CONTROLS`, `SELECT COUNT(*)::int FROM (SELECT control_id FROM tenant_controls WHERE tenant_id = '${tenantId}'::uuid GROUP BY control_id HAVING COUNT(*) > 1) d;`, '0');
  assertScalar(pg, `${expected.label}_DUPLICATE_APPLICABILITY`, `SELECT COUNT(*)::int FROM (SELECT tenant_control_id, COALESCE(standard_code, '') FROM tenant_applicable_controls WHERE tenant_id = '${tenantId}'::uuid GROUP BY tenant_control_id, COALESCE(standard_code, '') HAVING COUNT(*) > 1) d;`, '0');
  assertScalar(pg, `${expected.label}_NO_SCORES_INVENTED`, `SELECT COUNT(*)::int FROM tenant_controls WHERE tenant_id = '${tenantId}'::uuid AND score IS NOT NULL;`, '0');
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
  psqlExec(pg, sql.dependency);
  console.log('CONTROL_LIFECYCLE_PRIOR_RUNTIME_CHAIN=PASS');

  setupLifecycleFixture(pg);
  assertScalar(pg, 'PRE_BACKFILL_TENANT_CONTROLS', `SELECT COUNT(*)::int FROM tenant_controls WHERE tenant_id = '${TENANT_A}'::uuid;`, '51');
  assertScalar(pg, 'PRE_BACKFILL_APPLICABLE_VISIBLE', `SELECT COUNT(*)::int FROM tenant_applicable_controls WHERE tenant_id = '${TENANT_A}'::uuid AND active IS TRUE AND visible_to_tenant IS TRUE;`, '0');

  const checksum = runNode(pg, runnerPath, ['--checksum']).stdout.trim();
  assert.match(checksum, /20260911_tcdx_control_lifecycle_systemic_closeout checksum=[a-f0-9]{64}/);
  console.log('CONTROL_LIFECYCLE_CHECKSUM=PASS');

  const preflight = runNode(pg, runnerPath, ['--preflight']);
  assert.match(preflight.stdout, /migration_state=pending/);
  console.log('CONTROL_LIFECYCLE_PREFLIGHT_PENDING=PASS');

  runNode(pg, runnerPath, ['--apply']);
  console.log('CONTROL_LIFECYCLE_BACKFILL_APPLY=PASS');
  const secondApply = runNode(pg, runnerPath, ['--apply']);
  assert.match(secondApply.stdout, /already_applied/);
  console.log('CONTROL_LIFECYCLE_REAPPLY=PASS');

  assertLifecycleCounts(pg, TENANT_A, {
    label: 'GENERIC',
    mode: 'generic',
    catalog: 51,
    tenantControls: 51,
    applicableVisible: 51,
  });
  assertScalar(pg, 'GENERIC_DIAGNOSTIC_EFFECTIVE_CATALOG', `SELECT COUNT(*)::int FROM public.tcdx_effective_control_catalog('${TENANT_A}'::uuid, '${STANDARD}', 'generic') WHERE catalog_scope = 'global';`, '51');
  assertScalar(pg, 'GENERIC_HEALTH_ROWS', `SELECT COUNT(*)::int FROM public.v_iso_control_effective_health WHERE tenant_id = '${TENANT_A}'::uuid AND standard_code = '${STANDARD}';`, '51');
  assertScalar(pg, 'GENERIC_HEALTH_SCORED', `SELECT COUNT(*)::int FROM public.v_iso_control_effective_health WHERE tenant_id = '${TENANT_A}'::uuid AND standard_code = '${STANDARD}' AND effective_health_score IS NOT NULL;`, '0');
  assertScalar(pg, 'GENERIC_HEALTH_WITHOUT_SCORE', `SELECT COUNT(*)::int FROM public.v_iso_control_effective_health WHERE tenant_id = '${TENANT_A}'::uuid AND standard_code = '${STANDARD}' AND effective_health_score IS NULL;`, '51');

  setupCrossStandardFixture(pg);
  assertScalar(pg, 'CROSS_STANDARD_EFFECTIVE_CATALOG_NORMALIZED_REQUEST', `SELECT COUNT(*)::int FROM public.tcdx_effective_control_catalog('${TENANT_CROSS_STANDARD}'::uuid, ' ${CROSS_REQUESTED_STANDARD.toLowerCase()} ', 'generic');`, '1');
  initializeControls(pg, TENANT_CROSS_STANDARD, CROSS_REQUESTED_STANDARD);
  reconcileApplicability(pg, TENANT_CROSS_STANDARD, CROSS_REQUESTED_STANDARD);
  assertScalar(pg, 'CROSS_STANDARD_EFFECTIVE_CATALOG', `SELECT COUNT(*)::int FROM public.tcdx_effective_control_catalog('${TENANT_CROSS_STANDARD}'::uuid, '${CROSS_REQUESTED_STANDARD}', 'generic');`, '1');
  assertScalar(pg, 'CROSS_STANDARD_TENANT_CONTROLS', `SELECT COUNT(*)::int FROM tenant_controls WHERE tenant_id = '${TENANT_CROSS_STANDARD}'::uuid;`, '1');
  assertScalar(pg, 'CROSS_STANDARD_TENANT_CONTROL_MATERIALIZED_FROM_MAPPING', `SELECT COUNT(*)::int FROM tenant_controls tc JOIN controls_catalog cc ON cc.id = tc.control_id JOIN controls_catalog_standards ccs ON ccs.control_id = cc.id WHERE tc.tenant_id = '${TENANT_CROSS_STANDARD}'::uuid AND cc.iso = '${CROSS_PRIMARY_STANDARD}' AND ccs.standard_code = '${CROSS_REQUESTED_STANDARD}';`, '1');
  assertScalar(pg, 'CROSS_STANDARD_APPLICABILITY_REQUESTED_STANDARD', `SELECT COUNT(*)::int FROM tenant_applicable_controls WHERE tenant_id = '${TENANT_CROSS_STANDARD}'::uuid AND standard_code = '${CROSS_REQUESTED_STANDARD}';`, '1');
  assertScalar(pg, 'CROSS_STANDARD_APPLICABILITY_PRIMARY_ISO_CONTEXT', `SELECT COUNT(*)::int FROM tenant_applicable_controls WHERE tenant_id = '${TENANT_CROSS_STANDARD}'::uuid AND standard_code = '${CROSS_PRIMARY_STANDARD}';`, '0');
  assertScalar(pg, 'CROSS_STANDARD_NO_DUPLICATE_EFFECTIVE_CATALOG', `SELECT COUNT(*)::int FROM (SELECT control_catalog_id FROM public.tcdx_effective_control_catalog('${TENANT_CROSS_STANDARD}'::uuid, '${CROSS_REQUESTED_STANDARD}', 'generic') GROUP BY control_catalog_id HAVING COUNT(*) > 1) d;`, '0');
  assertScalar(pg, 'CROSS_STANDARD_NO_CROSS_TENANT_LEAKAGE', `SELECT COUNT(*)::int FROM tenant_controls tc JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tc.tenant_id <> '${TENANT_CROSS_STANDARD}'::uuid AND cc.code = 'LC-XSTD-001';`, '0');
  assertScalar(pg, 'CROSS_STANDARD_NO_SCORE_INVENTED', `SELECT COUNT(*)::int FROM tenant_controls WHERE tenant_id = '${TENANT_CROSS_STANDARD}'::uuid AND score IS NOT NULL;`, '0');
  assertScalar(pg, 'CROSS_STANDARD_HEALTH_SIN_DATOS', `SELECT COUNT(*)::int FROM public.v_iso_control_effective_health h JOIN controls_catalog cc ON cc.id = h.catalog_control_id WHERE h.tenant_id = '${TENANT_CROSS_STANDARD}'::uuid AND cc.code = 'LC-XSTD-001' AND h.effective_health_score IS NULL AND h.effective_health_status = 'sin_datos';`, '1');

  initializeControls(pg, TENANT_A);
  reconcileApplicability(pg, TENANT_A);
  assertLifecycleCounts(pg, TENANT_A, {
    label: 'GENERIC_SECOND_RUN',
    mode: 'generic',
    catalog: 51,
    tenantControls: 51,
    applicableVisible: 51,
  });

  initializeControls(pg, TENANT_PERSONALIZED);
  reconcileApplicability(pg, TENANT_PERSONALIZED);
  assertLifecycleCounts(pg, TENANT_PERSONALIZED, {
    label: 'PERSONALIZED',
    mode: 'personalized',
    catalog: 2,
    tenantControls: 2,
    applicableVisible: 2,
  });
  assertScalar(pg, 'PERSONALIZED_GLOBAL_LEAKAGE', `SELECT COUNT(*)::int FROM tenant_controls tc JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tc.tenant_id = '${TENANT_PERSONALIZED}'::uuid AND cc.tenant_id IS NULL;`, '0');

  initializeControls(pg, TENANT_B);
  reconcileApplicability(pg, TENANT_B);
  assertLifecycleCounts(pg, TENANT_B, {
    label: 'MIXED',
    mode: 'mixed',
    catalog: 53,
    tenantControls: 53,
    applicableVisible: 53,
  });
  assertScalar(pg, 'MIXED_REPLACEMENT_DEDUPED', `SELECT COUNT(*)::int FROM tenant_controls tc JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tc.tenant_id = '${TENANT_B}'::uuid AND (cc.code = 'LC-001' OR cc.code = 'LC-B-REPL-001');`, '1');

  psqlExec(pg, `
    UPDATE tenant_applicable_controls
    SET active = false,
        visible_to_tenant = false,
        applicability_status = 'excluded',
        applicability_reason = 'human_exclusion_preserved',
        source = 'human_review'
    WHERE id = (
      SELECT tac.id
      FROM tenant_applicable_controls tac
      JOIN tenant_controls tc ON tc.id = tac.tenant_control_id
      JOIN controls_catalog cc ON cc.id = tc.control_id
      WHERE tac.tenant_id = '${TENANT_B}'::uuid
        AND cc.code = 'LC-B-EXTRA-001'
      LIMIT 1
    );
  `);
  reconcileApplicability(pg, TENANT_B);
  assertScalar(pg, 'HUMAN_EXCLUSION_PRESERVED', `SELECT COUNT(*)::int FROM tenant_applicable_controls tac JOIN tenant_controls tc ON tc.id = tac.tenant_control_id JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tac.tenant_id = '${TENANT_B}'::uuid AND cc.code = 'LC-B-EXTRA-001' AND tac.active IS FALSE AND tac.visible_to_tenant IS FALSE AND tac.source = 'human_review';`, '1');
  assertScalar(pg, 'HUMAN_EXCLUSION_NO_DUPLICATE', `SELECT COUNT(*)::int FROM tenant_applicable_controls tac JOIN tenant_controls tc ON tc.id = tac.tenant_control_id JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tac.tenant_id = '${TENANT_B}'::uuid AND cc.code = 'LC-B-EXTRA-001';`, '1');

  assertScalar(pg, 'CROSS_TENANT_PERSONALIZED_ISOLATION', `SELECT COUNT(*)::int FROM tenant_controls tc JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tc.tenant_id = '${TENANT_A}'::uuid AND cc.tenant_id = '${TENANT_B}'::uuid;`, '0');
  assertScalar(pg, 'CROSS_TENANT_APPLICABILITY_ISOLATION', `SELECT COUNT(*)::int FROM tenant_applicable_controls tac JOIN controls_catalog cc ON cc.id = tac.control_catalog_id WHERE tac.tenant_id = '${TENANT_A}'::uuid AND cc.tenant_id = '${TENANT_B}'::uuid;`, '0');
  assertScalar(pg, 'APPLICABILITY_NO_SCORES_INVENTED', `SELECT COUNT(*)::int FROM tenant_applicable_controls WHERE applicability_score IS NOT NULL;`, '0');

  psqlExec(pg, `
    UPDATE schema_migrations
    SET checksum = repeat('0', 64)
    WHERE migration_id = '20260911_tcdx_control_lifecycle_systemic_closeout';
  `);
  const mismatch = runNode(pg, runnerPath, ['--preflight'], true);
  assert.notEqual(mismatch.status, 0, 'checksum mismatch preflight must fail closed');
  assert.match(mismatch.stderr, /checksum differs/i);
  console.log('CONTROL_LIFECYCLE_CHECKSUM_MISMATCH_FAIL_CLOSED=PASS');
  console.log('TCDX_CONTROL_LIFECYCLE_SYSTEMIC_CLOSEOUT_POSTGRES_TEST=PASS');
} finally {
  stopPostgres(pg);
}
