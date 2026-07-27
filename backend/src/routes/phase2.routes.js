const express = require('express');
const pool = require('../config/db');
const { Phase2Error, createPhase2Service } = require('../services/grc/phase2.service');

const router = express.Router();
const service = createPhase2Service(pool);
const REPORT_READ_PERMISSIONS = Object.freeze({
  privacy_inventory: 'privacy.read',
  privacy_risk: 'privacy.read',
  dpia_status: 'privacy.read',
  privacy_requests: 'privacy.read',
  incidents: 'incidents.read',
  postmortem: 'incidents.read',
  suppliers: 'suppliers.read',
  supplier_assessments: 'suppliers.read',
  supplier_evidence: 'suppliers.read',
  connectors_health: 'connectors.read',
});

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
  return req.resolvedTenantId || req.user?.tenant_id || req.user?.tenantId || null;
}

function contextOf(req) {
  const tenantId = tenantIdOf(req);
  if (!tenantId) throw new Phase2Error('PHASE2_TENANT_REQUIRED', 'Se requiere contexto de empresa.', 400);
  return {
    tenantId,
    userId: userIdOf(req),
    role: roleOf(req),
    correlationId: req.requestId || null,
  };
}

function route(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      return res.json({ ok: true, data, request_id: req.requestId || null });
    } catch (error) {
      if (error instanceof Phase2Error) {
        res.locals.errorCode = error.code;
        return res.status(error.status).json({
          ok: false,
          code: error.code,
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
          request_id: req.requestId || null,
        });
      }
      console.error(JSON.stringify({
        event: 'GRC_PHASE2_ERROR',
        request_id: req.requestId || null,
        tenant_id: tenantIdOf(req),
        route: req.originalUrl,
        error_code: error?.code || 'GRC_PHASE2_INTERNAL_ERROR',
      }));
      res.locals.errorCode = error?.code || 'GRC_PHASE2_INTERNAL_ERROR';
      return res.status(500).json({
        ok: false,
        code: 'GRC_PHASE2_INTERNAL_ERROR',
        error: 'No fue posible completar la operación de Fase 2.',
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

async function authorizedAll(req, permissions, operation) {
  const context = contextOf(req);
  await service.assertModuleEnabled(context.tenantId);
  for (const permission of permissions) {
    await service.assertPermission({ userId: context.userId, role: context.role, permission });
  }
  return operation(context);
}

router.get('/meta', route(async req => {
  const context = contextOf(req);
  return service.getMeta(context);
}));

router.post('/relations', route(req => authorized(req, 'privacy.manage', context => service.createRelation({
  ...context,
  body: req.body,
}))));

router.get('/privacy/overview', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.privacyOverview(tenantId))));
router.get('/privacy/processing-activities', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.listProcessingActivities(tenantId, req.query))));
router.post('/privacy/processing-activities', route(req => authorized(req, 'privacy.manage', context => service.createProcessingActivity({ ...context, body: req.body }))));
router.patch('/privacy/processing-activities/:id', route(req => authorized(req, 'privacy.manage', context => service.updateProcessingActivity({ ...context, id: req.params.id, body: req.body }))));
router.get('/privacy/processing-activities/:id', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.getProcessing360(tenantId, req.params.id))));
router.post('/privacy/processing-activities/:id/transitions', route(req => authorized(req, req.body?.to_status === 'approved' ? 'privacy.approve' : 'privacy.manage', context => service.transitionProcessing({ ...context, id: req.params.id, body: req.body }))));
router.post('/privacy/processing-activities/:id/processors', route(req => authorized(req, 'privacy.manage', context => service.addProcessingProcessor({ ...context, id: req.params.id, body: req.body }))));
router.post('/privacy/processing-activities/:id/dpias', route(req => authorized(req, 'privacy.dpia.manage', context => service.createDpia({ ...context, id: req.params.id, body: req.body }))));
router.get('/privacy/dpias', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.listDpias(tenantId, req.query))));
router.post('/privacy/dpias/:id/transitions', route(req => authorized(req, req.body?.to_status === 'approved' ? 'privacy.approve' : 'privacy.dpia.manage', context => service.transitionDpia({ ...context, id: req.params.id, body: req.body }))));
router.post('/privacy/dpias/:id/risks', route(req => authorized(req, 'privacy.dpia.manage', context => service.addDpiaRisk({ ...context, id: req.params.id, body: req.body }))));
router.post('/privacy/consents', route(req => authorized(req, 'privacy.manage', context => service.createConsent({ ...context, body: req.body }))));
router.get('/privacy/requests', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.listPrivacyRequests(tenantId, req.query))));
router.post('/privacy/requests', route(req => authorized(req, 'privacy.requests.manage', context => service.createPrivacyRequest({ ...context, body: req.body }))));
router.post('/privacy/requests/:id/transitions', route(req => authorized(req, 'privacy.requests.manage', context => service.transitionPrivacyRequest({ ...context, id: req.params.id, body: req.body }))));
router.get('/privacy/breaches', route(req => authorized(req, 'privacy.read', ({ tenantId }) => service.listPrivacyBreaches(tenantId, req.query))));
router.post('/privacy/breaches', route(req => authorized(req, 'privacy.breaches.manage', context => service.createPrivacyBreach({ ...context, body: req.body }))));
router.post('/privacy/breaches/:id/transitions', route(req => authorized(req, 'privacy.breaches.manage', context => service.transitionPrivacyBreach({ ...context, id: req.params.id, body: req.body }))));

router.get('/incidents/dashboard', route(req => authorized(req, 'incidents.read', ({ tenantId }) => service.incidentDashboard(tenantId))));
router.get('/incidents/workspace', route(req => authorized(req, 'incidents.read', ({ tenantId }) => service.incidentWorkspace(tenantId, req.query))));
router.get('/incidents', route(req => authorized(req, 'incidents.read', ({ tenantId }) => service.listIncidents(tenantId, req.query))));
router.post('/incidents', route(req => authorized(req, 'incidents.manage', context => service.createIncident({ ...context, body: req.body }))));
router.get('/incidents/:id', route(req => authorized(req, 'incidents.read', ({ tenantId }) => service.getIncident360(tenantId, req.params.id))));
router.post('/incidents/:id/transitions', route(req => authorized(req, req.body?.to_status === 'closed' ? 'incidents.close' : 'incidents.command', context => service.transitionIncident({ ...context, id: req.params.id, body: req.body }))));
router.post('/incidents/:id/timeline', route(req => authorized(req, 'incidents.command', context => service.addIncidentTimeline({ ...context, id: req.params.id, body: req.body }))));
router.post('/incidents/:id/impacts', route(req => authorized(req, 'incidents.command', context => service.addIncidentImpact({ ...context, id: req.params.id, body: req.body }))));
router.post('/incidents/:id/notifications', route(req => authorized(req, 'incidents.notifications.manage', context => service.addIncidentNotification({ ...context, id: req.params.id, body: req.body }))));
router.post('/incidents/:id/root-causes', route(req => authorized(req, 'incidents.command', context => service.addIncidentRootCause({ ...context, id: req.params.id, body: req.body }))));
router.put('/incidents/:id/postmortem', route(req => authorized(req, 'incidents.command', context => service.upsertPostmortem({ ...context, id: req.params.id, body: req.body }))));
router.post('/incidents/:id/effectiveness', route(req => authorized(req, 'incidents.close', context => service.verifyIncidentEffectiveness({ ...context, id: req.params.id, body: req.body }))));

router.get('/suppliers/portfolio', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.supplierPortfolio(tenantId))));
router.get('/suppliers/workspace', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.supplierWorkspace(tenantId, req.query))));
router.get('/suppliers', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.listSuppliers(tenantId, req.query))));
router.post('/suppliers', route(req => authorized(req, 'suppliers.manage', context => service.createSupplier({ ...context, body: req.body }))));
router.get('/suppliers/:id', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.getSupplier360(tenantId, req.params.id))));
router.post('/suppliers/:id/transitions', route(req => authorized(req, ['approved', 'active'].includes(req.body?.to_status) ? 'suppliers.approve' : 'suppliers.manage', context => service.transitionSupplier({ ...context, id: req.params.id, body: req.body }))));
router.post('/suppliers/:id/services', route(req => authorized(req, 'suppliers.manage', context => service.addSupplierService({ ...context, id: req.params.id, body: req.body }))));
router.post('/suppliers/:id/contracts', route(req => authorized(req, 'suppliers.manage', context => service.addSupplierContract({ ...context, id: req.params.id, body: req.body }))));
router.put('/suppliers/:id/exit-checks', route(req => authorized(req, 'suppliers.manage', context => service.upsertExitCheck({ ...context, id: req.params.id, body: req.body }))));
router.get('/questionnaires', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.listQuestionnaires(tenantId))));
router.post('/questionnaires', route(req => authorized(req, 'suppliers.assess', context => service.createQuestionnaireTemplate({ ...context, body: req.body }))));
router.get('/assessments', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.listAssessments(tenantId, req.query))));
router.get('/assessments/:id', route(req => authorized(req, 'suppliers.read', ({ tenantId }) => service.getAssessment(tenantId, req.params.id))));
router.post('/suppliers/:id/assessments', route(req => authorized(req, 'suppliers.assess', context => service.createSupplierAssessment({ ...context, id: req.params.id, body: req.body }))));
router.put('/assessments/:id/answers', route(req => authorized(req, 'suppliers.assess', ({ tenantId }) => service.saveSupplierAnswer({ tenantId, assessmentId: req.params.id, body: req.body }))));
router.post('/assessments/:id/transitions', route(req => authorized(req, req.body?.to_status === 'approved' ? 'suppliers.approve' : 'suppliers.assess', context => service.transitionAssessment({ ...context, id: req.params.id, body: req.body }))));
router.post('/assessments/:id/portal-invitations', route(req => authorized(req, 'suppliers.portal.manage', context => service.createPortalInvitation({ ...context, assessmentId: req.params.id, body: req.body }))));

router.get('/connectors/catalog', route(req => authorized(req, 'connectors.read', () => service.connectorCatalog())));
router.get('/connectors/health', route(req => authorized(req, 'connectors.read', ({ tenantId }) => service.integrationHealth(tenantId))));
router.get('/connectors/runs', route(req => authorized(req, 'connectors.logs.read', ({ tenantId }) => service.listConnectorRuns(tenantId, req.query))));
router.get('/connectors', route(req => authorized(req, 'connectors.read', ({ tenantId }) => service.listConnectors(tenantId))));
router.post('/connectors', route(req => authorized(req, Object.keys(req.body?.credentials || {}).length ? 'connectors.credentials.manage' : 'connectors.manage', context => service.createConnector({ ...context, body: req.body }))));
router.get('/connectors/:id', route(req => authorized(req, 'connectors.read', ({ tenantId }) => service.connector360(tenantId, req.params.id))));
router.put('/connectors/:id', route(req => authorized(req, Object.keys(req.body?.credentials || {}).length ? 'connectors.credentials.manage' : 'connectors.manage', context => service.updateConnector({ ...context, id: req.params.id, body: req.body }))));
router.post('/connectors/:id/oauth/start', route(req => authorized(req, 'connectors.credentials.manage', context => service.prepareConnectorOAuth({ ...context, id: req.params.id }))));
router.post('/connectors/:id/sync', route(req => authorized(req, 'connectors.sync.run', context => service.runConnector({
  ...context,
  id: req.params.id,
  idempotencyKey: req.get('Idempotency-Key'),
}))));
router.post('/connectors/:id/retry', route(req => authorized(req, 'connectors.sync.run', context => service.runConnector({
  ...context,
  id: req.params.id,
  runType: 'retry',
  idempotencyKey: req.get('Idempotency-Key'),
}))));

router.post('/reports/:domain', async (req, res) => {
  try {
    const domainPermission = REPORT_READ_PERMISSIONS[req.params.domain];
    const required = domainPermission
      ? ['grc.phase2.export', domainPermission]
      : ['grc.phase2.export', 'privacy.read', 'incidents.read', 'suppliers.read', 'connectors.read'];
    const result = await authorizedAll(req, required, context => service.generateReport({
      ...context,
      domain: req.params.domain,
      filters: req.body?.filters || {},
    }));
    res.setHeader('Content-Type', result.record.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(result.record.file_name).replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-TCDX-Export-Id', result.record.id);
    res.setHeader('X-TCDX-Content-Hash', result.record.content_hash);
    return res.send(result.buffer);
  } catch (error) {
    if (error instanceof Phase2Error) {
      return res.status(error.status).json({ ok: false, code: error.code, error: error.message, request_id: req.requestId || null });
    }
    return res.status(500).json({ ok: false, code: 'PHASE2_EXPORT_INTERNAL_ERROR', error: 'No fue posible generar el reporte.', request_id: req.requestId || null });
  }
});

router.get('/reports/exports/:id', async (req, res) => {
  try {
    const record = await authorized(req, 'grc.phase2.export', async context => {
      const stored = await service.getPhase2Export(context.tenantId, req.params.id);
      const domainPermission = REPORT_READ_PERMISSIONS[stored.domain];
      const required = domainPermission
        ? [domainPermission]
        : ['privacy.read', 'incidents.read', 'suppliers.read', 'connectors.read'];
      for (const permission of required) {
        await service.assertPermission({ userId: context.userId, role: context.role, permission });
      }
      return stored;
    });
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(record.file_name).replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-TCDX-Content-Hash', record.content_hash);
    return res.send(record.file_content);
  } catch (error) {
    if (error instanceof Phase2Error) {
      return res.status(error.status).json({ ok: false, code: error.code, error: error.message, request_id: req.requestId || null });
    }
    return res.status(500).json({ ok: false, code: 'PHASE2_EXPORT_INTERNAL_ERROR', error: 'No fue posible descargar el reporte.', request_id: req.requestId || null });
  }
});

router.get('/executive', route(req => authorizedAll(
  req,
  ['privacy.read', 'incidents.read', 'suppliers.read', 'connectors.read'],
  ({ tenantId }) => service.executiveGlobalView(tenantId)
)));

module.exports = router;
