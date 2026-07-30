'use strict';

const assert = require('assert');
const { buildDecision } = require('./decisionInterpretation.service');
const { classifyError, enrichDependencies, recalculateOfficialAnalytics } = require('./officialCalculationOrchestrator.service');
const { mapFormulaInput } = require('./sourceResolver.service');

async function run() {
  const incompatible = classifyError(Object.assign(new Error('column le.event_date does not exist'), { code: '42703' }));
  assert.equal(incompatible.status, 'source_incompatible');
  assert.equal(incompatible.failureType, 'source_incompatible');

  const insufficient = classifyError(Object.assign(new Error('Falta variable requerida'), { code: 'FORMULA_VARIABLE_REQUIRED' }));
  assert.equal(insufficient.status, 'unmeasured');
  assert.equal(insufficient.failureType, 'insufficient_data');

  const dependency = enrichDependencies('F5_5_READINESS', { evidence: 0.8, health: 0.7, actions: 0.6 }, new Map([['F5_5_COVERAGE', 75]]));
  assert.equal(dependency.input.compliance, 0.75);
  assert.deepEqual(dependency.missing, []);

  const residualWithoutControls = mapFormulaInput('F5_5_RESIDUAL_RISK', [{ probability: 5, impact: 3, control_effectiveness: null }]);
  assert.equal(residualWithoutControls.inherentRisk, 15);
  assert.equal(residualWithoutControls.controlEffectiveness, null);

  const decision = buildDecision({
    formula: { formula_code: 'F5_5_INHERENT_RISK', category: 'risk' },
    value: 15,
    unit: 'score',
    source: { counts: { received: 131, usable: 131, excluded: 0 }, physical_sources: ['iso_risk_matrix_items'] },
    previousValue: 12,
  });
  assert.equal(decision.interpretation.severity, 'red');
  assert.equal(decision.data_quality.coverage_pct, 100);
  assert.equal(decision.action.can_create_plan, true);

  let persisted = false;
  const emptyResult = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => ({
        status: 'ready', source_code: 'risk_register_controls', counts: { received: 1, usable: 1, excluded: 0 },
        formula_input: { probability: null, impact: null }, physical_sources: ['iso_risk_matrix_items'], warnings: [],
      }),
      persistOfficialCalculation: async () => { persisted = true; return {}; },
      persistSourceSnapshot: async () => 'snapshot',
    }
  );
  assert.equal(persisted, false);
  assert.equal(emptyResult.summary.unmeasured, 1);
  assert.equal(emptyResult.results[0].failure_type, 'insufficient_data');

  const technical = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => { throw Object.assign(new Error('column event_date does not exist'), { code: '42703' }); },
      persistOfficialCalculation: async () => { throw new Error('no debe persistir'); },
    }
  );
  assert.equal(technical.summary.source_incompatible, 1);
  assert.equal(technical.summary.failed, 0);

  console.log(JSON.stringify({ status: 'GRC_DECISION_CENTER_TESTS_OK', assertions: 16 }));
}

run().catch((error) => { console.error(error); process.exit(1); });
