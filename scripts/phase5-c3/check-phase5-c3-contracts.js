#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const { FUNCTIONAL_INDICATORS } = require(path.join(root, 'backend/src/services/indicators/functionalIndicatorCatalog'));
const { FORMULA_MAP } = require(path.join(root, 'backend/src/services/math-governance/formulaRegistry.service'));

assert(FUNCTIONAL_INDICATORS.length === 22, 'The documentary functional catalog must contain exactly 22 governed concepts');
assert(new Set(FUNCTIONAL_INDICATORS.map((item) => item.functional_code)).size === FUNCTIONAL_INDICATORS.length, 'Functional codes must be unique');
for (const item of FUNCTIONAL_INDICATORS) {
  assert(FORMULA_MAP.has(item.formula_code), `Indicator ${item.functional_code} is not bound to the official formula registry`);
  assert(item.checksum && item.threshold_bands.length === 3, `Indicator ${item.functional_code} lacks checksum or versioned thresholds`);
}
for (const [functionalCode,formulaCode] of [['DATA-TRUST','F5_C3_DATA_TRUST'],['OP-PERFORMANCE','F5_C3_OPERATIONAL_PERFORMANCE'],['SUPPLIER-HEALTH','F5_C3_SUPPLIER_HEALTH']]) {
  assert(FUNCTIONAL_INDICATORS.find((item) => item.functional_code === functionalCode)?.formula_code === formulaCode, `${functionalCode} must use its own published composite methodology`);
}
const core = read('backend/src/services/indicators/indicatorCore.js');
for (const dimension of ['completeness','accuracy','consistency','freshness','lineage','validation','stability','coverage']) assert(core.includes(`'${dimension}'`), `Missing Data Trust dimension ${dimension}`);
for (const state of ['calculated','unmeasured','source_unavailable','mapping_required','insufficient_data','insufficient_coverage','stale_source','dependency_pending','source_incompatible','validation_failed','technical_error']) assert(core.includes(`'${state}'`), `Missing official state ${state}`);
const service = read('backend/src/services/indicators/indicatorGovernance.service.js');
assert(service.includes('recalculateOfficialAnalytics'), 'Indicator calculation must call the official mathematical orchestrator');
assert(service.includes('createMethodologyDraft') && service.includes('transitionMethodology') && service.includes('exportCatalog'), 'Methodology governance or official export is incomplete');
assert(!service.includes('new Function(') && !service.includes('eval('), 'Dynamic calculation is forbidden');
const dashboard = read('frontend/src/app/dashboard/page.tsx');
assert(dashboard.includes('/api/metrics/official/dashboard'), 'Dashboard must consume the official snapshot adapter');
assert(!dashboard.includes('/api/kpis/dashboard/') && !dashboard.includes('calculateExecutiveScore('), 'Dashboard retains a parallel legacy calculation');
const phase5 = read('backend/src/services/phase5/phase5.service.js');
assert(!phase5.includes('evaluate(formula.expression'), 'Legacy metric endpoint still executes a parallel formula');
const reports = read('backend/src/routes/reports.routes.js');
assert(reports.includes('reportData.official_indicators = await indicatorGovernance.listCatalog'), 'Report artifacts must embed the same official indicator snapshots');
const analyticsPanel = read('frontend/src/components/math-governance/OfficialAnalyticsPanel.tsx');
assert(analyticsPanel.includes('/api/metrics/official/catalog') && !analyticsPanel.includes('/api/grc/official/analytics/catalog'), 'BI and Report Studio must consume functional snapshots');
for (let i=1;i<=12;i+=1) assert(fs.existsSync(path.join(root, `docs/final-phases/indicators/${String(i).padStart(2,'0')}_${[
  'current_state_inventory','consumer_migration_matrix','functional_indicator_catalog','official_calculation_chain','data_trust_methodology','snapshot_and_comparison_contract','api_and_consumer_contract','security_rbac_limits','jobs_and_observability','migration_runbook','numeric_and_e2e_evidence','phase5_c3_closeout'][i-1]}.md`)), `Missing Phase 5-C3 document ${i}`);
process.stdout.write(JSON.stringify({status:'VERIFIED_PHASE5_C3_CONTRACTS',indicators:22,trust_dimensions:8,parallel_frontend_calculations:0})+'\n');
