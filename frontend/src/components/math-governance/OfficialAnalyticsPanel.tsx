'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import OfficialEvidenceDialog, { type EvidenceKind } from './OfficialEvidenceDialog';
import { ApiClientError, apiRequestJsonSingleFlight } from '@/utils/apiClient';

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
  latest_calculation_run?: string | { id?: string; run_id?: string; run_status?: string; completed_at?: string } | null;
  latest_snapshot?: string | { id?: string; snapshot_id?: string; snapshot_type?: string; created_at?: string } | null;
  supported_periods?: string[];
  dimensions?: string[];
  publication_status?: string;
};

type Props = { title?: string; domain?: string; compact?: boolean; limit?: number };
type EvidenceState = { kind: EvidenceKind; runId: string; formulaName: string } | null;
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringId(value: unknown) {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  for (const key of ['run_id', 'id', 'snapshot_id', 'calculation_run_id']) {
    if (typeof value[key] === 'string' && String(value[key]).trim()) return String(value[key]);
  }
  return '';
}

function runStatus(item: AnalyticsItem) {
  const run = item.latest_calculation_run;
  return isRecord(run) ? String(run.run_status || '').toLowerCase() : '';
}

function cardTone(item: AnalyticsItem) {
  const run = stringId(item.latest_calculation_run);
  const snapshot = stringId(item.latest_snapshot);
  const status = runStatus(item);
  const trusted = String(item.trust_status || '').toLowerCase() === 'trusted';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-950';
  if (run && snapshot && ['calculated', 'completed'].includes(status) && trusted) return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (run && snapshot && ['calculated', 'completed'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-950';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function executionLabel(item: AnalyticsItem) {
  const run = stringId(item.latest_calculation_run);
  const snapshot = stringId(item.latest_snapshot);
  const status = runStatus(item);
  if (!run) return 'Sin ejecución oficial';
  if (status === 'failed') return 'Ejecución fallida';
  if (!snapshot) return 'Ejecución sin snapshot publicable';
  if (['calculated', 'completed'].includes(status)) return 'Resultado oficial disponible';
  return status || 'Ejecución pendiente';
}

function label(value: unknown) {
  if (value === null || value === undefined || value === '') return 'No medido';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Sin dimensión';
  return String(value);
}

export default function OfficialAnalyticsPanel({ title = 'Resultados analíticos oficiales', domain, compact = false, limit = 8 }: Props) {
  const titleId = useId();
  const [items, setItems] = useState<AnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [evidence, setEvidence] = useState<EvidenceState>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequestJsonSingleFlight<{ data?: AnalyticsItem[] }>('/api/grc/official/analytics/catalog', { fallbackMessage: 'No fue posible cargar el catálogo analítico oficial.' })
      .then((payload) => {
        const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload as unknown) ? payload as unknown as AnalyticsItem[] : [];
        if (!cancelled) setItems(rows);
      })
      .catch((err) => { if (!cancelled) setError({ code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR', message: err instanceof Error ? err.message : 'Error cargando resultados oficiales.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">Verde significa resultado calculado, snapshot persistido y confianza validada. Un contrato de fuente sin ejecución permanece gris.</p>
        </div>
        <Link href="/datos/lineage" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Ver lineage e impacto</Link>
      </div>

      {loading && <div className="mt-4 rounded-md border border-dashed p-4 text-sm">Cargando resultados oficiales…</div>}
      {!loading && error && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert"><div className="font-semibold">Catálogo no disponible</div><p className="mt-1">{error.message}</p></div>}
      {!loading && !error && visible.length === 0 && <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-[var(--tcdx-color-text-secondary)]">No hay resultados oficiales publicados para este alcance.</div>}
      {!loading && !error && visible.length > 0 && (
        <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
          {visible.map((item) => {
            const code = item.result_code || item.analytical_result_code || item.formula_code || 'unknown';
            const runId = stringId(item.latest_calculation_run);
            const snapshotId = stringId(item.latest_snapshot);
            const formulaName = item.display_name || code;
            return (
              <article key={code} className={`rounded-md border p-4 ${cardTone(item)}`}>
                <div className="text-sm font-semibold">{formulaName}</div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-3"><dt>Estado oficial</dt><dd className="font-semibold text-right">{executionLabel(item)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Fórmula</dt><dd className="font-semibold text-right">{item.formula_code}@v{item.formula_version || 1}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Unidad</dt><dd>{label(item.unit)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Contrato de fuente</dt><dd>{label(item.source_status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Confianza</dt><dd>{label(item.trust_status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Período</dt><dd>{label(item.supported_periods?.[0])}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {runId ? <button type="button" onClick={() => setEvidence({ kind: 'explanation', runId, formulaName })} className="rounded-md border border-current/20 bg-white/70 px-2 py-1 hover:bg-white">Explicación</button> : <span>Sin ejecución</span>}
                  {runId ? <button type="button" onClick={() => setEvidence({ kind: 'lineage', runId, formulaName })} className="rounded-md border border-current/20 bg-white/70 px-2 py-1 hover:bg-white">Lineage</button> : null}
                  {snapshotId ? <span>Snapshot {snapshotId.slice(0, 8)}</span> : <span>Snapshot pendiente</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <OfficialEvidenceDialog open={Boolean(evidence)} kind={evidence?.kind || 'explanation'} runId={evidence?.runId || ''} formulaName={evidence?.formulaName || ''} onClose={() => setEvidence(null)} />
    </section>
  );
}
