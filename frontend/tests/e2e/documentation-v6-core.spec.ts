import { expect, request as createRequest, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const scenarios = [
  { key:'iso9001', email:'admin.demo9001@tcdx.demo' },
  { key:'iso27001', email:'admin.demo27001@tcdx.demo' },
  { key:'integrated', email:'admin.demoisos@tcdx.demo' },
];

async function login(page: Page, email: string) {
  const api = await createRequest.newContext({ baseURL: apiBase });
  try {
    const r = await api.post('/api/auth/login', { data: { email, password } });
    const b = await r.json().catch(() => ({}));
    expect(r.status(), JSON.stringify(b)).toBe(200);
    const token = String(b.token || b.accessToken || b.data?.token || b.data?.accessToken || '');
    expect(token).toBeTruthy();
    await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('authToken', t); }, token);
  } finally { await api.dispose(); }
}

async function openStable(page: Page, route: string, marker: RegExp) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForTimeout(1400);
    const denied = page.getByText(/capacidad no est[aá] habilitada|m[oó]dulo no habilitado|no tiene permiso/i);
    const transient = page.getByText(/error de conexi[oó]n|base de datos.*no disponible|ECONN|ETIMEDOUT/i);
    const ready = page.getByText(marker).first();
    if ((await denied.count()) === 0 && (await transient.count()) === 0 && await ready.isVisible().catch(() => false)) return;
    await page.waitForTimeout(1200 * attempt);
  }
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/capacidad no est[aá] habilitada|m[oó]dulo no habilitado|no tiene permiso|error de conexi[oó]n|base de datos.*no disponible|ECONN|ETIMEDOUT/i)).toHaveCount(0);
}

async function shot(page: Page, key: string, name: string) {
  const dir = path.join(out, key, 'core-v6');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

test.beforeAll(() => { expect(password).toBeTruthy(); expect(apiBase).toBeTruthy(); });

for (const s of scenarios) {
  test(`${s.key} core ISO manual views at 67 percent`, async ({ page }) => {
    await login(page, s.email);
    const views = [
      ['/usuarios', /Usuarios|Gesti[oó]n de Usuarios/i, '01-usuarios'],
      ['/perfil-empresa', /Perfil Empresa|Perfil de Empresa/i, '02-perfil-empresa'],
      ['/cumplimiento-auditoria', /Cumplimiento|Auditor[ií]a/i, '03-cumplimiento-auditoria'],
      ['/controles', /Controles/i, '04-controles'],
      ['/evidencias', /Evidencias|Biblioteca documental/i, '05-evidencias'],
      ['/hallazgos', /Hallazgos/i, '06-hallazgos'],
      ['/planes-accion', /Planes de acci[oó]n|Plan de acci[oó]n/i, '07-planes-accion'],
      ['/auditorias', /Auditor[ií]as/i, '08-auditorias'],
      ['/dashboard?view=executive', /Bienvenido a TCDX|Cumplimiento global/i, '09-dashboard-ejecutivo'],
    ] as const;
    for (const [route, marker, name] of views) {
      await openStable(page, route, marker);
      await shot(page, s.key, name);
    }
  });
}
