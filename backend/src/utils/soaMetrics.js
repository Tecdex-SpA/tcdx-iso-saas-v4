'use strict';

const {
  normalizeApplicable,
  normalizeImplementationStatus,
  buildSoAInconsistencies,
} = require('./soaValidation');

function pct(value, base) {
  const numerator = Number(value || 0);
  const denominator = Number(base || 0);
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function withInconsistencies(rows) {
  return rows.map((row) => {
    const inconsistencies = Array.isArray(row.inconsistencies)
      ? row.inconsistencies
      : buildSoAInconsistencies(row);

    return {
      ...row,
      implementation_status: normalizeImplementationStatus(row.implementation_status),
      inconsistencies,
      inconsistency_count: inconsistencies.length,
    };
  });
}

function buildSoAMetrics(inputRows) {
  const rows = withInconsistencies(inputRows || []);
  const totalControls = rows.length;
  const applicableRows = rows.filter((row) => normalizeApplicable(row.applicable, null) === true);
  const notApplicableRows = rows.filter((row) => normalizeApplicable(row.applicable, null) === false);
  const decisionCount = applicableRows.length + notApplicableRows.length;
  const implementedApplicable = applicableRows.filter((row) => normalizeImplementationStatus(row.implementation_status) === 'implementado').length;
  const partialApplicable = applicableRows.filter((row) => normalizeImplementationStatus(row.implementation_status) === 'parcial').length;
  const pendingApplicable = applicableRows.filter((row) => normalizeImplementationStatus(row.implementation_status) === 'pendiente').length;
  const notApplicableJustified = notApplicableRows.filter((row) => String(row.justification || '').trim()).length;

  const validEvidence = applicableRows.filter((row) => Number(row.valid_evidence_count || 0) > 0).length;
  const expiredEvidence = rows.filter((row) => Number(row.expired_evidence_count || 0) > 0).length;
  const rejectedEvidence = rows.filter((row) => Number(row.rejected_evidence_count || 0) > 0).length;
  const controlsWithOpenFindings = rows.filter((row) => Number(row.open_findings_count || 0) > 0).length;
  const controlsWithOpenNc = rows.filter((row) => Number(row.open_nonconformities_count || 0) > 0).length;
  const controlsWithHighRisk = rows.filter((row) => Number(row.high_or_critical_risk_count || 0) > 0).length;
  const controlsWithOverdueActions = rows.filter((row) => Number(row.overdue_actions_count || 0) > 0).length;
  const controlsWithInconsistency = rows.filter((row) => row.inconsistencies.length > 0).length;

  return {
    total_controls: totalControls,
    decision_count: decisionCount,
    applicable_count: applicableRows.length,
    not_applicable_count: notApplicableRows.length,
    not_applicable_justified_count: notApplicableJustified,
    pending_applicability_count: Math.max(totalControls - decisionCount, 0),
    implemented_applicable_count: implementedApplicable,
    partial_applicable_count: partialApplicable,
    pending_applicable_count: pendingApplicable,
    implementation_coverage_pct: pct(implementedApplicable, applicableRows.length),
    applicability_coverage_pct: pct(decisionCount, totalControls),
    na_justification_coverage_pct: pct(notApplicableJustified, notApplicableRows.length),
    controls_with_valid_evidence_count: validEvidence,
    controls_with_expired_evidence_count: expiredEvidence,
    controls_with_rejected_evidence_count: rejectedEvidence,
    evidence_validity_pct: pct(validEvidence, applicableRows.length),
    controls_with_open_findings_count: controlsWithOpenFindings,
    controls_with_open_nonconformities_count: controlsWithOpenNc,
    controls_with_high_or_critical_risk_count: controlsWithHighRisk,
    controls_with_overdue_actions_count: controlsWithOverdueActions,
    inconsistency_count: controlsWithInconsistency,
  };
}

module.exports = {
  pct,
  withInconsistencies,
  buildSoAMetrics,
};
