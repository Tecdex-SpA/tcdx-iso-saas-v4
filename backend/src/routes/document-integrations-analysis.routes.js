const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const {
  analyzeDocument,
  listDocumentAnalysis
} = require('../services/documentAiAnalysis.service')

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  )
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null
}

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '')
    .toLowerCase()
    .trim()
}

function isSuperAdmin(user) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner'
  ].includes(normalizeRole(user))
}

function canAnalyzeDocuments(user) {
  const role = normalizeRole(user)
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager', 'auditor'].includes(role)
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

function assertTenant(req, res) {
  const tenantId = resolveTenantId(req)

  if (!tenantId) {
    res.status(400).json({ error: 'tenant_id es obligatorio' })
    return null
  }

  if (!ensureTenantAccess(req, tenantId)) {
    res.status(403).json({ error: 'No autorizado para este tenant' })
    return null
  }

  return tenantId
}

router.post('/documents/:documentId/analyze', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canAnalyzeDocuments(req.user)) {
    return res.status(403).json({ error: 'No autorizado para analizar documentos' })
  }

  try {
    const result = await analyzeDocument({
      tenantId,
      documentId: req.params.documentId,
      userId: getUserId(req.user)
    })

    return res.json(result)
  } catch (err) {
    console.error('ERROR ANALYZE DOCUMENT:', err.message)
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'DOCUMENT_ANALYSIS_ERROR',
      error: err.statusCode ? err.message : 'Error analizando documento'
    })
  }
})

router.get('/documents/:documentId/analysis', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const analyses = await listDocumentAnalysis({
      tenantId,
      documentId: req.params.documentId,
      limit: req.query.limit || 20
    })

    return res.json({ analyses })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT ANALYSIS:', err.message)
    return res.status(500).json({ error: 'Error listando análisis documentales' })
  }
})

module.exports = router
