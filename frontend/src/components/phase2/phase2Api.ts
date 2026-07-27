import { getApiBaseUrl, readJsonResponse } from '@/utils/apiClient';
import { getStoredValidToken } from '@/utils/auth';

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  request_id?: string;
};

export async function phase2Request<T>(
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
  const response = await fetch(`${getApiBaseUrl()}/api/grc/phase2${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
  const payload = await readJsonResponse<ApiEnvelope<T>>(response);
  return payload.data;
}

export async function phase2Mutation<T>(
  path: string,
  body: Record<string, unknown>,
  method = 'POST',
  idempotencyKey?: string
): Promise<T> {
  return phase2Request<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export async function phase2DownloadReport(domain: string) {
  const token = getStoredValidToken();
  if (!token) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.');
  const response = await fetch(`${getApiBaseUrl()}/api/grc/phase2/reports/${encodeURIComponent(domain)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters: {} }),
  });
  if (!response.ok) {
    await readJsonResponse(response);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `tcdx-phase2-${domain}.csv`;
  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}
