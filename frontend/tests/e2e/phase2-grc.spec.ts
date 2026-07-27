import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(__filename);
const root = path.resolve(__dirname, '../../..');
const { appendManifestResource } = require(path.join(root, 'scripts/phase2/phase2-qa-manifest.js'));
const apiBaseUrl = String(process.env.API_BASE_URL || 'http://phase2.invalid').replace(/\/$/, '');
const tenantId = String(process.env.PHASE2_TENANT_ID || '');
const tenantBId = String(process.env.E2E_TENANT_B_ID || '');
const runId = String(process.env.PHASE2_QA_RUN_ID || 'unconfigured').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);
const prefix = `PHASE2_QA_${runId}`;
const manifestPath = path.resolve(process.env.PHASE2_QA_MANIFEST || path.join(root, 'artifacts/fase-2/phase2-qa-manifest.json'));
const evidenceId = String(process.env.E2E_EVIDENCE_ID || '');

type Json = Record<string, unknown>;

function record(key: string, id: string) {
  appendManifestResource(manifestPath, tenantId, key, id);
}

async function login(api: APIRequestContext, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  return {
    response,
    token: body.token || body.accessToken || body.data?.token || body.data?.accessToken || '',
  };
}

async function ok(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `HTTP ${response.status()} ${response.url()} ${JSON.stringify(body)}`).toBe(200);
  expect(body.ok).toBe(true);
  return body.data as Json;
}

async function installSession(page: Page, token: string) {
  await page.addInitScript(value => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

test.describe.serial('Phase 2 integrated GRC runtime', () => {
  let api: APIRequestContext;
  let adminToken = '';
  let restrictedToken = '';
  let tenantBToken = '';
  let activityId = '';
  let dpiaId = '';
  let requestId = '';
  let breachId = '';
  let incidentId = '';
  let incidentSeverity = '';
  let supplierId = '';
  let supplierBId = '';
  let templateId = '';
  let questionnaireVersionId = '';
  let assessmentId = '';
  let portalToken = '';
  let portalSession = '';
  let portalQuestionId = '';
  const connectorIds: string[] = [];

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  test.beforeAll(async () => {
    api = await createRequest.newContext({ baseURL: apiBaseUrl });
    const [admin, restricted, tenantB] = await Promise.all([
      login(api, String(process.env.E2E_ADMIN_EMAIL), String(process.env.E2E_ADMIN_PASSWORD)),
      login(api, String(process.env.E2E_RESTRICTED_EMAIL), String(process.env.E2E_RESTRICTED_PASSWORD)),
      login(api, String(process.env.E2E_TENANT_B_EMAIL), String(process.env.E2E_TENANT_B_PASSWORD)),
    ]);
    expect(admin.response.status()).toBe(200);
    expect(restricted.response.status()).toBe(200);
    expect(tenantB.response.status()).toBe(200);
    adminToken = admin.token;
    restrictedToken = restricted.token;
    tenantBToken = tenantB.token;
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('módulo, permisos y catálogo de adapters están operativos', async () => {
    const meta = await ok(await api.get('/api/grc/phase2/meta', { headers: auth() }));
    expect((meta.module as Json).is_enabled).toBe(true);
    const catalog = await ok(await api.get('/api/grc/phase2/connectors/catalog', { headers: auth() })) as unknown as Json[];
    expect(catalog).toHaveLength(4);
    expect(new Set(catalog.map(item => item.provider))).toEqual(new Set(['microsoft_graph', 'google_workspace', 'jira', 'github']));
  });

  test('frontend expone las cinco superficies integradas sin datos ficticios', async ({ page }) => {
    await installSession(page, adminToken);
    for (const [route, heading] of [
      ['/grc-global', 'Vista ejecutiva GRC global'],
      ['/privacidad', 'Privacy Overview'],
      ['/incidentes', 'Incident Dashboard'],
      ['/proveedores', 'Supplier Portfolio'],
      ['/conectores', 'Connector Catalog'],
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByText('placeholder', { exact: false })).toHaveCount(0);
    }
  });

  test('privacidad crea tratamiento sensible, reglas y Processing Activity 360', async () => {
    const activity = await ok(await api.post('/api/grc/phase2/privacy/processing-activities', {
      headers: auth(),
      data: {
        code: `${prefix}-ROPA`,
        name: `${prefix} tratamiento sensible`,
        legal_basis: 'Obligación legal',
        legal_basis_source: 'Fuente normativa QA controlada',
        purposes: ['Prestación del servicio'],
        data_subject_categories: ['Clientes'],
        data_categories: ['Identificación'],
        sensitive_data_categories: ['Salud'],
        systems: [{ name: 'Sistema QA controlado' }],
        deletion_method: 'Eliminación verificable',
      },
    }));
    activityId = String(activity.id);
    record('processing_activity_ids', activityId);
    const detail = await ok(await api.get(`/api/grc/phase2/privacy/processing-activities/${activityId}`, { headers: auth() }));
    expect((detail.activity as Json).dpia_required).toBe(true);
    expect((detail.alerts as Json[]).map(item => item.code)).toEqual(expect.arrayContaining([
      'SENSITIVE_PROCESSING_WITHOUT_DPIA', 'PROCESSING_RETENTION_MISSING',
    ]));
  });

  test('DPIA completa screening, riesgo, aprobación y activa el tratamiento', async () => {
    await ok(await api.patch(`/api/grc/phase2/privacy/processing-activities/${activityId}`, {
      headers: auth(),
      data: {
        retention_period: 'Cinco años desde el cierre de la relación',
        retention_basis: 'Obligación contractual y normativa',
        change_reason: 'Completar prerrequisito de retención antes de aprobación',
      },
    }));
    const dpia = await ok(await api.post(`/api/grc/phase2/privacy/processing-activities/${activityId}/dpias`, {
      headers: auth(),
      data: {
        screening: { sensitive: true, large_scale: true },
        necessity_assessment: 'Necesario para la finalidad declarada.',
        proportionality_assessment: 'Minimización y acceso restringido.',
        residual_risk_level: 'medium',
        conditions: ['Revisión anual'],
      },
    }));
    dpiaId = String(dpia.id);
    await ok(await api.post(`/api/grc/phase2/privacy/dpias/${dpiaId}/risks`, {
      headers: auth(),
      data: {
        title: 'Acceso no autorizado', likelihood: 4, impact: 4,
        residual_likelihood: 2, residual_impact: 2, treatment: 'MFA y revisión de acceso',
      },
    }));
    for (const to_status of ['screening', 'assessment', 'pending_approval', 'approved']) {
      await ok(await api.post(`/api/grc/phase2/privacy/dpias/${dpiaId}/transitions`, {
        headers: auth(), data: { to_status },
      }));
    }
    for (const to_status of ['under_review', 'approved', 'active']) {
      await ok(await api.post(`/api/grc/phase2/privacy/processing-activities/${activityId}/transitions`, {
        headers: auth(), data: { to_status, reason: `QA ${to_status}` },
      }));
    }
    const detail = await ok(await api.get(`/api/grc/phase2/privacy/processing-activities/${activityId}`, { headers: auth() }));
    expect((detail.activity as Json).status).toBe('active');
    expect(detail.dpias as Json[]).toHaveLength(1);
  });

  test('solicitud de titular aplica plazo y bloquea cierre sin respuesta/evidencia', async () => {
    const request = await ok(await api.post('/api/grc/phase2/privacy/requests', {
      headers: auth(),
      data: {
        request_number: `${prefix}-DSR`,
        request_type: 'access',
        subject_reference: `${prefix}-subject`,
        due_days: 10,
        normative_source: 'Fuente normativa QA controlada',
        processing_activity_ids: [activityId],
        systems: ['Sistema QA controlado'],
      },
    }));
    requestId = String(request.id);
    record('privacy_request_ids', requestId);
    for (const [to_status, extra] of [
      ['identity_verification', { identity_verification: { verified: true } }],
      ['in_progress', {}],
      ['pending_approval', {}],
    ] as const) {
      await ok(await api.post(`/api/grc/phase2/privacy/requests/${requestId}/transitions`, {
        headers: auth(), data: { to_status, ...extra },
      }));
    }
    const invalid = await api.post(`/api/grc/phase2/privacy/requests/${requestId}/transitions`, {
      headers: auth(), data: { to_status: 'responded' },
    });
    expect(invalid.status()).toBe(200);
    const blockedClose = await api.post(`/api/grc/phase2/privacy/requests/${requestId}/transitions`, {
      headers: auth(), data: { to_status: 'closed' },
    });
    expect(blockedClose.status()).toBe(409);
    expect((await blockedClose.json()).code).toBe('PRIVACY_REQUEST_CLOSURE_EVIDENCE_REQUIRED');
  });

  test('solicitud de titular cierra con respuesta, aprobación y evidencia', async () => {
    expect(evidenceId).toMatch(/^[0-9a-f-]{36}$/i);
    const reopened = await ok(await api.get('/api/grc/phase2/privacy/requests', { headers: auth() })) as unknown as Json[];
    expect(reopened.find(item => item.id === requestId)?.status).toBe('responded');
    const closed = await ok(await api.post(`/api/grc/phase2/privacy/requests/${requestId}/transitions`, {
      headers: auth(),
      data: {
        to_status: 'closed',
        response_summary: 'Respuesta aprobada y entregada.',
        response_evidence_ids: [evidenceId],
      },
    }));
    expect(closed.status).toBe('closed');
  });

  test('incidente calcula y confirma severidad explicable con impactos', async () => {
    const incident = await ok(await api.post('/api/grc/phase2/incidents', {
      headers: auth(),
      data: {
        incident_number: `${prefix}-INC`,
        title: `${prefix} incidente crítico`,
        description: 'Incidente QA controlado',
        category: 'privacy',
        priority: 'urgent',
        recurrence_key: `${prefix}-recurrence`,
        privacy_impact: true,
        regulatory_impact: true,
        customer_impact: true,
        severity_inputs: {
          service_criticality: 'critical', process_criticality: 'high',
          asset_criticality: 'high', supplier_criticality: 'medium',
          privacy_impact: true, regulatory_impact: true, customer_impact: 'high',
          duration_impact: 'medium', financial_impact: 'medium',
        },
      },
    }));
    incidentId = String(incident.id);
    incidentSeverity = String(incident.calculated_severity);
    record('incident_ids', incidentId);
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'triaged', note: 'Triage QA' },
    }));
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'classified', note: 'Clasificación QA', confirmed_severity: incidentSeverity },
    }));
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'active', note: 'Respuesta activa QA' },
    }));
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/impacts`, {
      headers: auth(), data: { impact_type: 'privacy', severity: 'high', description: 'Datos personales afectados' },
    }));
    const detail = await ok(await api.get(`/api/grc/phase2/incidents/${incidentId}`, { headers: auth() }));
    expect((detail.incident as Json).severity_formula_version).toBe('incident-severity-v1');
    expect(detail.impacts as Json[]).toHaveLength(1);
  });

  test('incidente bloquea cierre inválido y completa contención, recuperación y eficacia', async () => {
    const early = await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'contained', note: 'Contención QA' },
    });
    expect(early.status()).toBe(200);
    for (const to_status of ['recovering', 'resolved', 'post_incident_review']) {
      await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
        headers: auth(), data: { to_status, note: `Transición QA ${to_status}` },
      }));
    }
    const blocked = await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'closed', note: 'Cierre prematuro' },
    });
    expect(blocked.status()).toBe(409);
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/root-causes`, {
      headers: auth(),
      data: {
        method: 'five_whys', cause_category: 'process',
        description: 'Control preventivo insuficiente', contributing_factors: ['Revisión tardía'], confirmed: true,
      },
    }));
    await ok(await api.put(`/api/grc/phase2/incidents/${incidentId}/postmortem`, {
      headers: auth(),
      data: {
        summary: 'Postmortem QA', what_worked: 'Contención', what_failed: 'Prevención',
        lessons: ['Automatizar revisión'], status: 'approved',
      },
    }));
    await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/effectiveness`, {
      headers: auth(), data: { effective: true, criteria: 'Sin recurrencia en ventana QA' },
    }));
    const closed = await ok(await api.post(`/api/grc/phase2/incidents/${incidentId}/transitions`, {
      headers: auth(), data: { to_status: 'closed', note: 'Cierre eficaz QA', closure_summary: 'Recuperación y eficacia verificadas' },
    }));
    expect(closed.status).toBe('closed');
  });

  test('brecha de privacidad impacta obligaciones y exige evidencia para cerrar', async () => {
    const breach = await ok(await api.post('/api/grc/phase2/privacy/breaches', {
      headers: auth(),
      data: {
        breach_number: `${prefix}-BREACH`,
        processing_activity_id: activityId,
        incident_id: incidentId,
        data_categories: ['Identificación'],
        affected_subjects_estimate: 12,
        impact_summary: 'Exposición controlada para QA',
        severity: 'high',
        notification_due_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
    }));
    breachId = String(breach.id);
    record('privacy_breach_ids', breachId);
    await ok(await api.post(`/api/grc/phase2/privacy/breaches/${breachId}/transitions`, {
      headers: auth(), data: { to_status: 'assessing' },
    }));
    await ok(await api.post(`/api/grc/phase2/privacy/breaches/${breachId}/transitions`, {
      headers: auth(), data: { to_status: 'contained' },
    }));
    const blocked = await api.post(`/api/grc/phase2/privacy/breaches/${breachId}/transitions`, {
      headers: auth(), data: { to_status: 'closed' },
    });
    expect(blocked.status()).toBe(409);
    await ok(await api.post('/api/grc/phase2/relations', {
      headers: auth(),
      data: {
        source_type: 'privacy_breach', source_id: breachId,
        target_type: 'evidence', target_id: evidenceId,
        relation_type: 'closure_evidence', provenance: { source: 'runtime_qa' }, confidence: 100,
      },
    }));
    const closed = await ok(await api.post(`/api/grc/phase2/privacy/breaches/${breachId}/transitions`, {
      headers: auth(), data: { to_status: 'closed' },
    }));
    expect(closed.status).toBe('closed');
  });

  test('TPRM crea cartera, dependencias, contrato y cuestionario versionado', async () => {
    const createSupplier = async (suffix: string) => ok(await api.post('/api/grc/phase2/suppliers', {
      headers: auth(),
      data: {
        code: `${prefix}-SUP-${suffix}`,
        legal_name: `${prefix} Proveedor ${suffix}`,
        criticality: suffix === 'A' ? 'critical' : 'medium',
        inherent_risk_score: suffix === 'A' ? 85 : 45,
        data_access_level: suffix === 'A' ? 'sensitive' : 'internal',
        access_summary: 'Acceso QA controlado',
      },
    }));
    const supplierA = await createSupplier('A');
    const supplierB = await createSupplier('B');
    supplierId = String(supplierA.id);
    supplierBId = String(supplierB.id);
    record('supplier_ids', supplierId);
    record('supplier_ids', supplierBId);
    for (const to_status of ['due_diligence', 'under_assessment']) {
      await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/transitions`, {
        headers: auth(), data: { to_status, reason: `TPRM QA ${to_status}` },
      }));
    }
    await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/services`, {
      headers: auth(), data: { name: 'Servicio crítico QA', service_criticality: 'critical', dependency_type: 'critical' },
    }));
    await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/contracts`, {
      headers: auth(),
      data: {
        contract_number: `${prefix}-CONTRACT`, title: 'Contrato QA', status: 'active',
        security_terms: { audit: true }, privacy_terms: { deletion: true }, exit_terms: { revocation: true },
      },
    }));
    const questionnaire = await ok(await api.post('/api/grc/phase2/questionnaires', {
      headers: auth(),
      data: {
        code: `${prefix}-QUESTIONNAIRE`, name: `${prefix} evaluación`, domain: 'security',
        sections: [{
          code: 'ACCESS', title: 'Acceso',
          questions: [{
            code: 'MFA', prompt: '¿MFA habilitado?', answer_type: 'boolean',
            required: true, weight: 1, evidence_required: true,
          }],
        }],
      },
    }));
    templateId = String((questionnaire.template as Json).id);
    questionnaireVersionId = String((questionnaire.version as Json).id);
    record('questionnaire_template_ids', templateId);
  });

  test('portal rechaza invitación vencida y limita la sesión al proveedor asignado', async () => {
    const assessment = await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/assessments`, {
      headers: auth(),
      data: { questionnaire_version_id: questionnaireVersionId, inherent_risk_score: 85 },
    }));
    assessmentId = String(assessment.id);
    const expired = await ok(await api.post(`/api/grc/phase2/assessments/${assessmentId}/portal-invitations`, {
      headers: auth(),
      data: { email: 'expired@example.invalid', expires_at: new Date(Date.now() - 3600_000).toISOString() },
    }));
    const expiredExchange = await api.post('/api/supplier-portal/exchange', {
      data: { token: expired.one_time_token },
    });
    expect(expiredExchange.status()).toBe(410);
    const invitation = await ok(await api.post(`/api/grc/phase2/assessments/${assessmentId}/portal-invitations`, {
      headers: auth(),
      data: { email: 'supplier-a@example.invalid', max_file_bytes: 4096, allowed_mime_types: ['text/plain'] },
    }));
    portalToken = String(invitation.one_time_token);
    const exchange = await ok(await api.post('/api/supplier-portal/exchange', { data: { token: portalToken } }));
    portalSession = String(exchange.session_token);
    const portal = await ok(await api.get('/api/supplier-portal/assessment', {
      headers: { Authorization: `Bearer ${portalSession}` },
    }));
    expect((portal.supplier as Json).name).toBe(`${prefix} Proveedor A`);
    expect(JSON.stringify(portal)).not.toContain(`${prefix} Proveedor B`);
    expect(JSON.stringify(portal)).not.toContain('reviewer_user_id');
    expect(JSON.stringify(portal)).not.toContain('inherent_risk_score');
    portalQuestionId = String((portal.questions as Json[])[0].id);
  });

  test('portal valida archivos, deduplica evidencia y envía respuestas trazadas', async () => {
    const portalHeaders = { Authorization: `Bearer ${portalSession}` };
    await ok(await api.put('/api/supplier-portal/answers', {
      headers: portalHeaders,
      data: { question_id: portalQuestionId, answer: true, observation: 'MFA verificado por proveedor' },
    }));
    const rejected = await api.post('/api/supplier-portal/evidence', {
      headers: portalHeaders,
      multipart: {
        question_id: portalQuestionId,
        file: { name: 'unsafe.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('blocked') },
      },
    });
    expect(rejected.status()).toBe(415);
    const upload = () => api.post('/api/supplier-portal/evidence', {
      headers: portalHeaders,
      multipart: {
        question_id: portalQuestionId,
        file: { name: 'mfa-evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('phase2 controlled evidence') },
      },
    });
    const first = await ok(await upload());
    const repeated = await ok(await upload());
    expect(first.id).toBe(repeated.id);
    expect(JSON.stringify(first)).not.toContain('storage_path');
    const submitted = await ok(await api.post('/api/supplier-portal/submit', {
      headers: portalHeaders, data: { comment: 'Envío QA proveedor' },
    }));
    expect(submitted.status).toBe('submitted');
  });

  test('evaluación requiere decisión humana y habilita aprobación del proveedor', async () => {
    await ok(await api.post(`/api/grc/phase2/assessments/${assessmentId}/transitions`, {
      headers: auth(), data: { to_status: 'under_review', comment: 'Revisión humana QA' },
    }));
    const approved = await ok(await api.post(`/api/grc/phase2/assessments/${assessmentId}/transitions`, {
      headers: auth(),
      data: {
        to_status: 'approved', comment: 'Aprobación humana QA',
        residual_risk_score: 30, decision_reason: 'Controles y evidencia verificados',
      },
    }));
    expect((approved.scoring as Json).formulaVersion).toBe('supplier-assessment-v1');
    for (const to_status of ['pending_approval', 'approved', 'active']) {
      await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/transitions`, {
        headers: auth(), data: { to_status, reason: `Decisión TPRM QA ${to_status}` },
      }));
    }
    const supplier360 = await ok(await api.get(`/api/grc/phase2/suppliers/${supplierId}`, { headers: auth() }));
    expect((supplier360.supplier as Json).status).toBe('active');
    expect(supplier360.assessments as Json[]).toHaveLength(1);
  });

  test('salida del proveedor exige revocación, devolución y eliminación verificadas', async () => {
    await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/transitions`, {
      headers: auth(), data: { to_status: 'exit_in_progress', reason: 'Inicio salida QA' },
    }));
    const premature = await api.post(`/api/grc/phase2/suppliers/${supplierId}/transitions`, {
      headers: auth(), data: { to_status: 'exited', reason: 'Salida incompleta' },
    });
    expect(premature.status()).toBe(409);
    for (const check_type of ['access_revocation', 'data_return', 'data_deletion']) {
      await ok(await api.put(`/api/grc/phase2/suppliers/${supplierId}/exit-checks`, {
        headers: auth(),
        data: { check_type, status: 'verified', evidence_ids: [evidenceId], notes: `Verificado ${check_type}` },
      }));
    }
    const exited = await ok(await api.post(`/api/grc/phase2/suppliers/${supplierId}/transitions`, {
      headers: auth(), data: { to_status: 'exited', reason: 'Salida verificada QA' },
    }));
    expect(exited.status).toBe('exited');
  });

  test('cuatro conectores sandbox normalizan, alertan y deduplican por idempotencia', async () => {
    for (const provider of ['microsoft_graph', 'google_workspace', 'jira', 'github']) {
      const connector = await ok(await api.post('/api/grc/phase2/connectors', {
        headers: auth(),
        data: { provider, display_name: `${prefix} ${provider}`, execution_mode: 'sandbox', schedule: { enabled: false } },
      }));
      const id = String(connector.id);
      connectorIds.push(id);
      record('connector_ids', id);
      expect(connector.credential_envelope).toBeUndefined();
      const key = `${prefix}:${provider}:sync`;
      const first = await ok(await api.post(`/api/grc/phase2/connectors/${id}/sync`, {
        headers: { ...auth(), 'Idempotency-Key': key },
      }));
      expect((first.run as Json).status).toBe('completed');
      expect(Number((first.run as Json).records_normalized)).toBeGreaterThan(0);
      if (provider === 'github') {
        const replay = await ok(await api.post(`/api/grc/phase2/connectors/${id}/sync`, {
          headers: { ...auth(), 'Idempotency-Key': key },
        }));
        expect(replay.reused).toBe(true);
      }
      const detail = await ok(await api.get(`/api/grc/phase2/connectors/${id}`, { headers: auth() }));
      expect(JSON.stringify(detail)).not.toContain('credential_envelope');
    }
  });

  test('RBAC, tenant, export y vista ejecutiva global permanecen aislados', async () => {
    const denied = await api.post('/api/grc/phase2/connectors', {
      headers: { Authorization: `Bearer ${restrictedToken}` },
      data: { provider: 'github', display_name: `${prefix} denied`, execution_mode: 'sandbox' },
    });
    expect(denied.status()).toBe(403);
    const crossTenant = await api.get(`/api/grc/phase2/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${tenantBToken}` },
    });
    expect([403, 404]).toContain(crossTenant.status());
    expect(tenantBId).not.toBe(tenantId);
    const report = await api.post('/api/grc/phase2/reports/incidents', {
      headers: auth(), data: { filters: { status: 'closed' } },
    });
    expect(report.status()).toBe(200);
    const exportId = report.headers()['x-tcdx-export-id'];
    expect(exportId).toBeTruthy();
    record('export_ids', exportId);
    expect(await report.text()).toContain(`${prefix}-INC`);
    const executive = await ok(await api.get('/api/grc/phase2/executive', { headers: auth() }));
    expect(executive).toHaveProperty('privacy');
    expect(executive).toHaveProperty('incidents');
    expect(executive).toHaveProperty('suppliers');
    expect(executive).toHaveProperty('integrations');
  });
});
