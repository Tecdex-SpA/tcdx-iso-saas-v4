'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createGrcGapService } = require('./grcGap.service');

const TENANT_A = '80000000-0000-4000-8000-000000000001';
const TENANT_B = '80000000-0000-4000-8000-000000000002';
const USER_A = '80000000-0000-4000-8000-000000000003';
const OBS_A1 = '80000000-0000-4000-8000-000000000011';
const OBS_A2 = '80000000-0000-4000-8000-000000000012';
const OBS_A_BAD = '80000000-0000-4000-8000-000000000013';
const OBS_A_TRUSTED = '80000000-0000-4000-8000-000000000014';
const OBS_B1 = '80000000-0000-4000-8000-000000000021';
const RULE_ID = '80000000-0000-4000-8000-000000000031';

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

function observation(overrides = {}) {
  return {
    id: OBS_A1,
    tenant_id: TENANT_A,
    observation_type: 'official_calculation.data_trust_attention',
    entity_type: 'official_formula',
    entity_id: null,
    source_identity_hash: 'a'.repeat(64),
    observed_at: '2026-08-18T16:51:19.728Z',
    status_value: 'open',
    severity_value: 'medium',
    quality_status: 'valid',
    freshness_status: 'fresh',
    source_snapshot_id: '80000000-0000-4000-8000-000000000041',
    metadata: {
      data_trust: { state: 'LOW_CONFIDENCE', model_version: 'data-trust-model-v1' },
      source_status: 'ready',
    },
    is_current: true,
    ...overrides,
  };
}

function fakePool() {
  const state = {
    observations: [
      observation(),
      observation({ id: OBS_A2, observed_at: '2026-08-19T16:51:19.728Z', severity_value: 'high' }),
      observation({ id: OBS_A_BAD, source_identity_hash: 'b'.repeat(64), metadata: { data_trust: { state: 'INSUFFICIENT_DATA' } } }),
      observation({ id: OBS_A_TRUSTED, source_identity_hash: 'c'.repeat(64), metadata: { data_trust: { state: 'TRUSTED' } } }),
      observation({ id: OBS_B1, tenant_id: TENANT_B, source_identity_hash: 'd'.repeat(64) }),
    ],
    rules: [{
      id: RULE_ID,
      tenant_id: null,
      rule_code: 'observation.data_trust_attention_gap',
      rule_version: 1,
      rule_type: 'deterministic',
      input_observation_type: 'official_calculation.data_trust_attention',
      gap_type: 'data_trust_attention',
      status: 'published',
      enabled: true,
      metadata: { ai_created: false, owner: 'grc_gap_service' },
    }],
    gaps: [],
    history: [],
    hypotheses: [],
    relations: [],
    audits: [],
    calls: [],
  };

  async function query(sql, values = []) {
    const text = String(sql);
    state.calls.push({ sql: text, values });
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };

    if (text.includes('FROM grc_observations')) {
      const row = state.observations.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM grc_gap_rules')) {
      const row = state.rules.find((item) => (item.tenant_id === values[0] || item.tenant_id === null) &&
        item.rule_code === values[1] && item.rule_version === values[2] && item.status === 'published' && item.enabled === true);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM grc_gaps') && text.includes('gap_key') && text.includes('FOR UPDATE')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.gap_key === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('INSERT INTO grc_gaps')) {
      const row = {
        id: `80000000-0000-4000-8000-0000000000${50 + state.gaps.length}`,
        tenant_id: values[0],
        gap_key: values[1],
        gap_type: values[2],
        rule_id: values[3],
        rule_code: values[4],
        rule_version: values[5],
        source_observation_id: values[6],
        latest_source_observation_id: values[6],
        affected_entity_type: values[7],
        affected_entity_id: values[8],
        severity: values[9],
        status: 'open',
        first_seen: values[10],
        last_seen: values[10],
        last_evaluated_at: '2026-08-18T17:00:00.000Z',
        resolved_at: null,
        verified_at: null,
        is_current: true,
        correlation_id: values[11],
        created_by: values[12],
        updated_by: values[12],
        metadata: JSON.parse(values[13]),
        created_at: '2026-08-18T17:00:00.000Z',
        updated_at: '2026-08-18T17:00:00.000Z',
      };
      state.gaps.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (text.includes('UPDATE grc_gaps') && text.includes('latest_source_observation_id')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      row.latest_source_observation_id = values[2];
      row.severity = values[3];
      row.status = values[4];
      row.last_seen = [row.last_seen, values[5]].sort().at(-1);
      row.correlation_id = values[6] || row.correlation_id;
      row.updated_by = values[7];
      row.metadata = { ...row.metadata, ...JSON.parse(values[8]) };
      if (row.status === 'open') {
        row.resolved_at = null;
        row.verified_at = null;
      }
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (text.includes('INSERT INTO grc_gap_status_history')) {
      const row = {
        id: `history-${state.history.length + 1}`,
        tenant_id: values[0],
        gap_id: values[1],
        from_status: values[2],
        to_status: values[3],
        transition_type: values[4],
        actor_id: values[5],
        source_observation_id: values[6],
        rule_code: values[7],
        rule_version: values[8],
        reason: values[9],
        correlation_id: values[10],
        metadata: JSON.parse(values[11]),
      };
      state.history.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (text.includes('INSERT INTO grc_observation_relations')) {
      const observation = state.observations.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      const gap = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[2]);
      if (!observation || !gap) throw new Error('cross tenant relation rejected');
      const existing = state.relations.find((item) => item.tenant_id === values[0] &&
        item.observation_id === values[1] &&
        item.related_entity_type === 'grc_gap' &&
        item.related_entity_id === values[2] &&
        item.relation_type === 'supports');
      if (existing) {
        existing.confidence = 1;
        existing.valid_until = null;
        existing.metadata = { ...existing.metadata, ...JSON.parse(values[5]) };
        return { rows: [clone(existing)], rowCount: 1 };
      }
      const relation = {
        id: `relation-${state.relations.length + 1}`,
        tenant_id: values[0],
        observation_id: values[1],
        related_entity_type: 'grc_gap',
        related_entity_id: values[2],
        relation_type: 'supports',
        confidence: 1,
        valid_from: values[3],
        valid_until: null,
        created_by: values[4],
        metadata: JSON.parse(values[5]),
      };
      state.relations.push(relation);
      return { rows: [clone(relation)], rowCount: 1 };
    }
    if (text.includes('FROM grc_gaps') && text.includes('LIMIT $5')) {
      const rows = state.gaps.filter((item) => item.tenant_id === values[0] &&
        (!values[1] || item.status === values[1]) &&
        (!values[2] || item.gap_type === values[2]) &&
        (!values[3] || item.severity === values[3]));
      return { rows: clone(rows), rowCount: rows.length };
    }
    if (text.includes('FROM grc_gaps') && text.includes('id=$2::uuid') && text.includes('LIMIT 1')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM grc_gaps') && text.includes('FOR UPDATE')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('UPDATE grc_gaps') && text.includes('resolved_at=CASE')) {
      const row = state.gaps.find((item) => item.tenant_id === values[0] && item.id === values[1]);
      row.status = values[2];
      row.correlation_id = values[3] || row.correlation_id;
      row.updated_by = values[4];
      row.metadata = { ...row.metadata, ...JSON.parse(values[5]) };
      if (row.status === 'verified') row.verified_at = row.verified_at || '2026-08-18T17:30:00.000Z';
      if (row.status === 'closed') row.resolved_at = row.resolved_at || '2026-08-18T17:45:00.000Z';
      if (row.status === 'open') {
        row.verified_at = null;
        row.resolved_at = null;
      }
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (text.includes('INSERT INTO grc_gap_hypotheses')) {
      const existing = state.hypotheses.find((item) => item.tenant_id === values[0] && item.hypothesis_key === values[1]);
      if (existing) return { rows: [clone(existing)], rowCount: 1 };
      const row = {
        id: `hypothesis-${state.hypotheses.length + 1}`,
        tenant_id: values[0],
        hypothesis_key: values[1],
        source_type: values[2],
        source_id: values[3],
        title: values[4],
        statement: values[5],
        confidence: values[6],
        status: values[7],
        created_by: values[8],
        metadata: JSON.parse(values[9]),
      };
      state.hypotheses.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  return {
    state,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

function assertStaticMigrationContract() {
  const root = path.resolve(__dirname, '../../../..');
  const migration = fs.readFileSync(path.join(root, 'database/migrations/20260818_f6_8_03_grc_gap_model.sql'), 'utf8');
  const runner = fs.readFileSync(path.join(root, 'scripts/f6-8/apply-f6-8-migration.js'), 'utf8');
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS grc_gaps'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS grc_gap_rules'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS grc_gap_status_history'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS grc_gap_hypotheses'));
  assert.ok(migration.includes('idx_grc_gaps_tenant_gap_key'));
  assert.ok(migration.includes('protect_grc_gap_published_rule_version'));
  assert.ok(migration.includes("'observation.data_trust_attention_gap'"));
  assert.ok(migration.includes("'official_calculation.data_trust_attention'"));
  assert.ok(migration.includes('grc_observation_links'));
  assert.ok(!/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?grc_observation_links/i.test(migration));
  assert.ok(!/INSERT\s+INTO\s+grc_observations/i.test(migration));
  assert.ok(runner.includes('20260818_f6_8_03_grc_gap_model'));
  assert.ok(runner.includes('postconditionsGrcGapModel'));
}

async function run() {
  assertStaticMigrationContract();
  const pool = fakePool();
  const service = createGrcGapService(pool, {
    GrcError,
    assertUuid,
    audit: async (_client, event) => pool.state.audits.push(event),
    json: (value) => JSON.stringify(value === undefined ? {} : value),
  });

  assert.deepEqual(await service.listGaps({ tenantId: TENANT_A }), { data: [], model_version: 'grc-canonical-gap-model-v1' });

  const created = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A1, correlationId: 'gap-corr-1' });
  assert.equal(created.status, 'created');
  assert.equal(pool.state.gaps.length, 1);
  assert.equal(created.gap.first_seen, '2026-08-18T16:51:19.728Z');
  assert.equal(created.gap.last_seen, '2026-08-18T16:51:19.728Z');
  assert.equal(created.gap.metadata.rule.rule_code, 'observation.data_trust_attention_gap');
  assert.equal(created.gap.metadata.source_observation.id, OBS_A1);
  assert.equal(created.gap.metadata.hypothesis, false);
  assert.equal(pool.state.relations.length, 1);
  assert.equal(pool.state.relations[0].related_entity_type, 'grc_gap');
  assert.equal(pool.state.relations[0].relation_type, 'supports');

  const replay = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A1, correlationId: 'gap-corr-1' });
  assert.equal(replay.status, 'updated');
  assert.equal(pool.state.gaps.length, 1);
  assert.equal(pool.state.relations.length, 1);

  const confirmed = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A2, correlationId: 'gap-corr-2' });
  assert.equal(confirmed.status, 'updated');
  assert.equal(pool.state.gaps.length, 1);
  assert.equal(confirmed.gap.latest_source_observation_id, OBS_A2);
  assert.equal(confirmed.gap.severity, 'high');
  assert.equal(confirmed.gap.last_seen, '2026-08-19T16:51:19.728Z');
  assert.equal(pool.state.relations.length, 2);

  const badData = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A_BAD });
  assert.equal(badData.status, 'ignored');
  assert.equal(badData.reason, 'INSUFFICIENT_DATA');
  assert.equal(pool.state.gaps.length, 1);

  const trusted = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A_TRUSTED });
  assert.equal(trusted.status, 'ignored');
  assert.equal(trusted.reason, 'trusted_no_gap_condition');
  assert.equal(pool.state.gaps.length, 1);

  const gapId = created.gap.id;
  assert.equal((await service.getGap(TENANT_A, gapId)).id, gapId);
  await service.transitionGap({ tenantId: TENANT_A, userId: USER_A, gapId, body: { status: 'acknowledged', reason: 'accepted for treatment' } });
  await service.transitionGap({ tenantId: TENANT_A, userId: USER_A, gapId, body: { status: 'in_treatment' } });
  await service.transitionGap({ tenantId: TENANT_A, userId: USER_A, gapId, body: { status: 'verified' } });
  const closed = await service.transitionGap({ tenantId: TENANT_A, userId: USER_A, gapId, body: { status: 'closed' } });
  assert.equal(closed.status, 'closed');
  await assert.rejects(
    () => service.transitionGap({ tenantId: TENANT_A, userId: USER_A, gapId, body: { status: 'verified' } }),
    (error) => error.code === 'GAP_TRANSITION_INVALID'
  );

  const reopened = await service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_A2, correlationId: 'gap-reopen' });
  assert.equal(reopened.gap.status, 'open');
  assert.equal(pool.state.gaps.length, 1);
  assert.ok(pool.state.history.some((item) => item.transition_type === 'reopened'));

  await assert.rejects(
    () => service.evaluateObservation({ tenantId: TENANT_A, userId: USER_A, observationId: OBS_B1 }),
    (error) => error.code === 'GAP_SOURCE_OBSERVATION_NOT_FOUND'
  );
  await assert.rejects(
    () => service.getGap(TENANT_B, gapId),
    (error) => error.code === 'GAP_NOT_FOUND'
  );
  await assert.rejects(
    () => service.transitionGap({ tenantId: TENANT_B, userId: USER_A, gapId, body: { status: 'acknowledged' } }),
    (error) => error.code === 'GAP_NOT_FOUND'
  );

  const hypothesis = await service.recordHypothesis({
    tenantId: TENANT_A,
    userId: USER_A,
    body: { title: 'Possible systemic issue', statement: 'AI-only signal pending deterministic rule.', confidence: 0.7 },
  });
  assert.equal(hypothesis.deterministic_gap, false);
  assert.equal(pool.state.hypotheses.length, 1);
  assert.equal(pool.state.gaps.length, 1);

  const listed = await service.listGaps({ tenantId: TENANT_A, filters: { status: 'open' } });
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].numeric_value, undefined);
  assert.ok(pool.state.calls.every((call) => !call.sql.includes('findings')));
  assert.ok(pool.state.calls.every((call) => !call.sql.includes('grc_observation_' + 'links')));
  assert.ok(pool.state.calls.every((call) => !/INSERT\s+INTO\s+grc_observations/i.test(call.sql)));
  assert.equal(await service.listGaps({ tenantId: TENANT_B }).then((result) => result.data.length), 0);

  console.log('grcGap.service tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
