'use strict';

const crypto = require('crypto');

const {
  CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
  stableHash: crossGrcStableHash,
} = require('./crossGrcIntelligence.service');

const RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION = 'recommendation-decision-ledger-v1';
const EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION = 'effectiveness-feedback-loop-v1';
const OPERATIONAL_MEMORY_CONTRACT_VERSION = 'operational-memory-v1';

const VALID_DECISIONS = new Set(['accepted', 'modified', 'rejected', 'deferred', 'escalated', 'executed', 'cancelled']);
const VALID_EFFECTIVENESS_RESULTS = new Set(['effective', 'partially_effective', 'ineffective', 'inconclusive', 'insufficient_data']);
const VALID_MEMORY_STATUSES = new Set(['candidate', 'confirmed', 'rejected', 'deprecated']);
const VALID_MEMORY_TYPES = new Set(['recommendation_case', 'effectiveness_case', 'lesson_candidate', 'ai_hypothesis']);

const DEFAULT_BOUNDS = Object.freeze({
  max_memory_cases: 25,
  max_links: 40,
  max_summary_chars: 2000,
  max_recommendation_context_chars: 4000,
});

class OperationalLearningError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

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

function checksumText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function requireTenantId({ tenantId, user } = {}) {
  const resolved = tenantId || tenantIdFromUser(user);
  if (!resolved) {
    throw new OperationalLearningError('OPERATIONAL_LEARNING_TENANT_REQUIRED', 'Tenant requerido para F6.13-A.', 400);
  }
  return resolved;
}

function requireActor(user = {}, field = 'actor') {
  const actorId = user.id || user.user_id || user.userId || user.sub || null;
  if (!actorId) {
    throw new OperationalLearningError('OPERATIONAL_LEARNING_ACTOR_REQUIRED', `Usuario requerido como ${field}.`, 401);
  }
  return actorId;
}

function requireCorrelationId(value) {
  const correlationId = cleanText(value, 160);
  if (!correlationId) {
    throw new OperationalLearningError('OPERATIONAL_LEARNING_CORRELATION_REQUIRED', 'correlation_id/request_id requerido para idempotencia.', 422);
  }
  return correlationId;
}

function normalizeTrust(value) {
  if (value === null || value === undefined || value === '') return null;
  const state = String(value?.state || value || '').trim();
  const upper = state.toUpperCase();
  if (upper === 'TRUSTED') return 'trusted';
  if (upper === 'TRUSTED_WITH_WARNINGS') return 'trusted_with_warnings';
  if (upper === 'LOW_CONFIDENCE') return 'low_confidence';
  if (upper === 'INSUFFICIENT_DATA') return 'insufficient_data';
  if (upper === 'SOURCE_INCOMPATIBLE') return 'source_incompatible';
  if (upper === 'DEPENDENCY_PENDING') return 'dependency_pending';
  if (['trusted', 'trusted_with_warnings', 'low_confidence', 'insufficient_data', 'source_incompatible', 'dependency_pending'].includes(state)) {
    return state;
  }
  return state ? 'trusted_with_warnings' : null;
}

function combineTrust(values = []) {
  const states = values.map(normalizeTrust).filter(Boolean);
  if (!states.length) return 'insufficient_data';
  if (states.includes('source_incompatible')) return 'source_incompatible';
  if (states.includes('dependency_pending')) return 'dependency_pending';
  if (states.includes('insufficient_data')) return 'insufficient_data';
  if (states.includes('low_confidence')) return 'low_confidence';
  if (states.includes('trusted_with_warnings')) return 'trusted_with_warnings';
  return 'trusted';
}

function boundedObject(value, maxChars = DEFAULT_BOUNDS.max_recommendation_context_chars) {
  const object = asObject(value);
  const serialized = JSON.stringify(stable(object));
  if (serialized.length <= maxChars) return object;
  return {
    truncated: true,
    original_checksum: stableHash(object),
    preview: serialized.slice(0, maxChars),
  };
}

function recommendationIdentity(input = {}) {
  const recommendation = asObject(input.recommendation || input);
  return {
    recommendation_id: recommendation.id || recommendation.recommendation_id || null,
    recommendation_key: cleanText(recommendation.key || recommendation.recommendation_key || recommendation.dedupe_key, 220),
    source_module: cleanText(recommendation.source_module, 120),
    source_entity_type: cleanText(recommendation.source_entity_type || recommendation.subject_type, 120),
    source_entity_id: recommendation.source_entity_id || recommendation.subject_id || null,
    title: cleanText(recommendation.title || recommendation.recommended_action || recommendation.action, 240),
  };
}

function subjectIdentity({ recommendation = {}, subject = {} } = {}) {
  const source = Object.keys(asObject(subject)).length ? subject : recommendation;
  return {
    subject_type: cleanText(source.subject_type || source.source_entity_type || source.target_record_type || 'recommendation', 120),
    subject_id: source.subject_id || source.source_entity_id || source.target_id || null,
  };
}

function buildDecisionLedgerEntry({
  tenantId,
  user,
  recommendation,
  sourceIntelligenceContext = {},
  priorityContext = {},
  subject = {},
  decision,
  decisionReason,
  decisionAt,
  correlationId,
  requestId,
  idempotencyKey,
  previousDecisionId = null,
  humanModification = {},
  metadata = {},
  now = () => new Date().toISOString(),
} = {}) {
  const effectiveTenantId = requireTenantId({ tenantId, user });
  const actorId = requireActor(user, 'decision_actor');
  const normalizedDecision = cleanText(decision, 40);
  if (!VALID_DECISIONS.has(normalizedDecision)) {
    throw new OperationalLearningError('DECISION_LEDGER_DECISION_INVALID', 'Decision no soportada por recommendation-decision-ledger-v1.', 422);
  }
  const reason = cleanText(decisionReason || metadata.reason, 1000);
  if (!reason) {
    throw new OperationalLearningError('DECISION_LEDGER_REASON_REQUIRED', 'decision_reason es obligatorio.', 422);
  }
  const effectiveCorrelationId = requireCorrelationId(correlationId || requestId);
  const recommendationRef = recommendationIdentity({ recommendation });
  const subjectRef = subjectIdentity({ recommendation, subject });
  const sourceContext = boundedObject(sourceIntelligenceContext);
  const boundedPriority = boundedObject(priorityContext, 2500);
  const contractInput = {
    contract_version: RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    recommendation_identity: recommendationRef,
    recommendation_version: recommendation?.version || recommendation?.recommendation_version || null,
    subject: subjectRef,
    source_intelligence_context_key: sourceContext.context_key || sourceContext.id || sourceContext.provenance?.request_id || null,
    source_intelligence_contract: sourceContext.contract_version || CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
    priority_context_key: boundedPriority.priority_key || boundedPriority.id || null,
    priority_contract: boundedPriority.contract_version || boundedPriority.model_version || 'priority-engine-2-v1',
  };
  const decisionKey = stableHash(contractInput);
  const effectiveIdempotency = cleanText(idempotencyKey, 240)
    || `f6.13-decision:${stableHash({ tenant_id: effectiveTenantId, decision_key: decisionKey, decision: normalizedDecision, actor_id: actorId, correlation_id: effectiveCorrelationId })}`;
  const effectiveDecisionAt = decisionAt || now();
  return {
    tenant_id: effectiveTenantId,
    decision_key: decisionKey,
    idempotency_key: effectiveIdempotency,
    contract_version: RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
    recommendation_id: recommendationRef.recommendation_id,
    recommendation_identity: recommendationRef,
    recommendation_version: recommendation?.version || recommendation?.recommendation_version || null,
    subject_type: subjectRef.subject_type,
    subject_id: subjectRef.subject_id,
    source_intelligence_context: {
      ...sourceContext,
      reused_contract_version: sourceContext.contract_version || CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
      ai_decision_authority: false,
    },
    priority_context: {
      ...boundedPriority,
      owner: boundedPriority.owner || 'priorityEngine.service.js',
      priority_engine_reimplemented: false,
    },
    decision: normalizedDecision,
    decision_status: 'recorded',
    decision_reason: reason,
    decision_actor_user_id: actorId,
    decision_at: effectiveDecisionAt,
    correlation_id: effectiveCorrelationId,
    previous_decision_id: previousDecisionId,
    human_modification: asObject(humanModification),
    provenance: {
      contract_version: RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      recommendation_identity: recommendationRef,
      source_intelligence_contract: sourceContext.contract_version || CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
      priority_contract: boundedPriority.contract_version || boundedPriority.model_version || 'priority-engine-2-v1',
      correlation_id: effectiveCorrelationId,
      actor_user_id: actorId,
      ai_decision_authority: false,
      llm_direct_sql: false,
      append_only: true,
    },
    metadata: asObject(metadata),
  };
}

function metricValue(state = {}, metric) {
  const object = asObject(state);
  const metrics = asObject(object.metrics || object.values || object);
  const value = metrics[metric];
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateBeforeAfter({ beforeState = {}, afterState = {}, expectedOutcome = {} } = {}) {
  const expected = asObject(expectedOutcome);
  const metric = expected.metric || expected.metric_key || null;
  const direction = expected.direction || null;
  const target = expected.target === undefined || expected.target === null ? null : Number(expected.target);
  if (!metric || !direction) {
    return {
      result: 'inconclusive',
      confidence: 0.35,
      reason: 'expected_outcome_missing_metric_or_direction',
    };
  }
  const before = metricValue(beforeState, metric);
  const after = metricValue(afterState, metric);
  if (before === null || after === null) {
    return {
      result: 'insufficient_data',
      confidence: 0,
      reason: 'before_or_after_metric_missing',
    };
  }
  if (direction === 'decrease') {
    if (after < before) return { result: 'effective', confidence: 0.8, reason: 'metric_decreased' };
    return { result: 'ineffective', confidence: 0.7, reason: 'metric_not_decreased' };
  }
  if (direction === 'increase') {
    if (after > before) return { result: 'effective', confidence: 0.8, reason: 'metric_increased' };
    return { result: 'ineffective', confidence: 0.7, reason: 'metric_not_increased' };
  }
  if (direction === 'target_at_or_below' && Number.isFinite(target)) {
    if (after <= target) return { result: 'effective', confidence: 0.85, reason: 'target_met' };
    if (after < before) return { result: 'partially_effective', confidence: 0.65, reason: 'improved_but_target_not_met' };
    return { result: 'ineffective', confidence: 0.7, reason: 'target_not_met' };
  }
  if (direction === 'target_at_or_above' && Number.isFinite(target)) {
    if (after >= target) return { result: 'effective', confidence: 0.85, reason: 'target_met' };
    if (after > before) return { result: 'partially_effective', confidence: 0.65, reason: 'improved_but_target_not_met' };
    return { result: 'ineffective', confidence: 0.7, reason: 'target_not_met' };
  }
  return {
    result: 'inconclusive',
    confidence: 0.35,
    reason: 'unsupported_expected_outcome_direction',
  };
}

function buildEffectivenessEvaluation({
  tenantId,
  user,
  decision,
  decisionId,
  actionConversionId = null,
  actionReference = {},
  beforeState = {},
  afterState = {},
  expectedOutcome = {},
  observedOutcome = {},
  evaluationWindow = {},
  observationTime = null,
  methodology = 'before-after-outcome-comparison-v1',
  correlationId,
  requestId,
  idempotencyKey,
  evaluatedAt,
  metadata = {},
  now = () => new Date().toISOString(),
} = {}) {
  const effectiveTenantId = requireTenantId({ tenantId, user });
  const actorId = requireActor(user, 'effectiveness_evaluator');
  const effectiveCorrelationId = requireCorrelationId(correlationId || requestId);
  const effectiveDecisionId = decisionId || decision?.id || null;
  if (!effectiveDecisionId) {
    throw new OperationalLearningError('EFFECTIVENESS_DECISION_REQUIRED', 'decision_id es obligatorio.', 422);
  }
  const before = asObject(beforeState);
  const after = asObject(afterState);
  const expected = asObject(expectedOutcome);
  const observed = asObject(observedOutcome);
  const method = cleanText(methodology, 120) || 'before-after-outcome-comparison-v1';
  const comparison = evaluateBeforeAfter({ beforeState: before, afterState: after, expectedOutcome: expected });
  const trust = combineTrust([before.data_trust, after.data_trust, expected.data_trust, observed.data_trust]);
  const result = trust === 'insufficient_data' || comparison.result === 'insufficient_data'
    ? 'insufficient_data'
    : comparison.result;
  if (!VALID_EFFECTIVENESS_RESULTS.has(result)) {
    throw new OperationalLearningError('EFFECTIVENESS_RESULT_INVALID', 'Resultado de efectividad invalido.', 422);
  }
  const windowStart = evaluationWindow.start || evaluationWindow.period_start || null;
  const windowEnd = evaluationWindow.end || evaluationWindow.period_end || null;
  const evaluationKey = stableHash({
    contract_version: EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    decision_id: effectiveDecisionId,
    action_conversion_id: actionConversionId,
    action_reference: asObject(actionReference),
    methodology: method,
    expected_outcome: expected,
    evaluation_window_start: windowStart,
    evaluation_window_end: windowEnd,
  });
  const effectiveIdempotency = cleanText(idempotencyKey, 240)
    || `f6.13-effectiveness:${stableHash({ tenant_id: effectiveTenantId, evaluation_key: evaluationKey, correlation_id: effectiveCorrelationId, actor_id: actorId })}`;
  const technicalEvaluatedAt = evaluatedAt || now();
  return {
    tenant_id: effectiveTenantId,
    evaluation_key: evaluationKey,
    idempotency_key: effectiveIdempotency,
    contract_version: EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
    decision_id: effectiveDecisionId,
    action_conversion_id: actionConversionId,
    action_reference: asObject(actionReference),
    methodology: method,
    expected_outcome: expected,
    observed_outcome: {
      ...observed,
      closed_equals_effective_assumption: false,
      comparison_reason: comparison.reason,
    },
    before_state: before,
    after_state: after,
    effectiveness_result: result,
    confidence: result === 'insufficient_data' ? 0 : comparison.confidence,
    data_trust: {
      state: trust,
      missing_is_not_zero: true,
      insufficient_data_is_not_ineffective: true,
    },
    evaluation_window_start: windowStart,
    evaluation_window_end: windowEnd,
    observation_time: observationTime || after.observed_at || after.observation_time || null,
    evaluated_by: actorId,
    evaluated_at: technicalEvaluatedAt,
    correlation_id: effectiveCorrelationId,
    provenance: {
      contract_version: EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      decision_id: effectiveDecisionId,
      action_conversion_id: actionConversionId,
      methodology: method,
      evaluation_window: { start: windowStart, end: windowEnd },
      correlation_id: effectiveCorrelationId,
      actor_user_id: actorId,
      ai_effectiveness_truth_authority: false,
      closed_equals_effective_assumption: false,
      llm_direct_sql: false,
    },
    metadata: asObject(metadata),
  };
}

function buildOperationalMemoryCase({
  tenantId,
  user,
  title,
  summary,
  lifecycleStatus = 'candidate',
  caseType = 'recommendation_case',
  facts = [],
  decisions = [],
  outcomes = [],
  effectivenessEvaluations = [],
  confirmedLessons = [],
  aiHypotheses = [],
  sourceDecisionId = null,
  sourceEffectivenessEvaluationId = null,
  dataTrust = {},
  confirmationReason = null,
  correlationId,
  requestId,
  idempotencyKey,
  confirmedAt,
  metadata = {},
  now = () => new Date().toISOString(),
} = {}) {
  const effectiveTenantId = requireTenantId({ tenantId, user });
  const actorId = requireActor(user, 'memory_actor');
  const status = cleanText(lifecycleStatus, 40) || 'candidate';
  const type = cleanText(caseType, 80) || 'recommendation_case';
  if (!VALID_MEMORY_STATUSES.has(status)) {
    throw new OperationalLearningError('OPERATIONAL_MEMORY_STATUS_INVALID', 'Estado de memoria no soportado.', 422);
  }
  if (!VALID_MEMORY_TYPES.has(type)) {
    throw new OperationalLearningError('OPERATIONAL_MEMORY_TYPE_INVALID', 'Tipo de memoria no soportado.', 422);
  }
  if (type === 'ai_hypothesis' && status === 'confirmed') {
    throw new OperationalLearningError('OPERATIONAL_MEMORY_AI_CONFIRM_FORBIDDEN', 'Una hipotesis IA no puede publicarse como memoria confirmada.', 422);
  }
  const caseTitle = cleanText(title, 240);
  const caseSummary = cleanText(summary, DEFAULT_BOUNDS.max_summary_chars);
  if (!caseTitle || !caseSummary) {
    throw new OperationalLearningError('OPERATIONAL_MEMORY_SUMMARY_REQUIRED', 'title y summary son obligatorios.', 422);
  }
  const effectiveCorrelationId = requireCorrelationId(correlationId || requestId);
  const trust = normalizeTrust(dataTrust);
  const confirmReason = cleanText(confirmationReason, 1000);
  if (status === 'confirmed' && !confirmReason) {
    throw new OperationalLearningError('OPERATIONAL_MEMORY_CONFIRMATION_REQUIRED', 'confirmation_reason es obligatorio para memoria confirmada.', 422);
  }
  const caseKey = stableHash({
    contract_version: OPERATIONAL_MEMORY_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    case_type: type,
    title: caseTitle,
    source_decision_id: sourceDecisionId,
    source_effectiveness_evaluation_id: sourceEffectivenessEvaluationId,
    summary_checksum: checksumText(caseSummary),
  });
  const effectiveIdempotency = cleanText(idempotencyKey, 240)
    || `f6.13-memory:${stableHash({ tenant_id: effectiveTenantId, case_key: caseKey, correlation_id: effectiveCorrelationId, actor_id: actorId })}`;
  const technicalNow = now();
  return {
    tenant_id: effectiveTenantId,
    case_key: caseKey,
    idempotency_key: effectiveIdempotency,
    contract_version: OPERATIONAL_MEMORY_CONTRACT_VERSION,
    lifecycle_status: status,
    case_type: type,
    title: caseTitle,
    summary: caseSummary,
    summary_checksum: checksumText(caseSummary),
    facts: asArray(facts),
    decisions: asArray(decisions),
    outcomes: asArray(outcomes),
    effectiveness_evaluations: asArray(effectivenessEvaluations),
    confirmed_lessons: status === 'confirmed' ? asArray(confirmedLessons) : [],
    ai_hypotheses: asArray(aiHypotheses),
    source_decision_id: sourceDecisionId,
    source_effectiveness_evaluation_id: sourceEffectivenessEvaluationId,
    data_trust: {
      state: trust,
      missing_is_not_zero: true,
      hypothesis_is_not_confirmed_lesson: true,
    },
    confirmed_by: status === 'confirmed' ? actorId : null,
    confirmed_at: status === 'confirmed' ? (confirmedAt || technicalNow) : null,
    confirmation_reason: status === 'confirmed' ? confirmReason : null,
    correlation_id: effectiveCorrelationId,
    provenance: {
      contract_version: OPERATIONAL_MEMORY_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      source_decision_id: sourceDecisionId,
      source_effectiveness_evaluation_id: sourceEffectivenessEvaluationId,
      correlation_id: effectiveCorrelationId,
      actor_user_id: actorId,
      ai_operational_memory_publish_authority: false,
      second_kb_created: false,
      second_retrieval_engine: false,
      llm_direct_sql: false,
    },
    metadata: asObject(metadata),
    created_by: actorId,
  };
}

async function withClient(pool, work) {
  if (pool?.connect) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }
  if (pool?.query) return work(pool);
  throw new OperationalLearningError('OPERATIONAL_LEARNING_DB_REQUIRED', 'Pool PostgreSQL requerido.', 500);
}

function json(value) {
  return JSON.stringify(value ?? null);
}

async function audit(client, { tenantId, actorId, tableName, recordId, action, newData, metadata }) {
  await client.query(
    `INSERT INTO audit_event_log (table_name, record_id, tenant_id, action, changed_by, new_data, metadata)
     VALUES ($1, $2::uuid, $3::uuid, $4, $5::uuid, $6::jsonb, $7::jsonb)`,
    [tableName, recordId, tenantId, action, actorId, json(newData), json(metadata)]
  );
}

async function assertSameTenantRecommendation(client, tenantId, recommendationId) {
  if (!recommendationId) return;
  const result = await client.query(
    'SELECT id FROM iso_operational_suggestions WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
    [tenantId, recommendationId]
  );
  if (!result.rowCount) {
    throw new OperationalLearningError('DECISION_LEDGER_RECOMMENDATION_NOT_FOUND', 'La recomendacion no existe para el tenant autenticado.', 404);
  }
}

async function assertSameTenantDecision(client, tenantId, decisionId) {
  const result = await client.query(
    'SELECT id FROM recommendation_decision_ledger WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
    [tenantId, decisionId]
  );
  if (!result.rowCount) {
    throw new OperationalLearningError('EFFECTIVENESS_DECISION_NOT_FOUND', 'La decision no existe para el tenant autenticado.', 404);
  }
}

function createOperationalLearningService({ pool, now = () => new Date().toISOString() } = {}) {
  async function recordDecision(input = {}) {
    const entry = buildDecisionLedgerEntry({ ...input, now });
    return withClient(pool, async (client) => {
      await assertSameTenantRecommendation(client, entry.tenant_id, entry.recommendation_id);
      const existing = await client.query(
        'SELECT * FROM recommendation_decision_ledger WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [entry.tenant_id, entry.idempotency_key]
      );
      if (existing.rowCount) return { ...existing.rows[0], reused: true };
      const result = await client.query(
        `INSERT INTO recommendation_decision_ledger (
          tenant_id, decision_key, idempotency_key, contract_version, recommendation_id, recommendation_identity,
          recommendation_version, subject_type, subject_id, source_intelligence_context, priority_context,
          decision, decision_status, decision_reason, decision_actor_user_id, decision_at, correlation_id,
          previous_decision_id, human_modification, provenance, metadata
        ) VALUES (
          $1::uuid,$2,$3,$4,$5::uuid,$6::jsonb,$7,$8,$9::uuid,$10::jsonb,$11::jsonb,
          $12,$13,$14,$15::uuid,$16::timestamptz,$17,$18::uuid,$19::jsonb,$20::jsonb,$21::jsonb
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING *`,
        [
          entry.tenant_id, entry.decision_key, entry.idempotency_key, entry.contract_version,
          entry.recommendation_id, json(entry.recommendation_identity), entry.recommendation_version,
          entry.subject_type, entry.subject_id, json(entry.source_intelligence_context), json(entry.priority_context),
          entry.decision, entry.decision_status, entry.decision_reason, entry.decision_actor_user_id,
          entry.decision_at, entry.correlation_id, entry.previous_decision_id, json(entry.human_modification),
          json(entry.provenance), json(entry.metadata),
        ]
      );
      const row = result.rows[0] || (await client.query(
        'SELECT * FROM recommendation_decision_ledger WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [entry.tenant_id, entry.idempotency_key]
      )).rows[0];
      await audit(client, {
        tenantId: entry.tenant_id,
        actorId: entry.decision_actor_user_id,
        tableName: 'recommendation_decision_ledger',
        recordId: row.id,
        action: 'recommendation.decision.recorded',
        newData: { ...entry, id: row.id },
        metadata: { correlation_id: entry.correlation_id, contract_version: entry.contract_version },
      });
      return { ...row, reused: false };
    });
  }

  async function recordEffectivenessEvaluation(input = {}) {
    const evaluation = buildEffectivenessEvaluation({ ...input, now });
    return withClient(pool, async (client) => {
      await assertSameTenantDecision(client, evaluation.tenant_id, evaluation.decision_id);
      const existing = await client.query(
        'SELECT * FROM recommendation_effectiveness_evaluations WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [evaluation.tenant_id, evaluation.idempotency_key]
      );
      if (existing.rowCount) return { ...existing.rows[0], reused: true };
      const result = await client.query(
        `INSERT INTO recommendation_effectiveness_evaluations (
          tenant_id, evaluation_key, idempotency_key, contract_version, decision_id, action_conversion_id,
          action_reference, methodology, expected_outcome, observed_outcome, before_state, after_state,
          effectiveness_result, confidence, data_trust, evaluation_window_start, evaluation_window_end,
          observation_time, evaluated_by, evaluated_at, correlation_id, provenance, metadata
        ) VALUES (
          $1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
          $13,$14,$15::jsonb,$16::timestamptz,$17::timestamptz,$18::timestamptz,$19::uuid,$20::timestamptz,
          $21,$22::jsonb,$23::jsonb
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING *`,
        [
          evaluation.tenant_id, evaluation.evaluation_key, evaluation.idempotency_key, evaluation.contract_version,
          evaluation.decision_id, evaluation.action_conversion_id, json(evaluation.action_reference),
          evaluation.methodology, json(evaluation.expected_outcome), json(evaluation.observed_outcome),
          json(evaluation.before_state), json(evaluation.after_state), evaluation.effectiveness_result,
          evaluation.confidence, json(evaluation.data_trust), evaluation.evaluation_window_start,
          evaluation.evaluation_window_end, evaluation.observation_time, evaluation.evaluated_by,
          evaluation.evaluated_at, evaluation.correlation_id, json(evaluation.provenance), json(evaluation.metadata),
        ]
      );
      const row = result.rows[0] || (await client.query(
        'SELECT * FROM recommendation_effectiveness_evaluations WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [evaluation.tenant_id, evaluation.idempotency_key]
      )).rows[0];
      await audit(client, {
        tenantId: evaluation.tenant_id,
        actorId: evaluation.evaluated_by,
        tableName: 'recommendation_effectiveness_evaluations',
        recordId: row.id,
        action: 'recommendation.effectiveness.evaluated',
        newData: { ...evaluation, id: row.id },
        metadata: { correlation_id: evaluation.correlation_id, contract_version: evaluation.contract_version },
      });
      return { ...row, reused: false };
    });
  }

  async function createMemoryCase(input = {}) {
    const memoryCase = buildOperationalMemoryCase({ ...input, now });
    const links = asArray(input.links).slice(0, DEFAULT_BOUNDS.max_links);
    return withClient(pool, async (client) => {
      const existing = await client.query(
        'SELECT * FROM operational_memory_cases WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [memoryCase.tenant_id, memoryCase.idempotency_key]
      );
      if (existing.rowCount) return { ...existing.rows[0], reused: true };
      const result = await client.query(
        `INSERT INTO operational_memory_cases (
          tenant_id, case_key, idempotency_key, contract_version, lifecycle_status, case_type, title, summary,
          summary_checksum, facts, decisions, outcomes, effectiveness_evaluations, confirmed_lessons, ai_hypotheses,
          source_decision_id, source_effectiveness_evaluation_id, data_trust, confirmed_by, confirmed_at,
          confirmation_reason, correlation_id, provenance, metadata, created_by
        ) VALUES (
          $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
          $16::uuid,$17::uuid,$18::jsonb,$19::uuid,$20::timestamptz,$21,$22,$23::jsonb,$24::jsonb,$25::uuid
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING *`,
        [
          memoryCase.tenant_id, memoryCase.case_key, memoryCase.idempotency_key, memoryCase.contract_version,
          memoryCase.lifecycle_status, memoryCase.case_type, memoryCase.title, memoryCase.summary,
          memoryCase.summary_checksum, json(memoryCase.facts), json(memoryCase.decisions), json(memoryCase.outcomes),
          json(memoryCase.effectiveness_evaluations), json(memoryCase.confirmed_lessons), json(memoryCase.ai_hypotheses),
          memoryCase.source_decision_id, memoryCase.source_effectiveness_evaluation_id, json(memoryCase.data_trust),
          memoryCase.confirmed_by, memoryCase.confirmed_at, memoryCase.confirmation_reason, memoryCase.correlation_id,
          json(memoryCase.provenance), json(memoryCase.metadata), memoryCase.created_by,
        ]
      );
      const row = result.rows[0] || (await client.query(
        'SELECT * FROM operational_memory_cases WHERE tenant_id = $1::uuid AND idempotency_key = $2 LIMIT 1',
        [memoryCase.tenant_id, memoryCase.idempotency_key]
      )).rows[0];
      for (const link of links) {
        await client.query(
          `INSERT INTO operational_memory_case_links (
            tenant_id, case_id, link_type, target_type, target_id, target_key, target_contract_version, provenance
          ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7,$8::jsonb)`,
          [
            memoryCase.tenant_id,
            row.id,
            cleanText(link.link_type || link.type, 60),
            cleanText(link.target_type, 120),
            link.target_id || null,
            cleanText(link.target_key, 240),
            cleanText(link.target_contract_version || link.contract_version, 120),
            json({ ...(asObject(link.provenance)), tenant_id: memoryCase.tenant_id, contract_version: OPERATIONAL_MEMORY_CONTRACT_VERSION }),
          ]
        );
      }
      await audit(client, {
        tenantId: memoryCase.tenant_id,
        actorId: memoryCase.created_by,
        tableName: 'operational_memory_cases',
        recordId: row.id,
        action: memoryCase.lifecycle_status === 'confirmed' ? 'operational_memory.confirmed' : 'operational_memory.created',
        newData: { ...memoryCase, id: row.id, link_count: links.length },
        metadata: { correlation_id: memoryCase.correlation_id, contract_version: memoryCase.contract_version },
      });
      return { ...row, reused: false };
    });
  }

  async function searchMemoryCases({ tenantId, user, query = '', filters = {}, limit = DEFAULT_BOUNDS.max_memory_cases } = {}) {
    const effectiveTenantId = requireTenantId({ tenantId, user });
    const boundedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_BOUNDS.max_memory_cases, 50));
    const params = [effectiveTenantId, boundedLimit];
    const where = ['tenant_id = $1::uuid'];
    if (filters.lifecycle_status) {
      params.splice(1, 0, filters.lifecycle_status);
      where.push(`lifecycle_status = $${params.length - 1}`);
    }
    const textQuery = cleanText(query, 240);
    if (textQuery) {
      params.splice(params.length - 1, 0, `%${textQuery}%`);
      where.push(`(title ILIKE $${params.length - 1} OR summary ILIKE $${params.length - 1})`);
    }
    const result = await pool.query(
      `SELECT * FROM operational_memory_cases
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return {
      ok: true,
      contract_version: OPERATIONAL_MEMORY_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      retrieval_strategy: 'tenant_scoped_structured_query_v1',
      second_kb_created: false,
      second_retrieval_engine: false,
      cases: result.rows,
    };
  }

  return {
    contracts: {
      decisionLedger: RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
      effectivenessFeedback: EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
      operationalMemory: OPERATIONAL_MEMORY_CONTRACT_VERSION,
    },
    recordDecision,
    recordEffectivenessEvaluation,
    createMemoryCase,
    searchMemoryCases,
  };
}

module.exports = {
  RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
  EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
  OPERATIONAL_MEMORY_CONTRACT_VERSION,
  DEFAULT_BOUNDS,
  OperationalLearningError,
  buildDecisionLedgerEntry,
  buildEffectivenessEvaluation,
  buildOperationalMemoryCase,
  evaluateBeforeAfter,
  createOperationalLearningService,
  stableHash: crossGrcStableHash || stableHash,
};
