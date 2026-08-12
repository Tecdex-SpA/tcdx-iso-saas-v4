import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const backendRoot = path.resolve(root, '../backend/src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dashboard = read(path.join(srcRoot, 'app/dashboard/page.tsx'));
const metricCatalog = read(path.join(srcRoot, 'components/indicators/FunctionalIndicatorCatalog.tsx'));
const indicatorGovernance = read(path.join(backendRoot, 'services/indicators/indicatorGovernance.service.js'));
const indicatorCore = read(path.join(backendRoot, 'services/indicators/indicatorCore.js'));
const sourceContracts = read(path.join(backendRoot, 'services/math-governance/sourceContracts.service.js'));
const routes = read(path.join(backendRoot, 'routes/phase5.routes.js'));
const p0Pages = [
  ['app/cumplimiento-auditoria/page.tsx'],
  ['app/evidencias/page.tsx'],
  ['app/metricas/page.tsx', 'components/indicators/FunctionalIndicatorCatalog.tsx'],
  ['app/grc/page.tsx', 'components/grc/GrcPortal.tsx', 'components/math-governance/GrcDecisionCenter.tsx'],
  ['app/exportes/page.tsx'],
].map((files) => files.map((file) => read(path.join(srcRoot, file))).join('\n'));
const p0Shells = [
  'app/riesgos/page.tsx',
  'app/planes-accion/page.tsx',
].map((file) => read(path.join(srcRoot, file)));
const mvpShell = read(path.join(srcRoot, 'components/mvp/MvpViewShell.tsx'));

assert(
  indicatorCore.includes('actionable_state') &&
    indicatorCore.includes('data_requirements') &&
    indicatorCore.includes('source_contract'),
  'Official snapshots must carry actionable UX state, source contract, and data requirements.'
);

assert(
  indicatorGovernance.includes('buildActionableState') &&
    indicatorGovernance.includes('unknownTrustDimensions') &&
    indicatorGovernance.includes('route_to_fix') &&
    indicatorGovernance.includes('required_capability') &&
    indicatorGovernance.includes('missing_components'),
  'Indicator governance must derive actionable states from governed metadata, not hardcoded tenant data.'
);

assert(
  sourceContracts.includes('ROUTE_TO_FIX_BY_ENTITY') &&
    sourceContracts.includes('CAPABILITY_BY_ENTITY') &&
    sourceContracts.includes("data_quality: '/datos/calidad'") &&
    sourceContracts.includes("data_lineage: '/datos/lineage'"),
  'Source contracts must expose generic route/capability metadata for user-actionable state resolution.'
);

assert(
  routes.includes("metricsRouter.get('/official/:metricCode/technical'") &&
    routes.includes("metricsRouter.get('/official/:metricCode'") &&
    routes.includes("metricsRouter.post('/official/:metricCode/calculate'"),
  'Official metric detail, technical metadata, and recalculation endpoints must remain available.'
);

assert(
  metricCatalog.includes('ActionableStatePanel') &&
    metricCatalog.includes('fallbackActionable') &&
    metricCatalog.includes('Qué falta') &&
    metricCatalog.includes('Resolver origen') &&
    metricCatalog.includes('required_capability') &&
    metricCatalog.includes('route_to_fix'),
  'Official metrics UI must show state, why, missing components, route to fix, and capability for non-calculated states.'
);

assert(
  dashboard.includes('getSnapshotActionableState') &&
    dashboard.includes('missing_components') &&
    dashboard.includes('scoreGlobalMissingComponent') &&
    dashboard.includes('route_to_fix') &&
    dashboard.includes('expected_after_resolution'),
  'Dashboard KPI must use actionable official state for Global Score dependency explanations.'
);

assert(
  !dashboard.includes('alert(') && !dashboard.includes('window.alert('),
  'Dashboard KPI productive mutations must use inline success/error feedback, not browser alerts.'
);

assert(
  !/official_score[\s\S]{0,120}\?\?\s*0/.test(dashboard) &&
    !dashboard.includes('adminScore') &&
    !dashboard.includes('/api/kpis/recalculate'),
  'Phase 6.5 must not regress into official null-to-zero or Admin/Official crossover.'
);

for (const [index, page] of p0Pages.entries()) {
  assert(/loading|Cargando|isLoading|setLoading|busy|saving/i.test(page), `P0 page ${index} must expose loading or processing state.`);
  assert(/error|role="alert"|validation|validaci/i.test(page), `P0 page ${index} must expose error or validation feedback.`);
  assert(/empty|Sin |No hay|Aún no|0 /.test(page), `P0 page ${index} must expose an empty or no-data state.`);
}

for (const [index, page] of p0Shells.entries()) {
  assert(page.includes('MvpViewShell') && page.includes('links={['), `P0 shell ${index} must route users to concrete operational subflows.`);
  assert(page.includes('feature:') && page.includes('description:'), `P0 shell ${index} must expose RBAC-gated actionable destinations.`);
}

assert(
  mvpShell.includes('EnterpriseEmptyState') &&
    mvpShell.includes('visibleLinks.length === 0') &&
    mvpShell.includes('canAccessMvpFeature'),
  'P0 shell must handle RBAC and empty authorized destinations clearly.'
);

const productionSurface = `${dashboard}\n${metricCatalog}\n${indicatorGovernance}\n${indicatorCore}`;
assert(
  !/tenant_id\s*:\s*['"][0-9a-f-]{20,}|tenantId\s*:\s*['"][0-9a-f-]{20,}|credex|admin\.demo|auditor\.demo|@credex\.cl|Tenant 1|Tenant 2/i.test(productionSurface),
  'Phase 6.5 functional flow work must not introduce tenant, customer, or demo hardcodes.'
);

console.log('PHASE6_FUNCTIONAL_FLOWS_UX_STATES_CONTRACT_PASS');
