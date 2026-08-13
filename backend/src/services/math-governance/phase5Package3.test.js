 'use strict';
const assert = require('assert');
const compliance = require('./complianceCalculation.service');
const controls = require('./controlCalculation.service');
const risk = require('./riskCalculation.service');
const actions = require('./actionCalculation.service');
const readiness = require('./readinessCalculation.service');
const health = require('./grcHealthCalculation.service');
const { operationalExcellence } = require('./operationalExcellence.service');
const { buildOverviewOfficialCalculations, calculateOfficialByKey } = require('./phase5Package3.service');
const { resolveFormulaSource } = require('./sourceResolver.service');
const { executeFormula } = require('./formulaRegistry.service');

function close(actual, expected, tolerance = 0.01) { assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `${actual} != ${expected}`); }
const assessments = [
  { status: 'conform', weight: 2, standard: 'ISO27001', clause: '5', domain: 'A', process: 'TI', owner: 'a' },
  { status: 'partial', weight: 1, standard: 'ISO27001', clause: '6', domain: 'A', process: 'TI', owner: 'a' },
  { status: 'not_applicable', weight: 1, standard: 'ISO27001', clause: '7', domain: 'B', process: 'OPS', owner: 'b' },
  { status: 'not_evaluated', weight: 1, standard: 'ISO27001', clause: '8', domain: 'B', process: 'OPS', owner: 'b' },
  { status: 'non_conform', weight: 1, standard: 'ISO27001', clause: '9', domain: 'B', process: 'OPS', owner: 'b' },
];
const wc = compliance.weightedCompliance({ assessments });
close(wc.value, 62.5);
close(wc.coverage, 75);
assert.strictEqual(wc.notApplicable, 1);
assert.strictEqual(wc.notEvaluated, 1);
assert.strictEqual(compliance.groupCompliance(assessments, 'process').length, 2);
assert.strictEqual(compliance.officialCompliance({ assessments }).formula_code, 'F5_5_COMPLIANCE_WEIGHTED');
assert.strictEqual(compliance.officialCompliance({ assessments: [] }).status, 'unmeasured');

close(controls.controlEffectiveness({ design: .8, implementation: .7, operation: .9, evidence: .6 }), .75);
close(controls.combinedEffectiveness({ effectivenesses: [.4, .5], dependencyFactor: .9 }), .63);
assert.throws(() => controls.controlEffectiveness({ design: .8, implementation: .7, operation: .9, evidence: .6, weights: { design: .9, implementation: .1, operation: .1, evidence: .1 } }), /Pesos/);
assert.strictEqual(controls.officialCombinedEffectiveness({ effectivenesses: [] }).status, 'unmeasured');

assert.strictEqual(risk.inherentRisk({ probability: 4, impact: 5 }), 20);
assert.strictEqual(risk.residualRisk({ inherentRisk: 20, controlEffectiveness: .65 }), 7);
assert.strictEqual(risk.classifyRisk(16), 'critical');
assert.strictEqual(risk.classifyRisk(10), 'high');
close(risk.multidimensionalImpact({ financial: 4, legal: 2 }, { financial: .7, legal: .3 }), 3.4);
assert.strictEqual(risk.officialResidualRisk({ inherentRisk: 20, controlEffectiveness: .65 }).formula_code, 'F5_5_RESIDUAL_RISK');

const summary = actions.summarizeActions({ now: '2026-01-11T00:00:00Z', items: [
  { status: 'open', createdAt: '2026-01-01T00:00:00Z', dueAt: '2026-01-05T00:00:00Z', progress: .5, weight: 2 },
  { status: 'closed', openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-06T00:00:00Z', progress: 1, weight: 1 },
] });
assert.strictEqual(summary.open, 1);
assert.strictEqual(summary.closed, 1);
assert.strictEqual(summary.overdue, 1);
close(summary.mttc, 5);
assert.strictEqual(actions.officialWeightedProgress({ items: summary.progressItems }).formula_code, 'F5_5_WEIGHTED_PROGRESS');

close(readiness.readiness({ compliance: .8, evidence: .7, health: .9, actions: .6, coverage: 100 }), 77);
close(readiness.readiness({ compliance: .8, evidence: .7, health: .9, actions: .6, coverage: 35, minimumCoverage: 70 }), 38.5);
assert.strictEqual(readiness.officialReadiness({ compliance: null, evidence: .7, health: .9, actions: .6 }).status, 'unmeasured');

close(health.inverseResidualRisk(5, 25), .8);
const grc = health.officialGrcHealth({ risk: .8, compliance: .9, actions: .7, evidence: .6, dataTrust: .85 });
close(grc.value, 78);
assert.ok(grc.components.weights);
assert.ok(health.listHealthDefinitions().length >= 8);
const oe = operationalExcellence({ compliance: 80, actions: 70, risk: 78, quality: 75, dataTrust: 85 });
assert.ok(oe.value > 0);
assert.ok(oe.snapshot.formula_version);

const overview = buildOverviewOfficialCalculations({
  compliance: { status: 'ok', data: { score: 80 }, trust: { score: 80 }, source_count: 3, warnings: [] },
  controls: { status: 'ok', trust: { score: 75 }, source_count: 2, warnings: [] },
  evidence: { status: 'ok', trust: { score: 70 }, source_count: 2, warnings: [] },
  actions: { status: 'ok', trust: { score: 70 }, source_count: 2, warnings: [] },
  risks: { status: 'ok', trust: { score: 80 }, source_count: 2, warnings: [] },
  data_trust: { status: 'ok', trust: { score: 85 }, source_count: 2, warnings: [] },
  metrics: { status: 'ok', trust: { score: 80 }, source_count: 2, warnings: [] },
}, { requestId: 'pkg3' });
assert.strictEqual(overview.health.formula_code, 'F5_5_GRC_HEALTH');
assert.strictEqual(overview.readiness.formula_code, 'F5_5_READINESS');
assert.strictEqual(calculateOfficialByKey('health-grc', { risk: .8, compliance: .9, actions: .7, evidence: .6, dataTrust: .85 }).formula_code, 'F5_5_GRC_HEALTH');
assert.throws(() => calculateOfficialByKey('unknown', {}), /Calculo oficial no soportado/);

function fakeTableExists(params, present) {
  const table = String(params?.[0] || '').replace(/^public\./, '');
  return { rows: [{ exists: present.includes(table) }] };
}

async function reconciliationTests() {
  const controlClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return fakeTableExists(params, ['grc_control_assurance']);
    if (sql.includes('FROM grc_control_assurance a')) return { rows: [
      { id: 'control-a', tenant_id: 'tenant-a', assurance_status: 'effective', status: 'effective', score: 88, calculated_at: '2026-08-10T12:00:00Z', __event_time: '2026-08-10T12:00:00Z' },
      { id: 'control-b', tenant_id: 'tenant-a', assurance_status: 'incomplete', status: 'incomplete', score: 72, calculated_at: '2026-08-10T12:00:00Z', __event_time: '2026-08-10T12:00:00Z' },
    ] };
    throw new Error(`unexpected control query: ${sql}`);
  } };
  const controlSource = await resolveFormulaSource({ client: controlClient, tenantId: 'tenant-a', formulaCode: 'F5_5_CONTROL_EFFECTIVENESS', period: { start: '2026-08-01T00:00:00Z', end: '2026-08-13T23:59:59Z' } });
  assert.deepStrictEqual(controlSource.formula_input, { compositeScore: 0.8 });
  assert.strictEqual(executeFormula('F5_5_CONTROL_EFFECTIVENESS', controlSource.formula_input).value, 0.8);
  assert.ok(controlSource.warnings.some((warning) => String(warning).includes('score compuesto oficial')));
  assert.ok(!Object.prototype.hasOwnProperty.call(controlSource.formula_input, 'design'));

  const riskClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return fakeTableExists(params, ['iso_risk_matrix_items', 'iso_risk_matrix_runs']);
    if (sql.includes('WITH latest_runs AS')) return { rows: [
      { id: 'risk-a', tenant_id: 'tenant-a', status: 'accepted', likelihood: 4, impact: 5, __event_time: '2026-08-10T12:00:00Z' },
      { id: 'risk-b', tenant_id: 'tenant-a', status: 'accepted', likelihood: 2, impact: 5, __event_time: '2026-08-10T12:00:00Z' },
      { id: 'risk-ineligible', tenant_id: 'tenant-a', status: 'accepted', likelihood: null, impact: 5, __event_time: '2026-08-10T12:00:00Z' },
    ] };
    throw new Error(`unexpected risk query: ${sql}`);
  } };
  const riskSource = await resolveFormulaSource({ client: riskClient, tenantId: 'tenant-a', formulaCode: 'F5_5_INHERENT_RISK', period: { start: '2026-08-01T00:00:00Z', end: '2026-08-13T23:59:59Z' } });
  assert.strictEqual(riskSource.counts.received, 3);
  assert.strictEqual(riskSource.counts.usable, 2);
  assert.strictEqual(riskSource.counts.excluded, 1);
  assert.strictEqual(riskSource.counts.eligible_population, 2);
  assert.strictEqual(riskSource.counts.ineligible, 1);
  assert.strictEqual(riskSource.formula_input.population_size, 2);
  assert.strictEqual(riskSource.formula_input.raw_population_size, 3);
  assert.ok(riskSource.exclusions.some((item) => item.code === 'risk_axis_invalid'));
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', riskSource.formula_input).value, 15);

  let maturitySqlChecked = false;
  const maturityClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return fakeTableExists(params, ['survey_evaluations']);
    if (sql.includes('FROM survey_evaluations e')) {
      maturitySqlChecked = sql.includes("metadata'->>'source_max'") && !sql.includes('/ 20.0') && !sql.includes('BETWEEN 0 AND 5');
      return { rows: [{ id: 'maturity-a', tenant_id: 'tenant-a', level: null, source_score: 84, source_min: 0, source_max: 100, target_min: 0, target_max: 5, weight: 1, status: 'confirmed', __event_time: '2026-08-10T12:00:00Z' }] };
    }
    throw new Error(`unexpected maturity query: ${sql}`);
  } };
  const maturitySource = await resolveFormulaSource({ client: maturityClient, tenantId: 'tenant-a', formulaCode: 'F5_5_MATURITY', period: { start: '2026-08-01T00:00:00Z', end: '2026-08-13T23:59:59Z' } });
  assert.strictEqual(maturitySqlChecked, true, 'survey maturity conversion must use persisted scale metadata and no runtime scale constants');
  assert.deepStrictEqual(maturitySource.formula_input, { levels: [{ level: 4.2, weight: 1 }] });
  assert.strictEqual(executeFormula('F5_5_MATURITY', maturitySource.formula_input).value, 4.2);

  const maturityWithoutScaleClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return fakeTableExists(params, ['survey_evaluations']);
    if (sql.includes('FROM survey_evaluations e')) return { rows: [{ id: 'maturity-b', tenant_id: 'tenant-b', level: null, source_score: 84, source_min: null, source_max: null, target_min: null, target_max: null, weight: 1, status: 'confirmed', __event_time: '2026-08-10T12:00:00Z' }] };
    throw new Error(`unexpected maturity query: ${sql}`);
  } };
  const maturityWithoutScale = await resolveFormulaSource({ client: maturityWithoutScaleClient, tenantId: 'tenant-b', formulaCode: 'F5_5_MATURITY', period: { start: '2026-08-01T00:00:00Z', end: '2026-08-13T23:59:59Z' } });
  assert.strictEqual(maturityWithoutScale.status, 'empty_dataset');
  assert.ok(maturityWithoutScale.exclusions.some((item) => item.code === 'maturity_scale_configuration_missing'));
}

reconciliationTests()
  .then(() => process.stdout.write(JSON.stringify({ status: 'PHASE5_5_PACKAGE3_TESTS_OK' }) + '\n'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
