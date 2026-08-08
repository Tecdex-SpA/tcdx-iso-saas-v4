#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const docs = path.join(root, 'docs/phase5-5');
const required = [
  'current-calculation-inventory.md',
  'calculation-consumer-map.md',
  'source-availability-matrix.md',
  'implementation-workplan.md',
  'formula-traceability-matrix.md',
  'mathematical-verification-evidence.md',
  'integration-verification-evidence.md',
  'adversarial-quality-review.md',
  'execution-progress.md',
  'independent-final-review.md',
];
const missing = required.filter((file) => !fs.existsSync(path.join(docs, file)));
if (missing.length) {
  process.stderr.write('Missing Phase 5.5 inventory docs: ' + missing.join(', ') + '\n');
  process.exit(1);
}
const trace = fs.readFileSync(path.join(docs, 'formula-traceability-matrix.md'), 'utf8');
const formulaCodes = [...trace.matchAll(/`(F5_(?:5|C3)_[A-Z0-9_]+)`/g)].map((match) => match[1]);
const unique = new Set(formulaCodes);
if (unique.size !== 53) {
  process.stderr.write('Expected 53 official formulas in traceability matrix; found ' + unique.size + '.\n');
  process.exit(1);
}
const inventory = fs.readFileSync(path.join(docs, 'current-calculation-inventory.md'), 'utf8');
for (const marker of ['formulaEngine.js', 'dataTrustScore.js', 'phase5_data_metrics_bi_reporting', 'companyProfileApplicabilityEngine.service.js', 'evidences.routes.js']) {
  if (!inventory.includes(marker)) {
    process.stderr.write('Inventory missing marker: ' + marker + '\n');
    process.exit(1);
  }
}
process.stdout.write(JSON.stringify({
  status: 'PHASE5_5_INVENTORY_READY',
  formulas_registered_in_matrix: unique.size,
  docs: required.length,
}) + '\n');
