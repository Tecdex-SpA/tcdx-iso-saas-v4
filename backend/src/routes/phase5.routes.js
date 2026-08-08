'use strict';

const express = require('express');
const service = require('../services/phase5/phase5.service');
const semanticService = require('../services/semantic/semanticLayer.service');
const indicatorService = require('../services/indicators/indicatorGovernance.service');
const officialCalculationOrchestrator = require('../services/math-governance/officialCalculationOrchestrator.service');
const { requireCommercialCapability } = require('../middleware/commercialEntitlement.middleware');
const { resolveEffectiveTenant } = require('../utils/effectiveTenant');

function scope(req) {
  return {
    tenant_id: req.resolvedTenantId || req.tenantId || req.user?.tenant_id,
    user: req.user,
  };
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
    error: status >= 500 ? 'Error procesando información GRC.' : error.message,
    details: status >= 500 ? undefined : error.details,
    request_id: req.requestId || null,
  });
}

async function requireTenant(req, res, next) {
  try {
    await resolveEffectiveTenant(req, { required: true });
    return next();
  } catch (error) {
    return res.status(error.status || 403).json({
      ok: false,
      code: error.code || 'TENANT_REQUIRED',
      error: error.message || 'Se requiere contexto de empresa.',
      details: error.details || undefined,
      request_id: req.requestId || null,
    });
  }
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
dataRouter.use(requireTenant);
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

const semanticRouter = express.Router();
semanticRouter.use(requireCommercialCapability('data.semantic_layer'));
const semanticPermission = (permission, mode) => requireCommercialCapability('data.semantic_layer', { requiredPermission: permission, mode });
semanticRouter.get('/source-contracts', semanticPermission('semantic.contracts.read', 'read'), route((req) => semanticService.listContracts(scope(req), req.query)));
semanticRouter.get('/reconciliation', semanticPermission('semantic.contracts.read', 'read'), route((req) => semanticService.reconcileLegacyContracts(scope(req))));
semanticRouter.post('/source-contracts', semanticPermission('semantic.contracts.manage', 'write'), route((req) => semanticService.createContract(scope(req), req.body, req.requestId)));
semanticRouter.get('/source-contracts/:id', semanticPermission('semantic.contracts.read', 'read'), route((req) => semanticService.getContract(scope(req), req.params.id)));
semanticRouter.patch('/source-contracts/:id', semanticPermission('semantic.contracts.manage', 'write'), route((req) => semanticService.updateContract(scope(req), req.params.id, req.body, req.requestId)));
semanticRouter.post('/source-contracts/:id/versions', semanticPermission('semantic.contracts.manage', 'write'), route((req) => semanticService.createVersion(scope(req), req.params.id, req.body, req.requestId)));
semanticRouter.get('/versions/:versionId', semanticPermission('semantic.contracts.read', 'read'), route((req) => semanticService.getVersion(scope(req), req.params.versionId)));
semanticRouter.patch('/versions/:versionId', semanticPermission('semantic.contracts.manage', 'write'), route((req) => semanticService.updateVersion(scope(req), req.params.versionId, req.body, req.requestId)));
semanticRouter.post('/versions/:versionId/review', semanticPermission('semantic.contracts.review', 'write'), route((req) => semanticService.transitionVersion(scope(req), req.params.versionId, 'reviewed', req.requestId)));
semanticRouter.post('/versions/:versionId/approve', semanticPermission('semantic.contracts.review', 'write'), route((req) => semanticService.transitionVersion(scope(req), req.params.versionId, 'approved', req.requestId)));
semanticRouter.post('/versions/:versionId/publish', semanticPermission('semantic.contracts.publish', 'write'), route((req) => semanticService.transitionVersion(scope(req), req.params.versionId, 'published', req.requestId)));
semanticRouter.post('/versions/:versionId/preview', semanticPermission('semantic.mappings.validate', 'write'), route((req) => semanticService.previewVersion(scope(req), req.params.versionId, req.body)));
semanticRouter.get('/versions/:versionId/mappings', semanticPermission('semantic.mappings.read', 'read'), route((req) => semanticService.listMappings(scope(req), req.params.versionId)));
semanticRouter.post('/versions/:versionId/mappings', semanticPermission('semantic.mappings.manage', 'write'), route((req) => semanticService.upsertMapping(scope(req), req.params.versionId, req.body, req.requestId)));
semanticRouter.patch('/mappings/:mappingId', semanticPermission('semantic.mappings.manage', 'write'), route((req) => semanticService.updateMapping(scope(req), req.params.mappingId, req.body, req.requestId)));
semanticRouter.post('/mappings/:mappingId/validate', semanticPermission('semantic.mappings.validate', 'write'), route((req) => semanticService.validateMapping(scope(req), req.params.mappingId)));
semanticRouter.get('/versions/:versionId/assessment', semanticPermission('semantic.contracts.read', 'read'), route((req) => semanticService.versionAssessment(scope(req), req.params.versionId, req.query)));
semanticRouter.post('/versions/:versionId/ingest', semanticPermission('semantic.observations.ingest', 'write'), route((req) => semanticService.ingestVersion(scope(req), req.params.versionId, req.body, req.requestId)));
semanticRouter.get('/observations', semanticPermission('semantic.observations.read', 'read'), route((req) => semanticService.listObservations(scope(req), req.query)));
semanticRouter.get('/observations/:observationId', semanticPermission('semantic.observations.read', 'read'), route((req) => semanticService.getObservation(scope(req), req.params.observationId)));
semanticRouter.get('/observations/:observationId/lineage', semanticPermission('semantic.lineage.read', 'read'), route((req) => semanticService.observationLineage(scope(req), req.params.observationId)));
semanticRouter.get('/observations/:observationId/quality', semanticPermission('semantic.observations.read', 'read'), route((req) => semanticService.observationAssessment(scope(req), req.params.observationId)));
semanticRouter.post('/observations/:observationId/relations', semanticPermission('semantic.observations.ingest', 'write'), route((req) => semanticService.createObservationRelation(scope(req), req.params.observationId, req.body, req.requestId)));
semanticRouter.get('/sufficiency-rules', semanticPermission('semantic.sufficiency.read', 'read'), route((req) => semanticService.listSufficiencyRules(scope(req), req.query)));
semanticRouter.post('/sufficiency-rules', semanticPermission('semantic.sufficiency.manage', 'write'), route((req) => semanticService.createSufficiencyRule(scope(req), req.body, req.requestId)));
semanticRouter.get('/sufficiency-rules/:ruleId', semanticPermission('semantic.sufficiency.read', 'read'), route((req) => semanticService.getSufficiencyRule(scope(req), req.params.ruleId)));
semanticRouter.post('/sufficiency-rules/:ruleId/review', semanticPermission('semantic.sufficiency.manage', 'write'), route((req) => semanticService.transitionSufficiencyRule(scope(req), req.params.ruleId, 'reviewed', req.requestId)));
semanticRouter.post('/sufficiency-rules/:ruleId/approve', semanticPermission('semantic.sufficiency.manage', 'write'), route((req) => semanticService.transitionSufficiencyRule(scope(req), req.params.ruleId, 'approved', req.requestId)));
semanticRouter.post('/sufficiency-rules/:ruleId/publish', semanticPermission('semantic.sufficiency.publish', 'write'), route((req) => semanticService.publishSufficiencyRule(scope(req), req.params.ruleId, req.requestId)));
semanticRouter.get('/jobs', semanticPermission('semantic.observations.read', 'read'), route((req) => semanticService.listJobs(scope(req), req.query)));
semanticRouter.post('/jobs/:jobType', semanticPermission('semantic.observations.ingest', 'write'), route((req) => semanticService.runJob(scope(req), req.params.jobType, req.body, req.requestId)));
semanticRouter.post('/jobs/id/:jobId/execute', semanticPermission('semantic.observations.ingest', 'write'), route((req) => semanticService.executeJob(scope(req), req.params.jobId)));
dataRouter.use('/semantic', semanticRouter);

const metricsRouter = express.Router();
metricsRouter.use(requireTenant);
metricsRouter.use(requireCommercialCapability('metrics.catalog'));
const indicatorPermission = (capability, permission, mode) => requireCommercialCapability(capability, { requiredPermission: permission, mode });
metricsRouter.get('/official/catalog', indicatorPermission('metrics.indicators.read', 'metrics.read', 'read'), route((req) => indicatorService.listCatalog(scope(req), req.query)));
metricsRouter.get('/official/export', indicatorPermission('metrics.indicators.read', 'metrics.read', 'read'), route((req) => indicatorService.exportCatalog(scope(req), req.query, req.requestId)));
metricsRouter.get('/official/dashboard', indicatorPermission('metrics.indicators.read', 'metrics.read', 'read'), route((req) => indicatorService.dashboard(scope(req))));
metricsRouter.post('/official/dashboard/recalculate', indicatorPermission('metrics.jobs.run', 'metrics.recalculate', 'write'), route((req) => indicatorService.recalculateCatalog(scope(req), req.body, req.requestId)));
metricsRouter.get('/official/jobs', indicatorPermission('metrics.jobs.run', 'metrics.recalculate', 'read'), route((req) => indicatorService.listJobs(scope(req), req.query)));
metricsRouter.post('/official/jobs/:jobType', indicatorPermission('metrics.jobs.run', 'metrics.recalculate', 'write'), route((req) => indicatorService.createJob(scope(req), req.params.jobType, req.body, req.requestId)));
metricsRouter.post('/official/jobs/id/:jobId/execute', indicatorPermission('metrics.jobs.run', 'metrics.recalculate', 'write'), route((req) => indicatorService.executeJob(scope(req), req.params.jobId)));
metricsRouter.post('/official/snapshots/:snapshotId/publish', indicatorPermission('metrics.snapshots.publish', 'metrics.publish', 'write'), route((req) => indicatorService.publishSnapshot(scope(req), req.params.snapshotId, req.requestId)));
metricsRouter.post('/official/snapshots/:snapshotId/proposals', indicatorPermission('metrics.actions.propose', 'metrics.measure', 'write'), route((req) => indicatorService.createProposal(scope(req), req.params.snapshotId, req.body, req.requestId)));
metricsRouter.post('/official/proposals/:proposalId/accept', indicatorPermission('metrics.actions.review', 'metrics.validate', 'write'), route((req) => indicatorService.reviewProposal(scope(req), req.params.proposalId, 'accepted', req.body, req.requestId)));
metricsRouter.post('/official/proposals/:proposalId/reject', indicatorPermission('metrics.actions.review', 'metrics.validate', 'write'), route((req) => indicatorService.reviewProposal(scope(req), req.params.proposalId, 'rejected', req.body, req.requestId)));
metricsRouter.get('/official/:metricCode/methodology', indicatorPermission('metrics.indicators.technical', 'data.lineage.read', 'read'), route((req) => indicatorService.methodology(scope(req), req.params.metricCode)));
metricsRouter.post('/official/:metricCode/methodology', indicatorPermission('metrics.methodology.manage', 'metrics.manage', 'write'), route((req) => indicatorService.createMethodologyDraft(scope(req), req.params.metricCode, req.body, req.requestId)));
metricsRouter.post('/official/methodology/:versionId/review', indicatorPermission('metrics.methodology.review', 'metrics.validate', 'write'), route((req) => indicatorService.transitionMethodology(scope(req), req.params.versionId, 'reviewed', req.requestId)));
metricsRouter.post('/official/methodology/:versionId/publish', indicatorPermission('metrics.methodology.publish', 'metrics.publish', 'write'), route((req) => indicatorService.transitionMethodology(scope(req), req.params.versionId, 'published', req.requestId)));
metricsRouter.get('/official/:metricCode/technical', indicatorPermission('metrics.indicators.technical', 'data.lineage.read', 'read'), route((req) => indicatorService.getIndicator(scope(req), req.params.metricCode, { technical: true })));
metricsRouter.get('/official/:metricCode/history', indicatorPermission('metrics.indicators.read', 'metrics.read', 'read'), route((req) => indicatorService.history(scope(req), req.params.metricCode, req.query)));
metricsRouter.get('/official/:metricCode/comparisons', indicatorPermission('metrics.comparisons.read', 'metrics.read', 'read'), route((req) => indicatorService.comparisons(scope(req), req.params.metricCode, req.query)));
metricsRouter.post('/official/:metricCode/calculate', indicatorPermission('metrics.jobs.run', 'metrics.recalculate', 'write'), route((req) => indicatorService.calculateIndicator(scope(req), req.params.metricCode, req.body, req.requestId)));
metricsRouter.post('/official/:metricCode/snapshots', indicatorPermission('metrics.snapshots.publish', 'metrics.measure', 'write'), route((req) => indicatorService.createSnapshot(scope(req), req.params.metricCode, req.body, req.requestId)));
metricsRouter.post('/official/:metricCode/comparisons', indicatorPermission('metrics.snapshots.publish', 'metrics.measure', 'write'), route((req) => indicatorService.createComparison(scope(req), req.params.metricCode, req.body, req.requestId)));
metricsRouter.get('/official/:metricCode', indicatorPermission('metrics.indicators.read', 'metrics.read', 'read'), route((req) => indicatorService.getIndicator(scope(req), req.params.metricCode)));
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
surveysRouter.use(requireTenant);
surveysRouter.use(requireCommercialCapability('surveys.engine'));
surveysRouter.get('/', route((req) => service.listSurveys(scope(req), req.query)));
surveysRouter.post('/', route((req) => service.createSurvey(scope(req), req.body, req.requestId)));
surveysRouter.get('/:id', route((req) => service.getSurvey(scope(req), req.params.id)));
surveysRouter.put('/:id', route((req) => service.createSurvey(scope(req), { ...req.body, id: req.params.id }, req.requestId)));
surveysRouter.post('/:id/versions', route((req) => service.createSurveyVersion(scope(req), req.params.id, req.body, req.requestId)));
surveysRouter.post('/:id/publish', route((req) => service.publishSurvey(scope(req), req.params.id, req.requestId)));

const surveyCampaignsRouter = express.Router();
surveyCampaignsRouter.use(requireTenant);
surveyCampaignsRouter.use(requireCommercialCapability('surveys.engine'));
surveyCampaignsRouter.post('/', route((req) => service.createCampaign(scope(req), req.body, req.requestId)));
surveyCampaignsRouter.get('/', route((req) => service.listCampaigns(scope(req), req.query)));
surveyCampaignsRouter.get('/:id', route((req) => service.getCampaign(scope(req), req.params.id)));
surveyCampaignsRouter.post('/:id/launch', route((req) => service.transitionCampaign(scope(req), req.params.id, 'active', req.requestId)));
surveyCampaignsRouter.post('/:id/close', route((req) => service.transitionCampaign(scope(req), req.params.id, 'closed', req.requestId)));

const surveyResponsesRouter = express.Router();
surveyResponsesRouter.use(requireTenant);
surveyResponsesRouter.use(requireCommercialCapability('surveys.engine'));
surveyResponsesRouter.post('/', route((req) => service.submitResponse(scope(req), req.body, req.requestId)));
surveyResponsesRouter.post('/:id/submit', route((req) => service.submitResponse(scope(req), { ...req.body, response_id: req.params.id, submit: true }, req.requestId)));
surveyResponsesRouter.post('/:id/evaluate', route((req) => service.evaluateResponse(scope(req), req.params.id, req.body, req.requestId)));
surveyResponsesRouter.post('/:id/approve', route((req) => service.approveResponse(scope(req), req.params.id, req.body, req.requestId)));

const assuranceTestsRouter = express.Router();
assuranceTestsRouter.use(requireTenant);
assuranceTestsRouter.use(requireCommercialCapability('assurance.testing'));
assuranceTestsRouter.get('/', route((req) => service.listAssuranceTests(scope(req), req.query)));
assuranceTestsRouter.post('/', route((req) => service.createAssuranceTest(scope(req), req.body, req.requestId)));
assuranceTestsRouter.post('/:id/execute', route((req) => service.executeAssuranceTest(scope(req), req.params.id, req.body, req.requestId)));
assuranceTestsRouter.post('/executions/:executionId/complete', route((req) => service.completeAssuranceExecution(scope(req), req.params.executionId, req.body, req.requestId)));
assuranceTestsRouter.post('/executions/:executionId/review', route((req) => service.reviewAssuranceExecution(scope(req), req.params.executionId, req.body, req.requestId)));

const lossEventsRouter = express.Router();
lossEventsRouter.use(requireTenant);
lossEventsRouter.use(requireCommercialCapability('loss.events'));
lossEventsRouter.get('/', route((req) => service.listLossEvents(scope(req), req.query)));
lossEventsRouter.post('/', route((req) => service.createLossEvent(scope(req), req.body, req.requestId)));
lossEventsRouter.get('/:id', route((req) => service.getLossEvent(scope(req), req.params.id)));
lossEventsRouter.put('/:id', route((req) => service.updateLossEvent(scope(req), req.params.id, req.body, req.requestId)));
lossEventsRouter.post('/:id/confirm', route((req) => service.transitionLossEvent(scope(req), req.params.id, 'confirmed', req.requestId)));
lossEventsRouter.post('/:id/recoveries', route((req) => service.addLossRecovery(scope(req), req.params.id, req.body, req.requestId)));
lossEventsRouter.post('/:id/close', route((req) => service.transitionLossEvent(scope(req), req.params.id, 'closed', req.requestId)));

const dashboardsRouter = express.Router();
dashboardsRouter.use(requireTenant);
dashboardsRouter.use(requireCommercialCapability('bi.executive_dashboards'));
dashboardsRouter.get('/', route((req) => service.listDashboards(scope(req), req.query)));
dashboardsRouter.post('/', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.createDashboard(scope(req), req.body, req.requestId)));
dashboardsRouter.get('/:id', route((req) => service.getDashboard(scope(req), req.params.id)));
dashboardsRouter.put('/:id', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.createDashboard(scope(req), req.body, req.requestId)));
dashboardsRouter.post('/:id/publish', requireCommercialCapability('bi.dashboard_builder'), route((req) => service.publishDashboard(scope(req), req.params.id, req.requestId)));
dashboardsRouter.post('/:id/snapshot', route((req) => service.snapshotDashboard(scope(req), req.params.id, req.requestId)));
dashboardsRouter.get('/:id/render', route((req) => service.renderDashboard(scope(req), req.params.id)));

const reportsRouter = express.Router();
reportsRouter.use(requireTenant);
reportsRouter.use(requireCommercialCapability('reporting.studio'));
reportsRouter.get('/', route((req) => service.listReports(scope(req), req.query)));
reportsRouter.post('/', route((req) => service.createReport(scope(req), req.body, req.requestId)));
reportsRouter.get('/:id', route((req) => service.getReport(scope(req), req.params.id)));
reportsRouter.put('/:id', route((req) => service.createReport(scope(req), req.body, req.requestId)));
reportsRouter.post('/:id/generate', route((req) => service.generateReport(scope(req), req.params.id, req.body, req.requestId)));

const reportGenerationsRouter = express.Router();
reportGenerationsRouter.use(requireTenant);
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
reportSchedulesRouter.use(requireTenant);
reportSchedulesRouter.use(requireCommercialCapability('reporting.scheduled'));
reportSchedulesRouter.post('/', route((req) => service.createReportSchedule(scope(req), req.body, req.requestId)));
reportSchedulesRouter.put('/:id', route((req) => service.updateReportSchedule(scope(req), req.params.id, req.body, req.requestId)));
reportSchedulesRouter.post('/:id/pause', route((req) => service.updateReportSchedule(scope(req), req.params.id, { status: 'paused' }, req.requestId)));
reportSchedulesRouter.post('/:id/resume', route((req) => service.updateReportSchedule(scope(req), req.params.id, { status: 'active' }, req.requestId)));

const grcRouter = express.Router();
grcRouter.get('/overview', requireTenant, requireCommercialCapability('data.governance'), route((req) => service.getGrcOverview(scope(req), req.requestId)));

grcRouter.get('/official/analytics/catalog', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.listOfficialAnalyticsCatalog(scope(req))));
grcRouter.get('/official/analytics/health-catalog', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.listOfficialHealthCatalog(scope(req))));
grcRouter.get('/official/analytics/:resultCode', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.getOfficialAnalyticsResult(scope(req), req.params.resultCode, { filters: req.query, period: req.query })));
grcRouter.post('/official/analytics/:resultCode', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.getOfficialAnalyticsResult(scope(req), req.params.resultCode, req.body)));
grcRouter.post('/official/recalculate', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => officialCalculationOrchestrator.recalculateOfficialAnalytics(scope(req), req.body, req.requestId)));

grcRouter.get('/official/package4/jobs', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.listOfficialPackage4Jobs(scope(req))));
grcRouter.post('/official/package4/jobs/:jobKey', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.runOfficialPackage4Job(scope(req), req.params.jobKey, req.body, req.requestId)));
grcRouter.post('/official/surveys/scoring', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'survey-score', req.body, req.requestId)));
grcRouter.post('/official/surveys/campaign-analytics', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'survey-response-rate', req.body, req.requestId)));
grcRouter.post('/official/surveys/cronbach', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'survey-cronbach', req.body, req.requestId)));
grcRouter.post('/official/assurance/sample-size', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'assurance-sample-size', req.body, req.requestId)));
grcRouter.post('/official/assurance/execution-score', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'assurance-score', req.body, req.requestId)));
grcRouter.post('/official/losses/net-loss', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'loss-net', req.body, req.requestId)));
grcRouter.post('/official/losses/expected-loss', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'loss-expected', req.body, req.requestId)));
grcRouter.post('/official/losses/var', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'loss-var', req.body, req.requestId)));
grcRouter.post('/official/losses/monte-carlo', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'loss-monte-carlo', req.body, req.requestId)));
grcRouter.post('/official/continuity/availability', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-availability', req.body, req.requestId)));
grcRouter.post('/official/continuity/mtbf', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-mtbf', req.body, req.requestId)));
grcRouter.post('/official/continuity/mttr', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-mttr', req.body, req.requestId)));
grcRouter.post('/official/continuity/sla', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-sla', req.body, req.requestId)));
grcRouter.post('/official/continuity/rto-gap', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-rto-gap', req.body, req.requestId)));
grcRouter.post('/official/continuity/rpo-gap', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'continuity-rpo-gap', req.body, req.requestId)));
grcRouter.post('/official/assets/criticality', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'asset-criticality', req.body, req.requestId)));
grcRouter.post('/official/suppliers/risk', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), 'supplier-risk', req.body, req.requestId)));

grcRouter.get('/official/health/definitions', requireTenant, requireCommercialCapability('metrics.catalog'), route(() => require('../services/math-governance/grcHealthCalculation.service').listHealthDefinitions()));
grcRouter.get('/official/calculations/:runId/explanation', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.getOfficialCalculationExplanation(scope(req), req.params.runId)));
grcRouter.get('/official/calculations/:runId/lineage', requireTenant, requireCommercialCapability('metrics.catalog'), route((req) => service.getOfficialCalculationLineage(scope(req), req.params.runId)));
grcRouter.post('/official/:metricKey', requireTenant, requireCommercialCapability('metrics.engine'), route((req) => service.calculateOfficialGrcMetric(scope(req), req.params.metricKey, { ...req.body, period: req.body?.period || req.query || {} }, req.requestId)));
grcRouter.get('/impact/:entityType/:entityId', requireTenant, requireCommercialCapability('data.impact_graph'), route((req) => service.graph(scope(req), req.params.entityType, req.params.entityId, 'impact')));

module.exports = {
  grcRouter,
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
