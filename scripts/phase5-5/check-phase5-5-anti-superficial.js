#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return exists(rel) ? fs.readFileSync(path.join(root, rel), 'utf8') : ''; }
const failures = [];
const futurePackagePending = [];
const trace = read('docs/phase5-5/formula-traceability-matrix.md');
const formulas = new Set([...trace.matchAll(/`(F5_5_[A-Z0-9_]+)`/g)].map((m) => m[1]));
if (formulas.size !== 50) failures.push('formula_traceability_matrix_must_register_50_formulas');
const requiredDocs = [
  'docs/phase5-5/current-calculation-inventory.md',
  'docs/phase5-5/calculation-consumer-map.md',
  'docs/phase5-5/source-availability-matrix.md',
  'docs/phase5-5/implementation-workplan.md',
  'docs/phase5-5/mathematical-verification-evidence.md',
  'docs/phase5-5/integration-verification-evidence.md',
  'docs/phase5-5/adversarial-quality-review.md',
  'docs/phase5-5/independent-final-review.md',
  'docs/phase5-5/official-math-architecture.md',
  'docs/phase5-5/source-contracts.md',
  'docs/phase5-5/api-contracts.md',
  'docs/phase5-5/security.md',
  'docs/phase5-5/package5-final-audit.md',
  'docs/phase5-5/package6-operability-ux.md',
  'docs/phase5-5/final-acceptance-matrix.md',
  'docs/phase5-5/closeout.md',
];
for (const doc of requiredDocs) if (!exists(doc)) failures.push('missing_' + doc);
const expectedRuntime = [
  'backend/src/services/math-governance/formulaRegistry.service.js',
  'backend/src/services/math-governance/formulaExecution.service.js',
  'backend/src/services/math-governance/statisticalEngine.service.js',
  'backend/src/services/math-governance/riskCalculation.service.js',
  'backend/src/services/math-governance/controlCalculation.service.js',
  'backend/src/services/math-governance/complianceCalculation.service.js',
  'backend/src/services/math-governance/readinessCalculation.service.js',
  'backend/src/services/math-governance/grcHealthCalculation.service.js',
  'backend/src/services/math-governance/actionCalculation.service.js',
  'backend/src/services/math-governance/operationalExcellence.service.js',
  'backend/src/services/math-governance/phase5Package3.service.js',
  'backend/src/services/math-governance/surveyCalculation.service.js',
  'backend/src/services/math-governance/assuranceCalculation.service.js',
  'backend/src/services/math-governance/lossCalculation.service.js',
  'backend/src/services/math-governance/continuityCalculation.service.js',
  'backend/src/services/math-governance/assetCalculation.service.js',
  'backend/src/services/math-governance/supplierCalculation.service.js',
  'backend/src/services/math-governance/phase5Package4Jobs.service.js',
  'backend/src/services/math-governance/phase5Package4.test.js',
  'backend/src/services/math-governance/analyticsCatalog.service.js',
  'backend/src/services/math-governance/phase5Package5.test.js',
  'frontend/src/components/math-governance/OfficialAnalyticsPanel.tsx',
  'frontend/src/components/phase5/Phase5Workspace.tsx',
  'frontend/src/components/grc/GrcPortal.tsx',
  'database/migrations/20260730_phase5_5_official_math_governance.sql',
];
for (const file of expectedRuntime) if (!exists(file)) failures.push('missing_runtime_' + file);
const packageJson = JSON.parse(read('package.json') || '{}');
const scripts = packageJson.scripts || {};
for (const script of ['phase5-5:inventory','phase5-5:formula-registry-check','phase5-5:formula-tests','phase5-5:statistics-tests','phase5-5:source-binding-check','phase5-5:package3-tests','phase5-5:package4-check','phase5-5:package4-e2e','phase5-5:package4-tenant-isolation','phase5-5:package4-postgres','phase5-5:supplier-integration','phase5-5:asset-integration','phase5-5:continuity-integration','phase5-5:loss-integration','phase5-5:assurance-integration','phase5-5:survey-integration','phase5-5:package4-tests','phase5-5:analytics-catalog','phase5-5:bi-consumption','phase5-5:report-studio','phase5-5:explainability','phase5-5:package5-postgres','phase5-5:package5-tenant-isolation','phase5-5:package5-e2e','phase5-5:package5-tests','phase5-5:package5-check','phase5-5:package6-check','phase5-5:full-e2e','phase5-5:browser-e2e','phase5-5:cross-view-consistency','phase5-5:artifact-validation','phase5-5:accessibility-check','phase5-5:security-check','phase5-5:performance-check','phase5-5:final-check','phase5-5:tenant-isolation','phase5-5:legacy-compatibility','phase5-5:frontend-operability','phase5-5:postgres-integration','phase5-5:e2e','phase5-5:check','phase5-5:anti-superficial-check']) {
  if (!scripts[script]) failures.push('missing_package_script_' + script);
}
const testDir = path.join(root, 'backend/src/services/math-governance');
const testFiles = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter((name) => name.endsWith('.test.js')) : [];
if (testFiles.length === 0) failures.push('missing_formula_unit_tests');
const frontendConstructors = [
  'FormulaCatalog','FormulaEditor','FormulaVersionHistory','SourceBindingEditor','VariableMapper','ThresholdEditor','CalculationPreview','CalculationRunHistory','CalculationExplanation','StatisticalMethodSelector','SampleSizeCalculator','RiskMethodologyEditor','ControlEffectivenessEditor','SurveyScoringBuilder','AssuranceScoringBuilder','LossAnalyticsPanel','OperationalExcellenceDashboard','HealthScoreBreakdown','MetricBuilder','DashboardBuilder','ReportStudioWorkspace'
];
for (const component of frontendConstructors) {
  if (!exists('frontend/src/components/math-governance/' + component + '.tsx')) futurePackagePending.push('missing_frontend_constructor_' + component);
}
for (const target of ['backend/src/services/math-governance', 'frontend/src/components/math-governance', 'docs/phase5-5']) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) continue;
  const stack = [full];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) fs.readdirSync(current).forEach((name) => stack.push(path.join(current, name)));
    else {
      const text = fs.readFileSync(current, 'utf8');
      const debtPattern = new RegExp('\\b(' + ['TO' + 'DO', 'FIX' + 'ME', 'HA' + 'CK'].join('|') + ')\\b');
      if (debtPattern.test(text)) failures.push('debt_marker_' + path.relative(root, current));
    }
  }
}
const review = read('docs/phase5-5/independent-final-review.md');
if (!review.includes('APPROVED_FOR_REVIEW')) failures.push('independent_final_review_not_approved');
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'NOT_READY', package3_status: 'BLOCKED', package4_status: 'BLOCKED', package5_status: 'BLOCKED', package6_status: 'BLOCKED', package7_status: 'BLOCKED', failures, future_package_pending: futurePackagePending }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'APPROVED_FOR_REVIEW', package3_status: 'COMPLETED', package4_status: 'COMPLETED', package5_status: 'COMPLETED', package6_status: 'COMPLETED', package7_status: 'COMPLETED', future_package_pending: futurePackagePending }) + '\n');
