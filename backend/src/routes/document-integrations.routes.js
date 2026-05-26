const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const auth = require('../middleware/auth')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { validateMountedSharePath, indexMountedShareSource } = require('../services/mountedShareDocumentSource.service')
const { syncGoogleDriveSource } = require('../services/documentGoogleSync.service')
const zohoWorkdrive = require('../services/zohoWorkdriveClient.service')
const { hashSecret, randomSecret } = require('../utils/cryptoSecret.util')

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

function canOperateDocumentIntegrations(user) {
  const role = normalizeRole(user)
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager', 'auditor', 'operativo'].includes(role)
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

const DOCUMENT_SOURCE_PROVIDERS = new Set([
  'google_drive',
  'zoho_workdrive',
  'microsoft_graph',
  'onedrive',
  'sharepoint',
  'local_agent',
  'mounted_share',
  'manual_upload'
])

function normalizeStandardCode(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw || raw === 'SIN ASOCIAR' || raw === 'NONE') return null
  if (raw.includes('9001')) return 'ISO9001'
  if (raw.includes('27001')) return 'ISO27001'
  if (raw.includes('42001')) return 'ISO42001'
  return raw.replace(/[^A-Z0-9]/g, '').slice(0, 40) || null
}

function safeStatus(value, fallback = 'active') {
  const status = String(value || '').trim().toLowerCase()
  return ['active', 'paused', 'disconnected', 'pending_agent', 'error'].includes(status) ? status : fallback
}

function safeDownloadName(value) {
  return path.basename(String(value || 'documento').replace(/[\r\n"]/g, '_'))
}

async function getTenantSource({ sourceId, tenantId }) {
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_document_sources
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [sourceId, tenantId]
  )
  return result.rows[0] || null
}

const providerCards = [
  {
    provider: 'google_drive',
    label: 'Google Drive',
    status: 'available',
    phase: 'Conector operativo',
    read_only: true,
    oauth_ready: true,
    description: 'OAuth Google Drive tenant-scoped e indexación de carpetas seleccionadas.'
  },
  {
    provider: 'zoho_workdrive',
    label: 'Zoho WorkDrive',
    status: zohoWorkdrive.isZohoConfigured() ? 'available' : 'not_configured',
    phase: 'Conector preparado',
    read_only: true,
    oauth_ready: zohoWorkdrive.isZohoConfigured(),
    description: 'OAuth Zoho WorkDrive tenant-scoped. Requiere variables Zoho por data center.'
  },
  {
    provider: 'local_agent',
    label: 'TCDX Sync Agent',
    status: 'available',
    phase: 'Agente local mínimo',
    read_only: false,
    oauth_ready: false,
    description: 'Vincula una carpeta local del cliente mediante código temporal y agente con token propio.'
  },
  {
    provider: 'mounted_share',
    label: 'Carpeta compartida montada',
    status: process.env.LOCAL_DOCUMENT_ROOT ? 'available' : 'not_configured',
    phase: 'Operación técnica',
    read_only: true,
    oauth_ready: false,
    description: 'Indexa una ruta relativa bajo LOCAL_DOCUMENT_ROOT sin aceptar rutas absolutas ni traversal.'
  },
  {
    provider: 'manual_upload',
    label: 'Carga manual',
    status: 'available',
    phase: 'Base existente',
    read_only: false,
    oauth_ready: false,
    description: 'Fuente tenant-scoped para documentos cargados manualmente.'
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

function normalizeControlRefForMatch(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/^ISO\s*\/?\s*\d+\s*[:/-]?\s*\d*\s*/i, '')
    .replace(/^ISO\d+\s*/i, '')
    .replace(/[^A-Z0-9.]/g, '')
    .trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function buildControlMappingRequiredError({
  tenantId,
  standardCode,
  controlRef,
  operationId = null,
  candidates = [],
  reason = 'control_not_applicable_or_not_found'
}) {
  const err = new Error(
    `No se encontró un control aplicable y activo para ${standardCode || 'norma no informada'} / ${controlRef || 'referencia no informada'}. Debe mapearse manualmente antes de crear evidencia formal.`
  )
  err.statusCode = 422
  err.code = 'CONTROL_MAPPING_REQUIRED'
  err.details = {
    mapping_required: true,
    reason,
    tenant_id: tenantId,
    operation_id: operationId,
    standard_code: standardCode || null,
    control_ref: controlRef || null,
    candidate_controls: candidates,
    tenant_filter_enforced: true,
    filtered_by_tenant_id: true,
    applicability_universe_applied: true
  }
  return err
}

async function resolveTenantControlForDocumentSuggestion(client, {
  tenantId,
  suggestedStandardCode,
  suggestedControlRef,
  preferredOperationId = null,
  explicitTenantControlId = null,
  suggestionText = ''
}) {
  const baseStandard = baseStandardCodeFromSuggestion(suggestedStandardCode)
  const controlRef = normalizeControlRefForMatch(suggestedControlRef)

  if (!baseStandard || !controlRef) return null

  const activeOperations = await client.query(
    `
    SELECT
      tso.operation_id,
      op.name AS operation_name,
      op.code AS operation_code,
      op.operation_type,
      COALESCE(op.is_default, false) AS is_default,
      COALESCE(op.sort_order, 9999) AS sort_order
    FROM tenant_standard_operations tso
    JOIN tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
     AND op.is_active = TRUE
    WHERE tso.tenant_id = $1::uuid
      AND tso.is_active = TRUE
      AND UPPER(REPLACE(REPLACE(COALESCE(tso.standard_code, ''), '/', ''), ' ', '')) = $2
      AND (
        $3::uuid IS NULL
        OR tso.operation_id = $3::uuid
      )
    ORDER BY
      COALESCE(op.is_default, false) DESC,
      COALESCE(op.sort_order, 9999) ASC,
      op.name ASC
    `,
    [tenantId, baseStandard, preferredOperationId || null]
  )

  if (activeOperations.rowCount === 0) {
    throw buildControlMappingRequiredError({
      tenantId,
      standardCode: baseStandard,
      controlRef,
      reason: 'active_operation_not_found'
    })
  }

  if (!preferredOperationId && activeOperations.rowCount > 1) {
    throw buildControlMappingRequiredError({
      tenantId,
      standardCode: baseStandard,
      controlRef,
      candidates: activeOperations.rows.map((item) => ({
        operation_id: item.operation_id,
        operation_name: item.operation_name,
        operation_code: item.operation_code,
        operation_type: item.operation_type
      })),
      reason: 'operation_selection_required'
    })
  }

  const operationId = activeOperations.rows[0].operation_id

  const explicitResult = explicitTenantControlId && isUuid(explicitTenantControlId)
    ? await client.query(
      `
      SELECT
        tc.id AS tenant_control_id,
        tc.control_id AS catalog_control_id,
        tc.operation_id,
        cc.iso,
        COALESCE(tac.standard_code, ccs.standard_code, cc.iso) AS standard_code,
        COALESCE(tac.control_code, ccs.clause, cc.clause) AS clause,
        COALESCE(tac.control_name, cc.description) AS control_description,
        cc.category,
        op.name AS operation_name,
        op.code AS operation_code,
        op.operation_type
      FROM tenant_controls tc
      JOIN tenant_applicable_controls tac
        ON tac.tenant_id = tc.tenant_id
       AND tac.tenant_control_id = tc.id
       AND tac.active = true
       AND tac.visible_to_tenant = true
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
       AND cc.is_active = TRUE
      LEFT JOIN controls_catalog_standards ccs
        ON ccs.control_id = cc.id
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      WHERE tc.tenant_id = $1::uuid
        AND tc.id = $2::uuid
        AND tc.operation_id = $3::uuid
        AND (
          UPPER(REPLACE(REPLACE(COALESCE(tac.standard_code, ccs.standard_code, cc.iso, ''), '/', ''), ' ', '')) = $4
          OR UPPER(REPLACE(REPLACE(COALESCE(cc.iso, ''), '/', ''), ' ', '')) = $4
        )
      LIMIT 1
      `,
      [tenantId, explicitTenantControlId, operationId, baseStandard]
    )
    : { rowCount: 0, rows: [] }

  if (explicitResult.rowCount > 0) {
    return explicitResult.rows[0] || null
  }

  const result = await client.query(
    `
    WITH candidates AS (
      SELECT
        tc.id AS tenant_control_id,
        tc.control_id AS catalog_control_id,
        tc.operation_id,
        cc.iso,
        COALESCE(tac.standard_code, ccs.standard_code, cc.iso) AS standard_code,
        COALESCE(tac.control_code, ccs.clause, cc.clause) AS clause,
        COALESCE(tac.control_name, cc.description) AS control_description,
        cc.category,
        op.name AS operation_name,
        op.code AS operation_code,
        op.operation_type,
        CASE
          WHEN regexp_replace(upper(COALESCE(tac.control_code, ccs.clause, cc.clause, '')), '[^A-Z0-9.]', '', 'g') = regexp_replace(upper($3), '[^A-Z0-9.]', '', 'g') THEN 1
          WHEN regexp_replace(upper(COALESCE(ccs.clause, cc.clause, '')), '[^A-Z0-9.]', '', 'g') = regexp_replace(upper($3), '[^A-Z0-9.]', '', 'g') THEN 2
          WHEN length($3) >= 3 AND regexp_replace(upper(COALESCE(tac.control_code, ccs.clause, cc.clause, '')), '[^A-Z0-9.]', '', 'g') LIKE regexp_replace(upper($3), '[^A-Z0-9.]', '', 'g') || '%' THEN 8
          WHEN length($5) >= 8 AND lower(COALESCE(tac.control_name, cc.description, '')) LIKE '%' || lower($5) || '%' THEN 9
          ELSE 99
        END AS match_priority
      FROM tenant_applicable_controls tac
      LEFT JOIN tenant_controls tc
        ON tc.id = tac.tenant_control_id
       AND tc.tenant_id = tac.tenant_id
      LEFT JOIN controls_catalog cc
        ON cc.id = COALESCE(tac.control_catalog_id, tc.control_id)
       AND cc.is_active = TRUE
      LEFT JOIN controls_catalog_standards ccs
        ON ccs.control_id = cc.id
      LEFT JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tac.tenant_id
       AND op.is_active = TRUE
      WHERE tac.tenant_id = $1::uuid
        AND tac.active = true
        AND tac.visible_to_tenant = true
        AND ($4::uuid IS NULL OR tc.operation_id = $4::uuid OR tac.tenant_control_id IS NULL)
        AND (
          UPPER(REPLACE(REPLACE(COALESCE(tac.standard_code, ccs.standard_code, cc.iso, ''), '/', ''), ' ', '')) = $2
          OR UPPER(REPLACE(REPLACE(COALESCE(cc.iso, ''), '/', ''), ' ', '')) = $2
        )
    ),
    ranked AS (
      SELECT *
      FROM candidates
      WHERE match_priority < 99
      ORDER BY match_priority ASC, control_description ASC NULLS LAST
      LIMIT 10
    )
    SELECT *
    FROM ranked
    ORDER BY match_priority ASC
    `,
    [tenantId, baseStandard, controlRef, operationId, String(suggestionText || '').slice(0, 120)]
  )

  const safeMatches = result.rows.filter((row) => row.tenant_control_id && Number(row.match_priority || 99) <= 2)
  if (safeMatches.length === 1) {
    return safeMatches[0]
  }

  throw buildControlMappingRequiredError({
    tenantId,
    standardCode: baseStandard,
    controlRef,
    operationId,
    candidates: result.rows.map((row) => ({
      tenant_control_id: row.tenant_control_id,
      catalog_control_id: row.catalog_control_id,
      standard_code: row.standard_code,
      clause: row.clause,
      control_description: row.control_description,
      operation_id: row.operation_id,
      operation_name: row.operation_name,
      match_priority: row.match_priority
    })),
    reason: result.rowCount > 0 ? 'ambiguous_or_broad_control_reference' : 'control_not_applicable_or_not_found'
  })
}

async function createEvidenceFromApprovedDocumentSuggestion(client, {
  tenantId,
  suggestionId,
  userId,
  preferredOperationId = null
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
    suggestedControlRef: suggestion.suggested_control_ref,
    preferredOperationId: preferredOperationId || null,
    explicitTenantControlId: suggestion.target_id || suggestion.tenant_control_id || null,
    suggestionText: [
      suggestion.suggested_reason,
      suggestion.file_name,
      suggestion.document_metadata_json?.title
    ].filter(Boolean).join(' ')
  })

  if (!resolvedControl) {
    throw buildControlMappingRequiredError({
      tenantId,
      standardCode: suggestion.suggested_standard_code,
      controlRef: suggestion.suggested_control_ref,
      operationId: preferredOperationId || null,
      reason: 'control_mapping_required'
    })
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

  const provider = String(req.body?.provider || '').trim().toLowerCase()
  const displayName = String(req.body?.display_name || '').trim() || null

  if (!DOCUMENT_SOURCE_PROVIDERS.has(provider)) {
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
    source_name,
    folder_id,
    folder_path,
    folder_display_name,
    include_subfolders,
    associated_standard_code,
    scan_frequency
  } = req.body || {}
  const provider = String(req.body?.provider || '').trim().toLowerCase()

  if (!provider || !source_name) {
    return res.status(400).json({ error: 'provider y source_name son obligatorios' })
  }

  if (!DOCUMENT_SOURCE_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'Proveedor documental no soportado' })
  }

  try {
    let safeFolderPath = folder_path || null
    let initialStatus = 'active'
    let metadata = { stage: 'tenant_scoped_source_registration' }

    if (provider === 'mounted_share') {
      const safe = await validateMountedSharePath(folder_path)
      safeFolderPath = safe.relative_path
      metadata = { ...metadata, mounted_share_validated: true }
    }

    if (provider === 'local_agent') {
      initialStatus = 'pending_agent'
      metadata = { ...metadata, requires_agent_pairing: true }
    }

    const result = await pool.query(
      `
      INSERT INTO tenant_document_sources (
        tenant_id,
        integration_id,
        provider,
        source_name,
        status,
        folder_id,
        folder_path,
        folder_display_name,
        include_subfolders,
        associated_standard_code,
        scan_frequency,
        created_by_user_id,
        created_by,
        metadata_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, 'manual'),$12,$12,$13::jsonb)
      RETURNING *
      `,
      [
        tenantId,
        integration_id || null,
        provider,
        source_name,
        initialStatus,
        folder_id || null,
        safeFolderPath,
        folder_display_name || folder_path || folder_id || null,
        include_subfolders !== false,
        normalizeStandardCode(associated_standard_code),
        scan_frequency || 'manual',
        getUserId(req.user),
        JSON.stringify(metadata)
      ]
    )

    return res.status(201).json({ source: result.rows[0] })
  } catch (err) {
    console.error('ERROR CREATE DOCUMENT SOURCE:', err)
    return res.status(500).json({ error: 'Error creando fuente documental' })
  }
})

router.get('/sources/:sourceId', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const source = await getTenantSource({ sourceId: req.params.sourceId, tenantId })
    if (!source) return res.status(404).json({ error: 'Fuente documental no encontrada' })
    return res.json({ source })
  } catch (err) {
    console.error('ERROR GET DOCUMENT SOURCE:', err.message)
    return res.status(500).json({ error: 'Error obteniendo fuente documental' })
  }
})

router.patch('/sources/:sourceId', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return
  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para editar fuentes documentales' })
  }

  try {
    const existing = await getTenantSource({ sourceId: req.params.sourceId, tenantId })
    if (!existing) return res.status(404).json({ error: 'Fuente documental no encontrada' })

    let safeFolderPath = req.body?.folder_path !== undefined ? req.body.folder_path : existing.folder_path
    if (existing.provider === 'mounted_share' && req.body?.folder_path !== undefined) {
      const safe = await validateMountedSharePath(req.body.folder_path)
      safeFolderPath = safe.relative_path
    }

    const result = await pool.query(
      `
      UPDATE tenant_document_sources
      SET source_name = COALESCE(NULLIF($3, ''), source_name),
          status = $4,
          include_subfolders = $5,
          associated_standard_code = $6,
          sync_enabled = $7,
          folder_path = $8,
          folder_display_name = COALESCE($9, folder_display_name),
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      RETURNING *
      `,
      [
        req.params.sourceId,
        tenantId,
        req.body?.source_name || null,
        req.body?.status ? safeStatus(req.body.status, existing.status) : existing.status,
        req.body?.include_subfolders !== undefined ? req.body.include_subfolders === true : existing.include_subfolders,
        req.body?.associated_standard_code !== undefined ? normalizeStandardCode(req.body.associated_standard_code) : existing.associated_standard_code,
        req.body?.sync_enabled !== undefined ? req.body.sync_enabled === true : existing.sync_enabled,
        safeFolderPath,
        req.body?.folder_display_name || null,
      ]
    )

    return res.json({ source: result.rows[0] })
  } catch (err) {
    console.error('ERROR PATCH DOCUMENT SOURCE:', err.message)
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'DOCUMENT_SOURCE_UPDATE_ERROR',
      error: err.statusCode ? err.message : 'Error editando fuente documental'
    })
  }
})

router.delete('/sources/:sourceId', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return
  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para desconectar fuentes documentales' })
  }

  try {
    const result = await pool.query(
      `
      UPDATE tenant_document_sources
      SET status = 'disconnected',
          sync_enabled = false,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      RETURNING *
      `,
      [req.params.sourceId, tenantId]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Fuente documental no encontrada' })
    return res.json({ ok: true, source: result.rows[0] })
  } catch (err) {
    console.error('ERROR DELETE DOCUMENT SOURCE:', err.message)
    return res.status(500).json({ error: 'Error desconectando fuente documental' })
  }
})

router.get('/sources/:sourceId/documents', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)))

  try {
    const source = await getTenantSource({ sourceId: req.params.sourceId, tenantId })
    if (!source) return res.status(404).json({ error: 'Fuente documental no encontrada' })

    const result = await pool.query(
      `
      SELECT
        d.id,
        d.tenant_id,
        d.source_id,
        d.integration_id,
        d.provider,
        d.provider_file_id,
        d.provider_version_id,
        d.file_name,
        d.mime_type,
        d.file_extension,
        d.file_url,
        d.web_view_url,
        d.size_bytes,
        d.checksum,
        d.content_hash,
        d.file_hash,
        d.relative_path,
        d.modified_at,
        d.indexed_at,
        d.last_seen_at,
        d.status,
        d.metadata_json,
        s.source_name
      FROM document_index d
      JOIN tenant_document_sources s
        ON s.id = d.source_id
       AND s.tenant_id = d.tenant_id
      WHERE d.tenant_id = $1::uuid
        AND d.source_id = $2::uuid
      ORDER BY d.indexed_at DESC NULLS LAST, d.modified_at DESC NULLS LAST
      LIMIT $3
      `,
      [tenantId, req.params.sourceId, limit]
    )

    return res.json({ documents: result.rows })
  } catch (err) {
    console.error('ERROR LIST SOURCE DOCUMENTS:', err.message)
    return res.status(500).json({ error: 'Error listando documentos de la fuente' })
  }
})

router.post('/agents/pairing-codes', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return
  if (!canManageDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para vincular agentes locales' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let sourceId = req.body?.source_id || null
    const sourceName = String(req.body?.source_name || 'TCDX Sync Agent').trim()

    if (sourceId) {
      const source = await client.query(
        `
        SELECT id
        FROM tenant_document_sources
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND provider = 'local_agent'
          AND status <> 'disconnected'
        LIMIT 1
        `,
        [sourceId, tenantId]
      )
      if (source.rowCount === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Fuente local_agent no encontrada' })
      }
    } else {
      const inserted = await client.query(
        `
        INSERT INTO tenant_document_sources (
          tenant_id, provider, source_name, status, sync_enabled,
          include_subfolders, created_by_user_id, created_by, metadata_json
        )
        VALUES ($1,'local_agent',$2,'pending_agent',true,true,$3,$3,$4::jsonb)
        RETURNING id
        `,
        [
          tenantId,
          sourceName,
          getUserId(req.user),
          JSON.stringify({ created_from: 'pairing_code' }),
        ]
      )
      sourceId = inserted.rows[0].id
    }

    const code = randomSecret(18).replace(/[^A-Z0-9]/gi, '').slice(0, 24).toUpperCase()
    const expiresMinutes = Math.max(5, Math.min(60, Number(req.body?.expires_minutes || 15)))
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000)

    const pairing = await client.query(
      `
      INSERT INTO tenant_sync_agent_pairing_codes (
        tenant_id, source_id, code_hash, expires_at, created_by
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, tenant_id, source_id, expires_at, created_at
      `,
      [tenantId, sourceId, hashSecret(code), expiresAt, getUserId(req.user)]
    )

    await client.query('COMMIT')
    return res.status(201).json({
      ok: true,
      pairing_code: code,
      visible_once: true,
      source_id: sourceId,
      expires_at: pairing.rows[0].expires_at,
      tenant_id: tenantId,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR CREATE AGENT PAIRING CODE:', err.message)
    return res.status(500).json({ error: 'Error generando código de vinculación' })
  } finally {
    client.release()
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
        d.id,
        d.tenant_id,
        d.source_id,
        d.integration_id,
        d.provider,
        d.provider_file_id,
        d.provider_version_id,
        d.file_name,
        d.mime_type,
        d.file_extension,
        d.file_url,
        d.web_view_url,
        d.size_bytes,
        d.checksum,
        d.content_hash,
        d.file_hash,
        d.relative_path,
        d.modified_at,
        d.indexed_at,
        d.last_seen_at,
        d.status,
        d.metadata_json,
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

router.get('/documents/:documentId/download', auth, async (req, res) => {
  const tenantId = assertTenant(req, res)
  if (!tenantId) return

  try {
    const result = await pool.query(
      `
      SELECT d.*, s.provider AS source_provider, s.folder_path AS source_folder_path, s.integration_id
      FROM document_index d
      LEFT JOIN tenant_document_sources s
        ON s.id = d.source_id
       AND s.tenant_id = d.tenant_id
      WHERE d.id = $1::uuid
        AND d.tenant_id = $2::uuid
      LIMIT 1
      `,
      [req.params.documentId, tenantId]
    )

    if (result.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado' })
    const doc = result.rows[0]

    if (['mounted_share', 'local_agent', 'manual_upload'].includes(doc.provider)) {
      const localPath = doc.local_storage_path || doc.metadata_json?.local_storage_path || null
      if (!localPath) {
        return res.status(409).json({ ok: false, code: 'DOCUMENT_BINARY_NOT_STORED', error: 'Archivo binario no almacenado localmente' })
      }
      const stat = await fs.promises.stat(localPath).catch(() => null)
      if (!stat || !stat.isFile()) return res.status(404).json({ error: 'Archivo no encontrado' })
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.download(localPath, safeDownloadName(doc.file_name))
    }

    if (doc.provider === 'zoho_workdrive') {
      return res.status(409).json({
        ok: false,
        code: 'ZOHO_DOWNLOAD_REQUIRES_PROVIDER_FETCH',
        error: 'Descarga Zoho vía API preparada, pero requiere credencial activa de la fuente.',
      })
    }

    if (doc.web_view_url || doc.file_url) {
      return res.json({
        ok: true,
        provider: doc.provider,
        download_url: doc.web_view_url || doc.file_url,
        external_download: true,
      })
    }

    return res.status(409).json({ ok: false, code: 'DOCUMENT_DOWNLOAD_NOT_AVAILABLE', error: 'Descarga no disponible para este documento' })
  } catch (err) {
    console.error('ERROR DOCUMENT DOWNLOAD:', err.message)
    return res.status(500).json({ error: 'Error descargando documento' })
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
      userId: getUserId(req.user),
      preferredOperationId: req.body?.operation_id || null
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
    if (err.code === 'CONTROL_MAPPING_REQUIRED') {
      console.warn('CONTROL_MAPPING_REQUIRED CREATE EVIDENCE FROM DOCUMENT SUGGESTION:', {
        tenant_id: tenantId,
        suggestion_id: req.params.suggestionId,
        reason: err.details?.reason || null,
        standard_code: err.details?.standard_code || null,
        control_ref: err.details?.control_ref || null,
      })
      return res.status(422).json({
        ok: false,
        code: 'CONTROL_MAPPING_REQUIRED',
        message: err.message,
        error: err.message,
        mapping_required: true,
        candidate_controls: err.details?.candidate_controls || [],
        tenant_filter_enforced: true,
        filtered_by_tenant_id: true,
        applicability_universe_applied: true,
        details: err.details || {},
      })
    }

    console.error('ERROR CREATE EVIDENCE FROM DOCUMENT SUGGESTION:', err)

    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'DOCUMENT_SUGGESTION_EVIDENCE_ERROR',
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

  if (!canOperateDocumentIntegrations(req.user)) {
    return res.status(403).json({ error: 'No autorizado para sincronizar fuentes documentales' })
  }

  try {
    const source = await getTenantSource({ sourceId: req.params.sourceId, tenantId })

    if (!source) return res.status(404).json({ error: 'Fuente documental no encontrada' })
    if (source.status === 'disconnected') {
      return res.status(409).json({ ok: false, code: 'DOCUMENT_SOURCE_DISCONNECTED', error: 'Fuente desconectada' })
    }
    if (source.sync_enabled === false || source.status === 'paused') {
      return res.status(409).json({ ok: false, code: 'DOCUMENT_SOURCE_SYNC_DISABLED', error: 'Sincronización deshabilitada para esta fuente' })
    }

    if (source.provider === 'google_drive') {
      const result = await syncGoogleDriveSource({
        tenantId,
        sourceId: req.params.sourceId,
        maxDepth: req.body?.max_depth,
        maxFiles: req.body?.max_files,
        allowRoot: req.body?.allow_root === true,
      })
      return res.json(result)
    }

    if (source.provider === 'mounted_share') {
      const result = await indexMountedShareSource({ tenantId, sourceId: req.params.sourceId })
      return res.json(result)
    }

    if (source.provider === 'local_agent') {
      return res.json({
        ok: true,
        provider: 'local_agent',
        status: source.status,
        message: 'La sincronización de esta fuente la ejecuta TCDX Sync Agent desde el equipo vinculado.',
      })
    }

    if (source.provider === 'zoho_workdrive') {
      return res.status(202).json({
        ok: true,
        provider: 'zoho_workdrive',
        status: 'accepted',
        message: 'Zoho WorkDrive está preparado. Use el endpoint /api/document-integrations/zoho/sync para sincronización Zoho.',
      })
    }

    return res.json({
      ok: true,
      provider: source.provider,
      status: 'no_op',
      message: 'Fuente válida. Este proveedor no requiere sincronización automática en esta versión.'
    })
  } catch (err) {
    console.error('ERROR DOCUMENT SOURCE SYNC:', err.message)
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'DOCUMENT_SOURCE_SYNC_ERROR',
      error: err.statusCode ? err.message : 'Error sincronizando fuente documental'
    })
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
    const tenantId = tcdxIntegratedIsSuperAdmin(req.user)
      ? (req.query.tenant_id || tcdxIntegratedGetUserTenantId(req.user))
      : tcdxIntegratedGetUserTenantId(req.user)
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
