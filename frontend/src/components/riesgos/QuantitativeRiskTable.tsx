import {
  buildRiskTreatmentRecommendation,
  formatRiskNumber,
  formatRiskProbability,
  getRiskContributionPercent,
  statusLabel,
  type QuantitativeRisk,
} from './riskSimulationUtils';

type QuantitativeRiskTableProps = {
  risks: QuantitativeRisk[];
  selectedRiskId?: string;
  totalP95?: number;
  onSelectRisk: (risk: QuantitativeRisk) => void;
  onEditRisk?: (risk: QuantitativeRisk) => void;
  onGenerateRecommendation?: (risk: QuantitativeRisk) => void;
  recommendationLoadingId?: string;
  canEditRisk?: boolean;
  canCreateRecommendation?: boolean;
};

function statusClass(status: QuantitativeRisk['status']) {
  if (status === 'critico') return 'bg-red-100 text-red-800';
  if (status === 'alto') return 'bg-orange-100 text-orange-800';
  if (status === 'medio') return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-800';
}

export default function QuantitativeRiskTable({
  risks,
  selectedRiskId,
  totalP95 = 0,
  onSelectRisk,
  onEditRisk,
  onGenerateRecommendation,
  recommendationLoadingId,
  canEditRisk = false,
  canCreateRecommendation = false,
}: QuantitativeRiskTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-950">Riesgos evaluados</h2>
        <span className="text-xs font-semibold text-slate-500">{risks.length} registro(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Riesgo</th>
              <th className="px-4 py-3">Norma</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Media</th>
              <th className="px-4 py-3">P95</th>
              <th className="px-4 py-3">Contrib. P95</th>
              <th className="px-4 py-3">% critico</th>
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {risks.map((risk) => {
              const selected = selectedRiskId === risk.id;
              const loading = recommendationLoadingId === risk.id;
              const treatment = buildRiskTreatmentRecommendation(risk);
              const p95Contribution = getRiskContributionPercent(risk.p95, totalP95);

              return (
                <tr
                  key={risk.id}
                  className={[
                    'cursor-pointer align-top transition hover:bg-blue-50/60',
                    selected ? 'bg-blue-50' : 'bg-white',
                  ].join(' ')}
                  onClick={() => onSelectRisk(risk)}
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-950">{risk.code}: {risk.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{risk.processName}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{risk.normName}</td>
                  <td className="px-4 py-3 text-slate-700">{risk.unit}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatRiskNumber(risk.expectedValue)} h</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatRiskNumber(risk.p95)} h</td>
                  <td className="px-4 py-3 text-slate-700">{formatRiskNumber(p95Contribution, 1)}%</td>
                  <td className="px-4 py-3 text-slate-700">{formatRiskProbability(risk.criticalProbability)}</td>
                  <td className="px-4 py-3 text-slate-700">{treatment?.priority || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${statusClass(risk.status)}`}>
                      {statusLabel(risk.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditRisk?.(risk);
                        }}
                        disabled={!canEditRisk || !onEditRisk}
                        className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onGenerateRecommendation?.(risk);
                        }}
                        disabled={!canCreateRecommendation || !onGenerateRecommendation || loading}
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Generando...' : 'Recomendacion'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {risks.length === 0 && (
        <div className="px-5 py-8 text-sm text-slate-500">
          No hay riesgos evaluados para los filtros seleccionados.
        </div>
      )}
    </section>
  );
}
