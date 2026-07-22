#!/usr/bin/env node
const fs = require('fs');

const coverage = JSON.parse(fs.readFileSync('config/phase0/e2e-capability-coverage.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('config/capabilities/catalog.json', 'utf8'));
const errors = [];
const seen = new Set();
for (const item of coverage.capabilities || []) {
  if (!item.code || seen.has(item.code)) errors.push(`Invalid or duplicate capability coverage: ${item.code || '<empty>'}`);
  seen.add(item.code);
  if (!item.testFile || !fs.existsSync(item.testFile)) errors.push(`Missing test file for ${item.code}`);
  if (!item.scenario) errors.push(`Missing scenario for ${item.code}`);
}
for (const capability of catalog.capabilities || []) {
  if (capability.runtimeState === 'productive' && !seen.has(capability.code)) {
    errors.push(`Productive capability lacks E2E scenario: ${capability.code}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`phase0 e2e contract VERIFIED capabilities=${seen.size} runner=${coverage.runner}`);
