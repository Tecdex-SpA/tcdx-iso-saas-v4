#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const failures = [];
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return exists(rel) ? fs.readFileSync(path.join(root, rel), 'utf8') : ''; }
const docs = [
  'docs/phase5-5/package5-final-audit.md',
  'docs/phase5-5/package6-operability-ux.md',
  'docs/phase5-5/browser-e2e-evidence.md',
  'docs/phase5-5/cross-channel-consistency-evidence.md',
  'docs/phase5-5/security-validation.md',
  'docs/phase5-5/performance-validation.md',
  'docs/phase5-5/artifact-validation.md',
  'docs/phase5-5/final-acceptance-matrix.md',
  'docs/phase5-5/closeout.md',
];
for (const doc of docs) if (!exists(doc)) failures.push('missing_doc_' + doc);
const progress = read('docs/phase5-5/execution-progress.md');
for (const pkg of ['Paquete 0','Paquete 1','Paquete 2','Paquete 3','Paquete 4','Paquete 5','Paquete 6','Paquete 7']) {
  const escaped = pkg.replace(' ', '\\s+');
  const pattern = new RegExp(escaped + '[^\n|]*[|: -]+\\s*completed', 'i');
  if (!pattern.test(progress)) failures.push('progress_missing_' + pkg + '_completed');
}
const review = read('docs/phase5-5/independent-final-review.md');
if (!review.includes('APPROVED_FOR_REVIEW')) failures.push('independent_review_not_approved');
const anti = read('docs/phase5-5/adversarial-quality-review.md');
if (!anti.includes('No open high or critical findings')) failures.push('adversarial_review_has_open_high_or_critical');
const packageJson = JSON.parse(read('package.json') || '{}');
const scripts = packageJson.scripts || {};
for (const script of ['phase5-5:package6-check','phase5-5:full-e2e','phase5-5:browser-e2e','phase5-5:cross-view-consistency','phase5-5:artifact-validation','phase5-5:accessibility-check','phase5-5:security-check','phase5-5:performance-check','phase5-5:final-check']) {
  if (!scripts[script]) failures.push('missing_script_' + script);
}
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'NOT_READY', package7_status: 'BLOCKED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'APPROVED_FOR_REVIEW', package7_status: 'COMPLETED', docs: docs.length }) + '\n');
