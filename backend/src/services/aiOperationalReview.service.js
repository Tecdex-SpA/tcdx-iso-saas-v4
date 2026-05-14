const aiEngineClient = require('./aiEngineClient.service');

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
      depth: normalizeDepth(body.depth),
      return_structured_result: true,
    },
  };

  const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(payload);
  return {
    ok: aiResult.ok !== false,
    answer: aiResult.answer || '',
    structured_result: aiResult.structured_result || {},
    source_trace: aiResult.source_trace || [],
    confidence: Number(aiResult.confidence || 0),
    limitations: aiResult.limitations || [],
    engine: aiResult.engine || {},
  };
}

module.exports = {
  runOperationalAiReview,
};
