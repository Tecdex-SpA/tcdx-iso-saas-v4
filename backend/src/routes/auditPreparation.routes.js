const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const auditPreparationController = require('../controllers/auditPreparation.controller');
const { ensureUploadDir } = require('../services/auditPreparation.service');

const router = express.Router();

const zipUploadDir = ensureUploadDir();
const maxZipBytes = Number(process.env.AUDIT_PREPARATION_ZIP_MAX_BYTES || 50 * 1024 * 1024);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, zipUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function zipFileFilter(_req, file, cb) {
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();
  const allowedMimeTypes = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/octet-stream',
    'multipart/x-zip',
  ]);

  if (ext !== '.zip' || (mimeType && !allowedMimeTypes.has(mimeType))) {
    const error = new Error('Solo se permiten archivos ZIP para preparación documental');
    error.code = 'AUDIT_PREPARATION_ZIP_TYPE_NOT_ALLOWED';
    return cb(error);
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: maxZipBytes },
  fileFilter: zipFileFilter,
});

function zipUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    const isSizeError = error.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      ok: false,
      code: isSizeError ? 'AUDIT_PREPARATION_ZIP_TOO_LARGE' : (error.code || 'AUDIT_PREPARATION_ZIP_UPLOAD_ERROR'),
      error: isSizeError
        ? 'El ZIP excede el tamaño máximo permitido'
        : 'Solo se permiten archivos ZIP para preparación documental',
    });
  });
}

router.get('/templates', auditPreparationController.listTemplates);
router.post('/packages', auditPreparationController.createPackage);
router.get('/packages', auditPreparationController.listPackages);
router.get('/packages/:id/summary', auditPreparationController.getPackageSummary);
router.get('/packages/:id/documents', auditPreparationController.listPackageDocuments);
router.post('/packages/:id/build-context', auditPreparationController.buildContext);
router.post('/packages/:id/generate-documents', auditPreparationController.generateDocuments);
router.post('/packages/:id/generate-evidence-index', auditPreparationController.generateEvidenceIndex);
router.get('/packages/:id/uploaded-zips', auditPreparationController.listUploadedZips);
router.get('/packages/:id/gaps', auditPreparationController.getGaps);
router.post('/packages/:id/export', auditPreparationController.exportPackage);
router.get('/packages/:id/download-export', auditPreparationController.downloadExport);
router.get('/packages/:id', auditPreparationController.getPackage);
router.get('/documents/:documentId', auditPreparationController.getDocumentDetail);
router.get('/documents/:documentId/download', auditPreparationController.downloadDocument);
router.get('/documents/:documentId/history', auditPreparationController.getDocumentHistory);
router.patch('/documents/:documentId/status', auditPreparationController.updateDocumentStatus);
router.patch('/evidences/:evidenceId/status', auditPreparationController.updateEvidenceStatus);
router.post('/upload-zip', zipUpload, auditPreparationController.uploadZip);

module.exports = router;
