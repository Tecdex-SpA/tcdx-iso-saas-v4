'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';
import { translateClauseLabel, translateStandardLabel } from '@/i18n/displayText';
import QuantitativeRiskSimulationView from '@/components/riesgos/QuantitativeRiskSimulationView';
import RiskViewSwitcher, { type RiskViewMode } from '@/components/riesgos/RiskViewSwitcher';
import type { OperationalRiskSimulationRow, QuantitativeRisk } from '@/components/riesgos/riskSimulationUtils';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type AuthUser = {
  tenant_id?: string | null;
  tenantId?: string | null;
  tenant?: string | null;
  company_id?: string | null;
  companyId?: string | null;
  role?: string | null;
  user_role?: string | null;
  userRole?: string | null;
};

type UnknownRecord = { [key: string]: unknown };

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type OperationItem = {
  id?: string;
  tenant_id?: string;
  code?: string | null;
  name?: string;
  operation_type?: string;
  is_active?: boolean;
};

type ScopeResponse = {
  operations: OperationItem[];
  standards: ScopeStandard[];
};

type RiskControlRow = {
  id: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  status?: string | null;
  iso?: string;
  iso_code?: string;
  standard_code?: string;
  likelihood?: number;
  impact?: number;
  score?: number;
  nivel?: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function isRiskControlRow(value: unknown): value is RiskControlRow {
  return isRecord(value) && typeof value.id === 'string';
}

type IsoRiskMatrixOption = {
  standard_code: string;
  version_code: string;
  display_name?: string;
  certifiable?: boolean;
  publication_status?: string;
  run_type?: string;
  catalog_coverage_pct?: number;
  sync_status?: string;
  latest_run_id?: string | null;
  latest_risk_posture?: string | null;
  latest_residual_risk_avg?: number | string | null;
  latest_assessment_id?: string | null;
  assets_count?: number;
  risk_templates_count?: number;
  recommended?: boolean;
  warnings?: string[];
};

type IsoRiskMatrixRun = {
  id?: string;
  run_id?: string;
  standard_code?: string;
  version_code?: string;
  run_type?: string;
  certifiable_version?: boolean;
  coverage_warning?: string | null;
  suggested_risks_count?: number;
  critical_risks_count?: number;
  high_risks_count?: number;
  medium_risks_count?: number;
  low_risks_count?: number;
  inherent_risk_avg?: number | string;
  residual_risk_avg?: number | string;
  risk_posture?: string;
  summary_json?: Record<string, unknown>;
};

type IsoRiskMatrixItem = {
  id?: string;
  risk_title: string;
  risk_description?: string | null;
  risk_category?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  asset_criticality?: string | null;
  likelihood?: number;
  impact?: number;
  inherent_risk_score?: number;
  inherent_risk_level?: string;
  residual_likelihood?: number;
  residual_impact?: number;
  residual_risk_score?: number;
  residual_risk_level?: string;
  treatment_strategy?: string;
  status?: string;
  confidence?: number | string;
};

type MatrixItemRiskInputDraft = {
  likelihood: string;
  impact: string;
};

type IsoRiskMatrixAction = {
  id?: string;
  risk_title?: string;
  action_title?: string;
  title?: string;
  action_description?: string;
  description?: string;
  priority?: string;
  suggested_owner_role?: string;
  owner_role?: string;
  suggested_due_days?: number;
  due_days?: number;
};

type HeatmapEntry = {
  id: string;
  title: string;
  description?: string | null;
  source: 'iso_matrix' | 'control';
  likelihood: number;
  impact: number;
  score: number;
  level: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  asset?: string | null;
  standard?: string | null;
};

type HeatmapCell = {
  likelihood: number;
  impact: number;
};

type OperationalRiskModel = 'ISO27001_TTIA' | 'ISO9001_COP_SIMPLE' | 'ISO9001_COP_AVANZADO';

type OperationalRiskSimulation = OperationalRiskSimulationRow & {
  norma_tipo: 'ISO27001' | 'ISO9001';
  modelo_usado: OperationalRiskModel;
  nombre_riesgo: string;
  proceso_afectado?: string | null;
  iteraciones: number;
  media_operativa_anual: number;
  peor_escenario_p90?: number | null;
  peor_escenario_p95: number;
  probabilidad_disrupcion_critica?: number | null;
  created_at?: string;
};

type OperationalRiskForm = {
  norma_tipo: 'ISO27001' | 'ISO9001';
  modelo_usado: OperationalRiskModel;
  nombre_riesgo: string;
  proceso_afectado: string;
  frecuencia_min: string;
  frecuencia_mode: string;
  frecuencia_max: string;
  impacto_min: string;
  impacto_mode: string;
  impacto_max: string;
  tasa_error_min: string;
  tasa_error_mode: string;
  tasa_error_max: string;
  volumen_operativo_anual: string;
  umbral_disrupcion_critica_horas: string;
  iteraciones: string;
};

type OperationalRiskRecommendation = {
  diagnostico_operativo?: string;
  controles_sugeridos?: unknown[];
  efectividad_estimada_pct?: number | string | null;
  requiere_validacion_humana?: boolean;
};

type EditingOperationalSimulation = {
  id: string;
  code: string;
  name: string;
};

const DEFAULT_OPERATIONAL_RISK_FORM: OperationalRiskForm = {
  norma_tipo: 'ISO27001',
  modelo_usado: 'ISO27001_TTIA',
  nombre_riesgo: '',
  proceso_afectado: '',
  frecuencia_min: '1',
  frecuencia_mode: '3',
  frecuencia_max: '8',
  impacto_min: '2',
  impacto_mode: '6',
  impacto_max: '16',
  tasa_error_min: '1',
  tasa_error_mode: '3',
  tasa_error_max: '8',
  volumen_operativo_anual: '1000',
  umbral_disrupcion_critica_horas: '40',
  iteraciones: '10000',
};

function toFormString(value: unknown, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function normalizeOperationalNorm(value: unknown): OperationalRiskForm['norma_tipo'] {
  return String(value || '').toUpperCase().includes('ISO9001') ? 'ISO9001' : 'ISO27001';
}

function normalizeOperationalModel(value: unknown, norm: OperationalRiskForm['norma_tipo']): OperationalRiskModel {
  const model = String(value || '');
  if (model === 'ISO27001_TTIA' || model === 'ISO9001_COP_SIMPLE' || model === 'ISO9001_COP_AVANZADO') {
    return model;
  }
  return norm === 'ISO9001' ? 'ISO9001_COP_SIMPLE' : 'ISO27001_TTIA';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function resolveTenantId(user: AuthUser | null): string {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function isOperationalStandard(s: ScopeStandard) {
  return (
    (s?.is_active === true || s?.is_active === 'true' || s?.is_active === 1) &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function clampRiskAxis(value: unknown) {
  const n = Math.round(Number(value || 0));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, n));
}

function riskLevelFromScore(score: number): HeatmapEntry['level'] {
  if (score >= 16) return 'CRITICO';
  if (score >= 10) return 'ALTO';
  if (score >= 5) return 'MEDIO';
  return 'BAJO';
}

function axisLabel(value: number) {
  if (value >= 5) return 'Muy alta';
  if (value === 4) return 'Alta';
  if (value === 3) return 'Media';
  if (value === 2) return 'Baja';
  return 'Muy baja';
}

function resolveRole(user: AuthUser | null): string {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim();
}

function canCreateOperationalSimulation(user: AuthUser | null) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
    'admin',
    'tenant_admin',
    'admin_cumplimiento',
    'compliance_admin',
    'operativo',
    'responsable_area',
    'area_owner',
  ].includes(resolveRole(user));
}

function canEditIsoRiskMatrix(user: AuthUser | null) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
    'admin',
    'tenant_admin',
    'operativo',
    'responsable_area',
    'area_owner',
  ].includes(resolveRole(user));
}

function buildRiskInputDrafts(items: IsoRiskMatrixItem[]) {
  return items.reduce<Record<string, MatrixItemRiskInputDraft>>((acc, item) => {
    if (!item.id) return acc;
    acc[item.id] = {
      likelihood: String(clampRiskAxis(item.likelihood || 1)),
      impact: String(clampRiskAxis(item.impact || 1)),
    };
    return acc;
  }, {});
}

export default function RiskMatrixPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">{t('riskMatrix.loading')}</div>
        </AppLayout>
      }
    >
      <RiskMatrixPageContent />
    </Suspense>
  );
}

function RiskMatrixPageContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');

  const [controls, setControls] = useState<RiskControlRow[]>([]);
  const [iso, setIso] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapCell | null>(null);
  const [matrixOptions, setMatrixOptions] = useState<IsoRiskMatrixOption[]>([]);
  const [selectedMatrixKey, setSelectedMatrixKey] = useState('');
  const [matrixRun, setMatrixRun] = useState<IsoRiskMatrixRun | null>(null);
  const [matrixItems, setMatrixItems] = useState<IsoRiskMatrixItem[]>([]);
  const [matrixActions, setMatrixActions] = useState<IsoRiskMatrixAction[]>([]);
  const [matrixItemRiskInputs, setMatrixItemRiskInputs] = useState<Record<string, MatrixItemRiskInputDraft>>({});
  const [savingMatrixRiskInputId, setSavingMatrixRiskInputId] = useState('');
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [generatingMatrix, setGeneratingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState('');
  const [matrixDryRun, setMatrixDryRun] = useState(true);
  const [riskViewMode, setRiskViewMode] = useState<RiskViewMode>('classic');

  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingControls, setLoadingControls] = useState(false);

  const [focusedControlId, setFocusedControlId] = useState('');
  const [focusMessage, setFocusMessage] = useState('');
  const [applyingAiControlId, setApplyingAiControlId] = useState('');
  const [aiActionFeedback, setAiActionFeedback] = useState<{
    kind: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [operationalRiskForm, setOperationalRiskForm] = useState<OperationalRiskForm>(DEFAULT_OPERATIONAL_RISK_FORM);
  const [operationalSimulations, setOperationalSimulations] = useState<OperationalRiskSimulation[]>([]);
  const [selectedOperationalSimulationId, setSelectedOperationalSimulationId] = useState('');
  const [editingOperationalSimulation, setEditingOperationalSimulation] = useState<EditingOperationalSimulation | null>(null);
  const [loadingOperationalSimulations, setLoadingOperationalSimulations] = useState(false);
  const [runningOperationalSimulation, setRunningOperationalSimulation] = useState(false);
  const [operationalRiskError, setOperationalRiskError] = useState('');
  const [operationalRiskMessage, setOperationalRiskMessage] = useState('');
  const [recommendationLoadingId, setRecommendationLoadingId] = useState('');
  const [recommendationBySimulationId, setRecommendationBySimulationId] = useState<Record<string, OperationalRiskRecommendation>>({});

  const focusAppliedRef = useRef(false);

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const activeStandardCodes = useMemo(() => {
    return new Set(operationalStandards.map((s) => s.code).filter(Boolean));
  }, [operationalStandards]);

  const matrixOptionsForSelectedIso = useMemo(() => {
    return matrixOptions.filter((option) => !iso || option.standard_code === iso);
  }, [iso, matrixOptions]);

  const selectedMatrixOption = useMemo(() => {
    return matrixOptionsForSelectedIso.find((option) => `${option.standard_code}:${option.version_code}` === selectedMatrixKey) || null;
  }, [matrixOptionsForSelectedIso, selectedMatrixKey]);

  const matrixSummary = useMemo(() => {
    return matrixRun?.summary_json || matrixRun || {};
  }, [matrixRun]);

  const userCanCreateOperationalSimulation = useMemo(() => {
    return canCreateOperationalSimulation(getUserFromToken() as AuthUser | null);
  }, []);

  const userCanEditIsoRiskMatrix = useMemo(() => {
    return canEditIsoRiskMatrix(getUserFromToken() as AuthUser | null);
  }, []);

  const topMatrixItems = useMemo(() => {
    return [...matrixItems]
      .sort((a, b) => Number(b.residual_risk_score || 0) - Number(a.residual_risk_score || 0));
  }, [matrixItems]);

  const heatmapEntries = useMemo<HeatmapEntry[]>(() => {
    if (matrixItems.length > 0) {
      return matrixItems.map((item, index) => {
        const likelihood = clampRiskAxis(item.likelihood || Math.ceil(Math.sqrt(Number(item.inherent_risk_score || item.residual_risk_score || 1))));
        const impact = clampRiskAxis(item.impact || Math.ceil(Number(item.inherent_risk_score || item.residual_risk_score || 1) / likelihood));
        const score = likelihood * impact;
        const rawLevel = String(item.residual_risk_level || item.inherent_risk_level || '').toUpperCase();
        const level = rawLevel === 'CRITICO' || rawLevel === 'ALTO' || rawLevel === 'MEDIO' || rawLevel === 'BAJO'
          ? rawLevel as HeatmapEntry['level']
          : riskLevelFromScore(score);

        return {
          id: item.id || `matrix-${index}`,
          title: item.risk_title || 'Riesgo ISO sugerido',
          description: item.risk_description,
          source: 'iso_matrix',
          likelihood,
          impact,
          score,
          level,
          asset: item.asset_name,
          standard: `${selectedMatrixOption?.standard_code || ''} ${selectedMatrixOption?.version_code || ''}`.trim(),
        };
      });
    }

    return controls.map((control) => {
      const likelihood = clampRiskAxis(control.likelihood || 1);
      const impact = clampRiskAxis(control.impact || 1);
      const score = likelihood * impact;
      return {
        id: control.id,
        title: control.category || control.clause || 'Control operativo',
        description: control.description,
        source: 'control',
        likelihood,
        impact,
        score,
        level: control.nivel || riskLevelFromScore(score),
        asset: control.clause ? `Clausula ${control.clause}` : null,
        standard: control.iso,
      };
    });
  }, [controls, matrixItems, selectedMatrixOption]);

  const selectedHeatmapEntries = useMemo(() => {
    if (!selectedHeatmapCell) return [];
    return heatmapEntries
      .filter((entry) => entry.likelihood === selectedHeatmapCell.likelihood && entry.impact === selectedHeatmapCell.impact)
      .sort((a, b) => b.score - a.score);
  }, [heatmapEntries, selectedHeatmapCell]);

  const riskLevelClass = (level?: string | null) => {
    const value = String(level || '').toLowerCase();
    if (value === 'critico') return 'bg-red-600 text-white';
    if (value === 'alto') return 'bg-orange-500 text-white';
    if (value === 'medio') return 'bg-amber-400 text-amber-950';
    return 'bg-emerald-100 text-emerald-800';
  };

  const riskPostureClass = (posture?: string | null) => {
    const value = String(posture || '').toLowerCase();
    if (value === 'critica') return 'bg-red-50 text-red-800 border-red-200';
    if (value === 'alta') return 'bg-orange-50 text-orange-800 border-orange-200';
    if (value === 'moderada') return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  };

  const formatNumber = (value: unknown) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2).replace('.00', '') : '0';
  };

  const updateOperationalRiskField = (field: keyof OperationalRiskForm, value: string) => {
    setOperationalRiskForm((prev) => {
      const next = { ...prev, [field]: value } as OperationalRiskForm;

      if (field === 'norma_tipo') {
        next.modelo_usado = value === 'ISO27001' ? 'ISO27001_TTIA' : 'ISO9001_COP_SIMPLE';
      }

      if (field === 'modelo_usado' && value === 'ISO27001_TTIA') {
        next.norma_tipo = 'ISO27001';
      }

      if (field === 'modelo_usado' && value.startsWith('ISO9001')) {
        next.norma_tipo = 'ISO9001';
      }

      return next;
    });
  };

  const buildOperationalFormFromRisk = (risk: QuantitativeRisk): OperationalRiskForm => {
    const row = risk.source || {};
    const norm = normalizeOperationalNorm(row.norma_tipo || risk.normId);
    const model = normalizeOperationalModel(row.modelo_usado, norm);
    const impactMin = row.tiempo_subsanacion_min ?? row.impacto_min;
    const impactMode = row.tiempo_subsanacion_mode ?? row.impacto_mode;
    const impactMax = row.tiempo_subsanacion_max ?? row.impacto_max;

    return {
      norma_tipo: norm,
      modelo_usado: model,
      nombre_riesgo: toFormString(row.nombre_riesgo, risk.name),
      proceso_afectado: toFormString(row.proceso_afectado, risk.processName),
      frecuencia_min: toFormString(row.frecuencia_min, ''),
      frecuencia_mode: toFormString(row.frecuencia_mode, ''),
      frecuencia_max: toFormString(row.frecuencia_max, ''),
      impacto_min: toFormString(impactMin, ''),
      impacto_mode: toFormString(impactMode, ''),
      impacto_max: toFormString(impactMax, ''),
      tasa_error_min: toFormString(row.tasa_error_min, ''),
      tasa_error_mode: toFormString(row.tasa_error_mode, ''),
      tasa_error_max: toFormString(row.tasa_error_max, ''),
      volumen_operativo_anual: toFormString(row.volumen_operativo_anual, ''),
      umbral_disrupcion_critica_horas: toFormString(row.umbral_disrupcion_critica_horas, ''),
      iteraciones: toFormString(row.iteraciones, DEFAULT_OPERATIONAL_RISK_FORM.iteraciones),
    };
  };

  const beginEditOperationalSimulation = (risk: QuantitativeRisk) => {
    setSelectedOperationalSimulationId(risk.id);
    setEditingOperationalSimulation({
      id: risk.id,
      code: risk.code,
      name: risk.name,
    });
    setOperationalRiskForm(buildOperationalFormFromRisk(risk));
    setOperationalRiskError('');
    setOperationalRiskMessage('Editando evaluacion existente. Al guardar se creara una nueva simulacion basada en estos parametros.');

    window.setTimeout(() => {
      document.getElementById('beta-pert-simulation-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  };

  const cancelOperationalSimulationEdit = () => {
    setEditingOperationalSimulation(null);
    setOperationalRiskForm(DEFAULT_OPERATIONAL_RISK_FORM);
    setOperationalRiskError('');
    setOperationalRiskMessage('');
  };

  const loadOperationalSimulations = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      setLoadingOperationalSimulations(true);
      setOperationalRiskError('');

      const params = new URLSearchParams();

      const res = await fetch(`${API_URL}/api/operational-risks/simulations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible cargar simulaciones operativas');
      }

      const rows = Array.isArray(json?.data) ? json.data : [];
      setOperationalSimulations(rows);
      return rows as OperationalRiskSimulation[];
    } catch (err) {
      console.error('ERROR LOAD OPERATIONAL RISK SIMULATIONS:', err);
      setOperationalRiskError(getErrorMessage(err, 'Error cargando simulaciones operativas'));
      return [];
    } finally {
      setLoadingOperationalSimulations(false);
    }
  }, []);

  const runOperationalRiskSimulation = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setOperationalRiskError('No hay sesion activa. Ingresa nuevamente antes de simular.');
      return;
    }

    try {
      setRunningOperationalSimulation(true);
      setOperationalRiskError('');
      setOperationalRiskMessage('');

      const advanced = operationalRiskForm.modelo_usado === 'ISO9001_COP_AVANZADO';
      const body: Record<string, unknown> = {
        norma_tipo: operationalRiskForm.norma_tipo,
        modelo_usado: operationalRiskForm.modelo_usado,
        nombre_riesgo: operationalRiskForm.nombre_riesgo,
        proceso_afectado: operationalRiskForm.proceso_afectado,
        frecuencia: {
          min: Number(operationalRiskForm.frecuencia_min),
          mode: Number(operationalRiskForm.frecuencia_mode),
          max: Number(operationalRiskForm.frecuencia_max),
          unidad: 'eventos_por_ano',
        },
        impacto_operativo: {
          min: Number(operationalRiskForm.impacto_min),
          mode: Number(operationalRiskForm.impacto_mode),
          max: Number(operationalRiskForm.impacto_max),
          unidad: operationalRiskForm.norma_tipo === 'ISO27001' ? 'horas_por_evento' : 'horas_reproceso_por_error',
        },
        umbral_disrupcion_critica_horas: Number(operationalRiskForm.umbral_disrupcion_critica_horas),
        iteraciones: Number(operationalRiskForm.iteraciones || 10000),
      };

      if (advanced) {
        body.tasa_error = {
          min: Number(operationalRiskForm.tasa_error_min),
          mode: Number(operationalRiskForm.tasa_error_mode),
          max: Number(operationalRiskForm.tasa_error_max),
          unidad: 'porcentaje',
        };
        body.tiempo_subsanacion = {
          min: Number(operationalRiskForm.impacto_min),
          mode: Number(operationalRiskForm.impacto_mode),
          max: Number(operationalRiskForm.impacto_max),
          unidad: 'horas_reproceso_por_error',
        };
        body.volumen_operativo_anual = Number(operationalRiskForm.volumen_operativo_anual);
      }

      const res = await fetch(`${API_URL}/api/operational-risks/simulations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible ejecutar la simulacion');
      }

      const createdSimulation = json?.data as OperationalRiskSimulation | undefined;
      const savingFromEdit = Boolean(editingOperationalSimulation);
      const rows = await loadOperationalSimulations();

      setSelectedOperationalSimulationId(createdSimulation?.id || rows[0]?.id || '');
      setEditingOperationalSimulation(null);
      setOperationalRiskMessage(
        savingFromEdit
          ? 'Simulacion guardada como nueva evaluacion.'
          : 'Simulacion operativa guardada con metricas agregadas.'
      );
    } catch (err) {
      console.error('ERROR RUN OPERATIONAL RISK SIMULATION:', err);
      setOperationalRiskError(getErrorMessage(err, 'Error ejecutando simulacion operativa'));
    } finally {
      setRunningOperationalSimulation(false);
    }
  };

  const generateOperationalRecommendation = async (simulationId: string) => {
    const token = localStorage.getItem('token');
    if (!token || !simulationId) return;

    try {
      setRecommendationLoadingId(simulationId);
      setOperationalRiskError('');
      setOperationalRiskMessage('');

      const res = await fetch(`${API_URL}/api/operational-risks/simulations/${simulationId}/recommendations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible generar recomendacion operativa');
      }

      setRecommendationBySimulationId((prev) => ({
        ...prev,
        [simulationId]: json?.data || {},
      }));
      setOperationalRiskMessage('Recomendacion rule-based generada para revision humana.');
    } catch (err) {
      console.error('ERROR GENERATE OPERATIONAL RISK RECOMMENDATION:', err);
      setOperationalRiskError(getErrorMessage(err, 'Error generando recomendacion operativa'));
    } finally {
      setRecommendationLoadingId('');
    }
  };

  const loadScope = useCallback(async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId) {
      setLoadingStandards(false);
      return;
    }

    try {
      setLoadingStandards(true);

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD RISK SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setIso('');
        return;
      }

      const nextScope: ScopeResponse = {
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      };

      const activeStandards = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      if (activeStandards.length > 0) {
        setIso((prev) => {
          if (focusISO) {
            const existsFocus = activeStandards.some((s) => s.code === focusISO);
            if (existsFocus) return focusISO;
          }

          const exists = activeStandards.some((s) => s.code === prev);
          return exists ? prev : activeStandards[0].code;
        });
      } else {
        setIso('');
      }
    } catch (err) {
      console.error('ERROR LOAD RISK SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setIso('');
    } finally {
      setLoadingStandards(false);
    }
  }, [focusISO]);

  const loadMatrixOptions = useCallback(async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId) return;

    try {
      setLoadingMatrix(true);
      setMatrixError('');

      const res = await fetch(`${API_URL}/api/iso-risk-matrix/${tenantId}/options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'No fue posible cargar opciones de matriz');
      }

      const options = Array.isArray(json?.data?.options) ? json.data.options : [];
      setMatrixOptions(options);

      setSelectedMatrixKey((prev) => {
        if (prev && options.some((option: IsoRiskMatrixOption) => `${option.standard_code}:${option.version_code}` === prev)) {
          return prev;
        }

        const recommended = options.find((option: IsoRiskMatrixOption) => option.recommended);
        const first = recommended || options[0];
        return first ? `${first.standard_code}:${first.version_code}` : '';
      });
    } catch (err) {
      console.error('ERROR LOAD ISO RISK MATRIX OPTIONS:', err);
      setMatrixError(getErrorMessage(err, 'Error cargando matriz automatizada'));
    } finally {
      setLoadingMatrix(false);
    }
  }, []);

  const loadLatestMatrix = useCallback(async (option?: IsoRiskMatrixOption | null) => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);
    const target = option || selectedMatrixOption;

    if (!token || !tenantId || !target) return;

    try {
      const res = await fetch(
        `${API_URL}/api/iso-risk-matrix/${tenantId}/latest?standard_code=${encodeURIComponent(target.standard_code)}&version_code=${encodeURIComponent(target.version_code)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();

      if (!res.ok) return;

      if (json?.data?.run) {
        const items = Array.isArray(json.data.items) ? json.data.items : [];
        setMatrixRun(json.data.run);
        setMatrixItems(items);
        setMatrixItemRiskInputs(buildRiskInputDrafts(items));
        setMatrixActions(Array.isArray(json.data.actions) ? json.data.actions : []);
        setMatrixDryRun(false);
      } else {
        setMatrixRun(null);
        setMatrixItems([]);
        setMatrixItemRiskInputs({});
        setMatrixActions([]);
        setMatrixDryRun(true);
      }
    } catch (err) {
      console.error('ERROR LOAD LATEST ISO RISK MATRIX:', err);
    }
  }, [selectedMatrixOption]);

  const generateMatrix = async (dryRun: boolean) => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);
    const target = selectedMatrixOption;

    if (!token || !tenantId || !target) return;

    try {
      setGeneratingMatrix(true);
      setMatrixError('');

      const res = await fetch(`${API_URL}/api/iso-risk-matrix/${tenantId}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          standard_code: target.standard_code,
          version_code: target.version_code,
          run_type: target.version_code === '2026_FDIS' ? 'transition_readiness' : 'automated',
          include_assets: true,
          include_diagnostic_gaps: true,
          include_existing_asset_risks: true,
          dry_run: dryRun,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'No fue posible generar la matriz');
      }

      const data = json?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setMatrixRun({
        ...(data.run || {}),
        summary_json: data.summary || data.run?.summary_json || {},
      });
      setMatrixItems(items);
      setMatrixItemRiskInputs(buildRiskInputDrafts(items));
      setMatrixActions(Array.isArray(data.actions) ? data.actions : []);
      setMatrixDryRun(dryRun);

      if (!dryRun) {
        await loadMatrixOptions();
      }
    } catch (err) {
      console.error('ERROR GENERATE ISO RISK MATRIX:', err);
      setMatrixError(getErrorMessage(err, 'Error generando matriz de riesgos'));
    } finally {
      setGeneratingMatrix(false);
    }
  };

  const updateMatrixRiskInputDraft = (
    itemId: string | undefined,
    field: keyof MatrixItemRiskInputDraft,
    value: string
  ) => {
    if (!itemId) return;
    setMatrixItemRiskInputs((prev) => ({
      ...prev,
      [itemId]: {
        likelihood: prev[itemId]?.likelihood || '1',
        impact: prev[itemId]?.impact || '1',
        [field]: value,
      },
    }));
  };

  const saveMatrixRiskInputs = async (item: IsoRiskMatrixItem) => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);
    const itemId = item.id;
    const draft = itemId ? matrixItemRiskInputs[itemId] : null;

    if (!token || !tenantId || !itemId || !draft) return;

    try {
      setSavingMatrixRiskInputId(itemId);
      setMatrixError('');

      const res = await fetch(`${API_URL}/api/iso-risk-matrix/${tenantId}/items/${itemId}/risk-inputs`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          likelihood: Number(draft.likelihood),
          impact: Number(draft.impact),
          reason: 'Ajuste de probabilidad/impacto desde matriz de riesgos.',
        }),
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible guardar probabilidad/impacto');
      }

      const updatedItem = json?.data?.item as IsoRiskMatrixItem | undefined;
      const updatedRun = json?.data?.run as IsoRiskMatrixRun | undefined;

      if (updatedItem) {
        setMatrixItems((prev) => prev.map((current) => (
          current.id === itemId ? { ...current, ...updatedItem } : current
        )));
        setMatrixItemRiskInputs((prev) => ({
          ...prev,
          [itemId]: {
            likelihood: String(clampRiskAxis(updatedItem.likelihood || draft.likelihood)),
            impact: String(clampRiskAxis(updatedItem.impact || draft.impact)),
          },
        }));
      }

      if (updatedRun) {
        setMatrixRun(updatedRun);
      }
    } catch (err) {
      console.error('ERROR UPDATE RISK INPUTS:', err);
      setMatrixError(getErrorMessage(err, 'Error guardando probabilidad/impacto'));
    } finally {
      setSavingMatrixRiskInputId('');
    }
  };

  const reviewRiskItem = async (itemId: string | undefined, status: 'accepted' | 'rejected') => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId || !itemId) return;

    try {
      const res = await fetch(`${API_URL}/api/iso-risk-matrix/${tenantId}/items/${itemId}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          review_comment: status === 'accepted' ? 'Aceptado desde matriz de riesgos.' : 'Rechazado desde matriz de riesgos.',
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'No fue posible revisar el riesgo');
      }

      setMatrixItems((prev) => prev.map((item) => (
        item.id === itemId ? { ...item, status } : item
      )));
    } catch (err) {
      console.error('ERROR REVIEW RISK ITEM:', err);
      setMatrixError(getErrorMessage(err, 'Error revisando riesgo'));
    }
  };

  const load = useCallback(async (selectedISO: string) => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken() as AuthUser | null;
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId || !selectedISO) {
      setControls([]);
      return;
    }

    if (!activeStandardCodes.has(selectedISO)) {
      setControls([]);
      return;
    }

    try {
      setLoadingControls(true);

      const res = await fetch(`${API_URL}/api/dashboard-controls/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD CONTROLS:', data);
        setControls([]);
        return;
      }

      const enriched = (Array.isArray(data) ? data.filter(isRiskControlRow) : [])
        .map((c) => ({
          ...c,
          iso: c.iso || c.iso_code || c.standard_code || '',
        }))
        .filter((c) => activeStandardCodes.has(c.iso || ''))
        .filter((c) => c.iso === selectedISO)
        .map((c) => {
          let p = 1;
          let i = 1;

          if (c.status === 'parcial') {
            p = 3;
            i = 3;
          }

          if (c.status === 'no cumple') {
            p = 4;
            i = 4;
          }

          const score = p * i;
          const nivel = riskLevelFromScore(score);

          return { ...c, likelihood: p, impact: i, score, nivel };
        })
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

      setControls(enriched);
    } catch (err) {
      console.error('ERROR LOAD CONTROLS:', err);
      setControls([]);
    } finally {
      setLoadingControls(false);
    }
  }, [activeStandardCodes]);

  useEffect(() => {
    void loadScope();
    void loadMatrixOptions();
    void loadOperationalSimulations();
  }, [loadMatrixOptions, loadOperationalSimulations, loadScope]);

  useEffect(() => {
    if (iso === 'ISO27001' || iso === 'ISO9001') {
      setOperationalRiskForm((prev) => {
        if (prev.norma_tipo === iso) return prev;
        return {
          ...prev,
          norma_tipo: iso,
          modelo_usado: iso === 'ISO27001' ? 'ISO27001_TTIA' : 'ISO9001_COP_SIMPLE',
        };
      });
    }
  }, [iso]);

  useEffect(() => {
    if (selectedMatrixOption) {
      void loadLatestMatrix(selectedMatrixOption);
    } else {
      setMatrixRun(null);
      setMatrixItems([]);
      setMatrixActions([]);
      setMatrixDryRun(true);
    }
  }, [loadLatestMatrix, selectedMatrixOption]);

  useEffect(() => {
    if (!iso) return;

    const hasSelectedOption = matrixOptionsForSelectedIso.some(
      (option) => `${option.standard_code}:${option.version_code}` === selectedMatrixKey
    );

    if (hasSelectedOption) return;

    const recommended = matrixOptionsForSelectedIso.find((option) => option.recommended);
    const next = recommended || matrixOptionsForSelectedIso[0];

    setSelectedMatrixKey(next ? `${next.standard_code}:${next.version_code}` : '');
    setMatrixRun(null);
    setMatrixItems([]);
    setMatrixActions([]);
    setMatrixDryRun(true);
    setSelectedHeatmapCell(null);
  }, [iso, matrixOptionsForSelectedIso, selectedMatrixKey]);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedControlId('');
    setFocusMessage('');
    setSelectedLevel(null);
    setSelectedHeatmapCell(null);
  }, [focusId, focusISO]);

  useEffect(() => {
    if (iso) {
      void load(iso);
    } else {
      setControls([]);
    }

    if (!focusId) {
      setSelectedLevel(null);
    }
  }, [activeStandardCodes, focusId, iso, load]);

  const applyAI = async (tenant_control_id: string) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setAiActionFeedback({
        kind: 'error',
        message: 'No hay sesion activa. Ingresa nuevamente antes de crear un borrador IA.',
      });
      return;
    }

    const confirmed = window.confirm(
      'La IA no aplicara cambios directamente. Se creara un borrador de plan de accion revisable. ¿Deseas continuar?'
    );

    if (!confirmed) return;

    try {
      setApplyingAiControlId(tenant_control_id);
      setAiActionFeedback({
        kind: 'info',
        message: 'Creando borrador de plan de accion desde recomendacion IA...',
      });

      const response = await fetch(`${API_URL}/api/ai/apply/${tenant_control_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await response.text();
      let json: unknown = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      const jsonRecord = asRecord(json);

      if (!response.ok || jsonRecord.success === false || jsonRecord.ok === false) {
        throw new Error(
          typeof jsonRecord.message === 'string'
            ? jsonRecord.message
            : typeof jsonRecord.error === 'string'
              ? jsonRecord.error
              : `No fue posible crear el borrador IA (HTTP ${response.status}).`
        );
      }

      if (iso) {
        await load(iso);
      }

      setAiActionFeedback({
        kind: 'success',
        message: jsonRecord.action_plan_id
          ? `Borrador IA creado para revision humana. Plan: ${String(jsonRecord.action_plan_id)}.`
          : 'Borrador IA creado para revision humana.',
      });
    } catch (err) {
      console.error('ERROR APPLY AI:', err);
      setAiActionFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : t('riskMatrix.applyAiError'),
      });
    } finally {
      setApplyingAiControlId('');
    }
  };

  const explainRisk = (nivel: string) => {
    if (nivel === 'ALTO') {
      return t('riskMatrix.explanations.high');
    }

    if (nivel === 'MEDIO') {
      return t('riskMatrix.explanations.medium');
    }

    return t('riskMatrix.explanations.low');
  };

  const getHeatmapColor = (value: number) => {
    if (value >= 20) return 'bg-gradient-to-br from-rose-700 to-red-600 text-white border-red-500 shadow-red-900/20';
    if (value >= 16) return 'bg-gradient-to-br from-red-600 to-orange-600 text-white border-red-400 shadow-red-900/20';
    if (value >= 10) return 'bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-300 shadow-orange-900/10';
    if (value >= 5) return 'bg-gradient-to-br from-yellow-300 to-amber-300 text-slate-950 border-amber-200 shadow-amber-900/10';
    return 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-950 border-emerald-200 shadow-emerald-900/10';
  };

  const getHeatmapLevelClass = (level: string) => {
    if (level === 'CRITICO') return 'bg-red-950/20 text-white';
    if (level === 'ALTO') return 'bg-orange-950/15 text-white';
    if (level === 'MEDIO') return 'bg-amber-950/10 text-amber-950';
    return 'bg-emerald-950/10 text-emerald-950';
  };

  const filtered = useMemo(() => {
    return selectedLevel
      ? controls.filter((c) => c.nivel === selectedLevel)
      : [];
  }, [controls, selectedLevel]);

  const riskLevelLabel = useCallback((value?: string | null) => {
    const raw = String(value || '').toUpperCase();
    if (raw === 'CRITICO') return t('statuses.findings.critico') || 'Critico';
    if (raw === 'ALTO') return t('statuses.findings.alto');
    if (raw === 'MEDIO') return t('statuses.findings.medio');
    return t('statuses.findings.bajo');
  }, [t]);

  const applyFocus = useCallback((control: RiskControlRow) => {
    setFocusedControlId(control.id);
    setSelectedLevel(control.nivel || null);
    setFocusMessage(
      `${t('riskMatrix.directOpen')}: ${translateStandardLabel(control.iso, locale)} · ${t('riskMatrix.clause').toLowerCase()} ${
        translateClauseLabel(control.clause || 'N/A', locale)
      } · ${t('dashboard.risk').toLowerCase()} ${riskLevelLabel(control.nivel)}`
    );
    focusAppliedRef.current = true;

    setTimeout(() => {
      const el = document.getElementById(`risk-control-${control.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  }, [locale, riskLevelLabel, t]);

  useEffect(() => {
    if (loadingStandards || !operationalStandards.length) return;

    if (focusISO) {
      const exists = operationalStandards.some((s) => s.code === focusISO);
      if (exists && iso !== focusISO) {
        setIso(focusISO);
      }
    }
  }, [focusISO, operationalStandards, loadingStandards, iso]);

  useEffect(() => {
    if (!focusId || loadingControls || !controls.length || focusAppliedRef.current) return;

    const match = controls.find((c) => c.id === focusId);

    if (match) {
      applyFocus(match);
    }
  }, [applyFocus, focusId, controls, loadingControls]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">{t('riskMatrix.loadingStandards')}</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{t('riskMatrix.title')}</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              {t('riskMatrix.noOperationalStandards')}
            </h2>

            <p className="text-sm text-gray-700">
              {t('riskMatrix.noOperationalStandardsHelp')}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="tcdx-risk-refinement p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Riesgos</h1>
          <p className="text-sm text-[var(--tcdx-color-text-secondary)] mt-1">
            Matriz ISO, riesgo operacional y priorización por impacto/probabilidad.
          </p>
        </div>

        {focusMessage && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl px-5 py-4 shadow-sm">
            <div className="font-semibold">{t('riskMatrix.directOpen')}</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        <RiskViewSwitcher value={riskViewMode} onChange={setRiskViewMode} />

        {riskViewMode === 'betaPert' ? (
          <QuantitativeRiskSimulationView
            form={operationalRiskForm}
            simulations={operationalSimulations}
            loading={loadingOperationalSimulations}
            formLoading={runningOperationalSimulation}
            error={operationalRiskError}
            message={operationalRiskMessage}
            standardOptions={operationalStandards.map((standard) => ({
              value: standard.code,
              label: `${standard.code}${standard.name ? ` - ${standard.name}` : ''}`,
            }))}
            canCreateSimulation={userCanCreateOperationalSimulation}
            canCreateRecommendation={userCanCreateOperationalSimulation}
            recommendationLoadingId={recommendationLoadingId}
            recommendationsBySimulationId={recommendationBySimulationId}
            selectedSimulationId={selectedOperationalSimulationId}
            isEditingSimulation={Boolean(editingOperationalSimulation)}
            editingSimulationLabel={
              editingOperationalSimulation
                ? `${editingOperationalSimulation.code}: ${editingOperationalSimulation.name}`
                : ''
            }
            submitLabel={editingOperationalSimulation ? 'Guardar como nueva simulacion' : 'Ejecutar y guardar simulacion'}
            onFormChange={updateOperationalRiskField}
            onSubmitSimulation={runOperationalRiskSimulation}
            onCancelEditing={cancelOperationalSimulationEdit}
            onSelectSimulation={setSelectedOperationalSimulationId}
            onEditRisk={beginEditOperationalSimulation}
            onRefresh={loadOperationalSimulations}
            onGenerateRecommendation={(simulationId) => {
              void generateOperationalRecommendation(simulationId);
            }}
          />
        ) : (
          <>
        <select
          value={iso}
          onChange={(e) => {
            setIso(e.target.value);
            setSelectedLevel(null);
            setSelectedHeatmapCell(null);
            setFocusedControlId('');
            if (!focusId) {
              setFocusMessage('');
            }
          }}
          className="border px-3 py-2 rounded"
        >
          <option value="">{t('riskMatrix.selectIso')}</option>
          {operationalStandards.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <TcdxIcon name="risk" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">
                    Matriz automatizada ISO
                  </h2>
                  <p className="text-sm text-gray-500">
                    Riesgos sugeridos desde ISO, activos, diagnostico express, controles y evidencias.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={selectedMatrixKey}
                onChange={(e) => {
                  setSelectedMatrixKey(e.target.value);
                  setMatrixError('');
                }}
                className="border border-gray-300 px-3 py-2 rounded text-sm min-w-[260px]"
                disabled={loadingMatrix}
              >
                <option value="">
                  {iso ? `Seleccionar version de ${iso}` : 'Seleccionar norma/version'}
                </option>
                {matrixOptionsForSelectedIso.map((option) => (
                  <option
                    key={`${option.standard_code}:${option.version_code}`}
                    value={`${option.standard_code}:${option.version_code}`}
                  >
                    {option.standard_code} {option.version_code} · {option.display_name || 'Matriz ISO'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => generateMatrix(true)}
                disabled={!selectedMatrixOption || generatingMatrix}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 whitespace-nowrap hover:bg-gray-50 disabled:opacity-50"
              >
                Simular
              </button>

              <button
                type="button"
                onClick={() => generateMatrix(false)}
                disabled={!selectedMatrixOption || generatingMatrix}
                className="inline-flex items-center justify-center rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white whitespace-nowrap hover:bg-slate-800 disabled:opacity-50"
              >
                Generar matriz
              </button>
            </div>
          </div>

          {matrixError && (
            <div className="mx-5 mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {matrixError}
            </div>
          )}

          {selectedMatrixOption && (
            <div className="px-5 py-4 bg-slate-50 border-b border-gray-100 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedMatrixOption.standard_code} {selectedMatrixOption.version_code}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    selectedMatrixOption.certifiable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {selectedMatrixOption.certifiable ? 'Certificable' : 'No certificable'}
                  </span>
                  <span className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">
                    Cobertura {formatNumber(selectedMatrixOption.catalog_coverage_pct)}%
                  </span>
                  <span className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">
                    Activos {selectedMatrixOption.assets_count || 0}
                  </span>
                  <span className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">
                    Templates {selectedMatrixOption.risk_templates_count || 0}
                  </span>
                </div>

                {(selectedMatrixOption.warnings || []).length > 0 && (
                  <div className="flex flex-col gap-1">
                    {(selectedMatrixOption.warnings || []).map((warning) => (
                      <div key={warning} className="text-sm text-amber-800">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`rounded border px-4 py-3 ${riskPostureClass(String(matrixSummary.risk_posture || selectedMatrixOption.latest_risk_posture || 'controlada'))}`}>
                <div className="text-xs uppercase tracking-wide opacity-80">Postura de riesgo</div>
                <div className="text-2xl font-bold capitalize">
                  {String(matrixSummary.risk_posture || selectedMatrixOption.latest_risk_posture || 'sin matriz').replace('_', ' ')}
                </div>
                <div className="text-xs mt-1">
                  Residual promedio {formatNumber(matrixSummary.residual_risk_avg || selectedMatrixOption.latest_residual_risk_avg)}
                </div>
              </div>
            </div>
          )}

          {generatingMatrix || loadingMatrix ? (
            <div className="px-5 py-8 text-sm text-gray-500">
              Procesando matriz de riesgos...
            </div>
          ) : matrixRun ? (
            <div className="p-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ['Riesgos', matrixSummary.suggested_risks_count || matrixItems.length, 'bg-gray-950 text-white'],
                  ['Criticos', matrixSummary.critical_risks_count || 0, 'bg-red-600 text-white'],
                  ['Altos', matrixSummary.high_risks_count || 0, 'bg-orange-500 text-white'],
                  ['Medios', matrixSummary.medium_risks_count || 0, 'bg-amber-400 text-amber-950'],
                  ['Bajos', matrixSummary.low_risks_count || 0, 'bg-emerald-100 text-emerald-800'],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className="border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500">{String(label)}</div>
                    <div className={`mt-2 inline-flex min-w-12 justify-center rounded px-3 py-1 text-xl font-bold ${String(className)}`}>
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>

              {matrixRun.coverage_warning && (
                <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {matrixRun.coverage_warning}
                </div>
              )}

              {matrixDryRun && (
                <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Simulacion sin escritura. Usa “Generar matriz” para guardar la corrida y habilitar revision de sugerencias.
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Riesgos priorizados</h3>
                    <span className="text-xs text-gray-500">
                      Inherente {formatNumber(matrixSummary.inherent_risk_avg)} · Residual {formatNumber(matrixSummary.residual_risk_avg)}
                    </span>
                  </div>

                  <div className="max-h-[420px] overflow-auto tcdx-scrollbar">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Riesgo</th>
                          <th className="px-4 py-3">Activo</th>
                          <th className="px-4 py-3">Inherente</th>
                          <th className="px-4 py-3">Residual</th>
                          <th className="px-4 py-3">Tratamiento</th>
                          <th className="px-4 py-3">Revision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {topMatrixItems.map((item, index) => {
                          const draft = item.id ? matrixItemRiskInputs[item.id] : null;
                          const draftLikelihood = clampRiskAxis(draft?.likelihood || item.likelihood || 1);
                          const draftImpact = clampRiskAxis(draft?.impact || item.impact || 1);
                          const draftScore = draftLikelihood * draftImpact;
                          const draftChanged = Boolean(
                            item.id &&
                            (draftLikelihood !== clampRiskAxis(item.likelihood || 1) ||
                              draftImpact !== clampRiskAxis(item.impact || 1))
                          );

                          return (
                          <tr key={item.id || `${item.risk_title}-${index}`} className="align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-950">{item.risk_title}</div>
                              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.risk_description}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                Confianza {formatNumber(Number(item.confidence || 0) * 100)}%
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <div>{item.asset_name || 'Sin activo especifico'}</div>
                              <div className="text-xs text-gray-500">{item.asset_type || item.asset_criticality || ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-2">
                                {userCanEditIsoRiskMatrix && item.id && !matrixDryRun ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="text-[11px] text-gray-500">
                                      Prob.
                                      <select
                                        value={String(draftLikelihood)}
                                        onChange={(event) => updateMatrixRiskInputDraft(item.id, 'likelihood', event.target.value)}
                                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                                      >
                                        {[1, 2, 3, 4, 5].map((value) => (
                                          <option key={value} value={value}>{value} · {axisLabel(value)}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="text-[11px] text-gray-500">
                                      Impacto
                                      <select
                                        value={String(draftImpact)}
                                        onChange={(event) => updateMatrixRiskInputDraft(item.id, 'impact', event.target.value)}
                                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                                      >
                                        {[1, 2, 3, 4, 5].map((value) => (
                                          <option key={value} value={value}>{value} · {axisLabel(value)}</option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-gray-500">
                                    Prob. {item.likelihood || 1} · Impacto {item.impact || 1}
                                  </div>
                                )}

                                <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${riskLevelClass(item.inherent_risk_level)}`}>
                                  {item.inherent_risk_score || 0} · {item.inherent_risk_level || 'bajo'}
                                </span>

                                <div className="text-[11px] text-gray-500">
                                  Fórmula oficial: {draftLikelihood} × {draftImpact} = {draftScore}
                                </div>

                                {userCanEditIsoRiskMatrix && item.id && !matrixDryRun && (
                                  <button
                                    type="button"
                                    onClick={() => saveMatrixRiskInputs(item)}
                                    disabled={!draftChanged || savingMatrixRiskInputId === item.id}
                                    className="text-xs px-2 py-1 rounded bg-gray-950 text-white disabled:bg-gray-300 disabled:text-gray-600"
                                  >
                                    {savingMatrixRiskInputId === item.id ? 'Guardando...' : 'Guardar P/I'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${riskLevelClass(item.residual_risk_level)}`}>
                                {item.residual_risk_score || 0} · {item.residual_risk_level || 'bajo'}
                              </span>
                            </td>
                            <td className="px-4 py-3 capitalize text-gray-700">
                              {item.treatment_strategy || 'monitorear'}
                            </td>
                            <td className="px-4 py-3">
                              {item.id ? (
                                <div className="flex flex-col gap-2">
                                  <span className="text-xs text-gray-500 capitalize">{item.status || 'suggested'}</span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => reviewRiskItem(item.id, 'accepted')}
                                      className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                      Aceptar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => reviewRiskItem(item.id, 'rejected')}
                                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Disponible al guardar</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Acciones sugeridas</h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
                    {matrixActions.slice(0, 12).map((action, index) => (
                      <div key={action.id || `${action.title || action.action_title}-${index}`} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-950">
                              {action.action_title || action.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {action.risk_title || action.action_description || action.description}
                            </div>
                          </div>
                          <span className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-700 capitalize">
                            {action.priority || 'media'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {action.suggested_owner_role || action.owner_role || 'Responsable'} · {action.suggested_due_days || action.due_days || 30} dias
                        </div>
                      </div>
                    ))}
                    {matrixActions.length === 0 && (
                      <div className="p-4 text-sm text-gray-500">
                        Sin acciones sugeridas para mostrar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-gray-500">
              Selecciona una norma y simula la matriz para ver riesgos por activo, brecha y control.
            </div>
          )}
        </div>

        {!iso && (
          <div className="bg-white p-6 rounded shadow space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <TcdxIcon name="risk" className="h-5 w-5" />
              </span>
              {t('riskMatrix.title')}
            </h2>
            <p className="text-gray-700">
              {t('riskMatrix.emptyIntro.line1')}
            </p>
            <p className="text-gray-700">
              {t('riskMatrix.emptyIntro.line2')}
            </p>
            <p className="text-gray-600">
              {t('riskMatrix.emptyIntro.line3')}
            </p>
          </div>
        )}

        {iso && loadingControls && (
          <div className="bg-white p-4 rounded shadow text-gray-500">
            {t('riskMatrix.loading')}
          </div>
        )}

        {iso && !loadingControls && (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-5 border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#eef4ff_0%,#ffffff_38%,#f8fafc_100%)] p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-700 shadow-sm">
                  <TcdxIcon name="risk" className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Matriz multinorma</p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                    Matriz de riesgo — {iso}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Heatmap moderno por probabilidad e impacto. El numero grande muestra riesgos en el cuadrante; el valor inferior muestra la criticidad asignada.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:grid-cols-4">
                {[
                  ['Bajo', '1 - 4', 'bg-emerald-500'],
                  ['Moderado', '5 - 9', 'bg-yellow-400'],
                  ['Alto', '10 - 16', 'bg-orange-500'],
                  ['Extremo', '17 - 25', 'bg-red-500'],
                ].map(([label, range, dot]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`h-4 w-4 rounded-full shadow-sm ${dot}`} />
                    <div>
                      <div className="text-sm font-bold text-slate-950">{label}</div>
                      <div className="text-xs font-semibold text-slate-500">{range}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {heatmapEntries.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                {t('riskMatrix.noControls')}
              </div>
            ) : (
              <div className="p-5 lg:p-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[1060px]">
                    <div className="grid grid-cols-[220px_repeat(5,minmax(138px,1fr))] gap-1.5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold uppercase tracking-wide text-indigo-700">
                        Probabilidad
                      </div>
                      {[1, 2, 3, 4, 5].map((impact) => (
                        <div key={`impact-head-${impact}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                          <div className="text-2xl font-black text-indigo-700">{impact}</div>
                          <div className="text-sm font-bold text-slate-950">{axisLabel(impact)}</div>
                          <div className="text-xs text-slate-500">Impacto</div>
                        </div>
                      ))}

                      {[5, 4, 3, 2, 1].map((likelihood) => (
                        <div key={`risk-row-${likelihood}`} className="contents">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-3xl font-black text-indigo-700">{likelihood}</div>
                            <div className="mt-1 text-base font-bold text-slate-950">{axisLabel(likelihood)}</div>
                            <div className="text-xs text-slate-500">Probabilidad</div>
                          </div>

                          {[1, 2, 3, 4, 5].map((impact) => {
                            const score = likelihood * impact;
                            const level = riskLevelFromScore(score);
                            const count = heatmapEntries.filter(
                              (entry) => entry.likelihood === likelihood && entry.impact === impact
                            ).length;
                            const isActive = selectedHeatmapCell?.likelihood === likelihood && selectedHeatmapCell?.impact === impact;

                            return (
                              <button
                                key={`${likelihood}-${impact}`}
                                type="button"
                                onClick={() => {
                                  setSelectedHeatmapCell({ likelihood, impact });
                                  setSelectedLevel(level);
                                }}
                                className={[
                                  'min-h-[132px] rounded-2xl border p-4 text-center shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-200',
                                  getHeatmapColor(score),
                                  isActive ? 'ring-4 ring-indigo-300' : '',
                                ].join(' ')}
                              >
                                <div className="text-5xl font-black leading-none tracking-tight">{count}</div>
                                <div className="mt-2 text-xs font-bold uppercase tracking-[0.16em] opacity-75">
                                  riesgos
                                </div>
                                <div className={`mx-auto mt-3 inline-flex rounded-xl px-3 py-1 text-xs font-black uppercase shadow-sm backdrop-blur ${getHeatmapLevelClass(level)}`}>
                                  {riskLevelLabel(level)}
                                </div>
                                <div className="mt-2 text-xs font-semibold opacity-80">
                                  Valor {score}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold uppercase tracking-wide text-indigo-700">
                        Impacto
                      </div>
                      {[1, 2, 3, 4, 5].map((impact) => (
                        <div key={`impact-foot-${impact}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                          <div className="text-2xl font-black text-indigo-700">{impact}</div>
                          <div className="text-sm font-bold text-slate-950">{axisLabel(impact)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedHeatmapCell && (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-950">
                          Riesgos en cuadrante P{selectedHeatmapCell.likelihood} / I{selectedHeatmapCell.impact}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Valor {selectedHeatmapCell.likelihood * selectedHeatmapCell.impact} · {riskLevelLabel(riskLevelFromScore(selectedHeatmapCell.likelihood * selectedHeatmapCell.impact))}
                        </p>
                      </div>
                      <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">
                        {selectedHeatmapEntries.length} elemento(s)
                      </span>
                    </div>

                    {selectedHeatmapEntries.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        No hay riesgos registrados en esta celda.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {selectedHeatmapEntries.slice(0, 8).map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-slate-950">{entry.title}</div>
                                <div className="mt-1 text-xs text-slate-500 line-clamp-2">{entry.description}</div>
                              </div>
                              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                                {entry.source === 'iso_matrix' ? 'ISO' : 'Control'}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              {entry.standard && <span>{entry.standard}</span>}
                              {entry.asset && <span>{entry.asset}</span>}
                              <span>Valor {entry.score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {selectedLevel && controls.length > 0 && (
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold">{t('riskMatrix.aiAnalysis')} — {riskLevelLabel(selectedLevel)}</h3>
            <p className="mt-2 text-gray-700">{explainRisk(selectedLevel)}</p>
          </div>
        )}

        {selectedLevel && controls.length > 0 && (
          <div className="bg-white p-6 rounded shadow space-y-4">
            <h3 className="font-semibold">
              {t('riskMatrix.controlsWithRisk')} {riskLevelLabel(selectedLevel)}
            </h3>

            {aiActionFeedback && (
              <div
                className={[
                  'rounded-2xl border px-4 py-3 text-sm',
                  aiActionFeedback.kind === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : aiActionFeedback.kind === 'error'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-blue-200 bg-blue-50 text-blue-800',
                ].join(' ')}
              >
                {aiActionFeedback.message}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-gray-500">
                {t('riskMatrix.noControlsForLevel')}
              </div>
            ) : (
              <div className="max-h-[560px] space-y-4 overflow-y-auto pr-2 tcdx-scrollbar">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  id={`risk-control-${c.id}`}
                  className={`border p-4 rounded space-y-2 transition-all ${
                    focusedControlId === c.id
                      ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50'
                      : ''
                  }`}
                >
                  <div className="font-semibold">
                    {t('riskMatrix.clause')} {c.clause}:{' '}
                    {c.category
                      ?.replace(`Cláusula ${c.clause}:`, '')
                      .replace(':', '')
                      .trim() || c.category}
                  </div>

                  <div className="text-sm text-gray-600">{c.description}</div>

                  <div className="text-sm">
                    {t('riskMatrix.standard')}: <strong>{c.iso}</strong>
                  </div>

                  <div className="text-sm">
                    {t('riskMatrix.score')}: <strong>{c.score}</strong>
                  </div>

                  {c.nivel !== 'BAJO' && (
                    <button
                      type="button"
                      onClick={() => applyAI(c.id)}
                      disabled={applyingAiControlId === c.id}
                      className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applyingAiControlId === c.id ? 'Creando...' : 'Crear borrador IA'}
                    </button>
                  )}
                </div>
              ))}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
