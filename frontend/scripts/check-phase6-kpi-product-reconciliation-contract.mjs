import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const adminPage = read(path.join(srcRoot, 'app/administrar-kpis/page.tsx'));
const metricsPage = read(path.join(srcRoot, 'app/metricas/page.tsx'));
const dashboardPage = read(path.join(srcRoot, 'app/dashboard/page.tsx'));
const functionalCatalog = read(path.join(srcRoot, 'components/indicators/FunctionalIndicatorCatalog.tsx'));
const es = read(path.join(srcRoot, 'i18n/dictionaries/es.json'));
const en = read(path.join(srcRoot, 'i18n/dictionaries/en.json'));

assert(
  adminPage.includes('/api/kpis/admin/') &&
    adminPage.includes('/api/kpis/custom') &&
    adminPage.includes('/api/kpis/tenant-setting') &&
    adminPage.includes('/api/kpis/manual-value'),
  'Administrar KPI must remain backed by administrative KPI endpoints.'
);

assert(
  !adminPage.includes('/api/metrics/official/dashboard') &&
    !adminPage.includes('/api/metrics/official/catalog') &&
    !adminPage.includes('/api/metrics/official/snapshots'),
  'Administrar KPI must not consume or mutate official Phase 5 metric endpoints.'
);

assert(
  metricsPage.includes('Indicadores oficiales') &&
    metricsPage.includes('Esta vista no administra KPI configurables') &&
    functionalCatalog.includes('/api/metrics/official/catalog'),
  'Métricas must be presented and sourced as the official governed indicator universe.'
);

assert(
  !metricsPage.includes('/api/kpis/admin') &&
    !functionalCatalog.includes('/api/kpis/admin'),
  'Official metrics surfaces must not consume administrative KPI endpoints.'
);

assert(
  dashboardPage.includes('/api/metrics/official/dashboard') &&
    !dashboardPage.includes('/api/kpis/admin/'),
  'Dashboard KPI view must remain sourced from the official dashboard endpoint, not Admin KPI.'
);

assert(
  dashboardPage.includes('scoreKpiGlobal') &&
    /official_score\s*===\s*null/.test(dashboardPage) &&
    !/official_score[\s\S]{0,120}\?\?\s*0/.test(dashboardPage),
  'Official Global Score must preserve null when the official score is unavailable.'
);

assert(
  adminPage.includes('canAdministerKpis') &&
    adminPage.includes('canAccessMvpFeature') &&
    adminPage.includes("hasCapability('metrics.catalog')") &&
    adminPage.includes('readOnlyActionsHidden'),
  'Admin/Official cross-linking and admin actions must respect role/capability context.'
);

assert(
  es.includes('No son la fuente de verdad de los indicadores oficiales Phase 5') &&
    es.includes('No crea un indicador oficial gobernado') &&
    en.includes('They are not the source of truth for Phase 5 official indicators') &&
    en.includes('It does not create a governed official indicator'),
  'Product copy must explicitly distinguish Admin KPI from Official KPI.'
);

const productionSurface = `${adminPage}\n${metricsPage}\n${dashboardPage}\n${functionalCatalog}`;

assert(
  !/tenant_id\s*:\s*['"][0-9a-f-]{20,}|tenantId\s*:\s*['"][0-9a-f-]{20,}|credex|admin\.demo|auditor\.demo|@credex\.cl|Tenant 1|Tenant 2/i.test(productionSurface),
  'KPI product reconciliation must not introduce tenant, customer, or demo-account hardcodes.'
);

assert(
  !/metrics\.rows\.slice\(0,|kpiCategoryOverview[\s\S]{0,900}\.slice\(0,|manualPendingKpis[\s\S]{0,900}\.slice\(0,/.test(adminPage),
  'Administrative KPI page must not silently hide administrative KPI evidence with first-N slicing.'
);

console.log('PHASE6_KPI_PRODUCT_RECONCILIATION_CONTRACT_PASS');
