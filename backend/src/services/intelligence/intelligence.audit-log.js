const pool = require('../../config/db');

async function recordIntelligenceAiTrace({
  tenantId,
  userId = null,
  requestId = null,
  aiUsed = false,
  model = null,
  latencyMs = 0,
  promptContextSize = 0,
  knowledgeItemsCount = 0,
  fallback = false,
  errorCode = null,
  confidence = null,
  governance = null,
} = {}) {
  if (!tenantId) return null;
  try {
    await pool.query(
      `
      INSERT INTO ai_prompt_logs (
        tenant_id,
        prompt_type,
        source_module,
        source_entity_type,
        source_entity_id,
        request_payload,
        response_payload,
        status,
        error_message,
        created_by
      )
      VALUES (
        $1::uuid,
        'intelligence_narrative',
        'intelligence_layer',
        'tenant',
        $1::uuid,
        $2::jsonb,
        $3::jsonb,
        $4,
        $5,
        $6::uuid
      )
      `,
      [
        tenantId,
        JSON.stringify({
          request_id: requestId,
          ai_used: aiUsed,
          model,
          prompt_context_size: promptContextSize,
          knowledge_items_count: knowledgeItemsCount,
          governance: governance ? {
            contract_version: governance.contract_version,
            capability_id: governance.capability_id,
            policy_version: governance.policy_version,
            prompt_version: governance.prompt_version,
            context_builder_version: governance.context_builder_version,
            output_schema_version: governance.output_schema_version,
            prompt_context_summary: governance.prompt_context_summary,
          } : null,
        }),
        JSON.stringify({
          latency_ms: latencyMs,
          fallback,
          error_code: errorCode,
          confidence,
          governance: governance ? {
            status: governance.status,
            fallback_used: governance.fallback_used,
            source_count: governance.provenance?.source_count || 0,
            citation_count: governance.provenance?.citation_count || 0,
            authority_boundaries: governance.policy?.authority_boundaries || {},
            retention_redaction_policy_version: governance.retention_redaction_policy_version,
          } : null,
        }),
        errorCode ? 'fallback' : 'ok',
        errorCode,
        userId,
      ]
    );
  } catch (error) {
    console.warn('INTELLIGENCE_AI_TRACE_SKIPPED', {
      code: error?.code,
      message: error?.message,
    });
  }
  return null;
}

module.exports = {
  recordIntelligenceAiTrace,
};
