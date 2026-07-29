#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const files = [
  'backend/src/services/phase5/formulaEngine.js',
  'backend/src/services/phase5/phase5.service.js',
  'backend/src/routes/phase5.routes.js',
  'backend/src/middleware/rbac.middleware.js',
  'database/migrations/20260729_phase5_data_metrics_bi_reporting.sql',
];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\beval\s*\(/.test(source) || /new Function\s*\(/.test(source)) {
    throw new Error(`Unsafe dynamic execution detected: ${file}`);
  }
  if (/postgres(?:ql)?:\/\/[^'"\s]+/.test(source)) {
    throw new Error(`Database URL literal detected: ${file}`);
  }
}

const routes = fs.readFileSync(path.join(root, 'backend/src/routes/phase5.routes.js'), 'utf8');
for (const capability of [
  'data.governance','metrics.catalog','metrics.engine','metrics.data_trust','data.lineage',
  'data.impact_graph','surveys.engine','assurance.testing','loss.events',
  'bi.dashboard_builder','bi.executive_dashboards','reporting.studio','reporting.scheduled',
]) {
  if (!routes.includes(`'${capability}'`)) throw new Error(`Capability middleware missing: ${capability}`);
}

const migration = fs.readFileSync(path.join(root, 'database/migrations/20260729_phase5_data_metrics_bi_reporting.sql'), 'utf8');
for (const table of ['data_elements','metric_measurements','survey_responses','loss_events','dashboard_definitions','report_generations']) {
  const create = migration.slice(migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`), migration.indexOf(');', migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`)) + 2);
  if (!/tenant_id uuid NOT NULL REFERENCES tenants\(id\)/.test(create)) {
    throw new Error(`Operational table is not tenant-scoped: ${table}`);
  }
}

if (!/FOR EACH ROW\s+WHEN \(OLD\.status = 'published'\)\s+EXECUTE FUNCTION reject_published_metric_formula_change/s.test(migration)) {
  throw new Error('Published metric formula immutability trigger missing');
}

process.stdout.write(JSON.stringify({ status: 'VERIFIED_PHASE5_SECURITY' }) + '\n');
