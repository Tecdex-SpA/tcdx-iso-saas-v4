const repository = require('./intelligence.repository');
const { normalizeTenantDataset } = require('./intelligence.normalizer');
const {
  CONFIDENCE_LEVELS,
  INTELLIGENCE_BRIEF_VERSION,
} = require('./intelligence.types');
const {
  buildKnowledgeContextForTenantDataset,
} = require('../knowledge-base/knowledge.service');

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
  const knowledgeContext = await buildKnowledgeContextForTenantDataset(normalizedDataset);
  return {
    ...normalizedDataset,
    knowledge_context: knowledgeContext,
  };
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

async function buildTenantIntelligenceBrief({ tenantId, user, locale = 'es' }) {
  const rawDataset = await getTenantIntelligenceDataset({ tenantId, user });
  const normalizedDataset = normalizeTenantDataset(rawDataset);
  const enriched = await enrichDatasetWithKnowledge(normalizedDataset);
  const dataQuality = buildDataQualityProfile(normalizedDataset);
  const narrative = buildFallbackNarrative(normalizedDataset);

  return {
    ok: true,
    version: INTELLIGENCE_BRIEF_VERSION,
    tenant_id: tenantId,
    locale,
    generated_at: new Date().toISOString(),
    confidence: dataQuality.confidence,
    data_quality: dataQuality,
    knowledge_context: enriched.knowledge_context,
    brief: {
      confirmed_data: narrative.confirmed_data,
      rule_inferences: narrative.rule_inferences,
      ai_inferences: narrative.ai_inferences,
      recommendations: narrative.recommendations,
      limitations: narrative.limitations,
    },
    source_trace: normalizedDataset.source_trace,
  };
}

module.exports = {
  buildDataQualityProfile,
  buildFallbackNarrative,
  buildTenantIntelligenceBrief,
  enrichDatasetWithKnowledge,
  getTenantIntelligenceDataset,
  normalizeTenantDataset,
};
