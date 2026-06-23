export type QuantitativeRiskStatus = 'bajo' | 'medio' | 'alto' | 'critico';
export type QuantitativeRiskHorizon = 'mensual' | 'trimestral' | 'anual';

export type OperationalRiskSimulationRow = {
  id: string;
  tenant_id?: string | null;
  source_risk_id?: string | null;
  norma_tipo?: string | null;
  modelo_usado?: string | null;
  nombre_riesgo?: string | null;
  proceso_afectado?: string | null;
  descripcion?: string | null;
  frecuencia_min?: number | string | null;
  frecuencia_mode?: number | string | null;
  frecuencia_max?: number | string | null;
  impacto_min?: number | string | null;
  impacto_mode?: number | string | null;
  impacto_max?: number | string | null;
  tasa_error_min?: number | string | null;
  tasa_error_mode?: number | string | null;
  tasa_error_max?: number | string | null;
  tiempo_subsanacion_min?: number | string | null;
  tiempo_subsanacion_mode?: number | string | null;
  tiempo_subsanacion_max?: number | string | null;
  volumen_operativo_anual?: number | string | null;
  umbral_disrupcion_critica_horas?: number | string | null;
  iteraciones?: number | string | null;
  media_operativa_anual?: number | string | null;
  peor_escenario_p90?: number | string | null;
  peor_escenario_p95?: number | string | null;
  probabilidad_disrupcion_critica?: number | string | null;
  created_at?: string | null;
};

export type QuantitativeRisk = {
  id: string;
  code: string;
  name: string;
  normId: string;
  normName: string;
  processName: string;
  tenantId?: string | null;
  unit: string;
  horizon: QuantitativeRiskHorizon;
  frequencyMin: number;
  frequencyMostLikely: number;
  frequencyMax: number;
  impactMin: number;
  impactMostLikely: number;
  impactMax: number;
  iterations: number;
  criticalThreshold: number | null;
  expectedValue: number;
  p90: number;
  p95: number;
  criticalProbability: number | null;
  probabilityScore: number;
  impactScore: number;
  status: QuantitativeRiskStatus;
  suggestedAction: string;
  source: OperationalRiskSimulationRow;
};

export type QuantitativeRiskFilters = {
  search: string;
  norm: string;
  process: string;
  unit: string;
  status: string;
  horizon: QuantitativeRiskHorizon;
};

export type QuantitativeRiskKpis = {
  expectedExposure: number;
  conservativeP95: number;
  criticalProbability: number | null;
  prioritizedHighRisks: number;
};

export type PortfolioExposureLevel = QuantitativeRiskStatus;

export type ExecutiveRiskSummary = {
  level: PortfolioExposureLevel;
  title: string;
  narrative: string;
  priorityFocus: string;
  p95Leader: QuantitativeRisk | null;
  criticalProbabilityLeader: QuantitativeRisk | null;
  expectedExposureLeader: QuantitativeRisk | null;
  highOrCriticalCount: number;
};

export type RiskContributorItem = {
  risk: QuantitativeRisk;
  value: number;
  contributionPercent: number | null;
};

export type TopRiskContributors = {
  byP95: RiskContributorItem[];
  byExpectedExposure: RiskContributorItem[];
  byCriticalProbability: RiskContributorItem[];
};

export type RiskTreatmentRecommendation = {
  treatment: 'Mitigar' | 'Transferir' | 'Aceptar' | 'Evitar';
  action: string;
  controlFocus: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Critica';
  horizon: 'inmediato' | '30 dias' | '60 dias' | '90 dias';
  justification: string;
};

export type OperationalRiskRecommendationResult = {
  diagnostico_operativo?: string;
  controles_sugeridos?: unknown[];
  efectividad_estimada_pct?: number | string | null;
  requiere_validacion_humana?: boolean;
};

export type AiAuditorOperationalPayload = {
  scope: 'portfolio' | 'simulation';
  include_web_context?: boolean;
  options?: {
    include_web_context?: boolean;
  };
  methodology: {
    exposureExpectedAccumulated: string;
    conservativeP95: string;
    criticalProbabilityAverage: string;
    warning: string;
  };
  kpis: {
    exposureExpectedAccumulated: number;
    conservativeP95: number;
    criticalProbabilityAverage: number | null;
    highPrioritizedRisks: number;
  };
  selectedRisk: ReturnType<typeof toAiRiskPayload> | null;
  risks: Array<ReturnType<typeof toAiRiskPayload>>;
};

export type OperationalAiAnalysis = {
  diagnostico_ejecutivo: string;
  lectura_portafolio?: string;
  resumen_ejecutivo?: string;
  lectura_cuantitativa?: Record<string, unknown> | null;
  hipotesis_operativas?: unknown[];
  causas_probables?: unknown[];
  riesgos_prioritarios: unknown[];
  concentracion_exposicion?: unknown[];
  acciones_sugeridas: unknown[];
  acciones_tratamiento?: unknown[];
  controles_iso_sugeridos: unknown[];
  evidencia_requerida?: unknown[];
  criterios_cierre?: unknown[];
  riesgos_residuales?: unknown[];
  datos_faltantes?: unknown[];
  nivel_confianza?: {
    nivel?: string;
    justificacion?: string;
    factores?: unknown[];
  } | null;
  uso_sugerido?: unknown[];
  web_context?: {
    used?: boolean;
    status?: 'not_requested' | 'disabled_for_tenant' | 'used' | 'failed' | string;
    searched_at?: string | null;
    queries?: string[];
    sources?: Array<Record<string, unknown>>;
    external_insights?: string[];
    external_risk_signals?: string[];
    external_control_references?: string[];
    message?: string | null;
    error?: string | null;
  } | null;
  advertencias_metodologicas: unknown[];
  proximos_pasos: unknown[];
  efectividad_estimada_pct: number | null;
  ai_model: string;
  prompt_version: string;
  scope?: 'portfolio' | 'simulation' | string;
  request_id?: string | null;
  ai_engine_used?: boolean;
  source?: string;
  generation_mode?: string;
  guardable?: boolean;
};

export type OperationalAiAnalysisJob = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  simulation_id?: string | null;
  source_risk_id?: string | null;
  analysis_json?: OperationalAiAnalysis | null;
  error_code?: string | null;
  error_message?: string | null;
  ai_model?: string | null;
  request_payload_json?: {
    include_web_context?: boolean;
    options?: {
      include_web_context?: boolean;
    };
  } | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export const HORIZON_OPTIONS: Array<{ value: QuantitativeRiskHorizon; label: string; factor: number }> = [
  { value: 'mensual', label: 'Mensual', factor: 1 / 12 },
  { value: 'trimestral', label: 'Trimestral', factor: 1 / 4 },
  { value: 'anual', label: 'Anual', factor: 1 },
];

export const DEFAULT_QUANTITATIVE_FILTERS: QuantitativeRiskFilters = {
  search: '',
  norm: 'all',
  process: 'all',
  unit: 'all',
  status: 'all',
  horizon: 'anual',
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function betaPertMean(min: number, mostLikely: number, max: number) {
  return (min + 4 * mostLikely + max) / 6;
}

function createSeededRandom(seed?: string | number | null) {
  if (seed === undefined || seed === null || seed === '') return Math.random;

  let h = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return function seededRandom() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGamma(shape: number, rng: () => number): number {
  if (shape <= 0 || !Number.isFinite(shape)) return 0;

  if (shape < 1) {
    const u = Math.max(Number.EPSILON, rng());
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x = 0;
    let v = 0;

    do {
      const u1 = Math.max(Number.EPSILON, rng());
      const u2 = Math.max(Number.EPSILON, rng());
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng();

    if (u < 1 - 0.0331 * (x ** 4)) return d * v;
    if (Math.log(Math.max(Number.EPSILON, u)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randomBeta(alpha: number, beta: number, rng: () => number) {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

export function sampleBetaPert({
  min,
  mostLikely,
  max,
  iterations,
  seed,
}: {
  min: number;
  mostLikely: number;
  max: number;
  iterations: number;
  seed?: string | number | null;
}) {
  const count = Math.max(1, Math.round(iterations));
  const range = max - min;

  if (range <= 0) {
    return Array.from({ length: count }, () => min);
  }

  // Beta-PERT converts min/mode/max into beta alpha/beta weights around the most likely value.
  const alpha = 1 + 4 * ((mostLikely - min) / range);
  const beta = 1 + 4 * ((max - mostLikely) / range);
  const rng = createSeededRandom(seed);

  return Array.from({ length: count }, () => min + randomBeta(alpha, beta, rng) * range);
}

export function percentile(samples: number[], p: number) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function horizonFactor(horizon: QuantitativeRiskHorizon) {
  return HORIZON_OPTIONS.find((option) => option.value === horizon)?.factor || 1;
}

function normName(normId: string) {
  if (normId === 'ISO27001') return 'ISO 27001';
  if (normId === 'ISO9001') return 'ISO 9001';
  return normId.replace(/^ISO(\d+)/, 'ISO $1');
}

export function normalizeNormId(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function unitLabel(row: OperationalRiskSimulationRow) {
  const model = String(row.modelo_usado || '');
  if (model.includes('ISO9001')) return 'Horas de reproceso';
  return 'Horas de inactividad';
}

function probabilityScoreFrom(row: OperationalRiskSimulationRow, criticalProbability: number | null) {
  if (criticalProbability !== null) {
    if (criticalProbability >= 0.5) return 5;
    if (criticalProbability >= 0.3) return 4;
    if (criticalProbability >= 0.15) return 3;
    if (criticalProbability >= 0.05) return 2;
    return 1;
  }

  const frequencyMean = betaPertMean(
    toNumber(row.frecuencia_min),
    toNumber(row.frecuencia_mode),
    toNumber(row.frecuencia_max)
  );

  if (frequencyMean >= 10) return 5;
  if (frequencyMean >= 6) return 4;
  if (frequencyMean >= 3) return 3;
  if (frequencyMean >= 1) return 2;
  return 1;
}

function impactScoreFrom(annualP95: number) {
  if (annualP95 >= 120) return 5;
  if (annualP95 >= 60) return 4;
  if (annualP95 >= 24) return 3;
  if (annualP95 >= 8) return 2;
  return 1;
}

function statusFrom(probabilityScore: number, impactScore: number, criticalProbability: number | null): QuantitativeRiskStatus {
  const score = probabilityScore * impactScore;
  if (
    (probabilityScore >= 5 && impactScore >= 4) ||
    (impactScore === 5 && Number(criticalProbability || 0) >= 0.3)
  ) {
    return 'critico';
  }
  if (score >= 12) return 'alto';
  if (score >= 6) return 'medio';
  return 'bajo';
}

function suggestedAction(status: QuantitativeRiskStatus, row: OperationalRiskSimulationRow) {
  const model = String(row.modelo_usado || '');
  if (status === 'critico') return 'Escalar tratamiento, reforzar continuidad y validar mitigacion con responsable del proceso.';
  if (status === 'alto') return model.includes('ISO9001')
    ? 'Reducir variabilidad operativa, controles de verificacion y tiempos de subsanacion.'
    : 'Reforzar redundancia, runbooks de recuperacion y pruebas de contingencia.';
  if (status === 'medio') return 'Monitorear tendencia, revisar umbral y priorizar controles preventivos.';
  return 'Mantener seguimiento periodico y evidencia de control.';
}

export function normalizeOperationalSimulation(
  row: OperationalRiskSimulationRow,
  index: number,
  horizon: QuantitativeRiskHorizon
): QuantitativeRisk {
  const normId = normalizeNormId(row.norma_tipo);
  const factor = horizonFactor(horizon);
  const thresholdAnnual = row.umbral_disrupcion_critica_horas === null || row.umbral_disrupcion_critica_horas === undefined
    ? null
    : toNumber(row.umbral_disrupcion_critica_horas);
  const threshold = thresholdAnnual === null ? null : thresholdAnnual * factor;
  const expectedValue = toNumber(row.media_operativa_anual) * factor;
  const p90 = toNumber(row.peor_escenario_p90) * factor;
  const p95 = toNumber(row.peor_escenario_p95) * factor;
  const annualP95 = toNumber(row.peor_escenario_p95);
  const criticalProbability = row.probabilidad_disrupcion_critica === null || row.probabilidad_disrupcion_critica === undefined
    ? null
    : toNumber(row.probabilidad_disrupcion_critica);
  const probabilityScore = clampScore(probabilityScoreFrom(row, criticalProbability));
  const impactScore = clampScore(impactScoreFrom(annualP95));
  const status = statusFrom(probabilityScore, impactScore, criticalProbability);
  const impactMin = row.tiempo_subsanacion_min ?? row.impacto_min;
  const impactMode = row.tiempo_subsanacion_mode ?? row.impacto_mode;
  const impactMax = row.tiempo_subsanacion_max ?? row.impacto_max;

  return {
    id: row.id,
    code: `R-${String(index + 1).padStart(2, '0')}`,
    name: String(row.nombre_riesgo || 'Riesgo operativo sin nombre'),
    normId,
    normName: normName(normId),
    processName: String(row.proceso_afectado || 'Proceso no especificado'),
    tenantId: row.tenant_id,
    unit: unitLabel(row),
    horizon,
    frequencyMin: toNumber(row.frecuencia_min),
    frequencyMostLikely: toNumber(row.frecuencia_mode),
    frequencyMax: toNumber(row.frecuencia_max),
    impactMin: toNumber(impactMin),
    impactMostLikely: toNumber(impactMode),
    impactMax: toNumber(impactMax),
    iterations: toNumber(row.iteraciones),
    criticalThreshold: threshold,
    expectedValue,
    p90,
    p95,
    criticalProbability,
    probabilityScore,
    impactScore,
    status,
    suggestedAction: suggestedAction(status, row),
    source: row,
  };
}

export function buildQuantitativeRisks(
  rows: OperationalRiskSimulationRow[],
  horizon: QuantitativeRiskHorizon
) {
  return rows.map((row, index) => normalizeOperationalSimulation(row, index, horizon));
}

export function filterQuantitativeRisks(risks: QuantitativeRisk[], filters: QuantitativeRiskFilters) {
  const search = String(filters.search || '').trim().toLowerCase();

  return risks.filter((risk) => {
    const searchMatches =
      !search ||
      [
        risk.code,
        risk.name,
        risk.processName,
        risk.normName,
        risk.unit,
        risk.status,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search));
    const normMatches = filters.norm === 'all' || risk.normId === filters.norm;
    const processMatches = filters.process === 'all' || risk.processName === filters.process;
    const unitMatches = filters.unit === 'all' || risk.unit === filters.unit;
    const statusMatches = filters.status === 'all' || risk.status === filters.status;
    return searchMatches && normMatches && processMatches && unitMatches && statusMatches;
  });
}

export function calculateQuantitativeRiskKpis(risks: QuantitativeRisk[]): QuantitativeRiskKpis {
  if (risks.length === 0) {
    return {
      expectedExposure: 0,
      conservativeP95: 0,
      criticalProbability: null,
      prioritizedHighRisks: 0,
    };
  }

  const criticalProbabilities = risks
    .map((risk) => risk.criticalProbability)
    .filter((value): value is number => value !== null);

  return {
    expectedExposure: risks.reduce((sum, risk) => sum + risk.expectedValue, 0),
    conservativeP95: risks.reduce((sum, risk) => sum + risk.p95, 0),
    criticalProbability: criticalProbabilities.length
      ? criticalProbabilities.reduce((sum, value) => sum + value, 0) / criticalProbabilities.length
      : null,
    prioritizedHighRisks: risks.filter((risk) => risk.status === 'alto' || risk.status === 'critico').length,
  };
}

function statusWeight(status: QuantitativeRiskStatus) {
  if (status === 'critico') return 4;
  if (status === 'alto') return 3;
  if (status === 'medio') return 2;
  return 1;
}

function levelLabel(level: PortfolioExposureLevel) {
  if (level === 'critico') return 'critica';
  if (level === 'alto') return 'alta';
  if (level === 'medio') return 'media';
  return 'baja';
}

function topBy(risks: QuantitativeRisk[], value: (risk: QuantitativeRisk) => number, total = 0): RiskContributorItem[] {
  return [...risks]
    .sort((a, b) => value(b) - value(a))
    .slice(0, 3)
    .map((risk) => ({
      risk,
      value: value(risk),
      contributionPercent: total > 0 ? getRiskContributionPercent(value(risk), total) : null,
    }));
}

export function getRiskContributionPercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function getTopRiskContributors(risks: QuantitativeRisk[]): TopRiskContributors {
  const totalP95 = risks.reduce((sum, risk) => sum + risk.p95, 0);
  const totalExpected = risks.reduce((sum, risk) => sum + risk.expectedValue, 0);

  return {
    byP95: topBy(risks, (risk) => risk.p95, totalP95),
    byExpectedExposure: topBy(risks, (risk) => risk.expectedValue, totalExpected),
    byCriticalProbability: topBy(
      risks.filter((risk) => risk.criticalProbability !== null),
      (risk) => Number(risk.criticalProbability || 0),
      0
    ),
  };
}

export function getPortfolioExposureLevel(risks: QuantitativeRisk[], kpis: QuantitativeRiskKpis): PortfolioExposureLevel {
  if (risks.length === 0) return 'bajo';

  const criticalCount = risks.filter((risk) => risk.status === 'critico').length;
  const highOrCriticalCount = risks.filter((risk) => risk.status === 'alto' || risk.status === 'critico').length;
  const mediumCount = risks.filter((risk) => risk.status === 'medio').length;
  const averageSeverity = risks.reduce((sum, risk) => sum + statusWeight(risk.status), 0) / risks.length;
  const criticalProbability = Number(kpis.criticalProbability || 0);

  if ((criticalCount >= 1 && kpis.conservativeP95 >= 120) || criticalProbability >= 0.5) return 'critico';
  if (highOrCriticalCount >= 3 || criticalProbability >= 0.3 || averageSeverity >= 3) return 'alto';
  if (mediumCount > 0 || kpis.expectedExposure >= 24 || averageSeverity >= 2) return 'medio';
  return 'bajo';
}

export function buildExecutiveRiskSummary(
  risks: QuantitativeRisk[],
  kpis: QuantitativeRiskKpis
): ExecutiveRiskSummary {
  const contributors = getTopRiskContributors(risks);
  const level = getPortfolioExposureLevel(risks, kpis);
  const p95Leader = contributors.byP95[0]?.risk || null;
  const expectedExposureLeader = contributors.byExpectedExposure[0]?.risk || null;
  const criticalProbabilityLeader = contributors.byCriticalProbability[0]?.risk || null;
  const highOrCriticalCount = risks.filter((risk) => risk.status === 'alto' || risk.status === 'critico').length;
  const mainDrivers = [p95Leader?.name, expectedExposureLeader?.name]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 2);

  if (risks.length === 0) {
    return {
      level,
      title: 'Sin exposicion operacional calculada',
      narrative: 'No hay riesgos operativos evaluados para los filtros actuales.',
      priorityFocus: 'Ingrese una simulacion para construir lectura ejecutiva y priorizacion.',
      p95Leader: null,
      criticalProbabilityLeader: null,
      expectedExposureLeader: null,
      highOrCriticalCount: 0,
    };
  }

  const narrative = [
    `Los riesgos filtrados muestran una exposicion operacional ${levelLabel(level)}.`,
    mainDrivers.length
      ? `La mayor concentracion se observa en ${mainDrivers.join(' y ')}.`
      : 'La exposicion esta distribuida entre los riesgos evaluados.',
    highOrCriticalCount > 0
      ? `${highOrCriticalCount} riesgo(s) requieren priorizacion por estado alto o critico.`
      : 'No se observan riesgos altos o criticos con los filtros actuales.',
  ].join(' ');

  const priorityFocus = criticalProbabilityLeader
    ? `Reducir probabilidad critica y severidad en ${criticalProbabilityLeader.name}.`
    : p95Leader
      ? `Reducir P95 individual en ${p95Leader.name}.`
      : 'Mantener monitoreo de controles y umbrales operativos.';

  return {
    level,
    title: `Exposicion operacional ${levelLabel(level)}`,
    narrative,
    priorityFocus,
    p95Leader,
    criticalProbabilityLeader,
    expectedExposureLeader,
    highOrCriticalCount,
  };
}

function includesAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function controlFocusForRisk(risk: QuantitativeRisk) {
  const text = `${risk.name} ${risk.processName}`.toLowerCase();

  if (includesAny(text, ['autenticacion', 'autenticación', 'acceso', 'iam', 'identidad'])) {
    return 'IAM, MFA, monitoreo de accesos, contingencia y pruebas de acceso.';
  }
  if (includesAny(text, ['respaldo', 'backup', 'restauracion', 'restauración', 'continuidad', 'drp'])) {
    return 'Pruebas de restauracion, RTO/RPO, DRP, playbooks y evidencias de continuidad.';
  }
  if (includesAny(text, ['cambio', 'cambios', 'liberacion', 'liberación', 'version', 'versión', 'release'])) {
    return 'CAB, pipeline QA, rollback, control de cambios y pruebas automatizadas.';
  }
  if (includesAny(text, ['base de datos', 'database', 'infraestructura', 'capacidad', 'servidor'])) {
    return 'Capacidad, monitoreo, tuning, escalamiento, alertas y pruebas de carga.';
  }
  if (includesAny(text, ['documentacion', 'documentación', 'documental', 'politica', 'política'])) {
    return 'Control documental, ownership, revision periodica y versionamiento.';
  }
  if (includesAny(text, ['soporte', 'incidente', 'sla', 'mesa de ayuda', 'ticket'])) {
    return 'Escalamiento, runbooks, guardias, metricas SLA y postmortems.';
  }
  if (includesAny(text, ['parametrizacion', 'parametrización', 'cliente', 'implementacion', 'implementación'])) {
    return 'Checklist, QA funcional, doble validacion y control de entregables.';
  }
  if (includesAny(text, ['conciliacion', 'conciliación', 'backoffice', 'back office'])) {
    return 'Controles preventivos, conciliacion automatizada, segregacion y revision dual.';
  }

  return 'Controles preventivos, monitoreo operativo, owner definido y evidencia de seguimiento.';
}

export function buildRiskTreatmentRecommendation(risk: QuantitativeRisk | null): RiskTreatmentRecommendation | null {
  if (!risk) return null;

  const highCriticalProbability = Number(risk.criticalProbability || 0) >= 0.3;
  const controlFocus = controlFocusForRisk(risk);

  if (risk.status === 'critico') {
    return {
      treatment: 'Mitigar',
      action: 'Ejecutar plan de tratamiento inmediato con responsable, umbral de recuperacion y evidencia de control.',
      controlFocus,
      priority: 'Critica',
      horizon: 'inmediato',
      justification: 'El riesgo combina severidad operativa alta con probabilidad o impacto suficiente para afectar continuidad.',
    };
  }

  if (risk.status === 'alto') {
    return {
      treatment: highCriticalProbability ? 'Mitigar' : 'Transferir',
      action: highCriticalProbability
        ? 'Reducir frecuencia y variabilidad del evento antes del siguiente ciclo de revision.'
        : 'Evaluar mitigacion operativa y transferencia contractual/SLA si existe dependencia externa.',
      controlFocus,
      priority: 'Alta',
      horizon: '30 dias',
      justification: 'El score compuesto exige priorizacion, aunque puede admitir tratamiento gradual si la probabilidad critica es contenida.',
    };
  }

  if (risk.status === 'medio') {
    return {
      treatment: 'Mitigar',
      action: 'Aplicar controles selectivos y monitorear tendencia antes de escalar inversion.',
      controlFocus,
      priority: 'Media',
      horizon: '60 dias',
      justification: 'La exposicion requiere seguimiento, pero no desplaza a riesgos altos o criticos.',
    };
  }

  return {
    treatment: 'Aceptar',
    action: 'Mantener monitoreo periodico y evidencia de control; revisar si cambian umbrales o frecuencia.',
    controlFocus,
    priority: 'Baja',
    horizon: '90 dias',
    justification: 'La exposicion calculada se mantiene dentro de niveles bajos para los filtros actuales.',
  };
}

export function buildMethodologyNote() {
  return 'Los KPI agregados resumen los riesgos filtrados. La exposicion esperada acumulada corresponde a la suma de medias anuales. El P95 agregado conservador corresponde a la suma de P95 individuales y no equivale a una simulacion de portafolio con correlacion entre riesgos.';
}

function truncateText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function roundForAi(value: number | null, decimals = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toAiRiskPayload(risk: QuantitativeRisk) {
  return {
    id: risk.id,
    sourceRiskId: risk.source.source_risk_id || null,
    name: truncateText(risk.name, 120),
    standard: risk.normId === 'ISO9001' ? 'ISO9001' : 'ISO27001',
    model: truncateText(risk.source.modelo_usado, 80),
    process: truncateText(risk.processName, 80),
    description: truncateText(risk.source.descripcion, 240),
    expectedAnnualExposure: roundForAi(risk.expectedValue, 2),
    p95: roundForAi(risk.p95, 2),
    criticalProbability: roundForAi(risk.criticalProbability, 4),
    status: risk.status,
    probabilityScore: risk.probabilityScore,
    impactScore: risk.impactScore,
    frequency: {
      min: roundForAi(risk.frequencyMin, 2),
      mode: roundForAi(risk.frequencyMostLikely, 2),
      max: roundForAi(risk.frequencyMax, 2),
    },
    impact: {
      min: roundForAi(risk.impactMin, 2),
      mode: roundForAi(risk.impactMostLikely, 2),
      max: roundForAi(risk.impactMax, 2),
    },
  };
}

type AiRiskPayloadItem = ReturnType<typeof toAiRiskPayload>;

function aiRiskKey(risk: AiRiskPayloadItem) {
  return [risk.standard, risk.model, risk.name, risk.process].map((value) => String(value || '').toLowerCase()).join('|');
}

function aiStatusRank(status: string) {
  if (status === 'critico') return 4;
  if (status === 'alto') return 3;
  if (status === 'medio') return 2;
  return 1;
}

function aiRiskSort(a: AiRiskPayloadItem, b: AiRiskPayloadItem) {
  return (
    aiStatusRank(b.status) - aiStatusRank(a.status) ||
    Number(b.p95 || 0) - Number(a.p95 || 0) ||
    Number(b.criticalProbability || 0) - Number(a.criticalProbability || 0) ||
    Number(b.expectedAnnualExposure || 0) - Number(a.expectedAnnualExposure || 0)
  );
}

function compactAiRisks(risks: QuantitativeRisk[], selectedRisk: QuantitativeRisk | null) {
  const selectedPayload = selectedRisk ? toAiRiskPayload(selectedRisk) : null;
  const byKey = new Map<string, AiRiskPayloadItem>();

  risks.map(toAiRiskPayload).forEach((risk) => {
    const key = aiRiskKey(risk);
    const current = byKey.get(key);
    if (!current || Number(risk.p95 || 0) > Number(current.p95 || 0)) {
      byKey.set(key, risk);
    }
  });

  if (selectedPayload) {
    byKey.set(aiRiskKey(selectedPayload), selectedPayload);
  }

  const ordered = Array.from(byKey.values()).sort(aiRiskSort);
  if (!selectedPayload) return ordered.slice(0, 8);

  const selectedKey = aiRiskKey(selectedPayload);
  const rest = ordered.filter((risk) => aiRiskKey(risk) !== selectedKey);
  return [selectedPayload, ...rest].slice(0, 8);
}

export function getAiAuditorPayload(
  risks: QuantitativeRisk[],
  selectedRisk: QuantitativeRisk | null,
  kpis: QuantitativeRiskKpis,
  includeWebContext = false
): AiAuditorOperationalPayload {
  const compactRisks = compactAiRisks(risks, selectedRisk);

  return {
    scope: risks.length > 1 ? 'portfolio' : 'simulation',
    include_web_context: includeWebContext,
    options: {
      include_web_context: includeWebContext,
    },
    methodology: {
      exposureExpectedAccumulated: 'SUM(media_operativa_anual)',
      conservativeP95: 'SUM(peor_escenario_p95)',
      criticalProbabilityAverage: 'AVG(probabilidad_disrupcion_critica)',
      warning: 'El P95 agregado conservador no equivale a un P95 de portafolio simulado.',
    },
    kpis: {
      exposureExpectedAccumulated: kpis.expectedExposure,
      conservativeP95: kpis.conservativeP95,
      criticalProbabilityAverage: kpis.criticalProbability,
      highPrioritizedRisks: kpis.prioritizedHighRisks,
    },
    selectedRisk: selectedRisk ? toAiRiskPayload(selectedRisk) : null,
    risks: compactRisks,
  };
}

export function statusLabel(status: QuantitativeRiskStatus) {
  if (status === 'critico') return 'Critico';
  if (status === 'alto') return 'Alto';
  if (status === 'medio') return 'Medio';
  return 'Bajo';
}

export function formatRiskNumber(value: number, decimals = 0) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatRiskProbability(value: number | null) {
  if (value === null) return '-';
  return `${Math.round(value * 100)}%`;
}
