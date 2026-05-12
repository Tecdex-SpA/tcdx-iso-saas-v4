const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const auth = require('../middleware/auth')

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

function canManageDocumentIntegrations(user) {
  const role = normalizeRole(user)
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager'].includes(role)
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true
  return String(getUserTenantId(req.user)) === String(tenantId)
}

function resolveTenantId(req) {
  return req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)
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

const providerCards = [
  {
    provider: 'google_drive',
    label: 'Google Drive',
    status: 'prepared',
    phase: 'Etapa 1',
    read_only: true,
    oauth_ready: false,
    description: 'Proveedor preparado para conexión OAuth2 e indexación documental en Etapa 2.'
  },
  {
    provider: 'onedrive',
    label: 'Microsoft OneDrive',
    status: 'roadmap',
    phase: 'Etapa 5',
    read_only: true,
    oauth_ready: false,
    description: 'Proveedor preparado conceptualmente para Microsoft Graph.'
  },
  {
    provider: 'sharepoint',
    label: 'Microsoft SharePoint',
    status: 'roadmap',
    phase: 'Etapa 5',
    read_only: true,
    oauth_ready: false,
    description: 'Proveedor recomendado para clientes Microsoft 365 corporativos.'
  }
]

router.get('/providers', auth, async (_req, res) => {
  return res.json({ providers: providerCards })
})

router.get('/integrations', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        provider,
        status,
        display_name,
        provider_account_email,
        scopes,
        metadata_json,
        created_at,
        updated_at,
        last_sync_at,
        disconnected_at
      FROM tenant_integrations
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenantId]
    )

    return res.json({ integrations: result.rows })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT INTEGRATIONS:', err)
    return res.status(500).json({ error: 'Error listando integraciones documentales' })
  }
})

router.post('/integrations/prepared', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para configurar integraciones documentales' })
  }

  const provider = String(req.body?.provider || '').trim()
  const displayName = String(req.body?.display_name || '').trim() || null

  if (!['google_drive', 'microsoft_graph', 'onedrive', 'sharepoint'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor documental no soportado' })
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO tenant_integrations (
        tenant_id,
        provider,
        status,
        display_name,
        connected_by_user_id,
        metadata_json
      )
      VALUES ($1, $2, 'prepared', $3, $4, $5::jsonb)
      RETURNING
        id,
        tenant_id,
        provider,
        status,
        display_name,
        metadata_json,
        created_at,
        updated_at
      `,
      [
        tenantId,
        provider,
        displayName,
        getUserId(req.user),
        JSON.stringify({ stage: 'etapa_1_prepared_only', oauth_real_enabled: false })
      ]
    )

    return res.status(201).json({ integration: result.rows[0] })
  } catch (err) {
    console.error('ERROR CREATE PREPARED DOCUMENT INTEGRATION:', err)
    return res.status(500).json({ error: 'Error preparando integración documental' })
  }
})

router.post('/integrations/:integrationId/disconnect', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para desconectar integraciones documentales' })
  }

  try {
    const result = await pool.query(
      `
      UPDATE tenant_integrations
      SET
        status = 'disconnected',
        encrypted_access_token = NULL,
        encrypted_refresh_token = NULL,
        token_expires_at = NULL,
        disconnected_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      RETURNING id, tenant_id, provider, status, disconnected_at
      `,
      [req.params.integrationId, tenantId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Integración no encontrada' })
    }

    return res.json({ integration: result.rows[0] })
  } catch (err) {
    console.error('ERROR DISCONNECT DOCUMENT INTEGRATION:', err)
    return res.status(500).json({ error: 'Error desconectando integración documental' })
  }
})

router.get('/sources', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const result = await pool.query(
      `
      SELECT
        s.*,
        i.status AS integration_status,
        i.display_name AS integration_display_name
      FROM tenant_document_sources s
      LEFT JOIN tenant_integrations i
        ON i.id = s.integration_id
       AND i.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1
      ORDER BY s.created_at DESC
      `,
      [tenantId]
    )

    return res.json({ sources: result.rows })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT SOURCES:', err)
    return res.status(500).json({ error: 'Error listando fuentes documentales' })
  }
})

router.post('/sources', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para crear fuentes documentales' })
  }

  const {
    integration_id,
    provider,
    source_name,
    folder_id,
    folder_path,
    scan_frequency
  } = req.body || {}

  if (!provider || !source_name) {
    return res.status(400).json({ error: 'provider y source_name son obligatorios' })
  }

  if (!['google_drive', 'microsoft_graph', 'onedrive', 'sharepoint'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor documental no soportado' })
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO tenant_document_sources (
        tenant_id,
        integration_id,
        provider,
        source_name,
        folder_id,
        folder_path,
        scan_frequency,
        created_by_user_id,
        metadata_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, 'manual'),$8,$9::jsonb)
      RETURNING *
      `,
      [
        tenantId,
        integration_id || null,
        provider,
        source_name,
        folder_id || null,
        folder_path || null,
        scan_frequency || 'manual',
        getUserId(req.user),
        JSON.stringify({ stage: 'etapa_1_manual_source_registration' })
      ]
    )

    return res.status(201).json({ source: result.rows[0] })
  } catch (err) {
    console.error('ERROR CREATE DOCUMENT SOURCE:', err)
    return res.status(500).json({ error: 'Error creando fuente documental' })
  }
})

router.get('/documents', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  const provider = req.query.provider || null
  const sourceId = req.query.source_id || null
  const status = req.query.status || null
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))

  try {
    const params = [tenantId]
    let idx = 2
    let where = 'WHERE d.tenant_id = $1'

    if (provider) {
      where += ` AND d.provider = $${idx}`
      params.push(provider)
      idx += 1
    }

    if (sourceId) {
      where += ` AND d.source_id = $${idx}`
      params.push(sourceId)
      idx += 1
    }

    if (status) {
      where += ` AND d.status = $${idx}`
      params.push(status)
      idx += 1
    }

    params.push(limit)

    const result = await pool.query(
      `
      SELECT
        d.*,
        s.source_name,
        i.display_name AS integration_display_name
      FROM document_index d
      LEFT JOIN tenant_document_sources s
        ON s.id = d.source_id
       AND s.tenant_id = d.tenant_id
      LEFT JOIN tenant_integrations i
        ON i.id = d.integration_id
       AND i.tenant_id = d.tenant_id
      ${where}
      ORDER BY d.indexed_at DESC
      LIMIT $${idx}
      `,
      params
    )

    return res.json({ documents: result.rows })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT INDEX:', err)
    return res.status(500).json({ error: 'Error listando documentos indexados' })
  }
})

router.get('/suggestions', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  const status = req.query.status || 'pending'
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))

  try {
    const result = await pool.query(
      `
      SELECT
        s.*,
        d.file_name,
        d.provider,
        d.web_view_url,
        d.mime_type
      FROM document_association_suggestions s
      JOIN document_index d
        ON d.id = s.document_id
       AND d.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1
        AND ($2::text IS NULL OR s.status = $2::text)
      ORDER BY s.created_at DESC
      LIMIT $3
      `,
      [tenantId, status || null, limit]
    )

    return res.json({ suggestions: result.rows })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT SUGGESTIONS:', err)
    return res.status(500).json({ error: 'Error listando sugerencias documentales' })
  }
})


router.post('/suggestions/:suggestionId/approve', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para revisar sugerencias documentales' })
  }

  try {
    const result = await pool.query(
      `
      UPDATE document_association_suggestions
      SET
        status = 'approved',
        reviewed_by_user_id = $3,
        reviewed_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
        AND status = 'pending'
      RETURNING *
      `,
      [req.params.suggestionId, tenantId, getUserId(req.user)]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sugerencia pendiente no encontrada' })
    }

    return res.json({ suggestion: result.rows[0] })
  } catch (err) {
    console.error('ERROR APPROVE DOCUMENT SUGGESTION:', err)
    return res.status(500).json({ error: 'Error aprobando sugerencia documental' })
  }
})

router.post('/suggestions/:suggestionId/reject', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para revisar sugerencias documentales' })
  }

  try {
    const result = await pool.query(
      `
      UPDATE document_association_suggestions
      SET
        status = 'rejected',
        reviewed_by_user_id = $3,
        reviewed_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
        AND status = 'pending'
      RETURNING *
      `,
      [req.params.suggestionId, tenantId, getUserId(req.user)]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sugerencia pendiente no encontrada' })
    }

    return res.json({ suggestion: result.rows[0] })
  } catch (err) {
    console.error('ERROR REJECT DOCUMENT SUGGESTION:', err)
    return res.status(500).json({ error: 'Error rechazando sugerencia documental' })
  }
})

router.post('/sources/:sourceId/sync', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para sincronizar fuentes documentales' })
  }

  try {
    const source = await pool.query(
      `
      SELECT *
      FROM tenant_document_sources
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [req.params.sourceId, tenantId]
    )

    if (source.rowCount === 0) {
      return res.status(404).json({ error: 'Fuente documental no encontrada' })
    }

    const log = await pool.query(
      `
      INSERT INTO document_sync_logs (
        tenant_id,
        source_id,
        integration_id,
        provider,
        status,
        started_at,
        finished_at,
        files_seen,
        files_indexed,
        files_updated,
        files_skipped,
        details_json
      )
      VALUES ($1,$2,$3,$4,'completed_with_warnings',NOW(),NOW(),0,0,0,0,$5::jsonb)
      RETURNING *
      `,
      [
        tenantId,
        source.rows[0].id,
        source.rows[0].integration_id,
        source.rows[0].provider,
        JSON.stringify({
          stage: 'etapa_1_stub',
          message: 'Sincronización real se implementa en Etapa 2 con OAuth Google Drive.'
        })
      ]
    )

    return res.json({
      ok: true,
      stage: 'etapa_1_stub',
      message: 'Fuente válida. La sincronización real queda para Etapa 2.',
      sync_log: log.rows[0]
    })
  } catch (err) {
    console.error('ERROR STUB DOCUMENT SYNC:', err)
    return res.status(500).json({ error: 'Error registrando sincronización documental' })
  }
})

router.get('/sync-logs', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const result = await pool.query(
      `
      SELECT l.*, s.source_name
      FROM document_sync_logs l
      LEFT JOIN tenant_document_sources s
        ON s.id = l.source_id
       AND s.tenant_id = l.tenant_id
      WHERE l.tenant_id = $1
      ORDER BY l.started_at DESC
      LIMIT 100
      `,
      [tenantId]
    )

    return res.json({ logs: result.rows })
  } catch (err) {
    console.error('ERROR LIST DOCUMENT SYNC LOGS:', err)
    return res.status(500).json({ error: 'Error listando logs de sincronización documental' })
  }
})

module.exports = router
