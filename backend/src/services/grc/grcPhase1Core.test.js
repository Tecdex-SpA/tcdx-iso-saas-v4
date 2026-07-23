const assert = require('assert');
const { assertApprovalActor, evaluateApproval } = require('./grcApprovalRules');
const { buildGrcExport } = require('./grcExport.service');
const { ADAPTERS, readRuntimeEntity } = require('./grcRuntimeAdapters');
const { escalationStages, occurrenceKey, retryBackoffSeconds, schedulerWindow } = require('./grcSchedulerRules');
const { runEnabledTenants } = require('./grcSchedulerRunner');
const { observe, resetForTests, snapshot } = require('./grcObservability');
const { createGrcService, GrcError } = require('./grc.service');

const TENANT_A = '70000000-0000-4000-8000-000000000701';
const TENANT_B = '70000000-0000-4000-8000-000000000702';
const USER = '70000000-0000-4000-8000-000000000703';
const RUN = '70000000-0000-4000-8000-000000000704';

function approval(id, decision, sequenceNo = 1) {
  return { reviewer_id: id, assigned_reviewer_id: id, decision, sequence_no: sequenceNo };
}

async function testApprovals() {
  assert.equal(evaluateApproval({ mode: 'simple', approvals: [approval('a', 'approved')] }).complete, true);
  assert.equal(evaluateApproval({ mode: 'parallel', config: { required_count: 2 }, approvals: [approval('a', 'approved')] }).complete, false);
  assert.equal(evaluateApproval({ mode: 'parallel', config: { required_count: 2 }, approvals: [approval('a', 'approved'), approval('b', 'approved')] }).complete, true);
  assert.equal(evaluateApproval({ mode: 'quorum', quorum: 2, approvals: [approval('a', 'approved'), approval('b', 'approved')] }).complete, true);
  assert.equal(evaluateApproval({ mode: 'unanimous', config: { user_ids: ['a', 'b'] }, approvals: [approval('a', 'approved'), approval('b', 'approved')] }).complete, true);
  assert.equal(evaluateApproval({ mode: 'unanimous', config: { user_ids: ['a', 'b'] }, approvals: [approval('a', 'approved'), approval('b', 'rejected')] }).outcome, 'rejected');
  const sequential = evaluateApproval({ mode: 'sequential', config: { steps: [{ sequence_no: 1 }, { sequence_no: 2 }] }, approvals: [approval('a', 'approved', 1)] });
  assert.equal(sequential.nextSequence, 2);
  assert.equal(sequential.complete, false);
  assert.throws(() => assertApprovalActor({ mode: 'sequential', config: { steps: [{ sequence_no: 1, user_id: 'a' }] }, userId: 'b', sequenceNo: 1 }), /WORKFLOW_APPROVER_DENIED/);
}

async function testSchedulerRules() {
  assert.equal(retryBackoffSeconds(1), 30);
  assert.equal(retryBackoffSeconds(4), 240);
  assert.equal(retryBackoffSeconds(99), 3600);
  assert.equal(schedulerWindow('2026-07-22T12:07:42Z', 5), '2026-07-22T12:05:00.000Z');
  assert.equal(occurrenceKey('schedule-a', '2026-07-22T12:00:00Z'), 'schedule-a:2026-07-22T12:00:00.000Z');
  assert.deepEqual(escalationStages({ dueAt: '2026-07-22T12:00:00Z', now: '2026-07-22T13:00:00Z', policy: { prior_notice_hours: 24, first_escalation_hours: 0, second_escalation_hours: 24 }, status: 'open' }), ['prior_notice', 'overdue', 'escalation_1']);
  assert.deepEqual(escalationStages({ dueAt: '2026-07-22T12:00:00Z', now: '2026-07-22T13:00:00Z', policy: {}, status: 'closed' }), ['resolved']);
  assert.deepEqual(escalationStages({ dueAt: '2026-07-22T12:00:00Z', now: '2026-07-22T13:00:00Z', policy: {}, status: 'cancelled' }), ['cancelled']);
}

function schedulerPool({ existing = null, acquired = true, failTask = false } = {}) {
  const calls = [];
  let attempt = Number(existing?.attempt_count || 0);
  const query = async (sql, values = []) => {
    const text = String(sql);
    calls.push({ sql: text, values });
    if (text.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired }], rowCount: 1 };
    if (text.includes('SELECT * FROM grc_scheduler_runs')) return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    if (text.includes('INSERT INTO grc_scheduler_runs')) {
      attempt = 1;
      return { rows: [{ id: RUN, tenant_id: values[0], status: 'running', attempt_count: attempt }], rowCount: 1 };
    }
    if (text.includes("SET status = 'running'")) {
      attempt += 1;
      return { rows: [{ ...existing, status: 'running', attempt_count: attempt }], rowCount: 1 };
    }
    if (text.includes('UPDATE grc_audit_followups')) {
      if (failTask) throw Object.assign(new Error('partial'), { code: 'PARTIAL_TASK' });
      return { rows: [], rowCount: 2 };
    }
    if (text.includes('UPDATE grc_scheduler_runs SET status = $4')) {
      return { rows: [{ id: RUN, tenant_id: values[0], status: values[3], attempt_count: attempt, task_results: JSON.parse(values[4]) }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  return {
    calls,
    query,
    async connect() { return { query, release() {} }; },
  };
}

async function testSchedulerIntegration() {
  const firstPool = schedulerPool();
  const first = createGrcService(firstPool, { createJob: async () => ({ id: RUN }) });
  const result = await first.runScheduler({ tenantId: TENANT_A, userId: USER, body: { window_key: 'w1', tasks: ['action_followup'] }, correlationId: 'c1' });
  assert.equal(result.reused, false);
  assert.equal(result.run.status, 'completed');
  assert.equal(result.results.action_followup.marked_overdue, 2);
  assert.ok(firstPool.calls.every(call => !call.sql.includes('grc_') || !call.values.length || call.values[0] === TENANT_A));

  const reusedPool = schedulerPool({ existing: { id: RUN, tenant_id: TENANT_A, status: 'completed', attempt_count: 1, task_results: { action_followup: { status: 'completed' } } } });
  const reused = await createGrcService(reusedPool, { createJob: async () => ({}) }).runScheduler({ tenantId: TENANT_A, userId: USER, body: { window_key: 'w1', tasks: ['action_followup'] }, correlationId: 'c2' });
  assert.equal(reused.reused, true);
  assert.equal(reusedPool.calls.some(call => call.sql.includes('UPDATE grc_audit_followups')), false);

  const partialPool = schedulerPool({ failTask: true });
  const partial = await createGrcService(partialPool, { createJob: async () => ({}) }).runScheduler({ tenantId: TENANT_B, userId: USER, body: { window_key: 'w2', tasks: ['action_followup'] }, correlationId: 'c3' });
  assert.equal(partial.run.status, 'partial_failure');
  assert.equal(partial.results.action_followup.error_code, 'PARTIAL_TASK');

  const retryPool = schedulerPool({ existing: { id: RUN, tenant_id: TENANT_B, status: 'partial_failure', attempt_count: 1, task_results: {} } });
  const retry = await createGrcService(retryPool, { createJob: async () => ({}) }).runScheduler({ tenantId: TENANT_B, userId: USER, body: { window_key: 'w2', tasks: ['action_followup'], retry: true }, correlationId: 'c4' });
  assert.equal(retry.run.attempt_count, 2);

  const locked = createGrcService(schedulerPool({ acquired: false }), { createJob: async () => ({}) });
  await assert.rejects(() => locked.runScheduler({ tenantId: TENANT_A, userId: USER, body: { window_key: 'w3', tasks: ['action_followup'] }, correlationId: 'c5' }), error => error instanceof GrcError && error.code === 'GRC_SCHEDULER_LOCKED');

  const scheduledTenants = [];
  const runner = await runEnabledTenants({
    database: { query: async () => ({ rows: [{ tenant_id: TENANT_A }, { tenant_id: TENANT_B }] }) },
    service: { runScheduler: async input => { scheduledTenants.push(input.tenantId); return { run: { status: 'completed' }, reused: false }; } },
    workerId: 'test-runner',
  });
  assert.deepEqual(scheduledTenants, [TENANT_A, TENANT_B]);
  assert.deepEqual(runner.map(item => item.status), ['completed', 'completed']);
}

function transactionalPool(handler) {
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push({ sql: String(sql), values });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(String(sql))) return { rows: [], rowCount: 0 };
    return handler(String(sql), values);
  };
  return { calls, query, async connect() { return { query, release() {} }; } };
}

async function testApprovalAndSupervisorIntegration() {
  const transitionId = '70000000-0000-4000-8000-000000000705';
  const stateA = '70000000-0000-4000-8000-000000000706';
  const stateB = '70000000-0000-4000-8000-000000000707';
  const approvalId = '70000000-0000-4000-8000-000000000708';
  let storedApproval = null;
  const approvalPool = transactionalPool((sql, values) => {
    if (sql.includes('SELECT i.*, t.id AS transition_id')) return { rows: [{ id: RUN, current_state_id: stateA, transition_id: transitionId, to_state_id: stateB, required_permission: 'workflow.transition', approval_mode: 'simple', approval_config: {}, quorum: null, sla_hours: null, preconditions: [], target_type: 'terminal', entity_type: 'audit', entity_id: RUN }], rowCount: 1 };
    if (sql.includes('FROM grc_workflow_transition_roles')) return { rows: [{ configured: 0, matching: 0 }], rowCount: 1 };
    if (sql.includes('user_has_permission')) return { rows: [{ allowed: true }], rowCount: 1 };
    if (sql.includes('INSERT INTO grc_workflow_approvals')) {
      storedApproval = { id: approvalId, reviewer_id: USER, assigned_reviewer_id: USER, acted_by: USER, decision: values[7], sequence_no: values[3] };
      return { rows: [storedApproval], rowCount: 1 };
    }
    if (sql.includes('SELECT * FROM grc_workflow_approvals')) return { rows: [storedApproval], rowCount: 1 };
    if (sql.includes('UPDATE grc_workflow_instances')) return { rows: [{ id: RUN, status: 'completed', current_state_id: stateB }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const approvalService = createGrcService(approvalPool, { createJob: async () => ({}) });
  const approved = await approvalService.executeTransition({ tenantId: TENANT_A, userId: USER, role: 'auditor', instanceId: RUN, body: { transition_code: 'approve', decision: 'approved', comment: 'Aprobado' }, correlationId: 'approval-correlation' });
  assert.equal(approved.status, 'completed');
  assert.ok(approvalPool.calls.some(call => call.sql.includes('user_has_permission')));
  assert.ok(approvalPool.calls.some(call => call.sql.includes('workflow.approval')) === false);

  const workpaperId = '70000000-0000-4000-8000-000000000709';
  const auditId = '70000000-0000-4000-8000-000000000710';
  const reviewId = '70000000-0000-4000-8000-000000000711';
  const reviewPool = transactionalPool((sql, values) => {
    if (sql.includes('SELECT * FROM grc_audit_workpapers')) return { rows: [{ id: workpaperId, audit_id: auditId, prepared_by: TENANT_B, status: 'submitted', version: 1, content_hash: 'hash' }], rowCount: 1 };
    if (sql.includes('grc_audit_conflicts')) return { rows: [], rowCount: 0 };
    if (sql.includes('SELECT * FROM grc_audit_supervisor_reviews')) return { rows: [], rowCount: 0 };
    if (sql.includes('INSERT INTO grc_audit_supervisor_reviews')) return { rows: [{ id: reviewId, decision: values[4], version: values[6] }], rowCount: 1 };
    if (sql.includes('UPDATE grc_audit_workpapers')) return { rows: [{ id: workpaperId, status: values[2], reviewed_by: USER }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const reviewed = await createGrcService(reviewPool, { createJob: async () => ({}) }).reviewWorkpaper({ tenantId: TENANT_A, userId: USER, workpaperId, body: { decision: 'approved', observations: 'Independiente' }, correlationId: 'review-correlation' });
  assert.equal(reviewed.review.version, 1);
  assert.equal(reviewed.workpaper.status, 'approved');
}

async function testExports() {
  const rows = [{ id: '1', status: 'open', title: 'Registro, uno' }];
  for (const format of ['csv', 'xlsx', 'docx', 'pdf']) {
    const artifact = await buildGrcExport({ domain: 'findings', format, rows, tenantId: TENANT_A, generatedAt: '2026-07-22T12:00:00.000Z' });
    assert.ok(Buffer.isBuffer(artifact.buffer));
    assert.ok(artifact.buffer.length > 20);
    assert.match(artifact.fileName, /^grc_findings_v1_2026-07-22_/);
    assert.equal(artifact.contentHash.length, 64);
  }
  await assert.rejects(() => buildGrcExport({ domain: 'findings', format: 'csv', rows: [], tenantId: TENANT_A }), /GRC_EXPORT_EMPTY/);
}

async function testAdaptersAndObservability() {
  assert.deepEqual(new Set(Object.values(ADAPTERS).map(adapter => adapter.domain)), new Set([
    'documents', 'evidence', 'controls', 'risks', 'audits', 'findings_nonconformities_actions',
  ]));
  assert.ok(Object.values(ADAPTERS).every(adapter => adapter.query.includes('tenant_id = $1::uuid')));
  const calls = [];
  const pool = { async query(sql, values) {
    calls.push({ sql: String(sql), values });
    if (String(sql).startsWith('SELECT * FROM evidences')) return { rows: [{ id: RUN, tenant_id: TENANT_A, status: 'approved' }], rowCount: 1 };
    if (String(sql).includes('FROM grc_workflow_instances')) return { rows: [{ id: RUN, state_code: 'approved' }], rowCount: 1 };
    if (String(sql).includes('COUNT(*)')) return { rows: [{ linked_count: 2 }], rowCount: 1 };
    return { rows: [{ id: RUN, score: 80 }], rowCount: 1 };
  } };
  const result = await readRuntimeEntity(pool, { tenantId: TENANT_A, entityType: 'evidence', entityId: RUN });
  assert.equal(result.adapter, 'evidence');
  assert.equal(result.evidence.linked_count, 2);
  assert.ok(calls.every(call => call.values[0] === TENANT_A));

  resetForTests();
  observe('scheduler', { tenantId: TENANT_A, status: 'success' });
  observe('scheduler', { tenantId: TENANT_B, status: 'failed', errorCode: 'X' });
  assert.deepEqual(snapshot().map(item => item.count), [1, 1]);
}

async function run() {
  await testApprovals();
  await testSchedulerRules();
  await testSchedulerIntegration();
  await testApprovalAndSupervisorIntegration();
  await testExports();
  await testAdaptersAndObservability();
  console.log('grc Phase 1 core tests: OK');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
