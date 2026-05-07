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

module.exports = router;
