'use strict';

const express = require('express');
const {
  updateOperation,
  setOperationStatus,
} = require('../services/tenantProcesses.service');

const router = express.Router();

function sendError(res, error) {
  const status = Number(error?.status || 500);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    code: error?.code || 'TENANT_OPERATION_ERROR',
    error: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
  });
}

router.put('/:id', async (req, res) => {
  try {
    const data = await updateOperation({ user: req.user, operationId: req.params.id, payload: req.body || {} });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const data = await setOperationStatus({
      user: req.user,
      operationId: req.params.id,
      isActive: req.body?.is_active,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
