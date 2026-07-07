function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compactRows(rows, limit = 30) {
  return asArray(rows).slice(0, limit);
}

function normalizeTenantDataset(rawDataset = {}) {
  return {
    tenant: rawDataset.tenant || {},
    scope: rawDataset.scope || {},
    company_profile: rawDataset.company_profile || null,
    tenant_standards: asArray(rawDataset.tenant?.active_standards),
    controls: compactRows(rawDataset.priority_controls),
    priority_controls: compactRows(rawDataset.priority_controls),
    evidences: compactRows(rawDataset.recent_evidences),
    recent_evidences: compactRows(rawDataset.recent_evidences),
    risks: compactRows(rawDataset.risks),
    assets: compactRows(rawDataset.assets),
    audits: compactRows(rawDataset.audits),
    findings: compactRows(rawDataset.recent_findings),
    recent_findings: compactRows(rawDataset.recent_findings),
    nonconformities: compactRows(rawDataset.recent_nonconformities),
    action_plans: compactRows(rawDataset.recent_action_plans),
    recent_action_plans: compactRows(rawDataset.recent_action_plans),
    processes: compactRows(rawDataset.operational_context?.linked_controls),
    operations: rawDataset.tenant?.active_operations || [],
    kpis: compactRows(rawDataset.kpis),
    effective_health_summary: compactRows(rawDataset.effective_health_summary),
    source_trace: asArray(rawDataset.source_trace),
    limitations: asArray(rawDataset.limitations),
    raw_context_version: rawDataset.scope?.context_version || null,
  };
}

module.exports = {
  normalizeTenantDataset,
};
