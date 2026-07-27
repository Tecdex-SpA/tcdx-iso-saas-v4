const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const { Phase2Error, createPhase2Service } = require('../services/grc/phase2.service');

const router = express.Router();
const service = createPhase2Service(pool);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 52428800, fields: 10 },
});

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

function sessionToken(req) {
  const authorization = String(req.get('Authorization') || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
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
          ok: false, code: error.code, error: error.message, request_id: req.requestId || null,
        });
      }
      console.error(JSON.stringify({
        event: 'SUPPLIER_PORTAL_ERROR',
        request_id: req.requestId || null,
        error_code: error?.code || 'SUPPLIER_PORTAL_INTERNAL_ERROR',
      }));
      return res.status(500).json({
        ok: false,
        code: 'SUPPLIER_PORTAL_INTERNAL_ERROR',
        error: 'No fue posible completar la operación del portal.',
        request_id: req.requestId || null,
      });
    }
  };
}

router.post('/exchange', express.json({ limit: '32kb' }), route(req => service.exchangePortalInvitation(req.body?.token)));
router.get('/assessment', route(req => service.portalAssessment(sessionToken(req))));
router.put('/answers', express.json({ limit: '256kb' }), route(req => service.portalSaveAnswer(sessionToken(req), req.body)));
router.post('/submit', express.json({ limit: '32kb' }), route(req => service.portalSubmit(sessionToken(req), req.body)));

router.post('/evidence', upload.single('file'), route(async req => {
  if (!req.file?.buffer?.length) {
    throw new Phase2Error('SUPPLIER_PORTAL_FILE_REQUIRED', 'Se requiere un archivo.', 400);
  }
  const context = await service.portalContext(sessionToken(req));
  if (!context.allowed_mime_types.includes(req.file.mimetype)) {
    throw new Phase2Error('SUPPLIER_PORTAL_FILE_TYPE_REJECTED', 'Tipo de archivo no permitido.', 415);
  }
  if (req.file.size > Number(context.max_file_bytes)) {
    throw new Phase2Error('SUPPLIER_PORTAL_FILE_TOO_LARGE', 'Archivo supera el límite permitido.', 413);
  }
  const contentHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const safeName = `${crypto.randomUUID()}-${path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)}`;
  const directory = path.resolve(__dirname, '..', '..', 'uploads', 'supplier-portal', context.tenant_id, context.assessment_id);
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o750 });
  const storagePath = path.join(directory, safeName);
  await fs.promises.writeFile(storagePath, req.file.buffer, { mode: 0o640, flag: 'wx' });
  try {
    const evidence = await service.recordPortalEvidence(sessionToken(req), {
      question_id: req.body?.question_id || null,
      file_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      content_hash: contentHash,
      storage_path: storagePath,
    });
    if (evidence.duplicate_upload) {
      await fs.promises.unlink(storagePath);
    }
    delete evidence.duplicate_upload;
    return evidence;
  } catch (error) {
    await fs.promises.unlink(storagePath).catch(() => undefined);
    throw error;
  }
}));

module.exports = router;
