#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const exportPath = path.join(root, 'scripts/normalization/db-n05-export-qa-reference-catalogs.sql');
const manifestPath = path.join(root, 'database/reference/iso/manifest.json');
const auditPath = path.join(root, 'artifacts/db-n05/qa-catalog-audit/DB-N05_CATALOG_AUDIT_RESULT.txt');

const sql = fs.readFileSync(exportPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const audit = fs.readFileSync(auditPath, 'utf8');

const approvedRawCodes = ['ISO9001', 'ISO27001', 'ISO42001'];
const productStandardCodes = ['ISO_9001_2015', 'ISO_9001_2026', 'ISO_27001_2022', 'ISO_42001'];

assert.match(sql, /BEGIN READ ONLY;/, 'QA export must run in a read-only transaction');
assert.match(sql, /ROLLBACK;/, 'QA export must close without persisting state');
assert.match(sql, /current_setting\('transaction_read_only'\)/, 'QA export must emit transaction read-only proof');
assert.match(sql, /\\copy \(/g, 'QA export must emit copyable CSV sections');

for (const code of approvedRawCodes) {
  assert.match(sql, new RegExp(`'${code}'`), `QA export must explicitly include approved raw code ${code}`);
}
for (const forbidden of ['ISO27701', 'ISO27017', 'ISO27018']) {
  assert.doesNotMatch(sql, new RegExp(forbidden, 'i'), `QA export must not include out-of-scope historical family ${forbidden}`);
}

assert.match(sql, /cc\.tenant_id IS NULL/g, 'controls_catalog export must be restricted to global rows');
assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i, 'QA export must not contain write DDL/DML');
assert.doesNotMatch(sql, /_backup|cleanup_backup|_preview|qa_audit\./i, 'QA export must exclude backup, preview, and qa_audit objects');
assert.doesNotMatch(sql, /192\.168\.2\.40|tecdex_saas/i, 'QA export must not embed db-v4 connection details');

assert.equal(manifest.schema, 'tcdx.iso_reference_manifest');
assert.equal(manifest.version, 2);
assert.match(audit, /tecdex_saas\s*\|\s*postgres\s*\|\s*PostgreSQL 16\.15/);
assert.match(audit, /tecdex_saas\s*\|\s*postgres\s*\|/);
assert.match(audit, /PostgreSQL 16\.15/);
assert.match(audit, /ROLLBACK/);
assert.match(audit, /public\.controls_catalog\s+\|\s+3310/);
assert.match(audit, /public\.controls_catalog_standards\s+\|\s+3604/);
assert.match(audit, /public\.iso_controls\s+\|\s+61/);
const versionCounts = [...audit.matchAll(/public\.iso_standard_versions\.standard_code\s*\|\s*ISO(?:9001|27001|42001)\s*\|\s*(\d+)/g)].map(match => Number(match[1]));
assert.deepEqual(versionCounts, [2, 1, 1]);
assert.equal(versionCounts.reduce((a, b) => a + b, 0), 4);
assert.match(audit, /public\.iso_standards\s+\|\s+3/);

// Audit-backed column contract, including qualified columns in diagnostics.
const columns = new Map();
for (const line of audit.split(/\r?\n/)) {
  const match = line.match(/^\s*public\s*\|\s*(\w+)\s*\|\s*\d+\s*\|\s*(\w+)\s*\|/);
  if (match) {
    if (!columns.has(match[1])) columns.set(match[1], new Set());
    columns.get(match[1]).add(match[2]);
  }
}
const aliases = { cc: 'controls_catalog', ccs: 'controls_catalog_standards', ic: 'iso_controls', sv: 'iso_standard_versions', ie: 'iso_evidence_expectations' };
for (const [, alias, column] of sql.matchAll(/\b(cc|ccs|ic|sv|ie)\.(\w+)/g)) {
  assert.ok(columns.get(aliases[alias])?.has(column), `audit does not demonstrate ${aliases[alias]}.${column}`);
}
for (const table of ['iso_standards', 'iso_evidence_expectations']) {
  const query = sql.split(/\r?\n/).find(line => line.startsWith('\\copy (SELECT ') && line.includes(`FROM public.${table} `));
  assert.ok(query, `missing export ${table}`);
  for (const column of query.split('SELECT ')[1].split(' FROM ')[0].split(',').map(value => value.trim())) {
    assert.ok(columns.get(table)?.has(column), `audit does not demonstrate ${table}.${column}`);
  }
}
const copies = sql.split(/\r?\n/).filter(line => line.startsWith('\\copy '));
assert.equal(copies.length, 8);
for (const line of copies) assert.match(line, /^\\copy \(.*\) TO STDOUT WITH CSV HEADER$/);
assert.doesNotMatch(sql, /SELECT \*/i);
assert.match(sql, /sv\.publication_status/);
assert.match(sql, /sv\.source_policy/);
assert.match(sql, /ic\.standard_version_id = sv\.id/);
assert.match(sql, /iso_control_unresolved_version/);
assert.doesNotMatch(sql, /tenant_id IS NOT NULL/);
console.log('QA_REFERENCE_EXPORT_SCHEMA_COLUMNS PASS');
console.log('QA_REFERENCE_EXPORT_CONTRACT PASS');
