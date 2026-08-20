import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');

const scenarios = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo', standard: 'ISO9001' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo', standard: 'ISO27001' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo', standard: 'ISO9001' },
];

async function login(page: Page, email: string) {
  const res = await page.request.post(`${apiBase}/api/auth/login`, { data: { email, password } });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(200);
  const token = String(body.token || body.accessToken || body.data?.token || body.data?.accessToken || '');
  expect(token).toBeTruthy();
  await page.addInitScript((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'ai-auditor');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => {
  expect(password).toBeTruthy();
  expect(apiBase).toBeTruthy();
});

for (const s of scenarios) {
  test(`${s.key} Senior AI Auditor advisory flow`, async ({ page }) => {
    await login(page, s.email);
    await page.goto(`/auditorias?view=ia&standard_code=${encodeURIComponent(s.standard)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('IA Auditor Senior', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/IA solo consultiva|Análisis consultivo/i).first()).toBeVisible();
    await shot(page, s.key, '01-ia-auditor-inicio');

    const standardSelect = page.locator('select').filter({ has: page.locator(`option[value="${s.standard}"]`) }).first();
    if (await standardSelect.count()) await standardSelect.selectOption(s.standard).catch(() => {});

    const modeSelect = page.locator('select').filter({ has: page.locator('option[value="fast"]') }).first();
    if (await modeSelect.count()) await modeSelect.selectOption('fast').catch(() => {});

    await shot(page, s.key, '02-ia-auditor-configurado');
    await page.getByRole('button', { name: /Ejecutar análisis/i }).click();

    await expect(page.getByText(/Resumen ejecutivo|Resultado estructurado Auditor Senior/i).first()).toBeVisible({ timeout: 120000 });
    await expect(page.getByText(/Opinión auditora|Brechas principales|Resultado estructurado Auditor Senior|Diagnóstico/i).first()).toBeVisible({ timeout: 120000 });
    await shot(page, s.key, '03-ia-auditor-resultado');
  });
}
