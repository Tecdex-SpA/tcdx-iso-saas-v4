'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiClient';
import { getStoredValidToken, getTenantIdFromToken } from '@/utils/auth';
import { hasUsefulBrief } from '@/components/intelligence/utils';
import type { IntelligenceBrief, IntelligenceStatus } from '@/components/intelligence/types';

type UseIntelligenceBriefOptions = {
  enabled?: boolean;
  timeoutMs?: number;
};

type RefreshOptions = {
  bypassCache?: boolean;
};

type UseIntelligenceBriefResult = {
  tenantId: string | null;
  data: IntelligenceBrief | null;
  loading: boolean;
  error: string;
  status: IntelligenceStatus;
  partial: boolean;
  timeout: boolean;
  empty: boolean;
  refresh: (options?: RefreshOptions) => Promise<void>;
};

function briefCacheKey(tenantId: string) {
  return `tcdx:intelligence-brief:last:${tenantId}:es`;
}

function readSessionBrief(tenantId: string): IntelligenceBrief | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(briefCacheKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntelligenceBrief;
    return parsed?.tenant_id && String(parsed.tenant_id) !== tenantId ? null : parsed;
  } catch {
    return null;
  }
}

function writeSessionBrief(tenantId: string, brief: IntelligenceBrief) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(briefCacheKey(tenantId), JSON.stringify(brief));
  } catch {
    // Cache is best effort only; the network response remains the source of truth.
  }
}

function readApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    return String(record.error || record.message || record.detail || fallback);
  }
  return fallback;
}

export default function useIntelligenceBrief({
  enabled = true,
  timeoutMs = 18000,
}: UseIntelligenceBriefOptions = {}): UseIntelligenceBriefResult {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [data, setData] = useState<IntelligenceBrief | null>(null);
  const [status, setStatus] = useState<IntelligenceStatus>('idle');
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    const token = getStoredValidToken();
    const tokenTenantId = getTenantIdFromToken();
    const safeTenantId = tokenTenantId ? String(tokenTenantId) : '';
    setTenantId(safeTenantId || null);

    if (!token || !safeTenantId) {
      setData(null);
      setError('Sin sesión o tenant asociado para consultar Intelligence Layer.');
      setStatus('no_session');
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const cached = readSessionBrief(safeTenantId);
      if (cached && !options.bypassCache) {
        setData((current) => current || cached);
      }
      setStatus('loading');
      setError('');
      const baseUrl = getApiBaseUrl();
      const query = new URLSearchParams({ locale: 'es' });
      if (options.bypassCache) query.set('refresh', '1');
      const response = await fetch(
        `${baseUrl}/api/intelligence/brief/${encodeURIComponent(safeTenantId)}?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tcdx-locale': 'es',
          },
          signal: controller.signal,
        }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        const forbidden = response.status === 401 || response.status === 403;
        throw Object.assign(
          new Error(readApiError(payload, forbidden ? 'Sin permisos para consultar Intelligence Layer.' : 'No fue posible cargar Intelligence Layer.')),
          { status: response.status }
        );
      }

      const brief = payload as IntelligenceBrief;
      if (brief.tenant_id && String(brief.tenant_id) !== safeTenantId) {
        setData(null);
        setError('La respuesta Intelligence no corresponde al tenant autenticado.');
        setStatus('forbidden');
        return;
      }

      setData(brief);
      writeSessionBrief(safeTenantId, brief);
      if (!hasUsefulBrief(brief)) {
        setStatus('empty');
      } else if (brief.metadata?.fallback_reason || brief.metadata?.ai_used === false || brief.data_quality?.confidence === 'low') {
        setStatus('partial');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const statusCode = typeof (err as { status?: unknown })?.status === 'number'
        ? Number((err as { status?: unknown }).status)
        : 0;
      setError(
        aborted
          ? 'El análisis asistido está tardando más de lo habitual. Se mantiene la lectura operativa disponible.'
          : err instanceof Error
            ? err.message
            : 'No fue posible cargar Intelligence Layer.'
      );
      setStatus(aborted ? 'timeout' : statusCode === 401 || statusCode === 403 ? 'forbidden' : 'error');
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }, [enabled, timeoutMs]);

  useEffect(() => {
    refresh();
    return () => {
      requestRef.current?.abort();
    };
  }, [refresh]);

  return useMemo(() => ({
    tenantId,
    data,
    loading: status === 'loading',
    error,
    status,
    partial: status === 'partial',
    timeout: status === 'timeout',
    empty: status === 'empty',
    refresh,
  }), [data, error, refresh, status, tenantId]);
}
