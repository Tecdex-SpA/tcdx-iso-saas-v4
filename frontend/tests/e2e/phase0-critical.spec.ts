import fs from 'node:fs';
import path from 'node:path';
import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const requiredEnvironment = [
  'WEB_BASE_URL',
  'API_BASE_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_RESTRICTED_EMAIL',
  'E2E_RESTRICTED_PASSWORD',
  'E2E_RESTRICTED_API_PATH',
  'E2E_TENANT_A_EMAIL',
  'E2E_TENANT_A_PASSWORD',
  'E2E_TENANT_A_ID',
  'E2E_TENANT_B_EMAIL',
  'E2E_TENANT_B_PASSWORD',
  'E2E_TENANT_B_ID',
  'E2E_TENANT_A_FILE_PATH',
  'E2E_TENANT_B_FILE_PATH',
];

const apiBaseUrl = String(process.env.API_BASE_URL || 'http://phase0.invalid').replace(/\/$/, '');
const coveragePath = path.resolve(process.cwd(), '../config/phase0/e2e-capability-coverage.json');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as {
  capabilities: Array<{ code: string; scenario: string }>;
};
const authorizedRoutes = Array.from(new Set(
  coverage.capabilities
    .map(item => item.scenario.replace(/^authorized-route:/, ''))
    .filter(route => route.startsWith('/')),
));

async function login(api: APIRequestContext, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
  return { response, body, token };
}

async function installSession(page: Page, token: string) {
  await page.addInitScript(value => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

test.describe.serial('Phase 0 critical E2E', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    const missingEnvironment = requiredEnvironment.filter(name => !process.env[name]);
    if (missingEnvironment.length) {
      throw new Error(`Missing required Phase 0 E2E environment variables: ${missingEnvironment.join(', ')}`);
    }
    api = await createRequest.newContext({ baseURL: apiBaseUrl });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('login válido e inválido', async () => {
    const valid = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    expect(valid.response.status()).toBe(200);
    expect(valid.token).toBeTruthy();

    const invalid = await login(api, String(process.env.E2E_ADMIN_EMAIL), `${process.env.E2E_ADMIN_PASSWORD}-invalid`);
    expect([400, 401]).toContain(invalid.response.status());
    expect(invalid.body.token || invalid.body.accessToken || invalid.body.data?.token).toBeFalsy();
  });

  test('sesión persiste en reload y token inválido expira hacia login', async ({ page }) => {
    const valid = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    await installSession(page, valid.token);
    await page.goto('/dashboard');
    await page.reload();
    await expect(page.locator('body')).toContainText(/\S/);

    await page.evaluate(() => {
      localStorage.setItem('token', 'phase0-expired-token');
      localStorage.setItem('authToken', 'phase0-expired-token');
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test('ruta API privada rechaza sesión ausente', async () => {
    const response = await api.get('/api/user/me');
    expect(response.status()).toBe(401);
  });

  test('rol sin permiso es rechazado y rol autorizado accede', async () => {
    const restricted = await login(api, String(process.env.E2E_RESTRICTED_EMAIL), String(process.env.E2E_RESTRICTED_PASSWORD));
    const denied = await api.get(String(process.env.E2E_RESTRICTED_API_PATH), {
      headers: { Authorization: `Bearer ${restricted.token}` },
    });
    expect([403, 404]).toContain(denied.status());

    const admin = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    const allowed = await api.get('/api/user/me', { headers: { Authorization: `Bearer ${admin.token}` } });
    expect(allowed.status()).toBe(200);
  });

  test('Tenant A y Tenant B no cruzan lectura ni archivos', async () => {
    const tenantA = await login(api, String(process.env.E2E_TENANT_A_EMAIL), String(process.env.E2E_TENANT_A_PASSWORD));
    const tenantB = await login(api, String(process.env.E2E_TENANT_B_EMAIL), String(process.env.E2E_TENANT_B_PASSWORD));
    const aReadsB = await api.get(`/api/tenant-standards/${encodeURIComponent(String(process.env.E2E_TENANT_B_ID))}`, {
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });
    const bReadsA = await api.get(`/api/tenant-standards/${encodeURIComponent(String(process.env.E2E_TENANT_A_ID))}`, {
      headers: { Authorization: `Bearer ${tenantB.token}` },
    });
    expect([403, 404]).toContain(aReadsB.status());
    expect([403, 404]).toContain(bReadsA.status());

    const aReadsBFile = await api.get(String(process.env.E2E_TENANT_B_FILE_PATH), {
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });
    const bReadsAFile = await api.get(String(process.env.E2E_TENANT_A_FILE_PATH), {
      headers: { Authorization: `Bearer ${tenantB.token}` },
    });
    expect([403, 404]).toContain(aReadsBFile.status());
    expect([403, 404]).toContain(bReadsAFile.status());
  });

  test('reportes/exportación responde con contrato autorizado', async () => {
    const admin = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    const response = await api.get('/api/reports/types?locale=es', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  for (const route of authorizedRoutes) {
    test(`capacidad autorizada carga: ${route}`, async ({ page }) => {
      const admin = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
      await installSession(page, admin.token);
      const consoleErrors: string[] = [];
      const serverFailures: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('response', response => {
        if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`);
      });
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status() || 0).toBeLessThan(500);
      await expect(page.locator('body')).toContainText(/\S/);
      expect(serverFailures).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});
