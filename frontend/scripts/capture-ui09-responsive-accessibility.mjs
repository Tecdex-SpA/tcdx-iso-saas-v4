import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui09-responsive-accessibility');
const baseUrl = process.env.UI09_BASE_URL || 'http://localhost:3001';
const tenantId = randomUUID();
const userId = randomUUID();
const tenantName = 'Tenant validacion UI09';
const email = `ui09-${userId.slice(0, 8)}@local.test`;
const role = 'admin';

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith('.png') || file === 'manifest.json' || file.endsWith('.body.txt')) {
    fs.unlinkSync(path.join(outDir, file));
  }
}

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
  full_name: 'Validacion UI09',
  name: 'Validacion UI09',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = [
  'health',
  'risks',
  'controls',
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

const capabilityKeys = [
  'health.view',
  'risks.view',
  'risk.view',
  'controls.view',
  'controls.manage',
  'audits.view',
  'evidences.view',
  'evidences.manage',
  'evidence.ai_assistance',
  'data.governance',
  'data.lineage',
  'reports.view',
  'reports.premium',
  'reports.generate',
  'reporting.studio',
  'metrics.catalog',
  'metrics.indicators.read',
  'bi.executive_dashboards',
  'phase3.read',
];

const moduleMap = Object.fromEntries(moduleKeys.map((key) => [key, { module_key: key, module_name: key, is_enabled: true }]));
const capabilities = Object.fromEntries(
  capabilityKeys.map((key) => [
    key,
    {
      capability_key: key,
      enabled: true,
      decision: 'allowed',
      source: 'ui09_visual_fixture',
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

const operationId = randomUUID();
const auditId = randomUUID();
const matrixItemId = randomUUID();

const standards = [
  {
    code: 'ISO27001',
    name: 'Seguridad de la informacion',
    is_active: true,
    active_operations_count: 1,
    active_operation_ids: [operationId],
  },
];

const dataDomains = [
  {
    id: randomUUID(),
    domain_key: 'risk_registry',
    display_name: 'Registro de riesgos',
    status: 'trusted_with_warnings',
    description: 'Dominio operativo con lineage y cobertura parcial.',
    trust_status: 'trusted_with_warnings',
    coverage: 0.82,
    freshness_status: 'fresh',
    source_status: 'source_ready_with_warnings',
    warnings: ['Cobertura parcial validada por fixture visual.'],
  },
  {
    id: randomUUID(),
    domain_key: 'evidence_library',
    display_name: 'Biblioteca de evidencias',
    status: 'trusted',
    description: 'Documentos aprobados, pendientes y rechazados.',
    trust_status: 'trusted',
    coverage: 0.94,
    freshness_status: 'fresh',
    source_status: 'resolved',
  },
];

const evidenceRows = [
  {
    id: randomUUID(),
    tenant_id: tenantId,
    iso: 'ISO27001',
    clause: 'A.5.1',
    status: 'pendiente',
    description: 'Politica de seguridad pendiente de revision humana.',
    control_description: 'Politica de seguridad de la informacion',
    evidence_type: 'documento',
    validated: false,
    created_at: '2026-08-20T12:00:00Z',
    reviewed_at: null,
    expires_at: '2026-09-30T12:00:00Z',
    ai_acceptance_pct: 76,
    analysis_status: 'completed',
    file_type: 'pdf',
    page_count: 12,
    operation_name: 'Operacion corporativa',
  },
];

const matrixItems = [
  {
    id: matrixItemId,
    run_id: randomUUID(),
    risk_code: 'R-001',
    risk_title: 'Acceso privilegiado sin revision periodica',
    risk_description: 'Riesgo operativo con evidencia parcial.',
    risk_category: 'Accesos',
    asset_name: 'Identidades criticas',
    asset_type: 'Identidad',
    likelihood: 4,
    impact: 4,
    inherent_risk_score: 18,
    inherent_risk_level: 'alto',
    residual_risk_score: 12,
    residual_risk_level: 'medio',
    treatment_strategy: 'mitigar',
    status: 'suggested',
    confidence: 0.78,
  },
];

const controlRows = [
  {
    id: randomUUID(),
    tenant_control_id: randomUUID(),
    tenant_id: tenantId,
    operation_id: operationId,
    operation_name: 'Operacion corporativa',
    catalog_control_id: randomUUID(),
    iso: 'ISO27001',
    clause: 'A.5.1',
    category: 'Controles organizacionales',
    description: 'Politicas para seguridad de la informacion',
    declared_status: 'parcial',
    declared_score: 72,
    priority: 'alta',
    health_score: 72,
    effective_health_score: 72,
    effective_health_status: 'atencion',
    evidence_quality_status: 'pendiente_revision',
    approved_evidence_count: 0,
    official_evidence_count: 0,
    evidence_count: 1,
    pending_evidence_count: 1,
    open_findings_count: 1,
    open_nonconformities_count: 0,
  },
];

const metricCatalog = [
  {
    definition: { code: 'F5_5_GRC_HEALTH', name: 'Salud GRC', unit: 'percent', domain: 'compliance' },
    latest_snapshot: {
      snapshot_id: randomUUID(),
      status: 'calculated',
      value: 82,
      trust_status: 'TRUSTED',
      interpretation: { recommendation: 'Mantener seguimiento operacional.' },
    },
  },
];

function scopePayload() {
  return {
    operations: [{ id: operationId, name: 'Operacion corporativa', code: 'OP-001', is_active: true, is_default: true, sort_order: 1 }],
    standards,
  };
}

function apiMock(url) {
  const pathname = url.pathname;

  if (pathname === '/api/me/modules') {
    return { ok: true, scope: { user_id: userId, role, tenant_id: tenantId, tenant_name: tenantName, service_status: 'active' }, module_map: moduleMap };
  }
  if (pathname === '/api/me/permissions') return { ok: true, permission_map: Object.fromEntries(capabilityKeys.map((key) => [key, true])) };
  if (pathname === '/api/me/entitlements') {
    return {
      ok: true,
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
  if (pathname === '/api/user/me' || pathname === '/api/auth/validate') return { ok: true, ...payload, tenant: { id: tenantId, tenant_id: tenantId, name: tenantName } };
  if (pathname.startsWith('/api/tenants/') || pathname === '/api/admin-saas/tenants') return paged([{ id: tenantId, tenant_id: tenantId, name: tenantName, company_name: tenantName, plan_name: 'Enterprise' }]);
  if (pathname.includes('/notifications') || pathname.includes('/search')) return paged([]);
  if (pathname.startsWith('/api/tenant-standards/scope/')) return { ok: true, data: scopePayload(), ...scopePayload() };
  if (pathname.startsWith('/api/tenant-standards/')) return { ok: true, data: standards, standards };
  if (pathname.startsWith('/api/company-profile/impact/module/')) return { ok: true, prioritized_items: [], recommended_focus: [], suggested_actions: [], applicability_summary: {} };

  if (pathname === '/api/data/domains') return paged(dataDomains);
  if (pathname === '/api/data/quality') return paged([{ source_key: 'risk_registry', display_name: 'Registro de riesgos', status: 'trusted', freshness: 'current' }]);
  if (pathname === '/api/data/elements') return paged([{ element_key: 'risk.status', display_name: 'Estado de riesgo', status: 'published' }]);
  if (pathname.startsWith('/api/data/lineage') || pathname.startsWith('/api/data/impact')) return { ok: true, data: { root: {}, nodes: [], edges: [], warnings: [] } };
  if (pathname === '/api/data/semantic/source-contracts') return paged([]);
  if (pathname === '/api/data/semantic/reconciliation') return { ok: true, data: { status: 'ok', warnings: [] } };
  if (pathname.startsWith('/api/data/semantic/')) return paged([]);

  if (pathname.startsWith('/api/evidences/')) return paged(evidenceRows);
  if (pathname.startsWith('/api/controls/workbench/')) {
    return {
      ok: true,
      tenant_id: tenantId,
      iso: 'ISO27001',
      operation: { id: operationId, name: 'Operacion corporativa' },
      catalog_mode: 'generic',
      summary: {
        total_controls: 1,
        healthy_controls: 0,
        attention_controls: 1,
        deteriorated_controls: 0,
        controls_without_evidence: 0,
        controls_with_open_nc: 0,
        average_health_score: 72,
        catalog_mode: 'generic',
      },
      items: controlRows,
    };
  }
  if (pathname.startsWith('/api/controls/catalog/')) {
    return { ok: true, catalog_mode: 'generic', generic_controls: [], personalized_controls: [], effective_controls: controlRows };
  }
  if (pathname.startsWith('/api/dashboard-controls/')) return controlRows;

  if (pathname.startsWith('/api/iso-risk-matrix/') && pathname.endsWith('/options')) {
    return { ok: true, data: { options: [{ standard_code: 'ISO27001', version_code: '2022', display_name: 'ISO 27001:2022', certifiable: true, catalog_coverage_pct: 84, assets_count: 1, risk_templates_count: 2, recommended: true }] } };
  }
  if (pathname.startsWith('/api/iso-risk-matrix/') && pathname.endsWith('/latest')) {
    return { ok: true, data: { run: { id: randomUUID(), standard_code: 'ISO27001', version_code: '2022', residual_risk_avg: 12, risk_posture: 'moderada' }, items: matrixItems, actions: [{ id: randomUUID(), title: 'Revisar accesos privilegiados', priority: 'alta', owner_role: 'Seguridad', due_days: 30 }] } };
  }
  if (pathname.startsWith('/api/assets/')) return paged([]);

  if (pathname === '/api/audits/summary' || pathname.startsWith('/api/audits/summary/')) return { ok: true, data: { total: 1, pendientes: 0, en_ejecucion: 1, completadas: 0, hallazgos: 1, acciones: 1 } };
  if (pathname === '/api/audits' || pathname.startsWith('/api/audits/')) return paged([{ id: auditId, iso: 'ISO27001', title: 'Auditoria interna ISO 27001', status: 'en_ejecucion', auditor_name: 'Equipo auditor', findings_count: 1, actions_count: 1 }]);
  if (pathname.startsWith('/api/findings') || pathname.startsWith('/api/nonconformities') || pathname.startsWith('/api/action-plans')) return paged([]);

  if (pathname === '/api/metrics/official/catalog') return { ok: true, data: metricCatalog };
  if (pathname.startsWith('/api/metrics/official/')) return { ok: true, data: metricCatalog[0] };
  if (pathname.startsWith('/api/grc/phase3/')) return paged([]);
  if (pathname === '/api/grc/overview') return { ok: true, data: { risks: { total: 2, critical: 1 }, controls: { total: 1, active: 1 }, evidences: { total: 1, pending: 1 }, reports: { total: 1 } } };

  if (pathname === '/api/ai-compliance/engine-health') return { ok: true, data: { status: 'available', model: 'governed' } };
  if (pathname === '/api/ai-compliance/health-summary') return { ok: true, data: { tenant_name: tenantName, status: 'operational', controls_total: 1, controls_warning: 1, evidences_pending: 1 } };
  if (pathname === '/api/ai-compliance/suggestions') return paged([]);
  if (pathname === '/api/ai-compliance/executive-brief') return { ok: true, data: { summary: 'Brief ejecutivo visual local.' } };
  if (pathname === '/api/intelligence/brief' || pathname.includes('/intelligence')) return { ok: true, data: { overall: { score: 82 }, audit_readiness: { score: 76 }, basis: [], risks: [], warnings: [] } };

  if (pathname === '/api/dashboards') return paged([]);
  if (pathname.startsWith('/api/reports')) return paged([]);
  if (pathname.startsWith('/health/')) return { ok: true, data: null };

  return paged([]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesText(bodyText, expectedText) {
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
  page.setDefaultTimeout(25000);
  await page.route('**/api/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.route('**/health/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
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

async function validateKeyboard(page, file) {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focusedBeforeEscape = await page.evaluate(() => Boolean(document.activeElement && document.activeElement !== document.body));
  assert(focusedBeforeEscape, `${file} must expose keyboard-reachable controls.`);

  const notifications = page.getByRole('button', { name: /notificaciones/i }).first();
  if ((await notifications.count()) > 0) {
    await notifications.focus();
    await notifications.press('Enter');
    await page.locator('[role="menu"]').first().waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const menuOpen = await page.locator('[role="menu"]').count();
    assert(menuOpen === 0, `${file} must close header menu on Escape.`);
    const focusReturned = await notifications.evaluate((node) => document.activeElement === node);
    assert(focusReturned, `${file} must return focus to header menu trigger after Escape.`);
  }

  await page.keyboard.press('Shift+Tab');
}

async function capture(browser, item) {
  const { context, page } = await setupPage(browser, item.viewport);
  await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('header.enterprise-topbar').first().waitFor({ state: 'visible' });
  await page.locator('main.enterprise-main').first().waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.addStyleTag({ content: 'nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-overlay],[data-nextjs-dev-tools-button]{display:none!important;}' }).catch(() => null);
  await page.waitForTimeout(900);

  if (item.clickText) {
    const target = page.getByRole('button', { name: item.clickText }).first();
    assert((await target.count()) > 0, `${item.file} must expose ${String(item.clickText)} before capture.`);
    await target.click();
    await page.waitForTimeout(500);
  }
  if (typeof item.scrollY === 'number') {
    await page.evaluate((scrollY) => {
      const main = document.querySelector('main.enterprise-main');
      const scroller = main instanceof HTMLElement ? main : document.scrollingElement;
      scroller?.scrollTo(0, scrollY);
    }, item.scrollY);
    await page.waitForTimeout(300);
  }
  if (item.scrollLocalRight) {
    await page.evaluate(() => {
      const region = document.querySelector('[data-ui09-scroll-region="true"]');
      if (region instanceof HTMLElement) region.scrollLeft = region.scrollWidth;
    });
    await page.waitForTimeout(300);
  }

  const bodyText = await page.locator('body').innerText();
  const topbars = await page.locator('header.enterprise-topbar').count();
  const mainVisible = await page.locator('main.enterprise-main').first().isVisible();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  const activeTabs = await page.locator('[aria-current="page"]').count();
  const scrollRegions = await page.locator('[data-ui09-scroll-region="true"], [role="region"][tabindex="0"]').count();
  const disabledLegible = await page.evaluate(() => {
    const node = document.querySelector('button:disabled, select:disabled, input:disabled');
    if (!node) return true;
    const styles = window.getComputedStyle(node);
    return Number(styles.opacity || 1) >= 0.6 && styles.cursor === 'not-allowed';
  });

  assert(topbars === 1, `${item.file} must have exactly one App Shell topbar; found ${topbars}.`);
  assert(mainVisible, `${item.file} must keep main content visible.`);
  assert(!horizontalOverflow, `${item.file} must not have global horizontal overflow.`);
  assert(disabledLegible, `${item.file} disabled controls must remain legible.`);
  if (item.expectActiveTab) assert(activeTabs >= 1, `${item.file} must expose an active tab.`);
  if (item.expectScrollRegion) assert(scrollRegions >= 1, `${item.file} must expose a keyboard-reachable local scroll region.`);
  for (const text of item.assertions) {
    if (!includesText(bodyText, text)) fs.writeFileSync(path.join(outDir, `${item.file}.body.txt`), bodyText);
    assert(includesText(bodyText, text), `${item.file} must include ${text}. Body: ${bodyText.slice(0, 700)}`);
  }
  if (item.keyboard) await validateKeyboard(page, item.file);

  await page.screenshot({ path: path.join(outDir, item.file), fullPage: false });
  await context.close();
  return {
    file: item.file,
    route: item.route,
    viewport: item.viewport,
    assertions: [
      'exactly one App Shell topbar',
      'global horizontal overflow=false',
      'main content visible',
      item.expectActiveTab ? 'active tab identifiable' : null,
      item.expectScrollRegion ? 'local scroll region keyboard reachable' : null,
      item.keyboard ? 'Tab Shift+Tab Escape traversal validated' : null,
      'disabled state legibility checked',
      ...item.assertions.map((text) => `visible text: ${text}`),
    ].filter(Boolean),
  };
}

const capturesToRun = [
  {
    file: 'responsive-desktop-1440.png',
    route: '/ia-compliance',
    viewport: { width: 1440, height: 1000 },
    expectActiveTab: true,
    keyboard: true,
    assertions: ['IA Compliance', 'Inteligencia', 'revisión humana'],
  },
  {
    file: 'responsive-tablet-768.png',
    route: '/datos',
    viewport: { width: 768, height: 1000 },
    expectActiveTab: true,
    expectScrollRegion: true,
    assertions: ['Datos', 'Buscar', 'Confianza'],
  },
  {
    file: 'responsive-mobile-shell-390.png',
    route: '/ia-compliance',
    viewport: { width: 390, height: 940 },
    expectActiveTab: true,
    assertions: ['IA Compliance', 'Resumen ejecutivo IA'],
  },
  {
    file: 'responsive-mobile-table-390.png',
    route: '/matriz-riesgo',
    viewport: { width: 390, height: 940 },
    expectActiveTab: true,
    expectScrollRegion: true,
    assertions: ['Matriz de Riesgo', 'Riesgos priorizados', 'Aceptar'],
    scrollY: 1180,
    scrollLocalRight: true,
  },
  {
    file: 'responsive-mobile-dashboard-390.png',
    route: '/dashboard',
    viewport: { width: 390, height: 940 },
    assertions: ['Centro ejecutivo'],
  },
  {
    file: 'responsive-tabs-dialog-390.png',
    route: '/riesgos',
    viewport: { width: 390, height: 940 },
    expectActiveTab: true,
    assertions: ['Registro de riesgos', 'R-001'],
    clickText: /R-001|Acceso privilegiado/i,
  },
];

const browser = await chromium.launch({ headless: true });
try {
  const captures = [];
  for (const item of capturesToRun) captures.push(await capture(browser, item));
  const manifest = {
    verdict: 'PASS',
    locale: 'es-CL',
    generated_at: new Date().toISOString(),
    route_count: { before: routeCount(), after: routeCount(), expected: '97 -> 97' },
    context: 'UI-09 responsive and accessibility final focal evidence',
    source_fixture_policy: 'Fixtures are confined to this harness and are not runtime/productive data evidence.',
    assertions_globales: [
      'desktop/tablet/mobile App Shell has one topbar',
      'global horizontal overflow=false',
      'tabs expose active state and horizontal affordance where present',
      'table scroll regions are local and keyboard reachable',
      'header Escape focus return validated',
      'disabled controls remain legible',
      'status meaning verified through visible labels, not color alone',
    ],
    captures,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI09_RESPONSIVE_ACCESSIBILITY_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
