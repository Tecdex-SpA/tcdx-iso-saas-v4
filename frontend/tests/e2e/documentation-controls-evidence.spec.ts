import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Scenario = { key: 'iso9001' | 'iso27001' | 'integrated'; email: string; iso: 'ISO9001' | 'ISO27001'; evidenceCode: string; evidenceDescription: string };

const root = path.resolve(__dirname, '../../..');
const outputRoot = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const resultsFile = path.resolve(root, 'artifacts/documentation/controls-evidence.json');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const writeEnabled = String(process.env.DOC_ENABLE_WRITES || '').toLowerCase() === 'true';
const results: unknown[] = [];

const scenarios: Scenario[] = [
  { key: 'iso9001', email: 'admin.demo9001@tcdx.demo', iso: 'ISO9001', evidenceCode: 'DOC-EV-QMS-001', evidenceDescription: 'DOC-EV-QMS-001 Evidencia de revisión operativa ISO 9001' },
  { key: 'iso27001', email: 'admin.demo27001@tcdx.demo', iso: 'ISO27001', evidenceCode: 'DOC-EV-ISMS-001', evidenceDescription: 'DOC-EV-ISMS-001 Evidencia de revisión operativa ISO 27001' },
  { key: 'integrated', email: 'admin.demoisos@tcdx.demo', iso: 'ISO9001', evidenceCode: 'DOC-EV-IMS-001', evidenceDescription: 'DOC-EV-IMS-001 Evidencia integrada de control y cumplimiento' },
];

function decodeJwt(token: string) {
  try {
    const part = token.split('.')[1] || '';
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch { return {}; }
}

async function login(api: APIRequestContext, email: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `login ${email}`).toBe(200);
  const token = String(body.token || body.accessToken || body.data?.token || body.data?.accessToken || '');
  expect(token).toBeTruthy();
  const claims = decodeJwt(token);
  const tenantId = String(body.tenant_id || body.tenantId || body.user?.tenant_id || body.data?.tenant_id || body.data?.user?.tenant_id || claims.tenant_id || claims.tenantId || '');
  const role = String(body.role || body.user?.role || body.data?.role || body.data?.user?.role || claims.role || '').toLowerCase();
  expect(tenantId).toBeTruthy();
  expect(role).toBe('admin');
  return { token, tenantId };
}

async function json(api: APIRequestContext, method: 'GET' | 'POST' | 'PUT', url: string, token: string, data?: unknown) {
  const options: any = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (data !== undefined) options.data = data;
  const response = method === 'GET' ? await api.get(url, options) : method === 'POST' ? await api.post(url, options) : await api.put(url, options);
  const body = await response.json().catch(() => ({}));
  expect(response.ok(), `${method} ${url}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

function collectionRows(body: any): any[] {
  if (Array.isArray(body)) return body;
  const keys = [
    'effective_controls',
    'generic_controls',
    'personalized_controls',
    'evidences',
    'data',
    'controls',
    'items',
    'rows',
  ];
  for (const key of keys) if (Array.isArray(body?.[key])) return body[key];
  if (body?.data && typeof body.data === 'object') {
    for (const key of keys) if (Array.isArray(body.data?.[key])) return body.data[key];
  }
  return [];
}

async function getOperationalControl(api: APIRequestContext, token: string, tenantId: string, iso: string) {
  let catalog = await json(api, 'GET', `/api/controls/catalog/${tenantId}/${iso}`, token);
  let rows = collectionRows(catalog);
  expect(rows.length, `catalog ${iso}: ${JSON.stringify(Object.keys(catalog || {}))}`).toBeGreaterThan(0);

  let row = rows.find((item: any) => item.tenant_control_id) || rows.find((item: any) => item.id || item.control_id);
  expect(row).toBeTruthy();

  if (!row.tenant_control_id) {
    const catalogControlId = String(row.id || row.control_id || row.catalog_control_id || '');
    expect(catalogControlId).toBeTruthy();
    await json(api, 'POST', `/api/controls/catalog/${catalogControlId}/enable`, token, {
      tenant_id: tenantId,
      operation_id: catalog.operation?.id || undefined,
      iso,
    });
    catalog = await json(api, 'GET', `/api/controls/catalog/${tenantId}/${iso}`, token);
    rows = collectionRows(catalog);
    row = rows.find((item: any) => String(item.id || item.control_id || item.catalog_control_id || '') === catalogControlId && item.tenant_control_id)
      || rows.find((item: any) => item.tenant_control_id);
  }

  expect(row?.tenant_control_id, `tenant control ${iso}`).toBeTruthy();
  return row;
}

async function ensureEvidence(api: APIRequestContext, token: string, tenantId: string, scenario: Scenario, control: any) {
  const existingBody = await json(api, 'GET', `/api/evidences/${tenantId}?iso=${scenario.iso}`, token);
  const existingRows = collectionRows(existingBody);
  let evidence = existingRows.find((item: any) => String(item.description || '').includes(scenario.evidenceCode));
  if (evidence) return evidence;

  const fileBuffer = Buffer.from([
    `Código: ${scenario.evidenceCode}`,
    `Norma: ${scenario.iso}`,
    'Objeto: evidencia documental para manual de usuario TCDX ISO SaaS v4.',
    'Resultado esperado: demostrar carga, revisión y aprobación de evidencia mediante el flujo real del producto.',
  ].join('\n'), 'utf8');

  const response = await api.post('/api/evidences/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      tenant_id: tenantId,
      tenant_control_id: String(control.tenant_control_id),
      control_id: String(control.id || control.control_id || control.catalog_control_id || ''),
      description: scenario.evidenceDescription,
      evidence_type: 'documental',
      file: { name: `${scenario.evidenceCode}.txt`, mimeType: 'text/plain', buffer: fileBuffer },
    },
  });
  const body = await response.json().catch(() => ({}));
  expect(response.ok(), `upload evidence ${scenario.key}: ${JSON.stringify(body)}`).toBeTruthy();
  evidence = body.data || body.evidence || body;
  expect(evidence?.id).toBeTruthy();
  return evidence;
}

async function capture(page: Page, scenario: Scenario, name: string) {
  const dir = path.join(outputRoot, scenario.key, 'controls-evidence');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function installSession(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

test.beforeAll(() => {
  expect(apiBase).toBeTruthy();
  expect(password).toBeTruthy();
  expect(writeEnabled).toBeTruthy();
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
});

test.afterAll(() => fs.writeFileSync(resultsFile, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)));

for (const scenario of scenarios) {
  test(`${scenario.key} control to evidence flow`, async ({ page }) => {
    const api = await createRequest.newContext({ baseURL: apiBase });
    try {
      const { token, tenantId } = await login(api, scenario.email);
      const control = await getOperationalControl(api, token, tenantId, scenario.iso);

      await json(api, 'PUT', `/api/controls/workbench/${control.tenant_control_id}`, token, {
        tenant_id: tenantId,
        status: 'parcial',
        score: 65,
        priority: 'media',
        responsible_user_id: scenario.email,
        last_reviewed_at: new Date().toISOString(),
      });

      await installSession(page, token);
      await page.goto('/controles', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/Control|Controles|Cumplimiento/i);
      await capture(page, scenario, '01-control-operativo-parcial');

      const evidence = await ensureEvidence(api, token, tenantId, scenario, control);

      await page.goto('/evidencias', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/Evidencia|Evidencias/i);
      await expect(page.locator('body')).toContainText(scenario.evidenceCode);
      await capture(page, scenario, '02-evidencia-cargada-pendiente');

      await json(api, 'PUT', `/api/evidences/approve/${evidence.id}`, token, { status: 'aprobada' });
      const verified = await json(api, 'GET', `/api/evidences/${tenantId}?iso=${scenario.iso}`, token);
      const verifiedRows = collectionRows(verified);
      const approved = verifiedRows.find((item: any) => String(item.id) === String(evidence.id));
      expect(String(approved?.status || '').toLowerCase()).toBe('aprobada');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(scenario.evidenceCode);
      await expect(page.locator('body')).toContainText(/Aprobada|Aprobado/i);
      await capture(page, scenario, '03-evidencia-aprobada');

      await page.goto('/controles', { waitUntil: 'domcontentloaded' });
      await capture(page, scenario, '04-control-post-evidencia');

      results.push({ scenario: scenario.key, tenantId, iso: scenario.iso, status: 'PASS', tenantControlId: control.tenant_control_id, evidenceId: evidence.id, evidenceCode: scenario.evidenceCode });
    } finally {
      await api.dispose();
    }
  });
}
