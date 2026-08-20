import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const password = String(process.env.DOC_DEMO_PASSWORD || '');

const scenarios = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo' },
];

async function login(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contrase|password/i).fill(password);
  await page.getByRole('button', { name: /ingresar|iniciar|login/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'ai-compliance');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => expect(password).toBeTruthy());

for (const s of scenarios) {
  test(`${s.key} IA Compliance executive flow`, async ({ page }) => {
    await login(page, s.email);
    await page.goto('/ia-compliance', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'IA Compliance' }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/No certifica cumplimiento ni reemplaza revisión humana/i).first()).toBeVisible();

    await expect(page.getByText(/Resumen de salud IA/i).first()).toBeVisible({ timeout: 45000 });
    await shot(page, s.key, '01-ia-compliance-salud');

    const refreshAnalysis = page.getByRole('button', { name: /Actualizar análisis/i }).first();
    if (await refreshAnalysis.count()) {
      await refreshAnalysis.click();
      await expect(page.getByText(/Actualizando análisis|Resumen de salud IA/i).first()).toBeVisible({ timeout: 45000 });
    }
    await shot(page, s.key, '02-ia-compliance-analisis-actualizado');

    const executiveBrief = page.getByRole('button', { name: /Resumen ejecutivo IA/i }).first();
    if (await executiveBrief.count()) {
      await executiveBrief.click();
      await expect(page.getByText(/Prioridades|Acciones gerenciales|Resultado estructurado AI v2|Resumen ejecutivo IA/i).first()).toBeVisible({ timeout: 90000 });
    }

    await expect(page.getByText(/Controles activos/i).first()).toBeVisible();
    await expect(page.getByText(/Evidencias pendientes/i).first()).toBeVisible();
    await shot(page, s.key, '03-ia-compliance-resumen-ejecutivo');
  });
}
