 'use strict';
const assert = require('assert');
const { FORMULAS, OfficialFormulaRegistry, FormulaRegistryError, executeFormula } = require('./formulaRegistry.service');
function close(actual, expected, tolerance = 0.01) {
  if (expected === null) return assert.strictEqual(actual, null);
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `${actual} != ${expected}`);
}
assert.strictEqual(FORMULAS.length, 53, 'deben existir 53 formulas oficiales');
const registry = new OfficialFormulaRegistry();
const codes = new Set();
let assertions = 0;
for (const formula of FORMULAS) {
  assert.ok(/^F5_(?:5|C3)_/.test(formula.formula_code));
  assert.ok(!codes.has(formula.formula_code), `formula duplicada ${formula.formula_code}`);
  codes.add(formula.formula_code);
  assert.strictEqual(formula.version, 1);
  assert.strictEqual(formula.status, 'published');
  assert.strictEqual(formula.checksum.length, 64);
  assert.ok(Object.isFrozen(formula), `${formula.formula_code} debe estar congelada`);
  assert.ok(Array.isArray(formula.tests) && formula.tests.length >= 6, `${formula.formula_code} sin matriz de pruebas completa`);
  const normal = formula.tests.find((test) => test.name === 'normal');
  const first = executeFormula(formula.formula_code, normal.inputs);
  const second = executeFormula(formula.formula_code, normal.inputs);
  close(first.value, normal.expected, normal.tolerance);
  assert.deepStrictEqual(first, second, `${formula.formula_code} no es determinista`);
  assertions += 2;
  for (const testCase of formula.tests) {
    if (testCase.expectError) {
      assert.throws(() => registry.execute(formula.formula_code, testCase.inputs), /./, `${formula.formula_code}/${testCase.name} debio fallar`);
      assertions += 1;
      continue;
    }
    const result = registry.execute(formula.formula_code, testCase.inputs);
    assert.ok(['calculated','not_calculable'].includes(result.status));
    assert.strictEqual(result.unit, formula.units.output);
    if (testCase.expected !== null && testCase.expected !== undefined) close(result.value, testCase.expected, testCase.tolerance || 0.01);
    assertions += 3;
  }
  assert.throws(() => registry.register({ ...formula, methodology: `${formula.methodology} changed`, checksum: 'changed' }), (error) => error instanceof FormulaRegistryError && error.code === 'FORMULA_PUBLISHED_IMMUTABLE');
  assertions += 1;
}
for (const code of ['F5_5_MONTE_CARLO','F5_5_PARAMETRIC_VAR','F5_5_CRONBACH_ALPHA','F5_5_CONFIDENCE_INTERVAL']) assert.ok(codes.has(code));
assert.throws(() => executeFormula('F5_C3_DATA_TRUST', { completeness:90,accuracy:null,consistency:85,freshness:75,lineage:100,validation:90,stability:70,coverage:80 }), (error) => error?.code === 'FORMULA_VARIABLE_REQUIRED');
process.stdout.write(JSON.stringify({ status: 'PHASE5_5_FORMULA_TESTS_OK', formulas: FORMULAS.length, assertions }) + '\n');
