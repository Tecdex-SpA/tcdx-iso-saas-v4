'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJsonSingleFlight } from '@/utils/apiClient';

type Definition = { code:string;name:string;definition:string;domain:string;unit:string;version:number };
type Snapshot = { snapshot_id:string;value:number|null;state:string;unit?:string;period?:{key?:string};coverage?:number|null;trust?:{score?:number|null;status?:string};freshness?:{status?:string};interpretation?:{classification?:{label?:string;positive?:boolean}} };
type IndicatorItem = { definition:Definition;latest_snapshot:Snapshot|null };
type Props = { title?:string;domain?:string;compact?:boolean;limit?:number;priorityCodes?:string[] };

function valueLabel(snapshot:Snapshot|null){if(!snapshot||snapshot.state!=='calculated'||snapshot.value===null)return 'Sin medición oficial';return `${new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(snapshot.value)}${snapshot.unit==='%'?' %':snapshot.unit?` ${snapshot.unit}`:''}`}
function tone(snapshot:Snapshot|null){if(!snapshot||snapshot.state!=='calculated')return 'border-slate-200 bg-slate-50 text-slate-800';if(snapshot.interpretation?.classification?.positive===true&&['trusted','acceptable'].includes(String(snapshot.trust?.status)))return 'border-emerald-200 bg-emerald-50 text-emerald-950';return 'border-amber-200 bg-amber-50 text-amber-950'}
function coverage(value:number|null|undefined){return value===null||value===undefined?'Desconocida':`${Math.round(value*(value<=1?100:1)*100)/100}%`}

export default function OfficialAnalyticsPanel({title='Resultados analíticos oficiales',domain,compact=false,limit=8,priorityCodes=[]}:Props){
  const titleId=useId();const [items,setItems]=useState<IndicatorItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let cancelled=false;apiRequestJsonSingleFlight<{data?:IndicatorItem[]}>('/api/metrics/official/catalog',{fallbackMessage:'No fue posible cargar los indicadores oficiales.'}).then((payload)=>{if(!cancelled)setItems(Array.isArray(payload.data)?payload.data:[])}).catch((reason)=>{if(!cancelled)setError(reason instanceof ApiClientError||reason instanceof Error?reason.message:'Error cargando indicadores oficiales.')} ).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[]);
  const visible=useMemo(()=>{
    const scoped=items.filter((item)=>!domain||item.definition.domain===domain);
    const priority=new Set(priorityCodes);
    const pinned=scoped.filter((item)=>priority.has(item.definition.code));
    const rest=scoped.filter((item)=>!priority.has(item.definition.code));
    return [...pinned,...rest].slice(0,limit);
  },[domain,items,limit,priorityCodes]);
  return <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" aria-labelledby={titleId}>
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Snapshots funcionales oficiales</p><h2 id={titleId} className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2><p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">Valor, cobertura, confianza y período provienen del mismo snapshot inmutable usado por Métricas y exportación.</p></div><Link href="/metricas" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Abrir catálogo</Link></div>
    {loading&&<div className="mt-4 rounded-md border border-dashed p-4 text-sm">Cargando resultados oficiales…</div>}
    {!loading&&error&&<div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">{error}</div>}
    {!loading&&!error&&!visible.length&&<div className="mt-4 rounded-md border border-dashed p-4 text-sm text-[var(--tcdx-color-text-secondary)]">No hay snapshots oficiales publicados para este alcance.</div>}
    {!loading&&!error&&visible.length>0&&<div className={`mt-4 grid gap-3 ${compact?'md:grid-cols-2':'md:grid-cols-2 xl:grid-cols-4'}`}>{visible.map((item)=><article key={item.definition.code} className={`rounded-md border p-4 ${tone(item.latest_snapshot)}`}><div className="text-sm font-semibold">{item.definition.name}</div><div className="mt-2 text-2xl font-bold">{valueLabel(item.latest_snapshot)}</div><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between gap-3"><dt>Estado</dt><dd className="font-semibold">{item.latest_snapshot?.interpretation?.classification?.label||item.latest_snapshot?.state||'unmeasured'}</dd></div><div className="flex justify-between gap-3"><dt>Período</dt><dd>{item.latest_snapshot?.period?.key||'No disponible'}</dd></div><div className="flex justify-between gap-3"><dt>Cobertura</dt><dd>{coverage(item.latest_snapshot?.coverage)}</dd></div><div className="flex justify-between gap-3"><dt>Data Trust</dt><dd>{item.latest_snapshot?.trust?.score??'Desconocido'} · {item.latest_snapshot?.trust?.status||'unknown'}</dd></div><div className="flex justify-between gap-3"><dt>Freshness</dt><dd>{item.latest_snapshot?.freshness?.status||'unknown'}</dd></div></dl><Link href={`/metricas/${encodeURIComponent(item.definition.code)}`} className="mt-3 inline-flex min-h-9 items-center rounded-md border border-current/20 bg-white/70 px-2 text-xs font-semibold">Snapshot {item.latest_snapshot?.snapshot_id?.slice(0,8)||'pendiente'}</Link></article>)}</div>}
  </section>
}
