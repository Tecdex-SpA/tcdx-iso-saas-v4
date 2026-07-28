'use strict';

const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const {
  ImportFileError,
  Phase3Error,
  createUniversalImportService,
} = require('../services/imports/universalImport.service');
const { LIMITS } = require('../services/imports/excelWorkbook');

const router = express.Router();
const service = createUniversalImportService(pool);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LIMITS.maximumFileSize,
    files: 1,
    fields: 10,
    parts: 12,
  },
});
const windows = new Map();

function contextOf(req) {
  const tenantId = req.resolvedTenantId || req.user?.tenant_id || req.user?.tenantId;
  if (!tenantId) {
    throw new ImportFileError('IMPORT_TENANT_REQUIRED', 'Se requiere contexto de empresa.', 400);
  }
  return {
    tenantId,
    userId: req.user?.id || req.user?.user_id || req.user?.sub || null,
    role: String(req.user?.role || req.user?.user_role || '').toLowerCase(),
    correlationId: req.requestId || null,
  };
}

function rateLimit(req, _res, next) {
  const now = Date.now();
  if (windows.size > 5000) {
    for (const [windowKey, value] of windows) {
      if (value.resetAt <= now) windows.delete(windowKey);
    }
  }
  const key = `${req.resolvedTenantId || req.user?.tenant_id || 'unknown'}:${req.user?.id || 'unknown'}`;
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + 60000 });
    return next();
  }
  current.count += 1;
  if (current.count > 10) {
    return next(new ImportFileError(
      'IMPORT_RATE_LIMITED',
      'Se alcanzó el límite temporal de importaciones. Intenta nuevamente en un minuto.',
      429
    ));
  }
  return next();
}

function route(handler) {
  return async (req, res, next) => {
    try {
      const data = await handler(req);
      if (data?.buffer) {
        res.setHeader('Content-Type', data.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (data.checksum) res.setHeader('X-Template-Checksum', data.checksum);
        return res.send(data.buffer);
      }
      return res.json({ ok: true, data, request_id: req.requestId || null });
    } catch (error) {
      return next(error);
    }
  };
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/definitions', route(req => service.definitions(contextOf(req))));
router.get('/definitions/:entityType', route(req => (
  service.definition(contextOf(req), req.params.entityType)
)));
router.get('/templates/:entityType.xlsx', rateLimit, route(req => (
  service.template(contextOf(req), req.params.entityType)
)));
router.get('/catalogs/:entityType.xlsx', rateLimit, route(req => (
  service.catalogs(contextOf(req), req.params.entityType)
)));
router.post('/preview', rateLimit, upload.single('file'), route(req => (
  service.preview(contextOf(req), {
    entityType: req.body?.entity_type,
    duplicatePolicy: req.body?.duplicate_policy,
    file: req.file,
  })
)));
router.get('/history', route(req => service.history(contextOf(req), {
  limit: req.query.limit,
  entityType: req.query.entity_type,
})));
router.get('/:batchId', route(req => service.batch(contextOf(req), req.params.batchId)));
router.post('/:batchId/confirm', rateLimit, route(req => (
  service.confirm(contextOf(req), req.params.batchId, req.body?.confirmed === true)
)));
router.post('/:batchId/rollback', rateLimit, route(req => (
  service.rollback(contextOf(req), req.params.batchId)
)));
router.get('/:batchId/errors.xlsx', route(req => (
  service.errorsWorkbook(contextOf(req), req.params.batchId)
)));

router.use((error, req, res, _next) => {
  const known = error instanceof ImportFileError || error instanceof Phase3Error;
  const multerTooLarge = error?.code === 'LIMIT_FILE_SIZE';
  const status = multerTooLarge ? 413 : known ? error.status : 500;
  const code = multerTooLarge ? 'IMPORT_FILE_SIZE_INVALID'
    : known ? error.code : 'IMPORT_INTERNAL_ERROR';
  res.locals.errorCode = code;
  if (!known && !multerTooLarge) {
    console.error(JSON.stringify({
      event: 'UNIVERSAL_IMPORT_ERROR',
      request_id: req.requestId || null,
      tenant_id: req.resolvedTenantId || req.user?.tenant_id || null,
      route: req.originalUrl,
      error_code: error?.code || 'IMPORT_INTERNAL_ERROR',
    }));
  }
  return res.status(status).json({
    ok: false,
    code,
    error: multerTooLarge
      ? 'El archivo excede el tamaño permitido.'
      : known ? error.message : 'No fue posible procesar la importación.',
    ...(known && error.details ? { details: error.details } : {}),
    request_id: req.requestId || null,
  });
});

module.exports = router;
