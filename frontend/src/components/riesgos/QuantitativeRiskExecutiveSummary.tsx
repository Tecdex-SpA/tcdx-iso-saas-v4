import {
  buildExecutiveRiskSummary,
  formatRiskNumber,
  formatRiskProbability,
  statusLabel,
  type QuantitativeRisk,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type QuantitativeRiskExecutiveSummaryProps = {
  risks: QuantitativeRisk[];
  kpis: QuantitativeRiskKpis;
  unitSuffix: string;
  onSelectRisk: (risk: QuantitativeRisk) => void;
};

function levelClass(level: QuantitativeRisk['status']) {
  if (level === 'critico') return 'border-red-200 bg-red-50 text-red-800';
  if (level === 'alto') return 'border-orange-200 bg-orange-50 text-orange-800';
  if (level === 'medio') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function InsightButton({
  label,
  risk,
  value,
  onSelectRisk,
}: {
  label: string;
  risk: QuantitativeRisk | null;
  value: string;
  onSelectRisk: (risk: QuantitativeRisk) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => risk && onSelectRisk(risk)}
      disabled={!risk}
      className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-white"
    >
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-950">{risk ? `${risk.code}: ${risk.name}` : '-'}</div>
      <div className="mt-1 text-xs text-slate-600">{value}</div>
    </button>
  );
}

export default function QuantitativeRiskExecutiveSummary({
  risks,
  kpis,
  unitSuffix,
  onSelectRisk,
}: QuantitativeRiskExecutiveSummaryProps) {
  const summary = buildExecutiveRiskSummary(risks, kpis);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Lectura automatica deterministica</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Resumen ejecutivo</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">{summary.narrative}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{summary.priorityFocus}</p>
        </div>
        <span className={`w-fit rounded border px-3 py-1.5 text-xs font-bold ${levelClass(summary.level)}`}>
          Exposicion {statusLabel(summary.level).toLowerCase()}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <InsightButton
          label="Mayor P95 individual"
          risk={summary.p95Leader}
          value={summary.p95Leader ? `${formatRiskNumber(summary.p95Leader.p95)} ${unitSuffix}` : '-'}
          onSelectRisk={onSelectRisk}
        />
        <InsightButton
          label="Mayor prob. critica"
          risk={summary.criticalProbabilityLeader}
          value={summary.criticalProbabilityLeader ? formatRiskProbability(summary.criticalProbabilityLeader.criticalProbability) : '-'}
          onSelectRisk={onSelectRisk}
        />
        <InsightButton
          label="Mayor media"
          risk={summary.expectedExposureLeader}
          value={summary.expectedExposureLeader ? `${formatRiskNumber(summary.expectedExposureLeader.expectedValue)} ${unitSuffix}` : '-'}
          onSelectRisk={onSelectRisk}
        />
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <div className="text-xs font-bold uppercase text-slate-500">Altos / criticos</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{formatRiskNumber(summary.highOrCriticalCount)}</div>
          <div className="mt-1 text-xs text-slate-600">Riesgos priorizados por estado</div>
        </div>
      </div>
    </section>
  );
}
