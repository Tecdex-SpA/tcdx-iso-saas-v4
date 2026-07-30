'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

type CatalogItem = {
  result_code?: string;
  analytical_result_code?: string;
  display_name?: string;
  domain?: string;
  formula_code?: string;
  formula_version?: number;
  unit?: string | null;
  source_status?: string;
  trust_status?: string;
  latest_calculation_run?: string | null;
  latest_snapshot?: string | null;
};

type RecalculationResult = {
  formula_code: string;
  display_name?: string;
  domain?: string;
  status: 'calculated' | 'unmeasured' | 'source_unavailable' | 'not_applicable' | 'failed';
  value?: number | null;
  unit?: string | null;
  calculation_run_id?: string | null;
  snapshot_id?: string | null;
  warnings?: string[];
  error?: string;
};

type RecalculationPayload = {
  status: string;
  period: { start?: string | null; end?: string | null; timezone?: string };
  summary: Record<string, number>;
  results: RecalculationResult[];
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusLabel(value?: string) {
  const labels: Record<string, string> = {
    available: 'Disponible',
    trusted: 'Confiable',
    source_unavailable: 'Sin fuente',
    calculated: 'Calculada',
    unmeasured: 'Sin medición',
    not_applicable: 'No aplicable',
    failed: 'Error',
    unknown: 'Pendiente',
  };
  return labels[String(value || 'unknown')] || String(value || 'Pendiente');
}

function statusTone(value?: string) {
  const status = String(value || '').toLowerCase();
  if (['available', 'trusted', 'calculated'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (['failed'].includes(status)) return 'border-red-200 bg-red-50 text-red-950';
  if (['unmeasured', 'source_unavailable', 'not_applicable'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-950';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function FormulaCatalog() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [start, setStart] = useState(isoDate(yearStart));
  const [end, setEnd] = useState(isoDate(now));
  const [domain, setDomain] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [lastRun, setLastRun] = useState<RecalculationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequestJson<{ data?: CatalogItem[] }>('/api/grc/official/analytics/catalog', {
        fallbackMessage: 'No fue posible cargar las fórmulas oficiales.',
      });
      setCatalog(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No fue posible cargar las fórmulas oficiales.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const domains = useMemo(() => Array.from(new Set(catalog.map((item) => item.domain).filter(Boolean) as string[])).sort(), [catalog]);
  const visible = useMemo(() => domain ? catalog.filter((item) => item.domain === domain) : catalog, [catalog, domain]);
  const runMap = useMemo(() => new Map((lastRun?.results || []).map((item) => [item.formula_code, item])), [lastRun]);

  async function recalculate() {
    setRunning(true);
    setError(null);
    try {
      const response = await apiRequestJson<{ data?: RecalculationPayload }>('/api/grc/official/recalculate', {
        method: 'POST',
        body: JSON.stringify({
          domain: domain || undefined,
          period: {
            start: start ? `${start}T00:00:00.000Z` : null,
            end: end ? `${end}T23:59:59.999Z` : null,
            timezone: 'America/Santiago',
          },
        }),
        fallbackMessage: 'No fue posible recalcular las fórmulas con los datos existentes.',
      });
      if (!response.data) throw new Error('El backend no devolvió el resumen de recálculo.');
      setLastRun(response.data);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible recalcular las fórmulas.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Capa matemática oficial</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--tcdx-color-text-ink)]">Catálogo de fórmulas</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
            Las fórmulas publicadas leen los datos operacionales de la empresa seleccionada. Define el período y ejecuta el recálculo para generar resultados, snapshots, explicación y lineage.
          </p>
        </div>
        <Link href="/datos/lineage" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">
          Ver lineage
        </Link>
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-[var(--tcdx-color-border)] bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
          Desde
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
          Hasta
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
          Dominio
          <select value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal">
            <option value="">Todos los dominios</option>
            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" onClick={recalculate} disabled={running || loading} className="min-h-10 self-end rounded-md bg-[var(--tcdx-color-action-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {running ? 'Calculando…' : 'Recalcular desde datos existentes'}
        </button>
      </div>

      {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}

      {lastRun && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Calculadas', lastRun.summary.calculated || 0],
            ['Sin medición', lastRun.summary.unmeasured || 0],
            ['Sin fuente', lastRun.summary.source_unavailable || 0],
            ['No aplicables', lastRun.summary.not_applicable || 0],
            ['Errores', lastRun.summary.failed || 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-3">
              <div className="text-xs text-[var(--tcdx-color-text-secondary)]">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-5 rounded-md border border-dashed p-4 text-sm">Cargando fórmulas oficiales…</div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--tcdx-color-text-secondary)]">
                <th className="border-b px-3 py-2">Fórmula</th>
                <th className="border-b px-3 py-2">Dominio</th>
                <th className="border-b px-3 py-2">Versión</th>
                <th className="border-b px-3 py-2">Fuente</th>
                <th className="border-b px-3 py-2">Resultado del recálculo</th>
                <th className="border-b px-3 py-2">Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const formulaCode = item.formula_code || item.result_code || item.analytical_result_code || 'unknown';
                const result = runMap.get(formulaCode);
                const runId = result?.calculation_run_id || item.latest_calculation_run;
                return (
                  <tr key={`${formulaCode}-${item.result_code || ''}`}>
                    <td className="border-b px-3 py-3">
                      <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{item.display_name || formulaCode}</div>
                      <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{formulaCode}</div>
                    </td>
                    <td className="border-b px-3 py-3">{item.domain || '—'}</td>
                    <td className="border-b px-3 py-3">v{item.formula_version || 1} · {item.unit || 'sin unidad'}</td>
                    <td className="border-b px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.source_status)}`}>{statusLabel(item.source_status)}</span></td>
                    <td className="border-b px-3 py-3">
                      {result ? (
                        <div>
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(result.status)}`}>{statusLabel(result.status)}</span>
                          {result.status === 'calculated' && <div className="mt-1 font-semibold">{result.value ?? '—'} {result.unit || ''}</div>}
                          {(result.error || result.warnings?.[0]) && <div className="mt-1 max-w-sm text-xs text-[var(--tcdx-color-text-secondary)]">{result.error || result.warnings?.[0]}</div>}
                        </div>
                      ) : <span className="text-[var(--tcdx-color-text-secondary)]">Pendiente de recálculo</span>}
                    </td>
                    <td className="border-b px-3 py-3">
                      {runId ? (
                        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--tcdx-color-primary)]">
                          <Link href={`/api/grc/official/calculations/${runId}/explanation`} className="underline">Explicación</Link>
                          <Link href={`/api/grc/official/calculations/${runId}/lineage`} className="underline">Lineage</Link>
                        </div>
                      ) : <span className="text-xs text-[var(--tcdx-color-text-secondary)]">Sin ejecución</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
