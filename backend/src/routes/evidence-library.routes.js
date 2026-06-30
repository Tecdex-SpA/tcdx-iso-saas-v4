'use strict';

const express = require('express');
const {
  listSources,
  listDocuments,
  getDocumentDetail,
  listDocumentChildren,
  listAssociations,
  createAssociation,
  setAssociationStatus,
  listTargetCandidates,
  manualUploadFiles,
  manualUploadZip,
  excludeDocumentFromIndex,
  restoreDocumentIndex,
  analyzeSemanticEvidence,
  reviewSuggestion,
} = require('../services/evidenceLibrary.service');
const {
  DOCUMENT_MIME_TYPES,
  ZIP_MIME_TYPES,
  createMemoryUpload,
  safeUploadError,
} = require('../utils/secureUpload');

const router = express.Router();
const maxManualFiles = Number(process.env.EVIDENCE_LIBRARY_UPLOAD_MAX_FILES || 50);
const manualFilesUpload = createMemoryUpload({
  allowedTypes: DOCUMENT_MIME_TYPES,
  fileSize: Number(process.env.EVIDENCE_LIBRARY_UPLOAD_MAX_FILE_BYTES || 50 * 1024 * 1024),
  files: maxManualFiles,
  fields: 20,
  code: 'EVIDENCE_LIBRARY_FILE_TYPE_NOT_ALLOWED',
  message: 'Tipo de archivo no permitido para carga manual',
});
const manualZipUpload = createMemoryUpload({
  allowedTypes: ZIP_MIME_TYPES,
  fileSize: Number(process.env.EVIDENCE_LIBRARY_UPLOAD_MAX_ZIP_BYTES || 100 * 1024 * 1024),
  files: 1,
  fields: 20,
  code: 'EVIDENCE_LIBRARY_ZIP_TYPE_NOT_ALLOWED',
  message: 'Solo se permiten archivos ZIP para carga manual',
});

function sendError(res, error) {
  const status = Number(error?.status || error?.statusCode || 500);
  const payload = {
    ok: false,
    code: error?.code || 'EVIDENCE_LIBRARY_ERROR',
    error: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
  };
  if (error?.details && status < 500) {
    payload.details = error.details;
  }
  return res.status(status >= 400 && status < 600 ? status : 500).json(payload);
}

function uploadManualFiles(req, res, next) {
  manualFilesUpload.array('files', maxManualFiles)(req, res, (error) => {
    if (!error) return next();

    const payload = safeUploadError(error, {
      code: 'EVIDENCE_LIBRARY_UPLOAD_ERROR',
      sizeCode: 'EVIDENCE_LIBRARY_FILE_TOO_LARGE',
      sizeMessage: 'El archivo excede el tamaño máximo permitido',
      message: 'Tipo de archivo no permitido para carga manual',
    });
    return res.status(payload.status).json({ ok: false, code: payload.code, error: payload.error });
  });
}

function uploadManualZip(req, res, next) {
  manualZipUpload.single('zip')(req, res, (error) => {
    if (!error) return next();

    const payload = safeUploadError(error, {
      code: 'EVIDENCE_LIBRARY_ZIP_UPLOAD_ERROR',
      sizeCode: 'EVIDENCE_LIBRARY_ZIP_TOO_LARGE',
      sizeMessage: 'El ZIP excede el tamaño máximo permitido',
      message: 'Solo se permiten archivos ZIP para carga manual',
    });
    return res.status(payload.status).json({ ok: false, code: payload.code, error: payload.error });
  });
}

router.get('/sources', async (req, res) => {
  try {
    const data = await listSources({ user: req.user });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/manual-upload/files', uploadManualFiles, async (req, res) => {
  try {
    const data = await manualUploadFiles({
      user: req.user,
      files: req.files || [],
      fields: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/manual-upload/zip', uploadManualZip, async (req, res) => {
  try {
    const data = await manualUploadZip({
      user: req.user,
      file: req.file,
      fields: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents', async (req, res) => {
  try {
    const result = await listDocuments({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents/:sourceType/:sourceId/children', async (req, res) => {
  try {
    const result = await listDocumentChildren({
      user: req.user,
      sourceType: req.params.sourceType,
      sourceId: req.params.sourceId,
      filters: req.query || {},
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/index/exclusions', async (req, res) => {
  try {
    const data = await excludeDocumentFromIndex({
      user: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/index/restore', async (req, res) => {
  try {
    const data = await restoreDocumentIndex({
      user: req.user,
      payload: req.body || {},
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents/:sourceType/:sourceId', async (req, res) => {
  try {
    const data = await getDocumentDetail({
      user: req.user,
      sourceType: req.params.sourceType,
      sourceId: req.params.sourceId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/associations', async (req, res) => {
  try {
    const data = await listAssociations({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/associations', async (req, res) => {
  try {
    const data = await createAssociation({ user: req.user, payload: req.body || {} });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/associations/:id/deactivate', async (req, res) => {
  try {
    const data = await setAssociationStatus({ user: req.user, id: req.params.id, isActive: false });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/associations/:id/reactivate', async (req, res) => {
  try {
    const data = await setAssociationStatus({ user: req.user, id: req.params.id, isActive: true });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/targets/:targetType', async (req, res) => {
  try {
    const data = await listTargetCandidates({
      user: req.user,
      targetType: req.params.targetType,
      search: req.query?.search || '',
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/analyze', async (req, res) => {
  try {
    const data = await analyzeSemanticEvidence({
      user: req.user,
      operationRef: req.body?.operation_ref,
      sourceType: req.body?.source_type,
      sourceId: req.body?.source_id,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/suggestions/:id/accept', async (req, res) => {
  try {
    const data = await reviewSuggestion({ user: req.user, suggestionId: req.params.id, action: 'accept' });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/suggestions/:id/reject', async (req, res) => {
  try {
    const data = await reviewSuggestion({ user: req.user, suggestionId: req.params.id, action: 'reject' });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
