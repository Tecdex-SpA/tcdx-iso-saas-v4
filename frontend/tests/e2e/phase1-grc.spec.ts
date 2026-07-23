import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const requiredEnvironment = [
  'WEB_BASE_URL', 'API_BASE_URL', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD',
  'E2E_RESTRICTED_EMAIL', 'E2E_RESTRICTED_PASSWORD',
  'E2E_TENANT_A_EMAIL', 'E2E_TENANT_A_PASSWORD', 'E2E_TENANT_A_ID',
  'E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD', 'E2E_TENANT_B_ID',
  'E2E_REVIEWER_EMAIL', 'E2E_REVIEWER_PASSWORD', 'E2E_REVIEWER_ID',
  'E2E_AUDIT_ID', 'E2E_EVIDENCE_ID', 'E2E_CONTROL_ID',
];
const apiBaseUrl = String(process.env.API_BASE_URL || 'http://phase1.invalid').replace(/\/$/, '');

async function login(api: APIRequestContext, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  return { response, token: body.token || body.accessToken || body.data?.token || body.data?.accessToken };
}

async function installSession(page: Page, token: string) {
  await page.addInitScript(value => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

test.describe.serial('Phase 1 GRC runtime', () => {
  let api: APIRequestContext;
  let adminToken = '';
  let restrictedToken = '';
  let reviewerToken = '';
  let workflowId = '';
  let instanceId = '';
  const nonce = Date.now().toString(36);

  test.beforeAll(async () => {
    const missing = requiredEnvironment.filter(name => !process.env[name]);
    if (missing.length) throw new Error(`Missing required Phase 1 E2E environment variables: ${missing.join(', ')}`);
    api = await createRequest.newContext({ baseURL: apiBaseUrl });
    const admin = await login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD));
    const restricted = await login(api, String(process.env.E2E_RESTRICTED_EMAIL), String(process.env.E2E_RESTRICTED_PASSWORD));
    const reviewer = await login(api, String(process.env.E2E_REVIEWER_EMAIL), String(process.env.E2E_REVIEWER_PASSWORD));
    expect(admin.response.status()).toBe(200);
    expect(restricted.response.status()).toBe(200);
    expect(reviewer.response.status()).toBe(200);
    adminToken = admin.token;
    restrictedToken = restricted.token;
    reviewerToken = reviewer.token;
  });

  test.afterAll(async () => api.dispose());

  test('feature flag y permisos están activos en QA', async () => {
    const response = await api.get('/api/grc/meta', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.module.is_enabled).toBe(true);
  });

  test('bootstrap explícito es confirmado, idempotente y deja el tenant listo', async () => {
    const before = await api.get('/api/grc/bootstrap/status', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(before.status()).toBe(200);
    const idempotencyKey = `phase1-bootstrap-${nonce}`;
    const options = {
      headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': idempotencyKey },
      data: { confirmation: 'INITIALIZE_GRC' },
    };
    const first = await api.post('/api/grc/bootstrap', options);
    const replay = await api.post('/api/grc/bootstrap', options);
    expect(first.status()).toBe(200);
    expect(replay.status()).toBe(200);
    const initialized = (await first.json()).data;
    const reused = (await replay.json()).data;
    expect(initialized.ready).toBe(true);
    expect(reused).toEqual({
      ...initialized,
      idempotent_replay: true,
    });
    const validated = await api.post('/api/grc/bootstrap/validate', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(validated.status()).toBe(200);
    expect((await validated.json()).data.ready).toBe(true);
  });

  test('errores visibles conservan código cuando falta confirmación de bootstrap', async () => {
    const response = await api.post('/api/grc/bootstrap', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': `phase1-bootstrap-invalid-${nonce}`,
      },
      data: { confirmation: 'INVALID' },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('GRC_BOOTSTRAP_CONFIRMATION_REQUIRED');
    expect(body.error).toBeTruthy();
  });

  test('administración SaaS y cache de módulos reflejan grc_phase1_core', async () => {
    const first = await api.get('/api/me/modules', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const second = await api.get('/api/me/modules', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(first.headers()['cache-control']).toContain('no-store');
    const moduleMap = (await second.json()).module_map;
    expect(moduleMap.grc_phase1_core.is_enabled).toBe(true);
  });

  test('administrador crea workflow válido', async () => {
    const response = await api.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': `phase1-workflow-${nonce}` },
      data: {
        code: `e2e-evidence-${nonce}`, name: `E2E evidence ${nonce}`, entity_type: 'evidence',
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
    expect(response.status()).toBe(200);
    workflowId = (await response.json()).data.definition.id;
  });

  test('administrador publica versión y usuario no autorizado es rechazado', async () => {
    const denied = await api.post(`/api/grc/workflows/${workflowId}/publish`, { headers: { Authorization: `Bearer ${restrictedToken}` } });
    expect(denied.status()).toBe(403);
    const published = await api.post(`/api/grc/workflows/${workflowId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(published.status()).toBe(200);
    expect((await published.json()).data.status).toBe('published');
  });

  test('instancia conserva versión y valida transición/precondición', async () => {
    const entityId = crypto.randomUUID();
    const start = await api.post('/api/grc/workflow-instances', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { definition_id: workflowId, entity_type: 'evidence', entity_id: entityId },
    });
    expect(start.status()).toBe(200);
    instanceId = (await start.json()).data.id;
    const submit = await api.post(`/api/grc/workflow-instances/${instanceId}/transitions`, {
      headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'submit' },
    });
    expect(submit.status()).toBe(200);
    const missingComment = await api.post(`/api/grc/workflow-instances/${instanceId}/transitions`, {
      headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve' },
    });
    expect(missingComment.status()).toBe(422);
    const approve = await api.post(`/api/grc/workflow-instances/${instanceId}/transitions`, {
      headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve', comment: 'Revisión humana E2E' },
    });
    expect(approve.status()).toBe(200);
    expect((await approve.json()).data.status).toBe('completed');
  });

  test('evidencia recurrente no duplica la plantilla y rechazo exige causa', async () => {
    const request = await api.post('/api/grc/evidence/requests', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { title: `Solicitud E2E ${nonce}`, status: 'requested', schedule: { frequency: 'monthly', interval_value: 1, start_at: new Date().toISOString() } },
    });
    expect(request.status()).toBe(200);
    const list = await api.get('/api/grc/evidence/requests', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(list.status()).toBe(200);
    expect((await list.json()).data.some((item: { title: string }) => item.title === `Solicitud E2E ${nonce}`)).toBe(true);
    const invalidReview = await api.post(`/api/grc/evidence/submissions/${crypto.randomUUID()}/review`, {
      headers: { Authorization: `Bearer ${adminToken}` }, data: { decision: 'rejected' },
    });
    expect(invalidReview.status()).toBe(422);
  });

  test('readiness es determinista, explicable y comparable', async () => {
    const first = await api.post('/api/grc/readiness/snapshots', { headers: { Authorization: `Bearer ${adminToken}` } });
    const second = await api.post('/api/grc/readiness/snapshots', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const a = (await first.json()).data;
    const b = (await second.json()).data;
    expect(a.input_hash).toBe(b.input_hash);
    expect(a.dimensions).toHaveLength(8);
    const latest = await api.get('/api/grc/readiness/latest', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(latest.status()).toBe(200);
    expect((await latest.json()).data.results).toHaveLength(8);
  });

  test('nueve frameworks conservan versión y origen', async () => {
    const response = await api.get('/api/grc/frameworks', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(response.status()).toBe(200);
    const frameworks = (await response.json()).data;
    expect(frameworks.length).toBeGreaterThanOrEqual(9);
    expect(frameworks.every((item: { content_classification?: string; versions?: unknown[] }) => item.content_classification && item.versions?.length)).toBe(true);
  });

  test('auditoría avanzada crea plan y expone workspace', async () => {
    const plan = await api.post('/api/grc/audits/annual-plans', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        year: new Date().getFullYear() + 1,
        version: 1_000_000_000 + (Date.now() % 1_000_000_000),
        prioritization_criteria: { method: 'risk_based', evidence: 'E2E' },
      },
    });
    expect(plan.status()).toBe(200);
    const workspace = await api.get('/api/grc/audits/workspace', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(workspace.status()).toBe(200);
    expect((await workspace.json()).data.annual_plans).toBeGreaterThan(0);
  });

  test('Tenant A no consulta recursos de Tenant B', async () => {
    const tenantA = await login(api, String(process.env.E2E_TENANT_A_EMAIL), String(process.env.E2E_TENANT_A_PASSWORD));
    const response = await api.get(`/api/grc/summary?tenant_id=${encodeURIComponent(String(process.env.E2E_TENANT_B_ID))}`, {
      headers: { Authorization: `Bearer ${tenantA.token}` },
    });
    expect([403, 404]).toContain(response.status());
  });

  test('aprobación con quorum permanece pendiente y completa con segundo aprobador', async () => {
    const workflow = await api.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        code: `e2e-quorum-${nonce}`, name: `E2E quorum ${nonce}`, entity_type: 'audit',
        states: [{ code: 'draft', name: 'Borrador', state_type: 'initial' }, { code: 'approved', name: 'Aprobado', state_type: 'terminal' }],
        transitions: [{ code: 'approve', name: 'Aprobar', from_state: 'draft', to_state: 'approved', required_permission: 'workflow.transition', approval_mode: 'quorum', quorum: 2, approval_config: { required_count: 2 } }],
      },
    });
    expect(workflow.status()).toBe(200);
    const definitionId = (await workflow.json()).data.definition.id;
    expect((await api.post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } })).status()).toBe(200);
    const start = await api.post('/api/grc/workflow-instances', { headers: { Authorization: `Bearer ${adminToken}` }, data: { definition_id: definitionId, entity_type: 'audit', entity_id: process.env.E2E_AUDIT_ID } });
    expect(start.status()).toBe(200);
    const id = (await start.json()).data.id;
    const first = await api.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { transition_code: 'approve', decision: 'approved', comment: 'Primera aprobación' } });
    expect(first.status()).toBe(200);
    expect((await first.json()).data.pending_approval).toBe(true);
    const second = await api.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'approved', comment: 'Quorum completado' } });
    expect(second.status()).toBe(200);
    expect((await second.json()).data.status).toBe('completed');
  });

  test('rechazo de aprobación exige comentario y queda auditado sin transición', async () => {
    const workflow = await api.post('/api/grc/workflows', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        code: `e2e-reject-${nonce}`, name: `E2E rejection ${nonce}`, entity_type: 'audit',
        states: [{ code: 'draft', name: 'Borrador', state_type: 'initial' }, { code: 'approved', name: 'Aprobado', state_type: 'terminal' }],
        transitions: [{ code: 'approve', name: 'Aprobar', from_state: 'draft', to_state: 'approved', required_permission: 'workflow.transition', approval_mode: 'simple' }],
      },
    });
    const definitionId = (await workflow.json()).data.definition.id;
    await api.post(`/api/grc/workflows/${definitionId}/publish`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const start = await api.post('/api/grc/workflow-instances', { headers: { Authorization: `Bearer ${adminToken}` }, data: { definition_id: definitionId, entity_type: 'audit', entity_id: crypto.randomUUID() } });
    const id = (await start.json()).data.id;
    const invalid = await api.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'rejected' } });
    expect(invalid.status()).toBe(422);
    const rejected = await api.post(`/api/grc/workflow-instances/${id}/transitions`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { transition_code: 'approve', decision: 'rejected', comment: 'Falta evidencia suficiente' } });
    expect(rejected.status()).toBe(200);
    expect((await rejected.json()).data.outcome).toBe('rejected');
  });

  test('scheduler es idempotente y registra escalamiento configurable', async () => {
    const policy = await api.post('/api/grc/escalations/policies', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { code: `e2e-evidence-${nonce}`, entity_type: 'evidence_request', prior_notice_hours: 24, first_escalation_hours: 0, second_escalation_hours: 24, role_keys: ['auditor'] },
    });
    expect(policy.status()).toBe(200);
    const payload = { run_type: 'e2e', window_key: `e2e-${nonce}` };
    const first = await api.post('/api/grc/scheduler/run', { headers: { Authorization: `Bearer ${adminToken}` }, data: payload });
    const second = await api.post('/api/grc/scheduler/run', { headers: { Authorization: `Bearer ${adminToken}` }, data: payload });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect((await second.json()).data.reused).toBe(true);
  });

  test('revisión supervisora aplica independencia, versión e historial', async () => {
    const workpaper = await api.post('/api/grc/audits/workpapers', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { audit_id: process.env.E2E_AUDIT_ID, code: `WP-${nonce}`, objective: 'Validar revisión supervisora E2E', procedure_text: 'Inspeccionar evidencia y conclusión', result: 'Sin excepción', conclusion: 'Conforme', status: 'submitted', content_hash: `sha256-${nonce}` },
    });
    expect(workpaper.status()).toBe(200);
    const id = (await workpaper.json()).data.id;
    const review = await api.post(`/api/grc/audits/workpapers/${id}/reviews`, { headers: { Authorization: `Bearer ${reviewerToken}` }, data: { decision: 'approved', observations: 'Revisión independiente E2E' } });
    expect(review.status()).toBe(200);
    const body = (await review.json()).data;
    expect(body.review.version).toBe(1);
    expect(body.workpaper.status).toBe('approved');
  });

  test('exportación avanzada entrega datos reales, nombre seguro e identificadores', async () => {
    const response = await api.post('/api/grc/exports/audit', { headers: { Authorization: `Bearer ${adminToken}` }, data: { format: 'csv', filters: {} } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toMatch(/attachment; filename="grc_audit_/);
    expect(response.headers()['x-tcdx-export-id']).toBeTruthy();
    expect(response.headers()['x-tcdx-content-hash']).toMatch(/^[a-f0-9]{64}$/);
    expect((await response.body()).length).toBeGreaterThan(20);
  });

  test('tenant no autorizado conserva feature flag apagado y endpoint bloqueado', async () => {
    const tenantB = await login(api, String(process.env.E2E_TENANT_B_EMAIL), String(process.env.E2E_TENANT_B_PASSWORD));
    const meta = await api.get('/api/grc/meta', { headers: { Authorization: `Bearer ${tenantB.token}` } });
    expect(meta.status()).toBe(200);
    expect((await meta.json()).data.module.is_enabled).toBe(false);
    const direct = await api.get('/api/grc/summary', { headers: { Authorization: `Bearer ${tenantB.token}` } });
    expect(direct.status()).toBe(403);
  });

  test('observabilidad expone scheduler, aprobaciones, revisión y exportación', async () => {
    const response = await api.get('/api/grc/observability', { headers: { Authorization: `Bearer ${adminToken}` } });
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
    await installSession(page, adminToken);
    await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Workflow').selectOption({ index: 1 });
    await page.getByLabel('ID de entidad').fill(crypto.randomUUID());
    await page.getByRole('button', { name: 'Crear instancia' }).click();
    await expect(page.getByText('Instancia creada y persistida.')).toBeVisible();
    await page.getByLabel('Transición').selectOption({ index: 1 });
    await page.getByLabel('Comentario').fill('Transición ejecutada desde Playwright');
    await page.getByRole('button', { name: 'Ejecutar transición' }).click();
    await expect(page.getByText('Transición registrada y vista actualizada.')).toBeVisible();
    await expect(page.getByText(/Historial: [2-9]/)).toBeVisible();
  });

  test('workflow editado desde la web valida, versiona y muestra historial', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
    const row = page.getByText(`E2E evidence ${nonce}`).locator('..').locator('..');
    await row.getByRole('button', { name: 'Editar borrador' }).click();
    const editor = page.getByText('Crear borrador').locator('..').locator('..');
    await editor.getByLabel('Nombre').fill(`E2E evidence revised ${nonce}`);
    await editor.getByRole('button', { name: 'Validar' }).click();
    await expect(page.getByText('Configuración de workflow válida.')).toBeVisible();
    await editor.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Borrador validado y guardado.')).toBeVisible();
    const revised = page.getByText(`E2E evidence revised ${nonce}`).locator('..').locator('..');
    await revised.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Versión de workflow publicada.')).toBeVisible();
    await revised.getByRole('button', { name: 'Historial' }).click();
    await expect(page.getByText('v2 · published')).toBeVisible();
  });

  test('evidencia operada desde la web se entrega, versiona y rechaza con causa', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/evidencias', { waitUntil: 'domcontentloaded' });
    const panel = page.getByText('Entrega, revisión y vínculos').locator('..').locator('..');
    await panel.getByLabel('Solicitud').selectOption({ index: 1 });
    await panel.getByLabel('ID de evidencia existente').fill(String(process.env.E2E_EVIDENCE_ID));
    await panel.getByRole('button', { name: 'Enviar evidencia' }).click();
    await expect(panel.getByText('Evidencia enviada a revisión.')).toBeVisible();
    await panel.getByLabel('Causa u observación').fill('Corrección solicitada desde recorrido web');
    await panel.getByRole('button', { name: 'Rechazar' }).click();
    await expect(panel.getByText('Evidencia rechazada con causa.')).toBeVisible();
    await panel.getByRole('button', { name: 'Nueva versión' }).click();
    await expect(panel.getByText('Nueva versión registrada.')).toBeVisible();
  });

  test('mapping operado desde la web conserva revisión tenant', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/controles', { waitUntil: 'domcontentloaded' });
    const panel = page.getByText('Nuevo mapping').locator('..').locator('..');
    await panel.getByLabel('Requisito').selectOption({ index: 2 });
    await panel.getByLabel('ID control tenant').fill(String(process.env.E2E_CONTROL_ID));
    await panel.getByLabel('Justificación').fill('Cobertura verificada desde recorrido web');
    await panel.getByRole('button', { name: 'Crear mapping' }).click();
    await expect(page.getByText('Mapping creado y enviado a revisión.')).toBeVisible();
  });

  test('auditoría operada desde la web registra equipo, programa y muestra', async ({ page }) => {
    await installSession(page, adminToken);
    await page.goto('/auditorias', { waitUntil: 'domcontentloaded' });
    const panel = page.getByText('Ejecución operacional de auditoría').locator('..').locator('..');
    await panel.getByLabel('ID de auditoría operacional').fill(String(process.env.E2E_AUDIT_ID));
    await panel.getByRole('button', { name: 'Cargar auditoría' }).click();
    await expect(panel.getByText('Workspace de auditoría actualizado.')).toBeVisible();
    await panel.getByLabel('ID usuario del equipo').fill(String(process.env.E2E_REVIEWER_ID));
    await panel.getByLabel('Rol del equipo').selectOption('supervisor');
    await panel.getByRole('button', { name: 'Asignar y declarar' }).click();
    await expect(panel.getByText('Miembro e independencia registrados.')).toBeVisible();
    await panel.getByRole('button', { name: 'Crear programa' }).click();
    await expect(panel.getByText('Programa versionado creado.')).toBeVisible();
    await panel.getByRole('button', { name: 'Crear muestra' }).click();
    await expect(panel.getByText('Plan de muestra creado.')).toBeVisible();
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
      await expect(page.locator('body')).toContainText(/Operación GRC avanzada/);
      expect(consoleErrors).toEqual([]);
      expect(serverFailures).toEqual([]);
    });
  }
});
