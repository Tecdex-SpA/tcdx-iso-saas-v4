import { useMemo, useState } from 'react';
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
  includeWebContext: boolean;
  webContextAvailable: boolean;
  error?: string;
  successMessage?: string;
  onIncludeWebContextChange: (value: boolean) => void;
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
        record.evidencia ||
        record.criterio ||
        record.causa ||
        record.condicion_residual ||
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
  const visible = (items || []).map(stringifyItem).filter(Boolean).slice(0, 8);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(8,25,58,0.04)]">
      <div className="text-sm font-bold text-slate-950">{title}</div>
      {visible.length === 0 ? (
        <div className="mt-2 text-sm text-slate-500">Sin elementos reportados.</div>
      ) : (
        <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm leading-6 text-slate-700">
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

type DetailTab = 'resumen' | 'prioritarios' | 'acciones' | 'controles' | 'web' | 'metodologia';

function jobMatchesDate(job: OperationalAiAnalysisJob, dateFilter: string) {
  if (dateFilter === 'all') return true;
  const rawDate = job.completed_at || job.created_at;
  if (!rawDate) return false;
  const created = new Date(rawDate).getTime();
  if (!Number.isFinite(created)) return false;
  const now = Date.now();
  if (dateFilter === 'today') return created >= new Date().setHours(0, 0, 0, 0);
  if (dateFilter === '7d') return now - created <= 7 * 24 * 60 * 60 * 1000;
  return true;
}

function webStatusLabel(status?: string) {
  if (status === 'used') return 'Contexto externo incluido';
  if (status === 'disabled_for_tenant') return 'Contexto externo no disponible para este tenant';
  if (status === 'failed') return 'Contexto externo fallido';
  return 'Contexto externo no solicitado';
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
  includeWebContext,
  webContextAvailable,
  error = '',
  successMessage = '',
  onIncludeWebContextChange,
  onGenerate,
  onSave,
  onUseJobAnalysis,
}: AiAuditorOperationalRiskPanelProps) {
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<'all' | OperationalAiAnalysisJob['status']>('all');
  const [historyDate, setHistoryDate] = useState<'all' | 'today' | '7d'>('all');
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
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
  const filteredJobs = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (historyStatus !== 'all' && job.status !== historyStatus) return false;
      if (!jobMatchesDate(job, historyDate)) return false;
      if (!search) return true;
      const text = [
        job.status,
        job.ai_model || '',
        job.error_code || '',
        job.error_message || '',
        job.analysis_json?.diagnostico_ejecutivo || '',
        job.analysis_json?.lectura_portafolio || '',
        job.analysis_json?.resumen_ejecutivo || '',
      ].join(' ').toLowerCase();
      return text.includes(search);
    });
  }, [historyDate, historySearch, historyStatus, jobs]);
  const webContext = analysis?.web_context;
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'prioritarios', label: 'Riesgos' },
    { id: 'acciones', label: 'Acciones y evidencias' },
    { id: 'controles', label: 'Controles ISO' },
    { id: 'web', label: 'Contexto externo' },
    { id: 'metodologia', label: 'Metodologia' },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-blue-100 bg-[linear-gradient(135deg,#f0f7ff_0%,#ffffff_46%,#f8fbff_100%)] p-5 shadow-[0_14px_38px_rgba(8,25,58,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 shadow-sm sm:flex">
            AI
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">AI operacional</div>
            <h2 className="mt-1 text-lg font-bold text-slate-950">AI Auditor v4</h2>
            <p className="text-sm leading-6 text-slate-600">
              Analisis operacional bajo demanda con ai-engine. No se ejecuta automaticamente y requiere revision humana.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Generar analisis AI Auditor'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar como recomendacion'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-100 bg-white/80 px-4 py-3 text-sm text-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeWebContext}
            disabled={!webContextAvailable || loading}
            onChange={(event) => onIncludeWebContextChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-semibold text-slate-900">Incluir contexto externo web</span>
        </label>
        <span className="text-xs text-slate-500">
          {webContextAvailable
            ? 'Usa consultas sanitizadas y genericas; no envia datos sensibles del tenant.'
            : 'Requiere web_research habilitado para este tenant.'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white/85 px-3 py-2 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Riesgos incluidos</div>
          <div className="mt-1 text-lg font-bold text-slate-950">{payload.risks.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/85 px-3 py-2 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Asociacion para guardado</div>
          <div className="mt-1 truncate text-sm font-bold text-slate-950">{selectedRisk?.name || 'Seleccione un riesgo'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/85 px-3 py-2 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">P95 conservador</div>
          <div className="mt-1 text-sm font-bold text-slate-950">{formatRiskNumber(kpis.conservativeP95)} h</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/85 px-3 py-2 shadow-sm md:col-span-3">
          <div className="text-xs font-bold uppercase text-slate-500">Contexto externo</div>
          <div className="mt-1 text-sm font-bold text-slate-950">
            {includeWebContext && webContextAvailable ? 'Solicitado para el proximo job' : webStatusLabel(webContext?.status)}
          </div>
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
        <div className="mt-4 rounded-lg border border-dashed border-blue-200 bg-white/70 px-4 py-5 text-sm leading-6 text-slate-600">
          Genera un analisis AI cuando necesites lectura adicional. Si ai-engine no esta disponible o el tenant no tiene IA habilitada, la vista mantendra la lectura deterministica sin presentarla como IA.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-blue-200 bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-bold text-blue-950">Diagnostico ejecutivo</div>
            <p className="mt-2 text-sm leading-6 text-blue-950">{analysis.resumen_ejecutivo || analysis.diagnostico_ejecutivo}</p>
            {analysis.lectura_portafolio && (
              <p className="mt-2 text-sm leading-6 text-blue-900">{analysis.lectura_portafolio}</p>
            )}
            <div className="mt-2 text-xs font-semibold text-blue-800">
              Fuente: {engineLabel} - Modelo: {analysis.ai_model || 'ai-engine'} - Modo: {analysis.generation_mode || 'no verificable'} - Prompt: {analysis.prompt_version || 'beta-pert-operational-risk-v1'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-bold ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {activeTab === 'resumen' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Lectura cuantitativa" items={[
                    `Exposicion acumulada: ${formatRiskNumber(Number(analysis.lectura_cuantitativa?.exposicion_esperada_acumulada || 0))}`,
                    `P95 conservador: ${formatRiskNumber(Number(analysis.lectura_cuantitativa?.p95_agregado_conservador || 0))}`,
                    String(analysis.lectura_cuantitativa?.advertencia_p95 || 'P95 agregado conservador no equivale a P95 de portafolio simulado.'),
                  ]} />
                  <ListBlock title="Hipotesis operativas" items={analysis.hipotesis_operativas || []} />
                  <ListBlock title="Datos faltantes" items={analysis.datos_faltantes || []} />
                  <ListBlock title="Nivel de confianza" items={[
                    `${analysis.nivel_confianza?.nivel || 'medio'}: ${analysis.nivel_confianza?.justificacion || 'Revision humana requerida.'}`,
                    ...((analysis.nivel_confianza?.factores || []) as unknown[]),
                  ]} />
                </div>
              )}
              {activeTab === 'prioritarios' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Riesgos prioritarios" items={analysis.riesgos_prioritarios || []} />
                  <ListBlock title="Concentracion de exposicion" items={analysis.concentracion_exposicion || []} />
                  <ListBlock title="Causas probables" items={analysis.causas_probables || []} />
                  <ListBlock title="Riesgos residuales" items={analysis.riesgos_residuales || []} />
                </div>
              )}
              {activeTab === 'acciones' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Acciones de tratamiento" items={analysis.acciones_tratamiento || analysis.acciones_sugeridas || []} />
                  <ListBlock title="Evidencia requerida" items={analysis.evidencia_requerida || []} />
                  <ListBlock title="Criterios de cierre" items={analysis.criterios_cierre || []} />
                  <ListBlock title="Proximos pasos" items={analysis.proximos_pasos || []} />
                </div>
              )}
              {activeTab === 'controles' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Controles ISO sugeridos" items={analysis.controles_iso_sugeridos || []} />
                  <ListBlock title="Uso sugerido" items={analysis.uso_sugerido || []} />
                </div>
              )}
              {activeTab === 'web' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title={webStatusLabel(webContext?.status)} items={[
                    ...(webContext?.queries || []),
                    webContext?.message || webContext?.error || '',
                  ].filter(Boolean)} />
                  <ListBlock title="Fuentes externas" items={(webContext?.sources || []).map((source) => `${source.title || 'Fuente'} - ${source.url || ''}`)} />
                  <ListBlock title="Insights externos" items={webContext?.external_insights || []} />
                  <ListBlock title="Referencias de control externas" items={webContext?.external_control_references || []} />
                </div>
              )}
              {activeTab === 'metodologia' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Advertencias metodologicas" items={analysis.advertencias_metodologicas || []} />
                  <ListBlock title="Revision humana" items={[
                    'El analisis AI queda como insumo operacional; requiere validacion humana antes de plan de accion o decision formal.',
                    'No afirma certificacion ni cumplimiento ISO.',
                    'No calcula P95 de portafolio con correlaciones.',
                  ]} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-slate-200 bg-white/86 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-950">Historial de analisis AI</div>
            <div className="text-xs text-slate-500">
              Se carga al seleccionar un riesgo/simulacion. Los intentos fallidos tambien quedan registrados.
            </div>
          </div>
          {historyLoading && <span className="text-xs font-semibold text-slate-500">Cargando...</span>}
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_160px_160px]">
          <input
            type="search"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Buscar diagnostico, error o modelo"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={historyStatus}
            onChange={(event) => setHistoryStatus(event.target.value as 'all' | OperationalAiAnalysisJob['status'])}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todos</option>
            <option value="completed">Completados</option>
            <option value="running">En proceso</option>
            <option value="pending">Pendientes</option>
            <option value="timeout">Timeout</option>
            <option value="failed">Fallidos</option>
          </select>
          <select
            value={historyDate}
            onChange={(event) => setHistoryDate(event.target.value as 'all' | 'today' | '7d')}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="7d">Ultimos 7 dias</option>
          </select>
        </div>

        {jobs.length === 0 ? (
          <div className="mt-3 rounded border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
            Sin analisis AI registrados para la simulacion seleccionada.
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="mt-3 rounded border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
            No hay analisis que coincidan con los filtros.
          </div>
        ) : (
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {filteredJobs.map((job) => (
              <div key={job.id} className="rounded border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-bold ${statusClassName(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(job.completed_at || job.created_at)}</span>
                      {job.ai_model && <span className="text-xs text-slate-500">{job.ai_model}</span>}
                      {job.request_payload_json?.include_web_context && <span className="text-xs text-slate-500">web</span>}
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
