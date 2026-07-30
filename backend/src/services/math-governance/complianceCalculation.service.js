 'use strict';
const { MathGovernanceError, number } = require('./statisticalEngine.service');
const { officialResult, unmeasured } = require('./officialCalculation.service');
function percentage(numerator, denominator, code = 'COMPLIANCE_ZERO_DENOMINATOR') {
  const den = number(denominator, 'denominator');
  if (den === 0) throw new MathGovernanceError(code, 'Denominador cero.');
  return (number(numerator, 'numerator') / den) * 100;
}
function normalizeAssessment(item, partialScore = 0.5) {
  const status = String(item.status || '').toLowerCase().trim();
  const applicable = !(item.applicable === false || ['not_applicable', 'no_aplica', 'na'].includes(status));
  const evaluated = applicable && !['not_evaluated', 'no_evaluado', 'pending', ''].includes(status);
  const score = ['conform', 'conforme', 'compliant'].includes(status) ? 1 : ['partial', 'parcial', 'partially_compliant'].includes(status) ? partialScore : 0;
  return { ...item, applicable, evaluated, score, weight: number(item.weight ?? 1, 'weight') };
}
function weightedCompliance({ assessments = [], partialScore = 0.5 } = {}) {
  const normalized = assessments.map((item) => normalizeAssessment(item, partialScore));
  let weighted = 0, weights = 0, evaluated = 0, applicable = 0, notApplicable = 0, notEvaluated = 0;
  for (const item of normalized) {
    if (!item.applicable) { notApplicable += 1; continue; }
    applicable += 1;
    if (!item.evaluated) { notEvaluated += 1; continue; }
    weighted += item.weight * item.score;
    weights += item.weight;
    evaluated += 1;
  }
  if (applicable === 0) return { value: null, coverage: null, evaluated, applicable, notApplicable, notEvaluated, status: 'unmeasured' };
  if (weights === 0) return { value: null, coverage: applicable ? (evaluated / applicable) * 100 : null, evaluated, applicable, notApplicable, notEvaluated, status: 'unmeasured' };
  return { value: (weighted / weights) * 100, coverage: (evaluated / applicable) * 100, evaluated, applicable, notApplicable, notEvaluated, status: 'completed' };
}
function coverage({ evaluated, applicable }) { return percentage(evaluated, applicable, 'COVERAGE_ZERO_APPLICABLE'); }
function groupCompliance(assessments = [], groupBy, options = {}) {
  const groups = new Map();
  for (const item of assessments) {
    const key = item[groupBy] || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([key, rows]) => ({ key, ...weightedCompliance({ assessments: rows, partialScore: options.partialScore }) }));
}
function officialCompliance({ assessments = [], period = {}, source = null, partialScore = 0.5 } = {}) {
  const summary = weightedCompliance({ assessments, partialScore });
  if (summary.value === null) return unmeasured('F5_5_COMPLIANCE_WEIGHTED', 'Sin requisitos aplicables evaluados; cumplimiento queda unmeasured.', { unit: '%', period, source });
  return officialResult('F5_5_COMPLIANCE_WEIGHTED', { assessments, partialScore }, { period, source, coverage: summary.coverage, components: summary, explanation: 'Cumplimiento oficial ponderado; no aplica excluido y no evaluado afecta cobertura.' });
}
function officialCoverage({ evaluated, applicable, period = {}, source = null } = {}) {
  if (!applicable) return unmeasured('F5_5_COVERAGE', 'Sin requisitos aplicables para calcular cobertura.', { unit: '%', period, source });
  return officialResult('F5_5_COVERAGE', { evaluated, applicable }, { period, source, coverage: (Number(evaluated) / Number(applicable)) * 100 });
}
function completeness({ validRequired, expectedRequired }) { return percentage(validRequired, expectedRequired, 'COMPLETENESS_ZERO_EXPECTED'); }
function accuracy({ verifiedCorrect, verified }) { return percentage(verifiedCorrect, verified, 'ACCURACY_NO_REFERENCE'); }
function consistency({ contradictory, evaluated }) { return (1 - (number(contradictory, 'contradictory') / number(evaluated, 'evaluated'))) * 100; }
function lineageScore({ presentRelations, requiredRelations }) { return percentage(presentRelations, requiredRelations, 'LINEAGE_ZERO_REQUIRED'); }
module.exports = { weightedCompliance, coverage, groupCompliance, officialCompliance, officialCoverage, completeness, accuracy, consistency, lineageScore };
