 'use strict';
const crypto = require('crypto');
const { calculateTrustScore } = require('../phase5/dataTrustScore');

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}
function round(value, precision = 2) {
  if (value === null || value === undefined) return null;
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
function stable(value) { return JSON.stringify(value, Object.keys(value).sort()); }
function hash(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function formulaRegistry() { return require('./formulaRegistry.service'); }
function unmeasured(formulaCode, reason, { unit = null, period = {}, source = null, warnings = [] } = {}) {
  const { FORMULA_MAP } = formulaRegistry();
  const formula = FORMULA_MAP.get(formulaCode);
  return {
    value: null,
    unit: unit || formula?.units?.output || null,
    status: 'unmeasured',
    formula_code: formulaCode,
    formula_version: formula?.version || 1,
    period,
    coverage: null,
    trust_score: null,
    trust_status: 'unknown',
    source_status: source?.status || 'source_unavailable',
    warnings: [reason, ...warnings].filter(Boolean),
    calculation_run_id: null,
    explanation_url: null,
    lineage_url: null,
    explanation: reason,
    components: {},
    lineage: source?.lineage || [],
  };
}
function trustFromSource(source, extra = {}) {
  const sourceReady = source?.status === 'ready' || source?.status === 'validated_with_warnings';
  return calculateTrustScore({
    completeness: { score: source?.counts?.usable && source?.counts?.received ? (source.counts.usable / source.counts.received) * 100 : sourceReady ? 100 : 0, status: sourceReady ? 'acceptable' : 'unknown', reason: 'Cobertura util del dataset fuente.' },
    accuracy: { score: extra.accuracy ?? (sourceReady ? 80 : 0), status: sourceReady ? 'acceptable' : 'unknown', reason: 'Exactitud segun validaciones operacionales disponibles.' },
    consistency: { score: extra.consistency ?? (source?.invalid_rows?.length ? 60 : sourceReady ? 90 : 0), status: source?.invalid_rows?.length ? 'attention' : sourceReady ? 'acceptable' : 'unknown', reason: 'Consistencia de filas validas.' },
    freshness: { score: extra.freshness ?? (sourceReady ? 80 : 0), status: sourceReady ? 'acceptable' : 'unknown', reason: 'Freshness normalizada por contrato fuente.' },
    lineage: { score: source?.lineage?.length ? 100 : 0, status: source?.lineage?.length ? 'trusted' : 'unknown', reason: 'Lineage source->snapshot->formula.' },
    validation: { score: source?.exclusions?.length ? 70 : sourceReady ? 95 : 0, status: source?.exclusions?.length ? 'attention' : sourceReady ? 'trusted' : 'unknown', reason: 'Resultado de dataset validation.' },
    stability: { score: extra.stability ?? 75, status: sourceReady ? 'acceptable' : 'unknown', reason: 'Estabilidad operacional pendiente de series historicas.' },
    coverage: { score: source?.counts?.usable && source?.counts?.received ? (source.counts.usable / source.counts.received) * 100 : sourceReady ? 100 : 0, status: sourceReady ? 'acceptable' : 'unknown', reason: 'Cobertura de filas utiles.' },
    source_availability: { score: sourceReady ? 100 : 0, status: sourceReady ? 'trusted' : 'unknown', reason: `Estado fuente ${source?.status || 'unknown'}.` },
    assurance_result: { score: extra.assurance ?? 75, status: sourceReady ? 'acceptable' : 'unknown', reason: 'Assurance disponible segun paquete.' },
    evidence_trace: { score: source?.lineage?.length ? 100 : 0, status: source?.lineage?.length ? 'trusted' : 'unknown', reason: 'Trazabilidad de evidencia/lineage.' },
    dimension_quality: { score: extra.dimensionQuality ?? 75, status: sourceReady ? 'acceptable' : 'unknown', reason: 'Calidad dimensional.' },
  });
}
function officialResult(formulaCode, inputs = {}, { period = {}, coverage = null, source = null, trust = null, components = {}, explanation = null, warnings = [], runId = null } = {}) {
  const { executeFormula, FORMULA_MAP } = formulaRegistry();
  const formula = FORMULA_MAP.get(formulaCode);
  const calculated = executeFormula(formulaCode, inputs);
  const trustScore = trust || trustFromSource(source || { status: 'ready', counts: { usable: 1, received: 1 }, lineage: [{ formula_version: `${formulaCode}@${formula?.version || 1}` }] });
  const payload = { formulaCode, inputs, period, source_hash: source?.input_hash || null };
  const calculationRunId = runId || `local-${hash(payload).slice(0, 32)}`;
  return {
    value: round(calculated.value, calculated.precision ?? formula?.precision ?? 2),
    unit: calculated.unit,
    status: calculated.status === 'calculated' ? 'completed' : calculated.status,
    formula_code: formulaCode,
    formula_version: calculated.version || formula?.version || 1,
    period,
    coverage,
    trust_score: trustScore.score,
    trust_status: trustScore.status,
    source_status: source?.status || 'available',
    warnings: [...(source?.warnings || []), ...warnings],
    calculation_run_id: calculationRunId,
    explanation_url: `/api/grc/official/calculations/${calculationRunId}/explanation`,
    lineage_url: `/api/grc/official/calculations/${calculationRunId}/lineage`,
    explanation: explanation || calculated.explanation,
    details: calculated.details || {},
    components,
    lineage: source?.lineage || [],
    input_hash: source?.input_hash || hash(inputs),
  };
}
function statusFromScore(value) {
  if (value === null || value === undefined) return 'unmeasured';
  if (value >= 85) return 'strong';
  if (value >= 70) return 'acceptable';
  if (value >= 50) return 'attention';
  return 'critical';
}
module.exports = { officialResult, unmeasured, trustFromSource, statusFromScore, clamp, round, hash };
