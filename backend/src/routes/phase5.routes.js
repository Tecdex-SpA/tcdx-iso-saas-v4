'use strict';

const express = require('express');
const service = require('../services/phase5/phase5.service');
const { requireCommercialCapability } = require('../middleware/commercialEntitlement.middleware');

function scope(req) {
  return { tenant_id: req.tenantId || req.user?.tenant_id || req.user?.tenantId, user: req.user };
}

function send(res, data, req) {
  return res.json({ ok: true, data, request_id: req.requestId || null });
}

function handleError(req, res, error) {
  const status = Number(error?.status || 500);
  res.locals = res.locals || {};
  res.locals.errorCode = error?.code || 'PHASE5_ERROR';
  console.error(JSON.stringify({
    event: 'PHASE5_ERROR',
    request_id: req.requestId || null,
    tenant_id: req.tenantId || req.user?.tenant_id || null,
    route: `${req.method} ${req.baseUrl}${req.route?.path || req.path}`,
    status,
    code: error?.code || 'PHASE5_ERROR',
    message: service.sanitizeError(error),
  }));
  return res.status(status).json({
    ok: false,
    code: error?.code || 'PHASE5_ERROR',
    error: status >= 500 ? 'Error procesando Fase 5.' : error.message,
    details: status >= 500 ? undefined : error.details,
    request_id: req.requestId || null,
  });
}

function route(handler) {
  return async (req, res) => {
    try {
      return send(res, await handler(req), req);
    } catch (error) {
      return handleError(req, res, error);
    }
  };
}

const dataRouter = express.Router();
dataRouter.use(requireCommercialCapability('data.governance'));
dataRouter.get('/domains', route((req) => service.listDataDomains(scope(req), req.query)));
dataRouter.post('/domains', route((req) => service.createDataDomain(scope(req), req.body, req.requestId)));
dataRouter.get('/elements', route((req) => service.listDataElements(scope(req), req.query)));
dataRouter.post('/elements', route((req) => service.createDataElement(scope(req), req.body, req.requestId)));
dataRouter.get('/elements/:id', route((req) => service.getDataElement(scope(req), req.params.id)));
dataRouter.put('/elements/:id', route((req) => service.updateDataElement(scope(req), req.params.id, req.body, req.requestId)));
dataRouter.get('/quality', requireCommercialCapability('metrics.data_trust'), route((req) => service.listDataQuality(scope(req), req.query)));
dataRouter.post('/quality/assess', requireCommercialCapability('metrics.data_trust'), route((req) => service.assessDataQuality(scope(req), req.body, req.requestId)));
dataRouter.get('/lineage/:entityType/:entityId', requireCommercialCapability('data.lineage'), route((req) => service.graph(scope(req), req.params.entityType, req.params.entityId, 'lineage')));
dataRouter.get('/impact/:entityType/:entityId', requireCommercialCapability('data.impact_graph'), route((req) => service.graph(scope(req), req.params.entityType, req.params.entityId, 'impact')));

const metricsRouter = express.Router();
metricsRouter.use(requireCommercialCapability('metrics.catalog'));
metricsRouter.get('/', route((req) => service.listMetrics(scope(req), req.query)));
metricsRouter.post('/', route((req) => service.createMetric(scope(req), req.body, req.requestId)));
metricsRouter.get('/:id', route((req) => service.getMetric(scope(req), req.params.id)));
metricsRouter.put('/:id', route((req) => service.updateMetric(scope(req), req.params.id, req.body, req.requestId)));
metricsRouter.post('/:id/formulas', route((req) => service.addFormula(scope(req), req.params.id, req.body, req.requestId)));
metricsRouter.post('/:id/publish', route((req) => service.publishMetric(scope(req), req.params.id, req.requestId)));
metricsRouter.get('/:id/measurements', route((req) => service.listMeasurements(scope(req), req.params.id, req.query)));
metricsRouter.post('/:id/measurements', requireCommercialCapability('metrics.engine'), route((req) => service.recordMeasurement(scope(req), req.params.id, req.body, req.requestId)));
metricsRouter.post('/:id/calculate', requireCommercialCapability('metrics.engine'), route((req) => service.calculateMetric(scope(req), req.params.id, req.body, req.requestId)));
metricsRouter.post('/:id/recalculate', requireCommercialCapability('metrics.engine'), route((req) => service.calculateMetric(scope(req), req.params.id, { ...req.body, recalculate: true }, req.requestId)));
metricsRouter.post('/measurements/:measurementId/validate', route((req) => service.validateMeasurement(scope(req), req.params.measurementId, req.body, req.requestId)));
metricsRouter.get('/:id/trend', route((req) => service.metricTrend(scope(req), req.params.id)));
metricsRouter.get('/:id/trust', requireCommercialCapability('metrics.data_trust'), route((req) => service.metricTrust(scope(req), req.params.id)));

const surveysRouter = express.Router();
surveysRouter.use(requireCommercialCapability('surveys.engine'));
surveysRouter.get('/', route((req) => service.listSurveys(scope(req), req.query)));
surveysRouter.post('/', route((req) => service.createSurvey(scope(req), req.body, req.requestId)));
surveysRouter.get('/:id', route((req) => service.getSurvey(scope(req), req.params.id)));
surveysRouter.put('/:id', route((req) => service.createSurvey(scope(req), { ...req.body, id: req.params.id }, req.requestId)));
surveysRouter.post('/:id/versions', route((req) => service.createSurveyVersion(scope(req), req.params.id, req.body, req.requestId)));
surveysRouter.post('/:id/publish', route((req) => service.publishSurvey(scope(req), req.params.id, req.requestId)));

const surveyCampaignsRouter = express.Router();
surveyCampaignsRouter.use(requireCommercialCapability('surveys.engine'));
surveyCampaignsRouter.post('/', route((req) => service.createCampaign(scope(req), req.body, req.requestId)));
surveyCampaignsRouter.get('/', route((req) => service.listCampaigns(scope(req), req.query)));
surveyCampaignsRouter.get('/:id', route((req) => service.getCampaign(scope(req), req.params.id)));
surveyCampaignsRouter.post('/:id/launch', route((req) => service.transitionCampaign(scope(req), req.params.id, 'active', req.requestId)));
surveyCampaignsRouter.post('/:id/close', route((req) => service.transitionCampaign(scope(req), req.params.id, 'closed', req.requestId)));

const surveyResponsesRouter = express.Router();
surveyResponsesRouter.use(requireCommercialCapability('surveys.engine'));
surveyResponsesRouter.post('/', route((req) => service.submitResponse(scope(req), req.body, req.requestId)));
surveyResponsesRouter.post('/:id/submit', route((req) => service.submitResponse(scope(req), { ...req.body, response_id: req.params.id, submit: true }, req.requestId)));
surveyResponsesRouter.post('/:id/evaluate', route((req) => service.evaluateResponse(scope(req), req.params.id, req.body, req.requestId)));
surveyResponsesRouter.post('/:id/approve', route((req) => service.approveResponse(scope(req), req.params.id, req.body, req.requestId)));

const assuranceTestsRouter = express.Router();
assuranceTestsRouter.use(requireCommercialCapability('assurance.testing'));
assuranceTestsRouter.get('/', route((req) => service.listAssuranceTests(scope(req), req.query)));
assuranceTestsRouter.post('/', route((req) => service.createAssuranceTest(scope(req), req.body, req.requestId)));
assuranceTestsRouter.post('/:id/execute', route((req) => service.executeAssuranceTest(scope(req), req.params.id, req.body, req.requestId)));
assuranceTestsRouter.post('/executions/:executionId/complete', route((req) => service.completeAssuranceExecution(scope(req), req.params.executionId, req.body, req.requestId)));
assuranceTestsRouter.post('/executions/:executionId/review', route((req) => service.reviewAssuranceExecution(scope(req), req.params.executionId, req.body, req.requestId)));

const lossEventsRouter = express.Router();
lossEventsRouter.use(requireCommercialCapability('loss.events'));
lossEventsRouter.get('/', route((req) => service.listLossEvents(scope(req), req.query)));
lossEventsRouter.post('/', route((req) => service.createLossEvent(scope(req), req.body, req.requestId)));
lossEventsRouter.get('/:id', route((req) => service.getLossEvent(scope(req), req.params.id)));
lossEventsRouter.put('/:id', route((req) => service.updateLossEvent(scope(req), req.params.id, req.body, req.requestId)));
lossEventsRouter.post('/:id/confirm', route((req) => service.transitionLossEvent(scope(req), req.params.id, 'confirmed', req.requestId)));
lossEventsRouter.post('/:id/recoveries', route((req) => service.addLossRecovery(scope(req), req.params.id, req.body, req.requestId)));
lossEventsRouter.post('/:id/close', route((req) => service.transitionLossEvent(scope(req), req.params.id, 'closed', req.requestId)));

const dashboardsRouter = express.Router();
dashboardsRouter.use(requireCommercialCapability('bi.executive_dashboards'));
dashboardsRouter.get('/', route((req) => service.listDashboards(scope(req), req.query)));
dashboardsRouter.post('/', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.createDashboard(scope(req), req.body, req.requestId)));
dashboardsRouter.get('/:id', route((req) => service.getDashboard(scope(req), req.params.id)));
dashboardsRouter.put('/:id', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.createDashboard(scope(req), req.body, req.requestId)));
dashboardsRouter.post('/:id/publish', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.publishDashboard(scope(req), req.params.id, req.requestId)));
dashboardsRouter.post('/:id/snapshot', route((req) => service.snapshotDashboard(scope(req), req.params.id, req.requestId)));
dashboardsRouter.get('/:id/render', route((req) => service.renderDashboard(scope(req), req.params.id)));

const reportsRouter = express.Router();
reportsRouter.use(requireCommercialCapability('reporting.studio'));
reportsRouter.get('/', route((req) => service.listReports(scope(req), req.query)));
reportsRouter.post('/', route((req) => service.createReport(scope(req), req.body, req.requestId)));
reportsRouter.get('/:id', route((req) => service.getReport(scope(req), req.params.id)));
reportsRouter.put('/:id', route((req) => service.createReport(scope(req), req.body, req.requestId)));
reportsRouter.post('/:id/generate', route((req) => service.generateReport(scope(req), req.params.id, req.body, req.requestId)));

const reportGenerationsRouter = express.Router();
reportGenerationsRouter.use(requireCommercialCapability('reporting.studio'));
reportGenerationsRouter.get('/', route((req) => service.listReportGenerations(scope(req), req.query)));
reportGenerationsRouter.get('/:id', route((req) => service.getReportGeneration(scope(req), req.params.id)));
reportGenerationsRouter.get('/:id/download', requireCommercialCapability('reporting.pdf'), async (req, res) => {
  try {
    const artifact = await service.downloadArtifact(scope(req), req.params.id);
    res.setHeader('Content-Type', artifact.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.file_name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(artifact.buffer);
  } catch (error) {
    return handleError(req, res, error);
  }
});
reportGenerationsRouter.post('/:id/approve', route((req) => service.approveReportGeneration(scope(req), req.params.id, req.body, req.requestId)));

const reportSchedulesRouter = express.Router();
reportSchedulesRouter.use(requireCommercialCapability('reporting.scheduled'));
reportSchedulesRouter.post('/', route((req) => service.createReportSchedule(scope(req), req.body, req.requestId)));
reportSchedulesRouter.put('/:id', route((req) => service.updateReportSchedule(scope(req), req.params.id, req.body, req.requestId)));
reportSchedulesRouter.post('/:id/pause', route((req) => service.updateReportSchedule(scope(req), req.params.id, { status: 'paused' }, req.requestId)));
reportSchedulesRouter.post('/:id/resume', route((req) => service.updateReportSchedule(scope(req), req.params.id, { status: 'active' }, req.requestId)));

module.exports = {
  dataRouter,
  metricsRouter,
  surveysRouter,
  surveyCampaignsRouter,
  surveyResponsesRouter,
  assuranceTestsRouter,
  lossEventsRouter,
  dashboardsRouter,
  reportsRouter,
  reportGenerationsRouter,
  reportSchedulesRouter,
};
