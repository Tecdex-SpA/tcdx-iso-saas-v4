const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoCommandCenter = require('../services/isoCommandCenter.service');

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    ...data,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO COMMAND CENTER:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_COMMAND_CENTER_ERROR',
    error: error.message || 'Error procesando Command Center ISO',
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

router.get('/summary', async (req, res) => {
  try {
    const data = await isoCommandCenter.getSummary(req.user, filters(req));
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/standards', async (req, res) => {
  try {
    const data = await isoCommandCenter.getStandards(req.user, filters(req));
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/standards/:standard_code/:version_code', async (req, res) => {
  try {
    const data = await isoCommandCenter.getStandardDetail(
      req.user,
      req.params.standard_code,
      req.params.version_code,
      filters(req)
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/readiness', async (req, res) => {
  try {
    const data = await isoCommandCenter.getReadiness(req.user, filters(req));
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/activity', async (req, res) => {
  try {
    const data = await isoCommandCenter.getActivity(req.user, filters(req));
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
