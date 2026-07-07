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
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const basis = collectKnowledgeBasis(brief);
  const risk = asArray<Record<string, unknown>>(brief?.main_risks)[0] || asArray<Record<string, unknown>>(brief?.findings)[0] || null;
  const score = brief?.overall?.score ?? brief?.scoring?.overall;
  const scoreClass = badgeTone[scoreTone(score)];
  const stateClass = badgeTone[stateTone(brief?.overall?.state)];

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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Intelligence Layer</div>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Lectura ejecutiva del sistema</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">{executiveSummary(brief)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Ver fundamento
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado general</div>
          <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${stateClass}`}>
            {cleanText(brief.overall?.state, 'sin estado')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score global</div>
          <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${scoreClass}`}>
            {formatScore(score)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audit readiness</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{formatScore(brief.audit_readiness?.score)}</div>
          <div className="mt-1 text-xs text-slate-500">{cleanText(brief.audit_readiness?.state, 'sin estado')}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Riesgo principal</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{cleanText(risk?.title || risk?.rule_key, 'Sin riesgo crítico')}</div>
          <div className="mt-1 text-xs text-slate-500">{cleanText(risk?.severity || risk?.category, 'no informado')}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 text-sm font-semibold text-slate-900">3 acciones prioritarias</div>
          <NextBestActionsPanel brief={brief} maxItems={3} />
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Confianza</div>
            <div className="mt-3">
              <IntelligenceConfidenceBadge brief={brief} />
            </div>
            {brief.metadata?.ai_used === false && (
              <p className="mt-3 text-sm leading-6 text-slate-600">
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
