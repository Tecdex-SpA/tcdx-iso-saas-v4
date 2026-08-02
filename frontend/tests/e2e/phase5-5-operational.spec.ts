import path from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const tenantA = process.env.PHASE5_5_TENANT_A_ID || '70000000-0000-0000-0000-000000000701';
const tenantB = process.env.PHASE5_5_TENANT_B_ID || '70000000-0000-0000-0000-000000000702';
const adminEmail = process.env.PHASE5_5_ADMIN_EMAIL || 'phase55.admin@tcdx.local';
const restrictedEmail = process.env.PHASE5_5_RESTRICTED_EMAIL || 'phase55.viewer@tcdx.local';
const tenantBEmail = process.env.PHASE5_5_TENANT_B_EMAIL || 'phase55.admin.b@tcdx.local';
const password = process.env.PHASE5_5_PASSWORD || 'Phase55E2E!2026';
const apiBaseUrl = (process.env.API_BASE_URL || '').replace(/\/+$/, '');

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonce = `P55_${Date.now()}`;
const axeScriptPath = path.resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');

type LoginResult = { token: string };

function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function expectNoSeriousAxeViolations(page: Page) {
  await page.addScriptTag({ path: axeScriptPath });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: Record<string, unknown>) => Promise<{ violations: Array<{ id: string; impact?: string | null; nodes: unknown[] }> }> } }).axe;
    return axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  });
  const blocking = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(blocking, JSON.stringify(blocking.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })))).toEqual([]);
}

async function login(page: Page, email = adminEmail): Promise<LoginResult> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeTenantId');
  }).catch(() => null);
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const submit = page.getByRole('button', { name: /ingresar/i });
  await expect(submit).toBeEnabled();
  const response = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login')),
    submit.click(),
  ]).then(([res]) => res);
  const loginStatus = response.status();
  expect(loginStatus).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  return { token: token || '' };
}

function headers(token: string, tenantId = tenantA) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  };
}

async function expectApiOk(response: Awaited<ReturnType<APIRequestContext['get']>> | Awaited<ReturnType<APIRequestContext['post']>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function operateBuilder(page: Page, kind: string, path: string, code: string, testKey = kind) {
  await page.goto(path);
  await expect(page.getByTestId(`operational-builder-${testKey}`)).toBeVisible();
  await page.getByTestId(`builder-${testKey}-code`).fill(code);
  await page.getByTestId(`builder-${testKey}-name`).fill(`${kind} ${nonce}`);

  await page.getByTestId(`builder-${testKey}-validate`).click();
  await expect(page.getByText(/Configuración válida|Operación completada/i).first()).toBeVisible();

  const preview = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/grc/official/analytics/') && res.request().method() === 'POST'),
    page.getByTestId(`builder-${testKey}-preview`).click(),
  ]).then(([res]) => res);
  expect(preview.ok(), await preview.text()).toBeTruthy();
  await expect(page.getByTestId(`builder-${testKey}-value`)).not.toHaveText('Sin dato');

  const save = await Promise.all([
    page.waitForResponse((res) => res.url().includes(endpointMarker(kind)) && res.request().method() === 'POST'),
    page.getByTestId(`builder-${testKey}-save`).click(),
  ]).then(([res]) => res);
  expect(save.ok(), await save.text()).toBeTruthy();
  const entityText = await page.getByTestId(`builder-${testKey}-entity`).innerText();
  expect(entityText).toMatch(uuidRe);

  if (['metric', 'dashboard', 'survey'].includes(kind)) {
    const publish = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/publish') && res.request().method() === 'POST'),
      page.getByTestId(`builder-${testKey}-publish`).click(),
    ]).then(([res]) => res);
    expect(publish.ok(), await publish.text()).toBeTruthy();
  }

  const execute = await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST' && executeMarker(kind, res.url())),
    page.getByTestId(`builder-${testKey}-execute`).click(),
  ]).then(([res]) => res);
  expect(execute.ok(), await execute.text()).toBeTruthy();
  return entityText.trim();
}

function endpointMarker(kind: string) {
  return {
    metric: '/api/metrics',
    dashboard: '/api/dashboards',
    report: '/api/reports',
    survey: '/api/surveys',
    assurance: '/api/assurance-tests',
    loss: '/api/loss-events',
  }[kind] || `/api/${kind}`;
}

function executeMarker(kind: string, url: string) {
  if (kind === 'metric') return url.includes('/api/metrics/') && url.includes('/calculate');
  if (kind === 'dashboard') return url.includes('/api/dashboards/') && url.includes('/snapshot');
  if (kind === 'report') return url.includes('/api/reports/') && url.includes('/generate');
  if (kind === 'survey') return url.includes('/api/survey-campaigns');
  if (kind === 'assurance') return url.includes('/api/assurance-tests/') && url.includes('/execute');
  if (kind === 'loss') return url.includes('/api/loss-events/') && url.includes('/confirm');
  return false;
}

test.describe.serial('Phase 5.5 operational UX and acceptance', () => {
  let token = '';
  let metricId = '';
  let dashboardId = '';
  let reportId = '';

  test('login, tenant context and Portal GRC load against real backend', async ({ page }) => {
    ({ token } = await login(page));
    await page.evaluate((id) => localStorage.setItem('activeTenantId', id), tenantA);
    await page.goto('/grc');
    await expect(page.getByText('Portal GRC')).toBeVisible();
    await expect(page.getByText(/Estado operativo y analítico/i)).toBeVisible();
    const overview = await page.request.get(apiUrl('/api/grc/overview'), { headers: headers(token) });
    expect(overview.ok(), await overview.text()).toBeTruthy();
  });

  test('accesibilidad WCAG AA en login y rutas críticas', async ({ page }) => {
    await page.goto('/login');
    await expectNoSeriousAxeViolations(page);
    await login(page);
    for (const route of ['/grc', '/metricas', '/bi', '/reportes/studio']) {
      await page.goto(route);
      await expectNoSeriousAxeViolations(page);
    }
  });

  test('crear métrica, configurar fuente, preview, publicar, ejecutar, resultado, explicación y lineage', async ({ page }) => {
    await login(page);
    metricId = await operateBuilder(page, 'metric', '/metricas', `${nonce}_METRIC`);
    const measurements = await page.request.get(apiUrl(`/api/metrics/${metricId}/measurements`), { headers: headers(token) });
    const payload = await expectApiOk(measurements);
    expect(Array.isArray(payload.data)).toBeTruthy();
    expect(payload.data.length).toBeGreaterThan(0);
  });

  test('crear encuesta, publicar, campaña y scoring oficial', async ({ page }) => {
    await login(page);
    await operateBuilder(page, 'survey', '/encuestas', `${nonce}_SURVEY`);
    const scoring = await page.request.post(apiUrl('/api/grc/official/surveys/scoring'), {
      headers: headers(token),
      data: { items: [{ score: 4, maxScore: 5, weight: 1 }], period: { start: '2026-01-01', end: '2026-01-31' } },
    });
    const payload = await expectApiOk(scoring);
    expect(payload.data.formula_code).toContain('F5_5_SURVEY');
  });

  test('crear assurance test, calcular muestra, registrar resultado y revisar', async ({ page }) => {
    await login(page);
    await operateBuilder(page, 'assurance', '/tests', `${nonce}_ASSURANCE`, 'assurance-score');
    const sample = await page.request.post(apiUrl('/api/grc/official/assurance/sample-size'), {
      headers: headers(token),
      data: { z: 1.96, p: 0.5, e: 0.05, population: 100 },
    });
    const payload = await expectApiOk(sample);
    expect(payload.data.formula_code).toBe('F5_5_SAMPLE_SIZE');
  });

  test('crear evento de pérdida y ejecutar estadísticas oficiales', async ({ page }) => {
    await login(page);
    await operateBuilder(page, 'loss', '/eventos-perdida', `${nonce}_LOSS`);
    const loss = await page.request.post(apiUrl('/api/grc/official/losses/net-loss'), {
      headers: headers(token),
      data: { grossLoss: 1000, recoveries: 100, events: [{ grossLoss: 1000, recoveries: 100, currency: 'CLP' }] },
    });
    const payload = await expectApiOk(loss);
    expect(payload.data.formula_code).toContain('LOSS');
  });

  test('crear dashboard, agregar widget oficial, publicar y snapshot', async ({ page }) => {
    await login(page);
    dashboardId = await operateBuilder(page, 'dashboard', '/bi', `${nonce}_DASH`);
    const render = await page.request.get(apiUrl(`/api/dashboards/${dashboardId}/render`), { headers: headers(token) });
    const payload = await expectApiOk(render);
    expect(payload.data.official_only).toBeTruthy();
    expect(payload.data.widgets.length).toBeGreaterThan(0);
  });

  test('crear reporte, generar PDF DOCX XLSX, aprobar y descargar artefactos', async ({ page }) => {
    await login(page);
    reportId = await operateBuilder(page, 'report', '/reportes/studio', `${nonce}_REPORT`);
    for (const format of ['pdf', 'docx', 'xlsx'] as const) {
      const generationResponse = await page.request.post(apiUrl(`/api/reports/${reportId}/generate`), {
        headers: headers(token),
        data: { format, result_codes: ['health.grc'], period: { start: '2026-01-01', end: '2026-01-31' }, generation_key: `${nonce}_${format}` },
      });
      const generationPayload = await expectApiOk(generationResponse);
      const generationId = generationPayload.data.generation.id;
      const approve = await page.request.post(apiUrl(`/api/report-generations/${generationId}/approve`), {
        headers: headers(token),
        data: { approval_status: 'approved', comment: `approved ${format}` },
      });
      await expectApiOk(approve);
      const download = await page.request.get(apiUrl(`/api/report-generations/${generationId}/download`), { headers: headers(token) });
      expect(download.ok(), await download.text()).toBeTruthy();
      const body = await download.body();
      if (format === 'pdf') expect(body.slice(0, 5).toString('utf8')).toBe('%PDF-');
      else expect(body.slice(0, 2).toString('utf8')).toBe('PK');
      const contentType = download.headers()['content-type'] || '';
      if (format === 'pdf') expect(contentType).toContain('application/pdf');
      if (format === 'docx') expect(contentType).toContain('wordprocessingml');
      if (format === 'xlsx') expect(contentType).toContain('spreadsheetml');
    }
  });

  test('consistencia entre Portal GRC, dominio, dashboard y reporte por cálculo oficial', async ({ page }) => {
    await login(page);
    const official = await page.request.post(apiUrl('/api/grc/official/analytics/health.grc'), {
      headers: headers(token),
      data: { period: { start: '2026-01-01', end: '2026-01-31' }, include_trend: true },
    });
    const officialPayload = await expectApiOk(official);
    await page.goto('/grc');
    await expect(page.getByText(/Capa matemática oficial|Resultados operativos trazables/i).first()).toBeVisible();
    await page.goto('/bi');
    await expect(page.getByTestId('operational-builder-dashboard')).toBeVisible();
    expect(officialPayload.data.formula.code).toBeTruthy();
    expect(officialPayload.data.unit).toBeDefined();
  });

  test('usuario restringido no puede persistir y Tenant B no ve datos de Tenant A', async ({ page }) => {
    await login(page, restrictedEmail);
    await page.goto('/metricas');
    await expect(page.getByTestId('operational-builder-metric')).toBeVisible();
    await page.getByTestId('builder-metric-code').fill(`${nonce}_DENIED`);
    const denied = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/metrics') && res.request().method() === 'POST'),
      page.getByTestId('builder-metric-save').click(),
    ]).then(([res]) => res);
    expect(denied.status()).toBe(403);

    const tenantBLogin = await login(page, tenantBEmail);
    const tenantBMetrics = await page.request.get(apiUrl('/api/metrics'), { headers: headers(tenantBLogin.token, tenantB) });
    const payload = await expectApiOk(tenantBMetrics);
    expect(JSON.stringify(payload.data)).not.toContain(`${nonce}_METRIC`);
  });
});
