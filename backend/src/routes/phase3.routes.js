const express = require('express');
const pool = require('../config/db');
const { Phase3Error, createPhase3Service } = require('../services/grc/phase3.service');

const router = express.Router();
const service = createPhase3Service(pool);
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EMPTY_ID_VALUES = new Set(['', 'null', 'undefined']);

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function normalizePayload(value, key = '') {
  if (Array.isArray(value)) {
    return value.map(item => normalizePayload(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        normalizePayload(childValue, childKey),
      ])
    );
  }
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if ((key === 'id' || key.endsWith('_id')) && EMPTY_ID_VALUES.has(normalized.toLowerCase())) {
    return null;
  }
  return normalized;
}

function validatePayloadIds(value, path = 'body') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validatePayloadIds(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, childValue] of Object.entries(value)) {
    const fieldPath = `${path}.${key}`;
    if (
      (key === 'id' || key.endsWith('_id'))
      && childValue !== null
      && childValue !== undefined
      && !UUID_PATTERN.test(String(childValue))
    ) {
      throw new Phase3Error(
        'PHASE3_UUID_INVALID',
        `El campo ${key} debe usar una entidad válida de esta empresa.`,
        400,
        { field: key }
      );
    }
    validatePayloadIds(childValue, fieldPath);
  }
}

router.use((req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = normalizePayload(req.body);
      validatePayloadIds(req.body);
    }
    next();
  } catch (error) {
    if (error instanceof Phase3Error) {
      res.locals.errorCode = error.code;
      return res.status(error.status).json({
        ok: false,
        code: error.code,
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
        request_id: req.requestId || null,
      });
    }
    next(error);
  }
});

function safePayloadSummary(body) {
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(
    Object.entries(body).slice(0, 50).map(([key, value]) => {
      if (value === null) return [key, 'null'];
      if (Array.isArray(value)) return [key, `array(${value.length})`];
      if (typeof value === 'object') return [key, 'object'];
      if (key.endsWith('_id')) return [key, UUID_PATTERN.test(String(value)) ? 'uuid' : 'invalid-id'];
      return [key, `${typeof value}(${String(value).length})`];
    })
  );
}

function mapDatabaseError(error) {
  const mappings = {
    '23505': [
      'PHASE3_DUPLICATE',
      'Ya existe un registro con el mismo código o relación en esta empresa.',
      409,
    ],
    '23503': [
      'PHASE3_RELATION_NOT_FOUND',
      'La relación seleccionada no existe o no está disponible en esta empresa.',
      409,
    ],
    '23514': [
      'PHASE3_CONSTRAINT_VIOLATION',
      'Los valores no cumplen las reglas operacionales de la entidad.',
      409,
    ],
    '23502': [
      'PHASE3_REQUIRED_FIELD',
      'Falta un campo obligatorio para completar la operación.',
      400,
    ],
    '22P02': [
      'PHASE3_VALUE_FORMAT_INVALID',
      'Uno de los campos tiene un formato inválido.',
      400,
    ],
  };
  const mapped = mappings[error?.code];
  if (!mapped) return null;
  return new Phase3Error(mapped[0], mapped[1], mapped[2], {
    field: error?.column || null,
    constraint: error?.constraint || null,
  });
}

function roleOf(req) {
  return String(req.user?.role || req.user?.user_role || req.user?.userRole || '')
    .toLowerCase()
    .trim();
}

function userIdOf(req) {
  return req.user?.id || req.user?.user_id || req.user?.sub || null;
}

function tenantIdOf(req) {
  return req.resolvedTenantId || req.user?.tenant_id || req.user?.tenantId || null;
}

function contextOf(req) {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    throw new Phase3Error('PHASE3_TENANT_REQUIRED', 'Se requiere contexto de empresa.', 400);
  }
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
      const mappedError = error instanceof Phase3Error ? error : mapDatabaseError(error);
      if (mappedError) {
        res.locals.errorCode = mappedError.code;
        return res.status(mappedError.status).json({
          ok: false,
          code: mappedError.code,
          error: mappedError.message,
          ...(mappedError.details ? { details: mappedError.details } : {}),
          request_id: req.requestId || null,
        });
      }
      console.error(JSON.stringify({
        event: 'GRC_PHASE3_ERROR',
        request_id: req.requestId || null,
        tenant_id: tenantIdOf(req),
        route: req.originalUrl,
        error_code: error?.code || 'GRC_PHASE3_INTERNAL_ERROR',
        payload: safePayloadSummary(req.body),
        stack: String(error?.stack || '').split('\n').slice(0, 8).join(' | '),
      }));
      res.locals.errorCode = error?.code || 'GRC_PHASE3_INTERNAL_ERROR';
      return res.status(500).json({
        ok: false,
        code: 'GRC_PHASE3_INTERNAL_ERROR',
        error: 'No fue posible completar la operación integrada al GRC.',
        request_id: req.requestId || null,
      });
    }
  };
}

async function authorized(req, permission, operation) {
  const context = contextOf(req);
  await service.assertModuleEnabled(context.tenantId);
  await service.assertPermission({
    userId: context.userId,
    role: context.role,
    permission,
  });
  return operation(context);
}

function transitionPermission(entityType, toStatus) {
  const approval = ['approved', 'current', 'active', 'passed', 'passed_with_observations'].includes(toStatus);
  const permissions = {
    organization: approval ? 'organizations.manage' : 'organizations.manage',
    process: approval ? 'processes.approve' : 'processes.manage',
    service: 'services.manage',
    bia: approval ? 'bia.approve' : 'bia.manage',
    continuity_plan: toStatus === 'activated'
      ? 'continuity.activate'
      : approval ? 'continuity.approve' : 'continuity.manage',
    continuity_test: approval ? 'continuity.approve' : 'continuity.tests.manage',
    crisis: 'crisis.manage',
    metric: approval ? 'metrics.approve' : 'metrics.manage',
    quantitative_risk: approval ? 'quantitative_risk.approve' : 'quantitative_risk.manage',
  };
  return permissions[entityType];
}

router.get('/meta', route(req => {
  const context = contextOf(req);
  return service.getMeta(context);
}));

router.get('/lookups', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getLookups(tenantId)
)));
router.get('/summary', route(req => authorized(
  req,
  'operations.dashboard.read',
  ({ tenantId }) => service.operationsOverview(tenantId)
)));
router.get('/readiness', route(req => authorized(
  req,
  'operations.dashboard.read',
  ({ tenantId }) => service.activationReadiness(tenantId)
)));
router.get('/templates/:entityType', route(req => authorized(
  req,
  'operations.import',
  () => service.getImportTemplate(req.params.entityType)
)));
router.post('/imports/preview', route(req => authorized(
  req,
  'operations.import',
  context => service.createImportPreview({ ...context, body: req.body })
)));
router.get('/imports/:id', route(req => authorized(
  req,
  'operations.import',
  ({ tenantId }) => service.getImportBatch(tenantId, req.params.id)
)));
router.post('/imports/:id/confirm', route(req => authorized(
  req,
  'operations.import',
  context => service.confirmImport({
    ...context,
    batchId: req.params.id,
    confirmed: req.body?.confirm === true,
  })
)));
router.post('/imports/:id/rollback', route(req => authorized(
  req,
  'operations.import',
  context => service.rollbackImport({ ...context, batchId: req.params.id })
)));
router.get('/360/:entityType/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, req.params.entityType, req.params.id)
)));

router.get('/operations-overview', route(req => authorized(
  req,
  'operations.dashboard.read',
  ({ tenantId }) => service.operationsOverview(tenantId)
)));
router.get('/continuity-overview', route(req => authorized(
  req,
  'continuity.read',
  ({ tenantId }) => service.continuityOverview(tenantId)
)));

router.post('/relations', route(req => authorized(
  req,
  'processes.manage',
  context => service.createRelation({ ...context, body: req.body })
)));
router.post('/dependencies', route(req => authorized(
  req,
  'processes.manage',
  context => service.createDependency({ ...context, body: req.body })
)));

router.get('/organizations', route(req => authorized(
  req,
  'organizations.read',
  ({ tenantId }) => service.listOrganizations(tenantId, req.query)
)));
router.post('/organizations', route(req => authorized(
  req,
  'organizations.manage',
  context => service.createOrganization({ ...context, body: req.body })
)));
router.patch('/organizations/:id', route(req => authorized(
  req,
  'organizations.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'organization',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/organizations/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'organization', req.params.id)
)));

router.get('/processes', route(req => authorized(
  req,
  'processes.read',
  ({ tenantId }) => service.listProcesses(tenantId, req.query)
)));
router.post('/processes', route(req => authorized(
  req,
  'processes.manage',
  context => service.createProcess({ ...context, body: req.body })
)));
router.patch('/processes/:id', route(req => authorized(
  req,
  'processes.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'process',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/processes/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'process', req.params.id)
)));

router.get('/services', route(req => authorized(
  req,
  'services.read',
  ({ tenantId }) => service.listServices(tenantId, req.query)
)));
router.post('/services', route(req => authorized(
  req,
  'services.manage',
  context => service.createService({ ...context, body: req.body })
)));
router.patch('/services/:id', route(req => authorized(
  req,
  'services.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'service',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/services/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'service', req.params.id)
)));

router.get('/bia', route(req => authorized(
  req,
  'bia.read',
  ({ tenantId }) => service.listBias(tenantId, req.query)
)));
router.post('/bia', route(req => authorized(
  req,
  'bia.manage',
  context => service.createBia({ ...context, body: req.body })
)));
router.patch('/bia/:id', route(req => authorized(
  req,
  'bia.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'bia',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.post('/bia/:id/impacts', route(req => authorized(
  req,
  'bia.manage',
  context => service.createBiaImpact({
    ...context,
    biaId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/bia/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'bia', req.params.id)
)));

router.get('/continuity/plans', route(req => authorized(
  req,
  'continuity.read',
  ({ tenantId }) => service.listPlans(tenantId, req.query)
)));
router.post('/continuity/plans', route(req => authorized(
  req,
  'continuity.manage',
  context => service.createContinuityPlan({ ...context, body: req.body })
)));
router.patch('/continuity/plans/:id', route(req => authorized(
  req,
  'continuity.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'continuity_plan',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/continuity/plans/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'continuity_plan', req.params.id)
)));

router.get('/continuity/tests', route(req => authorized(
  req,
  'continuity.read',
  ({ tenantId }) => service.listTests(tenantId, req.query)
)));
router.post('/continuity/tests', route(req => authorized(
  req,
  'continuity.tests.manage',
  context => service.createContinuityTest({ ...context, body: req.body })
)));
router.patch('/continuity/tests/:id', route(req => authorized(
  req,
  'continuity.tests.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'continuity_test',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/continuity/tests/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'continuity_test', req.params.id)
)));

router.get('/crisis', route(req => authorized(
  req,
  'crisis.read',
  ({ tenantId }) => service.listCrises(tenantId, req.query)
)));
router.post('/crisis', route(req => authorized(
  req,
  'crisis.manage',
  context => service.createCrisis({ ...context, body: req.body })
)));
router.patch('/crisis/:id', route(req => authorized(
  req,
  'crisis.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'crisis',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/crisis/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'crisis', req.params.id)
)));
router.post('/crisis/:id/log', route(req => authorized(
  req,
  'crisis.manage',
  context => service.addCrisisLog({ ...context, id: req.params.id, body: req.body })
)));

router.get('/metrics', route(req => authorized(
  req,
  'metrics.read',
  ({ tenantId }) => service.listMetrics(tenantId, req.query)
)));
router.post('/metrics', route(req => authorized(
  req,
  'metrics.manage',
  context => service.createMetric({ ...context, body: req.body })
)));
router.patch('/metrics/:id', route(req => authorized(
  req,
  'metrics.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'metric',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/metrics/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.metric360(tenantId, req.params.id)
)));
router.post('/metrics/:id/measurements', route(req => authorized(
  req,
  'metrics.record',
  context => service.recordMeasurement({
    ...context,
    metricId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));

router.get('/quantitative-risks', route(req => authorized(
  req,
  'quantitative_risk.read',
  ({ tenantId }) => service.listQuantitativeRisks(tenantId, req.query)
)));
router.post('/quantitative-risks', route(req => authorized(
  req,
  'quantitative_risk.manage',
  context => service.createQuantitativeRisk({ ...context, body: req.body })
)));
router.patch('/quantitative-risks/:id', route(req => authorized(
  req,
  'quantitative_risk.manage',
  context => service.updateEntity({
    ...context,
    entityType: 'quantitative_risk',
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  })
)));
router.get('/quantitative-risks/:id', route(req => authorized(
  req,
  'operations.360.read',
  ({ tenantId }) => service.getEntity360(tenantId, 'quantitative_risk', req.params.id)
)));

router.post('/:entityType/:id/transitions', route(req => {
  const permission = transitionPermission(req.params.entityType, req.body?.to_status);
  if (!permission) {
    throw new Phase3Error('PHASE3_TRANSITION_ENTITY_INVALID', 'Entidad no transicionable.', 400);
  }
  return authorized(req, permission, context => service.transitionEntity({
    ...context,
    entityType: req.params.entityType,
    entityId: req.params.id,
    body: req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  }));
}));

router._test = {
  mapDatabaseError,
  normalizePayload,
  safePayloadSummary,
  validatePayloadIds,
};

module.exports = router;
