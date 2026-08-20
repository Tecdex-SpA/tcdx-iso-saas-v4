import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Role = 'admin' | 'operativo' | 'auditor' | 'viewer';
type ScenarioKey = 'iso9001' | 'iso27001' | 'integrated';

type Scenario = {
  key: ScenarioKey;
  tenantLabel: string;
  expectedStandards: string[];
  accounts: Record<Role, string>;
};

type LoginResult = {
  token: string;
  body: any;
};

type Identity = {
  tenantId: string;
  role: string;
  source: 'login_response' | 'jwt';
};

type ManifestEntry = {
  id: string;
  scenario: ScenarioKey;
  tenantLabel: string;
  tenantId: string;
  role: Role;
  route: string;
  standards: string[];
  file: string;
  capturedAt: string;
};

const root = path.resolve(__dirname, '../../..');
const outputRoot = path.resolve(
  root,
  process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots',
);
const manifestFile = path.resolve(
  root,
  process.env.DOC_MANIFEST_FILE || 'artifacts/documentation/manifest.json',
);
const validationFile = path.resolve(
  root,
  process.env.DOC_VALIDATION_FILE || 'artifacts/documentation/validation.json',
);

const webBase = String(process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const apiBase = String(process.env.DOC_API_BASE_URL || webBase).replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const requestedScenario = String(process.env.DOC_SCENARIO || 'all').toLowerCase();

const scenarios: Scenario[] = [
  {
    key: 'iso9001',
    tenantLabel: 'demo.9001',
    expectedStandards: ['ISO9001'],
    accounts: {
      admin: 'admin.demo9001@tcdx.demo',
      operativo: 'operativo.demo9001@tcdx.demo',
      auditor: 'auditor.demo9001@tcdx.demo',
      viewer: 'viewer.demo9001@tcdx.demo',
    },
  },
  {
    key: 'iso27001',
    tenantLabel: 'demo.27001',
    expectedStandards: ['ISO27001'],
    accounts: {
      admin: 'admin.demo27001@tcdx.demo',
      operativo: 'operativo.demo27001@tcdx.demo',
      auditor: 'auditor.demo27001@tcdx.demo',
      viewer: 'viewer.demo27001@tcdx.demo',
    },
  },
  {
    key: 'integrated',
    tenantLabel: 'demo.isos',
    expectedStandards: ['ISO9001', 'ISO27001'],
    accounts: {
      admin: 'admin.demoisos@tcdx.demo',
      operativo: 'operativo.demoisos@tcdx.demo',
      auditor: 'auditor.demoisos@tcdx.demo',
      viewer: 'viewer.demoisos@tcdx.demo',
    },
  },
];

const routesByRole: Record<Role, string[]> = {
  admin: [
    '/dashboard',
    '/usuarios',
    '/perfil-empresa',
    '/configuracion',
    '/cumplimiento-auditoria',
    '/diagnostico',
    '/controles',
    '/iso-health',
    '/health',
    '/evidencias',
    '/auditorias',
    '/hallazgos',
    '/no-conformidades',
    '/planes-accion',
    '/ciclo-vida',
    '/administrar-kpis',
    '/ia-compliance',
    '/reportes',
  ],
  operativo: ['/dashboard', '/evidencias', '/planes-accion', '/hallazgos'],
  auditor: [
    '/dashboard',
    '/cumplimiento-auditoria',
    '/diagnostico',
    '/controles',
    '/evidencias',
    '/auditorias',
    '/auditorias?view=ia',
    '/hallazgos',
    '/no-conformidades',
    '/ciclo-vida',
    '/iso-health',
    '/ia-compliance',
    '/reportes',
  ],
  viewer: ['/dashboard', '/iso-health', '/health'],
};

const selectedScenarios = scenarios.filter(
  (scenario) => requestedScenario === 'all' || requestedScenario === scenario.key,
);

const manifest: ManifestEntry[] = [];
const validation: Record<string, unknown>[] = [];

function sanitizeRoute(route: string) {
  const [pathname, query] = route.split('?');
  const base = pathname.replace(/^\//, '').replace(/\//g, '-') || 'home';
  return query ? `${base}-${query.replace(/[^a-z0-9]+/gi, '-')}` : base;
}

function decodeJwtPayload(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(normalized + padding, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function pickIdentity(candidate: any): { tenantId: string; role: string } | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const tenantId =
    candidate.tenant_id ||
    candidate.tenantId ||
    candidate.company_id ||
    candidate.companyId ||
    candidate.tenant?.id ||
    candidate.company?.id ||
    '';
  const role = candidate.role || candidate.user_role || candidate.userRole || candidate.profile || '';
  if (!tenantId || !role) return null;
  return { tenantId: String(tenantId), role: String(role).toLowerCase() };
}

function resolveIdentity(loginBody: any, token: string): Identity {
  const loginCandidates = [
    loginBody,
    loginBody?.user,
    loginBody?.data,
    loginBody?.data?.user,
    loginBody?.profile,
  ];
  for (const candidate of loginCandidates) {
    const identity = pickIdentity(candidate);
    if (identity) return { ...identity, source: 'login_response' };
  }

  const claims = decodeJwtPayload(token);
  const jwtCandidates = [claims, claims?.user, claims?.data];
  for (const candidate of jwtCandidates) {
    const identity = pickIdentity(candidate);
    if (identity) return { ...identity, source: 'jwt' };
  }

  const safeLoginKeys = loginBody && typeof loginBody === 'object' ? Object.keys(loginBody) : [];
  const safeClaimKeys = Object.keys(claims);
  throw new Error(
    `Unable to resolve tenant/role from authenticated session. login keys=${safeLoginKeys.join(',')} jwt keys=${safeClaimKeys.join(',')}`,
  );
}

async function login(api: APIRequestContext, email: string): Promise<LoginResult> {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `Login failed for ${email}: ${JSON.stringify(body)}`).toBe(200);
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken || '';
  expect(token, `Token missing for ${email}`).toBeTruthy();
  return { token: String(token), body };
}

async function installSession(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

async function getOperationalScope(api: APIRequestContext, token: string, tenantId: string) {
  const response = await api.get(`/api/tenant-standards/scope/${tenantId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `Scope failed: ${JSON.stringify(body)}`).toBe(200);
  return body;
}

function activeStandardCodes(scope: any) {
  return (Array.isArray(scope?.standards) ? scope.standards : [])
    .filter(
      (standard: any) =>
        standard?.is_active === true &&
        Number(standard?.active_operations_count || 0) > 0 &&
        Array.isArray(standard?.active_operation_ids) &&
        standard.active_operation_ids.length > 0,
    )
    .map((standard: any) => String(standard.code || standard.standard_code || ''))
    .filter(Boolean)
    .sort();
}

async function waitForStableUi(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined);
  await expect(page.getByText(/cargando…|cargando\.\.\./i)).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined);
  await expect(page.locator('body')).not.toContainText(
    /application error|internal server error|error boundary/i,
  );
}

async function captureRoute(
  page: Page,
  scenario: Scenario,
  role: Role,
  tenantId: string,
  route: string,
) {
  const serverErrors: string[] = [];
  const onResponse = (response: any) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  };
  page.on('response', onResponse);
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await waitForStableUi(page);
    expect(serverErrors, `${scenario.key} ${role} ${route}`).toEqual([]);

    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    expect(bodyText.length, `${scenario.key} ${role} ${route} body`).toBeGreaterThan(50);
    expect(bodyText).not.toMatch(/capability.+(bloqueada|no habilitada)/i);

    const dir = path.join(outputRoot, scenario.key, role);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${sanitizeRoute(route)}.png`;
    const file = path.join(dir, filename);
    await page.screenshot({ path: file, fullPage: true });

    manifest.push({
      id: `${scenario.key}-${role}-${sanitizeRoute(route)}`.toUpperCase(),
      scenario: scenario.key,
      tenantLabel: scenario.tenantLabel,
      tenantId,
      role,
      route,
      standards: scenario.expectedStandards,
      file: path.relative(root, file),
      capturedAt: new Date().toISOString(),
    });
  } finally {
    page.off('response', onResponse);
  }
}

test.beforeAll(() => {
  expect(webBase, 'DOC_WEB_BASE_URL is required').toBeTruthy();
  expect(apiBase, 'DOC_API_BASE_URL or DOC_WEB_BASE_URL is required').toBeTruthy();
  expect(password, 'DOC_DEMO_PASSWORD is required').toBeTruthy();
  expect(selectedScenarios.length, `Unknown DOC_SCENARIO=${requestedScenario}`).toBeGreaterThan(0);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(manifestFile, JSON.stringify({ generatedAt: new Date().toISOString(), entries: manifest }, null, 2));
  fs.writeFileSync(validationFile, JSON.stringify({ generatedAt: new Date().toISOString(), checks: validation }, null, 2));
});

for (const scenario of selectedScenarios) {
  test.describe(`${scenario.key} documentation capture`, () => {
    for (const role of Object.keys(scenario.accounts) as Role[]) {
      test(`${scenario.key} ${role} validates tenant, ISO scope and captures allowed views`, async ({ page }) => {
        const api = await createRequest.newContext({ baseURL: apiBase });
        try {
          const auth = await login(api, scenario.accounts[role]);
          const identity = resolveIdentity(auth.body, auth.token);
          expect(identity.role, `${scenario.key} ${role} role mismatch`).toBe(role);

          const scope = await getOperationalScope(api, auth.token, identity.tenantId);
          const actualStandards = activeStandardCodes(scope);
          expect(actualStandards, `${scenario.key} operational standards`).toEqual(
            [...scenario.expectedStandards].sort(),
          );

          validation.push({
            scenario: scenario.key,
            tenantLabel: scenario.tenantLabel,
            tenantId: identity.tenantId,
            role,
            email: scenario.accounts[role],
            identitySource: identity.source,
            operationalStandards: actualStandards,
            status: 'PASS',
            checkedAt: new Date().toISOString(),
          });

          await installSession(page, auth.token);
          const routes = [...routesByRole[role]];
          if ((scenario.key === 'iso27001' || scenario.key === 'integrated') && (role === 'admin' || role === 'auditor')) {
            routes.splice(routes.indexOf('/evidencias'), 0, '/soa');
          }

          for (const route of routes) {
            await captureRoute(page, scenario, role, identity.tenantId, route);
          }
        } finally {
          await api.dispose();
        }
      });
    }
  });
}
