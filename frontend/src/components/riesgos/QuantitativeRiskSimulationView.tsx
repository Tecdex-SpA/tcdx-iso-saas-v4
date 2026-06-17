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
  normalizeNormId,
  type OperationalRiskRecommendationResult,
  type OperationalRiskSimulationRow,
  type QuantitativeRisk,
  type QuantitativeRiskFilters,
} from './riskSimulationUtils';

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

          <AiAuditorOperationalRiskPanel risks={filteredRisks} selectedRisk={selectedRisk} kpis={kpis} />

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
