function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value) {
  return String(value || '').toLowerCase().trim();
}

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function isOpen(value) {
  return !['cerrado', 'cerrada', 'closed', 'completado', 'completada', 'resolved', 'resuelta', 'cancelado', 'cancelada'].includes(lower(value));
}

function isOverdue(row) {
  if (!row?.due_date) return false;
  const due = new Date(row.due_date).getTime();
  return Number.isFinite(due) && due < Date.now() && isOpen(row.status);
}

function isHighSeverity(value) {
  return ['critica', 'crítica', 'critical', 'alta', 'alto', 'high', 'critico', 'crítico'].includes(lower(value));
}

function calculateEvidenceMaturityScore(dataset = {}) {
  const controls = asArray(dataset.priority_controls || dataset.controls);
  const evidences = asArray(dataset.recent_evidences || dataset.evidences);
  if (!controls.length && !evidences.length) return 0;
  const controlsWithEvidence = controls.filter((row) => Number(row.evidence_count || row.approved_evidence_count || 0) > 0).length;
  const approved = evidences.filter((row) => ['aprobada', 'aprobado', 'approved', 'validada'].includes(lower(row.status || row.approval_status))).length;
  const controlScore = controls.length ? (controlsWithEvidence / controls.length) * 65 : 35;
  const approvalScore = evidences.length ? (approved / evidences.length) * 35 : 0;
  return bounded(controlScore + approvalScore);
}

function calculateRiskPressureScore(dataset = {}) {
  const risks = asArray(dataset.risks);
  const highRisks = risks.filter((row) => isHighSeverity(row.severity || row.level || row.risk_level || row.residual_risk_level));
  const untreated = highRisks.filter((row) => !row.treatment_plan_id && !row.action_plan_id && !row.owner && !row.owner_id);
  if (!risks.length) return 0;
  return bounded((highRisks.length / risks.length) * 70 + (untreated.length / risks.length) * 30);
}

function calculateActionExecutionScore(dataset = {}) {
  const actions = asArray(dataset.recent_action_plans || dataset.action_plans);
  if (!actions.length) return 50;
  const overdue = actions.filter(isOverdue).length;
  const closed = actions.filter((row) => !isOpen(row.status)).length;
  return bounded((closed / actions.length) * 70 + ((actions.length - overdue) / actions.length) * 30);
}

function calculateDataQualityScore(dataset = {}) {
  const counts = {
    standards: asArray(dataset.tenant_standards).length,
    controls: asArray(dataset.priority_controls || dataset.controls).length,
    evidences: asArray(dataset.recent_evidences || dataset.evidences).length,
    risks: asArray(dataset.risks).length,
    findings: asArray(dataset.recent_findings || dataset.findings).length,
    actions: asArray(dataset.recent_action_plans || dataset.action_plans).length,
    health: asArray(dataset.effective_health_summary).length,
  };
  const sourceCoverage = Object.values(counts).filter((count) => count > 0).length / Object.keys(counts).length;
  const warnings = asArray(dataset.limitations).length;
  return bounded(sourceCoverage * 100 - Math.min(35, warnings * 5));
}

function calculateKnowledgeCoverageScore(_dataset = {}, knowledgeContext = {}) {
  return bounded(knowledgeContext.coverage_score || 0);
}

function calculateSourceCoverageScore(dataset = {}) {
  const traceCount = asArray(dataset.source_trace).length;
  const sourceTypes = [
    dataset.tenant,
    dataset.company_profile,
    dataset.tenant_standards,
    dataset.priority_controls,
    dataset.recent_evidences,
    dataset.risks,
    dataset.recent_findings,
    dataset.recent_action_plans,
    dataset.kpis,
    dataset.effective_health_summary,
  ];
  const populated = sourceTypes.filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length;
  return bounded(Math.max(traceCount * 8, populated * 10));
}

function calculateConsistencyScore(dataset = {}, findings = []) {
  const highScoreWarning = asArray(findings).some((finding) => finding.rule_key === 'score_high_data_quality_low');
  const mismatchWarning = asArray(dataset.recent_evidences || dataset.evidences).some((evidence) => evidence.evidence_strength?.matches_expected_evidence === false);
  return bounded(100 - (highScoreWarning ? 35 : 0) - (mismatchWarning ? 20 : 0));
}

function calculateConfidenceScore(dataset = {}, findings = [], knowledgeContext = {}) {
  const dataQualityScore = calculateDataQualityScore(dataset);
  const sourceCoverageScore = calculateSourceCoverageScore(dataset);
  const knowledgeCoverageScore = calculateKnowledgeCoverageScore(dataset, knowledgeContext);
  const consistencyScore = calculateConsistencyScore(dataset, findings);
  const score = bounded(
    dataQualityScore * 0.45 +
      sourceCoverageScore * 0.20 +
      knowledgeCoverageScore * 0.25 +
      consistencyScore * 0.10
  );
  return {
    score,
    level: score >= 75 ? 'alta' : score >= 45 ? 'media' : 'baja',
    components: {
      data_quality_score: dataQualityScore,
      source_coverage_score: sourceCoverageScore,
      knowledge_coverage_score: knowledgeCoverageScore,
      consistency_score: consistencyScore,
    },
  };
}

function calculateAuditReadinessScore(dataset = {}, findings = [], knowledgeContext = {}) {
  const evidence = calculateEvidenceMaturityScore(dataset);
  const actions = calculateActionExecutionScore(dataset);
  const riskPressure = calculateRiskPressureScore(dataset);
  const knowledge = calculateKnowledgeCoverageScore(dataset, knowledgeContext);
  const blockers = asArray(findings).filter((finding) => finding.type === 'audit_blocker' || finding.severity === 'critica').length;
  return bounded(evidence * 0.35 + actions * 0.20 + (100 - riskPressure) * 0.20 + knowledge * 0.15 + Math.max(0, 100 - blockers * 20) * 0.10);
}

function calculateOverallIntelligenceScore(dataset = {}, findings = [], knowledgeContext = {}) {
  const readiness = calculateAuditReadinessScore(dataset, findings, knowledgeContext);
  const dataQuality = calculateDataQualityScore(dataset);
  const confidence = calculateConfidenceScore(dataset, findings, knowledgeContext).score;
  return bounded(readiness * 0.45 + dataQuality * 0.25 + confidence * 0.30);
}

module.exports = {
  calculateActionExecutionScore,
  calculateAuditReadinessScore,
  calculateConfidenceScore,
  calculateDataQualityScore,
  calculateEvidenceMaturityScore,
  calculateKnowledgeCoverageScore,
  calculateOverallIntelligenceScore,
  calculateRiskPressureScore,
};
