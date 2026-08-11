'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';
import OfficialAnalyticsPanel from '@/components/math-governance/OfficialAnalyticsPanel';

type Phase5Item = Record<string, unknown>;

type Phase5WorkspaceProps = {
  title: string;
  description: string;
  endpoint: string;
  primaryLabel: string;
  columns: Array<{ key: string; label: string }>;
  emptyMessage: string;
  capabilityLabel?: string;
  analyticsDomain?: string;
  loadCollection?: boolean;
  children?: ReactNode;
};

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

function entityTypeFromEndpoint(endpoint: string) {
  if (endpoint.startsWith('/api/metrics')) return 'metric_definition';
  if (endpoint.startsWith('/api/assurance-tests')) return 'assurance_test_definition';
  if (endpoint.startsWith('/api/loss-events')) return 'loss_event';
  if (endpoint.startsWith('/api/dashboards')) return 'dashboard_definition';
  if (endpoint.startsWith('/api/reports')) return 'report_definition';
  if (endpoint.startsWith('/api/report-generations')) return 'report_generation';
  if (endpoint.startsWith('/api/surveys')) return 'survey_definition';
  if (endpoint.startsWith('/api/survey-campaigns')) return 'assessment_campaign';
  if (endpoint.startsWith('/api/data/elements')) return 'data_element';
  if (endpoint.startsWith('/api/data')) return 'data_domain';
  return 'grc_entity';
}

export default function Phase5Workspace({
  title,
  description,
  endpoint,
  primaryLabel,
  columns,
  emptyMessage,
  capabilityLabel,
  analyticsDomain,
  loadCollection = true,
  children,
}: Phase5WorkspaceProps) {
  const [rows, setRows] = useState<Phase5Item[]>([]);
  const [loading, setLoading] = useState(loadCollection);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const requestEndpoint = useMemo(() => endpoint, [endpoint]);
  const entityType = useMemo(() => entityTypeFromEndpoint(endpoint), [endpoint]);

  useEffect(() => {
    if (!loadCollection) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await apiRequestJson(requestEndpoint, {
          fallbackMessage: `No fue posible cargar ${primaryLabel}.`,
        });
        if (!cancelled) {
          setRows(normalizeRows(json));
          setLastLoadedAt(new Date().toLocaleString('es-CL'));
        }
      } catch (err) {
        if (!cancelled) {
          const code = err instanceof ApiClientError ? err.code : 'LOAD_ERROR';
          setError({ code, message: err instanceof Error ? err.message : 'Error inesperado cargando datos.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadCollection, primaryLabel, requestEndpoint]);

  const retry = () => {
    setLastLoadedAt('');
    setRows([]);
    setLoading(true);
    setError(null);
    setTimeout(() => {
      apiRequestJson(requestEndpoint, { fallbackMessage: `No fue posible cargar ${primaryLabel}.` })
        .then((json) => {
          setRows(normalizeRows(json));
          setLastLoadedAt(new Date().toLocaleString('es-CL'));
        })
        .catch((err) => setError({
          code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR',
          message: err instanceof Error ? err.message : 'Error inesperado cargando datos.',
        }))
        .finally(() => setLoading(false));
    }, 0);
  };

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tcdx-color-primary)]">Gobierno analítico GRC</p>
            <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
          </div>
          <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-4 py-3 text-xs text-[var(--tcdx-color-text-secondary)]">
            <div className="font-semibold text-[var(--tcdx-color-text-primary)]">{capabilityLabel || primaryLabel}</div>
            <div>Última carga: {lastLoadedAt || 'pendiente'}</div>
          </div>
        </div>

        {children && (
          <div className="mt-6 grid gap-4">
            {children}
          </div>
        )}

        {analyticsDomain !== undefined && (
          <div className="mt-6">
            <OfficialAnalyticsPanel
              title="Resultados oficiales disponibles para esta vista"
              domain={analyticsDomain || undefined}
              compact
            />
          </div>
        )}

        {loading && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] p-6 text-sm">
            Cargando información gobernada…
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <div className="font-semibold">
              {error.code === 'TENANT_REQUIRED'
                ? 'Selecciona una empresa'
                : error.code === 'CAPABILITY_NOT_INCLUDED'
                  ? 'Capacidad no incluida en el plan'
                  : error.code === 'PERMISSION_DENIED'
                    ? 'Permiso insuficiente'
                    : 'No fue posible cargar la información'}
            </div>
            <p className="mt-1">{error.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {error.code === 'TENANT_REQUIRED' && (
                <Link className="rounded-md bg-[var(--tcdx-color-primary)] px-3 py-2 text-xs font-semibold text-white" href="/admin-saas">
                  Seleccionar empresa
                </Link>
              )}
              <button
                type="button"
                onClick={retry}
                className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {loadCollection && !loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
            {emptyMessage}
          </div>
        )}

        {loadCollection && !loading && !error && rows.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)]">
            <table className="min-w-full divide-y divide-[var(--tcdx-color-border)] text-sm">
              <thead className="bg-[var(--tcdx-color-surface)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-4 py-3 text-left font-semibold">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Confianza</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Fórmula</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Análisis</th>
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
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="font-semibold">{text(row.formula_code || row.official_formula_code || row.result_code)}</div>
                      <div className="text-[var(--tcdx-color-text-secondary)]">v{text(row.formula_version || row.official_formula_version || row.version_number)}</div>
                      <div className="text-[var(--tcdx-color-text-secondary)]">{text(row.coverage ?? row.trust_status ?? row.source_status)}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.id ? (
                        <div className="flex flex-wrap gap-2">
                          <Link className="text-xs font-semibold text-[var(--tcdx-color-primary)] underline-offset-2 hover:underline" href={`/datos/lineage?entityType=${encodeURIComponent(String(row.entity_type || entityType))}&entityId=${encodeURIComponent(String(row.id))}&mode=lineage`}>
                            Lineage
                          </Link>
                          <Link className="text-xs font-semibold text-[var(--tcdx-color-primary)] underline-offset-2 hover:underline" href={`/datos/lineage?entityType=${encodeURIComponent(String(row.entity_type || entityType))}&entityId=${encodeURIComponent(String(row.id))}&mode=impact`}>
                            Impacto
                          </Link>
                        </div>
                      ) : (
                        '—'
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
