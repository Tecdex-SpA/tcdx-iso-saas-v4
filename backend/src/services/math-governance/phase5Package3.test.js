'use strict';

const assert = require('assert');
const {
  PACKAGE3_FORMULA_CODES,
  buildOverviewOfficialCalculations,
  calculateOfficialByKey,
  formulaCodeForKey,
  overviewKeyForFormula,
} = require('./phase5Package3.service');

assert.ok(PACKAGE3_FORMULA_CODES.includes('F5_5_COMPLIANCE_WEIGHTED'));
assert.strictEqual(formulaCodeForKey('actions-progress'), 'F5_5_WEIGHTED_PROGRESS');
assert.strictEqual(formulaCodeForKey('F5_5_GRC_HEALTH'), 'F5_5_GRC_HEALTH');
assert.strictEqual(overviewKeyForFormula('F5_5_CONTROL_EFFECTIVENESS'), 'control_effectiveness');

const overview = buildOverviewOfficialCalculations({
  compliance: { status: 'ok', data: { score: 80 }, trust: { score: 80 }, source_count: 3, warnings: [] },
  controls: { status: 'ok', trust: { score: 75 }, source_count: 2, warnings: [] },
  actions: { status: 'ok', trust: { score: 70 }, source_count: 2, warnings: [] },
}, { requestId: 'pkg3' });

assert.strictEqual(overview.compliance.formula_code, 'F5_5_COMPLIANCE_WEIGHTED');
assert.strictEqual(overview.compliance.value, null);
assert.strictEqual(overview.compliance.status, 'unmeasured');
assert.ok(overview.compliance.warnings.includes('canonical_orchestrator_required'));
assert.strictEqual(overview.control_effectiveness.value, null);
assert.strictEqual(overview.actions.value, null);
assert.strictEqual(overview.health.metadata.canonical_pipeline_required, true);
assert.throws(() => calculateOfficialByKey('health-grc', { risk: .8, compliance: .9, actions: .7, evidence: .6, dataTrust: .85 }), /officialCalculationOrchestrator/);

process.stdout.write(JSON.stringify({ status: 'PHASE5_5_PACKAGE3_COMPATIBILITY_TESTS_OK' }) + '\n');
