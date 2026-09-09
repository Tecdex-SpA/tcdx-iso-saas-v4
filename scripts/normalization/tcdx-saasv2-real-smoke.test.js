#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Pool } = require(path.join(root, 'backend/node_modules/pg'));
const { createTenantAwarePool, withPlatformTransaction } = require(path.join(root, 'backend/src/utils/dbTenantContext'));

const TARGET_DATABASE = 'tcdx_saasv2';
const ARTIFACT_DIR = path.join(root, 'artifacts/db-integral/tcdx-saasv2-real-smoke');
const RESULT_PATH = path.join(ARTIFACT_DIR, 'REAL_DB_SMOKE_RESULT.txt');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'REAL_DB_SMOKE_SUMMARY.md');
const PERIOD = { start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z', timezone: 'UTC' };
const FORMULA_CODES = Object.freeze([
  'F5_5_COMPLIANCE_WEIGHTED',
  'F5_5_COVERAGE',
  'F5_5_RESIDUAL_RISK',
  'F5_5_WEIGHTED_PROGRESS',
  'F5_5_FRESHNESS_CONTINUOUS',
  'F5_5_GRC_HEALTH',
]);
const INDICATOR_CODES = Object.freeze([
  'COMPLIANCE',
  'RISK-RESIDUAL',
  'REMEDIATION',
  'EVIDENCE-FRESH',
  'DATA-TRUST',
  'GRC-HEALTH',
]);
const RUN_PREFIX = 'tcdx-saasv2-real-smoke';

function deterministicUuid(label) {
  const hex = crypto.createHash('sha256').update(`${RUN_PREFIX}:${label}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const SYNTHETIC = Object.freeze({
  tenantA: deterministicUuid('tenant-a'),
  tenantB: deterministicUuid('tenant-b'),
  actor: deterministicUuid('actor-system'),
  actorEmail: 'tcdx-saasv2-real-smoke@synthetic.local',
});

const summary = {
  status: 'TCDX_SAASV2_REAL_SMOKE_BLOCKED',
  database: TARGET_DATABASE,
  postgresVersion: null,
  tenants: [SYNTHETIC.tenantA, SYNTHETIC.tenantB],
  formulas: FORMULA_CODES,
  indicators: INDICATOR_CODES,
  counts: {},
  health: {},
  calculationOutputsContract: {
    classification: 'HARNESS_DEFECT',
    canonical_numeric_value: 'calculation_outputs.output_value.value',
    numeric_value_role: 'nullable compatibility/projection column; not written by current official runtime persistence',
  },
  sourceContracts: {},
  files: { result: RESULT_PATH, summary: SUMMARY_PATH },
  error: null,
};

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.writeFileSync(RESULT_PATH, `REAL_DB_SMOKE_STARTED=${new Date().toISOString()}\n`);

function fdTargetsResultPath(fd) {
  try {
    const fdStat = fs.fstatSync(fd);
    if (!fdStat.isFile()) return false;
    const resultStat = fs.statSync(RESULT_PATH);
    return fdStat.dev === resultStat.dev && fdStat.ino === resultStat.ino;
  } catch {
    return false;
  }
}

const stdoutTargetsResultPath = fdTargetsResultPath(1);
const stderrTargetsResultPath = fdTargetsResultPath(2);

function appendResultLine(message) {
  fs.appendFileSync(RESULT_PATH, `${message}\n`);
}

function log(message) {
  console.log(message);
  if (!stdoutTargetsResultPath) appendResultLine(message);
}

function requireEnvConfig() {
  const database = process.env.PGDATABASE || process.env.DB_NAME || '';
  if (database !== TARGET_DATABASE) {
    throw new Error(`Refusing to run: PGDATABASE or DB_NAME must be exactly ${TARGET_DATABASE}; received ${database || '[unset]'}`);
  }

  const config = {
    host: process.env.PGHOST || process.env.DB_HOST,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    database,
  };

  if (!config.host) throw new Error('PGHOST or DB_HOST is required');
  if (!config.user) throw new Error('PGUSER or DB_USER is required');
  if (!Number.isInteger(config.port) || config.port <= 0) throw new Error('PGPORT or DB_PORT must be a valid positive integer');

  process.env.DB_HOST = config.host;
  process.env.DB_PORT = String(config.port);
  process.env.DB_USER = config.user;
  process.env.DB_PASSWORD = config.password;
  process.env.DB_NAME = config.database;
  process.env.DB_APPLICATION_NAME = `${RUN_PREFIX} safety harness`;
  process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '4';
  process.env.DB_CONNECTION_TIMEOUT_MS = process.env.DB_CONNECTION_TIMEOUT_MS || '5000';
  return config;
}

function loadRuntimeServices() {
  const modules = [
    'backend/src/config/db.js',
    'backend/src/services/phase5/phase5.service.js',
    'backend/src/services/math-governance/officialCalculationOrchestrator.service.js',
    'backend/src/services/indicators/indicatorGovernance.service.js',
  ];
  for (const relative of modules) {
    const resolved = require.resolve(path.join(root, relative));
    delete require.cache[resolved];
  }
  return {
    dbPool: require(path.join(root, 'backend/src/config/db')),
    orchestrator: require(path.join(root, 'backend/src/services/math-governance/officialCalculationOrchestrator.service')),
    indicators: require(path.join(root, 'backend/src/services/indicators/indicatorGovernance.service')),
  };
}

function countSql(table, where = '') {
  return `(SELECT count(*)::int FROM ${table}${where ? ` WHERE ${where}` : ''})`;
}

async function scalar(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ? Object.values(result.rows[0])[0] : null;
}

async function assertTargetDatabase(client) {
  const db = await scalar(client, 'SELECT current_database()');
  if (db !== TARGET_DATABASE) {
    throw new Error(`Refusing to run: current_database()=${db}, expected ${TARGET_DATABASE}`);
  }
  summary.database = db;
  const version = await scalar(client, "SELECT regexp_replace(version(), '.*PostgreSQL ([0-9.]+).*', '\\1') AS version");
  summary.postgresVersion = version;
  log(`REAL_DB_TARGET_DATABASE=${db}`);
  log(`POSTGRESQL_VERSION=${version}`);
}

async function legacyObjectCount(client) {
  const result = await client.query(`
    WITH forbidden_relations AS (
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public','qa_audit')
        AND (
          c.relname IN ('controls', 'control_health_scores', 'v_latest_health_kpi_snapshots', 'control_health_scores_v2_preview', 'evidences_backup_history', 'action_plans_backup_history')
          OR c.relname ~* '(backup_before_|cleanup_backup|backup_history|v2_preview|qa_|preview)'
        )
    ),
    forbidden_functions AS (
      SELECT p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'refresh_control_health_scores_v2_1'
    ),
    forbidden_columns AS (
      SELECT table_name || '.' || column_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          column_name IN ('legacy_control_id', 'controls_id_legacy')
          OR (table_name = 'evidences' AND column_name = 'control_id')
        )
    ),
    forbidden_metrics AS (
      SELECT metric_code AS name
      FROM metric_definitions
      WHERE metric_code LIKE 'KPI-HLT-%'
    )
    SELECT count(*)::int AS count
    FROM (
      SELECT name FROM forbidden_relations
      UNION ALL SELECT name FROM forbidden_functions
      UNION ALL SELECT name FROM forbidden_columns
      UNION ALL SELECT name FROM forbidden_metrics
    ) forbidden
  `);
  return Number(result.rows[0].count);
}

async function readGlobalCounts(client) {
  const result = await client.query(`
    SELECT
      ${countSql('tenants')} AS tenants,
      ${countSql('iso_standards')} AS iso_standards,
      ${countSql('iso_standard_versions')} AS iso_standard_versions,
      ${countSql('iso_controls')} AS iso_controls,
      ${countSql('iso_evidence_expectations')} AS iso_evidence_expectations,
      ${countSql('controls_catalog')} AS controls_catalog,
      ${countSql('official_formula_definitions')} AS formula_definitions,
      ${countSql('official_formula_versions')} AS formula_versions,
      ${countSql('official_formula_source_contracts')} AS source_contracts,
      ${countSql('metric_definitions')} AS metric_definitions,
      ${countSql('metric_source_bindings')} AS metric_source_bindings,
      ${countSql('knowledge_items')} AS knowledge_items,
      (
        SELECT count(*)::int
        FROM official_formula_versions ofv
        JOIN official_formula_source_contracts ofsc
          ON ofsc.tenant_id IS NULL
         AND ofsc.source_code = ofv.source_contract_code
         AND ofsc.status = 'published'
        WHERE ofv.tenant_id IS NULL
          AND ofv.status = 'published'
          AND ofv.source_contract_code IS NOT NULL
      ) AS valid_formula_source_links,
      (
        SELECT count(DISTINCT ofv.source_contract_code)::int
        FROM official_formula_versions ofv
        WHERE ofv.tenant_id IS NULL
          AND ofv.status = 'published'
          AND ofv.source_contract_code IS NOT NULL
      ) AS distinct_formula_source_codes
  `);
  return result.rows[0];
}

async function assertPreconditions(client) {
  await assertTargetDatabase(client);
  const counts = await readGlobalCounts(client);
  const legacy = await legacyObjectCount(client);
  const expected = {
    tenants: 0,
    iso_standards: 3,
    iso_standard_versions: 4,
    controls_catalog: 83,
    formula_definitions: 53,
    formula_versions: 53,
    valid_formula_source_links: 53,
    source_contracts: 20,
    metric_definitions: 22,
    metric_source_bindings: 22,
    iso_controls: 61,
    iso_evidence_expectations: 54,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(Number(counts[key]), value, `precondition ${key}`);
  }
  assert.equal(legacy, 0, 'precondition legacy object count');
  summary.counts.pre = { ...counts, legacy_object_count: legacy };
  log(`PRECONDITIONS=${JSON.stringify(summary.counts.pre)}`);
  log('REAL_DB_PRECONDITIONS PASS');
}

async function classifySourceContracts(client) {
  const rows = (await client.query(`
    WITH used AS (
      SELECT DISTINCT source_contract_code
      FROM official_formula_versions
      WHERE tenant_id IS NULL
        AND status = 'published'
        AND source_contract_code IS NOT NULL
    )
    SELECT source_code,
      CASE
        WHEN source_code IN (SELECT source_contract_code FROM used) THEN 'formula_source'
        WHEN source_code = 'incident_operational_events' THEN 'indicator source'
        WHEN source_code = 'evidence_freshness_records' THEN 'indicator source'
        WHEN source_code = 'external_fx_rates' THEN 'registered global contract; no current formula consumer'
        ELSE 'registered global contract; no current formula consumer'
      END AS classification
    FROM official_formula_source_contracts
    WHERE tenant_id IS NULL AND status = 'published'
    ORDER BY source_code
  `)).rows;
  const used = rows.filter((row) => row.classification === 'formula_source').length;
  const registered = rows.length;
  summary.sourceContracts = { registered, formula_sources: used, rows };
  assert.equal(registered, 20);
  assert.equal(used, 17);
  assert.ok(rows.find((row) => row.source_code === 'incident_operational_events' && row.classification === 'indicator source'));
  assert.ok(rows.find((row) => row.source_code === 'evidence_freshness_records' && row.classification === 'indicator source'));
  assert.ok(rows.find((row) => row.source_code === 'external_fx_rates' && row.classification.includes('no current formula consumer')));
  log('SOURCE_CONTRACT_CLASSIFICATION=17 formula sources, 2 indicator sources, 1 registered global contract without current formula consumer');
}

async function seedRuntimeTenant(client, { tenantId, suffix, assessmentStatus, evidenceCreatedAt, evidenceExpiresAt }) {
  const tenantStandardId = deterministicUuid(`runtime-${suffix}-standard`);
  const operationId = deterministicUuid(`runtime-${suffix}-operation`);
  const tenantControlId = deterministicUuid(`runtime-${suffix}-tenant-control`);
  const soaAssessmentId = deterministicUuid(`runtime-${suffix}-soa-assessment`);
  const evidenceId = deterministicUuid(`runtime-${suffix}-evidence`);
  const actionPlanId = deterministicUuid(`runtime-${suffix}-action-plan`);
  const actionUpdateId = deterministicUuid(`runtime-${suffix}-action-update`);
  const riskId = deterministicUuid(`runtime-${suffix}-risk`);
  const riskControlRelationId = deterministicUuid(`runtime-${suffix}-risk-control-relation`);
  const progressPercent = suffix === 'a' ? 80 : 20;
  const likelihood = suffix === 'a' ? 2 : 4;
  const impact = suffix === 'a' ? 3 : 5;
  const controlEffectivenessScore = suffix === 'a' ? 70 : 10;
  const catalog = await client.query(`
    SELECT id
    FROM controls_catalog
    WHERE iso = 'ISO_27001_2022'
    ORDER BY code
    LIMIT 1
  `);
  assert.ok(catalog.rows[0]?.id, 'runtime E2E requires an ISO_27001_2022 catalog control');

  await client.query(`
    INSERT INTO tenants (id, name, slug, service_status, settings)
    VALUES ($1, $2, $3, 'active', $4::jsonb)
  `, [tenantId, `TCDX SaaSv2 Real Smoke Tenant ${suffix.toUpperCase()}`, `tcdx-saasv2-real-smoke-${suffix}`, JSON.stringify({ synthetic_harness: RUN_PREFIX })]);
  await client.query(`
    INSERT INTO tenant_standards (id, tenant_id, standard_code, is_active, lifecycle_status)
    VALUES ($1, $2, 'ISO_27001_2022', true, 'active')
  `, [tenantStandardId, tenantId]);
  await client.query(`
    INSERT INTO tenant_operations (id, tenant_id, operation_key, code, name, is_active, status)
    VALUES ($1, $2, $3, $3, $4, true, 'active')
  `, [operationId, tenantId, `real-smoke-op-${suffix}`, `Real smoke operation ${suffix}`]);
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
      suggested_applicable, suggested_implementation_status, confidence_score, created_at
    )
    VALUES ($1, $2, $3, 'ISO_27001_2022', $4, $5, true, 'implemented', 0.95, '2026-09-08T00:00:00Z')
  `, [soaAssessmentId, tenantId, tenantControlId, RUN_PREFIX, assessmentStatus]);
  await client.query(`
    INSERT INTO evidences (
      id, tenant_id, tenant_control_id, catalog_control_id, title,
      evidence_type, status, validated, expires_at, created_at, updated_at, metadata
    )
    VALUES ($1, $2, $3, $4, $5, 'document', 'approved', true, $6::date, $7::timestamptz, $7::timestamptz, $8::jsonb)
  `, [evidenceId, tenantId, tenantControlId, catalog.rows[0].id, `Real smoke evidence ${suffix}`, evidenceExpiresAt, evidenceCreatedAt, JSON.stringify({ synthetic_harness: RUN_PREFIX })]);
  await client.query(`
    INSERT INTO action_plans (
      id, tenant_id, tenant_control_id, title, status, due_date, created_at, updated_at, metadata
    )
    VALUES ($1, $2, $3, $4, 'en_progreso', '2026-12-31', '2026-09-08T00:00:00Z', '2026-09-08T00:00:00Z', $5::jsonb)
  `, [actionPlanId, tenantId, tenantControlId, `Real smoke action ${suffix}`, JSON.stringify({ weight: 1, synthetic_harness: RUN_PREFIX })]);
  await client.query(`
    INSERT INTO action_plan_updates (
      id, action_plan_id, tenant_id, comment, progress_percent, status_after, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'Real smoke progress', $4, 'en_progreso', '2026-09-08T00:00:00Z', '2026-09-08T00:00:00Z')
  `, [actionUpdateId, actionPlanId, tenantId, progressPercent]);
  await client.query(`
    INSERT INTO risks (id, tenant_id, risk_key, title, inherent_score, residual_score, status, metadata, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'open', $7::jsonb, '2026-09-08T00:00:00Z')
  `, [
    riskId,
    tenantId,
    `real-smoke-risk-${suffix}`,
    `Real smoke risk ${suffix}`,
    likelihood * impact,
    likelihood * impact * (1 - (controlEffectivenessScore / 100)),
    JSON.stringify({ likelihood, impact, control_effectiveness_score: controlEffectivenessScore, assessed_at: '2026-09-08T00:00:00Z', synthetic_harness: RUN_PREFIX }),
  ]);
  await client.query(`
    INSERT INTO risk_control_relations (id, tenant_id, risk_id, tenant_control_id, relation_type, created_at)
    VALUES ($1, $2, $3, $4, 'mitigates', '2026-09-08T00:00:00Z')
  `, [riskControlRelationId, tenantId, riskId, tenantControlId]);
}

async function seedSyntheticActor(client) {
  await client.query(`
    INSERT INTO users (id, tenant_id, email, name, full_name, role, effective_role, status)
    VALUES ($1, NULL, $2, 'TCDX SaaSv2 Real Smoke Actor', 'TCDX SaaSv2 Real Smoke Actor', 'platform_admin', 'platform_admin', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [SYNTHETIC.actor, SYNTHETIC.actorEmail]);
}

async function publishIndicator(scope, indicators, metricCode) {
  const requestId = `${RUN_PREFIX}-indicator-${metricCode}`;
  const measurement = await indicators.calculateIndicator(scope, metricCode, { period: PERIOD }, requestId);
  const snapshot = await indicators.createSnapshot(scope, metricCode, {
    measurement_id: measurement.measurement.id,
    timezone: PERIOD.timezone,
  }, requestId);
  const published = await indicators.publishSnapshot(scope, snapshot.snapshot.snapshot_id, requestId);
  return { metricCode, measurement, snapshot, published };
}

function runtimeResultView(item) {
  return {
    formula_code: item.formula_code,
    status: item.status,
    value: item.value ?? null,
    source_code: item.source_code || null,
    source_counts: item.source_counts || null,
    failure_type: item.failure_type || null,
    machine_reason: item.machine_reason || item.code || null,
    calculation_run_id: item.calculation_run_id || null,
    snapshot_id: item.snapshot_id || null,
  };
}

function outputPayload(row) {
  return row?.output_value && typeof row.output_value === 'object' && !Array.isArray(row.output_value)
    ? row.output_value
    : null;
}

function canonicalOutputValue(row) {
  const payload = outputPayload(row);
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'value')) return null;
  if (payload.value === null || payload.value === undefined || payload.value === '') return null;
  const numericValue = Number(payload.value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

async function runRuntime(runtime) {
  const scopeA = { tenant_id: SYNTHETIC.tenantA, user: { id: SYNTHETIC.actor } };
  const scopeB = { tenant_id: SYNTHETIC.tenantB, user: { id: SYNTHETIC.actor } };
  const body = {
    formula_codes: FORMULA_CODES,
    period: PERIOD,
    source_overrides: {
      F5_5_FRESHNESS_CONTINUOUS: 'evidence_freshness_records',
    },
  };
  const resultA = await runtime.orchestrator.recalculateOfficialAnalytics(scopeA, body, `${RUN_PREFIX}-runtime-a`, { observationEmitter: null });
  const resultB = await runtime.orchestrator.recalculateOfficialAnalytics(scopeB, body, `${RUN_PREFIX}-runtime-b`, { observationEmitter: null });
  const byCodeA = new Map(resultA.results.map((item) => [item.formula_code, item]));
  const byCodeB = new Map(resultB.results.map((item) => [item.formula_code, item]));

  log(`RUNTIME_TENANT_A_RESULTS=${JSON.stringify(resultA.results.map(runtimeResultView))}`);
  log(`RUNTIME_TENANT_B_RESULTS=${JSON.stringify(resultB.results.map(runtimeResultView))}`);

  for (const formulaCode of FORMULA_CODES) {
    assert.equal(byCodeA.get(formulaCode)?.status, 'calculated', `${formulaCode} must calculate for tenant A`);
    assert.ok(byCodeA.get(formulaCode)?.calculation_run_id, `${formulaCode} must persist run for tenant A`);
    assert.ok(byCodeA.get(formulaCode)?.snapshot_id, `${formulaCode} must persist source snapshot for tenant A`);
  }
  assert.equal(byCodeB.get('F5_5_GRC_HEALTH')?.status, 'unmeasured', 'tenant B Health must stay unmeasured');
  assert.equal(byCodeB.get('F5_5_GRC_HEALTH')?.machine_reason || byCodeB.get('F5_5_GRC_HEALTH')?.code, 'FORMULA_INSUFFICIENT_COVERAGE');
  assert.notEqual(Number(byCodeA.get('F5_5_COMPLIANCE_WEIGHTED')?.value), Number(byCodeB.get('F5_5_COMPLIANCE_WEIGHTED')?.value));

  const published = [];
  for (const metricCode of INDICATOR_CODES) {
    published.push(await publishIndicator(scopeA, runtime.indicators, metricCode));
  }
  const publishedCount = published.filter((item) => ['published', 'already_published'].includes(item.published.status)).length;
  assert.equal(publishedCount, INDICATOR_CODES.length);

  summary.health = {
    tenantA: {
      status: byCodeA.get('F5_5_GRC_HEALTH')?.status,
      value: byCodeA.get('F5_5_GRC_HEALTH')?.value ?? null,
    },
    tenantB: {
      status: byCodeB.get('F5_5_GRC_HEALTH')?.status,
      value: byCodeB.get('F5_5_GRC_HEALTH')?.value ?? null,
      reason: byCodeB.get('F5_5_GRC_HEALTH')?.machine_reason || byCodeB.get('F5_5_GRC_HEALTH')?.code || null,
    },
  };
  log(`RUNTIME_INDICATOR_SNAPSHOTS=${publishedCount}`);
}

async function validateLineageAndIsolation(client) {
  const lineage = (await client.query(`
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
        cr.correlation_id IN ($3, $4)
        OR cr.correlation_id LIKE $5
      )
  `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB, `${RUN_PREFIX}-runtime-a`, `${RUN_PREFIX}-runtime-b`, `${RUN_PREFIX}-indicator-%`])).rows[0];

  const invalidLineage = Number((await scalar(client, `
    SELECT count(*)::int
    FROM calculation_runs cr
    LEFT JOIN official_formula_versions ofv ON ofv.id = cr.formula_version_id
    LEFT JOIN official_formula_source_contracts ofsc ON ofsc.id = cr.source_contract_id
    LEFT JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
    LEFT JOIN calculation_snapshots cs ON cs.tenant_id = cr.tenant_id AND cs.run_id = cr.id AND cs.snapshot_type = 'source_dataset'
    WHERE cr.tenant_id IN ($1, $2)
      AND cr.formula_code = ANY($3::text[])
      AND (cr.formula_version_id IS NULL OR ofv.id IS NULL OR co.id IS NULL OR cs.id IS NULL OR cr.source_contract_id IS NULL OR ofsc.id IS NULL)
  `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB, FORMULA_CODES])) || 0);

  const inconsistentTenant = Number((await scalar(client, `
    SELECT count(*)::int
    FROM calculation_runs cr
    LEFT JOIN calculation_outputs co ON co.run_id = cr.id AND co.tenant_id <> cr.tenant_id
    LEFT JOIN calculation_snapshots cs ON cs.run_id = cr.id AND cs.tenant_id <> cr.tenant_id
    LEFT JOIN metric_snapshots ms ON ms.calculation_run_id = cr.id AND ms.tenant_id <> cr.tenant_id
    WHERE cr.tenant_id IN ($1, $2)
      AND (co.id IS NOT NULL OR cs.id IS NOT NULL OR ms.id IS NOT NULL)
  `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB])) || 0);

  const leakage = Number((await scalar(client, `
    SELECT count(*)::int
    FROM calculation_runs cr
    JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
    JOIN calculation_snapshots cs ON cs.tenant_id = cr.tenant_id AND cs.run_id = cr.id
    WHERE cr.tenant_id IN ($1, $2)
      AND (
        co.output_value::text LIKE '%' || CASE WHEN cr.tenant_id = $1 THEN $2::text ELSE $1::text END || '%'
        OR cs.payload::text LIKE '%' || CASE WHEN cr.tenant_id = $1 THEN $2::text ELSE $1::text END || '%'
      )
  `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB])) || 0);

  summary.counts.runtime = lineage;
  summary.counts.invalid_lineage = invalidLineage;
  summary.counts.tenant_inconsistent_lineage = inconsistentTenant;
  summary.counts.cross_tenant_leakage = leakage;
  if (invalidLineage > 0) {
    const details = (await client.query(`
      SELECT cr.id, cr.tenant_id, cr.formula_code, cr.formula_version_id, cr.source_contract_id,
        co.id IS NOT NULL AS has_output,
        cs.id IS NOT NULL AS has_source_snapshot
      FROM calculation_runs cr
      LEFT JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
      LEFT JOIN calculation_snapshots cs ON cs.tenant_id = cr.tenant_id AND cs.run_id = cr.id AND cs.snapshot_type = 'source_dataset'
      WHERE cr.tenant_id IN ($1, $2)
        AND cr.formula_code = ANY($3::text[])
        AND (cr.formula_version_id IS NULL OR co.id IS NULL OR cs.id IS NULL OR cr.source_contract_id IS NULL)
      ORDER BY cr.started_at, cr.id
    `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB, FORMULA_CODES])).rows;
    log(`INVALID_FORMULA_LINEAGE_DETAILS=${JSON.stringify(details)}`);
  }
  if (inconsistentTenant > 0) {
    const details = (await client.query(`
      SELECT cr.id, cr.tenant_id, cr.formula_code,
        co.tenant_id AS output_tenant_id,
        cs.tenant_id AS snapshot_tenant_id,
        ms.tenant_id AS metric_snapshot_tenant_id
      FROM calculation_runs cr
      LEFT JOIN calculation_outputs co ON co.run_id = cr.id AND co.tenant_id <> cr.tenant_id
      LEFT JOIN calculation_snapshots cs ON cs.run_id = cr.id AND cs.tenant_id <> cr.tenant_id
      LEFT JOIN metric_snapshots ms ON ms.calculation_run_id = cr.id AND ms.tenant_id <> cr.tenant_id
      WHERE cr.tenant_id IN ($1, $2)
        AND (co.id IS NOT NULL OR cs.id IS NOT NULL OR ms.id IS NOT NULL)
      ORDER BY cr.started_at, cr.id
    `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB])).rows;
    log(`TENANT_INCONSISTENT_LINEAGE_DETAILS=${JSON.stringify(details)}`);
  }
  log(`RUNTIME_ORCHESTRATOR_RUNS=${lineage.runs}`);
  log(`RUNTIME_ORCHESTRATOR_OUTPUTS=${lineage.outputs}`);
  log(`RUNTIME_ORCHESTRATOR_SOURCE_SNAPSHOTS=${lineage.source_snapshots}`);
  log(`RUNTIME_ORCHESTRATOR_METRIC_SNAPSHOTS=${lineage.metric_snapshots}`);
  log(`FORMULA_CROSS_TENANT_LEAKAGE=${leakage}`);
  assert.ok(Number(lineage.runs) > 0);
  assert.ok(Number(lineage.outputs) > 0);
  assert.ok(Number(lineage.source_snapshots) > 0);
  assert.ok(Number(lineage.metric_snapshots) >= 6);
  assert.equal(invalidLineage, 0);
  assert.equal(inconsistentTenant, 0);
  assert.equal(leakage, 0);
  log('REAL_DB_RUNTIME_ORCHESTRATOR_END_TO_END PASS');
}

async function validateHealthSemantics(client) {
  const rows = (await client.query(`
    SELECT cr.tenant_id, cr.formula_code, cr.run_status, co.numeric_value, co.output_value, co.state, co.metadata
    FROM calculation_runs cr
    JOIN calculation_outputs co ON co.tenant_id = cr.tenant_id AND co.run_id = cr.id
    WHERE cr.tenant_id IN ($1, $2)
      AND cr.formula_code = 'F5_5_GRC_HEALTH'
    ORDER BY cr.tenant_id, cr.started_at DESC
  `, [SYNTHETIC.tenantA, SYNTHETIC.tenantB])).rows;
  const tenantA = rows.find((row) => row.tenant_id === SYNTHETIC.tenantA && row.run_status === 'calculated');
  const tenantB = rows.find((row) => row.tenant_id === SYNTHETIC.tenantB && row.run_status !== 'calculated');
  assert.ok(tenantA, 'tenant A GRC Health must be calculated');
  assert.ok(outputPayload(tenantA), 'tenant A GRC Health output_value must be a JSON object');
  assert.ok(Object.prototype.hasOwnProperty.call(outputPayload(tenantA), 'value'), 'tenant A GRC Health output_value must expose value');
  assert.ok(canonicalOutputValue(tenantA) !== null, 'tenant A GRC Health must have canonical output_value.value numeric score');
  assert.ok(tenantB, 'tenant B GRC Health must have an unmeasured output');
  assert.equal(tenantB.numeric_value, null, 'tenant B GRC Health must not publish numeric zero');
  assert.ok(outputPayload(tenantB), 'tenant B GRC Health output_value must be a JSON object');
  assert.ok(Object.prototype.hasOwnProperty.call(outputPayload(tenantB), 'value'), 'tenant B GRC Health output_value must expose value');
  assert.equal(canonicalOutputValue(tenantB), null, 'tenant B unmeasured output must not publish a numeric score');
  const controlHealthView = await scalar(client, "SELECT pg_get_viewdef('public.v_iso_control_effective_health'::regclass, true)");
  assert.ok(String(controlHealthView).includes('F5_5_CONTROL_EFFECTIVENESS'), 'per-control Health view must use control effectiveness snapshots');
  assert.ok(!String(controlHealthView).includes('F5_5_GRC_HEALTH'), 'per-control Health view must not use global GRC Health');
  assert.equal(await legacyObjectCount(client), 0, 'legacy Health objects must remain absent');
  summary.health.tenantA = {
    ...summary.health.tenantA,
    canonical_output_value: canonicalOutputValue(tenantA),
    output_shape: Object.keys(outputPayload(tenantA)).sort(),
    numeric_value_column: tenantA.numeric_value,
  };
  summary.health.tenantB = {
    ...summary.health.tenantB,
    canonical_output_value: canonicalOutputValue(tenantB),
    output_shape: Object.keys(outputPayload(tenantB)).sort(),
    numeric_value_column: tenantB.numeric_value,
  };
  log(`CALCULATION_OUTPUTS_CONTRACT=${JSON.stringify(summary.calculationOutputsContract)}`);
  log(`HEALTH_TENANT_A=${JSON.stringify(summary.health.tenantA)}`);
  log(`HEALTH_TENANT_B=${JSON.stringify(summary.health.tenantB)}`);
  log('REAL_DB_HEALTH_SEMANTICS PASS');
}

async function cleanupSynthetic(pool) {
  await withPlatformTransaction(pool, { role: 'migration_runner', reason: RUN_PREFIX }, async (client) => {
    const tenantIds = [SYNTHETIC.tenantA, SYNTHETIC.tenantB];
    async function deleteIfExists(tableName, sql, params = sql.includes('$2') ? [tenantIds, `${RUN_PREFIX}%`] : [tenantIds]) {
      const exists = await scalar(client, 'SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]);
      if (exists) await client.query(sql, params);
    }

    await deleteIfExists('grc_observation_emission_outbox', 'DELETE FROM grc_observation_emission_outbox WHERE tenant_id = ANY($1::uuid[]) OR correlation_id LIKE $2');
    await deleteIfExists('grc_observation_relations', 'DELETE FROM grc_observation_relations WHERE tenant_id = ANY($1::uuid[])');
    await deleteIfExists('grc_observations', 'DELETE FROM grc_observations WHERE tenant_id = ANY($1::uuid[]) OR correlation_id LIKE $2');
    await deleteIfExists('data_lineage_edges', 'DELETE FROM data_lineage_edges WHERE tenant_id = ANY($1::uuid[]) OR correlation_id LIKE $2');
    await deleteIfExists('data_snapshots', 'DELETE FROM data_snapshots WHERE tenant_id = ANY($1::uuid[]) OR correlation_id LIKE $2');
    await deleteIfExists('audit_event_log', 'DELETE FROM audit_event_log WHERE tenant_id = ANY($1::uuid[])');
    await deleteIfExists('metric_action_proposals', 'DELETE FROM metric_action_proposals WHERE tenant_id = ANY($1::uuid[])');
    await client.query(`
      UPDATE metric_trust_assessments
      SET measurement_id = NULL
      WHERE tenant_id = ANY($1::uuid[])
    `, [tenantIds]);
    const cleanupStatements = [
      'DELETE FROM metric_interpretations WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM metric_snapshots WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM metric_trust_assessments WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM metric_measurements WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM commercial_events WHERE tenant_id = ANY($1::uuid[]) OR request_id LIKE $2',
      'DELETE FROM calculation_snapshots WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM calculation_validations WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM calculation_inputs WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM calculation_outputs WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM calculation_runs WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM risk_control_relations WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM risks WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM action_plan_updates WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM action_plans WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM evidences WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM control_soa_assessments WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM tenant_controls WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM tenant_operations WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM tenant_standards WHERE tenant_id = ANY($1::uuid[])',
      'DELETE FROM tenants WHERE id = ANY($1::uuid[])',
    ];
    for (const statement of cleanupStatements) {
      await client.query(statement, statement.includes('$2') ? [tenantIds, `${RUN_PREFIX}%`] : [tenantIds]);
    }
    await client.query('DELETE FROM users WHERE id = $1::uuid AND email = $2', [SYNTHETIC.actor, SYNTHETIC.actorEmail]);
  });
}

async function assertPostCleanup(client) {
  const counts = await readGlobalCounts(client);
  const legacy = await legacyObjectCount(client);
  const expected = {
    tenants: 0,
    iso_standards: 3,
    iso_standard_versions: 4,
    controls_catalog: 83,
    formula_definitions: 53,
    formula_versions: 53,
    valid_formula_source_links: 53,
    source_contracts: 20,
    iso_controls: 61,
    iso_evidence_expectations: 54,
    knowledge_items: 1000,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(Number(counts[key]), value, `post-cleanup ${key}`);
  }
  assert.equal(legacy, 0, 'post-cleanup legacy object count');
  summary.counts.post = { ...counts, legacy_object_count: legacy };
  log(`POST_CLEANUP_GLOBAL_COUNTS=${JSON.stringify(summary.counts.post)}`);
  log('REAL_DB_SYNTHETIC_CLEANUP PASS');
}

function writeSummary() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const lines = [
    '# TCDX SaaSv2 Real Smoke Summary',
    '',
    `Status: \`${summary.status}\``,
    '',
    '- `formula_version_id` PRODUCT_DEFECT: `RESOLVED` (`persistFunctionalFailure` preserves `formula.version` as `formula_version`)',
    `- calculation_outputs blockage classification: \`${summary.calculationOutputsContract.classification}\``,
    `- DB objetivo: \`${summary.database}\``,
    `- DB validada: \`${summary.postgresVersion ? summary.database : 'not_connected'}\``,
    `- PostgreSQL: \`${summary.postgresVersion || 'not_connected'}\``,
    `- Tenants sinteticos: \`${summary.tenants.join('`, `')}\``,
    `- Formulas ejecutadas: \`${summary.formulas.join('`, `')}\``,
    `- Indicadores publicados: \`${summary.indicators.join('`, `')}\``,
    `- Runtime counts: \`${JSON.stringify(summary.counts.runtime || {})}\``,
    `- Health A/B: \`${JSON.stringify(summary.health || {})}\``,
    `- calculation_outputs contract: \`${JSON.stringify(summary.calculationOutputsContract)}\``,
    `- Leakage: \`${summary.counts.cross_tenant_leakage ?? 'not_run'}\``,
    `- Source contracts: \`${JSON.stringify({ registered: summary.sourceContracts.registered, formula_sources: summary.sourceContracts.formula_sources })}\``,
    `- Post-cleanup counts: \`${JSON.stringify(summary.counts.post || {})}\``,
    `- Error: \`${summary.error || 'none'}\``,
  ];
  fs.writeFileSync(SUMMARY_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  let pool = null;
  let runtime = null;
  let wroteSynthetic = false;
  let primaryError = null;
  try {
    requireEnvConfig();
    const directPool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 3,
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
      ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true'
        ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false' }
        : undefined,
      application_name: `${RUN_PREFIX} direct precheck`,
    });
    pool = createTenantAwarePool(directPool);
    runtime = loadRuntimeServices();
    await withPlatformTransaction(pool, { role: 'migration_runner', reason: RUN_PREFIX }, async (client) => {
      await assertPreconditions(client);
      await classifySourceContracts(client);
      await seedSyntheticActor(client);
      await seedRuntimeTenant(client, {
        tenantId: SYNTHETIC.tenantA,
        suffix: 'a',
        assessmentStatus: 'compliant',
        evidenceCreatedAt: '2026-09-08T00:00:00Z',
        evidenceExpiresAt: '2026-12-31',
      });
      await seedRuntimeTenant(client, {
        tenantId: SYNTHETIC.tenantB,
        suffix: 'b',
        assessmentStatus: 'non_compliant',
        evidenceCreatedAt: '2026-08-01T00:00:00Z',
        evidenceExpiresAt: '2026-08-31',
      });
      wroteSynthetic = true;
      log(`SYNTHETIC_TENANTS_CREATED=${SYNTHETIC.tenantA},${SYNTHETIC.tenantB}`);
    });

    await runRuntime(runtime);
    await withPlatformTransaction(pool, { role: 'migration_runner', reason: RUN_PREFIX }, async (client) => {
      await validateLineageAndIsolation(client);
      await validateHealthSemantics(client);
    });

    summary.status = 'TCDX_SAASV2_REAL_SMOKE_READY_FOR_BACKEND_CUTOVER_REVIEW';
  } catch (error) {
    primaryError = error;
    summary.status = 'TCDX_SAASV2_REAL_SMOKE_BLOCKED';
    summary.error = error.stack || error.message;
    throw error;
  } finally {
    try {
      if (pool && wroteSynthetic) {
        await cleanupSynthetic(pool);
      }
      if (pool && (wroteSynthetic || !primaryError)) await withPlatformTransaction(pool, { role: 'migration_runner', reason: `${RUN_PREFIX}-post-cleanup` }, async (client) => {
        await assertPostCleanup(client);
      });
    } catch (cleanupError) {
      summary.status = 'TCDX_SAASV2_REAL_SMOKE_BLOCKED';
      summary.error = `${summary.error ? `${summary.error}\n` : ''}CLEANUP_ERROR: ${cleanupError.stack || cleanupError.message}`;
      throw cleanupError;
    } finally {
      if (runtime?.dbPool) await runtime.dbPool.end().catch(() => null);
      if (pool) await pool.end().catch(() => null);
      writeSummary();
      log(summary.status);
    }
  }
}

main().catch((error) => {
  if (!stderrTargetsResultPath) appendResultLine(error.stack || error.message);
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
