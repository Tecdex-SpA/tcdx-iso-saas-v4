const express = require('express');
const router = express.Router();
const { errorDetail } = require('../utils/errorResponse');
const isoControlMapping = require('../services/isoControlMapping.service');

const ADMIN_ROLES = new Set([
  'admin',
  'tenant_admin',
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

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
    console.error('ERROR ISO CONTROL MAPPING:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'ISO_CONTROL_MAPPING_ERROR',
    error: error.message || 'Error consultando mapeo ISO',
    ...errorDetail(error),
  });
}

function requireAdmin(req, res, next) {
  const role = normalizeRole(
    req.user?.role ||
      req.user?.user_role ||
      req.user?.userRole ||
      ''
  );

  if (!ADMIN_ROLES.has(role)) {
    return res.status(403).json({
      ok: false,
      code: 'RBAC_DENIED',
      error: 'Se requiere rol administrador para aplicar sugerencias',
    });
  }

  return next();
}

router.get('/coverage', async (req, res) => {
  try {
    const rows = await isoControlMapping.listCoverage({
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
    });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/unlinked-iso-controls', async (req, res) => {
  try {
    const rows = await isoControlMapping.listUnlinkedIsoControls({
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
    });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/unlinked-catalog-controls', async (req, res) => {
  try {
    const rows = await isoControlMapping.listUnlinkedCatalogControls({
      standard_code: req.query.standard_code,
      iso: req.query.iso,
    });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/catalog-links', async (req, res) => {
  try {
    const rows = await isoControlMapping.listCatalogLinks({
      standard_code: req.query.standard_code,
      version_code: req.query.version_code,
      relationship_type: req.query.relationship_type,
      min_confidence: req.query.min_confidence,
    });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const rows = await isoControlMapping.getMappingSuggestions({
      standardCode: req.query.standard_code,
      versionCode: req.query.version_code,
      minConfidence: req.query.min_confidence,
    });
    return sendData(res, rows, {
      min_confidence: req.query.min_confidence || '0.75',
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/apply-suggestions', requireAdmin, async (req, res) => {
  try {
    const data = await isoControlMapping.applySuggestions({
      standardCode: req.body?.standard_code,
      versionCode: req.body?.version_code,
      minConfidence: req.body?.min_confidence,
      dryRun: req.body?.dry_run !== false,
    });
    return sendData(res, data);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/sync-status', async (req, res) => {
  try {
    const rows = await isoControlMapping.listSyncStatus();
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
