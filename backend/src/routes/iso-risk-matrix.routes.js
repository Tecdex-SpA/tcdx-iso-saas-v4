const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoRiskMatrix = require('../services/isoRiskMatrix.service');

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO RISK MATRIX:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_RISK_MATRIX_ERROR',
    error: error.message || 'Error procesando matriz de riesgos ISO',
    ...errorDetail(error),
  });
}

router.get('/:tenantId/options', async (req, res) => {
  try {
    const options = await isoRiskMatrix.listOptions(req.params.tenantId, req.user);
    return sendData(res, {
      tenant_id: req.params.tenantId,
      options,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/generate', async (req, res) => {
  try {
    const data = await isoRiskMatrix.generateRiskMatrix({
      tenantId: req.params.tenantId,
      user: req.user,
      payload: req.body || {},
    });
    return sendData(res, data, {
      success: true,
      run_id: data?.run?.id || null,
      dry_run: data?.dry_run === true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/runs', async (req, res) => {
  try {
    const rows = await isoRiskMatrix.listRuns(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
      status: req.query.status,
    });
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/latest', async (req, res) => {
  try {
    const data = await isoRiskMatrix.getLatest(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/summary', async (req, res) => {
  try {
    const rows = await isoRiskMatrix.getSummary(req.params.tenantId, req.user);
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/runs/:runId', async (req, res) => {
  try {
    const data = await isoRiskMatrix.getRunDetail(
      req.params.tenantId,
      req.params.runId,
      req.user
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/runs/:runId/items', async (req, res) => {
  try {
    const rows = await isoRiskMatrix.listRunItems(
      req.params.tenantId,
      req.params.runId,
      req.user,
      {
        level: req.query.level,
        status: req.query.status,
        asset_id: req.query.asset_id,
      }
    );
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/runs/:runId/actions', async (req, res) => {
  try {
    const rows = await isoRiskMatrix.listRunActions(
      req.params.tenantId,
      req.params.runId,
      req.user
    );
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/items/:itemId/review', async (req, res) => {
  try {
    const data = await isoRiskMatrix.reviewItem(
      req.params.tenantId,
      req.params.itemId,
      req.user,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/:tenantId/items/:itemId/risk-inputs', async (req, res) => {
  try {
    const data = await isoRiskMatrix.updateItemRiskInputs(
      req.params.tenantId,
      req.params.itemId,
      req.user,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/runs/:runId/archive', async (req, res) => {
  try {
    const data = await isoRiskMatrix.archiveRun(
      req.params.tenantId,
      req.params.runId,
      req.user
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
