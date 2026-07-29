'use strict';

const COMPONENTS = [
  'completeness',
  'accuracy',
  'consistency',
  'freshness',
  'lineage',
  'validation',
  'stability',
  'coverage',
  'source_availability',
  'assurance_result',
  'evidence_trace',
  'dimension_quality',
];

const DEFAULT_WEIGHTS = Object.freeze({
  completeness: 0.12,
  accuracy: 0.12,
  consistency: 0.1,
  freshness: 0.12,
  lineage: 0.1,
  validation: 0.1,
  stability: 0.06,
  coverage: 0.06,
  source_availability: 0.08,
  assurance_result: 0.06,
  evidence_trace: 0.04,
  dimension_quality: 0.04,
});

class TrustScoreError extends Error {
  constructor(code, message, status = 422, details = null) {
    super(message);
    this.name = 'TrustScoreError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function normalizeWeights(weights = DEFAULT_WEIGHTS) {
  const normalized = {};
  let total = 0;
  for (const key of COMPONENTS) {
    const weight = Number(weights[key] ?? DEFAULT_WEIGHTS[key]);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new TrustScoreError('TRUST_WEIGHT_INVALID', 'Los pesos del Data Trust Score deben ser numeros no negativos.', 422, { component: key });
    }
    normalized[key] = weight;
    total += weight;
  }
  if (Math.abs(total - 1) > 0.0001) {
    throw new TrustScoreError('TRUST_WEIGHTS_SUM_INVALID', 'La suma de pesos del Data Trust Score debe ser 1.', 422, { total });
  }
  return normalized;
}

function normalizeComponent(key, input = {}, weight) {
  const status = String(input.status || 'unknown').toLowerCase();
  const score = clampScore(input.score);
  return {
    component: key,
    score,
    weight,
    status: ['trusted', 'acceptable', 'attention', 'untrusted', 'unknown'].includes(status) ? status : 'unknown',
    reason: String(input.reason || 'Sin evidencia suficiente para este componente.').slice(0, 500),
    evidence: input.evidence || null,
  };
}

function statusFromScore(score, components) {
  const rejected = components.validation?.status === 'untrusted';
  const unavailable = components.source_availability?.status === 'untrusted';
  const stale = ['untrusted', 'unknown'].includes(components.freshness?.status);
  const noLineage = components.lineage?.score < 100;
  if (rejected || unavailable || score < 40) return 'untrusted';
  if (stale || score < 70 || components.assurance_result?.status === 'attention') return 'attention';
  if (noLineage || score < 85) return 'acceptable';
  return 'trusted';
}

function calculateTrustScore(input = {}, weightsInput = DEFAULT_WEIGHTS) {
  const weights = normalizeWeights(weightsInput);
  const components = {};
  let score = 0;

  for (const key of COMPONENTS) {
    const component = normalizeComponent(key, input[key], weights[key]);
    components[key] = component;
    score += component.score * component.weight;
  }

  if (components.freshness.status === 'untrusted') score = Math.min(score, 69);
  if (components.freshness.status === 'unknown') score = Math.min(score, 74);
  if (components.source_availability.status === 'untrusted') score = Math.min(score, 59);
  if (components.source_availability.status === 'unknown') score = Math.min(score, 79);
  if (components.lineage.score < 100) score = Math.min(score, 89);
  if (components.evidence_trace.score < 100) score = Math.min(score, 94);
  if (components.validation.status === 'untrusted') score = Math.min(score, 39);
  if (components.assurance_result.status === 'untrusted') score = Math.min(score, 69);

  const rounded = Math.round(score * 100) / 100;
  return {
    score: rounded,
    status: statusFromScore(rounded, components),
    components,
    formula_version: 'data_trust_score_v2',
    calculated_at: new Date().toISOString(),
  };
}

function assessFreshness({ observedAt, frequency = 'on_demand', now = new Date() } = {}) {
  if (!observedAt) return { status: 'unknown', score: 0, reason: 'No existe fecha de observacion de la fuente.' };
  const observed = new Date(observedAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(observed) || observed > current) {
    return { status: 'unknown', score: 0, reason: 'Fecha de observacion invalida.' };
  }
  const ageHours = (current - observed) / 36e5;
  const thresholds = {
    realtime: [1, 8, 24],
    daily: [24, 72, 168],
    weekly: [168, 336, 720],
    monthly: [744, 1488, 2232],
    quarterly: [2232, 4464, 6696],
    semiannual: [4464, 6696, 8928],
    annual: [8928, 13140, 17520],
    on_demand: [720, 2160, 4320],
  }[frequency] || [720, 2160, 4320];

  if (ageHours <= thresholds[0]) return { status: 'current', score: 100, reason: 'Dato vigente para su frecuencia.' };
  if (ageHours <= thresholds[1]) return { status: 'aging', score: 75, reason: 'Dato envejeciendo; requiere seguimiento.' };
  if (ageHours <= thresholds[2]) return { status: 'stale', score: 45, reason: 'Dato stale para su frecuencia.' };
  return { status: 'expired', score: 20, reason: 'Dato expirado para su frecuencia.' };
}

module.exports = {
  COMPONENTS,
  DEFAULT_WEIGHTS,
  TrustScoreError,
  calculateTrustScore,
  assessFreshness,
  normalizeWeights,
};
