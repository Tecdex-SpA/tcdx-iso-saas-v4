const crypto = require('crypto');

const EVIDENCE_FREQUENCIES = new Set([
  'daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom', 'event',
]);

const SCORE_WEIGHTS = Object.freeze({
  validity: 20,
  approval: 20,
  completeness: 15,
  format: 10,
  source: 10,
  integrity: 10,
  owner: 5,
  consistency: 5,
  coverage: 5,
});

function asBoolean(value) {
  return value === true || value === 1 || value === 'true';
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function nextOccurrence({ frequency, intervalValue = 1, from, customDays }) {
  if (!EVIDENCE_FREQUENCIES.has(frequency)) {
    throw new Error('EVIDENCE_FREQUENCY_INVALID');
  }
  if (frequency === 'event') return null;

  const start = new Date(from);
  if (Number.isNaN(start.getTime())) throw new Error('EVIDENCE_SCHEDULE_DATE_INVALID');
  const interval = Math.max(1, Number(intervalValue) || 1);

  if (frequency === 'daily') start.setUTCDate(start.getUTCDate() + interval);
  if (frequency === 'weekly') start.setUTCDate(start.getUTCDate() + (7 * interval));
  if (frequency === 'monthly') return addMonths(start, interval);
  if (frequency === 'quarterly') return addMonths(start, 3 * interval);
  if (frequency === 'semiannual') return addMonths(start, 6 * interval);
  if (frequency === 'annual') return addMonths(start, 12 * interval);
  if (frequency === 'custom') start.setUTCDate(start.getUTCDate() + Math.max(1, Number(customDays) || interval));
  return start;
}

function scoreEvidence(input = {}) {
  const now = input.now ? new Date(input.now) : new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  const valid = !expiresAt || (!Number.isNaN(expiresAt.getTime()) && expiresAt >= now);
  const factors = {
    validity: valid ? 1 : 0,
    approval: input.status === 'approved' || asBoolean(input.validated) ? 1 : 0,
    completeness: input.description && input.fileName ? 1 : input.fileName ? 0.6 : 0,
    format: input.mimeType ? 1 : 0,
    source: input.sourceType && input.sourceType !== 'unknown' ? 1 : 0.5,
    integrity: input.contentHash ? 1 : 0,
    owner: input.ownerId ? 1 : 0,
    consistency: input.consistent === false ? 0 : 1,
    coverage: clamp(input.coverage ?? 0) / 100,
  };
  const contributions = {};
  let score = 0;
  for (const [factor, weight] of Object.entries(SCORE_WEIGHTS)) {
    contributions[factor] = Number((factors[factor] * weight).toFixed(2));
    score += contributions[factor];
  }
  return {
    score: Number(score.toFixed(2)),
    formulaVersion: 'evidence-quality-v1',
    weights: SCORE_WEIGHTS,
    factors,
    contributions,
    limitations: [
      'El puntaje es determinista y no acredita conformidad.',
      'La calidad documental requiere revision humana.',
    ],
  };
}

function calculateReadiness(dimensions = []) {
  const normalized = dimensions.map((dimension) => ({
    ...dimension,
    score: clamp(dimension.score),
    weight: Math.max(0, Number(dimension.weight) || 0),
  }));
  const totalWeight = normalized.reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight
    ? normalized.reduce((sum, item) => sum + (item.score * item.weight), 0) / totalWeight
    : 0;
  return {
    score: Number(score.toFixed(2)),
    formulaVersion: 'audit-readiness-v1',
    inputHash: sha256(normalized),
    dimensions: normalized,
    limitations: [
      'Indicador de preparacion basado en registros operacionales disponibles.',
      'No constituye certificacion ni reemplaza una auditoria.',
    ],
  };
}

function validateWorkflowDraft({ states = [], transitions = [] }) {
  const errors = [];
  const stateCodes = new Set(states.map((state) => String(state.code || '').trim()).filter(Boolean));
  const initialStates = states.filter((state) => state.state_type === 'initial');
  if (initialStates.length !== 1) errors.push('WORKFLOW_REQUIRES_ONE_INITIAL_STATE');
  if (!states.some((state) => state.state_type === 'terminal')) errors.push('WORKFLOW_REQUIRES_TERMINAL_STATE');
  if (stateCodes.size !== states.length) errors.push('WORKFLOW_STATE_CODES_MUST_BE_UNIQUE');
  for (const transition of transitions) {
    if (!stateCodes.has(transition.from_state) || !stateCodes.has(transition.to_state)) {
      errors.push(`WORKFLOW_TRANSITION_STATE_INVALID:${transition.code || 'unknown'}`);
    }
    if (transition.from_state === transition.to_state) {
      errors.push(`WORKFLOW_TRANSITION_SELF_REFERENCE:${transition.code || 'unknown'}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  EVIDENCE_FREQUENCIES,
  SCORE_WEIGHTS,
  calculateReadiness,
  nextOccurrence,
  scoreEvidence,
  sha256,
  stableStringify,
  validateWorkflowDraft,
};
