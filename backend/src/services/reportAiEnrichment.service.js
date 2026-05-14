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

async function buildReportAiEnrichment({
  tenantId,
  standardCode = null,
  operationId = null,
  reportType = 'executive',
  depth = 'executive',
  includeDeepLlm = false,
  requestId = null,
} = {}) {
  const timer = createAiTimer({
    endpoint: 'report-ai-enrichment',
    mode: includeDeepLlm ? 'local_compact' : 'fast_mode',
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

  const requestedDepth = includeDeepLlm
    ? (['standard', 'deep'].includes(depth) ? depth : 'standard')
    : 'executive';

  const options = {
    local_compact: true,
    fast_mode: !includeDeepLlm,
    use_llm_in_fast_mode: false,
    use_rag: true,
    use_drive: 'auto',
    use_web: false,
    depth: requestedDepth,
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
      question: 'Genera enriquecimiento ejecutivo de reporte con brechas, readiness y acciones prioritarias.',
      locale: 'es',
      context,
      options,
      request_metadata: {
        report_type: reportType,
        request_id: requestId || null,
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
      metrics,
    };
  } catch (error) {
    const metrics = timer.finish({
      mode: 'fast_mode',
      report_type: reportType,
      request_id: requestId || null,
      used_llm: false,
    });
    console.error('REPORT AI ENRICHMENT ERROR:', error.message);
    return emptyEnrichment({
      reportType,
      metrics,
      limitation: 'Enriquecimiento IA no disponible; reporte generado con datos internos.',
    });
  }
}

module.exports = {
  buildReportAiEnrichment,
};
