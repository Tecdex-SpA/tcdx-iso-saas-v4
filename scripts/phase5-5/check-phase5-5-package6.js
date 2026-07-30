#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const failures = [];
function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function requireFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) failures.push('missing_' + rel);
  return read(rel);
}
function requireIncludes(rel, tokens) {
  const text = requireFile(rel);
  for (const token of tokens) if (!text.includes(token)) failures.push(`missing_token:${rel}:${token}`);
  return text;
}
requireIncludes('frontend/src/components/phase5/Phase5Workspace.tsx', [
  'OfficialAnalyticsPanel',
  'analyticsDomain',
  'Fórmula',
  'Lineage',
  'Impacto',
]);
requireIncludes('frontend/src/components/grc/GrcPortal.tsx', [
  'official_calculations',
  'formula_code',
  'formula_version',
  'explanation_url',
  'lineage_url',
]);
requireIncludes('frontend/src/components/Sidebar.tsx', [
  'navigationGroups',
  'GRC integrado',
  'Analítica y reportes',
  'Evaluación y assurance',
]);
const pages = {
  'frontend/src/app/bi/page.tsx': ['DashboardBuilderGuide', 'OfficialAnalyticsPanel', 'analyticsDomain'],
  'frontend/src/app/reportes/studio/page.tsx': ['ReportStudioWorkspace', 'OfficialAnalyticsPanel', 'analyticsDomain'],
  'frontend/src/app/reportes/generaciones/page.tsx': ['CalculationRunHistory', 'analyticsDomain'],
  'frontend/src/app/metricas/page.tsx': ['MetricBuilder', 'FormulaCatalog', 'analyticsDomain="data_quality"'],
  'frontend/src/app/encuestas/page.tsx': ['SurveyScoringBuilder', 'analyticsDomain="survey"'],
  'frontend/src/app/tests/page.tsx': ['AssuranceScoringBuilder', 'SampleSizeCalculator', 'analyticsDomain="assurance"'],
  'frontend/src/app/eventos-perdida/page.tsx': ['LossAnalyticsPanel', 'analyticsDomain="loss"'],
};
for (const [rel, tokens] of Object.entries(pages)) requireIncludes(rel, tokens);
const constructors = [
  'FormulaCatalog','FormulaEditor','FormulaVersionHistory','SourceBindingEditor','VariableMapper','ThresholdEditor','CalculationPreview','CalculationRunHistory','CalculationExplanation','StatisticalMethodSelector','SampleSizeCalculator','RiskMethodologyEditor','ControlEffectivenessEditor','SurveyScoringBuilder','AssuranceScoringBuilder','LossAnalyticsPanel','OperationalExcellenceDashboard','HealthScoreBreakdown','MetricBuilder','DashboardBuilder','ReportStudioWorkspace'
];
for (const component of constructors) {
  const text = requireFile(`frontend/src/components/math-governance/${component}.tsx`);
  if (text && !/BuilderSurface|OfficialAnalyticsPanel|resultCode|steps/.test(text)) failures.push(`constructor_without_operational_contract:${component}`);
}
const scopedFiles = [
  'frontend/src/components/math-governance/OfficialAnalyticsPanel.tsx',
  'frontend/src/components/math-governance/BuilderSurface.tsx',
  'frontend/src/components/phase5/Phase5Workspace.tsx',
  ...Object.keys(pages),
];
for (const rel of scopedFiles) {
  const text = read(rel);
  if (/\b(eval|Function)\s*\(/.test(text)) failures.push(`unsafe_runtime_execution:${rel}`);
  if (/formulaExecution|statisticalEngine|officialFormulas|MonteCarlo/i.test(text)) failures.push(`frontend_calculation_import:${rel}`);
}
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'NOT_READY', package6_status: 'BLOCKED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'PACKAGE6_COMPLETED', checks: 86 }) + '\n');
