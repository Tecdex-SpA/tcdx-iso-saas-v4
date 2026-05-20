const aiContextBuilder = require('./aiContextBuilder.service');
const aiEngineClient = require('./aiEngineClient.service');
const { createAiTimer, resolveAiMode } = require('./aiRuntimeMetrics.service');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function emptyEnrichment({ reportType, metrics, limitation }) {
  return {
    ok: false,
    answer: '',
    structured_result: {},
    executive_summary: '',
    key_findings: [],
    recommended_actions: [],
    audit_readiness: {},
    confidence: 0,
    limitations: [limitation || 'Enriquecimiento IA no disponible; reporte generado con datos internos.'],
    source_trace: [],
    ai_enrichment_failed: true,
    fallback_used: true,
    engine: {
      fast_mode: true,
      used_llm: false,
      local_compact: true,
    },
    metrics: {
      ...(metrics || {}),
      mode: metrics?.mode || 'fast_mode',
      report_type: reportType,
    },
  };
}

function normalizeModelMode(value) {
  const mode = String(value || 'fast').trim().toLowerCase();
  return ['fast', 'balanced', 'deep'].includes(mode) ? mode : 'fast';
}

function boolOption(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 's'].includes(String(value).trim().toLowerCase());
}

async function buildReportAiEnrichment({
  tenantId,
  standardCode = null,
  operationId = null,
  reportType = 'executive',
  depth = 'executive',
  includeDeepLlm = false,
  modelMode = 'fast',
  useLlm = false,
  useRag = true,
  useWeb = false,
  useDrive = 'auto',
  quality = null,
  requestId = null,
} = {}) {
  const normalizedModelMode = normalizeModelMode(modelMode);
  const requestedLlm = boolOption(useLlm, normalizedModelMode !== 'fast' || includeDeepLlm);
  const useDeepPath = includeDeepLlm || requestedLlm || normalizedModelMode !== 'fast';
  const timer = createAiTimer({
    endpoint: 'report-ai-enrichment',
    mode: useDeepPath ? 'llm' : 'fast_mode',
    tenantId,
    operationId,
    standardCode,
  });

  if (!tenantId) {
    return emptyEnrichment({
      reportType,
      metrics: timer.finish({ report_type: reportType, request_id: requestId || null }),
      limitation: 'Enriquecimiento IA omitido: tenant_id no disponible para el reporte.',
    });
  }

  const requestedDepth = useDeepPath
    ? (['standard', 'deep'].includes(depth) ? depth : (normalizedModelMode === 'deep' ? 'deep' : 'standard'))
    : 'executive';

  const options = {
    local_compact: true,
    fast_mode: !useDeepPath,
    use_llm_in_fast_mode: requestedLlm && normalizedModelMode === 'fast',
    use_llm: requestedLlm,
    model_mode: normalizedModelMode,
    use_rag: boolOption(useRag, true),
    use_drive: useDrive === 'auto' ? 'auto' : boolOption(useDrive, false),
    use_web: boolOption(useWeb, false),
    depth: requestedDepth,
    quality,
    return_structured_result: true,
  };

  try {
    const context = standardCode
      ? await aiContextBuilder.buildAiStandardContext({ tenantId, standardCode, operationId })
      : await aiContextBuilder.buildAiTenantContext({ tenantId });

    const payload = {
      task_type: reportType === 'audit_report' ? 'audit_analysis' : 'standard_gap_analysis',
      tenant_id: tenantId,
      module_origin: 'reports',
      question: requestedLlm
        ? 'Genera enriquecimiento premium de reporte con resumen ejecutivo, riesgos clave, decisiones recomendadas, prioridades de evidencia, próximos pasos y comentario auditor. No inventes datos: los datos internos son la fuente de verdad.'
        : 'Genera enriquecimiento ejecutivo de reporte con brechas, readiness y acciones prioritarias.',
      locale: 'es',
      context,
      options,
      request_metadata: {
        report_type: reportType,
        request_id: requestId || null,
        model_mode: normalizedModelMode,
        quality,
      },
    };

    const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(payload);
    const structured = aiResult?.structured_result && typeof aiResult.structured_result === 'object'
      ? aiResult.structured_result
      : {};
    const gaps = asArray(structured.gaps);
    const recommendedActions = asArray(structured.recommended_actions);
    const engine = aiResult?.engine || {};
    const metrics = timer.finish({
      mode: resolveAiMode(options, engine),
      report_type: reportType,
      request_id: requestId || null,
      used_llm: engine.used_llm === true,
      fast_mode: engine.fast_mode === true,
      local_compact: engine.local_compact === true,
      used_rag: engine.used_rag === true,
      used_drive: engine.used_drive === true,
      used_web: engine.used_web === true,
    });

    return {
      ok: aiResult?.ok !== false,
      answer: aiResult?.answer || '',
      structured_result: structured,
      executive_summary: structured.executive_summary || aiResult?.answer || '',
      key_findings: gaps.map((gap) => gap.title || gap.description).filter(Boolean),
      recommended_actions: recommendedActions,
      audit_readiness: structured.audit_readiness || {},
      confidence: Number(aiResult?.confidence ?? structured.confidence ?? 0),
      limitations: aiResult?.limitations || structured.limitations || [],
      source_trace: aiResult?.source_trace || structured.source_trace || [],
      engine,
      metrics: {
        ...metrics,
        model_mode_used: normalizedModelMode,
        llm_used: engine.used_llm === true,
        llm_provider: engine.llm_provider || null,
        model_name: engine.model || null,
        source: engine.used_llm === true ? 'ai-engine-v2-report-llm' : 'ai-engine-v2-report-fast',
        duration_ms: metrics.duration_ms,
      },
      model_mode_used: normalizedModelMode,
      llm_used: engine.used_llm === true,
      llm_provider: engine.llm_provider || null,
      model_name: engine.model || null,
      source: engine.used_llm === true ? 'ai-engine-v2-report-llm' : 'ai-engine-v2-report-fast',
      duration_ms: metrics.duration_ms,
      ai_enrichment_failed: false,
      fallback_used: false,
    };
  } catch (error) {
    const metrics = timer.finish({
      mode: 'fast_mode',
      report_type: reportType,
      request_id: requestId || null,
      used_llm: false,
    });
    console.error('REPORT AI ENRICHMENT ERROR:', error.message);
    const fallback = emptyEnrichment({
      reportType,
      metrics,
      limitation: 'Enriquecimiento IA no disponible; reporte generado con datos internos.',
    });
    return {
      ...fallback,
      model_mode_used: normalizedModelMode,
      llm_used: false,
      source: 'ai-engine-v2-report-fallback',
    };
  }
}

module.exports = {
  buildReportAiEnrichment,
};
