import { getApiBaseUrl, readJsonResponse } from '@/utils/apiClient';
import { getStoredValidToken } from '@/utils/auth';

export type Phase3Permissions = Record<string, boolean>;

export type Phase3Meta = {
  module: {
    module_key: string;
    display_name?: string;
    is_enabled: boolean;
  };
  permissions: Phase3Permissions;
};

export type Phase3Record = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  lifecycle_status?: string;
  owner_user_id?: string;
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type Phase3Impact = {
  id: string;
  dimension: string;
  previous_score: number;
  new_score: number;
  reason_code: string;
  explanation: string;
  created_at: string;
};

export type Phase3Alert = {
  id: string;
  code: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  created_at: string;
};

export type Phase3Entity360 = {
  entity: Phase3Record;
  relations: {
    outgoing: Phase3Record[];
    incoming: Phase3Record[];
  };
  dependencies: {
    outgoing: Phase3Record[];
    incoming: Phase3Record[];
  };
  alerts: Phase3Alert[];
  readiness_impacts: Phase3Impact[];
  history: Phase3Record[];
  events: Phase3Record[];
  bia_impacts: Phase3Record[];
  measurements?: Phase3Record[];
  linked_context?: Record<string, Phase3Record[]>;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  request_id?: string;
};

export function normalizePhase3Payload(
  body: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, value.map(item => (
            item && typeof item === 'object' && !Array.isArray(item)
              ? normalizePhase3Payload(item as Record<string, unknown>)
              : item
          ))];
        }
        if (value && typeof value === 'object') {
          return [key, normalizePhase3Payload(value as Record<string, unknown>)];
        }
        if (key === 'id' || key.endsWith('_id')) {
          const normalized = String(value ?? '').trim();
          if (!normalized || ['null', 'undefined'].includes(normalized.toLowerCase())) {
            return [key, null];
          }
          return [key, normalized];
        }
        return [key, typeof value === 'string' ? value.trim() : value];
      })
  );
}

export async function phase3Request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredValidToken();
  if (!token) {
    throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.');
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${getApiBaseUrl()}/api/grc/phase3${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
  const payload = await readJsonResponse<ApiEnvelope<T>>(response);
  return payload.data;
}

export function phase3Mutation<T>(
  path: string,
  body: Record<string, unknown>,
  method = 'POST',
  idempotencyKey = crypto.randomUUID()
) {
  return phase3Request<T>(path, {
    method,
    body: JSON.stringify(normalizePhase3Payload(body)),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
