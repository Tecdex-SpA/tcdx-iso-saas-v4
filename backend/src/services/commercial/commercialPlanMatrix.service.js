'use strict';

const PLAN_KEYS = Object.freeze({
  ISO: 'pyme',
  ISO_RISK: 'empresa',
  GRC: 'enterprise',
});

const CLASSIFICATIONS = Object.freeze({
  ISO_ONLY: 'ISO_ONLY',
  OPERATIONAL_RISK_EXTENSION: 'OPERATIONAL_RISK_EXTENSION',
  GRC_ADVANCED: 'GRC_ADVANCED',
  PLATFORM_INTERNAL: 'PLATFORM_INTERNAL',
  DEALER_INTERNAL: 'DEALER_INTERNAL',
  HISTORIC_DEPRECATED: 'HISTORIC/DEPRECATED',
});

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
const ACTIVE_TENANT_STATUSES = new Set(['active', 'trialing']);

const CAPABILITIES = Object.freeze([
  capability('core.dashboard', 'Dashboard base del tenant', 'core', 'home', CLASSIFICATIONS.ISO_ONLY, 'dashboards.read', ['/dashboard'], ['/api/dashboard', '/api/me/entitlements']),
  capability('core.reports', 'Reportes/exportes estrictamente ISO', 'core', 'reports', CLASSIFICATIONS.ISO_ONLY, 'reports.read', ['/exportes'], ['/api/reports']),
  capability('iso.compliance', 'Gestion ISO, diagnostico, controles, SOA, auditorias, hallazgos y no conformidades', 'iso', 'iso_compliance', CLASSIFICATIONS.ISO_ONLY, 'framework.read', ['/cumplimiento-auditoria', '/diagnostico', '/controles', '/soa', '/ciclo-vida', '/auditorias', '/auditorias/ejecucion', '/ejecucion-iso', '/hallazgos', '/no-conformidades'], ['/api/diagnostic', '/api/controls', '/api/soa', '/api/lifecycle', '/api/audits', '/api/audit-execution', '/api/findings', '/api/nonconformities']),
  capability('iso.risk', 'Riesgos ISO y matriz de riesgo ISO', 'risks', 'iso_risk', CLASSIFICATIONS.ISO_ONLY, 'risk_matrix.view', ['/riesgos', '/matriz-riesgo', '/activos'], ['/api/iso-risk-matrix', '/api/assets']),
  capability('iso.actions', 'Planes de accion y acciones recomendadas de cumplimiento ISO', 'iso', 'iso_actions', CLASSIFICATIONS.ISO_ONLY, 'actions.read', ['/planes-accion', '/plan-accion', '/acciones-recomendadas'], ['/api/action-plans', '/api/iso-recommended-actions']),
  capability('evidence.library', 'Biblioteca de evidencias y documentos normativos ISO', 'evidences', 'evidence_library', CLASSIFICATIONS.ISO_ONLY, 'evidences.view', ['/evidencias', '/documentos'], ['/api/evidences', '/api/evidence-library']),
  capability('iso.health', 'Health/estado ISO y KPIs minimos de gestion ISO', 'health', 'iso_health', CLASSIFICATIONS.ISO_ONLY, 'framework.read', ['/iso-health', '/health', '/administrar-kpis'], ['/api/health', '/api/kpi', '/api/kpis']),

  capability('grc.phase3', 'Operacion, procesos, unidades, servicios, BIA, continuidad, crisis e indicadores operacionales', 'operations_grc', 'operational_risk_core', CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, 'operations.dashboard.read', ['/operaciones-grc', '/unidades', '/procesos', '/servicios', '/bia', '/continuidad', '/crisis', '/indicadores'], ['/api/grc/phase3']),
  capability('imports.excel', 'Importacion operacional necesaria para operar riesgo operacional', 'operations_grc', 'operational_imports', CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, 'operations.import', ['/importaciones', '/operaciones-grc/importar'], ['/api/imports']),
  capability('risk.quantitative', 'Riesgo cuantitativo operacional', 'risk_manager', 'operational_quantitative_risk', CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, 'quantitative_risk.read', ['/riesgo-cuantitativo'], ['/api/operational-risks']),
  capability('methodology.risk', 'Metodologias de riesgo operacional', 'risk_manager', 'operational_risk_methodology', CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, 'quantitative_risk.read', ['/riesgo-cuantitativo'], ['/api/operational-risks']),
  capability('loss.events', 'Eventos de perdida operacional', 'operational_losses', 'operational_loss_events', CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, 'loss_events.read', ['/eventos-perdida'], ['/api/loss-events']),

  capability('grc.phase1', 'Workflow GRC transversal, readiness y auditoria avanzada', 'grc_core', 'grc_phase1_advanced', CLASSIFICATIONS.GRC_ADVANCED, 'workflow.read', ['/grc-global'], ['/api/grc']),
  capability('grc.phase2', 'Privacidad, incidentes, proveedores, conectores y GRC integrado', 'integrated_grc', 'grc_phase2_integrated', CLASSIFICATIONS.GRC_ADVANCED, 'workflow.read', ['/grc-global', '/privacidad', '/incidentes', '/proveedores', '/portal-proveedor', '/conectores'], ['/api/grc/phase2']),
  capability('tprm.suppliers', 'Proveedores, terceros y TPRM', 'integrated_grc', 'tprm_suppliers', CLASSIFICATIONS.GRC_ADVANCED, 'suppliers.read', ['/proveedores', '/portal-proveedor'], ['/api/grc/phase2/suppliers', '/api/supplier-portal']),
  capability('data.governance', 'Gobierno de datos, catalogo y portal GRC de datos', 'data_governance', 'data_governance_core', CLASSIFICATIONS.GRC_ADVANCED, 'data.catalog.read', ['/grc', '/datos', '/datos/catalogo'], ['/api/data', '/api/grc/overview']),
  capability('metrics.catalog', 'Catalogo de metricas GRC avanzadas', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.read', ['/metricas', '/metricas/[id]', '/metricas/constructor'], ['/api/metrics', '/api/grc/official/analytics']),
  capability('metrics.engine', 'Motor de metricas GRC avanzadas', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.measure', ['/metricas/constructor'], ['/api/metrics/:id/calculate', '/api/grc/official/recalculate']),
  capability('metrics.data_trust', 'Data Trust avanzado', 'data_governance', 'data_governance_core', CLASSIFICATIONS.GRC_ADVANCED, 'data.quality.read', ['/datos/calidad'], ['/api/data/quality']),
  capability('data.lineage', 'Lineage de datos', 'data_governance', 'data_governance_core', CLASSIFICATIONS.GRC_ADVANCED, 'data.lineage.read', ['/datos/lineage'], ['/api/data/lineage']),
  capability('data.impact_graph', 'Impact Graph GRC', 'data_governance', 'data_governance_core', CLASSIFICATIONS.GRC_ADVANCED, 'data.lineage.read', ['/grc'], ['/api/data/impact', '/api/grc/impact']),
  capability('data.semantic_layer', 'Semantica de datos y observaciones canonicas', 'data_governance', 'data_governance_core', CLASSIFICATIONS.GRC_ADVANCED, 'semantic.contracts.read', ['/datos/semantica'], ['/api/semantic']),
  capability('surveys.engine', 'Encuestas y evaluaciones GRC', 'surveys_assessments', 'surveys_assessments_core', CLASSIFICATIONS.GRC_ADVANCED, 'surveys.read', ['/encuestas', '/encuestas/[id]', '/evaluaciones'], ['/api/surveys', '/api/survey-campaigns', '/api/survey-responses']),
  capability('assurance.testing', 'Assurance y tests GRC avanzados', 'assurance_loss', 'assurance_testing', CLASSIFICATIONS.GRC_ADVANCED, 'assurance_tests.read', ['/tests'], ['/api/assurance-tests']),
  capability('bi.dashboard_builder', 'Constructor de dashboards BI', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'dashboards.read', ['/bi/dashboards/[id]'], ['/api/dashboards']),
  capability('bi.executive_dashboards', 'Dashboards ejecutivos BI', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'dashboards.read', ['/bi'], ['/api/dashboards']),
  capability('reporting.studio', 'Report Studio avanzado', 'report_studio', 'report_studio_core', CLASSIFICATIONS.GRC_ADVANCED, 'reports.read', ['/reportes/studio', '/reportes/generaciones'], ['/api/reports', '/api/report-generations']),
  capability('reporting.pdf', 'Generacion PDF avanzada', 'report_studio', 'report_studio_core', CLASSIFICATIONS.GRC_ADVANCED, 'reports.generate', ['/reportes/generaciones'], ['/api/report-generations/:id/download']),
  capability('reporting.docx', 'Generacion DOCX avanzada', 'report_studio', 'report_studio_core', CLASSIFICATIONS.GRC_ADVANCED, 'reports.generate', ['/reportes/generaciones'], ['/api/report-generations']),
  capability('reporting.xlsx', 'Generacion XLSX avanzada', 'report_studio', 'report_studio_core', CLASSIFICATIONS.GRC_ADVANCED, 'reports.generate', ['/reportes/generaciones'], ['/api/report-generations']),
  capability('reporting.scheduled', 'Reportes programados avanzados', 'report_studio', 'report_studio_core', CLASSIFICATIONS.GRC_ADVANCED, 'reports.schedule', ['/reportes/studio'], ['/api/report-schedules']),
  capability('reports.premium', 'Premium reports y ZIP/PDF ejecutivo', 'premium_reports', 'premium_reports_core', CLASSIFICATIONS.GRC_ADVANCED, 'grc.export.generate', ['/reportes/studio'], ['/api/reports']),
  capability('workpapers.audit', 'Papeles de trabajo avanzados de auditoria', 'audit_workpapers', 'audit_workpapers_core', CLASSIFICATIONS.GRC_ADVANCED, 'commercial.workpaper.read', ['/auditorias/ia'], ['/api/audit-preparation']),
  capability('ai.compliance', 'IA Compliance avanzada', 'ai_compliance', 'ai_compliance_core', CLASSIFICATIONS.GRC_ADVANCED, 'ai_compliance.read', ['/ia', '/ia-compliance', '/ia-compliance/sugerencias'], ['/api/ai-compliance']),
  capability('ai.auditor', 'IA Auditor avanzada', 'ai_compliance', 'ai_auditor_core', CLASSIFICATIONS.GRC_ADVANCED, 'audit.review', ['/ia-auditor', '/auditorias/ia'], ['/api/ai-auditor']),
  capability('metrics.indicators.read', 'Indicadores oficiales avanzados', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.read', ['/metricas'], ['/api/metrics']),
  capability('metrics.indicators.technical', 'Detalle tecnico de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'data.lineage.read', ['/metricas/[id]'], ['/api/metrics']),
  capability('metrics.methodology.manage', 'Administrar metodologia de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.manage', ['/metricas/constructor'], ['/api/metrics']),
  capability('metrics.methodology.review', 'Revisar metodologia de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.validate', ['/metricas/constructor'], ['/api/metrics']),
  capability('metrics.methodology.publish', 'Publicar metodologia de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.publish', ['/metricas/constructor'], ['/api/metrics']),
  capability('metrics.snapshots.publish', 'Publicar snapshots oficiales', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.measure', ['/metricas/[id]'], ['/api/metrics']),
  capability('metrics.comparisons.read', 'Comparaciones de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.read', ['/metricas/[id]'], ['/api/metrics']),
  capability('metrics.actions.propose', 'Propuestas de acciones desde indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.measure', ['/metricas/[id]'], ['/api/metrics']),
  capability('metrics.actions.review', 'Revision de acciones propuestas desde indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.validate', ['/metricas/[id]'], ['/api/metrics']),
  capability('metrics.jobs.run', 'Jobs de indicadores', 'metrics_bi', 'metrics_bi_core', CLASSIFICATIONS.GRC_ADVANCED, 'metrics.recalculate', ['/metricas'], ['/api/metrics']),
]);

const INTERNAL_ROUTE_CAPABILITIES = Object.freeze([
  internalCapability('core.profile', 'Perfil de usuario', 'core', CLASSIFICATIONS.PLATFORM_INTERNAL, ['/perfil']),
  internalCapability('tenant.admin', 'Administracion tenant', 'core', CLASSIFICATIONS.PLATFORM_INTERNAL, ['/configuracion', '/usuarios', '/perfil-empresa']),
  internalCapability('platform.admin', 'Administracion plataforma', 'platform', CLASSIFICATIONS.PLATFORM_INTERNAL, ['/admin-saas', '/empresas']),
  internalCapability('dealer.console', 'Consola dealer', 'dealer', CLASSIFICATIONS.DEALER_INTERNAL, ['/dealer', '/cotizador', '/prefacturacion']),
]);

function capability(key, functional, moduleKey, featureKey, classification, permission, routes, endpoints) {
  return Object.freeze({
    capability_key: key,
    functional_capability: functional,
    module_key: moduleKey,
    feature_key: featureKey,
    classification,
    required_permission: permission,
    routes,
    backend_endpoints: endpoints,
    iso: classification === CLASSIFICATIONS.ISO_ONLY,
    iso_operational_risk: [CLASSIFICATIONS.ISO_ONLY, CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION].includes(classification),
    grc: [CLASSIFICATIONS.ISO_ONLY, CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION, CLASSIFICATIONS.GRC_ADVANCED].includes(classification),
  });
}

function internalCapability(key, functional, moduleKey, classification, routes) {
  return Object.freeze({
    capability_key: key,
    functional_capability: functional,
    module_key: moduleKey,
    feature_key: key,
    classification,
    required_permission: null,
    routes,
    backend_endpoints: [],
    iso: false,
    iso_operational_risk: false,
    grc: false,
  });
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePlanKey(planKey) {
  const value = normalizeKey(planKey);
  if (['iso', 'pyme'].includes(value)) return PLAN_KEYS.ISO;
  if (['iso_operational_risk', 'iso_riesgo_operativo', 'iso_riesgo_operacional', 'empresa'].includes(value)) return PLAN_KEYS.ISO_RISK;
  if (['grc', 'enterprise'].includes(value)) return PLAN_KEYS.GRC;
  return value;
}

function planAllowsCapability(planKey, capabilityKey) {
  const plan = normalizePlanKey(planKey);
  const row = CAPABILITIES.find((item) => item.capability_key === normalizeKey(capabilityKey));
  if (!row) return false;
  if (plan === PLAN_KEYS.ISO) return row.iso;
  if (plan === PLAN_KEYS.ISO_RISK) return row.iso_operational_risk;
  if (plan === PLAN_KEYS.GRC) return row.grc;
  return false;
}

function capabilitiesForPlan(planKey) {
  const plan = normalizePlanKey(planKey);
  return CAPABILITIES.filter((row) => planAllowsCapability(plan, row.capability_key));
}

function classifyCapability(capabilityKey) {
  const key = normalizeKey(capabilityKey);
  return (
    CAPABILITIES.find((row) => row.capability_key === key) ||
    INTERNAL_ROUTE_CAPABILITIES.find((row) => row.capability_key === key) ||
    null
  );
}

function evaluatePlanCapabilityAccess({
  planKey,
  capabilityKey,
  hasPermission = true,
  moduleActive = true,
  subscriptionStatus = 'active',
  tenantStatus = 'active',
  scopeAllowed = true,
} = {}) {
  const key = normalizeKey(capabilityKey);
  const row = classifyCapability(key);

  if (!row || !row.grc) {
    return deny(key, 'CAPABILITY_NOT_COMMERCIAL');
  }
  if (!ACTIVE_TENANT_STATUSES.has(normalizeKey(tenantStatus))) {
    return deny(key, 'TENANT_NOT_ACTIVE');
  }
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(normalizeKey(subscriptionStatus))) {
    return deny(key, 'SUBSCRIPTION_INACTIVE');
  }
  if (!planAllowsCapability(planKey, key)) {
    return deny(key, 'CAPABILITY_NOT_INCLUDED_IN_PLAN');
  }
  if (moduleActive !== true) {
    return deny(key, 'MODULE_NOT_ACTIVE');
  }
  if (hasPermission !== true) {
    return deny(key, 'RBAC_PERMISSION_REQUIRED');
  }
  if (scopeAllowed !== true) {
    return deny(key, 'SCOPE_FORBIDDEN');
  }

  return {
    capability_key: key,
    decision: 'allowed',
    enabled: true,
    reason_code: 'ENTITLED',
  };
}

function deny(capabilityKey, reasonCode) {
  return {
    capability_key: capabilityKey,
    decision: 'denied',
    enabled: false,
    reason_code: reasonCode,
  };
}

function classificationSummary() {
  const all = [...CAPABILITIES, ...INTERNAL_ROUTE_CAPABILITIES];
  return all.reduce((acc, row) => {
    acc[row.classification] = acc[row.classification] || [];
    acc[row.classification].push(row.capability_key);
    return acc;
  }, {});
}

module.exports = {
  PLAN_KEYS,
  CLASSIFICATIONS,
  COMMERCIAL_PLAN_CAPABILITIES: CAPABILITIES,
  INTERNAL_ROUTE_CAPABILITIES,
  normalizePlanKey,
  planAllowsCapability,
  capabilitiesForPlan,
  classifyCapability,
  evaluatePlanCapabilityAccess,
  classificationSummary,
};
