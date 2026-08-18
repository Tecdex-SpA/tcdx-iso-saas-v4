'use strict';

const assert = require('assert');
const { createGrcService, GrcError } = require('./grc.service');

const TENANT_A = '70000000-0000-4000-8000-000000000801';
const TENANT_B = '70000000-0000-4000-8000-000000000802';
const USER_A = '70000000-0000-4000-8000-000000000803';
const FINDING_A = '70000000-0000-4000-8000-000000000804';
const ACTION_A = '70000000-0000-4000-8000-000000000805';
const OBSERVATION_A = '70000000-0000-4000-8000-000000000806';
const LINK_A = '70000000-0000-4000-8000-000000000807';

function observationPool() {
  const calls = [];
  const observations = new Map();
  const links = [];
  const sourceTables = new Set(['findings', 'action_plans']);
  let sequence = 0;

  function key(tenantId, id) {
    return `${tenantId}:${id}`;
  }

  async function query(sql, values = []) {
    const text = String(sql);
    calls.push({ sql: text, values });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [], rowCount: 0 };

    if (text.includes('information_schema.tables')) {
      return { rows: sourceTables.has(values[0]) ? [{ exists: 1 }] : [], rowCount: sourceTables.has(values[0]) ? 1 : 0 };
    }

    if (text.includes('FROM findings')) {
      if (values[0] === TENANT_A && values[1] === FINDING_A) {
        return { rows: [{ id: FINDING_A, tenant_id: TENANT_A, label: 'Audit finding A' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (text.includes('FROM action_plans')) {
      if (values[0] === TENANT_A && values[1] === ACTION_A) {
        return { rows: [{ id: ACTION_A, tenant_id: TENANT_A, label: 'Action A' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (text.includes('INSERT INTO grc_observations')) {
      const tenantId = values[0];
      const observationKey = values[1];
      const existing = [...observations.values()].find((row) => row.tenant_id === tenantId && row.observation_key === observationKey);
      if (existing) return { rows: [], rowCount: 0 };
      sequence += 1;
      const row = {
        id: sequence === 1 ? OBSERVATION_A : `70000000-0000-4000-8000-0000000008${String(sequence).padStart(2, '0')}`,
        tenant_id: tenantId,
        observation_key: observationKey,
        observation_hash: values[2],
        observation_type: values[3],
        domain: values[4],
        title: values[5],
        description: values[6],
        status: values[7],
        severity: values[8],
        source_type: values[9],
        source_id: values[10],
        source_reference: JSON.parse(values[11]),
        observed_at: values[12],
        effective_from: values[13],
        effective_to: values[14],
        owner_user_id: values[15],
        responsible_user_id: values[16],
        created_by: values[17],
        metadata: JSON.parse(values[18]),
        correlation_id: values[19],
        created_at: '2026-08-18T00:00:00.000Z',
        updated_at: '2026-08-18T00:00:00.000Z',
      };
      observations.set(key(tenantId, row.id), row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.includes('FROM grc_observations') && text.includes('observation_key')) {
      const row = [...observations.values()].find((item) => item.tenant_id === values[0] && item.observation_key === values[1]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (text.includes('FROM grc_observations') && text.includes('ORDER BY')) {
      const rows = [...observations.values()].filter((item) => item.tenant_id === values[0]);
      return { rows, rowCount: rows.length };
    }

    if (text.includes('FROM grc_observations')) {
      const row = observations.get(key(values[0], values[1]));
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (text.includes('UPDATE grc_observations') && text.includes('SET status')) {
      const row = observations.get(key(values[2], values[3]));
      Object.assign(row, { status: values[0], metadata: { ...row.metadata, ...JSON.parse(values[1]) } });
      return { rows: [row], rowCount: 1 };
    }

    if (text.includes('INSERT INTO grc_observation_links')) {
      const row = {
        id: LINK_A,
        tenant_id: values[0],
        observation_id: values[1],
        target_type: values[2],
        target_id: values[3],
        relation_type: values[4],
        source: values[5],
        metadata: JSON.parse(values[6]),
        created_by: values[7],
        is_active: true,
      };
      links.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.includes('INSERT INTO audit_event_log')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }

  return {
    calls,
    links,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

async function run() {
  const pool = observationPool();
  const service = createGrcService(pool, { createJob: async () => ({ id: 'job' }) });

  const created = await service.createObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    correlationId: 'obs-test-1',
    body: {
      observation_type: 'finding',
      domain: 'audit',
      title: 'Control evidence is incomplete',
      severity: 'high',
      source_type: 'finding',
      source_id: FINDING_A,
      observed_at: '2026-08-18T12:00:00.000Z',
      metadata: { rule: 'test' },
    },
  });

  assert.equal(created.tenant_id, TENANT_A);
  assert.equal(created.source_type, 'finding');
  assert.equal(created.source_id, FINDING_A);
  assert.equal(created.source_reference.source_table, 'findings');
  assert.equal(created.metadata.model_version, 'grc-observation-model-v1');

  const replay = await service.createObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    correlationId: 'obs-test-2',
    body: {
      observation_type: 'finding',
      domain: 'audit',
      title: 'Control evidence is incomplete',
      severity: 'high',
      source_type: 'finding',
      source_id: FINDING_A,
      observed_at: '2026-08-18T12:00:00.000Z',
    },
  });
  assert.equal(replay.id, created.id);
  assert.equal(replay.idempotent_replay, true);

  await assert.rejects(
    () => service.createObservation({
      tenantId: TENANT_B,
      userId: USER_A,
      body: {
        observation_type: 'finding',
        domain: 'audit',
        title: 'Cross tenant source',
        severity: 'medium',
        source_type: 'finding',
        source_id: FINDING_A,
        observed_at: '2026-08-18T12:00:00.000Z',
      },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_SOURCE_NOT_FOUND'
  );

  await assert.rejects(
    () => service.createObservation({
      tenantId: TENANT_A,
      userId: USER_A,
      body: {
        observation_type: 'observation',
        domain: 'general',
        title: 'Invalid severity',
        severity: 'urgent',
        source_type: 'manual',
        observed_at: '2026-08-18T12:00:00.000Z',
      },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_SEVERITY_INVALID'
  );

  const emptyTenant = await service.listObservations({ tenantId: TENANT_B, filters: {} });
  assert.deepEqual(emptyTenant.data, []);

  const transitioned = await service.transitionObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    observationId: created.id,
    body: { status: 'under_review', reason: 'Triage started' },
  });
  assert.equal(transitioned.status, 'under_review');

  await assert.rejects(
    () => service.transitionObservation({
      tenantId: TENANT_A,
      userId: USER_A,
      observationId: created.id,
      body: { status: 'closed' },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_TRANSITION_INVALID'
  );

  const link = await service.linkObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    observationId: created.id,
    body: {
      target_type: 'action',
      target_id: ACTION_A,
      relation_type: 'remediated_by',
    },
  });
  assert.equal(link.tenant_id, TENANT_A);
  assert.equal(link.target_type, 'action');
  assert.equal(link.metadata.target.source_table, 'action_plans');

  await assert.rejects(
    () => service.getObservation({ tenantId: TENANT_B, observationId: created.id }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_NOT_FOUND'
  );

  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO audit_event_log')));
  assert.ok(pool.calls.every((call) => {
    if (!call.sql.includes('grc_observations') && !call.sql.includes('grc_observation_links')) return true;
    return call.sql.includes('tenant_id');
  }));

  console.log('grcObservation.service tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
