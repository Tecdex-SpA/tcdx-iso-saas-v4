const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoExpressDiagnostic = require('../services/isoExpressDiagnostic.service');

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
    console.error('ERROR ISO EXPRESS DIAGNOSTIC:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_EXPRESS_DIAGNOSTIC_ERROR',
    error: error.message || 'Error procesando diagnostico ISO Express',
    ...errorDetail(error),
  });
}

router.get('/options/:tenantId', async (req, res) => {
  try {
    const options = await isoExpressDiagnostic.getAssessmentOptions(
      req.params.tenantId,
      req.user
    );
    return sendData(res, {
      tenant_id: req.params.tenantId,
      options,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/calculate', async (req, res) => {
  try {
    const data = await isoExpressDiagnostic.calculateAssessment({
      tenantId: req.params.tenantId,
      user: req.user,
      standardCode: req.body?.standard_code,
      versionCode: req.body?.version_code,
      assessmentType: req.body?.assessment_type,
      answers: req.body?.answers || [],
    });

    return sendData(res, data, {
      success: true,
      assessment_id: data?.assessment?.id || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/latest', async (req, res) => {
  try {
    const rows = await isoExpressDiagnostic.listLatestAssessments(
      req.params.tenantId,
      req.user,
      {
        standard_code: req.query.standard_code,
        version_code: req.query.version_code,
      }
    );
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/readiness', async (req, res) => {
  try {
    const data = await isoExpressDiagnostic.getReadiness(req.params.tenantId, req.user, {
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/:assessmentId/gaps', async (req, res) => {
  try {
    const rows = await isoExpressDiagnostic.listGaps(
      req.params.tenantId,
      req.params.assessmentId,
      req.user
    );
    return sendData(res, rows, {
      count: rows.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/:assessmentId/plan', async (req, res) => {
  try {
    const data = await isoExpressDiagnostic.getPlan(
      req.params.tenantId,
      req.params.assessmentId,
      req.user
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tenantId/:assessmentId/archive', async (req, res) => {
  try {
    const data = await isoExpressDiagnostic.archiveAssessment(
      req.params.tenantId,
      req.params.assessmentId,
      req.user
    );
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tenantId/:assessmentId', async (req, res) => {
  try {
    const data = await isoExpressDiagnostic.getAssessmentDetail(
      req.params.tenantId,
      req.params.assessmentId,
      req.user
    );
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
