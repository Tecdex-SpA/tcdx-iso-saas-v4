const assert = require('assert');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createGrcService, GrcError } = require('./grc.service');

const TENANT_A = '70000000-0000-4000-8000-000000000701';
const TENANT_B = '70000000-0000-4000-8000-000000000702';
const USER_A = '70000000-0000-4000-8000-000000000711';
const USER_B = '70000000-0000-4000-8000-000000000712';

async function run() {
  const pool = new Pool();
  const asyncJobs = {
    async createJob({ tenant_id: tenantId }) {
      const id = crypto.randomUUID();
      await pool.query('INSERT INTO tcdx_async_jobs (id, tenant_id) VALUES ($1::uuid,$2::uuid)', [id, tenantId]);
      return { id };
    },
  };
  const service = createGrcService(pool, asyncJobs);
  try {
    await pool.query(
      `INSERT INTO tenants (id, name) VALUES
         ($1::uuid,'Tenant A Phase 1R'),($2::uuid,'Tenant B Phase 1R')`,
      [TENANT_A, TENANT_B]
    );
    await pool.query(
      `INSERT INTO users (id, tenant_id, email) VALUES
       ($1::uuid,$3::uuid,'phase1r-admin@example.invalid'),
       ($2::uuid,$3::uuid,'phase1r-reviewer@example.invalid')`,
      [USER_A, USER_B, TENANT_A]
    );
    await pool.query(
      `INSERT INTO tenant_module_settings (
         tenant_id, module_key, is_enabled, enabled_at, enabled_by
       ) VALUES
         ($1::uuid,'grc_phase1_core',TRUE,now(),$3::uuid),
         ($2::uuid,'grc_phase1_core',FALSE,NULL,NULL)`,
      [TENANT_A, TENANT_B, USER_A]
    );
    const tenantControlA = crypto.randomUUID();
    const tenantControlB = crypto.randomUUID();
    await pool.query(
      'INSERT INTO tenant_controls (id, tenant_id) VALUES ($1::uuid,$2::uuid)',
      [tenantControlA, TENANT_A]
    );
    await pool.query(
      'INSERT INTO tenant_controls (id, tenant_id) VALUES ($1::uuid,$2::uuid)',
      [tenantControlB, TENANT_B]
    );

    const first = await service.bootstrapTenant({
      tenantId: TENANT_A,
      userId: USER_A,
      confirmation: 'INITIALIZE_GRC',
      idempotencyKey: 'phase1r-integration-bootstrap',
      correlationId: 'phase1r-integration-1',
    });
    assert.equal(first.ok, true);
    assert.equal(first.ready, true);
    assert.equal(first.created.filter(item => item.startsWith('workflow:')).length, 7);
    assert.ok(first.created.includes('mapping:framework-root'));

    const replay = await service.bootstrapTenant({
      tenantId: TENANT_A,
      userId: USER_A,
      confirmation: 'INITIALIZE_GRC',
      idempotencyKey: 'phase1r-integration-bootstrap',
      correlationId: 'phase1r-integration-2',
    });
    assert.equal(replay.idempotent_replay, true);
    assert.deepEqual(replay.created, first.created);

    const secondKey = await service.bootstrapTenant({
      tenantId: TENANT_A,
      userId: USER_A,
      confirmation: 'INITIALIZE_GRC',
      idempotencyKey: 'phase1r-integration-bootstrap-second',
      correlationId: 'phase1r-integration-3',
    });
    assert.equal(secondKey.ready, true);
    assert.equal(secondKey.created.length, 0);
    assert.ok(secondKey.reused.includes('configuration'));
    assert.ok(secondKey.reused.includes('mapping:framework-root'));

    const statusA = await service.getBootstrapStatus(TENANT_A);
    const statusB = await service.getBootstrapStatus(TENANT_B);
    assert.equal(statusA.ready, true);
    assert.equal(statusA.counts.workflows, 7);
    assert.equal(statusB.ready, false);
    assert.equal(statusB.checks.module_enabled, false);
    await assert.rejects(
      () => service.assertModuleEnabled(TENANT_B),
      error => error instanceof GrcError && error.code === 'GRC_PHASE1_DISABLED'
    );
    const workflowDefinition = (await service.listWorkflowDefinitions(TENANT_A))
      .find(item => item.code === 'phase1-approval-simple');
    const workflowDraft = {
      name: 'Aprobación simple revisada',
      entity_type: 'action',
      approval_mode: 'simple',
      states: [
        { code: 'draft', name: 'Borrador', state_type: 'initial' },
        { code: 'approved', name: 'Aprobado', state_type: 'terminal' },
      ],
      transitions: [
        {
          code: 'approve', name: 'Aprobar', from_state: 'draft', to_state: 'approved',
          required_permission: 'workflow.transition', approval_mode: 'simple',
          roles: ['admin', 'tenant_admin'], preconditions: ['comment_required'],
        },
      ],
    };
    assert.equal(service.validateWorkflow(workflowDraft).valid, true);
    const savedDraft = await service.saveWorkflowDraft({
      tenantId: TENANT_A, userId: USER_A, definitionId: workflowDefinition.id,
      correlationId: 'phase1r-workflow-draft', body: workflowDraft,
    });
    assert.equal(savedDraft.version.version, 2);
    const workflowHistory = await service.getWorkflowDefinition(TENANT_A, workflowDefinition.id);
    assert.equal(workflowHistory.versions.length, 2);
    await service.publishWorkflow({
      tenantId: TENANT_A, userId: USER_A, definitionId: workflowDefinition.id,
      correlationId: 'phase1r-workflow-publish-v2',
    });
    await assert.rejects(
      () => pool.query(
        `UPDATE grc_workflow_versions SET config = '{"mutated":true}'::jsonb
         WHERE tenant_id = $1::uuid AND definition_id = $2::uuid AND version = 1`,
        [TENANT_A, workflowDefinition.id]
      ),
      error => error.code === 'P0001' || error.message === 'grc_workflow_versions records are immutable'
    );
    const mappings = await service.listMappings(TENANT_A);
    assert.equal(mappings.length, 1);
    const mappingReview = await service.reviewMapping({
      tenantId: TENANT_A,
      userId: USER_A,
      mappingId: mappings[0].id,
      body: { decision: 'approved', comment: 'Mapping sintético verificado' },
      correlationId: 'phase1r-mapping-review',
    });
    assert.equal(mappingReview.mapping.status, 'published');
    await assert.rejects(
      () => service.createMapping({
        tenantId: TENANT_A,
        userId: USER_A,
        correlationId: 'phase1r-mapping-cross-tenant',
        body: {
          requirement_id: mappings[0].requirement_id,
          tenant_control_id: tenantControlB,
          mapping_type: 'partial',
          coverage_level: 50,
          justification: 'Debe ser rechazado',
        },
      }),
      error => error instanceof GrcError && error.code === 'MAPPING_CONTROL_NOT_FOUND'
    );

    const request = await service.createEvidenceRequest({
      tenantId: TENANT_A,
      userId: USER_A,
      correlationId: 'phase1r-evidence',
      body: {
        title: 'PHASE1R_QA recurring evidence',
        status: 'requested',
        due_at: new Date(Date.now() - 3_600_000).toISOString(),
        schedule: { frequency: 'monthly', interval_value: 1, start_at: new Date().toISOString() },
      },
    });
    const evidenceV1 = crypto.randomUUID();
    const evidenceV2 = crypto.randomUUID();
    await pool.query(
      `INSERT INTO evidences (id, tenant_id) VALUES
        ($1::uuid,$3::uuid),($2::uuid,$3::uuid)`,
      [evidenceV1, evidenceV2, TENANT_A]
    );
    const submission = await service.submitEvidence({
      tenantId: TENANT_A,
      userId: USER_A,
      requestId: request.id,
      correlationId: 'phase1r-evidence-submit',
      body: { evidence_id: evidenceV1, content_hash: 'sha256-v1' },
    });
    const submissionReplay = await service.submitEvidence({
      tenantId: TENANT_A,
      userId: USER_A,
      requestId: request.id,
      correlationId: 'phase1r-evidence-submit-replay',
      body: { evidence_id: evidenceV1, content_hash: 'sha256-v1' },
    });
    assert.equal(submissionReplay.id, submission.id);
    assert.equal(submissionReplay.reused, true);
    const version = await service.createEvidenceVersion({
      tenantId: TENANT_A,
      userId: USER_A,
      submissionId: submission.id,
      correlationId: 'phase1r-evidence-version',
      body: { evidence_id: evidenceV2, content_hash: 'sha256-v2' },
    });
    assert.equal(version.version, 2);
    await assert.rejects(
      () => service.reviewEvidence({
        tenantId: TENANT_A, userId: USER_A, submissionId: submission.id,
        body: { decision: 'rejected' }, correlationId: 'phase1r-evidence-review-invalid',
      }),
      error => error instanceof GrcError && error.code === 'EVIDENCE_REJECTION_REASON_REQUIRED'
    );
    await service.reviewEvidence({
      tenantId: TENANT_A,
      userId: USER_A,
      submissionId: submission.id,
      body: { decision: 'rejected', reason: 'Corrección sintética requerida' },
      correlationId: 'phase1r-evidence-review',
    });
    const evidenceDetail = await service.getEvidenceRequest(TENANT_A, request.id);
    assert.equal(evidenceDetail.submissions.length, 1);
    assert.equal(evidenceDetail.submissions[0].versions.length, 2);
    assert.equal(evidenceDetail.submissions[0].reviews.length, 1);
    await assert.rejects(
      () => service.getEvidenceRequest(TENANT_B, request.id),
      error => error instanceof GrcError && error.code === 'EVIDENCE_REQUEST_NOT_FOUND'
    );
    const auditId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO audits (id, tenant_id, status) VALUES ($1::uuid,$2::uuid,'en_ejecucion')`,
      [auditId, TENANT_A]
    );
    const auditor = await service.assignAuditTeamMember({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-team-a',
      body: { user_id: USER_A, team_role: 'auditor', independence_status: 'declared', declaration: { confirmed: true } },
    });
    await service.assignAuditTeamMember({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-team-b',
      body: { user_id: USER_B, team_role: 'supervisor', independence_status: 'declared', declaration: { confirmed: true } },
    });
    const conflict = await service.recordAuditConflict({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-conflict',
      body: { team_member_id: auditor.id, conflict_type: 'independence', description: 'Conflicto sintético' },
    });
    let closeReadiness = await service.getAuditCloseReadiness(TENANT_A, auditId);
    assert.ok(closeReadiness.blockers.includes('open_independence_conflicts'));
    await service.resolveAuditConflict({
      tenantId: TENANT_A, userId: USER_B, conflictId: conflict.id,
      correlationId: 'phase1r-audit-conflict-resolve',
      body: { status: 'mitigated', resolution: 'Mitigación sintética verificada' },
    });
    await service.createAuditProgram({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-program',
      body: { objectives: ['Objetivo sintético'], scope: { synthetic: true }, procedures: ['inspection'] },
    });
    await service.createAuditSample({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-sample',
      body: { population_description: 'Población sintética', method: 'judgmental', sample_size: 1, limitation: 'Muestra dirigida' },
    });
    const workpaper = await service.createWorkpaper({
      tenantId: TENANT_A, userId: USER_A, correlationId: 'phase1r-audit-workpaper',
      body: { audit_id: auditId, code: 'WP-QA-1', objective: 'Objetivo', procedure_text: 'Inspección', status: 'submitted' },
    });
    await service.linkAuditEvidence({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-evidence',
      body: { evidence_id: evidenceV2, workpaper_id: workpaper.id },
    });
    await service.reviewWorkpaper({
      tenantId: TENANT_A, userId: USER_B, workpaperId: workpaper.id,
      correlationId: 'phase1r-audit-review',
      body: { decision: 'approved', observations: 'Aprobado por supervisor independiente' },
    });
    await service.createAuditFollowup({
      tenantId: TENANT_A, userId: USER_A, auditId, correlationId: 'phase1r-audit-followup',
      body: { verification_notes: 'Seguimiento sintético' },
    });
    closeReadiness = await service.getAuditCloseReadiness(TENANT_A, auditId);
    assert.equal(closeReadiness.can_close, true, JSON.stringify(closeReadiness));
    const closedAudit = await service.closeAudit({
      tenantId: TENANT_A, userId: USER_B, auditId, correlationId: 'phase1r-audit-close',
    });
    assert.equal(closedAudit.status, 'completada');
    const auditReport = await service.generateExport({
      tenantId: TENANT_A, userId: USER_B, domain: 'audit', format: 'pdf',
      filters: { id: auditId }, correlationId: 'phase1r-audit-report',
    });
    assert.ok(auditReport.buffer.length > 20);
    const reportRows = await pool.query(
      `SELECT * FROM grc_audit_reports WHERE tenant_id = $1::uuid AND audit_id = $2::uuid`,
      [TENANT_A, auditId]
    );
    assert.equal(reportRows.rowCount, 1);
    assert.equal(reportRows.rows[0].content_hash, auditReport.record.content_hash);
    const auditOperations = await service.getAuditOperations(TENANT_A, auditId);
    assert.equal(auditOperations.team.length, 2);
    assert.equal(auditOperations.programs.length, 1);
    assert.equal(auditOperations.workpapers[0].status, 'approved');
    await pool.query(
      `UPDATE grc_evidence_schedules SET next_run_at = now() - interval '1 minute'
       WHERE tenant_id = $1::uuid AND request_template_id = $2::uuid`,
      [TENANT_A, request.id]
    );
    const schedulerInput = {
      tenantId: TENANT_A,
      userId: USER_A,
      correlationId: 'phase1r-scheduler',
      body: {
        run_type: 'phase1r_integration',
        window_key: 'phase1r-integration-window',
        tasks: ['evidence_requests', 'escalations'],
      },
    };
    const scheduler = await service.runScheduler(schedulerInput);
    const schedulerReplay = await service.runScheduler(schedulerInput);
    assert.equal(scheduler.run.status, 'completed', JSON.stringify(scheduler.results));
    assert.equal(scheduler.results.evidence_requests.created, 1);
    assert.equal(schedulerReplay.reused, true);
    const occurrences = await pool.query(
      `SELECT COUNT(*)::int AS count FROM grc_evidence_requests
       WHERE tenant_id = $1::uuid AND schedule_id IS NOT NULL`,
      [TENANT_A]
    );
    assert.equal(occurrences.rows[0].count, 1);

    const exported = await service.generateExport({
      tenantId: TENANT_A,
      userId: USER_A,
      domain: 'frameworks',
      format: 'csv',
      filters: {},
      correlationId: 'phase1r-export',
    });
    assert.ok(exported.buffer.length > 20);
    assert.match(exported.record.content_hash, /^[a-f0-9]{64}$/);
    await assert.rejects(
      () => service.getExport(TENANT_B, exported.record.id),
      error => error instanceof GrcError && error.code === 'GRC_EXPORT_NOT_FOUND'
    );

    const auditRows = await pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_event_log
       WHERE tenant_id = $1::uuid AND action LIKE 'grc.bootstrap.%'`,
      [TENANT_A]
    );
    assert.ok(auditRows.rows[0].count >= 2);
    const tenantBLeak = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM grc_workflow_definitions WHERE tenant_id = $1::uuid) +
         (SELECT COUNT(*) FROM grc_bootstrap_runs WHERE tenant_id = $1::uuid) AS count`,
      [TENANT_B]
    );
    assert.equal(Number(tenantBLeak.rows[0].count), 0);
    console.log('Phase 1R PostgreSQL integration: OK');
  } finally {
    await pool.end();
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
