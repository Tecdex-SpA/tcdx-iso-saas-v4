const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { syncGoogleDriveSource } = require('../services/documentGoogleSync.service')

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null
}

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim()
}

function isSuperAdmin(user) {
  return ['superadmin', 'super_admin', 'admin_global', 'global_admin', 'platform_admin', 'owner'].includes(normalizeRole(user))
}

function canManage(user) {
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager'].includes(normalizeRole(user))
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true
  return String(getUserTenantId(req.user)) === String(tenantId)
}

function resolveTenantId(req) {
  return req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)
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
    return res.status(500).json({ error: 'Error sincronizando Google Drive' })
  }
})

module.exports = router
