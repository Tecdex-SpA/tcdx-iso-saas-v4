const express = require('express');
const pool = require('../config/db');
const { Phase2Error, createPhase2Service } = require('../services/grc/phase2.service');

const router = express.Router();
const service = createPhase2Service(pool);

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

function sendError(req, res, error) {
  if (error instanceof Phase2Error) {
    return res.status(error.status).json({
      ok: false,
      code: error.code,
      error: error.message,
      request_id: req.requestId || null,
    });
  }
  console.error(JSON.stringify({
    event: 'PHASE2_EXTERNAL_ERROR',
    request_id: req.requestId || null,
    error_code: error?.code || 'PHASE2_EXTERNAL_INTERNAL_ERROR',
  }));
  return res.status(500).json({
    ok: false,
    code: 'PHASE2_EXTERNAL_INTERNAL_ERROR',
    error: 'No fue posible procesar la solicitud externa.',
    request_id: req.requestId || null,
  });
}

router.get('/oauth/callback', async (req, res) => {
  try {
    const data = await service.completeConnectorOAuth({
      state: req.query?.state,
      code: req.query?.code,
    });
    return res.json({ ok: true, data, request_id: req.requestId || null });
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/webhooks/:integrationId', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const data = await service.ingestConnectorWebhook({
      integrationId: req.params.integrationId,
      signature: req.get('X-TCDX-Signature') || req.get('X-Hub-Signature-256'),
      eventType: req.get('X-TCDX-Event') || req.get('X-GitHub-Event'),
      rawBody,
    });
    return res.json({ ok: true, data, request_id: req.requestId || null });
  } catch (error) {
    return sendError(req, res, error);
  }
});

module.exports = router;
