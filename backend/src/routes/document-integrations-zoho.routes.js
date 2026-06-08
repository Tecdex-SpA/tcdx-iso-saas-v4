const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const {
  getJwtSecret,
} = require('../config/security');
const zoho = require('../services/zohoWorkdriveClient.service');

const router = express.Router();
const ZOHO_PROVIDER = 'zoho_workdrive';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return isSuperAdmin(user) || ['tenant_admin', 'admin', 'admin_cumplimiento', 'compliance_admin', 'compliance_manager'].includes(role(user));
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

function resolveTenantId(req) {
  return isSuperAdmin(req.user) ? (req.query.tenant_id || req.body?.tenant_id || getUserTenantId(req.user)) : getUserTenantId(req.user);
}

function assertManageZoho(req, res) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    res.status(400).json({ ok: false, code: 'TENANT_REQUIRED', error: 'tenant_id es obligatorio' });
    return null;
  }
  if (!ensureTenantAccess(req, tenantId)) {
    res.status(403).json({ ok: false, code: 'TENANT_DENIED', error: 'No autorizado para este tenant' });
    return null;
  }
  if (!canManage(req.user)) {
    res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para administrar Zoho WorkDrive' });
    return null;
  }
  return tenantId;
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'https://181.212.166.187:8443').replace(/\/$/, '');
}

function stateSecret() {
  const secret = getJwtSecret() || process.env.SESSION_SECRET || process.env.TOKEN_ENCRYPTION_KEY || process.env.AGENT_TOKEN_SIGNING_SECRET;
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
  const ageMs = Date.now() - Number(parsed.iat || 0);
  const expiresAt = Number(parsed.expires_at || 0);
  if (!parsed.tenant_id || !parsed.user_id || ageMs < 0 || ageMs > 10 * 60 * 1000 || (expiresAt && Date.now() > expiresAt)) {
    throw new Error('State OAuth expirado o incompleto');
  }
  return parsed;
}

function notConfigured(res) {
  return res.status(503).json({
    ok: false,
    code: 'ZOHO_PLATFORM_CONFIG_MISSING',
    error: 'Zoho WorkDrive no está configurado por la plataforma.',
  });
}

function tokenMetadata(tokens = {}) {
  return {
    ...zoho.extractTokenMetadata(tokens),
    scopes: zoho.getScopes(),
  };
}

function safeProbeForStorage(probe = {}) {
  return {
    ok: Boolean(probe.ok),
    code: probe.code || null,
    provider_status: probe.provider_status || null,
    provider_code: probe.provider_code || null,
    provider_message: probe.provider_message || null,
    message: probe.message || null,
    hint: probe.hint || null,
    endpoint: probe.endpoint || null,
    stage: probe.stage || probe.details?.stage || null,
    api_domain: probe.api_domain || probe.details?.api_domain || null,
    private_folders_count: probe.private_folders_count || probe.details?.private_folders_count || 0,
    team_folders_count: probe.team_folders_count || probe.details?.team_folders_count || 0,
    shared_folders_count: probe.shared_folders_count || probe.details?.shared_folders_count || 0,
    diagnostics: Array.isArray(probe.diagnostics || probe.details?.diagnostics)
      ? (probe.diagnostics || probe.details.diagnostics).slice(0, 10)
      : undefined,
    checked_at: new Date().toISOString(),
  };
}

function metadataValue(row, key) {
  const metadata = row?.metadata_json || {};
  return metadata?.[key] || metadata?.zoho?.[key] || null;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function resolveApiBaseUrl(source, credential) {
  return metadataValue(source, 'api_domain') || metadataValue(credential, 'api_domain') || null;
}

function shortId(value) {
  const raw = String(value || '');
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

async function getTenantZohoSource({ tenantId, sourceId = null }) {
  const params = [tenantId];
  let sourceFilter = '';
  if (sourceId) {
    params.push(sourceId);
    sourceFilter = `AND s.id = $2::uuid`;
  }

  const result = await pool.query(
    `
    SELECT s.*
    FROM tenant_document_sources s
    WHERE s.tenant_id = $1::uuid
      AND s.provider = $${params.length + 1}
      AND COALESCE(s.status, '') <> 'disconnected'
      ${sourceFilter}
    ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [...params, ZOHO_PROVIDER]
  );
  return result.rows[0] || null;
}

async function getCredential({ tenantId, credentialId = null, sourceId = null }) {
  const params = [tenantId, ZOHO_PROVIDER];
  const where = [`tenant_id = $1::uuid`, `provider = $2`];
  if (credentialId) {
    params.push(credentialId);
    where.push(`id = $${params.length}::uuid`);
  }
  if (sourceId) {
    params.push(sourceId);
    where.push(`source_id = $${params.length}::uuid`);
  }

  const result = await pool.query(
    `SELECT * FROM tenant_document_provider_credentials WHERE ${where.join(' AND ')} ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

async function ensureFreshCredential(credential) {
  const tokens = zoho.decryptZohoCredential(credential);
  const expiresAt = credential.token_expires_at ? new Date(credential.token_expires_at).getTime() : 0;
  const shouldRefresh = tokens.refresh_token && (!tokens.access_token || !expiresAt || expiresAt < Date.now() + 5 * 60 * 1000);
  if (!shouldRefresh) return { credential, tokens };

  const refreshed = await zoho.refreshAccessToken(tokens.refresh_token);
  const encrypted = zoho.encryptZohoTokens({
    ...refreshed,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
  });
  const metadata = tokenMetadata(refreshed);
  const result = await pool.query(
    `
    UPDATE tenant_document_provider_credentials
    SET access_token_encrypted = COALESCE($2, access_token_encrypted),
        refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
        token_expires_at = COALESCE($4, token_expires_at),
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $5::jsonb,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [
      credential.id,
      encrypted.access_token_encrypted,
      encrypted.refresh_token_encrypted,
      encrypted.token_expires_at,
      JSON.stringify(metadata),
    ]
  );
  return { credential: result.rows[0], tokens: zoho.decryptZohoCredential(result.rows[0]) };
}

async function upsertCredential({ client, tenantId, userId, tokens, sourceId = null }) {
  const existing = sourceId
    ? await client.query(
        `SELECT * FROM tenant_document_provider_credentials WHERE tenant_id = $1::uuid AND provider = $2 AND source_id = $3::uuid ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
        [tenantId, ZOHO_PROVIDER, sourceId]
      )
    : await client.query(
        `SELECT * FROM tenant_document_provider_credentials WHERE tenant_id = $1::uuid AND provider = $2 ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
        [tenantId, ZOHO_PROVIDER]
      );
  const encrypted = zoho.encryptZohoTokens(tokens);
  const metadata = tokenMetadata(tokens);

  if (existing.rowCount > 0) {
    const result = await client.query(
      `
      UPDATE tenant_document_provider_credentials
      SET access_token_encrypted = COALESCE($2, access_token_encrypted),
          refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
          token_expires_at = COALESCE($4, token_expires_at),
          scopes = $5,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $6::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING *
      `,
      [
        existing.rows[0].id,
        encrypted.access_token_encrypted,
        encrypted.refresh_token_encrypted,
        encrypted.token_expires_at,
        zoho.getScopes(),
        JSON.stringify(metadata),
      ]
    );
    return result.rows[0];
  }

  const result = await client.query(
    `
    INSERT INTO tenant_document_provider_credentials (
      tenant_id, provider, access_token_encrypted, refresh_token_encrypted,
      token_expires_at, scopes, metadata_json, created_by, source_id
    )
    VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8::uuid,$9::uuid)
    RETURNING *
    `,
    [
      tenantId,
      ZOHO_PROVIDER,
      encrypted.access_token_encrypted,
      encrypted.refresh_token_encrypted,
      encrypted.token_expires_at,
      zoho.getScopes(),
      JSON.stringify(metadata),
      userId || null,
      sourceId,
    ]
  );
  return result.rows[0];
}

function normalizeFolder(item) {
  if (item?.provider === ZOHO_PROVIDER && item?.can_open !== undefined && item?.name) {
    return {
      ...item,
      provider: ZOHO_PROVIDER,
      item_type: 'folder',
      type: item.type || 'folder',
      can_open: item.can_open !== false,
      can_select: item.can_select !== false,
      path: item.path || item.display_path || item.name,
      display_path: item.display_path || item.path || item.name,
    };
  }
  const attributes = item?.attributes || {};
  const id = item?.id || attributes.id || attributes.resource_id;
  const name = attributes.name || attributes.display_name || attributes.display_attr_name || attributes.display_html_name || attributes.title || id;
  const parentId = attributes.parent_id || attributes.parentId || null;
  const path = attributes.path || attributes.display_path || attributes.displayPath || name;
  return {
    id,
    provider_folder_id: id,
    name,
    parent_id: parentId,
    path,
    display_path: path,
    type: 'folder',
    item_type: 'folder',
    provider: ZOHO_PROVIDER,
    can_select: true,
    can_open: true,
    web_view_url: attributes.permalink || null,
    modified_at: attributes.modified_time || null,
    provider_team_id: attributes.library_id || attributes.team_id || null,
  };
}

function normalizeZohoListedFile(item) {
  const normalized = zoho.normalizeZohoItem(item);
  return {
    id: normalized.id,
    provider_file_id: normalized.provider_file_id,
    name: normalized.name,
    display_name: normalized.display_name || normalized.name,
    parent_id: normalized.parent_id || null,
    path: normalized.path || normalized.name,
    display_path: normalized.path || normalized.name,
    type: normalized.type || 'file',
    item_type: normalized.item_type || 'file',
    provider: ZOHO_PROVIDER,
    can_select: false,
    can_open: false,
    mime_type: normalized.mime_type || null,
    file_extension: normalized.file_extension || null,
    size_bytes: normalized.size_bytes || null,
    web_view_url: normalized.web_view_url || null,
  };
}

function zohoErrorDetails(error, fallbackStage = null) {
  const providerStatus = error.provider_status || error.statusCode || null;
  const providerCode = error.provider_code || error.details?.error || error.details?.code || null;
  const providerMessage = error.provider_message || error.details?.message || error.message || null;
  let hint = 'Revise conexión y permisos de Zoho WorkDrive.';
  if (providerStatus === 401) hint = 'Token Zoho expirado o inválido. Reconecte Zoho WorkDrive.';
  if (providerStatus === 403) hint = 'Permisos insuficientes de Zoho WorkDrive. Reconecte Zoho autorizando los scopes requeridos.';
  if (providerStatus === 404) hint = 'La carpeta o endpoint Zoho no existe para esta cuenta. Seleccione otra ubicación o reconecte.';
  return {
    stage: error.stage || fallbackStage,
    provider_status: providerStatus,
    provider_code: providerCode,
    provider_message: providerMessage,
    endpoint: error.endpoint || null,
    hint,
    diagnostics: Array.isArray(error.diagnostics) ? error.diagnostics.slice(0, 10) : undefined,
  };
}

function zohoUnauthorizedDetails(probe = null) {
  return {
    stage: probe?.stage || probe?.details?.stage || 'probe_workdrive_access',
    provider_status: probe?.provider_status || 401,
    provider_code: probe?.provider_code || 'R008',
    provider_message: probe?.provider_message || 'Unauthorized access',
    endpoint: probe?.endpoint || null,
    hint: probe?.hint || 'Reconecte Zoho WorkDrive aceptando permisos o revise API Console/scopes.',
    diagnostics: Array.isArray(probe?.diagnostics) ? probe.diagnostics.slice(0, 10) : undefined,
  };
}

function isUnauthorizedSource(source) {
  return String(source?.status || '').toLowerCase() === 'error' &&
    String(source?.last_sync_status || '').toLowerCase() === 'zoho_oauth_unauthorized';
}

function successDetails(folders, foldersResult, fallbackStage) {
  const details = foldersResult.details || {};
  if (folders.length > 0) {
    return {
      reason: details.reason || null,
      stage: details.stage || fallbackStage,
      message: details.message || null,
      api_domain: details.api_domain || null,
      provider_status: details.provider_status || null,
      provider_message: details.provider_message || null,
      private_folders_count: details.private_folders_count,
      team_folders_count: details.team_folders_count,
      shared_folders_count: details.shared_folders_count,
      folders_count: details.folders_count,
      files_count: details.files_count,
      total_items_count: details.total_items_count,
      diagnostics: Array.isArray(details.diagnostics) ? details.diagnostics.slice(0, 10) : undefined,
      ok_endpoints: details.ok_endpoints || undefined,
    };
  }
  return {
    reason: details.reason || 'no_visible_folders',
    stage: details.stage || fallbackStage,
    message: details.message || 'No se encontraron carpetas visibles en Zoho WorkDrive para esta cuenta.',
    api_domain: details.api_domain || null,
    provider_status: details.provider_status || null,
    provider_message: details.provider_message || null,
    folders_count: details.folders_count,
    files_count: details.files_count,
    total_items_count: details.total_items_count,
    diagnostics: Array.isArray(details.diagnostics) ? details.diagnostics.slice(0, 10) : undefined,
    ok_endpoints: details.ok_endpoints || undefined,
  };
}

function logZohoEndpointProbe({ req, tenantId, sourceId, diagnostics = [] }) {
  diagnostics.forEach((item) => {
    console.info('ZOHO_WORKDRIVE_ENDPOINT_PROBE:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: sourceId || null,
      endpoint: item.endpoint,
      status: item.status,
      provider_code: item.provider_code || null,
      provider_message: item.provider_message || null,
      ok: Boolean(item.ok),
      stage: 'root_endpoint_probe',
    });
  });
}

function normalizeRelativePath(...parts) {
  return parts
    .map((part) => String(part || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

async function upsertZohoDocument({ tenantId, source, credential, item, relativePath }) {
  const normalized = zoho.normalizeZohoFileToDocumentIndex(item);
  const isFolder = Boolean(normalized.metadata_json?.zoho?.is_folder);
  const finalRelativePath = relativePath || normalized.relative_path || normalized.file_name;
  const metadata = {
    ...normalized.metadata_json,
    zoho: {
      ...(normalized.metadata_json?.zoho || {}),
      api_domain: metadataValue(credential, 'api_domain') || null,
      source_id: source.id,
      folder_id: source.folder_id,
      relative_path: finalRelativePath,
      parent_folder_id: normalized.metadata_json?.zoho?.parent_folder_id || normalized.metadata_json?.zoho?.parent_id || null,
    },
  };

  await pool.query(
    `
    INSERT INTO document_index (
      tenant_id, source_id, provider, provider_file_id, provider_version_id,
      file_name, mime_type, file_extension, file_url, web_view_url, size_bytes,
      modified_at, relative_path, indexed_at, last_seen_at, status, metadata_json
    )
    VALUES (
      $1::uuid,$2::uuid,$3,$4,$5,
      $6,$7,$8,$9,$10,$11::bigint,
      $12::timestamp,$13::text,NOW(),NOW(),'indexed',$14::jsonb
    )
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
      metadata_json = COALESCE(document_index.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json
    `,
    [
      tenantId,
      source.id,
      ZOHO_PROVIDER,
      normalized.provider_file_id,
      normalized.provider_version_id,
      normalized.file_name,
      normalized.mime_type || (isFolder ? 'application/vnd.zoho.workdrive.folder' : null),
      isFolder ? 'folder' : normalized.file_extension,
      normalized.file_url,
      normalized.web_view_url,
      normalized.size_bytes,
      normalized.modified_at,
      finalRelativePath,
      JSON.stringify(metadata),
    ]
  );

  return isFolder ? 'folder' : 'file';
}

async function listZohoFilesRecursive({
  accessToken,
  apiBaseUrl,
  folderId,
  includeSubfolders,
  maxFiles = 1000,
  workspaceId = null,
  spaceType = null,
  preferredEndpoint = null,
}) {
  const files = [];
  const warnings = [];
  const visited = new Set();
  const rootDiagnostics = [];
  let rootWorkingEndpoint = null;

  async function walk(currentFolderId, currentPath, depth, options = {}) {
    if (visited.has(currentFolderId) || files.length >= maxFiles) return;
    visited.add(currentFolderId);
    const listed = await zoho.listZohoFolderContents({
      accessToken,
      apiBaseUrl,
      folderId: currentFolderId,
      workspaceId: options.workspaceId || null,
      spaceType: options.spaceType || null,
      preferredEndpoint: options.preferredEndpoint || null,
      includeFiles: true,
      includeFolders: true,
      stage: depth === 0 ? 'sync_root_folder' : 'sync_child_folder',
    });
    if (depth === 0) {
      rootDiagnostics.push(...(listed.diagnostics || []));
      rootWorkingEndpoint = listed.working_endpoint || null;
    }
    for (const item of [...(listed.folders || []), ...(listed.files || [])]) {
      if (files.length >= maxFiles) break;
      const normalized = zoho.normalizeZohoFileToDocumentIndex(item);
      const name = normalized.file_name || normalized.provider_file_id;
      const relativePath = normalizeRelativePath(currentPath, name);
      files.push({ item, relativePath });
      if (includeSubfolders && normalized.metadata_json?.zoho?.is_folder && depth < 5) {
        await walk(normalized.provider_file_id, relativePath, depth + 1, options).catch((error) => {
          warnings.push({
            type: 'zoho_folder_walk_failed',
            folder_id: normalized.provider_file_id,
            message: error.message,
            diagnostics: Array.isArray(error.diagnostics) ? error.diagnostics.slice(0, 5) : undefined,
          });
        });
      }
    }
  }

  await walk(folderId, '', 0, { workspaceId, spaceType, preferredEndpoint });

  return { files, warnings, root_diagnostics: rootDiagnostics, working_endpoint: rootWorkingEndpoint };
}

async function startOAuth(req, res) {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = assertManageZoho(req, res);
  if (!tenantId) return;

  const state = signState({
    provider: ZOHO_PROVIDER,
    tenant_id: tenantId,
    user_id: getUserId(req.user),
    nonce: crypto.randomBytes(16).toString('hex'),
    return_to: '/evidencias',
    expires_at: Date.now() + 10 * 60 * 1000,
    iat: Date.now(),
  });
  return res.json({ provider: ZOHO_PROVIDER, auth_url: zoho.buildAuthorizationUrl({ state }) });
}

router.get('/oauth/start', auth, startOAuth);
router.post('/oauth/start', auth, startOAuth);

router.get('/oauth/callback', async (req, res) => {
  const client = await pool.connect();
  const frontendUrl = getFrontendUrl();
  try {
    console.info('ZOHO_OAUTH_CALLBACK_REACHED:', {
      request_id: req.requestId || null,
      stage: 'callback_reached',
      code_present: Boolean(req.query.code),
      state_present: Boolean(req.query.state),
    });
    if (req.query.error) {
      return res.redirect(`${frontendUrl}/evidencias?zoho=error&drive_status=error&reason=${encodeURIComponent(String(req.query.error))}`);
    }
    if (!zoho.isZohoConfigured()) {
      return res.redirect(`${frontendUrl}/evidencias?zoho=error&drive_status=error&reason=not_configured`);
    }
    if (!req.query.code || !req.query.state) {
      return res.redirect(`${frontendUrl}/evidencias?zoho=error&drive_status=error&reason=missing_code_or_state`);
    }

    const payload = verifyState(req.query.state);
    if (payload.provider !== ZOHO_PROVIDER) throw new Error('Proveedor OAuth inválido');
    const tokens = await zoho.exchangeCodeForTokens(String(req.query.code));
    const tokenMeta = tokenMetadata(tokens);
    const tokenApiBaseUrl = tokenMeta.api_domain || null;
    console.info('ZOHO_OAUTH_TOKEN_EXCHANGED:', {
      request_id: req.requestId || null,
      tenant: shortId(payload.tenant_id),
      stage: 'token_exchanged',
      access_token_present: Boolean(tokens.access_token),
      refresh_token_present: Boolean(tokens.refresh_token),
      api_domain: tokenMeta.api_domain || null,
      token_logged: false,
    });
    console.info('ZOHO_WORKDRIVE_PROBE_START:', {
      request_id: req.requestId || null,
      tenant: shortId(payload.tenant_id),
      stage: 'probe_workdrive_access',
      api_domain: tokenMeta.api_domain || null,
    });
    const identity = await zoho.getZohoAccountIdentity({
      accessToken: tokens.access_token,
      apiBaseUrl: tokenApiBaseUrl,
    }).catch(() => null);
    const probe = await zoho.probeZohoWorkdriveAccess({
      accessToken: tokens.access_token,
      apiBaseUrl: tokenApiBaseUrl,
    });
    console.info('ZOHO_WORKDRIVE_PROBE_RESULT:', {
      request_id: req.requestId || null,
      tenant: shortId(payload.tenant_id),
      stage: probe.stage || probe.details?.stage || 'probe_workdrive_access',
      ok: probe.ok,
      code: probe.code,
      provider_status: probe.provider_status || null,
      provider_code: probe.provider_code || null,
      endpoint: probe.endpoint || null,
      root_nodes_count: probe.root_nodes_count || 0,
    });
    if (!probe.ok && probe.code === 'ZOHO_UNAUTHORIZED') {
      console.warn('ZOHO_WORKDRIVE_UNAUTHORIZED:', {
        request_id: req.requestId || null,
        tenant: shortId(payload.tenant_id),
        stage: probe.stage || 'probe_workdrive_access',
        provider_status: probe.provider_status,
        provider_code: probe.provider_code,
        endpoint: probe.endpoint || null,
      });
    }

    await client.query('BEGIN');

    const existingSources = await client.query(
      `
      SELECT id, folder_id
      FROM tenant_document_sources
      WHERE tenant_id = $1::uuid
        AND provider = $2
        AND COALESCE(status, '') <> 'disconnected'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      `,
      [payload.tenant_id, ZOHO_PROVIDER]
    );
    if (existingSources.rowCount > 1) {
      console.warn('WARN ZOHO OAUTH MULTIPLE_TENANT_SOURCES:', {
        request_id: req.requestId || null,
        tenant_source_count: existingSources.rowCount,
        selected_source_id: existingSources.rows[0]?.id || null,
      });
    }

    let sourceId = existingSources.rows[0]?.id || null;
    let sourceFolderId = existingSources.rows[0]?.folder_id || null;
    let credential = await upsertCredential({
      client,
      tenantId: payload.tenant_id,
      userId: payload.user_id,
      tokens,
      sourceId,
    });

    const sourceStatus = probe.ok ? 'active' : 'error';
    const sourceLastSyncStatus = probe.ok
      ? (sourceFolderId ? 'connected' : 'folder_required')
      : (probe.code === 'ZOHO_UNAUTHORIZED' ? 'zoho_oauth_unauthorized' : 'zoho_probe_failed');
    const sourceLastSyncError = probe.ok ? null : (probe.message || 'No fue posible validar acceso a Zoho WorkDrive.');
    const metadata = JSON.stringify({
      oauth_connected_at: new Date().toISOString(),
      folder_required: probe.ok && !sourceFolderId,
      provider: ZOHO_PROVIDER,
      zoho_probe: safeProbeForStorage(probe),
      account_email: identity?.account_email || null,
      account_name: identity?.account_name || null,
      ...tokenMeta,
    });

    if (sourceId) {
      const updated = await client.query(
        `
        UPDATE tenant_document_sources
        SET status = $5,
            sync_enabled = $6::boolean,
            provider_account_email = COALESCE($9, provider_account_email),
            last_sync_status = CASE
              WHEN $5 = 'error' THEN $7
              WHEN COALESCE(folder_id, '') = '' THEN 'folder_required'
              ELSE last_sync_status
            END,
            last_sync_error = $8,
            metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND provider = $4
        RETURNING id, folder_id
        `,
        [
          sourceId,
          payload.tenant_id,
          metadata,
          ZOHO_PROVIDER,
          sourceStatus,
          probe.ok,
          sourceLastSyncStatus,
          sourceLastSyncError,
          identity?.account_email || null,
        ]
      );
      sourceId = updated.rows[0]?.id || sourceId;
      sourceFolderId = updated.rows[0]?.folder_id || null;
    } else {
      const inserted = await client.query(
        `
        INSERT INTO tenant_document_sources (
          tenant_id, provider, source_name, status, sync_enabled, scan_frequency,
          last_sync_status, last_sync_error, provider_account_email, metadata_json, created_by_user_id, created_by, updated_at
        )
        VALUES ($1::uuid,$2,'Zoho WorkDrive',$5,$6::boolean,'manual',$7,$8,$9,$3::jsonb,$4::uuid,$4::uuid,NOW())
        RETURNING id, folder_id
        `,
        [
          payload.tenant_id,
          ZOHO_PROVIDER,
          metadata,
          payload.user_id,
          sourceStatus,
          probe.ok,
          sourceLastSyncStatus,
          sourceLastSyncError,
          identity?.account_email || null,
        ]
      );
      sourceId = inserted.rows[0]?.id || null;
      sourceFolderId = inserted.rows[0]?.folder_id || null;
    }

    credential = await client.query(
      `
      UPDATE tenant_document_provider_credentials
      SET source_id = $2::uuid,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING *
      `,
      [credential.id, sourceId, metadata]
    );

    await client.query('COMMIT');
    if (!probe.ok) {
      const reason = probe.code === 'ZOHO_UNAUTHORIZED' ? 'unauthorized_workdrive' : 'probe_failed';
      const driveStatus = probe.code === 'ZOHO_UNAUTHORIZED' ? 'zoho_oauth_unauthorized' : 'zoho_probe_failed';
      return res.redirect(`${frontendUrl}/evidencias?zoho=error&drive_status=${driveStatus}&reason=${reason}&source_id=${sourceId || ''}`);
    }
    const driveStatus = sourceFolderId ? 'connected' : 'folder_required';
    return res.redirect(`${frontendUrl}/evidencias?zoho=connected&drive_status=${driveStatus}&source_id=${sourceId || ''}&credential_id=${credential.rows[0]?.id || ''}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR ZOHO OAUTH CALLBACK:', {
      request_id: req.requestId || null,
      stage: 'zoho_oauth_callback',
      code: error.code || 'CALLBACK_FAILED',
      message: error.message,
      constraint: error.constraint || null,
      token_logged: false,
    });
    const invalidState = /state|firma|expirado|incompleto|proveedor/i.test(String(error.message || ''));
    return res.redirect(`${frontendUrl}/evidencias?zoho=error&drive_status=error&reason=${invalidState ? 'invalid_state' : 'callback_failed'}`);
  } finally {
    client.release();
  }
});

router.get('/folders', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = assertManageZoho(req, res);
  if (!tenantId) return;
  const sourceId = String(req.query.source_id || '').trim();
  if (sourceId && !isUuid(sourceId)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SOURCE_ID',
      error: 'source_id debe ser UUID de tenant_document_sources.',
    });
  }

  try {
    const parentId = String(req.query.parentId || req.query.parent_id || 'root').trim() || 'root';
    const isRootRequest = !parentId || ['root', 'my_drive', 'mi_unidad'].includes(parentId.toLowerCase());
    const source = await getTenantZohoSource({ tenantId, sourceId: sourceId || null });
    if (!source) return res.status(409).json({ ok: false, code: 'ZOHO_NOT_CONNECTED', error: 'Zoho WorkDrive no está conectado para este tenant.' });
    const credential = await getCredential({ tenantId, sourceId: source.id });
    if (!credential) return res.status(409).json({ ok: false, code: 'ZOHO_RECONNECT_REQUIRED', error: 'Reconecte Zoho WorkDrive para continuar.' });
    const fresh = await ensureFreshCredential(credential);
    const apiBaseUrl = resolveApiBaseUrl(source, fresh.credential);

    if (isRootRequest) {
      const endpointProbe = await zoho.diagnosticZohoWorkdriveEndpoints({
        accessToken: fresh.tokens.access_token,
        apiBaseUrl,
      });
      logZohoEndpointProbe({
        req,
        tenantId,
        sourceId: source.id,
        diagnostics: endpointProbe.diagnostics,
      });
      if (endpointProbe.all_unauthorized) {
        return res.status(409).json({
          ok: false,
          code: 'ZOHO_UNAUTHORIZED',
          error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
          details: {
            stage: 'root_endpoint_probe',
            provider_status: 401,
            provider_code: 'R008',
            provider_message: 'Unauthorized access',
            hint: 'Reconecte Zoho WorkDrive aceptando permisos o revise API Console/scopes.',
            diagnostics: endpointProbe.diagnostics,
          },
        });
      }
      if (isUnauthorizedSource(source) && !endpointProbe.ok) {
        return res.status(409).json({
          ok: false,
          code: 'ZOHO_UNAUTHORIZED',
          error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
          details: zohoUnauthorizedDetails({
            ...(source.metadata_json?.zoho_probe || {}),
            diagnostics: endpointProbe.diagnostics,
          }),
        });
      }
    } else if (isUnauthorizedSource(source)) {
      return res.status(409).json({
        ok: false,
        code: 'ZOHO_UNAUTHORIZED',
        error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
        details: zohoUnauthorizedDetails(source.metadata_json?.zoho_probe || null),
      });
    }

    console.info('ZOHO_FOLDERS_DISCOVERY_START:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: source.id,
      parent_id: parentId,
      stage: parentId === 'root' ? 'root_discovery' : 'folder_navigation',
    });
    const folders = await zoho.listFolders({
      accessToken: fresh.tokens.access_token,
      apiBaseUrl,
      parentId,
      pageToken: req.query.page_token || null,
    });
    logZohoEndpointProbe({
      req,
      tenantId,
      sourceId: source.id,
      diagnostics: folders.details?.diagnostics || [],
    });
    const current = folders.current || {
      id: parentId,
      name: parentId === 'root' ? 'Mi unidad' : parentId,
      path: parentId === 'root' ? 'Mi unidad' : parentId,
      parent_id: parentId === 'root' ? null : null,
      type: parentId === 'root' ? 'root' : 'folder',
    };
    const normalizedFolders = folders.folders.map((folder) => {
      const normalized = normalizeFolder(folder);
      const path = normalized.path && normalized.path !== normalized.name
        ? normalized.path
        : normalizeRelativePath(current.path, normalized.name);
      return {
        ...normalized,
        parent_id: normalized.parent_id || current.id,
        path,
        display_path: path,
      };
    });
    const normalizedFiles = (folders.files || []).map((file) => normalizeZohoListedFile(file));
    const details = successDetails(normalizedFolders, folders, current.type === 'root' ? 'root_discovery_completed' : 'list_folder');
    if (details.stage === 'list_private_space') {
      console.info('ZOHO_ROOT_FILES_RESULT:', {
        request_id: req.requestId || null,
        tenant: shortId(tenantId),
        source_id: source.id,
        stage: details.stage,
        endpoint: '/workdrive/api/v1/files',
        folders_count: details.folders_count || normalizedFolders.length,
        files_count: details.files_count || 0,
        total_items_count: details.total_items_count || null,
        reason: details.reason || null,
      });
    } else if (details.stage === 'list_folder') {
      console.info('ZOHO_FOLDER_CHILDREN_RESULT:', {
        request_id: req.requestId || null,
        tenant: shortId(tenantId),
        source_id: source.id,
        stage: details.stage,
        parent_id: parentId,
        folders_count: details.folders_count || normalizedFolders.length,
        files_count: details.files_count || 0,
        reason: details.reason || null,
      });
    }
    const breadcrumbs = parentId === 'root'
      ? [{ id: 'root', name: current.name || 'Zoho WorkDrive' }]
      : [
          { id: 'root', name: 'Mi unidad' },
          { id: current.id, name: current.name || current.id },
        ];
    if (parentId === 'root') {
      await pool.query(
        `
        UPDATE tenant_document_sources
        SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND provider = $4
        `,
        [
          source.id,
          tenantId,
          JSON.stringify({
            root_discovery: {
              stage: details.stage,
              reason: details.reason,
              private_folders_count: details.private_folders_count || 0,
              team_folders_count: details.team_folders_count || 0,
              shared_folders_count: details.shared_folders_count || 0,
              checked_at: new Date().toISOString(),
            },
          }),
          ZOHO_PROVIDER,
        ]
      ).catch(() => null);
    }
    console.info('ZOHO_FOLDERS_DISCOVERY_RESULT:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: source.id,
      parent_id: parentId,
      stage: details.stage,
      count: normalizedFolders.length,
      reason: details.reason || null,
    });
    if (normalizedFolders.length === 0) {
      console.warn('ZOHO_FOLDERS_EMPTY_WITH_REASON:', {
        request_id: req.requestId || null,
        tenant: shortId(tenantId),
        source_id: source.id,
        parent_id: parentId,
        stage: details.stage,
        reason: details.reason,
      });
    }

    return res.json({
      ok: true,
      provider: ZOHO_PROVIDER,
      source_id: source.id,
      parent_id: parentId,
      current,
      folders: normalizedFolders,
      files: normalizedFiles,
      next_page_token: folders.next_page_token,
      breadcrumbs,
      details,
      data: {
        source_id: source.id,
        current,
        folders: normalizedFolders,
        files: normalizedFiles,
        breadcrumbs,
        next_page_token: folders.next_page_token,
        details,
      },
    });
  } catch (error) {
    const details = zohoErrorDetails(error, error.stage || 'list_folder');
    const unauthorized = Number(details.provider_status || 0) === 401 || String(details.provider_code || '').toUpperCase() === 'R008';
    console.error('ZOHO_API_ERROR:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: sourceId || null,
      code: error.code || 'ZOHO_FOLDER_LIST_FAILED',
      message: error.message,
      details,
    });
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: unauthorized ? 'ZOHO_UNAUTHORIZED' : (error.code || 'ZOHO_FOLDER_LIST_FAILED'),
      error: unauthorized ? 'Zoho conectado, pero sin permisos efectivos para WorkDrive.' : 'Error consultando Zoho WorkDrive',
      details: unauthorized ? zohoUnauthorizedDetails(details) : details,
    });
  }
});

router.post('/select-folder', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = assertManageZoho(req, res);
  if (!tenantId) return;

  const sourceId = req.body?.source_id || null;
  const folderId = String(req.body?.folder_id || '').trim();
  const folderName = String(req.body?.folder_name || req.body?.folder_display_name || '').trim();
  const folderPath = String(req.body?.folder_path || '').trim();
  const workspaceId = String(req.body?.workspace_id || req.body?.zoho_workspace_id || '').trim() || null;
  const zohoSpaceType = String(req.body?.zoho_space_type || '').trim() || 'unknown';
  if (sourceId && !isUuid(sourceId)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SOURCE_ID',
      error: 'source_id debe ser UUID de tenant_document_sources.',
    });
  }
  if (!folderId) return res.status(400).json({ ok: false, code: 'ZOHO_FOLDER_REQUIRED', error: 'folder_id es obligatorio' });
  if (folderId.startsWith('zoho:')) {
    return res.status(400).json({
      ok: false,
      code: 'ZOHO_SYNTHETIC_ROOT_NOT_SELECTABLE',
      error: 'Seleccione una carpeta real de Zoho WorkDrive o pegue la URL de una carpeta.',
    });
  }

  try {
    const source = await getTenantZohoSource({ tenantId, sourceId });
    if (!source) return res.status(409).json({ ok: false, code: 'ZOHO_NOT_CONNECTED', error: 'Zoho WorkDrive no está conectado para este tenant.' });
    if (isUnauthorizedSource(source)) {
      return res.status(409).json({
        ok: false,
        code: 'ZOHO_UNAUTHORIZED',
        error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
        details: zohoUnauthorizedDetails(source.metadata_json?.zoho_probe || null),
      });
    }
    const credential = await getCredential({ tenantId, sourceId: source.id });
    if (!credential) return res.status(409).json({ ok: false, code: 'ZOHO_RECONNECT_REQUIRED', error: 'Reconecte Zoho WorkDrive para continuar.' });
    const fresh = await ensureFreshCredential(credential);
    const apiBaseUrl = resolveApiBaseUrl(source, fresh.credential);
    const metadata = await zoho.getFileMetadata({ accessToken: fresh.tokens.access_token, apiBaseUrl, fileId: folderId }).catch(() => null);
    const normalized = metadata
      ? normalizeFolder(metadata)
      : { id: folderId, name: folderName || 'Zoho WorkDrive', path: folderPath || folderName || 'Zoho WorkDrive', display_path: folderPath || folderName || 'Zoho WorkDrive', provider_team_id: null };
    const selectedPath = folderPath || normalized.display_path || normalized.path || normalized.name;
    const result = await pool.query(
      `
      UPDATE tenant_document_sources
      SET folder_id = $3::text,
          folder_display_name = $4::text,
          folder_path = $5::text,
          provider_team_id = COALESCE($6::text, provider_team_id),
          include_subfolders = $7::boolean,
          status = 'active',
          sync_enabled = true,
          last_sync_status = 'selected',
          last_sync_error = NULL,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $8::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND provider = $9
      RETURNING *
      `,
      [
        source.id,
        tenantId,
        folderId,
        normalized.name,
        selectedPath,
        normalized.provider_team_id || null,
        req.body?.include_subfolders !== false,
        JSON.stringify({
          folder_required: false,
          root_folder_id: folderId,
          root_folder_name: normalized.name,
          root_folder_path: selectedPath,
          workspace_id: workspaceId,
          zoho_workspace_id: workspaceId,
          zoho_space_type: zohoSpaceType,
          zoho_root_kind: 'real_folder',
          zoho_root_mode: 'folder',
          zoho_root_endpoint: null,
          provider: ZOHO_PROVIDER,
          selected_at: new Date().toISOString(),
        }),
        ZOHO_PROVIDER,
      ]
    );
    return res.json({ ok: true, source: result.rows[0] });
  } catch (error) {
    const details = zohoErrorDetails(error, error.stage || 'select_folder');
    console.error('ERROR SELECT ZOHO FOLDER:', {
      request_id: req.requestId || null,
      code: error.code || 'ZOHO_SELECT_FOLDER_FAILED',
      message: error.message,
      details,
    });
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || 'ZOHO_SELECT_FOLDER_FAILED',
      error: error.statusCode ? error.message : 'No fue posible seleccionar la carpeta Zoho WorkDrive.',
      details,
    });
  }
});

router.post('/select-folder-url', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = assertManageZoho(req, res);
  if (!tenantId) return;

  const sourceId = req.body?.source_id || null;
  const folderUrl = String(req.body?.folder_url || '').trim();
  const folderName = String(req.body?.folder_name || req.body?.folder_display_name || '').trim();
  const folderPath = String(req.body?.folder_path || '').trim();
  if (sourceId && !isUuid(sourceId)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SOURCE_ID',
      error: 'source_id debe ser UUID de tenant_document_sources.',
    });
  }

  try {
    const parsed = zoho.parseZohoFolderUrl(folderUrl);
    const source = await getTenantZohoSource({ tenantId, sourceId });
    if (!source) return res.status(409).json({ ok: false, code: 'ZOHO_NOT_CONNECTED', error: 'Zoho WorkDrive no está conectado para este tenant.' });
    if (isUnauthorizedSource(source)) {
      return res.status(409).json({
        ok: false,
        code: 'ZOHO_UNAUTHORIZED',
        error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
        details: zohoUnauthorizedDetails(source.metadata_json?.zoho_probe || null),
      });
    }
    const credential = await getCredential({ tenantId, sourceId: source.id });
    if (!credential) return res.status(409).json({ ok: false, code: 'ZOHO_RECONNECT_REQUIRED', error: 'Reconecte Zoho WorkDrive para continuar.' });
    const fresh = await ensureFreshCredential(credential);
    const apiBaseUrl = resolveApiBaseUrl(source, fresh.credential);
    const contents = await zoho.listZohoFolderContents({
      accessToken: fresh.tokens.access_token,
      apiBaseUrl,
      folderId: parsed.folder_id,
      workspaceId: parsed.workspace_id,
      spaceType: parsed.zoho_space_type,
      includeFiles: true,
      includeFolders: true,
      stage: 'select_folder_url_validate',
    });
    const metadata = await zoho.getFileMetadata({
      accessToken: fresh.tokens.access_token,
      apiBaseUrl,
      fileId: parsed.folder_id,
    }).catch(() => null);
    const normalized = metadata ? normalizeFolder(metadata) : null;
    const resolvedName = folderName || normalized?.name || parsed.folder_id;
    const resolvedPath = folderPath || normalized?.display_path || normalized?.path || `Zoho WorkDrive/${resolvedName}`;
    const metadataPatch = {
      folder_required: false,
      workspace_id: parsed.workspace_id,
      zoho_workspace_id: parsed.workspace_id,
      zoho_space_type: parsed.zoho_space_type || 'unknown',
      zoho_url_source: parsed.zoho_url_source,
      zoho_root_kind: 'real_folder',
      zoho_root_mode: 'folder',
      root_folder_id: parsed.folder_id,
      root_folder_name: resolvedName,
      root_folder_path: resolvedPath,
      selected_from_url: true,
      selected_at: new Date().toISOString(),
      zoho_working_list_endpoint: contents.working_endpoint || null,
      zoho_folder_validation: {
        ok: Boolean(contents.ok),
        empty: Boolean(contents.empty),
        files_count: contents.files?.length || 0,
        folders_count: contents.folders?.length || 0,
        working_endpoint: contents.working_endpoint || null,
        checked_at: new Date().toISOString(),
        diagnostics: (contents.diagnostics || []).slice(0, 10),
      },
    };
    const result = await pool.query(
      `
      UPDATE tenant_document_sources
      SET folder_id = $3::text,
          folder_display_name = $4::text,
          folder_path = $5::text,
          status = 'active',
          sync_enabled = true,
          last_sync_status = 'selected',
          last_sync_error = NULL,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $6::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND provider = $7
      RETURNING *
      `,
      [
        source.id,
        tenantId,
        parsed.folder_id,
        resolvedName,
        resolvedPath,
        JSON.stringify(metadataPatch),
        ZOHO_PROVIDER,
      ]
    );
    return res.json({
      ok: true,
      provider: ZOHO_PROVIDER,
      source: result.rows[0],
      validation: {
        folder_id: parsed.folder_id,
        workspace_id: parsed.workspace_id,
        zoho_space_type: parsed.zoho_space_type,
        files_count: contents.files?.length || 0,
        folders_count: contents.folders?.length || 0,
        working_endpoint: contents.working_endpoint || null,
        empty: Boolean(contents.empty),
        diagnostics: (contents.diagnostics || []).slice(0, 10),
      },
    });
  } catch (error) {
    const details = zohoErrorDetails(error, error.stage || 'select_folder_url');
    console.error('ERROR SELECT ZOHO FOLDER URL:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: sourceId || null,
      code: error.code || 'ZOHO_SELECT_FOLDER_URL_FAILED',
      message: error.message,
      details,
    });
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || 'ZOHO_SELECT_FOLDER_URL_FAILED',
      error: error.statusCode ? error.message : 'No fue posible seleccionar la carpeta desde la URL Zoho.',
      details,
    });
  }
});

router.post('/sources', auth, async (req, res) => {
  return res.status(410).json({
    ok: false,
    code: 'ZOHO_SOURCE_CREATION_REPLACED',
    error: 'Use /api/document-integrations/zoho/select-folder después de conectar Zoho WorkDrive.',
  });
});

router.post('/sync', auth, async (req, res) => {
  if (!zoho.isZohoConfigured()) return notConfigured(res);
  const tenantId = assertManageZoho(req, res);
  if (!tenantId) return;
  const sourceId = req.body?.source_id || req.query.source_id;
  if (!sourceId) return res.status(400).json({ ok: false, code: 'SOURCE_REQUIRED', error: 'source_id es obligatorio' });
  if (!isUuid(sourceId)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SOURCE_ID',
      error: 'source_id debe ser UUID de tenant_document_sources.',
    });
  }

  try {
    const source = await getTenantZohoSource({ tenantId, sourceId });
    if (!source) return res.status(404).json({ ok: false, code: 'ZOHO_SOURCE_NOT_FOUND', error: 'Fuente Zoho no encontrada' });
    if (isUnauthorizedSource(source)) {
      return res.status(409).json({
        ok: false,
        code: 'ZOHO_UNAUTHORIZED',
        error: 'Zoho conectado, pero sin permisos efectivos para WorkDrive.',
        details: zohoUnauthorizedDetails(source.metadata_json?.zoho_probe || null),
      });
    }
    if (!source.folder_id) {
      return res.status(409).json({ ok: false, code: 'ZOHO_ROOT_FOLDER_REQUIRED', error: 'Seleccione una carpeta de Zoho WorkDrive antes de sincronizar.' });
    }
    if (String(source.folder_id || '').startsWith('zoho:')) {
      return res.status(409).json({
        ok: false,
        provider: ZOHO_PROVIDER,
        code: 'ZOHO_SYNTHETIC_ROOT_NOT_SYNCABLE',
        error: 'Seleccione una carpeta real de Zoho WorkDrive o pegue la URL de una carpeta.',
        details: {
          folder_id: source.folder_id,
          hint: 'Las raíces sintéticas solo sirven para navegar en la UI, no para sincronización final.',
        },
      });
    }
    const credential = await getCredential({ tenantId, sourceId: source.id });
    if (!credential) return res.status(409).json({ ok: false, code: 'ZOHO_RECONNECT_REQUIRED', error: 'Reconecte Zoho WorkDrive para continuar.' });
    const fresh = await ensureFreshCredential(credential);
    const apiBaseUrl = resolveApiBaseUrl(source, fresh.credential);
    console.info('ZOHO_SYNC_START:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: source.id,
      stage: 'sync_start',
      folder_id: source.folder_id,
      root_mode: metadataValue(source, 'zoho_root_mode') || null,
    });
    const listed = await listZohoFilesRecursive({
      accessToken: fresh.tokens.access_token,
      apiBaseUrl,
      folderId: source.folder_id,
      includeSubfolders: source.include_subfolders !== false,
      maxFiles: Number(req.body?.max_files || 1000),
      workspaceId: metadataValue(source, 'workspace_id') || metadataValue(source, 'zoho_workspace_id') || null,
      spaceType: metadataValue(source, 'zoho_space_type') || null,
      preferredEndpoint: metadataValue(source, 'zoho_working_list_endpoint') || null,
    });

    let filesIndexed = 0;
    let foldersIndexed = 0;
    let filesErrors = 0;
    let filesSeen = 0;
    let foldersSeen = 0;
    const warnings = [...listed.warnings];
    for (const row of listed.files) {
      const normalized = zoho.normalizeZohoFileToDocumentIndex(row.item);
      if (normalized.metadata_json?.zoho?.is_folder) foldersSeen += 1;
      else filesSeen += 1;
      try {
        const kind = await upsertZohoDocument({
          tenantId,
          source,
          credential: fresh.credential,
          item: row.item,
          relativePath: row.relativePath,
        });
        if (kind === 'folder') foldersIndexed += 1;
        else filesIndexed += 1;
      } catch (error) {
        filesErrors += 1;
        warnings.push({ type: 'zoho_file_upsert_failed', message: error.message });
      }
    }

    const totalIndexed = filesIndexed + foldersIndexed;
    const totalSeen = filesSeen + foldersSeen;
    if (totalSeen === 0) {
      await pool.query(
        `
        UPDATE tenant_document_sources
        SET status = 'active',
            last_sync_status = 'failed_empty_or_unreadable',
            last_sync_error = $3::text,
            metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $4::jsonb,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND provider = $5
        `,
        [
          source.id,
          tenantId,
          'Zoho no devolvió archivos para esta carpeta o no fue posible verificar su contenido.',
          JSON.stringify({
            zoho_last_sync_diagnostics: {
              status: 'failed_empty_or_unreadable',
              folder_id: source.folder_id,
              workspace_id: metadataValue(source, 'workspace_id') || metadataValue(source, 'zoho_workspace_id') || null,
              zoho_space_type: metadataValue(source, 'zoho_space_type') || null,
              tested_endpoints: (listed.root_diagnostics || []).slice(0, 10),
              checked_at: new Date().toISOString(),
            },
          }),
          ZOHO_PROVIDER,
        ]
      );
      console.warn('ZOHO_SYNC_RESULT:', {
        request_id: req.requestId || null,
        tenant: shortId(tenantId),
        source_id: source.id,
        stage: 'sync_result',
        status: 'failed_empty_or_unreadable',
        files_seen: 0,
        folders_seen: 0,
      });
      return res.status(409).json({
        ok: false,
        provider: ZOHO_PROVIDER,
        status: 'failed_empty_or_unreadable',
        code: 'ZOHO_FOLDER_EMPTY_OR_UNREADABLE',
        error: 'Zoho no devolvió archivos para esta carpeta. Verifique que la URL sea de una carpeta con contenido y que la cuenta conectada tenga acceso.',
        files_seen: 0,
        folders_seen: 0,
        files_indexed: 0,
        folders_indexed: 0,
        details: {
          folder_id: source.folder_id,
          workspace_id: metadataValue(source, 'workspace_id') || metadataValue(source, 'zoho_workspace_id') || null,
          zoho_space_type: metadataValue(source, 'zoho_space_type') || null,
          tested_endpoints: (listed.root_diagnostics || []).slice(0, 10),
        },
      });
    }

    const finalStatus = totalIndexed === 0 && filesErrors > 0
        ? 'error'
        : (filesErrors || warnings.length) ? 'completed_with_warnings' : 'completed';
    const finalError = finalStatus === 'error'
      ? 'Zoho WorkDrive no pudo indexar los elementos visibles.'
      : null;
    await pool.query(
      `
      UPDATE tenant_document_sources
      SET last_sync_at = NOW(),
          status = 'active',
          last_sync_status = $3,
          last_sync_error = $4,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $5::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      `,
      [
        source.id,
        tenantId,
        finalStatus,
        finalError,
        JSON.stringify({
          zoho_working_list_endpoint: listed.working_endpoint || metadataValue(source, 'zoho_working_list_endpoint') || null,
          zoho_last_sync_diagnostics: {
            status: finalStatus,
            folder_id: source.folder_id,
            workspace_id: metadataValue(source, 'workspace_id') || metadataValue(source, 'zoho_workspace_id') || null,
            zoho_space_type: metadataValue(source, 'zoho_space_type') || null,
            tested_endpoints: (listed.root_diagnostics || []).slice(0, 10),
            checked_at: new Date().toISOString(),
          },
        }),
      ]
    );
    console.info('ZOHO_SYNC_RESULT:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: source.id,
      stage: 'sync_result',
      status: finalStatus,
      files_seen: filesSeen,
      files_indexed: filesIndexed,
      folders_seen: foldersSeen,
      folders_indexed: foldersIndexed,
      files_errors: filesErrors,
      warnings_count: warnings.length,
    });

    if (finalStatus === 'error') {
      return res.status(500).json({
        ok: false,
        provider: ZOHO_PROVIDER,
        status: finalStatus,
        code: 'ZOHO_SYNC_INDEX_FAILED',
        error: finalError,
        files_seen: filesSeen,
        files_indexed: filesIndexed,
        folders_seen: foldersSeen,
        folders_indexed: foldersIndexed,
        files_errors: filesErrors,
        warnings_count: warnings.length,
        warnings: warnings.slice(0, 20),
      });
    }

    return res.json({
      ok: true,
      provider: ZOHO_PROVIDER,
      status: finalStatus,
      files_seen: filesSeen,
      files_indexed: filesIndexed,
      files_created: filesIndexed,
      files_updated: 0,
      folders_seen: foldersSeen,
      folders_indexed: foldersIndexed,
      files_skipped: 0,
      files_errors: filesErrors,
      warnings_count: warnings.length,
      warnings: warnings.slice(0, 20),
    });
  } catch (error) {
    const details = zohoErrorDetails(error, error.stage || 'sync_zoho');
    console.error('ZOHO_API_ERROR:', {
      request_id: req.requestId || null,
      tenant: shortId(tenantId),
      source_id: sourceId || null,
      code: error.code || 'ZOHO_SYNC_ERROR',
      message: error.message,
      details,
    });
    await pool.query(
      `
      UPDATE tenant_document_sources
      SET status = 'active',
          last_sync_status = 'error',
          last_sync_error = $3::text,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND provider = $4
      `,
      [sourceId, tenantId, error.message || 'Error sincronizando Zoho WorkDrive', ZOHO_PROVIDER]
    ).catch(() => null);
    return res.status(error.statusCode || 500).json({
      ok: false,
      provider: ZOHO_PROVIDER,
      status: 'error',
      code: error.code || 'ZOHO_SYNC_ERROR',
      error: error.statusCode ? error.message : 'Error sincronizando Zoho',
      details,
    });
  }
});

module.exports = router;
