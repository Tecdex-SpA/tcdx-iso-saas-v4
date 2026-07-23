#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const artifactDir = path.join(root, 'artifacts/fase-1');
const resultsPath = path.join(artifactDir, 'e2e-results.json');
if (!fs.existsSync(resultsPath)) {
  console.error(`Missing Playwright result: ${resultsPath}`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const specs = [];
function collect(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const statuses = (test.results || []).map(result => result.status);
      specs.push({ title: spec.title, expected_status: test.expectedStatus, statuses });
    }
  }
  for (const child of suite.suites || []) collect(child);
}
for (const suite of report.suites || []) collect(suite);
const passed = specs.filter(item => item.statuses.includes('passed') && item.expected_status === 'passed');
const failed = specs.filter(item => !item.statuses.includes('passed') || item.expected_status !== 'passed');
if (specs.length < 30 || failed.length) {
  console.error(`Runtime evidence requires at least 30 passing Playwright tests; total=${specs.length} failed=${failed.length}`);
  process.exit(1);
}
const select = marker => passed.filter(item => item.title.toLowerCase().includes(marker));
const required = ['bootstrap', 'tenant', 'scheduler', 'exportación', 'observabilidad', 'administración saas'];
const missing = required.filter(marker => select(marker).length === 0);
if (missing.length) {
  console.error(`Runtime evidence is missing required passing scenarios: ${missing.join(', ')}`);
  process.exit(1);
}
const now = new Date().toISOString();
const sha = String(process.env.DEPLOYED_SHA || '').trim();
const writeJson = (name, value) => fs.writeFileSync(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`);
fs.mkdirSync(artifactDir, { recursive: true });
writeJson('phase1-runtime-summary.json', { status: 'VERIFIED_RUNTIME', deployed_sha: sha, checked_at: now, tests: specs.length, passed: passed.length });
writeJson('phase1-api-results.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: passed.map(item => item.title) });
writeJson('phase1-export-validation.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('exportación').map(item => item.title) });
writeJson('phase1-tenant-isolation.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('tenant').map(item => item.title) });
writeJson('phase1-scheduler-results.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('scheduler').map(item => item.title) });
fs.writeFileSync(
  path.join(artifactDir, 'phase1-observability.txt'),
  `status=VERIFIED_RUNTIME\nchecked_at=${now}\ndeployed_sha=${sha}\nscenarios=${select('observabilidad').map(item => item.title).join(';')}\n`
);
fs.writeFileSync(
  path.join(artifactDir, 'phase1-closeout-evidence.md'),
  `# Phase 1 Runtime QA evidence\n\n- Status: VERIFIED_RUNTIME\n- Deployed SHA: ${sha}\n- Checked at: ${now}\n- Playwright tests: ${specs.length}/${specs.length} passed\n\n${passed.map(item => `- ${item.title}`).join('\n')}\n`
);
console.log(`Phase 1 runtime evidence: VERIFIED_RUNTIME tests=${specs.length}`);
