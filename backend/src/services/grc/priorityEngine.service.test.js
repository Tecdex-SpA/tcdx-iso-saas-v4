'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PRIORITY_MODEL_VERSION,
  evaluateGapPriority,
  createPriorityEngineService,
} = require('./priorityEngine.service');

const TENANT_A = '91000000-0000-4000-8000-000000000001';
const TENANT_B = '91000000-0000-4000-8000-000000000002';
const GAP_HIGH = '91000000-0000-4000-8000-000000000011';
const GAP_MEDIUM = '91000000-0000-4000-8000-000000000012';
const GAP_CLOSED = '91000000-0000-4000-8000-000000000013';
const OBS = '91000000-0000-4000-8000-000000000021';

class GrcError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function assertUuid(value, code = 'ID_INVALID') {
  const text = String(value || '').trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text)) throw new GrcError(code, 'Identificador inválido.', 400);
  return text;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function gap(overrides = {}) {
  return {
    id: GAP_HIGH,
    tenant_id: TENANT_A,
    gap_type: 'data_trust_attention',
    rule_code: 'observation.data_trust_attention_gap',
    rule_version: 1,
    source_observation_id: OBS,
    latest_source_observation_id: OBS,
    severity: 'high',
    status: 'open',
    first_seen: '2026-08-18T10:00:00.000Z',
    last_seen: '2026-08-19T10:00:00.000Z',
    metadata: {
      data_trust: { state: 'LOW_CONFIDENCE', model_version: 'data-trust-model-v1' },
      source_observation: {
        id: OBS,
        source_snapshot_id: '91000000-0000-4000-8000-000000000031',
      },
    },
    created_at: '2026-08-18T10:00:00.000Z',
    ...overrides,
  };
}

function fakePool() {
  const state = {
    calls: [],
    gaps: [
      gap(),
      gap({
        id: GAP_MEDIUM,
        severity: 'medium',
        status: 'acknowledged',
        latest_source_observation_id: '91000000-0000-4000-8000-000000000022',
        metadata: { data_trust: { state: 'TRUSTED_WITH_WARNINGS' } },
        last_seen: '2026-08-19T09:00:00.000Z',
      }),
      gap({
        id: GAP_CLOSED,
        severity: 'critical',
        status: 'closed',
        latest_source_observation_id: '91000000-0000-4000-8000-000000000023',
        metadata: { data_trust: { state: 'TRUSTED' }, ai_hypothesis: { ignored: true } },
        last_seen: '2026-08-19T08:00:00.000Z',
      }),
    ],
  };

  async function query(sql, values = []) {
    state.calls.push({ sql: String(sql), values });
    if (String(sql).includes('FROM grc_gaps') && String(sql).includes('LIMIT $5')) {
      const rows = state.gaps.filter((item) => item.tenant_id === values[0] &&
        (!values[1] || item.status === values[1]) &&
        (!values[2] || item.gap_type === values[2]) &&
        (!values[3] || item.severity === values[3]))
        .slice(0, values[4]);
      return { rows: clone(rows), rowCount: rows.length };
    }
    if (String(sql).includes('FROM grc_gaps') && String(sql).includes('id=$2::uuid')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  return { state, query };
}

function fakeImpactGraph() {
  const state = { calls: [] };
  async function getNeighborhood(args = {}) {
    state.calls.push(args);
    if (args.tenantId !== TENANT_A) {
      return {
        model_version: 'impact-graph-2-foundation-v1',
        tenant_id: args.tenantId,
        seed: { id: `seed:${args.entityId}` },
        depth: args.depth,
        limits: { max_nodes: args.maxNodes, max_edges: args.maxEdges },
        nodes: [{ id: `seed:${args.entityId}`, entity_type: args.entityType, entity_id: args.entityId }],
        edges: [],
      };
    }
    const seed = { id: `seed:${args.entityId}`, entity_type: 'grc_gap', entity_id: args.entityId };
    const observationNode = { id: `node:${OBS}`, entity_type: 'observation', entity_id: OBS };
    const edges = args.entityId === GAP_HIGH ? [
      {
        id: 'edge:relation',
        tenant_id: TENANT_A,
        source: { entity_type: 'observation', entity_id: OBS },
        target: { entity_type: 'grc_gap', entity_id: args.entityId },
        source_of_truth: 'grc_observation_relations',
        relationship_type: 'supports',
      },
      {
        id: 'edge:derived',
        tenant_id: TENANT_A,
        source: { entity_type: 'observation', entity_id: OBS },
        target: { entity_type: 'grc_gap', entity_id: args.entityId },
        source_of_truth: 'grc_gaps',
        relationship_type: 'derives_gap',
      },
    ] : [];
    return {
      model_version: 'impact-graph-2-foundation-v1',
      tenant_id: args.tenantId,
      seed,
      depth: args.depth,
      limits: { max_nodes: args.maxNodes, max_edges: args.maxEdges },
      nodes: edges.length ? [seed, observationNode] : [seed],
      edges,
    };
  }
  return { state, getNeighborhood };
}

async function rejectsCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.code, code);
    return error;
  }
  throw new Error(`Expected rejection ${code}`);
}

async function run() {
  const pool = fakePool();
  const graph = fakeImpactGraph();
  const service = createPriorityEngineService(pool, {
    GrcError,
    assertUuid,
    impactGraph: graph,
    now: () => '2026-08-19T12:00:00.000Z',
  });

  assert.equal(service.modelVersion, PRIORITY_MODEL_VERSION);

  const list = await service.listPriorities({
    tenantId: TENANT_A,
    filters: { limit: 99, depth: 99, max_nodes: 999, max_edges: 999 },
  });
  assert.equal(list.model_version, PRIORITY_MODEL_VERSION);
  assert.equal(list.tenant_id, TENANT_A);
  assert.equal(list.limits.max_results, 50);
  assert.equal(list.limits.graph_depth, 2);
  assert.equal(list.limits.graph_max_nodes, 50);
  assert.equal(list.limits.graph_max_edges, 50);
  assert.equal(list.results.length, 3);
  assert.equal(list.results[0].subject_id, GAP_HIGH);
  assert.equal(list.results[0].rank, 1);
  assert.equal(list.results[0].priority_score, list.results[0].factors.reduce((sum, item) => sum + item.contribution, 0));
  assert.equal(list.results[0].priority_band, 'urgent');
  assert.equal(list.results[0].provenance.ai_priority_truth, false);
  assert.ok(list.results[0].factors.some((item) => item.factor === 'impact_graph_breadth' && item.contribution > 0));
  assert.ok(list.results[0].factors.some((item) => item.factor === 'canonical_gap_provenance' && item.value === 'present'));
  assert.ok(graph.state.calls.every((call) => call.tenantId === TENANT_A));
  assert.ok(graph.state.calls.every((call) => call.depth <= 2 && call.maxNodes <= 50 && call.maxEdges <= 50));

  const replay = await service.listPriorities({ tenantId: TENANT_A, filters: { limit: 3 } });
  assert.deepEqual(
    list.results.map((item) => [item.subject_id, item.priority_score, item.priority_band]),
    replay.results.map((item) => [item.subject_id, item.priority_score, item.priority_band]),
    'ranking is reproducible for equivalent inputs'
  );

  const directA = evaluateGapPriority({
    tenantId: TENANT_A,
    gap: gap(),
    graphProjection: await graph.getNeighborhood({ tenantId: TENANT_A, entityType: 'grc_gap', entityId: GAP_HIGH, depth: 1, maxNodes: 25, maxEdges: 50 }),
    evaluatedAt: '2026-08-19T12:00:00.000Z',
  });
  const directB = evaluateGapPriority({
    tenantId: TENANT_A,
    gap: gap(),
    graphProjection: await graph.getNeighborhood({ tenantId: TENANT_A, entityType: 'grc_gap', entityId: GAP_HIGH, depth: 1, maxNodes: 25, maxEdges: 50 }),
    evaluatedAt: '2026-08-19T13:00:00.000Z',
  });
  assert.equal(directA.priority_score, directB.priority_score, 'evaluated_at does not affect score');
  assert.equal(directA.priority_band, directB.priority_band);
  assert.deepEqual(directA.factors, directB.factors);

  const one = await service.getPriority({ tenantId: TENANT_A, entityType: 'gap', entityId: GAP_HIGH, filters: {} });
  assert.equal(one.result.rank, 1);
  assert.equal(one.result.subject_type, 'grc_gap');

  const emptyTenant = await service.listPriorities({ tenantId: TENANT_B, filters: {} });
  assert.equal(emptyTenant.tenant_id, TENANT_B);
  assert.deepEqual(emptyTenant.results, []);
  assert.ok(pool.state.calls.some((call) => call.values[0] === TENANT_B));

  await rejectsCode(
    service.getPriority({ tenantId: TENANT_B, entityType: 'grc_gap', entityId: GAP_HIGH, filters: {} }),
    'PRIORITY_SUBJECT_NOT_FOUND'
  );
  await rejectsCode(
    service.getPriority({ tenantId: TENANT_A, entityType: 'control', entityId: GAP_HIGH, filters: {} }),
    'PRIORITY_SUBJECT_UNSUPPORTED'
  );

  const closed = list.results.find((item) => item.subject_id === GAP_CLOSED);
  assert.equal(closed.provenance.ai_priority_truth, false);
  assert.ok(!closed.factors.some((item) => item.source.model === 'grc_gap_hypotheses'));

  const source = fs.readFileSync(path.join(__dirname, 'priorityEngine.service.js'), 'utf8');
  assert.ok(!/CREATE\s+TABLE/i.test(source), 'Priority Engine does not create storage');
  assert.ok(!source.includes('grc_observation_' + 'links'));
  assert.ok(!source.includes('grc_gap_hypotheses'));

  process.stdout.write('priorityEngine.service tests: OK\n');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
