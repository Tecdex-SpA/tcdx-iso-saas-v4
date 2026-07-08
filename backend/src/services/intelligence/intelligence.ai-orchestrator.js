const aiEngineClient = require('../aiEngineClient.service');
const {
  ensureKnowledgeBasisOrDegrade,
  fallbackToDeterministicNarrative,
  validateStructuredAiOutput,
} = require('./intelligence.guardrails');
const { buildAiMessages, buildPromptContext } = require('./intelligence.prompt-builder');
const { buildNarrativeSet } = require('./intelligence.narrative');
const { recordIntelligenceAiTrace } = require('./intelligence.audit-log');

const DEFAULT_INTELLIGENCE_AI_TIMEOUT_MS = 12000;

function aiDisabled() {
  return String(process.env.AI_DISABLED || '').toLowerCase() === 'true' ||
    String(process.env.INTELLIGENCE_AI_ENABLED || 'true').toLowerCase() === 'false';
}

function getUserId(user) {
  return user?.id || user?.user_id || user?.userId || null;
}

function promptSize(value) {
  return Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
}

function resolveIntelligenceAiTimeoutMs(value = null) {
  const parsed = Number.parseInt(String(value || process.env.INTELLIGENCE_AI_TIMEOUT_MS || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTELLIGENCE_AI_TIMEOUT_MS;
}

async function invokeAi(promptContext, { requestId = null, timeoutMs = null } = {}) {
  const resolvedTimeoutMs = resolveIntelligenceAiTimeoutMs(timeoutMs);
  if (typeof aiEngineClient.generateIntelligenceNarrative === 'function') {
    return aiEngineClient.generateIntelligenceNarrative({
      messages: buildAiMessages(promptContext),
      context: promptContext,
      request_id: requestId,
    }, { timeoutMs: resolvedTimeoutMs });
  }
  return aiEngineClient.postJson('/api/ai/intelligence/narrative', {
    messages: buildAiMessages(promptContext),
    context: promptContext,
    request_id: requestId,
  }, { timeoutMs: resolvedTimeoutMs });
}

async function generateStructuredNarrative(context = {}, {
  narrativeType = 'executive',
  question = '',
  user = null,
  requestId = null,
  knowledgeLimit = 30,
} = {}) {
  const started = Date.now();
  let promptContext = null;
  let fallbackReason = null;
  let aiUsed = false;
  let model = null;

  try {
    promptContext = buildPromptContext(context, { narrativeType, question, knowledgeLimit });

    if (aiDisabled()) {
      fallbackReason = 'AI_DISABLED';
      const fallback = fallbackToDeterministicNarrative(promptContext, fallbackReason);
      await recordIntelligenceAiTrace({
        tenantId: context.tenant_id || context.tenant?.tenant_id || promptContext.tenant_summary?.tenant_id,
        userId: getUserId(user),
        requestId,
        aiUsed: false,
        model,
        latencyMs: Date.now() - started,
        promptContextSize: promptSize(promptContext),
        knowledgeItemsCount: promptContext.metadata.knowledge_items_count,
        fallback: true,
        errorCode: fallbackReason,
        confidence: fallback.confidence,
      });
      return fallback;
    }

    const raw = await invokeAi(promptContext, { requestId });
    aiUsed = true;
    model = raw?.model || raw?.engine?.model || raw?.metadata?.model || null;
    const structured = ensureKnowledgeBasisOrDegrade(
      validateStructuredAiOutput(raw),
      promptContext
    );
    await recordIntelligenceAiTrace({
      tenantId: context.tenant_id || context.tenant?.tenant_id || promptContext.tenant_summary?.tenant_id,
      userId: getUserId(user),
      requestId,
      aiUsed,
      model,
      latencyMs: Date.now() - started,
      promptContextSize: promptSize(promptContext),
      knowledgeItemsCount: promptContext.metadata.knowledge_items_count,
      fallback: false,
      confidence: structured.confidence,
    });
    return structured;
  } catch (error) {
    fallbackReason = error?.code || error?.name || 'AI_ORCHESTRATOR_ERROR';
    const fallback = fallbackToDeterministicNarrative(promptContext || context, fallbackReason);
    await recordIntelligenceAiTrace({
      tenantId: context.tenant_id || context.tenant?.tenant_id || promptContext?.tenant_summary?.tenant_id,
      userId: getUserId(user),
      requestId,
      aiUsed,
      model,
      latencyMs: Date.now() - started,
      promptContextSize: promptSize(promptContext),
      knowledgeItemsCount: promptContext?.metadata?.knowledge_items_count || 0,
      fallback: true,
      errorCode: fallbackReason,
      confidence: fallback.confidence,
    });
    return fallback;
  }
}

async function generateExecutiveNarrative(context, options = {}) {
  return generateStructuredNarrative(context, { ...options, narrativeType: 'executive' });
}

async function generateTechnicalNarrative(context, options = {}) {
  return generateStructuredNarrative(context, { ...options, narrativeType: 'technical' });
}

async function generateAuditNarrative(context, options = {}) {
  return generateStructuredNarrative(context, { ...options, narrativeType: 'audit' });
}

async function generateNextBestActionsNarrative(context, options = {}) {
  return generateStructuredNarrative(context, { ...options, narrativeType: 'next_best_actions' });
}

async function answerContextualQuestion({ tenantId, question, intelligenceBrief, user = null, requestId = null }) {
  const context = {
    ...(intelligenceBrief || {}),
    tenant_id: tenantId || intelligenceBrief?.tenant_id,
  };
  const structured = await generateStructuredNarrative(context, {
    narrativeType: 'contextual_question',
    question,
    user,
    requestId,
    knowledgeLimit: 20,
  });
  return {
    ok: true,
    tenant_id: context.tenant_id,
    question,
    answer: structured.executive_summary,
    structured_result: structured,
    knowledge_basis: structured.knowledge_basis,
    confidence: structured.confidence,
    limitations: structured.limitations,
    should_escalate_to_human: structured.should_escalate_to_human,
  };
}

async function generateNarratives(context, options = {}) {
  const structured = await generateStructuredNarrative(context, options);
  return buildNarrativeSet(structured);
}

module.exports = {
  answerContextualQuestion,
  generateAuditNarrative,
  generateExecutiveNarrative,
  generateNarratives,
  generateNextBestActionsNarrative,
  generateStructuredNarrative,
  generateTechnicalNarrative,
};
