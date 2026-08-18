'use strict';

const assert = require('assert');
const { GrcError } = require('./grc.service');

const TENANT_A = '70000000-0000-4000-8000-000000000801';
const TENANT_B = '70000000-0000-4000-8000-000000000802';
const USER_A = '70000000-0000-4000-8000-000000000803';
const FINDING_A = '70000000-0000-4000-8000-000000000804';
const ACTION_A = '70000000-0000-4000-8000-000000000805';
const OBSERVATION_A = '70000000-0000-4000-8000-000000000806';
const OBSERVATION_A2 = '70000000-0000-4000-8000-000000000816';
const RELATION_A = '70000000-0000-4000-8000-000000000807';

function observationPool() {
  const calls = [];
  const sourceTables = new Set(['findings', 'action_plans']);

  async function query(sql, values = []) {
    const text = String(sql);
    calls.push({ sql: text, values });

    if (text.includes('information_schema.tables')) {
      return { rows: sourceTables.has(values[0]) ? [{ exists: 1 }] : [], rowCount: sourceTables.has(values[0]) ? 1 : 0 };
    }
    if (text.includes('FROM findings')) {
      if (values[0] === TENANT_A && values[1] === FINDING_A) return { rows: [{ id: FINDING_A, tenant_id: TENANT_A, label: 'Audit finding A' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('FROM action_plans')) {
      if (values[0] === TENANT_A && values[1] === ACTION_A) return { rows: [{ id: ACTION_A, tenant_id: TENANT_A, label: 'Action A' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('INSERT INTO audit_event_log')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }

  return {
    calls,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

function canonicalRow(overrides = {}) {
  return {
    id: OBSERVATION_A,
    tenant_id: TENANT_A,
    observation_type: 'finding',
    entity_type: 'audit',
    entity_id: FINDING_A,
    contract_id: '70000000-0000-4000-8000-000000000811',
    contract_version_id: '70000000-0000-4000-8000-000000000812',
    source_table: 'findings',
    source_record_id: FINDING_A,
    source_identity_hash: 'a'.repeat(64),
    observed_at: '2026-08-18T12:00:00.000Z',
    period_start: null,
    period_end: null,
    status_value: 'open',
    severity_value: 'high',
    text_value: 'Control evidence is incomplete',
    numeric_value: null,
    boolean_value: null,
    quality_status: 'valid',
    quality_score: 100,
    freshness_status: 'fresh',
    freshness_age_seconds: 0,
    trust_score: 100,
    source_snapshot_id: '70000000-0000-4000-8000-000000000813',
    supersedes_observation_id: null,
    superseded_by_id: null,
    is_current: true,
    metadata: {
      content_hash: 'b'.repeat(64),
      grc_facade: {
        domain: 'audit',
        title: 'Control evidence is incomplete',
        description: null,
        status: 'open',
        severity: 'high',
        source_type: 'finding',
        source_id: FINDING_A,
        source_reference: { source_table: 'findings', source_label: 'Audit finding A' },
      },
    },
    ...overrides,
  };
}

function semanticFake() {
  const operations = [];
  const rowsByTenant = new Map([[TENANT_A, [canonicalRow()]], [TENANT_B, []]]);
  let created = null;
  let superseded = null;

  return {
    operations,
    async listObservations(scope) {
      operations.push({ op: 'list', tenant: scope.tenant_id });
      return rowsByTenant.get(scope.tenant_id) || [];
    },
    async getObservation(scope, id) {
      operations.push({ op: 'get', tenant: scope.tenant_id, id });
      const row = (rowsByTenant.get(scope.tenant_id) || []).find((item) => item.id === id && item.is_current !== false);
      if (!row) {
        const error = new Error('not found');
        error.code = 'SEMANTIC_OBSERVATION_NOT_FOUND';
        throw error;
      }
      return row;
    },
    async createManualObservation(scope, body) {
      operations.push({ op: 'createManualObservation', tenant: scope.tenant_id, body });
      if (created) return { ...created, idempotent_replay: true };
      created = canonicalRow({
        metadata: body.metadata,
        source_table: body.source_table,
        source_record_id: body.source_record_id,
        status_value: body.status_value,
        severity_value: body.severity_value,
        text_value: body.text_value,
      });
      rowsByTenant.set(scope.tenant_id, [created]);
      return created;
    },
    async supersedeObservation(scope, id, body) {
      operations.push({ op: 'supersedeObservation', tenant: scope.tenant_id, id, body });
      const current = await this.getObservation(scope, id);
      current.is_current = false;
      current.superseded_by_id = OBSERVATION_A2;
      superseded = canonicalRow({
        id: OBSERVATION_A2,
        status_value: body.status_value === undefined ? current.status_value : body.status_value,
        severity_value: body.severity_value === undefined ? current.severity_value : body.severity_value,
        text_value: body.text_value === undefined ? current.text_value : body.text_value,
        supersedes_observation_id: current.id,
        metadata: { ...current.metadata, ...(body.metadata || {}) },
      });
      rowsByTenant.set(scope.tenant_id, [superseded]);
      return superseded;
    },
    async createObservationRelation(scope, id, body) {
      operations.push({ op: 'createObservationRelation', tenant: scope.tenant_id, id, body });
      await this.getObservation(scope, id);
      return {
        id: RELATION_A,
        tenant_id: scope.tenant_id,
        observation_id: id,
        related_entity_type: body.related_entity_type,
        related_entity_id: body.related_entity_id,
        relation_type: body.relation_type,
        metadata: body.metadata,
      };
    },
  };
}

async function run() {
  const pool = observationPool();
  const semantic = semanticFake();

  const observationService = require('./grcObservation.service').createGrcObservationService(pool, {
    GrcError,
    assertUuid: (value, code = 'GRC_ID_REQUIRED') => {
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value || ''))) throw new GrcError(code, 'Identificador inválido.', 400);
      return value;
    },
    observe: () => {},
    audit: async (client, payload) => client.query('INSERT INTO audit_event_log VALUES ($1)', [payload.tableName]),
    json: (value) => JSON.stringify(value),
    semantic,
  });

  const created = await observationService.createObservation({
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
  assert.equal(created.status, 'open');
  assert.equal(created.severity, 'high');
  assert.equal(created.source_table, 'findings');
  assert.equal(created.source_snapshot_id, '70000000-0000-4000-8000-000000000813');
  assert.equal(semantic.operations.at(-1).op, 'createManualObservation');

  const replay = await observationService.createObservation({
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

  const listed = await observationService.listObservations({ tenantId: TENANT_A, filters: {} });
  assert.equal(listed.data.length, 1);
  assert.equal((await observationService.listObservations({ tenantId: TENANT_B, filters: {} })).data.length, 0);
  assert.equal((await observationService.getObservation(TENANT_A, created.id)).id, created.id);

  await assert.rejects(
    () => observationService.getObservation(TENANT_B, created.id),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_NOT_FOUND'
  );

  await assert.rejects(
    () => observationService.createObservation({
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

  const updated = await observationService.updateObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    observationId: created.id,
    body: { severity: 'critical', title: 'Control evidence remains incomplete' },
    correlationId: 'obs-update',
  });
  assert.equal(updated.id, OBSERVATION_A2);
  assert.equal(updated.supersedes_observation_id, created.id);
  assert.equal(updated.severity, 'critical');
  assert.equal(semantic.operations.filter((item) => item.op === 'supersedeObservation').length, 1);

  await assert.rejects(
    () => observationService.transitionObservation({
      tenantId: TENANT_B,
      userId: USER_A,
      observationId: updated.id,
      body: { status: 'under_review' },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_NOT_FOUND'
  );

  const transitioned = await observationService.transitionObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    observationId: updated.id,
    body: { status: 'under_review', reason: 'Triage started' },
  });
  assert.equal(transitioned.status, 'under_review');
  assert.equal(transitioned.supersedes_observation_id, updated.id);

  await assert.rejects(
    () => observationService.transitionObservation({
      tenantId: TENANT_A,
      userId: USER_A,
      observationId: transitioned.id,
      body: { status: 'closed' },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_TRANSITION_INVALID'
  );

  const relation = await observationService.linkObservation({
    tenantId: TENANT_A,
    userId: USER_A,
    observationId: transitioned.id,
    body: {
      target_type: 'action',
      target_id: ACTION_A,
      relation_type: 'remediated_by',
    },
  });
  assert.equal(relation.tenant_id, TENANT_A);
  assert.equal(relation.related_entity_type, 'action');
  assert.equal(relation.target_type, 'action');
  assert.equal(relation.relation_type, 'related_to');
  const relationOperation = semantic.operations.find((item) => item.op === 'createObservationRelation');
  assert.ok(relationOperation);
  assert.equal(relationOperation.body.metadata.api_name, 'links');

  await assert.rejects(
    () => observationService.linkObservation({
      tenantId: TENANT_B,
      userId: USER_A,
      observationId: transitioned.id,
      body: { target_type: 'action', target_id: ACTION_A, relation_type: 'relates_to' },
    }),
    (error) => error instanceof GrcError && error.code === 'OBSERVATION_NOT_FOUND'
  );

  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO audit_event_log')));
  assert.ok(semantic.operations.some((item) => item.op === 'createManualObservation'));
  assert.ok(semantic.operations.some((item) => item.op === 'createObservationRelation'));
  assert.ok(pool.calls.every((call) => !call.sql.includes('grc_observation_' + 'links')));
  assert.ok(pool.calls.every((call) => !call.sql.includes('observation' + '_key')));
  assert.ok(pool.calls.every((call) => !call.sql.includes('observation' + '_hash')));

  console.log('grcObservation.service tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
