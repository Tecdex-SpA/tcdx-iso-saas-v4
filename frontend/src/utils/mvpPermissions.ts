export type MvpRoleGroup =
  | 'platform'
  | 'dealer'
  | 'admin'
  | 'auditor'
  | 'area_owner'
  | 'executive'
  | 'unknown';

export type MvpFeatureKey =
  | 'dashboard.read'
  | 'compliance.read'
  | 'health.view'
  | 'health.refresh'
  | 'compliance.functional_subflows.read'
  | 'compliance.write'
  | 'compliance.lifecycle.read'
  | 'compliance.lifecycle.request_progress'
  | 'compliance.lifecycle.approve'
  | 'evidences.read'
  | 'evidences.upload'
  | 'evidence_library.read'
  | 'evidence_library.manage_sources'
  | 'evidence_library.upload'
  | 'evidence_library.index'
  | 'evidence_library.discard_index'
  | 'evidence_library.associate'
  | 'semantic_evidence.process'
  | 'semantic_evidence.review_suggestion'
  | 'semantic_evidence.accept_suggestion'
  | 'semantic_evidence.reject_suggestion'
  | 'risks.read'
  | 'risks.functional_subflows.read'
  | 'risks.write'
  | 'action_plans.read'
  | 'action_plans.functional_subflows.read'
  | 'action_plans.write'
  | 'reports.read'
  | 'reports.export'
  | 'phase2.read'
  | 'phase3.read'
  | 'phase5.read'
  | 'ai_compliance.read'
  | 'ai_compliance.suggest'
  | 'configuration.profile.self'
  | 'configuration.users.manage'
  | 'configuration.company_profile.manage'
  | 'config.companyProfile.view'
  | 'config.companyProfile.update'
  | 'config.processes.view'
  | 'config.processes.create'
  | 'config.processes.update'
  | 'config.processes.toggleStatus'
  | 'config.operations.view'
  | 'config.operations.create'
  | 'config.operations.update'
  | 'config.operations.toggleStatus'
  | 'tenant_process_links.read'
  | 'tenant_process_links.create'
  | 'tenant_process_links.update'
  | 'tenant_process_links.deactivate'
  | 'tenant_process_links.reactivate'
  | 'admin_saas.internal'
  | 'dealer.console';

export type MvpNavItem = {
  href: string;
  label: string;
  feature: MvpFeatureKey;
  moduleKey?: string;
};

export const PLATFORM_ROLES = [
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
];

export const ADMIN_ROLES = ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin'];
export const AUDITOR_ROLES = ['auditor'];
export const AREA_OWNER_ROLES = ['operativo', 'responsable_area', 'area_owner'];
export const EXECUTIVE_ROLES = [
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
  'ejecutivo',
];

export function normalizeMvpRole(role?: string | null) {
  return String(role || '').toLowerCase().trim();
}

export function getMvpRoleGroup(role?: string | null): MvpRoleGroup {
  const normalized = normalizeMvpRole(role);

  if (PLATFORM_ROLES.includes(normalized)) return 'platform';
  if (normalized === 'dealer') return 'dealer';
  if (ADMIN_ROLES.includes(normalized)) return 'admin';
  if (AUDITOR_ROLES.includes(normalized)) return 'auditor';
  if (AREA_OWNER_ROLES.includes(normalized)) return 'area_owner';
  if (EXECUTIVE_ROLES.includes(normalized)) return 'executive';

  return 'unknown';
}

const FEATURE_ACCESS: Record<MvpFeatureKey, MvpRoleGroup[]> = {
  'dashboard.read': ['admin', 'area_owner', 'executive'],
  'compliance.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'health.view': ['admin', 'auditor', 'area_owner', 'executive'],
  'health.refresh': ['admin'],
  'compliance.functional_subflows.read': ['admin', 'auditor', 'area_owner'],
  'compliance.write': ['admin'],
  'compliance.lifecycle.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'compliance.lifecycle.request_progress': ['admin'],
  'compliance.lifecycle.approve': ['auditor'],
  'evidences.read': ['admin', 'auditor', 'area_owner'],
  'evidences.upload': ['admin', 'area_owner'],
  'evidence_library.read': ['admin', 'auditor', 'area_owner'],
  'evidence_library.manage_sources': ['admin'],
  'evidence_library.upload': ['admin'],
  'evidence_library.index': ['admin'],
  'evidence_library.discard_index': ['admin'],
  'evidence_library.associate': ['admin'],
  'semantic_evidence.process': ['admin'],
  'semantic_evidence.review_suggestion': ['admin', 'auditor'],
  'semantic_evidence.accept_suggestion': ['admin'],
  'semantic_evidence.reject_suggestion': ['admin'],
  'risks.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'risks.functional_subflows.read': ['admin', 'auditor', 'area_owner'],
  'risks.write': ['admin', 'area_owner'],
  'action_plans.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'action_plans.functional_subflows.read': ['admin', 'auditor', 'area_owner'],
  'action_plans.write': ['admin', 'area_owner'],
  'reports.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'reports.export': ['admin', 'auditor'],
  'phase2.read': ['admin', 'auditor', 'area_owner'],
  'phase3.read': ['admin', 'auditor', 'area_owner'],
  'phase5.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'ai_compliance.read': ['admin', 'auditor'],
  'ai_compliance.suggest': ['admin', 'auditor'],
  'configuration.profile.self': ['admin', 'auditor', 'area_owner', 'executive'],
  'configuration.users.manage': ['admin'],
  'configuration.company_profile.manage': ['admin'],
  'config.companyProfile.view': ['admin'],
  'config.companyProfile.update': ['admin'],
  'config.processes.view': ['admin'],
  'config.processes.create': ['admin'],
  'config.processes.update': ['admin'],
  'config.processes.toggleStatus': ['admin'],
  'config.operations.view': ['admin'],
  'config.operations.create': ['admin'],
  'config.operations.update': ['admin'],
  'config.operations.toggleStatus': ['admin'],
  'tenant_process_links.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'tenant_process_links.create': ['admin'],
  'tenant_process_links.update': ['admin'],
  'tenant_process_links.deactivate': ['admin'],
  'tenant_process_links.reactivate': ['admin'],
  'admin_saas.internal': ['platform'],
  'dealer.console': ['dealer'],
};

export function canAccessMvpFeature(
  role?: string | null,
  feature?: MvpFeatureKey | null
) {
  if (!feature) return false;

  const group = getMvpRoleGroup(role);

  if (group === 'platform') {
    return feature === 'admin_saas.internal';
  }

  if (group === 'dealer') {
    return feature === 'dealer.console';
  }

  return FEATURE_ACCESS[feature]?.includes(group) || false;
}

export const CLIENT_MVP_NAV_ITEMS: MvpNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', feature: 'dashboard.read' },
  {
    href: '/cumplimiento-auditoria',
    label: 'Cumplimiento y Auditoría',
    feature: 'compliance.read',
  },
  {
    href: '/evidencias',
    label: 'Evidencias',
    feature: 'evidences.read',
    moduleKey: 'evidences',
  },
  { href: '/riesgos', label: 'Riesgos', feature: 'risks.read', moduleKey: 'risks' },
  { href: '/planes-accion', label: 'Planes de acción', feature: 'action_plans.read' },
  { href: '/exportes', label: 'Reportes', feature: 'reports.read' },
  {
    href: '/grc-global',
    label: 'GRC integrado',
    feature: 'phase2.read',
    moduleKey: 'grc_phase2_integrated',
  },
  {
    href: '/operaciones-grc',
    label: 'Operación GRC',
    feature: 'phase3.read',
    moduleKey: 'grc_phase3_operations',
  },
  {
    href: '/grc',
    label: 'Portal GRC',
    feature: 'phase5.read',
    moduleKey: 'data_governance',
  },
  {
    href: '/datos',
    label: 'Datos',
    feature: 'phase5.read',
    moduleKey: 'data_governance',
  },
  {
    href: '/metricas',
    label: 'Métricas',
    feature: 'phase5.read',
    moduleKey: 'metrics_bi',
  },
  {
    href: '/encuestas',
    label: 'Encuestas',
    feature: 'phase5.read',
    moduleKey: 'surveys_assessments',
  },
  {
    href: '/tests',
    label: 'Tests',
    feature: 'phase5.read',
    moduleKey: 'assurance_loss',
  },
  {
    href: '/eventos-perdida',
    label: 'Eventos de pérdida',
    feature: 'phase5.read',
    moduleKey: 'assurance_loss',
  },
  {
    href: '/bi',
    label: 'Business Intelligence',
    feature: 'phase5.read',
    moduleKey: 'metrics_bi',
  },
  {
    href: '/reportes/studio',
    label: 'Report Studio',
    feature: 'phase5.read',
    moduleKey: 'report_studio',
  },
  {
    href: '/ia-compliance',
    label: 'IA Compliance',
    feature: 'ai_compliance.read',
    moduleKey: 'ai',
  },
  { href: '/configuracion', label: 'Configuración', feature: 'configuration.users.manage' },
];

export const COMPLIANCE_FUNCTIONAL_MVP_SUBFLOW_ROUTES = [
  '/diagnostico',
  '/iso-health',
  '/health',
  '/administrar-kpis',
  '/controles',
  '/soa',
  '/ciclo-vida',
  '/auditorias',
  '/hallazgos',
  '/no-conformidades',
];

export const RISKS_FUNCTIONAL_MVP_SUBFLOW_ROUTES = [
  '/matriz-riesgo',
  '/activos',
];

export const ACTION_PLANS_FUNCTIONAL_MVP_SUBFLOW_ROUTES = [
  '/plan-accion',
  '/acciones-recomendadas',
];

export const FUNCTIONAL_MVP_SUBFLOW_ROUTES = [
  ...COMPLIANCE_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
  ...RISKS_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
  ...ACTION_PLANS_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
];

type MvpRouteRule = {
  routes: string[];
  feature: MvpFeatureKey;
  moduleKey?: string;
  exactOnlyFor?: string[];
  fallback?: string;
};

export const MVP_ROUTE_RULES: MvpRouteRule[] = [
  { routes: ['/dashboard'], feature: 'dashboard.read' },
  {
    routes: [
      '/grc-global',
      '/privacidad',
      '/incidentes',
      '/proveedores',
      '/conectores',
    ],
    feature: 'phase2.read',
    moduleKey: 'grc_phase2_integrated',
  },
  { routes: ['/cumplimiento-auditoria'], feature: 'compliance.read' },
  {
    routes: [
      '/operaciones-grc',
      '/importaciones',
      '/unidades',
      '/procesos',
      '/servicios',
      '/bia',
      '/continuidad',
      '/crisis',
      '/indicadores',
      '/riesgo-cuantitativo',
    ],
    feature: 'phase3.read',
    moduleKey: 'grc_phase3_operations',
  },
  { routes: ['/iso-health', '/health'], feature: 'health.view', moduleKey: 'health' },
  { routes: ['/administrar-kpis'], feature: 'health.view', moduleKey: 'health' },
  {
    routes: COMPLIANCE_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
    feature: 'compliance.functional_subflows.read',
  },
  { routes: ['/evidencias'], feature: 'evidences.read', moduleKey: 'evidences' },
  { routes: ['/riesgos'], feature: 'risks.read', moduleKey: 'risks' },
  {
    routes: RISKS_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
    feature: 'risks.functional_subflows.read',
    moduleKey: 'risks',
  },
  { routes: ['/planes-accion'], feature: 'action_plans.read' },
  {
    routes: ACTION_PLANS_FUNCTIONAL_MVP_SUBFLOW_ROUTES,
    feature: 'action_plans.functional_subflows.read',
  },
  { routes: ['/exportes'], feature: 'reports.read' },
  {
    routes: ['/grc', '/datos'],
    feature: 'phase5.read',
    moduleKey: 'data_governance',
  },
  {
    routes: ['/metricas', '/bi'],
    feature: 'phase5.read',
    moduleKey: 'metrics_bi',
  },
  {
    routes: ['/encuestas', '/evaluaciones'],
    feature: 'phase5.read',
    moduleKey: 'surveys_assessments',
  },
  {
    routes: ['/tests', '/eventos-perdida'],
    feature: 'phase5.read',
    moduleKey: 'assurance_loss',
  },
  {
    routes: ['/reportes'],
    feature: 'phase5.read',
    moduleKey: 'report_studio',
  },
  { routes: ['/ia-compliance'], feature: 'ai_compliance.read', moduleKey: 'ai' },
  { routes: ['/perfil'], feature: 'configuration.profile.self' },
  { routes: ['/configuracion', '/usuarios', '/perfil-empresa'], feature: 'configuration.users.manage' },
];

export const INTERNAL_CLIENT_HIDDEN_ROUTES = [
  '/administrar-kpis',
  '/acciones-recomendadas',
  '/activos',
  '/auditorias',
  '/auditorias/ejecucion',
  '/controles',
  '/dashboard-v2',
  '/diagnostico',
  '/documentos',
  '/ejecucion-iso',
  '/hallazgos',
  '/health',
  '/iso-health',
  '/ia',
  '/ia-auditor',
  '/auditorias/ia',
  '/matriz-riesgo',
  '/no-conformidades',
  '/plan-accion',
  '/soa',
  '/ciclo-vida',
];

export const PLATFORM_ROUTES = ['/admin-saas', '/empresas'];
export const DEALER_ROUTES = ['/dealer', '/cotizador', '/prefacturacion'];

export function isPathInRoutes(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getMvpRouteRule(pathname: string) {
  return MVP_ROUTE_RULES.find((rule) => isPathInRoutes(pathname, rule.routes)) || null;
}

export function getMvpHomePathByRole(role?: string | null) {
  const group = getMvpRoleGroup(role);

  if (group === 'platform') return '/admin-saas';
  if (group === 'dealer') return '/dealer';
  if (group === 'auditor') return '/cumplimiento-auditoria';

  return '/dashboard';
}
