'use strict';

const assert = require('assert');
const { dynamicGrcHealth } = require('./grcHealthCalculation.service');
const { executeFormula, FORMULA_MAP } = require('./formulaRegistry.service');

const partial = dynamicGrcHealth({
  evidence: 0.1425,
  component_states: {
    risk: { classification: 'MISSING', reason: 'dependency_pending' },
    compliance: { classification: 'MISSING', reason: 'dependency_pending' },
    actions: { classification: 'MISSING', reason: 'dependency_pending' },
    dataTrust: { classification: 'NOT_CONFIGURED', reason: 'accuracy_source_not_configured' },
  },
  minimum_coverage: 0.8,
});

assert.strictEqual(partial.score_publicable, false);
assert.strictEqual(partial.global_status, 'insufficient_coverage');
assert.strictEqual(partial.coverage, 0.2);
assert.strictEqual(partial.missing_components.length, 4);
assert.ok(partial.missing_components.some((component) => component.key === 'dataTrust' && component.classification === 'NOT_CONFIGURED'));
assert.ok(Math.abs(partial.value - 14.25) < 0.001);

const withNotApplicable = dynamicGrcHealth({
  evidence: 0.8,
  dataTrust: 0.9,
  risk: 0.7,
  compliance: 0.75,
  component_states: {
    actions: { classification: 'NOT_APPLICABLE', reason: 'scope_excluded' },
  },
  minimum_coverage: 0.8,
});

assert.strictEqual(withNotApplicable.score_publicable, true);
assert.strictEqual(withNotApplicable.global_status, 'measured');
assert.strictEqual(withNotApplicable.coverage, 1);
assert.strictEqual(withNotApplicable.missing_components.length, 0);

const formula = FORMULA_MAP.get('F5_5_GRC_HEALTH');
assert.strictEqual(formula.version, 2);
assert.strictEqual(formula.null_policy, 'partial_available_components_with_coverage_threshold');

const registryResult = executeFormula('F5_5_GRC_HEALTH', {
  evidence: 0.1425,
  component_states: {
    risk: { classification: 'MISSING' },
    compliance: { classification: 'MISSING' },
    actions: { classification: 'MISSING' },
    dataTrust: { classification: 'NOT_CONFIGURED' },
  },
  minimum_coverage: 0.8,
});

assert.strictEqual(registryResult.status, 'calculated');
assert.strictEqual(registryResult.details.global_status, 'insufficient_coverage');
assert.strictEqual(registryResult.details.score_publicable, false);
assert.strictEqual(registryResult.details.coverage_policy, 'available_weight/applicable_weight; publish only when coverage >= minimum_coverage');

process.stdout.write('NORMALIZATION02_GLOBAL_SCORE_SEMANTICS_PASS\n');
