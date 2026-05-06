const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoDocumentGenerator = require('../services/isoDocumentGenerator.service');

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO DOCUMENT GENERATOR:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_DOCUMENT_GENERATOR_ERROR',
    error: error.message || 'Error procesando generador documental ISO',
    ...errorDetail(error),
  });
}

router.get('/:tenantId/options', async (req, res) => {
  try {
    const options = await isoDocumentGenerator.listOptions(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
      document_type: req.query.document_type,
    });
    return sendData(res, {
      tenant_id: req.params.tenantId,
      options,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/templates', async (req, res) => {
  try {
    const templates = await isoDocumentGenerator.listTemplates(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
      document_type: req.query.document_type,
    });
    return sendData(res, templates, {
      count: templates.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/documents', async (req, res) => {
  try {
    const rows = await isoDocumentGenerator.listDocuments(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
      document_type: req.query.document_type,
      status: req.query.status,
    });
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/summary', async (req, res) => {
  try {
    const rows = await isoDocumentGenerator.getSummary(req.params.tenantId, req.user);
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/generate', async (req, res) => {
  try {
    const data = await isoDocumentGenerator.generateDocument({
      tenantId: req.params.tenantId,
      user: req.user,
      payload: req.body || {},
    });
    return sendData(res, data, {
      success: true,
      document_id: data?.document?.id || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/documents/:documentId', async (req, res) => {
  try {
    const data = await isoDocumentGenerator.getDocumentDetail(
      req.params.tenantId,
      req.params.documentId,
      req.user
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/documents/:documentId/regenerate', async (req, res) => {
  try {
    const data = await isoDocumentGenerator.regenerateDocument(
      req.params.tenantId,
      req.params.documentId,
      req.user,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
      document_id: data?.document?.id || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/documents/:documentId/archive', async (req, res) => {
  try {
    const data = await isoDocumentGenerator.archiveDocument(
      req.params.tenantId,
      req.params.documentId,
      req.user
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
