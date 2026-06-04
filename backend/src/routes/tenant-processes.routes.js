'use strict';

const express = require('express');
const {
  listProcesses,
  getProcess,
  createProcess,
  updateProcess,
  setProcessStatus,
  listOperationsForProcess,
  createOperation,
} = require('../services/tenantProcesses.service');

const router = express.Router();

function sendError(res, error) {
  const status = Number(error?.status || 500);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    code: error?.code || 'TENANT_PROCESS_ERROR',
    error: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
  });
}

router.get('/', async (req, res) => {
  try {
    const data = await listProcesses({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await createProcess({ user: req.user, payload: req.body || {} });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getProcess({ user: req.user, processId: req.params.id });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await updateProcess({ user: req.user, processId: req.params.id, payload: req.body || {} });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const data = await setProcessStatus({
      user: req.user,
      processId: req.params.id,
      isActive: req.body?.is_active,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id/operations', async (req, res) => {
  try {
    const data = await listOperationsForProcess({
      user: req.user,
      processId: req.params.id,
      filters: req.query || {},
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/operations', async (req, res) => {
  try {
    const data = await createOperation({
      user: req.user,
      processId: req.params.id,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
