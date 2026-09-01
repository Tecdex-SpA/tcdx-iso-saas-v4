const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoOperationalExecution = require('../services/isoOperationalExecution.service');
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
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO OPERATIONAL EXECUTION:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_OPERATIONAL_EXECUTION_ERROR',
    error: error.message || 'Error procesando ejecucion operativa ISO',
    ...errorDetail(error),
  });
}

router.get('/summary', requireActionsRead, async (req, res) => {
  try {
    const data = await isoOperationalExecution.getSummary(req.user, {
      tenant_id: req.query.tenant_id,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/suggestions', requireActionsRead, async (req, res) => {
  try {
    const rows = await isoOperationalExecution.listSuggestions(req.user, {
      tenant_id: req.query.tenant_id,
      standard_code: req.query.standard_code,
      status: req.query.status,
      priority: req.query.priority,
      suggestion_type: req.query.suggestion_type,
      target_record_type: req.query.target_record_type,
    });
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/generate', requireActionsManage, async (req, res) => {
  try {
    const data = await isoOperationalExecution.generateSuggestions({
      user: req.user,
      tenantId: req.body?.tenant_id,
      filters: {
        standard_code: req.body?.standard_code,
        source_module: req.body?.source_module,
        tenant_id: req.body?.tenant_id,
      },
      dryRun: req.body?.dry_run === true,
    });
    return sendData(res, data, {
      success: true,
      dry_run: data?.dry_run === true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', requireActionsRead, async (req, res) => {
  try {
    const data = await isoOperationalExecution.getSuggestion(
      req.user,
      req.params.id,
      req.query.tenant_id || null
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/approve', requireActionsManage, async (req, res) => {
  try {
    const data = await isoOperationalExecution.approveSuggestion(
      req.user,
      req.params.id,
      req.body || {}
    );
    return sendData(res, data, {
      success: true,
      dry_run: data?.dry_run === true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/reject', requireActionsManage, async (req, res) => {
  try {
    const data = await isoOperationalExecution.rejectSuggestion(
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
