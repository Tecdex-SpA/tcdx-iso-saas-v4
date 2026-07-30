#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const resultsPath = path.join(root, 'artifacts/phase5-5/browser-e2e-results.json');
const targetTitle = 'consistencia entre Portal GRC, dominio, dashboard y reporte por cálculo oficial';

function collectSpecs(suite, out = []) {
  for (const spec of suite.specs || []) out.push(spec);
  for (const child of suite.suites || []) collectSpecs(child, out);
  return out;
}

if (!fs.existsSync(resultsPath)) {
  throw new Error('Missing Playwright browser results. Run npm run phase5-5:browser-e2e first.');
}

const payload = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const specs = (payload.suites || []).flatMap((suite) => collectSpecs(suite));
const spec = specs.find((item) => item.title === targetTitle);

if (!spec) throw new Error('Cross-view consistency scenario is missing from browser E2E results.');
if (spec.ok !== true) throw new Error('Cross-view consistency scenario did not pass.');

const passed = (spec.tests || []).some((test) => test.status === 'expected' && (test.results || []).some((result) => result.status === 'passed'));
if (!passed) throw new Error('Cross-view consistency scenario has no passed browser execution.');

console.log(JSON.stringify({ status: 'PHASE5_5_CROSS_VIEW_CONSISTENCY_OK', scenario: targetTitle }));
