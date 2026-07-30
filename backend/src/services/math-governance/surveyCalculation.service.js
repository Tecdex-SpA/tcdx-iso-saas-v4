 'use strict';
const stats = require('./statisticalEngine.service');
const { MathGovernanceError, number } = stats;
const { officialResult, unmeasured } = require('./officialCalculation.service');

function visible(item) { return item.visible !== false && item.branchVisible !== false && item.hidden !== true; }
function applicable(item) { return visible(item) && item.notApplicable !== true && item.status !== 'not_applicable'; }
function validItem(item, index) {
  if (!visible(item) || item.notApplicable === true || item.status === 'not_applicable') return null;
  if (item.invalid === true || item.status === 'invalid') throw new MathGovernanceError('SURVEY_INVALID_RESPONSE', `Respuesta invalida en item ${index}.`);
  if (item.score === null || item.score === undefined || item.score === '') return { ...item, missing: true };
  const maxScore = number(item.maxScore ?? item.max_score, `items[${index}].maxScore`);
  if (maxScore <= 0) throw new MathGovernanceError('SURVEY_INVALID_MAX_SCORE', 'Maximo de pregunta debe ser positivo.');
  const score = number(item.score, `items[${index}].score`);
  if (score < 0 || score > maxScore) throw new MathGovernanceError('SURVEY_SCORE_RANGE', 'Score de encuesta fuera de rango.');
  return { ...item, score, maxScore, weight: number(item.weight ?? 1, `items[${index}].weight`) };
}
function surveyScore({ items = [] } = {}) {
  if (!Array.isArray(items) || !items.length) return { status: 'unmeasured', value: null, coverage: 0, usable: 0, expected: 0 };
  const expected = items.filter(applicable).length;
  let numerator = 0, denominator = 0, usable = 0, missing = 0;
  items.forEach((item, index) => {
    const current = validItem(item, index);
    if (!current) return;
    if (current.missing) { missing += 1; return; }
    numerator += current.weight * current.score;
    denominator += current.weight * current.maxScore;
    usable += 1;
  });
  if (denominator === 0) return { status: 'unmeasured', value: null, coverage: expected ? (usable / expected) * 100 : 100, usable, expected, missing };
  return { status: 'calculated', value: (numerator / denominator) * 100, coverage: expected ? (usable / expected) * 100 : 100, usable, expected, missing };
}
function groupScore(items = [], key) {
  const groups = new Map();
  for (const item of items) { const group = item[key] || 'unclassified'; groups.set(group, [...(groups.get(group) || []), item]); }
  return [...groups.entries()].map(([group, groupItems]) => ({ group, ...surveyScore({ items: groupItems }) }));
}
function responseRate({ completedResponses, validInvitations }) { return (number(completedResponses, 'completedResponses') / number(validInvitations, 'validInvitations')) * 100; }
function dropoutRate({ started, completed }) { return ((number(started, 'started') - number(completed, 'completed')) / number(started, 'started')) * 100; }
function cronbach({ matrix = [], dimension = null, compatible = true, minimumSample = 2 } = {}) {
  if (!compatible) return { status: 'not_applicable', value: null, warning: 'Dimension heterogenea; alfa no aplicable.', dimension };
  if (!Array.isArray(matrix) || matrix.length < minimumSample) return { status: 'unmeasured', value: null, warning: 'Muestra insuficiente para alfa de Cronbach.', dimension };
  if (!Array.isArray(matrix[0]) || matrix[0].length < 2) return { status: 'not_applicable', value: null, warning: 'Alfa requiere al menos dos preguntas compatibles.', dimension };
  return { status: 'calculated', value: stats.cronbachAlpha(matrix), dimension, interpretation: 'consistencia_interna' };
}
function surveyStatistics(values = []) {
  const clean = stats.numbers(values, { min: 1, label: 'surveyValues' });
  return { mean: stats.mean(clean), median: stats.median(clean), stddev: clean.length > 1 ? stats.stddevSample(clean) : 0, p25: stats.percentile(clean, .25), p50: stats.percentile(clean, .5), p75: stats.percentile(clean, .75), p90: stats.percentile(clean, .9), distribution: stats.mode(clean), sample_size: clean.length };
}
function grcProposals({ score, responseRate: rr = null, supplierId = null } = {}) {
  const proposals = [];
  if (score !== null && score < 60) proposals.push({ type: 'finding', severity: score < 40 ? 'high' : 'medium', requires_approval: true });
  if (score !== null && score < 50) proposals.push({ type: 'risk', severity: 'high', requires_approval: true });
  return proposals.concat(rr !== null && rr < 70 ? [{ type: 'action', priority: 'medium', requires_approval: true }] : [], supplierId ? [{ type: 'supplier_evaluation', supplier_id: supplierId, requires_approval: true }] : [], score !== null ? [{ type: 'maturity_evaluation', level: score >= 80 ? 'managed' : 'developing', requires_approval: true }] : []);
}
function officialSurveyScore(input = {}) { const r = surveyScore(input); if (r.status !== 'calculated') return unmeasured('F5_5_SURVEY_SCORE', 'Encuesta sin respuestas suficientes.', { unit: '%', period: input.period || {}, source: input.source || null, warnings: r.missing ? ['survey_incomplete'] : [] }); return officialResult('F5_5_SURVEY_SCORE', input, { period: input.period || {}, source: input.source || null, coverage: r.coverage, components: { usable: r.usable, expected: r.expected, groups: { section: groupScore(input.items || [], 'section'), dimension: groupScore(input.items || [], 'dimension') }, proposals: grcProposals({ score: r.value, responseRate: input.responseRate, supplierId: input.supplierId }) }, explanation: 'Score ponderado oficial de encuesta; no aplica y preguntas no visibles excluidas del denominador.' }); }
function officialResponseRate(input = {}) { return officialResult('F5_5_RESPONSE_RATE', input, { period: input.period || {}, source: input.source || null, components: { valid_invitations: input.validInvitations, completed: input.completedResponses } }); }
function officialDropoutRate(input = {}) { return officialResult('F5_5_DROPOUT_RATE', input, { period: input.period || {}, source: input.source || null, components: { started: input.started, completed: input.completed } }); }
function officialCronbach(input = {}) { const r = cronbach(input); if (r.status !== 'calculated') return unmeasured('F5_5_CRONBACH_ALPHA', r.warning || 'Alfa no calculable.', { unit: 'ratio', period: input.period || {}, source: input.source || null, warnings: [r.warning].filter(Boolean) }); return officialResult('F5_5_CRONBACH_ALPHA', input, { period: input.period || {}, source: input.source || null, components: { dimension: input.dimension, interpretation: r.interpretation, limitation: 'Solo valido para items homogeneos.' } }); }
function campaignAnalytics(input = {}) { const score = surveyScore({ items: input.items || [] }); return { score, response_rate: responseRate(input), dropout_rate: dropoutRate(input), sections: groupScore(input.items || [], 'section'), dimensions: groupScore(input.items || [], 'dimension'), statistics: surveyStatistics((input.items || []).filter((i) => i.score !== undefined && i.score !== null).map((i) => i.score)) }; }
module.exports = { surveyScore, groupScore, responseRate, dropoutRate, cronbach, surveyStatistics, campaignAnalytics, grcProposals, officialSurveyScore, officialResponseRate, officialDropoutRate, officialCronbach };
