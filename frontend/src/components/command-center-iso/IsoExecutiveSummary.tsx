import type { IsoCommandSummary } from './types';
import { formatNumber, formatPercent, label, scoreBarClass } from './utils';

type Props = {
  summary: IsoCommandSummary;
};

export default function IsoExecutiveSummary({ summary }: Props) {
  const cards = [
    { label: 'Normas activas', value: formatNumber(summary.active_standards), detail: `${summary.certifiable_standards} certificables` },
    { label: 'Cobertura normativa', value: formatPercent(summary.coverage_pct), detail: `${summary.iso_controls_linked}/${summary.iso_controls_total} controles mapeados` },
    { label: 'Acciones pendientes', value: formatNumber(summary.recommended_actions_open), detail: `${summary.recommended_actions_converted} convertidas` },
    { label: 'Riesgo alto', value: formatNumber(summary.high_risks), detail: 'Riesgos altos/criticos' },
    { label: 'Brechas operativas', value: formatNumber(summary.open_findings + summary.open_nonconformities), detail: `${summary.open_action_plans} planes abiertos` },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Readiness general</div>
        <div className="mt-3 flex items-end gap-3">
          <div className="text-5xl font-bold">{formatPercent(summary.readiness_score)}</div>
          <div className="pb-1 text-sm text-slate-300">{label(summary.readiness_label)}</div>
        </div>
        <div className="mt-5 h-2 rounded-full bg-white/15">
          <div
            className={`h-2 rounded-full ${scoreBarClass(summary.readiness_score)}`}
            style={{ width: `${Math.max(4, Math.min(100, Number(summary.readiness_score || 0)))}%` }}
          />
        </div>
      </div>

      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">{card.label}</div>
          <div className="mt-3 text-2xl font-bold text-gray-950">{card.value}</div>
          <div className="mt-1 text-xs text-gray-500">{card.detail}</div>
        </div>
      ))}
    </section>
  );
}
