#!/usr/bin/env node
const fs = require('fs');
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
const catalog = readJson('config/capabilities/catalog.json');
const auth = readJson('config/security/authorization-matrix.json');
const summary = readJson('artifacts/fase-0/inventory-summary.json');
const failures = [];
for (const cap of catalog.capabilities) {
  if (!['productive', 'partial', 'internal', 'beta', 'disabled'].includes(cap.runtimeState)) failures.push(`Invalid runtimeState for ${cap.code}`);
  if (cap.visible && cap.runtimeState === 'productive' && cap.backendEndpoints.length === 0) failures.push(`Visible productive capability without endpoint: ${cap.code}`);
  if (cap.runtimeState === 'productive' && !cap.testCoverage?.e2e) failures.push(`Productive capability without E2E proof: ${cap.code}`);
  if (['partial', 'internal', 'beta', 'disabled'].includes(cap.runtimeState) && cap.visible && !cap.featureFlag) failures.push(`Non-productive visible capability without feature flag: ${cap.code}`);
}
for (const endpoint of auth.authorization) {
  if (endpoint.authSignal !== 'true') failures.push(`Endpoint without static auth signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`);
  if (endpoint.dataScope === 'unknown') failures.push(`Endpoint without static tenant/data scope signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`);
}
if (summary.capabilitiesWithoutEndpoint > 0) failures.push(`${summary.capabilitiesWithoutEndpoint} capabilities lack backend endpoint association by static inventory`);
const report = { checkedAt: new Date().toISOString(), failuresCount: failures.length, failures: failures.slice(0, 500), truncated: failures.length > 500 };
fs.mkdirSync('artifacts/fase-0', { recursive: true });
fs.writeFileSync('artifacts/fase-0/phase0-contracts-check.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) {
  console.error(`phase0 contracts check failed: ${failures.length} blocking issue(s). See artifacts/fase-0/phase0-contracts-check.json`);
  process.exit(1);
}
console.log('phase0 contracts check OK');
