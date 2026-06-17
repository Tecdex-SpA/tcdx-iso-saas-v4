import {
  statusLabel,
  type QuantitativeRisk,
} from './riskSimulationUtils';

type BetaPertRiskMatrixProps = {
  risks: QuantitativeRisk[];
  selectedRiskId?: string;
  onSelectRisk: (risk: QuantitativeRisk) => void;
};

const probabilityLabels = [
  { value: 1, label: 'Rara', hint: '<5%' },
  { value: 2, label: 'Poco probable', hint: '5-15%' },
  { value: 3, label: 'Posible', hint: '15-30%' },
  { value: 4, label: 'Probable', hint: '30-50%' },
  { value: 5, label: 'Casi cierta', hint: '>=50%' },
];

const impactLabels = [
  { value: 1, label: 'Insignificante' },
  { value: 2, label: 'Menor' },
  { value: 3, label: 'Moderado' },
  { value: 4, label: 'Mayor' },
  { value: 5, label: 'Catastrofico' },
];

function heatmapColor(probability: number, impact: number) {
  const score = probability * impact;
  if (score >= 20) return 'from-red-600 to-red-500';
  if (score >= 16) return 'from-red-500 to-orange-500';
  if (score >= 10) return 'from-orange-400 to-amber-300';
  if (score >= 5) return 'from-yellow-300 to-emerald-200';
  return 'from-emerald-300 to-emerald-200';
}

function pointTone(status: QuantitativeRisk['status']) {
  if (status === 'critico') return 'border-red-600 bg-red-50 text-red-700';
  if (status === 'alto') return 'border-orange-500 bg-orange-50 text-orange-700';
  if (status === 'medio') return 'border-amber-500 bg-amber-50 text-amber-800';
  return 'border-emerald-500 bg-emerald-50 text-emerald-800';
}

export default function BetaPertRiskMatrix({
  risks,
  selectedRiskId,
  onSelectRisk,
}: BetaPertRiskMatrixProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Matriz cuantitativa de riesgo</h2>
          <p className="text-sm text-slate-500">Posicion calculada con simulacion Beta-PERT / Monte Carlo.</p>
        </div>
        <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          {risks.length} riesgo(s)
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[120px_repeat(5,minmax(96px,1fr))] gap-1">
            <div className="flex items-end justify-center pb-2 text-xs font-bold uppercase text-slate-500">
              Impacto
            </div>
            {probabilityLabels.map((item) => (
              <div key={item.value} className="px-2 pb-2 text-center">
                <div className="text-sm font-bold text-slate-900">{item.value}</div>
                <div className="text-xs font-medium text-slate-600">{item.label}</div>
                <div className="text-[11px] text-slate-400">{item.hint}</div>
              </div>
            ))}

            {[5, 4, 3, 2, 1].map((impact) => {
              const impactLabel = impactLabels.find((item) => item.value === impact);

              return (
                <div key={`row-${impact}`} className="contents">
                  <div className="flex min-h-[82px] flex-col justify-center rounded border border-slate-200 bg-slate-50 px-3 text-right">
                    <div className="text-sm font-bold text-slate-950">{impact}</div>
                    <div className="text-xs font-medium text-slate-600">{impactLabel?.label}</div>
                  </div>

                  {[1, 2, 3, 4, 5].map((probability) => {
                    const cellRisks = risks.filter(
                      (risk) => risk.probabilityScore === probability && risk.impactScore === impact
                    );

                    return (
                      <div
                        key={`${probability}-${impact}`}
                        className={[
                          'relative min-h-[82px] rounded border border-white bg-gradient-to-br p-2 shadow-inner',
                          heatmapColor(probability, impact),
                        ].join(' ')}
                      >
                        <div className="flex flex-wrap gap-1">
                          {cellRisks.slice(0, 5).map((risk) => {
                            const active = risk.id === selectedRiskId;

                            return (
                              <button
                                key={risk.id}
                                type="button"
                                onClick={() => onSelectRisk(risk)}
                                title={`${risk.code}: ${risk.name} (${statusLabel(risk.status)})`}
                                className={[
                                  'rounded-full border px-2 py-1 text-[11px] font-bold shadow-sm transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                  pointTone(risk.status),
                                  active ? 'ring-2 ring-blue-700 ring-offset-2' : '',
                                ].join(' ')}
                              >
                                {risk.code}
                              </button>
                            );
                          })}
                          {cellRisks.length > 5 && (
                            <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-slate-700">
                              +{cellRisks.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-[120px_repeat(5,minmax(96px,1fr))] gap-1">
            <div />
            {probabilityLabels.map((item) => (
              <div key={`foot-${item.value}`} className="text-center text-xs font-semibold text-slate-700">
                {item.label}
              </div>
            ))}
          </div>
          <div className="mt-1 text-center text-sm font-bold text-slate-950">Probabilidad</div>
        </div>
      </div>
    </section>
  );
}
