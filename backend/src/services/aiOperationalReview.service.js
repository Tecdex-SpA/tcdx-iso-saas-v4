const aiEngineClient = require('./aiEngineClient.service');
const { createAiTimer, resolveAiMode } = require('./aiRuntimeMetrics.service');

function normalizeDepth(value) {
  return ['executive', 'standard', 'deep'].includes(value) ? value : 'executive';
}

function buildQuestion({ defaultQuestion, body = {}, entityLabel = '' }) {
  const userQuestion = typeof body.question === 'string' ? body.question.trim() : '';
  if (userQuestion) return userQuestion;
  return defaultQuestion || `Analiza ${entityLabel || 'este elemento'} con criterio de auditor ISO senior.`;
}

async function runOperationalAiReview({
  tenantId,
  moduleOrigin,
  taskType,
  context,
  body = {},
  defaultQuestion = '',
  entityLabel = '',
}) {
  const depth = normalizeDepth(body.depth);
  const fastMode = body.fast_mode === undefined ? depth === 'executive' : body.fast_mode === true;
  const timer = createAiTimer({
    endpoint: `${moduleOrigin || 'operational-ai'}/${taskType || 'analysis'}`,
    mode: fastMode ? 'fast_mode' : 'local_compact',
    tenantId,
    operationId: context?.scope?.operation_id,
    standardCode: context?.scope?.standard_code,
  });
  const payload = {
    task_type: taskType,
    tenant_id: tenantId,
    module_origin: moduleOrigin,
    question: buildQuestion({ defaultQuestion, body, entityLabel }),
    locale: 'es',
    context,
    options: {
      local_compact: body.local_compact !== false,
      use_rag: body.use_rag !== false,
      use_drive: body.use_drive === undefined ? 'auto' : body.use_drive !== false,
      use_web: body.force_web === true || body.use_web === true,
      force_web: body.force_web === true,
      fast_mode: fastMode,
      use_llm_in_fast_mode: body.use_llm_in_fast_mode === true,
      depth,
      return_structured_result: true,
    },
  };

  const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(payload);
  const mode = resolveAiMode(payload.options, aiResult.engine || {});
  const metrics = timer.finish({
    mode,
    used_llm: aiResult.engine?.used_llm === true,
    fast_mode: aiResult.engine?.fast_mode === true,
    local_compact: aiResult.engine?.local_compact === true,
    used_rag: aiResult.engine?.used_rag === true,
    used_drive: aiResult.engine?.used_drive === true,
    used_web: aiResult.engine?.used_web === true,
  });
  return {
    ok: aiResult.ok !== false,
    answer: aiResult.answer || '',
    structured_result: aiResult.structured_result || {},
    source_trace: aiResult.source_trace || [],
    confidence: Number(aiResult.confidence || 0),
    limitations: aiResult.limitations || [],
    engine: aiResult.engine || {},
    metrics,
  };
}

module.exports = {
  runOperationalAiReview,
};
