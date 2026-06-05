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
  };
}

async function diagnosticZohoWorkdriveEndpoints({ accessToken, apiBaseUrl = null }) {
  const resolvedApiBaseUrl = resolveApiBaseUrl(apiBaseUrl);
  const diagnostics = [];

  for (const path of diagnosticEndpointCandidates()) {
    const url = buildZohoUrl({
      path,
      apiBaseUrl: resolvedApiBaseUrl,
      searchParams: { 'page[limit]': 100 },
    });
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const parsed = await readDiagnosticResponse(response);
      diagnostics.push({
        endpoint: safeEndpoint(url.toString()),
        path,
        status: response.status,
        provider_code: parsed.provider_code,
        provider_message: parsed.provider_message,
        ok: response.ok,
        response_keys: responseKeys(parsed.json),
      });
    } catch (error) {
      diagnostics.push({
        endpoint: safeEndpoint(url.toString()),
        path,
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
    '/workdrive/api/v1/privatespace/folders/files',
    '/workdrive/privatespace/folders/files',
    '/workdrive/api/v1/privatefolders',
    '/workdrive/api/v1/files',
    '/workdrive/privatespace/folders',
    '/workdrive/privatefolders',
    '/workdrive/files',
  ];
}

function teamFolderRootCandidates() {
  return [
    '/workdrive/api/v1/teams',
    '/workdrive/api/v1/teamfolders',
    '/workdrive/api/v1/workspaces',
    '/workdrive/teamfolders',
    '/workdrive/workspaces',
  ];
}

function sharedFolderCandidates() {
  return [
    '/workdrive/api/v1/sharedwithme',
    '/workdrive/api/v1/shared/files',
    '/workdrive/sharedwithme',
    '/workdrive/shared/files',
  ];
}

function childFolderCandidates(parentId) {
  const encoded = encodeURIComponent(parentId);
  return [
    `/workdrive/api/v1/teamfolders/${encoded}/files`,
    `/workdrive/api/v1/teamfolders/${encoded}/folders`,
    `/workdrive/api/v1/files/${encoded}/files`,
    `/workdrive/teamfolders/${encoded}/files`,
    `/workdrive/teamfolders/${encoded}/folders`,
    `/workdrive/files/${encoded}/files`,
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
  if (normalized === 'zoho:privatespace:root') return 'private_space';
  if (normalized === 'zoho:teamfolders:root') return 'team_folder_root';
  if (normalized === 'zoho:shared:root') return 'shared_root';
  return null;
}

function folderRowsFromJson(json = {}) {
  return extractRows(json).filter(isFolderItem);
}

function emptyDetails({ reason, stage, message, apiBaseUrl, error = null }) {
  return {
    reason,
    stage,
    message,
    api_domain: apiBaseUrl || null,
    provider_status: error?.provider_status || error?.statusCode || null,
    provider_code: error?.provider_code || null,
    provider_message: error?.provider_message || null,
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
    canSelect: true,
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
    candidates = privateSpaceCandidates();
    current = {
      id: 'zoho:privatespace:root',
      name: 'Mis carpetas',
      path: 'Mis carpetas',
      parent_id: 'root',
      type: 'private_space',
    };
    stage = 'list_private_space';
    fallbackReason = 'empty_private_space';
    emptyMessage = 'No se encontraron carpetas visibles en Mis carpetas de Zoho WorkDrive.';
  } else if (alias === 'team_folder_root') {
    candidates = teamFolderRootCandidates();
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
  const candidates = alias === 'private_space'
    ? privateSpaceCandidates()
    : alias === 'team_folder_root'
      ? teamFolderRootCandidates()
      : folderId ? childFolderCandidates(folderId) : privateSpaceCandidates();
  const json = await zohoGetJsonAny({
    accessToken,
    candidates,
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
  getZohoAccountIdentity,
  diagnosticZohoWorkdriveEndpoints,
  probeZohoWorkdriveAccess,
  discoverZohoRootContainers,
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
