import TcdxIcon from '@/components/icons/TcdxIcon';
import {
  formatRiskNumber,
  formatRiskProbability,
  statusLabel,
  type QuantitativeRisk,
} from './riskSimulationUtils';

type RiskSimulationDetailPanelProps = {
  risk: QuantitativeRisk | null;
};

function row(label: string, value: string) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function statusClass(status: QuantitativeRisk['status']) {
  if (status === 'critico') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'alto') return 'border-orange-200 bg-orange-50 text-orange-800';
  if (status === 'medio') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

export default function RiskSimulationDetailPanel({ risk }: RiskSimulationDetailPanelProps) {
  if (!risk) {
    return (
      <aside className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Selecciona un riesgo en la matriz o en la tabla para ver su ficha cuantitativa.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{risk.code}</div>
          <h2 className="mt-1 text-lg font-bold text-blue-700">{risk.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{risk.normName} · {risk.processName}</p>
        </div>
        <span className={`shrink-0 rounded border px-2.5 py-1 text-xs font-bold ${statusClass(risk.status)}`}>
          {statusLabel(risk.status)}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <div className="bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">Entradas</div>
        {row(
          'Frecuencia (min/prob/max)',
          `${formatRiskNumber(risk.frequencyMin, 2)} / ${formatRiskNumber(risk.frequencyMostLikely, 2)} / ${formatRiskNumber(risk.frequencyMax, 2)}`
        )}
        {row(
          'Impacto (min/prob/max)',
          `${formatRiskNumber(risk.impactMin, 2)} / ${formatRiskNumber(risk.impactMostLikely, 2)} / ${formatRiskNumber(risk.impactMax, 2)} h`
        )}
        {row('Iteraciones', formatRiskNumber(risk.iterations))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <div className="bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">Resultados</div>
        {row('Media', `${formatRiskNumber(risk.expectedValue)} h`)}
        {row('P90', `${formatRiskNumber(risk.p90)} h`)}
        {row('P95', `${formatRiskNumber(risk.p95)} h`)}
        {row(
          risk.criticalThreshold ? `Prob. > ${formatRiskNumber(risk.criticalThreshold)} h` : 'Prob. umbral',
          formatRiskProbability(risk.criticalProbability)
        )}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
          <TcdxIcon name="plan" className="h-4 w-4 text-blue-700" />
          Accion sugerida
        </div>
        <div className="px-3 py-3 text-sm leading-6 text-slate-700">{risk.suggestedAction}</div>
      </div>
    </aside>
  );
}
