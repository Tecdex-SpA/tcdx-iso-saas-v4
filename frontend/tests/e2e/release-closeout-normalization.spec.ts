import crypto from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';

const criticalRoutes = [
  '/dashboard',
  '/dashboard?view=kpi',
  '/ia-compliance',
  '/ia-auditor',
  '/acciones-recomendadas',
  '/planes-accion',
  '/encuestas',
  '/grc',
  '/health',
  '/iso-health',
];

type Session = {
  token: string;
  tenantId: string;
  userId: string;
};

function base64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createSession(): Session {
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const payload = {
    user_id: userId,
    tenant_id: tenantId,
    email: 'release-closeout@example.invalid',
    role: 'platform_admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return {
    token: `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`,
    tenantId,
    userId,
  };
}

async function installSession(page: Page, session: Session) {
  await page.addInitScript(({ token, tenantId, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('authToken', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('activeTenantId', tenantId);
  }, session);
}

function capability(key: string, source = 'plan') {
  return {
    capability_key: key,
    enabled: true,
    decision: 'allowed',
    source,
    reason_code: 'ALLOWED',
    effective_from: null,
    effective_until: null,
    limit: null,
    usage: 0,
    remaining: null,
    dependencies: [],
    read_only: false,
    rbac_allowed: true,
    module_active: true,
  };
}

function canonicalHealth() {
  return {
    formula_code: 'F5_5_GRC_HEALTH',
    formula_version: 2,
    score: 82,
    status: 'measured',
    coverage: 0.86,
    confidence: 0.82,
    minimum_coverage: 0.6,
    period: 'current',
    components: [
      { code: 'EVIDENCE-FRESH', status: 'AVAILABLE', value: 85, weight: 0.25 },
      { code: 'COVERAGE', status: 'AVAILABLE', value: 80, weight: 0.25 },
      { code: 'DATA-TRUST', status: 'NOT_CONFIGURED', value: null, weight: 0.25 },
      { code: 'KPI-HLT-OPS', status: 'AVAILABLE', value: 83, weight: 0.25 },
    ],
    missing_components: [{ code: 'DATA-TRUST', status: 'NOT_CONFIGURED' }],
    source: {
      authority: 'official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings',
      compatibility_sources: ['KPI-HLT-*'],
    },
  };
}

function entitlements(tenantId: string) {
  const capabilities = Object.fromEntries(
    [
      ['core.dashboard', 'plan'],
      ['iso.compliance', 'plan'],
      ['iso.actions', 'plan'],
      ['iso.health', 'plan'],
      ['data.governance', 'plan'],
      ['surveys.engine', 'plan'],
      ['ai.compliance', 'addon'],
      ['ai.auditor', 'addon'],
    ].map(([key, source]) => [key, capability(key, source)])
  );

  return {
    ok: true,
    tenant_id: tenantId,
    subscription: { status: 'active', plan_key: 'grc' },
    modules: Object.keys(capabilities).map((capability_key) => ({ capability_key, enabled: true })),
    addons: [{ addon_key: 'ai', status: 'active' }],
    capabilities,
    limits: {},
    usage: {},
    health: {},
    ai: {
      enabled: true,
      plan: 'none',
      web_enabled: true,
      report_enabled: true,
      auditor_enabled: true,
      features: {
        auditor: true,
        suggestions: true,
        web_research: true,
        report_enrichment: true,
        document_generation: true,
        company_profile_analysis: true,
      },
      quota: { monthly: null, used: 0 },
    },
  };
}

function enabledModuleMap() {
  return Object.fromEntries(
    [
      'core',
      'compliance',
      'ai_compliance',
      'actions',
      'health',
      'grc',
      'metrics_bi',
      'surveys_assessments',
    ].map((module_key) => [module_key, { module_key, is_enabled: true }])
  );
}

function permissionMap() {
  return Object.fromEntries(
    [
      'dashboards.read',
      'ai.view',
      'audit.review',
      'actions.view',
      'actions.manage',
      'health.view',
      'workflow.read',
      'metrics.read',
      'surveys.read',
    ].map((permission) => [permission, true])
  );
}

function apiPayload(pathname: string, session: Session) {
  const health = canonicalHealth();

  if (pathname === '/api/me/entitlements') return entitlements(session.tenantId);
  if (pathname === '/api/me/modules') {
    return {
      ok: true,
      tenant_id: session.tenantId,
      capabilities: entitlements(session.tenantId).capabilities,
      modules: entitlements(session.tenantId).modules,
      module_map: enabledModuleMap(),
      scope: { tenant_id: session.tenantId, role: 'platform_admin', service_status: 'active', is_platform: true },
    };
  }
  if (pathname === '/api/me/permissions') return { ok: true, permission_map: permissionMap() };
  if (pathname === '/api/auth/validate' || pathname === '/api/user/me') {
    return {
      ok: true,
      user: { id: session.userId, tenant_id: session.tenantId, role: 'platform_admin' },
      tenant_id: session.tenantId,
      role: 'platform_admin',
    };
  }
  if (pathname === '/api/health/dashboard' || pathname === '/api/metrics/official/dashboard') {
    return { ok: true, data: { canonical_health: health, global_health: health, metrics: [], alerts: {} } };
  }
  if (pathname === '/api/health/summary') {
    return { ok: true, data: [{ tenant_id: session.tenantId, tenant_name: 'Release Closeout', canonical_health: health, tenant_health_score: 82, tenant_health_status: 'measured' }] };
  }
  if (pathname === '/api/health/kpis') {
    return { ok: true, data: [{ code: 'GRC-HEALTH', name: 'Global GRC Health', canonical_health: health, value: 82, status: 'measured' }] };
  }
  if (pathname === '/api/grc/overview') {
    return {
      ok: true,
      data: {
        tenant: { data: { id: session.tenantId, name: 'Release Closeout' } },
        canonical_health: health,
        health,
        risks: { total: 1, critical: 0 },
        controls: { total: 1, active: 1 },
        evidences: { total: 1, pending: 0 },
      },
    };
  }
  if (pathname === '/api/ai-compliance/engine-health') return { ok: true, data: { ok: true, service: 'ai-engine', db_connection: true } };
  if (pathname === '/api/ai-compliance/health-summary') return { ok: true, data: { tenant_name: 'Release Closeout', status: 'operational', controls_total: 1, controls_warning: 0, evidences_pending: 0 } };
  if (pathname === '/api/ai-compliance/suggestions') return { ok: true, data: [] };
  if (pathname === '/api/ai-compliance/executive-brief') return { ok: true, data: { executive_summary: 'Canonical fixture', confidence: 0.82, recommended_actions: [] } };
  if (pathname.startsWith('/health/')) return { ok: true, data: [] };

  return {
    ok: true,
    data: [],
    items: [],
    metrics: [],
    indicators: [],
    summary: null,
    canonical_health: health,
  };
}

async function mockApi(page: Page, session: Session) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiPayload(url.pathname, session)),
    });
  });
  await page.route('**/health/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/_next/')) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiPayload(url.pathname, session)),
    });
  });
}

test.describe('Release closeout critical routes', () => {
  test.beforeEach(async ({ page }) => {
    const session = createSession();
    await installSession(page, session);
    await mockApi(page, session);
  });

  for (const routePath of criticalRoutes) {
    test(`${routePath} renders without client or server failure`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const serverFailures: string[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`);
      });

      const response = await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      expect(response?.status() || 0).toBeLessThan(500);
      await expect(page.locator('body')).toContainText(/\S/);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/Application error|Unhandled Runtime Error|404: This page could not be found/i);
      expect(serverFailures).toEqual([]);
      expect(consoleErrors.filter((entry) => /hydration|uncaught|typeerror|referenceerror|failed to load resource/i.test(entry))).toEqual([]);
    });
  }

  test('health surfaces expose the same canonical authority fixture', async ({ page }) => {
    for (const routePath of ['/dashboard?view=kpi', '/health', '/iso-health']) {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/GRC|Health|Salud|Cobertura|Confianza/i);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/Application error|Unhandled Runtime Error/i);
    }
  });
});
