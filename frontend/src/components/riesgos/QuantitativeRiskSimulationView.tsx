'use client';

import { useMemo, useState } from 'react';
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
import {
  DEFAULT_QUANTITATIVE_FILTERS,
  HORIZON_OPTIONS,
  buildQuantitativeRisks,
  calculateQuantitativeRiskKpis,
  filterQuantitativeRisks,
  getAiAuditorPayload,
  normalizeNormId,
  type OperationalAiAnalysis,
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiMessage, setAiMessage] = useState('');

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
    setAiError('');
    setAiMessage('');
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

      const payload = getAiAuditorPayload(filteredRisks, selectedRisk, kpis);
      const res = await fetch(`${API_URL}/api/operational-risks/ai-analysis`, {
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

      const analysis = json?.data?.analysis as OperationalAiAnalysis | undefined;
      if (!analysis?.diagnostico_ejecutivo || analysis.guardable === false || analysis.ai_engine_used === false) {
        throw new Error('AI Auditor no devolvio un analisis estructurado utilizable.');
      }

      setAiAnalysis(analysis);
      setAiMessage('Analisis AI generado. Revisa el resultado antes de guardarlo como recomendacion.');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error generando analisis AI Auditor.');
    } finally {
      setAiLoading(false);
    }
  }

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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
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
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
          Cargando simulaciones operativas...
        </div>
      ) : simulations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-sm leading-6 text-slate-600">
          <div className="text-base font-bold text-slate-950">Sin simulaciones operativas guardadas</div>
          <p className="mt-2">
            Ingrese una simulacion operativa para estimar exposicion esperada, P95 conservador y probabilidad critica.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Minimo</div>
              <div className="text-xs text-slate-500">Escenario optimista razonable.</div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Mas probable</div>
              <div className="text-xs text-slate-500">Valor esperado por experiencia operacional.</div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Maximo</div>
              <div className="text-xs text-slate-500">Escenario severo plausible.</div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">Umbral critico</div>
              <div className="text-xs text-slate-500">Limite operacional para medir disrupcion.</div>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
        </div>
      ) : (
        <>
          <QuantitativeRiskDashboard kpis={kpis} unitSuffix={unitSuffix} />

          <QuantitativeRiskMethodologyNote />

          <QuantitativeRiskExecutiveSummary
            risks={filteredRisks}
            kpis={kpis}
            unitSuffix={unitSuffix}
            onSelectRisk={selectRisk}
          />

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <BetaPertRiskMatrix
              risks={filteredRisks}
              selectedRiskId={selectedRisk?.id}
              onSelectRisk={selectRisk}
            />
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
            loading={aiLoading}
            saving={aiSaving}
            error={aiError}
            successMessage={aiMessage}
            onGenerate={generateAiAnalysis}
            onSave={saveAiRecommendation}
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

          <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Metricas normalizadas al horizonte {horizonLabel(filters.horizon).toLowerCase()} desde resultados anuales guardados.</span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
            >
              Actualizar datos
            </button>
          </div>
        </>
      )}
    </section>
  );
}
