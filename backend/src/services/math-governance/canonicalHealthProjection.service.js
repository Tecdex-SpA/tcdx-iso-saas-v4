'use strict';

const pool = require('../../config/db');
const { HEALTH_DEFINITIONS, COMPONENT_STATES } = require('./grcHealthCalculation.service');
const { FUNCTIONAL_INDICATORS } = require('../indicators/functionalIndicatorCatalog');

const GLOBAL_HEALTH_AUTHORITY = 'official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings';
const GLOBAL_SCORE_FORMULA = 'F5_5_GRC_HEALTH';
const GLOBAL_SCORE_VERSION = 2;
const MODEL_VERSION = 'canonical-health-projection-v1';
const EVIDENCE_COVERAGE_MAPPING = 'EVIDENCE-FRESH=freshness; COVERAGE=compliance_coverage; EVIDENCE-COVERAGE=compatibility_alias_only';
const OFFICIAL_PROJECTION_ROLE = 'READ_NORMALIZE_EXPLAIN_PRESENT_ONLY';
const DEFAULT_MINIMUM_COVERAGE = FUNCTIONAL_INDICATORS.find((item) => item.functional_code === 'GRC-HEALTH')?.minimum_coverage || HEALTH_DEFINITIONS.grc_health.minimum_coverage || 0.8;

const COMPONENTS = Object.freeze([
  { key: 'risk', label: 'Riesgo', weight: 0.2, formula_code: 'F5_5_RESIDUAL_RISK', metric_code: 'RISK-RESIDUAL' },
  { key: 'compliance', label: 'Cumplimiento', weight: 0.25, formula_code: 'F5_5_COMPLIANCE_WEIGHTED', metric_code: 'COMPLIANCE' },
  { key: 'actions', label: 'Acciones', weight: 0.15, formula_code: 'F5_5_WEIGHTED_PROGRESS', metric_code: 'ACTIONS' },
  { key: 'evidence', label: 'Vigencia de evidencia', weight: 0.2, formula_code: 'F5_5_FRESHNESS_CONTINUOUS', metric_code: 'EVIDENCE-FRESH' },
  { key: 'dataTrust', label: 'Data Trust', weight: 0.2, formula_code: 'F5_C3_DATA_TRUST', metric_code: 'DATA-TRUST' },
]);

function tenantIdFrom(scope = {}) {
  return scope?.tenant_id || scope?.tenantId || scope?.tenant || scope?.company_id || scope?.companyId || null;
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number * 100) / 100));
}

function normalizePercent(value, key = null) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (key === 'risk') return clampPercent(number > 1 ? 100 - number : number * 100);
  return clampPercent(number <= 1 ? number * 100 : number);
}

function normalizeState(value) {
  const state = String(value || '').toLowerCase();
  if (['calculated', 'completed', 'available', 'measured'].includes(state)) return 'AVAILABLE';
  if (['not_applicable', 'excluded'].includes(state)) return 'NOT_APPLICABLE';
  if (['stale', 'stale_source'].includes(state)) return 'STALE';
  if (['failed', 'source_incompatible', 'technical_error', 'validation_failed'].includes(state)) return 'INVALID';
  if (['not_configured', 'configuration_missing'].includes(state)) return 'NOT_CONFIGURED';
  if (['dependency_pending', 'unmeasured', 'insufficient_data', 'insufficient_coverage', 'source_unavailable', 'not_calculable'].includes(state)) return 'MISSING';
  return 'UNKNOWN';
}

function intervalToMs(value) {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') {
    const days = Number(value.days || 0);
    const hours = Number(value.hours || 0);
    const minutes = Number(value.minutes || 0);
    const seconds = Number(value.seconds || 0);
    const milliseconds = Number(value.milliseconds || 0);
    const total = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
    return Number.isFinite(total) && total > 0 ? total : null;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(milliseconds?|seconds?|minutes?|hours?|days?)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith('millisecond') ? 1
    : unit.startsWith('second') ? 1000
      : unit.startsWith('minute') ? 60000
        : unit.startsWith('hour') ? 3600000
          : 86400000;
  return Number.isFinite(amount) ? amount * multiplier : null;
}

function isSourceStale(source = null, asOf = new Date()) {
  const staleAfterMs = intervalToMs(source?.stale_after_ms ?? source?.stale_after);
  if (!staleAfterMs) return false;
  const effectiveAt = source?.effective_at || source?.updated_at || source?.period?.as_of || source?.period?.end || null;
  if (!effectiveAt) return false;
  const timestamp = new Date(effectiveAt).getTime();
  const asOfMs = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(asOfMs)) return false;
  return timestamp + staleAfterMs < asOfMs;
}

function classifyOfficialComponent(spec, source = null, options = {}) {
  const numericValue = normalizePercent(source?.value, spec.key);
  let state = normalizeState(source?.state || source?.status || source?.run_status);
  if (state === 'AVAILABLE' && isSourceStale(source, options.asOf)) state = 'STALE';
  if (numericValue !== null && state === 'AVAILABLE') {
    return { ...spec, classification: 'AVAILABLE', value: numericValue, source };
  }
  if (!source) {
    return { ...spec, classification: 'NOT_CONFIGURED', value: null, reason: 'official_component_source_missing', source: null };
  }
  const reason = source.machine_reason || source.reason || source.code || source.state || source.status || 'component_unavailable';
  const classification = spec.key === 'dataTrust' && String(reason).includes('FORMULA_VARIABLE_REQUIRED')
    ? 'NOT_CONFIGURED'
    : state;
  return {
    ...spec,
    classification: COMPONENT_STATES.includes(classification) ? classification : 'UNKNOWN',
    value: null,
    reason,
    source,
  };
}

function projectHealthFromComponents({ components, minimumCoverage = DEFAULT_MINIMUM_COVERAGE, period = null, updatedAt = null }) {
  const threshold = Number.isFinite(Number(minimumCoverage)) ? Number(minimumCoverage) : DEFAULT_MINIMUM_COVERAGE;
  let applicableWeight = 0;
  let availableWeight = 0;
  let weightedScore = 0;
  const normalizedComponents = components.map((component) => {
    const classification = COMPONENT_STATES.includes(String(component.classification).toUpperCase())
      ? String(component.classification).toUpperCase()
      : 'UNKNOWN';
    const weight = Number(component.weight || 0);
    const value = normalizePercent(component.value, component.key);
    if (classification !== 'NOT_APPLICABLE') applicableWeight += weight;
    if (classification === 'AVAILABLE' && value !== null) {
      availableWeight += weight;
      weightedScore += value * weight;
    }
    return { ...component, classification, weight, value };
  });
  const coverage = applicableWeight > 0 ? availableWeight / applicableWeight : 0;
  const score = availableWeight > 0 ? clampPercent(weightedScore / availableWeight) : null;
  const globalStatus = score === null ? 'not_calculable' : coverage >= threshold ? 'measured' : 'insufficient_coverage';
  const missingComponents = normalizedComponents
    .filter((component) => component.classification !== 'AVAILABLE' && component.classification !== 'NOT_APPLICABLE')
    .map((component) => ({
      key: component.key,
      label: component.label,
      classification: component.classification,
      reason: component.reason || null,
      route_to_fix: component.key === 'dataTrust' ? '/datos/calidad' : '/metricas',
    }));
  const label = globalStatus === 'measured'
    ? 'Health medido'
    : globalStatus === 'insufficient_coverage'
      ? 'Cobertura insuficiente'
      : 'No calculable';
  return {
    score,
    global_score: score,
    published_score: globalStatus === 'measured' ? score : null,
    score_publicable: globalStatus === 'measured',
    global_status: globalStatus,
    status: globalStatus,
    label,
    coverage: Math.round(coverage * 10000) / 10000,
    confidence: Math.round(coverage * 10000) / 10000,
    minimum_coverage: threshold,
    applicable_weight: Math.round(applicableWeight * 10000) / 10000,
    available_weight: Math.round(availableWeight * 10000) / 10000,
    missing_components: missingComponents,
    components: normalizedComponents,
    period,
    updated_at: updatedAt || new Date().toISOString(),
  };
}

async function relationExists(client, name) {
  const result = await client.query('SELECT to_regclass($1) AS relation', [`public.${name}`]);
  return Boolean(result.rows[0]?.relation);
}

async function loadGovernedPolicy(client, tenantId) {
  if (!(await relationExists(client, 'metric_calculation_policies'))) {
    return { minimum_coverage: DEFAULT_MINIMUM_COVERAGE, source: 'functionalIndicatorCatalog.minimum_coverage' };
  }
  const result = await client.query(
    `SELECT metadata, version_number, published_at, created_at
     FROM metric_calculation_policies
     WHERE metric_key = $1
       AND formula_code = $2
       AND status IN ('published','active')
       AND (tenant_id = $3::uuid OR tenant_id IS NULL)
     ORDER BY tenant_id DESC NULLS LAST, version_number DESC, published_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    ['GRC-HEALTH', GLOBAL_SCORE_FORMULA, tenantId],
  );
  const metadata = result.rows[0]?.metadata || {};
  const minimumCoverage = Number(metadata.minimum_coverage ?? metadata.coverage_threshold ?? DEFAULT_MINIMUM_COVERAGE);
  return {
    minimum_coverage: Number.isFinite(minimumCoverage) ? minimumCoverage : DEFAULT_MINIMUM_COVERAGE,
    version_number: result.rows[0]?.version_number || null,
    source: result.rowCount ? 'metric_calculation_policies.metadata.minimum_coverage' : 'functionalIndicatorCatalog.minimum_coverage',
  };
}

async function loadComponentPolicies(client, tenantId) {
  if (!(await relationExists(client, 'metric_calculation_policies'))) return new Map();
  const result = await client.query(
    `SELECT DISTINCT ON (metric_key, formula_code)
       metric_key,
       formula_code,
       stale_after,
       metadata,
       version_number,
       published_at,
       created_at
     FROM metric_calculation_policies
     WHERE status IN ('published','active')
       AND (tenant_id = $1::uuid OR tenant_id IS NULL)
       AND (
         metric_key = ANY($2::text[])
         OR formula_code = ANY($3::text[])
       )
     ORDER BY metric_key, formula_code, tenant_id DESC NULLS LAST, version_number DESC, published_at DESC NULLS LAST, created_at DESC`,
    [
      tenantId,
      COMPONENTS.map((item) => item.metric_code).concat(['GRC-HEALTH']),
      COMPONENTS.map((item) => item.formula_code).concat([GLOBAL_SCORE_FORMULA]),
    ],
  );
  const policies = new Map();
  for (const row of result.rows) {
    const value = {
      stale_after: row.stale_after || null,
      stale_after_ms: intervalToMs(row.stale_after),
      metadata: row.metadata || {},
    };
    if (row.metric_key) policies.set(`metric:${row.metric_key}`, value);
    if (row.formula_code) policies.set(`formula:${row.formula_code}`, value);
  }
  return policies;
}

function attachPolicy(source, policy) {
  if (!source || !policy) return source;
  return {
    ...source,
    stale_after: policy.stale_after,
    stale_after_ms: policy.stale_after_ms,
  };
}

async function loadLatestRuns(client, tenantId) {
  if (!(await relationExists(client, 'calculation_runs')) || !(await relationExists(client, 'calculation_outputs'))) return new Map();
  const result = await client.query(
    `SELECT DISTINCT ON (cr.formula_code)
       cr.formula_code,
       cr.run_status,
       cr.period_start,
       cr.period_end,
       cr.started_at,
       cr.completed_at,
       cr.metadata,
       co.output_value,
       co.metadata AS output_metadata
     FROM calculation_runs cr
     LEFT JOIN calculation_outputs co ON co.run_id = cr.id
     WHERE cr.tenant_id = $1::uuid
       AND cr.formula_code = ANY($2::text[])
     ORDER BY cr.formula_code,
       COALESCE(cr.period_end, cr.completed_at, cr.started_at, cr.period_start) DESC NULLS LAST,
       cr.completed_at DESC NULLS LAST,
       cr.started_at DESC NULLS LAST`,
    [tenantId, COMPONENTS.map((item) => item.formula_code).concat([GLOBAL_SCORE_FORMULA])],
  );
  return new Map(result.rows.map((row) => [row.formula_code, {
    value: row.output_value?.value ?? row.output_value ?? null,
    state: row.run_status,
    period: { start: row.period_start || null, end: row.period_end || null, as_of: row.period_end || row.completed_at || row.started_at || null },
    effective_at: row.period_end || row.completed_at || row.started_at || row.period_start || null,
    updated_at: row.completed_at || row.started_at || row.period_end || null,
    machine_reason: row.metadata?.machine_reason || row.output_metadata?.machine_reason || row.output_value?.machine_reason || null,
    payload: row.output_value || null,
  }]));
}

async function loadLatestSnapshots(client, tenantId) {
  if (!(await relationExists(client, 'metric_snapshots'))) return new Map();
  const result = await client.query(
    `SELECT DISTINCT ON (md.metric_code)
       md.metric_code,
       ms.snapshot_payload,
       ms.effective_at,
       ms.published_at,
       ms.created_at
     FROM metric_definitions md
     JOIN metric_snapshots ms ON ms.metric_definition_id = md.id
     WHERE ms.tenant_id = $1::uuid
       AND md.metric_code = ANY($2::text[])
       AND ms.snapshot_status = 'published'
     ORDER BY md.metric_code, ms.effective_at DESC NULLS LAST, ms.published_at DESC NULLS LAST, ms.created_at DESC`,
    [tenantId, COMPONENTS.map((item) => item.metric_code).concat(['GRC-HEALTH', 'COVERAGE', 'EVIDENCE-FRESH', 'DATA-TRUST'])],
  );
  return new Map(result.rows.map((row) => {
    const payload = row.snapshot_payload || {};
    const resultPayload = payload.result || {};
    return [row.metric_code, {
      value: resultPayload.value ?? payload.value ?? null,
      state: resultPayload.status || payload.state || payload.status || 'unmeasured',
      coverage: payload.coverage ?? null,
      trust: payload.trust || null,
      period: payload.period || { as_of: row.effective_at || null },
      effective_at: row.effective_at || null,
      updated_at: row.published_at || row.created_at || null,
      machine_reason: payload.machine_reason || payload.data_requirements?.reason || resultPayload.machine_reason || null,
      payload,
    }];
  }));
}

function selectOfficialGlobalHealth({ globalSource = null, componentProjection }) {
  const sourceClassification = classifyOfficialComponent(
    { key: 'global', label: 'Health GRC oficial', weight: 1, formula_code: GLOBAL_SCORE_FORMULA, metric_code: 'GRC-HEALTH' },
    globalSource,
  );
  const payload = globalSource?.payload || {};
  const details = payload.details || payload.health || payload.result?.details || {};
  const sourceCoverage = Number(details.coverage ?? payload.coverage ?? globalSource?.coverage);
  const coverage = Number.isFinite(sourceCoverage) ? sourceCoverage : componentProjection.coverage;
  const sourceMinimumCoverage = Number(details.minimum_coverage ?? details.threshold ?? payload.minimum_coverage ?? componentProjection.minimum_coverage);
  const minimumCoverage = Number.isFinite(sourceMinimumCoverage) ? sourceMinimumCoverage : componentProjection.minimum_coverage;
  const measured = sourceClassification.classification === 'AVAILABLE' && coverage >= minimumCoverage;
  const score = measured ? sourceClassification.value : null;
  const status = sourceClassification.classification === 'AVAILABLE'
    ? (measured ? 'measured' : 'insufficient_coverage')
    : 'not_calculable';

  return {
    ...componentProjection,
    score,
    global_score: score,
    published_score: measured ? score : null,
    score_publicable: measured,
    global_status: status,
    status,
    label: measured ? 'Health medido' : status === 'insufficient_coverage' ? 'Cobertura insuficiente' : 'No calculable',
    coverage,
    confidence: coverage,
    minimum_coverage: minimumCoverage,
    official_global_source: globalSource || null,
    official_global_classification: sourceClassification.classification,
  };
}

async function getCanonicalHealthProjection({ user } = {}) {
  const tenantId = tenantIdFrom(user);
  if (!tenantId) {
    return projectHealthFromComponents({
      components: COMPONENTS.map((spec) => ({ ...spec, classification: 'NOT_CONFIGURED', value: null, reason: 'tenant_required' })),
      minimumCoverage: DEFAULT_MINIMUM_COVERAGE,
    });
  }
  const client = await pool.connect();
  try {
    const [policy, componentPolicies, runs, snapshots] = await Promise.all([
      loadGovernedPolicy(client, tenantId),
      loadComponentPolicies(client, tenantId),
      loadLatestRuns(client, tenantId),
      loadLatestSnapshots(client, tenantId),
    ]);
    const officialComponents = COMPONENTS.map((spec) => {
      const policySource = componentPolicies.get(`metric:${spec.metric_code}`) || componentPolicies.get(`formula:${spec.formula_code}`) || null;
      const source = attachPolicy(snapshots.get(spec.metric_code) || runs.get(spec.formula_code) || null, policySource);
      return classifyOfficialComponent(spec, source);
    });
    const latest = officialComponents
      .map((component) => component.source?.updated_at)
      .filter(Boolean)
      .sort()
      .pop() || null;
    const period = officialComponents.find((component) => component.source?.period)?.source?.period || null;
    const componentProjection = projectHealthFromComponents({
      components: officialComponents,
      minimumCoverage: policy.minimum_coverage,
      period,
      updatedAt: latest,
    });
    const globalPolicy = componentPolicies.get('metric:GRC-HEALTH') || componentPolicies.get(`formula:${GLOBAL_SCORE_FORMULA}`) || null;
    const globalSource = attachPolicy(snapshots.get('GRC-HEALTH') || runs.get(GLOBAL_SCORE_FORMULA) || null, globalPolicy);
    const health = selectOfficialGlobalHealth({ globalSource, componentProjection });
    return {
      model_version: MODEL_VERSION,
      ...health,
      health,
      source: {
        authority: GLOBAL_HEALTH_AUTHORITY,
        formula_code: GLOBAL_SCORE_FORMULA,
        formula_version: GLOBAL_SCORE_VERSION,
        coverage_policy: 'available_weight/applicable_weight; publish only when coverage >= minimum_coverage',
        coverage_policy_source: policy.source,
        data_trust_accuracy_policy: 'accuracy remains NOT_CONFIGURED until a real measurable source or canonical binding exists',
        evidence_coverage_mapping: EVIDENCE_COVERAGE_MAPPING,
        projection_role: OFFICIAL_PROJECTION_ROLE,
      },
      compatibility_components: [],
      alerts: {
        missing_components: health.missing_components.length,
        insufficient_coverage: health.global_status === 'insufficient_coverage' ? 1 : 0,
      },
      data_quality_warnings: health.missing_components.map((component) => `${component.label}: ${component.classification}`),
    };
  } finally {
    client.release();
  }
}

module.exports = {
  COMPONENTS,
  DEFAULT_MINIMUM_COVERAGE,
  EVIDENCE_COVERAGE_MAPPING,
  GLOBAL_HEALTH_AUTHORITY,
  GLOBAL_SCORE_FORMULA,
  GLOBAL_SCORE_VERSION,
  MODEL_VERSION,
  OFFICIAL_PROJECTION_ROLE,
  classifyOfficialComponent,
  getCanonicalHealthProjection,
  isSourceStale,
  loadComponentPolicies,
  projectHealthFromComponents,
  selectOfficialGlobalHealth,
};
