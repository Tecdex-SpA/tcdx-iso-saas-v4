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

function summarizeSuggestions(rows = []) {
  const canAutoApply = rows.filter((row) => row.can_auto_apply).length;
  const conflicts = rows.filter((row) => row.conflict_reason).length;

  return {
    candidates_total: rows.length,
    can_auto_apply: canAutoApply,
    would_apply: canAutoApply,
    applied: 0,
    skipped: Math.max(rows.length - canAutoApply, 0),
    conflicts,
  };
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
      success: true,
      min_confidence: req.query.min_confidence || '0.75',
      summary: summarizeSuggestions(rows),
      items: rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/review-queue', async (req, res) => {
  try {
    const includeAutoApplicable =
      String(req.query.include_auto_applicable || 'false').toLowerCase() === 'true';
    const rows = await isoControlMapping.getReviewQueue({
      standardCode: req.query.standard_code,
      versionCode: req.query.version_code,
      minConfidence: req.query.min_confidence,
      maxConfidence: req.query.max_confidence,
      includeAutoApplicable,
    });
    return sendData(res, rows, {
      success: true,
      include_auto_applicable: includeAutoApplicable,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/application-summary', async (req, res) => {
  try {
    const data = await isoControlMapping.getApplicationSummary();
    return sendData(res, data, {
      success: true,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/apply-suggestions', requireAdmin, async (req, res) => {
  try {
    const requestedRole = normalizeRole(
      req.user?.role ||
        req.user?.user_role ||
        req.user?.userRole ||
        ''
    );
    const data = await isoControlMapping.applySuggestions({
      standardCode: req.body?.standard_code,
      versionCode: req.body?.version_code,
      minConfidence: req.body?.min_confidence,
      dryRun: req.body?.dry_run !== false,
      requestedBy: req.user?.user_id || req.user?.id || null,
      requestedRole,
      requestPayload: {
        standard_code: req.body?.standard_code || null,
        version_code: req.body?.version_code || null,
        min_confidence: req.body?.min_confidence ?? null,
        dry_run: req.body?.dry_run !== false,
      },
    });
    return res.json({
      ok: true,
      success: true,
      ...data,
    });
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
