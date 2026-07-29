'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiClient';

type Phase5Item = Record<string, unknown>;

type Phase5WorkspaceProps = {
  title: string;
  description: string;
  endpoint: string;
  primaryLabel: string;
  columns: Array<{ key: string; label: string }>;
  emptyMessage: string;
  capabilityLabel?: string;
};

const API_URL = getApiBaseUrl();

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return 'Ver detalle';
  return String(value);
}

function isWarning(item: Phase5Item) {
  const freshness = String(item.freshness_status || '').toLowerCase();
  const quality = String(item.quality_status || '').toLowerCase();
  const trust = String(item.trust_status || '').toLowerCase();
  return ['stale', 'expired', 'unavailable', 'unknown'].includes(freshness) ||
    ['rejected', 'unknown'].includes(quality) ||
    ['attention', 'untrusted', 'unknown'].includes(trust);
}

function normalizeRows(payload: unknown): Phase5Item[] {
  const data = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(data)) return data as Phase5Item[];
  if (Array.isArray((data as { items?: unknown })?.items)) return (data as { items: Phase5Item[] }).items;
  if (Array.isArray((data as { rows?: unknown })?.rows)) return (data as { rows: Phase5Item[] }).rows;
  if (data && typeof data === 'object') return [data as Phase5Item];
  return [];
}

export default function Phase5Workspace({
  title,
  description,
  endpoint,
  primaryLabel,
  columns,
  emptyMessage,
  capabilityLabel,
}: Phase5WorkspaceProps) {
  const [rows, setRows] = useState<Phase5Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const url = useMemo(() => `${API_URL}${endpoint}`, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const token = getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `No fue posible cargar ${primaryLabel}.`);
        }
        if (!cancelled) {
          setRows(normalizeRows(json));
          setLastLoadedAt(new Date().toLocaleString('es-CL'));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error inesperado cargando datos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [primaryLabel, url]);

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-6 py-6 text-[var(--tcdx-color-text-ink)]">
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tcdx-color-primary)]">Fase 5 · Datos confiables</p>
            <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
          </div>
          <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-4 py-3 text-xs text-[var(--tcdx-color-text-secondary)]">
            <div className="font-semibold text-[var(--tcdx-color-text-primary)]">{capabilityLabel || primaryLabel}</div>
            <div>Última carga: {lastLoadedAt || 'pendiente'}</div>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] p-6 text-sm">
            Cargando información gobernada…
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
            {emptyMessage}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)]">
            <table className="min-w-full divide-y divide-[var(--tcdx-color-border)] text-sm">
              <thead className="bg-[var(--tcdx-color-surface)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-4 py-3 text-left font-semibold">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Confianza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tcdx-color-border)] bg-white">
                {rows.map((row, index) => (
                  <tr key={String(row.id || row.metric_code || row.dashboard_key || index)} className={isWarning(row) ? 'bg-amber-50' : ''}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 align-top">
                        {text(row[column.key])}
                      </td>
                    ))}
                    <td className="px-4 py-3 align-top">
                      {isWarning(row) ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                          Requiere atención
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                          Sin alerta visible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
