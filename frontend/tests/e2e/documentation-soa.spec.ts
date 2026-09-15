import { expect, request as createRequest, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const webBase = String(process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const apiBase = String(process.env.DOC_API_BASE_URL || webBase).replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');

const scenarios = [
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo' },
];

function jwtPayload(token: string) {
  try {
    return JSON.parse(Buffer.from((token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return {}; }
}

async function authenticate(page: Page, email: string) {
  const api = await createRequest.newContext({ baseURL: apiBase });
  try {
    const r = await api.post('/api/auth/login', { data: { email, password } });
    expect(r.status()).toBe(200);
    const b = await r.json();
    const token = String(b.token || b.accessToken || b.data?.token || b.data?.accessToken || '');
    expect(token).toBeTruthy();
    const p = jwtPayload(token);
    expect(String(b.role || b.user?.role || b.data?.user?.role || p.role || '').toLowerCase()).toBe('admin');
    await page.addInitScript((value) => {
      localStorage.setItem('token', value);
      localStorage.setItem('authToken', value);
    }, token);
  } finally { await api.dispose(); }
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'soa');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => {
  expect(webBase).toBeTruthy();
  expect(apiBase).toBeTruthy();
  expect(password).toBeTruthy();
});

for (const s of scenarios) {
  test(`${s.key} ISO 27001 SoA real view`, async ({ page }) => {
    await authenticate(page, s.email);
    await page.goto('/soa', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/soa/);
    await page.waitForTimeout(5000);
    await shot(page, s.key, '01-soa-vista-general');

    const standardSelect = page.locator('select').first();
    if (await standardSelect.count()) {
      const options = await standardSelect.locator('option').allTextContents();
      expect(options.some((v) => /27001/i.test(v))).toBeTruthy();
    }

    const tables = page.locator('table');
    if (await tables.count()) {
      await tables.first().scrollIntoViewIfNeeded();
      await shot(page, s.key, '02-soa-controles-y-decisiones');
    }

    const buttons = page.getByRole('button');
    const texts = await buttons.allTextContents();
    const intelligenceIndex = texts.findIndex((t) => /suger|evalu|recalcular|intelig/i.test(t));
    if (intelligenceIndex >= 0) {
      await buttons.nth(intelligenceIndex).scrollIntoViewIfNeeded();
      await shot(page, s.key, '03-soa-inteligencia-y-acciones');
    }
  });
}
