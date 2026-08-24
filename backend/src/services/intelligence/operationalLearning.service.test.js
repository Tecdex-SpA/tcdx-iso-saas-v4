const assert = require('node:assert/strict');

const {
  RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION,
  EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION,
  OPERATIONAL_MEMORY_CONTRACT_VERSION,
  buildDecisionLedgerEntry,
  buildEffectivenessEvaluation,
  buildOperationalMemoryCase,
  createOperationalLearningService,
} = require('./operationalLearning.service');

const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor = '11111111-1111-4111-8111-111111111111';
const now = () => '2026-08-24T12:00:00.000Z';

function user(tenantId = tenantA) {
  return { id: actor, tenant_id: tenantId, role: 'admin' };
}

function recommendation(overrides = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    dedupe_key: 'iso:gap:critical:1',
    source_module: 'cross_grc_intelligence',
    source_entity_type: 'gap',
    source_entity_id: '33333333-3333-4333-8333-333333333333',
    target_record_type: 'action_plan',
    title: 'Cerrar brecha critica',
    recommendation_version: 'cross-grc-intelligence-orchestrator-v1',
    ...overrides,
  };
}

function runDecisionContractTest() {
  const input = {
    user: user(),
    recommendation: recommendation(),
    decision: 'accepted',
    decisionReason: 'Se acepta por evidencia y prioridad alta.',
    sourceIntelligenceContext: { context_key: 'ctx-1', contract_version: 'cross-grc-intelligence-orchestrator-v1' },
    priorityContext: { priority_key: 'prio-1', model_version: 'priority-engine-2-v1', band: 'critical' },
    correlationId: 'req-1',
    now,
  };
  const first = buildDecisionLedgerEntry(input);
  const second = buildDecisionLedgerEntry(input);
  assert.equal(first.contract_version, RECOMMENDATION_DECISION_LEDGER_CONTRACT_VERSION);
  assert.equal(first.decision_key, second.decision_key);
  assert.equal(first.idempotency_key, second.idempotency_key);
  assert.equal(first.provenance.ai_decision_authority, false);
  assert.equal(first.priority_context.priority_engine_reimplemented, false);
  assert.equal(first.decision_at, '2026-08-24T12:00:00.000Z');
}

function runDecisionValidationTest() {
  assert.throws(() => buildDecisionLedgerEntry({
    user: user(),
    recommendation: recommendation(),
    decision: 'published_by_ai',
    decisionReason: 'invalid',
    correlationId: 'req-2',
    now,
  }), { code: 'DECISION_LEDGER_DECISION_INVALID' });
  assert.throws(() => buildDecisionLedgerEntry({
    user: user(),
    recommendation: recommendation(),
    decision: 'accepted',
    decisionReason: '',
    correlationId: 'req-3',
    now,
  }), { code: 'DECISION_LEDGER_REASON_REQUIRED' });
}

function runEffectivenessSemanticsTest() {
  const effective = buildEffectivenessEvaluation({
    user: user(),
    decisionId: '44444444-4444-4444-8444-444444444444',
    beforeState: { metrics: { open_gap_count: 4 }, data_trust: { state: 'TRUSTED' } },
    afterState: { metrics: { open_gap_count: 2 }, data_trust: { state: 'TRUSTED' } },
    expectedOutcome: { metric: 'open_gap_count', direction: 'decrease', data_trust: { state: 'TRUSTED' } },
    correlationId: 'req-4',
    now,
  });
  assert.equal(effective.contract_version, EFFECTIVENESS_FEEDBACK_CONTRACT_VERSION);
  assert.equal(effective.effectiveness_result, 'effective');
  assert.equal(effective.observed_outcome.closed_equals_effective_assumption, false);
  assert.equal(effective.provenance.ai_effectiveness_truth_authority, false);

  const insufficient = buildEffectivenessEvaluation({
    user: user(),
    decisionId: '44444444-4444-4444-8444-444444444444',
    beforeState: { metrics: {}, data_trust: { state: 'INSUFFICIENT_DATA' } },
    afterState: { metrics: {}, data_trust: { state: 'TRUSTED' } },
    expectedOutcome: { metric: 'open_gap_count', direction: 'decrease' },
    correlationId: 'req-5',
    now,
  });
  assert.equal(insufficient.effectiveness_result, 'insufficient_data');
  assert.equal(insufficient.data_trust.insufficient_data_is_not_ineffective, true);
}

function runMemoryGovernanceTest() {
  const candidate = buildOperationalMemoryCase({
    user: user(),
    title: 'Caso de accion correctiva',
    summary: 'Se acepto una recomendacion y se evaluo contra evidencia posterior.',
    lifecycleStatus: 'candidate',
    caseType: 'ai_hypothesis',
    aiHypotheses: [{ hypothesis: 'Podria repetirse en auditorias similares.' }],
    correlationId: 'req-6',
    now,
  });
  assert.equal(candidate.contract_version, OPERATIONAL_MEMORY_CONTRACT_VERSION);
  assert.equal(candidate.confirmed_lessons.length, 0);
  assert.equal(candidate.provenance.ai_operational_memory_publish_authority, false);
  assert.equal(candidate.provenance.second_kb_created, false);
  assert.equal(candidate.provenance.second_retrieval_engine, false);

  assert.throws(() => buildOperationalMemoryCase({
    user: user(),
    title: 'Hipotesis IA',
    summary: 'Hipotesis no revisada.',
    lifecycleStatus: 'confirmed',
    caseType: 'ai_hypothesis',
    confirmationReason: 'No deberia aceptar.',
    correlationId: 'req-7',
    now,
  }), { code: 'OPERATIONAL_MEMORY_AI_CONFIRM_FORBIDDEN' });

  const confirmed = buildOperationalMemoryCase({
    user: user(),
    title: 'Leccion confirmada',
    summary: 'Evidencia posterior confirma la reduccion de brecha.',
    lifecycleStatus: 'confirmed',
    caseType: 'effectiveness_case',
    confirmedLessons: [{ lesson: 'Asignar owner con fecha mejora cierre.' }],
    confirmationReason: 'Revision humana con evidencia suficiente.',
    correlationId: 'req-8',
    now,
  });
  assert.equal(confirmed.confirmed_by, actor);
  assert.equal(confirmed.confirmed_lessons.length, 1);
}

function createFakePool() {
  const rows = [
    {
      id: 'case-a',
      tenant_id: tenantA,
      lifecycle_status: 'confirmed',
      title: 'Tenant A confirmed',
      summary: 'case for tenant A',
      created_at: '2026-08-24T12:00:00.000Z',
    },
    {
      id: 'case-b',
      tenant_id: tenantB,
      lifecycle_status: 'confirmed',
      title: 'Tenant B confirmed',
      summary: 'case for tenant B',
      created_at: '2026-08-24T12:00:00.000Z',
    },
  ];
  return {
    async query(sql, params) {
      assert.match(sql, /WHERE tenant_id = \$1::uuid/);
      const tenantId = params[0];
      const limit = params[params.length - 1];
      return { rows: rows.filter((row) => row.tenant_id === tenantId).slice(0, limit) };
    },
  };
}

async function runTenantIsolationSearchTest() {
  const service = createOperationalLearningService({ pool: createFakePool(), now });
  const a = await service.searchMemoryCases({ user: user(tenantA), limit: 10 });
  const b = await service.searchMemoryCases({ user: user(tenantB), limit: 10 });
  assert.equal(a.cases.length, 1);
  assert.equal(a.cases[0].tenant_id, tenantA);
  assert.equal(b.cases.length, 1);
  assert.equal(b.cases[0].tenant_id, tenantB);
  assert.equal(a.second_kb_created, false);
  assert.equal(a.second_retrieval_engine, false);
  assert.throws(() => buildDecisionLedgerEntry({
    user: {},
    recommendation: recommendation(),
    decision: 'accepted',
    decisionReason: 'missing tenant',
    correlationId: 'req-empty',
    now,
  }), { code: 'OPERATIONAL_LEARNING_TENANT_REQUIRED' });
}

async function main() {
  runDecisionContractTest();
  runDecisionValidationTest();
  runEffectivenessSemanticsTest();
  runMemoryGovernanceTest();
  await runTenantIsolationSearchTest();
  console.log('F6_13_A_OPERATIONAL_LEARNING_TESTS_OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
