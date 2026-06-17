import {
  buildRiskTreatmentRecommendation,
  formatRiskNumber,
  type OperationalRiskRecommendationResult,
  type QuantitativeRisk,
} from './riskSimulationUtils';

type QuantitativeRiskRecommendationsProps = {
  risk: QuantitativeRisk | null;
  recommendation?: OperationalRiskRecommendationResult;
  loading?: boolean;
  canGenerateRecommendation?: boolean;
  onGenerateRecommendation?: (risk: QuantitativeRisk) => void;
};

function suggestedControls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return String(record.control || record.nombre || record.name || record.descripcion || record.description || '').trim();
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, 4);
}

export default function QuantitativeRiskRecommendations({
  risk,
  recommendation,
  loading = false,
  canGenerateRecommendation = false,
  onGenerateRecommendation,
}: QuantitativeRiskRecommendationsProps) {
  const treatment = buildRiskTreatmentRecommendation(risk);
  const controls = suggestedControls(recommendation?.controles_sugeridos);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Lectura automatica deterministica</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Recomendaciones de tratamiento</h2>
          <p className="text-sm text-slate-500">Derivadas de estado, scores, exposicion y proceso afectado.</p>
        </div>
        {risk && (
          <button
            type="button"
            onClick={() => onGenerateRecommendation?.(risk)}
            disabled={!canGenerateRecommendation || !onGenerateRecommendation || loading}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Generando...' : 'Generar recomendacion operativa'}
          </button>
        )}
      </div>

      {!risk || !treatment ? (
        <div className="mt-4 rounded border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
          Selecciona un riesgo para ver tratamiento sugerido.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase text-slate-500">{risk.code}: {risk.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold text-slate-500">Tratamiento</div>
                <div className="font-bold text-slate-950">{treatment.treatment}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Prioridad</div>
                <div className="font-bold text-slate-950">{treatment.priority}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Horizonte</div>
                <div className="font-bold text-slate-950">{treatment.horizon}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">P95</div>
                <div className="font-bold text-slate-950">{formatRiskNumber(risk.p95)} h</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-bold text-slate-950">Accion recomendada</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{treatment.action}</p>
            <div className="mt-3 text-sm font-bold text-slate-950">Foco de control</div>
            <p className="mt-1 text-sm leading-6 text-slate-700">{treatment.controlFocus}</p>
            <div className="mt-3 text-sm font-bold text-slate-950">Justificacion</div>
            <p className="mt-1 text-sm leading-6 text-slate-700">{treatment.justification}</p>
          </div>
        </div>
      )}

      {recommendation && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-bold text-emerald-900">Recomendacion operacional generada</div>
          {recommendation.diagnostico_operativo && (
            <p className="mt-2 text-sm leading-6 text-emerald-900">{recommendation.diagnostico_operativo}</p>
          )}
          <div className="mt-2 text-xs font-semibold text-emerald-800">
            Fuente rule-based-operational-v1. Requiere revision humana antes de ejecutar tratamiento.
          </div>
          {controls.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-900">
              {controls.map((control) => (
                <li key={control}>{control}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
