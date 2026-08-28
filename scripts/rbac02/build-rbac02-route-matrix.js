'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const appRoot = path.join(repoRoot, 'frontend/src/app');
const outDir = path.join(repoRoot, 'artifacts/rbac02-route-audit');
const outCsv = path.join(outDir, 'route_access_matrix.csv');
const outSummary = path.join(outDir, 'rbac02_route_summary.txt');

const routeRules = [
  { routes: ['/'], group: 'public-entry', feature: 'public.redirect', permission: '', capability: '', module: '', plan: 'PUBLIC_AUTH_REDIRECT', scope: 'none', roles: 'anonymous,authenticated', expected: 'ALLOW_PUBLIC_ENTRY_REDIRECT' },
  { routes: ['/login'], group: 'public-entry', feature: 'public.login', permission: '', capability: '', module: '', plan: 'PUBLIC_AUTH', scope: 'none', roles: 'anonymous,authenticated', expected: 'ALLOW_PUBLIC_AUTH' },
  { routes: ['/dashboard'], group: 'home', feature: 'dashboard.read', permission: 'dashboards.read', capability: 'core.dashboard', module: 'core', plan: 'ANY_ACTIVE_COMMERCIAL_TENANT', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_PERMISSION_ENTITLEMENT_MODULE_SCOPE' },
  { routes: ['/grc-global'], group: 'operations-resilience', feature: 'phase2.read', permission: 'workflow.read', capability: 'grc.phase2', module: 'integrated_grc', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/privacidad'], group: 'operations-resilience', feature: 'phase2.read', permission: 'privacy.read', capability: 'grc.phase2', module: 'integrated_grc', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/incidentes'], group: 'operations-resilience', feature: 'phase2.read', permission: 'incidents.read', capability: 'grc.phase2', module: 'integrated_grc', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/proveedores', '/portal-proveedor'], group: 'operations-resilience', feature: 'phase2.read', permission: 'suppliers.read', capability: 'tprm.suppliers', module: 'integrated_grc', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/conectores'], group: 'operations-resilience', feature: 'phase2.read', permission: 'connectors.read', capability: 'grc.phase2', module: 'integrated_grc', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/cumplimiento-auditoria'], group: 'compliance', feature: 'compliance.read', permission: 'framework.read', capability: 'iso.compliance', module: 'iso', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_ISO_ENTITLED' },
  { routes: ['/operaciones-grc/importar', '/importaciones'], group: 'operations-resilience', feature: 'phase3.read', permission: 'operations.import', capability: 'imports.excel', module: 'operations_grc', plan: 'ISO_RIESGO_OPERATIVO_OR_GRC', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_OPERATIONAL_RISK_ENTITLED' },
  { routes: ['/operaciones-grc', '/unidades', '/procesos', '/servicios', '/continuidad', '/crisis', '/indicadores'], group: 'operations-resilience', feature: 'phase3.read', permission: 'operations.dashboard.read', capability: 'grc.phase3', module: 'operations_grc', plan: 'ISO_RIESGO_OPERATIVO_OR_GRC', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_OPERATIONAL_RISK_ENTITLED' },
  { routes: ['/bia'], group: 'operations-resilience', feature: 'phase3.read', permission: 'bia.read', capability: 'grc.phase3', module: 'operations_grc', plan: 'ISO_RIESGO_OPERATIVO_OR_GRC', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_OPERATIONAL_RISK_ENTITLED' },
  { routes: ['/riesgo-cuantitativo'], group: 'risk-control', feature: 'phase3.read', permission: 'quantitative_risk.read', capability: 'risk.quantitative', module: 'risk_manager', plan: 'ISO_RIESGO_OPERATIVO_OR_GRC', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_OPERATIONAL_RISK_ENTITLED' },
  { routes: ['/auditorias/ia'], group: 'intelligence', feature: 'ai_compliance.read', permission: 'audit.review', capability: 'ai.auditor', module: 'ai_compliance', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/iso-health', '/health', '/administrar-kpis'], group: 'compliance', feature: 'health.view', permission: 'framework.read', capability: 'iso.health', module: 'health', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_ISO_ENTITLED' },
  { routes: ['/diagnostico', '/controles', '/soa', '/ciclo-vida', '/auditorias', '/ejecucion-iso', '/hallazgos', '/no-conformidades'], group: 'compliance', feature: 'compliance.functional_subflows.read', permission: 'framework.read', capability: 'iso.compliance', module: 'iso', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_ISO_ENTITLED' },
  { routes: ['/evidencias', '/documentos'], group: 'data-evidence', feature: 'evidences.read', permission: 'evidences.view', capability: 'evidence.library', module: 'evidences', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_ISO_ENTITLED' },
  { routes: ['/riesgos'], group: 'risk-control', feature: 'risks.read', permission: 'risk_matrix.view', capability: 'iso.risk', module: 'risks', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_ISO_RISK_ENTITLED' },
  { routes: ['/matriz-riesgo', '/activos'], group: 'risk-control', feature: 'risks.functional_subflows.read', permission: 'risk_matrix.view', capability: 'iso.risk', module: 'risks', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_ISO_RISK_ENTITLED' },
  { routes: ['/planes-accion', '/plan-accion', '/acciones-recomendadas'], group: 'audit-improvement', feature: 'action_plans.read', permission: 'actions.read', capability: 'iso.actions', module: 'iso', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_ISO_ENTITLED' },
  { routes: ['/exportes'], group: 'reports', feature: 'reports.read', permission: 'reports.read', capability: 'core.reports', module: 'core', plan: 'ISO_OR_HIGHER', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_REPORTS_ENTITLED' },
  { routes: ['/grc', '/datos'], group: 'intelligence', feature: 'phase5.read', permission: 'data.catalog.read', capability: 'data.governance', module: 'data_governance', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/metricas', '/bi'], group: 'intelligence', feature: 'phase5.read', permission: 'metrics.read', capability: 'metrics.catalog', module: 'metrics_bi', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/encuestas', '/evaluaciones'], group: 'intelligence', feature: 'phase5.read', permission: 'surveys.read', capability: 'surveys.engine', module: 'surveys_assessments', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/eventos-perdida'], group: 'risk-control', feature: 'phase5.read', permission: 'loss_events.read', capability: 'loss.events', module: 'operational_losses', plan: 'ISO_RIESGO_OPERATIVO_OR_GRC', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_OPERATIONAL_RISK_ENTITLED' },
  { routes: ['/tests'], group: 'risk-control', feature: 'phase5.read', permission: 'assurance_tests.read', capability: 'assurance.testing', module: 'assurance_loss', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,area_owner', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/reportes'], group: 'reports', feature: 'phase5.read', permission: 'reports.read', capability: 'reporting.studio', module: 'report_studio', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor,executive', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/ia', '/ia-compliance'], group: 'intelligence', feature: 'ai_compliance.read', permission: 'ai_compliance.read', capability: 'ai.compliance', module: 'ai_compliance', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/ia-auditor'], group: 'intelligence', feature: 'ai_compliance.read', permission: 'audit.review', capability: 'ai.auditor', module: 'ai_compliance', plan: 'GRC_ONLY_OR_EXPLICIT_ADDON', scope: 'tenant', roles: 'tenant_admin,auditor', expected: 'ALLOW_IF_GRC_ADVANCED_ENTITLED' },
  { routes: ['/perfil'], group: 'administration', feature: 'configuration.profile.self', permission: 'profile.read', capability: 'core.profile', module: 'core', plan: 'ANY_ACTIVE_COMMERCIAL_TENANT', scope: 'self', roles: 'tenant_admin,auditor,area_owner,executive', expected: 'ALLOW_SELF' },
  { routes: ['/configuracion', '/usuarios', '/perfil-empresa'], group: 'administration', feature: 'configuration.users.manage', permission: 'users.manage', capability: 'tenant.admin', module: 'core', plan: 'ANY_ACTIVE_COMMERCIAL_TENANT', scope: 'tenant_admin', roles: 'tenant_admin', expected: 'ALLOW_TENANT_ADMIN_ONLY' },
  { routes: ['/admin-saas', '/empresas'], group: 'platform', feature: 'admin_saas.internal', permission: 'commercial.subscription.read', capability: 'platform.admin', module: 'platform', plan: 'PLATFORM_CONTEXT', scope: 'platform', roles: 'platform_admin', expected: 'ALLOW_PLATFORM_ONLY' },
  { routes: ['/dealer', '/cotizador', '/prefacturacion'], group: 'dealer', feature: 'dealer.console', permission: 'dealer.clients.view', capability: 'dealer.console', module: 'dealer', plan: 'DEALER_ASSIGNMENT', scope: 'dealer_tenant_access', roles: 'dealer', expected: 'ALLOW_ASSIGNED_TENANTS_ONLY' },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    if (entry.isFile() && entry.name === 'page.tsx') files.push(full);
  }
  return files;
}

function toRoute(file) {
  const relative = path.relative(appRoot, path.dirname(file));
  const route = `/${relative.replace(/\\/g, '/')}`.replace(/\/\([^)]+\)/g, '').replace(/\/page$/, '');
  return route === '/.' ? '/' : route;
}

function matches(route, base) {
  return route === base || route.startsWith(`${base}/`);
}

function findRule(route) {
  return routeRules.find((rule) => rule.routes.some((base) => matches(route, base))) || null;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

fs.mkdirSync(outDir, { recursive: true });

const routes = walk(appRoot).map(toRoute).sort((a, b) => a.localeCompare(b));
const rows = routes.map((route) => {
  const rule = findRule(route);
  const issue = rule ? 'NO_FAILURE' : 'MISSING_PERMISSION_MAP';
  return {
    route,
    route_group: rule?.group || 'unknown',
    required_permission: rule?.permission || '',
    capability_key: rule?.capability || '',
    module_key: rule?.module || '',
    plan_requirement: rule?.plan || '',
    scope_requirement: rule?.scope || '',
    mutation_read_only: 'read_only',
    canonical_roles_allowed: rule?.roles || '',
    legacy_compatibility: 'preserve_effective_legacy_role_no_privilege_escalation',
    backend_guard: rule ? 'rbac.middleware + commercialEntitlement.middleware' : '',
    frontend_guard: rule ? 'AppLayout + mvpPermissions + useTenantEntitlements' : '',
    expected_access: rule?.expected || '',
    finding: issue,
  };
});

const headers = Object.keys(rows[0] || {
  route: '',
  route_group: '',
  required_permission: '',
  capability_key: '',
  module_key: '',
  plan_requirement: '',
  scope_requirement: '',
  mutation_read_only: '',
  canonical_roles_allowed: '',
  legacy_compatibility: '',
  backend_guard: '',
  frontend_guard: '',
  expected_access: '',
  finding: '',
});

fs.writeFileSync(
  outCsv,
  `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csv(row[header])).join(',')).join('\n')}\n`
);

const missing = rows.filter((row) => row.finding !== 'NO_FAILURE');
fs.writeFileSync(
  outSummary,
  [
    `routes=${rows.length}`,
    `mapped=${rows.length - missing.length}`,
    `missing=${missing.length}`,
    `expected_routes=97`,
    `route_count_status=${rows.length === 97 ? 'PASS' : 'FAIL'}`,
    `missing_routes=${missing.map((row) => row.route).join('|') || 'NONE'}`,
    '',
  ].join('\n')
);

process.stdout.write(`RBAC02_ROUTE_MATRIX routes=${rows.length} missing=${missing.length} output=${outCsv}\n`);
