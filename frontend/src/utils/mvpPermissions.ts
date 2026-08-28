export type MvpRoleGroup =
  | 'platform'
  | 'dealer'
  | 'admin'
  | 'auditor'
  | 'area_owner'
  | 'executive'
  | 'unknown';

export type MvpRoleClassification =
  | 'CANONICAL_ROLE'
  | 'EXACT_ALIAS'
  | 'COMPATIBILITY_MAPPING'
  | 'DEPRECATED_LEGACY_ROLE'
  | 'UNKNOWN_REQUIRES_DECISION';

export type MvpRoleCompatibility = {
  rawRole: string | null;
  normalizedRole: string;
  canonicalRole: MvpRoleGroup;
  effectiveRole: string | null;
  classification: MvpRoleClassification;
  privilegePreservation: 'DIRECT' | 'PRESERVE_LEGACY_EFFECTIVE_ROLE' | 'NO_ALIAS_APPLIED';
};

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

export const CAPABILITY_BY_PATH: Record<string, string> = {
  '/dashboard': 'core.dashboard',
  '/cumplimiento-auditoria': 'iso.compliance',
  '/diagnostico': 'iso.compliance',
  '/controles': 'iso.compliance',
  '/soa': 'iso.compliance',
  '/ciclo-vida': 'iso.compliance',
  '/auditorias/ejecucion': 'iso.compliance',
  '/auditorias/ia': 'ai.auditor',
  '/auditorias': 'iso.compliance',
  '/ejecucion-iso': 'iso.compliance',
  '/hallazgos': 'iso.compliance',
  '/no-conformidades': 'iso.compliance',
  '/evidencias': 'evidence.library',
  '/documentos': 'evidence.library',
  '/riesgo-cuantitativo': 'risk.quantitative',
  '/riesgos': 'iso.risk',
  '/matriz-riesgo': 'iso.risk',
  '/activos': 'iso.risk',
  '/planes-accion': 'iso.actions',
  '/plan-accion': 'iso.actions',
  '/acciones-recomendadas': 'iso.actions',
  '/iso-health': 'iso.health',
  '/health': 'iso.health',
  '/administrar-kpis': 'iso.health',
  '/exportes': 'core.reports',
  '/grc-global': 'grc.phase2',
  '/privacidad': 'grc.phase2',
  '/incidentes': 'grc.phase2',
  '/proveedores': 'tprm.suppliers',
  '/portal-proveedor': 'tprm.suppliers',
  '/conectores': 'grc.phase2',
  '/operaciones-grc/importar': 'imports.excel',
  '/operaciones-grc': 'grc.phase3',
  '/importaciones': 'imports.excel',
  '/unidades': 'grc.phase3',
  '/procesos': 'grc.phase3',
  '/servicios': 'grc.phase3',
  '/bia': 'grc.phase3',
  '/continuidad': 'grc.phase3',
  '/crisis': 'grc.phase3',
  '/indicadores': 'grc.phase3',
  '/grc': 'data.governance',
  '/datos/calidad': 'metrics.data_trust',
  '/datos/lineage': 'data.lineage',
  '/datos/semantica': 'data.semantic_layer',
  '/datos/catalogo': 'data.governance',
  '/datos': 'data.governance',
  '/metricas/constructor': 'metrics.catalog',
  '/metricas': 'metrics.catalog',
  '/reportes/studio': 'reporting.studio',
  '/reportes/generaciones': 'reporting.studio',
  '/bi/dashboards': 'bi.dashboard_builder',
  '/bi': 'bi.executive_dashboards',
  '/encuestas': 'surveys.engine',
  '/evaluaciones': 'surveys.engine',
  '/tests': 'assurance.testing',
  '/eventos-perdida': 'loss.events',
  '/ia-auditor': 'ai.auditor',
  '/ia': 'ai.compliance',
  '/ia-compliance': 'ai.compliance',
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
export const AREA_OWNER_ROLES = ['operativo', 'responsable_area', 'area_owner', 'control_owner'];
export const EXECUTIVE_ROLES = [
  'executive',
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
  'ejecutivo',
];

const ROLE_COMPATIBILITY: Record<string, Omit<MvpRoleCompatibility, 'rawRole' | 'normalizedRole'>> = {
  platform_admin: { canonicalRole: 'platform', effectiveRole: 'platform_admin', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  tenant_admin: { canonicalRole: 'admin', effectiveRole: 'tenant_admin', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  auditor: { canonicalRole: 'auditor', effectiveRole: 'auditor', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  area_owner: { canonicalRole: 'area_owner', effectiveRole: 'area_owner', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  executive: { canonicalRole: 'executive', effectiveRole: 'executive', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  dealer: { canonicalRole: 'dealer', effectiveRole: 'dealer', classification: 'CANONICAL_ROLE', privilegePreservation: 'DIRECT' },
  super_admin: { canonicalRole: 'platform', effectiveRole: 'super_admin', classification: 'EXACT_ALIAS', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  global_admin: { canonicalRole: 'platform', effectiveRole: 'global_admin', classification: 'EXACT_ALIAS', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  admin_global: { canonicalRole: 'platform', effectiveRole: 'admin_global', classification: 'EXACT_ALIAS', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  superadmin: { canonicalRole: 'platform', effectiveRole: 'superadmin', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  owner: { canonicalRole: 'platform', effectiveRole: 'owner', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  admin: { canonicalRole: 'admin', effectiveRole: 'admin', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  admin_cumplimiento: { canonicalRole: 'admin', effectiveRole: 'admin_cumplimiento', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  compliance_admin: { canonicalRole: 'admin', effectiveRole: 'compliance_admin', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  compliance_manager: { canonicalRole: 'admin', effectiveRole: 'compliance_manager', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  operativo: { canonicalRole: 'area_owner', effectiveRole: 'operativo', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  responsable_area: { canonicalRole: 'area_owner', effectiveRole: 'responsable_area', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  control_owner: { canonicalRole: 'area_owner', effectiveRole: 'control_owner', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  viewer: { canonicalRole: 'executive', effectiveRole: 'viewer', classification: 'DEPRECATED_LEGACY_ROLE', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  cliente: { canonicalRole: 'executive', effectiveRole: 'cliente', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  client: { canonicalRole: 'executive', effectiveRole: 'client', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  read_only: { canonicalRole: 'executive', effectiveRole: 'read_only', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  readonly: { canonicalRole: 'executive', effectiveRole: 'readonly', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  solo_lectura: { canonicalRole: 'executive', effectiveRole: 'solo_lectura', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
  ejecutivo: { canonicalRole: 'executive', effectiveRole: 'ejecutivo', classification: 'COMPATIBILITY_MAPPING', privilegePreservation: 'PRESERVE_LEGACY_EFFECTIVE_ROLE' },
};

export function normalizeMvpRole(role?: string | null) {
  return String(role || '').toLowerCase().trim();
}

export function resolveMvpRoleCompatibility(role?: string | null): MvpRoleCompatibility {
  const normalizedRole = normalizeMvpRole(role);
  const match = ROLE_COMPATIBILITY[normalizedRole];

  if (!match) {
    return {
      rawRole: role || null,
      normalizedRole,
      canonicalRole: 'unknown',
      effectiveRole: normalizedRole || null,
      classification: 'UNKNOWN_REQUIRES_DECISION',
      privilegePreservation: 'NO_ALIAS_APPLIED',
    };
  }

  return {
    rawRole: role || null,
    normalizedRole,
    ...match,
  };
}

export function getMvpRoleGroup(role?: string | null): MvpRoleGroup {
  return resolveMvpRoleCompatibility(role).canonicalRole;
}

function getMvpEffectiveAccessGroup(role?: string | null): MvpRoleGroup {
  const roleModel = resolveMvpRoleCompatibility(role);
  const effectiveRole = roleModel.effectiveRole || roleModel.normalizedRole;

  if (PLATFORM_ROLES.includes(effectiveRole)) return 'platform';
  if (effectiveRole === 'dealer') return 'dealer';
  if (ADMIN_ROLES.includes(effectiveRole)) return 'admin';
  if (AUDITOR_ROLES.includes(effectiveRole)) return 'auditor';
  if (AREA_OWNER_ROLES.includes(effectiveRole)) return 'area_owner';
  if (EXECUTIVE_ROLES.includes(effectiveRole)) return 'executive';
  if (roleModel.classification === 'CANONICAL_ROLE') return roleModel.canonicalRole;
  if (roleModel.classification === 'EXACT_ALIAS') return roleModel.canonicalRole;

  return 'unknown';
}

const FEATURE_ACCESS: Record<MvpFeatureKey, MvpRoleGroup[]> = {
  'dashboard.read': ['admin', 'auditor', 'area_owner', 'executive'],
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

  const group = getMvpEffectiveAccessGroup(role);

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
    moduleKey: 'integrated_grc',
  },
  {
    href: '/operaciones-grc',
    label: 'Riesgo Operativo',
    feature: 'phase3.read',
    moduleKey: 'operations_grc',
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
    label: 'Datos y Analítica',
    feature: 'phase5.read',
    moduleKey: 'metrics_bi',
  },
  {
    href: '/reportes/studio',
    label: 'Diseñador de reportes',
    feature: 'phase5.read',
    moduleKey: 'report_studio',
  },
  {
    href: '/ia-compliance',
    label: 'IA Compliance',
    feature: 'ai_compliance.read',
    moduleKey: 'ai_compliance',
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
    moduleKey: 'integrated_grc',
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
    moduleKey: 'operations_grc',
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
  { routes: ['/ia-compliance'], feature: 'ai_compliance.read', moduleKey: 'ai_compliance' },
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

export function getMvpRouteCapability(pathname: string) {
  const match = Object.entries(CAPABILITY_BY_PATH).find(([route]) =>
    isPathInRoutes(pathname, [route])
  );

  return match?.[1] || null;
}

export function getMvpHomePathByRole(role?: string | null) {
  const group = getMvpRoleGroup(role);

  if (group === 'platform') return '/admin-saas';
  if (group === 'dealer') return '/dealer';
  if (group === 'auditor') return '/cumplimiento-auditoria';

  return '/dashboard';
}
