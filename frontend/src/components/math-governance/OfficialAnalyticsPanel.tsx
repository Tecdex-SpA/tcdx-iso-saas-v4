'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

type AnalyticsItem = {
  analytical_result_code?: string;
  result_code?: string;
  display_name?: string;
  domain?: string;
  formula_code?: string;
  formula_version?: number;
  unit?: string | null;
  source_status?: string;
  trust_status?: string;
  latest_calculation_run?: string | { id?: string; run_id?: string } | null;
  latest_snapshot?: string | { id?: string; snapshot_id?: string } | null;
  supported_periods?: string[];
  dimensions?: string[];
  publication_status?: string;
};

type OfficialAnalyticsPanelProps = {
  title?: string;
  domain?: string;
  compact?: boolean;
  limit?: number;
};

function tone(status?: string) {
  const normalized = String(status || 'unknown').toLowerCase();
  if (normalized === 'available' || normalized === 'trusted' || normalized === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (normalized === 'source_unavailable' || normalized === 'unknown') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-950';
}

function label(value: unknown) {
  if (value === null || value === undefined || value === '') return 'No medido';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Sin dimensión';
  return String(value);
}

export default function OfficialAnalyticsPanel({ title = 'Resultados analíticos oficiales', domain, compact = false, limit = 8 }: OfficialAnalyticsPanelProps) {
  const titleId = useId();
  const [items, setItems] = useState<AnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequestJson<{ data?: AnalyticsItem[] }>('/api/grc/official/analytics/catalog', {
      fallbackMessage: 'No fue posible cargar el catálogo analítico oficial.',
    })
      .then((payload) => {
        const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload as unknown) ? payload as unknown as AnalyticsItem[] : [];
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (!cancelled) setError({
          code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR',
          message: err instanceof Error ? err.message : 'Error cargando resultados oficiales.',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const filtered = domain ? items.filter((item) => item.domain === domain) : items;
    return filtered.slice(0, limit);
  }, [domain, items, limit]);

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" aria-labelledby={titleId}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Capa matemática oficial</p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            Todas las cifras se publican con fórmula, versión, fuente, confianza, snapshot, explicación y lineage.
          </p>
        </div>
        <Link href="/datos/lineage" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">
          Ver lineage e impacto
        </Link>
      </div>

      {loading && <div className="mt-4 rounded-md border border-dashed p-4 text-sm">Cargando resultados oficiales…</div>}
      {!loading && error && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <div className="font-semibold">Catálogo no disponible</div>
          <p className="mt-1">{error.message}</p>
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-[var(--tcdx-color-text-secondary)]">
          No hay resultados oficiales publicados para este alcance. Configure una fórmula oficial, ejecute el cálculo y publique el snapshot antes de usarlo en BI o reportes.
        </div>
      )}
      {!loading && !error && visible.length > 0 && (
        <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
          {visible.map((item) => {
            const code = item.result_code || item.analytical_result_code || item.formula_code || 'unknown';
            const latestRun = item.latest_calculation_run;
            const run = typeof latestRun === 'object' && latestRun ? latestRun.run_id || latestRun.id : latestRun;
            const latestSnapshot = item.latest_snapshot;
            const snapshot = typeof latestSnapshot === 'object' && latestSnapshot ? latestSnapshot.snapshot_id || latestSnapshot.id : latestSnapshot;
            return (
              <article key={code} className={`rounded-md border p-4 ${tone(item.source_status)}`}>
                <div className="text-sm font-semibold">{item.display_name || code}</div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-3"><dt>Resultado</dt><dd className="font-semibold text-right">{code}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Fórmula</dt><dd className="font-semibold text-right">{item.formula_code}@v{item.formula_version || 1}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Unidad</dt><dd>{label(item.unit)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Fuente</dt><dd>{label(item.source_status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Confianza</dt><dd>{label(item.trust_status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Período</dt><dd>{label(item.supported_periods?.[0])}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {run ? <Link href={`/api/grc/official/calculations/${run}/explanation`} className="underline">Explicación</Link> : <span>Sin ejecución</span>}
                  {run ? <Link href={`/api/grc/official/calculations/${run}/lineage`} className="underline">Lineage</Link> : null}
                  {snapshot ? <span>Snapshot {String(snapshot).slice(0, 8)}</span> : <span>Snapshot pendiente</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
