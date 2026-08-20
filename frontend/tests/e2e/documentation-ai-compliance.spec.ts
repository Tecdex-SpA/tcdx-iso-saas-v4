import { expect, request as createRequest, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');

const scenarios = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo' },
];

async function login(page: Page, email: string) {
  const api = await createRequest.newContext({ baseURL: apiBase });
  try {
    const res = await api.post('/api/auth/login', { data: { email, password } });
    const body = await res.json().catch(() => ({}));
    expect(res.status(), JSON.stringify(body)).toBe(200);
    const token = String(body.token || body.accessToken || body.data?.token || body.data?.accessToken || '');
    expect(token).toBeTruthy();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('authToken', t);
    }, token);
  } finally {
    await api.dispose();
  }
}

async function zoom(page: Page, ratio = 0.75) {
  await page.evaluate((z) => { document.documentElement.style.zoom = String(z); }, ratio);
}

async function shot(page: Page, key: string, name: string, ratio = 0.75) {
  await zoom(page, ratio);
  const dir = path.join(out, key, 'ai-compliance');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => { expect(password).toBeTruthy(); expect(apiBase).toBeTruthy(); });

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
    await shot(page, s.key, '03-ia-compliance-resumen-ejecutivo', 0.5);
  });
}
