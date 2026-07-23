const assert = require('assert');
const {
  BOOTSTRAP_VERSION,
  READINESS_RULES,
  WORKFLOW_TEMPLATES,
  createGrcBootstrapService,
} = require('./grcBootstrap.service');

assert.strictEqual(BOOTSTRAP_VERSION, 1);
assert.strictEqual(WORKFLOW_TEMPLATES.length, 7);
assert.strictEqual(new Set(WORKFLOW_TEMPLATES.map(item => item.code)).size, WORKFLOW_TEMPLATES.length);
assert.deepStrictEqual(
  new Set(WORKFLOW_TEMPLATES.map(item => item.mode)),
  new Set(['simple', 'sequential', 'parallel', 'quorum', 'unanimous'])
);
assert.strictEqual(READINESS_RULES.length, 8);
assert.strictEqual(new Set(READINESS_RULES.map(item => item[0])).size, READINESS_RULES.length);
assert.strictEqual(typeof createGrcBootstrapService, 'function');

console.log('GRC bootstrap rules tests passed');
