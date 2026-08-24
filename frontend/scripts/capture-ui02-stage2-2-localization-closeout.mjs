import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui02-stage2-2-localization-closeout');
const baseUrl = process.env.UI02_BASE_URL || 'http://localhost:3001';
const locale = 'es';
const tenantId = randomUUID();
const userId = randomUUID();
const role = 'admin';
const tenantName = 'TECDEX Validación Visual';

fs.mkdirSync(outDir, { recursive: true });

const payload = {
  id: userId,
  userId,
  tenant_id: tenantId,
  tenantId,
  email: 'validacion.ui@local.test',
  full_name: 'Validación UI',
  name: 'Validación UI',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = [
  'health',
  'risks',
  'audits',
  'evidences',
  'grc_phase2_integrated',
  'grc_phase3_operations',
  'data_governance',
  'metrics_bi',
  'surveys_assessments',
  'assurance_loss',
  'ai',
  'report_studio',
];

const moduleMap = Object.fromEntries(
  moduleKeys.map((key) => [key, { module_key: key, module_name: key, is_enabled: true }])
);

const capabilities = Object.fromEntries(
  [
    'reports.premium',
    'data.governance',
    'metrics.catalog',
    'bi.executive_dashboards',
    'reporting.studio',
    'health.view',
  ].map((key) => [key, {
    capability_key: key,
    enabled: true,
    decision: 'allowed',
    source: 'visual_validation_mock',
    reason_code: 'ALLOWED_FOR_LOCAL_VISUAL_VALIDATION',
    effective_from: null,
    effective_until: null,
    limit: null,
    usage: 0,
    remaining: null,
    dependencies: [],
    read_only: false,
  }])
);

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function apiMock(url) {
  const pathname = url.pathname;

  if (pathname === '/api/me/modules') {
    return {
      ok: true,
      scope: {
        user_id: userId,
        role,
        tenant_id: tenantId,
        tenant_name: tenantName,
        service_status: 'active',
      },
      module_map: moduleMap,
    };
  }

  if (pathname === '/api/me/permissions') {
    return { ok: true, permission_map: { 'health.view': true } };
  }

  if (pathname === '/api/me/entitlements') {
    return {
      tenant_id: tenantId,
      subscription: { plan: 'enterprise' },
      modules: moduleKeys.map((module_key) => ({ module_key, enabled: true })),
      capabilities,
      limits: {},
      usage: {},
      health: {},
      ai: {
        enabled: true,
        plan: 'enterprise',
        web_enabled: true,
        report_enabled: true,
        auditor_enabled: true,
        features: {
          auditor: true,
          suggestions: true,
          web_research: true,
          report_enrichment: true,
          document_generation: true,
          company_profile_analysis: true,
        },
        quota: { monthly: null, used: 0 },
      },
    };
  }

  if (pathname === '/api/user/me' || pathname === '/api/auth/validate') {
    return {
      ok: true,
      ...payload,
      tenant_name: tenantName,
      tenant: { id: tenantId, tenant_id: tenantId, name: tenantName },
    };
  }

  if (pathname.startsWith('/api/tenants/')) {
    return {
      ok: true,
      data: {
        id: tenantId,
        tenant_id: tenantId,
        name: tenantName,
        company_name: tenantName,
        legal_name: `${tenantName} SpA`,
        plan_name: 'Enterprise',
      },
    };
  }

  if (pathname === '/api/metrics/official/catalog') return { ok: true, data: [] };
  if (pathname.includes('/notifications')) return { ok: true, items: [] };
  if (pathname.includes('/search')) return [];
  if (pathname.includes('/health')) return { ok: true, data: null, items: [], metrics: [], indicators: [], summary: null };
  if (pathname.includes('/dashboard')) return { ok: true, data: null, items: [], metrics: [], indicators: [], summary: null };
  if (pathname.includes('/riesgos') || pathname.includes('/risks')) return { ok: true, data: [], items: [], risks: [] };
  if (pathname.includes('/grc')) return { ok: true, data: [], items: [], results: [] };

  return { ok: true, data: null, items: [], results: [], rows: [], total: 0 };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertVisibleTextClean(capture) {
  const visible = `${capture.bodyText || ''}\n${capture.breadcrumbText || ''}`;
  const forbiddenPatterns = [
    /La sesión no contiene un tenant válido/i,
    /invalid tenant/i,
    /unauthorized/i,
    /error de autenticación/i,
    /Risk matrixs/i,
    /Inicio\s*\/\s*Inicio/i,
    /Home\s*\/\s*Home/i,
  ];

  forbiddenPatterns.forEach((pattern) => {
    assert(!pattern.test(visible), `${capture.file} contains forbidden visible pattern: ${pattern}`);
  });

  const knownEnglishLabels = [
    /Welcome to TCDX/i,
    /Operational View/i,
    /Executive Center/i,
    /Risk Register/i,
    /Risk Matrix/i,
    /System Health/i,
    /Home\s*\//i,
  ];
  knownEnglishLabels.forEach((pattern) => {
    assert(!pattern.test(visible), `${capture.file} mixes English label in Spanish evidence: ${pattern}`);
  });
}

function assertContains(capture, patterns) {
  const visible = `${capture.bodyText || ''}\n${capture.breadcrumbText || ''}`;
  patterns.forEach((pattern) => {
    assert(pattern.test(visible), `${capture.file} missing expected visible pattern: ${pattern}`);
  });
}

async function setupPage(browser, viewport, collapsed = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    extraHTTPHeaders: {
      'Accept-Language': 'es-CL,es;q=0.9',
      'x-tcdx-locale': 'es',
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);

  await page.route('**/api/**', async (route) => {
    await route.fulfill(jsonResponse(apiMock(new URL(route.request().url()))));
  });
  await page.route('**/health/**', async (route) => {
    await route.fulfill(jsonResponse(apiMock(new URL(route.request().url()))));
  });

  await page.addInitScript(({ token, tenantId, collapsed, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('activeTenantId', tenantId);
    localStorage.setItem('selectedTenantId', tenantId);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('email', 'validacion.ui@local.test');
    localStorage.setItem('sidebar-collapsed', String(collapsed));
    localStorage.setItem('tcdx_locale', 'es');
    document.cookie = 'tcdx_locale=es; path=/; SameSite=Lax';
  }, { token, tenantId, collapsed, userId });

  return { context, page };
}

async function waitForShell(page, routePath) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
  await page.locator('header.enterprise-topbar').waitFor({ state: 'visible' });
  await page.locator('main.enterprise-main').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
}

async function readBreadcrumb(page) {
  return page
    .locator('nav[aria-label="Ruta de navegación"]')
    .first()
    .textContent()
    .catch(() => '');
}

async function capture(browser, options) {
  const { file, viewport, routePath, menuState, collapsed = false, openDrawer = false } = options;
  const { context, page } = await setupPage(browser, viewport, collapsed);

  await waitForShell(page, routePath);

  const accessibility = {};
  if (openDrawer) {
    const menuButton = page.getByRole('button', { name: /Abrir menú/i });
    await menuButton.click();
    await page.locator('#mobile-sidebar-drawer').waitFor({ state: 'visible' });
    accessibility.bodyScrollLockedWhenDrawerOpen = await page.evaluate(() => document.body.style.overflow === 'hidden');
    accessibility.focusInsideDrawerAfterOpen = await page.evaluate(() => Boolean(document.activeElement?.closest?.('#mobile-sidebar-drawer')));
    await page.keyboard.press('Tab');
    accessibility.tabTrapStayedInsideDrawer = await page.evaluate(() => Boolean(document.activeElement?.closest?.('#mobile-sidebar-drawer')));
    await page.keyboard.press('Escape');
    await page.locator('#mobile-sidebar-drawer').waitFor({ state: 'detached' });
    await page.waitForTimeout(120);
    accessibility.escapeClosesDrawer = true;
    accessibility.focusReturnsToMenuButtonAfterEscape = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Abrir menú');
    await menuButton.click();
    await page.locator('#mobile-sidebar-drawer').waitFor({ state: 'visible' });
    await page.locator('#mobile-sidebar-drawer > button[aria-label="Cerrar"]').click({ position: { x: Math.max(viewport.width - 16, 10), y: 16 } });
    await page.locator('#mobile-sidebar-drawer').waitFor({ state: 'detached' });
    await page.waitForTimeout(120);
    accessibility.overlayClosesDrawer = true;
    accessibility.focusReturnsToMenuButtonAfterOverlay = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Abrir menú');
    await menuButton.click();
    await page.locator('#mobile-sidebar-drawer').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
  }

  const bodyText = await page.locator('body').innerText();
  const rawBreadcrumbText = await readBreadcrumb(page);
  const tenantTitle = await page
    .locator(`header.enterprise-topbar [title*="${tenantName}"]`)
    .first()
    .getAttribute('title')
    .catch(() => null);
  const currentSegments = await page
    .locator('nav[aria-label="Ruta de navegación"] [aria-current="page"]')
    .count()
    .catch(() => 0);
  const visibleInternalTerms = await page
    .locator('text=/DOMINIOS ENTERPRISE|VISTAS DEL DOMINIO|ENTERPRISE DOMAINS|DOMAIN VIEWS/i')
    .count();
  const collapsedAccessibleLinks = await page.locator('aside a[title][aria-label]').count();

  const captureData = {
    file,
    locale,
    viewport,
    route: routePath,
    menuState,
    tenantContext: {
      source: 'visual harness runtime UUID from JWT and activeTenantId',
      tenantId,
      tenantName,
      validUuid: true,
    },
    dataConditions: 'API mocks with enabled modules/capabilities and empty operational datasets; official metrics catalog returns an empty array, not zero-filled metrics.',
    breadcrumbText: String(rawBreadcrumbText || '').replace(/\s+/g, ' ').trim(),
    bodyText: String(bodyText || '').replace(/\s+/g, ' ').trim(),
    assertions: {
      forbiddenVisiblePatternsAbsent: true,
      spanishLocaleLabelsOnly: true,
      noDuplicateBreadcrumb: true,
      currentSegments,
      tenantTitle,
      visibleInternalTerms,
      collapsedAccessibleLinks,
      accessibility,
    },
  };

  assertVisibleTextClean(captureData);
  assert(currentSegments === 1 || viewport.width < 1024, `${file} must expose exactly one aria-current breadcrumb segment on desktop.`);
  assert(visibleInternalTerms === 0, `${file} must not show internal sidebar terminology.`);
  assert(tenantTitle?.includes(tenantName), `${file} must show a valid tenant title.`);

  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  await context.close();
  return captureData;
}

const browser = await chromium.launch();
const captures = [];

try {
  captures.push(await capture(browser, {
    file: 'dashboard-1440-sidebar-expanded-es.png',
    viewport: { width: 1440, height: 1000 },
    routePath: '/dashboard',
    menuState: 'sidebar-expanded',
  }));
  captures.push(await capture(browser, {
    file: 'dashboard-1280-sidebar-collapsed-es.png',
    viewport: { width: 1280, height: 900 },
    routePath: '/dashboard',
    menuState: 'sidebar-collapsed',
    collapsed: true,
  }));
  captures.push(await capture(browser, {
    file: 'riesgos-1440-sidebar-expanded-es.png',
    viewport: { width: 1440, height: 1000 },
    routePath: '/riesgos',
    menuState: 'sidebar-expanded',
  }));
  captures.push(await capture(browser, {
    file: 'dashboard-mobile-390-drawer-open-es.png',
    viewport: { width: 390, height: 844 },
    routePath: '/dashboard',
    menuState: 'drawer-open',
    openDrawer: true,
  }));
} finally {
  await browser.close();
}

const dashboard = captures.find((item) => item.file === 'dashboard-1440-sidebar-expanded-es.png');
const riesgos = captures.find((item) => item.file === 'riesgos-1440-sidebar-expanded-es.png');
const mobile = captures.find((item) => item.file === 'dashboard-mobile-390-drawer-open-es.png');

assertContains(dashboard, [
  /Inicio\s*\/\s*Centro ejecutivo/i,
  /Bienvenido a TCDX/i,
  /Vista operacional/i,
  /Vista KPI/i,
  /Salud del sistema/i,
  /Hoy/i,
  /Actualizar/i,
  /Resumen ejecutivo GRC/i,
]);
assertContains(riesgos, [
  /Inicio\s*\/\s*…\s*\/\s*Registro de riesgos/i,
  /Matriz de riesgos/i,
  /Controles/i,
  /Activos/i,
  /Riesgo cuantitativo/i,
]);
assert(
  mobile.assertions.accessibility.escapeClosesDrawer &&
    mobile.assertions.accessibility.overlayClosesDrawer &&
    mobile.assertions.accessibility.focusReturnsToMenuButtonAfterEscape &&
    mobile.assertions.accessibility.focusReturnsToMenuButtonAfterOverlay &&
    mobile.assertions.accessibility.bodyScrollLockedWhenDrawerOpen &&
    mobile.assertions.accessibility.tabTrapStayedInsideDrawer,
  'Mobile drawer accessibility assertions must pass.'
);

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  locale,
  routeCountBefore: 97,
  routeCountAfter: 97,
  tenantContext: {
    tenantId,
    tenantName,
    role,
    source: 'runtime-generated UUID in Playwright localStorage/JWT for visual validation only',
  },
  permissionsContext: {
    moduleKeys,
    capabilities: Object.keys(capabilities),
    permission_map: { 'health.view': true },
  },
  assertions: {
    noInvalidTenantText: true,
    noAuthErrors: true,
    noKnownMixedLocaleLabels: true,
    noRiskMatrixs: true,
    noDuplicatedBreadcrumbHome: true,
    dashboardSpanishLabels: true,
    riesgosSpanishLabels: true,
    mobileDrawerAccessibility: true,
  },
  captures: captures.map((captureData) => ({
    ...captureData,
    bodyText: undefined,
  })),
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('UI02_STAGE2_2_VISUAL_EVIDENCE_PASS');
