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
  tiempo_subsanacion_min?: number | string | null;
  tiempo_subsanacion_mode?: number | string | null;
  tiempo_subsanacion_max?: number | string | null;
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
  norm: string;
  process: string;
  unit: string;
  horizon: QuantitativeRiskHorizon;
};

export type QuantitativeRiskKpis = {
  expectedExposure: number;
  p95: number;
  criticalProbability: number | null;
  prioritizedHighRisks: number;
};

export const HORIZON_OPTIONS: Array<{ value: QuantitativeRiskHorizon; label: string; factor: number }> = [
  { value: 'mensual', label: 'Mensual', factor: 1 / 12 },
  { value: 'trimestral', label: 'Trimestral', factor: 1 / 4 },
  { value: 'anual', label: 'Anual', factor: 1 },
];

export const DEFAULT_QUANTITATIVE_FILTERS: QuantitativeRiskFilters = {
  norm: 'all',
  process: 'all',
  unit: 'all',
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
    if (criticalProbability >= 0.8) return 5;
    if (criticalProbability >= 0.5) return 4;
    if (criticalProbability >= 0.2) return 3;
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

function impactScoreFrom(p95: number, threshold: number | null) {
  if (!threshold || threshold <= 0) {
    if (p95 >= 160) return 5;
    if (p95 >= 80) return 4;
    if (p95 >= 40) return 3;
    if (p95 >= 16) return 2;
    return 1;
  }

  const ratio = p95 / threshold;
  if (ratio >= 1.5) return 5;
  if (ratio >= 1) return 4;
  if (ratio >= 0.65) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

function statusFrom(probabilityScore: number, impactScore: number, criticalProbability: number | null): QuantitativeRiskStatus {
  const score = probabilityScore * impactScore;
  if (score >= 20 || Number(criticalProbability || 0) >= 0.5) return 'critico';
  if (score >= 12 || Number(criticalProbability || 0) >= 0.2) return 'alto';
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
  const criticalProbability = row.probabilidad_disrupcion_critica === null || row.probabilidad_disrupcion_critica === undefined
    ? null
    : toNumber(row.probabilidad_disrupcion_critica);
  const probabilityScore = clampScore(probabilityScoreFrom(row, criticalProbability));
  const impactScore = clampScore(impactScoreFrom(p95, threshold));
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
  return risks.filter((risk) => {
    const normMatches = filters.norm === 'all' || risk.normId === filters.norm;
    const processMatches = filters.process === 'all' || risk.processName === filters.process;
    const unitMatches = filters.unit === 'all' || risk.unit === filters.unit;
    return normMatches && processMatches && unitMatches;
  });
}

export function calculateQuantitativeRiskKpis(risks: QuantitativeRisk[]): QuantitativeRiskKpis {
  if (risks.length === 0) {
    return {
      expectedExposure: 0,
      p95: 0,
      criticalProbability: null,
      prioritizedHighRisks: 0,
    };
  }

  const criticalProbabilities = risks
    .map((risk) => risk.criticalProbability)
    .filter((value): value is number => value !== null);

  return {
    expectedExposure: risks.reduce((sum, risk) => sum + risk.expectedValue, 0),
    p95: risks.reduce((sum, risk) => sum + risk.p95, 0),
    criticalProbability: criticalProbabilities.length
      ? criticalProbabilities.reduce((sum, value) => sum + value, 0) / criticalProbabilities.length
      : null,
    prioritizedHighRisks: risks.filter((risk) => risk.status === 'alto' || risk.status === 'critico').length,
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
