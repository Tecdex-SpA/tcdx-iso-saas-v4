'use strict';

const monteCarlo = require('./operationalRiskMonteCarlo.service');

const PROMPT_VERSION = 'beta-pert-operational-risk-v1';
const MAX_RISKS = 8;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '', maxLength = 2000) {
  return String(value || fallback || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function boundedNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundNumber(value, decimals = 2, fallback = null) {
  const n = boundedNumber(value, fallback);
  if (n === null) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function publicAiError(status, code, message, details = {}) {
  const error = monteCarlo.publicError(status, code, message);
  Object.assign(error, details);
  return error;
}

function normalizePayloadRisk(risk) {
  if (!risk || typeof risk !== 'object') return null;
  const name = safeText(risk.name || risk.nombre_riesgo, '', 120);
  const id = safeText(risk.id, '', 80);

  if (!name && !id) return null;

  return {
    id,
    name: name || 'Riesgo operativo',
    standard: safeText(risk.standard || risk.norm || risk.norma_tipo, '', 40),
    model: safeText(risk.model || risk.modelo_usado, '', 80),
    process: safeText(risk.process || risk.processName || risk.proceso_afectado, '', 80),
    description: safeText(risk.description || risk.descripcion, '', 240),
    expectedAnnualExposure: roundNumber(risk.expectedAnnualExposure ?? risk.expectedValue, 2, 0),
    p95: roundNumber(risk.p95 ?? risk.peor_escenario_p95, 2, 0),
    criticalProbability: roundNumber(risk.criticalProbability ?? risk.probabilidad_disrupcion_critica, 4, null),
    status: safeText(risk.status || risk.estado, '', 40),
    probabilityScore: boundedNumber(risk.probabilityScore, null),
    impactScore: boundedNumber(risk.impactScore, null),
    frequency: {
      min: roundNumber(risk.frequency?.min ?? risk.frecuencia_min, 2, null),
      mode: roundNumber(risk.frequency?.mode ?? risk.frequency?.mostLikely ?? risk.frecuencia_mode, 2, null),
      max: roundNumber(risk.frequency?.max ?? risk.frecuencia_max, 2, null),
    },
    impact: {
      min: roundNumber(risk.impact?.min ?? risk.impacto_min, 2, null),
      mode: roundNumber(risk.impact?.mode ?? risk.impact?.mostLikely ?? risk.impacto_mode, 2, null),
      max: roundNumber(risk.impact?.max ?? risk.impacto_max, 2, null),
    },
  };
}

function riskDedupKey(risk) {
  return [
    risk.standard,
    risk.model,
    risk.name,
    risk.process,
  ].map((value) => safeText(value, '', 160).toLowerCase()).join('|');
}

function statusRank(status) {
  const normalized = safeText(status, '', 40)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized === 'critico') return 4;
  if (normalized === 'alto') return 3;
  if (normalized === 'medio') return 2;
  return 1;
}

function riskPrioritySort(a, b) {
  return (
    statusRank(b.status) - statusRank(a.status) ||
    Number(b.p95 || 0) - Number(a.p95 || 0) ||
    Number(b.criticalProbability || 0) - Number(a.criticalProbability || 0) ||
    Number(b.expectedAnnualExposure || 0) - Number(a.expectedAnnualExposure || 0)
  );
}

function compactRisksForAi(risks, selectedRisk = null) {
  const byKey = new Map();
  for (const risk of risks) {
    const key = riskDedupKey(risk);
    const current = byKey.get(key);
    if (!current || Number(risk.p95 || 0) > Number(current.p95 || 0)) {
      byKey.set(key, risk);
    }
  }

  const selectedKey = selectedRisk ? riskDedupKey(selectedRisk) : '';
  if (selectedRisk) {
    byKey.set(selectedKey, selectedRisk);
  }

  const ordered = [...byKey.values()].sort(riskPrioritySort);
  if (!selectedRisk) return ordered.slice(0, MAX_RISKS);

  const selected = byKey.get(selectedKey) || selectedRisk;
  const withoutSelected = ordered.filter((risk) => riskDedupKey(risk) !== selectedKey);
  return [selected, ...withoutSelected].slice(0, MAX_RISKS);
}

function normalizeAiPayload(body = {}) {
  const normalizedRisks = asArray(body.risks)
    .map(normalizePayloadRisk)
    .filter(Boolean);
  const selectedRisk = normalizePayloadRisk(body.selectedRisk);
  const risks = compactRisksForAi(normalizedRisks, selectedRisk);

  if (risks.length === 0) {
    throw publicAiError(400, 'ai_invalid_payload', 'Se requiere al menos un riesgo valido para analisis AI.');
  }

  const kpis = body.kpis && typeof body.kpis === 'object' ? body.kpis : {};
  const scope = ['portfolio', 'simulation'].includes(String(body.scope || '')) ? body.scope : 'portfolio';

  return {
    scope,
    methodology: {
      exposureExpectedAccumulated: 'SUM(media_operativa_anual)',
      conservativeP95: 'SUM(peor_escenario_p95)',
      criticalProbabilityAverage: 'AVG(probabilidad_disrupcion_critica)',
      warning: 'El P95 agregado conservador no equivale a un P95 de portafolio simulado.',
    },
    kpis: {
      exposureExpectedAccumulated: boundedNumber(kpis.exposureExpectedAccumulated ?? kpis.expectedExposure, 0),
      conservativeP95: boundedNumber(kpis.conservativeP95, 0),
      criticalProbabilityAverage: boundedNumber(kpis.criticalProbabilityAverage ?? kpis.criticalProbability, null),
      highPrioritizedRisks: boundedNumber(kpis.highPrioritizedRisks ?? kpis.prioritizedHighRisks, 0),
    },
    selectedRisk,
    risks,
  };
}

function buildOperationalAiPrompt(payload) {
  return [
    'Analiza riesgos operacionales Beta-PERT. Devuelve exclusivamente JSON valido.',
    'No uses markdown, HTML, texto previo ni explicaciones fuera del JSON. No omitas claves; usa [] o null si falta dato.',
    'Usa solo el payload. No inventes riesgos, metricas ni cumplimiento ISO certificado.',
    'No afirmes P95 de portafolio. P95 agregado conservador = suma de P95 individuales.',
    'Limites: diagnostico max 80 palabras, max 3 riesgos, 5 acciones, 5 controles, 3 advertencias, 5 proximos pasos.',
    `prompt_version: ${PROMPT_VERSION}`,
    'JSON exacto:',
    JSON.stringify({
      diagnostico_ejecutivo: 'string',
      riesgos_prioritarios: [{ nombre: 'string', motivo: 'string', prioridad: 'critica|alta|media|baja' }],
      acciones_sugeridas: [{ accion: 'string', horizonte: 'inmediato|30_dias|60_dias|90_dias', responsable_sugerido: 'string|null', riesgo_relacionado: 'string|null' }],
      controles_iso_sugeridos: [{ norma: 'ISO27001|ISO9001', control_o_clausula: 'string', descripcion: 'string', riesgo_relacionado: 'string|null' }],
      advertencias_metodologicas: ['string'],
      proximos_pasos: ['string'],
      efectividad_estimada_pct: 'number|null',
      ai_model: 'string|null',
      prompt_version: PROMPT_VERSION,
    }),
    `Payload: ${JSON.stringify(payload)}`,
  ].join('\n');
}

function buildRequestId() {
  return `beta_pert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildAiEnginePayload({ tenantId, requestId, payload }) {
  return {
    tenant_id: tenantId,
    request_id: requestId,
    locale: 'es',
    task_type: 'operational_risk_beta_pert_analysis',
    prompt_version: PROMPT_VERSION,
    question: buildOperationalAiPrompt(payload),
    context: {
      tenant: { tenant_id: tenantId },
      scope: {
        module: 'operational-risks',
        view: 'beta-pert',
        analysis_scope: payload.scope,
        prompt_version: PROMPT_VERSION,
      },
      operational_risk_beta_pert: payload,
    },
    options: {
      model_mode: 'fast',
      fast_mode: true,
      depth: 'standard',
      response_format: 'json',
      require_json: true,
      return_structured_result: true,
      human_review_required: true,
    },
    request_metadata: {
      request_id: requestId,
      module: 'operational-risks',
      view: 'beta-pert',
      prompt_version: PROMPT_VERSION,
      response_schema: 'operational_beta_pert_ai_analysis_v1',
    },
  };
}

function parseJsonCandidate(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  const text = value.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    text,
    fenced?.[1],
    text.includes('{') && text.includes('}') ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1) : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Try the next extraction strategy.
    }
  }

  return null;
}

function collectObjectCandidates(value, depth = 0) {
  if (!value || depth > 3) return [];
  if (typeof value === 'string') return [parseJsonCandidate(value)].filter(Boolean);
  if (typeof value !== 'object') return [];

  const candidates = [];
  if (!Array.isArray(value)) candidates.push(value);

  const keys = [
    'analysis',
    'result',
    'content',
    'text',
    'output',
    'data',
    'raw',
    'message',
    'answer',
    'structured_result',
    'enhanced_answer',
  ];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      candidates.push(...collectObjectCandidates(value[key], depth + 1));
    }
  }

  return candidates;
}

function normalizePriority(value) {
  const normalized = safeText(value, 'media', 20)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (['critica', 'alta', 'media', 'baja'].includes(normalized)) return normalized;
  if (normalized === 'critical') return 'critica';
  if (normalized === 'high') return 'alta';
  if (normalized === 'low') return 'baja';
  return 'media';
}

function normalizeHorizon(value) {
  const normalized = safeText(value, '30_dias', 30).toLowerCase().replace(/\s+/g, '_');
  if (['inmediato', '30_dias', '60_dias', '90_dias'].includes(normalized)) return normalized;
  if (normalized.includes('inmedi')) return 'inmediato';
  if (normalized.includes('60')) return '60_dias';
  if (normalized.includes('90')) return '90_dias';
  return '30_dias';
}

function normalizePrioritizedRisk(item) {
  if (typeof item === 'string') {
    return {
      nombre: safeText(item, '', 220),
      motivo: 'Priorizado por el analisis AI a partir de los datos enviados.',
      prioridad: 'media',
    };
  }
  if (!item || typeof item !== 'object') return null;
  const nombre = safeText(item.nombre || item.riesgo || item.risk || item.name, '', 220);
  if (!nombre) return null;
  return {
    nombre,
    motivo: safeText(item.motivo || item.reason || item.descripcion || item.description, '', 700),
    prioridad: normalizePriority(item.prioridad || item.priority),
  };
}

function normalizeSuggestedAction(item) {
  if (typeof item === 'string') {
    return {
      accion: safeText(item, '', 700),
      horizonte: '30_dias',
      responsable_sugerido: null,
      riesgo_relacionado: null,
    };
  }
  if (!item || typeof item !== 'object') return null;
  const accion = safeText(item.accion || item.action || item.descripcion || item.description, '', 700);
  if (!accion) return null;
  return {
    accion,
    horizonte: normalizeHorizon(item.horizonte || item.horizon),
    responsable_sugerido: safeText(item.responsable_sugerido || item.owner || item.responsable, '', 180) || null,
    riesgo_relacionado: safeText(item.riesgo_relacionado || item.risk || item.riesgo, '', 220) || null,
  };
}

function normalizeIsoControl(item) {
  if (typeof item === 'string') {
    return {
      norma: 'ISO27001',
      control_o_clausula: safeText(item, '', 180),
      descripcion: safeText(item, '', 700),
      riesgo_relacionado: null,
    };
  }
  if (!item || typeof item !== 'object') return null;
  const control = safeText(item.control_o_clausula || item.control || item.clausula || item.clause, '', 180);
  const descripcion = safeText(item.descripcion || item.description || item.motivo || item.reason, '', 700);
  if (!control && !descripcion) return null;
  const norma = safeText(item.norma || item.standard, 'ISO27001', 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {
    norma: norma === 'ISO9001' ? 'ISO9001' : 'ISO27001',
    control_o_clausula: control || 'Control ISO sugerido',
    descripcion: descripcion || control,
    riesgo_relacionado: safeText(item.riesgo_relacionado || item.risk || item.riesgo, '', 220) || null,
  };
}

function normalizeStringList(value, limit = 8) {
  return asArray(value)
    .map((item) => safeText(typeof item === 'string' ? item : item?.descripcion || item?.description || item?.text || item?.title, '', 700))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeList(value, normalizer, limit = 8) {
  return asArray(value).map(normalizer).filter(Boolean).slice(0, limit);
}

function sourceObjectFromAiResult(aiResult) {
  const candidates = collectObjectCandidates(aiResult);
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate) && (
    candidate.diagnostico_ejecutivo ||
    candidate.executive_summary ||
    candidate.diagnosis ||
    candidate.diagnostic ||
    candidate.acciones_sugeridas ||
    candidate.proximos_pasos
  )) || null;
}

function selectedModelFrom(aiResult, source = {}) {
  return safeText(
    source.ai_model ||
      aiResult?.engine?.selected_model ||
      aiResult?.engine?.model ||
      aiResult?.metrics?.selected_model ||
      aiResult?.metrics?.model ||
      aiResult?.source ||
      (aiResult?.ok !== false ? 'ai-engine' : ''),
    '',
    120
  );
}

function normalizeOperationalAiAnalysis(aiResult, payload) {
  const source = sourceObjectFromAiResult(aiResult);
  if (!source) {
    throw publicAiError(502, 'ai_invalid_response', 'AI Auditor devolvio una respuesta no estructurada.');
  }

  const diagnostico = safeText(
    source.diagnostico_ejecutivo || source.executive_summary || source.diagnosis || source.diagnostic,
    '',
    3000
  );
  const acciones = normalizeList(source.acciones_sugeridas || source.recommended_actions || source.actions, normalizeSuggestedAction, 10);
  const proximosPasos = normalizeStringList(source.proximos_pasos || source.next_steps, 10);
  const aiModel = selectedModelFrom(aiResult, source);

  if (!diagnostico || (acciones.length === 0 && proximosPasos.length === 0) || !aiModel) {
    throw publicAiError(502, 'ai_invalid_response', 'AI Auditor devolvio una respuesta incompleta para el contrato Beta-PERT.');
  }

  return {
    diagnostico_ejecutivo: diagnostico,
    riesgos_prioritarios: normalizeList(source.riesgos_prioritarios || source.prioritized_risks || source.key_risks, normalizePrioritizedRisk, 10),
    acciones_sugeridas: acciones,
    controles_iso_sugeridos: normalizeList(source.controles_iso_sugeridos || source.iso_controls || source.controls, normalizeIsoControl, 10),
    advertencias_metodologicas: normalizeStringList(
      source.advertencias_metodologicas ||
        source.methodology_warnings ||
        source.limitations ||
        ['El P95 agregado conservador no equivale a una simulacion de portafolio con correlacion entre riesgos.'],
      10
    ),
    proximos_pasos: proximosPasos,
    efectividad_estimada_pct: boundedNumber(source.efectividad_estimada_pct ?? source.estimated_effectiveness_pct, null),
    ai_model: aiModel,
    prompt_version: PROMPT_VERSION,
    scope: payload.scope,
    source: 'ai-engine',
    guardable: true,
    ai_engine_used: true,
    request_id: aiResult?.request_id || aiResult?.engine?.request_id || null,
  };
}

function classifyAiEngineResult(aiResult) {
  if (!aiResult) {
    return {
      status: 503,
      code: 'ai_engine_unavailable',
      message: 'AI Auditor no esta disponible temporalmente.',
    };
  }

  const engine = aiResult.engine || aiResult.trace || aiResult.metrics || {};
  const errorType = safeText(engine.error_type || aiResult.code, '', 80);
  const errorMessage = safeText(engine.error_message || aiResult.message || aiResult.answer, '', 300);
  const disabled = aiResult.disabled_by_plan === true || aiResult.ai_disabled_by_plan === true || engine.ai_disabled_by_plan === true;
  const reason = safeText(engine.ai_disabled_reason || aiResult.reason, '', 80);

  if (disabled) {
    return {
      status: 403,
      code: reason === 'ai_feature_disabled' ? 'ai_feature_not_enabled' : 'ai_disabled_for_tenant',
      message: 'AI Auditor no esta habilitado para esta empresa.',
      reason,
    };
  }

  const fallback =
    aiResult.synthetic_result === true ||
    aiResult.deterministic_mode === true ||
    engine.ai_engine_used === false ||
    engine.fallback_used === true ||
    engine.ai_enrichment_failed === true ||
    safeText(engine.selected_model || engine.model, '', 120).toLowerCase() === 'backend_fallback';

  if (fallback || aiResult.ok === false) {
    if (errorType === 'AI_ENGINE_TIMEOUT' || errorType === 'AI_AUDITOR_TIMEOUT' || engine.timeout_stage) {
      return {
        status: 504,
        code: 'ai_timeout',
        message: 'AI Auditor excedio el tiempo de respuesta. Intenta nuevamente.',
        reason: errorType,
      };
    }
    if (errorMessage.toLowerCase().includes('no configurado') || errorMessage.toLowerCase().includes('token')) {
      return {
        status: 503,
        code: 'ai_engine_unconfigured',
        message: 'El motor AI no esta configurado para analisis operacional.',
        reason: errorType || 'ai_engine_unconfigured',
      };
    }
    return {
      status: 503,
      code: errorType === 'AI_ENGINE_ENDPOINT_NOT_FOUND' ? 'ai_engine_unavailable' : 'ai_engine_unavailable',
      message: 'AI Auditor no esta disponible temporalmente para analisis operacional Beta-PERT.',
      reason: errorType || 'ai_engine_unavailable',
    };
  }

  return null;
}

function normalizeAnalysisToSave(value) {
  const analysis = value && typeof value === 'object' ? value : {};
  const diagnostico = safeText(
    analysis.diagnostico_ejecutivo || analysis.diagnostico_operativo || analysis.executive_summary,
    '',
    3000
  );
  const promptVersion = safeText(analysis.prompt_version, '', 120);
  const source = safeText(analysis.source, '', 80);
  const aiModel = safeText(analysis.ai_model, '', 120);
  const acciones = normalizeList(analysis.acciones_sugeridas, normalizeSuggestedAction, 10);
  const proximosPasos = normalizeStringList(analysis.proximos_pasos, 10);
  const deterministicModel = ['backend_fallback', 'rule-based-operational-v1', 'deterministic', 'local'].includes(aiModel.toLowerCase());

  if (!diagnostico) {
    throw publicAiError(400, 'ai_invalid_response', 'diagnostico_ejecutivo es obligatorio.');
  }
  if (promptVersion !== PROMPT_VERSION) {
    throw publicAiError(400, 'ai_invalid_response', `prompt_version debe ser ${PROMPT_VERSION}.`);
  }
  if ((!aiModel && source !== 'ai-engine') || deterministicModel || analysis.ai_engine_used === false || analysis.guardable === false) {
    throw publicAiError(400, 'ai_invalid_response', 'Solo se puede guardar analisis generado por ai-engine real.');
  }
  if (acciones.length === 0 && proximosPasos.length === 0) {
    throw publicAiError(400, 'ai_invalid_response', 'El analisis AI debe incluir acciones sugeridas o proximos pasos.');
  }

  return {
    diagnostico_ejecutivo: diagnostico,
    riesgos_prioritarios: normalizeList(analysis.riesgos_prioritarios, normalizePrioritizedRisk, 10),
    acciones_sugeridas: acciones,
    controles_iso_sugeridos: normalizeList(analysis.controles_iso_sugeridos, normalizeIsoControl, 10),
    advertencias_metodologicas: normalizeStringList(analysis.advertencias_metodologicas, 10),
    proximos_pasos: proximosPasos,
    efectividad_estimada_pct: boundedNumber(analysis.efectividad_estimada_pct, null),
    ai_model: aiModel || 'ai-engine',
    prompt_version: PROMPT_VERSION,
    request_id: safeText(analysis.request_id, '', 120) || null,
    scope: safeText(analysis.scope || 'portfolio', 'portfolio', 40),
    source: 'ai-engine',
  };
}

module.exports = {
  PROMPT_VERSION,
  normalizeAiPayload,
  buildOperationalAiPrompt,
  buildRequestId,
  buildAiEnginePayload,
  classifyAiEngineResult,
  normalizeOperationalAiAnalysis,
  normalizeAnalysisToSave,
  _internal: {
    parseJsonCandidate,
    normalizePayloadRisk,
    normalizePriority,
    normalizeHorizon,
    normalizePrioritizedRisk,
    normalizeSuggestedAction,
    normalizeIsoControl,
  },
};
