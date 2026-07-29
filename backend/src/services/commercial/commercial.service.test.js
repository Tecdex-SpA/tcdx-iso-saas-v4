const assert = require('assert');
const { validateMethodologyDefinition, CommercialError } = require('./commercialAdmin.service');
const { normalizeKey } = require('./entitlementResolver.service');

assert.strictEqual(normalizeKey(' TPRM Suppliers '), 'tprm_suppliers');
assert.doesNotThrow(() => validateMethodologyDefinition({ scoring: { steps: [{ operator: 'multiply' }, { operator: 'threshold' }] } }));
assert.throws(
  () => validateMethodologyDefinition({ scoring: { steps: [{ operator: 'eval' }] } }),
  (error) => error instanceof CommercialError && error.code === 'METHODOLOGY_OPERATOR_NOT_ALLOWED'
);

process.stdout.write('commercial.service.test: OK\n');
