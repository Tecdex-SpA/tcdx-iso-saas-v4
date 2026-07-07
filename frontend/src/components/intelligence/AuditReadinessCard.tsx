'use client';

import { useState } from 'react';
import DataQualityWarnings from './DataQualityWarnings';
import IntelligenceConfidenceBadge from './IntelligenceConfidenceBadge';
import KnowledgeBasisDrawer from './KnowledgeBasisDrawer';
import NextBestActionsPanel from './NextBestActionsPanel';
import { asArray, cleanText, collectKnowledgeBasis, formatScore, scoreTone } from './utils';
import type { IntelligenceBrief } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  compact?: boolean;
};

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function AuditReadinessCard({ brief, compact = false }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const readiness = brief?.audit_readiness;
  const explanation = readiness?.explanation;
  const basis = collectKnowledgeBasis(brief);
  const blockers = asArray<Record<string, unknown>>(brief?.findings)
    .filter((finding) => String(finding.type || '').includes('audit') || String(finding.severity || '').toLowerCase().includes('crit'))
    .slice(0, compact ? 3 : 5);
  const criticalControls = asArray<Record<string, unknown>>(brief?.findings)
    .filter((finding) => String(finding.category || '').includes('control') || String(finding.category || '').includes('evidence'))
    .slice(0, 4);
  const tone = scoreTone(readiness?.score);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Audit readiness</div>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Preparación auditora</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {cleanText(explanation?.why, 'Preparación estimada con datos confirmados, reglas determinísticas y fundamento KB cuando existe.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
            {formatScore(readiness?.score)} · {cleanText(readiness?.state, 'sin estado')}
          </span>
          <IntelligenceConfidenceBadge brief={brief} compact />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Bloqueadores</div>
          {blockers.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {blockers.map((item, index) => (
                <li key={index}>{cleanText(item.title || item.description)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Sin bloqueadores críticos detectados.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Riesgo de observación</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {cleanText(explanation?.impact, 'El riesgo depende de evidencia faltante, hallazgos abiertos, acciones vencidas y cobertura KB.')}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Controles críticos</div>
          {criticalControls.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {criticalControls.map((item, index) => (
                <li key={index}>{cleanText(item.entity_id || item.title || item.rule_key)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Sin controles críticos priorizados.</p>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">Acciones antes de auditoría</div>
          <NextBestActionsPanel brief={brief} maxItems={4} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <span>Fundamento KB visible: {basis.length ? `${basis.length} registros derivados aplicables.` : 'sin cobertura aplicable.'}</span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          Ver fundamento
        </button>
      </div>

      <div className="mt-4">
        <DataQualityWarnings brief={brief} maxItems={3} />
      </div>

      <KnowledgeBasisDrawer open={drawerOpen} items={basis} onClose={() => setDrawerOpen(false)} />
    </section>
  );
}
