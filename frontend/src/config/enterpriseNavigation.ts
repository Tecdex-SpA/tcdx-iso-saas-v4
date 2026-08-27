import { isPathInRoutes, type MvpFeatureKey, type MvpNavItem } from '@/utils/mvpPermissions';

export type EnterpriseNavItem = MvpNavItem & {
  labelKey?: string;
  routes?: string[];
};

export type EnterpriseNavDomain = {
  id:
    | 'home'
    | 'compliance'
    | 'risk-control'
    | 'audit-improvement'
    | 'operations-resilience'
    | 'data-evidence'
    | 'intelligence'
    | 'reports'
    | 'administration';
  href: string;
  label: string;
  labelKey: string;
  feature: MvpFeatureKey;
  moduleKey?: string;
  routes: string[];
  items: EnterpriseNavItem[];
};

export const CLIENT_ENTERPRISE_NAV_DOMAINS: EnterpriseNavDomain[] = [
  {
    id: 'home',
    href: '/dashboard',
    label: 'Inicio',
    labelKey: 'navigation.domains.home',
    feature: 'dashboard.read',
    routes: ['/dashboard', '/grc-global'],
    items: [
      { href: '/dashboard', label: 'Centro ejecutivo', labelKey: 'navigation.destinations.executiveCenter', feature: 'dashboard.read' },
      { href: '/grc-global', label: 'Portfolio GRC', labelKey: 'navigation.destinations.grcPortfolio', feature: 'phase2.read', moduleKey: 'grc_phase2_integrated' },
    ],
  },
  {
    id: 'compliance',
    href: '/cumplimiento-auditoria',
    label: 'Cumplimiento',
    labelKey: 'navigation.domains.compliance',
    feature: 'compliance.read',
    routes: ['/cumplimiento-auditoria', '/diagnostico', '/iso-health', '/health', '/soa', '/ciclo-vida', '/ejecucion-iso'],
    items: [
      { href: '/cumplimiento-auditoria', label: 'Overview ISO', labelKey: 'navigation.destinations.isoOverview', feature: 'compliance.read' },
      { href: '/diagnostico', label: 'Diagnóstico', labelKey: 'navigation.destinations.diagnosis', feature: 'compliance.functional_subflows.read' },
      { href: '/iso-health', label: 'Salud ISO', labelKey: 'navigation.destinations.isoHealth', feature: 'health.view', moduleKey: 'health' },
      { href: '/soa', label: 'SoA', labelKey: 'navigation.destinations.soa', feature: 'compliance.functional_subflows.read' },
      { href: '/ciclo-vida', label: 'Ciclo de vida', labelKey: 'navigation.destinations.lifecycle', feature: 'compliance.lifecycle.read' },
    ],
  },
  {
    id: 'risk-control',
    href: '/riesgos',
    label: 'Riesgo y Control',
    labelKey: 'navigation.domains.riskControl',
    feature: 'risks.read',
    moduleKey: 'risks',
    routes: ['/riesgos', '/matriz-riesgo', '/activos', '/controles', '/riesgo-cuantitativo'],
    items: [
      { href: '/riesgos', label: 'Registro de riesgos', labelKey: 'navigation.destinations.riskRegister', feature: 'risks.read', moduleKey: 'risks' },
      { href: '/matriz-riesgo', label: 'Matriz de riesgo', labelKey: 'navigation.destinations.riskMatrix', feature: 'risks.functional_subflows.read', moduleKey: 'risks' },
      { href: '/controles', label: 'Controles', labelKey: 'navigation.destinations.controls', feature: 'compliance.functional_subflows.read' },
      { href: '/activos', label: 'Activos', labelKey: 'navigation.destinations.assets', feature: 'risks.functional_subflows.read', moduleKey: 'risks' },
      { href: '/riesgo-cuantitativo', label: 'Cuantitativo', labelKey: 'navigation.destinations.quantitativeRisk', feature: 'phase3.read', moduleKey: 'grc_phase3_operations' },
    ],
  },
  {
    id: 'audit-improvement',
    href: '/planes-accion',
    label: 'Auditoría y Mejora',
    labelKey: 'navigation.domains.auditImprovement',
    feature: 'action_plans.read',
    routes: ['/auditorias', '/auditorias/ejecucion', '/auditorias/ia', '/hallazgos', '/no-conformidades', '/planes-accion', '/plan-accion', '/acciones-recomendadas'],
    items: [
      { href: '/planes-accion', label: 'Planes de acción', labelKey: 'navigation.destinations.actionPlans', feature: 'action_plans.read' },
      { href: '/auditorias', label: 'Auditorías', labelKey: 'navigation.destinations.audits', feature: 'compliance.functional_subflows.read' },
      { href: '/hallazgos', label: 'Hallazgos', labelKey: 'navigation.destinations.findings', feature: 'compliance.functional_subflows.read' },
      { href: '/no-conformidades', label: 'No conformidades', labelKey: 'navigation.destinations.nonconformities', feature: 'compliance.functional_subflows.read' },
      { href: '/acciones-recomendadas', label: 'Recomendaciones', labelKey: 'navigation.destinations.recommendations', feature: 'action_plans.functional_subflows.read' },
    ],
  },
  {
    id: 'operations-resilience',
    href: '/operaciones-grc',
    label: 'Operación y Resiliencia',
    labelKey: 'navigation.domains.operationsResilience',
    feature: 'phase3.read',
    moduleKey: 'grc_phase3_operations',
    routes: ['/operaciones-grc', '/operaciones-grc/activacion', '/operaciones-grc/importar', '/procesos', '/servicios', '/unidades', '/bia', '/continuidad', '/crisis', '/incidentes', '/eventos-perdida', '/proveedores', '/portal-proveedor', '/privacidad'],
    items: [
      { href: '/operaciones-grc', label: 'Riesgo Operativo', labelKey: 'navigation.destinations.grcOperations', feature: 'phase3.read', moduleKey: 'grc_phase3_operations' },
      { href: '/continuidad', label: 'Continuidad', labelKey: 'navigation.destinations.continuity', feature: 'phase3.read', moduleKey: 'grc_phase3_operations' },
      { href: '/incidentes', label: 'Incidentes', labelKey: 'navigation.destinations.incidents', feature: 'phase2.read', moduleKey: 'grc_phase2_integrated' },
      { href: '/proveedores', label: 'Proveedores', labelKey: 'navigation.destinations.suppliers', feature: 'phase2.read', moduleKey: 'grc_phase2_integrated' },
      { href: '/privacidad', label: 'Privacidad', labelKey: 'navigation.destinations.privacy', feature: 'phase2.read', moduleKey: 'grc_phase2_integrated' },
    ],
  },
  {
    id: 'data-evidence',
    href: '/evidencias',
    label: 'Datos y Evidencia',
    labelKey: 'navigation.domains.dataEvidence',
    feature: 'evidences.read',
    moduleKey: 'evidences',
    routes: ['/evidencias', '/datos', '/datos/calidad', '/datos/catalogo', '/datos/lineage', '/datos/semantica', '/importaciones', '/documentos'],
    items: [
      { href: '/evidencias', label: 'Evidencias', labelKey: 'navigation.destinations.evidence', feature: 'evidences.read', moduleKey: 'evidences' },
      { href: '/datos', label: 'Datos', labelKey: 'navigation.destinations.data', feature: 'phase5.read', moduleKey: 'data_governance' },
      { href: '/datos/calidad', label: 'Calidad', labelKey: 'navigation.destinations.dataQuality', feature: 'phase5.read', moduleKey: 'data_governance' },
      { href: '/datos/lineage', label: 'Lineage', labelKey: 'navigation.destinations.lineage', feature: 'phase5.read', moduleKey: 'data_governance' },
      { href: '/importaciones', label: 'Importaciones', labelKey: 'navigation.destinations.imports', feature: 'phase3.read', moduleKey: 'grc_phase3_operations' },
    ],
  },
  {
    id: 'intelligence',
    href: '/metricas',
    label: 'Inteligencia',
    labelKey: 'navigation.domains.intelligence',
    feature: 'phase5.read',
    moduleKey: 'metrics_bi',
    routes: ['/metricas', '/indicadores', '/grc', '/encuestas', '/evaluaciones', '/tests', '/ia', '/ia-compliance', '/ia-compliance/sugerencias', '/ia-auditor'],
    items: [
      { href: '/metricas', label: 'Métricas', labelKey: 'navigation.destinations.metrics', feature: 'phase5.read', moduleKey: 'metrics_bi' },
      { href: '/indicadores', label: 'Indicadores', labelKey: 'navigation.destinations.indicators', feature: 'phase3.read', moduleKey: 'grc_phase3_operations' },
      { href: '/grc', label: 'Análisis GRC', labelKey: 'navigation.destinations.grcAnalysis', feature: 'phase5.read', moduleKey: 'data_governance' },
      { href: '/encuestas', label: 'Encuestas', labelKey: 'navigation.destinations.surveys', feature: 'phase5.read', moduleKey: 'surveys_assessments' },
      { href: '/ia-compliance', label: 'IA Compliance', labelKey: 'navigation.destinations.aiCompliance', feature: 'ai_compliance.read', moduleKey: 'ai' },
    ],
  },
  {
    id: 'reports',
    href: '/exportes',
    label: 'Reportes',
    labelKey: 'navigation.domains.reports',
    feature: 'reports.read',
    routes: ['/exportes', '/bi', '/reportes/studio', '/reportes/generaciones'],
    items: [
      { href: '/exportes', label: 'Exportes', labelKey: 'navigation.destinations.exports', feature: 'reports.read' },
      { href: '/bi', label: 'Analítica', labelKey: 'navigation.destinations.bi', feature: 'phase5.read', moduleKey: 'metrics_bi' },
      { href: '/reportes/studio', label: 'Diseñador de reportes', labelKey: 'navigation.destinations.reportStudio', feature: 'phase5.read', moduleKey: 'report_studio' },
      { href: '/reportes/generaciones', label: 'Generaciones', labelKey: 'navigation.destinations.reportGenerations', feature: 'phase5.read', moduleKey: 'report_studio' },
    ],
  },
  {
    id: 'administration',
    href: '/configuracion',
    label: 'Administración',
    labelKey: 'navigation.domains.administration',
    feature: 'configuration.users.manage',
    routes: ['/configuracion', '/usuarios', '/perfil-empresa', '/perfil', '/conectores'],
    items: [
      { href: '/configuracion', label: 'Configuración', labelKey: 'navigation.destinations.settings', feature: 'configuration.users.manage' },
      { href: '/usuarios', label: 'Usuarios', labelKey: 'navigation.destinations.users', feature: 'configuration.users.manage' },
      { href: '/perfil-empresa', label: 'Perfil empresa', labelKey: 'navigation.destinations.companyProfile', feature: 'configuration.company_profile.manage' },
      { href: '/conectores', label: 'Conectores', labelKey: 'navigation.destinations.connectors', feature: 'phase2.read', moduleKey: 'grc_phase2_integrated' },
    ],
  },
];

export function getEnterpriseNavigationContext(pathname: string) {
  const domain =
    CLIENT_ENTERPRISE_NAV_DOMAINS.find((item) =>
      isPathInRoutes(pathname, item.routes)
    ) || null;

  if (!domain) {
    return {
      domain: null,
      item: null,
    };
  }

  const item =
    domain.items.find((entry) =>
      isPathInRoutes(pathname, entry.routes || [entry.href])
    ) || null;

  return {
    domain,
    item,
  };
}
