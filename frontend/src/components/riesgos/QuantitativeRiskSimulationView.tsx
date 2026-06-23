'use client';

import { useEffect, useMemo, useState } from 'react';
import AiAuditorOperationalRiskPanel from './AiAuditorOperationalRiskPanel';
import BetaPertRiskMatrix from './BetaPertRiskMatrix';
import QuantitativeRiskContributors from './QuantitativeRiskContributors';
import QuantitativeRiskDashboard from './QuantitativeRiskDashboard';
import QuantitativeRiskExecutiveSummary from './QuantitativeRiskExecutiveSummary';
import QuantitativeRiskMethodologyNote from './QuantitativeRiskMethodologyNote';
import QuantitativeRiskRecommendations from './QuantitativeRiskRecommendations';
import QuantitativeRiskTable from './QuantitativeRiskTable';
import RiskSimulationDetailPanel from './RiskSimulationDetailPanel';
import OperationalRiskSimulationForm, {
  type OperationalRiskSimulationFormState,
} from './OperationalRiskSimulationForm';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  EnterpriseCard,
  EnterpriseEmptyState,
} from '@/components/ui/enterprise';
import {
  DEFAULT_QUANTITATIVE_FILTERS,
  HORIZON_OPTIONS,
  buildQuantitativeRisks,
  calculateQuantitativeRiskKpis,
  filterQuantitativeRisks,
  getAiAuditorPayload,
  normalizeNormId,
  type OperationalAiAnalysis,
  type OperationalAiAnalysisJob,
  type OperationalRiskRecommendationResult,
  type OperationalRiskSimulationRow,
  type QuantitativeRisk,
  type QuantitativeRiskFilters,
} from './riskSimulationUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type FilterOption = {
  value: string;
  label: string;
};

type QuantitativeRiskSimulationViewProps = {
  form: OperationalRiskSimulationFormState;
  simulations: OperationalRiskSimulationRow[];
  loading: boolean;
  formLoading: boolean;
  error?: string;
  message?: string;
  standardOptions?: FilterOption[];
  canCreateSimulation?: boolean;
  canCreateRecommendation?: boolean;
  recommendationLoadingId?: string;
  recommendationsBySimulationId?: Record<string, OperationalRiskRecommendationResult>;
  selectedSimulationId?: string;
  isEditingSimulation?: boolean;
  editingSimulationLabel?: string;
  submitLabel?: string;
  onFormChange: (field: keyof OperationalRiskSimulationFormState, value: string) => void;
  onSubmitSimulation: () => void;
  onCancelEditing?: () => void;
  onSelectSimulation?: (simulationId: string) => void;
  onEditRisk?: (risk: QuantitativeRisk) => void;
  onRefresh: () => void;
  onGenerateRecommendation?: (simulationId: string) => void;
};

function selectClassName() {
  return 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function horizonLabel(value: QuantitativeRiskFilters['horizon']) {
  return HORIZON_OPTIONS.find((option) => option.value === value)?.label || 'Anual';
}

function aiErrorMessage(code: string, fallback: string) {
  const normalized = String(code || '').toLowerCase();
  const messages: Record<string, string> = {
    ai_disabled_for_tenant: 'AI Auditor no esta habilitado para esta empresa.',
    ai_feature_not_enabled: 'La funcionalidad AI Auditor no esta habilitada para esta empresa.',
    ai_engine_unconfigured: 'El motor AI no esta configurado para analisis operacional.',
    ai_engine_unavailable: 'AI Auditor no esta disponible temporalmente. Intenta nuevamente mas tarde.',
    ai_invalid_payload: 'No hay datos de riesgo suficientes para generar analisis AI.',
    ai_invalid_response: 'AI Auditor respondio sin la estructura requerida para Beta-PERT.',
    ai_timeout: 'AI Auditor excedio el tiempo de respuesta. Intenta nuevamente.',
    ai_forbidden: 'No tienes permisos para ejecutar AI Auditor sobre estos riesgos.',
    ai_unknown_error: 'No fue posible completar el analisis AI Auditor.',
  };
  return messages[normalized] || fallback || messages.ai_unknown_error;
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return { json: body ? JSON.parse(body) : null, text: body };
    } catch {
      return { json: null, text: body };
    }
  }
  return { json: null, text: body };
}

function nonJsonAiError(response: Response, text: string) {
  const normalized = String(text || '').toLowerCase();
  if (response.status === 504 || normalized.includes('gateway time-out') || normalized.includes('gateway timeout')) {
    return 'AI Auditor tardo demasiado en responder. Reintente con menos riesgos o mas tarde.';
  }
  if (normalized.includes('<html') || normalized.includes('<!doctype')) {
    return 'El backend devolvio una respuesta no JSON para el analisis AI.';
  }
  return 'No fue posible leer la respuesta del analisis AI Auditor.';
}

export default function QuantitativeRiskSimulationView({
  form,
  simulations,
  loading,
  formLoading,
  error = '',
  message = '',
  standardOptions = [],
  canCreateSimulation = false,
  canCreateRecommendation = false,
  recommendationLoadingId = '',
  recommendationsBySimulationId = {},
  selectedSimulationId = '',
  isEditingSimulation = false,
  editingSimulationLabel = '',
  submitLabel,
  onFormChange,
  onSubmitSimulation,
  onCancelEditing,
  onSelectSimulation,
  onEditRisk,
  onRefresh,
  onGenerateRecommendation,
}: QuantitativeRiskSimulationViewProps) {
  const [filters, setFilters] = useState<QuantitativeRiskFilters>(DEFAULT_QUANTITATIVE_FILTERS);
  const [selectedRiskId, setSelectedRiskId] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<OperationalAiAnalysis | null>(null);
  const [aiJobs, setAiJobs] = useState<OperationalAiAnalysisJob[]>([]);
  const [activeAiJob, setActiveAiJob] = useState<OperationalAiAnalysisJob | null>(null);
  const [aiPollingJobId, setAiPollingJobId] = useState('');
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [includeWebContext, setIncludeWebContext] = useState(false);
  const { canUseAiFeature } = useTenantEntitlements();
  const webContextAvailable = canUseAiFeature('web_research');

  const allRisks = useMemo(() => {
    return buildQuantitativeRisks(simulations, filters.horizon);
  }, [simulations, filters.horizon]);

  const normOptions = useMemo(() => {
    const fromRisks = allRisks.map((risk) => ({ value: risk.normId, label: risk.normName }));
    const fromStandards = standardOptions.map((option) => ({
      value: normalizeNormId(option.value),
      label: option.label,
    }));
    const byValue = new Map<string, FilterOption>();

    [...fromStandards, ...fromRisks].forEach((option) => {
      if (option.value) byValue.set(option.value, option);
    });

    return Array.from(byValue.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRisks, standardOptions]);

  const processOptions = useMemo(() => uniqueOptions(allRisks.map((risk) => risk.processName)), [allRisks]);
  const unitOptions = useMemo(() => uniqueOptions(allRisks.map((risk) => risk.unit)), [allRisks]);

  const filteredRisks = useMemo(() => {
    return filterQuantitativeRisks(allRisks, filters);
  }, [allRisks, filters]);

  const kpis = useMemo(() => calculateQuantitativeRiskKpis(filteredRisks), [filteredRisks]);
  const activeSelectedRiskId = selectedSimulationId || selectedRiskId;
  const selectedRisk = useMemo(() => {
    return filteredRisks.find((risk) => risk.id === activeSelectedRiskId) || filteredRisks[0] || null;
  }, [filteredRisks, activeSelectedRiskId]);

  const unitSuffix = filters.unit === 'all' || filters.unit.toLowerCase().includes('hora') ? 'h' : '';
  const selectedRecommendation = selectedRisk ? recommendationsBySimulationId[selectedRisk.id] : undefined;
  const totalP95 = kpis.conservativeP95;
  const totalExpectedExposure = kpis.expectedExposure;

  function updateFilter<Key extends keyof QuantitativeRiskFilters>(key: Key, value: QuantitativeRiskFilters[Key]) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'norm' ? { process: 'all' } : {}),
    }));
  }

  function selectRisk(risk: QuantitativeRisk) {
    setSelectedRiskId(risk.id);
    onSelectSimulation?.(risk.id);
    setAiAnalysis(null);
    setActiveAiJob(null);
    setAiPollingJobId('');
    setAiError('');
    setAiMessage('');
  }

  async function loadAiJobHistory(simulationId: string) {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    try {
      setAiHistoryLoading(true);
      const params = new URLSearchParams({ simulation_id: simulationId, limit: '10' });
      const res = await fetch(`${API_URL}/api/operational-risks/ai-analysis-jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { json, text } = await readApiResponse(res);

      if (!json) {
        throw new Error(nonJsonAiError(res, text));
      }
      if (!res.ok || json?.ok === false) {
        throw new Error(aiErrorMessage(json?.code, json?.message || json?.error || 'No fue posible cargar historial AI.'));
      }

      setAiJobs((json?.data || []) as OperationalAiAnalysisJob[]);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error cargando historial AI Auditor.');
    } finally {
      setAiHistoryLoading(false);
    }
  }

  async function fetchAiJob(jobId: string) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay sesion activa. Ingresa nuevamente antes de consultar el analisis AI.');
    }
    const res = await fetch(`${API_URL}/api/operational-risks/ai-analysis-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { json, text } = await readApiResponse(res);
    if (!json) {
      throw new Error(nonJsonAiError(res, text));
    }
    if (!res.ok || json?.ok === false) {
      throw new Error(aiErrorMessage(json?.code, json?.message || json?.error || 'No fue posible consultar el job AI.'));
    }
    return json?.data?.job as OperationalAiAnalysisJob;
  }

  async function generateAiAnalysis() {
    const token = localStorage.getItem('token');
    if (!token) {
      setAiError('No hay sesion activa. Ingresa nuevamente antes de generar analisis AI.');
      return;
    }

    try {
      setAiLoading(true);
      setAiError('');
      setAiMessage('');
      setAiAnalysis(null);
      setActiveAiJob(null);

      const payload = getAiAuditorPayload(filteredRisks, selectedRisk, kpis, includeWebContext && webContextAvailable);
      const res = await fetch(`${API_URL}/api/operational-risks/ai-analysis-jobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const { json, text } = await readApiResponse(res);

      if (!json) {
        throw new Error(nonJsonAiError(res, text));
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(aiErrorMessage(json?.code, json?.message || json?.error || 'AI Auditor no disponible para analisis operacional.'));
      }

      const jobId = String(json?.data?.job_id || '');
      if (!jobId) {
        throw new Error('El backend no devolvio identificador de job AI.');
      }

      const pendingJob: OperationalAiAnalysisJob = {
        id: jobId,
        status: (json?.data?.status || 'pending') as OperationalAiAnalysisJob['status'],
        simulation_id: selectedRisk?.id || null,
        source_risk_id: selectedRisk?.source.source_risk_id || null,
        created_at: String(json?.data?.created_at || new Date().toISOString()),
      };
      setActiveAiJob(pendingJob);
      setAiJobs((prev) => [pendingJob, ...prev.filter((job) => job.id !== jobId)]);
      setAiPollingJobId(jobId);
      setAiMessage('Analisis AI en proceso. Puedes seguir trabajando; el resultado aparecera en el historial.');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error generando analisis AI Auditor.');
      setAiLoading(false);
      setAiPollingJobId('');
    }
  }

  function useCompletedJob(job: OperationalAiAnalysisJob) {
    if (job.status !== 'completed' || !job.analysis_json) return;
    setActiveAiJob(job);
    setAiAnalysis(job.analysis_json);
    setAiError('');
    setAiMessage('Analisis AI completado. Revisa el resultado antes de guardarlo como recomendacion.');
  }

  useEffect(() => {
    if (!selectedRisk?.id) {
      setAiJobs([]);
      return;
    }
    loadAiJobHistory(selectedRisk.id);
  }, [selectedRisk?.id]);

  useEffect(() => {
    if (!aiPollingJobId) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await fetchAiJob(aiPollingJobId);
        if (cancelled) return;

        setActiveAiJob(job);
        setAiJobs((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);

        if (job.status === 'completed') {
          if (job.analysis_json) {
            setAiAnalysis(job.analysis_json);
          }
          setAiMessage('Analisis AI completado. Revisa el resultado antes de guardarlo como recomendacion.');
          setAiLoading(false);
          setAiPollingJobId('');
          if (selectedRisk?.id) loadAiJobHistory(selectedRisk.id);
        } else if (job.status === 'timeout') {
          setAiError('El motor AI excedio el tiempo de generacion. El intento quedo registrado en el historial.');
          setAiLoading(false);
          setAiPollingJobId('');
          if (selectedRisk?.id) loadAiJobHistory(selectedRisk.id);
        } else if (job.status === 'failed') {
          setAiError(job.error_message || 'No fue posible completar el analisis AI. El intento quedo registrado en el historial.');
          setAiLoading(false);
          setAiPollingJobId('');
          if (selectedRisk?.id) loadAiJobHistory(selectedRisk.id);
        } else {
          setAiMessage('Analisis AI en proceso. Esto puede tardar unos minutos segun la carga del motor.');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setAiError(err instanceof Error ? err.message : 'Error consultando estado del analisis AI Auditor.');
        setAiLoading(false);
        setAiPollingJobId('');
      }
    };

    poll();
    const interval = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [aiPollingJobId, selectedRisk?.id]);

  async function saveAiRecommendation() {
    const token = localStorage.getItem('token');
    if (!token) {
      setAiError('No hay sesion activa. Ingresa nuevamente antes de guardar la recomendacion.');
      return;
    }
    if (!selectedRisk) {
      setAiError('Selecciona un riesgo evaluado antes de guardar el analisis AI.');
      return;
    }
    if (!aiAnalysis || aiAnalysis.guardable === false || aiAnalysis.ai_engine_used === false) {
      setAiError('Primero genera un analisis AI real y guardable antes de guardar.');
      return;
    }

    try {
      setAiSaving(true);
      setAiError('');
      setAiMessage('');

      const res = await fetch(`${API_URL}/api/operational-risks/simulations/${selectedRisk.id}/recommendations/ai`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis: aiAnalysis,
          scope: aiAnalysis.scope || 'portfolio',
          selectedRiskId: selectedRisk.id,
        }),
      });
      const { json, text } = await readApiResponse(res);

      if (!json) {
        throw new Error(nonJsonAiError(res, text));
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(aiErrorMessage(json?.code, json?.message || json?.error || 'No fue posible guardar el analisis AI como recomendacion.'));
      }

      setAiMessage('Analisis AI guardado como recomendacion operacional.');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error guardando recomendacion AI operacional.');
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <EnterpriseCard>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Segmentacion operacional</div>
            <h3 className="mt-1 text-base font-bold text-slate-950">Filtros de simulacion</h3>
          </div>
          <div className="text-xs text-slate-500">Actualiza KPI, matriz, panel y tabla sin cambiar datos guardados.</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <span className="text-xs font-bold text-slate-600">Riesgo evaluado</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Buscar por riesgo, codigo o proceso"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Norma</span>
            <select
              value={filters.norm}
              onChange={(event) => updateFilter('norm', event.target.value)}
              className={selectClassName()}
            >
              <option value="all">Todas</option>
              {normOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Proceso</span>
            <select
              value={filters.process}
              onChange={(event) => updateFilter('process', event.target.value)}
              className={selectClassName()}
            >
              <option value="all">Todos</option>
              {processOptions.map((process) => (
                <option key={process} value={process}>{process}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Unidad de medicion</span>
            <select
              value={filters.unit}
              onChange={(event) => updateFilter('unit', event.target.value)}
              className={selectClassName()}
            >
              <option value="all">Todas</option>
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Criticidad</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className={selectClassName()}
            >
              <option value="all">Todas</option>
              <option value="critico">Critica</option>
              <option value="alto">Alta</option>
              <option value="medio">Media</option>
              <option value="bajo">Baja</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Horizonte</span>
            <select
              value={filters.horizon}
              onChange={(event) => updateFilter('horizon', event.target.value as QuantitativeRiskFilters['horizon'])}
              className={selectClassName()}
            >
              {HORIZON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </EnterpriseCard>

      {loading ? (
        <EnterpriseEmptyState title="Cargando simulaciones operativas..." className="text-sm text-slate-500" />
      ) : simulations.length === 0 ? (
        <EnterpriseEmptyState
          title="Sin simulaciones operativas guardadas"
          description="Ingrese una simulacion operativa para estimar exposicion esperada, P95 conservador y probabilidad critica."
          className="border-dashed border-blue-200 text-sm leading-6 text-slate-600"
          action={
            <>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Minimo</div>
              <div className="text-xs text-slate-500">Escenario optimista razonable.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Mas probable</div>
              <div className="text-xs text-slate-500">Valor esperado por experiencia operacional.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Maximo</div>
              <div className="text-xs text-slate-500">Escenario severo plausible.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Umbral critico</div>
              <div className="text-xs text-slate-500">Limite operacional para medir disrupcion.</div>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
            </>
          }
        />
      ) : (
        <>
          <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <BetaPertRiskMatrix
              risks={filteredRisks}
              selectedRiskId={selectedRisk?.id}
              onSelectRisk={selectRisk}
            />
            <QuantitativeRiskDashboard kpis={kpis} unitSuffix={unitSuffix} variant="sidePanel" />
          </div>

          <QuantitativeRiskMethodologyNote />

          <QuantitativeRiskExecutiveSummary
            risks={filteredRisks}
            kpis={kpis}
            unitSuffix={unitSuffix}
            onSelectRisk={selectRisk}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RiskSimulationDetailPanel
              risk={selectedRisk}
              totalP95={totalP95}
              totalExpectedExposure={totalExpectedExposure}
              recommendation={selectedRecommendation}
            />
          </div>

          <QuantitativeRiskContributors
            risks={filteredRisks}
            unitSuffix={unitSuffix}
            onSelectRisk={selectRisk}
          />

          <QuantitativeRiskRecommendations
            risk={selectedRisk}
            recommendation={selectedRecommendation}
            loading={selectedRisk ? recommendationLoadingId === selectedRisk.id : false}
            canGenerateRecommendation={canCreateRecommendation}
            onGenerateRecommendation={
              onGenerateRecommendation
                ? (risk) => onGenerateRecommendation(risk.id)
                : undefined
            }
          />

          <AiAuditorOperationalRiskPanel
            risks={filteredRisks}
            selectedRisk={selectedRisk}
            kpis={kpis}
            analysis={aiAnalysis}
            jobs={aiJobs}
            activeJob={activeAiJob}
            loading={aiLoading}
            historyLoading={aiHistoryLoading}
            saving={aiSaving}
            includeWebContext={includeWebContext}
            webContextAvailable={webContextAvailable}
            error={aiError}
            successMessage={aiMessage}
            onIncludeWebContextChange={setIncludeWebContext}
            onGenerate={generateAiAnalysis}
            onSave={saveAiRecommendation}
            onUseJobAnalysis={useCompletedJob}
          />

          <QuantitativeRiskTable
            risks={filteredRisks}
            selectedRiskId={selectedRisk?.id}
            totalP95={totalP95}
            onSelectRisk={selectRisk}
            canEditRisk={canCreateSimulation}
            onEditRisk={(risk) => {
              selectRisk(risk);
              onEditRisk?.(risk);
            }}
            canCreateRecommendation={canCreateRecommendation}
            recommendationLoadingId={recommendationLoadingId}
            onGenerateRecommendation={
              onGenerateRecommendation
                ? (risk) => onGenerateRecommendation(risk.id)
                : undefined
            }
          />

          <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span>Metricas normalizadas al horizonte {horizonLabel(filters.horizon).toLowerCase()} desde resultados anuales guardados.</span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
            >
              Actualizar datos
            </button>
          </div>
        </>
      )}

      <OperationalRiskSimulationForm
        form={form}
        onChange={onFormChange}
        onSubmit={onSubmitSimulation}
        loading={formLoading}
        disabled={!canCreateSimulation}
        error={error}
        successMessage={message}
        mode={isEditingSimulation ? 'edit' : 'create'}
        editingLabel={editingSimulationLabel}
        submitLabel={submitLabel || (isEditingSimulation ? 'Guardar como nueva simulacion' : 'Ejecutar y guardar simulacion')}
        onCancelEdit={isEditingSimulation ? onCancelEditing : undefined}
      />
    </section>
  );
}
