import {
  getAiAuditorPayload,
  type QuantitativeRisk,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type AiAuditorOperationalRiskPanelProps = {
  risks: QuantitativeRisk[];
  selectedRisk: QuantitativeRisk | null;
  kpis: QuantitativeRiskKpis;
};

export default function AiAuditorOperationalRiskPanel({
  risks,
  selectedRisk,
  kpis,
}: AiAuditorOperationalRiskPanelProps) {
  const payload = getAiAuditorPayload(risks, selectedRisk, kpis);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">AI Auditor v4</h2>
          <p className="text-sm leading-6 text-slate-600">
            No disponible en esta version para analisis operacional Beta-PERT.
          </p>
        </div>
        <span className="w-fit rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
          Preparado
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        La vista ya entrega lectura automatica deterministica. La integracion con AI Auditor v4 queda preparada para conectar un endpoint de analisis operacional cuando este disponible.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">Riesgos incluidos</div>
          <div className="mt-1 text-lg font-bold text-slate-950">{payload.risks.length}</div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">Riesgo seleccionado</div>
          <div className="mt-1 truncate text-sm font-bold text-slate-950">{payload.selectedRisk?.name || '-'}</div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">Payload seguro</div>
          <div className="mt-1 text-sm font-bold text-slate-950">KPIs + resumen estructurado</div>
        </div>
      </div>
    </section>
  );
}
