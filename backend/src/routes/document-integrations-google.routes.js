const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const auth = require('../middleware/auth')
const crypto = require('crypto')
const { encryptToken } = require('../utils/cryptoTokens')
const {
  getScopes,
  buildGoogleOAuthUrl,
  exchangeCodeForTokens,
  getAccountEmail
} = require('../services/providers/googleDrive.provider')

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
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager'].includes(normalizeRole(user))
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true
  return String(getUserTenantId(req.user)) === String(tenantId)
}

function resolveTenantId(req) {
  return req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://192.168.100.130:3000').replace(/\/$/, '')
}

function getStateSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || process.env.TOKEN_ENCRYPTION_KEY
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

  if (!parsed.tenant_id || !parsed.user_id || ageMs < 0 || ageMs > 10 * 60 * 1000) {
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
    if (req.query.error) {
      return res.redirect(`${frontendUrl}/evidencias?drive_status=error&reason=${encodeURIComponent(String(req.query.error))}`)
    }

    if (!req.query.code || !req.query.state) {
      return res.redirect(`${frontendUrl}/evidencias?drive_status=error&reason=missing_code_or_state`)
    }

    const payload = verifyOAuthState(req.query.state)
    if (payload.provider !== 'google_drive') throw new Error('Proveedor OAuth inválido')

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

    await client.query('COMMIT')
    return res.redirect(`${frontendUrl}/evidencias?drive_status=connected&integration_id=${integrationId}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR GOOGLE OAUTH CALLBACK:', err.message)
    return res.redirect(`${frontendUrl}/evidencias?drive_status=error&reason=callback_failed`)
  } finally {
    client.release()
  }
})

module.exports = router
