const repository = require('./intelligence.repository');
const { normalizeTenantDataset } = require('./intelligence.normalizer');
const {
  CONFIDENCE_LEVELS,
  INTELLIGENCE_BRIEF_VERSION,
} = require('./intelligence.types');
const {
  buildKnowledgeContextForTenantDataset,
  getAuditQuestions,
  getCommonGaps,
  getEvidenceExpectations,
  getKnowledgeRules,
  getRecommendedActions,
  getRuleHints,
  matchKnowledgeToTenantEntity,
} = require('../knowledge-base/knowledge.service');
const { buildNextBestActions } = require('./intelligence.actions');
const { buildConfidenceProfile } = require('./intelligence.confidence');
const { calculateEvidenceStrength } = require('./intelligence.evidence-strength');
const { explainCoreMetrics } = require('./intelligence.explainability');
const { runRules } = require('./intelligence.rules');
const { generateNarratives } = require('./intelligence.ai-orchestrator');
const crossGrcIntelligence = require('./crossGrcIntelligence.service');
const scoring = require('./intelligence.scoring');

const INTELLIGENCE_CACHE_TTL_MS = Math.max(60000, Number(process.env.INTELLIGENCE_BRIEF_CACHE_TTL_MS || 5 * 60 * 1000));
const INTELLIGENCE_CACHE_MAX_ENTRIES = Math.max(10, Number(process.env.INTELLIGENCE_BRIEF_CACHE_MAX_ENTRIES || 250));
const briefCache = new Map();
const aiNarrativeRefreshes = new Map();

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function cacheKey({ tenantId, locale, enableAiNarrative }) {
  return `${tenantId}:${locale || 'es'}:${enableAiNarrative === false ? 'no-ai' : 'ai'}`;
}

function getCachedBrief(key) {
  const entry = briefCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    briefCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedBrief(key, value) {
  if (briefCache.size >= INTELLIGENCE_CACHE_MAX_ENTRIES) {
    const firstKey = briefCache.keys().next().value;
    if (firstKey) briefCache.delete(firstKey);
  }
  briefCache.set(key, {
    expiresAt: Date.now() + INTELLIGENCE_CACHE_TTL_MS,
    value,
  });
}

function clearIntelligenceBriefCache() {
  briefCache.clear();
}

function cloneBrief(value) {
  return JSON.parse(JSON.stringify(value));
}

function logIntelligenceEvent(event) {
  try {
    console.log('INTELLIGENCE_BRIEF_EVENT', JSON.stringify(event));
  } catch (error) {
    console.log('INTELLIGENCE_BRIEF_EVENT', JSON.stringify({
      error_code: 'INTELLIGENCE_EVENT_SERIALIZATION_FAILED',
    }));
  }
}

function finalizeBriefResponse(response, {
  key,
  startedAt,
  requestId,
  user,
  tenantId,
  bypassCache = false,
  cacheStatus = 'miss',
  shouldCache = true,
} = {}) {
  const latencyMs = Date.now() - startedAt;
  const metadata = {
    ...(response.metadata || {}),
    request_id: requestId,
    intelligence_version: response.version,
    latency_ms: latencyMs,
    cache_status: cacheStatus,
  };

  if (typeof metadata.fallback_used !== 'boolean') {
    metadata.fallback_used = metadata.ai_used === false && Boolean(metadata.fallback_reason);
  }

  const finalized = {
    ...response,
    metadata,
  };

  if (shouldCache && !bypassCache && key) {
    setCachedBrief(key, cloneBrief(finalized));
  }

  logIntelligenceEvent({
    request_id: requestId,
    tenant_id: tenantId,
    user_id: getUserId(user),
    intelligence_version: finalized.version,
    knowledge_seed_version: finalized.knowledge_context?.seed_version || metadata.knowledge_seed_version || null,
    rules_version: metadata.rules_version || null,
    ai_used: metadata.ai_used === true,
    fallback_used: metadata.fallback_used === true,
    latency_ms: latencyMs,
    cache_status: cacheStatus,
    confidence: finalized.confidence?.level || finalized.confidence || null,
    knowledge_coverage_score: finalized.knowledge_context?.coverage_score ?? null,
    error_code: null,
  });

  return finalized;
}

function buildAiPendingBrief(baseBrief) {
  return {
    ...baseBrief,
    metadata: {
      ...baseBrief.metadata,
      ai_used: false,
      fallback_used: false,
      fallback_reason: null,
      ai_status: 'pending',
      ai_pending: true,
    },
  };
}

function mergeAiNarratives(baseBrief, narratives, aiStartedAt) {
  const aiStructured = narratives.structured || {};
  const fallbackUsed = aiStructured.fallback === true;
  return {
    ...baseBrief,
    narratives,
    knowledge_basis: aiStructured.knowledge_basis || baseBrief.knowledge_context?.knowledge_items_used || [],
    metadata: {
      ...baseBrief.metadata,
      ai_used: fallbackUsed ? false : true,
      fallback_used: fallbackUsed,
      fallback_reason: fallbackUsed ? aiStructured.fallback_reason || 'AI_FALLBACK' : null,
      ai_confidence: aiStructured.confidence || null,
      ai_should_escalate_to_human: aiStructured.should_escalate_to_human === true,
      ai_status: fallbackUsed ? 'fallback' : 'ready',
      ai_pending: false,
      ai_latency_ms: Date.now() - aiStartedAt,
      knowledge_items_count: Array.isArray(aiStructured.knowledge_basis)
        ? aiStructured.knowledge_basis.length
        : Array.isArray(baseBrief.knowledge_context?.knowledge_items_used)
          ? baseBrief.knowledge_context.knowledge_items_used.length
          : 0,
    },
    brief: {
      ...baseBrief.brief,
      ai_inferences: fallbackUsed
        ? []
        : [
            aiStructured.executive_summary,
            aiStructured.technical_summary,
            aiStructured.audit_summary,
          ].filter(Boolean),
      recommendations: Array.isArray(aiStructured.recommendations) && aiStructured.recommendations.length
        ? aiStructured.recommendations
        : baseBrief.brief.recommendations,
      limitations: Array.from(new Set([
        ...baseBrief.brief.limitations,
        ...(Array.isArray(aiStructured.limitations) ? aiStructured.limitations : []),
      ])),
    },
  };
}

async function buildAiNarrativeRefresh({ key, baseBrief, user, requestId, tenantId }) {
  const aiStartedAt = Date.now();
  const narratives = await generateNarratives(baseBrief, {
    narrativeType: 'intelligence_brief',
    user,
    requestId,
  });
  const finalBrief = mergeAiNarratives(baseBrief, narratives, aiStartedAt);
  if (key) {
    setCachedBrief(key, cloneBrief(finalBrief));
  }
  logIntelligenceEvent({
    request_id: requestId,
    tenant_id: tenantId,
    user_id: getUserId(user),
    intelligence_version: finalBrief.version,
    knowledge_seed_version: finalBrief.knowledge_context?.seed_version || finalBrief.metadata?.knowledge_seed_version || null,
    rules_version: finalBrief.metadata?.rules_version || null,
    ai_used: finalBrief.metadata?.ai_used === true,
    fallback_used: finalBrief.metadata?.fallback_used === true,
    latency_ms: finalBrief.metadata?.ai_latency_ms || 0,
    cache_status: 'background_refresh',
    confidence: finalBrief.confidence?.level || finalBrief.confidence || null,
    knowledge_coverage_score: finalBrief.knowledge_context?.coverage_score ?? null,
    error_code: finalBrief.metadata?.fallback_reason || null,
  });
  return finalBrief;
}

function startAiNarrativeRefresh({ key, baseBrief, user, requestId, tenantId }) {
  if (!key || aiNarrativeRefreshes.has(key)) return aiNarrativeRefreshes.get(key) || null;
  const task = buildAiNarrativeRefresh({ key, baseBrief: cloneBrief(baseBrief), user, requestId, tenantId })
    .catch((error) => {
      const fallbackReason = error?.code || error?.name || 'AI_BACKGROUND_REFRESH_FAILED';
      setCachedBrief(key, cloneBrief({
        ...baseBrief,
        metadata: {
          ...baseBrief.metadata,
          ai_used: false,
          fallback_used: true,
          fallback_reason: fallbackReason,
          ai_status: 'fallback',
          ai_pending: false,
        },
      }));
      logIntelligenceEvent({
        request_id: requestId,
        tenant_id: tenantId,
        user_id: getUserId(user),
        intelligence_version: baseBrief.version,
        knowledge_seed_version: baseBrief.knowledge_context?.seed_version || baseBrief.metadata?.knowledge_seed_version || null,
        rules_version: baseBrief.metadata?.rules_version || null,
        ai_used: false,
        fallback_used: true,
        latency_ms: 0,
        cache_status: 'background_refresh',
        confidence: baseBrief.confidence?.level || baseBrief.confidence || null,
        knowledge_coverage_score: baseBrief.knowledge_context?.coverage_score ?? null,
        error_code: fallbackReason,
      });
      return null;
    })
    .finally(() => {
      aiNarrativeRefreshes.delete(key);
    });
  aiNarrativeRefreshes.set(key, task);
  return task;
}


function countRows(dataset, field) {
  const value = dataset?.[field];
  return Array.isArray(value) ? value.length : 0;
}

function buildDataQualityProfile(dataset = {}) {
  const sourceCount = Array.isArray(dataset.source_trace) ? dataset.source_trace.length : 0;
  const limitationCount = Array.isArray(dataset.limitations) ? dataset.limitations.length : 0;
  const entityCounts = {
    standards: countRows(dataset, 'tenant_standards'),
    controls: countRows(dataset, 'priority_controls'),
    evidences: countRows(dataset, 'recent_evidences'),
    risks: countRows(dataset, 'risks'),
    findings: countRows(dataset, 'recent_findings'),
    action_plans: countRows(dataset, 'recent_action_plans'),
    kpis: countRows(dataset, 'kpis'),
    health_signals: countRows(dataset, 'effective_health_summary'),
  };
  const populated = Object.values(entityCounts).filter((count) => count > 0).length;
  const confidence = populated >= 5 && limitationCount <= 3
    ? CONFIDENCE_LEVELS.HIGH
    : populated >= 2
      ? CONFIDENCE_LEVELS.MEDIUM
      : CONFIDENCE_LEVELS.LOW;

  return {
    confidence,
    source_count: sourceCount,
    limitation_count: limitationCount,
    entity_counts: entityCounts,
    warnings: dataset.limitations || [],
  };
}

async function enrichDatasetWithKnowledge(normalizedDataset = {}) {
  const entityGroups = [
    ['priority_controls', 'control'],
    ['controls', 'control'],
    ['soa_items', 'soa_item'],
    ['recent_evidences', 'evidence'],
    ['evidences', 'evidence'],
    ['risks', 'risk'],
    ['recent_findings', 'audit_finding'],
    ['findings', 'audit_finding'],
    ['recent_action_plans', 'action_plan'],
    ['action_plans', 'action_plan'],
  ];
  const enriched = { ...normalizedDataset };

  for (const [field, entityType] of entityGroups) {
    if (!Array.isArray(normalizedDataset[field])) continue;
    enriched[field] = await Promise.all(normalizedDataset[field].map((entity) => enrichEntityWithKnowledge(entity, entityType)));
  }

  const knowledgeContext = await buildKnowledgeContextForTenantDataset(enriched);
  return {
    ...enriched,
    knowledge_context: knowledgeContext,
  };
}

function entityFilters(entity = {}, entityType) {
  return {
    entityType,
    standardFamily: entity.standard_family || entity.standardFamily || entity.standard_code || entity.norma_tipo,
    standardCode: entity.standard_code || entity.standardCode || entity.norma_tipo,
    clauseOrControl: entity.control_code || entity.clause_or_control || entity.clause_code,
    domain: entity.domain || entity.control_domain || entity.process_name || entity.kpi_category || entity.category,
    title: entity.title || entity.name || entity.control_title || entity.finding_title || entity.description || entity.risk_name,
    tags: [entity.status, entity.severity, entity.effective_health_status, entity.health_status].filter(Boolean),
    severity: entity.severity,
  };
}

function compactChildRows(rows = [], limit = 5) {
  return Array.isArray(rows) ? rows.slice(0, limit) : [];
}

async function enrichEntityWithKnowledge(entity = {}, entityType) {
  const filters = entityFilters(entity, entityType);
  const matchResult = await matchKnowledgeToTenantEntity(filters);
  const itemKeys = matchResult.matches.map((item) => item.item_key);
  const childFilter = {
    standard_family: filters.standardFamily,
    standard_code: filters.standardCode,
    clause_or_control: filters.clauseOrControl,
    domain: filters.domain,
    q: filters.title,
    limit: 12,
  };
  const [expectedEvidence, auditQuestions, commonGaps, recommendedActions, ruleHints, explicitRules] = await Promise.all([
    getEvidenceExpectations(childFilter).catch(() => []),
    getAuditQuestions(childFilter).catch(() => []),
    getCommonGaps(childFilter).catch(() => []),
    getRecommendedActions(childFilter).catch(() => []),
    getRuleHints(childFilter).catch(() => []),
    getKnowledgeRules(childFilter).catch(() => []),
  ]);

  const byMatchedItem = (row) => itemKeys.length === 0 || itemKeys.includes(row.item_key);
  const enriched = {
    ...entity,
    knowledge_matches: matchResult.matches,
    expected_evidence: compactChildRows(expectedEvidence.filter(byMatchedItem)),
    audit_questions: compactChildRows(auditQuestions.filter(byMatchedItem)),
    common_gaps: compactChildRows(commonGaps.filter(byMatchedItem)),
    recommended_actions: compactChildRows(recommendedActions.filter(byMatchedItem)),
    rule_hints: compactChildRows(ruleHints.filter(byMatchedItem)),
    explicit_rules: compactChildRows(explicitRules.filter(byMatchedItem)),
    knowledge_coverage: {
      coverage_score: matchResult.coverage_score,
      missing_coverage: matchResult.missing_coverage,
      license_warnings: matchResult.license_warnings,
    },
  };

  if (entityType === 'evidence') {
    enriched.evidence_strength = calculateEvidenceStrength(enriched);
  }

  return enriched;
}

function buildFallbackNarrative(normalizedDataset = {}) {
  const tenantName = normalizedDataset.tenant?.name || 'el tenant';
  const controls = countRows(normalizedDataset, 'priority_controls');
  const findings = countRows(normalizedDataset, 'recent_findings');
  const actions = countRows(normalizedDataset, 'recent_action_plans');
  const standards = countRows(normalizedDataset, 'tenant_standards');

  if (controls === 0 && findings === 0 && actions === 0) {
    return {
      confirmed_data: [
        `Se consulto el contexto operacional de ${tenantName}.`,
        `Normas activas detectadas: ${standards}.`,
      ],
      rule_inferences: [],
      ai_inferences: [],
      recommendations: [{
        title: 'Completar datos operacionales antes de usar conclusiones avanzadas',
        action_basis: 'Datos confirmados insuficientes en controles, evidencias, riesgos, hallazgos y acciones.',
      }],
      limitations: normalizedDataset.limitations || [],
    };
  }

  return {
    confirmed_data: [
      `Se consultaron ${controls} controles/senales de salud priorizadas.`,
      `Se consultaron ${findings} hallazgos recientes y ${actions} planes de accion recientes.`,
    ],
    rule_inferences: [
      'La prioridad inicial se basa en datos confirmados, cobertura de conocimiento y senales de calidad de datos.',
    ],
    ai_inferences: [],
    recommendations: [{
      title: 'Priorizar entidades con baja salud, hallazgos abiertos o acciones vencidas',
      action_basis: 'Regla inicial Intelligence Layer: combinar health ISO, hallazgos, acciones y knowledge_basis disponible.',
    }],
    limitations: normalizedDataset.limitations || [],
  };
}

async function getTenantIntelligenceDataset({ tenantId, user }) {
  if (!tenantId) {
    const error = new Error('tenantId es obligatorio');
    error.status = 400;
    error.code = 'TENANT_REQUIRED';
    throw error;
  }
  const rawDataset = await repository.getTenantIntelligenceDataset({ tenantId, user });
  return rawDataset;
}

async function buildTenantIntelligenceBrief({
  tenantId,
  user,
  locale = 'es',
  enableAiNarrative = true,
  requestId = null,
  bypassCache = false,
} = {}) {
  const startedAt = Date.now();
  const key = cacheKey({ tenantId, locale, enableAiNarrative });

  if (!bypassCache) {
    const cached = getCachedBrief(key);
    if (cached) {
      const response = cloneBrief(cached);
      return finalizeBriefResponse(response, {
        key,
        startedAt,
        requestId,
        user,
        tenantId,
        bypassCache,
        cacheStatus: 'hit',
        shouldCache: false,
      });
    }
  }

  const rawDataset = await getTenantIntelligenceDataset({ tenantId, user });
  const normalizedDataset = normalizeTenantDataset(rawDataset);
  const enriched = await enrichDatasetWithKnowledge(normalizedDataset);
  const knowledgeContext = enriched.knowledge_context;
  const preliminaryScores = {
    audit_readiness: scoring.calculateAuditReadinessScore(enriched, [], knowledgeContext),
    data_quality: scoring.calculateDataQualityScore(enriched),
  };
  const findings = runRules(enriched, knowledgeContext, preliminaryScores);
  const scores = {
    audit_readiness: scoring.calculateAuditReadinessScore(enriched, findings, knowledgeContext),
    overall: scoring.calculateOverallIntelligenceScore(enriched, findings, knowledgeContext),
    evidence_maturity: scoring.calculateEvidenceMaturityScore(enriched),
    risk_pressure: scoring.calculateRiskPressureScore(enriched),
    action_execution: scoring.calculateActionExecutionScore(enriched),
    data_quality: scoring.calculateDataQualityScore(enriched),
    knowledge_coverage: scoring.calculateKnowledgeCoverageScore(enriched, knowledgeContext),
  };
  const confidenceProfile = buildConfidenceProfile(enriched, findings, knowledgeContext);
  scores.confidence = confidenceProfile.score;
  const dataQuality = {
    ...buildDataQualityProfile(enriched),
    score: scores.data_quality,
    warnings: [...(enriched.limitations || []), ...confidenceProfile.warnings],
  };
  const metricExplanations = explainCoreMetrics(enriched, findings, knowledgeContext);
  const nextBestActions = buildNextBestActions(enriched, findings);
  const narrative = buildFallbackNarrative(enriched);

  const baseBrief = {
    ok: true,
    version: INTELLIGENCE_BRIEF_VERSION,
    tenant_id: tenantId,
    tenant: {
      tenant_id: tenantId,
      name: enriched.tenant?.name || null,
      active_standards: enriched.tenant_standards,
    },
    tenant_standards: enriched.tenant_standards,
    locale,
    generated_at: new Date().toISOString(),
    confidence: confidenceProfile,
    data_quality: dataQuality,
    knowledge_context: knowledgeContext,
    findings,
    main_risks: findings.filter((finding) => finding.type === 'risk' || finding.severity === 'critica').slice(0, 10),
    metric_explanations: metricExplanations,
    next_best_actions: nextBestActions,
    audit_readiness: {
      score: scores.audit_readiness,
      state: scores.audit_readiness >= 75 ? 'alta' : scores.audit_readiness >= 45 ? 'media' : 'baja',
      explanation: metricExplanations.find((item) => item.metric === 'audit_readiness') || null,
    },
    overall: {
      score: scores.overall,
      state: scores.overall >= 75 ? 'alta' : scores.overall >= 45 ? 'media' : 'baja',
    },
    scoring: scores,
    metadata: {
      request_id: requestId,
      rules_version: 'intelligence_rules_v1',
      scoring_version: 'intelligence_scoring_v1',
      knowledge_seed_version: knowledgeContext.seed_version,
      intelligence_version: INTELLIGENCE_BRIEF_VERSION,
      ai_used: false,
      fallback_used: false,
      fallback_reason: enableAiNarrative ? null : 'ai_narrative_disabled_by_caller',
      ai_status: enableAiNarrative ? 'pending' : 'disabled',
      ai_pending: enableAiNarrative,
      latency_ms: Date.now() - startedAt,
      cache_status: bypassCache ? 'bypass' : 'miss',
    },
    brief: {
      confirmed_data: narrative.confirmed_data,
      rule_inferences: narrative.rule_inferences,
      ai_inferences: narrative.ai_inferences,
      recommendations: narrative.recommendations,
      limitations: narrative.limitations,
    },
    source_trace: normalizedDataset.source_trace,
  };

  if (!enableAiNarrative) {
    return finalizeBriefResponse(baseBrief, {
      key,
      startedAt,
      requestId,
      user,
      tenantId,
      bypassCache,
      cacheStatus: bypassCache ? 'bypass' : 'miss',
    });
  }

  const pendingBrief = buildAiPendingBrief(baseBrief);
  const response = finalizeBriefResponse(pendingBrief, {
    key,
    startedAt,
    requestId,
    user,
    tenantId,
    bypassCache,
    cacheStatus: bypassCache ? 'bypass' : 'miss',
  });
  startAiNarrativeRefresh({ key, baseBrief, user, requestId, tenantId });
  return response;
}

function pendingAiNarrativeCount() {
  return aiNarrativeRefreshes.size;
}

module.exports = {
  buildDataQualityProfile,
  buildFallbackNarrative,
  buildTenantIntelligenceBrief,
  crossGrcIntelligence,
  enrichDatasetWithKnowledge,
  getTenantIntelligenceDataset,
  normalizeTenantDataset,
  _clearIntelligenceBriefCache: clearIntelligenceBriefCache,
  _pendingAiNarrativeCount: pendingAiNarrativeCount,
};
