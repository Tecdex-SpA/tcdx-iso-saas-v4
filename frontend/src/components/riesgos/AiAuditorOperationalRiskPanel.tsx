import {
  formatRiskNumber,
  getAiAuditorPayload,
  type OperationalAiAnalysis,
  type QuantitativeRisk,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type AiAuditorOperationalRiskPanelProps = {
  risks: QuantitativeRisk[];
  selectedRisk: QuantitativeRisk | null;
  kpis: QuantitativeRiskKpis;
  analysis: OperationalAiAnalysis | null;
  loading: boolean;
  saving: boolean;
  error?: string;
  successMessage?: string;
  onGenerate: () => void;
  onSave: () => void;
};

function stringifyItem(item: unknown) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    return String(
      record.riesgo ||
        record.risk ||
        record.accion ||
        record.action ||
        record.control ||
        record.name ||
        record.title ||
        record.descripcion ||
        record.description ||
        JSON.stringify(record)
    );
  }
  return String(item || '');
}

function ListBlock({ title, items }: { title: string; items: unknown[] }) {
  const visible = (items || []).map(stringifyItem).filter(Boolean).slice(0, 6);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold text-slate-950">{title}</div>
      {visible.length === 0 ? (
        <div className="mt-2 text-sm text-slate-500">Sin elementos reportados.</div>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {visible.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiAuditorOperationalRiskPanel({
  risks,
  selectedRisk,
  kpis,
  analysis,
  loading,
  saving,
  error = '',
  successMessage = '',
  onGenerate,
  onSave,
}: AiAuditorOperationalRiskPanelProps) {
  const payload = getAiAuditorPayload(risks, selectedRisk, kpis);
  const canGenerate = risks.length > 0 && !loading;
  const canSave = Boolean(
    analysis &&
      analysis.guardable !== false &&
      analysis.ai_engine_used !== false &&
      selectedRisk &&
      !saving &&
      !loading
  );
  const engineLabel = analysis?.source === 'ai-engine' || analysis?.ai_engine_used !== false
    ? 'ai-engine'
    : 'origen no verificable';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">AI Auditor v4</h2>
          <p className="text-sm leading-6 text-slate-600">
            Analisis operacional bajo demanda con ai-engine. No se ejecuta automaticamente y requiere revision humana.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Generando...' : 'Generar analisis AI Auditor'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar como recomendacion'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">Riesgos incluidos</div>
          <div className="mt-1 text-lg font-bold text-slate-950">{payload.risks.length}</div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">Asociacion para guardado</div>
          <div className="mt-1 truncate text-sm font-bold text-slate-950">{selectedRisk?.name || 'Seleccione un riesgo'}</div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-bold uppercase text-slate-500">P95 conservador</div>
          <div className="mt-1 text-sm font-bold text-slate-950">{formatRiskNumber(kpis.conservativeP95)} h</div>
        </div>
      </div>

      {!selectedRisk && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Selecciona una simulacion/riesgo para poder guardar el analisis AI como recomendacion operacional.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {!analysis ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
          Genera un analisis AI cuando necesites lectura adicional. Si ai-engine no esta disponible o el tenant no tiene IA habilitada, la vista mantendra la lectura deterministica sin presentarla como IA.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-bold text-blue-950">Diagnostico ejecutivo</div>
            <p className="mt-2 text-sm leading-6 text-blue-950">{analysis.diagnostico_ejecutivo}</p>
            <div className="mt-2 text-xs font-semibold text-blue-800">
              Fuente: {engineLabel} - Modelo: {analysis.ai_model || 'ai-engine'} - Prompt: {analysis.prompt_version || 'beta-pert-operational-risk-v1'}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ListBlock title="Riesgos prioritarios" items={analysis.riesgos_prioritarios || []} />
            <ListBlock title="Acciones sugeridas" items={analysis.acciones_sugeridas || []} />
            <ListBlock title="Controles ISO sugeridos" items={analysis.controles_iso_sugeridos || []} />
            <ListBlock title="Advertencias metodologicas" items={analysis.advertencias_metodologicas || []} />
            <ListBlock title="Proximos pasos" items={analysis.proximos_pasos || []} />
          </div>
        </div>
      )}
    </section>
  );
}
