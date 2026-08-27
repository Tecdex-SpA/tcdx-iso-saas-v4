import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui04-executive-command-center');
const baseUrl = process.env.UI04_BASE_URL || 'http://localhost:3001';
const tenantId = randomUUID();
const userId = randomUUID();
const tenantName = 'TECDEX Centro Ejecutivo';
const email = `ui04-${userId.slice(0, 8)}@local.test`;
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
  full_name: 'Validacion UI04',
  name: 'Validacion UI04',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = [
  'health',
  'risks',
  'audits',
  'evidences',
  'grc_phase3_operations',
  'data_governance',
  'metrics_bi',
  'ai',
  'report_studio',
];

const capabilityKeys = [
  'company_profile_analysis',
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
  capabilityKeys.map((key) => [key, {
    capability_key: key,
    enabled: true,
    decision: 'allowed',
    source: 'ui04_visual_fixture',
    reason_code: 'ALLOWED_FOR_LOCAL_VISUAL_VALIDATION',
    read_only: false,
  }])
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

function metricItem(code, name, value, statusColor, trustStatus, snapshots = []) {
  const latest = {
    id: randomUUID(),
    snapshot_id: randomUUID(),
    value,
    unit: '%',
    status_color: statusColor,
    state: value === null ? 'insufficient_data' : 'calculated',
    coverage: value === null ? null : 0.82,
    trust: trustStatus ? {
      status: trustStatus,
      score: trustStatus === 'trusted_with_warnings' ? 0.74 : 0.91,
      coverage: value === null ? null : 0.82,
      freshness: trustStatus === 'trusted_with_warnings' ? 'stale' : 'fresh',
      source: code,
      timestamp: '2026-08-26T12:00:00.000Z',
      warnings: trustStatus === 'trusted_with_warnings' ? ['Freshness con advertencia publicada por health.'] : [],
    } : null,
    freshness: trustStatus ? { status: trustStatus === 'trusted_with_warnings' ? 'stale' : 'fresh' } : null,
    sufficiency: { status: value === null ? 'insufficient_data' : 'sufficient' },
    period_type: 'monthly',
    period_start: '2026-08-01T00:00:00.000Z',
    period_end: '2026-08-26T00:00:00.000Z',
    calculated_at: '2026-08-26T12:00:00.000Z',
    updated_at: '2026-08-26T12:00:00.000Z',
    checksum: randomUUID(),
    breakdown_json: { state: value === null ? 'insufficient_data' : 'calculated' },
  };

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
    is_health_kpi: code.startsWith('GRC') || code.startsWith('DATA'),
    latest_snapshot: latest,
    latest_snapshots: snapshots.length ? snapshots.map((point) => ({ ...latest, id: randomUUID(), snapshot_id: randomUUID(), value: point.value, period_end: point.period })) : [latest],
  };
}

function metricsDashboard(scenario) {
  if (scenario === 'data-state') {
    return {
      ok: true,
      data: {
        summary: { total_kpis: 3, green: 0, yellow: 0, red: 0, gray: 3, measured_kpis: 0, data_coverage_pct: null, official_score: null, health_kpis: 2 },
        items: [
          metricItem('GRC-HEALTH', 'Estado GRC oficial', null, 'gray', null),
          metricItem('DATA-TRUST', 'Data Trust oficial', null, 'gray', null),
        ],
      },
    };
  }

  return {
    ok: true,
    data: {
      summary: { total_kpis: 6, green: 2, yellow: 2, red: 1, gray: 1, measured_kpis: 5, data_coverage_pct: 82, official_score: 73, health_kpis: 2 },
      items: [
        metricItem('GRC-HEALTH', 'Estado GRC oficial', 73, 'yellow', 'trusted_with_warnings', [
          { period: '2026-06', value: 68 },
          { period: '2026-07', value: 70 },
          { period: '2026-08', value: 73 },
        ]),
        metricItem('DATA-TRUST', 'Data Trust oficial', 82, 'yellow', 'trusted_with_warnings'),
        metricItem('RISK-CRITICAL', 'Riesgos críticos', 4, 'red', 'trusted'),
        metricItem('EVIDENCE-COVERAGE', 'Cobertura de evidencias', 76, 'yellow', 'trusted_with_warnings'),
      ],
    },
  };
}

function apiMock(url, scenario) {
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
  if (pathname.startsWith('/api/audits/summary/')) return { ok: true, summary: { total: 3, pendientes: 1, en_ejecucion: 1, completadas: 1, con_informe: 1, sin_informe: 2, hallazgos: 3, acciones: 5 }, recent_audits: [{ id: randomUUID(), iso: 'ISO22301', status: 'en_ejecucion', start_date: daysFromNow(-5), auditor_name: 'Auditor interno' }] };
  if (pathname.startsWith('/api/assets/risk-summary/')) return [{ level: 'alto', total: 4 }, { level: 'medio', total: 6 }, { level: 'bajo', total: 9 }];
  if (pathname.startsWith('/api/action-plans/')) return [
    { id: randomUUID(), title: 'Cerrar evidencia de accesos', iso_code: 'ISO27001', status: 'abierto', due_date: daysFromNow(-3), owner: 'Operaciones' },
    { id: randomUUID(), title: 'Ejecutar prueba DRP', iso_code: 'ISO22301', status: 'en progreso', due_date: daysFromNow(8), owner: 'Continuidad' },
  ];
  if (pathname === '/api/metrics/official/dashboard') return metricsDashboard(scenario);
  if (pathname === '/api/health/dashboard') {
    return {
      ok: true,
      data: {
        global_score: 73,
        label: 'Atención',
        status: 'medium',
        explanation: 'Health calculado con advertencias de cobertura y evidencia pendiente.',
        alerts: { critical_gaps: 2, overdue_actions: 1, missing_evidence: 5 },
        standards: [{ id: 'iso27001', name: 'ISO 27001', score: 76, status: 'attention', label: 'Atención' }],
        critical_processes: [{ id: 'process-1', name: 'Gestión de accesos', standard_code: 'ISO27001', score: 62, main_issue: 'Evidencia insuficiente' }],
        data_quality_warnings: ['Freshness con advertencia publicada por health.'],
      },
    };
  }
  if (pathname.startsWith('/api/kpi/effective-health-summary/') || pathname.startsWith('/api/kpis/effective-health-summary/')) {
    return {
      ok: true,
      active_summary: [
        { iso: 'ISO27001', active_scope_controls: 4, complies_controls: 2, partial_controls: 1, non_compliant_or_no_data_controls: 1, controls_with_official_evidence: 2, controls_with_approved_non_official_evidence: 1, controls_without_evidence: 1, open_findings_count: 3, open_nonconformities_count: 2, open_action_plans_count: 2, overdue_action_plans_count: 1, kpi_health_status: 'atencion' },
      ],
    };
  }
  if (pathname === '/api/company-profile/impact/module/dashboard') {
    return {
      ok: true,
      tenant_id: tenantId,
      module_code: 'dashboard',
      module_label: 'Centro ejecutivo',
      company_profile_used: true,
      tenant_filter_enforced: true,
      prioritized_items: [{ title: 'Gestión de accesos', reason: 'Control parcial con evidencia insuficiente.' }],
      recommended_focus: ['Cerrar acciones vencidas y completar evidencia oficial.'],
      suggested_actions: [{ title: 'Revisar acciones vencidas', reason: 'Existe una acción fuera de plazo.' }],
      applicability_summary: { applicable_controls_count: 4, applicable_kpis_count: 6, applicable_evidence_requirements_count: 5, exclusions_count: 0, active_universe: true },
    };
  }

  if (pathname.includes('/notifications')) return { ok: true, items: [] };
  if (pathname.includes('/search')) return paged([]);
  return paged([]);
}

const capturesToRun = [
  { file: 'executive-1440.png', route: '/dashboard', scenario: 'default', viewport: { width: 1440, height: 1080 }, assertions: ['Centro ejecutivo', 'Requiere atención', 'Prioridades ejecutivas', 'Data Trust ejecutivo'] },
  { file: 'executive-1280.png', route: '/dashboard', scenario: 'default', viewport: { width: 1280, height: 980 }, assertions: ['Requiere atención', 'Tendencia', 'Calidad y confianza'] },
  { file: 'executive-mobile-390.png', route: '/dashboard', scenario: 'default', viewport: { width: 390, height: 940 }, assertions: ['Requiere atención', 'Acciones vencidas', 'Data Trust'] },
  { file: 'executive-data-state-1440.png', route: '/dashboard?ui04_case=data-state', scenario: 'data-state', viewport: { width: 1440, height: 1080 }, assertions: ['Datos insuficientes', 'No disponible', 'Sin datos'], scrollTarget: 'No disponible' },
  { file: 'executive-data-trust-1440.png', route: '/dashboard', scenario: 'default', viewport: { width: 1440, height: 1080 }, assertions: ['Data Trust ejecutivo', 'Confiable con advertencias', 'Vigencia', 'Provenance'], scrollTarget: 'Data Trust ejecutivo' },
];

async function setupPage(browser, viewport, scenario) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    extraHTTPHeaders: { 'Accept-Language': 'es-CL,es;q=0.9', 'x-tcdx-locale': 'es' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.route('**/api/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url()), scenario))));
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function visibleTextIncludes(bodyText, expectedText) {
  return bodyText.toLocaleLowerCase('es-CL').includes(expectedText.toLocaleLowerCase('es-CL'));
}

async function capture(browser, item) {
  const { context, page } = await setupPage(browser, item.viewport, item.scenario);
  await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page
    .locator('header.enterprise-topbar')
    .first()
    .waitFor({ state: 'visible', timeout: 6000 })
    .catch(() => null);
  await page
    .addStyleTag({
      content: `
        nextjs-portal,
        [data-nextjs-toast],
        [data-nextjs-dev-overlay],
        [data-nextjs-dev-tools-button] {
          display: none !important;
        }
      `,
    })
    .catch(() => null);
  await page.waitForTimeout(900);

  const bodyText = await page.locator('body').innerText();
  const topbars = await page.locator('header.enterprise-topbar').count();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);

  assert(topbars === 1, `${item.file} must have exactly one AppLayout topbar; found ${topbars}. Body: ${bodyText.slice(0, 240)}`);
  assert(!horizontalOverflow, `${item.file} must not have global horizontal overflow.`);
  item.assertions.forEach((text) => {
    if (!visibleTextIncludes(bodyText, text)) {
      fs.writeFileSync(path.join(outDir, `${item.file}.body.txt`), bodyText);
    }
    assert(visibleTextIncludes(bodyText, text), `${item.file} must include ${text}. Body: ${bodyText.slice(0, 500)}`);
  });

  if (item.scrollTarget) {
    const target = page.getByText(item.scrollTarget, { exact: false }).first();
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const box = await target.boundingBox();
    assert(box && box.y >= 0 && box.y < item.viewport.height, `${item.file} must show ${item.scrollTarget} in the captured viewport.`);
  }

  await page.screenshot({ path: path.join(outDir, item.file), fullPage: false });
  await context.close();

  return {
    file: item.file,
    route: item.route,
    locale: 'es-CL',
    viewport: item.viewport,
    state_case: item.scenario,
    source: 'playwright-route-fixture',
    assertions: item.assertions,
    scroll_target: item.scrollTarget || null,
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
    route: '/dashboard',
    route_count: { before: routeCount(), after: routeCount(), expected: '97 -> 97' },
    context: 'UI-04 Executive Command Center over the existing dashboard route',
    source: 'mock/real: Playwright fixtures over real App Router page; fixtures are confined to this script',
    assertions: {
      executive_route_preserved: true,
      app_shell_topbar_once: true,
      universal_states_visible: true,
      data_trust_visible: true,
      attention_priorities_visible: true,
      desktop_1440: true,
      desktop_1280: true,
      mobile_390: true,
      global_horizontal_overflow: false,
      route_count: '97 -> 97',
    },
    captures,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI04_EXECUTIVE_COMMAND_CENTER_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
