const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  browseGoogleDriveFolders,
} = require('../services/documentGoogleFolders.service');

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '')
    .toLowerCase()
    .trim();
}

function isSuperAdmin(user) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(normalizeRole(user));
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

function resolveTenantId(req) {
  if (isSuperAdmin(req.user)) {
    return req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user);
  }
  return getUserTenantId(req.user);
}

router.get('/google/folders', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);

  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id es obligatorio' });
  }

  if (!ensureTenantAccess(req, tenantId)) {
    return res.status(403).json({ error: 'No autorizado para este tenant' });
  }

  const integrationId = req.query.integration_id;
  const parentId = req.query.parent_id || 'root';
  const pageToken = req.query.page_token || null;

  if (!integrationId) {
    return res.status(400).json({ error: 'integration_id es obligatorio' });
  }

  try {
    const result = await browseGoogleDriveFolders({
      tenantId,
      integrationId,
      parentId,
      pageToken,
    });

    return res.json(result);
  } catch (err) {
    console.error('ERROR LIST GOOGLE DRIVE FOLDERS:', err.message);

    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'GOOGLE_FOLDERS_LIST_ERROR',
      error: err.statusCode ? err.message : 'Error listando carpetas de Google Drive',
    });
  }
});

module.exports = router;
