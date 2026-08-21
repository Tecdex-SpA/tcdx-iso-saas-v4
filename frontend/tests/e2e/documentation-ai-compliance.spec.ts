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
    await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('authToken', t); }, token);
  } finally { await api.dispose(); }
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'ai-compliance-v6');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

async function hasConnectionError(page: Page) {
  const rx = /error de conexi[oó]n|ai[ -]?engine.*no disponible|servicio de ia.*no disponible|base de datos.*no disponible|conectividad.*base de datos|ECONN|ETIMEDOUT|timeout.*(ia|base de datos)/i;
  return (await page.getByText(rx).count()) > 0;
}

async function waitForStableAnalysis(page: Page) {
  const loading = page.getByText(/Actualizando an[aá]lisis|Procesando|Generando resumen/i).first();
  await loading.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1800);
}

async function refreshUntilHealthy(page: Page, buttonName: RegExp, readyText: RegExp) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const button = page.getByRole('button', { name: buttonName }).first();
    if (await button.count()) await button.click();
    await waitForStableAnalysis(page);
    const ready = page.getByText(readyText).first();
    await ready.waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
    if (!(await hasConnectionError(page))) return;
    await page.waitForTimeout(3000 * attempt);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  expect(await hasConnectionError(page), 'IA Compliance persisted with AI/DB connectivity error after retries').toBeFalsy();
}

test.beforeAll(() => { expect(password).toBeTruthy(); expect(apiBase).toBeTruthy(); });

for (const s of scenarios) {
  test(`${s.key} IA Compliance complete healthy flow`, async ({ page }) => {
    await login(page, s.email);
    await page.goto('/ia-compliance', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'IA Compliance' }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Resumen de salud IA/i).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Controles activos/i).first()).toBeVisible();
    await shot(page, s.key, '01-contexto-antes-de-analizar');

    await refreshUntilHealthy(page, /Actualizar an[aá]lisis/i, /Resumen de salud IA|Acciones recomendadas|Riesgos usados como contexto/i);
    await expect(page.getByText(/Acciones recomendadas|Riesgos usados como contexto/i).first()).toBeVisible({ timeout: 60000 });
    await shot(page, s.key, '02-resultado-analisis-sin-errores');

    await refreshUntilHealthy(page, /Resumen ejecutivo IA/i, /Prioridades|Acciones gerenciales|Resultado estructurado AI v2|Resumen ejecutivo IA/i);
    const result = page.getByText(/Prioridades|Acciones gerenciales|Resultado estructurado AI v2|Resumen ejecutivo IA/i).first();
    await result.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, s.key, '03-resultado-resumen-ejecutivo');
  });
}
