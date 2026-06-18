import {
  formatRiskNumber,
  getAiAuditorPayload,
  type OperationalAiAnalysis,
  type OperationalAiAnalysisJob,
  type QuantitativeRisk,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type AiAuditorOperationalRiskPanelProps = {
  risks: QuantitativeRisk[];
  selectedRisk: QuantitativeRisk | null;
  kpis: QuantitativeRiskKpis;
  analysis: OperationalAiAnalysis | null;
  jobs: OperationalAiAnalysisJob[];
  activeJob: OperationalAiAnalysisJob | null;
  loading: boolean;
  historyLoading: boolean;
  saving: boolean;
  error?: string;
  successMessage?: string;
  onGenerate: () => void;
  onSave: () => void;
  onUseJobAnalysis: (job: OperationalAiAnalysisJob) => void;
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

function statusLabel(status: OperationalAiAnalysisJob['status']) {
  const labels: Record<OperationalAiAnalysisJob['status'], string> = {
    pending: 'Pendiente',
    running: 'En proceso',
    completed: 'Completado',
    failed: 'Fallido',
    timeout: 'Timeout',
  };
  return labels[status] || status;
}

function statusClassName(status: OperationalAiAnalysisJob['status']) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed' || status === 'timeout') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function analysisPreview(job: OperationalAiAnalysisJob) {
  if (job.status === 'completed') {
    return String(job.analysis_json?.diagnostico_ejecutivo || job.analysis_json?.lectura_portafolio || 'Analisis completado.').slice(0, 130);
  }
  return String(job.error_message || 'Intento registrado en historial.').slice(0, 130);
}

export default function AiAuditorOperationalRiskPanel({
  risks,
  selectedRisk,
  kpis,
  analysis,
  jobs,
  activeJob,
  loading,
  historyLoading,
  saving,
  error = '',
  successMessage = '',
  onGenerate,
  onSave,
  onUseJobAnalysis,
}: AiAuditorOperationalRiskPanelProps) {
  const payload = getAiAuditorPayload(risks, selectedRisk, kpis);
  const canGenerate = risks.length > 0 && !loading;
  const canSave = Boolean(
    analysis &&
      analysis.guardable !== false &&
      analysis.ai_engine_used !== false &&
      analysis.generation_mode === 'semantic_plus_llm' &&
      selectedRisk &&
      !saving &&
      !loading
  );
  const engineLabel = analysis?.source === 'ai-engine' || analysis?.ai_engine_used !== false
    ? (analysis?.source === 'ai-engine-operational-beta-pert' ? 'AI operacional Beta-PERT' : 'ai-engine')
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
            {loading ? 'Procesando...' : 'Generar analisis AI Auditor'}
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

      {loading && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Analisis AI en proceso. Esto puede tardar unos minutos segun la carga del motor.
        </div>
      )}

      {activeJob && (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-bold text-slate-950">Job actual:</span>{' '}
          <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-bold ${statusClassName(activeJob.status)}`}>
            {statusLabel(activeJob.status)}
          </span>
          <span className="ml-2">Creado {formatDate(activeJob.created_at)}</span>
          {activeJob.ai_model && <span className="ml-2">Modelo: {activeJob.ai_model}</span>}
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
            {analysis.lectura_portafolio && (
              <p className="mt-2 text-sm leading-6 text-blue-900">{analysis.lectura_portafolio}</p>
            )}
            <div className="mt-2 text-xs font-semibold text-blue-800">
              Fuente: {engineLabel} - Modelo: {analysis.ai_model || 'ai-engine'} - Modo: {analysis.generation_mode || 'no verificable'} - Prompt: {analysis.prompt_version || 'beta-pert-operational-risk-v1'}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ListBlock title="Riesgos prioritarios" items={analysis.riesgos_prioritarios || []} />
            <ListBlock title="Concentracion de exposicion" items={analysis.concentracion_exposicion || []} />
            <ListBlock title="Acciones sugeridas" items={analysis.acciones_sugeridas || []} />
            <ListBlock title="Controles ISO sugeridos" items={analysis.controles_iso_sugeridos || []} />
            <ListBlock title="Advertencias metodologicas" items={analysis.advertencias_metodologicas || []} />
            <ListBlock title="Proximos pasos" items={analysis.proximos_pasos || []} />
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-950">Historial de analisis AI</div>
            <div className="text-xs text-slate-500">
              Se carga al seleccionar un riesgo/simulacion. Los intentos fallidos tambien quedan registrados.
            </div>
          </div>
          {historyLoading && <span className="text-xs font-semibold text-slate-500">Cargando...</span>}
        </div>

        {jobs.length === 0 ? (
          <div className="mt-3 rounded border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
            Sin analisis AI registrados para la simulacion seleccionada.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {jobs.slice(0, 8).map((job) => (
              <div key={job.id} className="rounded border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-bold ${statusClassName(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(job.completed_at || job.created_at)}</span>
                      {job.ai_model && <span className="text-xs text-slate-500">{job.ai_model}</span>}
                    </div>
                    <div className="mt-2 text-sm leading-5 text-slate-700">{analysisPreview(job)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUseJobAnalysis(job)}
                    disabled={job.status !== 'completed' || !job.analysis_json}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Usar este analisis
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
