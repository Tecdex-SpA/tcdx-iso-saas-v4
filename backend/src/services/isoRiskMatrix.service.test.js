'use strict';

const assert = require('assert');
const { executeFormula } = require('./math-governance/formulaRegistry.service');
const { mapFormulaInput } = require('./math-governance/sourceResolver.service');
const isoRiskMatrix = require('./isoRiskMatrix.service');

const {
  calculateRiskAxes,
  canManageRiskMatrix,
  parseRiskAxis,
} = isoRiskMatrix._private;

assert.strictEqual(canManageRiskMatrix({ role: 'admin' }), true, 'admin must edit ISO risk matrix inputs');
assert.strictEqual(canManageRiskMatrix({ role: 'tenant_admin' }), true, 'tenant admin must edit ISO risk matrix inputs');
assert.strictEqual(canManageRiskMatrix({ role: 'auditor' }), false, 'auditor must not edit ISO risk matrix inputs');

assert.strictEqual(parseRiskAxis(4, 'likelihood'), 4);
assert.strictEqual(parseRiskAxis('5', 'impact'), 5);
assert.throws(() => parseRiskAxis(0, 'likelihood'), (error) => error?.code === 'INVALID_RISK_AXIS');
assert.throws(() => parseRiskAxis(6, 'impact'), (error) => error?.code === 'INVALID_RISK_AXIS');
assert.throws(() => parseRiskAxis(2.5, 'impact'), (error) => error?.code === 'INVALID_RISK_AXIS');

const initialAxes = calculateRiskAxes({ likelihood: 4, impact: 5, controlEffectiveness: 0 });
assert.strictEqual(initialAxes.inherent_risk_score, 20);
assert.strictEqual(initialAxes.inherent_risk_level, 'critico');
assert.strictEqual(initialAxes.residual_risk_score, 20);

const changedAxes = calculateRiskAxes({ likelihood: 3, impact: 5, controlEffectiveness: 0 });
assert.strictEqual(changedAxes.inherent_risk_score, 15);
assert.strictEqual(changedAxes.inherent_risk_level, 'alto');
assert.strictEqual(changedAxes.residual_risk_score, 15);

const sourceInputInitial = mapFormulaInput('F5_5_INHERENT_RISK', [{
  id: 'risk-qa-1',
  tenant_id: 'tenant-a',
  likelihood: initialAxes.likelihood,
  impact: initialAxes.impact,
}]);
assert.deepStrictEqual(sourceInputInitial.risks, [{
  source_record: 'risk-qa-1',
  physical_source: null,
  probability: 4,
  impact: 5,
  inherent_risk_score: 20,
}]);
assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', sourceInputInitial).value, 20);

const sourceInputChanged = mapFormulaInput('F5_5_INHERENT_RISK', [{
  id: 'risk-qa-1',
  tenant_id: 'tenant-a',
  likelihood: changedAxes.likelihood,
  impact: changedAxes.impact,
}]);
assert.deepStrictEqual(sourceInputChanged.risks, [{
  source_record: 'risk-qa-1',
  physical_source: null,
  probability: 3,
  impact: 5,
  inherent_risk_score: 15,
}]);
assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', sourceInputChanged).value, 15);

process.stdout.write(JSON.stringify({
  status: 'ISO_RISK_MATRIX_INPUTS_TEST_OK',
  admin_update: true,
  auditor_denied: true,
  invalid_axes_rejected: true,
  risk_inherent_4x5: 20,
  risk_inherent_3x5: 15,
}) + '\n');
