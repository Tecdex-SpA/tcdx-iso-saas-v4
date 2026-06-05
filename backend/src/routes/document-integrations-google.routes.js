const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const auth = require('../middleware/auth')
const crypto = require('crypto')
const { encryptToken } = require('../utils/cryptoTokens')
const {
  getJwtSecret,
} = require('../config/security')
const {
  getScopes,
  buildGoogleOAuthUrl,
  exchangeCodeForTokens,
  getAccountEmail
} = require('../services/providers/googleDrive.provider')
const {
  browseGoogleDriveFolders,
  getGoogleDriveFolder,
} = require('../services/documentGoogleFolders.service')
const { syncGoogleDriveSource } = require('../services/documentGoogleSync.service')

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null
}

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim()
}

function isSuperAdmin(user) {
  return ['superadmin', 'super_admin', 'admin_global', 'global_admin', 'platform_admin', 'owner'].includes(normalizeRole(user))
}

function canManage(user) {
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'admin_cumplimiento', 'compliance_admin', 'compliance_manager'].includes(normalizeRole(user))
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

async function getTenantGoogleSource({ tenantId, sourceId = null }) {
  const params = [tenantId]
  let sourceFilter = ''
  if (sourceId) {
    params.push(sourceId)
    sourceFilter = `AND s.id = $2::uuid`
  }

  const result = await pool.query(
    `
    SELECT s.*, i.status AS integration_status
    FROM tenant_document_sources s
    LEFT JOIN tenant_integrations i
      ON i.id = s.integration_id
     AND i.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1::uuid
      AND s.provider = 'google_drive'
      AND COALESCE(s.status, '') <> 'disconnected'
      ${sourceFilter}
    ORDER BY
      CASE WHEN s.integration_id IS NOT NULL THEN 0 ELSE 1 END,
      s.updated_at DESC NULLS LAST,
      s.created_at DESC NULLS LAST
    LIMIT 1
    `,
    params
  )
  return result.rows[0] || null
}

function assertManageGoogle(req, res) {
  const tenantId = resolveTenantId(req)
  if (!tenantId) {
    res.status(400).json({ ok: false, code: 'TENANT_REQUIRED', error: 'tenant_id es obligatorio' })
    return null
  }
  if (!ensureTenantAccess(req, tenantId)) {
    res.status(403).json({ ok: false, code: 'TENANT_DENIED', error: 'No autorizado para este tenant' })
    return null
  }
  if (!canManage(req.user)) {
    res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para administrar Google Drive' })
    return null
  }
  return tenantId
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'https://181.212.166.187:8443').replace(/\/$/, '')
}

function getStateSecret() {
  const secret = getJwtSecret() || process.env.SESSION_SECRET || process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('No existe secreto para firmar state OAuth')
  return secret
}

function signOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', getStateSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifyOAuthState(state) {
  const [body, signature] = String(state || '').split('.')
  if (!body || !signature) throw new Error('State OAuth inválido')

  const expected = crypto.createHmac('sha256', getStateSecret()).update(body).digest('base64url')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Firma OAuth state inválida')
  }

  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  const ageMs = Date.now() - Number(parsed.iat || 0)
  const expiresAt = Number(parsed.expires_at || 0)

  if (!parsed.tenant_id || !parsed.user_id || ageMs < 0 || ageMs > 10 * 60 * 1000 || (expiresAt && Date.now() > expiresAt)) {
    throw new Error('State OAuth expirado o incompleto')
  }

  return parsed
}

router.post('/oauth/start', auth, async (req, res) => {
  const tenantId = resolveTenantId(req)

  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' })
  if (!ensureTenantAccess(req, tenantId)) return res.status(403).json({ error: 'No autorizado para este tenant' })
  if (!canManage(req.user)) return res.status(403).json({ error: 'No autorizado para conectar Google Drive' })

  try {
    const state = signOAuthState({
      provider: 'google_drive',
      tenant_id: tenantId,
      user_id: getUserId(req.user),
      nonce: crypto.randomBytes(16).toString('hex'),
      return_to: '/evidencias',
      expires_at: Date.now() + 10 * 60 * 1000,
      iat: Date.now()
    })

    return res.json({
      provider: 'google_drive',
      auth_url: buildGoogleOAuthUrl({ state })
    })
  } catch (err) {
    console.error('ERROR START GOOGLE OAUTH:', err.message)
    return res.status(500).json({ error: 'Error iniciando conexión con Google Drive' })
  }
})

router.get('/oauth/callback', async (req, res) => {
  const client = await pool.connect()
  const frontendUrl = getFrontendUrl()

  try {
    console.info('GOOGLE_OAUTH_CALLBACK_REACHED:', {
      request_id: req.requestId || null,
      has_code: Boolean(req.query.code),
      has_state: Boolean(req.query.state),
      has_error: Boolean(req.query.error)
    })

    if (req.query.error) {
      return res.redirect(`${frontendUrl}/evidencias?drive_status=error&reason=${encodeURIComponent(String(req.query.error))}`)
    }

    if (!req.query.code || !req.query.state) {
      return res.redirect(`${frontendUrl}/evidencias?drive_status=error&reason=missing_code_or_state`)
    }

    const payload = verifyOAuthState(req.query.state)
    if (payload.provider !== 'google_drive') throw new Error('Proveedor OAuth inválido')
    console.info('GOOGLE_OAUTH_STATE_VALID:', {
      request_id: req.requestId || null,
      provider: payload.provider,
      has_tenant: Boolean(payload.tenant_id),
      has_user: Boolean(payload.user_id)
    })

    const { oauthClient, tokens } = await exchangeCodeForTokens({ code: req.query.code })
    const accountEmail = await getAccountEmail({ oauthClient })
    const scopes = getScopes().join(' ')
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    const encryptedAccessToken = tokens.access_token ? encryptToken(tokens.access_token) : null
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null

    await client.query('BEGIN')

    const existing = await client.query(
      `
      SELECT id
      FROM tenant_integrations
      WHERE tenant_id = $1
        AND provider = 'google_drive'
        AND COALESCE(provider_account_email, '') = COALESCE($2, '')
        AND status <> 'disconnected'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [payload.tenant_id, accountEmail || '']
    )

    let integrationId = null

    if (existing.rowCount > 0) {
      const updated = await client.query(
        `
        UPDATE tenant_integrations
        SET
          status = 'connected',
          display_name = COALESCE(display_name, 'Google Drive'),
          connected_by_user_id = $3,
          encrypted_access_token = COALESCE($4, encrypted_access_token),
          encrypted_refresh_token = COALESCE($5, encrypted_refresh_token),
          token_expires_at = $6,
          scopes = $7,
          provider_account_email = $8,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $9::jsonb,
          disconnected_at = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND tenant_id = $2
        RETURNING id
        `,
        [
          existing.rows[0].id,
          payload.tenant_id,
          payload.user_id,
          encryptedAccessToken,
          encryptedRefreshToken,
          expiresAt,
          scopes,
          accountEmail,
          JSON.stringify({ oauth_connected_at: new Date().toISOString() })
        ]
      )
      integrationId = updated.rows[0].id
    } else {
      const inserted = await client.query(
        `
        INSERT INTO tenant_integrations (
          tenant_id,
          provider,
          status,
          display_name,
          connected_by_user_id,
          encrypted_access_token,
          encrypted_refresh_token,
          token_expires_at,
          scopes,
          provider_account_email,
          metadata_json
        )
        VALUES ($1,'google_drive','connected','Google Drive',$2,$3,$4,$5,$6,$7,$8::jsonb)
        RETURNING id
        `,
        [
          payload.tenant_id,
          payload.user_id,
          encryptedAccessToken,
          encryptedRefreshToken,
          expiresAt,
          scopes,
          accountEmail,
          JSON.stringify({ oauth_connected_at: new Date().toISOString() })
        ]
      )
      integrationId = inserted.rows[0].id
    }

    const sourceStatus = 'active'
    const sourceMetadata = JSON.stringify({
      oauth_connected_at: new Date().toISOString(),
      provider_account_email: accountEmail || null,
    })
    const existingSources = await client.query(
      `
      SELECT id, folder_id
      FROM tenant_document_sources
      WHERE tenant_id = $1::uuid
        AND provider = 'google_drive'
        AND COALESCE(status, '') <> 'disconnected'
      ORDER BY
        CASE WHEN integration_id = $2::uuid THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
      `,
      [payload.tenant_id, integrationId]
    )
    if (existingSources.rowCount > 1) {
      console.warn('WARN GOOGLE OAUTH MULTIPLE_TENANT_SOURCES:', {
        request_id: req.requestId || null,
        tenant_source_count: existingSources.rowCount,
        selected_source_id: existingSources.rows[0]?.id || null,
      })
    }

    let sourceId = null
    let sourceFolderId = null
    if (existingSources.rowCount > 0) {
      const updatedSource = await client.query(
        `
        UPDATE tenant_document_sources
        SET
          integration_id = $2::uuid,
          status = $4::text,
          sync_enabled = true,
          provider_account_email = $3::text,
          last_sync_status = CASE
            WHEN COALESCE(folder_id, '') = '' THEN 'folder_required'
            ELSE last_sync_status
          END,
          last_sync_error = NULL,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb)
            || $5::jsonb
            || jsonb_build_object('folder_required', COALESCE(folder_id, '') = ''),
          updated_at = NOW()
        WHERE id = $1::uuid
          AND tenant_id = $6::uuid
          AND provider = 'google_drive'
        RETURNING id, folder_id
        `,
        [
          existingSources.rows[0].id,
          integrationId,
          accountEmail || '',
          sourceStatus,
          sourceMetadata,
          payload.tenant_id,
        ]
      )
      sourceId = updatedSource.rows[0]?.id || null
      sourceFolderId = updatedSource.rows[0]?.folder_id || null
    }
    if (!sourceId) {
      const insertedSource = await client.query(
        `
        INSERT INTO tenant_document_sources (
          tenant_id,
          integration_id,
          provider,
          source_name,
          status,
          sync_enabled,
          scan_frequency,
          last_sync_status,
          provider_account_email,
          metadata_json,
          created_by_user_id,
          created_by,
          updated_at
        )
        VALUES ($1::uuid,$2::uuid,'google_drive','Google Drive',$3::text,true,'manual','folder_required',$4::text,$5::jsonb,$6::uuid,$6::uuid,NOW())
        RETURNING id, folder_id
        `,
        [
          payload.tenant_id,
          integrationId,
          sourceStatus,
          accountEmail || '',
          JSON.stringify({ oauth_connected_at: new Date().toISOString(), provider_account_email: accountEmail || null, folder_required: true }),
          payload.user_id
        ]
      )
      sourceId = insertedSource.rows[0]?.id || null
      sourceFolderId = insertedSource.rows[0]?.folder_id || null
    }

    await client.query('COMMIT')
    const driveStatus = sourceFolderId ? 'connected' : 'folder_required'
    return res.redirect(`${frontendUrl}/evidencias?google=connected&drive_status=${driveStatus}&integration_id=${integrationId}&source_id=${sourceId || ''}`)
  } catch (err) {
    await client.query('ROLLBACK')
    const invalidState = /state|firma|expirado|incompleto|proveedor/i.test(String(err.message || ''))
    console.error('ERROR GOOGLE OAUTH CALLBACK:', {
      request_id: req.requestId || null,
      stage: 'persist_google_source',
      code: invalidState ? 'INVALID_STATE' : 'CALLBACK_FAILED',
      message: err.message,
      constraint: err.constraint || null,
      safe_status_attempted: 'active',
    })
    return res.redirect(`${frontendUrl}/evidencias?google=error&drive_status=error&reason=${invalidState ? 'invalid_state' : 'callback_failed'}`)
  } finally {
    client.release()
  }
})

router.get('/folders', auth, async (req, res) => {
  const tenantId = assertManageGoogle(req, res)
  if (!tenantId) return

  try {
    const source = await getTenantGoogleSource({ tenantId, sourceId: req.query.source_id || null })
    if (!source || !source.integration_id) {
      return res.status(409).json({
        ok: false,
        code: 'GOOGLE_NOT_CONNECTED',
        error: 'Google Drive no está conectado para este tenant.',
      })
    }

    const result = await browseGoogleDriveFolders({
      tenantId,
      sourceId: source.id,
      parentId: req.query.parentId || req.query.parent_id || 'root',
      pageToken: req.query.page_token || null,
    })

    return res.json(result)
  } catch (err) {
    console.error('ERROR LIST GOOGLE DRIVE FOLDERS:', {
      request_id: req.requestId || null,
      code: err.code || 'GOOGLE_FOLDER_LIST_FAILED',
      message: err.message,
    })
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'GOOGLE_FOLDER_LIST_FAILED',
      error: err.statusCode ? err.message : 'Error listando carpetas de Google Drive',
    })
  }
})

router.post('/select-folder', auth, async (req, res) => {
  const tenantId = assertManageGoogle(req, res)
  if (!tenantId) return

  const folderId = String(req.body?.folder_id || '').trim()
  const requestedFolderName = String(req.body?.folder_name || '').trim()
  if (!folderId) {
    return res.status(400).json({ ok: false, code: 'GOOGLE_FOLDER_REQUIRED', error: 'folder_id es obligatorio' })
  }

  try {
    const source = await getTenantGoogleSource({ tenantId, sourceId: req.body?.source_id || null })
    if (!source || !source.integration_id) {
      return res.status(409).json({
        ok: false,
        code: 'GOOGLE_NOT_CONNECTED',
        error: 'Google Drive no está conectado para este tenant.',
      })
    }

    const folder = await getGoogleDriveFolder({
      tenantId,
      sourceId: source.id,
      folderId,
    })
    const folderName = folder.name || requestedFolderName || 'Carpeta Google Drive'

    const result = await pool.query(
      `
      UPDATE tenant_document_sources
      SET
        folder_id = $3::text,
        folder_path = $4::text,
        folder_display_name = $4::text,
        status = 'active',
        sync_enabled = true,
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $5::jsonb,
        last_sync_status = NULL,
        last_sync_error = NULL,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND provider = 'google_drive'
      RETURNING id, provider, source_name, status, folder_id, folder_display_name, provider_account_email, last_sync_at
      `,
      [
        source.id,
        tenantId,
        folder.id,
        folderName,
        JSON.stringify({
          root_folder_selected_at: new Date().toISOString(),
          root_folder_id: folder.id,
          root_folder_name: folderName,
          root_folder_parents: folder.parents || [],
        }),
      ]
    )

    return res.json({ ok: true, source: result.rows[0] })
  } catch (err) {
    console.error('ERROR SELECT GOOGLE DRIVE FOLDER:', {
      request_id: req.requestId || null,
      code: err.code || 'GOOGLE_SELECT_FOLDER_FAILED',
      message: err.message,
    })
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'GOOGLE_SELECT_FOLDER_FAILED',
      error: err.statusCode ? err.message : 'No fue posible seleccionar la carpeta de Google Drive.',
    })
  }
})

router.post('/sync', auth, async (req, res) => {
  const tenantId = assertManageGoogle(req, res)
  if (!tenantId) return

  try {
    const source = await getTenantGoogleSource({ tenantId, sourceId: req.body?.source_id || null })
    if (!source || !source.integration_id) {
      return res.status(409).json({
        ok: false,
        code: 'GOOGLE_NOT_CONNECTED',
        error: 'Google Drive no está conectado para este tenant.',
      })
    }
    if (!source.folder_id) {
      return res.status(409).json({
        ok: false,
        code: 'GOOGLE_ROOT_FOLDER_REQUIRED',
        error: 'Seleccione una carpeta raíz de Google Drive antes de sincronizar.',
      })
    }

    const result = await syncGoogleDriveSource({
      tenantId,
      sourceId: source.id,
      maxDepth: req.body?.max_depth,
      maxFiles: req.body?.max_files,
      allowRoot: req.body?.allow_root === true,
    })
    return res.json(result)
  } catch (err) {
    console.error('ERROR SYNC GOOGLE DRIVE SOURCE:', {
      request_id: req.requestId || null,
      code: err.code || 'GOOGLE_SYNC_FAILED',
      message: err.message,
    })
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'GOOGLE_SYNC_FAILED',
      error: err.statusCode ? err.message : 'No fue posible sincronizar Google Drive.',
    })
  }
})

module.exports = router
