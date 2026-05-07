const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const dashboardV2 = require('../services/dashboardV2.service');

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR DASHBOARD V2:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'DASHBOARD_V2_ERROR',
    error: error.message || 'Error procesando Dashboard v2',
    ...errorDetail(error),
  });
}

router.get('/summary', async (req, res) => {
  try {
    const data = await dashboardV2.getSummary(req.user);
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const data = await dashboardV2.getPreferences(req.user, {
      dashboard_key: req.query.dashboard_key,
    });
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const data = await dashboardV2.savePreferences(req.user, req.body || {});
    return res.json({
      ok: true,
      ...data,
      data,
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/preferences', async (req, res) => {
  try {
    const data = await dashboardV2.resetPreferences(req.user, {
      dashboard_key: req.query.dashboard_key,
    });
    return res.json({
      ok: true,
      ...data,
      data,
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/preferences/reset', async (req, res) => {
  try {
    const data = await dashboardV2.resetPreferences(req.user, req.body || {});
    return res.json({
      ok: true,
      ...data,
      data,
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/actions', async (req, res) => {
  try {
    const data = await dashboardV2.getActions(req.user);
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/risks', async (req, res) => {
  try {
    const data = await dashboardV2.getRisks(req.user);
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/kpis', async (req, res) => {
  try {
    const data = await dashboardV2.getKpis(req.user);
    return res.json({
      ok: true,
      ...data,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const data = await dashboardV2.getAlerts(req.user);
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
