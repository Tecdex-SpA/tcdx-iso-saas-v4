import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type ScenarioKey = 'iso9001' | 'iso27001' | 'integrated';
type ReadinessStatus =
  | 'VALID'
  | 'BLOCKED_REDIRECT'
  | 'BLOCKED_ENTITLEMENT_OR_CAPABILITY'
  | 'PRODUCT_GAP_ROUTING_COLLISION'
  | 'INVALID_404'
  | 'INVALID_SERVER_ERROR';

type Scenario = {
  key: ScenarioKey;
  tenantLabel: string;
  adminEmail: string;
};

type ReadinessEntry = {
  scenario: ScenarioKey;
  tenantLabel: string;
  route: string;
  finalUrl: string;
  contentType: string;
  status: ReadinessStatus;
  reason: string;
  checkedAt: string;
};

const root = path.resolve(__dirname, '../../..');
const readinessFile = path.resolve(
  root,
  process.env.DOC_READINESS_FILE || 'artifacts/documentation/readiness.json',
);
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const requestedScenario = String(process.env.DOC_SCENARIO || 'all').toLowerCase();

const scenarios: Scenario[] = [
  { key: 'iso9001', tenantLabel: 'demo.9001', adminEmail: 'admin.demo9001@tcdx.demo' },
  { key: 'iso27001', tenantLabel: 'demo.27001', adminEmail: 'admin.demo27001@tcdx.demo' },
  { key: 'integrated', tenantLabel: 'demo.isos', adminEmail: 'admin.demoisos@tcdx.demo' },
];

const routes = ['/dashboard', '/iso-health', '/health', '/ia-compliance', '/exportes'];
const selectedScenarios = scenarios.filter(
  (scenario) => requestedScenario === 'all' || requestedScenario === scenario.key,
);
const entries: ReadinessEntry[] = [];

async function login(api: APIRequestContext, email: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `Login failed for ${email}: ${JSON.stringify(body)}`).toBe(200);
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken || '';
  expect(token, `Token missing for ${email}`).toBeTruthy();
  return String(token);
}

async function installSession(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

function classify(
  route: string,
  finalUrl: string,
  contentType: string,
  bodyText: string,
  serverErrors: string[],
): { status: ReadinessStatus; reason: string } {
  if (serverErrors.length > 0) {
    return { status: 'INVALID_SERVER_ERROR', reason: serverErrors.join('; ') };
  }

  const requestedPath = new URL(route, 'https://documentation.invalid').pathname;
  const finalPath = new URL(finalUrl).pathname;

  if (route === '/health' && /application\/json/i.test(contentType)) {
    return {
      status: 'PRODUCT_GAP_ROUTING_COLLISION',
      reason: 'The frontend /health route is shadowed by the backend health endpoint in production.',
    };
  }

  if (finalPath !== requestedPath) {
    return {
      status: 'BLOCKED_REDIRECT',
      reason: `Requested ${requestedPath} but finished at ${finalPath}.`,
    };
  }

  if (/404|this page could not be found|página no encontrada/i.test(bodyText)) {
    return { status: 'INVALID_404', reason: 'The requested route rendered a 404/not-found state.' };
  }

  if (
    /acceso restringido|m[oó]dulo .+ no est[aá] habilitado|capacidad no est[aá] habilitada|capability.+(bloqueada|no habilitada)/i.test(
      bodyText,
    )
  ) {
    return {
      status: 'BLOCKED_ENTITLEMENT_OR_CAPABILITY',
      reason: 'The route rendered an entitlement/capability restriction state.',
    };
  }

  return { status: 'VALID', reason: 'Route stayed on target and did not render a known blocking state.' };
}

test.beforeAll(() => {
  expect(apiBase, 'DOC_API_BASE_URL or DOC_WEB_BASE_URL is required').toBeTruthy();
  expect(password, 'DOC_DEMO_PASSWORD is required').toBeTruthy();
  expect(selectedScenarios.length, `Unknown DOC_SCENARIO=${requestedScenario}`).toBeGreaterThan(0);
  fs.mkdirSync(path.dirname(readinessFile), { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(
    readinessFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2),
  );
});

for (const scenario of selectedScenarios) {
  test(`${scenario.key} classifies documentation-critical routes`, async ({ page }) => {
    const api = await createRequest.newContext({ baseURL: apiBase });
    try {
      const token = await login(api, scenario.adminEmail);
      await installSession(page, token);

      for (const route of routes) {
        const serverErrors: string[] = [];
        const onResponse = (response: any) => {
          if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
        };
        page.on('response', onResponse);

        try {
          const navigation = await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1200);
          const bodyText = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
          const contentType = navigation?.headers()?.['content-type'] || '';
          const result = classify(route, page.url(), contentType, bodyText, serverErrors);

          entries.push({
            scenario: scenario.key,
            tenantLabel: scenario.tenantLabel,
            route,
            finalUrl: page.url(),
            contentType,
            status: result.status,
            reason: result.reason,
            checkedAt: new Date().toISOString(),
          });
        } finally {
          page.off('response', onResponse);
        }
      }
    } finally {
      await api.dispose();
    }
  });
}
