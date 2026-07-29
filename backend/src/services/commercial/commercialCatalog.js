const COMMERCIAL_PERMISSIONS = [
  'commercial.catalog.read',
  'commercial.catalog.manage',
  'commercial.plan.read',
  'commercial.plan.manage',
  'commercial.subscription.read',
  'commercial.subscription.manage',
  'commercial.entitlement.read',
  'commercial.entitlement.override',
  'commercial.usage.read',
  'commercial.health.read',
  'commercial.trial.manage',
  'commercial.pack.read',
  'commercial.pack.manage',
  'commercial.pack.install',
  'commercial.methodology.read',
  'commercial.methodology.manage',
  'commercial.workpaper.read',
  'commercial.workpaper.manage',
];

const RESOURCE_KEYS = [
  'active_users',
  'active_standards',
  'premium_modules',
  'evidence_files',
  'storage_bytes',
  'imports_monthly',
  'exports_monthly',
  'ai_requests_monthly',
  'external_lookups_monthly',
  'api_calls_monthly',
];

const INITIAL_CAPABILITIES = [
  ['core.dashboard', 'Dashboard operativo', 'Acceso al resumen operacional del tenant'],
  ['core.reports', 'Reportes operacionales', 'Generacion y descarga de reportes habilitados'],
  ['grc.phase1', 'Nucleo GRC avanzado', 'Workflow, evidencias, auditoria y readiness'],
  ['grc.phase2', 'GRC integrado', 'Privacidad, incidentes, TPRM y conectores controlados'],
  ['grc.phase3', 'Operacion integrada', 'Procesos, servicios, BIA, continuidad e importaciones'],
  ['imports.excel', 'Importacion Excel', 'Motor universal de plantillas, preview, confirmacion y rollback'],
  ['ai.compliance', 'IA Compliance', 'Analisis asistido de cumplimiento con limites de uso'],
  ['reports.premium', 'Reportes Premium', 'Exportacion avanzada PDF y ZIP'],
  ['tprm.suppliers', 'Proveedores y terceros', 'Gestion de proveedores, evaluaciones y evidencias asociadas'],
  ['risk.quantitative', 'Riesgo cuantitativo', 'Escenarios cuantitativos y exposicion financiera'],
  ['methodology.risk', 'Metodologias de riesgo', 'Escalas, matrices y scoring versionado'],
  ['workpapers.audit', 'Papeles de trabajo', 'Plantillas reutilizables para auditoria interna'],
];

const INITIAL_MODULES = [
  ['core', 'Core operativo', 'Base operativa multi-tenant', 10, ['core.dashboard', 'core.reports']],
  ['grc_core', 'GRC central', 'Workflow, evidencias y auditoria', 20, ['grc.phase1']],
  ['integrated_grc', 'GRC integrado', 'Privacidad, incidentes, TPRM y conectores', 30, ['grc.phase2', 'tprm.suppliers']],
  ['operations_grc', 'Operacion GRC', 'Procesos, servicios, BIA y continuidad', 40, ['grc.phase3', 'imports.excel']],
  ['risk_manager', 'Risk Manager', 'Riesgo operacional y cuantitativo', 50, ['risk.quantitative', 'methodology.risk']],
  ['ai_compliance', 'IA Compliance', 'Inteligencia asistida y limites', 60, ['ai.compliance']],
  ['premium_reports', 'Reportes Premium', 'Exportaciones ejecutivas', 70, ['reports.premium']],
  ['audit_workpapers', 'Papeles de trabajo', 'Estructuras reutilizables de auditoria', 80, ['workpapers.audit']],
];

const INITIAL_PACKS = [
  ['implementation_quickstart', 'Acelerador quickstart', 'implementation', 'published', false],
  ['implementation_standard', 'Acelerador standard', 'implementation', 'published', false],
  ['methodology_iso31000_qualitative', 'Metodologia cualitativa ISO 31000', 'methodology', 'published', false],
  ['template_audit_workpapers_base', 'Papeles de trabajo base', 'template', 'published', false],
  ['regulatory_reference_library', 'Biblioteca regulatoria referencial', 'regulatory', 'draft', false],
];

const DEFAULT_LIMITS = RESOURCE_KEYS.map((key) => {
  const defaults = {
    active_users: 25,
    active_standards: 3,
    premium_modules: 6,
    evidence_files: 5000,
    storage_bytes: 10737418240,
    imports_monthly: 25,
    exports_monthly: 50,
    ai_requests_monthly: 500,
    external_lookups_monthly: 250,
    api_calls_monthly: 25000,
  };
  return [key, defaults[key], 0.8, 'block'];
});

module.exports = {
  COMMERCIAL_PERMISSIONS,
  RESOURCE_KEYS,
  INITIAL_CAPABILITIES,
  INITIAL_MODULES,
  INITIAL_PACKS,
  DEFAULT_LIMITS,
};
