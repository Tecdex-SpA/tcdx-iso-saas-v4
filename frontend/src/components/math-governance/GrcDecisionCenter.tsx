'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJsonSingleFlight } from '@/utils/apiClient';
import { useTranslation } from '@/hooks/useTranslation';

type UnknownRecord = Record<string, unknown>;
type Severity = 'green'|'amber'|'red'|'gray';
type DecisionItem = {
  code:string; name:string; domain:string; value:number|null; unit:string; severity:Severity;
  interpretation:string; cause:string; impact:string; recommendation:string; trend:string;
  delta:number|null; snapshotId:string; owner:string;
};
type Props = {
  compact?: boolean;
  title?: string;
  variant?: 'full' | 'summary';
  ctaHref?: string;
  ctaLabel?: string;
};

function record(value:unknown):UnknownRecord { return typeof value==='object'&&value!==null&&!Array.isArray(value)?value as UnknownRecord:{}; }
function text(value:unknown,fallback=''){ return typeof value==='string'&&value.trim()?value.trim():fallback; }
function numeric(value:unknown){ if(value===null||value===undefined||value==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null; }
function unwrap(value:unknown){ const item=record(value);return 'data' in item?item.data:value; }
function tone(value:Severity){if(value==='red')return 'border-red-200 bg-red-50 text-red-950';if(value==='amber')return 'border-amber-200 bg-amber-50 text-amber-950';if(value==='green')return 'border-emerald-200 bg-emerald-50 text-emerald-950';return 'border-slate-200 bg-slate-50 text-slate-800';}
function priority(value:Severity){return value==='red'?3:value==='amber'?2:value==='green'?1:0;}
function summaryValue(value:number|null, noDataLabel:string){return value===null?noDataLabel:String(value);}

function deriveDecision(raw:unknown,t:(key:string)=>string):DecisionItem{
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
    code:text(definition.code,'unknown'),name:text(definition.name,t('grcDecisionCenter.defaults.unnamedIndicator')),domain:text(definition.domain,'general'),
    value,unit:text(snapshot.unit||definition.unit),severity,
    interpretation:text(classification.label,value===null?t('grcDecisionCenter.values.noValidMeasurement'):t('grcDecisionCenter.values.validResult')),
    cause:text(interpretation.cause,value===null?t('grcDecisionCenter.defaults.noOfficialSnapshot'):t('grcDecisionCenter.defaults.officialSnapshot')),
    impact:text(interpretation.impact,t('grcDecisionCenter.defaults.reviewImpact')),
    recommendation:text(interpretation.recommendation,value===null?t('grcDecisionCenter.defaults.completeSourceData'):t('grcDecisionCenter.defaults.reviewEvidence')),
    trend:text(comparison.direction,t('grcDecisionCenter.values.noComparablePeriod')),delta:numeric(comparison.delta_absolute),
    snapshotId:text(snapshot.snapshot_id),owner:text(interpretation.suggested_owner,t('grcDecisionCenter.defaults.unassigned')),
  };
}

export default function GrcDecisionCenter({
  compact = false,
  title = 'Centro de decisiones GRC',
  variant = 'full',
  ctaHref = '/grc',
  ctaLabel,
}: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title || t('grcDecisionCenter.defaultTitle');
  const resolvedCtaLabel = ctaLabel || t('grcDecisionCenter.cta');
  const [items,setItems]=useState<DecisionItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState<DecisionItem|null>(null);
  useEffect(()=>{let cancelled=false;apiRequestJsonSingleFlight('/api/metrics/official/catalog',{fallbackMessage:t('grcDecisionCenter.loadError')})
    .then((payload)=>{const raw=unwrap(payload);const rows=Array.isArray(raw)?raw.map((row)=>deriveDecision(row,t)):[];if(!cancelled)setItems(rows.sort((a,b)=>priority(b.severity)-priority(a.severity)));})
    .catch((reason)=>{if(!cancelled)setError(reason instanceof ApiClientError||reason instanceof Error?reason.message:t('grcDecisionCenter.loadError'));})
    .finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true};},[t]);
  const summary=useMemo(()=>items.reduce((acc,item)=>{acc[item.severity]+=1;if(item.value!==null)acc.measured+=1;return acc;},{red:0,amber:0,green:0,gray:0,measured:0}),[items]);
  const priorities=useMemo(()=>items.filter((item)=>item.severity==='red'||item.severity==='amber'),[items]);
  const priorityPreview=useMemo(()=>priorities.slice(0,3),[priorities]);
  const priorityFocus=useMemo(()=>priorities.slice(0,6),[priorities]);
  const hasItems=items.length>0;
  const insufficientTone = 'text-slate-700';
  const prioritiesPanelTone = hasItems
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-slate-200 bg-slate-50 text-slate-800';
  const prioritiesTextTone = hasItems ? 'text-amber-900' : 'text-slate-700';
  const summaryCards = [
    [t('grcDecisionCenter.summaryCards.critical'), hasItems?summary.red:null, hasItems?'text-red-700':insufficientTone],
    [t('grcDecisionCenter.summaryCards.attention'), hasItems?summary.amber:null, hasItems?'text-amber-700':insufficientTone],
    [t('grcDecisionCenter.summaryCards.controlled'), hasItems?summary.green:null, hasItems?'text-emerald-700':insufficientTone],
    [t('grcDecisionCenter.summaryCards.unmeasured'), hasItems?summary.gray:null, insufficientTone],
    [t('grcDecisionCenter.summaryCards.measured'), hasItems?summary.measured:null, hasItems?'text-slate-950':insufficientTone],
  ] as const;

  if (variant === 'summary') {
    return (
      <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-text-muted)]">
              {t('grcDecisionCenter.evidenceBased')}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">{resolvedTitle}</h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
              {t('grcDecisionCenter.summaryDescription')}
            </p>
          </div>
          <Link
            href={ctaHref}
            className="inline-flex w-fit rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tcdx-color-primary-hover)]"
          >
            {resolvedCtaLabel}
          </Link>
        </div>

        {loading && <div className="mt-4 rounded-md border border-dashed p-4 text-sm">{t('grcDecisionCenter.loading')}</div>}
        {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}

        {!loading && !error && (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {summaryCards.map(([label, value, color]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-600">{label}</div>
                  <div className={`mt-1 text-lg font-bold ${color}`}>{summaryValue(value,t('grcDecisionCenter.values.noData'))}</div>
                </div>
              ))}
            </div>
            <div className={`rounded-xl border p-4 text-sm ${prioritiesPanelTone}`}>
              <div className="font-semibold">{t('grcDecisionCenter.priorities.title')}</div>
              {!hasItems ? (
                <p className={`mt-2 ${prioritiesTextTone}`}>{t('grcDecisionCenter.priorities.noneAvailable')}</p>
              ) : priorities.length === 0 ? (
                <p className={`mt-2 ${prioritiesTextTone}`}>{t('grcDecisionCenter.priorities.noneCritical')}</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-amber-900">
                    {t('grcDecisionCenter.priorities.previewHelp')}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {priorityPreview.map((item) => (
                      <li key={item.code} className="truncate" title={item.name}>
                        {item.name}
                      </li>
                    ))}
                  </ul>
                  {priorities.length > priorityPreview.length && (
                    <p className="mt-2 text-xs font-semibold text-amber-900">
                      {t('grcDecisionCenter.priorities.additional',{count:priorities.length-priorityPreview.length})}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  return <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">{t('grcDecisionCenter.evidenceBased')}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{resolvedTitle}</h2><p className="mt-2 max-w-4xl text-sm text-slate-600">{t('grcDecisionCenter.fullDescription')}</p></div><Link href={ctaHref} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">{resolvedCtaLabel}</Link></div>
    {loading&&<div className="mt-4 rounded-md border border-dashed p-4 text-sm">{t('grcDecisionCenter.loading')}</div>}
    {error&&<div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
    {!loading&&!error&&<><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{summaryCards.map(([label,value,color])=><div key={String(label)} className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-600">{label}</div><div className={`mt-1 text-2xl font-bold ${color}`}>{summaryValue(value,t('grcDecisionCenter.values.noData'))}</div></div>)}</div>
      {priorities.length>0&&<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">{t('grcDecisionCenter.priorities.managementTitle')}</h3><p className="mt-1 text-xs text-amber-900">{t('grcDecisionCenter.priorities.focusHelp')}</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{priorityFocus.map((item)=><button key={item.code} type="button" onClick={()=>setSelected(item)} className="rounded-lg border border-amber-200 bg-white p-4 text-left"><div className="font-semibold">{item.name}</div><p className="mt-2 text-sm text-slate-700">{item.recommendation}</p></button>)}</div>{priorities.length>priorityFocus.length&&<p className="mt-3 text-xs font-semibold text-amber-900">{t('grcDecisionCenter.priorities.additionalPriorities',{count:priorities.length-priorityFocus.length})}</p>}</div>}
      <div className={`mt-5 grid gap-3 ${compact?'md:grid-cols-2':'md:grid-cols-2 xl:grid-cols-3'}`}>{items.map((item)=><article key={item.code} className={`rounded-xl border p-4 ${tone(item.severity)}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs opacity-70">{item.code} · {item.domain}</p></div><span className="rounded-full border border-current/20 bg-white/50 px-2 py-1 text-xs font-bold">{item.interpretation}</span></div><div className="mt-4 text-3xl font-bold">{item.value===null?t('grcDecisionCenter.values.unmeasured'):`${item.value}${item.unit?` ${item.unit}`:''}`}</div><div className="mt-3 text-sm"><strong>{t('grcDecisionCenter.fields.trend')}:</strong> {item.trend}{item.delta!==null?` (${item.delta>0?'+':''}${item.delta})`:''}</div><p className="mt-2 text-sm">{item.cause}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>setSelected(item)} className="rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-semibold">{t('grcDecisionCenter.actions.viewDecision')}</button><Link href={`/metricas/${encodeURIComponent(item.code)}`} className="rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-semibold">{t('grcDecisionCenter.actions.openIndicator')}</Link></div></article>)}</div></>}
    {selected&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelected(null)}}><section role="dialog" aria-modal="true" className="max-h-[84vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-orange-700">{t('grcDecisionCenter.dialogTitle')}</p><h3 className="mt-1 text-2xl font-semibold">{selected.name}</h3></div><button type="button" onClick={()=>setSelected(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">{t('grcDecisionCenter.actions.close')}</button></div><div className={`mt-4 rounded-xl border p-4 ${tone(selected.severity)}`}><div className="text-3xl font-bold">{selected.value===null?t('grcDecisionCenter.values.noValidMeasurement'):`${selected.value}${selected.unit?` ${selected.unit}`:''}`}</div><div className="mt-1 font-semibold">{selected.interpretation}</div></div><dl className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">{t('grcDecisionCenter.fields.cause')}</dt><dd className="mt-2 text-sm">{selected.cause}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">{t('grcDecisionCenter.fields.impact')}</dt><dd className="mt-2 text-sm">{selected.impact}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">{t('grcDecisionCenter.fields.recommendation')}</dt><dd className="mt-2 text-sm">{selected.recommendation}</dd></div><div className="rounded-lg border p-4"><dt className="text-xs font-semibold uppercase text-slate-500">{t('grcDecisionCenter.fields.traceability')}</dt><dd className="mt-2 text-sm">{t('grcDecisionCenter.fields.snapshot')} {selected.snapshotId||t('grcDecisionCenter.defaults.notPublished')} · {selected.owner}</dd></div></dl><Link href={`/metricas/${encodeURIComponent(selected.code)}`} className="mt-4 inline-flex rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">{t('grcDecisionCenter.actions.openProposal')}</Link></section></div>}
  </section>;
}
