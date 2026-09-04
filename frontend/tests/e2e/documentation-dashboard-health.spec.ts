import { expect, request as createRequest, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const webBase = String(process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');

const scenarios = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo' },
];

async function auth(page: Page, email: string) {
  const api = await createRequest.newContext({ baseURL: apiBase });
  const res = await api.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const token = String(body.token || body.accessToken || body.data?.token || body.data?.accessToken || '');
  expect(token).toBeTruthy();
  await page.addInitScript((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('authToken', t);
  }, token);
  await api.dispose();
}

async function capture(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'dashboard-health');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

async function openEntitled(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const denied = page.getByText(/capacidad no est[aá] habilitada|m[oó]dulo no habilitado|no tiene permiso/i);
  await expect(denied).toHaveCount(0);
}

test.beforeAll(() => {
  expect(webBase).toBeTruthy();
  expect(apiBase).toBeTruthy();
  expect(password).toBeTruthy();
});

for (const s of scenarios) {
  test(`${s.key} dashboard and ISO health entitled views only`, async ({ page }) => {
    await auth(page, s.email);

    await openEntitled(page, '/dashboard?view=executive');
    await capture(page, s.key, '01-dashboard-ejecutivo');

    await openEntitled(page, '/dashboard?view=kpi');
    await capture(page, s.key, '02-dashboard-kpi');

    await openEntitled(page, '/dashboard?view=iso');
    await capture(page, s.key, '03-dashboard-salud-iso');

    await openEntitled(page, '/iso-health');
    await capture(page, s.key, '04-iso-health');
  });
}
