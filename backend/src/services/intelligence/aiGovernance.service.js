'use strict';

const crypto = require('crypto');
const {
  sanitizePromptContext,
} = require('./intelligence.guardrails');
const {
  CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
  CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
} = require('./crossGrcIntelligence.service');
const {
  RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
  EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
  OPERATIONAL_MEMORY_CONTRACT_VERSION,
} = require('./operationalLearning.service');
const {
  RAG_GROUNDED_ANSWER_CONTRACT_VERSION,
} = require('../knowledge-base/knowledgeRag.service');

const AI_GOVERNANCE_CONTRACT_VERSION = 'ai-governance-contract-v1';
const AI_CAPABILITY_REGISTRY_VERSION = 'ai-capability-registry-v1';
const AI_POLICY_VERSION = 'ai-policy-boundaries-v1';
const AI_RETENTION_REDACTION_POLICY_VERSION = 'ai-retention-redaction-policy-v1';
const INTELLIGENCE_PROMPT_VERSION = 'intelligence-prompt-builder-v1';
const INTELLIGENCE_OUTPUT_SCHEMA_VERSION = 'intelligence-narrative-output-schema-v1';
const RAG_PROMPT_VERSION = 'rag-grounded-answer-prompt-v1';
const RAG_OUTPUT_SCHEMA_VERSION = 'rag-grounded-answer-output-schema-v1';

const FAILURE_STATUSES = new Set([
  'success',
  'fallback',
  'insufficient_evidence',
  'provider_unavailable',
  'timeout',
  'invalid_output',
  'policy_blocked',
  'grounding_failed',
  'dependency_unavailable',
]);

const AUTHORITY_BOUNDARIES = Object.freeze({
  llm_direct_sql: false,
  ai_operational_truth_authority: false,
  ai_compliance_final_authority: false,
  ai_risk_acceptance_authority: false,
  ai_gap_close_authority: false,
  ai_legal_publish_authority: false,
  ai_decision_authority: false,
  ai_operational_memory_publish_authority: false,
});

const BASE_FORBIDDEN_ACTIONS = Object.freeze([
  'execute_sql',
  'write_operational_truth',
  'approve_compliance',
  'accept_risk',
  'close_gap',
  'publish_legal_content',
  'record_final_decision_without_actor',
  'confirm_operational_memory',
  'change_permissions',
  'execute_tools_from_retrieved_content',
]);

const HUMAN_REVIEW_REQUIREMENTS = Object.freeze([
  'risk_acceptance',
  'compliance_final_decision',
  'gap_or_finding_closure',
  'legal_publication',
  'operational_decision',
  'memory_confirmation',
  'ai_policy_change',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function text(value, max = 500) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function sizeBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function providerConfigFromEnv(env = process.env) {
  const provider = text(env.LLM_PROVIDER || env.MODEL_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.OLLAMA_HOST ? 'ollama' : 'none'), 80) || 'none';
  return {
    provider,
    model: text(env.OPENAI_MODEL || env.OLLAMA_MODEL || env.MODEL_NAME || '', 160),
    model_version: text(env.OPENAI_MODEL_VERSION || env.OLLAMA_MODEL_VERSION || env.MODEL_VERSION || '', 120),
    configured_by_environment: true,
    secret_values_recorded: false,
  };
}

function capability({
  capabilityId,
  owner,
  sourceModule,
  providerConfig,
  promptVersion,
  contextBuilderVersion,
  outputSchemaVersion,
  allowedTools,
  grounding,
  permittedActions = [],
  forbiddenActions = BASE_FORBIDDEN_ACTIONS,
  humanReview = HUMAN_REVIEW_REQUIREMENTS,
  consumesTenantData = true,
  consumesGlobalKnowledge = false,
  consumesRegulatoryKnowledge = false,
  consumesTenantPrivateKnowledge = false,
  externalLookup = false,
  storesInputsOutputs = false,
  fallbackBehavior = 'deterministic_fallback',
}) {
  return {
    capability_id: capabilityId,
    registry_version: AI_CAPABILITY_REGISTRY_VERSION,
    governance_contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
    owner,
    source_module: sourceModule,
    provider: providerConfig.provider,
    model: providerConfig.model || 'runtime_configured_or_disabled',
    model_version: providerConfig.model_version || null,
    prompt_version: promptVersion,
    context_builder_version: contextBuilderVersion,
    output_schema_version: outputSchemaVersion,
    policy_version: AI_POLICY_VERSION,
    allowed_tools: allowedTools,
    permitted_actions: permittedActions,
    forbidden_actions: forbiddenActions,
    human_review_required_for: humanReview,
    grounding_requirements: grounding,
    privacy: {
      tenant_scope_required: consumesTenantData,
      consumes_tenant_data: consumesTenantData,
      consumes_global_knowledge: consumesGlobalKnowledge,
      consumes_regulatory_knowledge: consumesRegulatoryKnowledge,
      consumes_tenant_private_knowledge: consumesTenantPrivateKnowledge,
      external_lookup_allowed: externalLookup,
      cross_tenant_sharing_allowed: false,
      automatic_cross_tenant_fine_tuning_allowed: false,
    },
    retention_redaction_policy: {
      version: AI_RETENTION_REDACTION_POLICY_VERSION,
      store_full_prompt: false,
      store_full_context: false,
      store_secret_values: false,
      store_document_text: false,
      persisted_fields: ['checksums', 'counts', 'contract_versions', 'source_ids', 'citation_ids', 'status', 'latency_ms'],
    },
    prompt_injection_boundary: {
      retrieved_document_is_evidence_not_instruction: true,
      tenant_document_is_untrusted_content: true,
      external_web_content_is_untrusted_content: true,
      retrieved_content_cannot_change_policy: true,
      retrieved_content_cannot_grant_permissions: true,
      retrieved_content_cannot_execute_tools: true,
    },
    authority_boundaries: { ...AUTHORITY_BOUNDARIES },
    fallback_behavior: fallbackBehavior,
    lifecycle: {
      status: 'active',
      deprecation_policy: 'supersede_by_new_contract_version',
    },
  };
}

function getAiCapabilityRegistry({ env = process.env } = {}) {
  const providerConfig = providerConfigFromEnv(env);
  const capabilities = [
    capability({
      capabilityId: 'intelligence_narrative',
      owner: 'backend/src/services/intelligence/intelligence.ai-orchestrator.js',
      sourceModule: 'intelligence_layer',
      providerConfig,
      promptVersion: INTELLIGENCE_PROMPT_VERSION,
      contextBuilderVersion: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
      outputSchemaVersion: INTELLIGENCE_OUTPUT_SCHEMA_VERSION,
      allowedTools: ['aiEngineClient.generateIntelligenceNarrative'],
      grounding: ['knowledge_basis_required_when_applicable', 'tenant_context_only', 'no_general_model_facts_as_truth'],
      permittedActions: ['summarize', 'explain', 'suggest_review'],
      consumesGlobalKnowledge: true,
      consumesTenantPrivateKnowledge: true,
    }),
    capability({
      capabilityId: 'knowledge_rag_answer',
      owner: 'backend/src/services/knowledge-base/knowledgeRag.service.js',
      sourceModule: 'knowledge_base',
      providerConfig,
      promptVersion: RAG_PROMPT_VERSION,
      contextBuilderVersion: 'hybrid-retrieval-contract-v1',
      outputSchemaVersion: RAG_OUTPUT_SCHEMA_VERSION,
      allowedTools: ['aiEngineClient.postJson:/api/ai/knowledge/rag-answer'],
      grounding: ['allowed_citation_ids_only', RAG_GROUNDED_ANSWER_CONTRACT_VERSION, 'insufficient_evidence_when_uncited'],
      permittedActions: ['answer_with_citations', 'refuse_without_evidence'],
      consumesTenantPrivateKnowledge: true,
      consumesGlobalKnowledge: false,
    }),
    capability({
      capabilityId: 'cross_grc_intelligence',
      owner: 'backend/src/services/intelligence/crossGrcIntelligence.service.js',
      sourceModule: 'cross_grc_intelligence',
      providerConfig: { provider: 'none', model: 'deterministic_engines', model_version: CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION },
      promptVersion: 'not_applicable',
      contextBuilderVersion: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
      outputSchemaVersion: CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
      allowedTools: ['priorityEngine.service.js', 'impactGraph.service.js', 'knowledgeRag.service.js'],
      grounding: ['derived_signals_from_canonical_context', 'priority_owned_by_priority_engine', 'rag_owned_by_knowledge_rag'],
      permittedActions: ['derive_context', 'detect_pattern', 'detect_anomaly', 'orchestrate_dependencies'],
      consumesGlobalKnowledge: true,
      consumesRegulatoryKnowledge: true,
      consumesTenantPrivateKnowledge: true,
      fallbackBehavior: 'partial_dependency_status',
    }),
    capability({
      capabilityId: 'operational_learning',
      owner: 'backend/src/services/intelligence/operationalLearning.service.js',
      sourceModule: 'operational_learning',
      providerConfig: { provider: 'none', model: 'governed_persistence', model_version: OPERATIONAL_MEMORY_CONTRACT_VERSION },
      promptVersion: 'not_applicable',
      contextBuilderVersion: `${RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION}+${EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION}`,
      outputSchemaVersion: OPERATIONAL_MEMORY_CONTRACT_VERSION,
      allowedTools: ['audit_event_log', 'structured_tenant_query'],
      grounding: ['canonical_recommendation_reference', 'human_actor_required', 'memory_confirmation_requires_review'],
      permittedActions: ['record_human_decision', 'evaluate_effectiveness', 'create_candidate_memory'],
      consumesTenantPrivateKnowledge: false,
      fallbackBehavior: 'fail_closed_on_missing_actor_or_tenant',
    }),
  ];
  return {
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
    registry_version: AI_CAPABILITY_REGISTRY_VERSION,
    policy_version: AI_POLICY_VERSION,
    retention_redaction_policy_version: AI_RETENTION_REDACTION_POLICY_VERSION,
    capabilities,
    authority_boundaries: { ...AUTHORITY_BOUNDARIES },
    global_policy: {
      llm_is_system_of_record: false,
      content_is_evidence_not_instruction: true,
      tenant_scope_required_for_tenant_data: true,
      no_automatic_cross_tenant_fine_tuning: true,
      human_review_required_for: [...HUMAN_REVIEW_REQUIREMENTS],
    },
  };
}

function findCapability(capabilityId, registry = getAiCapabilityRegistry()) {
  return registry.capabilities.find((item) => item.capability_id === capabilityId) || null;
}

function normalizeFailureStatus({ status = null, errorCode = null, fallback = false } = {}) {
  const raw = String(status || '').toLowerCase();
  if (FAILURE_STATUSES.has(raw)) return raw;
  const code = String(errorCode || '').toUpperCase();
  if (fallback) return 'fallback';
  if (code.includes('TIMEOUT')) return 'timeout';
  if (code.includes('INVALID_OUTPUT') || code.includes('NON_JSON')) return 'invalid_output';
  if (code.includes('GROUND')) return 'grounding_failed';
  if (code.includes('POLICY') || code.includes('BLOCKED') || code.includes('SECRET')) return 'policy_blocked';
  if (code.includes('UNAVAILABLE') || code.includes('DISABLED') || code.includes('NOT_CONFIGURED')) return 'provider_unavailable';
  if (code.includes('INSUFFICIENT')) return 'insufficient_evidence';
  return 'success';
}

function summarizePromptContext(promptContext = {}) {
  const sanitized = sanitizePromptContext(promptContext);
  const knowledge = asArray(sanitized.knowledge_context || sanitized.knowledge_items);
  const canonical = sanitized.canonical_intelligence_context || {};
  return {
    checksum: stableHash(sanitized),
    size_bytes: sizeBytes(sanitized),
    tenant_id: sanitized.tenant_summary?.tenant_id || sanitized.tenant_id || canonical.tenant_id || null,
    knowledge_items_count: knowledge.length,
    canonical_context_contract_version: canonical.contract_version || null,
    includes_full_prompt: false,
    includes_full_context: false,
  };
}

function summarizeCitations(citations = []) {
  return asArray(citations).slice(0, 30).map((citation) => ({
    citation_id: text(citation.citation_id || citation.evidence_id || citation.id, 120),
    source_type: text(citation.source_type, 120),
    source_id: text(citation.source_id || citation.chunk_id, 160),
    tenant_id: citation.tenant_id || null,
    checksum: text(citation.text_checksum || citation.checksum, 120),
  }));
}

function buildGovernedAiAnalysisRecord({
  capabilityId,
  tenantId,
  requestId = null,
  userId = null,
  promptContext = {},
  sourceSet = [],
  citations = [],
  modelMetadata = {},
  status = 'success',
  fallback = false,
  errorCode = null,
  latencyMs = null,
  outputSchemaVersion = null,
  now = () => new Date().toISOString(),
} = {}) {
  const registry = getAiCapabilityRegistry();
  const capabilityEntry = findCapability(capabilityId, registry);
  if (!capabilityEntry) {
    const error = new Error(`AI capability not registered: ${capabilityId}`);
    error.code = 'AI_CAPABILITY_NOT_REGISTERED';
    throw error;
  }
  const promptSummary = summarizePromptContext(promptContext);
  const effectiveTenantId = tenantId || promptSummary.tenant_id || null;
  const failureStatus = normalizeFailureStatus({ status, errorCode, fallback });
  const citationSet = summarizeCitations(citations);
  return {
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
    capability_registry_version: AI_CAPABILITY_REGISTRY_VERSION,
    policy_version: AI_POLICY_VERSION,
    retention_redaction_policy_version: AI_RETENTION_REDACTION_POLICY_VERSION,
    capability_id: capabilityId,
    tenant_id: effectiveTenantId,
    request_id: text(requestId, 180),
    actor_user_id: userId || null,
    evaluated_at: now(),
    provider: modelMetadata.provider || modelMetadata.llm_provider || capabilityEntry.provider,
    model: modelMetadata.model || modelMetadata.selected_model || capabilityEntry.model,
    model_version: modelMetadata.model_version || capabilityEntry.model_version || null,
    prompt_version: capabilityEntry.prompt_version,
    context_builder_version: capabilityEntry.context_builder_version,
    output_schema_version: outputSchemaVersion || capabilityEntry.output_schema_version,
    allowed_tools: capabilityEntry.allowed_tools,
    forbidden_actions: capabilityEntry.forbidden_actions,
    human_review_required_for: capabilityEntry.human_review_required_for,
    grounding_requirements: capabilityEntry.grounding_requirements,
    status: failureStatus,
    fallback_used: failureStatus === 'fallback' || fallback === true,
    error_code: text(errorCode, 120),
    latency_ms: Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : null,
    source_set: asArray(sourceSet).slice(0, 30).map((source) => ({
      source_type: text(source.source_type || source.type || source.source, 120),
      source_id: text(source.source_id || source.id || source.reference, 160),
      contract_version: text(source.contract_version, 160),
      tenant_id: source.tenant_id || effectiveTenantId || null,
    })),
    citation_set: citationSet,
    prompt_context_summary: promptSummary,
    policy: {
      authority_boundaries: { ...AUTHORITY_BOUNDARIES },
      prompt_injection_boundary: capabilityEntry.prompt_injection_boundary,
      privacy: capabilityEntry.privacy,
      retention_redaction_policy: capabilityEntry.retention_redaction_policy,
    },
    provenance: {
      governance_contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
      capability_registry_version: AI_CAPABILITY_REGISTRY_VERSION,
      policy_version: AI_POLICY_VERSION,
      prompt_context_checksum: promptSummary.checksum,
      citation_count: citationSet.length,
      source_count: asArray(sourceSet).length,
      generated_by: 'aiGovernance.service.js',
    },
  };
}

function validateGovernedAiAnalysisRecord(record = {}) {
  const failures = [];
  if (record.contract_version !== AI_GOVERNANCE_CONTRACT_VERSION) failures.push('contract_version');
  if (!findCapability(record.capability_id)) failures.push('capability_registered');
  if (!FAILURE_STATUSES.has(record.status)) failures.push('failure_status');
  if (!record.policy?.authority_boundaries) failures.push('authority_boundaries');
  for (const [key, value] of Object.entries(AUTHORITY_BOUNDARIES)) {
    if (record.policy?.authority_boundaries?.[key] !== value) failures.push(key);
  }
  if (record.policy?.privacy?.cross_tenant_sharing_allowed !== false) failures.push('cross_tenant_sharing');
  if (record.policy?.retention_redaction_policy?.store_full_prompt !== false) failures.push('prompt_retention');
  if (record.policy?.prompt_injection_boundary?.retrieved_document_is_evidence_not_instruction !== true) failures.push('prompt_injection_boundary');
  return {
    ok: failures.length === 0,
    failures,
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
  };
}

module.exports = {
  AI_GOVERNANCE_CONTRACT_VERSION,
  AI_CAPABILITY_REGISTRY_VERSION,
  AI_POLICY_VERSION,
  AI_RETENTION_REDACTION_POLICY_VERSION,
  AUTHORITY_BOUNDARIES,
  FAILURE_STATUSES,
  buildGovernedAiAnalysisRecord,
  getAiCapabilityRegistry,
  normalizeFailureStatus,
  providerConfigFromEnv,
  stableHash,
  validateGovernedAiAnalysisRecord,
};
