import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const backendRoot = path.resolve(root, '../backend/src');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function readBackend(relativePath) {
  return fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const evidence = readSrc('app/evidencias/page.tsx');
const dashboard = readSrc('app/dashboard/page.tsx');
const metrics = readSrc('components/indicators/FunctionalIndicatorCatalog.tsx');
const appLayout = readSrc('components/AppLayout.tsx');
const mvpShell = readSrc('components/mvp/MvpViewShell.tsx');
const risksShell = readSrc('app/riesgos/page.tsx');
const actionsShell = readSrc('app/planes-accion/page.tsx');
const complianceShell = readSrc('app/cumplimiento-auditoria/page.tsx');
const adminKpis = readSrc('app/administrar-kpis/page.tsx');
const indicatorGovernance = readBackend('services/indicators/indicatorGovernance.service.js');
const indicatorCore = readBackend('services/indicators/indicatorCore.js');
const sourceContracts = readBackend('services/math-governance/sourceContracts.service.js');
const phase5Routes = readBackend('routes/phase5.routes.js');
const backendRoutes = readBackend('routes/kpi.routes.js');

const p0CommercialSurface = [
  evidence,
  dashboard,
  metrics,
  readSrc('app/exportes/page.tsx'),
  readSrc('app/grc/page.tsx'),
  complianceShell,
  risksShell,
  actionsShell,
].join('\n');

assert(
  !/alert\s*\(|window\.alert\s*\(|confirm\s*\(|window\.confirm\s*\(/.test(p0CommercialSurface),
  'P0 commercial workflows must not use native browser alert/confirm feedback.'
);

assert(
  evidence.includes('type EvidenceNotice') &&
    evidence.includes('showEvidenceNotice') &&
    evidence.includes("role={evidenceNotice.type === 'error' ? 'alert' : 'status'}") &&
    evidence.includes('setUploading(true)') &&
    evidence.includes('disabled={uploading}') &&
    evidence.includes('setReviewingId') &&
    evidence.includes('setHealthRefreshing(true)'),
  'Evidence P0 mutations must expose inline success/error feedback, processing state, and double-submit blocking.'
);

assert(
  risksShell.includes('RiskRegisterWorkspace') &&
    risksShell.includes('AppLayout') &&
    risksShell.includes('Suspense'),
  'risks must use the approved risk-control workspace under AppLayout.'
);

for (const [name, shell, expectedRoute] of [
  ['actions', actionsShell, '/plan-accion'],
  ['compliance', complianceShell, '/auditorias'],
]) {
  assert(shell.includes('MvpViewShell'), `${name} must use the delegated functional shell.`);
  assert(shell.includes(expectedRoute), `${name} shell must route to the functional destination.`);
  assert(shell.includes('feature:'), `${name} shell must preserve capability-gated destinations.`);
}

assert(
  mvpShell.includes('canAccessMvpFeature') &&
    mvpShell.includes('visibleLinks.length === 0') &&
    mvpShell.includes('EnterpriseEmptyState'),
  'Delegated shells must preserve RBAC empty state and avoid dead-end navigation.'
);

assert(
  appLayout.includes('moduleIsEnabled') &&
    appLayout.includes('canShowCapability') &&
    appLayout.includes('fetchAccessBootstrap') &&
    appLayout.includes('tenant_id') &&
    appLayout.includes('tenant_name') &&
    appLayout.includes('clearToken()') &&
    appLayout.includes('sessionStorage.clear()') &&
    !/tenant_id\s*===\s*['"]|tenantId\s*===\s*['"]/.test(appLayout),
  'Commercial tenant shell must derive navigation from role/capabilities and clear session state on logout.'
);

assert(
  indicatorCore.includes('actionable_state') &&
    indicatorCore.includes('data_requirements') &&
    indicatorCore.includes('source_contract') &&
    indicatorGovernance.includes('buildActionableState') &&
    indicatorGovernance.includes('unknownTrustDimensions') &&
    sourceContracts.includes('route_to_fix') &&
    sourceContracts.includes('required_capability'),
  'Actionable official states must derive from governed snapshot/source-contract metadata.'
);

assert(
  dashboard.includes('/api/metrics/official/dashboard') &&
    dashboard.includes('/api/metrics/official/dashboard/recalculate') &&
    !dashboard.includes('/api/kpis/recalculate') &&
    !dashboard.includes('adminScore'),
  'Dashboard KPI must remain on the official metric universe.'
);

assert(
  adminKpis.includes('/api/kpis/admin/') &&
    adminKpis.includes('/api/kpis/recalculate') &&
    !adminKpis.includes('/api/metrics/official/dashboard/recalculate'),
  'Admin KPI surface must remain on the administrative KPI universe.'
);

assert(
  phase5Routes.includes("metricsRouter.get('/official/dashboard'") &&
    phase5Routes.includes("metricsRouter.post('/official/dashboard/recalculate'") &&
    backendRoutes.includes("router.get('/admin/:tenantId'"),
  'Official and Admin KPI endpoint contracts must both remain present and separate.'
);

assert(
  !/official_score[\s\S]{0,120}\?\?\s*0/.test(dashboard) &&
    !/null\s*->\s*0|null-to-zero|fake 100|fallback admin/i.test(p0CommercialSurface),
  'Commercial empty/unmeasured states must not fabricate official scores.'
);

const productionSurface = [
  evidence,
  dashboard,
  metrics,
  appLayout,
  adminKpis,
  indicatorGovernance,
  indicatorCore,
].join('\n');

assert(
  !/tenant_id\s*:\s*['"][0-9a-f-]{20,}|tenantId\s*:\s*['"][0-9a-f-]{20,}|credex|admin\.demo|auditor\.demo|@credex\.cl|Tenant 1|Tenant 2|dataset_a|dataset_b|dataset_c/i.test(productionSurface),
  'Commercial multi-tenant work must not introduce tenant, customer, demo, dataset, or email hardcodes.'
);

console.log('PHASE6_COMMERCIAL_MULTITENANT_CONTRACT_PASS');
