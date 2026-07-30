#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260730_phase5_5_official_math_governance.sql');
const runnerPath = path.join(root, 'scripts/phase5/apply-phase5-migration.js');
const migration = fs.readFileSync(migrationPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const requiredTables = [
  'official_formula_definitions','official_formula_versions','official_formula_variables','official_formula_source_contracts','official_formula_thresholds','official_formula_dependencies','calculation_runs','calculation_inputs','calculation_outputs','calculation_validations','calculation_snapshots','calculation_consumers','calculation_explanations','calculation_anomalies','calculation_comparisons','statistical_samples','statistical_results','metric_source_bindings','metric_calculation_policies','health_score_definitions','health_score_versions','health_score_components'
];
const failures = [];
if (!/^BEGIN;[\s\S]*COMMIT;\s*$/m.test(migration)) failures.push('migration_must_have_transaction');
for (const table of requiredTables) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`missing_table_${table}`);
}
for (const token of ['tenant_id uuid','REFERENCES tenants(id)','checksum char(64)','correlation_id','metadata jsonb','created_by uuid REFERENCES users(id)','published','trg_official_formula_versions_published_immutable','trg_health_score_versions_published_immutable']) {
  if (!migration.includes(token)) failures.push(`missing_required_sql_token_${token}`);
}
if (!runner.includes('20260730_phase5_5_official_math_governance') || !runner.includes('database/migrations/20260730_phase5_5_official_math_governance.sql')) failures.push('phase5_runner_missing_phase5_5_migration');
if (/DROP\s+TABLE|TRUNCATE\s+TABLE|ALTER\s+TABLE\s+[^\n]+\s+DROP\s+COLUMN/i.test(migration)) failures.push('destructive_sql_detected');
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'PHASE5_5_MIGRATION_CHECK_FAILED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'PHASE5_5_MIGRATION_CHECK_OK', tables: requiredTables.length }) + '\n');
