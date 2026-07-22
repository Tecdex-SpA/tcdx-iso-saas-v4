#!/usr/bin/env node
const fs = require('fs');

const catalog = JSON.parse(fs.readFileSync('config/capabilities/catalog.json', 'utf8'));
const allowedStates = new Set(['productive', 'beta', 'internal', 'disabled']);
const errors = [];
const decisions = {};
for (const capability of catalog.capabilities || []) {
  if (!allowedStates.has(capability.runtimeState)) {
    errors.push(`${capability.code}: invalid unresolved runtimeState ${capability.runtimeState}`);
  }
  if (capability.visible && capability.runtimeState !== 'productive' && !capability.featureFlag) {
    errors.push(`${capability.code}: visible non-productive capability lacks authoritative feature flag`);
  }
  if (capability.runtimeState === 'productive' && !capability.testCoverage?.e2e) {
    errors.push(`${capability.code}: productive capability lacks E2E scenario`);
  }
  decisions[capability.runtimeState] = (decisions[capability.runtimeState] || 0) + 1;
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`phase0 capability disposition VERIFIED total=${catalog.capabilities.length} decisions=${JSON.stringify(decisions)}`);
