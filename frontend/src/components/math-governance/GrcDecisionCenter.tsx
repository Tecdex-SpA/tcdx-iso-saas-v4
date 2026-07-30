'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import OfficialEvidenceDialog, { type EvidenceKind } from './OfficialEvidenceDialog';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

type UnknownRecord = Record<string, unknown>;
type EvidenceState = { kind: EvidenceKind; runId: string; formulaName: string } | null;
type DecisionItem = {
  code: string;
  name: string;
  domain: string;
  value: number | null;
  unit: string;
  severity: 'green'|'amber'|'red'|'blue'|'gray';
  interpretation: string;
  cause: string;
  impact: string;
  recommendation: string;
  trend: string;
  delta: number | null;
  runId: string;
  snapshotId: string;
  actionRoute: string;
  actionLabel: string;
  canCreatePlan: boolean;
  owner: string;
  targetDate: string;
};

type Props = { compact?: boolean; limit?: number; title?: string };

function isRecord(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function unwrap(value: unknown) { return isRecord(value) && 'data' in value ? value.data : value; }
function text(value: unknown, fallback = '') { if (typeof value === 'string' && value.trim()) return value.trim(); if (typeof value === 'number' || typeof value === 'boolean') return String(value); return fallback; }
function numeric(value: unknown) { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function objectId(value: unknown) { if (typeof value === 'string') return value; if (!isRecord(value)) return ''; return text(value.run_id || value.id || value.calculation_run_id || value.snapshot_id); }
function severityTone(value: DecisionItem['severity']) { if (value === 'red') return 'border-red-200 bg-red-50 text-red-950'; if (value === 'amber') return 'border-amber-200 bg-amber-50 text-amber-950'; if (value === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-950'; if (value === 'blue') return 'border-blue-200 bg-blue-50 text-blue-950'; return 'border-slate-200 bg-slate-50 text-slate-800'; }
function priority(value: DecisionItem['severity']) { return value === 'red' ? 4 : value === 'amber' ? 3 : value === 'blue' ? 2 : value === 'green' ? 1 : 0; }

function deriveDecision(catalogItem: UnknownRecord, detailPayload: unknown): DecisionItem {
  const detail = isRecord(unwrap(detailPayload)) ? unwrap(detailPayload) as UnknownRecord : {};
  const latestRun = isRecord(catalogItem.latest_calculation_run) ? catalogItem.latest_calculation_run : {};
  const latestSnapshot = isRecord(catalogItem.latest_snapshot) ? catalogItem.latest_snapshot : {};
  const decision = isRecord(detail.decision) ? detail.decision : isRecord(detail.details) && isRecord(detail.details.decision) ? detail.details.decision : {};
  const result = isRecord(decision.result) ? decision.result : {};
  const interpretation = isRecord(decision.interpretation) ? decision.interpretation : {};
  const action = isRecord(decision.action) ? decision.action : {};
  const trend = isRecord(decision.trend) ? decision.trend : {};
  const value = numeric(result.value ?? detail.value ?? detail.output_value);
  const runStatus = text(latestRun.run_status || detail.run_status).toLowerCase();
  const snapshotId = objectId(catalogItem.latest_snapshot);
  const trusted = text(catalogItem.trust_status).toLowerCase() === 'trusted';
  let severity = text(interpretation.severity, 'gray') as DecisionItem['severity'];
  if (!['green','amber','red','blue','gray'].includes(severity)) severity = 'gray';
  if (!value && value !== 0) severity = 'gray';
  if (runStatus === 'failed') severity = 'red';
  if (value !== null && snapshotId && trusted && severity === 'gray') severity = 'green';
  if (value !== null && snapshotId && !trusted && severity === 'gray') severity = 'amber';
  return {
    code: text(catalogItem.formula_code || catalogItem.result_code || catalogItem.analytical_result_code, 'unknown'),
    name: text(catalogItem.display_name, 'Indicador sin nombre'),
    domain: text(catalogItem.domain, 'general'),
    value,
    unit: text(result.unit || catalogItem.unit || detail.unit),
    severity,
    interpretation: text(interpretation.label, value === null ? 'Sin medición válida' : 'Resultado disponible'),
    cause: text(decision.cause, value === null ? 'No existe una ejecución oficial con valor y snapshot publicable.' : 'El resultado proviene de la última ejecución oficial disponible.'),
    impact: text(decision.impact, 'Revise el indicador junto con sus riesgos, controles, evidencias y planes asociados.'),
    recommendation: text(decision.recommendation, value === null ? 'Complete o corrija los datos fuente antes de tomar decisiones.' : 'Revise los registros que explican el resultado y asigne una acción cuando corresponda.'),
    trend: text(trend.label, 'Sin período comparable'),
    delta: numeric(trend.delta),
    runId: objectId(catalogItem.latest_calculation_run),
    snapshotId,
    actionRoute: text(action.route, '/dashboard'),
    actionLabel: text(action.label, 'Abrir detalle'),
    canCreatePlan: Boolean(action.can_create_plan) || severity === 'red' || severity === 'amber',
    owner: text(decision.owner, 'Por asignar'),
    targetDate: text(decision.target_date, 'Por definir'),
  };
}

export default function GrcDecisionCenter({ compact = false, limit = 12, title = 'Centro de decisiones GRC' }: Props) {
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DecisionItem | null>(null);
  const [evidence, setEvidence] = useState<EvidenceState>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try {
        const catalogPayload = await apiRequestJson('/api/grc/official/analytics/catalog', { fallbackMessage: 'No fue posible cargar los indicadores oficiales.' });
        const raw = unwrap(catalogPayload);
        const catalog = Array.isArray(raw) ? raw.filter(isRecord).slice(0, limit) : [];
        const resolved = await Promise.all(catalog.map(async (item) => {
          const resultCode = text(item.result_code || item.analytical_result_code || item.formula_code);
          let detail: unknown = {};
          if (resultCode) {
            try { detail = await apiRequestJson(`/api/grc/official/analytics/${encodeURIComponent(resultCode)}`, { fallbackMessage: 'No fue posible cargar el detalle del indicador.' }); }
            catch { detail = {}; }
          }
          return deriveDecision(item, detail);
        }));
        if (!cancelled) setItems(resolved.sort((a,b) => priority(b.severity)-priority(a.severity)));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar el centro de decisiones.');
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [limit]);

  const summary = useMemo(() => items.reduce((acc,item) => { acc[item.severity] += 1; if (item.value !== null) acc.measured += 1; return acc; }, { red:0, amber:0, green:0, blue:0, gray:0, measured:0 }), [items]);
  const priorities = useMemo(() => items.filter((item) => item.severity === 'red' || item.severity === 'amber'), [items]);

  return <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Decisión basada en evidencia</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2><p className="mt-2 max-w-4xl text-sm text-slate-600">Consolida resultados oficiales, interpretación, tendencia, impacto y acciones. Los indicadores sin ejecución válida permanecen grises y no se interpretan como cero.</p></div><Link href="/metricas" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Administrar métricas</Link></div>
    {loading && <div className="mt-4 rounded-md border border-dashed p-4 text-sm">Cargando decisiones…</div>}
    {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
    {!loading && !error && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[['Críticos',summary.red,'text-red-700'],['Atención',summary.amber,'text-amber-700'],['Controlados',summary.green,'text-emerald-700'],['Informativos',summary.blue,'text-blue-700'],['Sin medición',summary.gray,'text-slate-700'],['Medidos',summary.measured,'text-slate-950']].map(([label,value,tone]) => <div key={String(label)} className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-600">{label}</div><div className={`mt-1 text-2xl font-bold ${tone}`}>{Number(value)}</div></div>)}</div>
      {priorities.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Prioridades de gestión</h3><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{priorities.slice(0,6).map((item) => <button key={item.code} type="button" onClick={() => setSelected(item)} className="rounded-lg border border-amber-200 bg-white p-4 text-left"><div className="flex justify-between gap-3"><span className="font-semibold">{item.name}</span><span className="rounded-full border border-current/20 px-2 py-1 text-xs font-bold">{item.interpretation}</span></div><p className="mt-2 text-sm text-slate-700">{item.recommendation}</p><p className="mt-2 text-xs text-slate-500">Tendencia: {item.trend}</p></button>)}</div></div>}
      <div className={`mt-5 grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>{items.map((item) => <article key={item.code} className={`rounded-xl border p-4 ${severityTone(item.severity)}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs opacity-70">{item.code} · {item.domain}</p></div><span className="rounded-full border border-current/20 bg-white/50 px-2 py-1 text-xs font-bold">{item.interpretation}</span></div><div className="mt-4 text-3xl font-bold">{item.value === null ? 'Sin medición' : `${item.value}${item.unit ? ` ${item.unit}` : ''}`}</div><div className="mt-3 text-sm"><strong>Tendencia:</strong> {item.trend}{item.delta !== null ? ` (${item.delta > 0 ? '+' : ''}${item.delta})` : ''}</div><p className="mt-2 text-sm">{item.cause}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelected(item)} className="rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-semibold">Ver decisión</button>{item.runId && <button type="button" onClick={() => setEvidence({ kind:'explanation', runId:item.runId, formulaName:item.name })} className="rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-semibold">Explicación</button>}</div></article>)}</div>
    </>}
    {selected && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target===event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" className="max-h-[84vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-orange-700">Decisión GRC</p><h3 className="mt-1 text-2xl font-semibold">{selected.name}</h3></div><button type="button" onClick={() => setSelected(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Cerrar</button></div><div className={`mt-4 rounded-xl border p-4 ${severityTone(selected.severity)}`}><div className="text-3xl font-bold">{selected.value === null ? 'Sin medición válida' : `${selected.value}${selected.unit ? ` ${selected.unit}` : ''}`}</div><div className="mt-1 font-semibold">{selected.interpretation}</div></div><dl className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Causa</dt><dd className="mt-2 text-sm">{selected.cause}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Impacto</dt><dd className="mt-2 text-sm">{selected.impact}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Recomendación</dt><dd className="mt-2 text-sm">{selected.recommendation}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Responsable y fecha</dt><dd className="mt-2 text-sm">{selected.owner} · {selected.targetDate}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><Link href={selected.actionRoute} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">{selected.actionLabel}</Link>{selected.canCreatePlan && <Link href={`/planes-accion?source=official_metric&formula=${encodeURIComponent(selected.code)}&run=${encodeURIComponent(selected.runId)}&suggested=1`} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Crear plan de acción</Link>}{selected.runId && <button type="button" onClick={() => setEvidence({kind:'lineage',runId:selected.runId,formulaName:selected.name})} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Ver trazabilidad</button>}</div></section></div>}
    <OfficialEvidenceDialog open={Boolean(evidence)} kind={evidence?.kind || 'explanation'} runId={evidence?.runId || ''} formulaName={evidence?.formulaName || ''} onClose={() => setEvidence(null)} />
  </section>;
}
