const {
  isPlatformUser,
  isTenantAdminUser,
} = require('../services/auth/roleCompatibility.service');

const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { syncGoogleDriveSource } = require('../services/documentGoogleSync.service')

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null
}

function isSuperAdmin(user) {
  return isPlatformUser(user)
}

function canManage(user) {
  return isPlatformUser(user) || isTenantAdminUser(user)
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true
  return String(getUserTenantId(req.user)) === String(tenantId)
}

function resolveTenantId(req) {
  if (isSuperAdmin(req.user)) {
    return req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)
  }
  return getUserTenantId(req.user)
}

router.post('/sources/:sourceId/sync-google', auth, async (req, res) => {
  const tenantId = resolveTenantId(req)

  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' })
  if (!ensureTenantAccess(req, tenantId)) return res.status(403).json({ error: 'No autorizado para este tenant' })
  if (!canManage(req.user)) return res.status(403).json({ error: 'No autorizado para sincronizar fuentes documentales' })

  try {
    const result = await syncGoogleDriveSource({
      tenantId,
      sourceId: req.params.sourceId,
      maxDepth: req.body?.max_depth,
      maxFiles: req.body?.max_files,
      allowRoot: req.body?.allow_root === true
    })

    return res.json(result)
  } catch (err) {
    console.error('ERROR SYNC GOOGLE ROUTE:', err.message)
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'GOOGLE_DRIVE_SYNC_ERROR',
      error: err.statusCode ? err.message : 'Error sincronizando Google Drive'
    })
  }
})

module.exports = router
