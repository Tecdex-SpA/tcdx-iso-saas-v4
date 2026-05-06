const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoKnowledge = require('../services/isoKnowledge.service');

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    count: Array.isArray(data) ? data.length : undefined,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR ISO KNOWLEDGE:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_KNOWLEDGE_ERROR',
    error: error.message || 'Error consultando base de conocimiento ISO',
    ...errorDetail(error),
  });
}

router.get('/standards', async (req, res) => {
  try {
    const rows = await isoKnowledge.listStandards();
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/standards/:standardCode/versions', async (req, res) => {
  try {
    const rows = await isoKnowledge.listVersions(req.params.standardCode);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/crosswalks', async (req, res) => {
  try {
    const rows = await isoKnowledge.listCrosswalks({
      source_standard_code: req.query.source_standard_code,
      source_version_code: req.query.source_version_code,
      target_standard_code: req.query.target_standard_code,
      target_version_code: req.query.target_version_code,
    });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/transition/iso9001-2026', async (req, res) => {
  try {
    const data = await isoKnowledge.getIso9001TransitionGuidance();
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/sync-status', async (req, res) => {
  try {
    const rows = await isoKnowledge.listSyncStatus();
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/clauses', async (req, res) => {
  try {
    const rows = await isoKnowledge.listClauses(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/controls', async (req, res) => {
  try {
    const rows = await isoKnowledge.listControls(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/evidence-expectations', async (req, res) => {
  try {
    const rows = await isoKnowledge.listEvidenceExpectations(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/policy-templates', async (req, res) => {
  try {
    const rows = await isoKnowledge.listPolicyTemplates(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/procedure-templates', async (req, res) => {
  try {
    const rows = await isoKnowledge.listProcedureTemplates(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/risk-templates', async (req, res) => {
  try {
    const rows = await isoKnowledge.listRiskTemplates(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/audit-questions', async (req, res) => {
  try {
    const rows = await isoKnowledge.listAuditQuestions(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/gap-rules', async (req, res) => {
  try {
    const rows = await isoKnowledge.listGapRules(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/maturity-rules', async (req, res) => {
  try {
    const rows = await isoKnowledge.listMaturityRules(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/ai-guidance', async (req, res) => {
  try {
    const rows = await isoKnowledge.listAiGuidance(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:standardCode/:version/catalog-links', async (req, res) => {
  try {
    const rows = await isoKnowledge.listCatalogLinks(req.params.standardCode, req.params.version);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
