'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJsonSingleFlight } from '@/utils/apiClient';
import { DataTrustIndicator, UniversalStateBadge, UniversalStateBlock, universalStateLabel, type UniversalDataState } from '@/components/ui/enterprise';

type Definition = { code:string;name:string;definition:string;domain:string;unit:string;version:number };
type Snapshot = { snapshot_id:string;value:number|null;state:string;unit?:string;period?:{key?:string};coverage?:number|null;trust?:{score?:number|null;status?:string};freshness?:{status?:string};interpretation?:{classification?:{label?:string;positive?:boolean}} };
type IndicatorItem = { definition:Definition;latest_snapshot:Snapshot|null };
type Props = { title?:string;domain?:string;compact?:boolean };

function valueLabel(snapshot:Snapshot|null){if(!snapshot)return 'Sin datos';if(snapshot.state!=='calculated')return universalStateLabel(universalSnapshotState(snapshot));if(snapshot.value===null)return 'No calculable';return `${new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(snapshot.value)}${snapshot.unit==='%'?' %':snapshot.unit?` ${snapshot.unit}`:''}`}
function tone(snapshot:Snapshot|null){if(!snapshot||snapshot.state!=='calculated')return 'border-slate-200 bg-slate-50 text-slate-800';if(snapshot.interpretation?.classification?.positive===true&&['trusted','acceptable'].includes(String(snapshot.trust?.status)))return 'border-emerald-200 bg-emerald-50 text-emerald-950';return 'border-amber-200 bg-amber-50 text-amber-950'}
function coverage(value:number|null|undefined){return value===null||value===undefined?'Desconocida':`${Math.round(value*(value<=1?100:1)*100)/100}%`}
function universalSnapshotState(snapshot: Snapshot | null): UniversalDataState {
  if (!snapshot) return 'empty';
  const state = String(snapshot.state || '').toLowerCase();
  const freshness = String(snapshot.freshness?.status || '').toLowerCase();
  if (state === 'calculated' && snapshot.value === 0) return 'zero';
  if (state === 'calculated') return 'measured';
  if (state === 'failed' || state === 'error' || state === 'technical_error') return 'error';
  if (state === 'dependency_pending' || state === 'not_applicable' || state === 'source_incompatible') return 'not_calculable';
  if (state === 'source_unavailable') return 'not_available';
  if (state === 'partial') return 'partial';
  if (state === 'unmeasured' || state === 'insufficient' || state === 'insufficient_data') return 'insufficient';
  if (freshness === 'stale' || freshness === 'expired') return 'stale';
  return 'not_available';
}

export default function OfficialAnalyticsPanel({title='Resultados analíticos oficiales',domain,compact=false}:Props){
  const titleId=useId();const [items,setItems]=useState<IndicatorItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let cancelled=false;apiRequestJsonSingleFlight<{data?:IndicatorItem[]}>('/api/metrics/official/catalog',{fallbackMessage:'No fue posible cargar los indicadores oficiales.'}).then((payload)=>{if(!cancelled)setItems(Array.isArray(payload.data)?payload.data:[])}).catch((reason)=>{if(!cancelled)setError(reason instanceof ApiClientError||reason instanceof Error?reason.message:'Error cargando indicadores oficiales.')} ).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[]);
  const visible=useMemo(()=>{
    const scoped=items.filter((item)=>!domain||item.definition.domain===domain);
    return scoped;
  },[domain,items]);
  return <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" aria-labelledby={titleId}>
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Snapshots funcionales oficiales</p><h2 id={titleId} className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2><p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">Valor, cobertura, confianza y período provienen del mismo snapshot inmutable usado por Métricas y exportación.</p></div><Link href="/metricas" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Abrir catálogo</Link></div>
    {loading&&<UniversalStateBlock className="mt-4" state="loading" title="Cargando resultados oficiales" />}
    {!loading&&error&&<UniversalStateBlock className="mt-4" state="error" title="Error cargando snapshots oficiales" description={error} />}
    {!loading&&!error&&!visible.length&&<UniversalStateBlock className="mt-4" state="empty" title="Sin datos" description="No hay snapshots oficiales publicados para este alcance." />}
    {!loading&&!error&&visible.length>0&&<div className={`mt-4 grid gap-3 ${compact?'md:grid-cols-2':'md:grid-cols-2 xl:grid-cols-4'}`}>{visible.map((item)=><article key={item.definition.code} className={`rounded-md border p-4 ${tone(item.latest_snapshot)}`}><div className="flex items-start justify-between gap-3"><div className="text-sm font-semibold">{item.definition.name}</div><UniversalStateBadge state={universalSnapshotState(item.latest_snapshot)} label={item.latest_snapshot?.interpretation?.classification?.label||undefined} /></div><div className="mt-2 text-2xl font-bold">{valueLabel(item.latest_snapshot)}</div><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between gap-3"><dt>Período</dt><dd>{item.latest_snapshot?.period?.key||'No disponible'}</dd></div><div className="flex justify-between gap-3"><dt>Cobertura</dt><dd>{coverage(item.latest_snapshot?.coverage)}</dd></div><div className="flex justify-between gap-3"><dt>Freshness</dt><dd>{item.latest_snapshot?.freshness?.status||'No disponible'}</dd></div></dl><div className="mt-3"><DataTrustIndicator status={item.latest_snapshot?.trust?.status || null} confidence={item.latest_snapshot?.trust?.score ?? null} coverage={item.latest_snapshot?.coverage ?? null} freshness={item.latest_snapshot?.freshness?.status || null} label="Data Trust del snapshot" /></div><Link href={`/metricas/${encodeURIComponent(item.definition.code)}`} className="mt-3 inline-flex min-h-9 items-center rounded-md border border-current/20 bg-white/70 px-2 text-xs font-semibold">Snapshot {item.latest_snapshot?.snapshot_id?.slice(0,8)||'pendiente'}</Link></article>)}</div>}
  </section>
}
