import { expect, test, type Page, type Route } from '@playwright/test';

const LEGACY_PROCESS_ID = 'a6534ef8-2a87-2d80-38bb-bcea295a9a1e';

const profiles = [
  { name: 'tenant-1 admin', role: 'admin', userId: '70000000-0000-0000-0000-000000000712', tenantId: '70000000-0000-0000-0000-000000000701' },
  { name: 'tenant-1 auditor', role: 'auditor', userId: '70000000-0000-0000-0000-000000000713', tenantId: '70000000-0000-0000-0000-000000000701' },
  { name: 'tenant-2 admin', role: 'admin', userId: '029b2461-7542-243c-4b73-e77c039018ec', tenantId: '76c44a0e-6041-8bda-99c7-b740fccea001' },
  { name: 'tenant-2 auditor', role: 'auditor', userId: '99493ee8-0f4d-160d-03b1-47ac923f9768', tenantId: '76c44a0e-6041-8bda-99c7-b740fccea001' },
] as const;

function jwt(profile: (typeof profiles)[number]) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: profile.userId,
    user_id: profile.userId,
    tenant_id: profile.tenantId,
    role: profile.role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`;
}

async function installApi(page: Page, profile: (typeof profiles)[number]) {
  const token = jwt(profile);
  const counts = new Map<string, number>();
  const consoleErrors: string[] = [];
  const badResponses: Array<{ url: string; status: number }> = [];
  const authenticatedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });

  await page.addInitScript(({ token, tenantId, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('user_id', userId);
  }, { token, tenantId: profile.tenantId, userId: profile.userId });

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (['/api/me/modules', '/api/users', '/api/dashboards', '/api/grc/official/analytics/catalog'].includes(url.pathname) || url.pathname.startsWith('/api/tenant-process')) {
      authenticatedRequests.push(route.request().headers().authorization || '');
    }
    counts.set(url.pathname, (counts.get(url.pathname) || 0) + 1);
    let body: unknown = { ok: true, data: [] };

    if (url.pathname === '/api/me/modules') {
      await new Promise((resolve) => setTimeout(resolve, 30));
      body = {
        ok: true,
        scope: { user_id: profile.userId, tenant_id: profile.tenantId, role: profile.role, service_status: 'active' },
        module_map: {
          metrics_bi: { module_key: 'metrics_bi', is_enabled: true },
          evidences: { module_key: 'evidences', is_enabled: true },
        },
      };
    } else if (url.pathname === '/api/me/entitlements') {
      body = { ok: true, tenant_id: profile.tenantId, capabilities: {}, limits: {}, ai: { enabled: false, plan: 'none', features: {}, quota: { used: 0 } } };
    } else if (url.pathname === '/api/me/permissions') {
      body = { ok: true, permission_map: {} };
    } else if (url.pathname === '/api/users') {
      body = [];
    } else if (url.pathname === '/api/dashboards') {
      body = { ok: true, data: [] };
    } else if (url.pathname === '/api/grc/official/analytics/catalog') {
      await new Promise((resolve) => setTimeout(resolve, 30));
      body = { ok: true, data: [] };
    } else if (url.pathname === '/api/tenant-processes') {
      body = { ok: true, data: [{ id: LEGACY_PROCESS_ID, name: 'Proceso legacy tenant 2', code: 'LEGACY' }] };
    } else if (url.pathname === `/api/tenant-processes/${LEGACY_PROCESS_ID}/operations`) {
      body = { ok: true, data: [{ id: '10000000-0000-0000-0000-000000000001', process_id: LEGACY_PROCESS_ID, name: 'Operación preservada' }] };
    } else if (url.pathname === `/api/tenant-process-links/by-process/${LEGACY_PROCESS_ID}`) {
      body = { ok: true, process: { id: LEGACY_PROCESS_ID, tenant_id: profile.tenantId }, data: [{ id: '20000000-0000-0000-0000-000000000001', process_id: LEGACY_PROCESS_ID, target_type: 'control', target_id: '30000000-0000-0000-0000-000000000001', relation_type: 'associated', source: 'manual', is_active: true }] };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  return { counts, consoleErrors, badResponses, authenticatedRequests, token };
}

for (const profile of profiles) {
  test(`${profile.name}: rutas auditadas preservan requests, RBAC y aislamiento`, async ({ page }) => {
    const audit = await installApi(page, profile);
    const routes = ['/dashboard', '/evidencias', '/bi', '/usuarios', '/configuracion'];

    for (const path of routes) {
      const modulesBefore = audit.counts.get('/api/me/modules') || 0;
      const usersBefore = audit.counts.get('/api/users') || 0;
      const dashboardsBefore = audit.counts.get('/api/dashboards') || 0;
      const catalogBefore = audit.counts.get('/api/grc/official/analytics/catalog') || 0;

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_200);

      expect((audit.counts.get('/api/me/modules') || 0) - modulesBefore, `${profile.name} ${path} modules`).toBeLessThanOrEqual(1);
      if (path === '/usuarios') {
        expect((audit.counts.get('/api/users') || 0) - usersBefore).toBe(profile.role === 'auditor' ? 0 : 1);
      }
      if (path === '/bi') {
        expect((audit.counts.get('/api/dashboards') || 0) - dashboardsBefore).toBe(profile.role === 'auditor' ? 0 : 1);
        expect((audit.counts.get('/api/grc/official/analytics/catalog') || 0) - catalogBefore).toBe(1);
      }
    }

    if (profile.role === 'auditor') {
      expect(audit.counts.get('/api/users') || 0).toBe(0);
      expect(audit.counts.get('/api/dashboards') || 0).toBe(0);
      expect(audit.consoleErrors.filter((message) => message.includes('RBAC_DENIED'))).toEqual([]);
    }
    if (profile.role === 'admin') {
      expect(audit.counts.get(`/api/tenant-process-links/by-process/${LEGACY_PROCESS_ID}`) || 0).toBe(1);
    }

    expect(audit.badResponses).toEqual([]);
    expect(audit.consoleErrors.filter((message) => /hydration|failed to load resource/i.test(message))).toEqual([]);
    expect(new Set(audit.authenticatedRequests)).toEqual(new Set([`Bearer ${audit.token}`]));
  });
}

test('navegación autenticada mantiene un bootstrap por carga completa', async ({ page }) => {
  const audit = await installApi(page, profiles[0]);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_200);
  expect(audit.counts.get('/api/me/modules') || 0).toBe(1);

  await page.locator('a[href="/evidencias"]').first().click();
  await page.waitForURL('**/evidencias');
  await page.waitForTimeout(500);
  expect(audit.counts.get('/api/me/modules') || 0).toBe(2);
});
