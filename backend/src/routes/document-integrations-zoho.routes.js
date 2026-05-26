const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const {
  getJwtSecret,
} = require('../config/security');
const zoho = require('../services/zohoWorkdriveClient.service');

const router = express.Router();

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null;
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function role(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim();
}

function isSuperAdmin(user) {
  return ['superadmin', 'super_admin', 'admin_global', 'global_admin', 'platform_admin', 'owner'].includes(role(user));
}

function canManage(user) {
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'compliance_manager'].includes(role(user));
}

function resolveTenantId(req) {
  return isSuperAdmin(req.user) ? (req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)) : getUserTenantId(req.user);
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || 'https://181.212.166.187:8443').replace(/\/$/, '');
}

function stateSecret() {
  const secret = getJwtSecret() || process.env.SESSION_SECRET || process.env.AGENT_TOKEN_SIGNING_SECRET;
  if (!secret) throw new Error('No existe secreto para firmar state OAuth');
  return secret;
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(state) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) throw new Error('State OAuth inválido');
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  if (Buffer.from(expected).length !== Buffer.from(signature).length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw new Error('Firma OAuth state inválida');
  }
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!parsed.tenant_id || !parsed.user_id || Date.now() - Number(parsed.iat || 0) > 10 * 60 * 1000) {
    throw new Error('State OAuth expirado o incompleto');
  }
  return parsed;
}

function notConfigured(res) {
  return res.status(503).json({
    ok: false,
    code: 'ZOHO_CONNECTOR_NOT_CONFIGURED',
    error: 'Conector Zoho no configurado',
  });
}

router.get('/oauth/start', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'No autorizado para conectar Zoho WorkDrive' });

  const state = signState({
    provider: 'zoho_workdrive',
    tenant_id: tenantId,
    user_id: getUserId(req.user),
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  });
  return res.json({ provider: 'zoho_workdrive', auth_url: zoho.buildAuthorizationUrl({ state }) });
});

router.get('/oauth/callback', async (req, res) => {
  const client = await pool.connect();
  const frontendUrl = getFrontendUrl();
  try {
    if (req.query.error) {
      return res.redirect(`${frontendUrl}/evidencias?zoho_status=error&reason=${encodeURIComponent(String(req.query.error))}`);
    }
    if (!zoho.isZohoConfigured()) {
      return res.redirect(`${frontendUrl}/evidencias?zoho_status=error&reason=not_configured`);
    }
    if (!req.query.code || !req.query.state) {
      return res.redirect(`${frontendUrl}/evidencias?zoho_status=error&reason=missing_code_or_state`);
    }
    const payload = verifyState(req.query.state);
    if (payload.provider !== 'zoho_workdrive') throw new Error('Proveedor OAuth inválido');
    const tokens = await zoho.exchangeCodeForTokens(String(req.query.code));
    const encrypted = zoho.encryptZohoTokens(tokens);

    await client.query('BEGIN');
    const credential = await client.query(
      `
      INSERT INTO tenant_document_provider_credentials (
        tenant_id, provider, access_token_encrypted, refresh_token_encrypted,
        token_expires_at, scopes, metadata_json, created_by
      )
      VALUES ($1,'zoho_workdrive',$2,$3,$4,$5,$6::jsonb,$7)
      RETURNING id
      `,
      [
        payload.tenant_id,
        encrypted.access_token_encrypted,
        encrypted.refresh_token_encrypted,
        encrypted.token_expires_at,
        zoho.getScopes(),
        JSON.stringify({ oauth_connected_at: new Date().toISOString() }),
        payload.user_id,
      ]
    );
    await client.query('COMMIT');
    return res.redirect(`${frontendUrl}/evidencias?zoho_status=connected&credential_id=${credential.rows[0].id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR ZOHO OAUTH CALLBACK:', error.message);
    return res.redirect(`${frontendUrl}/evidencias?zoho_status=error&reason=callback_failed`);
  } finally {
    client.release();
  }
});

async function getCredential({ tenantId, credentialId = null, sourceId = null }) {
  const params = [tenantId];
  let where = `tenant_id = $1::uuid AND provider = 'zoho_workdrive'`;
  if (credentialId) {
    params.push(credentialId);
    where += ` AND id = $${params.length}::uuid`;
  }
  if (sourceId) {
    params.push(sourceId);
    where += ` AND source_id = $${params.length}::uuid`;
  }

  const result = await pool.query(
    `SELECT * FROM tenant_document_provider_credentials WHERE ${where} ORDER BY created_at DESC LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

router.get('/folders', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' });
  try {
    const credential = await getCredential({ tenantId, credentialId: req.query.credential_id || null });
    if (!credential) return res.status(404).json({ error: 'Credencial Zoho no encontrada' });
    const tokens = zoho.decryptZohoCredential(credential);
    const folders = await zoho.listFolders({
      accessToken: tokens.access_token,
      parentId: req.query.parent_id || 'root',
      pageToken: req.query.page_token || null,
    });
    return res.json({
      provider: 'zoho_workdrive',
      folders: folders.folders.map((folder) => ({
        id: folder.id,
        name: folder.attributes?.name || folder.attributes?.display_attr_name || folder.id,
        web_view_url: folder.attributes?.permalink || null,
        modified_at: folder.attributes?.modified_time || null,
      })),
      next_page_token: folders.next_page_token,
    });
  } catch (error) {
    console.error('ERROR LIST ZOHO FOLDERS:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || 'ZOHO_FOLDERS_ERROR',
      error: error.statusCode ? error.message : 'Error listando carpetas Zoho',
    });
  }
});

router.post('/sources', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'No autorizado para crear fuente Zoho' });

  const credentialId = req.body?.credential_id || null;
  const folderId = String(req.body?.folder_id || '').trim();
  const sourceName = String(req.body?.source_name || req.body?.folder_display_name || 'Zoho WorkDrive').trim();
  if (!credentialId || !folderId || !sourceName) {
    return res.status(400).json({ error: 'credential_id, folder_id y source_name son obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const credential = await client.query(
      `SELECT id FROM tenant_document_provider_credentials WHERE id = $1::uuid AND tenant_id = $2::uuid AND provider = 'zoho_workdrive' LIMIT 1`,
      [credentialId, tenantId]
    );
    if (credential.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credencial Zoho no encontrada' });
    }
    const source = await client.query(
      `
      INSERT INTO tenant_document_sources (
        tenant_id, provider, source_name, status, folder_id, folder_path,
        folder_display_name, include_subfolders, associated_standard_code,
        created_by_user_id, created_by, metadata_json
      )
      VALUES ($1,'zoho_workdrive',$2,'active',$3,$4,$5,$6,$7,$8,$8,$9::jsonb)
      RETURNING *
      `,
      [
        tenantId,
        sourceName,
        folderId,
        req.body?.folder_path || sourceName,
        req.body?.folder_display_name || sourceName,
        req.body?.include_subfolders !== false,
        req.body?.associated_standard_code || null,
        getUserId(req.user),
        JSON.stringify({ credential_id: credentialId }),
      ]
    );
    await client.query(
      `UPDATE tenant_document_provider_credentials SET source_id = $1::uuid, updated_at = NOW() WHERE id = $2::uuid AND tenant_id = $3::uuid`,
      [source.rows[0].id, credentialId, tenantId]
    );
    await client.query('COMMIT');
    return res.status(201).json({ source: source.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE ZOHO SOURCE:', error.message);
    return res.status(500).json({ error: 'Error creando fuente Zoho' });
  } finally {
    client.release();
  }
});

router.post('/sync', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id es obligatorio' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'No autorizado para sincronizar Zoho' });
  const sourceId = req.body?.source_id || req.query.source_id;
  if (!sourceId) return res.status(400).json({ error: 'source_id es obligatorio' });

  try {
    const sourceResult = await pool.query(
      `SELECT * FROM tenant_document_sources WHERE id = $1::uuid AND tenant_id = $2::uuid AND provider = 'zoho_workdrive' LIMIT 1`,
      [sourceId, tenantId]
    );
    if (sourceResult.rowCount === 0) return res.status(404).json({ error: 'Fuente Zoho no encontrada' });
    const source = sourceResult.rows[0];
    const credential = await getCredential({ tenantId, sourceId });
    if (!credential) return res.status(404).json({ error: 'Credencial Zoho no encontrada' });
    const tokens = zoho.decryptZohoCredential(credential);
    const listed = await zoho.listFiles({ accessToken: tokens.access_token, folderId: source.folder_id, includeSubfolders: source.include_subfolders !== false });

    let indexed = 0;
    let skipped = 0;
    for (const item of listed.files.slice(0, 500)) {
      const normalized = zoho.normalizeZohoFileToDocumentIndex(item);
      if (normalized.metadata_json?.zoho?.is_folder) {
        skipped += 1;
        continue;
      }
      await pool.query(
        `
        INSERT INTO document_index (
          tenant_id, source_id, provider, provider_file_id, provider_version_id,
          file_name, mime_type, file_extension, file_url, web_view_url, size_bytes,
          modified_at, relative_path, indexed_at, last_seen_at, status, metadata_json
        )
        VALUES ($1,$2,'zoho_workdrive',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),'indexed',$13::jsonb)
        ON CONFLICT (tenant_id, provider, provider_file_id)
        DO UPDATE SET
          source_id = EXCLUDED.source_id,
          provider_version_id = EXCLUDED.provider_version_id,
          file_name = EXCLUDED.file_name,
          mime_type = EXCLUDED.mime_type,
          file_extension = EXCLUDED.file_extension,
          file_url = EXCLUDED.file_url,
          web_view_url = EXCLUDED.web_view_url,
          size_bytes = EXCLUDED.size_bytes,
          modified_at = EXCLUDED.modified_at,
          relative_path = EXCLUDED.relative_path,
          last_seen_at = NOW(),
          status = 'updated',
          metadata_json = EXCLUDED.metadata_json
        `,
        [
          tenantId,
          sourceId,
          normalized.provider_file_id,
          normalized.provider_version_id,
          normalized.file_name,
          normalized.mime_type,
          normalized.file_extension,
          normalized.file_url,
          normalized.web_view_url,
          normalized.size_bytes,
          normalized.modified_at,
          normalized.relative_path,
          JSON.stringify(normalized.metadata_json),
        ]
      );
      indexed += 1;
    }
    return res.json({ ok: true, provider: 'zoho_workdrive', files_seen: listed.files.length, files_indexed: indexed, files_skipped: skipped });
  } catch (error) {
    console.error('ERROR SYNC ZOHO:', error.message);
    return res.status(error.statusCode || 500).json({ ok: false, code: error.code || 'ZOHO_SYNC_ERROR', error: error.statusCode ? error.message : 'Error sincronizando Zoho' });
  }
});

module.exports = router;
