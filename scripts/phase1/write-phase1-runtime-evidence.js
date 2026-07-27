#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readManifest, RESOURCE_KEYS } = require('./phase1-qa-manifest');

const root = path.resolve(__dirname, '../..');
const artifactDir = path.join(root, 'artifacts/fase-1');
const targetedPath = path.join(artifactDir, 'phase1-targeted-results.json');
const resultsPath = path.join(artifactDir, 'e2e-results.json');

function validateReport(file, expected) {
  if (!fs.existsSync(file)) throw new Error(`Missing Playwright result: ${file}`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const specs = [];
  function collect(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const results = test.results || [];
        specs.push({
          title: spec.title,
          expected_status: test.expectedStatus,
          status: results[0]?.status,
          retry: Number(results[0]?.retry || 0),
          result_count: results.length,
        });
      }
    }
    for (const child of suite.suites || []) collect(child);
  }
  for (const suite of report.suites || []) collect(suite);
  const invalid = specs.filter(item => item.expected_status !== 'passed'
    || item.status !== 'passed' || item.retry !== 0 || item.result_count !== 1);
  if (specs.length !== expected || invalid.length) {
    throw new Error(`Playwright evidence invalid: file=${file} expected=${expected} actual=${specs.length} invalid=${invalid.length}`);
  }
  return specs;
}

const targeted = validateReport(targetedPath, 13);
const specs = validateReport(resultsPath, 30);
const select = marker => specs.filter(item => item.title.toLowerCase().includes(marker));
const required = ['bootstrap', 'tenant', 'scheduler', 'exportación', 'observabilidad', 'administración saas'];
const missing = required.filter(marker => select(marker).length === 0);
if (missing.length) throw new Error(`Runtime evidence is missing passing scenarios: ${missing.join(', ')}`);

const now = new Date().toISOString();
const sha = String(process.env.DEPLOYED_SHA || '').trim();
const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(sha) || currentSha !== sha) {
  throw new Error(`Runtime evidence SHA mismatch: deployed=${sha || 'missing'} current=${currentSha}`);
}
const manifestPath = path.resolve(process.env.PHASE1_QA_MANIFEST || path.join(artifactDir, 'phase1-qa-manifest.json'));
const manifest = readManifest(manifestPath, process.env.PHASE1_TENANT_ID);
const resourceCounts = Object.fromEntries(RESOURCE_KEYS.map(key => [key, manifest.resources[key].length]));
const versions = {
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  playwright: require(path.join(root, 'frontend/node_modules/@playwright/test/package.json')).version,
};
const writeJson = (name, value) => fs.writeFileSync(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`);
fs.mkdirSync(artifactDir, { recursive: true });
writeJson('phase1-runtime-summary.json', {
  status: 'VERIFIED_RUNTIME', deployed_sha: sha, checked_at: now,
  environment: 'qa', public_url: process.env.WEB_BASE_URL,
  run_id: manifest.run_id, versions, targeted: { tests: targeted.length, passed: targeted.length },
  full: { tests: specs.length, passed: specs.length, retries: 0 }, resources: resourceCounts,
});
writeJson('phase1-api-results.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: specs.map(item => item.title) });
writeJson('phase1-export-validation.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('exportación').map(item => item.title) });
writeJson('phase1-tenant-isolation.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('tenant').map(item => item.title) });
writeJson('phase1-scheduler-results.json', { status: 'VERIFIED_RUNTIME', checked_at: now, scenarios: select('scheduler').map(item => item.title) });
fs.writeFileSync(
  path.join(artifactDir, 'phase1-observability.txt'),
  `status=VERIFIED_RUNTIME\nchecked_at=${now}\ndeployed_sha=${sha}\nrun_id=${manifest.run_id}\nscenarios=${select('observabilidad').map(item => item.title).join(';')}\n`
);
fs.writeFileSync(
  path.join(artifactDir, 'phase1-closeout-evidence.md'),
  `# Phase 1 Runtime QA evidence\n\n- Status: VERIFIED_RUNTIME\n- Deployed SHA: ${sha}\n- Checked at: ${now}\n- Run: ${manifest.run_id}\n- Public URL: ${process.env.WEB_BASE_URL}\n- Node: ${versions.node}\n- npm: ${versions.npm}\n- Playwright: ${versions.playwright}\n- Targeted Playwright: 13/13 passed\n- Full Playwright: 30/30 passed\n- Retries: 0\n\n${specs.map(item => `- ${item.title}`).join('\n')}\n`
);
console.log('Phase 1 runtime evidence: VERIFIED_RUNTIME targeted=13 full=30 retries=0');
