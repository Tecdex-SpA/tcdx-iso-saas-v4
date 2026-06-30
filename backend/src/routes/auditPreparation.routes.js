const express = require('express');
const auditPreparationController = require('../controllers/auditPreparation.controller');
const { ensureUploadDir } = require('../services/auditPreparation.service');
const {
  ZIP_MIME_TYPES,
  createDiskUpload,
  safeUploadError,
} = require('../utils/secureUpload');

const router = express.Router();

const zipUploadDir = ensureUploadDir();
const maxZipBytes = Number(process.env.AUDIT_PREPARATION_ZIP_MAX_BYTES || 50 * 1024 * 1024);

const upload = createDiskUpload({
  destination: zipUploadDir,
  allowedTypes: ZIP_MIME_TYPES,
  fileSize: maxZipBytes,
  files: 1,
  fields: 10,
  code: 'AUDIT_PREPARATION_ZIP_TYPE_NOT_ALLOWED',
  message: 'Solo se permiten archivos ZIP para preparación documental',
});

function zipUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    const payload = safeUploadError(error, {
      code: 'AUDIT_PREPARATION_ZIP_UPLOAD_ERROR',
      sizeCode: 'AUDIT_PREPARATION_ZIP_TOO_LARGE',
      sizeMessage: 'El ZIP excede el tamaño máximo permitido',
      message: 'Solo se permiten archivos ZIP para preparación documental',
    });
    return res.status(payload.status).json({
      ok: false,
      code: payload.code,
      error: payload.error,
    });
  });
}

router.get('/templates', auditPreparationController.listTemplates);
router.get('/documentary-sources', auditPreparationController.listDocumentarySources);
router.post('/documentary-sources', auditPreparationController.createDocumentarySource);
router.put('/documentary-sources/:sourceId', auditPreparationController.updateDocumentarySource);
router.delete('/documentary-sources/:sourceId', auditPreparationController.deleteDocumentarySource);
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
