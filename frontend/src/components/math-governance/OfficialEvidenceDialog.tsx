'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

export type EvidenceKind = 'explanation' | 'lineage';
type UnknownRecord = Record<string, unknown>;
type Props = { open: boolean; kind: EvidenceKind; runId: string; formulaName: string; onClose: () => void };
type LoaderProps = Omit<Props, 'open'>;

function isRecord(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function unwrap(payload: unknown): UnknownRecord { const value = isRecord(payload) && 'data' in payload ? payload.data : payload; return isRecord(value) ? value : { value }; }
function display(value: unknown) { if (value === null || value === undefined || value === '') return '—'; if (typeof value === 'boolean') return value ? 'Sí' : 'No'; if (typeof value === 'string' || typeof value === 'number') return String(value); return JSON.stringify(value); }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function number(value: unknown) { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }

function interpretationFrom(data: UnknownRecord, formulaName: string) {
  const decision = isRecord(data.decision) ? data.decision : isRecord(data.details) && isRecord(data.details.decision) ? data.details.decision : {};
  const result = isRecord(decision.result) ? decision.result : {};
  const interpretation = isRecord(decision.interpretation) ? decision.interpretation : {};
  const action = isRecord(decision.action) ? decision.action : {};
  const trend = isRecord(decision.trend) ? decision.trend : {};
  const variables = isRecord(data.variables) ? data.variables : {};
  const fallbackValue = number(data.value ?? data.output_value);
  const value = number(result.value) ?? fallbackValue;
  const unit = text(result.unit, text(data.unit));
  return {
    result: text(result.display, value === null ? 'Sin resultado publicable' : `${value}${unit ? ` ${unit}` : ''}`),
    classification: text(interpretation.label, text(data.status, 'Resultado disponible')),
    severity: text(interpretation.severity, 'gray'),
    cause: text(decision.cause, Object.keys(variables).length ? `El cálculo utiliza ${Object.keys(variables).length} variables operacionales verificables.` : 'No se informaron variables operacionales visibles.'),
    impact: text(decision.impact, 'El resultado debe analizarse junto con los riesgos, controles, evidencias y planes asociados.'),
    recommendation: text(decision.recommendation, 'Revise los registros que explican el resultado y asigne una acción cuando el indicador esté fuera del rango esperado.'),
    actionRoute: text(action.route, '/dashboard'),
    actionLabel: text(action.label, 'Abrir dashboard'),
    canCreatePlan: Boolean(action.can_create_plan),
    trend: text(trend.label, 'Sin período comparable'),
    delta: number(trend.delta),
    owner: text(decision.owner, 'Por asignar'),
    targetDate: text(decision.target_date, 'Por definir'),
    formulaName,
  };
}

function severityTone(value: string) { if (value === 'red') return 'border-red-200 bg-red-50 text-red-950'; if (value === 'amber') return 'border-amber-200 bg-amber-50 text-amber-950'; if (value === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-950'; if (value === 'blue') return 'border-blue-200 bg-blue-50 text-blue-950'; return 'border-slate-200 bg-slate-50 text-slate-900'; }

function EvidenceLoader({ kind, runId, formulaName, onClose }: LoaderProps) {
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`, { fallbackMessage: `No fue posible cargar ${kind === 'explanation' ? 'la explicación' : 'el lineage'} del cálculo.` })
      .then((payload) => { if (!cancelled) setData(unwrap(payload)); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar la evidencia.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, runId]);

  const lineage = useMemo(() => Array.isArray(data?.lineage) ? data.lineage.filter(isRecord) : [], [data]);
  const variables = isRecord(data?.variables) ? data.variables : {};
  const executive = data ? interpretationFrom(data, formulaName) : null;
  const sources = unique(lineage.map((row) => text(row.physical_source)));
  const contracts = unique(lineage.map((row) => text(row.source_contract)));
  const snapshots = unique(lineage.map((row) => text(row.dataset_snapshot)));
  const planHref = `/planes-accion?source=official_metric&run=${encodeURIComponent(runId)}&formula=${encodeURIComponent(text(data?.formula_code))}&suggested=1`;

  return <div className="fixed inset-0 z-[160] flex items-center justify-center overflow-hidden bg-slate-950/60 p-3 md:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="official-evidence-title" className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 md:p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Evidencia autenticada</p><h3 id="official-evidence-title" className="mt-1 text-xl font-semibold text-slate-950">{kind === 'explanation' ? 'Interpretación ejecutiva del cálculo' : 'Trazabilidad del cálculo'}</h3><p className="mt-1 text-sm text-slate-600">{formulaName} · ejecución {runId.slice(0, 12)}…</p></div>
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">Cerrar</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
        {loading && <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm">Cargando evidencia…</div>}
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
        {!loading && !error && data && kind === 'explanation' && executive && <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${severityTone(executive.severity)}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase opacity-70">Resultado oficial</div><div className="mt-1 text-3xl font-bold">{executive.result}</div></div><span className="rounded-full border border-current/20 bg-white/60 px-3 py-1 text-sm font-bold">{executive.classification}</span></div><div className="mt-3 text-sm font-medium">Tendencia: {executive.trend}{executive.delta !== null ? ` (${executive.delta > 0 ? '+' : ''}${executive.delta})` : ''}</div></div>
          <dl className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-slate-200 p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Qué explica el resultado</dt><dd className="mt-2 text-sm text-slate-900">{executive.cause}</dd></div><div className="rounded-lg border border-slate-200 p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Impacto para el negocio</dt><dd className="mt-2 text-sm text-slate-900">{executive.impact}</dd></div><div className="rounded-lg border border-slate-200 p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Recomendación</dt><dd className="mt-2 text-sm text-slate-900">{executive.recommendation}</dd></div><div className="rounded-lg border border-slate-200 p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Responsable y plazo</dt><dd className="mt-2 text-sm text-slate-900">{executive.owner} · {executive.targetDate}</dd></div></dl>
          <div className="flex flex-wrap gap-2"><Link href={executive.actionRoute} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">{executive.actionLabel}</Link>{executive.canCreatePlan && <Link href={planHref} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Crear plan de acción</Link>}</div>
          <details className="rounded-lg border border-slate-200"><summary className="cursor-pointer p-4 text-sm font-semibold">Ver variables y detalle técnico</summary><div className="border-t border-slate-200 p-4">{Object.keys(variables).length ? <div className="max-h-64 overflow-auto rounded-md border border-slate-200"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-50"><tr><th className="px-3 py-2 text-left">Variable</th><th className="px-3 py-2 text-left">Valor</th></tr></thead><tbody>{Object.entries(variables).map(([key, value]) => <tr key={key} className="border-t"><td className="px-3 py-2 font-semibold">{key}</td><td className="px-3 py-2">{display(value)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">La ejecución no reportó variables visibles.</p>}</div></details>
        </div>}
        {!loading && !error && data && kind === 'lineage' && <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-slate-200 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Registros utilizados</div><div className="mt-1 text-2xl font-bold">{lineage.length}</div></div><div className="rounded-lg border border-slate-200 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Fuentes físicas</div><div className="mt-1 text-sm font-semibold">{sources.join(', ') || 'No informadas'}</div></div><div className="rounded-lg border border-slate-200 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Contrato</div><div className="mt-1 text-sm font-semibold">{contracts.join(', ') || 'No informado'}</div></div><div className="rounded-lg border border-slate-200 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Snapshot</div><div className="mt-1 break-all text-xs font-semibold">{snapshots[0] ? `${snapshots[0].slice(0, 18)}…` : 'No informado'}</div></div></div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">La trazabilidad permite demostrar qué registros, fuente, contrato y versión de fórmula originaron el resultado. El detalle completo se mantiene disponible para auditoría, pero no es necesario para la supervisión diaria.</div>
          <button type="button" onClick={() => setShowTechnical((current) => !current)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">{showTechnical ? 'Ocultar detalle técnico' : `Ver detalle técnico (${lineage.length} registros)`}</button>
          {showTechnical && (lineage.length ? <div className="max-h-[42vh] overflow-auto rounded-md border border-slate-200"><table className="min-w-[900px] w-full text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="px-3 py-2 text-left">Fuente física</th><th className="px-3 py-2 text-left">Contrato</th><th className="px-3 py-2 text-left">Registro</th><th className="px-3 py-2 text-left">Versión</th><th className="px-3 py-2 text-left">Snapshot</th></tr></thead><tbody>{lineage.map((row, index) => <tr key={index} className="border-t"><td className="px-3 py-2 font-semibold">{display(row.physical_source)}</td><td className="px-3 py-2">{display(row.source_contract)}</td><td className="px-3 py-2 break-all">{display(row.source_record)}</td><td className="px-3 py-2">{display(row.formula_version)}</td><td className="px-3 py-2 break-all">{display(row.dataset_snapshot)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">La ejecución no contiene lineage visible.</p>)}
        </div>}
      </div>
    </section>
  </div>;
}

export default function OfficialEvidenceDialog({ open, kind, runId, formulaName, onClose }: Props) { if (!open || !runId) return null; return <EvidenceLoader key={`${kind}-${runId}`} kind={kind} runId={runId} formulaName={formulaName} onClose={onClose} />; }
