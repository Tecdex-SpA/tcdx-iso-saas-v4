function severityWeight(severity) {
  return {
    critica: 100,
    crítica: 100,
    alta: 80,
    media: 50,
    baja: 25,
  }[String(severity || '').toLowerCase()] || 40;
}

function urgencyForFinding(finding) {
  if (finding.severity === 'critica' || finding.type === 'audit_blocker') return 'inmediata';
  if (finding.severity === 'alta') return '7_dias';
  if (finding.severity === 'media') return '30_dias';
  return 'planificada';
}

function ownerForCategory(category) {
  return {
    evidence: 'operativo',
    audit: 'auditor',
    risk: 'area_owner',
    action_plan: 'admin_cumplimiento',
    governance: 'admin_cumplimiento',
    data_quality: 'admin_cumplimiento',
    ai_governance: 'admin_cumplimiento',
  }[category] || 'admin_cumplimiento';
}

function buildActionBasis(finding) {
  const kb = finding.knowledge_basis?.[0];
  if (kb?.item_key) {
    return {
      source: 'knowledge_base',
      item_key: kb.item_key,
      source_record_id: kb.source_record_id || null,
      derived_from: 'recommended_action',
    };
  }
  return {
    source: 'rule',
    item_key: null,
    source_record_id: null,
    derived_from: finding.rule_key,
  };
}

function buildNextBestActions(dataset = {}, findings = []) {
  return findings
    .map((finding) => ({
      finding,
      sort_score: severityWeight(finding.severity) + (finding.type === 'audit_blocker' ? 20 : 0),
    }))
    .sort((a, b) => b.sort_score - a.sort_score)
    .slice(0, 10)
    .map(({ finding }, index) => ({
      priority: index + 1,
      urgency: urgencyForFinding(finding),
      title: finding.recommended_action || finding.title,
      description: finding.description,
      reason: finding.impact,
      expected_impact: finding.type === 'audit_blocker'
        ? 'Mejora readiness y reduce bloqueo de auditoria.'
        : 'Mejora control operacional y trazabilidad.',
      owner_role: ownerForCategory(finding.category),
      effort: finding.severity === 'critica' ? 'alto' : finding.severity === 'alta' ? 'medio' : 'bajo',
      risk_if_ignored: finding.impact,
      source: finding.knowledge_basis?.length ? 'mixed' : 'rule',
      confidence: finding.confidence || 'media',
      action_basis: buildActionBasis(finding),
      related_finding_id: finding.id,
    }));
}

module.exports = {
  buildNextBestActions,
};
