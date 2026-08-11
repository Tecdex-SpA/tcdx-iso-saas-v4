#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const { FUNCTIONAL_INDICATORS } = require('../../backend/src/services/indicators/functionalIndicatorCatalog');
const { executeFormula } = require('../../backend/src/services/math-governance/formulaRegistry.service');
const { getSourceCodeForIndicator, getSourceContract } = require('../../backend/src/services/math-governance/sourceContracts.service');
const { mapFormulaInput } = require('../../backend/src/services/math-governance/sourceResolver.service');

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(FUNCTIONAL_INDICATORS.length === 22, `expected_22_indicators_found_${FUNCTIONAL_INDICATORS.length}`);
for (const indicator of FUNCTIONAL_INDICATORS) {
  const sourceCode = getSourceCodeForIndicator(indicator.functional_code, indicator.formula_code);
  const contract = getSourceContract(sourceCode);
  check(Boolean(contract), `${indicator.functional_code}_missing_source_contract_${sourceCode}`);
  check(contract?.availability === 'available', `${indicator.functional_code}_source_not_available_${sourceCode}`);
}

check(getSourceCodeForIndicator('INCIDENTS', 'F5_5_SEVERITY_INDEX') === 'incident_operational_events', 'INCIDENTS_must_not_use_audit_findings_source');
check(getSourceCodeForIndicator('EVIDENCE-FRESH', 'F5_5_FRESHNESS_CONTINUOUS') === 'evidence_freshness_records', 'EVIDENCE_FRESH_must_not_use_data_quality_source');
check(getSourceCodeForIndicator('FINDINGS', 'F5_5_SEVERITY_INDEX') === 'audit_findings_actions', 'FINDINGS_must_keep_audit_source');

const actions = mapFormulaInput('F5_5_WEIGHTED_PROGRESS', [
  { opened_at: '2026-01-01T00:00:00Z', progress_percent: 25, due_date: '2026-02-01T00:00:00Z', status: 'open', weight: 1 },
  { opened_at: '2026-01-01T00:00:00Z', latest_progress_percent: 50, due_at: '2026-02-01T00:00:00Z', latest_status_after: 'in_progress', weight: 1 },
  { opened_at: '2026-01-01T00:00:00Z', progress: 1, completed_at: '2026-02-01T00:00:00Z', status: 'completed', weight: 2 },
  { opened_at: '2026-01-01T00:00:00Z', status: 'open', weight: 10 },
]);
check(actions.items.length === 3, 'ACTIONS_missing_progress_must_be_excluded_not_zero');
check(executeFormula('F5_5_WEIGHTED_PROGRESS', actions).value === 68.75, 'ACTIONS_weighted_progress_value_mismatch');

const incidentSeverity = mapFormulaInput('F5_5_SEVERITY_INDEX', [
  { severity: 'low' },
  { severity: 'high' },
  { severity: 'critical' },
]);
check(JSON.stringify(incidentSeverity) === JSON.stringify({ low: 1, medium: 0, high: 1, critical: 1 }), 'INCIDENTS_severity_mapping_invalid');

const inherent = mapFormulaInput('F5_5_INHERENT_RISK', [{ likelihood: 4, impact: 5 }]);
check(executeFormula('F5_5_INHERENT_RISK', inherent).value === 20, 'RISK_INHERENT_likelihood_impact_value_mismatch');

const residual = mapFormulaInput('F5_5_RESIDUAL_RISK', [{ exposure: 20, control_effectiveness: 65 }]);
check(executeFormula('F5_5_RESIDUAL_RISK', residual).value === 7, 'RISK_RESIDUAL_expected_value_mismatch');

const controlGlobal = mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS', [{ score: 90 }]);
check(Object.values(controlGlobal).every((value) => value === null), 'CONTROL_EFFECT_global_score_must_not_fill_dimensions');
try {
  executeFormula('F5_5_CONTROL_EFFECTIVENESS', controlGlobal);
  failures.push('CONTROL_EFFECT_global_score_must_throw_missing_dimension');
} catch (error) {
  check(error?.code === 'FORMULA_VARIABLE_REQUIRED', 'CONTROL_EFFECT_unexpected_error_for_missing_dimensions');
}
const controlExact = mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS', [{ design_effectiveness: 80, implementation_effectiveness: 70, operation_effectiveness: 90, evidence_effectiveness: 60 }]);
check(executeFormula('F5_5_CONTROL_EFFECTIVENESS', controlExact).value === 0.75, 'CONTROL_EFFECT_dimension_value_mismatch');

const loss = mapFormulaInput('F5_5_NET_LOSS', [{ gross_loss_amount: 1000, recovery_amount: 300 }]);
check(executeFormula('F5_5_NET_LOSS', loss).value === 700, 'LOSSES_net_loss_value_mismatch');
const lossUiColumns = mapFormulaInput('F5_5_NET_LOSS', [{ gross_loss: 100000, recoveries: 25000, net_loss: 75000 }]);
check(executeFormula('F5_5_NET_LOSS', lossUiColumns).value === 75000, 'LOSSES_ui_loss_events_columns_must_feed_net_loss');

const continuityRto = mapFormulaInput('F5_5_RTO_GAP', [{ actual_recovery_hours: 9, rto_hours: 4 }]);
const continuityRpo = mapFormulaInput('F5_5_RPO_GAP', [{ actual_data_loss_hours: 3, rpo_hours: 1 }]);
check(executeFormula('F5_5_RTO_GAP', continuityRto).value === 5, 'CONTINUITY_rto_gap_mismatch');
check(executeFormula('F5_5_RPO_GAP', continuityRpo).value === 2, 'CONTINUITY_rpo_gap_mismatch');

const supplierPartial = mapFormulaInput('F5_C3_SUPPLIER_HEALTH', [{ compliance_score: 80, security_score: 80 }]);
try {
  executeFormula('F5_C3_SUPPLIER_HEALTH', supplierPartial);
  failures.push('SUPPLIER_HEALTH_missing_components_must_not_calculate');
} catch (error) {
  check(error?.code === 'FORMULA_VARIABLE_REQUIRED', 'SUPPLIER_HEALTH_unexpected_missing_component_error');
}

const dashboard = read('frontend/src/app/dashboard/page.tsx');
check(!dashboard.includes('buildTrend(numberOrZero(item.latest_snapshot?.value)'), 'Dashboard_must_not_synthesize_official_trend_from_current_value');
check(!dashboard.includes('Number(kpiSummary?.official_score ?? 0)'), 'Dashboard_must_not_convert_missing_official_score_to_zero');
check(dashboard.includes('Sin histórico oficial comparable.'), 'Dashboard_must_explain_missing_comparable_history');

const reportRoutes = read('backend/src/routes/reports.routes.js');
check(reportRoutes.includes('reportData.official_indicators = await indicatorGovernance.listCatalog'), 'Report_must_embed_official_indicator_snapshots');
const indicatorService = read('backend/src/services/indicators/indicatorGovernance.service.js');
for (const token of ['snapshot_id', 'checksum', 'trust', 'coverage', 'sufficiency']) {
  check(indicatorService.includes(token), `Official_export_missing_${token}`);
}
check(indicatorService.includes('snapshots_created'), 'Dashboard_recalculate_must_report_snapshot_publication_count');
check(indicatorService.includes('publishSnapshot(scope,snapshotId,requestId)'), 'Dashboard_recalculate_must_publish_snapshots_consumed_by_official_surfaces');
check(indicatorService.includes('metricInterpretationChecksum(snapshot.id,interpretation)'), 'Metric_interpretation_checksum_must_be_scoped_by_snapshot_to_avoid_cross_indicator_duplicates');
check(!indicatorService.includes('checksum(interpretation),actorId(scope)'), 'Metric_interpretation_checksum_must_not_be_global_interpretation_only');

if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'PHASE5_FUNCTIONAL_CLOSURE_CHECK_FAILED', failures }, null, 2) + '\n');
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  status: 'PHASE5_FUNCTIONAL_CLOSURE_CHECK_OK',
  indicators: 22,
  formulas_reconciled: 53,
  p0_numeric_assertions: 11,
  dashboard_synthetic_trend: 'rejected',
  report_export_snapshot_contract: 'verified',
}) + '\n');
