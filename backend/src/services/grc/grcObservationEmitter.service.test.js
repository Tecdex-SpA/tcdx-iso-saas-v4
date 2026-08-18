'use strict';

const assert = require('assert');
const { createObservationEmitterService, buildOfficialCalculationEvent } = require('./grcObservationEmitter.service');

const TENANT_A = '70000000-0000-4000-8000-000000000901';
const TENANT_B = '70000000-0000-4000-8000-000000000902';
const USER_A = '70000000-0000-4000-8000-000000000903';
const RUN_A1 = '70000000-0000-4000-8000-000000000911';
const RUN_A2 = '70000000-0000-4000-8000-000000000912';
const RUN_B1 = '70000000-0000-4000-8000-000000000913';
const RUN_A3 = '70000000-0000-4000-8000-000000000914';
const RUN_A4 = '70000000-0000-4000-8000-000000000915';
const RUN_A5 = '70000000-0000-4000-8000-000000000916';
const RUN_A6 = '70000000-0000-4000-8000-000000000917';
const SNAP_A1 = '70000000-0000-4000-8000-000000000921';
const SNAP_A2 = '70000000-0000-4000-8000-000000000922';
const SNAP_B1 = '70000000-0000-4000-8000-000000000923';
const SNAP_A3 = '70000000-0000-4000-8000-000000000924';
const SNAP_A4 = '70000000-0000-4000-8000-000000000925';
const SNAP_A5 = '70000000-0000-4000-8000-000000000926';
const SNAP_A6 = '70000000-0000-4000-8000-000000000927';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function eventId(index) {
  return `70000000-0000-4000-8000-0000000009${String(30 + index).padStart(2, '0')}`;
}

function observationId(index) {
  return `70000000-0000-4000-8000-0000000009${String(60 + index).padStart(2, '0')}`;
}

function fakePool() {
  const outbox = [];
  const calculations = new Map([
    [RUN_A1, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A1]) }],
    [RUN_A2, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A2]) }],
    [RUN_B1, { tenant_id: TENANT_B, snapshots: new Set([SNAP_B1]) }],
    [RUN_A3, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A3]) }],
    [RUN_A4, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A4]) }],
    [RUN_A5, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A5]) }],
    [RUN_A6, { tenant_id: TENANT_A, snapshots: new Set([SNAP_A6]) }],
  ]);
  const calls = [];

  async function query(sql, values = []) {
    const text = String(sql);
    calls.push({ sql: text, values });
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };

    if (text.includes('INSERT INTO grc_observation_emission_outbox')) {
      const existing = outbox.find((item) => item.tenant_id === values[0] && item.idempotency_key === values[11]);
      if (existing) return { rows: [], rowCount: 0 };
      const row = {
        id: eventId(outbox.length + 1),
        tenant_id: values[0],
        event_type: values[1],
        producer_type: values[2],
        producer_id: values[3],
        aggregate_type: values[4],
        aggregate_id: values[5],
        source_table: values[6],
        source_record_id: values[7],
        source_snapshot_id: values[8],
        rule_code: values[9],
        rule_version: values[10],
        idempotency_key: values[11],
        observation_identity: JSON.parse(values[12]),
        observed_at: values[13],
        period_start: values[14],
        period_end: values[15],
        status: values[16],
        attempts: 0,
        max_attempts: 3,
        correlation_id: values[17],
        payload: JSON.parse(values[18]),
        result: JSON.parse(values[19]),
        created_by: values[20],
        metadata: JSON.parse(values[21]),
        observation_id: null,
      };
      outbox.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }

    if (text.includes('SELECT * FROM grc_observation_emission_outbox WHERE tenant_id=$1::uuid AND idempotency_key=$2')) {
      const row = outbox.find((item) => item.tenant_id === values[0] && item.idempotency_key === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (text.includes('SELECT * FROM grc_observation_emission_outbox') && text.includes('FOR UPDATE')) {
      const row = outbox.find((item) => item.id === values[0] && item.tenant_id === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (text.includes('FROM calculation_runs cr')) {
      const run = calculations.get(values[1]);
      const snapshotMatches = !values[2] || run?.snapshots.has(values[2]) === true;
      if (!run || run.tenant_id !== values[0]) return { rows: [], rowCount: 0 };
      return { rows: [{ id: values[1], tenant_id: values[0], snapshot_matches: snapshotMatches }], rowCount: 1 };
    }

    if (text.includes("SET status='processing'")) {
      const row = outbox.find((item) => item.id === values[0] && item.tenant_id === values[1]);
      row.status = 'processing';
      row.attempts = values[2];
      row.last_error = null;
      return { rows: [clone(row)], rowCount: 1 };
    }

    if (text.includes("SET status='completed'")) {
      const row = outbox.find((item) => item.id === values[0] && item.tenant_id === values[1]);
      row.status = 'completed';
      row.observation_id = values[2];
      row.result = JSON.parse(values[3]);
      return { rows: [clone(row)], rowCount: 1 };
    }

    if (text.includes('SET status=$3')) {
      const row = outbox.find((item) => item.id === values[0] && item.tenant_id === values[1]);
      row.status = values[2];
      row.last_error = JSON.parse(values[3]);
      return { rows: [clone(row)], rowCount: 1 };
    }

    if (text.includes("status IN ('pending','failed')")) {
      const row = outbox.find((item) => item.tenant_id === values[0] && ['pending', 'failed'].includes(item.status));
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  return {
    outbox,
    calls,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

function fakeSemantic() {
  const observations = [];
  const calls = [];
  async function createManualObservation(scope, body) {
    calls.push({ scope, body });
    const identity = JSON.stringify(body.source_identity);
    const existing = observations.find((item) => item.tenant_id === scope.tenant_id && item.identity === identity && item.is_current);
    const content = JSON.stringify({
      status_value: body.status_value,
      severity_value: body.severity_value,
      numeric_value: body.numeric_value,
      data_trust: body.metadata?.data_trust,
      source_snapshot_id: body.metadata?.source_snapshot_id,
    });
    if (existing?.content === content) return { ...existing, idempotent_replay: true };
    const row = {
      id: observationId(observations.length + 1),
      tenant_id: scope.tenant_id,
      identity,
      content,
      is_current: true,
      supersedes_observation_id: existing?.id || null,
      ...body,
    };
    if (existing) {
      existing.is_current = false;
      existing.superseded_by_id = row.id;
    }
    observations.push(row);
    return row;
  }
  return { calls, observations, createManualObservation };
}

function calculatedResult(overrides = {}) {
  return {
    formula_code: 'F5_5_INHERENT_RISK',
    formula_version: 1,
    display_name: 'Inherent risk',
    domain: 'risk',
    status: 'calculated',
    value: 15,
    unit: 'score',
    calculation_run_id: RUN_A1,
    snapshot_id: SNAP_A1,
    period: { start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T00:00:00.000Z', timezone: 'UTC' },
    source_status: 'ready',
    source_code: 'risk_register_controls',
    source_contract: 'risk_register_controls',
    physical_sources: ['risk_register_controls'],
    source_counts: { received: 3, usable: 3, excluded: 0 },
    data_trust: { model_version: 'data-trust-model-v1', state: 'TRUSTED_WITH_WARNINGS', reasons: ['fallback_used'] },
    decision: { classification: 'attention' },
    warnings: ['fallback_used'],
    ...overrides,
  };
}

async function run() {
  const pool = fakePool();
  const semantic = fakeSemantic();
  const service = createObservationEmitterService(pool, { semantic });

  const pureEvent = buildOfficialCalculationEvent({ tenant_id: TENANT_A, user: { id: USER_A } }, calculatedResult(), 'corr-1', SNAP_A1);
  assert.equal(pureEvent.eligible, true);
  assert.equal(pureEvent.rule_code, 'official_calculation.data_trust_attention');
  assert.equal(pureEvent.observation_identity.producer_type, 'official_calculation');

  const created = await service.emitOfficialCalculationResult(
    { tenant_id: TENANT_A, user: { id: USER_A } },
    calculatedResult(),
    'corr-1',
    SNAP_A1
  );
  assert.equal(created.event.status, 'completed');
  assert.equal(created.observation.metadata.rule_version, 1);
  assert.equal(created.observation.correlation_id, 'corr-1');
  assert.equal(created.observation.source_table, 'calculation_runs');
  assert.equal(created.observation.metadata.source_snapshot_id, SNAP_A1);
  assert.equal(semantic.observations.length, 1);

  const replay = await service.emitOfficialCalculationResult(
    { tenant_id: TENANT_A, user: { id: USER_A } },
    calculatedResult(),
    'corr-1',
    SNAP_A1
  );
  assert.equal(replay.reused, true);
  assert.equal(pool.outbox.length, 1);
  assert.equal(semantic.observations.length, 1);

  const changed = await service.emitOfficialCalculationResult(
    { tenant_id: TENANT_A, user: { id: USER_A } },
    calculatedResult({
      calculation_run_id: RUN_A2,
      snapshot_id: SNAP_A2,
      value: 18,
      data_trust: { model_version: 'data-trust-model-v1', state: 'LOW_CONFIDENCE', reasons: ['high_exclusion_ratio'] },
      source_counts: { received: 10, usable: 6, excluded: 4 },
    }),
    'corr-2',
    SNAP_A2
  );
  assert.equal(changed.event.status, 'completed');
  assert.equal(changed.observation.supersedes_observation_id, created.observation.id);
  assert.equal(semantic.observations.filter((item) => item.is_current).length, 1);

  for (const nonEligible of [
    calculatedResult({ calculation_run_id: RUN_A3, snapshot_id: SNAP_A3, source_status: 'SOURCE_DATA_INSUFFICIENT', data_trust: { state: 'INSUFFICIENT_DATA' } }),
    calculatedResult({ calculation_run_id: RUN_A4, snapshot_id: SNAP_A4, source_status: 'SOURCE_SCHEMA_INCOMPATIBLE', data_trust: { state: 'UNTRUSTED' } }),
    calculatedResult({ calculation_run_id: RUN_A5, snapshot_id: SNAP_A5, status: 'dependency_pending', machine_reason: 'FORMULA_DEPENDENCY_PENDING' }),
    calculatedResult({ calculation_run_id: RUN_A6, snapshot_id: SNAP_A6, data_trust: { state: 'TRUSTED' } }),
  ]) {
    const result = await service.enqueueOfficialCalculationResult({ tenant_id: TENANT_A, user: { id: USER_A } }, nonEligible, 'ignored', nonEligible.snapshot_id);
    assert.equal(result.event.status, 'ignored');
  }
  assert.equal(semantic.observations.length, 2);

  await assert.rejects(
    () => service.emitOfficialCalculationResult(
      { tenant_id: TENANT_A, user: { id: USER_A } },
      calculatedResult({ calculation_run_id: RUN_B1, snapshot_id: SNAP_B1, data_trust: { state: 'LOW_CONFIDENCE' } }),
      'cross-tenant',
      SNAP_B1
    ),
    (error) => error.code === 'OBSERVATION_EMITTER_SOURCE_NOT_FOUND'
  );

  await assert.rejects(
    () => service.processOutboxEvent({ tenant_id: TENANT_B, user: { id: USER_A } }, created.event.id),
    (error) => error.code === 'OBSERVATION_EMITTER_EVENT_NOT_FOUND'
  );

  const retryPool = fakePool();
  const failingService = createObservationEmitterService(retryPool, {
    semantic: {
      async createManualObservation() {
        const error = new Error('semantic unavailable');
        error.code = 'SEMANTIC_DOWN';
        throw error;
      },
    },
  });
  const retry = await failingService.emitOfficialCalculationResult(
    { tenant_id: TENANT_A, user: { id: USER_A } },
    calculatedResult(),
    'retry',
    SNAP_A1
  );
  assert.equal(retry.event.status, 'failed');
  assert.equal(retry.event.attempts, 1);
  assert.equal(retryPool.outbox.length, 1);

  assert.equal(await service.processNextPending({ tenant_id: TENANT_B, user: { id: USER_A } }), null);
  assert.ok(pool.calls.every((call) => !call.sql.includes('grc_observation_' + 'links')));
  assert.ok(pool.calls.every((call) => !call.sql.includes('UPDATE grc_observations')));

  console.log('grcObservationEmitter.service tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
