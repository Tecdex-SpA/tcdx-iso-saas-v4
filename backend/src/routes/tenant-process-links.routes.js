'use strict';

const express = require('express');
const {
  listLinks,
  listByProcess,
  listByOperation,
  listCandidates,
  createLink,
  setLinkStatus,
} = require('../services/tenantProcessLinks.service');

const router = express.Router();

function sendError(res, error) {
  const status = Number(error?.status || 500);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    code: error?.code || 'TENANT_PROCESS_LINK_ERROR',
    error: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
  });
}

router.get('/', async (req, res) => {
  try {
    const data = await listLinks({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/by-process/:processId', async (req, res) => {
  try {
    const data = await listByProcess({
      user: req.user,
      processId: req.params.processId,
      filters: req.query || {},
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/by-operation/:operationId', async (req, res) => {
  try {
    const data = await listByOperation({
      user: req.user,
      operationId: req.params.operationId,
      filters: req.query || {},
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/candidates/:targetType', async (req, res) => {
  try {
    const data = await listCandidates({
      user: req.user,
      targetType: req.params.targetType,
      search: req.query?.search || '',
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await createLink({ user: req.user, payload: req.body || {} });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id/deactivate', async (req, res) => {
  try {
    const data = await setLinkStatus({ user: req.user, linkId: req.params.id, isActive: false });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id/reactivate', async (req, res) => {
  try {
    const data = await setLinkStatus({ user: req.user, linkId: req.params.id, isActive: true });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
