import { getStoredValidToken, getTenantIdFromToken, getUserRoleFromToken } from './auth';

export function getApiBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      ''
  ).replace(/\/+$/, '');
}

type ApiJsonObject = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);
const pendingJsonRequests = new Map<string, Promise<unknown>>();

export class ApiClientError extends Error {
  code: string;
  status?: number;
  requestId?: string | null;

  constructor(code: string, message: string, status?: number, requestId?: string | null) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function localizedDefaultMessage(locale: string, status: number) {
  const en = locale === 'en';

  if (status === 401) {
    return en
      ? 'Your session expired or is not valid. Please sign in again.'
      : 'La sesión expiró o no es válida. Vuelve a iniciar sesión.';
  }

  if (status === 408 || status === 504) {
    return en
      ? 'The AI service took too long to respond. Please try again in a few minutes.'
      : 'El servicio de IA tardó demasiado en responder. Intenta nuevamente en unos minutos.';
  }

  if (status === 502 || status === 503) {
    return en
      ? 'The AI service is temporarily unavailable. Please try again shortly.'
      : 'El servicio de IA no está disponible temporalmente. Intenta nuevamente en unos minutos.';
  }

  return en
    ? 'The request could not be completed.'
    : 'No fue posible completar la solicitud.';
}

function extractPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as ApiJsonObject;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (
    data.error &&
    typeof data.error === 'object' &&
    typeof (data.error as ApiJsonObject).message === 'string'
  ) {
    return (data.error as ApiJsonObject).message as string;
  }
  return '';
}

export async function readJsonResponse<T = ApiJsonObject>(
  response: Response,
  {
    fallbackMessage = 'No fue posible completar la solicitud.',
    locale = 'es',
  }: { fallbackMessage?: string; locale?: string } = {}
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const requestId =
    response.headers.get('x-request-id') ||
    response.headers.get('x-correlation-id') ||
    '';
  let payload: ApiJsonObject | null = null;

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => '');
    payload = text
      ? {
          message: localizedDefaultMessage(locale, response.status),
          non_json_response: true,
          response_preview: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160),
        }
      : {};
  }

  if (!response.ok || payload?.ok === false) {
    const message =
      extractPayloadMessage(payload) ||
      localizedDefaultMessage(locale, response.status) ||
      fallbackMessage;
    const suffix = requestId ? ` (request_id: ${requestId})` : '';
    const code = typeof payload?.code === 'string' ? payload.code : `HTTP_${response.status}`;
    throw new ApiClientError(code, `${message}${suffix}`, response.status, requestId || null);
  }

  return (payload || {}) as T;
}

export function isUuid(value: unknown) {
  return UUID_RE.test(String(value || '').trim());
}

export function getActiveTenantId() {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem('activeTenantId');
  return isUuid(value) ? value : null;
}

export function setActiveTenantId(tenantId: string | null) {
  if (typeof window === 'undefined') return;
  if (tenantId && isUuid(tenantId)) {
    localStorage.setItem('activeTenantId', tenantId);
  } else {
    localStorage.removeItem('activeTenantId');
  }
}

export function resolveEffectiveTenantContext({ tenantRequired = true }: { tenantRequired?: boolean } = {}) {
  const token = getStoredValidToken();
  if (!token) {
    throw new ApiClientError('AUTH_REQUIRED', 'La sesión expiró o no es válida. Vuelve a iniciar sesión.', 401);
  }

  const role = getUserRoleFromToken();
  const tokenTenantId = getTenantIdFromToken();
  const platform = PLATFORM_ROLES.has(role);

  if (platform) {
    const activeTenantId = getActiveTenantId();
    if (!activeTenantId) {
      if (!tenantRequired) return { token, tenantId: null, role, platform };
      throw new ApiClientError('TENANT_REQUIRED', 'Selecciona una empresa para operar este módulo GRC.', 400);
    }
    return { token, tenantId: activeTenantId, role, platform };
  }

  if (!isUuid(tokenTenantId)) {
    throw new ApiClientError('TENANT_INVALID', 'La sesión no contiene un tenant válido.', 422);
  }
  return { token, tenantId: String(tokenTenantId), role, platform };
}

export function buildTenantHeaders({ tenantRequired = true }: { tenantRequired?: boolean } = {}) {
  const context = resolveEffectiveTenantContext({ tenantRequired });
  return {
    context,
    headers: {
      Authorization: `Bearer ${context.token}`,
      ...(context.tenantId ? { 'X-Tenant-Id': context.tenantId } : {}),
      'X-Request-Id': `web-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
  };
}

export async function apiRequestJson<T = ApiJsonObject>(
  path: string,
  options: RequestInit & { tenantRequired?: boolean; fallbackMessage?: string; locale?: string } = {}
) {
  const { tenantRequired = true, fallbackMessage, locale, headers, ...requestOptions } = options;
  const baseUrl = getApiBaseUrl();
  const { headers: tenantHeaders } = buildTenantHeaders({ tenantRequired });
  const bodyIsFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
  const requestHeaders = new Headers(headers || undefined);
  Object.entries(tenantHeaders).forEach(([key, value]) => requestHeaders.set(key, value));
  if (!bodyIsFormData && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
  });
  return readJsonResponse<T>(response, { fallbackMessage, locale });
}

export function apiRequestJsonSingleFlight<T = ApiJsonObject>(
  path: string,
  options: RequestInit & { tenantRequired?: boolean; fallbackMessage?: string; locale?: string } = {}
) {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET' || options.body) return apiRequestJson<T>(path, options);

  const token = getStoredValidToken() || '';
  const tenant = getTenantIdFromToken() || '';
  const activeTenant = typeof window === 'undefined' ? '' : localStorage.getItem('activeTenantId') || '';
  const key = `${token}:${tenant}:${activeTenant}:${path}`;
  const pending = pendingJsonRequests.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = apiRequestJson<T>(path, options);
  pendingJsonRequests.set(key, request);
  const clearPending = () => {
    if (pendingJsonRequests.get(key) === request) pendingJsonRequests.delete(key);
  };
  void request.then(clearPending, clearPending);
  return request;
}
