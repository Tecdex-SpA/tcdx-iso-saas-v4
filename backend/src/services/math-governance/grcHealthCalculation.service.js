'use strict';
const { MathGovernanceError, number } = require('./statisticalEngine.service');
const { officialResult, unmeasured, statusFromScore, clamp } = require('./officialCalculation.service');
const COMPONENT_STATES = Object.freeze(['AVAILABLE', 'MISSING', 'NOT_APPLICABLE', 'NOT_CONFIGURED', 'STALE', 'INVALID', 'UNKNOWN']);
const HEALTH_DEFINITIONS = Object.freeze({
  grc_health: { formula_code: 'F5_5_GRC_HEALTH', version: 2, weights: { risk: 0.2, compliance: 0.25, actions: 0.15, evidence: 0.2, dataTrust: 0.2 }, components: ['risk','compliance','actions','evidence','dataTrust'], minimum_coverage: 0.8 },
  iso_health: { formula_code: 'F5_5_GRC_HEALTH', version: 2, weights: { risk: 0.15, compliance: 0.3, actions: 0.15, evidence: 0.2, dataTrust: 0.2 }, components: ['risk','compliance','readiness','evidence','actions','dataTrust'], minimum_coverage: 0.8 },
  risk_health: { formula_code: 'F5_5_RESIDUAL_RISK', version: 1, weights: { residualRisk: 0.7, dataTrust: 0.3 }, components: ['residualRisk','dataTrust'] },
  control_health: { formula_code: 'F5_5_CONTROL_EFFECTIVENESS', version: 1, weights: { effectiveness: 0.65, coverage: 0.2, dataTrust: 0.15 }, components: ['effectiveness','coverage','dataTrust'] },
  evidence_health: { formula_code: 'F5_5_GRC_HEALTH', version: 1, weights: { evidence: 0.8, dataTrust: 0.2 }, components: ['evidence','dataTrust'] },
  action_health: { formula_code: 'F5_5_WEIGHTED_PROGRESS', version: 1, weights: { progress: 0.6, overdue: 0.25, closure: 0.15 }, components: ['progress','overdue','closure'] },
  data_health: { formula_code: 'F5_5_GRC_HEALTH', version: 1, weights: { dataTrust: 1 }, components: ['dataTrust'] },
  operational_excellence_health: { formula_code: 'F5_5_GRC_HEALTH', version: 1, weights: { risk: 0.15, compliance: 0.15, actions: 0.15, evidence: 0.15, dataTrust: 0.4 }, components: ['efficacy','efficiency','stability','quality','timeliness','risk','compliance','actions','dataTrust'] },
  survey_health: { formula_code: 'F5_5_SURVEY_SCORE', version: 1, weights: { score: 0.55, responseRate: 0.25, consistency: 0.2 }, components: ['score','responseRate','consistency'] },
  assurance_health: { formula_code: 'F5_5_ASSURANCE_SCORE', version: 1, weights: { score: 0.6, evidence: 0.2, sampleQuality: 0.2 }, components: ['score','evidence','sampleQuality'] },
  loss_health: { formula_code: 'F5_5_EXPECTED_LOSS', version: 1, weights: { expectedLoss: 0.45, severity: 0.25, concentration: 0.15, dataTrust: 0.15 }, components: ['expectedLoss','severity','concentration','dataTrust'] },
  continuity_health: { formula_code: 'F5_5_AVAILABILITY', version: 1, weights: { availability: 0.35, sla: 0.25, recovery: 0.25, dataTrust: 0.15 }, components: ['availability','sla','rtoGap','rpoGap','dataTrust'] },
  asset_health: { formula_code: 'F5_5_ASSET_CRITICALITY', version: 1, weights: { classification: 0.5, controlCoverage: 0.25, dataTrust: 0.25 }, components: ['classification','controlCoverage','dataTrust'] },
  supplier_health: { formula_code: 'F5_5_SUPPLIER_RISK', version: 1, weights: { residualRisk: 0.4, assurance: 0.2, continuity: 0.2, losses: 0.1, dataTrust: 0.1 }, components: ['residualRisk','assurance','continuity','losses','dataTrust'] },
});
function assertWeights(weights) { const total = Object.values(weights).reduce((sum, value) => sum + number(value, 'weight'), 0); if (Math.abs(total - 1) > 0.0001) throw new MathGovernanceError('HEALTH_WEIGHTS_SUM_INVALID', 'Pesos de health deben sumar 1.'); }
function inverseResidualRisk(residualRisk, maxRisk = 25) { return clamp(1 - (number(residualRisk, 'residualRisk') / number(maxRisk, 'maxRisk')), 0, 1); }
function componentStateFromInput(input, key) {
  const raw = input?.component_states?.[key] || input?._component_states?.[key] || null;
  const classification = String(raw?.classification || raw?.state || '').toUpperCase();
  if (COMPONENT_STATES.includes(classification)) return { ...raw, classification };
  return null;
}
function normalizeRatio(value, key) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (key === 'risk') return clamp(parsed > 1 ? 1 - (parsed / 100) : parsed);
  return parsed > 1 ? parsed / 100 : parsed;
}
function classifyInputComponent(input, key) {
  const declared = componentStateFromInput(input, key);
  if (declared?.classification && declared.classification !== 'AVAILABLE') return declared;
  const normalized = normalizeRatio(input?.[key], key);
  if (normalized === null) {
    return declared || { classification: 'MISSING', reason: 'component_value_missing' };
  }
  return { ...(declared || {}), classification: 'AVAILABLE', value: normalized, raw_value: input[key] };
}
function dynamicGrcHealth(input = {}) {
  const weights = input.weights || HEALTH_DEFINITIONS.grc_health.weights;
  const threshold = Number(input.minimum_coverage ?? input.coverage_threshold ?? HEALTH_DEFINITIONS.grc_health.minimum_coverage);
  assertWeights(weights);
  const components = [];
  let availableWeight = 0;
  let applicableWeight = 0;
  let weightedAvailableScore = 0;
  for (const key of Object.keys(weights)) {
    const weight = number(weights[key], `weights.${key}`);
    const component = classifyInputComponent(input, key);
    if (component.classification !== 'NOT_APPLICABLE') applicableWeight += weight;
    if (component.classification === 'AVAILABLE') {
      availableWeight += weight;
      weightedAvailableScore += weight * number(component.value, key);
    }
    components.push({ key, weight, ...component });
  }
  const coverage = applicableWeight > 0 ? availableWeight / applicableWeight : 0;
  const value = availableWeight > 0 ? 100 * (weightedAvailableScore / availableWeight) : null;
  const missingComponents = components
    .filter((component) => component.classification !== 'AVAILABLE' && component.classification !== 'NOT_APPLICABLE')
    .map((component) => ({ key: component.key, classification: component.classification, reason: component.reason || null }));
  const globalStatus = value === null ? 'not_calculable' : coverage >= threshold ? 'measured' : 'insufficient_coverage';
  return {
    value,
    score: value,
    global_status: globalStatus,
    status: globalStatus,
    coverage,
    confidence: coverage,
    threshold,
    available_weight: availableWeight,
    applicable_weight: applicableWeight,
    weighted_available_score: weightedAvailableScore,
    components,
    missing_components: missingComponents,
    score_publicable: Boolean(value !== null && coverage >= threshold),
  };
}
function grcHealth(input = {}) { return dynamicGrcHealth(input).value; }
function officialGrcHealth(input = {}) {
  const health = dynamicGrcHealth(input);
  if (health.value === null) return unmeasured('F5_5_GRC_HEALTH', 'Health no calculable: no hay componentes oficiales disponibles.', { unit: 'score', period: input.period || {}, source: input.source || null, coverage: health.coverage, components: health.components });
  const result = officialResult('F5_5_GRC_HEALTH', { ...input, health }, {
    period: input.period || {},
    source: input.source || null,
    coverage: health.coverage,
    confidence: health.confidence,
    components: { weights: input.weights || HEALTH_DEFINITIONS.grc_health.weights, values: { risk: input.risk, compliance: input.compliance, actions: input.actions, evidence: input.evidence, dataTrust: input.dataTrust }, classifications: health.components, missing_components: health.missing_components },
    explanation: health.score_publicable
      ? 'GRC Health oficial v2 con componentes disponibles y cobertura suficiente.'
      : 'GRC Health oficial v2 calculado internamente con cobertura insuficiente para publicación ejecutiva.',
  });
  return { ...result, health_status: health.global_status, coverage: health.coverage, confidence: health.confidence, missing_components: health.missing_components };
}
function officialIsoHealth(input = {}) { return officialGrcHealth({ ...input, weights: HEALTH_DEFINITIONS.iso_health.weights }); }
function listHealthDefinitions() { return Object.entries(HEALTH_DEFINITIONS).map(([score_code, definition]) => ({ score_code, ...definition, status: 'published', period: 'requested_period', coverage: 'explicit', data_trust: 'required', explanation: 'drill_down_required' })); }
module.exports = { COMPONENT_STATES, HEALTH_DEFINITIONS, listHealthDefinitions, inverseResidualRisk, classifyInputComponent, dynamicGrcHealth, grcHealth, officialGrcHealth, officialIsoHealth };
