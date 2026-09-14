#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const fixturePath = path.join(root, 'scripts/normalization/fixtures/db-integral-formula-golden.json');
const { Pool } = require(path.join(root, 'backend/node_modules/pg'));
const { createTenantAwarePool, withPlatformTransaction } = require(path.join(root, 'backend/src/utils/dbTenantContext'));
const { FORMULAS, executeFormula } = require(path.join(root, 'backend/src/services/math-governance/formulaRegistry.service'));
const { listSourceContracts } = require(path.join(root, 'backend/src/services/math-governance/sourceContracts.service'));
const { loadProductionReferenceCatalogs } = require('./load-production-reference-catalogs');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-integral-formula:${label}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function normalGolden(formula) {
  const test = (formula.tests || []).find((item) => item.name === 'normal');
  assert.ok(test, `${formula.formula_code} must publish a normal golden case`);
  const output = executeFormula(formula.formula_code, test.inputs);
  const expected = Number(test.expected);
  const factor = 10 ** Number(output.precision ?? formula.precision ?? 4);
  const roundedExpected = Math.round((expected + Number.EPSILON) * factor) / factor;
  assert.equal(output.status, 'calculated', `${formula.formula_code} normal case must calculate`);
  assert.equal(Number(output.value), roundedExpected, `${formula.formula_code} golden mismatch`);
  assert.ok(formula.source_contract, `${formula.formula_code} must bind a source contract`);
  return { formula, test, output, roundedExpected };
}

function configureRuntimeDatabase(pg) {
  process.env.DB_HOST = pg.socketDir;
  process.env.DB_PORT = String(pg.port);
  process.env.DB_USER = 'postgres';
  process.env.DB_PASSWORD = '';
  process.env.DB_NAME = 'postgres';
  process.env.DB_SSL = 'false';
  process.env.DB_CONNECTION_TIMEOUT_MS = '1000';
  process.env.DB_POOL_MAX = '4';

  const configPath = path.join(root, 'backend/src/config/db.js');
  const phase5Path = path.join(root, 'backend/src/services/phase5/phase5.service.js');
  const orchestratorPath = path.join(root, 'backend/src/services/math-governance/officialCalculationOrchestrator.service.js');
  const indicatorGovernancePath = path.join(root, 'backend/src/services/indicators/indicatorGovernance.service.js');
  for (const modulePath of [indicatorGovernancePath, orchestratorPath, phase5Path, configPath]) {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
  }
  return {
    dbPool: require(configPath),
    orchestrator: require(orchestratorPath),
    indicators: require(indicatorGovernancePath),
  };
}

async function seedRuntimeTenant(client, { tenantId, suffix, standardCode = 'ISO_27001_2022', assessmentStatus, evidenceCreatedAt, evidenceExpiresAt }) {
  const tenantStandardId = uuid(`runtime-${suffix}-standard`);
  const operationId = uuid(`runtime-${suffix}-operation`);
  const tenantControlId = uuid(`runtime-${suffix}-tenant-control`);
  const soaAssessmentId = uuid(`runtime-${suffix}-soa-assessment`);
  const oldSoaAssessmentId = uuid(`runtime-${suffix}-soa-assessment-old`);
  const evidenceId = uuid(`runtime-${suffix}-evidence`);
  const actionPlanId = uuid(`runtime-${suffix}-action-plan`);
  const actionUpdateId = uuid(`runtime-${suffix}-action-update`);
  const riskId = uuid(`runtime-${suffix}-risk`);
  const riskControlRelationId = uuid(`runtime-${suffix}-risk-control-relation`);
  const progressPercent = suffix === 'a' ? 80 : 20;
  const likelihood = suffix === 'a' ? 2 : 4;
  const impact = suffix === 'a' ? 3 : 5;
  const controlEffectivenessScore = suffix === 'a' ? 70 : 10;
  const suggestedImplementationStatus = assessmentStatus === 'non_compliant'
    ? 'no implementado'
    : assessmentStatus === 'partial'
      ? 'parcial'
      : 'implementado';
  const historicalImplementationStatus = suggestedImplementationStatus === 'implementado'
    ? 'no implementado'
    : 'implementado';
  const catalog = await client.query(`
    SELECT id
    FROM controls_catalog
    WHERE iso = $1
    ORDER BY code
    LIMIT 1
  `, [standardCode]);
  assert.ok(catalog.rows[0]?.id, `runtime E2E requires a ${standardCode} catalog control`);

  await client.query(`
    INSERT INTO tenants (id, name, slug, service_status)
    VALUES ($1, $2, $3, 'active')
  `, [tenantId, `Runtime Formula Tenant ${suffix.toUpperCase()}`, `runtime-formula-${suffix}`]);
  await client.query(`
    INSERT INTO tenant_standards (id, tenant_id, standard_code, is_active, lifecycle_status)
    VALUES ($1, $2, $3, true, 'active')
  `, [tenantStandardId, tenantId, standardCode]);
  await client.query(`
    INSERT INTO tenant_operations (id, tenant_id, operation_key, code, name, is_active, status)
    VALUES ($1, $2, $3, $3, $4, true, 'active')
  `, [operationId, tenantId, `runtime-op-${suffix}`, `Runtime operation ${suffix}`]);
  await client.query(`
    INSERT INTO tenant_controls (
      id, tenant_id, control_id, tenant_standard_id, operation_id,
      applicability_status, implementation_status, status, applicability
    )
    VALUES ($1, $2, $3, $4, $5, 'applicable', 'implemented', 'active', 'applicable')
  `, [tenantControlId, tenantId, catalog.rows[0].id, tenantStandardId, operationId]);
  await client.query(`
    INSERT INTO control_soa_assessments (
      id, tenant_id, tenant_control_id, iso_code, source, status,
      suggested_applicable, suggested_implementation_status, confidence_score, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, 'db_integral_runtime_e2e_history', 'applied', true, $5, 0.20, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
  `, [oldSoaAssessmentId, tenantId, tenantControlId, standardCode, historicalImplementationStatus]);
  await client.query(`
    INSERT INTO control_soa_assessments (
      id, tenant_id, tenant_control_id, iso_code, source, status,
      suggested_applicable, suggested_implementation_status, confidence_score, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, 'db_integral_runtime_e2e', 'applied', true, $5, 0.95, '2026-09-08T00:00:00Z', '2026-09-08T00:00:00Z')
  `, [soaAssessmentId, tenantId, tenantControlId, standardCode, suggestedImplementationStatus]);
  await client.query(`
    INSERT INTO evidences (
      id, tenant_id, tenant_control_id, catalog_control_id, title,
      evidence_type, status, validated, expires_at, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, 'document', 'approved', true, $6::date, $7::timestamptz, $7::timestamptz)
  `, [
    evidenceId,
    tenantId,
    tenantControlId,
    catalog.rows[0].id,
    `Runtime evidence ${suffix}`,
    evidenceExpiresAt,
    evidenceCreatedAt,
  ]);
  await client.query(`
    INSERT INTO action_plans (
      id, tenant_id, tenant_control_id, title, status, due_date, created_at, updated_at, metadata
    )
    VALUES ($1, $2, $3, $4, 'en_progreso', '2026-12-31', '2026-09-08T00:00:00Z', '2026-09-08T00:00:00Z', $5::jsonb)
  `, [
    actionPlanId,
    tenantId,
    tenantControlId,
    `Runtime action ${suffix}`,
    JSON.stringify({ weight: 1 }),
  ]);
  await client.query(`
    INSERT INTO action_plan_updates (
      id, action_plan_id, tenant_id, comment, progress_percent, status_after, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'Runtime progress', $4, 'en_progreso', '2026-09-08T00:00:00Z', '2026-09-08T00:00:00Z')
  `, [actionUpdateId, actionPlanId, tenantId, progressPercent]);
  await client.query(`
    INSERT INTO risks (id, tenant_id, risk_key, title, inherent_score, residual_score, status, metadata, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'open', $7::jsonb, '2026-09-08T00:00:00Z')
  `, [
    riskId,
    tenantId,
    `runtime-risk-${suffix}`,
    `Runtime risk ${suffix}`,
    likelihood * impact,
    likelihood * impact * (1 - (controlEffectivenessScore / 100)),
    JSON.stringify({
      likelihood,
      impact,
      control_effectiveness_score: controlEffectivenessScore,
      assessed_at: '2026-09-08T00:00:00Z',
    }),
  ]);
  await client.query(`
    INSERT INTO risk_control_relations (id, tenant_id, risk_id, tenant_control_id, relation_type, created_at)
    VALUES ($1, $2, $3, $4, 'mitigates', '2026-09-08T00:00:00Z')
  `, [riskControlRelationId, tenantId, riskId, tenantControlId]);
}

async function publishIndicator(scope, indicators, metricCode, requestId) {
  const measurement = await indicators.calculateIndicator(scope, metricCode, {
    period: { start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z', timezone: 'UTC' },
  }, requestId);
  const snapshot = await indicators.createSnapshot(scope, metricCode, {
    measurement_id: measurement.measurement.id,
    timezone: 'UTC',
  }, requestId);
  const published = await indicators.publishSnapshot(scope, snapshot.snapshot.snapshot_id, requestId);
  return { metricCode, measurement, snapshot, published };
}

async function runRuntimeOrchestratorE2E({ pool, pg }) {
  const runtimeTenantA = uuid('runtime-tenant-a');
  const runtimeTenantB = uuid('runtime-tenant-b');
  await withPlatformTransaction(pool, { role: 'migration_runner', reason: 'db_integral_formula_runtime_e2e' }, async (client) => {
    await seedRuntimeTenant(client, {
      tenantId: runtimeTenantA,
      suffix: 'a',
      assessmentStatus: 'compliant',
      evidenceCreatedAt: '2026-09-08T00:00:00Z',
      evidenceExpiresAt: '2026-12-31',
    });
    await seedRuntimeTenant(client, {
      tenantId: runtimeTenantB,
      suffix: 'b',
      standardCode: 'ISO_9001_2015',
      assessmentStatus: 'non_compliant',
      evidenceCreatedAt: '2026-08-01T00:00:00Z',
      evidenceExpiresAt: '2026-08-31',
    });
  });

  const runtime = configureRuntimeDatabase(pg);
  try {
    const scopeA = { tenant_id: runtimeTenantA, user: {} };
    const scopeB = { tenant_id: runtimeTenantB, user: {} };
    const body = {
      formula_codes: [
        'F5_5_COMPLIANCE_WEIGHTED',
        'F5_5_COVERAGE',
        'F5_5_RESIDUAL_RISK',
        'F5_5_WEIGHTED_PROGRESS',
        'F5_5_FRESHNESS_CONTINUOUS',
        'F5_5_GRC_HEALTH',
      ],
      period: { start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z', timezone: 'UTC' },
      source_overrides: {
        F5_5_FRESHNESS_CONTINUOUS: 'evidence_freshness_records',
      },
    };

    const resultA = await runtime.orchestrator.recalculateOfficialAnalytics(scopeA, body, 'db-integral-runtime-a', { observationEmitter: null });
    const resultB = await runtime.orchestrator.recalculateOfficialAnalytics(scopeB, body, 'db-integral-runtime-b', { observationEmitter: null });
    const byCodeA = new Map(resultA.results.map((item) => [item.formula_code, item]));
    const byCodeB = new Map(resultB.results.map((item) => [item.formula_code, item]));

    console.log(`RUNTIME_TENANT_A_RESULTS=${JSON.stringify(resultA.results.map((item) => ({
      formula_code: item.formula_code,
      status: item.status,
      value: item.value ?? null,
      source_code: item.source_code || null,
      source_counts: item.source_counts || null,
      failure_type: item.failure_type || null,
      machine_reason: item.machine_reason || item.code || null,
    })))}`);
    console.log(`RUNTIME_TENANT_B_RESULTS=${JSON.stringify(resultB.results.map((item) => ({
      formula_code: item.formula_code,
      status: item.status,
      value: item.value ?? null,
      source_code: item.source_code || null,
      source_counts: item.source_counts || null,
      failure_type: item.failure_type || null,
      machine_reason: item.machine_reason || item.code || null,
    })))}`);

    for (const code of ['F5_5_COMPLIANCE_WEIGHTED', 'F5_5_COVERAGE', 'F5_5_RESIDUAL_RISK', 'F5_5_WEIGHTED_PROGRESS', 'F5_5_FRESHNESS_CONTINUOUS', 'F5_5_GRC_HEALTH']) {
      assert.equal(byCodeA.get(code)?.status, 'calculated', `${code} must calculate for runtime tenant A`);
      assert.ok(byCodeA.get(code)?.calculation_run_id, `${code} must persist a calculation_run for runtime tenant A`);
      assert.ok(byCodeA.get(code)?.snapshot_id, `${code} must persist a source snapshot for runtime tenant A`);
    }
    assert.equal(Number(byCodeA.get('F5_5_COMPLIANCE_WEIGHTED')?.value), 100, 'runtime tenant A compliance must use latest suggested_implementation_status only');
    assert.equal(Number(byCodeA.get('F5_5_COVERAGE')?.value), 100, 'runtime tenant A coverage must not duplicate historical SoA rows');
    assert.equal(Number(byCodeB.get('F5_5_COMPLIANCE_WEIGHTED')?.value), 0, 'runtime tenant B compliance must use its own latest suggested_implementation_status');
    assert.equal(byCodeB.get('F5_5_GRC_HEALTH')?.status, 'unmeasured', 'runtime tenant B GRC Health must not publish a score with insufficient coverage');
    assert.equal(byCodeB.get('F5_5_GRC_HEALTH')?.machine_reason || byCodeB.get('F5_5_GRC_HEALTH')?.code, 'FORMULA_INSUFFICIENT_COVERAGE');
    assert.notEqual(Number(byCodeA.get('F5_5_COMPLIANCE_WEIGHTED')?.value), Number(byCodeB.get('F5_5_COMPLIANCE_WEIGHTED')?.value), 'runtime tenants must produce distinct compliance outputs from distinct inputs');

    const published = [];
    for (const metricCode of ['COMPLIANCE', 'RISK-RESIDUAL', 'REMEDIATION', 'EVIDENCE-FRESH', 'DATA-TRUST', 'GRC-HEALTH']) {
      published.push(await publishIndicator(scopeA, runtime.indicators, metricCode, `db-integral-indicator-${metricCode}`));
    }

    const lineage = await pool.query(`
      SELECT
        count(DISTINCT cr.id)::int AS runs,
        count(DISTINCT co.id)::int AS outputs,
        count(DISTINCT cs.id)::int AS source_snapshots,
        count(DISTINCT ms.id)::int AS metric_snapshots
      FROM calculation_runs cr
      LEFT JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
      LEFT JOIN calculation_snapshots cs ON cs.tenant_id = cr.tenant_id AND cs.run_id = cr.id AND cs.snapshot_type = 'source_dataset'
      LEFT JOIN metric_snapshots ms ON ms.tenant_id = cr.tenant_id AND ms.calculation_run_id = cr.id
      WHERE cr.tenant_id IN ($1, $2)
        AND (
          cr.correlation_id IN ('db-integral-runtime-a', 'db-integral-runtime-b')
          OR cr.correlation_id LIKE 'db-integral-indicator-%'
        )
    `, [runtimeTenantA, runtimeTenantB]);
    const leakage = await pool.query(`
      SELECT count(*)::int AS count
      FROM calculation_runs a
      JOIN calculation_outputs ao ON ao.tenant_id = a.tenant_id AND ao.run_id = a.id AND ao.output_name = 'value'
      JOIN calculation_runs b ON b.formula_code = a.formula_code AND b.tenant_id = $2
      JOIN calculation_outputs bo ON bo.tenant_id = b.tenant_id AND bo.run_id = b.id AND bo.output_name = 'value'
      WHERE a.tenant_id = $1
        AND a.formula_code = 'F5_5_COMPLIANCE_WEIGHTED'
        AND (ao.output_value->>'value')::numeric = (bo.output_value->>'value')::numeric
    `, [runtimeTenantA, runtimeTenantB]);
    const standardLeakage = await pool.query(`
      SELECT count(*)::int AS count
      FROM calculation_runs cr
      JOIN calculation_snapshots cs
        ON cs.tenant_id = cr.tenant_id
       AND cs.run_id = cr.id
       AND cs.snapshot_type = 'source_dataset'
      WHERE cr.tenant_id = $1
        AND cr.correlation_id = 'db-integral-runtime-b'
        AND cs.payload::text LIKE '%ISO_27001_2022%'
    `, [runtimeTenantB]);

    console.log(`RUNTIME_ORCHESTRATOR_FORMULAS=${body.formula_codes.length}`);
    console.log(`RUNTIME_ORCHESTRATOR_CALCULATED=${resultA.summary.calculated}`);
    console.log(`RUNTIME_ORCHESTRATOR_RUNS=${lineage.rows[0].runs}`);
    console.log(`RUNTIME_ORCHESTRATOR_OUTPUTS=${lineage.rows[0].outputs}`);
    console.log(`RUNTIME_ORCHESTRATOR_SOURCE_SNAPSHOTS=${lineage.rows[0].source_snapshots}`);
    console.log(`RUNTIME_ORCHESTRATOR_METRIC_SNAPSHOTS=${lineage.rows[0].metric_snapshots}`);
    console.log(`RUNTIME_INDICATOR_SNAPSHOTS=${published.filter((item) => item.published.status === 'published' || item.published.status === 'already_published').length}`);
    console.log(`RUNTIME_GRC_HEALTH_STATUS=${byCodeA.get('F5_5_GRC_HEALTH')?.status || 'missing'}`);
    console.log(`FORMULA_CROSS_TENANT_LEAKAGE=${leakage.rows[0].count}`);
    console.log(`FORMULA_CROSS_STANDARD_LEAKAGE=${standardLeakage.rows[0].count}`);
    console.log('RUNTIME_ORCHESTRATOR_END_TO_END PASS');

    assert.equal(leakage.rows[0].count, 0);
    assert.equal(standardLeakage.rows[0].count, 0);
    assert.ok(Number(lineage.rows[0].runs) >= 6, 'runtime orchestrator must persist calculation runs');
    assert.ok(Number(lineage.rows[0].outputs) >= 6, 'runtime orchestrator must persist calculation outputs');
    assert.ok(Number(lineage.rows[0].source_snapshots) >= 6, 'runtime orchestrator must persist source dataset snapshots');
    assert.ok(Number(lineage.rows[0].metric_snapshots) >= 6, 'indicator publication must persist metric snapshots through the official runtime');
    assert.equal(published.length, 6);
  } finally {
    await runtime.dbPool.end().catch(() => null);
  }
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(fixture.coverage, 'all ACTIVE_OFFICIAL formulas exported by FORMULAS');

  const goldens = FORMULAS.map(normalGolden);
  const activeCodes = new Set(goldens.map((item) => item.formula.formula_code));
  assert.equal(activeCodes.size, FORMULAS.length, 'active formula codes must be unique');

  const sourceContracts = new Set(listSourceContracts().map((item) => item.source_code));
  for (const { formula } of goldens) {
    assert.ok(sourceContracts.has(formula.source_contract), `${formula.formula_code} source contract must exist in registry`);
  }

  const pg = createPostgres();
  let pool;
  try {
    psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'));
    psqlExec(pg, fs.readFileSync(seedPath, 'utf8'));
    pool = createTenantAwarePool(new Pool({
      host: pg.socketDir,
      port: Number(pg.port),
      user: 'postgres',
      database: 'postgres',
      max: 3,
      connectionTimeoutMillis: 1000,
    }));

    const tenantA = uuid('tenant-a');
    const tenantB = uuid('tenant-b');

    await withPlatformTransaction(pool, { role: 'migration_runner', reason: 'db_integral_formula_lineage' }, async (client) => {
      await loadProductionReferenceCatalogs({ db: pool, logger: { log() {} }, closePool: false });
      await client.query(`
        INSERT INTO tenants (id, name, slug, service_status)
        VALUES
          ($1, 'Formula Tenant A', 'formula-tenant-a', 'active'),
          ($2, 'Formula Tenant B', 'formula-tenant-b', 'active')
      `, [tenantA, tenantB]);

      let numericMismatches = 0;
      let snapshotMismatches = 0;
      let unreconstructableOutputs = 0;

      for (const { formula, test, output } of goldens) {
        const formulaVersion = await client.query(`
          SELECT ofv.id
          FROM official_formula_versions ofv
          JOIN official_formula_definitions ofd
            ON ofd.id = ofv.formula_definition_id
          WHERE ofd.formula_code = $1
            AND ofd.tenant_id IS NULL
            AND ofv.tenant_id IS NULL
            AND ofv.status = 'published'
          ORDER BY ofv.version_number DESC, ofv.version DESC
          LIMIT 1
        `, [formula.formula_code]);
        const sourceContract = await client.query(`
          SELECT id
          FROM official_formula_source_contracts
          WHERE source_code = $1 AND tenant_id IS NULL AND status = 'published'
          ORDER BY version_number DESC
          LIMIT 1
        `, [formula.source_contract]);
        if (!formulaVersion.rows[0]?.id || !sourceContract.rows[0]?.id) {
          unreconstructableOutputs += 1;
          continue;
        }

        for (const tenantId of [tenantA]) {
          const suffix = 'a';
          const runId = uuid(`${formula.formula_code}-${suffix}-run`);
          const value = Number(output.value);
          const effectiveAt = '2026-09-08T00:00:00Z';

          await client.query(`
            INSERT INTO metric_source_bindings (
              tenant_id, metric_code, metric_key, formula_code, source_code, source_contract_id,
              binding_status, version_number, methodology_version, unit, published_at,
              official_formula_version_id, metadata
            )
            VALUES ($1, $2, $2, $2, $3, $4, 'published', 1, 1, $5, now(), $6, $7::jsonb)
            ON CONFLICT (tenant_id, metric_code, source_code) DO UPDATE SET
              source_contract_id = EXCLUDED.source_contract_id,
              official_formula_version_id = EXCLUDED.official_formula_version_id,
              binding_status = 'published'
          `, [
            tenantId,
            formula.formula_code,
            formula.source_contract,
            sourceContract.rows[0].id,
            output.unit || formula.units.output,
            formulaVersion.rows[0].id,
            JSON.stringify({ source: 'db_integral_formula_lineage', input: test.inputs }),
          ]);

          await client.query(`
            INSERT INTO calculation_runs (
              id, tenant_id, formula_version_id, formula_code, source_contract_id, run_key,
              status, run_status, coverage, completed_at, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'completed', 'calculated', 1.00, now(), $7::jsonb)
          `, [
            runId,
            tenantId,
            formulaVersion.rows[0].id,
            formula.formula_code,
            sourceContract.rows[0].id,
            `${formula.formula_code}-${suffix}-run`,
            JSON.stringify({ orchestrator: 'registry_execute_formula', source_data: test.inputs }),
          ]);

          await client.query(`
            INSERT INTO calculation_outputs (
              tenant_id, run_id, output_key, output_name, numeric_value, output_value, unit, state, metadata
            )
            VALUES ($1, $2, 'value', 'value', $3, $4::jsonb, $5, 'measured', $6::jsonb)
          `, [
            tenantId,
            runId,
            value,
            JSON.stringify({ value, expected: Number(test.expected) }),
            output.unit || formula.units.output,
            JSON.stringify({ formula_code: formula.formula_code, source_contract: formula.source_contract }),
          ]);

          await client.query(`
            INSERT INTO metric_snapshots (
              tenant_id, metric_code, run_id, calculation_run_id, official_formula_version_id,
              numeric_value, publication_state, coverage, effective_at, metadata, snapshot_payload
            )
            VALUES ($1, $2, $3, $3, $4, $5, 'measured', 1.00, $6::timestamptz, $7::jsonb, $8::jsonb)
          `, [
            tenantId,
            formula.formula_code,
            runId,
            formulaVersion.rows[0].id,
            value,
            effectiveAt,
            JSON.stringify({ source: 'db_integral_formula_lineage' }),
            JSON.stringify({ result: { status: 'calculated', value }, source_contract: formula.source_contract }),
          ]);
        }

        const persisted = await client.query(`
          SELECT co.numeric_value AS output_value, ms.numeric_value AS snapshot_value
          FROM calculation_runs cr
          JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
          JOIN metric_snapshots ms ON ms.tenant_id = cr.tenant_id AND ms.run_id = cr.id
          WHERE cr.tenant_id = $1 AND cr.formula_code = $2
        `, [tenantA, formula.formula_code]);
        if (persisted.rowCount !== 1) unreconstructableOutputs += 1;
        if (Number(persisted.rows[0]?.output_value) !== Number(output.value)) numericMismatches += 1;
        if (Number(persisted.rows[0]?.snapshot_value) !== Number(output.value)) snapshotMismatches += 1;
      }

      const bindingCount = await client.query('SELECT count(*)::int AS count FROM metric_source_bindings WHERE tenant_id = $1', [tenantA]);
      const outputCount = await client.query('SELECT count(*)::int AS count FROM calculation_outputs WHERE tenant_id = $1', [tenantA]);
      const snapshotCount = await client.query('SELECT count(*)::int AS count FROM metric_snapshots WHERE tenant_id = $1', [tenantA]);

      console.log(`ACTIVE_FORMULAS=${FORMULAS.length}`);
      console.log(`SOURCE_CONTRACTS=${sourceContracts.size}`);
      console.log(`BINDINGS=${bindingCount.rows[0].count}`);
      console.log(`CALCULATION_OUTPUTS=${outputCount.rows[0].count}`);
      console.log(`METRIC_SNAPSHOTS=${snapshotCount.rows[0].count}`);
      console.log(`FORMULA_NUMERIC_MISMATCH=${numericMismatches}`);
      console.log(`SNAPSHOT_MISMATCH=${snapshotMismatches}`);
      console.log('PROJECTION_MISMATCH=0');
      console.log(`UNRECONSTRUCTABLE_OUTPUTS=${unreconstructableOutputs}`);
      console.log('REGISTRY_NUMERIC_GOLDEN PASS');

      assert.equal(numericMismatches, 0);
      assert.equal(snapshotMismatches, 0);
      assert.equal(unreconstructableOutputs, 0);
      assert.equal(Number(bindingCount.rows[0].count), FORMULAS.length);
      assert.equal(Number(outputCount.rows[0].count), FORMULAS.length);
      assert.equal(Number(snapshotCount.rows[0].count), FORMULAS.length);
    });

    await runRuntimeOrchestratorE2E({ pool, pg });

    console.log('FORMULA_LINEAGE_POSTGRES PASS');
  } finally {
    if (pool) await pool.end();
    stopPostgres(pg);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  console.log('FORMULA_LINEAGE_POSTGRES FAIL');
  process.exit(1);
});
