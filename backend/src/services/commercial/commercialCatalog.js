const {
  COMMERCIAL_PLAN_CAPABILITIES,
} = require('./commercialPlanMatrix.service');

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

const INITIAL_CAPABILITIES = COMMERCIAL_PLAN_CAPABILITIES.map((capability) => [
  capability.capability_key,
  capability.capability_key,
  capability.functional_capability,
]);

const MODULE_DESCRIPTIONS = {
  core: ['Core ISO', 'Dashboard base y reportes/exportes ISO'],
  iso: ['Gestion ISO', 'Cumplimiento, diagnostico, controles, auditorias, hallazgos y acciones ISO'],
  risks: ['Riesgo ISO', 'Riesgos y matriz de riesgo ISO'],
  evidences: ['Evidencias ISO', 'Evidencias y documentos normativos ISO'],
  health: ['Health ISO', 'Estado y KPIs minimos de gestion ISO'],
  operations_grc: ['Riesgo Operativo', 'Procesos, unidades, servicios, BIA, continuidad y crisis'],
  risk_manager: ['Riesgo Operativo cuantitativo', 'Riesgo cuantitativo y metodologia operacional'],
  operational_losses: ['Eventos de perdida', 'Eventos de perdida operacional'],
  grc_core: ['GRC transversal', 'Workflow GRC, readiness y auditoria avanzada'],
  integrated_grc: ['GRC integrado', 'Privacidad, incidentes, proveedores, TPRM y conectores'],
  data_governance: ['Gobierno de datos', 'Gobierno, calidad, catalogo, lineage y semantica de datos'],
  metrics_bi: ['Metricas y BI', 'Metricas avanzadas, indicadores oficiales y BI'],
  surveys_assessments: ['Encuestas y evaluaciones', 'Encuestas y evaluaciones GRC'],
  assurance_loss: ['Assurance avanzado', 'Assurance GRC avanzado'],
  report_studio: ['Report Studio', 'Reportes avanzados y generaciones'],
  premium_reports: ['Reportes Premium', 'Reportes premium y exportaciones ejecutivas'],
  audit_workpapers: ['Papeles de trabajo', 'Papeles de trabajo avanzados de auditoria'],
  ai_compliance: ['IA Compliance', 'IA Compliance e IA Auditor'],
};

const INITIAL_MODULES = [...COMMERCIAL_PLAN_CAPABILITIES.reduce((acc, capability) => {
  const current = acc.get(capability.module_key) || [];
  current.push(capability.capability_key);
  acc.set(capability.module_key, current);
  return acc;
}, new Map()).entries()]
  .map(([moduleKey, capabilityKeys], index) => {
    const [displayName, description] = MODULE_DESCRIPTIONS[moduleKey] || [moduleKey, moduleKey];
    return [moduleKey, displayName, description, (index + 1) * 10, capabilityKeys];
  });

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
