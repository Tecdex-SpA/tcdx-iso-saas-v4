const express = require('express');
const { errorDetail } = require('../utils/errorResponse');
const repository = require('../services/knowledge-base/knowledge.repository');
const knowledge = require('../services/knowledge-base/knowledge.service');

const router = express.Router();

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    count: Array.isArray(data) ? data.length : undefined,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error('ERROR KNOWLEDGE BASE:', error);
  }
  return res.status(status).json({
    ok: false,
    code: error.code || 'KNOWLEDGE_BASE_ERROR',
    error: error.message || 'Error consultando Knowledge Base',
    ...errorDetail(error),
  });
}

router.get('/search', async (req, res) => {
  try {
    const rows = await knowledge.searchKnowledge(req.query, { limit: req.query.limit });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/standards', async (_req, res) => {
  try {
    const rows = await repository.listStandards();
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rows = await repository.listRules(req.query);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
