#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const failures = [];
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push('missing_' + rel);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}
function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) if (!text.includes(token)) failures.push(`missing:${rel}:${token}`);
  return text;
}
const operational = read('frontend/src/components/math-governance/OperationalBuilder.tsx');
for (const token of [
  'apiRequestJson',
  'validateForm',
  'previewConfig',
  'saveDraft',
  'publish',
  'execute',
  'loadHistory',
  '/api/grc/official/analytics/',
  '/api/metrics',
  '/api/dashboards',
  '/api/reports',
  '/api/surveys',
  '/api/assurance-tests',
  '/api/loss-events',
  'data-operational-builder',
]) {
  if (!operational.includes(token)) failures.push('operational_builder_missing_' + token);
}
if (/import BuilderSurface/.test(operational)) failures.push('operational_builder_must_not_import_builder_surface');
const builders = {
  MetricBuilder: ['kind="metric"', 'domain="data_quality"'],
  DashboardBuilder: ['kind="dashboard"'],
  ReportStudioWorkspace: ['kind="report"'],
  SurveyScoringBuilder: ['kind="survey"', 'domain="survey"'],
  AssuranceScoringBuilder: ['kind="assurance"', 'domain="assurance"'],
  FormulaEditor: ['kind="metric"'],
  SourceBindingEditor: ['kind="metric"'],
  VariableMapper: ['kind="metric"'],
  ThresholdEditor: ['kind="metric"'],
  RiskMethodologyEditor: ['kind="metric"', 'domain="risk"'],
  ControlEffectivenessEditor: ['kind="metric"', 'domain="control"'],
  SampleSizeCalculator: ['kind="assurance"', 'assurance.sample_size'],
  LossAnalyticsPanel: ['kind="loss"', 'domain="loss"'],
};
for (const [component, tokens] of Object.entries(builders)) {
  const rel = `frontend/src/components/math-governance/${component}.tsx`;
  const text = requireTokens(rel, ['OperationalBuilder', ...tokens]);
  if (text.includes('BuilderSurface')) failures.push(`descriptive_builder_surface_still_used:${component}`);
}
requireTokens('frontend/src/components/phase5/Phase5Workspace.tsx', ['OfficialAnalyticsPanel', 'analyticsDomain', 'Fórmula', 'Lineage', 'Impacto']);
requireTokens('frontend/src/components/grc/GrcPortal.tsx', ['official_calculations', 'formula_code', 'formula_version', 'explanation_url', 'lineage_url']);
requireTokens('frontend/src/components/Sidebar.tsx', ['navigationGroups', 'GRC integrado', 'Analítica y reportes', 'Evaluación y assurance']);
const routePages = {
  'frontend/src/app/bi/page.tsx': ['DashboardBuilderGuide', 'OfficialAnalyticsPanel'],
  'frontend/src/app/reportes/studio/page.tsx': ['ReportStudioWorkspace', 'OfficialAnalyticsPanel'],
  'frontend/src/app/reportes/generaciones/page.tsx': ['CalculationRunHistory'],
  'frontend/src/app/metricas/page.tsx': ['MetricBuilder', 'FormulaCatalog'],
  'frontend/src/app/encuestas/page.tsx': ['SurveyScoringBuilder'],
  'frontend/src/app/tests/page.tsx': ['AssuranceScoringBuilder', 'SampleSizeCalculator'],
  'frontend/src/app/eventos-perdida/page.tsx': ['LossAnalyticsPanel'],
};
for (const [rel, tokens] of Object.entries(routePages)) requireTokens(rel, tokens);
for (const rel of ['frontend/src/components/math-governance/OperationalBuilder.tsx', ...Object.keys(routePages)]) {
  const text = read(rel);
  if (/\b(eval|Function)\s*\(/.test(text)) failures.push(`unsafe_runtime_execution:${rel}`);
  if (/formulaExecution|statisticalEngine|officialFormulas|MonteCarlo/i.test(text)) failures.push(`frontend_calculation_import:${rel}`);
}
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'NOT_READY', package6_status: 'BLOCKED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'PACKAGE6_OPERATIONAL_CONTRACT_OK', checks: 128 }) + '\n');
