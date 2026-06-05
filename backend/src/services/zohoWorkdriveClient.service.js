const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/cryptoSecret.util');

const DEFAULT_SCOPES = [
  'WorkDrive.files.READ',
  'WorkDrive.team.READ',
  'ZohoFiles.files.READ',
];

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isZohoConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REDIRECT_URI &&
      process.env.ZOHO_ACCOUNTS_BASE_URL &&
      process.env.ZOHO_API_BASE_URL
  );
}

function assertZohoConfigured() {
  if (!isZohoConfigured()) {
    const err = new Error('Zoho WorkDrive no está configurado por la plataforma.');
    err.statusCode = 503;
    err.code = 'ZOHO_PLATFORM_CONFIG_MISSING';
    throw err;
  }
}

function getConfigStatus() {
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REDIRECT_URI', 'ZOHO_ACCOUNTS_BASE_URL', 'ZOHO_API_BASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  return {
    configured: missing.length === 0,
    missing,
  };
}

function getAccountsBaseUrl() {
  assertZohoConfigured();
  return trimSlash(process.env.ZOHO_ACCOUNTS_BASE_URL);
}

function getApiBaseUrl() {
  assertZohoConfigured();
  return trimSlash(process.env.ZOHO_API_BASE_URL);
}

function resolveApiBaseUrl(value = null) {
  const raw = String(value || '').trim();
  if (raw) return trimSlash(raw);
  return getApiBaseUrl();
}

function getScopes() {
  return String(process.env.ZOHO_SCOPES || process.env.ZOHO_WORKDRIVE_SCOPES || DEFAULT_SCOPES.join(','))
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function buildAuthorizationUrl({ state }) {
  assertZohoConfigured();
  const url = new URL(`${getAccountsBaseUrl()}/oauth/v2/auth`);
  url.searchParams.set('scope', getScopes().join(','));
  url.searchParams.set('client_id', process.env.ZOHO_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('redirect_uri', process.env.ZOHO_REDIRECT_URI);
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

function safeEndpoint(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || '').split('?')[0];
  }
}

function providerErrorCode(json = {}) {
  return (
    json?.errors?.[0]?.id ||
    json?.errors?.[0]?.code ||
    json?.error_code ||
    json?.code ||
    json?.error ||
    null
  );
}

function providerErrorMessage(json = {}) {
  return (
    json?.errors?.[0]?.title ||
    json?.errors?.[0]?.detail ||
    json?.message ||
    json?.error_description ||
    json?.error ||
    null
  );
}

async function readJsonResponse(response, fallbackMessage, context = {}) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    const err = new Error(providerErrorMessage(json) || fallbackMessage);
    err.statusCode = response.status;
    err.code = 'ZOHO_API_ERROR';
    err.provider_status = response.status;
    err.provider_status_text = response.statusText;
    err.provider_code = providerErrorCode(json);
    err.provider_message = providerErrorMessage(json);
    err.endpoint = context.endpoint || safeEndpoint(response.url);
    err.stage = context.stage || null;
    err.details = json;
    throw err;
  }

  return json;
}

function buildZohoUrl({ path, searchParams = {}, apiBaseUrl = null }) {
  const url = new URL(`${resolveApiBaseUrl(apiBaseUrl)}${path}`);
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

function extractTokenMetadata(tokens = {}) {
  return {
    api_domain: tokens.api_domain || tokens.apiDomain || null,
    accounts_server: tokens.accounts_server || tokens.accountsServer || null,
    location: tokens.location || null,
    token_type: tokens.token_type || null,
  };
}

async function exchangeCodeForTokens(code) {
  assertZohoConfigured();
  const body = new URLSearchParams({
    code,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: process.env.ZOHO_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`${getAccountsBaseUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  return readJsonResponse(response, 'Error intercambiando código Zoho', { stage: 'exchange_code' });
}

async function refreshAccessToken(refreshToken) {
  assertZohoConfigured();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${getAccountsBaseUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  return readJsonResponse(response, 'Error refrescando token Zoho', { stage: 'refresh_token' });
}

async function zohoGetJson({ accessToken, path, searchParams = {}, apiBaseUrl = null, stage = null }) {
  const url = buildZohoUrl({ path, searchParams, apiBaseUrl });
  const response = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  return readJsonResponse(response, 'Error consultando Zoho WorkDrive', {
    endpoint: safeEndpoint(url.toString()),
    stage,
  });
}

async function zohoGetJsonAny({ accessToken, candidates = [], searchParams = {}, apiBaseUrl = null, stage = null }) {
  let lastError = null;
  for (const path of candidates) {
    try {
      return await zohoGetJson({ accessToken, path, searchParams, apiBaseUrl, stage });
    } catch (error) {
      lastError = error;
      const status = Number(error.provider_status || error.statusCode || 0);
      if (![400, 403, 404, 405, 409].includes(status)) {
        throw error;
      }
    }
  }
  throw lastError || Object.assign(new Error('Error consultando Zoho WorkDrive'), {
    code: 'ZOHO_API_ERROR',
    stage,
  });
}

function isFolderItem(item) {
  const attributes = item?.attributes || {};
  const type = String(item?.type || attributes?.type || attributes?.resource_type || '').toLowerCase();
  const mimeType = String(attributes?.mime_type || attributes?.mimetype || '').toLowerCase();
  return (
    attributes?.is_folder === true ||
    attributes?.isFolder === true ||
    type.includes('folder') ||
    type.includes('team') ||
    mimeType.includes('folder')
  );
}

function rootFolderCandidates() {
  return [
    '/workdrive/api/v1/teamfolders',
    '/workdrive/api/v1/files',
    '/workdrive/teamfolders',
    '/workdrive/files',
  ];
}

function childFolderCandidates(parentId) {
  const encoded = encodeURIComponent(parentId);
  return [
    `/workdrive/api/v1/files/${encoded}/files`,
    `/workdrive/files/${encoded}/files`,
  ];
}

async function listFolders({ accessToken, parentId = 'root', pageToken = null, apiBaseUrl = null }) {
  const normalizedParent = String(parentId || '').trim();
  const isRoot = !normalizedParent || ['root', 'my_drive', 'mi_unidad'].includes(normalizedParent.toLowerCase());
  const candidates = isRoot ? rootFolderCandidates() : childFolderCandidates(normalizedParent);

  const json = await zohoGetJsonAny({
    accessToken,
    candidates,
    apiBaseUrl,
    stage: isRoot ? 'list_root' : 'list_folder',
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });

  const rows = Array.isArray(json?.data) ? json.data : [];
  return {
    folders: rows.filter(isFolderItem),
    next_page_token: json?.links?.cursor?.next || null,
    current: {
      id: isRoot ? 'root' : normalizedParent,
      name: isRoot ? 'Mi unidad' : normalizedParent,
      path: isRoot ? 'Mi unidad' : normalizedParent,
      parent_id: isRoot ? null : null,
      type: isRoot ? 'root' : 'folder',
    },
    raw: json,
  };
}

async function listFiles({ accessToken, folderId, includeSubfolders = true, apiBaseUrl = null }) {
  const json = await zohoGetJsonAny({
    accessToken,
    candidates: folderId ? childFolderCandidates(folderId) : rootFolderCandidates(),
    apiBaseUrl,
    stage: 'sync_list_files',
    searchParams: { 'page[limit]': 100 },
  });

  const rows = Array.isArray(json?.data) ? json.data : [];
  return {
    files: rows,
    include_subfolders: includeSubfolders,
    raw: json,
  };
}

async function getFileMetadata({ accessToken, fileId, apiBaseUrl = null }) {
  const encoded = encodeURIComponent(fileId);
  const json = await zohoGetJsonAny({
    accessToken,
    candidates: [
      `/workdrive/api/v1/files/${encoded}`,
      `/workdrive/files/${encoded}`,
    ],
    apiBaseUrl,
    stage: 'file_metadata',
  });
  return json?.data || json;
}

async function downloadFile({ accessToken, fileId, apiBaseUrl = null }) {
  const metadata = await getFileMetadata({ accessToken, fileId, apiBaseUrl });
  const downloadUrl = metadata?.attributes?.download_url;
  if (!downloadUrl) {
    const err = new Error('Documento Zoho no contiene download_url');
    err.statusCode = 409;
    err.code = 'ZOHO_DOWNLOAD_URL_MISSING';
    throw err;
  }

  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!response.ok) {
    const err = new Error('Error descargando archivo Zoho');
    err.statusCode = response.status;
    err.code = 'ZOHO_DOWNLOAD_ERROR';
    throw err;
  }

  return {
    stream: response.body,
    content_type: response.headers.get('content-type') || 'application/octet-stream',
    content_length: response.headers.get('content-length'),
    metadata,
  };
}

function normalizeZohoFileToDocumentIndex(file) {
  const attributes = file?.attributes || {};
  const id = file?.id || attributes?.id || crypto.createHash('sha1').update(JSON.stringify(file || {})).digest('hex');
  const name = attributes.name || attributes.display_attr_name || attributes.display_html_name || attributes.title || id;
  const modifiedMs = Number(attributes.modified_time_in_millisecond || attributes.uploaded_time_in_millisecond || 0);

  return {
    provider_file_id: id,
    provider_version_id: attributes.version_id || attributes.status_change_time_in_millisecond || null,
    file_name: name,
    mime_type: attributes.mime_type || null,
    file_extension: attributes.extn || null,
    file_url: attributes.permalink || null,
    web_view_url: attributes.permalink || null,
    size_bytes: Number(attributes.storage_info?.size_in_bytes || attributes.size_in_bytes || 0) || null,
    modified_at: modifiedMs ? new Date(modifiedMs) : null,
    relative_path: attributes.path || name,
    metadata_json: {
      zoho: {
        id,
        parent_id: attributes.parent_id || null,
        parent_folder_id: attributes.parent_id || null,
        file_id: id,
        provider_file_id: id,
        is_folder: Boolean(attributes.is_folder),
        download_url_present: Boolean(attributes.download_url),
        library_id: attributes.library_id || null,
        relative_path: attributes.path || name,
      },
    },
  };
}

function encryptZohoTokens(tokens) {
  return {
    access_token_encrypted: tokens?.access_token ? encryptSecret(tokens.access_token) : null,
    refresh_token_encrypted: tokens?.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    token_expires_at: tokens?.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
  };
}

function decryptZohoCredential(credential) {
  return {
    access_token: decryptSecret(credential.access_token_encrypted),
    refresh_token: decryptSecret(credential.refresh_token_encrypted),
    token_expires_at: credential.token_expires_at,
  };
}

module.exports = {
  isZohoConfigured,
  assertZohoConfigured,
  getConfigStatus,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listFolders,
  listFiles,
  getFileMetadata,
  downloadFile,
  normalizeZohoFileToDocumentIndex,
  encryptZohoTokens,
  decryptZohoCredential,
  getScopes,
  extractTokenMetadata,
  resolveApiBaseUrl,
};
