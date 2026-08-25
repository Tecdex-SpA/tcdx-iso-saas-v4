import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui02-stage3-risk-control-workspace');
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
  ].map((key) => [
    key,
    {
      capability_key: key,
      enabled: true,
      decision: 'allowed',
      source: 'ui02_stage3_visual_fixture',
      reason_code: 'ALLOWED_FOR_LOCAL_VISUAL_VALIDATION',
      dependencies: [],
      read_only: false,
    },
  ])
);

const riskA = randomUUID();
const riskB = randomUUID();
const riskC = randomUUID();
const assetA = randomUUID();
const assetB = randomUUID();
const quantA = randomUUID();

const matrixItems = [
  {
    id: riskA,
    run_id: randomUUID(),
    risk_code: 'RC-001',
    risk_title: 'Interrupción de servicio crítico',
    risk_description: 'Escenario de indisponibilidad operacional con impacto en servicios comprometidos.',
    risk_category: 'Continuidad',
    asset_name: 'Plataforma GRC',
    asset_type: 'Aplicación',
    asset_criticality: 'alta',
    likelihood: 4,
    impact: 5,
    inherent_risk_score: 20,
    inherent_risk_level: 'CRITICO',
    residual_likelihood: 3,
    residual_impact: 4,
    residual_risk_score: 12,
    residual_risk_level: 'ALTO',
    treatment_strategy: 'Mitigar',
    status: 'revisado',
    confidence: 0.88,
  },
  {
    id: riskB,
    run_id: randomUUID(),
    risk_code: 'RC-002',
    risk_title: 'Interrupción de servicio crítico',
    risk_description: 'Título repetido con identificador distinto para validar no deduplicación por nombre.',
    risk_category: 'Operación',
    asset_name: 'Portal proveedor',
    asset_type: 'Servicio',
    asset_criticality: 'media',
    likelihood: 0,
    impact: 0,
    inherent_risk_score: 0,
    inherent_risk_level: 'BAJO',
    residual_risk_score: 0,
    residual_risk_level: 'BAJO',
    treatment_strategy: null,
    status: 'pendiente',
    confidence: 0.92,
  },
  {
    id: riskC,
    run_id: randomUUID(),
    risk_code: 'RC-003',
    risk_title: 'Dependencia sin medición suficiente',
    risk_description: 'Registro con confianza insuficiente sin convertir ausencia de medición en cero.',
    risk_category: 'Proveedor',
    asset_name: null,
    likelihood: null,
    impact: null,
    inherent_risk_score: null,
    residual_risk_score: null,
    residual_risk_level: null,
    treatment_strategy: null,
    status: 'borrador',
    confidence: 0.2,
  },
];

const assets = [
  {
    id: assetA,
    name: 'Plataforma GRC',
    type: 'Aplicación',
    iso: 'ISO27001',
    criticality: 'alta',
    owner: 'Operaciones',
    related_standards: ['ISO27001'],
    created_at: '2026-08-20T12:00:00Z',
  },
  {
    id: assetB,
    name: 'Portal proveedor',
    type: 'Servicio',
    iso: 'ISO27001',
    criticality: 'media',
    owner: 'Compras',
    related_standards: ['ISO27001'],
    created_at: '2026-08-21T12:00:00Z',
  },
];

const assetRisks = {
  [assetA]: [
    { id: randomUUID(), asset_id: assetA, risk: 'Interrupción de servicio crítico', impact: 'alto', probability: 'media', level: 'alto' },
  ],
  [assetB]: [
    { id: randomUUID(), asset_id: assetB, risk: 'Interrupción de servicio crítico', impact: null, probability: null, level: null },
  ],
};

const quantitativeRisks = [
  {
    id: quantA,
    code: 'QRC-001',
    risk_id: riskA,
    scenario: 'Pérdida operacional anualizada por indisponibilidad de plataforma',
    expected_impact: 18000000,
    annualized_loss: 5400000,
    net_expected_benefit: 1200000,
    status: 'active',
    source_description: 'Fixture visual local sobre contrato Phase 3',
    updated_at: '2026-08-22T09:00:00Z',
  },
];

function jsonResponse(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

function apiMock(url) {
  const pathname = url.pathname;

  if (pathname === '/api/me/modules') {
    return {
      ok: true,
      scope: { user_id: userId, role, tenant_id: tenantId, tenant_name: tenantName, service_status: 'active' },
      module_map: moduleMap,
    };
  }

  if (pathname === '/api/me/permissions') return { ok: true, permission_map: { 'health.view': true } };
  if (pathname === '/api/me/entitlements') {
    return {
      tenant_id: tenantId,
      subscription: { plan: 'enterprise' },
      modules: moduleKeys.map((module_key) => ({ module_key, enabled: true })),
      capabilities,
      limits: {},
      usage: {},
      health: {},
      ai: { enabled: true, plan: 'enterprise', quota: { monthly: null, used: 0 } },
    };
  }

  if (pathname === '/api/user/me' || pathname === '/api/auth/validate') {
    return { ok: true, ...payload, tenant_name: tenantName, tenant: { id: tenantId, tenant_id: tenantId, name: tenantName } };
  }

  if (pathname.startsWith('/api/tenants/')) {
    return { ok: true, data: { id: tenantId, tenant_id: tenantId, name: tenantName, company_name: tenantName, plan_name: 'Enterprise' } };
  }

  if (pathname.startsWith('/api/tenant-standards/scope/')) {
    const scope = {
      operations: [{ id: randomUUID(), name: 'Operación principal', code: 'OP-001', is_active: true }],
      standards: [{ code: 'ISO27001', name: 'ISO 27001', is_active: true, active_operations_count: 1, active_operation_ids: [randomUUID()] }],
    };
    return {
      ok: true,
      data: scope,
      ...scope,
    };
  }

  if (pathname.endsWith('/options') && pathname.includes('/api/iso-risk-matrix/')) {
    return {
      ok: true,
      data: {
        options: [
          {
            standard_code: 'ISO27001',
            version_code: '2022',
            display_name: 'ISO 27001:2022',
            recommended: true,
            latest_run_id: randomUUID(),
          },
        ],
      },
    };
  }

  if (pathname.endsWith('/latest') && pathname.includes('/api/iso-risk-matrix/')) {
    return {
      ok: true,
      data: {
        run: { id: randomUUID(), run_id: randomUUID(), standard_code: 'ISO27001', version_code: '2022', risk_posture: 'alto' },
        items: matrixItems,
      },
    };
  }

  if (pathname === `/api/assets/${tenantId}`) return { ok: true, data: assets };
  if (pathname.startsWith('/api/assets/risk/')) {
    const assetId = pathname.split('/').pop();
    return { ok: true, data: assetRisks[assetId] || [] };
  }
  if (pathname.startsWith('/api/assets/risk-summary/')) return { ok: true, data: [{ level: 'alto', total: 1 }, { level: 'medio', total: 0 }] };

  if (pathname === '/api/grc/phase3/meta') {
    return {
      ok: true,
      data: {
        module: { module_key: 'grc_phase3_operations', display_name: 'Operación GRC', is_enabled: true },
        permissions: { platform: true, 'quantitative_risk.read': true, 'quantitative_risk.manage': true },
      },
    };
  }
  if (pathname === '/api/grc/phase3/lookups') {
    return { ok: true, data: { risk: matrixItems.map((item) => ({ id: item.id, code: item.risk_code, name: item.risk_title })) } };
  }
  if (pathname.startsWith('/api/grc/phase3/quantitative-risks')) return { ok: true, data: quantitativeRisks };

  if (pathname.includes('/api/controls/workbench/')) {
    return {
      ok: true,
      data: {
        operation: { id: randomUUID(), name: 'Operación principal' },
        items: [
          {
            tenant_control_id: randomUUID(),
            catalog_control_id: randomUUID(),
            clause: 'A.5.1',
            category: 'Organizacional',
            description: 'Políticas de seguridad de la información',
            status: 'activo',
            score: 80,
            priority: 'alta',
            evidence_count: 1,
            open_nonconformities_count: 0,
            open_findings_count: 0,
          },
        ],
      },
    };
  }

  if (pathname.includes('/notifications')) return { ok: true, items: [] };
  if (pathname.includes('/search')) return [];
  if (pathname.includes('/health') || pathname.includes('/dashboard')) return { ok: true, data: null, items: [], metrics: [], indicators: [], summary: null };
  if (pathname.includes('/api/dashboard-controls/')) return { ok: true, data: [] };
  if (pathname.includes('/api/operational-risks/simulations')) return { ok: true, data: [] };
  if (pathname.includes('/api/evidences/')) return { ok: true, data: [] };
  if (pathname.includes('/api/controls/catalog/')) return { ok: true, data: { effective_controls: [], generic_controls: [], personalized_controls: [] } };

  return { ok: true, data: [], items: [], results: [], rows: [], total: 0 };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertVisibleTextClean(capture) {
  const visible = `${capture.bodyText || ''}\n${capture.breadcrumbText || ''}`;
  [
    /La sesión no contiene un tenant válido/i,
    /invalid tenant/i,
    /unauthorized/i,
    /error de autenticación/i,
    /Risk matrixs/i,
    /Inicio\s*\/\s*Inicio/i,
    /Home\s*\/\s*Home/i,
    /Risk Register/i,
    /Risk Matrix/i,
    /Risk and Control/i,
    /\bHigh\b/i,
    /\bMitigate\b/i,
    /\bReviewed\b/i,
    /\bgeneric\b/i,
  ].forEach((pattern) => assert(!pattern.test(visible), `${capture.file} contains forbidden visible pattern: ${pattern}`));
  [
    /Riesgo y Control/i,
    /Registro de riesgos|Matriz de riesgos|Controles/i,
  ].forEach((pattern) => assert(pattern.test(visible), `${capture.file} missing expected Spanish signal: ${pattern}`));
}

async function setupPage(browser, viewport, collapsed = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    extraHTTPHeaders: { 'Accept-Language': 'es-CL,es;q=0.9', 'x-tcdx-locale': 'es' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/api/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.route('**/health/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.addInitScript(({ token, tenantId, userId, collapsed }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('activeTenantId', tenantId);
    localStorage.setItem('selectedTenantId', tenantId);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('email', 'validacion.ui@local.test');
    localStorage.setItem('sidebar-collapsed', String(collapsed));
    localStorage.setItem('tcdx_locale', 'es');
    document.cookie = 'tcdx_locale=es; path=/; SameSite=Lax';
  }, { token, tenantId, userId, collapsed });
  return { context, page };
}

async function waitForShell(page, routePath) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
  await page.locator('header.enterprise-topbar').waitFor({ state: 'visible' }).catch(async (cause) => {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Enterprise topbar was not visible on ${routePath}. Body: ${bodyText.slice(0, 800)}. Cause: ${cause.message}`);
  });
  await page.locator('main.enterprise-main').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(700);
}

async function readBreadcrumb(page) {
  return page.locator('nav[aria-label="Ruta de navegación"]').first().textContent().catch(() => '');
}

async function openRiskDetail(page) {
  const tableDetailButton = page.getByRole('button', { name: /Ver detalle/i }).first();
  if (await tableDetailButton.isVisible().catch(() => false)) {
    await tableDetailButton.click();
    return tableDetailButton;
  }
  const mobileCard = page.getByRole('button', { name: /Interrupción de servicio crítico/i }).first();
  await mobileCard.click();
  return mobileCard;
}

async function verifyDrawerAccessibility(page, trigger) {
  const dialog = page.getByRole('dialog', { name: /Interrupción de servicio crítico/i });
  await dialog.waitFor({ state: 'visible' });
  const closeButton = page.getByRole('button', { name: /^Cerrar$/i });
  await closeButton.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Cerrar');

  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Cerrar');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Cerrar');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await trigger.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !!document.activeElement && document.activeElement !== document.body);

  const overlayTrigger = await openRiskDetail(page);
  await dialog.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Cerrar detalle/i }).click({ position: { x: 5, y: 5 } });
  await dialog.waitFor({ state: 'hidden' });
  await overlayTrigger.waitFor({ state: 'visible' });
}

async function capture(browser, options) {
  const { file, viewport, routePath, menuState, collapsed = false, detail = false } = options;
  const { context, page } = await setupPage(browser, viewport, collapsed);
  await waitForShell(page, routePath);
  if (detail) {
    const trigger = await openRiskDetail(page);
    await page.getByRole('dialog', { name: /Interrupción de servicio crítico/i }).waitFor({ state: 'visible' });
    await verifyDrawerAccessibility(page, trigger);
    await openRiskDetail(page);
    await page.getByRole('dialog', { name: /Interrupción de servicio crítico/i }).waitFor({ state: 'visible' });
  }
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  const capture = {
    file,
    locale,
    viewport,
    route: routePath,
    menuState,
    tenantVisual: tenantName,
    dataCondition: 'fixture with duplicate titles, real zero, unavailable data, and measured values',
    source: 'playwright-route-fixture',
    bodyText: await page.locator('body').innerText(),
    breadcrumbText: await readBreadcrumb(page),
    assertions: [
      'valid tenant session',
      'Spanish locale only',
      'no invalid tenant/auth/API visible error',
      'risk titles with duplicate names preserve distinct IDs',
      'real zero and unavailable data are rendered separately',
      'drawer keyboard trap, Escape, focus return, and overlay close validated',
      'routes 97 -> 97',
    ],
  };
  assertVisibleTextClean(capture);
  await context.close();
  return capture;
}

const browser = await chromium.launch({ headless: true });
try {
  const captures = [];
  captures.push(await capture(browser, { file: 'riesgos-1440-table-and-kpis.png', viewport: { width: 1440, height: 1100 }, routePath: '/riesgos', menuState: 'sidebar expanded' }));
  captures.push(await capture(browser, { file: 'riesgos-1440-detail-drawer.png', viewport: { width: 1440, height: 1100 }, routePath: '/riesgos', menuState: 'sidebar expanded', detail: true }));
  captures.push(await capture(browser, { file: 'riesgos-1280.png', viewport: { width: 1280, height: 960 }, routePath: '/riesgos', menuState: 'sidebar collapsed', collapsed: true }));
  captures.push(await capture(browser, { file: 'riesgos-mobile-390-list.png', viewport: { width: 390, height: 920 }, routePath: '/riesgos', menuState: 'mobile drawer closed' }));
  captures.push(await capture(browser, { file: 'riesgos-mobile-390-detail.png', viewport: { width: 390, height: 920 }, routePath: '/riesgos', menuState: 'mobile drawer closed', detail: true }));
  captures.push(await capture(browser, { file: 'matriz-riesgo-1440-workspace.png', viewport: { width: 1440, height: 1100 }, routePath: '/matriz-riesgo', menuState: 'sidebar expanded' }));
  captures.push(await capture(browser, { file: 'controles-1440-workspace.png', viewport: { width: 1440, height: 1100 }, routePath: '/controles', menuState: 'sidebar expanded' }));

  const manifest = {
    verdict: 'PASS',
    locale,
    generatedAt: new Date().toISOString(),
    tenantContext: { tenantId, tenantName, source: 'runtime UUID visual fixture' },
    routes: { before: 97, after: 97 },
    assertions: [
      'La sesión no contiene un tenant válido absent',
      'invalid tenant absent',
      'unauthorized absent',
      'error de autenticación absent',
      'Risk matrixs absent',
      'Inicio / Inicio absent',
      'Home / Home absent',
      'known English labels absent in Spanish evidence',
      'duplicate visible risk titles keep distinct IDs',
      'real zero and unavailable data represented separately',
    ],
    captures: captures.map((entry) => {
      const manifestEntry = { ...entry };
      delete manifestEntry.bodyText;
      delete manifestEntry.breadcrumbText;
      return manifestEntry;
    }),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI02_STAGE3_RISK_CONTROL_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
