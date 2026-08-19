'use strict';

const PRIORITY_MODEL_VERSION = 'priority-engine-2-v1';
const DEFAULT_LIMIT = 25;
const HARD_LIMIT = 50;
const DEFAULT_GRAPH_DEPTH = 1;
const MAX_GRAPH_DEPTH = 2;
const DEFAULT_GRAPH_MAX_NODES = 25;
const DEFAULT_GRAPH_MAX_EDGES = 50;
const MAX_GRAPH_MAX_NODES = 50;
const MAX_GRAPH_MAX_EDGES = 50;

const SEVERITY_CONTRIBUTIONS = Object.freeze({
  critical: 35,
  critica: 35,
  'crítica': 35,
  high: 28,
  alta: 28,
  medium: 18,
  media: 18,
  low: 8,
  baja: 8,
  informational: 0,
  info: 0,
});

const STATUS_CONTRIBUTIONS = Object.freeze({
  open: 20,
  acknowledged: 16,
  in_treatment: 10,
  verified: 3,
  closed: 0,
});

const DATA_TRUST_CONTRIBUTIONS = Object.freeze({
  LOW_CONFIDENCE: 15,
  TRUSTED_WITH_WARNINGS: 8,
  TRUSTED: 0,
});

function asText(value, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

function canonicalSubjectType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (['gap', 'grc_gap', 'grc-gaps', 'grc_gaps'].includes(type)) return 'grc_gap';
  return type;
}

function gapSeverity(gap = {}) {
  return asText(gap.severity, 80) || 'unknown';
}

function gapStatus(gap = {}) {
  return asText(gap.status, 80) || 'unknown';
}

function gapDataTrustState(gap = {}) {
  const metadata = asObject(gap.metadata);
  return asText(metadata.data_trust?.state || metadata.source_observation?.data_trust?.state, 120) || 'UNKNOWN';
}

function source(model, recordId, fields = []) {
  return { model, record_id: recordId || null, fields };
}

function factor({ factor, value, contribution, maxContribution, rule, source: factorSource }) {
  return {
    factor,
    value,
    contribution,
    max_contribution: maxContribution,
    rule,
    source: factorSource,
  };
}

function priorityBand(score) {
  if (score >= 75) return 'urgent';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function graphStats(graphProjection = {}, gapId = null) {
  const seedId = graphProjection.seed?.id || null;
  const nodes = Array.isArray(graphProjection.nodes) ? graphProjection.nodes : [];
  const edges = Array.isArray(graphProjection.edges) ? graphProjection.edges : [];
  const relatedNodes = nodes.filter((node) => node.id !== seedId).length;
  const canonicalGapEdges = edges.filter((edge) => {
    const touchesGap = edge.source?.entity_id === gapId || edge.target?.entity_id === gapId;
    return touchesGap && ['grc_observation_relations', 'grc_gaps'].includes(edge.source_of_truth);
  });
  return {
    nodes: nodes.length,
    edges: edges.length,
    related_nodes: relatedNodes,
    canonical_gap_edges: canonicalGapEdges.length,
    source_models: [...new Set(edges.map((edge) => edge.source_of_truth).filter(Boolean))].sort(),
  };
}

function evaluateGapPriority({ tenantId, gap, graphProjection = {}, evaluatedAt }) {
  const severity = gapSeverity(gap).toLowerCase();
  const status = gapStatus(gap).toLowerCase();
  const dataTrustState = gapDataTrustState(gap);
  const stats = graphStats(graphProjection, gap.id);
  const graphBreadthContribution = Math.min(20, (stats.edges * 5) + (stats.related_nodes * 2));
  const graphProvenanceContribution = stats.canonical_gap_edges > 0 ? 10 : 0;
  const factors = [
    factor({
      factor: 'gap_severity',
      value: severity,
      contribution: SEVERITY_CONTRIBUTIONS[severity] ?? 0,
      maxContribution: 35,
      rule: 'critical=35, high=28, medium=18, low=8, informational/unknown=0',
      source: source('grc_gaps', gap.id, ['severity']),
    }),
    factor({
      factor: 'gap_lifecycle_status',
      value: status,
      contribution: STATUS_CONTRIBUTIONS[status] ?? 0,
      maxContribution: 20,
      rule: 'open=20, acknowledged=16, in_treatment=10, verified=3, closed/unknown=0',
      source: source('grc_gaps', gap.id, ['status']),
    }),
    factor({
      factor: 'data_trust_state',
      value: dataTrustState,
      contribution: DATA_TRUST_CONTRIBUTIONS[dataTrustState] ?? 0,
      maxContribution: 15,
      rule: 'LOW_CONFIDENCE=15, TRUSTED_WITH_WARNINGS=8, TRUSTED/unknown=0',
      source: source('grc_gaps.metadata.data_trust', gap.id, ['metadata.data_trust.state']),
    }),
    factor({
      factor: 'impact_graph_breadth',
      value: {
        nodes: stats.nodes,
        edges: stats.edges,
        related_nodes: stats.related_nodes,
        source_models: stats.source_models,
      },
      contribution: graphBreadthContribution,
      maxContribution: 20,
      rule: 'min(20, edge_count*5 + related_node_count*2) over bounded Impact Graph neighborhood',
      source: source(graphProjection.model_version || 'impact-graph-2-foundation-v1', null, ['nodes', 'edges']),
    }),
    factor({
      factor: 'canonical_gap_provenance',
      value: stats.canonical_gap_edges > 0 ? 'present' : 'absent',
      contribution: graphProvenanceContribution,
      maxContribution: 10,
      rule: '10 when Impact Graph exposes canonical grc_observation_relations/grc_gaps edge touching the Gap',
      source: source(graphProjection.model_version || 'impact-graph-2-foundation-v1', null, ['edges.source_of_truth']),
    }),
  ];
  const priorityScore = Math.max(0, Math.min(100, factors.reduce((sum, item) => sum + item.contribution, 0)));
  return {
    tenant_id: tenantId,
    subject_type: 'grc_gap',
    subject_id: gap.id,
    priority_score: priorityScore,
    priority_band: priorityBand(priorityScore),
    rank: null,
    model_version: PRIORITY_MODEL_VERSION,
    evaluated_at: evaluatedAt,
    factors,
    provenance: {
      deterministic: true,
      ai_priority_truth: false,
      score_formula: 'sum(factor.contribution), clamped to 0..100',
      model_version: PRIORITY_MODEL_VERSION,
      source_models: {
        gap: 'grc_gaps',
        impact_graph: graphProjection.model_version || 'impact-graph-2-foundation-v1',
      },
      source_records: {
        gap_id: gap.id,
        latest_source_observation_id: gap.latest_source_observation_id || gap.source_observation_id || null,
        source_observation_id: gap.source_observation_id || null,
        source_snapshot_id: asObject(gap.metadata).source_observation?.source_snapshot_id || null,
      },
      graph_limits: graphProjection.limits || null,
      tie_breaker: ['priority_score desc', 'gap_severity desc', 'gap_status_weight desc', 'subject_type asc', 'subject_id asc'],
      temporal_semantics: 'evaluated_at is technical time only; temporal age is not a scoring input in v1.',
    },
    subject: {
      gap_type: gap.gap_type,
      severity: gap.severity,
      status: gap.status,
      first_seen: gap.first_seen || null,
      last_seen: gap.last_seen || null,
    },
  };
}

function comparePriority(a, b) {
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  const severityA = SEVERITY_CONTRIBUTIONS[String(a.subject?.severity || '').toLowerCase()] ?? 0;
  const severityB = SEVERITY_CONTRIBUTIONS[String(b.subject?.severity || '').toLowerCase()] ?? 0;
  if (severityB !== severityA) return severityB - severityA;
  const statusA = STATUS_CONTRIBUTIONS[String(a.subject?.status || '').toLowerCase()] ?? 0;
  const statusB = STATUS_CONTRIBUTIONS[String(b.subject?.status || '').toLowerCase()] ?? 0;
  if (statusB !== statusA) return statusB - statusA;
  if (a.subject_type !== b.subject_type) return a.subject_type.localeCompare(b.subject_type);
  return String(a.subject_id).localeCompare(String(b.subject_id));
}

function ranked(results) {
  return [...results].sort(comparePriority).map((item, index) => ({ ...item, rank: index + 1 }));
}

function createPriorityEngineService(pool, {
  GrcError,
  assertUuid,
  impactGraph,
  now = () => new Date().toISOString(),
} = {}) {
  function uuid(value, code = 'PRIORITY_ENTITY_ID_INVALID') {
    return assertUuid ? assertUuid(value, code) : asText(value, 80);
  }

  function bounds(filters = {}) {
    return {
      limit: clampInt(filters.limit || filters.max_results, DEFAULT_LIMIT, 1, HARD_LIMIT),
      graphDepth: clampInt(filters.depth || filters.graph_depth, DEFAULT_GRAPH_DEPTH, 0, MAX_GRAPH_DEPTH),
      graphMaxNodes: clampInt(filters.max_nodes || filters.graph_max_nodes, DEFAULT_GRAPH_MAX_NODES, 1, MAX_GRAPH_MAX_NODES),
      graphMaxEdges: clampInt(filters.max_edges || filters.graph_max_edges, DEFAULT_GRAPH_MAX_EDGES, 1, MAX_GRAPH_MAX_EDGES),
    };
  }

  async function readGaps(tenantId, filters = {}) {
    const b = bounds(filters);
    const result = await pool.query(
      `SELECT *
         FROM grc_gaps
        WHERE tenant_id=$1::uuid
          AND ($2::text IS NULL OR status=$2)
          AND ($3::text IS NULL OR gap_type=$3)
          AND ($4::text IS NULL OR severity=$4)
        ORDER BY last_seen DESC, created_at DESC, id
        LIMIT $5`,
      [tenantId, asText(filters.status, 80), asText(filters.gap_type, 120), asText(filters.severity, 80), b.limit]
    );
    return result.rows;
  }

  async function readGap(tenantId, gapId) {
    const result = await pool.query(
      `SELECT *
         FROM grc_gaps
        WHERE tenant_id=$1::uuid
          AND id=$2::uuid
        LIMIT 1`,
      [tenantId, uuid(gapId)]
    );
    if (!result.rowCount) throw new GrcError('PRIORITY_SUBJECT_NOT_FOUND', 'Sujeto de prioridad no encontrado para el tenant autenticado.', 404);
    return result.rows[0];
  }

  async function graphForGap(tenantId, gap, b) {
    return impactGraph.getNeighborhood({
      tenantId,
      entityType: 'grc_gap',
      entityId: gap.id,
      depth: b.graphDepth,
      maxNodes: b.graphMaxNodes,
      maxEdges: b.graphMaxEdges,
    });
  }

  async function evaluateGap(tenantId, gap, b, evaluatedAt) {
    const graphProjection = await graphForGap(tenantId, gap, b);
    return evaluateGapPriority({ tenantId, gap, graphProjection, evaluatedAt });
  }

  async function listPriorities({ tenantId, filters = {} }) {
    if (!tenantId) throw new GrcError('PRIORITY_TENANT_REQUIRED', 'Tenant requerido para evaluar prioridades.', 400);
    const b = bounds(filters);
    const evaluatedAt = now();
    const gaps = await readGaps(tenantId, filters);
    const results = [];
    for (const gap of gaps) {
      results.push(await evaluateGap(tenantId, gap, b, evaluatedAt));
    }
    return {
      model_version: PRIORITY_MODEL_VERSION,
      tenant_id: tenantId,
      evaluated_at: evaluatedAt,
      limits: {
        max_results: b.limit,
        graph_depth: b.graphDepth,
        graph_max_nodes: b.graphMaxNodes,
        graph_max_edges: b.graphMaxEdges,
      },
      results: ranked(results),
      provenance: {
        deterministic: true,
        ai_priority_truth: false,
        source_models: ['grc_gaps', 'impact-graph-2-foundation-v1'],
      },
    };
  }

  async function getPriority({ tenantId, entityType, entityId, filters = {} }) {
    if (!tenantId) throw new GrcError('PRIORITY_TENANT_REQUIRED', 'Tenant requerido para evaluar prioridad.', 400);
    const subjectType = canonicalSubjectType(entityType);
    if (subjectType !== 'grc_gap') {
      throw new GrcError('PRIORITY_SUBJECT_UNSUPPORTED', 'Priority Engine 2.0 v1 sólo evalúa sujetos grc_gap.', 400, {
        supported_subject_types: ['grc_gap'],
      });
    }
    const b = bounds(filters);
    const evaluatedAt = now();
    const gap = await readGap(tenantId, entityId);
    const [result] = ranked([await evaluateGap(tenantId, gap, b, evaluatedAt)]);
    return {
      model_version: PRIORITY_MODEL_VERSION,
      tenant_id: tenantId,
      evaluated_at: evaluatedAt,
      result,
    };
  }

  return {
    modelVersion: PRIORITY_MODEL_VERSION,
    listPriorities,
    getPriority,
  };
}

module.exports = {
  PRIORITY_MODEL_VERSION,
  evaluateGapPriority,
  comparePriority,
  createPriorityEngineService,
};
