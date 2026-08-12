'use strict';

const crypto = require('crypto');

const OFFICIAL_STATES = Object.freeze([
  'calculated', 'unmeasured', 'source_unavailable', 'mapping_required',
  'insufficient_data', 'insufficient_coverage', 'stale_source',
  'dependency_pending', 'source_incompatible', 'validation_failed',
  'technical_error',
]);
const TRUST_DIMENSIONS = Object.freeze([
  'completeness', 'accuracy', 'consistency', 'freshness',
  'lineage', 'validation', 'stability', 'coverage',
]);
const TRUST_STATUSES = Object.freeze(['trusted', 'acceptable', 'attention', 'untrusted', 'unknown']);
const CRITICAL_TRUST_DIMENSIONS = new Set(['freshness', 'lineage', 'validation', 'coverage']);

class IndicatorContractError extends Error {
  constructor(code, message, status = 422, details = null) {
    super(message);
    this.name = 'IndicatorContractError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonical(value[key]);
      return result;
    }, {});
  }
  return value;
}

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWeights(input) {
  const weights = {};
  let sum = 0;
  for (const dimension of TRUST_DIMENSIONS) {
    const value = finite(input?.[dimension]);
    if (value === null || value < 0 || value > 1) {
      throw new IndicatorContractError('INDICATOR_TRUST_WEIGHT_INVALID', 'Cada peso de Data Trust debe estar entre 0 y 1.', 422, { dimension });
    }
    weights[dimension] = value;
    sum += value;
  }
  if (Math.abs(sum - 1) > 0.000001) {
    throw new IndicatorContractError('INDICATOR_TRUST_WEIGHTS_SUM_INVALID', 'Los pesos de Data Trust deben sumar 1.', 422, { sum });
  }
  return weights;
}

function normalizeTrustDimension(dimension, input = {}) {
  const score = finite(input.score);
  const measurable = score !== null;
  if (measurable && (score < 0 || score > 100)) {
    throw new IndicatorContractError('INDICATOR_TRUST_SCORE_INVALID', 'El score de una dimensión debe estar entre 0 y 100.', 422, { dimension });
  }
  const numerator = finite(input.numerator);
  const denominator = finite(input.denominator);
  if (denominator !== null && denominator < 0) throw new IndicatorContractError('INDICATOR_TRUST_DENOMINATOR_INVALID', 'El denominador no puede ser negativo.', 422, { dimension });
  const status = measurable
    ? score >= 85 ? 'trusted' : score >= 70 ? 'acceptable' : score >= 50 ? 'attention' : 'untrusted'
    : 'unknown';
  return {
    dimension,
    score,
    status,
    evidence: input.evidence ?? null,
    rule: input.rule || null,
    numerator,
    denominator,
    population: finite(input.population),
    sample_size: finite(input.sample_size),
    warnings: Array.isArray(input.warnings) ? input.warnings.filter(Boolean) : [],
    evaluated_at: input.evaluated_at || null,
    version: Number(input.version || 1),
    checksum: checksum({ dimension, score, evidence: input.evidence ?? null, rule: input.rule || null, numerator, denominator }),
  };
}

function calculateDataTrust({ dimensions = {}, weights, policyVersion = 1, policyChecksum = null } = {}) {
  const normalizedWeights = normalizeWeights(weights);
  const normalized = {};
  let weighted = 0;
  let knownWeight = 0;
  const unknown = [];
  for (const dimension of TRUST_DIMENSIONS) {
    const item = normalizeTrustDimension(dimension, dimensions[dimension]);
    normalized[dimension] = item;
    if (item.score === null) unknown.push(dimension);
    else {
      weighted += item.score * normalizedWeights[dimension];
      knownWeight += normalizedWeights[dimension];
    }
  }
  const criticalUnknown = unknown.filter((dimension) => CRITICAL_TRUST_DIMENSIONS.has(dimension));
  let score = knownWeight > 0 ? Math.round((weighted / knownWeight) * 100) / 100 : null;
  if (normalized.lineage.score !== null && normalized.lineage.score < 100 && score !== null) score = Math.min(score, 99);
  if (normalized.freshness.status === 'untrusted' && score !== null) score = Math.min(score, 69);
  if (normalized.validation.status === 'untrusted' && score !== null) score = Math.min(score, 39);
  if (criticalUnknown.length === CRITICAL_TRUST_DIMENSIONS.size || score === null) score = null;
  let status = score === null ? 'unknown' : score >= 85 ? 'trusted' : score >= 70 ? 'acceptable' : score >= 50 ? 'attention' : 'untrusted';
  if (unknown.length && status === 'trusted') status = 'acceptable';
  if (criticalUnknown.length && ['trusted', 'acceptable'].includes(status)) status = 'attention';
  const result = {
    score,
    status,
    dimensions: normalized,
    weights: normalizedWeights,
    known_weight: Math.round(knownWeight * 1000000) / 1000000,
    unknown_dimensions: unknown,
    critical_unknown_dimensions: criticalUnknown,
    policy_version: Number(policyVersion),
    policy_checksum: policyChecksum || checksum(normalizedWeights),
  };
  const reproducible = { ...result, dimensions: Object.fromEntries(Object.entries(normalized).map(([key,item]) => [key,item.checksum])) };
  return { ...result, checksum: checksum(reproducible) };
}

function evaluateFreshness({ effectiveAt, periodEnd, frequency, timezone = 'UTC', policy, now = new Date() } = {}) {
  const evidenceAt = effectiveAt || periodEnd || null;
  const observed = evidenceAt ? new Date(evidenceAt).getTime() : NaN;
  const current = new Date(now).getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(current) || observed > current) {
    return { status: 'unknown', age_seconds: null, effective_at: evidenceAt, timezone, policy_version: policy?.version || null, reason: 'No existe fecha efectiva válida.' };
  }
  const defaults = {
    realtime: [3600, 28800], daily: [86400, 259200], weekly: [604800, 1209600],
    monthly: [2678400, 5356800], quarterly: [8035200, 16070400],
    semiannual: [16070400, 24105600], annual: [32140800, 48211200], on_demand: [2592000, 7776000],
  };
  const [freshSeconds, staleSeconds] = policy?.age_bands_seconds || defaults[frequency] || defaults.on_demand;
  const age = Math.floor((current - observed) / 1000);
  const status = age <= freshSeconds ? 'fresh' : age <= staleSeconds ? 'aging' : 'stale';
  return { status, age_seconds: age, effective_at: new Date(observed).toISOString(), timezone, policy_version: policy?.version || 1, reason: `Edad evaluada contra frecuencia ${frequency || 'on_demand'}.` };
}

function evaluateSufficiency({ sourceStatus = 'source_ready', requiredInputs = [], availableInputs = {}, sampleSize = 0, populationSize = null, coverage = null, rule = {} } = {}) {
  if (sourceStatus === 'source_unavailable') return { status: 'source_unavailable', missing_inputs: requiredInputs, coverage: null, sample_size: 0 };
  if (sourceStatus === 'mapping_required') return { status: 'mapping_required', missing_inputs: requiredInputs, coverage: null, sample_size: 0 };
  if (sourceStatus === 'source_incompatible') return { status: 'invalid', reason: 'source_incompatible', missing_inputs: [], coverage, sample_size: sampleSize };
  const missing = requiredInputs.filter((key) => availableInputs[key] === undefined || availableInputs[key] === null);
  if (missing.length) return { status: 'insufficient', reason: 'missing_inputs', missing_inputs: missing, coverage, sample_size: sampleSize };
  const minimumSample = Number(rule.minimum_sample_size || 1);
  if (Number(sampleSize || 0) < minimumSample) return { status: 'insufficient', reason: 'minimum_sample_size', missing_inputs: [], coverage, sample_size: Number(sampleSize || 0) };
  const derivedCoverage = finite(coverage) ?? (finite(populationSize) && Number(populationSize) > 0 ? Number(sampleSize) / Number(populationSize) : null);
  const minimumCoverage = finite(rule.minimum_coverage) ?? 0;
  if (derivedCoverage === null && minimumCoverage > 0) return { status: 'partial', reason: 'coverage_unknown', missing_inputs: [], coverage: null, sample_size: Number(sampleSize || 0) };
  if (derivedCoverage !== null && derivedCoverage < minimumCoverage) return { status: 'insufficient', reason: 'minimum_coverage', missing_inputs: [], coverage: derivedCoverage, sample_size: Number(sampleSize || 0) };
  return { status: 'sufficient', missing_inputs: [], coverage: derivedCoverage, sample_size: Number(sampleSize || 0) };
}

function assertOfficialResult(result) {
  if (!OFFICIAL_STATES.includes(result?.status)) throw new IndicatorContractError('INDICATOR_STATE_INVALID', 'Estado oficial de indicador inválido.');
  const value = finite(result.value);
  if (result.status === 'calculated' && value === null) throw new IndicatorContractError('INDICATOR_CALCULATED_VALUE_REQUIRED', 'Un resultado calculated requiere valor numérico.');
  if (result.status !== 'calculated' && result.value !== null && result.value !== undefined) throw new IndicatorContractError('INDICATOR_NON_CALCULATED_VALUE_FORBIDDEN', 'Solo calculated puede contener valor oficial.');
  return { ...result, value };
}

function classifyThreshold(value, policy) {
  const numeric = finite(value);
  if (numeric === null || !policy || !Array.isArray(policy.bands)) return { code: 'unknown', label: 'Sin clasificación', positive: false };
  for (const band of policy.bands) {
    const minOk = band.min === null || band.min === undefined || numeric >= Number(band.min);
    const maxOk = band.max === null || band.max === undefined || numeric <= Number(band.max);
    if (minOk && maxOk) return { code: band.code, label: band.label, positive: band.positive === true };
  }
  return { code: 'unclassified', label: 'Fuera de bandas publicadas', positive: false };
}

function buildInterpretation({ definition, result, threshold, comparison = null, evidence = {} } = {}) {
  const official = assertOfficialResult(result);
  const classification = official.status === 'calculated' ? classifyThreshold(official.value, threshold) : { code: official.status, label: 'Sin medición oficial', positive: false };
  const causes = Array.isArray(evidence.causes) ? evidence.causes.filter(Boolean) : [];
  const impacts = Array.isArray(evidence.impacts) ? evidence.impacts.filter(Boolean) : [];
  const warnings = [...(official.warnings || []), ...(evidence.warnings || [])].filter(Boolean);
  return {
    result_status: official.status,
    classification,
    trend: comparison?.direction || 'unknown',
    cause: causes[0] || null,
    impact: impacts[0] || null,
    recommendation: evidence.recommendation || (official.status === 'calculated' ? null : 'Resolver la causa indicada antes de usar el indicador para decidir.'),
    proposed_action: evidence.proposed_action || null,
    priority: evidence.priority || (classification.positive ? 'normal' : 'attention'),
    suggested_owner: evidence.suggested_owner || definition?.owner || null,
    warnings,
    limitations: Array.isArray(evidence.limitations) ? evidence.limitations : [],
    evidence_checksum: checksum(evidence),
  };
}

function buildSnapshotPayload(input = {}) {
  const result = assertOfficialResult(input.result || {});
  const payload = {
    tenant_id: input.tenant_id,
    metric_code: input.metric_code,
    metric_definition_id: input.metric_definition_id,
    definition_version: input.definition_version,
    formula_code: input.formula_code,
    formula_version: input.formula_version,
    semantic_contract: input.semantic_contract || null,
    mapping: input.mapping || null,
    calculation_policy: input.calculation_policy,
    methodology_version: input.methodology_version,
    period: input.period,
    effective_at: input.effective_at,
    result,
    unit: input.unit,
    target: input.target ?? null,
    coverage: input.coverage ?? null,
    trust: input.trust,
    freshness: input.freshness,
    sufficiency: input.sufficiency,
    data_requirements: input.data_requirements || null,
    source_contract: input.source_contract || null,
    actionable_state: input.actionable_state || null,
    threshold: input.threshold,
    interpretation: input.interpretation,
    source_snapshot_ids: [...new Set(input.source_snapshot_ids || [])].sort(),
    lineage: input.lineage || [],
    calculation_run_id: input.calculation_run_id || null,
    correlation_id: input.correlation_id || null,
  };
  const reproducible = { ...payload, calculation_run_id: undefined, correlation_id: undefined };
  return { ...payload, checksum: checksum(reproducible) };
}

function compareSnapshots(base, current, type = 'period') {
  const compatible = base.metric_code === current.metric_code
    && base.formula_code === current.formula_code
    && base.formula_version === current.formula_version
    && base.methodology_version === current.methodology_version
    && base.unit === current.unit;
  if (!compatible) return { comparison_type: type, status: 'not_comparable', direction: 'not_comparable', reason: 'methodology_or_unit_incompatible', base_checksum: base.checksum, current_checksum: current.checksum };
  const baseValue = base.result?.status === 'calculated' ? finite(base.result.value) : null;
  const currentValue = current.result?.status === 'calculated' ? finite(current.result.value) : null;
  if (baseValue === null || currentValue === null) return { comparison_type: type, status: 'not_comparable', direction: 'not_comparable', reason: 'non_calculated_snapshot', base_checksum: base.checksum, current_checksum: current.checksum };
  const absolute = currentValue - baseValue;
  const relative = baseValue === 0 ? null : absolute / Math.abs(baseValue);
  const direction = absolute === 0 ? 'unchanged' : absolute > 0 ? 'increase' : 'decrease';
  const result = {
    comparison_type: type,
    status: 'comparable',
    direction,
    base_value: baseValue,
    current_value: currentValue,
    absolute_change: absolute,
    relative_change: relative,
    state_change: { from: base.interpretation?.classification?.code || null, to: current.interpretation?.classification?.code || null },
    trust_change: { from: base.trust?.status || 'unknown', to: current.trust?.status || 'unknown' },
    coverage_change: { from: base.coverage ?? null, to: current.coverage ?? null },
    base_checksum: base.checksum,
    current_checksum: current.checksum,
  };
  return { ...result, checksum: checksum(result) };
}

function actionProposalKey({ tenant_id, metric_snapshot_id, proposal_type, related_entity_type = '', related_entity_id = '' }) {
  return checksum({ tenant_id, metric_snapshot_id, proposal_type, related_entity_type, related_entity_id });
}

module.exports = {
  OFFICIAL_STATES,
  TRUST_DIMENSIONS,
  TRUST_STATUSES,
  IndicatorContractError,
  canonical,
  checksum,
  normalizeWeights,
  calculateDataTrust,
  evaluateFreshness,
  evaluateSufficiency,
  assertOfficialResult,
  classifyThreshold,
  buildInterpretation,
  buildSnapshotPayload,
  compareSnapshots,
  actionProposalKey,
};
