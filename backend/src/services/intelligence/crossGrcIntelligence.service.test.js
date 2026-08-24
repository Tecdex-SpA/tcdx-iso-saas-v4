const assert = require('node:assert/strict');
const {
  CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
  PATTERN_TREND_CONTRACT_VERSION,
  ANOMALY_ENGINE_CONTRACT_VERSION,
  CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION,
  buildUnifiedContext,
  evaluatePatternsAndTrends,
  evaluateAnomalies,
  createCrossGrcIntelligenceService,
} = require('./crossGrcIntelligence.service');

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = '2026-08-24T12:00:00.000Z';

function point(tenantId, value, month, idSuffix = value) {
  return {
    tenant_id: tenantId,
    signal_key: 'audit_readiness',
    source_model: 'official_calculation_snapshots',
    snapshot_id: `${tenantId.slice(0, 4)}-${idSuffix}`,
    period_start: `2026-${String(month).padStart(2, '0')}-01T00:00:00.000Z`,
    period_end: `2026-${String(month).padStart(2, '0')}-28T00:00:00.000Z`,
    value,
    data_trust: { state: 'TRUSTED' },
  };
}

function tenantDataset() {
  return {
    tenant: {
      tenant_id: TENANT_A,
      name: 'Tenant A',
      active_standards: [{ standard_code: 'ISO 27001' }],
    },
    priority_controls: [{
      tenant_id: TENANT_A,
      id: 'control-a',
      title: 'Access control',
      status: 'active',
      score: 80,
      data_trust: { state: 'TRUSTED' },
      observed_at: '2026-08-01T00:00:00.000Z',
    }, {
      tenant_id: TENANT_B,
      id: 'control-b',
      title: 'Foreign control',
      status: 'active',
      score: 1,
    }],
    recent_findings: [{
      tenant_id: TENANT_A,
      id: 'finding-a',
      title: 'Evidence stale',
      severity: 'high',
      status: 'open',
      observed_at: '2026-08-03T00:00:00.000Z',
    }, {
      tenant_id: TENANT_B,
      id: 'finding-b',
      title: 'Foreign finding',
      severity: 'critical',
      status: 'open',
    }],
    historical_context: [
      point(TENANT_A, 10, 1, 'a1'),
      point(TENANT_A, 11, 2, 'a2'),
      point(TENANT_A, 10, 3, 'a3'),
      point(TENANT_A, 12, 4, 'a4'),
      point(TENANT_A, 11, 5, 'a5'),
      point(TENANT_A, 60, 6, 'a6'),
      point(TENANT_B, 99, 1, 'b1'),
      point(TENANT_B, 100, 2, 'b2'),
      point(TENANT_B, 101, 3, 'b3'),
    ],
    knowledge_context: {
      knowledge_items_used: [{
        item_key: 'kb-1',
        source_record_id: 'chunk-a',
        title: 'Access control guidance',
        standard_code: 'ISO 27001',
        license_class: 'derived_summary',
      }],
    },
    regulatory_context: [{
      tenant_id: TENANT_A,
      id: 'pack-context-a',
      pack_key: 'GLOBAL-PRIVACY',
      lifecycle_status: 'published',
      contract_version: 'regulatory-pack-model-v1',
    }, {
      tenant_id: TENANT_B,
      id: 'pack-context-b',
      pack_key: 'FOREIGN',
      lifecycle_status: 'published',
    }],
    limitations: [],
  };
}

async function runContextBuilderTest() {
  const context = await buildUnifiedContext({
    tenantId: TENANT_A,
    dataset: tenantDataset(),
    requestId: 'req-context',
    now: () => NOW,
  });
  assert.equal(context.contract_version, CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION);
  assert.equal(context.tenant_id, TENANT_A);
  assert.equal(context.categories.facts.some((item) => item.source_record_id === 'control-b'), false);
  assert.equal(context.categories.facts.some((item) => item.source_record_id === 'finding-b'), false);
  assert.equal(context.categories.regulatory_context.length, 1);
  assert.equal(context.categories.retrieved_knowledge.length, 1);
  assert.equal(context.provenance.no_cross_tenant_fallback, true);
  assert.equal(context.data_trust.missing_is_not_zero, true);
}

async function runEmptyTenantTest() {
  const context = await buildUnifiedContext({
    tenantId: TENANT_A,
    dataset: { tenant: { tenant_id: TENANT_A }, limitations: [] },
    now: () => NOW,
  });
  assert.equal(context.ok, true);
  assert.ok(context.categories.insufficient_context.length > 0);
  const trends = evaluatePatternsAndTrends({ tenantId: TENANT_A, context, now: () => NOW });
  const anomalies = evaluateAnomalies({ tenantId: TENANT_A, context, now: () => NOW });
  assert.equal(trends.insufficient_data[0].reason, 'no_historical_context');
  assert.equal(anomalies.insufficient_data[0].reason, 'no_historical_context');
}

async function runPatternTrendAndAnomalyTest() {
  const context = await buildUnifiedContext({
    tenantId: TENANT_A,
    dataset: tenantDataset(),
    now: () => NOW,
  });
  const first = evaluatePatternsAndTrends({
    tenantId: TENANT_A,
    context,
    options: { thresholds: { 'official_calculation_snapshots:audit_readiness': 50 } },
    now: () => NOW,
  });
  const second = evaluatePatternsAndTrends({
    tenantId: TENANT_A,
    context,
    options: { thresholds: { 'official_calculation_snapshots:audit_readiness': 50 } },
    now: () => NOW,
  });
  assert.equal(first.contract_version, PATTERN_TREND_CONTRACT_VERSION);
  assert.equal(first.trends.length, 1);
  assert.equal(first.trends[0].trend_direction, 'increasing');
  assert.equal(first.patterns.length, 1);
  assert.equal(first.trends[0].signal_id, second.trends[0].signal_id);
  assert.equal(JSON.stringify(first).includes(TENANT_B), false);

  const anomalies = evaluateAnomalies({ tenantId: TENANT_A, context, now: () => NOW });
  assert.equal(anomalies.contract_version, ANOMALY_ENGINE_CONTRACT_VERSION);
  assert.equal(anomalies.anomalies.length, 1);
  assert.equal(anomalies.anomalies[0].band, 'critical');
  assert.equal(anomalies.provenance.llm_anomaly_truth_authority, false);
}

async function runOrchestratorDependencyReuseTest() {
  const calls = {
    priorityTenant: null,
    graphTenant: null,
    ragTenant: null,
    regulatoryTenant: null,
  };
  const service = createCrossGrcIntelligenceService({
    contextRepository: {
      async getTenantIntelligenceDataset({ tenantId }) {
        assert.equal(tenantId, TENANT_A);
        return tenantDataset();
      },
    },
    priorityEngine: {
      async listPriorities({ tenantId }) {
        calls.priorityTenant = tenantId;
        return {
          model_version: 'priority-engine-2-v1',
          tenant_id: tenantId,
          results: [{ subject_id: 'gap-a', priority_score: 80 }],
        };
      },
    },
    impactGraph: {
      async getNeighborhood({ tenantId }) {
        calls.graphTenant = tenantId;
        return {
          model_version: 'impact-graph-2-foundation-v1',
          tenant_id: tenantId,
          nodes: [],
          edges: [],
        };
      },
    },
    ragService: {
      async answer({ user }) {
        calls.ragTenant = user.tenant_id;
        return {
          contract_version: 'rag-grounded-answer-contract-v1',
          tenant_id: user.tenant_id,
          grounding_status: 'grounded',
          citations: [{ citation_id: 'cite-1' }],
        };
      },
    },
    regulatoryContextProvider: async ({ tenantId }) => {
      calls.regulatoryTenant = tenantId;
      return {
        status: 'available',
        contract_version: 'regulatory-pack-model-v1',
        items: [{ id: 'pack-context-a' }],
      };
    },
    now: () => NOW,
  });

  const result = await service.orchestrate({
    tenantId: TENANT_A,
    user: { tenant_id: TENANT_A, role: 'admin' },
    entity: { entity_type: 'grc_gap', entity_id: '11111111-1111-4111-8111-111111111111' },
    question: 'What changed?',
    requestId: 'req-orchestrator',
  });

  assert.equal(result.contract_version, CROSS_GRC_INTELLIGENCE_CONTRACT_VERSION);
  assert.equal(calls.priorityTenant, TENANT_A);
  assert.equal(calls.graphTenant, TENANT_A);
  assert.equal(calls.ragTenant, TENANT_A);
  assert.equal(calls.regulatoryTenant, TENANT_A);
  assert.equal(result.provenance.priority_engine_reused, true);
  assert.equal(result.provenance.impact_graph_reused, true);
  assert.equal(result.provenance.rag_reused, true);
  assert.equal(result.provenance.ai_cross_grc_truth_authority, false);
  assert.equal(result.provenance.llm_direct_sql, false);
  assert.equal(JSON.stringify(result).includes(TENANT_B), false);
}

async function runTests() {
  await runContextBuilderTest();
  await runEmptyTenantTest();
  await runPatternTrendAndAnomalyTest();
  await runOrchestratorDependencyReuseTest();
  console.log('crossGrcIntelligence.service.test.js PASS');
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
