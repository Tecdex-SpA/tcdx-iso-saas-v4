const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoAuditor = require('../services/isoAuditor.service');

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO AUDITOR:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_AUDITOR_ERROR',
    error: error.message || 'Error procesando Auditor ISO',
    ...errorDetail(error),
  });
}

function filters(req) {
  return {
    tenant_id: req.query.tenant_id,
    standard_code: req.query.standard_code,
    version_code: req.query.version_code,
  };
}

router.get('/preview', async (req, res) => {
  try {
    const data = await isoAuditor.getPreview(req.user, filters(req));
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
