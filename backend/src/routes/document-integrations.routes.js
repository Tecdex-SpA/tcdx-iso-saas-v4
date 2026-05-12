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



function baseStandardCodeFromSuggestion(value) {
  const raw = String(value || '').toUpperCase().trim()

  if (!raw) return ''

  if (raw.includes('9001')) return 'ISO9001'
  if (raw.includes('27001')) return 'ISO27001'
  if (raw.includes('42001')) return 'ISO42001'

  return raw
    .replace(/:20\d{2}/g, '')
    .replace(/\s+/g, '')
    .replace(/\//g, '')
}

function normalizeSuggestionStatus(value) {
  return String(value || '').toLowerCase().trim()
}

async function resolveTenantControlForDocumentSuggestion(client, {
  tenantId,
  suggestedStandardCode,
  suggestedControlRef
}) {
  const baseStandard = baseStandardCodeFromSuggestion(suggestedStandardCode)
  const controlRef = String(suggestedControlRef || '').trim()

  if (!baseStandard || !controlRef) return null

  const result = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      cc.iso,
      COALESCE(ccs.standard_code, cc.iso) AS standard_code,
      COALESCE(ccs.clause, cc.clause) AS clause,
      cc.description AS control_description,
      cc.category,
      op.name AS operation_name,
      op.code AS operation_code,
      op.operation_type
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
     AND cc.is_active = TRUE
    LEFT JOIN controls_catalog_standards ccs
      ON ccs.control_id = cc.id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    WHERE tc.tenant_id = $1::uuid
      AND (
        UPPER(REPLACE(REPLACE(COALESCE(ccs.standard_code, cc.iso, ''), '/', ''), ' ', '')) = $2
        OR UPPER(REPLACE(REPLACE(COALESCE(cc.iso, ''), '/', ''), ' ', '')) = $2
      )
      AND (
        COALESCE(ccs.clause, cc.clause, '') = $3
        OR cc.clause = $3
        OR cc.description ILIKE '%' || $3 || '%'
      )
    ORDER BY
      CASE WHEN COALESCE(ccs.clause, cc.clause, '') = $3 THEN 0 ELSE 1 END,
      COALESCE(op.is_default, false) DESC,
      COALESCE(op.sort_order, 9999) ASC,
      tc.created_at ASC
    LIMIT 1
    `,
    [tenantId, baseStandard, controlRef]
  )

  return result.rows[0] || null
}

async function createEvidenceFromApprovedDocumentSuggestion(client, {
  tenantId,
  suggestionId,
  userId
}) {
  const current = await client.query(
    `
    SELECT
      s.*,
      d.file_name,
      d.file_url,
      d.web_view_url,
      d.mime_type,
      d.file_extension,
      d.size_bytes,
      d.provider,
      d.source_id,
      d.integration_id,
      d.provider_file_id,
      d.provider_version_id,
      d.modified_at,
      d.metadata_json AS document_metadata_json,
      src.source_name,
      src.folder_path
    FROM document_association_suggestions s
    JOIN document_index d
      ON d.id = s.document_id
     AND d.tenant_id = s.tenant_id
    LEFT JOIN tenant_document_sources src
      ON src.id = d.source_id
     AND src.tenant_id = d.tenant_id
    WHERE s.id = $1::uuid
      AND s.tenant_id = $2::uuid
      AND s.target_type = 'control'
    LIMIT 1
    `,
    [suggestionId, tenantId]
  )

  if (current.rowCount === 0) {
    const err = new Error('Sugerencia documental no encontrada')
    err.statusCode = 404
    throw err
  }

  const suggestion = current.rows[0]
  const status = normalizeSuggestionStatus(suggestion.status)

  if (status !== 'approved') {
    const err = new Error('La sugerencia debe estar aprobada antes de crear evidencia formal')
    err.statusCode = 409
    throw err
  }

  const resolvedControl = await resolveTenantControlForDocumentSuggestion(client, {
    tenantId,
    suggestedStandardCode: suggestion.suggested_standard_code,
    suggestedControlRef: suggestion.suggested_control_ref
  })

  if (!resolvedControl) {
    const err = new Error('No fue posible resolver un control activo del tenant para esta sugerencia')
    err.statusCode = 422
    throw err
  }

  const existing = await client.query(
    `
    SELECT id
    FROM evidences
    WHERE tenant_id = $1::uuid
      AND metadata->>'source_document_id' = $2
      AND metadata->>'source_suggestion_id' = $3
    LIMIT 1
    `,
    [tenantId, suggestion.document_id, suggestion.id]
  )

  if (existing.rowCount > 0) {
    const evidence = await client.query(
      `SELECT * FROM evidences WHERE id = $1::uuid LIMIT 1`,
      [existing.rows[0].id]
    )

    return {
      evidence: evidence.rows[0],
      created: false,
      already_exists: true,
      resolved_control: resolvedControl
    }
  }

  const metadata = {
    source: 'document_integration',
    source_document_id: suggestion.document_id,
    source_suggestion_id: suggestion.id,
    source_provider: suggestion.provider || null,
    source_id: suggestion.source_id || null,
    source_name: suggestion.source_name || null,
    folder_path: suggestion.folder_path || null,
    provider_file_id: suggestion.provider_file_id || null,
    provider_version_id: suggestion.provider_version_id || null,
    web_view_url: suggestion.web_view_url || suggestion.file_url || null,
    document_modified_at: suggestion.modified_at || null,
    suggested_standard_code: suggestion.suggested_standard_code || null,
    suggested_control_ref: suggestion.suggested_control_ref || null,
    suggested_reason: suggestion.suggested_reason || null,
    suggestion_confidence_score: suggestion.confidence_score || null,
    promoted_by_user_id: userId || null,
    promoted_at: new Date().toISOString(),
    iso: resolvedControl.standard_code || resolvedControl.iso || null,
    clause: resolvedControl.clause || suggestion.suggested_control_ref || null,
    control_description: resolvedControl.control_description || null,
    operation_id: resolvedControl.operation_id || null,
    operation_name: resolvedControl.operation_name || null,
    operation_code: resolvedControl.operation_code || null,
    operation_type: resolvedControl.operation_type || null,
    human_review_required: true,
    no_auto_approval: true
  }

  const description = [
    `Evidencia documental integrada desde Google Drive: ${suggestion.file_name || 'documento sin nombre'}.`,
    suggestion.suggested_reason ? `Motivo IA: ${suggestion.suggested_reason}` : null,
    'Creada desde sugerencia aprobada; requiere aprobación humana antes de impactar cumplimiento.'
  ].filter(Boolean).join('\n')

  const inserted = await client.query(
    `
    INSERT INTO evidences (
      tenant_id,
      control_id,
      tenant_control_id,
      description,
      file_name,
      file_path,
      file_mime_type,
      file_size_bytes,
      status,
      validated,
      expires_at,
      evidence_type,
      metadata,
      content_fingerprint,
      document_extraction_status,
      ai_analysis_status
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4,
      $5,
      NULL,
      $6,
      $7,
      'pendiente',
      false,
      NULL,
      'documento_integrado',
      $8::jsonb,
      md5(COALESCE($1::text,'') || '|' || COALESCE($5,'') || '|' || COALESCE($9::text,'')),
      'external_reference',
      'pending'
    )
    RETURNING *
    `,
    [
      tenantId,
      resolvedControl.catalog_control_id,
      resolvedControl.tenant_control_id,
      description,
      suggestion.file_name || null,
      suggestion.mime_type || null,
      suggestion.size_bytes || null,
      JSON.stringify(metadata),
      suggestion.document_id
    ]
  )

  await client.query(
    `
    UPDATE document_association_suggestions
    SET
      status = 'superseded',
      reviewed_at = COALESCE(reviewed_at, NOW()),
      reviewed_by_user_id = COALESCE(reviewed_by_user_id, $3::uuid)
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    `,
    [suggestionId, tenantId, userId || null]
  )

  return {
    evidence: inserted.rows[0],
    created: true,
    already_exists: false,
    resolved_control: resolvedControl
  }
}

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
  const q = String(req.query.q || '').trim()
  const includeFolders = String(req.query.include_folders || 'false').toLowerCase() === 'true'
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)))

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

    if (q) {
      where += ` AND (d.file_name ILIKE $${idx} OR d.mime_type ILIKE $${idx} OR d.file_extension ILIKE $${idx})`
      params.push(`%${q}%`)
      idx += 1
    }

    if (!includeFolders) {
      where += `
        AND COALESCE(d.mime_type, '') <> 'application/vnd.google-apps.folder'
        AND COALESCE(d.metadata_json->'google'->>'is_folder', 'false') <> 'true'
      `
    }

    params.push(limit)

    const result = await pool.query(
      `
      SELECT
        d.*,
        s.source_name,
        i.display_name AS integration_display_name,
        d.metadata_json->'google'->>'folder_path' AS folder_path
      FROM document_index d
      LEFT JOIN tenant_document_sources s
        ON s.id = d.source_id
       AND s.tenant_id = d.tenant_id
      LEFT JOIN tenant_integrations i
        ON i.id = d.integration_id
       AND i.tenant_id = d.tenant_id
      ${where}
      ORDER BY d.indexed_at DESC NULLS LAST, d.modified_at DESC NULLS LAST
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


router.post('/suggestions/:suggestionId/create-evidence', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para crear evidencia desde sugerencias documentales' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await createEvidenceFromApprovedDocumentSuggestion(client, {
      tenantId,
      suggestionId: req.params.suggestionId,
      userId: getUserId(req.user)
    })

    await client.query('COMMIT')

    return res.status(result.created ? 201 : 200).json({
      ok: true,
      created: result.created,
      already_exists: result.already_exists,
      evidence: result.evidence,
      resolved_control: result.resolved_control,
      message: result.created
        ? 'Evidencia formal creada en estado pendiente. Requiere aprobación humana para impactar cumplimiento.'
        : 'La evidencia ya existía para esta sugerencia.'
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR CREATE EVIDENCE FROM DOCUMENT SUGGESTION:', err)

    return res.status(err.statusCode || 500).json({
      error: err.message || 'Error creando evidencia desde sugerencia documental'
    })
  } finally {
    client.release()
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



// =========================================================
// Evidencias integradas creadas desde sugerencias documentales
// =========================================================
function tcdxIntegratedGetUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  )
}

function tcdxIntegratedNormalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim()
}

function tcdxIntegratedIsSuperAdmin(user) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner'
  ].includes(tcdxIntegratedNormalizeRole(user))
}

function tcdxIntegratedHasTenantAccess(req, tenantId) {
  if (tcdxIntegratedIsSuperAdmin(req.user)) return true
  return String(tcdxIntegratedGetUserTenantId(req.user)) === String(tenantId)
}

router.get('/integrated-evidences', auth, async (req, res) => {
  try {
    const tenantId = req.query.tenant_id
    const status = String(req.query.status || '').trim().toLowerCase()
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)))

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' })
    }

    if (!tcdxIntegratedHasTenantAccess(req, tenantId)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    const params = [tenantId]
    let idx = 2

    let where = `
      e.tenant_id = $1::uuid
      AND e.evidence_type = 'documento_integrado'
    `

    if (status) {
      where += ` AND LOWER(COALESCE(e.status, '')) = $${idx}::text`
      params.push(status)
      idx += 1
    }

    params.push(limit)

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.tenant_id,
        e.control_id,
        e.tenant_control_id,
        e.description,
        e.file_name,
        e.file_path,
        e.file_mime_type,
        e.file_size_bytes,
        e.status,
        e.validated,
        e.evidence_type,
        e.created_at,
        e.reviewed_by,
        e.reviewed_at,
        e.rejection_reason,
        e.metadata,
        e.metadata->>'source_document_id' AS source_document_id,
        e.metadata->>'source_suggestion_id' AS source_suggestion_id,
        e.metadata->>'suggested_standard_code' AS suggested_standard_code,
        e.metadata->>'suggested_control_ref' AS suggested_control_ref,
        e.metadata->>'suggested_reason' AS suggested_reason,
        e.metadata->>'suggestion_confidence_score' AS suggestion_confidence_score,
        e.metadata->>'web_view_url' AS web_view_url,
        e.metadata->>'source_provider' AS source_provider,
        e.metadata->>'source_name' AS source_name,
        e.metadata->>'folder_path' AS folder_path,
        e.metadata->>'iso' AS iso,
        e.metadata->>'clause' AS clause,
        e.metadata->>'control_description' AS control_description,
        e.metadata->>'operation_name' AS operation_name,
        e.metadata->>'operation_code' AS operation_code,
        e.metadata->>'operation_type' AS operation_type,
        cc.description AS catalog_control_description,
        cc.category AS catalog_category,
        tc.status AS tenant_control_status
      FROM evidences e
      LEFT JOIN controls_catalog cc
        ON cc.id = e.control_id
      LEFT JOIN tenant_controls tc
        ON tc.id = e.tenant_control_id
       AND tc.tenant_id = e.tenant_id
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT $${idx}::int
      `,
      params
    )

    return res.json({
      evidences: result.rows
    })
  } catch (err) {
    console.error('ERROR LIST INTEGRATED EVIDENCES:', err)
    return res.status(500).json({
      error: 'Error listando evidencias integradas'
    })
  }
})


module.exports = router
