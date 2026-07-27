import { expect, request as createRequest, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(__filename);
const root = path.resolve(__dirname, '../../..');
const { appendManifestResource } = require(path.join(root, 'scripts/phase1/phase1-qa-manifest.js'));
const apiBaseUrl = String(process.env.API_BASE_URL || 'http://phase1.invalid').replace(/\/$/, '');
const tenantId = String(process.env.PHASE1_TENANT_ID || '');
const runId = String(process.env.PHASE1_QA_RUN_ID || 'unconfigured').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);
const qaPrefix = `PHASE1R_QA_${runId}`;
const executionPass = String(process.env.PHASE1_E2E_PASS || 'full').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
const manifestPath = path.resolve(process.env.PHASE1_QA_MANIFEST || path.join(root, 'artifacts/fase-1/phase1-qa-manifest.json'));

function recordResource(key: string, id: string) {
  appendManifestResource(manifestPath, tenantId, key, id);
}

async function login(api: APIRequestContext, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  return { response, token: body.token || body.accessToken || body.data?.token || body.data?.accessToken,
    userId: body.user?.id || body.data?.user?.id || '' };
}

async function installSession(page: Page, token: string) {
  await page.addInitScript(value => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

async function selectAvailableOption(select: Locator, index = 0) {
  await expect(select).toBeVisible();
  const options = select.locator('option:not([value=""])');
  const optionCount = await options.count();
  expect(optionCount, `La lista debe contener al menos ${index + 1} opciones operables`).toBeGreaterThan(index);
  const option = options.nth(index);
  const value = await option.getAttribute('value');
  expect(value, 'La opción operable debe tener valor').toBeTruthy();
  await select.selectOption(String(value));
}

async function selectFirstAvailableOption(select: Locator) {
  await selectAvailableOption(select);
}

async function selectOptionByLabel(select: Locator, label: string) {
  await expect(select).toBeVisible();
  const option = select.locator('option', { hasText: label }).first();
  await expect(option, `No se cargó la opción requerida: ${label}`).toHaveCount(1);
  const value = await option.getAttribute('value');
  expect(value, `La opción ${label} no tiene valor`).toBeTruthy();
  await select.selectOption(String(value));
}

function workflowRow(page: Page, name: string) {
  return page.getByTitle(name, { exact: true }).locator('xpath=ancestor::div[.//button][1]');
}

async function expectMutation(
  page: Page,
  method: string,
  pathname: RegExp,
  action: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === method && pathname.test(url.pathname);
  });
  await action();
  const response = await responsePromise;
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `HTTP ${response.status()} ${response.request().method()} ${response.url()} ${JSON.stringify(body)}`).toBe(200);
  expect(body.ok, `Respuesta inválida ${JSON.stringify(body)}`).toBe(true);
  return body.data;
}

test.describe('Phase 1 GRC runtime', () => {
  let api: APIRequestContext | undefined;
  let adminToken = '';
  let restrictedToken = '';
  let reviewerToken = '';
  let adminUserId = '';
  let restrictedUserId = '';
  let reviewerUserId = '';
  let workflowId = '';
  let workflowPublished = false;
  let instanceId = '';
  const nonce = runId.toLowerCase();
  const workflowCode = `${qaPrefix}_evidence`.toLowerCase();
  const workflowName = `${qaPrefix} evidence workflow`;
  const evidenceRequestTitle = `${qaPrefix} evidence request`;

  function requireApi() {
    if (!api) throw new Error('Phase 1 API context is not initialized');
    return api;
  }

  async function ensureEvidenceWorkflow() {
    if (workflowId) return workflowId;
    const client = requireApi();
    const list = await client.get('/api/grc/workflows', { headers: { Authorization: `Bearer ${adminToken}` } });
    const listBody = await list.json().catch(() => ({}));
    expect(list.status(), `Workflow list failed: ${JSON.stringify(listBody)}`).toBe(200);
    const existing = listBody.data.find((item: { code: string }) => item.code === workflowCode);
    if (existing?.id) {
      workflowId = existing.id;
      recordResource('workflow_definition_ids', workflowId);
      return workflowId;
    }
    const response = await client.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': `phase1-workflow-${nonce}` },
      data: {
        code: workflowCode,
        name: workflowName,
        entity_type: 'evidence',
        states: [
          { code: 'draft', name: 'Borrador', state_type: 'initial' },
          { code: 'review', name: 'Revisión', state_type: 'active' },
          { code: 'approved', name: 'Aprobado', state_type: 'terminal' },
        ],
        transitions: [
          { code: 'submit', name: 'Enviar', from_state: 'draft', to_state: 'review', roles: ['admin', 'tenant_admin'], required_permission: 'workflow.transition' },
          { code: 'approve', name: 'Aprobar', from_state: 'review', to_state: 'approved', roles: ['admin', 'tenant_admin'], required_permission: 'workflow.transition', preconditions: ['comment_required'] },
        ],
      },
    });
    const body = await response.json().catch(() => ({}));
    expect(response.status(), `Workflow creation failed: ${JSON.stringify(body)}`).toBe(200);
    workflowId = body.data.definition.id;
    recordResource('workflow_definition_ids', workflowId);
    return workflowId;
  }

  async function ensurePublishedEvidenceWorkflow() {
    const definitionId = await ensureEvidenceWorkflow();
    if (!workflowPublished) {
      const detail = await requireApi().get(`/api/grc/workflows/${definitionId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      expect(detail.status()).toBe(200);
      workflowPublished = (await detail.json()).data.versions.some((item: { status: string }) => item.status === 'published');
    }
    if (!workflowPublished) {
      const published = await requireApi().post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } });
      expect(published.status()).toBe(200);
      workflowPublished = true;
    }
    return definitionId;
  }

  async function ensureEvidenceRequest() {
    const client = requireApi();
    const list = await client.get('/api/grc/evidence/requests', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(list.status()).toBe(200);
    const existing = (await list.json()).data.find((item: { title: string }) => item.title === evidenceRequestTitle);
    if (existing?.id) {
      recordResource('evidence_request_ids', existing.id);
      return existing.id as string;
    }
    const created = await client.post('/api/grc/evidence/requests', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { title: evidenceRequestTitle, status: 'requested', schedule: { frequency: 'monthly', interval_value: 1, start_at: new Date().toISOString() } },
    });
    const body = await created.json().catch(() => ({}));
    expect(created.status(), `Evidence request creation failed: ${JSON.stringify(body)}`).toBe(200);
    recordResource('evidence_request_ids', body.data.id);
    return body.data.id as string;
  }

  test.beforeAll(async () => {
    api = await createRequest.newContext({ baseURL: apiBaseUrl });
    const admin = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    const restricted = await login(api, String(process.env.E2E_RESTRICTED_EMAIL), String(process.env.E2E_RESTRICTED_PASSWORD));
    const reviewer = await login(api, String(process.env.E2E_REVIEWER_EMAIL), String(process.env.E2E_REVIEWER_PASSWORD));
    expect(admin.response.status()).toBe(200);
    expect(restricted.response.status()).toBe(200);
    expect(reviewer.response.status()).toBe(200);
    adminToken = admin.token;
    restrictedToken = restricted.token;
    adminUserId = admin.userId;
    restrictedUserId = restricted.userId;
    reviewerUserId = reviewer.userId;
    reviewerToken = reviewer.token;
  });

  test.afterAll(async () => {
    if (api) await api.dispose();
  });

  test('feature flag y permisos están activos en QA', async () => {
    const response = await requireApi().get('/api/grc/meta', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.module.is_enabled).toBe(true);
  });

  test('bootstrap explícito es confirmado, idempotente y deja el tenant listo', async () => {
    const client = requireApi();
    const before = await client.get('/api/grc/bootstrap/status', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(before.status()).toBe(200);
    const options = {
      headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': `phase1-bootstrap-${nonce}` },
      data: { confirmation: 'INITIALIZE_GRC' },
    };
    const first = await client.post('/api/grc/bootstrap', options);
    const replay = await client.post('/api/grc/bootstrap', options);
    expect(first.status()).toBe(200);
    expect(replay.status()).toBe(200);
    const initialized = (await first.json()).data;
    expect(initialized.ready).toBe(true);
    expect((await replay.json()).data).toEqual({ ...initialized, idempotent_replay: true });
    const validated = await client.post('/api/grc/bootstrap/validate', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(validated.status()).toBe(200);
    expect((await validated.json()).data.ready).toBe(true);
  });

  test('errores visibles conservan código cuando falta confirmación de bootstrap', async () => {
    const response = await requireApi().post('/api/grc/bootstrap', {
      headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': `phase1-bootstrap-invalid-${nonce}` },
      data: { confirmation: 'INVALID' },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('GRC_BOOTSTRAP_CONFIRMATION_REQUIRED');
    expect(body.error).toBeTruthy();
  });

  test('administración SaaS y cache de módulos reflejan grc_phase1_core', async () => {
    const client = requireApi();
    const first = await client.get('/api/me/modules', { headers: { Authorization: `Bearer ${adminToken}` } });
    const second = await client.get('/api/me/modules', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(first.headers()['cache-control']).toContain('no-store');
    expect((await second.json()).module_map.grc_phase1_core.is_enabled).toBe(true);
  });

  test('administrador crea workflow válido', async () => {
    expect(await ensureEvidenceWorkflow()).toBeTruthy();
  });

  test('administrador publica versión y usuario no autorizado es rechazado', async () => {
    const definitionId = await ensureEvidenceWorkflow();
    const denied = await requireApi().post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${restrictedToken}` } });
    expect(denied.status()).toBe(403);
    await ensurePublishedEvidenceWorkflow();
    expect(workflowPublished).toBe(true);
  });

  test('instancia conserva versión y valida transición/precondición', async () => {
    const definitionId = await ensurePublishedEvidenceWorkflow();
    const client = requireApi();
    const start = await client.post('/api/grc/workflow-instances', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { definition_id: definitionId, entity_type: 'evidence', entity_id: crypto.randomUUID() },
    });
    expect(start.status()).toBe(200);
    instanceId = (await start.json()).data.id;
    recordResource('workflow_instance_ids', instanceId);
    const submit = await client.post(`/api/grc/workflow-instances/${instanceId}/transitions`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'submit' } });
    expect(submit.status()).toBe(200);
    const missingComment = await client.post(`/api/grc/workflow-instances/${instanceId}/transitions`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve' } });
    expect(missingComment.status()).toBe(422);
    const approve = await client.post(`/api/grc/workflow-instances/${instanceId}/transitions`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve', comment: 'Revisión humana E2E' } });
    expect(approve.status()).toBe(200);
    expect((await approve.json()).data.status).toBe('completed');
  });

  test('evidencia recurrente no duplica la plantilla y rechazo exige causa', async () => {
    await ensureEvidenceRequest();
    const list = await requireApi().get('/api/grc/evidence/requests', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(list.status()).toBe(200);
    expect((await list.json()).data.some((item: { title: string }) => item.title === evidenceRequestTitle)).toBe(true);
    const invalidReview = await requireApi().post(`/api/grc/evidence/submissions/${crypto.randomUUID()}/review`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { decision: 'rejected' } });
    expect(invalidReview.status()).toBe(422);
  });

  test('readiness es determinista, explicable y comparable', async () => {
    const client = requireApi();
    const first = await client.post('/api/grc/readiness/snapshots', { headers: { Authorization: `Bearer ${adminToken}` } });
    const second = await client.post('/api/grc/readiness/snapshots', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const a = (await first.json()).data;
    const b = (await second.json()).data;
    recordResource('readiness_snapshot_ids', a.id);
    recordResource('readiness_snapshot_ids', b.id);
    expect(a.input_hash).toBe(b.input_hash);
    expect(a.dimensions).toHaveLength(8);
    const latest = await client.get('/api/grc/readiness/latest', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(latest.status()).toBe(200);
    expect((await latest.json()).data.results).toHaveLength(8);
  });

  test('nueve frameworks conservan versión y origen', async () => {
    const response = await requireApi().get('/api/grc/frameworks', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(response.status()).toBe(200);
    const frameworks = (await response.json()).data;
    expect(frameworks.length).toBeGreaterThanOrEqual(9);
    expect(frameworks.every((item: { content_classification?: string; versions?: unknown[] }) => item.content_classification && item.versions?.length)).toBe(true);
  });

  test('auditoría avanzada crea plan y expone workspace', async () => {
    const client = requireApi();
    const plan = await client.post('/api/grc/audits/annual-plans', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { year: new Date().getFullYear() + 1, version: 1_000_000_000 + (Date.now() % 1_000_000_000), prioritization_criteria: { method: 'risk_based', evidence: 'E2E' } },
    });
    expect(plan.status()).toBe(200);
    const planBody = await plan.json();
    recordResource('audit_annual_plan_ids', planBody.data.id);
    const workspace = await client.get('/api/grc/audits/workspace', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(workspace.status()).toBe(200);
    expect((await workspace.json()).data.annual_plans).toBeGreaterThan(0);
  });

  test('Tenant A no consulta recursos de Tenant B', async () => {
    const client = requireApi();
    const tenantA = await login(client, String(process.env.E2E_TENANT_A_EMAIL), String(process.env.E2E_TENANT_A_PASSWORD));
    const response = await client.get(`/api/grc/summary?tenant_id=${encodeURIComponent(String(process.env.E2E_TENANT_B_ID))}`, { headers: { Authorization: `Bearer ${tenantA.token}` } });
    expect([403, 404]).toContain(response.status());
  });

  test('aprobación con quorum permanece pendiente y completa con segundo aprobador', async () => {
    const client = requireApi();
    const workflow = await client.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        code: `${qaPrefix}_${executionPass}_quorum`.toLowerCase(),
        name: `${qaPrefix} ${executionPass} quorum`,
        entity_type: 'audit',
        states: [{ code: 'draft', name: 'Borrador', state_type: 'initial' }, { code: 'approved', name: 'Aprobado', state_type: 'terminal' }],
        transitions: [{ code: 'approve', name: 'Aprobar', from_state: 'draft', to_state: 'approved', required_permission: 'workflow.transition', approval_mode: 'quorum', quorum: 2, approval_config: { required_count: 2 } }],
      },
    });
    expect(workflow.status()).toBe(200);
    const definitionId = (await workflow.json()).data.definition.id;
    recordResource('workflow_definition_ids', definitionId);
    expect((await client.post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } })).status()).toBe(200);
    const start = await client.post('/api/grc/workflow-instances', { headers: { Authorization: `Bearer ${adminToken}` }, data: { definition_id: definitionId, entity_type: 'audit', entity_id: crypto.randomUUID() } });
    expect(start.status()).toBe(200);
    const id = (await start.json()).data.id;
    recordResource('workflow_instance_ids', id);
    const first = await client.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve', decision: 'approved', comment: 'Primera aprobación' } });
    expect(first.status()).toBe(200);
    expect((await first.json()).data.pending_approval).toBe(true);
    const second = await client.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'approved', comment: 'Quorum completado' } });
    expect(second.status()).toBe(200);
    expect((await second.json()).data.status).toBe('completed');
  });

  test('rechazo de aprobación exige comentario y queda auditado sin transición', async () => {
    const client = requireApi();
    const workflow = await client.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        code: `${qaPrefix}_${executionPass}_reject`.toLowerCase(),
        name: `${qaPrefix} ${executionPass} rejection`,
        entity_type: 'audit',
        states: [{ code: 'draft', name: 'Borrador', state_type: 'initial' }, { code: 'approved', name: 'Aprobado', state_type: 'terminal' }],
        transitions: [{ code: 'approve', name: 'Aprobar', from_state: 'draft', to_state: 'approved', required_permission: 'workflow.transition', approval_mode: 'simple' }],
      },
    });
    expect(workflow.status()).toBe(200);
    const definitionId = (await workflow.json()).data.definition.id;
    recordResource('workflow_definition_ids', definitionId);
    expect((await client.post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } })).status()).toBe(200);
    const start = await client.post('/api/grc/workflow-instances', { headers: { Authorization: `Bearer ${adminToken}` }, data: { definition_id: definitionId, entity_type: 'audit', entity_id: crypto.randomUUID() } });
    expect(start.status()).toBe(200);
    const id = (await start.json()).data.id;
    recordResource('workflow_instance_ids', id);
    const invalid = await client.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'rejected' } });
    expect(invalid.status()).toBe(422);
    const rejected = await client.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'rejected', comment: 'Falta evidencia suficiente' } });
    expect(rejected.status()).toBe(200);
    expect((await rejected.json()).data.outcome).toBe('rejected');
  });

  test('scheduler es idempotente y registra escalamiento configurable', async () => {
    const client = requireApi();
    const policy = await client.post('/api/grc/escalations/policies', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { code: `${qaPrefix}_${executionPass}_evidence`.toLowerCase(), entity_type: 'evidence_request', prior_notice_hours: 24, first_escalation_hours: 0, second_escalation_hours: 24, role_keys: ['auditor'] },
    });
    expect(policy.status()).toBe(200);
    const policyBody = await policy.json();
    recordResource('escalation_policy_ids', policyBody.data.id);
    const payload = { run_type: 'e2e', window_key: `${qaPrefix}-${executionPass}` };
    const first = await client.post('/api/grc/scheduler/run', { headers: { Authorization: `Bearer ${adminToken}` }, data: payload });
    const second = await client.post('/api/grc/scheduler/run', { headers: { Authorization: `Bearer ${adminToken}` }, data: payload });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const firstRun = await first.json();
    recordResource('scheduler_run_ids', firstRun.data.run.id);
    expect((await second.json()).data.reused).toBe(true);
  });

  test('revisión supervisora aplica independencia, versión e historial', async () => {
    const client = requireApi();
    const workpaper = await client.post('/api/grc/audits/workpapers', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { audit_id: process.env.E2E_AUDIT_ID, code: `${qaPrefix}-${executionPass}-WP`, objective: 'Validar revisión supervisora E2E', procedure_text: 'Inspeccionar evidencia y conclusión', result: 'Sin excepción', conclusion: 'Conforme', status: 'submitted', content_hash: `sha256-${nonce}-${executionPass}` },
    });
    expect(workpaper.status()).toBe(200);
    const id = (await workpaper.json()).data.id;
    const review = await client.post(`/api/grc/audits/workpapers/${id}/reviews`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { decision: 'approved', observations: 'Revisión independiente E2E' } });
    recordResource('audit_workpaper_ids', id);
    expect(review.status()).toBe(200);
    const body = (await review.json()).data;
    expect(body.review.version).toBe(1);
    expect(body.workpaper.status).toBe('approved');
  });

  test('exportación avanzada entrega datos reales, nombre seguro e identificadores', async () => {
    const response = await requireApi().post('/api/grc/exports/audit', { headers: { Authorization: `Bearer ${adminToken}` }, data: { format: 'csv', filters: {} } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toMatch(/attachment; filename="grc_audit_/);
    expect(response.headers()['x-tcdx-export-id']).toBeTruthy();
    expect(response.headers()['x-tcdx-content-hash']).toMatch(/^[a-f0-9]{64}$/);
    recordResource('export_ids', response.headers()['x-tcdx-export-id']);
    expect((await response.body()).length).toBeGreaterThan(20);
  });

  test('tenant no autorizado conserva feature flag apagado y endpoint bloqueado', async () => {
    const client = requireApi();
    const tenantB = await login(client, String(process.env.E2E_TENANT_B_EMAIL), String(process.env.E2E_TENANT_B_PASSWORD));
    const meta = await client.get('/api/grc/meta', { headers: { Authorization: `Bearer ${tenantB.token}` } });
    expect(meta.status()).toBe(200);
    expect((await meta.json()).data.module.is_enabled).toBe(false);
    const direct = await client.get('/api/grc/summary', { headers: { Authorization: `Bearer ${tenantB.token}` } });
    expect(direct.status()).toBe(403);
  });

  test('observabilidad expone scheduler, aprobaciones, revisión y exportación', async () => {
    const response = await requireApi().get('/api/grc/observability', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(response.status()).toBe(200);
    const operations = (await response.json()).data.counters.map((item: { operation: string }) => item.operation);
    expect(operations).toEqual(expect.arrayContaining(['scheduler', 'approval', 'audit_review', 'export']));
  });

  test('persistencia web tras recarga conserva inicialización operacional', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Inicialización operacional GRC')).toBeVisible();
    await expect(page.getByText('Listo', { exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Listo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revalidar configuración' })).toBeEnabled();
  });

  test('instancia operada desde la web persiste estado e historial', async ({ page }) => {
    await ensurePublishedEvidenceWorkflow();
    await installSession(page, adminToken);
    await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
    await selectOptionByLabel(page.getByLabel('Workflow'), workflowName);
    await page.getByLabel('ID de entidad').fill(crypto.randomUUID());
    const createdInstance = await expectMutation(page, 'POST', /\/api\/grc\/workflow-instances$/, () => page.getByRole('button', { name: 'Crear instancia' }).click());
    recordResource('workflow_instance_ids', createdInstance.id);
    await expect(page.getByText('Instancia creada y persistida.')).toBeVisible();
    await selectFirstAvailableOption(page.getByLabel('Transición'));
    await page.getByLabel('Comentario').fill('Transición ejecutada desde Playwright');
    await expectMutation(page, 'POST', /\/api\/grc\/workflow-instances\/[^/]+\/transitions$/, () => page.getByRole('button', { name: 'Ejecutar transición' }).click());
    await expect(page.getByText('Transición registrada y vista actualizada.')).toBeVisible();
    await expect(page.getByText(/Historial: [2-9]/)).toBeVisible();
  });

  test('workflow editado desde la web valida, versiona y muestra historial', async ({ page }) => {
    const definitionId = await ensurePublishedEvidenceWorkflow();
    await installSession(page, adminToken);
    await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
    await workflowRow(page, workflowName).getByRole('button', { name: 'Editar borrador' }).click();
    const editor = page.locator('form').filter({ has: page.getByRole('button', { name: 'Guardar borrador' }) });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Nombre')).toHaveValue(workflowName);
    await expectMutation(page, 'POST', /\/api\/grc\/workflows\/validate$/, () => editor.getByRole('button', { name: 'Validar' }).click());
    await expect(page.getByRole('status')).toContainText('Configuración de workflow válida.');
    await expectMutation(page, 'PUT', new RegExp(`/api/grc/workflows/${definitionId}/draft$`), () => editor.getByRole('button', { name: 'Guardar borrador' }).click());
    const draftRow = workflowRow(page, workflowName);
    await expect(draftRow.getByRole('button', { name: 'Publicar' })).toBeVisible();
    await expectMutation(page, 'POST', new RegExp(`/api/grc/workflows/${definitionId}/publish$`), () => draftRow.getByRole('button', { name: 'Publicar' }).click());
    const publishedRow = workflowRow(page, workflowName);
    await publishedRow.getByRole('button', { name: 'Historial' }).click();
    await expect(page.getByText('v2 · published', { exact: false })).toBeVisible();
  });

  test('evidencia operada desde la web se entrega, versiona y rechaza con causa', async ({ page }) => {
    test.setTimeout(90_000);
    const requestId = await ensureEvidenceRequest();
    await installSession(page, adminToken);
    const requestsResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname === '/api/grc/evidence/requests';
    });
    const navigation = await page.goto('/evidencias?grc_operations=1', { waitUntil: 'domcontentloaded' });
    expect(navigation?.status(), 'La ruta /evidencias no respondió correctamente').toBe(200);
    await expect(page, 'La sesión no debe redirigir fuera de /evidencias').toHaveURL(/\/evidencias(?:\?|$)/);
    const loaded = await requestsResponse;
    const loadedBody = await loaded.json().catch(() => ({}));
    expect(loaded.status(), `Evidence requests API failed: ${JSON.stringify(loadedBody)}`).toBe(200);
    expect(loadedBody.ok, `Evidence requests API returned an invalid envelope: ${JSON.stringify(loadedBody)}`).toBe(true);
    expect(loadedBody.data.some((item: { id: string }) => item.id === requestId), 'La solicitud creada no fue devuelta por la API').toBe(true);
    const grcPanel = page.getByLabel('Operación GRC avanzada');
    await expect(grcPanel, 'El panel GRC no se renderizó o el módulo está deshabilitado').toBeVisible();
    const requestSelect = grcPanel.getByRole('combobox', { name: 'Solicitud', exact: true });
    await expect(requestSelect, 'La UI no renderizó el selector accesible de solicitudes').toBeVisible();
    await selectOptionByLabel(requestSelect, evidenceRequestTitle);
    await grcPanel.getByLabel('ID de evidencia existente').fill(String(process.env.E2E_EVIDENCE_ID));
    const submitButton = grcPanel.getByRole('button', { name: 'Enviar evidencia', exact: true });
    await expect(submitButton).toBeEnabled();
    const createdSubmission = await expectMutation(page, 'POST', /\/api\/grc\/evidence\/requests\/[^/]+\/submissions$/, () => submitButton.click());
    expect(createdSubmission.request_id).toBe(requestId);
    expect(createdSubmission.reused).toBe(executionPass === 'full');
    await grcPanel.getByLabel('Causa u observación').fill('Corrección solicitada desde recorrido web');
    const rejectButton = grcPanel.getByRole('button', { name: 'Rechazar', exact: true });
    await expect(rejectButton).toBeEnabled();
    const createdReview = await expectMutation(page, 'POST', /\/api\/grc\/evidence\/submissions\/[^/]+\/review$/, () => rejectButton.click());
    expect(createdReview.decision).toBe('rejected');
    expect(createdReview.reason).toBe('Corrección solicitada desde recorrido web');
    const beforeVersionResponse = await requireApi().get(`/api/grc/evidence/requests/${requestId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const beforeVersionBody = await beforeVersionResponse.json().catch(() => ({}));
    expect(beforeVersionResponse.status(), `Evidence detail before version failed: ${JSON.stringify(beforeVersionBody)}`).toBe(200);
    const submissionBeforeVersion = beforeVersionBody.data.submissions.find((item: { id: string }) => item.id === createdSubmission.id);
    expect(submissionBeforeVersion, 'La entrega operada debe persistir antes de crear una versión').toBeTruthy();
    const previousVersion = Math.max(...submissionBeforeVersion.versions.map((item: { version: number }) => Number(item.version)));
    expect(previousVersion).toBeGreaterThanOrEqual(1);
    const versionButton = grcPanel.getByRole('button', { name: 'Nueva versión', exact: true });
    await expect(versionButton).toBeEnabled();
    const createdVersion = await expectMutation(page, 'POST', /\/api\/grc\/evidence\/submissions\/[^/]+\/versions$/, () => versionButton.click());
    expect(createdVersion.version).toBe(previousVersion + 1);
    const persistedResponse = await requireApi().get(`/api/grc/evidence/requests/${requestId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const persistedBody = await persistedResponse.json().catch(() => ({}));
    expect(persistedResponse.status(), `Evidence detail failed: ${JSON.stringify(persistedBody)}`).toBe(200);
    const persistedSubmission = persistedBody.data.submissions.find((item: { id: string }) => item.id === createdSubmission.id);
    expect(persistedSubmission?.reviews.some((item: { id: string }) => item.id === createdReview.id)).toBe(true);
    expect(persistedSubmission?.versions.some((item: { id: string }) => item.id === createdVersion.id)).toBe(true);
  });

  test('mapping operado desde la web conserva revisión tenant', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/controles', { waitUntil: 'domcontentloaded' });
    await selectAvailableOption(page.getByLabel('Requisito'), executionPass === 'targeted' ? 0 : 1);
    await page.getByLabel('ID control tenant').fill(String(process.env.E2E_CONTROL_ID));
    await page.getByLabel('Justificación').fill('Cobertura verificada desde recorrido web');
    const mapping = await expectMutation(page, 'POST', /\/api\/grc\/mappings$/, () => page.getByRole('button', { name: 'Crear mapping' }).click());
    recordResource('mapping_ids', mapping.id);
    await expect(page.getByRole('status')).toContainText('Mapping creado y enviado a revisión.');
  });

  test('auditoría operada desde la web registra equipo, programa y muestra', async ({ page }) => {
    const operationsResponse = await requireApi().get(`/api/grc/audits/${process.env.E2E_AUDIT_ID}/operations`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const operationsBody = await operationsResponse.json().catch(() => ({}));
    expect(operationsResponse.status(), `Audit operations failed: ${JSON.stringify(operationsBody)}`).toBe(200);
    const assignedUsers = new Set((operationsBody.data?.team || []).map((item: { user_id: string }) => item.user_id));
    const candidates = executionPass === 'targeted'
      ? [restrictedUserId, adminUserId, reviewerUserId]
      : [reviewerUserId, adminUserId, restrictedUserId];
    const qaMemberId = candidates.find(id => id && !assignedUsers.has(id));
    expect(qaMemberId, 'No existe una cuenta QA controlada libre para asignación sin modificar equipo preexistente').toBeTruthy();
    expect(String(qaMemberId), 'La cuenta QA seleccionada debe usar un UUID compatible con PostgreSQL').toMatch(
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
    );
    await installSession(page, adminToken);
    await page.goto('/auditorias', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('ID de auditoría operacional').fill(String(process.env.E2E_AUDIT_ID));
    await page.getByRole('button', { name: 'Cargar auditoría' }).click();
    await expect(page.getByRole('status')).toContainText('Workspace de auditoría actualizado.');
    await page.getByLabel('ID usuario del equipo').fill(String(qaMemberId));
    await page.getByLabel('Rol del equipo').selectOption('supervisor');
    const teamMember = await expectMutation(page, 'POST', /\/api\/grc\/audits\/[^/]+\/team$/, () => page.getByRole('button', { name: 'Asignar y declarar' }).click());
    recordResource('audit_team_member_ids', teamMember.id);
    await expect(page.getByRole('status')).toContainText('Miembro e independencia registrados.');
    const program = await expectMutation(page, 'POST', /\/api\/grc\/audits\/[^/]+\/programs$/, () => page.getByRole('button', { name: 'Crear programa' }).click());
    recordResource('audit_program_ids', program.id);
    await expect(page.getByRole('status')).toContainText('Programa versionado creado.');
    const sample = await expectMutation(page, 'POST', /\/api\/grc\/audits\/[^/]+\/samples$/, () => page.getByRole('button', { name: 'Crear muestra' }).click());
    recordResource('audit_sample_plan_ids', sample.id);
    await expect(page.getByRole('status')).toContainText('Plan de muestra creado.');
  });

  for (const route of ['/dashboard', '/evidencias', '/auditorias', '/controles', '/configuracion']) {
    test(`vista consolidada carga sin errores: ${route}`, async ({ page }) => {
      await installSession(page, adminToken);
      const consoleErrors: string[] = [];
      const serverFailures: string[] = [];
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`); });
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status() || 0).toBeLessThan(500);
      if (route === '/evidencias') {
        await expect(page.getByRole('heading', { name: 'Biblioteca documental' })).toBeVisible();
      } else {
        await expect(page.getByLabel('Operación GRC avanzada')).toBeVisible();
      }
      expect(consoleErrors).toEqual([]);
      expect(serverFailures).toEqual([]);
    });
  }
});
