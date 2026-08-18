'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_MODEL_VERSION,
  createImpactGraphService,
  nodeIdentity,
} = require('./impactGraph.service');

const TENANT_A = '90000000-0000-4000-8000-000000000001';
const TENANT_B = '90000000-0000-4000-8000-000000000002';
const REQ = '90000000-0000-4000-8000-000000000011';
const CTRL = '90000000-0000-4000-8000-000000000012';
const EVIDENCE = '90000000-0000-4000-8000-000000000013';
const RISK = '90000000-0000-4000-8000-000000000014';
const PROCESS = '90000000-0000-4000-8000-000000000015';
const ACTION = '90000000-0000-4000-8000-000000000016';
const OBS = '90000000-0000-4000-8000-000000000017';
const GAP = '90000000-0000-4000-8000-000000000018';

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

function hasNode(nodes, entityType, entityId) {
  return nodes.some((node) => node.entity_type === entityType && node.entity_id === entityId);
}

function fakePool() {
  const state = { calls: [] };

  async function query(sql, values = []) {
    state.calls.push({ sql, values });
    const nodes = values[1] ? JSON.parse(values[1]) : [];
    if (values[0] !== TENANT_A) return { rows: [], rowCount: 0 };

    if (sql.includes('impact_graph:requirement_control_mapping') && (hasNode(nodes, 'requirement', REQ) || hasNode(nodes, 'control', CTRL))) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000101',
        tenant_id: TENANT_A,
        requirement_id: REQ,
        tenant_control_id: CTRL,
        catalog_control_id: null,
        mapping_type: 'exact',
        coverage_level: '100.00',
        source_type: 'tcdx_interpretation',
        status: 'published',
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-02T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:evidence_entity_link') && (hasNode(nodes, 'evidence', EVIDENCE) || hasNode(nodes, 'control', CTRL))) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000102',
        tenant_id: TENANT_A,
        evidence_id: EVIDENCE,
        entity_type: 'control',
        entity_id: CTRL,
        created_at: '2026-08-03T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:generic_phase2_relation') && (hasNode(nodes, 'risk', RISK) || hasNode(nodes, 'control', CTRL))) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000103',
        tenant_id: TENANT_A,
        source_type: 'risk',
        source_id: RISK,
        target_type: 'control',
        target_id: CTRL,
        relation_type: 'mitigated_by',
        status: 'active',
        valid_from: '2026-08-04T10:00:00.000Z',
        valid_to: '2026-12-31T23:59:59.000Z',
        provenance: { source: 'manual_review' },
        confidence: '83.00',
        version: 1,
        created_at: '2026-08-04T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:operational_dependency') && hasNode(nodes, 'process', PROCESS)) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000104',
        tenant_id: TENANT_A,
        source_type: 'process',
        source_id: PROCESS,
        target_type: 'control',
        target_id: CTRL,
        dependency_type: 'process_to_control',
        criticality: 'high',
        is_mandatory: true,
        source_reference: 'operational dependency registry',
        valid_from: '2026-08-05T10:00:00.000Z',
        valid_to: null,
        provenance: { source: 'process_owner' },
        created_at: '2026-08-05T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:process_entity_link') && (hasNode(nodes, 'process', PROCESS) || hasNode(nodes, 'action', ACTION))) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000105',
        tenant_id: TENANT_A,
        process_id: PROCESS,
        operation_id: null,
        target_type: 'action',
        target_id: ACTION,
        relation_type: 'associated',
        source: 'manual',
        is_active: true,
        created_at: '2026-08-06T10:00:00.000Z',
        updated_at: '2026-08-06T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:canonical_observation_relation') && (hasNode(nodes, 'observation', OBS) || hasNode(nodes, 'grc_gap', GAP))) {
      return { rows: [clone({
        id: '90000000-0000-4000-8000-000000000106',
        tenant_id: TENANT_A,
        observation_id: OBS,
        related_entity_type: 'grc_gap',
        related_entity_id: GAP,
        relation_type: 'supports',
        confidence: '0.7500',
        valid_from: '2026-08-07T10:00:00.000Z',
        valid_until: null,
        metadata: { relation_owner: 'grc_gap_service' },
        created_at: '2026-08-07T10:00:00.000Z',
      })], rowCount: 1 };
    }

    if (sql.includes('impact_graph:gap_derivation') && (hasNode(nodes, 'observation', OBS) || hasNode(nodes, 'grc_gap', GAP))) {
      return { rows: [clone({
        id: GAP,
        tenant_id: TENANT_A,
        source_observation_id: OBS,
        latest_source_observation_id: OBS,
        gap_type: 'data_trust_attention',
        rule_code: 'observation.data_trust_attention_gap',
        rule_version: 1,
        first_seen: '2026-08-07T10:00:00.000Z',
        last_seen: '2026-08-07T10:00:00.000Z',
        last_evaluated_at: '2026-08-07T10:01:00.000Z',
        status: 'open',
        severity: 'medium',
        metadata: { source_identity_hash: 'f'.repeat(64) },
      })], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  return { state, query };
}

async function run() {
  const fixedProjectedAt = '2026-08-18T12:00:00.000Z';
  const pool = fakePool();
  const service = createImpactGraphService(pool, {
    GrcError,
    assertUuid,
    now: () => fixedProjectedAt,
  });

  assert.equal(service.modelVersion, GRAPH_MODEL_VERSION);
  assert.ok(service.adapters.some((adapter) => adapter.persisted_or_derived === 'derived'));
  assert.equal(
    nodeIdentity({ tenantId: TENANT_A, entityType: 'CONTROL', entityId: CTRL }),
    nodeIdentity({ tenantId: TENANT_A, entityType: 'control', entityId: CTRL }),
    'node identity is deterministic and type-normalized'
  );
  assert.notEqual(
    nodeIdentity({ tenantId: TENANT_A, entityType: 'control', entityId: CTRL }),
    nodeIdentity({ tenantId: TENANT_B, entityType: 'control', entityId: CTRL }),
    'node identity is tenant-scoped'
  );

  const requirementProjection = await service.getNodeRelationships({
    tenantId: TENANT_A,
    entityType: 'requirement',
    entityId: REQ,
    projectedAt: fixedProjectedAt,
  });
  const replayProjection = await service.getNodeRelationships({
    tenantId: TENANT_A,
    entityType: 'requirement',
    entityId: REQ,
    projectedAt: fixedProjectedAt,
  });
  assert.deepEqual(
    requirementProjection.edges.map((edge) => edge.id),
    replayProjection.edges.map((edge) => edge.id),
    'edge identities are idempotent across repeated projection'
  );
  const mappingEdge = requirementProjection.edges.find((edge) => edge.source_of_truth === 'grc_requirement_control_mappings');
  assert.ok(mappingEdge);
  assert.equal(mappingEdge.persisted_or_derived, 'persisted');
  assert.equal(mappingEdge.is_derived, false);
  assert.equal(mappingEdge.provenance.source_record_id, '90000000-0000-4000-8000-000000000101');
  assert.equal(mappingEdge.temporal.valid_from, '2026-08-01T10:00:00.000Z');
  assert.equal(mappingEdge.confidence, null, 'confidence is not invented for mapping rows');

  const controlProjection = await service.getNodeRelationships({
    tenantId: TENANT_A,
    entityType: 'control',
    entityId: CTRL,
    direction: 'incoming',
    projectedAt: fixedProjectedAt,
  });
  assert.ok(controlProjection.edges.some((edge) => edge.source_of_truth === 'grc_evidence_links'));
  const phase2Edge = controlProjection.edges.find((edge) => edge.source_of_truth === 'grc_phase2_relations');
  assert.equal(phase2Edge.confidence, 0.83);
  assert.equal(phase2Edge.temporal.valid_to, '2026-12-31T23:59:59.000Z');

  const observationProjection = await service.getNodeRelationships({
    tenantId: TENANT_A,
    entityType: 'observation',
    entityId: OBS,
    projectedAt: fixedProjectedAt,
  });
  const supportEdge = observationProjection.edges.find((edge) => edge.source_of_truth === 'grc_observation_relations');
  assert.ok(supportEdge, 'Observation -> Gap uses canonical observation relation model');
  assert.equal(supportEdge.relationship_type, 'supports');
  assert.equal(supportEdge.confidence, 0.75);
  const derivedEdge = observationProjection.edges.find((edge) => edge.source_of_truth === 'grc_gaps');
  assert.ok(derivedEdge);
  assert.equal(derivedEdge.persisted_or_derived, 'derived');
  assert.equal(derivedEdge.is_derived, true);
  assert.equal(derivedEdge.provenance.derivation_rule, 'observation.data_trust_attention_gap@1');
  assert.deepEqual(derivedEdge.provenance.inputs, [{ entity_type: 'observation', entity_id: OBS }]);

  const emptyTenant = await service.getNodeRelationships({
    tenantId: TENANT_B,
    entityType: 'observation',
    entityId: OBS,
    projectedAt: fixedProjectedAt,
  });
  assert.equal(emptyTenant.tenant_id, TENANT_B);
  assert.equal(emptyTenant.nodes.length, 1);
  assert.equal(emptyTenant.edges.length, 0);

  const neighborhood = await service.getNeighborhood({
    tenantId: TENANT_A,
    entityType: 'observation',
    entityId: OBS,
    depth: 9,
    maxNodes: 999,
    maxEdges: 999,
    projectedAt: fixedProjectedAt,
  });
  assert.equal(neighborhood.depth, 3, 'depth is defensively capped');
  assert.equal(neighborhood.limits.max_nodes, 100);
  assert.equal(neighborhood.limits.max_edges, 200);
  assert.ok(neighborhood.nodes.some((node) => node.entity_type === 'grc_gap' && node.entity_id === GAP));

  assert.ok(pool.state.calls.every((call) => call.values[0] === TENANT_A || call.values[0] === TENANT_B));
  assert.ok(pool.state.calls.every((call) => !call.sql.includes('grc_observation_' + 'links')));
  const source = fs.readFileSync(path.join(__dirname, 'impactGraph.service.js'), 'utf8');
  assert.ok(!source.includes('grc_observation_' + 'links'));
  assert.ok(!/CREATE\s+TABLE/i.test(source), 'Impact Graph foundation does not create graph storage');

  console.log('impactGraph.service tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
