const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const WRITE_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'operativo',
  'responsable_area',
  'area_owner',
]);

const READ_ROLES = new Set([
  ...WRITE_ROLES,
  'auditor',
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
  'ejecutivo',
]);

const VALID_NORMS = new Set(['ISO27001', 'ISO9001']);
const VALID_MODELS = new Set(['ISO27001_TTIA', 'ISO9001_COP_SIMPLE', 'ISO9001_COP_AVANZADO']);
const FINANCIAL_LANGUAGE_RE = /\b(costos?|costs?|d[oó]lares?|usd|roi|retorno|multa(?:s)?|financier[oa]s?|presupuesto|budget|money|revenue|ingresos?)\b/i;

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(normalizeRole(role));
}

function getUserRole(user) {
  return normalizeRole(user?.role || user?.user_role || user?.userRole || '');
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function canReadOperationalRisk(user) {
  const role = getUserRole(user);
  return isPlatformRole(role) || READ_ROLES.has(role);
}

function canCreateOperationalRisk(user) {
  const role = getUserRole(user);
  return isPlatformRole(role) || WRITE_ROLES.has(role);
}

function resolveTenantIdForRequest(user, explicitTenantId) {
  const role = getUserRole(user);
  if (isPlatformRole(role)) {
    return explicitTenantId || getUserTenantId(user) || null;
  }
  return getUserTenantId(user);
}

function assertCanReadTenant(user, tenantId) {
  if (!canReadOperationalRisk(user)) {
    throw publicError(403, 'OPERATIONAL_RISK_RBAC_DENIED', 'Rol no autorizado para leer simulaciones operativas');
  }

  if (isPlatformRole(getUserRole(user))) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function assertCanCreateTenant(user, tenantId) {
  if (!canCreateOperationalRisk(user)) {
    throw publicError(403, 'OPERATIONAL_RISK_RBAC_DENIED', 'Rol no autorizado para crear simulaciones operativas');
  }

  if (isPlatformRole(getUserRole(user))) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function toNumber(value, fieldName, { required = true, min = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw publicError(400, 'VALIDATION_ERROR', `${fieldName} es obligatorio`);
  }

  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw publicError(400, 'VALIDATION_ERROR', `${fieldName} debe ser numerico`);
  }

  if (min !== null && n < min) {
    throw publicError(400, 'VALIDATION_ERROR', `${fieldName} debe ser mayor o igual a ${min}`);
  }

  return n;
}

function clampIterations(value) {
  const iterations = Math.round(toNumber(value ?? 10000, 'iteraciones', { min: 10000 }));
  if (iterations > 100000) {
    throw publicError(400, 'VALIDATION_ERROR', 'iteraciones no puede superar 100000');
  }
  return iterations;
}

function validatePertInput(input, label = 'rango') {
  const min = toNumber(input?.min, `${label}.min`, { min: 0 });
  const mode = toNumber(input?.mode, `${label}.mode`, { min: 0 });
  const max = toNumber(input?.max, `${label}.max`, { min: 0 });

  if (min > mode) {
    throw publicError(400, 'VALIDATION_ERROR', `${label}: min no puede ser mayor que mode`);
  }

  if (mode > max) {
    throw publicError(400, 'VALIDATION_ERROR', `${label}: mode no puede ser mayor que max`);
  }

  return { min, mode, max };
}

function normalizeNorm(value) {
  const norm = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!VALID_NORMS.has(norm)) {
    throw publicError(400, 'VALIDATION_ERROR', 'norma_tipo debe ser ISO27001 o ISO9001');
  }
  return norm;
}

function normalizeModel(value, normaTipo, advancedRequested = false) {
  const fallback = normaTipo === 'ISO27001'
    ? 'ISO27001_TTIA'
    : advancedRequested ? 'ISO9001_COP_AVANZADO' : 'ISO9001_COP_SIMPLE';
  const model = String(value || fallback).toUpperCase();

  if (!VALID_MODELS.has(model)) {
    throw publicError(400, 'VALIDATION_ERROR', 'modelo_usado invalido');
  }

  if (normaTipo === 'ISO27001' && model !== 'ISO27001_TTIA') {
    throw publicError(400, 'VALIDATION_ERROR', 'ISO27001 solo permite modelo ISO27001_TTIA');
  }

  if (normaTipo === 'ISO9001' && !model.startsWith('ISO9001_')) {
    throw publicError(400, 'VALIDATION_ERROR', 'ISO9001 solo permite modelos COP');
  }

  return model;
}

function normalizeSimulationPayload(payload = {}) {
  const normaTipo = normalizeNorm(payload.norma_tipo || payload.normaTipo);
  const advancedRequested = Boolean(payload.tasa_error || payload.volumen_operativo_anual || payload.tiempo_subsanacion);
  const modeloUsado = normalizeModel(payload.modelo_usado || payload.modeloUsado, normaTipo, advancedRequested);
  const frequency = validatePertInput(payload.frecuencia || {
    min: payload.frecuencia_min,
    mode: payload.frecuencia_mode,
    max: payload.frecuencia_max,
  }, 'frecuencia');

  const iterations = clampIterations(payload.iteraciones);
  const threshold = toNumber(
    payload.umbral_disrupcion_critica_horas,
    'umbral_disrupcion_critica_horas',
    { required: false, min: 0 }
  );

  if (modeloUsado === 'ISO27001_TTIA') {
    const unit = payload.impacto_operativo?.unidad || payload.impacto_unidad || 'horas_por_evento';
    if (unit !== 'horas_por_evento') {
      throw publicError(400, 'VALIDATION_ERROR', 'ISO27001 requiere impacto operativo en horas_por_evento');
    }

    return {
      norma_tipo: normaTipo,
      modelo_usado: modeloUsado,
      nombre_riesgo: String(payload.nombre_riesgo || '').trim(),
      proceso_afectado: String(payload.proceso_afectado || '').trim() || null,
      descripcion: String(payload.descripcion || '').trim() || null,
      source_risk_id: payload.source_risk_id || null,
      frecuencia: frequency,
      impacto_operativo: validatePertInput(payload.impacto_operativo || {
        min: payload.impacto_min,
        mode: payload.impacto_mode,
        max: payload.impacto_max,
      }, 'impacto_operativo'),
      impacto_unidad: unit,
      tasa_error: null,
      tiempo_subsanacion: null,
      volumen_operativo_anual: null,
      umbral_disrupcion_critica_horas: threshold,
      iteraciones: iterations,
      seed: payload.seed || null,
    };
  }

  if (modeloUsado === 'ISO9001_COP_AVANZADO') {
    const tasaError = validatePertInput(payload.tasa_error || {
      min: payload.tasa_error_min,
      mode: payload.tasa_error_mode,
      max: payload.tasa_error_max,
    }, 'tasa_error');
    const tiempoSubsanacion = validatePertInput(payload.tiempo_subsanacion || {
      min: payload.tiempo_subsanacion_min ?? payload.impacto_min,
      mode: payload.tiempo_subsanacion_mode ?? payload.impacto_mode,
      max: payload.tiempo_subsanacion_max ?? payload.impacto_max,
    }, 'tiempo_subsanacion');
    const volumen = toNumber(payload.volumen_operativo_anual, 'volumen_operativo_anual', { min: 0 });

    return {
      norma_tipo: normaTipo,
      modelo_usado: modeloUsado,
      nombre_riesgo: String(payload.nombre_riesgo || '').trim(),
      proceso_afectado: String(payload.proceso_afectado || '').trim() || null,
      descripcion: String(payload.descripcion || '').trim() || null,
      source_risk_id: payload.source_risk_id || null,
      frecuencia: frequency,
      impacto_operativo: null,
      impacto_unidad: 'horas_reproceso_por_error',
      tasa_error: tasaError,
      tiempo_subsanacion: tiempoSubsanacion,
      volumen_operativo_anual: volumen,
      umbral_disrupcion_critica_horas: threshold,
      iteraciones: iterations,
      seed: payload.seed || null,
    };
  }

  const unit = payload.impacto_operativo?.unidad || payload.impacto_unidad || 'horas_reproceso_por_error';
  if (unit !== 'horas_reproceso_por_error') {
    throw publicError(400, 'VALIDATION_ERROR', 'ISO9001 simple requiere impacto en horas_reproceso_por_error');
  }

  return {
    norma_tipo: normaTipo,
    modelo_usado: modeloUsado,
    nombre_riesgo: String(payload.nombre_riesgo || '').trim(),
    proceso_afectado: String(payload.proceso_afectado || '').trim() || null,
    descripcion: String(payload.descripcion || '').trim() || null,
    source_risk_id: payload.source_risk_id || null,
    frecuencia: frequency,
    impacto_operativo: validatePertInput(payload.impacto_operativo || {
      min: payload.impacto_min,
      mode: payload.impacto_mode,
      max: payload.impacto_max,
    }, 'impacto_operativo'),
    impacto_unidad: unit,
    tasa_error: null,
    tiempo_subsanacion: null,
    volumen_operativo_anual: null,
    umbral_disrupcion_critica_horas: threshold,
    iteraciones: iterations,
    seed: payload.seed || null,
  };
}

function assertBusinessFields(input) {
  if (!input.nombre_riesgo) {
    throw publicError(400, 'VALIDATION_ERROR', 'nombre_riesgo es obligatorio');
  }

  if (input.nombre_riesgo.length > 240) {
    throw publicError(400, 'VALIDATION_ERROR', 'nombre_riesgo excede largo permitido');
  }
}

function createSeededRng(seed) {
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

function sampleGamma(shape, rng = Math.random) {
  if (shape <= 0 || !Number.isFinite(shape)) {
    throw publicError(500, 'INVALID_GAMMA_SHAPE', 'Parametro gamma invalido');
  }

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

function randomBeta(alpha, beta, rng = Math.random) {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

function sampleBetaPert(min, mode, max, iterations, rng = Math.random) {
  const range = max - min;
  if (range === 0) {
    return Array.from({ length: iterations }, () => min);
  }

  const alpha = 1 + 4 * ((mode - min) / range);
  const beta = 1 + 4 * ((max - mode) / range);
  const samples = new Array(iterations);

  for (let i = 0; i < iterations; i += 1) {
    samples[i] = min + randomBeta(alpha, beta, rng) * range;
  }

  return samples;
}

function percentile(sortedSamples, p) {
  if (sortedSamples.length === 0) return 0;
  const index = (sortedSamples.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedSamples[lower];
  const weight = index - lower;
  return sortedSamples[lower] * (1 - weight) + sortedSamples[upper] * weight;
}

function roundMetric(value, decimals = 4) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function calculateSummaryStats(samples, threshold = null) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw publicError(500, 'SIMULATION_EMPTY', 'La simulacion no genero muestras');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const count = samples.length;
  const mean = samples.reduce((sum, value) => sum + value, 0) / count;
  const variance = samples.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / count;
  const criticalCount = threshold === null
    ? 0
    : samples.filter((value) => value >= threshold).length;

  return {
    media_operativa_anual: roundMetric(mean),
    mediana_operativa_anual: roundMetric(percentile(sorted, 0.5)),
    peor_escenario_p90: roundMetric(percentile(sorted, 0.9)),
    peor_escenario_p95: roundMetric(percentile(sorted, 0.95)),
    peor_escenario_p99: roundMetric(percentile(sorted, 0.99)),
    desviacion_estandar: roundMetric(Math.sqrt(variance)),
    minimo_simulado: roundMetric(sorted[0]),
    maximo_simulado: roundMetric(sorted[sorted.length - 1]),
    probabilidad_disrupcion_critica: threshold === null ? null : roundMetric(criticalCount / count, 6),
  };
}

function buildHistogram(samples, bins = 12) {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  if (min === max) {
    return [{ min: roundMetric(min), max: roundMetric(max), count: samples.length }];
  }

  const size = (max - min) / bins;
  const histogram = Array.from({ length: bins }, (_, index) => ({
    min: roundMetric(min + size * index),
    max: roundMetric(index === bins - 1 ? max : min + size * (index + 1)),
    count: 0,
  }));

  for (const sample of samples) {
    const index = Math.min(bins - 1, Math.floor((sample - min) / size));
    histogram[index].count += 1;
  }

  return histogram;
}

function runIso27001OperationalSimulation(payload) {
  const input = normalizeSimulationPayload({ ...payload, norma_tipo: 'ISO27001', modelo_usado: 'ISO27001_TTIA' });
  assertBusinessFields(input);
  const rng = createSeededRng(input.seed);
  const frequency = sampleBetaPert(input.frecuencia.min, input.frecuencia.mode, input.frecuencia.max, input.iteraciones, rng);
  const impact = sampleBetaPert(input.impacto_operativo.min, input.impacto_operativo.mode, input.impacto_operativo.max, input.iteraciones, rng);
  const samples = frequency.map((value, index) => value * impact[index]);
  const summary = calculateSummaryStats(samples, input.umbral_disrupcion_critica_horas);

  return {
    input,
    samples,
    summary,
    histograma_json: buildHistogram(samples),
    modelo_usado: 'ISO27001_TTIA',
    fecha_ejecucion: new Date().toISOString(),
  };
}

function runIso9001SimpleOperationalSimulation(payload) {
  const input = normalizeSimulationPayload({ ...payload, norma_tipo: 'ISO9001', modelo_usado: 'ISO9001_COP_SIMPLE' });
  assertBusinessFields(input);
  const rng = createSeededRng(input.seed);
  const frequency = sampleBetaPert(input.frecuencia.min, input.frecuencia.mode, input.frecuencia.max, input.iteraciones, rng);
  const impact = sampleBetaPert(input.impacto_operativo.min, input.impacto_operativo.mode, input.impacto_operativo.max, input.iteraciones, rng);
  const samples = frequency.map((value, index) => value * impact[index]);
  const summary = calculateSummaryStats(samples, input.umbral_disrupcion_critica_horas);

  return {
    input,
    samples,
    summary,
    histograma_json: buildHistogram(samples),
    modelo_usado: 'ISO9001_COP_SIMPLE',
    fecha_ejecucion: new Date().toISOString(),
  };
}

function runIso9001AdvancedOperationalSimulation(payload) {
  const input = normalizeSimulationPayload({ ...payload, norma_tipo: 'ISO9001', modelo_usado: 'ISO9001_COP_AVANZADO' });
  assertBusinessFields(input);
  const rng = createSeededRng(input.seed);
  const errorRate = sampleBetaPert(input.tasa_error.min, input.tasa_error.mode, input.tasa_error.max, input.iteraciones, rng);
  const remediation = sampleBetaPert(input.tiempo_subsanacion.min, input.tiempo_subsanacion.mode, input.tiempo_subsanacion.max, input.iteraciones, rng);
  const samples = errorRate.map((value, index) => input.volumen_operativo_anual * (value / 100) * remediation[index]);
  const summary = calculateSummaryStats(samples, input.umbral_disrupcion_critica_horas);

  return {
    input,
    samples,
    summary,
    histograma_json: buildHistogram(samples),
    modelo_usado: 'ISO9001_COP_AVANZADO',
    fecha_ejecucion: new Date().toISOString(),
  };
}

function runOperationalSimulation(payload) {
  const normalized = normalizeSimulationPayload(payload);
  if (normalized.modelo_usado === 'ISO27001_TTIA') return runIso27001OperationalSimulation(normalized);
  if (normalized.modelo_usado === 'ISO9001_COP_AVANZADO') return runIso9001AdvancedOperationalSimulation(normalized);
  return runIso9001SimpleOperationalSimulation(normalized);
}

function buildAiRecommendationPayload(simulation) {
  const payload = {
    norma_tipo: simulation.norma_tipo,
    nombre_riesgo: simulation.nombre_riesgo,
    proceso_afectado: simulation.proceso_afectado,
    modelo_usado: simulation.modelo_usado,
    media_operativa_anual: Number(simulation.media_operativa_anual || 0),
    peor_escenario_p95: Number(simulation.peor_escenario_p95 || 0),
    probabilidad_disrupcion_critica: simulation.probabilidad_disrupcion_critica === null
      ? null
      : Number(simulation.probabilidad_disrupcion_critica),
    umbral_disrupcion_critica_horas: simulation.umbral_disrupcion_critica_horas === null
      ? null
      : Number(simulation.umbral_disrupcion_critica_horas),
  };

  if (FINANCIAL_LANGUAGE_RE.test(JSON.stringify(payload))) {
    throw publicError(400, 'FINANCIAL_LANGUAGE_REJECTED', 'El payload no debe incluir lenguaje financiero');
  }

  return payload;
}

function assertNoFinancialLanguage(value) {
  if (FINANCIAL_LANGUAGE_RE.test(JSON.stringify(value || {}))) {
    throw publicError(400, 'FINANCIAL_LANGUAGE_REJECTED', 'La recomendacion no debe incluir lenguaje financiero');
  }
}

function buildRuleBasedRecommendation(simulation) {
  const payload = buildAiRecommendationPayload(simulation);
  const is27001 = payload.norma_tipo === 'ISO27001';
  const probability = Number(payload.probabilidad_disrupcion_critica || 0);
  const pressure = probability >= 0.5 ? 'alta' : probability >= 0.2 ? 'media' : 'controlada';
  const baseReduction = pressure === 'alta' ? 35 : pressure === 'media' ? 25 : 15;
  const controls = is27001
    ? [
        {
          control_id: 'TCDX-CTRL-01',
          referencia_normativa: 'ISO27001 Anexo A - controles tecnologicos',
          accion_propuesta: 'Reducir MTTR con runbooks de recuperacion, monitoreo de disponibilidad y pruebas de restauracion.',
          mecanismo_reduccion: 'Disminuye el tiempo de recuperacion por evento y mejora continuidad del servicio.',
          reduccion_estimada_pct: baseReduction,
          metricas_a_monitorear: ['MTTR', 'horas de indisponibilidad', 'eventos recurrentes'],
        },
        {
          control_id: 'TCDX-CTRL-02',
          referencia_normativa: 'ISO27001 Anexo A - controles organizacionales',
          accion_propuesta: 'Formalizar criterios de escalamiento operativo y responsables por severidad.',
          mecanismo_reduccion: 'Reduce latencia de respuesta y evita interrupciones prolongadas.',
          reduccion_estimada_pct: Math.max(10, baseReduction - 8),
          metricas_a_monitorear: ['tiempo de escalamiento', 'incidentes fuera de SLA', 'reaperturas'],
        },
        {
          control_id: 'TCDX-CTRL-03',
          referencia_normativa: 'ISO27001 Anexo A - personas',
          accion_propuesta: 'Ejecutar simulacros de respuesta y transferencia de conocimiento para turnos criticos.',
          mecanismo_reduccion: 'Aumenta capacidad de respuesta consistente ante fallas operativas.',
          reduccion_estimada_pct: Math.max(10, baseReduction - 12),
          metricas_a_monitorear: ['cobertura de entrenamiento', 'tiempo de decision', 'errores de procedimiento'],
        },
      ]
    : [
        {
          control_id: 'TCDX-CTRL-01',
          referencia_normativa: 'ISO9001 control operacional',
          accion_propuesta: 'Estandarizar puntos de verificacion temprana en el proceso afectado.',
          mecanismo_reduccion: 'Reduce frecuencia de errores antes de que generen reproceso acumulado.',
          reduccion_estimada_pct: baseReduction,
          metricas_a_monitorear: ['errores por periodo', 'horas de reproceso', 'rechazos internos'],
        },
        {
          control_id: 'TCDX-CTRL-02',
          referencia_normativa: 'ISO9001 competencia y toma de conciencia',
          accion_propuesta: 'Reforzar criterios operativos con checklist de ejecucion y evidencia minima.',
          mecanismo_reduccion: 'Disminuye variabilidad de ejecucion y estabiliza eficiencia del proceso.',
          reduccion_estimada_pct: Math.max(10, baseReduction - 8),
          metricas_a_monitorear: ['cumplimiento de checklist', 'retrabajos', 'desviaciones repetidas'],
        },
        {
          control_id: 'TCDX-CTRL-03',
          referencia_normativa: 'ISO9001 mejora',
          accion_propuesta: 'Analizar causas recurrentes y priorizar automatizacion de verificaciones repetitivas.',
          mecanismo_reduccion: 'Reduce errores repetidos y recupera capacidad operativa.',
          reduccion_estimada_pct: Math.max(10, baseReduction - 12),
          metricas_a_monitorear: ['causas recurrentes', 'tiempo de subsanacion', 'capacidad recuperada'],
        },
      ];

  const recommendation = {
    diagnostico_operativo: `El riesgo ${payload.nombre_riesgo} presenta presion operativa ${pressure} segun horas anuales estimadas y P95.`,
    controles_sugeridos: controls,
    efectividad_estimada_pct: Math.round(controls.reduce((sum, item) => sum + item.reduccion_estimada_pct, 0) / controls.length),
    requiere_validacion_humana: true,
  };

  assertNoFinancialLanguage(recommendation);
  return recommendation;
}

module.exports = {
  publicError,
  validatePertInput,
  sampleBetaPert,
  runIso27001OperationalSimulation,
  runIso9001SimpleOperationalSimulation,
  runIso9001AdvancedOperationalSimulation,
  runOperationalSimulation,
  buildHistogram,
  calculateSummaryStats,
  buildAiRecommendationPayload,
  buildRuleBasedRecommendation,
  assertNoFinancialLanguage,
  normalizeSimulationPayload,
  getUserTenantId,
  getUserId,
  canReadOperationalRisk,
  canCreateOperationalRisk,
  resolveTenantIdForRequest,
  assertCanReadTenant,
  assertCanCreateTenant,
};
