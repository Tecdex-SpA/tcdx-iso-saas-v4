'use strict';

const express = require('express');
const isoScopeRecommendation = require('../services/isoScopeRecommendation.service');

const router = express.Router();

function sendError(res, error) {
  const status = Number(error?.status || 500);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    code: error?.code || 'ISO_SCOPE_RECOMMENDATION_ERROR',
    error: status >= 500
      ? 'No fue posible generar la recomendación de alcance ISO.'
      : error.message,
    details: status >= 500 ? null : error.details || null,
  });
}

router.post('/recommendations', async (req, res) => {
  try {
    const data = await isoScopeRecommendation.buildRecommendations({
      user: req.user,
      payload: req.body || {},
      requestedTenantId: req.query?.tenant_id || null,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
