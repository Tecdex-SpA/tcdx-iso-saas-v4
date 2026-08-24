'use strict';

const crypto = require('crypto');
const repository = require('./intelligence.repository');
const { normalizeTenantDataset } = require('./intelligence.normalizer');

const CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION = 'canonical-intelligence-context-v1';
const PATTERN_TREND_CONTRACT_VERSION = 'pattern-trend-engine-v1';
const ANOMALY_ENGINE_CONTRACT_VERSION = 'anomaly-engine-v1';
const CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION = 'cross-grc-intelligence-orchestrator-v1';

const DEFAULT_BOUNDS = Object.freeze({
  max_context_items: 120,
  max_facts: 60,
  max_derived_signals: 30,
  max_retrieved_knowledge: 12,
  max_regulatory_items: 20,
  max_historical_points_per_series: 24,
  max_graph_nodes: 25,
  max_graph_edges: 50,
  max_retrieval_candidates: 8,
  max_patterns: 12,
  max_trends: 12,
  max_anomalies: 12,
  max_analysis_window_days: 365,
  llm_context_char_limit: 6000,
});

const MIN_TREND_POINTS = 3;
const MIN_ANOMALY_BASELINE_POINTS = 5;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function text(value, max = 500) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function resolveBounds(options = {}) {
  const raw = asObject(options.bounds || options);
  return {
    max_context_items: clampInt(raw.max_context_items, DEFAULT_BOUNDS.max_context_items, 1, 250),
    max_facts: clampInt(raw.max_facts, DEFAULT_BOUNDS.max_facts, 1, 120),
    max_derived_signals: clampInt(raw.max_derived_signals, DEFAULT_BOUNDS.max_derived_signals, 0, 80),
    max_retrieved_knowledge: clampInt(raw.max_retrieved_knowledge, DEFAULT_BOUNDS.max_retrieved_knowledge, 0, 30),
    max_regulatory_items: clampInt(raw.max_regulatory_items, DEFAULT_BOUNDS.max_regulatory_items, 0, 50),
    max_historical_points_per_series: clampInt(raw.max_historical_points_per_series, DEFAULT_BOUNDS.max_historical_points_per_series, 1, 60),
    max_graph_nodes: clampInt(raw.max_graph_nodes, DEFAULT_BOUNDS.max_graph_nodes, 1, 100),
    max_graph_edges: clampInt(raw.max_graph_edges, DEFAULT_BOUNDS.max_graph_edges, 1, 200),
    max_retrieval_candidates: clampInt(raw.max_retrieval_candidates, DEFAULT_BOUNDS.max_retrieval_candidates, 1, 12),
    max_patterns: clampInt(raw.max_patterns, DEFAULT_BOUNDS.max_patterns, 0, 40),
    max_trends: clampInt(raw.max_trends, DEFAULT_BOUNDS.max_trends, 0, 40),
    max_anomalies: clampInt(raw.max_anomalies, DEFAULT_BOUNDS.max_anomalies, 0, 40),
    max_analysis_window_days: clampInt(raw.max_analysis_window_days, DEFAULT_BOUNDS.max_analysis_window_days, 1, 1095),
    llm_context_char_limit: clampInt(raw.llm_context_char_limit, DEFAULT_BOUNDS.llm_context_char_limit, 1000, 12000),
  };
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function requireTenantId({ tenantId, user } = {}) {
  const resolved = tenantId || tenantIdFromUser(user);
  if (!resolved) {
    const error = new Error('Tenant requerido para construir inteligencia Cross-GRC.');
    error.code = 'CROSS_GRC_TENANT_REQUIRED';
    error.status = 400;
    throw error;
  }
  return resolved;
}

function sameTenant(row = {}, tenantId) {
  return !row.tenant_id || String(row.tenant_id) === String(tenantId);
}

function normalizeTrust(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  if (['TRUSTED', 'TRUSTED_WITH_WARNINGS', 'LOW_CONFIDENCE', 'INSUFFICIENT_DATA', 'SOURCE_INCOMPATIBLE', 'DEPENDENCY_PENDING'].includes(upper)) {
    return upper;
  }
  const lower = raw.toLowerCase();
  if (['alta', 'high'].includes(lower)) return 'TRUSTED';
  if (['media', 'medium'].includes(lower)) return 'TRUSTED_WITH_WARNINGS';
  if (['baja', 'low'].includes(lower)) return 'LOW_CONFIDENCE';
  return value ? 'trusted_with_warnings' : 'insufficient_data';
}

function combineTrust(states = []) {
  const normalized = states.map(normalizeTrust).filter(Boolean);
  if (!normalized.length) return 'insufficient_data';
  if (normalized.includes('SOURCE_INCOMPATIBLE')) return 'source_incompatible';
  if (normalized.includes('DEPENDENCY_PENDING')) return 'dependency_pending';
  if (normalized.includes('INSUFFICIENT_DATA')) return 'insufficient_data';
  if (normalized.includes('LOW_CONFIDENCE')) return 'low_confidence';
  if (normalized.includes('TRUSTED_WITH_WARNINGS')) return 'trusted_with_warnings';
  return 'trusted';
}

function temporalFrom(row = {}) {
  return {
    event_time: row.event_time || row.observed_at || row.period_end || row.generated_at || row.calculated_at || row.last_seen || null,
    observation_time: row.observed_at || row.generated_at || row.calculated_at || null,
    period_start: row.period_start || null,
    period_end: row.period_end || null,
    regulatory_effective_time: row.effective_from || row.effective_at || null,
    analysis_window: null,
    technical_evaluation_time: null,
  };
}

function provenance({ tenantId, sourceModel, sourceRecordId, fields = [], contractVersion, dataTrust = null, temporal = {} }) {
  return {
    tenant_id: tenantId,
    source_model: sourceModel,
    source_record_id: sourceRecordId || null,
    fields,
    contract_version: contractVersion,
    data_trust: dataTrust,
    temporal_semantics: temporal,
  };
}

function contextItem({ tenantId, category, sourceModel, sourceRecordId, title, value = null, severity = null, status = null, domain = null, dataTrust = null, temporal = {}, metadata = {} }) {
  const id = stableHash({
    contract_version: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
    tenant_id: tenantId,
    category,
    source_model: sourceModel,
    source_record_id: sourceRecordId || title,
    title,
    value,
    temporal: {
      event_time: temporal.event_time || null,
      period_start: temporal.period_start || null,
      period_end: temporal.period_end || null,
    },
  });
  return {
    id,
    category,
    tenant_id: tenantId,
    source_model: sourceModel,
    source_record_id: sourceRecordId || null,
    title: text(title, 240),
    value,
    severity: text(severity, 80),
    status: text(status, 80),
    domain: text(domain, 160),
    data_trust: normalizeTrust(dataTrust),
    temporal_semantics: temporal,
    provenance: provenance({
      tenantId,
      sourceModel,
      sourceRecordId,
      fields: Object.keys(asObject(metadata)).slice(0, 20),
      contractVersion: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
      dataTrust: normalizeTrust(dataTrust),
      temporal,
    }),
    metadata: asObject(metadata),
  };
}

function factItemsFromDataset(dataset = {}, tenantId, bounds) {
  const facts = [];
  const addRows = (rows, sourceModel, mapper, limit = bounds.max_facts) => {
    for (const row of asArray(rows).filter((item) => sameTenant(item, tenantId)).slice(0, limit)) {
      facts.push(mapper(row));
      if (facts.length >= bounds.max_facts) break;
    }
  };

  addRows(dataset.priority_controls || dataset.controls, 'controls', (row) => contextItem({
    tenantId,
    category: 'facts',
    sourceModel: 'controls',
    sourceRecordId: row.id || row.tenant_control_id || row.control_id,
    title: row.title || row.control_title || row.name || 'Control',
    value: numberOrNull(row.score ?? row.health_score),
    severity: row.severity,
    status: row.status || row.health_status || row.effective_health_status,
    domain: row.domain || row.control_domain || row.standard_code,
    dataTrust: row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence,
    temporal: temporalFrom(row),
    metadata: { standard_code: row.standard_code, evidence_count: row.evidence_count, owner: row.owner || row.responsible_user_id },
  }));

  addRows(dataset.recent_findings || dataset.findings, 'findings', (row) => contextItem({
    tenantId,
    category: 'facts',
    sourceModel: 'findings',
    sourceRecordId: row.id || row.finding_id,
    title: row.title || row.description || 'Finding',
    severity: row.severity,
    status: row.status,
    domain: row.domain || row.finding_type || row.standard_code,
    dataTrust: row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence,
    temporal: temporalFrom(row),
    metadata: { due_date: row.due_date, closed_at: row.closed_at, standard_code: row.standard_code },
  }));

  addRows(dataset.recent_action_plans || dataset.action_plans, 'action_plans', (row) => contextItem({
    tenantId,
    category: 'facts',
    sourceModel: 'action_plans',
    sourceRecordId: row.id || row.action_plan_id,
    title: row.title || row.action || 'Action plan',
    severity: row.priority || row.severity,
    status: row.status,
    domain: row.domain || row.target_module,
    dataTrust: row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence,
    temporal: temporalFrom(row),
    metadata: { due_date: row.due_date, evidence_count: row.evidence_count },
  }));

  addRows(dataset.risks, 'risks', (row) => contextItem({
    tenantId,
    category: 'facts',
    sourceModel: 'risks',
    sourceRecordId: row.id || row.risk_id,
    title: row.title || row.risk_name || 'Risk',
    value: numberOrNull(row.score || row.inherent_risk_score || row.residual_risk_score),
    severity: row.severity || row.risk_level,
    status: row.status,
    domain: row.domain || row.category,
    dataTrust: row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence,
    temporal: temporalFrom(row),
    metadata: { likelihood: row.likelihood || row.probability, impact: row.impact },
  }));

  return facts.filter(Boolean).slice(0, bounds.max_facts);
}

function knowledgeItemsFromDataset(dataset = {}, tenantId, bounds) {
  return asArray(dataset.knowledge_context?.knowledge_items_used)
    .slice(0, bounds.max_retrieved_knowledge)
    .map((item) => contextItem({
      tenantId,
      category: 'retrieved_knowledge',
      sourceModel: 'knowledge_documents',
      sourceRecordId: item.source_record_id || item.item_key,
      title: item.title || item.intent_summary || item.item_key,
      status: item.license_class || 'derived_summary',
      domain: item.domain || item.standard_code,
      dataTrust: item.data_trust?.state || 'TRUSTED_WITH_WARNINGS',
      temporal: temporalFrom(item),
      metadata: {
        item_key: item.item_key,
        standard_code: item.standard_code,
        clause_or_control: item.clause_or_control,
        source_authority: item.source_authority || null,
      },
    }));
}

function regulatoryItemsFromDataset(dataset = {}, tenantId, bounds) {
  const candidates = asArray(dataset.regulatory_context || dataset.regulatory_packs || dataset.pack_applicability);
  return candidates
    .filter((item) => sameTenant(item, tenantId))
    .slice(0, bounds.max_regulatory_items)
    .map((item) => contextItem({
      tenantId,
      category: 'regulatory_context',
      sourceModel: item.source_model || item.object_type || 'regulatory_pack',
      sourceRecordId: item.id || item.pack_version_id || item.regulation_version_id || item.legal_obligation_id,
      title: item.title || item.pack_key || item.regulation_key || item.reference || 'Regulatory context',
      severity: item.recommendation || item.lifecycle_status,
      status: item.status || item.lifecycle_status || item.recommendation,
      domain: item.domain || item.jurisdiction || item.subject,
      dataTrust: item.data_trust?.state || item.confidence || 'TRUSTED_WITH_WARNINGS',
      temporal: temporalFrom(item),
      metadata: {
        contract_version: item.contract_version,
        jurisdiction: item.jurisdiction,
        source_id: item.source_id,
        regulation_id: item.regulation_id,
      },
    }));
}

function historicalSeriesFromDataset(dataset = {}, tenantId, bounds) {
  const rows = [
    ...asArray(dataset.kpis).map((row) => ({ ...row, __source_model: 'kpis', __key: row.kpi_code || row.kpi_name })),
    ...asArray(dataset.effective_health_summary).map((row) => ({ ...row, __source_model: 'effective_health_summary', __key: row.metric_key || row.standard_code || row.domain })),
    ...asArray(dataset.historical_context).map((row) => ({ ...row, __source_model: row.source_model || 'historical_context', __key: row.signal_key || row.metric_key || row.kpi_code })),
  ];

  const grouped = new Map();
  for (const row of rows.filter((item) => sameTenant(item, tenantId))) {
    const value = numberOrNull(row.value ?? row.calculated_value ?? row.score ?? row.healthy_percentage);
    const eventTime = temporalFrom(row).event_time;
    const signalKey = text(row.signal_key || row.__key || row.title, 160);
    if (value === null || !eventTime || !signalKey) continue;
    const key = `${row.__source_model}:${signalKey}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({
      tenant_id: tenantId,
      signal_key: key,
      source_model: row.__source_model,
      source_record_id: row.id || row.kpi_snapshot_id || row.snapshot_id || null,
      event_time: eventTime,
      period_start: row.period_start || null,
      period_end: row.period_end || null,
      value,
      unit: row.unit || null,
      data_trust: normalizeTrust(row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence),
      provenance: provenance({
        tenantId,
        sourceModel: row.__source_model,
        sourceRecordId: row.id || row.kpi_snapshot_id || row.snapshot_id || null,
        fields: ['value', 'period_start', 'period_end'],
        contractVersion: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
        dataTrust: normalizeTrust(row.data_trust?.state || row.data_trust_state || dataset.data_quality?.confidence),
        temporal: temporalFrom(row),
      }),
    });
  }

  return [...grouped.values()].map((points) => points
    .sort((a, b) => String(a.event_time).localeCompare(String(b.event_time)) || String(a.source_record_id).localeCompare(String(b.source_record_id)))
    .slice(-bounds.max_historical_points_per_series));
}

function missingContext(dataset = {}, tenantId) {
  const categories = [
    ['facts', ['priority_controls', 'controls', 'recent_findings', 'findings', 'recent_action_plans', 'action_plans', 'risks']],
    ['retrieved_knowledge', ['knowledge_context']],
    ['regulatory_context', ['regulatory_context', 'regulatory_packs', 'pack_applicability']],
    ['historical_context', ['kpis', 'effective_health_summary', 'historical_context']],
  ];
  return categories
    .filter(([, fields]) => fields.every((field) => {
      const value = dataset[field];
      if (field === 'knowledge_context') return !asArray(value?.knowledge_items_used).length;
      return !asArray(value).filter((item) => sameTenant(item, tenantId)).length;
    }))
    .map(([category]) => ({
      category,
      status: 'insufficient_data',
      reason: `${category}_not_available_for_tenant`,
      tenant_id: tenantId,
      provenance: {
        contract_version: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
        tenant_id: tenantId,
        no_cross_tenant_fallback: true,
      },
    }));
}

async function buildUnifiedContext({
  tenantId,
  user = {},
  dataset = null,
  requestId = null,
  options = {},
  now = () => new Date().toISOString(),
} = {}) {
  const effectiveTenantId = requireTenantId({ tenantId, user });
  const bounds = resolveBounds(options);
  const technicalEvaluationTime = now();
  const rawDataset = dataset || await repository.getTenantIntelligenceDataset({ tenantId: effectiveTenantId, user });
  const normalized = normalizeTenantDataset(rawDataset || {});
  const facts = factItemsFromDataset(normalized, effectiveTenantId, bounds);
  const retrievedKnowledge = knowledgeItemsFromDataset(normalized, effectiveTenantId, bounds);
  const regulatoryContext = regulatoryItemsFromDataset(normalized, effectiveTenantId, bounds);
  const historicalContext = historicalSeriesFromDataset(normalized, effectiveTenantId, bounds);
  const missing = missingContext(normalized, effectiveTenantId);
  const trustStates = [
    ...facts.map((item) => item.data_trust),
    ...retrievedKnowledge.map((item) => item.data_trust),
    ...regulatoryContext.map((item) => item.data_trust),
    ...historicalContext.flat().map((item) => item.data_trust),
  ];

  return {
    ok: true,
    contract_version: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    request_id: requestId,
    technical_evaluation_time: technicalEvaluationTime,
    bounds,
    categories: {
      facts,
      derived_signals: [],
      retrieved_knowledge: retrievedKnowledge,
      regulatory_context: regulatoryContext,
      historical_context: historicalContext,
      missing_context: missing,
      insufficient_context: missing.filter((item) => item.status === 'insufficient_data'),
    },
    data_trust: {
      state: combineTrust(trustStates),
      source_states: [...new Set(trustStates.map(normalizeTrust).filter(Boolean))].sort(),
      missing_is_not_zero: true,
    },
    temporal_semantics: {
      business_event_time_fields: ['event_time', 'observed_at', 'period_start', 'period_end'],
      regulatory_effective_time_fields: ['effective_from', 'effective_to'],
      analysis_window_days: bounds.max_analysis_window_days,
      technical_evaluation_time: technicalEvaluationTime,
      created_at_not_business_time_fallback: true,
    },
    provenance: {
      contract_version: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
      request_id: requestId,
      tenant_id: effectiveTenantId,
      source_models: [...new Set([
        ...facts.map((item) => item.source_model),
        ...retrievedKnowledge.map((item) => item.source_model),
        ...regulatoryContext.map((item) => item.source_model),
        ...historicalContext.flat().map((item) => item.source_model),
      ])].sort(),
      no_cross_tenant_fallback: true,
      untrusted_documents_are_evidence_not_instructions: true,
    },
  };
}

function flattenHistorical(context = {}) {
  return asArray(context.categories?.historical_context).flat().filter((point) => numberOrNull(point.value) !== null);
}

function analysisWindow(points = []) {
  const times = points.map((point) => point.event_time).filter(Boolean).sort();
  return {
    start: times[0] || null,
    end: times[times.length - 1] || null,
    sample_count: points.length,
  };
}

function linearTrend(points = []) {
  const n = points.length;
  const xs = points.map((_, index) => index + 1);
  const ys = points.map((point) => Number(point.value));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  const denominator = xs.reduce((sum, value) => sum + ((value - meanX) ** 2), 0);
  const slope = denominator === 0 ? 0 : xs.reduce((sum, value, index) => sum + ((value - meanX) * (ys[index] - meanY)), 0) / denominator;
  const delta = ys[n - 1] - ys[0];
  const direction = Math.abs(delta) < 0.000001 ? 'flat' : delta > 0 ? 'increasing' : 'decreasing';
  return { slope, delta, direction };
}

function trendSignal({ tenantId, signalKey, points, evaluatedAt }) {
  const window = analysisWindow(points);
  const trend = linearTrend(points);
  const dataTrust = combineTrust(points.map((point) => point.data_trust));
  const signalId = stableHash({
    contract_version: PATTERN_TREND_CONTRACT_VERSION,
    tenant_id: tenantId,
    signal_key: signalKey,
    window,
    method: 'linear-delta-v1',
  });
  return {
    signal_id: signalId,
    signal_type: 'trend',
    tenant_id: tenantId,
    signal_key: signalKey,
    contract_version: PATTERN_TREND_CONTRACT_VERSION,
    method: 'linear-delta-v1',
    status: 'calculated',
    trend_direction: trend.direction,
    slope: Number(trend.slope.toFixed(6)),
    delta: Number(trend.delta.toFixed(6)),
    window,
    data_trust: dataTrust,
    explanation: {
      summary: `Trend ${trend.direction} over ${window.sample_count} tenant-scoped samples.`,
      deterministic: true,
      min_samples_required: MIN_TREND_POINTS,
    },
    provenance: {
      contract_version: PATTERN_TREND_CONTRACT_VERSION,
      tenant_id: tenantId,
      source_points: points.map((point) => ({
        source_model: point.source_model,
        source_record_id: point.source_record_id,
        event_time: point.event_time,
        data_trust: point.data_trust,
      })),
      evaluated_at: evaluatedAt,
      ai_pattern_truth_authority: false,
    },
  };
}

function insufficientSignal({ contractVersion, tenantId, signalKey, reason, minSamples, sampleCount, evaluatedAt, method }) {
  return {
    signal_id: stableHash({ contract_version: contractVersion, tenant_id: tenantId, signal_key: signalKey, reason, sample_count: sampleCount, method }),
    tenant_id: tenantId,
    signal_key: signalKey,
    contract_version: contractVersion,
    method,
    status: 'insufficient_data',
    reason,
    sample_count: sampleCount,
    min_samples_required: minSamples,
    data_trust: 'insufficient_data',
    explanation: {
      summary: `Insufficient data: ${sampleCount}/${minSamples} samples.`,
      deterministic: true,
    },
    provenance: {
      contract_version: contractVersion,
      tenant_id: tenantId,
      evaluated_at: evaluatedAt,
      missing_is_not_zero: true,
    },
  };
}

function evaluatePatternsAndTrends({ tenantId, context = {}, options = {}, now = () => new Date().toISOString() } = {}) {
  const effectiveTenantId = requireTenantId({ tenantId });
  const bounds = resolveBounds(options);
  const evaluatedAt = now();
  const bySignal = new Map();
  for (const point of flattenHistorical(context).filter((item) => String(item.tenant_id) === String(effectiveTenantId))) {
    if (!bySignal.has(point.signal_key)) bySignal.set(point.signal_key, []);
    bySignal.get(point.signal_key).push(point);
  }
  const trends = [];
  const patterns = [];
  const insufficientData = [];
  for (const [signalKey, rawPoints] of [...bySignal.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const points = rawPoints
      .sort((a, b) => String(a.event_time).localeCompare(String(b.event_time)) || String(a.source_record_id).localeCompare(String(b.source_record_id)))
      .slice(-bounds.max_historical_points_per_series);
    if (points.length < MIN_TREND_POINTS) {
      insufficientData.push(insufficientSignal({
        contractVersion: PATTERN_TREND_CONTRACT_VERSION,
        tenantId: effectiveTenantId,
        signalKey,
        reason: 'minimum_periods_not_met',
        minSamples: MIN_TREND_POINTS,
        sampleCount: points.length,
        evaluatedAt,
        method: 'linear-delta-v1',
      }));
      continue;
    }
    const signal = trendSignal({ tenantId: effectiveTenantId, signalKey, points, evaluatedAt });
    trends.push(signal);
    const crossings = thresholdCrossings(points, options.thresholds?.[signalKey]);
    if (crossings.length) {
      patterns.push({
        ...signal,
        signal_id: stableHash({ base_signal_id: signal.signal_id, pattern: 'threshold_crossing-v1', crossings }),
        signal_type: 'pattern',
        method: 'threshold-crossing-v1',
        pattern_type: 'threshold_crossing',
        crossings,
        explanation: {
          summary: `Detected ${crossings.length} deterministic threshold crossing(s).`,
          deterministic: true,
        },
      });
    }
  }
  if (!bySignal.size) {
    insufficientData.push(insufficientSignal({
      contractVersion: PATTERN_TREND_CONTRACT_VERSION,
      tenantId: effectiveTenantId,
      signalKey: 'tenant_historical_context',
      reason: 'no_historical_context',
      minSamples: MIN_TREND_POINTS,
      sampleCount: 0,
      evaluatedAt,
      method: 'linear-delta-v1',
    }));
  }
  return {
    ok: true,
    contract_version: PATTERN_TREND_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    evaluated_at: evaluatedAt,
    patterns: patterns.slice(0, bounds.max_patterns),
    trends: trends.slice(0, bounds.max_trends),
    insufficient_data: insufficientData,
    data_trust: combineTrust([...trends, ...patterns].map((item) => item.data_trust)),
    provenance: {
      contract_version: PATTERN_TREND_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      method_versions: ['linear-delta-v1', 'threshold-crossing-v1'],
      deterministic: true,
      ai_pattern_truth_authority: false,
      source_context_contract_version: context.contract_version || null,
    },
  };
}

function thresholdCrossings(points = [], threshold = null) {
  const parsed = numberOrNull(threshold);
  if (parsed === null) return [];
  const crossings = [];
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    if ((before.value < parsed && after.value >= parsed) || (before.value >= parsed && after.value < parsed)) {
      crossings.push({
        from_event_time: before.event_time,
        to_event_time: after.event_time,
        threshold: parsed,
        from_value: before.value,
        to_value: after.value,
      });
    }
  }
  return crossings;
}

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function anomalyBand(score) {
  if (score >= 5) return 'critical';
  if (score >= 3.5) return 'high';
  if (score >= 2.5) return 'medium';
  return 'low';
}

function evaluateAnomalies({ tenantId, context = {}, options = {}, now = () => new Date().toISOString() } = {}) {
  const effectiveTenantId = requireTenantId({ tenantId });
  const bounds = resolveBounds(options);
  const evaluatedAt = now();
  const bySignal = new Map();
  for (const point of flattenHistorical(context).filter((item) => String(item.tenant_id) === String(effectiveTenantId))) {
    if (!bySignal.has(point.signal_key)) bySignal.set(point.signal_key, []);
    bySignal.get(point.signal_key).push(point);
  }
  const anomalies = [];
  const insufficientData = [];
  for (const [signalKey, rawPoints] of [...bySignal.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const points = rawPoints
      .sort((a, b) => String(a.event_time).localeCompare(String(b.event_time)) || String(a.source_record_id).localeCompare(String(b.source_record_id)))
      .slice(-bounds.max_historical_points_per_series);
    if (points.length < MIN_ANOMALY_BASELINE_POINTS + 1) {
      insufficientData.push(insufficientSignal({
        contractVersion: ANOMALY_ENGINE_CONTRACT_VERSION,
        tenantId: effectiveTenantId,
        signalKey,
        reason: 'baseline_sample_size_not_met',
        minSamples: MIN_ANOMALY_BASELINE_POINTS + 1,
        sampleCount: points.length,
        evaluatedAt,
        method: 'robust-z-score-mad-v1',
      }));
      continue;
    }
    const baseline = points.slice(0, -1);
    const observed = points[points.length - 1];
    const baselineValues = baseline.map((point) => Number(point.value)).filter(Number.isFinite);
    const baselineMedian = median(baselineValues);
    const deviations = baselineValues.map((value) => Math.abs(value - baselineMedian));
    const mad = median(deviations);
    if (baselineMedian === null || !mad) {
      insufficientData.push(insufficientSignal({
        contractVersion: ANOMALY_ENGINE_CONTRACT_VERSION,
        tenantId: effectiveTenantId,
        signalKey,
        reason: 'baseline_variance_not_available',
        minSamples: MIN_ANOMALY_BASELINE_POINTS + 1,
        sampleCount: points.length,
        evaluatedAt,
        method: 'robust-z-score-mad-v1',
      }));
      continue;
    }
    const robustZ = Math.abs((Number(observed.value) - baselineMedian) / (1.4826 * mad));
    if (robustZ < 2.5) continue;
    const window = analysisWindow(points);
    anomalies.push({
      signal_id: stableHash({
        contract_version: ANOMALY_ENGINE_CONTRACT_VERSION,
        tenant_id: effectiveTenantId,
        signal_key: signalKey,
        observed_event_time: observed.event_time,
        method: 'robust-z-score-mad-v1',
      }),
      tenant_id: effectiveTenantId,
      signal_key: signalKey,
      contract_version: ANOMALY_ENGINE_CONTRACT_VERSION,
      method: 'robust-z-score-mad-v1',
      status: 'detected',
      score: Number(robustZ.toFixed(6)),
      band: anomalyBand(robustZ),
      observed_value: Number(observed.value),
      baseline: {
        method: 'median-mad',
        median: Number(baselineMedian.toFixed(6)),
        mad: Number(mad.toFixed(6)),
        sample_count: baselineValues.length,
        window_start: baseline[0]?.event_time || null,
        window_end: baseline[baseline.length - 1]?.event_time || null,
      },
      window,
      data_trust: combineTrust(points.map((point) => point.data_trust)),
      explanation: {
        summary: `Observed value differs from robust baseline with z=${robustZ.toFixed(2)}.`,
        deterministic: true,
      },
      provenance: {
        contract_version: ANOMALY_ENGINE_CONTRACT_VERSION,
        tenant_id: effectiveTenantId,
        observed_source_record_id: observed.source_record_id,
        baseline_source_record_ids: baseline.map((point) => point.source_record_id).filter(Boolean),
        evaluated_at: evaluatedAt,
        llm_anomaly_truth_authority: false,
      },
    });
  }
  if (!bySignal.size) {
    insufficientData.push(insufficientSignal({
      contractVersion: ANOMALY_ENGINE_CONTRACT_VERSION,
      tenantId: effectiveTenantId,
      signalKey: 'tenant_historical_context',
      reason: 'no_historical_context',
      minSamples: MIN_ANOMALY_BASELINE_POINTS + 1,
      sampleCount: 0,
      evaluatedAt,
      method: 'robust-z-score-mad-v1',
    }));
  }
  return {
    ok: true,
    contract_version: ANOMALY_ENGINE_CONTRACT_VERSION,
    tenant_id: effectiveTenantId,
    evaluated_at: evaluatedAt,
    anomalies: anomalies.slice(0, bounds.max_anomalies),
    insufficient_data: insufficientData,
    data_trust: combineTrust(anomalies.map((item) => item.data_trust)),
    provenance: {
      contract_version: ANOMALY_ENGINE_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      method_versions: ['robust-z-score-mad-v1'],
      deterministic: true,
      llm_anomaly_truth_authority: false,
      source_context_contract_version: context.contract_version || null,
    },
  };
}

async function optionalDependency(name, warnings, fn) {
  try {
    const result = await fn();
    return result || null;
  } catch (error) {
    warnings.push({
      dependency: name,
      status: 'dependency_pending',
      code: error.code || error.name || `${name}_unavailable`,
      message: text(error.message, 240),
    });
    return null;
  }
}

function createCrossGrcIntelligenceService({
  contextRepository = repository,
  priorityEngine = null,
  impactGraph = null,
  ragService = null,
  regulatoryContextProvider = null,
  now = () => new Date().toISOString(),
} = {}) {
  async function buildContext(args = {}) {
    return buildUnifiedContext({
      ...args,
      now,
      dataset: args.dataset || await contextRepository.getTenantIntelligenceDataset({
        tenantId: requireTenantId(args),
        user: args.user || {},
      }).catch((error) => {
        if (args.dataset) return args.dataset;
        throw error;
      }),
    });
  }

  async function orchestrate({
    tenantId,
    user = {},
    dataset = null,
    entity = {},
    question = '',
    requestId = null,
    options = {},
  } = {}) {
    const effectiveTenantId = requireTenantId({ tenantId, user });
    const evaluatedAt = now();
    const warnings = [];
    const context = await buildUnifiedContext({
      tenantId: effectiveTenantId,
      user,
      dataset: dataset || await contextRepository.getTenantIntelligenceDataset({ tenantId: effectiveTenantId, user }),
      requestId,
      options,
      now,
    });
    const patternTrend = evaluatePatternsAndTrends({ tenantId: effectiveTenantId, context, options, now });
    const anomaly = evaluateAnomalies({ tenantId: effectiveTenantId, context, options, now });

    const priorityContext = priorityEngine
      ? await optionalDependency('priority_engine', warnings, () => priorityEngine.listPriorities({
        tenantId: effectiveTenantId,
        filters: { limit: resolveBounds(options).max_patterns },
      }))
      : null;

    const impactGraphContext = impactGraph && entity.entity_type && entity.entity_id
      ? await optionalDependency('impact_graph', warnings, () => impactGraph.getNeighborhood({
        tenantId: effectiveTenantId,
        entityType: entity.entity_type,
        entityId: entity.entity_id,
        depth: 1,
        maxNodes: resolveBounds(options).max_graph_nodes,
        maxEdges: resolveBounds(options).max_graph_edges,
      }))
      : null;

    const knowledgeGrounding = ragService && question
      ? await optionalDependency('rag_grounded_answer', warnings, () => ragService.answer({
        user: { ...user, tenant_id: effectiveTenantId },
        question,
        filters: {},
        retrievalOptions: {
          limit: resolveBounds(options).max_retrieval_candidates,
          evidence_limit: Math.min(5, resolveBounds(options).max_retrieval_candidates),
          context_char_limit: resolveBounds(options).llm_context_char_limit,
        },
        requestId,
      }))
      : null;

    const regulatoryContext = regulatoryContextProvider
      ? await optionalDependency('regulatory_context', warnings, () => regulatoryContextProvider({
        tenantId: effectiveTenantId,
        user,
        context,
        requestId,
      }))
      : { items: context.categories.regulatory_context, status: context.categories.regulatory_context.length ? 'available' : 'insufficient_data' };

    const insufficientData = [
      ...context.categories.insufficient_context,
      ...patternTrend.insufficient_data,
      ...anomaly.insufficient_data,
    ];

    return {
      ok: true,
      contract_version: CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
      tenant_id: effectiveTenantId,
      evaluated_at: evaluatedAt,
      context,
      patterns: patternTrend.patterns,
      trends: patternTrend.trends,
      anomalies: anomaly.anomalies,
      priority_context: priorityContext || {
        status: 'dependency_pending',
        owner: 'priorityEngine.service.js',
        score_authority: 'priority-engine-2-v1',
      },
      impact_graph_context: impactGraphContext || {
        status: entity.entity_type && entity.entity_id ? 'dependency_pending' : 'not_requested',
        owner: 'impactGraph.service.js',
      },
      knowledge_grounding: knowledgeGrounding || {
        status: question ? 'dependency_pending' : 'not_requested',
        owner: 'knowledgeRag.service.js',
      },
      regulatory_context: regulatoryContext,
      warnings,
      insufficient_data: insufficientData,
      data_trust: {
        state: combineTrust([context.data_trust.state, patternTrend.data_trust, anomaly.data_trust]),
        missing_is_not_zero: true,
      },
      provenance: {
        contract_version: CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
        tenant_id: effectiveTenantId,
        request_id: requestId,
        evaluated_at: evaluatedAt,
        source_contracts: {
          context_builder: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
          pattern_trend: PATTERN_TREND_CONTRACT_VERSION,
          anomaly: ANOMALY_ENGINE_CONTRACT_VERSION,
          priority: priorityContext?.model_version || 'priority-engine-2-v1',
          impact_graph: impactGraphContext?.model_version || 'impact-graph-2-foundation-v1',
          rag: knowledgeGrounding?.contract_version || 'rag-grounded-answer-contract-v1',
        },
        deterministic_truth: true,
        priority_engine_reused: Boolean(priorityEngine),
        impact_graph_reused: Boolean(impactGraph),
        rag_reused: Boolean(ragService),
        ai_cross_grc_truth_authority: false,
        llm_direct_sql: false,
        no_parallel_observation_model: true,
        no_parallel_gap_model: true,
        no_parallel_priority_store: true,
        no_second_retrieval_engine: true,
      },
    };
  }

  return {
    contextContractVersion: CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
    patternTrendContractVersion: PATTERN_TREND_CONTRACT_VERSION,
    anomalyContractVersion: ANOMALY_ENGINE_CONTRACT_VERSION,
    orchestratorContractVersion: CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
    buildContext,
    evaluatePatternsAndTrends: (args = {}) => evaluatePatternsAndTrends({ ...args, now }),
    evaluateAnomalies: (args = {}) => evaluateAnomalies({ ...args, now }),
    orchestrate,
  };
}

module.exports = {
  CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
  PATTERN_TREND_CONTRACT_VERSION,
  ANOMALY_ENGINE_CONTRACT_VERSION,
  CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
  DEFAULT_BOUNDS,
  buildUnifiedContext,
  evaluatePatternsAndTrends,
  evaluateAnomalies,
  createCrossGrcIntelligenceService,
  stableHash,
};
