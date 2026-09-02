'use client';

import { useState } from 'react';
import DataQualityWarnings from './DataQualityWarnings';
import IntelligenceConfidenceBadge from './IntelligenceConfidenceBadge';
import IntelligenceEmptyState from './IntelligenceEmptyState';
import IntelligenceErrorState from './IntelligenceErrorState';
import KnowledgeBasisDrawer from './KnowledgeBasisDrawer';
import NextBestActionsPanel from './NextBestActionsPanel';
import {
  asArray,
  cleanText,
  collectKnowledgeBasis,
  executiveSummary,
  formatScore,
  scoreTone,
  stateTone,
} from './utils';
import type { IntelligenceBrief, IntelligenceStatus } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  loading?: boolean;
  error?: string;
  status?: IntelligenceStatus;
  onRefresh?: () => void | Promise<void>;
  surface?: 'light' | 'dark';
};

const badgeTone = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function ExecutiveIntelligenceBrief({
  brief,
  loading = false,
  error = '',
  status = 'idle',
  onRefresh,
  surface = 'light',
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const basis = collectKnowledgeBasis(brief);
  const risk = asArray<Record<string, unknown>>(brief?.main_risks)[0] || asArray<Record<string, unknown>>(brief?.findings)[0] || null;
  const score = brief?.overall?.score ?? brief?.scoring?.overall;
  const scoreClass = badgeTone[scoreTone(score)];
  const stateClass = badgeTone[stateTone(brief?.overall?.state)];
  const dark = surface === 'dark';
  const shellClass = dark
    ? 'rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-sm'
    : 'rounded-lg border border-[var(--tcdx-color-border)] bg-white p-4 shadow-sm';
  const eyebrowClass = dark
    ? 'text-xs font-bold uppercase tracking-[0.16em] text-blue-200'
    : 'text-xs font-bold uppercase tracking-[0.16em] text-[var(--tcdx-color-primary)]';
  const titleClass = dark
    ? 'mt-1 text-lg font-bold text-slate-50'
    : 'mt-1 text-lg font-bold text-[var(--tcdx-color-text-ink)]';
  const bodyClass = dark
    ? 'mt-2 max-w-5xl text-sm leading-6 text-slate-100'
    : 'mt-2 max-w-5xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]';
  const cardClass = dark
    ? 'rounded-lg border border-white/15 bg-white/10 p-3'
    : 'rounded-lg border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-3';
  const cardLabelClass = dark
    ? 'text-xs font-semibold uppercase tracking-wide text-slate-300'
    : 'text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-text-muted)]';
  const cardValueClass = dark
    ? 'mt-2 text-xl font-bold text-slate-50'
    : 'mt-2 text-xl font-bold text-[var(--tcdx-color-text-ink)]';
  const cardSecondaryClass = dark
    ? 'mt-1 text-xs text-slate-300'
    : 'mt-1 text-xs text-[var(--tcdx-color-text-secondary)]';
  const panelHeadingClass = dark
    ? 'mb-3 text-sm font-semibold text-slate-50'
    : 'mb-3 text-sm font-semibold text-[var(--tcdx-color-text-ink)]';
  const secondaryTextClass = dark
    ? 'mt-3 text-sm leading-6 text-slate-200'
    : 'mt-3 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]';

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (status === 'error' || status === 'timeout' || status === 'forbidden' || status === 'no_session') {
    return <IntelligenceErrorState status={status} error={error} onRetry={onRefresh} />;
  }

  if (!brief) {
    return <IntelligenceEmptyState />;
  }

  return (
    <section className={shellClass}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className={eyebrowClass}>Lectura complementaria</div>
          <h2 className={titleClass}>Lectura ejecutiva del sistema</h2>
          <p className={bodyClass}>{executiveSummary(brief)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className={dark
              ? 'rounded border border-white/30 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
              : 'rounded border border-[var(--tcdx-color-border)] px-3 py-2 text-xs font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface)]'}
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={dark
              ? 'rounded border border-white bg-white px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
              : 'rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100'}
          >
            Ver fundamento
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClass}>
          <div className={cardLabelClass}>Estado general</div>
          <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${stateClass}`}>
            {cleanText(brief.overall?.state, 'sin estado')}
          </div>
        </div>
        <div className={cardClass}>
          <div className={cardLabelClass}>Score global</div>
          <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${scoreClass}`}>
            {formatScore(score)}
          </div>
        </div>
        <div className={cardClass}>
          <div className={cardLabelClass}>Preparación auditora</div>
          <div className={cardValueClass}>{formatScore(brief.audit_readiness?.score)}</div>
          <div className={cardSecondaryClass}>{cleanText(brief.audit_readiness?.state, 'sin estado')}</div>
        </div>
        <div className={cardClass}>
          <div className={cardLabelClass}>Riesgo principal</div>
          <div className={dark ? 'mt-2 text-sm font-semibold text-slate-50' : 'mt-2 text-sm font-semibold text-[var(--tcdx-color-text-ink)]'}>{cleanText(risk?.title || risk?.rule_key, 'Sin riesgo crítico')}</div>
          <div className={cardSecondaryClass}>{cleanText(risk?.severity || risk?.category, 'no informado')}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <div>
          <div className={panelHeadingClass}>3 acciones prioritarias</div>
          <NextBestActionsPanel brief={brief} maxItems={3} />
        </div>
        <div className="space-y-3">
          <div className={cardClass}>
            <div className={dark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-[var(--tcdx-color-text-ink)]'}>Confianza</div>
            <div className="mt-3">
              <IntelligenceConfidenceBadge brief={brief} />
            </div>
            {brief.metadata?.ai_used === false && (
              <p className={secondaryTextClass}>
                IA narrativa desactivada o en fallback. La lectura se mantiene con reglas determinísticas.
              </p>
            )}
          </div>
          <DataQualityWarnings brief={brief} maxItems={3} />
        </div>
      </div>

      <KnowledgeBasisDrawer open={drawerOpen} items={basis} onClose={() => setDrawerOpen(false)} />
    </section>
  );
}
