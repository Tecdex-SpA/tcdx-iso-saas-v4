const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/cryptoSecret.util');

const DEFAULT_SCOPES = [
  'WorkDrive.files.READ',
  'WorkDrive.team.READ',
  'ZohoFiles.files.READ',
];
const WORKDRIVE_API_PREFIX = '/workdrive/api/v1';
const PERSONAL_ROOT_ALIAS = 'zoho:root:files';
const LEGACY_PRIVATE_ROOT_ALIAS = 'zoho:privatespace:root';
const ACCEPT_HEADER_VARIANTS = [
  'application/vnd.api+json',
  'application/json',
  '*/*',
];
const ZOHO_ID_RE = /^[A-Za-z0-9_-]{8,}$/;

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isZohoConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REDIRECT_URI &&
      process.env.ZOHO_ACCOUNTS_BASE_URL
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
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REDIRECT_URI', 'ZOHO_ACCOUNTS_BASE_URL'];
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

function resolveAccountsServerUrl(value = null) {
  const raw = String(value || process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.com').trim();
  return trimSlash(raw || 'https://accounts.zoho.com');
}

function getApiBaseUrl() {
  return trimSlash(process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.com');
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

function cloneZohoError(error, stage = null) {
  return {
    code: error?.code || 'ZOHO_API_ERROR',
    message: error?.message || 'Error consultando Zoho WorkDrive',
    provider_status: error?.provider_status || error?.statusCode || null,
    provider_code: error?.provider_code || null,
    provider_message: error?.provider_message || null,
    endpoint: error?.endpoint || null,
    stage: error?.stage || stage || null,
  };
}

function isZohoUnauthorized(error) {
  return Number(error?.provider_status || error?.statusCode || 0) === 401 ||
    String(error?.provider_code || '').toUpperCase() === 'R008';
}

function normalizeZohoProbeError(error, stage = null) {
  const unauthorized = isZohoUnauthorized(error);
  const forbidden = Number(error?.provider_status || error?.statusCode || 0) === 403;
  if (unauthorized) {
    return {
      ok: false,
      code: 'ZOHO_UNAUTHORIZED',
      provider_status: 401,
      provider_code: error?.provider_code || 'R008',
      provider_message: error?.provider_message || error?.message || 'Unauthorized access',
      message: 'Zoho OAuth conectado, pero el token no tiene acceso efectivo a WorkDrive API.',
      hint: 'Reconecte aceptando permisos WorkDrive o revise scopes/API Console/WorkDrive habilitado para la cuenta.',
      endpoint: error?.endpoint || null,
      stage: error?.stage || stage || null,
      diagnostics: Array.isArray(error?.diagnostics) ? error.diagnostics : undefined,
    };
  }
  if (forbidden) {
    return {
      ok: false,
      code: 'ZOHO_SCOPE_OR_PERMISSION_DENIED',
      provider_status: 403,
      provider_code: error?.provider_code || null,
      provider_message: error?.provider_message || error?.message || null,
      message: 'Zoho OAuth conectado, pero los permisos WorkDrive no son suficientes.',
      hint: 'Reconecte Zoho WorkDrive aceptando los scopes requeridos.',
      endpoint: error?.endpoint || null,
      stage: error?.stage || stage || null,
      diagnostics: Array.isArray(error?.diagnostics) ? error.diagnostics : undefined,
    };
  }
  return {
    ok: false,
    code: error?.code || 'ZOHO_WORKDRIVE_PROBE_FAILED',
    provider_status: error?.provider_status || error?.statusCode || null,
    provider_code: error?.provider_code || null,
    provider_message: error?.provider_message || error?.message || null,
    message: error?.message || 'No fue posible validar acceso a Zoho WorkDrive.',
    hint: 'Revise configuración de Zoho WorkDrive, scopes y dominio API del tenant.',
    endpoint: error?.endpoint || null,
    stage: error?.stage || stage || null,
  };
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

function diagnosticEndpointCandidates() {
  return [
    '/workdrive/api/v1/teams',
    '/workdrive/api/v1/teamfolders',
    '/workdrive/api/v1/privatespace/folders/files',
    '/workdrive/api/v1/files',
  ];
}

function responseKeys(json = {}) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  return Object.keys(json).slice(0, 20);
}

function safeRawSnippet(text = '') {
  const raw = String(text || '').slice(0, 500);
  if (/(access[_-]?token|refresh[_-]?token|authorization|client[_-]?secret|zoho-oauthtoken|gocspx)/i.test(raw)) {
    return '[redacted]';
  }
  return raw;
}

function safeZohoUrlSource(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return raw.split('?')[0].slice(0, 500);
  }
}

function validateZohoId(value, fieldName = 'id') {
  const raw = String(value || '').trim();
  if (!raw || !ZOHO_ID_RE.test(raw)) {
    const err = new Error(`${fieldName} Zoho inválido.`);
    err.code = 'INVALID_ZOHO_FOLDER_URL';
    err.statusCode = 400;
    err.stage = 'parse_folder_url';
    throw err;
  }
  return raw;
}

function parseZohoFolderUrl(folderUrl) {
  const raw = String(folderUrl || '').trim();
  if (!raw) {
    const err = new Error('URL de carpeta Zoho es obligatoria.');
    err.code = 'ZOHO_FOLDER_URL_REQUIRED';
    err.statusCode = 400;
    err.stage = 'parse_folder_url';
    throw err;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    const err = new Error('URL de Zoho WorkDrive inválida.');
    err.code = 'INVALID_ZOHO_FOLDER_URL';
    err.statusCode = 400;
    err.stage = 'parse_folder_url';
    throw err;
  }

  const host = parsed.hostname.toLowerCase();
  if (!/(^|\.)workdrive\.zoho\.com$/.test(host) && !/(^|\.)workplace\.zoho\.com$/.test(host)) {
    const err = new Error('La URL debe pertenecer a Zoho WorkDrive.');
    err.code = 'INVALID_ZOHO_FOLDER_URL_HOST';
    err.statusCode = 400;
    err.stage = 'parse_folder_url';
    throw err;
  }

  const cleanUrl = safeZohoUrlSource(raw);
  const pathnameParts = parsed.pathname.split('/').filter(Boolean);
  const folderIndex = pathnameParts.findIndex((part) => part.toLowerCase() === 'folder');
  if (folderIndex >= 0 && pathnameParts[folderIndex + 1]) {
    return {
      folder_id: validateZohoId(pathnameParts[folderIndex + 1], 'folder_id'),
      workspace_id: null,
      zoho_space_type: 'unknown',
      zoho_url_source: cleanUrl,
    };
  }

  const hash = decodeURIComponent(String(parsed.hash || '').replace(/^#/, ''));
  const hashParts = hash.split('/').filter(Boolean);
  const appIndex = hashParts.findIndex((part) => part === 'workdrive_app');
  if (appIndex >= 0) {
    const workspaceId = hashParts[appIndex + 1] ? validateZohoId(hashParts[appIndex + 1], 'workspace_id') : null;
    const spaceType = hashParts[appIndex + 2] || 'unknown';
    const foldersIndex = hashParts.findIndex((part, index) => index > appIndex && part === 'folders');
    const folderId = foldersIndex >= 0 && hashParts[foldersIndex + 1] && hashParts[foldersIndex + 1] !== 'files'
      ? validateZohoId(hashParts[foldersIndex + 1], 'folder_id')
      : null;

    if (!folderId) {
      const err = new Error('La URL contiene un workspace Zoho, pero no una carpeta específica. Abra una carpeta y copie su URL.');
      err.code = 'ZOHO_FOLDER_URL_REQUIRES_FOLDER';
      err.statusCode = 400;
      err.stage = 'parse_folder_url';
      err.details = { workspace_id_present: Boolean(workspaceId), space_type: spaceType };
      throw err;
    }

    return {
      folder_id: folderId,
      workspace_id: workspaceId,
      zoho_space_type: ['privatespace', 'teamfolders', 'shared'].includes(spaceType) ? spaceType : 'unknown',
      zoho_url_source: cleanUrl,
    };
  }

  const err = new Error('No fue posible extraer una carpeta Zoho WorkDrive desde la URL.');
  err.code = 'INVALID_ZOHO_FOLDER_URL';
  err.statusCode = 400;
  err.stage = 'parse_folder_url';
  throw err;
}

function normalizeWorkdrivePath(path) {
  const raw = String(path || '').trim();
  if (!raw) return `${WORKDRIVE_API_PREFIX}/files`;
  let normalized = raw.replace(/^https?:\/\/[^/]+/i, '');
  normalized = normalized.replace(/^\/+/, '');
  if (normalized.startsWith('workdrive/api/v1/')) return `/${normalized}`;
  if (normalized.startsWith('workdrive/files') || normalized.startsWith('workdrive/folders')) return `/${normalized}`;
  if (normalized.startsWith('api/v1/')) return `/workdrive/${normalized}`;
  if (normalized.startsWith('workdrive/')) normalized = normalized.replace(/^workdrive\/+/, '');
  return `${WORKDRIVE_API_PREFIX}/${normalized.replace(/^\/+/, '')}`;
}

async function readDiagnosticResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = text ? { raw: text.slice(0, 300) } : {};
  }
  return {
    json,
    provider_code: providerErrorCode(json),
    provider_message: providerErrorMessage(json),
    raw_text: text,
    raw_snippet: safeRawSnippet(text),
  };
}

async function diagnosticZohoWorkdriveEndpoints({ accessToken, apiBaseUrl = null }) {
  const resolvedApiBaseUrl = resolveApiBaseUrl(apiBaseUrl);
  const diagnostics = [];

  for (const path of diagnosticEndpointCandidates()) {
    try {
      const result = await callZohoWorkdriveApi({
        accessToken,
        apiBaseUrl: resolvedApiBaseUrl,
        path,
        query: { 'page[limit]': 100 },
        stage: 'endpoint_probe',
        allowFailure: true,
      });
      diagnostics.push({
        endpoint: result.endpoint,
        path: result.path,
        status: result.status,
        provider_code: result.provider_code,
        provider_message: result.provider_message,
        ok: result.ok,
        response_keys: result.response_keys,
      });
    } catch (error) {
      diagnostics.push({
        endpoint: error?.endpoint || normalizeWorkdrivePath(path),
        path: normalizeWorkdrivePath(path),
        status: null,
        provider_code: error?.code || 'REQUEST_FAILED',
        provider_message: error?.message || 'No fue posible consultar endpoint Zoho.',
        ok: false,
        response_keys: [],
      });
    }
  }

  const okEndpoints = diagnostics.filter((item) => item.ok);
  const failedEndpoints = diagnostics.filter((item) => !item.ok);
  const allUnauthorized = diagnostics.length > 0 && diagnostics.every((item) => (
    Number(item.status || 0) === 401 ||
    String(item.provider_code || '').toUpperCase() === 'R008'
  ));

  return {
    ok: okEndpoints.length > 0,
    api_domain: resolvedApiBaseUrl,
    diagnostics,
    ok_endpoints: okEndpoints.map((item) => item.path),
    failed_count: failedEndpoints.length,
    all_unauthorized: allUnauthorized,
    all_failed: diagnostics.length > 0 && okEndpoints.length === 0,
  };
}

function buildZohoUrl({ path, searchParams = {}, apiBaseUrl = null }) {
  const url = new URL(`${resolveApiBaseUrl(apiBaseUrl)}${normalizeWorkdrivePath(path)}`);
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function callZohoWorkdriveApi({
  accessToken,
  apiBaseUrl = null,
  path,
  method = 'GET',
  query = {},
  body = null,
  stage = null,
  allowFailure = false,
}) {
  const normalizedPath = normalizeWorkdrivePath(path);
  const url = buildZohoUrl({ path: normalizedPath, searchParams: query, apiBaseUrl });
  const attempts = [];
  const methodUpper = String(method || 'GET').toUpperCase();

  for (const accept of ACCEPT_HEADER_VARIANTS) {
    const headers = {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: accept,
    };
    if (methodUpper !== 'GET' && body !== null && body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, {
      method: methodUpper,
      headers,
      body: methodUpper === 'GET' || body === null || body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = await readDiagnosticResponse(response);
    const result = {
      ok: response.ok,
      json: parsed.json,
      status: response.status,
      status_text: response.statusText,
      provider_code: parsed.provider_code,
      provider_message: parsed.provider_message,
      endpoint: safeEndpoint(url.toString()),
      path: normalizedPath,
      response_keys: responseKeys(parsed.json),
      raw_snippet: parsed.raw_snippet,
      accept,
      stage,
    };
    attempts.push({
      path: normalizedPath,
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      response_keys: result.response_keys,
      accept,
      raw_snippet: result.raw_snippet,
    });

    if (response.ok || response.status !== 415 || accept === ACCEPT_HEADER_VARIANTS[ACCEPT_HEADER_VARIANTS.length - 1]) {
      result.diagnostics = attempts;
      if (!response.ok && !allowFailure) {
        const err = new Error(result.provider_message || 'Error consultando Zoho WorkDrive');
        err.statusCode = response.status;
        err.code = 'ZOHO_API_ERROR';
        err.provider_status = response.status;
        err.provider_status_text = response.statusText;
        err.provider_code = result.provider_code;
        err.provider_message = result.provider_message;
        err.endpoint = result.endpoint;
        err.stage = stage;
        err.details = parsed.json;
        err.diagnostics = attempts;
        throw err;
      }
      return result;
    }
  }

  const err = new Error('Error consultando Zoho WorkDrive');
  err.code = 'ZOHO_API_ERROR';
  err.stage = stage;
  err.endpoint = safeEndpoint(url.toString());
  err.diagnostics = attempts;
  throw err;
}

function extractTokenMetadata(tokens = {}) {
  return {
    api_domain: tokens.api_domain || tokens.apiDomain || null,
    accounts_server: tokens.accounts_server || tokens.accountsServer || null,
    location: tokens.location || null,
    token_type: tokens.token_type || null,
    granted_scopes: tokens.scope ? String(tokens.scope).split(/[\s,]+/).filter(Boolean) : null,
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

async function revokeZohoToken({ accessToken, refreshToken, accountsServerUrl = null }) {
  const token = refreshToken || accessToken;
  const attempted = Boolean(token);
  if (!token) {
    return {
      attempted: false,
      success: false,
      provider_status: null,
      warning: 'No había token local para revocar. Credenciales locales eliminadas.',
    };
  }
  try {
    const url = new URL(`${resolveAccountsServerUrl(accountsServerUrl)}/oauth/v2/token/revoke`);
    url.searchParams.set('token', token);
    const response = await fetch(url.toString(), { method: 'POST' });
    const parsed = await readDiagnosticResponse(response);
    const providerStatus = response.status;
    const success = response.ok && (
      parsed.json?.status === 'success' ||
      parsed.json?.status === 'successfully revoked' ||
      parsed.json?.message === 'success'
    );
    if (success) {
      return { attempted, success: true, provider_status: providerStatus };
    }
    return {
      attempted,
      success: false,
      provider_status: providerStatus,
      provider_code: parsed.provider_code,
      provider_message: parsed.provider_message,
      warning: providerStatus === 400
        ? 'Token ya inválido o no revocable. Credenciales locales eliminadas.'
        : 'Zoho no confirmó la revocación. Credenciales locales eliminadas.',
    };
  } catch (error) {
    return {
      attempted,
      success: false,
      provider_status: error?.statusCode || error?.provider_status || null,
      provider_code: error?.provider_code || null,
      provider_message: error?.provider_message || null,
      warning: 'No fue posible confirmar la revocación externa. Credenciales locales eliminadas.',
    };
  }
}

async function zohoGetJson({ accessToken, path, searchParams = {}, apiBaseUrl = null, stage = null }) {
  const result = await callZohoWorkdriveApi({
    accessToken,
    path,
    query: searchParams,
    apiBaseUrl,
    stage,
  });
  return result.json;
}

async function zohoGetJsonAny({ accessToken, candidates = [], searchParams = {}, apiBaseUrl = null, stage = null }) {
  let lastError = null;
  for (const path of candidates) {
    try {
      return await zohoGetJson({ accessToken, path, searchParams, apiBaseUrl, stage });
    } catch (error) {
      lastError = error;
      const status = Number(error.provider_status || error.statusCode || 0);
      if (![400, 401, 403, 404, 405, 409].includes(status)) {
        throw error;
      }
    }
  }
  throw lastError || Object.assign(new Error('Error consultando Zoho WorkDrive'), {
    code: 'ZOHO_API_ERROR',
    stage,
  });
}

async function tryZohoGetJsonAny(options) {
  try {
    return { ok: true, json: await zohoGetJsonAny(options) };
  } catch (error) {
    return { ok: false, error };
  }
}

function isFolderItem(item) {
  const attributes = item?.attributes || {};
  const type = String(item?.type || attributes?.type || attributes?.kind || attributes?.resource_type || '').toLowerCase();
  const mimeType = String(attributes?.mime_type || attributes?.mimetype || '').toLowerCase();
  return (
    item?.can_open === true ||
    attributes?.is_folder === true ||
    attributes?.isFolder === true ||
    type.includes('folder') ||
    type.includes('files') ||
    type.includes('team') ||
    type.includes('workspace') ||
    mimeType.includes('folder')
  );
}

function privateSpaceCandidates() {
  return [
    '/workdrive/api/v1/files',
    '/workdrive/api/v1/privatefolders',
  ];
}

function teamFolderRootCandidates() {
  return [
    '/workdrive/api/v1/teams',
    '/workdrive/api/v1/teamfolders',
    '/workdrive/api/v1/workspaces',
  ];
}

function sharedFolderCandidates() {
  return [
    '/workdrive/api/v1/sharedwithme',
    '/workdrive/api/v1/shared/files',
  ];
}

function childFolderCandidates(parentId) {
  const encoded = encodeURIComponent(parentId);
  return [
    `/workdrive/api/v1/files/${encoded}/files`,
    `/workdrive/api/v1/files/${encoded}/records`,
    `/workdrive/api/v1/files/${encoded}/folders`,
    `/workdrive/api/v1/files?parent_id=${encoded}`,
    `/workdrive/api/v1/files?filter[parent_id]=${encoded}`,
    `/workdrive/api/v1/files?filter[parentId]=${encoded}`,
    `/workdrive/files?parent_id=${encoded}`,
    `/workdrive/folders?parent_id=${encoded}`,
    `/workdrive/api/v1/teamfolders/${encoded}/files`,
    `/workdrive/api/v1/teamfolders/${encoded}/folders`,
  ];
}

function syntheticRootNode({ id, name, type, canSelect = false, count = null }) {
  return {
    id,
    provider_folder_id: id,
    name,
    parent_id: 'root',
    path: name,
    display_path: name,
    type,
    item_type: 'folder',
    provider: 'zoho_workdrive',
    can_select: canSelect,
    can_open: true,
    is_synthetic_root: true,
    children_count: count,
    attributes: {
      id,
      name,
      display_name: name,
      type,
      is_folder: true,
      parent_id: 'root',
    },
  };
}

function extractRows(json = {}) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.folders)) return json.folders;
  if (Array.isArray(json?.teams)) return json.teams;
  if (Array.isArray(json?.teamfolders)) return json.teamfolders;
  if (Array.isArray(json?.files)) return json.files;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

function renderEndpointTemplate(template, folderId) {
  if (!template) return null;
  const encoded = encodeURIComponent(folderId);
  if (template.includes('{folderId}')) return template.replaceAll('{folderId}', encoded);
  return template;
}

function normalizeZohoItem(item = {}, context = {}) {
  const attributes = item?.attributes || {};
  const links = item?.links || attributes?.links || {};
  const id = item?.id || attributes.id || attributes.resource_id || attributes.file_id || attributes.folder_id || null;
  const name = item?.name ||
    item?.display_name ||
    attributes.name ||
    attributes.display_name ||
    attributes.display_attr_name ||
    attributes.display_html_name ||
    attributes.title ||
    id ||
    'Elemento Zoho';
  const rawType = String(item?.type || attributes.type || attributes.resource_type || attributes.kind || attributes.category || '').toLowerCase();
  const mimeType = attributes.mime_type || attributes.mimetype || item?.mime_type || null;
  const lowerMime = String(mimeType || '').toLowerCase();
  const isFolder = item?.item_type === 'folder' ||
    item?.can_open === true ||
    attributes.is_folder === true ||
    attributes.isFolder === true ||
    rawType.includes('folder') ||
    rawType.includes('team') ||
    rawType.includes('workspace') ||
    lowerMime.includes('folder');
  const fileExtension = attributes.extn || attributes.extension || (name.includes('.') ? name.split('.').pop() : null);
  const modifiedMs = Number(attributes.modified_time_in_millisecond || attributes.uploaded_time_in_millisecond || 0);
  const modifiedAt = attributes.modified_time || attributes.modifiedTime || (modifiedMs ? new Date(modifiedMs).toISOString() : null);
  const sizeBytes = Number(
    attributes.storage_info?.size_in_bytes ||
    attributes.size_in_bytes ||
    attributes.size ||
    item?.size_bytes ||
    item?.size ||
    0
  ) || null;
  const parentId = attributes.parent_id || attributes.parentId || attributes.parent_folder_id || item?.parent_id || context.parentId || null;
  const path = attributes.path || attributes.display_path || item?.path || context.path || name;
  const permalink = attributes.permalink || attributes.web_view_url || item?.web_view_url || links?.self || links?.download || null;

  return {
    id,
    provider_file_id: id,
    name,
    display_name: item?.display_name || attributes.display_name || name,
    type: isFolder ? 'folder' : (rawType || 'file'),
    item_type: isFolder ? 'folder' : 'file',
    mime_type: mimeType,
    file_extension: isFolder ? 'folder' : fileExtension,
    size_bytes: sizeBytes,
    parent_id: parentId,
    path,
    web_view_url: permalink,
    can_open: isFolder,
    can_select: isFolder,
    modified_at: modifiedAt,
    provider_version_id: attributes.version_id || attributes.status_change_time_in_millisecond || null,
    metadata_json: {
      zoho: {
        id,
        type: rawType || null,
        parent_id: parentId,
        parent_folder_id: parentId,
        file_id: id,
        provider_file_id: id,
        is_folder: isFolder,
        unknown_type: !rawType && attributes.is_folder === undefined && !mimeType,
        download_url_present: Boolean(attributes.download_url),
        download_url: attributes.download_url || null,
        library_id: attributes.library_id || null,
        team_id: attributes.team_id || attributes.library_id || null,
        relative_path: path,
      },
    },
    raw: item,
  };
}

function nextPageToken(json = {}) {
  return json?.links?.cursor?.next || json?.links?.next || json?.next_page_token || null;
}

function extractIdentity(json = {}) {
  const data = Array.isArray(json?.data) ? json.data[0] : (json?.data || json);
  const attributes = data?.attributes || data || {};
  return {
    account_email: attributes.email || attributes.email_id || attributes.primary_email || attributes.login_id || null,
    account_name: attributes.name || attributes.display_name || attributes.full_name || null,
    raw_type: data?.type || attributes.type || null,
  };
}

async function getZohoAccountIdentity({ accessToken, apiBaseUrl = null }) {
  const result = await zohoGetJsonAny({
    accessToken,
    apiBaseUrl,
    stage: 'account_identity',
    candidates: [
      '/workdrive/api/v1/user',
      '/workdrive/api/v1/users/me',
      '/workdrive/api/v1/profile',
      '/workdrive/user',
    ],
  });
  return extractIdentity(result);
}

function rootAlias(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || ['root', 'my_drive', 'mi_unidad'].includes(normalized)) return 'root';
  if (normalized === LEGACY_PRIVATE_ROOT_ALIAS || normalized === PERSONAL_ROOT_ALIAS) return 'private_space';
  if (normalized === 'zoho:teamfolders:root') return 'team_folder_root';
  if (normalized === 'zoho:shared:root') return 'shared_root';
  return null;
}

function folderRowsFromJson(json = {}) {
  return extractRows(json).map((item) => normalizeZohoItem(item)).filter((item) => item.item_type === 'folder');
}

function emptyDetails({ reason, stage, message, apiBaseUrl, error = null, diagnostics = null }) {
  return {
    reason,
    stage,
    message,
    api_domain: apiBaseUrl || null,
    provider_status: error?.provider_status || error?.statusCode || null,
    provider_code: error?.provider_code || null,
    provider_message: error?.provider_message || null,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : undefined,
  };
}

async function discoverZohoRootContainers({ accessToken, apiBaseUrl = null, pageToken = null }) {
  const resolvedApiBaseUrl = resolveApiBaseUrl(apiBaseUrl);
  const endpointProbe = await diagnosticZohoWorkdriveEndpoints({ accessToken, apiBaseUrl: resolvedApiBaseUrl });
  if (endpointProbe.all_unauthorized) {
    const firstUnauthorized = endpointProbe.diagnostics.find((item) => Number(item.status || 0) === 401) || endpointProbe.diagnostics[0];
    const err = new Error('Zoho OAuth conectado, pero el token no tiene acceso efectivo a WorkDrive API.');
    err.statusCode = 401;
    err.code = 'ZOHO_UNAUTHORIZED';
    err.provider_status = firstUnauthorized?.status || 401;
    err.provider_code = firstUnauthorized?.provider_code || 'R008';
    err.provider_message = firstUnauthorized?.provider_message || 'Unauthorized access';
    err.endpoint = firstUnauthorized?.endpoint || null;
    err.stage = 'root_endpoint_probe';
    err.diagnostics = endpointProbe.diagnostics;
    throw err;
  }

  const privateResult = await tryZohoGetJsonAny({
    accessToken,
    candidates: privateSpaceCandidates(),
    apiBaseUrl,
    stage: 'discover_private_space',
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });
  const teamResult = await tryZohoGetJsonAny({
    accessToken,
    candidates: teamFolderRootCandidates(),
    apiBaseUrl,
    stage: 'discover_team_folders',
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });
  const sharedResult = await tryZohoGetJsonAny({
    accessToken,
    candidates: sharedFolderCandidates(),
    apiBaseUrl,
    stage: 'discover_shared_folders',
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });

  const privateFolders = privateResult.ok ? folderRowsFromJson(privateResult.json) : [];
  const teamFolders = teamResult.ok ? folderRowsFromJson(teamResult.json) : [];
  const sharedFolders = sharedResult.ok ? folderRowsFromJson(sharedResult.json) : [];
  const allErrors = [privateResult, teamResult, sharedResult].filter((result) => !result.ok).map((result) => result.error);
  const forbidden = allErrors.find((error) => Number(error.provider_status || error.statusCode || 0) === 403);
  const unauthorized = allErrors.find(isZohoUnauthorized);
  if (!privateResult.ok && !teamResult.ok && !sharedResult.ok && (unauthorized || forbidden)) {
    throw unauthorized || forbidden;
  }

  const folders = [];
  folders.push(syntheticRootNode({
    id: 'zoho:privatespace:root',
    name: 'Mis carpetas',
    type: 'private_space',
    canSelect: false,
    count: privateFolders.length,
  }));
  folders.push(syntheticRootNode({
    id: 'zoho:teamfolders:root',
    name: 'Carpetas del equipo',
    type: 'team_folder_root',
    canSelect: false,
    count: teamFolders.length,
  }));
  if (sharedResult.ok && sharedFolders.length > 0) {
    folders.push(syntheticRootNode({
      id: 'zoho:shared:root',
      name: 'Compartido conmigo',
      type: 'shared_root',
      canSelect: false,
      count: sharedFolders.length,
    }));
  }

  return {
    folders,
    next_page_token: null,
    current: {
      id: 'root',
      name: 'Zoho WorkDrive',
      path: 'Zoho WorkDrive',
      parent_id: null,
      type: 'root',
    },
    details: {
      reason: null,
      stage: 'root_discovery_completed',
      message: null,
      api_domain: resolvedApiBaseUrl,
      diagnostics: endpointProbe.diagnostics,
      ok_endpoints: endpointProbe.ok_endpoints,
      private_folders_count: privateFolders.length,
      team_folders_count: teamFolders.length,
      shared_folders_count: sharedFolders.length,
      warnings: allErrors.map((error) => cloneZohoError(error)).slice(0, 3),
    },
    raw: {
      private_space: privateResult.ok ? privateResult.json : null,
      team_folders: teamResult.ok ? teamResult.json : null,
      shared_folders: sharedResult.ok ? sharedResult.json : null,
    },
  };
}

async function listZohoRootFiles({ accessToken, apiBaseUrl = null, pageToken = null }) {
  const result = await callZohoWorkdriveApi({
    accessToken,
    apiBaseUrl,
    path: '/workdrive/api/v1/files',
    query: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
    stage: 'list_root_files',
  });
  const items = extractRows(result.json).map((item) => normalizeZohoItem(item, {
    parentId: 'zoho:privatespace:root',
    path: normalizeWorkdriveDisplayPath('Mis carpetas', item),
  }));
  return {
    items,
    folders: items.filter((item) => item.item_type === 'folder'),
    files: items.filter((item) => item.item_type === 'file'),
    next_page_token: nextPageToken(result.json),
    diagnostics: [{
      endpoint: result.endpoint,
      path: result.path,
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      ok: result.ok,
      response_keys: result.response_keys,
      accept: result.accept,
      raw_snippet: result.raw_snippet,
      attempts: result.diagnostics,
    }],
    raw: result.json,
  };
}

async function listZohoTeams({ accessToken, apiBaseUrl = null, pageToken = null }) {
  const result = await callZohoWorkdriveApi({
    accessToken,
    apiBaseUrl,
    path: '/workdrive/api/v1/teams',
    query: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
    stage: 'list_teams',
  });
  const items = extractRows(result.json).map((item) => ({
    ...normalizeZohoItem(item, { parentId: 'zoho:teamfolders:root' }),
    item_type: 'folder',
    type: 'team',
    can_open: true,
    can_select: false,
  }));
  return {
    items,
    folders: items,
    next_page_token: nextPageToken(result.json),
    diagnostics: [{
      endpoint: result.endpoint,
      path: result.path,
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      ok: result.ok,
      response_keys: result.response_keys,
    }],
    raw: result.json,
  };
}

async function listZohoTeamFolders({ accessToken, apiBaseUrl = null, teamId = null, pageToken = null }) {
  const candidates = teamId
    ? [`/workdrive/api/v1/teams/${encodeURIComponent(teamId)}/teamfolders`, `/workdrive/api/v1/teamfolders?team_id=${encodeURIComponent(teamId)}`]
    : ['/workdrive/api/v1/teamfolders'];
  const json = await zohoGetJsonAny({
    accessToken,
    apiBaseUrl,
    candidates,
    stage: 'list_team_folders',
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });
  const items = extractRows(json).map((item) => ({
    ...normalizeZohoItem(item, { parentId: teamId || 'zoho:teamfolders:root' }),
    item_type: 'folder',
    type: 'team_folder',
    can_open: true,
    can_select: true,
  }));
  return {
    items,
    folders: items,
    next_page_token: nextPageToken(json),
    raw: json,
  };
}

async function listZohoFolderChildren({ accessToken, apiBaseUrl = null, folderId, pageToken = null }) {
  const listed = await listZohoFolderContents({
    accessToken,
    apiBaseUrl,
    folderId,
    pageToken,
    stage: 'list_folder_children',
  });
  return {
    items: listed.items,
    folders: listed.folders,
    files: listed.files,
    next_page_token: listed.next_page_token,
    diagnostics: listed.diagnostics,
    working_endpoint: listed.working_endpoint,
    raw: listed.raw,
  };
}

async function listZohoFolderContents({
  accessToken,
  apiBaseUrl = null,
  folderId,
  workspaceId = null,
  spaceType = null,
  includeFiles = true,
  includeFolders = true,
  preferredEndpoint = null,
  pageToken = null,
  stage = 'list_folder_contents',
}) {
  const normalizedFolderId = String(folderId || '').trim();
  if (!normalizedFolderId || rootAlias(normalizedFolderId)) {
    const err = new Error('Seleccione una carpeta real de Zoho WorkDrive.');
    err.code = 'ZOHO_SYNTHETIC_ROOT_NOT_LISTABLE';
    err.statusCode = 400;
    err.stage = stage;
    throw err;
  }

  const baseCandidates = childFolderCandidates(normalizedFolderId);
  const preferred = renderEndpointTemplate(preferredEndpoint, normalizedFolderId);
  const candidates = [...new Set([preferred, ...baseCandidates].filter(Boolean))];
  const diagnostics = [];
  const emptySuccesses = [];

  for (const path of candidates) {
    const result = await callZohoWorkdriveApi({
      accessToken,
      apiBaseUrl,
      path,
      query: {
        'page[limit]': 100,
        'page[token]': pageToken || undefined,
      },
      stage,
      allowFailure: true,
    });
    const rawRows = extractRows(result.json);
    const items = rawRows.map((item) => normalizeZohoItem(item, {
      parentId: normalizedFolderId,
      path: normalizeWorkdriveDisplayPath('', item),
    }));
    const folders = includeFolders ? items.filter((item) => item.item_type === 'folder') : [];
    const files = includeFiles ? items.filter((item) => item.item_type === 'file') : [];
    const totalItems = folders.length + files.length;
    const attempt = {
      endpoint: result.endpoint,
      path: result.path,
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      ok: result.ok,
      response_keys: result.response_keys,
      raw_snippet: result.raw_snippet,
      accept: result.accept,
      data_len: rawRows.length,
      items_count: totalItems,
      folders_count: folders.length,
      files_count: files.length,
    };
    diagnostics.push(attempt);

    if (result.ok && totalItems > 0) {
      return {
        ok: true,
        verified: true,
        folder_id: normalizedFolderId,
        workspace_id: workspaceId || null,
        zoho_space_type: spaceType || null,
        working_endpoint: result.path,
        items: [...folders, ...files],
        folders,
        files,
        next_page_token: nextPageToken(result.json),
        diagnostics,
        raw: result.json,
      };
    }

    if (result.ok) {
      emptySuccesses.push({ result, folders, files, rawRows });
      if (preferred && result.path === normalizeWorkdrivePath(preferred)) {
        return {
          ok: true,
          verified: true,
          empty: true,
          folder_id: normalizedFolderId,
          workspace_id: workspaceId || null,
          zoho_space_type: spaceType || null,
          working_endpoint: result.path,
          items: [],
          folders: [],
          files: [],
          next_page_token: nextPageToken(result.json),
          diagnostics,
          raw: result.json,
        };
      }
    }
  }

  if (emptySuccesses.length > 0) {
    const first = emptySuccesses[0].result;
    return {
      ok: true,
      verified: true,
      empty: true,
      folder_id: normalizedFolderId,
      workspace_id: workspaceId || null,
      zoho_space_type: spaceType || null,
      working_endpoint: first.path,
      items: [],
      folders: [],
      files: [],
      next_page_token: nextPageToken(first.json),
      diagnostics,
      raw: first.json,
    };
  }

  const last = diagnostics[diagnostics.length - 1] || {};
  const err = new Error('Zoho no devolvió contenido verificable para esta carpeta.');
  err.code = 'ZOHO_FOLDER_EMPTY_OR_UNREADABLE';
  err.statusCode = Number(last.status || 0) >= 400 ? Number(last.status) : 409;
  err.provider_status = last.status || null;
  err.provider_code = last.provider_code || null;
  err.provider_message = last.provider_message || null;
  err.endpoint = last.endpoint || null;
  err.stage = stage;
  err.diagnostics = diagnostics;
  throw err;
}

function normalizeWorkdriveDisplayPath(prefix, item = {}) {
  const attributes = item?.attributes || {};
  const name = item?.name || attributes.name || attributes.display_name || attributes.display_attr_name || attributes.title || item?.id || '';
  return [prefix, name].filter(Boolean).join('/');
}

function isPersonalRootId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === PERSONAL_ROOT_ALIAS || normalized === LEGACY_PRIVATE_ROOT_ALIAS;
}

function personalRootAlias() {
  return PERSONAL_ROOT_ALIAS;
}

async function probeZohoWorkdriveAccess({ accessToken, apiBaseUrl = null }) {
  try {
    const discovered = await discoverZohoRootContainers({ accessToken, apiBaseUrl });
    return {
      ok: true,
      code: 'ZOHO_WORKDRIVE_ACCESS_OK',
      message: 'Zoho WorkDrive API accesible.',
      api_domain: discovered.details?.api_domain || resolveApiBaseUrl(apiBaseUrl),
      stage: discovered.details?.stage || 'root_discovery_completed',
      root_nodes_count: discovered.folders.length,
      private_folders_count: discovered.details?.private_folders_count || 0,
      team_folders_count: discovered.details?.team_folders_count || 0,
      shared_folders_count: discovered.details?.shared_folders_count || 0,
      details: discovered.details,
    };
  } catch (error) {
    return normalizeZohoProbeError(error, error.stage || 'probe_workdrive_access');
  }
}

async function listFolders({ accessToken, parentId = 'root', pageToken = null, apiBaseUrl = null }) {
  const normalizedParent = String(parentId || '').trim();
  const alias = rootAlias(normalizedParent);
  if (alias === 'root') {
    return discoverZohoRootContainers({ accessToken, apiBaseUrl, pageToken });
  }
  const resolvedApiBaseUrl = resolveApiBaseUrl(apiBaseUrl);

  let candidates = childFolderCandidates(normalizedParent);
  let current = {
    id: normalizedParent,
    name: normalizedParent,
    path: normalizedParent,
    parent_id: null,
    type: 'folder',
  };
  let stage = 'list_folder';
  let fallbackReason = 'no_visible_folders';
  let emptyMessage = 'No se encontraron carpetas visibles en Zoho WorkDrive para esta cuenta.';

  if (alias === 'private_space') {
    current = {
      id: 'zoho:privatespace:root',
      name: 'Mis carpetas',
      path: 'Zoho WorkDrive/Mis carpetas',
      parent_id: 'root',
      type: 'private_space',
    };
    stage = 'list_private_space';
    fallbackReason = 'empty_private_space';
    emptyMessage = 'No se encontraron carpetas visibles en Mis carpetas de Zoho WorkDrive.';
    const listed = await listZohoRootFiles({ accessToken, apiBaseUrl, pageToken });
    return {
      folders: listed.folders,
      files: listed.files,
      next_page_token: listed.next_page_token,
      current,
      details: listed.folders.length > 0 ? {
        reason: null,
        stage,
        message: null,
        api_domain: resolvedApiBaseUrl,
        folders_count: listed.folders.length,
        files_count: listed.files.length,
        total_items_count: listed.items.length,
        diagnostics: listed.diagnostics,
      } : {
        ...emptyDetails({
          reason: fallbackReason,
          stage,
          message: listed.files.length > 0
            ? 'Esta ubicación contiene archivos pero no subcarpetas visibles.'
            : emptyMessage,
          apiBaseUrl: resolvedApiBaseUrl,
          diagnostics: listed.diagnostics,
        }),
        folders_count: 0,
        files_count: listed.files.length,
        total_items_count: listed.items.length,
      },
      raw: listed.raw,
    };
  } else if (alias === 'team_folder_root') {
    current = {
      id: 'zoho:teamfolders:root',
      name: 'Carpetas del equipo',
      path: 'Carpetas del equipo',
      parent_id: 'root',
      type: 'team_folder_root',
    };
    stage = 'list_team_folders';
    fallbackReason = 'no_workdrive_team';
    emptyMessage = 'No se encontraron carpetas de equipo visibles en Zoho WorkDrive para esta cuenta.';
    const listedTeams = await listZohoTeams({ accessToken, apiBaseUrl, pageToken });
    return {
      folders: listedTeams.folders,
      files: [],
      next_page_token: listedTeams.next_page_token,
      current,
      details: listedTeams.folders.length > 0 ? {
        reason: null,
        stage,
        message: null,
        api_domain: resolvedApiBaseUrl,
        folders_count: listedTeams.folders.length,
        diagnostics: listedTeams.diagnostics,
      } : emptyDetails({
        reason: fallbackReason,
        stage,
        message: emptyMessage,
        apiBaseUrl: resolvedApiBaseUrl,
        diagnostics: listedTeams.diagnostics,
      }),
      raw: listedTeams.raw,
    };
  } else if (alias === 'shared_root') {
    candidates = sharedFolderCandidates();
    current = {
      id: 'zoho:shared:root',
      name: 'Compartido conmigo',
      path: 'Compartido conmigo',
      parent_id: 'root',
      type: 'shared_root',
    };
    stage = 'list_shared_folders';
    fallbackReason = 'no_visible_folders';
    emptyMessage = 'No se encontraron carpetas compartidas visibles en Zoho WorkDrive.';
  } else {
    const listed = await listZohoFolderChildren({ accessToken, apiBaseUrl, folderId: normalizedParent, pageToken });
    return {
      folders: listed.folders,
      files: listed.files,
      next_page_token: listed.next_page_token,
      current,
      details: listed.folders.length > 0 ? {
        reason: null,
        stage,
        message: null,
        api_domain: resolvedApiBaseUrl,
        folders_count: listed.folders.length,
        files_count: listed.files.length,
        total_items_count: listed.items.length,
        diagnostics: listed.diagnostics,
        working_endpoint: listed.working_endpoint,
      } : {
        ...emptyDetails({
          reason: fallbackReason,
          stage,
          message: listed.files.length > 0
            ? 'Esta ubicación contiene archivos pero no subcarpetas visibles.'
            : emptyMessage,
          apiBaseUrl: resolvedApiBaseUrl,
          diagnostics: listed.diagnostics,
        }),
        folders_count: 0,
        files_count: listed.files.length,
        total_items_count: listed.items.length,
        working_endpoint: listed.working_endpoint,
      },
      raw: listed.raw,
    };
  }

  const json = await zohoGetJsonAny({
    accessToken,
    candidates,
    apiBaseUrl,
    stage,
    searchParams: {
      'page[limit]': 100,
      'page[token]': pageToken || undefined,
    },
  });

  const rows = extractRows(json);
  const folders = rows.filter(isFolderItem);
  return {
    folders,
    files: rows.map((item) => normalizeZohoItem(item, { parentId: normalizedParent })).filter((item) => item.item_type === 'file'),
    next_page_token: nextPageToken(json),
    current,
    details: folders.length > 0 ? {
      reason: null,
      stage,
      message: null,
      api_domain: resolvedApiBaseUrl,
      folders_count: folders.length,
    } : emptyDetails({
      reason: fallbackReason,
      stage,
      message: emptyMessage,
      apiBaseUrl: resolvedApiBaseUrl,
    }),
    raw: json,
  };
}

async function listFiles({ accessToken, folderId, includeSubfolders = true, apiBaseUrl = null }) {
  const alias = rootAlias(folderId);
  if (alias === 'private_space' || !folderId) {
    const listed = await listZohoRootFiles({ accessToken, apiBaseUrl });
    return {
      files: listed.items,
      include_subfolders: includeSubfolders,
      raw: listed.raw,
      diagnostics: listed.diagnostics,
    };
  }
  const listed = await listZohoFolderChildren({ accessToken, apiBaseUrl, folderId });
  return {
    files: listed.items,
    include_subfolders: includeSubfolders,
    raw: listed.raw,
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
  const normalized = normalizeZohoItem(file);
  const attributes = file?.attributes || {};
  const id = normalized.id || crypto.createHash('sha1').update(JSON.stringify(file || {})).digest('hex');
  const name = normalized.name || id;

  return {
    provider_file_id: id,
    provider_version_id: normalized.provider_version_id,
    file_name: name,
    mime_type: normalized.mime_type,
    file_extension: normalized.file_extension,
    file_url: attributes.permalink || normalized.web_view_url || null,
    web_view_url: normalized.web_view_url,
    size_bytes: normalized.size_bytes,
    modified_at: normalized.modified_at ? new Date(normalized.modified_at) : null,
    relative_path: normalized.path || name,
    metadata_json: {
      zoho: {
        id,
        parent_id: normalized.parent_id || null,
        parent_folder_id: normalized.parent_id || null,
        file_id: id,
        provider_file_id: id,
        is_folder: normalized.item_type === 'folder',
        item_type: normalized.item_type,
        download_url_present: Boolean(attributes.download_url || normalized.metadata_json?.zoho?.download_url_present),
        library_id: attributes.library_id || null,
        relative_path: normalized.path || name,
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
  revokeZohoToken,
  resolveAccountsServerUrl,
  getZohoAccountIdentity,
  callZohoWorkdriveApi,
  parseZohoFolderUrl,
  diagnosticZohoWorkdriveEndpoints,
  probeZohoWorkdriveAccess,
  discoverZohoRootContainers,
  isPersonalRootId,
  personalRootAlias,
  normalizeZohoItem,
  listZohoRootFiles,
  listZohoFolderChildren,
  listZohoFolderContents,
  listZohoTeams,
  listZohoTeamFolders,
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
