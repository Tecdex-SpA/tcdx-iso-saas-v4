import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const password = String(process.env.DOC_DEMO_PASSWORD || '');

const scenarios = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo', standard: 'ISO9001' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo', standard: 'ISO27001' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo', standard: 'ISO9001' },
];

async function login(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contrase|password/i).fill(password);
  await page.getByRole('button', { name: /ingresar|iniciar|login/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'ai-auditor');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => expect(password).toBeTruthy());

for (const s of scenarios) {
  test(`${s.key} Senior AI Auditor advisory flow`, async ({ page }) => {
    await login(page, s.email);
    await page.goto(`/auditorias?view=ia&standard_code=${encodeURIComponent(s.standard)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('IA Auditor Senior', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/IA solo consultiva|Análisis consultivo/i).first()).toBeVisible();
    await shot(page, s.key, '01-ia-auditor-inicio');

    const standardSelect = page.locator('select').filter({ has: page.locator(`option[value="${s.standard}"]`) }).first();
    if (await standardSelect.count()) await standardSelect.selectOption(s.standard).catch(() => {});

    const modeSelect = page.locator('select').filter({ has: page.locator('option[value="fast"]') }).first();
    if (await modeSelect.count()) await modeSelect.selectOption('fast').catch(() => {});

    await shot(page, s.key, '02-ia-auditor-configurado');
    await page.getByRole('button', { name: /Ejecutar análisis/i }).click();

    await expect(page.getByText(/Resumen ejecutivo/i).first()).toBeVisible({ timeout: 120000 });
    await expect(page.getByText(/Opinión auditora|Brechas principales|Resultado estructurado Auditor Senior/i).first()).toBeVisible({ timeout: 120000 });
    await shot(page, s.key, '03-ia-auditor-resultado');
  });
}
