const assert = require('assert');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createPhase2Service } = require('./phase2.service');
const { runCleanup } = require('../../../../scripts/phase2/cleanup-phase2-qa');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const service = createPhase2Service(pool, {
  clock: () => Date.parse('2026-07-27T18:00:00.000Z'),
  environment: { CONNECTOR_CREDENTIAL_ENCRYPTION_KEY: 'phase2-postgres-test-key' },
});

const tenantA = '82000000-0000-4000-8000-000000000001';
const tenantB = '82000000-0000-4000-8000-000000000002';
const userA = '82000000-0000-4000-8000-000000000011';
const userB = '82000000-0000-4000-8000-000000000012';
const qaPrefix = 'PHASE2_QA_postgres-contract';

async function seed() {
  await pool.query(
    `INSERT INTO tenants (id,name) VALUES ($1,'Phase 2 Tenant A'),($2,'Phase 2 Tenant B')`,
    [tenantA, tenantB]
  );
  await pool.query(
    `INSERT INTO users (id,tenant_id,email,full_name)
     VALUES ($3,$1,'phase2-a@example.test','Phase 2 A'),($4,$2,'phase2-b@example.test','Phase 2 B')`,
    [tenantA, tenantB, userA, userB]
  );
  await pool.query(
    `INSERT INTO tenant_module_settings (tenant_id,module_key,is_enabled,enabled_by)
     VALUES ($1,'grc_phase2_integrated',TRUE,$3),($2,'grc_phase2_integrated',TRUE,$4)`,
    [tenantA, tenantB, userA, userB]
  );
}

async function transitionIncident(incidentId, toStatus, extra = {}) {
  return service.transitionIncident({
    tenantId: tenantA,
    userId: userA,
    correlationId: `integration:${toStatus}`,
    id: incidentId,
    body: { to_status: toStatus, note: `Verified transition to ${toStatus}`, ...extra },
  });
}

async function run() {
  await seed();
  await service.assertModuleEnabled(tenantA);

  const activity = await service.createProcessingActivity({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'integration:processing',
    body: {
      code: `${qaPrefix}-ROPA-1`,
      name: 'Atención de solicitudes controlada',
      legal_basis: 'Obligación legal',
      legal_basis_source: 'Fuente normativa controlada',
      purposes: ['Atención'],
      data_categories: ['Identificación'],
      retention_period: '24 meses',
      retention_basis: 'Plazo normativo',
      deletion_method: 'Eliminación verificable',
      systems: [{ name: 'Sistema controlado' }],
    },
  });
  await service.transitionProcessing({
    tenantId: tenantA, userId: userA, correlationId: 'integration:processing-review',
    id: activity.id, body: { to_status: 'under_review', reason: 'Revisión controlada' },
  });
  await service.transitionProcessing({
    tenantId: tenantA, userId: userA, correlationId: 'integration:processing-approve',
    id: activity.id, body: { to_status: 'approved', reason: 'Aprobación controlada' },
  });
  await service.transitionProcessing({
    tenantId: tenantA, userId: userA, correlationId: 'integration:processing-active',
    id: activity.id, body: { to_status: 'active', reason: 'Activación controlada' },
  });
  const processing360 = await service.getProcessing360(tenantA, activity.id);
  assert.strictEqual(processing360.activity.status, 'active');
  assert.strictEqual(processing360.versions.length, 4);
  assert.strictEqual((await service.listProcessingActivities(tenantB)).length, 0);

  const request = await service.createPrivacyRequest({
    tenantId: tenantA, userId: userA, correlationId: 'integration:request',
    body: {
      request_number: `${qaPrefix}-DSR-1`,
      request_type: 'access',
      subject_reference: 'controlled-subject',
      due_days: 10,
      normative_source: 'Fuente normativa controlada',
      processing_activity_ids: [activity.id],
      systems: ['Sistema controlado'],
    },
  });
  assert.strictEqual(request.status, 'opened');

  const incident = await service.createIncident({
    tenantId: tenantA, userId: userA, correlationId: 'integration:incident',
    body: {
      incident_number: `${qaPrefix}-INC-1`,
      title: 'Incidente controlado',
      description: 'Ciclo runtime controlado',
      category: 'availability',
      priority: 'high',
      recurrence_key: 'phase2-controlled',
      privacy_impact: true,
      severity_inputs: {
        service_criticality: 'high',
        process_criticality: 'high',
        asset_criticality: 'medium',
        supplier_criticality: 'low',
        privacy_impact: true,
        regulatory_impact: true,
        customer_impact: 'medium',
        duration_impact: 'medium',
        financial_impact: 'low',
      },
    },
  });
  await transitionIncident(incident.id, 'triaged');
  await transitionIncident(incident.id, 'classified', { confirmed_severity: incident.calculated_severity });
  await transitionIncident(incident.id, 'active');
  await service.addIncidentImpact({
    tenantId: tenantA, id: incident.id,
    body: { impact_type: 'privacy', severity: 'high', description: 'Impacto controlado' },
  });
  await service.addIncidentNotification({
    tenantId: tenantA, userId: userA, id: incident.id,
    body: { recipient_type: 'internal', recipient: 'Equipo controlado', status: 'approved', message: 'Mensaje controlado' },
  });
  await transitionIncident(incident.id, 'contained');
  await transitionIncident(incident.id, 'recovering');
  await transitionIncident(incident.id, 'resolved');
  await service.addIncidentRootCause({
    tenantId: tenantA, userId: userA, id: incident.id,
    body: {
      method: 'five_whys', cause_category: 'process',
      description: 'Causa controlada', contributing_factors: ['Factor controlado'], confirmed: true,
    },
  });
  await transitionIncident(incident.id, 'post_incident_review');
  await service.upsertPostmortem({
    tenantId: tenantA, userId: userA, id: incident.id,
    body: {
      summary: 'Postmortem controlado', what_worked: 'Contención',
      what_failed: 'Prevención', lessons: ['Lección controlada'], status: 'approved',
    },
  });
  await service.verifyIncidentEffectiveness({
    tenantId: tenantA, userId: userA, id: incident.id,
    body: { effective: true, criteria: 'Sin recurrencia durante ventana controlada' },
  });
  await transitionIncident(incident.id, 'closed', { closure_summary: 'Cierre eficaz controlado' });
  const incident360 = await service.getIncident360(tenantA, incident.id);
  assert.strictEqual(incident360.incident.status, 'closed');
  assert.strictEqual(incident360.impacts.length, 1);
  assert.strictEqual(incident360.notifications.length, 1);

  const supplier = await service.createSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier',
    body: {
      code: `${qaPrefix}-SUP-1`, legal_name: 'Proveedor Controlado SpA',
      criticality: 'critical', inherent_risk_score: 80,
      data_access_level: 'sensitive', access_summary: 'Acceso controlado',
    },
  });
  await service.transitionSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier-dd',
    id: supplier.id, body: { to_status: 'due_diligence', reason: 'Inicio due diligence' },
  });
  await service.transitionSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier-assess',
    id: supplier.id, body: { to_status: 'under_assessment', reason: 'Evaluación iniciada' },
  });
  await service.addSupplierService({
    tenantId: tenantA, id: supplier.id,
    body: { name: 'Servicio controlado', service_criticality: 'critical', dependency_type: 'critical' },
  });
  await service.addSupplierContract({
    tenantId: tenantA, id: supplier.id,
    body: {
      contract_number: 'CON-QA-1', title: 'Contrato controlado', status: 'active',
      security_terms: { audit: true }, privacy_terms: { deletion: true }, exit_terms: { revocation: true },
    },
  });
  const questionnaire = await service.createQuestionnaireTemplate({
    tenantId: tenantA, userId: userA,
    body: {
      code: `${qaPrefix}-TPRM-1`, name: 'Cuestionario controlado', domain: 'security',
      sections: [{
        code: 'SEC', title: 'Seguridad',
        questions: [{
          code: 'MFA', prompt: '¿MFA habilitado?', answer_type: 'boolean',
          required: true, weight: 1, evidence_required: false,
        }],
      }],
    },
  });
  const assessment = await service.createSupplierAssessment({
    tenantId: tenantA, userId: userA, correlationId: 'integration:assessment',
    id: supplier.id,
    body: { questionnaire_version_id: questionnaire.version.id, inherent_risk_score: 80 },
  });
  const invitation = await service.createPortalInvitation({
    tenantId: tenantA, userId: userA, assessmentId: assessment.id,
    body: { email: 'supplier@example.test' },
  });
  const session = await service.exchangePortalInvitation(invitation.one_time_token);
  const portalBefore = await service.portalAssessment(session.session_token);
  assert.strictEqual(portalBefore.questions.length, 1);
  assert.strictEqual(portalBefore.assessment.reviewer_user_id, undefined);
  await service.portalSaveAnswer(session.session_token, {
    question_id: portalBefore.questions[0].id,
    answer: true,
    score: 0,
    observation: 'Respuesta controlada',
  });
  const submitted = await service.portalSubmit(session.session_token, { comment: 'Envío controlado' });
  assert.strictEqual(submitted.status, 'submitted');
  await service.transitionAssessment({
    tenantId: tenantA, userId: userA, correlationId: 'integration:assessment-review',
    id: assessment.id, body: { to_status: 'under_review', comment: 'Revisión humana controlada' },
  });
  const approvedAssessment = await service.transitionAssessment({
    tenantId: tenantA, userId: userA, correlationId: 'integration:assessment-approve',
    id: assessment.id,
    body: {
      to_status: 'approved', comment: 'Aprobación humana controlada',
      residual_risk_score: 35, decision_reason: 'Controles verificados',
    },
  });
  assert.strictEqual(Number(approvedAssessment.score), 100);
  await service.transitionSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier-pending',
    id: supplier.id, body: { to_status: 'pending_approval', reason: 'Evaluación aprobada' },
  });
  await service.transitionSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier-approved',
    id: supplier.id, body: { to_status: 'approved', reason: 'Decisión humana' },
  });
  await service.transitionSupplier({
    tenantId: tenantA, userId: userA, correlationId: 'integration:supplier-active',
    id: supplier.id, body: { to_status: 'active', reason: 'Proveedor activo' },
  });
  assert.strictEqual((await service.getSupplier360(tenantA, supplier.id)).supplier.status, 'active');
  assert.strictEqual((await service.listSuppliers(tenantB)).length, 0);

  const connector = await service.createConnector({
    tenantId: tenantA, userId: userA, role: 'platform_admin',
    body: { provider: 'github', display_name: `${qaPrefix} GitHub sandbox controlado`, execution_mode: 'sandbox' },
  });
  assert.strictEqual(connector.credentials_configured, false);
  const firstRun = await service.runConnector({
    tenantId: tenantA, userId: userA, role: 'platform_admin', correlationId: 'integration:connector',
    id: connector.id, idempotencyKey: 'integration:github:1',
  });
  const repeatedRun = await service.runConnector({
    tenantId: tenantA, userId: userA, role: 'platform_admin', correlationId: 'integration:connector-repeat',
    id: connector.id, idempotencyKey: 'integration:github:1',
  });
  assert.strictEqual(firstRun.run.status, 'completed');
  assert.strictEqual(firstRun.run.records_normalized, 3);
  assert.strictEqual(repeatedRun.reused, true);
  const connector360 = await service.connector360(tenantA, connector.id, 'platform_admin');
  assert.strictEqual(connector360.records.length, 3);
  assert.strictEqual(connector360.connector.credential_envelope, undefined);
  const report = await service.generateReport({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'integration:report',
    domain: 'incidents',
    filters: { status: 'closed' },
  });
  assert.strictEqual(report.record.domain, 'incidents');
  assert(report.buffer.toString('utf8').includes(`${qaPrefix}-INC-1`));
  const storedReport = await service.getPhase2Export(tenantA, report.record.id);
  assert.strictEqual(storedReport.content_hash, report.record.content_hash);
  const liveConnector = await service.createConnector({
    tenantId: tenantA,
    userId: userA,
    role: 'platform_admin',
    body: {
      provider: 'github',
      display_name: `${qaPrefix} GitHub webhook controlado`,
      execution_mode: 'live',
      credentials: {
        access_token: 'controlled-nonlive-token',
        webhook_secret: 'controlled-webhook-secret',
        client_id: 'controlled-client',
        client_secret: 'controlled-secret',
        redirect_uri: 'https://example.test/api/grc/phase2/external/oauth/callback',
      },
    },
  });
  assert.strictEqual(liveConnector.credentials_configured, true);
  assert(!JSON.stringify(liveConnector).includes('controlled-nonlive-token'));
  const webhookBody = Buffer.from(JSON.stringify({
    id: 'delivery-controlled-1',
    type: 'security_alert',
    state: 'open',
    severity: 'high',
  }));
  const signature = crypto.createHmac('sha256', 'controlled-webhook-secret').update(webhookBody).digest('hex');
  const webhookFirst = await service.ingestConnectorWebhook({
    integrationId: liveConnector.id,
    signature: `sha256=${signature}`,
    eventType: 'security_alert',
    rawBody: webhookBody,
  });
  const webhookRepeated = await service.ingestConnectorWebhook({
    integrationId: liveConnector.id,
    signature: `sha256=${signature}`,
    eventType: 'security_alert',
    rawBody: webhookBody,
  });
  assert.strictEqual(webhookFirst.reused, false);
  assert.strictEqual(webhookRepeated.reused, true);

  const events = await pool.query('SELECT COUNT(*)::int AS count FROM grc_domain_events WHERE tenant_id=$1', [tenantA]);
  const rules = await pool.query('SELECT COUNT(*)::int AS count FROM grc_rule_executions WHERE tenant_id=$1', [tenantA]);
  const crossTenant = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM privacy_processing_activities WHERE tenant_id=$1)::int AS privacy,
       (SELECT COUNT(*) FROM grc_incidents WHERE tenant_id=$1)::int AS incidents,
       (SELECT COUNT(*) FROM grc_suppliers WHERE tenant_id=$1)::int AS suppliers,
       (SELECT COUNT(*) FROM grc_external_records WHERE tenant_id=$1)::int AS external_records`,
    [tenantB]
  );
  assert(Number(events.rows[0].count) >= 15);
  assert(Number(rules.rows[0].count) >= 3);
  assert.deepStrictEqual(crossTenant.rows[0], {
    privacy: 0, incidents: 0, suppliers: 0, external_records: 0,
  });

  const cleanupManifest = {
    manifest_version: 1,
    tenant_id: tenantA,
    run_id: 'postgres-contract',
    prefix: qaPrefix,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resources: {
      processing_activity_ids: [activity.id],
      privacy_request_ids: [request.id],
      privacy_breach_ids: [],
      incident_ids: [incident.id],
      supplier_ids: [supplier.id],
      questionnaire_template_ids: [questionnaire.template.id],
      connector_ids: [connector.id, liveConnector.id],
      export_ids: [report.record.id],
    },
  };
  const firstCleanup = await runCleanup({ manifest: cleanupManifest, pool });
  const secondCleanup = await runCleanup({ manifest: cleanupManifest, pool });
  assert.strictEqual(firstCleanup.status, 'CLEANED');
  assert.strictEqual(secondCleanup.status, 'ALREADY_CLEAN');

  console.log(JSON.stringify({
    status: 'VERIFIED_PHASE2_POSTGRES',
    activity_id: activity.id,
    incident_id: incident.id,
    supplier_id: supplier.id,
    connector_id: connector.id,
    domain_events: events.rows[0].count,
    rule_executions: rules.rows[0].count,
    tenant_isolation_findings: 0,
    connector_idempotency: true,
    webhook_signature_verified: true,
    portal_internal_fields_exposed: false,
    cleanup_first: firstCleanup.status,
    cleanup_second: secondCleanup.status,
  }));
}

run()
  .then(() => pool.end())
  .catch(async error => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
