'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClientError, apiRequestJson, apiRequestJsonSingleFlight } from '@/utils/apiClient';
import { getUserRoleFromToken } from '@/utils/auth';
import { ActionableEmptyState, DataTrustIndicator, ResponsiveChartFrame, UniversalStateBadge, UniversalStateBlock, type UniversalDataState } from '@/components/ui/enterprise';
import { presentationLabel } from '@/utils/presentationLabels';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

type UnknownRecord = Record<string, unknown>;
type Definition = { id:string;code:string;name:string;definition:string;domain:string;objective:string;unit:string;direction:string;frequency:string;population:string;version:number;status:string };
type ActionableComponent = { component:string;label?:string;reason?:string|null;rule?:string|null;route_to_fix?:string|null;required_capability?:string|null;action?:string|null };
type ActionableState = { state:string;label?:string;why?:string;missing_components?:ActionableComponent[];route_to_fix?:string|null;required_capability?:string|null;expected_after_resolution?:string|null };
type Snapshot = { snapshot_id:string;period?:{key?:string;start?:string;end?:string};effective_at?:string;value:number|null;unit?:string;state:string;target?:number|null;coverage?:number|null;trust?:{score?:number|null;status?:string;dimensions?:Record<string, { score?:number|null;status?:string;rule?:string|null;warnings?:string[];evidence?:unknown }>};freshness?:{status?:string};sufficiency?:{status?:string};actionable_state?:ActionableState|null;interpretation?:{classification?:{label?:string;positive?:boolean};trend?:string;cause?:string|null;impact?:string|null;recommendation?:string|null;proposed_action?:string|null};updated_at?:string;checksum?:string };
type CatalogItem = { definition:Definition;latest_snapshot:Snapshot|null };
type Comparison = { id?:string;comparison_type?:string;status?:string;absolute_change?:number|null;percentage_change?:number|null;methodology_compatible?:boolean;compatibility_reason?:string|null;created_at?:string };

const ADMIN_ROLES=new Set(['admin','tenant_admin','superadmin','super_admin','platform_admin','admin_global','global_admin','owner','data_steward']);
const TECHNICAL_ROLES=new Set([...ADMIN_ROLES,'auditor']);
function record(value:unknown):UnknownRecord{return typeof value==='object'&&value!==null&&!Array.isArray(value)?value as UnknownRecord:{}}
function data<T>(payload:unknown):T{const root=record(payload);return (root.data??payload) as T}
function formatValue(snapshot:Snapshot|null){if(!snapshot)return 'Sin datos';if(snapshot.state!=='calculated')return universalSnapshotLabel(snapshot);if(snapshot.value===null)return 'No calculable';return `${new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(snapshot.value)}${snapshot.unit==='%'?' %':snapshot.unit?` ${snapshot.unit}`:''}`}
function pct(value:number|null|undefined){return value===null||value===undefined?'Desconocida':`${Math.round(value*(value<=1?100:1)*100)/100}%`}
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatSnapshotPeriod(snapshot: Snapshot, index: number) {
  const raw =
    snapshot.period?.key ||
    snapshot.period?.end ||
    snapshot.period?.start ||
    snapshot.effective_at ||
    snapshot.updated_at;
  if (!raw) return `Snapshot ${index + 1}`;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
  }
  return String(raw);
}

function buildSnapshotTrend(history: Snapshot[]) {
  return history
    .map((snapshot, index) => ({
      name: formatSnapshotPeriod(snapshot, index),
      value: snapshot.state === 'calculated' ? numberOrNull(snapshot.value) : null,
      unit: snapshot.unit || '',
      snapshotId: snapshot.snapshot_id,
    }))
    .filter(
      (point): point is { name: string; value: number; unit: string; snapshotId: string } =>
        point.value !== null
    );
}

function formatChartValue(value: unknown, unit?: string) {
  const n = numberOrNull(value);
  if (n === null) return 'Sin dato';
  const formatted = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);
  if (unit === '%') return `${formatted}%`;
  return unit ? `${formatted} ${unit}` : formatted;
}
function universalSnapshotState(snapshot: Snapshot | null): UniversalDataState { if(!snapshot)return'empty';const state=String(snapshot.state||'').toLowerCase();const freshness=String(snapshot.freshness?.status||'').toLowerCase();if(state==='calculated'&&snapshot.value===0)return'zero';if(state==='calculated')return'measured';if(['failed','error','technical_error'].includes(state))return'error';if(['dependency_pending','not_applicable','source_incompatible'].includes(state))return'not_calculable';if(state==='source_unavailable')return'not_available';if(state==='partial')return'partial';if(['unmeasured','insufficient','insufficient_data'].includes(state))return'insufficient';if(['stale','expired'].includes(freshness))return'stale';return'not_available'}
function universalSnapshotLabel(snapshot: Snapshot | null){const state=universalSnapshotState(snapshot);const labels:Record<UniversalDataState,string>={measured:'Con medición',zero:'0',empty:'Sin datos',insufficient:'Datos insuficientes',not_calculable:'No calculable',not_available:'No disponible',error:'Error',stale:'Desactualizado',partial:'Datos parciales',loading:'Cargando'};return labels[state]}
function actionRoute(component:string){const routes:Record<string,string>={lineage:'/datos/lineage',stability:'/metricas',dataTrust:'/metricas',risk:'/riesgos',compliance:'/cumplimiento-auditoria',actions:'/planes-accion',evidence:'/evidencias'};return routes[component]||null}
function componentLabel(component:string){const labels:Record<string,string>={completeness:'Completitud',accuracy:'Exactitud',consistency:'Consistencia',freshness:'Vigencia',lineage:'Lineage',validation:'Validación',stability:'Estabilidad',coverage:'Cobertura',dataTrust:'Confianza del dato',risk:'Riesgo residual',compliance:'Cumplimiento',actions:'Planes de acción',evidence:'Evidencia vigente'};return labels[component]||presentationLabel(component)}
function fallbackActionable(snapshot:Snapshot|null):ActionableState|null{if(!snapshot)return{state:'no_snapshot',label:'Sin snapshot oficial',why:'Aún no existe snapshot oficial publicado para este indicador.',missing_components:[],route_to_fix:'/metricas',required_capability:'metrics.jobs.run',expected_after_resolution:'Recalcular el indicador desde el pipeline oficial.'};if(snapshot.state==='calculated')return null;const dimensions=snapshot.trust?.dimensions||{};const missing=Object.entries(dimensions).filter(([,value])=>value?.score===null||value?.score===undefined||value?.status==='unknown').map(([component,value])=>({component,label:componentLabel(component),reason:value?.warnings?.[0]||value?.rule||'Componente requerido sin evidencia suficiente.',rule:value?.rule||null,route_to_fix:actionRoute(component),required_capability:component==='lineage'?'data.lineage':component==='stability'?'metrics.jobs.run':'metrics.data_trust',action:component==='lineage'?'Completar trazabilidad de fuente':component==='stability'?'Acumular historia oficial comparable':'Revisar calidad de datos'}));return{state:snapshot.state,label:'No calculable',why:snapshot.state==='dependency_pending'?'El indicador depende de otro resultado oficial que aún no es calculable.':'La fórmula oficial no tiene todos los componentes verificables requeridos.',missing_components:missing,route_to_fix:missing[0]?.route_to_fix||'/metricas',required_capability:missing[0]?.required_capability||'metrics.indicators.read',expected_after_resolution:'Recalcular desde el pipeline oficial una vez completada la evidencia.'}}
function actionable(snapshot:Snapshot|null){return snapshot?.actionable_state||fallbackActionable(snapshot)}

export default function FunctionalIndicatorCatalog({ metricCode }: { metricCode?:string }){
  const role=getUserRoleFromToken();const canOperate=ADMIN_ROLES.has(role);const canTechnical=TECHNICAL_ROLES.has(role);
  const [items,setItems]=useState<CatalogItem[]>([]);const [selected,setSelected]=useState<CatalogItem|null>(null);const [technical,setTechnical]=useState<UnknownRecord|null>(null);const [history,setHistory]=useState<Snapshot[]>([]);const [comparisons,setComparisons]=useState<Comparison[]>([]);const [draftSnapshotId,setDraftSnapshotId]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState('');const [error,setError]=useState('');const [search,setSearch]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{if(metricCode){const encoded=encodeURIComponent(metricCode);const [itemPayload,historyPayload,comparisonPayload]=await Promise.all([apiRequestJsonSingleFlight(`/api/metrics/official/${encoded}`,{fallbackMessage:'No fue posible cargar el indicador oficial.'}),apiRequestJsonSingleFlight(`/api/metrics/official/${encoded}/history?limit=24`,{fallbackMessage:'No fue posible cargar el historial oficial.'}),apiRequestJsonSingleFlight(`/api/metrics/official/${encoded}/comparisons?limit=24`,{fallbackMessage:'No fue posible cargar las comparaciones.'})]);const item=data<CatalogItem>(itemPayload);setItems([item]);setSelected(item);const historic=data<Snapshot[]>(historyPayload);const compared=data<Comparison[]>(comparisonPayload);setHistory(Array.isArray(historic)?historic:[]);setComparisons(Array.isArray(compared)?compared:[]);}else{const rows=data<CatalogItem[]>(await apiRequestJsonSingleFlight('/api/metrics/official/catalog',{fallbackMessage:'No fue posible cargar el catálogo funcional.'}));setItems(Array.isArray(rows)?rows:[]);}}catch(err){setError(err instanceof ApiClientError||err instanceof Error?err.message:'No fue posible cargar indicadores.');}finally{setLoading(false)}},[metricCode]);
  useEffect(()=>{void load()},[load]);
  const visible=useMemo(()=>items.filter((item)=>!search.trim()||`${item.definition.name} ${item.definition.definition} ${item.definition.domain}`.toLowerCase().includes(search.trim().toLowerCase())),[items,search]);
  async function operate(kind:'calculate'|'snapshot'|'publish'|'proposal'){
    if(!selected)return;setBusy(kind);setError('');try{
      if(kind==='calculate'){const now=new Date();const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));await apiRequestJson(`/api/metrics/official/${encodeURIComponent(selected.definition.code)}/calculate`,{method:'POST',body:JSON.stringify({period:{key:now.toISOString().slice(0,7),start:start.toISOString(),end:now.toISOString(),timezone:'America/Santiago'}}),fallbackMessage:'No fue posible calcular el indicador.'});}
      if(kind==='snapshot'){const created=data<{snapshot?:{snapshot_id?:string}}>(await apiRequestJson(`/api/metrics/official/${encodeURIComponent(selected.definition.code)}/snapshots`,{method:'POST',body:'{}',fallbackMessage:'No fue posible crear el snapshot.'}));setDraftSnapshotId(String(created.snapshot?.snapshot_id||''));}
      if(kind==='publish'&&draftSnapshotId){await apiRequestJson(`/api/metrics/official/snapshots/${encodeURIComponent(draftSnapshotId)}/publish`,{method:'POST',body:'{}',fallbackMessage:'No fue posible publicar el snapshot.'});setDraftSnapshotId('');}
      if(kind==='proposal'&&selected.latest_snapshot)await apiRequestJson(`/api/metrics/official/snapshots/${selected.latest_snapshot.snapshot_id}/proposals`,{method:'POST',body:JSON.stringify({title:`Revisar ${selected.definition.name}`,rationale:selected.latest_snapshot.interpretation?.recommendation||'El resultado oficial requiere revisión.',priority:'attention'}),fallbackMessage:'No fue posible registrar la propuesta.'});
      await load();
    }catch(err){setError(err instanceof ApiClientError||err instanceof Error?err.message:'No fue posible completar la operación.');}finally{setBusy('')}
  }
  async function loadTechnical(){if(!selected||!canTechnical)return;setBusy('technical');setError('');try{const payload=data<UnknownRecord>(await apiRequestJson(`/api/metrics/official/${encodeURIComponent(selected.definition.code)}/technical`,{fallbackMessage:'No fue posible cargar el detalle técnico.'}));setTechnical(record(payload.technical));}catch(err){setError(err instanceof ApiClientError||err instanceof Error?err.message:'No fue posible cargar el detalle técnico.');}finally{setBusy('')}}
  if(loading)return <UniversalStateBlock state="loading" title="Cargando indicadores oficiales" />;
  return <div className="space-y-5">
    {error&&<UniversalStateBlock state="error" title="Error cargando indicadores oficiales" description={error} />}
    {!metricCode&&<label className="block text-sm font-semibold text-slate-800">Buscar concepto<input value={search} onChange={(event)=>setSearch(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Cumplimiento, riesgo, evidencia…" /></label>}
    {!metricCode&&<div className="grid gap-4 lg:grid-cols-2">{visible.map((item)=>{const state=actionable(item.latest_snapshot);return <article key={item.definition.code} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-bold text-slate-950">{item.definition.name}</h2><UniversalStateBadge state={universalSnapshotState(item.latest_snapshot)} label={item.latest_snapshot?.interpretation?.classification?.label||undefined} /></div><div className="mt-3"><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</span><strong className="text-xl text-slate-950">{formatValue(item.latest_snapshot)}</strong></div><p className="mt-2 text-sm leading-6 text-slate-600">{state?.why||item.latest_snapshot?.interpretation?.cause||item.definition.definition}</p>{state?.missing_components?.[0]?.label&&<p className="mt-2 text-xs font-semibold text-amber-800">Falta: {state.missing_components[0].label}.</p>}<div className="mt-4 flex flex-wrap items-center gap-2"><Link href={`/metricas/${encodeURIComponent(item.definition.code)}`} className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Abrir indicador</Link>{state?.route_to_fix&&<Link href={state.route_to_fix} className="inline-flex min-h-10 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">Resolver origen</Link>}</div><details className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-slate-800">Detalle técnico</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2"><Field label="Dominio" value={presentationLabel(item.definition.domain)}/><Field label="Código" value={item.definition.code}/><Field label="Cobertura" value={pct(item.latest_snapshot?.coverage)}/><Field label="Dirección" value={presentationLabel(item.definition.direction)}/><Field label="Frecuencia" value={presentationLabel(item.definition.frequency)}/><div><dt className="text-xs text-slate-500">Data Trust</dt><dd className="mt-1"><DataTrustIndicator status={item.latest_snapshot?.trust?.status || null} confidence={item.latest_snapshot?.trust?.score ?? null} coverage={item.latest_snapshot?.coverage ?? null} freshness={item.latest_snapshot?.freshness?.status || null} label="Confianza del dato" /></dd></div></dl></details></article>})}</div>}
    {selected&&<article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{presentationLabel(selected.definition.domain)}</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{selected.definition.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selected.definition.definition}</p></div><UniversalStateBadge className="self-start" state={universalSnapshotState(selected.latest_snapshot)} label={selected.latest_snapshot?.interpretation?.classification?.label||undefined} /></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Resultado oficial" value={formatValue(selected.latest_snapshot)}/><Field label="Período" value={selected.latest_snapshot?.period?.key||'No disponible'}/><Field label="Cobertura" value={pct(selected.latest_snapshot?.coverage)}/><div><dt className="text-xs text-slate-500">Confianza del dato</dt><dd className="mt-1"><DataTrustIndicator status={selected.latest_snapshot?.trust?.status || null} confidence={selected.latest_snapshot?.trust?.score ?? null} coverage={selected.latest_snapshot?.coverage ?? null} freshness={selected.latest_snapshot?.freshness?.status || null} provenance={selected.latest_snapshot?.checksum ? <span className="break-all">Checksum: {selected.latest_snapshot.checksum}</span> : null} label="Confianza del dato" /></dd></div><Field label="Vigencia" value={presentationLabel(selected.latest_snapshot?.freshness?.status,'No disponible')}/><Field label="Suficiencia" value={presentationLabel(selected.latest_snapshot?.sufficiency?.status,'No disponible')}/><Field label="Tendencia" value={presentationLabel(selected.latest_snapshot?.interpretation?.trend,'No disponible')}/><Field label="Actualizado" value={selected.latest_snapshot?.updated_at?new Date(selected.latest_snapshot.updated_at).toLocaleString('es-CL'):'Sin evidencia'}/></dl>
      <section className="mt-6 grid gap-4 lg:grid-cols-3"><TextBlock title="Causa" value={selected.latest_snapshot?.interpretation?.cause}/><TextBlock title="Impacto" value={selected.latest_snapshot?.interpretation?.impact}/><TextBlock title="Recomendación" value={selected.latest_snapshot?.interpretation?.recommendation}/></section>
      <ActionableStatePanel state={actionable(selected.latest_snapshot)} />
      {metricCode&&<OfficialSnapshotTrend history={history} comparisons={comparisons} title={selected.definition.name} unit={selected.latest_snapshot?.unit||selected.definition.unit}/>}
      {canOperate&&<div className="mt-6 flex flex-wrap gap-2"><Action disabled={Boolean(busy)} onClick={()=>operate('calculate')}>{busy==='calculate'?'Calculando…':'Calcular desde fuentes'}</Action><Action disabled={Boolean(busy)} onClick={()=>operate('snapshot')}>{busy==='snapshot'?'Creando…':'Crear snapshot draft'}</Action>{draftSnapshotId&&<Action disabled={Boolean(busy)} onClick={()=>operate('publish')}>{busy==='publish'?'Publicando…':'Publicar snapshot revisado'}</Action>}{selected.latest_snapshot&&<Action disabled={Boolean(busy)} onClick={()=>operate('proposal')}>{busy==='proposal'?'Registrando…':'Proponer acción'}</Action>}</div>}
      {metricCode&&<section className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 p-4"><h2 className="font-bold text-slate-900">Historial oficial</h2>{history.length?<ol className="mt-3 space-y-2">{history.map((snapshot)=><li key={snapshot.snapshot_id} className="flex justify-between gap-3 text-sm"><span>{snapshot.period?.key||'Período sin etiqueta'}</span><strong>{formatValue(snapshot)}</strong></li>)}</ol>:<p className="mt-2 text-sm text-slate-600">Aún no hay snapshots publicados.</p>}</div><div className="rounded-lg border border-slate-200 p-4"><h2 className="font-bold text-slate-900">Comparabilidad metodológica</h2>{comparisons.length?<ol className="mt-3 space-y-2">{comparisons.map((comparison,index)=><li key={comparison.id||String(index)} className="text-sm"><strong>{comparison.methodology_compatible===false?'No comparable':comparison.status||'Comparable'}</strong><span className="block text-slate-600">{comparison.compatibility_reason||`Cambio absoluto: ${comparison.absolute_change??'desconocido'}`}</span></li>)}</ol>:<p className="mt-2 text-sm text-slate-600">Sin comparaciones publicadas.</p>}</div></section>}
      {canTechnical&&<details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4" onToggle={(event)=>{if(event.currentTarget.open&&!technical&&!busy)void loadTechnical()}}><summary className="cursor-pointer font-semibold text-slate-800">Detalle técnico autorizado</summary>{busy==='technical'?<p className="mt-3 text-sm text-slate-600">Cargando trazabilidad…</p>:technical?<TechnicalDetail value={technical}/>:<p className="mt-3 text-sm text-slate-600">Metodología, binding, versiones y lineage.</p>}</details>}
    </article>}
  </div>
}

function OfficialSnapshotTrend({
  history,
  comparisons,
  title,
  unit,
}: {
  history: Snapshot[];
  comparisons: Comparison[];
  title: string;
  unit?: string;
}) {
  const trend = buildSnapshotTrend(history);
  const incompatible = comparisons.find((comparison) => comparison.methodology_compatible === false);
  const summary =
    trend.length > 0
      ? `${trend[0].name} a ${trend[trend.length - 1].name}; ${trend.length} snapshots calculados.`
      : 'Sin puntos calculados.';

  return (
    <section
      aria-labelledby="official-snapshot-trend-title"
      className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="official-snapshot-trend-title" className="font-bold text-slate-900">
            Tendencia oficial publicada
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Se grafica sólo con snapshots oficiales calculados; ausencia o no calculable no se reemplaza por cero.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          Unidad: {unit || 'valor'}
        </span>
      </div>

      {incompatible ? (
        <UniversalStateBlock
          className="mt-4"
          state="partial"
          title="Histórico no comparable"
          description={
            incompatible.compatibility_reason ||
            'Existe una comparación metodológica marcada como no compatible para este indicador.'
          }
        />
      ) : trend.length < 2 ? (
        <UniversalStateBlock
          className="mt-4"
          state="insufficient"
          title="Datos insuficientes"
          description="Se requieren al menos dos snapshots oficiales calculados para mostrar tendencia."
        />
      ) : (
        <>
          <ResponsiveChartFrame
            ariaDescription={`Tendencia de ${title}. ${summary} Unidad: ${unit || 'valor'}.`}
            ariaLabel={`Tendencia oficial de ${title}`}
            className="mt-4 rounded-md bg-white p-2"
            height={220}
          >
            <LineChart data={trend} margin={{ top: 10, right: 12, left: -8, bottom: 2 }}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                label={{ value: unit || 'valor', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
              />
              <Tooltip
                formatter={(value: unknown) => [formatChartValue(value, unit), 'Resultado oficial']}
                labelFormatter={(label) => `Período: ${String(label)}`}
              />
              <Line dataKey="value" stroke="var(--tcdx-color-secondary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveChartFrame>
          <p className="mt-3 text-xs leading-5 text-slate-600">{summary}</p>
        </>
      )}
    </section>
  );
}

function Field({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-slate-950">{value}</dd></div>}
function TextBlock({title,value}:{title:string;value?:string|null}){return <div className="rounded-lg border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-800">{value||'No existe evidencia suficiente para afirmar este punto.'}</p></div>}
function Action({children,disabled,onClick}:{children:ReactNode;disabled:boolean;onClick:()=>void}){return <button type="button" disabled={disabled} onClick={onClick} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{children}</button>}
function ActionableStatePanel({state}:{state:ActionableState|null}){if(!state||state.state==='calculated')return null;const missing=state.missing_components||[];return <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ActionableEmptyState title={state.label||'No calculable'} reason={state.why||'El indicador requiere evidencia adicional para calcularse.'} ctaLabel={state.route_to_fix?'Resolver origen':undefined} href={state.route_to_fix||undefined} className="border-amber-200" />{missing.length>0&&<div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Qué falta</p><ul className="mt-2 grid gap-2 md:grid-cols-2">{missing.map((item)=><li key={item.component} className="rounded-lg border border-amber-200 bg-white px-3 py-2"><div className="font-semibold">{item.label||presentationLabel(item.component)}</div><div className="mt-1 text-xs leading-5 text-amber-900">{item.reason||item.rule||'Componente requerido por contrato oficial.'}</div>{item.route_to_fix&&<Link href={item.route_to_fix} className="mt-2 inline-flex text-xs font-bold text-blue-800 underline-offset-2 hover:underline">{item.action||'Abrir origen'}</Link>}</li>)}</ul></div>}<p className="mt-3 text-xs leading-5 text-amber-900">{state.expected_after_resolution||'Luego de completar la evidencia, recalcula el indicador desde el pipeline oficial.'}</p>{state.required_capability&&<p className="mt-1 text-xs text-amber-800">Capability requerida: {state.required_capability}</p>}</section>}
function TechnicalDetail({value}:{value:UnknownRecord}){const formula=record(value.formula);const binding=record(value.binding);const policy=record(value.calculation_policy);const trust=record(value.trust_policy);const lineage=Array.isArray(value.lineage)?value.lineage:[];return <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2"><Field label="Fórmula oficial" value={String(formula.code||'No disponible')}/><Field label="Versión de definición" value={String(value.definition_version||'No disponible')}/><Field label="Binding" value={`v${String(binding.version||'?')} · ${String(binding.checksum||'sin checksum')}`}/><Field label="Política de cálculo" value={`v${String(policy.version||'?')} · timeout ${String(policy.timeout_ms||'?')} ms`}/><Field label="Política Data Trust" value={`v${String(trust.version||'?')} · ${String(trust.checksum||'sin checksum')}`}/><Field label="Lineage" value={`${lineage.length} relaciones registradas`}/></dl>}
