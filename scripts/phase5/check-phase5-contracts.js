#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const requiredFiles = [
  'database/migrations/20260729_phase5_data_metrics_bi_reporting.sql',
  'database/migrations/20260730_phase5_tenant_shell_grc_data_integration.sql',
  'database/migrations/20260810_phase5_official_measurement_null_states.sql',
  'scripts/phase5/apply-phase5-migration.js',
  'backend/src/utils/effectiveTenant.js',
  'backend/src/services/phase5/formulaEngine.js',
  'backend/src/services/phase5/dataTrustScore.js',
  'backend/src/services/phase5/phase5.service.js',
  'backend/src/routes/phase5.routes.js',
  'frontend/src/components/phase5/Phase5Workspace.tsx',
  'frontend/src/components/grc/GrcPortal.tsx',
  'frontend/src/app/grc/page.tsx',
  'docs/phase5/phase5-baseline.md',
  'docs/phase5/closeout.md',
];

const requiredTables = [
  'data_domains','data_elements','data_definitions','data_owners','data_sources','data_quality_rules',
  'data_quality_assessments','data_lineage_edges','data_snapshots','data_comparisons',
  'metric_definitions','metric_formula_versions','metric_dimensions','metric_sources','metric_thresholds',
  'metric_measurements','metric_validations','metric_impact_rules','metric_snapshots',
  'survey_definitions','survey_versions','survey_sections','survey_questions','survey_question_options',
  'assessment_campaigns','assessment_recipients','survey_responses','survey_response_items',
  'survey_evaluations','survey_approvals','assurance_test_definitions','assurance_test_executions',
  'assurance_test_samples','assurance_test_results','assurance_test_exceptions','loss_events','loss_recoveries',
  'dashboard_definitions','dashboard_widgets','dashboard_permissions','report_definitions',
  'report_template_versions','report_schedules','report_generations','report_artifacts','report_approvals',
];

const endpoints = [
  '/api/data/domains','/api/data/elements','/api/data/quality','/api/data/lineage/:entityType/:entityId',
  '/api/metrics','/api/metrics/:id/formulas','/api/metrics/:id/publish','/api/metrics/:id/calculate',
  '/api/surveys','/api/survey-campaigns','/api/survey-responses','/api/assurance-tests',
  '/api/loss-events','/api/dashboards','/api/report-generations','/api/report-schedules',
  '/api/grc/overview','/api/grc/impact/:entityType/:entityId',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Phase 5 file: ${file}`);
}

const migration = fs.readFileSync(path.join(root, requiredFiles[0]), 'utf8');
const hotfixMigration = fs.readFileSync(path.join(root, 'database/migrations/20260730_phase5_tenant_shell_grc_data_integration.sql'), 'utf8');
const nullStateMigration = fs.readFileSync(path.join(root, 'database/migrations/20260810_phase5_official_measurement_null_states.sql'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'scripts/phase5/apply-phase5-migration.js'), 'utf8');
for (const table of requiredTables) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`Migration missing table: ${table}`);
  }
}

const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
for (const mount of ['/api/grc','/api/data','/api/metrics','/api/surveys','/api/loss-events','/api/dashboards','/api/report-generations']) {
  if (!app.includes(`app.use('${mount}'`)) throw new Error(`App missing mount: ${mount}`);
}
for (const table of ['grc_analytical_impact_rules','grc_analytical_impact_events','data_trust_score_versions']) {
  if (!hotfixMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`Hotfix migration missing table: ${table}`);
  }
}
if (!nullStateMigration.includes('DROP CONSTRAINT IF EXISTS metric_measurements_check1')) {
  throw new Error('Null-state hotfix must remove only the legacy metric_measurements_check1 constraint');
}
for (const constraint of [
  'metric_measurements_legacy_or_official_value_check',
  'metric_measurements_official_value_contract',
  'metric_measurements_official_state_check',
  'metric_measurements_coverage_ratio_check',
]) {
  if (!nullStateMigration.includes(constraint)) throw new Error(`Null-state hotfix must preserve required constraint: ${constraint}`);
  if (!runner.includes(constraint)) throw new Error(`Phase 5 runner postcondition must verify constraint: ${constraint}`);
}
if (!runner.includes('20260810_phase5_official_measurement_null_states')) {
  throw new Error('Phase 5 runner must register the official measurement null-state hotfix');
}

const rbac = fs.readFileSync(path.join(root, 'backend/src/middleware/rbac.middleware.js'), 'utf8');
for (const prefix of ['/api/data','/api/metrics','/api/survey-responses','/api/assurance-tests','/api/loss-events','/api/dashboards','/api/report-generations']) {
  if (!rbac.includes(`prefix: '${prefix}'`)) throw new Error(`RBAC missing prefix: ${prefix}`);
}

const apiDocs = fs.existsSync(path.join(root, 'docs/phase5/api-contracts.md'))
  ? fs.readFileSync(path.join(root, 'docs/phase5/api-contracts.md'), 'utf8')
  : '';
for (const endpoint of endpoints) {
  if (!apiDocs.includes(endpoint.replace('/:entityType/:entityId', '/:entityType/:entityId'))) {
    throw new Error(`API docs missing endpoint: ${endpoint}`);
  }
}

process.stdout.write(JSON.stringify({
  status: 'VERIFIED_PHASE5_CONTRACTS',
  tables: requiredTables.length,
  endpoints: endpoints.length,
  hotfix: 'verified',
}) + '\n');
