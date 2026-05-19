const auditPreparationService = require('../services/auditPreparation.service');

function handleError(res, error) {
  const status = Number(error.status || error.statusCode || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const code = safeStatus === 500
    ? 'AUDIT_PREPARATION_ERROR'
    : (error.code || 'AUDIT_PREPARATION_REQUEST_ERROR');
  const message = safeStatus === 500
    ? 'No fue posible procesar la preparación documental'
    : error.message;

  if (safeStatus === 500) {
    console.error('AUDIT PREPARATION CONTROLLER ERROR:', {
      code: error.code || code,
      message: error.message,
      stack: error.stack,
      sourceKey: error.sourceKey || null,
    });
  }

  return res.status(safeStatus).json({
    ok: false,
    code,
    error: message,
    message,
  });
}

async function listTemplates(req, res) {
  try {
    const templates = await auditPreparationService.listTemplates({
      standardCode: req.query.standard_code || 'ISO9001',
    });
    return res.json({ ok: true, templates });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createPackage(req, res) {
  try {
    const pkg = await auditPreparationService.createPackage({
      user: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, package: pkg });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listPackages(req, res) {
  try {
    const packages = await auditPreparationService.listPackages({
      user: req.user,
      filters: req.query || {},
    });
    return res.json({ ok: true, packages });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getPackage(req, res) {
  try {
    const detail = await auditPreparationService.getPackageDetail({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, ...detail });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getPackageSummary(req, res) {
  try {
    const summary = await auditPreparationService.getPackageSummary({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, ...summary });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listPackageDocuments(req, res) {
  try {
    const documents = await auditPreparationService.listPackageDocuments({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, documents });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getDocumentDetail(req, res) {
  try {
    const document = await auditPreparationService.getDocumentDetail({
      user: req.user,
      documentId: req.params.documentId,
    });
    return res.json({ ok: true, document });
  } catch (error) {
    return handleError(res, error);
  }
}

async function downloadDocument(req, res) {
  try {
    const file = await auditPreparationService.getDocumentFile({
      user: req.user,
      documentId: req.params.documentId,
    });
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    return res.download(file.path, file.filename);
  } catch (error) {
    return handleError(res, error);
  }
}

async function getDocumentHistory(req, res) {
  try {
    const versions = await auditPreparationService.getDocumentHistory({
      user: req.user,
      documentId: req.params.documentId,
    });
    return res.json({ ok: true, versions });
  } catch (error) {
    return handleError(res, error);
  }
}

async function buildContext(req, res) {
  try {
    const context = await auditPreparationService.buildContextForPackage({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, context });
  } catch (error) {
    return handleError(res, error);
  }
}

async function generateDocuments(req, res) {
  try {
    const result = await auditPreparationService.generateDocuments({
      user: req.user,
      packageId: req.params.id,
      payload: req.body || {},
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function generateEvidenceIndex(req, res) {
  try {
    const result = await auditPreparationService.generateEvidenceIndex({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listUploadedZips(req, res) {
  try {
    const uploaded_zips = await auditPreparationService.listUploadedZips({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, uploaded_zips });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listDocumentarySources(req, res) {
  try {
    const sources = await auditPreparationService.listDocumentarySources({
      user: req.user,
      filters: req.query || {},
    });
    return res.json({ ok: true, sources });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createDocumentarySource(req, res) {
  try {
    const source = await auditPreparationService.createDocumentarySource({
      user: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, source });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateDocumentarySource(req, res) {
  try {
    const source = await auditPreparationService.updateDocumentarySource({
      user: req.user,
      sourceId: req.params.sourceId,
      payload: req.body || {},
    });
    return res.json({ ok: true, source });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteDocumentarySource(req, res) {
  try {
    const source = await auditPreparationService.deleteDocumentarySource({
      user: req.user,
      sourceId: req.params.sourceId,
    });
    return res.json({ ok: true, source });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getGaps(req, res) {
  try {
    const gaps = await auditPreparationService.getGaps({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, gaps });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateDocumentStatus(req, res) {
  try {
    const document = await auditPreparationService.updateDocumentStatus({
      user: req.user,
      documentId: req.params.documentId,
      documentStatus: req.body?.document_status,
    });
    return res.json({ ok: true, document });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateEvidenceStatus(req, res) {
  try {
    const evidence = await auditPreparationService.updateEvidenceStatus({
      user: req.user,
      evidenceId: req.params.evidenceId,
      status: req.body?.status,
      notes: req.body?.notes,
    });
    return res.json({ ok: true, evidence });
  } catch (error) {
    return handleError(res, error);
  }
}

async function uploadZip(req, res) {
  try {
    const result = await auditPreparationService.registerUploadedZip({
      user: req.user,
      file: req.file,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function exportPackage(req, res) {
  try {
    const result = await auditPreparationService.exportPackage({
      user: req.user,
      packageId: req.params.id,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function downloadExport(req, res) {
  try {
    const file = await auditPreparationService.getExportFile({
      user: req.user,
      packageId: req.params.id,
    });
    res.setHeader('Content-Type', 'application/zip');
    return res.download(file.path, file.filename);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  listTemplates,
  createPackage,
  listPackages,
  getPackage,
  getPackageSummary,
  listPackageDocuments,
  getDocumentDetail,
  downloadDocument,
  getDocumentHistory,
  buildContext,
  generateDocuments,
  generateEvidenceIndex,
  listUploadedZips,
  listDocumentarySources,
  createDocumentarySource,
  updateDocumentarySource,
  deleteDocumentarySource,
  getGaps,
  updateDocumentStatus,
  updateEvidenceStatus,
  uploadZip,
  exportPackage,
  downloadExport,
};
