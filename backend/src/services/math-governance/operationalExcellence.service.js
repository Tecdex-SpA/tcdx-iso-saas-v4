 'use strict';
const { officialGrcHealth } = require('./grcHealthCalculation.service');
const { clamp, statusFromScore } = require('./officialCalculation.service');
function averageMeasured(values) { const measured = values.filter((value) => value !== null && value !== undefined).map(Number).filter(Number.isFinite); if (!measured.length) return null; return measured.reduce((sum, value) => sum + value, 0) / measured.length; }
function operationalExcellence(input = {}) {
  const components = {
    efficacy: input.efficacy ?? input.compliance ?? null,
    efficiency: input.efficiency ?? input.actions ?? null,
    stability: input.stability ?? input.risk ?? null,
    quality: input.quality ?? input.evidence ?? null,
    timeliness: input.timeliness ?? input.actions ?? null,
    risk: input.risk ?? null,
    compliance: input.compliance ?? null,
    actions: input.actions ?? null,
    dataTrust: input.dataTrust ?? null,
  };
  const value = averageMeasured(Object.values(components));
  const health = value === null ? null : officialGrcHealth({ risk: clamp((components.risk ?? value) / 100, 0, 1), compliance: clamp((components.compliance ?? value) / 100, 0, 1), actions: clamp((components.actions ?? value) / 100, 0, 1), evidence: clamp((components.quality ?? value) / 100, 0, 1), dataTrust: clamp((components.dataTrust ?? value) / 100, 0, 1), period: input.period || {}, source: input.source || null });
  return { value, status: statusFromScore(value), components, health, snapshot: { period: input.period || {}, generated_at: new Date().toISOString(), formula_version: health?.formula_version || 1 }, explanation: 'Operational Excellence consolida eficacia, eficiencia, estabilidad, calidad, oportunidad, riesgo, cumplimiento, acciones y Data Trust.' };
}
module.exports = { operationalExcellence };
