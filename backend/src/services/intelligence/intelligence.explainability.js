const scoring = require('./intelligence.scoring');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stateFromValue(value) {
  if (value >= 75) return 'alta';
  if (value >= 45) return 'media';
  return 'baja';
}

function firstKnowledge(knowledgeContext = {}) {
  return asArray(knowledgeContext.knowledge_items_used).slice(0, 3);
}

function evidenceBasis(dataset = {}, fields = []) {
  return fields.flatMap((field) => asArray(dataset[field]).slice(0, 3).map((row) => ({
    source: field,
    id: row.id || row.item_key || row.control_code || null,
    title: row.title || row.name || row.description || row.control_title || null,
  })));
}

function metricValue(metricKey, dataset, findings, knowledgeContext) {
  const scores = {
    compliance_score: scoring.calculateAuditReadinessScore(dataset, findings, knowledgeContext),
    health_score: scoring.calculateOverallIntelligenceScore(dataset, findings, knowledgeContext),
    audit_readiness: scoring.calculateAuditReadinessScore(dataset, findings, knowledgeContext),
    evidence_maturity: scoring.calculateEvidenceMaturityScore(dataset),
    overdue_actions: asArray(dataset.recent_action_plans || dataset.action_plans).filter((row) => row.due_date && new Date(row.due_date).getTime() < Date.now()).length,
    open_findings: asArray(dataset.recent_findings || dataset.findings).filter((row) => !['cerrado', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    open_nonconformities: asArray(dataset.recent_nonconformities || dataset.nonconformities).filter((row) => !['cerrado', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    high_critical_risks: asArray(dataset.risks).filter((row) => ['alta', 'critica', 'crítica', 'critical', 'high'].includes(String(row.severity || row.level || row.risk_level || '').toLowerCase())).length,
    data_quality: scoring.calculateDataQualityScore(dataset),
    knowledge_coverage: scoring.calculateKnowledgeCoverageScore(dataset, knowledgeContext),
    management_maturity: Math.round((scoring.calculateActionExecutionScore(dataset) + scoring.calculateDataQualityScore(dataset)) / 2),
  };
  return scores[metricKey] ?? 0;
}

function explainMetric(metricKey, dataset = {}, findings = [], knowledgeContext = {}) {
  const value = metricValue(metricKey, dataset, findings, knowledgeContext);
  const state = typeof value === 'number' && value <= 100 ? stateFromValue(value) : (value > 0 ? 'media' : 'baja');
  const knowledge = firstKnowledge(knowledgeContext);
  const confidence = knowledge.length && Number(knowledgeContext.coverage_score || 0) >= 45 ? 'media' : 'baja';

  const labels = {
    compliance_score: 'cumplimiento operacional inferido',
    health_score: 'salud ISO efectiva',
    audit_readiness: 'preparacion auditora',
    evidence_maturity: 'madurez de evidencia',
    overdue_actions: 'acciones vencidas',
    open_findings: 'hallazgos abiertos',
    open_nonconformities: 'no conformidades abiertas',
    high_critical_risks: 'riesgos altos o criticos',
    data_quality: 'calidad de datos',
    knowledge_coverage: 'cobertura Knowledge Base',
    management_maturity: 'madurez de gestion',
  };

  return {
    metric: metricKey,
    value,
    state,
    why: `La metrica ${labels[metricKey] || metricKey} se calcula con datos confirmados del tenant, reglas deterministicas y cobertura KB disponible.`,
    impact: state === 'baja'
      ? 'Requiere accion prioritaria o mayor calidad de datos antes de emitir conclusiones fuertes.'
      : 'Permite priorizar acciones y explicar el estado operativo con trazabilidad.',
    recommended_action: state === 'baja'
      ? 'Completar evidencia, responsables, acciones y cobertura KB para fortalecer la conclusion.'
      : 'Mantener seguimiento y revisar excepciones detectadas por reglas.',
    evidence_basis: evidenceBasis(dataset, ['priority_controls', 'recent_evidences', 'recent_findings', 'recent_action_plans']),
    knowledge_basis: knowledge,
    confidence,
  };
}

function explainCoreMetrics(dataset = {}, findings = [], knowledgeContext = {}) {
  return [
    'compliance_score',
    'health_score',
    'audit_readiness',
    'evidence_maturity',
    'overdue_actions',
    'open_findings',
    'open_nonconformities',
    'high_critical_risks',
    'data_quality',
    'knowledge_coverage',
    'management_maturity',
  ].map((metric) => explainMetric(metric, dataset, findings, knowledgeContext));
}

module.exports = {
  explainCoreMetrics,
  explainMetric,
};
