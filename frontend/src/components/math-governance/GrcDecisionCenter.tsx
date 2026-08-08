'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJsonSingleFlight } from '@/utils/apiClient';

type UnknownRecord = Record<string, unknown>;
type Severity = 'green'|'amber'|'red'|'gray';
type DecisionItem = {
  code:string; name:string; domain:string; value:number|null; unit:string; severity:Severity;
  interpretation:string; cause:string; impact:string; recommendation:string; trend:string;
  delta:number|null; snapshotId:string; owner:string;
};
type Props = { compact?:boolean; limit?:number; title?:string };

function record(value:unknown):UnknownRecord { return typeof value==='object'&&value!==null&&!Array.isArray(value)?value as UnknownRecord:{}; }
function text(value:unknown,fallback=''){ return typeof value==='string'&&value.trim()?value.trim():fallback; }
function numeric(value:unknown){ if(value===null||value===undefined||value==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null; }
function unwrap(value:unknown){ const item=record(value);return 'data' in item?item.data:value; }
function tone(value:Severity){if(value==='red')return 'border-red-200 bg-red-50 text-red-950';if(value==='amber')return 'border-amber-200 bg-amber-50 text-amber-950';if(value==='green')return 'border-emerald-200 bg-emerald-50 text-emerald-950';return 'border-slate-200 bg-slate-50 text-slate-800';}
function priority(value:Severity){return value==='red'?3:value==='amber'?2:value==='green'?1:0;}

function deriveDecision(raw:unknown):DecisionItem{
  const item=record(raw);const definition=record(item.definition);const snapshot=record(item.latest_snapshot);
  const interpretation=record(snapshot.interpretation);const classification=record(interpretation.classification);
  const comparison=record(interpretation.comparison);const trust=record(snapshot.trust);
  const value=text(snapshot.state)==='calculated'?numeric(snapshot.value):null;
  const trusted=['trusted','acceptable'].includes(text(trust.status).toLowerCase());
  let severity:Severity='gray';
  if(value!==null&&classification.positive===true&&trusted)severity='green';
  else if(value!==null&&text(trust.status).toLowerCase()==='untrusted')severity='red';
  else if(value!==null)severity='amber';
  return {
    code:text(definition.code,'unknown'),name:text(definition.name,'Indicador sin nombre'),domain:text(definition.domain,'general'),
    value,unit:text(snapshot.unit||definition.unit),severity,
    interpretation:text(classification.label,value===null?'Sin medición válida':'Resultado disponible'),
    cause:text(interpretation.cause,value===null?'No existe un snapshot oficial calculado y publicado.':'El resultado proviene del snapshot oficial publicado.'),
    impact:text(interpretation.impact,'Revise el indicador junto con sus riesgos, controles, evidencias y planes asociados.'),
    recommendation:text(interpretation.recommendation,value===null?'Complete o corrija los datos fuente antes de tomar decisiones.':'Revise la evidencia y registre una propuesta gobernada cuando corresponda.'),
    trend:text(comparison.direction,'Sin período comparable'),delta:numeric(comparison.delta_absolute),
    snapshotId:text(snapshot.snapshot_id),owner:text(interpretation.suggested_owner,'Por asignar'),
  };
}

export default function GrcDecisionCenter({compact=false,limit=12,title='Centro de decisiones GRC'}:Props){
  const [items,setItems]=useState<DecisionItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState<DecisionItem|null>(null);
  useEffect(()=>{let cancelled=false;apiRequestJsonSingleFlight('/api/metrics/official/catalog',{fallbackMessage:'No fue posible cargar los indicadores oficiales.'})
    .then((payload)=>{const raw=unwrap(payload);const rows=Array.isArray(raw)?raw.slice(0,limit).map(deriveDecision):[];if(!cancelled)setItems(rows.sort((a,b)=>priority(b.severity)-priority(a.severity)));})
    .catch((reason)=>{if(!cancelled)setError(reason instanceof ApiClientError||reason instanceof Error?reason.message:'No fue posible cargar el centro de decisiones.');})
    .finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true};},[limit]);
  const summary=useMemo(()=>items.reduce((acc,item)=>{acc[item.severity]+=1;if(item.value!==null)acc.measured+=1;return acc;},{red:0,amber:0,green:0,gray:0,measured:0}),[items]);
  const priorities=useMemo(()=>items.filter((item)=>item.severity==='red'||item.severity==='amber'),[items]);
  return <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Decisión basada en evidencia</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2><p className="mt-2 max-w-4xl text-sm text-slate-600">Consolida snapshots oficiales, interpretación, tendencia, impacto y acciones propuestas. Un estado sin medición nunca se presenta como cero.</p></div><Link href="/metricas" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Administrar métricas</Link></div>
    {loading&&<div className="mt-4 rounded-md border border-dashed p-4 text-sm">Cargando decisiones…</div>}
    {error&&<div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
    {!loading&&!error&&<><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Críticos',summary.red,'text-red-700'],['Atención',summary.amber,'text-amber-700'],['Controlados',summary.green,'text-emerald-700'],['Sin medición',summary.gray,'text-slate-700'],['Medidos',summary.measured,'text-slate-950']].map(([label,value,color])=><div key={String(label)} className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-600">{label}</div><div className={`mt-1 text-2xl font-bold ${color}`}>{Number(value)}</div></div>)}</div>
      {priorities.length>0&&<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Prioridades de gestión</h3><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{priorities.slice(0,6).map((item)=><button key={item.code} type="button" onClick={()=>setSelected(item)} className="rounded-lg border border-amber-200 bg-white p-4 text-left"><div className="font-semibold">{item.name}</div><p className="mt-2 text-sm text-slate-700">{item.recommendation}</p></button>)}</div></div>}
      <div className={`mt-5 grid gap-3 ${compact?'md:grid-cols-2':'md:grid-cols-2 xl:grid-cols-3'}`}>{items.map((item)=><article key={item.code} className={`rounded-xl border p-4 ${tone(item.severity)}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs opacity-70">{item.code} · {item.domain}</p></div><span className="rounded-full border border-current/20 bg-white/50 px-2 py-1 text-xs font-bold">{item.interpretation}</span></div><div className="mt-4 text-3xl font-bold">{item.value===null?'Sin medición':`${item.value}${item.unit?` ${item.unit}`:''}`}</div><div className="mt-3 text-sm"><strong>Tendencia:</strong> {item.trend}{item.delta!==null?` (${item.delta>0?'+':''}${item.delta})`:''}</div><p className="mt-2 text-sm">{item.cause}</p><button type="button" onClick={()=>setSelected(item)} className="mt-4 rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-semibold">Ver decisión</button></article>)}</div></>}
    {selected&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelected(null)}}><section role="dialog" aria-modal="true" className="max-h-[84vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-orange-700">Decisión GRC</p><h3 className="mt-1 text-2xl font-semibold">{selected.name}</h3></div><button type="button" onClick={()=>setSelected(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Cerrar</button></div><div className={`mt-4 rounded-xl border p-4 ${tone(selected.severity)}`}><div className="text-3xl font-bold">{selected.value===null?'Sin medición válida':`${selected.value}${selected.unit?` ${selected.unit}`:''}`}</div><div className="mt-1 font-semibold">{selected.interpretation}</div></div><dl className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Causa</dt><dd className="mt-2 text-sm">{selected.cause}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Impacto</dt><dd className="mt-2 text-sm">{selected.impact}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Recomendación</dt><dd className="mt-2 text-sm">{selected.recommendation}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Trazabilidad</dt><dd className="mt-2 text-sm">Snapshot {selected.snapshotId||'no publicado'} · {selected.owner}</dd></div></dl><Link href={`/metricas/${encodeURIComponent(selected.code)}`} className="mt-4 inline-flex rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Abrir indicador y propuesta</Link></section></div>}
  </section>;
}
