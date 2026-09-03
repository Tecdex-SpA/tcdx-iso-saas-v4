const express = require('express');
const router = express.Router();
const isoRecommendedActions = require('../services/isoRecommendedActions.service');
const { requireCommercialCapability } = require('../middleware/commercialEntitlement.middleware');

const requireActionsRead = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.view',
  mode: 'read',
});
const requireActionsManage = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.manage',
  mode: 'write',
});

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
    console.error('ERROR ISO RECOMMENDED ACTIONS:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_RECOMMENDED_ACTIONS_ERROR',
    error: error.message || 'Error procesando acciones recomendadas ISO',
  });
}

router.get('/workflow-summary', requireActionsRead, async (req, res) => {
  try {
    const data = await isoRecommendedActions.getWorkflowSummary(req.user, req.query || {});
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id/workflow', requireActionsRead, async (req, res) => {
  try {
    const data = await isoRecommendedActions.getWorkflow(req.user, req.params.id, {
      tenant_id: req.query.tenant_id,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/workflow/transition', requireActionsManage, async (req, res) => {
  try {
    const data = await isoRecommendedActions.transitionWorkflow(
      req.user,
      req.params.id,
      req.body || {}
    );
    return sendData(res, data, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/workflow/comment', requireActionsManage, async (req, res) => {
  try {
    const data = await isoRecommendedActions.commentWorkflow(
      req.user,
      req.params.id,
      req.body || {}
    );
    return sendData(res, data, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id/conversion-options', requireActionsRead, async (req, res) => {
  try {
    const data = await isoRecommendedActions.getConversionOptions(req.user, req.params.id, {
      tenant_id: req.query.tenant_id,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/dry-run-convert', requireActionsRead, async (req, res) => {
  try {
    const data = await isoRecommendedActions.dryRunConvertRecommendation(
      req.user,
      req.params.id,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
      dry_run: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/convert', requireActionsManage, async (req, res) => {
  try {
    const data = await isoRecommendedActions.convertRecommendation(
      req.user,
      req.params.id,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
