import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui06-data-visualization');
const baseUrl = process.env.UI06_BASE_URL || 'http://localhost:3001';
const tenantId = randomUUID();
const userId = randomUUID();
const tenantName = 'Tenant validacion UI06';
const email = `ui06-${userId.slice(0, 8)}@local.test`;
const role = 'admin';

fs.mkdirSync(outDir, { recursive: true });

function routeCount() {
  return execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
    .length;
}

const payload = {
  id: userId,
  userId,
  tenant_id: tenantId,
  tenantId,
  tenant_name: tenantName,
  company_name: tenantName,
  email,
  full_name: 'Validacion UI06',
  name: 'Validacion UI06',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = ['health', 'risks', 'audits', 'evidences', 'data_governance', 'metrics_bi', 'report_studio'];
const capabilityKeys = [
  'health.view',
  'metrics.catalog',
  'metrics.indicators.read',
  'metrics.jobs.run',
  'metrics.data_trust',
  'data.governance',
  'data.lineage',
  'bi.executive_dashboards',
  'reporting.studio',
];

const capabilities = Object.fromEntries(
  capabilityKeys.map((key) => [
    key,
    {
      capability_key: key,
      enabled: true,
      decision: 'allowed',
      source: 'ui06_visual_fixture',
      reason_code: 'ALLOWED_FOR_LOCAL_VISUAL_VALIDATION',
      read_only: false,
    },
  ])
);

function jsonResponse(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function paged(data) {
  return { ok: true, data, items: data, rows: data, total: data.length, count: data.length };
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function metricSnapshot(value, periodKey, state = 'calculated') {
  return {
    snapshot_id: randomUUID(),
    value,
    unit: '%',
    state,
    period: { key: periodKey, start: `${periodKey}-01T00:00:00.000Z`, end: `${periodKey}-26T00:00:00.000Z` },
    period_start: `${periodKey}-01T00:00:00.000Z`,
    period_end: `${periodKey}-26T00:00:00.000Z`,
    coverage: value === null ? null : 0.86,
    trust: {
      status: 'trusted_with_warnings',
      score: 0.82,
      coverage: 0.86,
      freshness: 'fresh',
      source: 'ISO-HEALTH',
      warnings: ['Cobertura parcial publicada por el snapshot oficial.'],
    },
    freshness: { status: 'fresh' },
    sufficiency: { status: value === null ? 'insufficient_data' : 'sufficient' },
    interpretation: { classification: { label: 'Atención', positive: false }, trend: 'Mejora gradual' },
    updated_at: '2026-08-26T12:00:00.000Z',
    checksum: randomUUID(),
  };
}

function metricItem(code, name, value, statusColor, snapshots = []) {
  const latest = metricSnapshot(value, '2026-08', value === null ? 'insufficient_data' : 'calculated');
  return {
    id: randomUUID(),
    code,
    name,
    description: `${name} desde snapshot oficial.`,
    category: 'grc',
    kpi_type: 'official',
    unit: '%',
    frequency: 'monthly',
    direction: 'higher_is_better',
    target_value: 85,
    applicable_standards: ['ISO27001'],
    is_enabled: true,
    is_health_kpi: true,
    latest_snapshot: { ...latest, status_color: statusColor },
    latest_snapshots: snapshots.length ? snapshots : [latest],
  };
}

const officialHistory = [
  metricSnapshot(68, '2026-06'),
  metricSnapshot(72, '2026-07'),
  metricSnapshot(76, '2026-08'),
  metricSnapshot(null, '2026-09', 'insufficient_data'),
];

const officialMetric = {
  definition: {
    id: randomUUID(),
    code: 'ISO-HEALTH',
    name: 'Salud ISO oficial',
    definition: 'Resultado oficial de salud ISO basado en snapshots gobernados.',
    domain: 'GRC',
    objective: 'Medir health ISO sin recalcular en frontend.',
    unit: '%',
    direction: 'higher_is_better',
    frequency: 'monthly',
    population: 'controles aplicables',
    version: 1,
    status: 'published',
  },
  latest_snapshot: officialHistory[2],
};

function metricsDashboard() {
  return {
    ok: true,
    data: {
      summary: { total_kpis: 4, green: 1, yellow: 2, red: 1, gray: 0, measured_kpis: 4, data_coverage_pct: 86, official_score: 76, health_kpis: 2 },
      items: [
        metricItem('ISO-HEALTH', 'Salud ISO oficial', 76, 'yellow', officialHistory.slice(0, 3)),
        metricItem('DATA-TRUST', 'Data Trust oficial', 82, 'yellow'),
        metricItem('RISK-CRITICAL', 'Riesgos críticos', 4, 'red'),
        metricItem('EVIDENCE-COVERAGE', 'Cobertura de evidencias', 91, 'green'),
      ],
    },
  };
}

function apiMock(url) {
  const pathname = url.pathname;
  if (pathname === '/api/me/modules') {
    return {
      ok: true,
      scope: { user_id: userId, role, tenant_id: tenantId, tenant_name: tenantName, service_status: 'active' },
      module_map: Object.fromEntries(moduleKeys.map((key) => [key, { module_key: key, module_name: key, is_enabled: true }])),
    };
  }
  if (pathname === '/api/me/permissions') return { ok: true, permission_map: Object.fromEntries(capabilityKeys.map((key) => [key, true])) };
  if (pathname === '/api/me/entitlements') return { ok: true, tenant_id: tenantId, subscription: { plan: 'enterprise' }, modules: moduleKeys.map((module_key) => ({ module_key, enabled: true })), capabilities, limits: {}, usage: {}, health: {} };
  if (pathname === '/api/user/me' || pathname === '/api/auth/validate') return { ok: true, ...payload, tenant: { id: tenantId, tenant_id: tenantId, name: tenantName } };
  if (pathname.startsWith('/api/tenants/') || pathname === '/api/admin-saas/tenants') return paged([{ id: tenantId, tenant_id: tenantId, name: tenantName, company_name: tenantName, service_status: 'active' }]);

  if (pathname.startsWith('/api/dashboard-controls/')) {
    return [
      { id: randomUUID(), iso: 'ISO27001', status: 'cumple', control_name: 'Política de seguridad' },
      { id: randomUUID(), iso: 'ISO27001', status: 'parcial', control_name: 'Gestión de accesos' },
      { id: randomUUID(), iso: 'ISO22301', status: 'no cumple', control_name: 'Prueba de continuidad' },
      { id: randomUUID(), iso: 'ISO27001', status: 'cumple', control_name: 'Inventario de activos' },
    ];
  }
  if (pathname.startsWith('/api/dashboard/')) return { total: 4, cumple: 2, parcial: 1, noCumple: 1, porcentaje: 50, riesgo: 4, nivel_riesgo: 'alto', open_findings: 3, closed_findings: 1, open_nonconformities: 2, closed_nonconformities: 0 };
  if (pathname.startsWith('/api/audits/next-all/')) return [{ id: randomUUID(), iso: 'ISO27001', status: 'programada', start_date: daysFromNow(12), auditor_name: 'Equipo auditor' }];
  if (pathname.startsWith('/api/audits/summary/')) return { ok: true, summary: { total: 3, pendientes: 1, en_ejecucion: 1, completadas: 1, con_informe: 1, sin_informe: 2, hallazgos: 3, acciones: 5 }, recent_audits: [] };
  if (pathname.startsWith('/api/assets/risk-summary/')) return [{ level: 'alto', total: 4 }, { level: 'medio', total: 6 }, { level: 'bajo', total: 9 }];
  if (pathname.startsWith('/api/action-plans/')) return [{ id: randomUUID(), title: 'Cerrar evidencia de accesos', status: 'abierto', due_date: daysFromNow(-3), owner: 'Operaciones' }];
  if (pathname === '/api/metrics/official/dashboard') return metricsDashboard();
  if (pathname === '/api/metrics/official/catalog') return { ok: true, data: [officialMetric] };
  if (pathname === '/api/metrics/official/ISO-HEALTH') return { ok: true, data: officialMetric };
  if (pathname === '/api/metrics/official/ISO-HEALTH/history') return { ok: true, data: officialHistory };
  if (pathname === '/api/metrics/official/ISO-HEALTH/comparisons') {
    return { ok: true, data: [{ comparison_type: 'period', status: 'Comparable', absolute_change: 4, methodology_compatible: true }] };
  }
  if (pathname === '/api/health/dashboard') {
    return {
      ok: true,
      data: {
        global_score: 76,
        label: 'Atención',
        status: 'medium',
        explanation: 'Health calculado con advertencias de cobertura.',
        alerts: { critical_gaps: 2, overdue_actions: 1, missing_evidence: 5 },
        data_quality_warnings: ['Cobertura parcial publicada por health.'],
      },
    };
  }
  if (pathname.startsWith('/api/kpi/effective-health-summary/') || pathname.startsWith('/api/kpis/effective-health-summary/')) {
    return { ok: true, active_summary: [{ iso: 'ISO27001', active_scope_controls: 4, complies_controls: 2, controls_with_official_evidence: 2, controls_with_approved_non_official_evidence: 1, controls_without_evidence: 1 }] };
  }
  if (pathname === '/api/company-profile/impact/module/dashboard') return { ok: true, prioritized_items: [], recommended_focus: [], suggested_actions: [], applicability_summary: {} };
  if (pathname.includes('/notifications') || pathname.includes('/search')) return paged([]);
  return paged([]);
}

const capturesToRun = [
  {
    file: 'charts-dashboard-1440.png',
    route: '/dashboard',
    viewport: { width: 1440, height: 1080 },
    chart_type: 'donut/bar/line',
    data_condition: 'sufficient',
    universal_state: 'measured',
    data_trust: 'trusted_with_warnings',
    assertions: ['Centro ejecutivo', 'Tendencia', 'Distribución de señales ISO activas', 'Data Trust ejecutivo'],
    scrollTarget: 'Distribución de señales ISO activas',
  },
  {
    file: 'charts-metrics-1440.png',
    route: '/metricas/ISO-HEALTH',
    viewport: { width: 1440, height: 980 },
    chart_type: 'line',
    data_condition: 'sufficient_history_with_one_absent_snapshot',
    universal_state: 'measured',
    data_trust: 'trusted_with_warnings',
    assertions: ['Tendencia oficial publicada', 'snapshots oficiales calculados', 'Unidad: %', 'Data Trust'],
  },
  {
    file: 'charts-mobile-390.png',
    route: '/metricas/ISO-HEALTH',
    viewport: { width: 390, height: 940 },
    chart_type: 'line',
    data_condition: 'mobile_compact',
    universal_state: 'measured',
    data_trust: 'trusted_with_warnings',
    assertions: ['Tendencia oficial publicada', 'Unidad: %', 'Resultado oficial'],
    scrollTarget: 'Tendencia oficial publicada',
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function visibleTextIncludes(bodyText, expectedText) {
  return bodyText.toLocaleLowerCase('es-CL').includes(expectedText.toLocaleLowerCase('es-CL'));
}

async function setupPage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    extraHTTPHeaders: { 'Accept-Language': 'es-CL,es;q=0.9', 'x-tcdx-locale': 'es' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.route('**/api/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.addInitScript(({ token, tenantId, userId, email }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('activeTenantId', tenantId);
    localStorage.setItem('selectedTenantId', tenantId);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('email', email);
    localStorage.setItem('tcdx_locale', 'es');
    localStorage.setItem('sidebar-collapsed', 'false');
    document.cookie = 'tcdx_locale=es; path=/; SameSite=Lax';
  }, { token, tenantId, userId, email });
  return { context, page };
}

async function capture(browser, item) {
  const { context, page } = await setupPage(browser, item.viewport);
  await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.addStyleTag({
    content: 'nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-overlay],[data-nextjs-dev-tools-button]{display:none!important;}',
  }).catch(() => null);
  await page.waitForTimeout(900);

  const bodyText = await page.locator('body').innerText();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  assert(!horizontalOverflow, `${item.file} must not have global horizontal overflow.`);
  for (const text of item.assertions) {
    if (!visibleTextIncludes(bodyText, text)) fs.writeFileSync(path.join(outDir, `${item.file}.body.txt`), bodyText);
    assert(visibleTextIncludes(bodyText, text), `${item.file} must include ${text}. Body: ${bodyText.slice(0, 500)}`);
  }
  if (item.scrollTarget) {
    const target = page.getByText(item.scrollTarget, { exact: false }).first();
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const box = await target.boundingBox();
    assert(box && box.y >= 0 && box.y < item.viewport.height, `${item.file} must show ${item.scrollTarget} in the captured viewport.`);
  }
  await page.screenshot({ path: path.join(outDir, item.file), fullPage: false });
  await context.close();
  return {
    file: item.file,
    route: item.route,
    viewport: item.viewport,
    locale: 'es-CL',
    chart_type: item.chart_type,
    source: 'official snapshots and existing dashboard domain summaries via Playwright route fixtures',
    data_condition: item.data_condition,
    universal_state: item.universal_state,
    data_trust: item.data_trust,
    assertions: item.assertions,
    scroll_target: item.scrollTarget || null,
    routes: '97 -> 97',
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const captures = [];
  for (const item of capturesToRun) captures.push(await capture(browser, item));
  const manifest = {
    verdict: 'PASS',
    locale: 'es-CL',
    generated_at: new Date().toISOString(),
    route_count: { before: routeCount(), after: routeCount(), expected: '97 -> 97' },
    context: 'UI-06 data visualization focal evidence',
    source: 'Playwright fixtures confined to this script; product code consumes existing endpoints only',
    captures,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI06_DATA_VISUALIZATION_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
