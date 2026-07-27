#!/usr/bin/env node
const fs = require('fs');

const file = process.argv[2];
const expected = Number(process.argv[3]);
if (!file || !Number.isInteger(expected) || expected < 1) {
  console.error('Usage: check-playwright-result.js <json-file> <expected-tests>');
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const tests = [];
function collect(suite) {
  for (const spec of suite.specs || []) {
    for (const item of spec.tests || []) tests.push({ title: spec.title, item });
  }
  for (const child of suite.suites || []) collect(child);
}
for (const suite of report.suites || []) collect(suite);
const invalid = tests.filter(({ item }) => {
  const results = item.results || [];
  return item.expectedStatus !== 'passed'
    || results.length !== 1
    || results[0].status !== 'passed'
    || Number(results[0].retry || 0) !== 0;
});
if (tests.length !== expected || invalid.length) {
  console.error(`Phase 2 Playwright invalid: expected=${expected} actual=${tests.length} invalid=${invalid.length}`);
  for (const entry of invalid) console.error(`- ${entry.title}`);
  process.exit(1);
}
process.stdout.write(`Phase 2 Playwright: VERIFIED ${tests.length}/${expected} passed, retries=0 skipped=0 fixme=0\n`);
