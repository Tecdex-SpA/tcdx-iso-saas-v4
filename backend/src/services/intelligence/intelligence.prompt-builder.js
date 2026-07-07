const {
  sanitizePromptContext,
  validateNoFullKnowledgeBase,
  validateNoLongLicensedText,
  validateNoSecrets,
} = require('./intelligence.guardrails');

const DEFAULT_KNOWLEDGE_LIMIT = 30;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function activeStandardsFrom(context = {}) {
  const explicit = asArray(context.tenant_standards);
  const tenant = asArray(context.tenant?.active_standards);
  const covered = asArray(context.knowledge_context?.standards_covered);
  return [...explicit, ...tenant, ...covered]
    .map((item) => (typeof item === 'string' ? item : item?.standard_code || item?.standard || item?.code))
    .map(text)
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 20);
}

function compactFinding(finding = {}) {
  return {
    rule_key: finding.rule_key || finding.type || null,
    title: text(finding.title || finding.message || finding.description).slice(0, 240),
    severity: finding.severity || null,
    entity_type: finding.entity_type || finding.source_type || null,
    entity_id: finding.entity_id || finding.source_id || null,
    standard_code: finding.standard_code || finding.standard || null,
    domain: finding.domain || finding.category || null,
    confirmed_data: asArray(finding.confirmed_data).slice(0, 4),
    rule_inference: finding.rule_inference || finding.explanation || null,
    knowledge_basis: asArray(finding.knowledge_basis).slice(0, 5),
  };
}

function compactAction(action = {}) {
  return {
    title: text(action.title || action.action || action.recommended_action).slice(0, 180),
    priority: action.priority || action.urgency || null,
    target_module: action.target_module || action.module || null,
    action_basis: text(action.action_basis || action.basis).slice(0, 280),
    related_entity: action.related_entity || action.entity || null,
    knowledge_basis: asArray(action.knowledge_basis).slice(0, 5),
  };
}

function compactKnowledgeItem(item = {}) {
  return {
    item_key: item.item_key || item.record_id || item.source_record_id || null,
    source_record_id: item.source_record_id || item.record_id || null,
    standard_family: item.standard_family || item.norma_key || null,
    standard_code: item.standard_code || item.norma || null,
    clause_or_control: item.clause_or_control || item.control_ref || null,
    domain: item.domain || item.category || null,
    item_type: item.item_type || null,
    title: text(item.title || item.titulo).slice(0, 180),
    intent_summary: text(item.intent_summary || item.summary || item.descripcion_resumen).slice(0, 320),
    severity_default: item.severity_default || null,
    license_class: item.license_class || 'derived_summary',
  };
}

function scoreKnowledgeItem(item, { standards, findings, question }) {
  const searchable = [
    item.standard_code,
    item.standard_family,
    item.clause_or_control,
    item.domain,
    item.item_type,
    item.title,
    item.intent_summary,
  ].map(text).join(' ').toLowerCase();
  let score = 0;
  for (const standard of standards) {
    const normalized = text(standard).toLowerCase();
    if (normalized && searchable.includes(normalized.split('+')[0].trim())) score += 20;
  }
  for (const finding of findings) {
    if (finding.severity === 'critica' || finding.severity === 'critical' || finding.severity === 'alta') score += 5;
    [finding.standard_code, finding.domain, finding.rule_key, finding.title]
      .map(text)
      .filter((part) => part.length >= 4)
      .forEach((part) => {
        if (searchable.includes(part.toLowerCase().slice(0, 40))) score += 10;
      });
  }
  text(question).toLowerCase().split(/\s+/).filter((word) => word.length >= 5).slice(0, 12).forEach((word) => {
    if (searchable.includes(word)) score += 4;
  });
  return score;
}

function collectKnowledgeCandidates(context = {}) {
  const fromContext = asArray(context.knowledge_context?.knowledge_items_used);
  const fromFindings = asArray(context.findings).flatMap((finding) => asArray(finding.knowledge_basis));
  const fromActions = asArray(context.next_best_actions).flatMap((action) => asArray(action.knowledge_basis));
  const byKey = new Map();
  [...fromContext, ...fromFindings, ...fromActions]
    .map(compactKnowledgeItem)
    .filter((item) => item.item_key || item.standard_code || item.domain)
    .forEach((item) => {
      const key = item.item_key || `${item.standard_code}:${item.clause_or_control}:${item.domain}`;
      if (!byKey.has(key)) byKey.set(key, item);
    });
  return Array.from(byKey.values());
}

function selectRelevantKnowledgeItems(context = {}, { question = '', limit = DEFAULT_KNOWLEDGE_LIMIT } = {}) {
  const standards = activeStandardsFrom(context);
  const findings = asArray(context.findings).map(compactFinding);
  const max = Math.max(1, Math.min(Number(limit || DEFAULT_KNOWLEDGE_LIMIT), 40));
  return collectKnowledgeCandidates(context)
    .map((item) => ({
      item,
      score: scoreKnowledgeItem(item, { standards, findings, question }),
    }))
    .sort((a, b) => b.score - a.score || text(a.item.item_key).localeCompare(text(b.item.item_key)))
    .slice(0, max)
    .map(({ item }) => item);
}

function buildEvidenceBasis(context = {}) {
  const sourceTrace = asArray(context.source_trace).slice(0, 12);
  const dataQuality = context.data_quality || {};
  return {
    source_trace: sourceTrace.map((item) => ({
      source: item.source || 'internal_db',
      reference: item.reference || null,
      used_for: item.used_for || null,
    })),
    data_quality_confidence: dataQuality.confidence || context.confidence?.level || null,
    entity_counts: dataQuality.entity_counts || {},
  };
}

function buildPromptContext(context = {}, { narrativeType = 'executive', question = '', knowledgeLimit = DEFAULT_KNOWLEDGE_LIMIT } = {}) {
  const knowledgeItems = selectRelevantKnowledgeItems(context, { question, limit: knowledgeLimit });
  const promptContext = {
    task: {
      narrative_type: narrativeType,
      question: text(question).slice(0, 600),
      instruction: 'Sintetizar con prudencia. No usar IA como fuente primaria. Distinguir dato confirmado, inferencia de regla, inferencia IA, recomendacion y limitacion.',
    },
    tenant_summary: {
      tenant_id: context.tenant_id || context.tenant?.tenant_id || null,
      name: context.tenant?.name || context.tenant_name || null,
      active_standards: activeStandardsFrom(context),
      generated_at: context.generated_at || null,
    },
    scores: context.scoring || {
      audit_readiness: context.audit_readiness?.score,
      overall: context.overall?.score,
    },
    findings: asArray(context.findings).slice(0, 12).map(compactFinding),
    metric_explanations: asArray(context.metric_explanations).slice(0, 8),
    next_best_actions: asArray(context.next_best_actions).slice(0, 10).map(compactAction),
    data_quality_warnings: asArray(context.data_quality?.warnings || context.limitations).slice(0, 12),
    knowledge_context: knowledgeItems,
    evidence_basis: buildEvidenceBasis(context),
    output_contract: {
      executive_summary: 'string',
      technical_summary: 'string',
      audit_summary: 'string',
      assumptions: [],
      limitations: [],
      recommendations: [],
      knowledge_basis: [],
      confidence: 'alta|media|baja',
      should_escalate_to_human: false,
    },
    metadata: {
      knowledge_items_count: knowledgeItems.length,
      knowledge_limit: Math.max(1, Math.min(Number(knowledgeLimit || DEFAULT_KNOWLEDGE_LIMIT), 40)),
      full_knowledge_base_included: false,
      tenant_documents_included: false,
    },
  };

  const sanitized = sanitizePromptContext(promptContext);
  validateNoFullKnowledgeBase(sanitized);
  validateNoSecrets(sanitized);
  validateNoLongLicensedText(sanitized);
  return sanitized;
}

function buildReducedIntelligenceBriefForAiCompliance(intelligenceBrief = {}, { question = '', knowledgeLimit = 20 } = {}) {
  const promptContext = buildPromptContext(intelligenceBrief, {
    narrativeType: 'ia_compliance_context',
    question,
    knowledgeLimit,
  });
  return {
    tenant_summary: promptContext.tenant_summary,
    scores: promptContext.scores,
    findings: promptContext.findings.slice(0, 8),
    next_best_actions: promptContext.next_best_actions.slice(0, 8),
    knowledge_context: promptContext.knowledge_context.slice(0, Math.min(knowledgeLimit, 20)),
    data_quality_warnings: promptContext.data_quality_warnings,
    evidence_basis: promptContext.evidence_basis,
    metadata: {
      ...promptContext.metadata,
      reduced_for: 'ia_compliance',
      knowledge_items_count: Math.min(promptContext.metadata.knowledge_items_count, 20),
    },
  };
}

function buildAiMessages(promptContext = {}) {
  return [
    {
      role: 'system',
      content: [
        'Eres una capa de sintesis GRC/ISO multi-tenant.',
        'No eres fuente primaria de verdad.',
        'No prometas certificacion ni auditoria automatica.',
        'Devuelve solo JSON valido con el contrato solicitado.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(promptContext),
    },
  ];
}

module.exports = {
  buildAiMessages,
  buildPromptContext,
  buildReducedIntelligenceBriefForAiCompliance,
  selectRelevantKnowledgeItems,
};
