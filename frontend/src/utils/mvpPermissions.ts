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
  | 'risks.write'
  | 'action_plans.read'
  | 'action_plans.write'
  | 'reports.read'
  | 'reports.export'
  | 'ai_compliance.read'
  | 'ai_compliance.suggest'
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
  'risks.write': ['admin', 'area_owner'],
  'action_plans.read': ['admin', 'auditor', 'area_owner', 'executive'],
  'action_plans.write': ['admin', 'area_owner'],
  'reports.read': ['admin', 'auditor', 'executive'],
  'reports.export': ['admin', 'auditor', 'executive'],
  'ai_compliance.read': ['admin', 'auditor'],
  'ai_compliance.suggest': ['admin', 'auditor'],
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
    href: '/ia-compliance',
    label: 'IA Compliance',
    feature: 'ai_compliance.read',
    moduleKey: 'ai',
  },
  { href: '/configuracion', label: 'Configuración', feature: 'configuration.users.manage' },
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
  { routes: ['/cumplimiento-auditoria'], feature: 'compliance.read' },
  { routes: ['/diagnostico', '/controles', '/soa', '/ciclo-vida', '/auditorias', '/auditorias/ejecucion', '/hallazgos', '/no-conformidades'], feature: 'compliance.read' },
  { routes: ['/evidencias'], feature: 'evidences.read', moduleKey: 'evidences' },
  { routes: ['/riesgos', '/matriz-riesgo', '/activos'], feature: 'risks.read', moduleKey: 'risks' },
  { routes: ['/planes-accion', '/plan-accion', '/acciones-recomendadas'], feature: 'action_plans.read' },
  { routes: ['/exportes'], feature: 'reports.read' },
  { routes: ['/ia-compliance'], feature: 'ai_compliance.read', moduleKey: 'ai' },
  { routes: ['/configuracion', '/usuarios', '/perfil', '/perfil-empresa'], feature: 'configuration.users.manage' },
];

export const INTERNAL_CLIENT_HIDDEN_ROUTES = [
  '/administrar-kpis',
  '/centro-control-iso',
  '/command-center-iso',
  '/dashboard-kpi',
  '/dashboard-v2',
  '/documentos',
  '/ejecucion-iso',
  '/health',
  '/ia',
  '/ia-auditor',
  '/auditorias/ia',
  '/auditor-iso',
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
