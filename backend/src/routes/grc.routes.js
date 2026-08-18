const express = require('express');
const pool = require('../config/db');
const asyncJobs = require('../services/asyncJob.service');
const { GrcError, createGrcService } = require('../services/grc/grc.service');
const { observe } = require('../services/grc/grcObservability');

const router = express.Router();
const service = createGrcService(pool, asyncJobs);

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function roleOf(req) {
  return String(req.user?.role || req.user?.user_role || req.user?.userRole || '').toLowerCase().trim();
}

function userIdOf(req) {
  return req.user?.id || req.user?.user_id || req.user?.sub || null;
}

function tenantIdOf(req) {
  return req.resolvedTenantId || req.user?.tenant_id || req.user?.tenantId || req.query?.tenant_id || req.body?.tenant_id || null;
}

function contextOf(req) {
  const tenantId = tenantIdOf(req);
  if (!tenantId) throw new GrcError('GRC_TENANT_REQUIRED', 'Se requiere contexto de empresa.', 400);
  return { tenantId, userId: userIdOf(req), role: roleOf(req), correlationId: req.requestId || null };
}

function route(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      return res.json({ ok: true, data, request_id: req.requestId || null });
    } catch (error) {
      observe('request', { tenantId: tenantIdOf(req), correlationId: req.requestId || null, status: 'failed', errorCode: error?.code || 'GRC_INTERNAL_ERROR' });
      if (error instanceof GrcError) {
        return res.status(error.status).json({
          ok: false, code: error.code, error: error.message,
          ...(error.details ? { details: error.details } : {}), request_id: req.requestId || null,
        });
      }
      console.error(JSON.stringify({
        event: 'GRC_PHASE1_ERROR', request_id: req.requestId || null,
        tenant_id: tenantIdOf(req), route: req.originalUrl,
        error_code: error?.code || 'GRC_INTERNAL_ERROR',
      }));
      return res.status(500).json({
        ok: false, code: 'GRC_INTERNAL_ERROR', error: 'No fue posible completar la operación GRC.',
        request_id: req.requestId || null,
      });
    }
  };
}

async function authorized(req, permission, operation) {
  const context = contextOf(req);
  await service.assertModuleEnabled(context.tenantId);
  await service.assertPermission({ userId: context.userId, role: context.role, permission });
  return operation(context);
}

router.get('/meta', route(async (req) => service.getMeta(contextOf(req))));
router.get('/summary', route(async (req) => authorized(req, 'readiness.read', ({ tenantId }) => service.getSummary(tenantId))));
router.get('/bootstrap/status', route(async (req) => authorized(req, 'workflow.manage', ({ tenantId }) => service.getBootstrapStatus(tenantId))));
router.post('/bootstrap', route(async (req) => authorized(req, 'workflow.manage', (context) => service.bootstrapTenant({
  ...context,
  confirmation: req.body?.confirmation,
  idempotencyKey: req.get('Idempotency-Key'),
}))));
router.post('/bootstrap/validate', route(async (req) => authorized(req, 'workflow.manage', (context) => service.validateBootstrap(context))));

router.get('/workflows', route(async (req) => authorized(req, 'workflow.read', ({ tenantId }) => service.listWorkflowDefinitions(tenantId, req.query))));
router.post('/workflows', route(async (req) => authorized(req, 'workflow.manage', (context) => service.createWorkflowDefinition({ ...context, body: req.body }))));
router.post('/workflows/validate', route(async (req) => authorized(req, 'workflow.manage', () => service.validateWorkflow(req.body))));
router.get('/workflows/:id', route(async (req) => authorized(req, 'workflow.read', ({ tenantId }) => service.getWorkflowDefinition(tenantId, req.params.id))));
router.put('/workflows/:id/draft', route(async (req) => authorized(req, 'workflow.manage', (context) => service.saveWorkflowDraft({ ...context, definitionId: req.params.id, body: req.body }))));
router.post('/workflows/:id/publish', route(async (req) => authorized(req, 'workflow.manage', (context) => service.publishWorkflow({ ...context, definitionId: req.params.id }))));
router.post('/workflows/:id/archive', route(async (req) => authorized(req, 'workflow.manage', (context) => service.archiveWorkflow({ ...context, definitionId: req.params.id }))));
router.post('/workflow-instances', route(async (req) => authorized(req, 'workflow.transition', (context) => service.startWorkflow({ ...context, body: req.body }))));
router.get('/workflow-instances/:id', route(async (req) => authorized(req, 'workflow.read', ({ tenantId }) => service.getWorkflowInstance(tenantId, req.params.id))));
router.post('/workflow-instances/:id/transitions', route(async (req) => authorized(req, 'workflow.transition', (context) => service.executeTransition({ ...context, instanceId: req.params.id, body: req.body }))));
router.post('/workflow-instances/:id/context', route(async (req) => authorized(req, 'workflow.transition', (context) => service.addWorkflowContext({ ...context, instanceId: req.params.id, body: req.body }))));
router.post('/approvals/:id/delegate', route(async (req) => authorized(req, 'workflow.transition', (context) => service.delegateApproval({ ...context, approvalId: req.params.id, body: req.body }))));

router.get('/evidence/requests', route(async (req) => authorized(req, 'evidence.request.read', ({ tenantId }) => service.listEvidenceRequests(tenantId, req.query))));
router.post('/evidence/requests', route(async (req) => authorized(req, 'evidence.request.manage', (context) => service.createEvidenceRequest({ ...context, body: req.body }))));
router.get('/evidence/requests/:id', route(async (req) => authorized(req, 'evidence.request.read', ({ tenantId }) => service.getEvidenceRequest(tenantId, req.params.id))));
router.post('/evidence/requests/:id/submissions', route(async (req) => authorized(req, 'evidence.request.manage', (context) => service.submitEvidence({ ...context, requestId: req.params.id, body: req.body }))));
router.post('/evidence/submissions/:id/versions', route(async (req) => authorized(req, 'evidence.request.manage', (context) => service.createEvidenceVersion({ ...context, submissionId: req.params.id, body: req.body }))));
router.post('/evidence/submissions/:id/review', route(async (req) => authorized(req, 'evidence.review', (context) => service.reviewEvidence({ ...context, submissionId: req.params.id, body: req.body }))));
router.post('/evidence/:id/quality', route(async (req) => authorized(req, 'evidence.review', (context) => service.calculateEvidenceQuality({ ...context, evidenceId: req.params.id, body: req.body }))));
router.post('/evidence/:id/links', route(async (req) => authorized(req, 'evidence.request.manage', (context) => service.linkEvidence({ ...context, evidenceId: req.params.id, body: req.body }))));

router.get('/readiness/latest', route(async (req) => authorized(req, 'readiness.read', ({ tenantId }) => service.getReadiness(tenantId))));
router.post('/readiness/snapshots', route(async (req) => authorized(req, 'readiness.generate', (context) => service.generateReadinessSnapshot(context))));
router.get('/frameworks', route(async (req) => authorized(req, 'framework.read', ({ tenantId }) => service.listFrameworks(tenantId))));
router.get('/framework-requirements', route(async (req) => authorized(req, 'framework.read', ({ tenantId }) => service.listFrameworkRequirements(tenantId, req.query.version_id || null))));
router.get('/mappings', route(async (req) => authorized(req, 'framework.read', ({ tenantId }) => service.listMappings(tenantId))));
router.post('/mappings', route(async (req) => authorized(req, 'framework.manage', (context) => service.createMapping({ ...context, body: req.body }))));
router.post('/mappings/:id/reviews', route(async (req) => authorized(req, 'framework.manage', (context) => service.reviewMapping({ ...context, mappingId: req.params.id, body: req.body }))));

router.get('/audits/workspace', route(async (req) => authorized(req, 'audit.plan.read', ({ tenantId }) => service.getAuditWorkspace(tenantId, req.query.audit_id || null))));
router.post('/audits/universe', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.createAuditUniverseEntity({ ...context, body: req.body }))));
router.post('/audits/annual-plans', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.createAuditPlan({ ...context, body: req.body }))));
router.get('/audits/:id/operations', route(async (req) => authorized(req, 'audit.plan.read', ({ tenantId }) => service.getAuditOperations(tenantId, req.params.id))));
router.post('/audits/:id/team', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.assignAuditTeamMember({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/conflicts', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.recordAuditConflict({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/conflicts/:id/resolve', route(async (req) => authorized(req, 'audit.review', (context) => service.resolveAuditConflict({ ...context, conflictId: req.params.id, body: req.body }))));
router.post('/audits/:id/programs', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.createAuditProgram({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/interviews', route(async (req) => authorized(req, 'audit.workpaper.manage', (context) => service.createAuditInterview({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/samples', route(async (req) => authorized(req, 'audit.workpaper.manage', (context) => service.createAuditSample({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/evidence-links', route(async (req) => authorized(req, 'audit.workpaper.manage', (context) => service.linkAuditEvidence({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/followups', route(async (req) => authorized(req, 'audit.plan.manage', (context) => service.createAuditFollowup({ ...context, auditId: req.params.id, body: req.body }))));
router.post('/audits/:id/close', route(async (req) => authorized(req, 'audit.review', (context) => service.closeAudit({ ...context, auditId: req.params.id }))));
router.post('/audits/workpapers', route(async (req) => authorized(req, 'audit.workpaper.manage', (context) => service.createWorkpaper({ ...context, body: req.body }))));
router.post('/audits/workpapers/:id/reviews', route(async (req) => authorized(req, 'audit.review', (context) => service.reviewWorkpaper({ ...context, workpaperId: req.params.id, body: req.body }))));
router.get('/audits/workpapers/:id/reviews', route(async (req) => authorized(req, 'audit.review', ({ tenantId }) => service.listWorkpaperReviews(tenantId, req.params.id))));
router.get('/audits/:id/close-readiness', route(async (req) => authorized(req, 'audit.review', ({ tenantId }) => service.getAuditCloseReadiness(tenantId, req.params.id))));

router.get('/observations', route(async (req) => authorized(req, 'observation.read', ({ tenantId }) => service.listObservations({ tenantId, filters: req.query || {} }))));
router.get('/observations/:id', route(async (req) => authorized(req, 'observation.read', ({ tenantId }) => service.getObservation({ tenantId, observationId: req.params.id }))));
router.post('/observations', route(async (req) => authorized(req, 'observation.manage', (context) => service.createObservation({ ...context, body: req.body || {} }))));
router.put('/observations/:id', route(async (req) => authorized(req, 'observation.manage', (context) => service.updateObservation({ ...context, observationId: req.params.id, body: req.body || {} }))));
router.post('/observations/:id/transitions', route(async (req) => authorized(req, 'observation.transition', (context) => service.transitionObservation({ ...context, observationId: req.params.id, body: req.body || {} }))));
router.post('/observations/:id/links', route(async (req) => authorized(req, 'observation.link', (context) => service.linkObservation({ ...context, observationId: req.params.id, body: req.body || {} }))));

router.post('/automation/jobs', route(async (req) => authorized(req, 'workflow.manage', (context) => service.enqueueAutomation({ ...context, body: req.body, requestId: req.requestId || null }))));
router.post('/scheduler/run', route(async (req) => authorized(req, 'grc.scheduler.run', (context) => service.runScheduler({ ...context, body: req.body }))));
router.get('/escalations/policies', route(async (req) => authorized(req, 'workflow.read', ({ tenantId }) => service.listEscalationPolicies(tenantId))));
router.post('/escalations/policies', route(async (req) => authorized(req, 'grc.escalation.manage', (context) => service.createEscalationPolicy({ ...context, body: req.body }))));
router.get('/runtime/:entityType/:id', route(async (req) => authorized(req, 'workflow.read', (context) => service.getRuntimeAdapter({ ...context, entityType: req.params.entityType, entityId: req.params.id }))));
router.post('/runtime/:entityType/:id/workflows', route(async (req) => authorized(req, 'workflow.transition', (context) => service.startRuntimeWorkflow({ ...context, entityType: req.params.entityType, entityId: req.params.id, body: req.body }))));
router.get('/observability', route(async (req) => authorized(req, 'workflow.read', () => ({ counters: service.observabilitySnapshot() }))));

async function sendExportError(req, res, error) {
  observe('export', { tenantId: tenantIdOf(req), correlationId: req.requestId || null, status: 'failed', errorCode: error?.code || 'GRC_EXPORT_INTERNAL_ERROR' });
  if (error instanceof GrcError) {
    return res.status(error.status).json({ ok: false, code: error.code, error: error.message, request_id: req.requestId || null });
  }
  console.error(JSON.stringify({ event: 'GRC_PHASE1_EXPORT_ERROR', request_id: req.requestId || null, tenant_id: tenantIdOf(req), error_code: error?.code || 'GRC_EXPORT_INTERNAL_ERROR' }));
  return res.status(500).json({ ok: false, code: 'GRC_EXPORT_INTERNAL_ERROR', error: 'No fue posible generar la exportación.', request_id: req.requestId || null });
}

router.post('/exports/:domain', async (req, res) => {
  try {
    const result = await authorized(req, 'grc.export.generate', (context) => service.generateExport({
      ...context,
      domain: req.params.domain,
      format: String(req.body?.format || 'csv').toLowerCase(),
      filters: req.body?.filters || {},
    }));
    res.setHeader('Content-Type', result.record.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(result.record.file_name).replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-TCDX-Export-Id', result.record.id);
    res.setHeader('X-TCDX-Content-Hash', result.record.content_hash);
    return res.send(result.buffer);
  } catch (error) {
    return sendExportError(req, res, error);
  }
});

router.get('/exports/:id/download', async (req, res) => {
  try {
    const record = await authorized(req, 'grc.export.generate', ({ tenantId }) => service.getExport(tenantId, req.params.id));
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(record.file_name).replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-TCDX-Content-Hash', record.content_hash);
    return res.send(record.file_content);
  } catch (error) {
    return sendExportError(req, res, error);
  }
});

module.exports = router;
