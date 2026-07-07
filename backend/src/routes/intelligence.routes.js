const express = require('express');
const { errorDetail } = require('../utils/errorResponse');
const intelligence = require('../services/intelligence/intelligence.service');

const router = express.Router();

function handleError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error('ERROR INTELLIGENCE:', error);
  }
  return res.status(status).json({
    ok: false,
    code: error.code || 'INTELLIGENCE_ERROR',
    error: error.message || 'Error construyendo Intelligence Brief',
    ...errorDetail(error),
  });
}

router.get('/brief/:tenantId', async (req, res) => {
  try {
    const data = await intelligence.buildTenantIntelligenceBrief({
      tenantId: req.params.tenantId,
      user: req.user,
      locale: req.query.locale || 'es',
      requestId: req.headers['x-request-id'] || req.query.request_id || null,
      bypassCache: req.query.refresh === '1' || req.query.bypass_cache === '1',
    });
    return res.json(data);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
