const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createGrcService, GrcError } = require('./grc.service');
const {
  classifyConnectorError,
  classifyConnectorRun,
  runDueConnectors,
} = require('./phase2SchedulerRunner');
const { resetForTests, snapshot } = require('./grcObservability');

const TENANT_A = '80000000-0000-4000-8000-000000000701';
const TENANT_B = '80000000-0000-4000-8000-000000000702';
const USER = '80000000-0000-4000-8000-000000000703';
const CONNECTOR_A = '80000000-0000-4000-8000-000000000704';
const CONNECTOR_B = '80000000-0000-4000-8000-000000000705';
const CONNECTOR_C = '80000000-0000-4000-8000-000000000707';
const POLICY_ID = '80000000-0000-4000-8000-000000000706';

function schedulerDatabase(rows = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql: String(sql), values });
      if (String(sql).includes('FROM grc_connector_instances i')) return { rows, rowCount: rows.length };
      if (String(sql).includes('UPDATE grc_connector_instances')) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected scheduler SQL: ${sql}`);
    },
  };
}

function policyPool() {
  const calls = [];
  let stored = null;
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql: String(sql), values });
      if (String(sql).includes('INSERT INTO grc_escalation_policies')) {
        stored = {
          id: POLICY_ID,
          tenant_id: values[0],
          code: values[1],
          entity_type: values[2],
          prior_notice_hours: values[5],
          first_escalation_hours: values[6],
          second_escalation_hours: values[7],
          role_keys: JSON.parse(values[10]),
          recipient_config: JSON.parse(values[11]),
          is_active: true,
        };
        return { rows: [stored], rowCount: 1 };
      }
      if (String(sql).includes('SELECT * FROM grc_escalation_policies')) {
        return { rows: stored ? [stored] : [], rowCount: stored ? 1 : 0 };
      }
      throw new Error(`Unexpected policy SQL: ${sql}`);
    },
  };
}

async function testConnectorScheduler() {
  resetForTests();
  assert.strictEqual(classifyConnectorError({ code: 'CONNECTOR_NOT_AVAILABLE' }), 'disabled');
  assert.strictEqual(classifyConnectorError({ code: 'CONNECTOR_ACCESS_TOKEN_REQUIRED' }), 'misconfiguration');
  assert.strictEqual(classifyConnectorError({ code: 'CONNECTOR_HTTP_503' }), 'dependency_unavailable');
  assert.strictEqual(classifyConnectorError({ code: 'CONNECTOR_TIMEOUT' }), 'failure');
  assert.strictEqual(classifyConnectorRun({ run: { status: 'completed' } }), 'success');
  assert.strictEqual(classifyConnectorRun({ run: { status: 'completed_with_warnings' } }), 'success');
  assert.strictEqual(classifyConnectorRun({ reused: true, run: { status: 'running' } }), 'success');
  assert.strictEqual(classifyConnectorRun({ run: { status: 'failed', error_code: 'CONNECTOR_HTTP_429' } }), 'dependency_unavailable');
  assert.strictEqual(classifyConnectorRun({ run: { status: 'running' } }), 'failure');
  assert.strictEqual(classifyConnectorRun({ run: { status: 'unknown_status' } }), 'failure');

  const emptyDb = schedulerDatabase([]);
  const empty = await runDueConnectors({
    database: emptyDb,
    connectorService: { async runConnector() { throw new Error('No connector should run.'); } },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(empty.status, 'skipped');
  assert(emptyDb.calls[0].sql.includes("ms.module_key='grc_phase2_integrated'"));
  assert(emptyDb.calls[0].sql.includes('ms.is_enabled=TRUE'));

  const successDb = schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]);
  const runInputs = [];
  const success = await runDueConnectors({
    database: successDb,
    connectorService: {
      async runConnector(input) {
        runInputs.push(input);
        return { run: { status: 'completed', metrics: { interval_minutes: 15 } }, reused: false };
      },
    },
    workerId: 'phase2-test',
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(success.status, 'success');
  assert.strictEqual(runInputs[0].role, 'platform_admin');
  assert.strictEqual(runInputs[0].tenantId, TENANT_A);
  assert.strictEqual(successDb.calls.at(-1).values[2], 'healthy');
  assert.strictEqual(successDb.calls.at(-1).values[3], null);
  assert.strictEqual(successDb.calls.at(-1).values[4], 15);

  const recoveryFailedDb = schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]);
  let recoveryFailedStep = 0;
  await runDueConnectors({
    database: recoveryFailedDb,
    connectorService: {
      async runConnector() {
        recoveryFailedStep += 1;
        if (recoveryFailedStep === 1) return { run: { status: 'failed', error_code: 'CONNECTOR_HTTP_503' }, reused: false };
        return { run: { status: 'completed', metrics: { interval_minutes: 45 } }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(recoveryFailedDb.calls.at(-1).values[2], 'failed');
  assert.strictEqual(recoveryFailedDb.calls.at(-1).values[3], 'CONNECTOR_HTTP_503');
  const recoveredFromFailed = await runDueConnectors({
    database: recoveryFailedDb,
    connectorService: {
      async runConnector() {
        recoveryFailedStep += 1;
        return { run: { status: 'completed', metrics: { interval_minutes: 45 } }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(recoveredFromFailed.status, 'success');
  assert.strictEqual(recoveryFailedDb.calls.at(-1).values[2], 'healthy');
  assert.strictEqual(recoveryFailedDb.calls.at(-1).values[3], null);
  assert.strictEqual(recoveryFailedDb.calls.at(-1).values[4], 45);

  const unknownDb = schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]);
  const unknown = await runDueConnectors({
    database: unknownDb,
    connectorService: {
      async runConnector() {
        return { run: { status: 'running', error_code: 'CONNECTOR_STILL_RUNNING' }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(unknown.status, 'partial_failure');
  assert.strictEqual(unknown.results[0].status, 'failure');
  assert.strictEqual(unknownDb.calls.at(-1).values[2], 'failed');
  assert.strictEqual(unknownDb.calls.at(-1).values[3], 'CONNECTOR_STILL_RUNNING');

  const disabledDb = schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]);
  const originalConsoleError = console.error;
  let schedulerErrorLogged = false;
  console.error = message => {
    schedulerErrorLogged = schedulerErrorLogged || String(message).includes('PHASE2_SCHEDULER_ERROR');
  };
  try {
    const disabled = await runDueConnectors({
      database: disabledDb,
      connectorService: {
        async runConnector() {
          const error = new Error('feature gated');
          error.code = 'CONNECTOR_NOT_AVAILABLE';
          throw error;
        },
      },
      clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
    });
    assert.strictEqual(disabled.status, 'success');
    assert.strictEqual(disabled.results[0].status, 'disabled');
    assert.strictEqual(disabledDb.calls.at(-1).values[2], 'disabled');
    assert.strictEqual(disabledDb.calls.at(-1).values[3], 'CONNECTOR_NOT_AVAILABLE');
    assert.strictEqual(disabledDb.calls.at(-1).values[4], 1440);
    assert.strictEqual(schedulerErrorLogged, false);
  } finally {
    console.error = originalConsoleError;
  }

  const recoveryDisabledDb = schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]);
  let recoveryDisabledStep = 0;
  await runDueConnectors({
    database: recoveryDisabledDb,
    connectorService: {
      async runConnector() {
        recoveryDisabledStep += 1;
        if (recoveryDisabledStep === 1) {
          const error = new Error('feature gated');
          error.code = 'CONNECTOR_NOT_AVAILABLE';
          throw error;
        }
        return { run: { status: 'completed', metrics: { interval_minutes: 20 } }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(recoveryDisabledDb.calls.at(-1).values[2], 'disabled');
  assert.strictEqual(recoveryDisabledDb.calls.at(-1).values[3], 'CONNECTOR_NOT_AVAILABLE');
  const recoveredFromDisabled = await runDueConnectors({
    database: recoveryDisabledDb,
    connectorService: {
      async runConnector() {
        return { run: { status: 'completed', metrics: { interval_minutes: 20 } }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(recoveredFromDisabled.status, 'success');
  assert.strictEqual(recoveryDisabledDb.calls.at(-1).values[2], 'healthy');
  assert.strictEqual(recoveryDisabledDb.calls.at(-1).values[3], null);
  assert.strictEqual(recoveryDisabledDb.calls.at(-1).values[4], 20);

  const mixedDb = schedulerDatabase([
    { id: CONNECTOR_A, tenant_id: TENANT_A },
    { id: CONNECTOR_B, tenant_id: TENANT_B },
    { id: CONNECTOR_C, tenant_id: TENANT_A },
  ]);
  let callCount = 0;
  const mixed = await runDueConnectors({
    database: mixedDb,
    connectorService: {
      async runConnector() {
        callCount += 1;
        if (callCount === 1) return { run: { status: 'failed', error_code: 'CONNECTOR_ACCESS_TOKEN_REQUIRED' }, reused: false };
        if (callCount === 2) return { run: { status: 'completed', metrics: { interval_minutes: 30 } }, reused: false };
        return { run: { status: 'failed', error_code: 'CONNECTOR_HTTP_503' }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  assert.strictEqual(mixed.status, 'partial_failure');
  assert.deepStrictEqual(mixed.results.map(result => result.status), ['misconfiguration', 'success', 'dependency_unavailable']);
  assert.strictEqual(callCount, 3);

  let releaseConnector;
  const blocking = runDueConnectors({
    database: schedulerDatabase([{ id: CONNECTOR_A, tenant_id: TENANT_A }]),
    connectorService: {
      async runConnector() {
        await new Promise(resolve => { releaseConnector = resolve; });
        return { run: { status: 'completed' }, reused: false };
      },
    },
    clock: () => Date.parse('2026-09-04T12:00:00.000Z'),
  });
  await new Promise(resolve => setImmediate(resolve));
  const concurrent = await runDueConnectors({
    database: schedulerDatabase([{ id: CONNECTOR_B, tenant_id: TENANT_B }]),
    connectorService: { async runConnector() { throw new Error('Concurrent run should skip.'); } },
  });
  assert.strictEqual(concurrent.status, 'skipped');
  assert.strictEqual(concurrent.reason, 'runner_busy');
  assert.strictEqual(typeof releaseConnector, 'function');
  releaseConnector();
  await blocking;

  const observedStatuses = snapshot()
    .filter(item => item.operation === 'phase2_scheduler_connector')
    .map(item => item.status);
  assert(observedStatuses.includes('success'));
  assert(observedStatuses.includes('disabled'));
  assert(observedStatuses.includes('misconfiguration'));
  assert(observedStatuses.includes('dependency_unavailable'));
}

async function testPoliciesAndUxContract() {
  const pool = policyPool();
  const service = createGrcService(pool, {});
  const policy = await service.createEscalationPolicy({
    tenantId: TENANT_A,
    userId: USER,
    correlationId: 'part2-policy',
    body: {
      name: 'Política de evidencias',
      entity_type: 'evidence_request',
      prior_notice_hours: '24',
      second_escalation_hours: '24',
    },
  });
  assert.strictEqual(policy.tenant_id, TENANT_A);
  assert.strictEqual(policy.code, 'evidence-default');
  assert.strictEqual(policy.recipient_config.display_name, 'Política de evidencias');
  assert.strictEqual(policy.prior_notice_hours, 24);
  assert.strictEqual(policy.second_escalation_hours, 24);

  const listed = await service.listEscalationPolicies(TENANT_A);
  assert.strictEqual(listed[0].display_name, 'Política de evidencias');
  assert(pool.calls.every(call => !call.values.length || call.values[0] === TENANT_A));

  await assert.rejects(
    () => service.createEscalationPolicy({
      tenantId: TENANT_A,
      userId: USER,
      body: { name: 'Inválida', entity_type: 'evidence_request', prior_notice_hours: -1 },
    }),
    error => error instanceof GrcError && error.code === 'GRC_ESCALATION_HOURS_INVALID'
  );
  await assert.rejects(
    () => service.createEscalationPolicy({
      tenantId: TENANT_A,
      userId: USER,
      body: { name: 'Inválida', entity_type: 'unknown' },
    }),
    error => error instanceof GrcError && error.code === 'GRC_ESCALATION_ENTITY_INVALID'
  );

  const repoRoot = path.join(__dirname, '../../../..');
  const routesSource = fs.readFileSync(path.join(repoRoot, 'backend/src/routes/grc.routes.js'), 'utf8');
  assert(routesSource.includes("router.post('/scheduler/run', route(async (req) => authorized(req, 'grc.scheduler.run'"));
  assert(routesSource.includes("router.get('/escalations/policies', route(async (req) => authorized(req, 'workflow.read'"));
  assert(routesSource.includes("router.post('/escalations/policies', route(async (req) => authorized(req, 'grc.escalation.manage'"));

  const panelSource = fs.readFileSync(path.join(repoRoot, 'frontend/src/components/grc/GrcPhase1Panel.tsx'), 'utf8');
  assert(panelSource.includes('Política de avisos y escalamiento'));
  assert(panelSource.includes('Avisar antes de vencer'));
  assert(panelSource.includes('Escalar nuevamente después de'));
  assert(panelSource.includes('Confirmar ejecución'));
  assert(panelSource.includes("tasks: ['evidence_requests', 'reminders_expirations', 'escalations', 'action_followup']"));
  assert(!panelSource.includes("useState('evidence-default')"));
  assert(!panelSource.includes('onCreatePolicy({ code'));
}

async function run() {
  await testConnectorScheduler();
  await testPoliciesAndUxContract();
  console.log('MARKET_READINESS_PART2_SCHEDULER_POLICIES_TEST=PASS');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
