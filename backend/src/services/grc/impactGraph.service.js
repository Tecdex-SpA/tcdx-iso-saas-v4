'use strict';

const crypto = require('crypto');

const GRAPH_MODEL_VERSION = 'impact-graph-2-foundation-v1';
const DEFAULT_DEPTH = 1;
const MAX_DEPTH = 3;
const DEFAULT_MAX_NODES = 50;
const DEFAULT_MAX_EDGES = 100;
const HARD_MAX_NODES = 100;
const HARD_MAX_EDGES = 200;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function asText(value, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function canonicalType(value) {
  return String(value || '').trim().toLowerCase();
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

function normalizeConfidence(value, scale = 'unit') {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return scale === 'percent' ? Math.max(0, Math.min(n / 100, 1)) : Math.max(0, Math.min(n, 1));
}

function nodeIdentity({ tenantId, entityType, entityId }) {
  return sha256({
    model: GRAPH_MODEL_VERSION,
    tenant_id: tenantId,
    entity_type: canonicalType(entityType),
    entity_id: entityId,
  });
}

function edgeIdentity({ tenantId, source, target, relationshipType, provenance, isDerived }) {
  return sha256({
    model: GRAPH_MODEL_VERSION,
    tenant_id: tenantId,
    source_type: source.entity_type,
    source_id: source.entity_id,
    target_type: target.entity_type,
    target_id: target.entity_id,
    relationship_type: relationshipType,
    source_model: provenance.source_model,
    source_record_id: provenance.source_record_id,
    derivation_rule: provenance.derivation_rule || null,
    is_derived: isDerived === true,
  });
}

function graphNode({ tenantId, entityType, entityId, owner = null, sourceModel = null, temporal = null, metadata = {} }) {
  const entity_type = canonicalType(entityType);
  return {
    id: nodeIdentity({ tenantId, entityType: entity_type, entityId }),
    tenant_id: tenantId,
    entity_type,
    entity_id: entityId,
    owner,
    source_model: sourceModel,
    temporal,
    metadata: asObject(metadata),
  };
}

function graphEdge({
  tenantId,
  source,
  target,
  relationshipType,
  sourceOfTruth,
  owner,
  sourceRecordId,
  sourceTenantId = tenantId,
  persistedOrDerived = 'persisted',
  confidence = null,
  temporal = {},
  cardinality = null,
  derivationRule = null,
  sourceInputs = [],
  metadata = {},
}) {
  const from = {
    entity_type: canonicalType(source.entity_type),
    entity_id: source.entity_id,
  };
  const to = {
    entity_type: canonicalType(target.entity_type),
    entity_id: target.entity_id,
  };
  const relationship_type = asText(relationshipType, 120);
  const provenance = {
    source_domain: sourceOfTruth,
    source_model: sourceOfTruth,
    source_record_id: sourceRecordId,
    source_tenant_id: sourceTenantId || null,
    relationship_type,
    owner,
    persistence: persistedOrDerived,
    derivation_rule: derivationRule,
    inputs: sourceInputs,
  };
  const isDerived = persistedOrDerived === 'derived';
  return {
    id: edgeIdentity({ tenantId, source: from, target: to, relationshipType: relationship_type, provenance, isDerived }),
    tenant_id: tenantId,
    source_node_id: nodeIdentity({ tenantId, entityType: from.entity_type, entityId: from.entity_id }),
    target_node_id: nodeIdentity({ tenantId, entityType: to.entity_type, entityId: to.entity_id }),
    source: from,
    target: to,
    relationship_type,
    cardinality,
    source_of_truth: sourceOfTruth,
    owner,
    provenance,
    temporal: {
      relationship_time: temporal.relationship_time || temporal.valid_from || null,
      valid_from: temporal.valid_from || null,
      valid_to: temporal.valid_to || null,
      projected_at: temporal.projected_at || null,
    },
    persisted_or_derived: persistedOrDerived,
    is_derived: isDerived,
    confidence,
    metadata: asObject(metadata),
  };
}

function nodePairs(nodes) {
  return JSON.stringify(nodes.map((node) => ({
    entity_type: canonicalType(node.entity_type),
    entity_id: node.entity_id,
  })));
}

function rowTenantMatches(row, tenantId) {
  return !row.tenant_id || row.tenant_id === tenantId;
}

const ADAPTERS = Object.freeze([
  {
    key: 'requirement_control_mapping',
    owner: 'grc.service.js',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:requirement_control_mapping */
         SELECT id, tenant_id, requirement_id, tenant_control_id, catalog_control_id,
                mapping_type, coverage_level, source_type, status, created_at, updated_at
           FROM grc_requirement_control_mappings m
          WHERE (m.tenant_id=$1::uuid OR m.tenant_id IS NULL)
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='requirement' AND n.entity_id=m.requirement_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='control' AND n.entity_id=m.tenant_control_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='catalog_control' AND n.entity_id=m.catalog_control_id)
            )
          ORDER BY m.created_at DESC, m.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.map((row) => graphEdge({
        tenantId,
        source: { entity_type: 'requirement', entity_id: row.requirement_id },
        target: { entity_type: row.tenant_control_id ? 'control' : 'catalog_control', entity_id: row.tenant_control_id || row.catalog_control_id },
        relationshipType: 'maps_to_control',
        sourceOfTruth: 'grc_requirement_control_mappings',
        owner: this.owner,
        sourceRecordId: row.id,
        sourceTenantId: row.tenant_id || null,
        temporal: { relationship_time: row.created_at, valid_from: row.created_at, projected_at: null },
        cardinality: 'N:N',
        metadata: {
          mapping_type: row.mapping_type,
          coverage_level: row.coverage_level,
          source_type: row.source_type,
          status: row.status,
        },
      })).filter((edge) => edge.target.entity_id);
    },
  },
  {
    key: 'evidence_entity_link',
    owner: 'grc.service.js',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:evidence_entity_link */
         SELECT id, tenant_id, evidence_id, entity_type, entity_id, created_at
           FROM grc_evidence_links l
          WHERE l.tenant_id=$1::uuid
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='evidence' AND n.entity_id=l.evidence_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(l.entity_type) AND n.entity_id=l.entity_id)
            )
          ORDER BY l.created_at DESC, l.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: 'evidence', entity_id: row.evidence_id },
        target: { entity_type: row.entity_type, entity_id: row.entity_id },
        relationshipType: 'evidences',
        sourceOfTruth: 'grc_evidence_links',
        owner: this.owner,
        sourceRecordId: row.id,
        temporal: { relationship_time: row.created_at, valid_from: row.created_at },
        cardinality: 'N:N',
      }));
    },
  },
  {
    key: 'generic_phase2_relation',
    owner: 'phase2.service.js/phase3.service.js',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:generic_phase2_relation */
         SELECT id, tenant_id, source_type, source_id, target_type, target_id, relation_type,
                status, valid_from, valid_to, provenance, confidence, version, created_at
           FROM grc_phase2_relations r
          WHERE r.tenant_id=$1::uuid
            AND r.status='active'
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(r.source_type) AND n.entity_id=r.source_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(r.target_type) AND n.entity_id=r.target_id)
            )
          ORDER BY r.created_at DESC, r.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: row.source_type, entity_id: row.source_id },
        target: { entity_type: row.target_type, entity_id: row.target_id },
        relationshipType: row.relation_type,
        sourceOfTruth: 'grc_phase2_relations',
        owner: this.owner,
        sourceRecordId: row.id,
        confidence: normalizeConfidence(row.confidence, 'percent'),
        temporal: { relationship_time: row.valid_from || row.created_at, valid_from: row.valid_from, valid_to: row.valid_to },
        cardinality: 'N:N',
        metadata: { status: row.status, version: row.version, provenance: asObject(row.provenance) },
      }));
    },
  },
  {
    key: 'operational_dependency',
    owner: 'phase3.service.js',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:operational_dependency */
         SELECT id, tenant_id, source_type, source_id, target_type, target_id, dependency_type,
                criticality, is_mandatory, source_reference, valid_from, valid_to, provenance, created_at
           FROM grc_operational_dependencies d
          WHERE d.tenant_id=$1::uuid
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(d.source_type) AND n.entity_id=d.source_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(d.target_type) AND n.entity_id=d.target_id)
            )
          ORDER BY d.created_at DESC, d.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: row.source_type, entity_id: row.source_id },
        target: { entity_type: row.target_type, entity_id: row.target_id },
        relationshipType: row.dependency_type,
        sourceOfTruth: 'grc_operational_dependencies',
        owner: this.owner,
        sourceRecordId: row.id,
        temporal: { relationship_time: row.valid_from || row.created_at, valid_from: row.valid_from, valid_to: row.valid_to },
        cardinality: 'N:N',
        metadata: {
          criticality: row.criticality,
          is_mandatory: row.is_mandatory,
          source_reference: row.source_reference,
          provenance: asObject(row.provenance),
        },
      }));
    },
  },
  {
    key: 'process_entity_link',
    owner: 'process services',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:process_entity_link */
         SELECT id, tenant_id, process_id, operation_id, target_type, target_id,
                relation_type, source, is_active, created_at, updated_at
           FROM tenant_process_entity_links l
          WHERE l.tenant_id=$1::uuid
            AND l.is_active=TRUE
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='process' AND n.entity_id=l.process_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(l.target_type) AND n.entity_id=l.target_id)
            )
          ORDER BY l.updated_at DESC, l.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: 'process', entity_id: row.process_id },
        target: { entity_type: row.target_type, entity_id: row.target_id },
        relationshipType: row.relation_type,
        sourceOfTruth: 'tenant_process_entity_links',
        owner: this.owner,
        sourceRecordId: row.id,
        temporal: { relationship_time: row.created_at, valid_from: row.created_at },
        cardinality: 'N:N',
        metadata: { source: row.source, operation_id: row.operation_id || null, is_active: row.is_active === true },
      }));
    },
  },
  {
    key: 'canonical_observation_relation',
    owner: 'semanticLayer.service.js',
    persistedOrDerived: 'persisted',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:canonical_observation_relation */
         SELECT id, tenant_id, observation_id, related_entity_type, related_entity_id,
                relation_type, confidence, valid_from, valid_until, metadata, created_at
           FROM grc_observation_relations r
          WHERE r.tenant_id=$1::uuid
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='observation' AND n.entity_id=r.observation_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type=lower(r.related_entity_type) AND n.entity_id=r.related_entity_id)
            )
          ORDER BY r.created_at DESC, r.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: 'observation', entity_id: row.observation_id },
        target: { entity_type: row.related_entity_type, entity_id: row.related_entity_id },
        relationshipType: row.relation_type,
        sourceOfTruth: 'grc_observation_relations',
        owner: this.owner,
        sourceRecordId: row.id,
        confidence: normalizeConfidence(row.confidence, 'unit'),
        temporal: { relationship_time: row.valid_from || row.created_at, valid_from: row.valid_from, valid_to: row.valid_until },
        cardinality: 'N:N',
        metadata: asObject(row.metadata),
      }));
    },
  },
  {
    key: 'gap_derivation',
    owner: 'grcGap.service.js',
    persistedOrDerived: 'derived',
    async edges(pool, tenantId, nodes, limit) {
      const result = await pool.query(
        `/* impact_graph:gap_derivation */
         SELECT id, tenant_id, source_observation_id, latest_source_observation_id,
                gap_type, rule_code, rule_version, first_seen, last_seen,
                last_evaluated_at, status, severity, metadata
           FROM grc_gaps g
          WHERE g.tenant_id=$1::uuid
            AND (
              EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='observation' AND n.entity_id=g.source_observation_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='observation' AND n.entity_id=g.latest_source_observation_id)
              OR EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) n(entity_type text, entity_id uuid)
                       WHERE n.entity_type='grc_gap' AND n.entity_id=g.id)
            )
          ORDER BY g.last_evaluated_at DESC, g.id
          LIMIT $3`,
        [tenantId, nodePairs(nodes), limit]
      );
      return result.rows.filter((row) => rowTenantMatches(row, tenantId)).map((row) => graphEdge({
        tenantId,
        source: { entity_type: 'observation', entity_id: row.latest_source_observation_id || row.source_observation_id },
        target: { entity_type: 'grc_gap', entity_id: row.id },
        relationshipType: 'derives_gap',
        sourceOfTruth: 'grc_gaps',
        owner: this.owner,
        sourceRecordId: row.id,
        persistedOrDerived: 'derived',
        temporal: { relationship_time: row.first_seen, valid_from: row.first_seen, valid_to: null },
        cardinality: 'N:1',
        derivationRule: `${row.rule_code}@${row.rule_version}`,
        sourceInputs: [{ entity_type: 'observation', entity_id: row.latest_source_observation_id || row.source_observation_id }],
        metadata: {
          gap_type: row.gap_type,
          rule_code: row.rule_code,
          rule_version: Number(row.rule_version),
          status: row.status,
          severity: row.severity,
          last_seen: row.last_seen,
          last_evaluated_at: row.last_evaluated_at,
          gap_metadata: asObject(row.metadata),
        },
      }));
    },
  },
]);

function createImpactGraphService(pool, { GrcError, assertUuid, now = () => new Date().toISOString() } = {}) {
  function uuid(value, code = 'GRAPH_ENTITY_ID_INVALID') {
    return assertUuid ? assertUuid(value, code) : asText(value, 80);
  }

  function nodeFromInput({ tenantId, entityType, entityId }) {
    const type = canonicalType(entityType);
    if (!type) throw new GrcError('GRAPH_NODE_TYPE_REQUIRED', 'Tipo de nodo requerido.', 400);
    return graphNode({ tenantId, entityType: type, entityId: uuid(entityId) });
  }

  async function readEdgesForNodes(tenantId, nodes, maxEdges) {
    if (!tenantId) throw new GrcError('GRAPH_TENANT_REQUIRED', 'Tenant requerido para proyectar grafo.', 400);
    const remaining = () => Math.max(0, maxEdges - edgeMap.size);
    const edgeMap = new Map();
    for (const adapter of ADAPTERS) {
      if (remaining() <= 0) break;
      const edges = await adapter.edges(pool, tenantId, nodes, remaining());
      for (const edge of edges) {
        if (edge.tenant_id !== tenantId) {
          throw new GrcError('GRAPH_CROSS_TENANT_EDGE', 'Arista de grafo cruza tenant.', 500);
        }
        if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
        if (edgeMap.size >= maxEdges) break;
      }
    }
    return [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  function projection({ tenantId, seed, nodes, edges, depth, limits, projectedAt }) {
    const nodeMap = new Map();
    for (const node of nodes) nodeMap.set(node.id, node);
    for (const edge of edges) {
      nodeMap.set(edge.source_node_id, graphNode({ tenantId, entityType: edge.source.entity_type, entityId: edge.source.entity_id }));
      nodeMap.set(edge.target_node_id, graphNode({ tenantId, entityType: edge.target.entity_type, entityId: edge.target.entity_id }));
    }
    return {
      model_version: GRAPH_MODEL_VERSION,
      tenant_id: tenantId,
      seed,
      projected_at: projectedAt,
      depth,
      limits,
      nodes: [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
      edges: edges.map((edge) => ({
        ...edge,
        temporal: { ...edge.temporal, projected_at: edge.temporal.projected_at || projectedAt },
      })),
    };
  }

  async function getNodeRelationships({ tenantId, entityType, entityId, direction = 'both', limit = DEFAULT_MAX_EDGES, projectedAt = now() }) {
    const maxEdges = clampInt(limit, DEFAULT_MAX_EDGES, 1, HARD_MAX_EDGES);
    const seed = nodeFromInput({ tenantId, entityType, entityId });
    const edges = (await readEdgesForNodes(tenantId, [seed], maxEdges)).filter((edge) => {
      if (direction === 'outgoing') return edge.source_node_id === seed.id;
      if (direction === 'incoming') return edge.target_node_id === seed.id;
      return edge.source_node_id === seed.id || edge.target_node_id === seed.id;
    }).slice(0, maxEdges);
    return projection({
      tenantId,
      seed,
      nodes: [seed],
      edges,
      depth: 1,
      limits: { max_edges: maxEdges, max_nodes: HARD_MAX_NODES },
      projectedAt,
    });
  }

  async function getNeighborhood({ tenantId, entityType, entityId, depth = DEFAULT_DEPTH, maxNodes = DEFAULT_MAX_NODES, maxEdges = DEFAULT_MAX_EDGES, projectedAt = now() }) {
    const boundedDepth = clampInt(depth, DEFAULT_DEPTH, 0, MAX_DEPTH);
    const boundedMaxNodes = clampInt(maxNodes, DEFAULT_MAX_NODES, 1, HARD_MAX_NODES);
    const boundedMaxEdges = clampInt(maxEdges, DEFAULT_MAX_EDGES, 1, HARD_MAX_EDGES);
    const seed = nodeFromInput({ tenantId, entityType, entityId });
    const nodeMap = new Map([[seed.id, seed]]);
    const edgeMap = new Map();
    let frontier = [seed];

    for (let level = 0; level < boundedDepth && frontier.length && edgeMap.size < boundedMaxEdges; level += 1) {
      const edges = await readEdgesForNodes(tenantId, frontier, boundedMaxEdges - edgeMap.size);
      const next = [];
      for (const edge of edges) {
        if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
        for (const endpoint of [edge.source, edge.target]) {
          const node = graphNode({ tenantId, entityType: endpoint.entity_type, entityId: endpoint.entity_id });
          if (!nodeMap.has(node.id) && nodeMap.size < boundedMaxNodes) {
            nodeMap.set(node.id, node);
            next.push(node);
          }
        }
        if (nodeMap.size >= boundedMaxNodes || edgeMap.size >= boundedMaxEdges) break;
      }
      frontier = next;
    }

    return projection({
      tenantId,
      seed,
      nodes: [...nodeMap.values()],
      edges: [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
      depth: boundedDepth,
      limits: { max_nodes: boundedMaxNodes, max_edges: boundedMaxEdges },
      projectedAt,
    });
  }

  return {
    modelVersion: GRAPH_MODEL_VERSION,
    adapters: ADAPTERS.map((adapter) => ({
      key: adapter.key,
      owner: adapter.owner,
      persisted_or_derived: adapter.persistedOrDerived,
    })),
    getNodeRelationships,
    getNeighborhood,
    nodeIdentity,
    edgeIdentity,
  };
}

module.exports = {
  GRAPH_MODEL_VERSION,
  createImpactGraphService,
  nodeIdentity,
  edgeIdentity,
};
