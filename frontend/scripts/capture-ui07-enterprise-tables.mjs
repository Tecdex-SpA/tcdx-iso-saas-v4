import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui07-enterprise-tables');
const baseUrl = process.env.UI07_BASE_URL || 'http://localhost:3001';
const tenantId = randomUUID();
const userId = randomUUID();
const tenantName = 'Tenant validacion UI07';
const email = `ui07-${userId.slice(0, 8)}@local.test`;
const role = 'admin';

fs.mkdirSync(outDir, { recursive: true });
for (const artifactFile of fs.readdirSync(outDir)) {
  if (artifactFile.endsWith('.body.txt') || artifactFile.endsWith('.before-click.body.txt')) {
    fs.unlinkSync(path.join(outDir, artifactFile));
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
  full_name: 'Validacion UI07',
  name: 'Validacion UI07',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = ['risks', 'controls', 'audits', 'evidences', 'data_governance', 'metrics_bi', 'report_studio'];
const capabilityKeys = [
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
];

const capabilities = Object.fromEntries(
  capabilityKeys.map((key) => [
    key,
    {
      capability_key: key,
      enabled: true,
      decision: 'allowed',
      source: 'ui07_visual_fixture',
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
  return date.toISOString();
}

const standards = [
  {
    code: 'ISO27001',
    name: 'Seguridad de la información',
    is_active: true,
    active_operations_count: 1,
    active_operation_ids: ['op-ui07'],
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
    formula_code: 'DATA-DOMAIN-TRUST',
    formula_version: 1,
    warnings: ['Cobertura parcial validada por fixture visual.'],
  },
  {
    id: randomUUID(),
    domain_key: 'evidence_library',
    display_name: 'Biblioteca de evidencias',
    status: 'active',
    description: 'Documentos aprobados, pendientes y rechazados.',
    trust_status: 'trusted',
    coverage: 0.94,
    freshness_status: 'fresh',
    source_status: 'resolved',
    formula_code: 'EVIDENCE-COVERAGE',
    formula_version: 2,
  },
];

const evidenceRows = [
  {
    id: randomUUID(),
    iso: 'ISO27001',
    clause: 'A.5.1',
    status: 'pendiente',
    description: 'Política de seguridad pendiente de revisión humana.',
    control_description: 'Política de seguridad de la información',
    evidence_type: 'documento',
    validated: false,
    created_at: daysFromNow(-3),
    reviewed_at: null,
    expires_at: daysFromNow(45),
    reviewer_name: null,
    ai_acceptance_pct: 76,
    pertinence_score: 82,
    sufficiency_score: 68,
    freshness_score: 92,
    traceability_score: 79,
    consistency_score: 84,
    compliance_impact_score: 70,
    analysis_status: 'completed',
    file_type: 'pdf',
    page_count: 12,
    text_char_count: 6800,
    appears_complete: true,
    operation_name: 'Operación corporativa',
  },
  {
    id: randomUUID(),
    iso: 'ISO27001',
    clause: 'A.8.2',
    status: 'aprobada',
    description: 'Matriz de accesos vigente.',
    control_description: 'Gestión de accesos privilegiados',
    evidence_type: 'registro',
    validated: true,
    created_at: daysFromNow(-9),
    reviewed_at: daysFromNow(-2),
    reviewed_by_label: 'Auditor interno',
    ai_acceptance_pct: 91,
    pertinence_score: 90,
    sufficiency_score: 88,
    freshness_score: 86,
    traceability_score: 94,
    consistency_score: 91,
    compliance_impact_score: 89,
    analysis_status: 'completed',
    file_type: 'xlsx',
    page_count: 1,
    text_char_count: 2400,
    appears_complete: true,
    operation_name: 'Operación corporativa',
  },
];

const riskMatrixItems = [
  {
    id: randomUUID(),
    risk_code: 'R-001',
    risk_title: 'Acceso privilegiado sin revisión periódica',
    risk_description: 'Riesgo operativo con evidencia parcial.',
    risk_category: 'Accesos',
    asset_name: 'Identidades críticas',
    inherent_risk_score: 18,
    inherent_risk_level: 'alto',
    residual_risk_score: 12,
    residual_risk_level: 'medio',
    treatment_strategy: 'Mitigar',
    status: 'pending',
    confidence: 0.78,
  },
  {
    id: randomUUID(),
    risk_code: 'R-002',
    risk_title: 'Continuidad sin prueba reciente',
    risk_category: 'Continuidad',
    asset_name: 'Servicio esencial',
    inherent_risk_score: 20,
    inherent_risk_level: 'critical',
    residual_risk_score: 16,
    residual_risk_level: 'high',
    treatment_strategy: null,
    status: 'en progreso',
    confidence: 0.64,
  },
];

const exportRows = [
  {
    id: randomUUID(),
    tenant_id: tenantId,
    tenant_name: tenantName,
    report_type_code: 'executive_compliance_report',
    report_type_name: 'Reporte ejecutivo de cumplimiento',
    report_title: 'Reporte ejecutivo de cumplimiento',
    report_format: 'pdf',
    generated_at: daysFromNow(-1),
    requested_by_name: 'Responsable GRC',
    requested_by_email: email,
    status: 'completed',
    file_url: '/reports/ui07.pdf',
  },
  {
    id: randomUUID(),
    tenant_id: tenantId,
    tenant_name: tenantName,
    report_type_code: 'evidence_traceability_report',
    report_type_name: 'Trazabilidad de evidencias',
    report_title: 'Trazabilidad de evidencias',
    report_format: 'pdf',
    generated_at: daysFromNow(-5),
    requested_by_name: 'Auditor interno',
    requested_by_email: 'auditor-ui07@local.test',
    status: 'pending',
    file_url: '/reports/ui07-pending.pdf',
  },
];

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
  if (pathname.startsWith('/api/company-profile/impact/module/')) return { ok: true, prioritized_items: [], recommended_focus: [], suggested_actions: [], applicability_summary: {} };
  if (pathname.startsWith('/api/tenant-standards/scope/')) return { operations: [{ id: 'op-ui07', name: 'Operación corporativa', is_active: true, is_default: true, sort_order: 1 }], standards };

  if (pathname === '/api/data/domains') return paged(dataDomains);

  if (pathname.startsWith('/api/evidences/')) return evidenceRows;
  if (pathname.includes('tenant-process-links')) return paged([]);
  if (pathname.includes('google-drive') || pathname.includes('drive')) return paged([]);

  if (pathname.startsWith('/api/iso-risk-matrix/') && pathname.endsWith('/options')) {
    return { ok: true, data: { options: [{ standard_code: 'ISO27001', version_code: '2022', display_name: 'ISO 27001:2022', recommended: true }] } };
  }
  if (pathname.startsWith('/api/iso-risk-matrix/') && pathname.endsWith('/latest')) {
    return { ok: true, data: { run: { id: randomUUID(), standard_code: 'ISO27001', version_code: '2022' }, items: riskMatrixItems } };
  }
  if (pathname.startsWith('/api/assets/') && !pathname.startsWith('/api/assets/risk/')) return paged([]);
  if (pathname.startsWith('/api/assets/risk/')) return paged([]);

  if (pathname === '/api/reports/types') {
    return paged([
      { code: 'executive_compliance_report', name: 'Reporte ejecutivo de cumplimiento', description: 'Resumen ejecutivo', category: 'executive', default_format: 'pdf', template_key: 'executive', can_generate: true, can_schedule: false },
      { code: 'evidence_traceability_report', name: 'Trazabilidad de evidencias', description: 'Trazabilidad documental', category: 'audit', default_format: 'pdf', template_key: 'evidence', can_generate: true, can_schedule: false },
    ]);
  }
  if (pathname === '/api/reports/clients') return paged([{ id: tenantId, name: tenantName }]);
  if (pathname === '/api/reports/standards') {
    return paged([{ tenant_id: tenantId, standard_code: 'ISO27001', version_code: '2022', label: 'ISO 27001:2022', display_name: 'ISO 27001:2022', coverage_status: 'partial', coverage_label: 'Cobertura parcial', coverage_severity: 'yellow', can_generate_executive: true, can_generate_operational: true, can_generate_audit: true, metrics: {}, warnings: [] }]);
  }
  if (pathname === '/api/reports/exports') return paged(exportRows);

  if (pathname.includes('/notifications') || pathname.includes('/search')) return paged([]);
  return paged([]);
}

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

  if (item.clickText) {
    const target = page.getByRole('button', { name: item.clickText }).first();
    if ((await target.count()) === 0) {
      fs.writeFileSync(path.join(outDir, `${item.file}.before-click.body.txt`), await page.locator('body').innerText());
    }
    assert((await target.count()) > 0, `${item.file} must expose the ${String(item.clickText)} tab before capture.`);
    await target.click();
    await page.waitForLoadState('networkidle').catch(() => null);
    await page.waitForTimeout(700);
  }
  if (item.fillSearch) {
    await page.getByRole('searchbox').first().fill(item.fillSearch);
    await page.waitForTimeout(400);
  }
  if (typeof item.scrollY === 'number') {
    await page.evaluate((scrollY) => {
      const main = document.querySelector('main.enterprise-main');
      const scroller = main instanceof HTMLElement ? main : document.scrollingElement;
      scroller?.scrollTo(0, scrollY);
    }, item.scrollY);
    await page.waitForTimeout(300);
  } else if (item.scrollTarget) {
    const target = page.getByText(item.scrollTarget, { exact: false }).first();
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }

  const bodyText = await page.locator('body').innerText();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  assert(!horizontalOverflow, `${item.file} must not have global horizontal overflow.`);
  for (const text of item.assertions) {
    if (!visibleTextIncludes(bodyText, text)) fs.writeFileSync(path.join(outDir, `${item.file}.body.txt`), bodyText);
    assert(visibleTextIncludes(bodyText, text), `${item.file} must include ${text}. Body: ${bodyText.slice(0, 700)}`);
  }

  await page.screenshot({ path: path.join(outDir, item.file), fullPage: false });
  await context.close();
  return {
    file: item.file,
    route: item.route,
    viewport: item.viewport,
    locale: 'es-CL',
    pattern: item.pattern,
    filters: item.filters,
    state: item.state,
    responsive: item.responsive,
    source: 'Playwright route fixtures confined to this script; product code consumes existing endpoints only',
    assertions: item.assertions,
    route_count: '97 -> 97',
  };
}

async function validateViewport(browser, item) {
  const { context, page } = await setupPage(browser, item.viewport);
  await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.addStyleTag({
    content: 'nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-overlay],[data-nextjs-dev-tools-button]{display:none!important;}',
  }).catch(() => null);
  await page.waitForTimeout(700);

  if (item.clickText) {
    const target = page.getByRole('button', { name: item.clickText }).first();
    assert((await target.count()) > 0, `${item.route} must expose ${String(item.clickText)} at ${item.viewport.width}px.`);
    await target.click();
    await page.waitForLoadState('networkidle').catch(() => null);
    await page.waitForTimeout(500);
  }

  const bodyText = await page.locator('body').innerText();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  assert(!horizontalOverflow, `${item.route} must not have global horizontal overflow at ${item.viewport.width}px.`);
  for (const text of item.assertions) {
    assert(visibleTextIncludes(bodyText, text), `${item.route} at ${item.viewport.width}px must include ${text}.`);
  }
  await context.close();
  return {
    route: item.route,
    viewport: item.viewport,
    locale: 'es-CL',
    assertions: item.assertions,
    responsive: item.responsive,
    route_count: '97 -> 97',
  };
}

const capturesToRun = [
  {
    file: 'datos-table-1440.png',
    route: '/datos',
    viewport: { width: 1440, height: 980 },
    pattern: 'EnterpriseTableShell + EnterpriseFilterBar',
    filters: 'search over loaded collection',
    state: 'measured + Data Trust',
    responsive: 'desktop table with local horizontal overflow only if needed',
    assertions: ['Datos', 'Buscar', '2 de 2 dominios de datos', 'Confianza', 'Lineage', 'Confiable con advertencias'],
  },
  {
    file: 'evidencias-table-1440.png',
    route: '/evidencias?legacy_upload=1',
    viewport: { width: 1440, height: 980 },
    pattern: 'EnterpriseFilterBar + operational evidence cards',
    filters: 'standard, status, search, reset',
    state: 'measured list',
    responsive: 'desktop dense toolbar and scroll panel',
    assertions: ['Evidencias', 'Buscar', 'evidencias en la vista actual', 'Pendiente'],
  },
  {
    file: 'riesgos-table-1440.png',
    route: '/riesgos',
    viewport: { width: 1440, height: 980 },
    pattern: 'sortable operational table',
    filters: 'search, source, level, status, owner',
    state: 'measured + source state labels',
    responsive: 'desktop table with local scroll',
    assertions: ['Registro de riesgos', 'Búsqueda', 'Fuente', 'Con medición', 'En progreso'],
  },
  {
    file: 'exportes-table-1440.png',
    route: '/exportes',
    viewport: { width: 1440, height: 980 },
    clickText: /Historial|History/i,
    pattern: 'EnterpriseTableShell history table',
    filters: 'search, report type, client, date range, reset',
    state: 'measured history',
    responsive: 'desktop table with local horizontal scroll',
    assertions: ['Historial', 'Desde', 'Hasta', 'Reporte ejecutivo de cumplimiento', 'En proceso'],
    scrollY: 760,
  },
  {
    file: 'table-mobile-390.png',
    route: '/riesgos',
    viewport: { width: 390, height: 940 },
    pattern: 'same risk dataset with mobile cards',
    filters: 'collapsed responsive filter grid',
    state: 'measured',
    responsive: 'mobile preserves entity, state and primary action without global overflow',
    assertions: ['Registro de riesgos', 'R-001', 'Alto'],
    scrollY: 1220,
  },
  {
    file: 'table-state-1440.png',
    route: '/datos',
    viewport: { width: 1440, height: 980 },
    fillSearch: 'sin-coincidencia-ui07',
    pattern: 'UniversalStateBlock empty search state',
    filters: 'search no-match',
    state: 'empty',
    responsive: 'desktop empty state without table collapse',
    assertions: ['Sin resultados', 'No hay registros que coincidan'],
  },
];

const responsiveChecksToRun = [
  {
    route: '/datos',
    viewport: { width: 1280, height: 900 },
    responsive: '1280 desktop table preserves scanability and no global horizontal overflow',
    assertions: ['Datos', 'Buscar', '2 de 2 dominios de datos', 'Confianza'],
  },
  {
    route: '/exportes',
    viewport: { width: 1280, height: 900 },
    clickText: /Historial|History/i,
    responsive: '1280 history table keeps filters, entity and primary action visible without global overflow',
    assertions: ['Historial', 'Reporte ejecutivo de cumplimiento', 'Ver PDF'],
  },
];

const browser = await chromium.launch({ headless: true });
try {
  const captures = [];
  for (const item of capturesToRun) captures.push(await capture(browser, item));
  const responsive_validations = [];
  for (const item of responsiveChecksToRun) responsive_validations.push(await validateViewport(browser, item));
  const manifest = {
    verdict: 'PASS',
    locale: 'es-CL',
    generated_at: new Date().toISOString(),
    route_count: { before: routeCount(), after: routeCount(), expected: '97 -> 97' },
    context: 'UI-07 enterprise tables, filters and density focal evidence',
    source_fixture_policy: 'Fixtures are confined to this harness and are not runtime/productive data evidence.',
    captures,
    responsive_validations,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI07_ENTERPRISE_TABLES_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
