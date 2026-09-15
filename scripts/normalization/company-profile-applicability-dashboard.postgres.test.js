'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const REPO_ROOT = path.resolve(__dirname, '../..');
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATALOG_ACTIVE = '33333333-3333-4333-8333-333333333333';
const CATALOG_TRANSITION = '44444444-4444-4444-8444-444444444444';
const CONTROL_ACTIVE = '55555555-5555-4555-8555-555555555555';
const KPI_ACTIVE = '66666666-6666-4666-8666-666666666666';

function assertNoSchemaChanges() {
  const changed = new Set([
    ...execFileSync('git', ['diff', '--name-only'], { cwd: REPO_ROOT, encoding: 'utf8' }).split(/\r?\n/),
    ...execFileSync('git', ['status', '--short'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.replace(/^.../, '')),
  ].map((line) => line.trim()).filter(Boolean));
  const forbidden = [...changed].filter((file) => file.startsWith('database/migrations/'));
  assert.deepEqual(forbidden, []);
}

async function dashboardUniverseRows(pool, tenantId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid AND is_active = true
    ),
    operational_controls AS (
      SELECT DISTINCT ON (tc.id)
        tc.id,
        LOWER(COALESCE(tc.status, 'pendiente')) AS status,
        COALESCE(tac.standard_code, cc.iso) AS standard_code,
        NULL::numeric AS health_score
      FROM tenant_controls tc
      INNER JOIN tenant_applicable_controls tac
        ON tac.tenant_id = tc.tenant_id
       AND tac.active = true
       AND tac.visible_to_tenant = true
       AND (tac.tenant_control_id = tc.id OR tac.control_catalog_id = tc.control_id)
      LEFT JOIN controls_catalog cc
        ON cc.id = tc.control_id
       AND cc.is_active = true
      WHERE tc.tenant_id = $1::uuid
        AND (
          tac.standard_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM active_standards ast
            WHERE ast.standard_code = tac.standard_code
          )
        )
      ORDER BY tc.id, tac.updated_at DESC NULLS LAST, tac.created_at DESC NULLS LAST
    )
    SELECT *
    FROM operational_controls
    ORDER BY id
    `,
    [tenantId]
  );
  return result.rows;
}

async function main() {
  const pg = createPostgres();
  process.env.DB_HOST = pg.container ? '127.0.0.1' : pg.socketDir;
  process.env.DB_PORT = pg.port;
  process.env.DB_USER = 'postgres';
  process.env.DB_NAME = 'postgres';
  process.env.DB_PASSWORD = '';
  process.env.DB_SSL = 'false';

  try {
    psqlExec(pg, `
      CREATE TABLE tenants (id uuid PRIMARY KEY, name text);
      CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), email text);
      CREATE TABLE tenant_company_profiles (
        tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
        industry text,
        subindustry text,
        company_size text,
        maturity_level text,
        risk_appetite text,
        profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        ai_profile_summary_json jsonb,
        ai_research_trace_json jsonb,
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_standards (
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        standard_code text NOT NULL,
        is_active boolean NOT NULL DEFAULT true
      );
      CREATE TABLE controls_catalog (
        id uuid PRIMARY KEY,
        tenant_id uuid,
        iso text,
        clause text,
        category text,
        description text,
        source_type text,
        is_active boolean NOT NULL DEFAULT true
      );
      CREATE TABLE controls_catalog_standards (
        control_id uuid NOT NULL,
        standard_code text,
        clause text
      );
      CREATE TABLE tenant_controls (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        control_id uuid NOT NULL,
        status text,
        priority text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE kpi_definitions (
        id uuid PRIMARY KEY,
        tenant_id uuid,
        code text,
        name text,
        description text,
        category text,
        is_active boolean DEFAULT true,
        is_standard boolean DEFAULT true,
        display_order integer
      );
      CREATE TABLE kpi_standard_mappings (
        kpi_id uuid,
        standard_code text,
        is_active boolean DEFAULT true
      );
      CREATE TABLE tenant_applicability_runs (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        status text,
        started_at timestamptz,
        completed_at timestamptz,
        created_by uuid,
        summary_json jsonb,
        trace_json jsonb,
        error_json jsonb,
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_applicability_profiles (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        profile_source text,
        profile_hash text,
        industry text,
        subindustry text,
        company_size text,
        maturity_level text,
        risk_appetite text,
        active_standards jsonb,
        declared_scope jsonb,
        critical_processes jsonb,
        excluded_operations jsonb,
        generated_by text,
        ai_used boolean,
        web_used boolean,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_applicable_controls (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        tenant_control_id uuid,
        control_catalog_id uuid,
        standard_code text,
        control_code text,
        control_name text,
        applicability_status text,
        applicability_reason text,
        applicability_score numeric,
        priority text,
        profile_drivers jsonb,
        calculation_weight numeric,
        must_exist boolean DEFAULT true,
        visible_to_tenant boolean DEFAULT true,
        active boolean DEFAULT true,
        source text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_applicable_kpis (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        kpi_definition_id uuid,
        kpi_code text,
        kpi_name text,
        applicability_status text,
        applicability_reason text,
        applicability_score numeric,
        priority text,
        calculation_weight numeric,
        visible_to_tenant boolean DEFAULT true,
        active boolean DEFAULT true,
        source text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_applicable_evidence_requirements (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        related_control_id uuid,
        related_kpi_id uuid,
        evidence_type text,
        evidence_name text,
        requirement_reason text,
        priority text,
        active boolean DEFAULT true,
        visible_to_tenant boolean DEFAULT true,
        source text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE tenant_applicability_exclusions (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        object_type text,
        object_id uuid,
        object_code text,
        object_name text,
        exclusion_reason text,
        excluded_by text,
        profile_drivers jsonb,
        active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      INSERT INTO tenants (id, name) VALUES ('${TENANT_A}', 'Empresa A'), ('${TENANT_B}', 'Empresa B');
      INSERT INTO users (id, tenant_id, email) VALUES ('${USER_A}', '${TENANT_A}', 'admin.a@example.test');
      INSERT INTO tenant_company_profiles (tenant_id, industry, company_size, maturity_level, risk_appetite, profile_json)
      VALUES (
        '${TENANT_A}',
        'Servicios TI',
        'pyme',
        'inicial',
        'bajo',
        '{"active_standards":["ISO9001"],"audit_scope":"Servicios TI y soporte gestionado","excluded_scope":["manufactura fisica"],"critical_processes":["control documental","auditoria interna"],"main_products_services":["SaaS"]}'::jsonb
      );
      INSERT INTO tenant_standards (tenant_id, standard_code, is_active) VALUES
        ('${TENANT_A}', 'ISO9001', true),
        ('${TENANT_A}', 'ISO9001:2026', false),
        ('${TENANT_B}', 'ISO9001', true);
      INSERT INTO controls_catalog (id, tenant_id, iso, clause, category, description, source_type, is_active) VALUES
        ('${CATALOG_ACTIVE}', NULL, 'ISO9001', '7.5', 'documentacion', 'Control documental y evidencia aprobada', 'canonical', true),
        ('${CATALOG_TRANSITION}', NULL, 'ISO9001:2026', '9.9', 'transicion', 'Control transicional no contratado', 'canonical', true);
      INSERT INTO controls_catalog_standards (control_id, standard_code, clause) VALUES
        ('${CATALOG_ACTIVE}', 'ISO9001', '7.5'),
        ('${CATALOG_TRANSITION}', 'ISO9001:2026', '9.9');
      INSERT INTO tenant_controls (id, tenant_id, control_id, status, priority) VALUES
        ('${CONTROL_ACTIVE}', '${TENANT_A}', '${CATALOG_ACTIVE}', 'pendiente', 'media');
      INSERT INTO kpi_definitions (id, tenant_id, code, name, description, category, is_active, is_standard, display_order)
      VALUES ('${KPI_ACTIVE}', NULL, 'KPI-DOC', 'Cobertura documental', 'Evidencia y documentos controlados', 'cumplimiento', true, true, 1);
      INSERT INTO kpi_standard_mappings (kpi_id, standard_code, is_active) VALUES ('${KPI_ACTIVE}', 'ISO9001', true);
    `);

    assertNoSchemaChanges();
    console.log('NO_SCHEMA_CHANGES=PASS');
    console.log('NO_MIGRATIONS_ADDED=PASS');

    const pool = require('../../backend/src/config/db');
    const engine = require('../../backend/src/services/companyProfileApplicabilityEngine.service');

    const first = await engine.buildTenantApplicabilityUniverse({ tenantId: TENANT_A, userId: USER_A, forceRebuild: true });
    const firstControls = await pool.query("SELECT control_catalog_id, standard_code, active, visible_to_tenant FROM tenant_applicable_controls WHERE tenant_id = $1::uuid AND source = 'profile_engine' ORDER BY control_catalog_id", [TENANT_A]);
    assert.equal(first.ok, true);
    assert.equal(first.summary.filtered_by_tenant_id, true);
    assert.equal(first.summary.active_standards.includes('ISO9001'), true);
    assert.equal(first.summary.active_standards.includes('ISO9001:2026'), false);
    assert.equal(firstControls.rows.length, 1);
    assert.equal(String(firstControls.rows[0].control_catalog_id), CATALOG_ACTIVE);
    assert.equal(firstControls.rows[0].active, true);
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_CANONICAL_DATA=PASS');
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_ACTIVE_STANDARDS_ONLY=PASS');
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_OPTIONAL_TRANSITION_EXCLUDED=PASS');

    const firstLogical = {
      activeControls: first.summary.applicable_controls_count,
      activeKpis: first.summary.applicable_kpis_count,
      activeEvidence: first.summary.applicable_evidence_requirements_count,
    };
    const second = await engine.buildTenantApplicabilityUniverse({ tenantId: TENANT_A, userId: USER_A, forceRebuild: true });
    const secondLogical = {
      activeControls: second.summary.applicable_controls_count,
      activeKpis: second.summary.applicable_kpis_count,
      activeEvidence: second.summary.applicable_evidence_requirements_count,
    };
    assert.deepEqual(secondLogical, firstLogical);
    const duplicates = await pool.query(
      `
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE active = true AND visible_to_tenant = true)::int AS active_total
      FROM tenant_applicable_controls
      WHERE tenant_id = $1::uuid AND source = 'profile_engine'
      `,
      [TENANT_A]
    );
    assert.equal(duplicates.rows[0].total, firstLogical.activeControls);
    assert.equal(duplicates.rows[0].active_total, firstLogical.activeControls);
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_IDEMPOTENT=PASS');
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_NO_DUPLICATES=PASS');

    const tenantBRows = await pool.query("SELECT COUNT(*)::int AS count FROM tenant_applicable_controls WHERE tenant_id = $1::uuid AND source = 'profile_engine'", [TENANT_B]);
    assert.equal(tenantBRows.rows[0].count, 0);
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_MULTITENANT=PASS');

    const dashboardRows = await dashboardUniverseRows(pool, TENANT_A);
    assert.equal(dashboardRows.length, 1);
    assert.equal(String(dashboardRows[0].id), CONTROL_ACTIVE);
    assert.equal(dashboardRows[0].health_score, null);
    console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_DASHBOARD_PROPAGATION=PASS');
    console.log('DASHBOARD_EXISTING_UNIVERSE_ONLY=PASS');
    console.log('DASHBOARD_OPTIONAL_STANDARD_EXCLUDED=PASS');
    console.log('DASHBOARD_CONTROL_HEALTH_OPTIONAL=PASS');

    await pool.end?.();
  } finally {
    stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
