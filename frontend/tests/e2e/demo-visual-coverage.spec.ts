import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type RouteItem = { route: string; module: string; component: string; type: string; endpoint: string; minimum: number; seriesMinimum?: number };
const root = path.resolve(__dirname, '../../..');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'scripts/demo/demo-visual-routes.json'), 'utf8')) as RouteItem[];
const uniqueRoutes = routes.filter((item, index) => routes.findIndex((candidate) => candidate.route === item.route) === index);
const tenantId = '76c44a0e-6041-8bda-99c7-b740fccea001';
const apiBase = String(process.env.DEMO_API_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DEMO_ADMIN_PASSWORD || Buffer.from('RGVtby4xMjM0NTY=', 'base64').toString('utf8'));
const evidenceDir = path.join(root, 'docs/demo/visual-evidence');
const screenshotRoutes = new Set(['/dashboard','/cumplimiento-auditoria','/diagnostico','/soa','/controles','/evidencias','/auditorias','/hallazgos','/planes-accion','/matriz-riesgo','/metricas','/bi','/reportes/studio','/datos','/datos/semantica','/datos/calidad','/datos/lineage']);

function demoUuid(key: string) {
  const hash = crypto.createHash('md5').update(`demo-tecdex:${key}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}
function resolve(value: string) { return value.replace(/:tenant/g, tenantId).replace(/:metric1/g, demoUuid('metric-1')); }
function arrays(value: unknown, output: unknown[][] = []): unknown[][] {
  if (Array.isArray(value)) { output.push(value); value.forEach((item) => arrays(item, output)); }
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => arrays(item, output));
  return output;
}
function scalar(value: unknown): string | null {
  if (Array.isArray(value)) { for (const item of value) { const found = scalar(item); if (found) return found; } }
  else if (value && typeof value === 'object') { for (const [key, item] of Object.entries(value)) { if (!/id|tenant|hash|metadata/i.test(key)) { const found = scalar(item); if (found) return found; } } }
  else if ((typeof value === 'string' && value.length >= 3) || (typeof value === 'number' && value > 0)) return String(value);
  return null;
}
async function login(api: APIRequestContext, email: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body.token || body.accessToken || body.data?.token || body.data?.accessToken || '';
}
async function installSession(page: Page, token: string) {
  await page.addInitScript((value) => { localStorage.setItem('token', value); localStorage.setItem('authToken', value); }, token);
}
async function validateApi(api: APIRequestContext, token: string, item: RouteItem) {
  const response = await api.get(resolve(item.endpoint), { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `${item.endpoint}: ${JSON.stringify(body)}`).toBe(200);
  const data = body.data ?? body;
  const found = arrays(data).sort((a, b) => b.length - a.length);
  const longest = found[0] || [];
  const positive = JSON.stringify(data).match(/:\s*[1-9][0-9]*(?:\.[0-9]+)?/g) || [];
  expect(longest.length >= item.minimum || positive.length > 0, `${item.endpoint} must expose non-zero data`).toBeTruthy();
  const seriesMinimum = item.seriesMinimum;
  if (seriesMinimum) expect(found.some((items) => items.length >= seriesMinimum), `${item.endpoint} series`).toBeTruthy();
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`tenant_id"\\s*:\\s*"(?!${tenantId})`));
  return { data, observed: Math.max(longest.length, positive.length ? 1 : 0), representative: scalar(data) };
}

test.beforeAll(() => {
  expect(apiBase, 'DEMO_API_BASE_URL is required').toBeTruthy();
  expect(apiBase).not.toMatch(/prod|production/i);
  expect(String(process.env.DEMO_WEB_BASE_URL || '')).not.toMatch(/prod|production/i);
  fs.mkdirSync(evidenceDir, { recursive: true });
});

for (const account of [{ role: 'admin', email: 'admin.demo@tcdx.demo' }, { role: 'auditor', email: 'auditor.demo@tcdx.demo' }]) {
  test.describe(`${account.role} visual coverage`, () => {
    let api: APIRequestContext;
    let token = '';
    test.beforeAll(async () => { api = await createRequest.newContext({ baseURL: apiBase }); token = await login(api, account.email); expect(token).toBeTruthy(); });
    test.afterAll(async () => { await api.dispose(); });

    for (const item of uniqueRoutes) {
      test(`${account.role} ${item.route}`, async ({ page }) => {
        await installSession(page, token);
        const serverErrors: string[] = [];
        page.on('response', (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`); });
        const endpointItems = routes.filter((candidate) => candidate.route === item.route);
        const apiEvidence = [];
        for (const endpointItem of endpointItems) apiEvidence.push(await validateApi(api, token, endpointItem));
        await page.goto(resolve(item.route), { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(800);
        expect(serverErrors).toEqual([]);
        await expect(page.locator('body')).not.toContainText(/capability.+(bloqueada|no habilitada)|error boundary|application error|internal server error/i);
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByText(/cargando…|cargando\.\.\./i)).toHaveCount(0, { timeout: 15_000 });
        const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(bodyText.length).toBeGreaterThan(80);
        expect(bodyText).toMatch(/\d/);
        const representative = apiEvidence.map((value) => value.representative).find(Boolean);
        if (representative && representative.length >= 4 && representative.length <= 80) {
          expect(bodyText.toLocaleLowerCase('es')).toContain(representative.toLocaleLowerCase('es'));
        }
        if (endpointItems.some((value) => value.type === 'tabla')) {
          const rowCount = await page.locator('tbody tr').count();
          expect(rowCount > 0 || bodyText.match(/\d/g)!.length >= 2).toBeTruthy();
        }
        if (endpointItems.some((value) => ['gráfico','heatmap'].includes(value.type))) {
          const marks = await page.locator('svg path, svg rect, canvas, [data-chart], [data-heatmap-cell]').count();
          expect(marks > 0 || bodyText.match(/\d/g)!.length >= 4).toBeTruthy();
        }
        const cleanRoute = item.route.split('?')[0];
        if (screenshotRoutes.has(cleanRoute)) {
          const slug = cleanRoute.replace(/^\//, '').replace(/\//g, '-') || 'home';
          await page.screenshot({ path: path.join(evidenceDir, `${slug}-${account.role}.png`), fullPage: true });
        }
        if (cleanRoute === '/diagnostico') {
          const standardSelect = page.locator('select:has(option[value="ISO9001"]):has(option[value="ISO27001"])').first();
          await expect(standardSelect).toBeVisible();
          for (const standard of ['ISO9001', 'ISO27001']) {
            await standardSelect.selectOption(standard);
            await page.waitForTimeout(500);
            await expect(page.locator('body')).toContainText(new RegExp(standard.replace('ISO', 'ISO\\s*'), 'i'));
            await page.screenshot({ path: path.join(evidenceDir, `${standard === 'ISO9001' ? 'iso-9001' : 'iso-27001'}-${account.role}.png`), fullPage: true });
          }
        }
      });
    }
  });
}
