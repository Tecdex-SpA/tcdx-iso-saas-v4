'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import OfficialEvidenceDialog, { type EvidenceKind } from './OfficialEvidenceDialog';
import { ApiClientError, apiRequestJson, apiRequestJsonSingleFlight, getActiveTenantId } from '@/utils/apiClient';
import { getUserRoleFromToken } from '@/utils/auth';

type UnknownRecord = Record<string, unknown>;
type Decision = {
  result?: { value?: number | null; unit?: string; display?: string };
  interpretation?: { code?: string; label?: string; severity?: 'green'|'amber'|'red'|'blue'|'gray'; direction?: string };
  cause?: string;
  impact?: string;
  recommendation?: string;
  action?: { route?: string; label?: string; can_create_plan?: boolean };
  data_quality?: { received?: number; usable?: number; excluded?: number; coverage_pct?: number | null; physical_sources?: string[] };
  trend?: { previous_value?: number | null; delta?: number | null; direction?: string; label?: string };
  owner?: string | null;
  target_date?: string | null;
};
type CatalogItem = { result_code: string; analytical_result_code: string; display_name: string; domain: string; formula_code: string; formula_version: number; unit: string; source_status: string; trust_status: string; latest_calculation_run: string; latest_snapshot: string };
type RecalculationStatus = 'calculated'|'unmeasured'|'source_unavailable'|'not_applicable'|'failed'|'dependency_pending'|'source_incompatible';
type RecalculationResult = { formula_code: string; display_name: string; domain: string; status: RecalculationStatus; source_contract_status: string; source_resolution_status: string; source_code: string; physical_sources: string[]; source_counts: { received: number; usable: number; excluded: number }; value: number|null; unit: string; calculation_run_id: string; snapshot_id: string; warnings: string[]; error: string; message: string; failure_type: string; failure_label: string; decision?: Decision };
type RecalculationPayload = { status: string; period: { start: string|null; end: string|null; timezone: string }; summary: Record<string, number>; results: RecalculationResult[] };
type EvidenceState = { kind: EvidenceKind; runId: string; formulaName: string } | null;

const PLATFORM_ROLES = new Set(['superadmin','super_admin','platform_admin','admin_global','global_admin','owner']);
const PAGE_SIZE = 10;
function isRecord(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function stringValue(value: unknown, fallback = '') { if (typeof value === 'string') return value.trim() || fallback; if (typeof value === 'number' || typeof value === 'boolean') return String(value); return fallback; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : []; }
function objectId(value: unknown) { if (typeof value === 'string') return value; if (!isRecord(value)) return ''; return stringValue(value.run_id || value.id || value.calculation_run_id || value.snapshot_id); }
function unwrapData(payload: unknown) { return isRecord(payload) && 'data' in payload ? payload.data : payload; }
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

function normalizeDecision(value: unknown): Decision | undefined {
  if (!isRecord(value)) return undefined;
  const result = isRecord(value.result) ? value.result : {};
  const interpretation = isRecord(value.interpretation) ? value.interpretation : {};
  const action = isRecord(value.action) ? value.action : {};
  const dataQuality = isRecord(value.data_quality) ? value.data_quality : {};
  const trend = isRecord(value.trend) ? value.trend : {};
  return {
    result: { value: nullableNumber(result.value), unit: stringValue(result.unit), display: stringValue(result.display) },
    interpretation: { code: stringValue(interpretation.code), label: stringValue(interpretation.label), severity: stringValue(interpretation.severity, 'gray') as Decision['interpretation'] extends infer T ? T extends {severity?: infer S} ? S : never : never, direction: stringValue(interpretation.direction) },
    cause: stringValue(value.cause), impact: stringValue(value.impact), recommendation: stringValue(value.recommendation),
    action: { route: stringValue(action.route, '/dashboard'), label: stringValue(action.label, 'Abrir detalle'), can_create_plan: Boolean(action.can_create_plan) },
    data_quality: { received: numberValue(dataQuality.received), usable: numberValue(dataQuality.usable), excluded: numberValue(dataQuality.excluded), coverage_pct: nullableNumber(dataQuality.coverage_pct), physical_sources: stringArray(dataQuality.physical_sources) },
    trend: { previous_value: nullableNumber(trend.previous_value), delta: nullableNumber(trend.delta), direction: stringValue(trend.direction, 'unknown'), label: stringValue(trend.label, 'Sin período comparable') },
    owner: stringValue(value.owner) || null, target_date: stringValue(value.target_date) || null,
  };
}

function normalizeCatalog(payload: unknown): CatalogItem[] {
  const data = unwrapData(payload);
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord).map((item) => ({ result_code: stringValue(item.result_code), analytical_result_code: stringValue(item.analytical_result_code), display_name: stringValue(item.display_name), domain: stringValue(item.domain, 'general'), formula_code: stringValue(item.formula_code), formula_version: numberValue(item.formula_version, 1), unit: stringValue(item.unit, 'sin unidad'), source_status: stringValue(item.source_status, 'unknown'), trust_status: stringValue(item.trust_status, 'unknown'), latest_calculation_run: objectId(item.latest_calculation_run), latest_snapshot: objectId(item.latest_snapshot) }));
}

function normalizeRecalculation(payload: unknown): RecalculationPayload | null {
  const data = unwrapData(payload); if (!isRecord(data)) return null;
  const rawSummary = isRecord(data.summary) ? data.summary : {}; const rawPeriod = isRecord(data.period) ? data.period : {}; const rawResults = Array.isArray(data.results) ? data.results : [];
  return { status: stringValue(data.status, 'completed'), period: { start: stringValue(rawPeriod.start) || null, end: stringValue(rawPeriod.end) || null, timezone: stringValue(rawPeriod.timezone, 'America/Santiago') }, summary: Object.fromEntries(Object.entries(rawSummary).filter(([,value]) => typeof value === 'number' || typeof value === 'string').map(([key,value]) => [key, numberValue(value)])), results: rawResults.filter(isRecord).map((item) => { const counts = isRecord(item.source_counts) ? item.source_counts : {}; return { formula_code: stringValue(item.formula_code), display_name: stringValue(item.display_name), domain: stringValue(item.domain, 'general'), status: stringValue(item.status, 'failed') as RecalculationStatus, source_contract_status: stringValue(item.source_contract_status || item.source_status, 'unknown'), source_resolution_status: stringValue(item.source_resolution_status, stringArray(item.physical_sources).length ? 'resolved' : 'not_resolved'), source_code: stringValue(item.source_code), physical_sources: stringArray(item.physical_sources), source_counts: { received: numberValue(counts.received), usable: numberValue(counts.usable), excluded: numberValue(counts.excluded) }, value: nullableNumber(item.value), unit: stringValue(item.unit), calculation_run_id: objectId(item.calculation_run_id), snapshot_id: objectId(item.snapshot_id), warnings: stringArray(item.warnings), error: stringValue(item.error), message: stringValue(item.message), failure_type: stringValue(item.failure_type), failure_label: stringValue(item.failure_label), decision: normalizeDecision(item.decision) }; }) };
}

function statusLabel(value?: string) { const labels: Record<string,string> = { available:'Configurado', resolved:'Resuelta', not_resolved:'No resuelta', trusted:'Confiable', source_unavailable:'Sin fuente', calculated:'Calculada', unmeasured:'Datos insuficientes', not_applicable:'No aplicable', failed:'Error técnico', dependency_pending:'Dependencia pendiente', source_incompatible:'Fuente incompatible', unknown:'Pendiente' }; return labels[String(value || 'unknown')] || String(value || 'Pendiente'); }
function statusTone(value?: string) { const status = String(value || '').toLowerCase(); if (['calculated','trusted','resolved'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-950'; if (['failed','technical_error'].includes(status)) return 'border-red-200 bg-red-50 text-red-950'; if (['unmeasured','source_unavailable','not_applicable','not_resolved','dependency_pending','source_incompatible'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-950'; return 'border-slate-200 bg-slate-50 text-slate-700'; }
function severityTone(value?: string) { if (value === 'red') return 'border-red-200 bg-red-50 text-red-950'; if (value === 'amber') return 'border-amber-200 bg-amber-50 text-amber-950'; if (value === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-950'; if (value === 'blue') return 'border-blue-200 bg-blue-50 text-blue-950'; return 'border-slate-200 bg-slate-50 text-slate-800'; }

function DecisionBlock({ result }: { result: RecalculationResult }) {
  const decision = result.decision;
  if (!decision) return <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">Este resultado todavía no dispone de interpretación ejecutiva.</div>;
  const actionRoute = decision.action?.route || '/dashboard';
  const planHref = `/planes-accion?source=official_metric&formula=${encodeURIComponent(result.formula_code)}&run=${encodeURIComponent(result.calculation_run_id)}&suggested=1`;
  const cards: Array<[string,string]> = [
    ['Resultado', decision.result?.display || `${result.value ?? '—'} ${result.unit}`],
    ['Interpretación', decision.interpretation?.label || 'Sin clasificación'],
    ['Causa', decision.cause || 'Sin causa disponible'],
    ['Impacto', decision.impact || 'Sin impacto documentado'],
    ['Recomendación', decision.recommendation || 'Revisar el detalle operacional'],
    ['Responsable', decision.owner || 'Por asignar'],
    ['Fecha objetivo', decision.target_date || 'Por definir'],
    ['Tendencia', `${decision.trend?.label || 'Sin comparación'}${decision.trend?.delta !== null && decision.trend?.delta !== undefined ? ` (${decision.trend.delta > 0 ? '+' : ''}${decision.trend.delta})` : ''}`],
  ];
  return <div className={`rounded-xl border p-4 ${severityTone(decision.interpretation?.severity)}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide">Decisión GRC</p><h3 className="mt-1 text-lg font-semibold">{result.display_name}</h3></div><span className="rounded-full border border-current/20 bg-white/60 px-3 py-1 text-xs font-bold">{decision.interpretation?.label || 'Sin clasificación'}</span></div>
    <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value]) => <div key={label} className="rounded-md border border-current/10 bg-white/70 p-3"><dt className="text-xs font-semibold uppercase opacity-70">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
    <div className="mt-4 flex flex-wrap gap-2"><Link href={actionRoute} className="rounded-md border border-current/20 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{decision.action?.label || 'Abrir registros'}</Link>{decision.action?.can_create_plan && <Link href={planHref} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Crear plan de acción</Link>}</div>
  </div>;
}

export default function FormulaCatalog() {
  const router = useRouter();
  const now = new Date(); const yearStart = new Date(now.getFullYear(), 0, 1); const role = getUserRoleFromToken(); const isPlatform = PLATFORM_ROLES.has(role); const tenantReady = !isPlatform || Boolean(getActiveTenantId());
  const { loading: entitlementsLoading, entitlements } = useTenantEntitlements(); const engineDecision = entitlements.capabilities['metrics.engine']; const engineAllowed = !engineDecision || (engineDecision.enabled === true && engineDecision.read_only !== true);
  const [start,setStart] = useState(isoDate(yearStart)); const [end,setEnd] = useState(isoDate(now)); const [domain,setDomain] = useState(''); const [catalog,setCatalog] = useState<CatalogItem[]>([]); const [lastRun,setLastRun] = useState<RecalculationPayload|null>(null); const [loading,setLoading] = useState(true); const [running,setRunning] = useState(false); const [error,setError] = useState<string|null>(null); const [evidence,setEvidence] = useState<EvidenceState>(null); const [query,setQuery] = useState(''); const [statusFilter,setStatusFilter] = useState(''); const [page,setPage] = useState(1); const [selectedDecision,setSelectedDecision] = useState<string>('');

  const loadCatalog = useCallback(async () => { setLoading(true); setError(null); try { setCatalog(normalizeCatalog(await apiRequestJsonSingleFlight('/api/grc/official/analytics/catalog', { fallbackMessage:'No fue posible cargar las fórmulas oficiales.' }))); } catch (err) { setCatalog([]); setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar las fórmulas oficiales.'); } finally { setLoading(false); } }, []);
  useEffect(() => { if (tenantReady) void loadCatalog(); else { setCatalog([]); setLoading(false); setError('Selecciona una empresa para cargar el catálogo y habilitar el recálculo.'); } }, [loadCatalog, tenantReady]);
  const domains = useMemo(() => Array.from(new Set(catalog.map((item) => item.domain).filter(Boolean))).sort(), [catalog]);
  const runMap = useMemo(() => new Map((lastRun?.results || []).map((item) => [item.formula_code,item])), [lastRun]);
  const filtered = useMemo(() => catalog.filter((item) => { const code=item.formula_code||item.result_code||item.analytical_result_code||''; const result=runMap.get(code); if (domain && item.domain !== domain) return false; if (statusFilter && (result?.status || 'pending') !== statusFilter) return false; const haystack=`${item.display_name} ${code} ${item.domain}`.toLowerCase(); return !query.trim() || haystack.includes(query.trim().toLowerCase()); }), [catalog,domain,query,runMap,statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(() => filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE), [filtered,page]);
  useEffect(() => { setPage(1); }, [domain,query,statusFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page,totalPages]);
  const selectedResult = selectedDecision ? runMap.get(selectedDecision) : undefined;
  const priorities = useMemo(() => (lastRun?.results || []).filter((item) => ['red','amber'].includes(item.decision?.interpretation?.severity || '')).slice(0,5), [lastRun]);

  async function recalculate() {
    if (!tenantReady) return setError('Selecciona una empresa antes de recalcular.');
    if (!engineAllowed) return setError('La capacidad metrics.engine no está habilitada para esta empresa o está en modo solo lectura.');
    setRunning(true); setError(null); setSelectedDecision('');
    try { const normalized = normalizeRecalculation(await apiRequestJson('/api/grc/official/recalculate', { method:'POST', body:JSON.stringify({ domain:domain || undefined, period:{ start:start ? `${start}T00:00:00.000Z` : null, end:end ? `${end}T23:59:59.999Z` : null, timezone:'America/Santiago' } }), fallbackMessage:'No fue posible recalcular las fórmulas con los datos existentes.' })); if (!normalized) throw new Error('El backend no devolvió un resumen válido de recálculo.'); setLastRun(normalized); await loadCatalog(); } catch (err) { setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible recalcular las fórmulas.'); } finally { setRunning(false); }
  }

  const disabled = running || loading || entitlementsLoading || !tenantReady || !engineAllowed;
  return <section id="catalogo-formulas" className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Centro de decisiones GRC</p><h2 className="mt-1 text-2xl font-semibold text-[var(--tcdx-color-text-ink)]">Indicadores oficiales, interpretación y acción</h2><p className="mt-2 max-w-4xl text-sm text-[var(--tcdx-color-text-secondary)]">Cada cálculo distingue contrato, fuente, calidad de datos, resultado, tendencia, impacto y acción recomendada. Los estados sin datos no se convierten en cero.</p></div>
    <div className="mt-5 grid gap-3 rounded-lg border border-[var(--tcdx-color-border)] bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="text-sm font-semibold">Desde<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
      <label className="text-sm font-semibold">Hasta<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
      <label className="text-sm font-semibold">Dominio<select value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">Todos los dominios</option>{domains.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" onClick={recalculate} disabled={disabled} className="min-h-11 self-end rounded-md border border-orange-700 bg-orange-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none">{running ? 'Calculando…' : 'Recalcular desde datos existentes'}</button>
    </div>
    {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
    {lastRun && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{[['Calculadas',lastRun.summary.calculated||0],['Datos insuficientes',lastRun.summary.unmeasured||0],['Dependencias',lastRun.summary.dependency_pending||0],['Fuente incompatible',lastRun.summary.source_incompatible||0],['Sin fuente',lastRun.summary.source_unavailable||0],['No aplicables',lastRun.summary.not_applicable||0],['Errores técnicos',lastRun.summary.failed||0]].map(([label,value]) => <div key={String(label)} className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-600">{label}</div><div className="mt-1 text-2xl font-semibold">{Number(value)}</div></div>)}</div>}
    {priorities.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-amber-950">Prioridades para decisión</h3><p className="text-sm text-amber-900">Indicadores que requieren seguimiento o tratamiento.</p></div><button type="button" onClick={() => router.push('/planes-accion')} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950">Abrir planes de acción</button></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{priorities.map((item) => <button key={item.formula_code} type="button" onClick={() => setSelectedDecision(item.formula_code)} className="rounded-md border border-amber-200 bg-white p-3 text-left"><div className="font-semibold">{item.display_name}</div><div className="mt-1 text-sm">{item.decision?.interpretation?.label} · {item.decision?.recommendation}</div></button>)}</div></div>}
    {selectedResult && <div className="mt-5"><DecisionBlock result={selectedResult} /></div>}
    <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_220px_auto]">
      <label className="text-sm font-semibold">Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código o dominio" className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal" /></label>
      <label className="text-sm font-semibold">Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">Todos</option><option value="calculated">Calculadas</option><option value="unmeasured">Datos insuficientes</option><option value="dependency_pending">Dependencia pendiente</option><option value="source_incompatible">Fuente incompatible</option><option value="source_unavailable">Sin fuente</option><option value="failed">Error técnico</option></select></label>
      <div className="self-end text-sm text-slate-600">{filtered.length} indicadores</div>
    </div>
    {loading ? <div className="mt-5 rounded-md border border-dashed p-4 text-sm">Cargando indicadores oficiales…</div> : <div className="mt-5 max-h-[620px] overflow-auto rounded-lg border border-slate-200"><table className="min-w-[1120px] w-full text-sm"><thead className="sticky top-0 z-10 bg-slate-100"><tr className="text-left text-xs uppercase text-slate-600"><th className="border-b px-3 py-3">Indicador</th><th className="border-b px-3 py-3">Dominio</th><th className="border-b px-3 py-3">Contrato</th><th className="border-b px-3 py-3">Fuente y datos</th><th className="border-b px-3 py-3">Ejecución</th><th className="border-b px-3 py-3">Decisión</th><th className="border-b px-3 py-3">Evidencia</th></tr></thead><tbody>{visible.map((item) => { const code=item.formula_code||item.result_code||item.analytical_result_code||'unknown'; const result=runMap.get(code); const runId=result?.calculation_run_id||item.latest_calculation_run; const name=item.display_name||code; const resolution=result?.source_resolution_status||'not_resolved'; const hasValidValue=result?.status==='calculated'&&result.value!==null; return <tr key={`${code}-${item.result_code}`} className="align-top"><td className="border-b px-3 py-3"><div className="font-semibold">{name}</div><div className="text-xs text-slate-500">{code} · v{item.formula_version}</div></td><td className="border-b px-3 py-3">{item.domain}</td><td className="border-b px-3 py-3"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{statusLabel(result?.source_contract_status||item.source_status)}</span></td><td className="border-b px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(resolution)}`}>{statusLabel(resolution)}</span><div className="mt-2 text-xs text-slate-600">{result?.physical_sources.length ? result.physical_sources.join(', ') : 'Sin tabla física resuelta'}</div><div className="mt-1 text-xs text-slate-600">Recibidos: {result?.source_counts.received||0} · Usables: {result?.source_counts.usable||0} · Excluidos: {result?.source_counts.excluded||0}</div></td><td className="border-b px-3 py-3">{result ? <div><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(result.status)}`}>{statusLabel(result.status)}</span>{hasValidValue&&<div className="mt-1 font-semibold">{result.value} {result.unit}</div>}{(result.message||result.error||result.warnings[0])&&<div className="mt-1 max-w-sm text-xs text-slate-600">{result.message||result.error||result.warnings[0]}</div>}</div> : <span className="text-slate-500">Pendiente de recálculo</span>}</td><td className="border-b px-3 py-3">{result?.decision ? <button type="button" onClick={() => setSelectedDecision(code)} className={`rounded-md border px-3 py-2 text-xs font-semibold ${severityTone(result.decision.interpretation?.severity)}`}>{result.decision.interpretation?.label || 'Ver decisión'}</button> : <span className="text-xs text-slate-500">Sin interpretación</span>}</td><td className="border-b px-3 py-3">{runId ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEvidence({kind:'explanation',runId,formulaName:name})} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50">Explicación</button><button type="button" onClick={() => setEvidence({kind:'lineage',runId,formulaName:name})} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50">Lineage</button></div> : <span className="text-xs text-slate-500">Sin ejecución</span>}</td></tr>; })}</tbody></table></div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={() => setPage((current)=>Math.max(1,current-1))} className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">Anterior</button><button type="button" disabled={page>=totalPages} onClick={() => setPage((current)=>Math.min(totalPages,current+1))} className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">Siguiente</button></div></div>
    <OfficialEvidenceDialog open={Boolean(evidence)} kind={evidence?.kind||'explanation'} runId={evidence?.runId||''} formulaName={evidence?.formulaName||''} onClose={() => setEvidence(null)} />
  </section>;
}
