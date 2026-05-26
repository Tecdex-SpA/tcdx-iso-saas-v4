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
    const err = new Error('Conector Zoho no configurado');
    err.statusCode = 503;
    err.code = 'ZOHO_CONNECTOR_NOT_CONFIGURED';
    throw err;
  }
}

function getAccountsBaseUrl() {
  assertZohoConfigured();
  return trimSlash(process.env.ZOHO_ACCOUNTS_BASE_URL);
}

function getApiBaseUrl() {
  assertZohoConfigured();
  return trimSlash(process.env.ZOHO_API_BASE_URL);
}

function getScopes() {
  return String(process.env.ZOHO_WORKDRIVE_SCOPES || DEFAULT_SCOPES.join(','))
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

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    const err = new Error(json?.error_description || json?.error || fallbackMessage);
    err.statusCode = response.status;
    err.code = json?.error || 'ZOHO_API_ERROR';
    err.details = json;
    throw err;
  }

  return json;
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

  return readJsonResponse(response, 'Error intercambiando código Zoho');
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

  return readJsonResponse(response, 'Error refrescando token Zoho');
}

async function zohoGetJson({ accessToken, path, searchParams = {} }) {
  const url = new URL(`${getApiBaseUrl()}${path}`);
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  return readJsonResponse(response, 'Error consultando Zoho WorkDrive');
}

async function listFolders({ accessToken, parentId = 'root', pageToken = null }) {
  const path = parentId && parentId !== 'root'
    ? `/workdrive/files/${encodeURIComponent(parentId)}/files`
    : '/workdrive/files';

  const json = await zohoGetJson({
    accessToken,
    path,
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });

  const rows = Array.isArray(json?.data) ? json.data : [];
  return {
    folders: rows.filter((item) => item?.attributes?.is_folder === true || item?.attributes?.type === 'folder'),
    next_page_token: json?.links?.cursor?.next || null,
    raw: json,
  };
}

async function listFiles({ accessToken, folderId, includeSubfolders = true }) {
  const path = folderId
    ? `/workdrive/files/${encodeURIComponent(folderId)}/files`
    : '/workdrive/files';

  const json = await zohoGetJson({
    accessToken,
    path,
    searchParams: { 'page[limit]': 100 },
  });

  const rows = Array.isArray(json?.data) ? json.data : [];
  return {
    files: rows,
    include_subfolders: includeSubfolders,
    raw: json,
  };
}

async function getFileMetadata({ accessToken, fileId }) {
  const json = await zohoGetJson({
    accessToken,
    path: `/workdrive/files/${encodeURIComponent(fileId)}`,
  });
  return json?.data || json;
}

async function downloadFile({ accessToken, fileId }) {
  const metadata = await getFileMetadata({ accessToken, fileId });
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
        parent_id: attributes.parent_id || null,
        is_folder: Boolean(attributes.is_folder),
        download_url_present: Boolean(attributes.download_url),
        library_id: attributes.library_id || null,
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
};
