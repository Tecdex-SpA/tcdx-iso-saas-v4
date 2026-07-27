const assert = require('assert');
const { assertUuid, createGrcService, GrcError } = require('./grc.service');

function fakePool(resolver) {
  const calls = [];
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql: String(sql), values });
      return resolver(String(sql), values);
    },
    async connect() {
      return {
        query: async (sql, values = []) => {
          calls.push({ sql: String(sql), values });
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(String(sql))) return { rows: [], rowCount: 0 };
          return resolver(String(sql), values);
        },
        release() {},
      };
    },
  };
}

async function run() {
  const tenantA = '70000000-0000-0000-0000-000000000701';
  assert.equal(assertUuid(tenantA), tenantA);
  assert.throws(
    () => assertUuid('not-a-uuid'),
    error => error instanceof GrcError && error.code === 'GRC_ID_REQUIRED'
  );
  const pool = fakePool((sql, values) => {
    if (sql.includes('FROM saas_modules')) return { rows: [{ is_enabled: true }], rowCount: 1 };
    if (sql.includes('user_has_permission')) return { rows: [{ allowed: values[1] !== 'framework.manage' }], rowCount: 1 };
    if (sql.includes('active_workflows')) return { rows: [{ active_workflows: 2, readiness_score: 75 }], rowCount: 1 };
    if (sql.includes('FROM grc_workflow_definitions d')) return { rows: [{ id: 'workflow-a' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const service = createGrcService(pool, { createJob: async () => ({ id: 'job' }) });

  await service.assertModuleEnabled(tenantA);
  await service.assertPermission({ userId: tenantA, role: 'tenant_admin', permission: 'workflow.read' });
  await assert.rejects(
    () => service.assertPermission({ userId: tenantA, role: 'tenant_admin', permission: 'framework.manage' }),
    error => error instanceof GrcError && error.code === 'GRC_PERMISSION_DENIED'
  );

  const summary = await service.getSummary(tenantA);
  assert.equal(summary.active_workflows, 2);
  const definitions = await service.listWorkflowDefinitions(tenantA, { limit: 500 });
  assert.equal(definitions.length, 1);

  const scopedCalls = pool.calls.filter(call => call.sql.includes('grc_'));
  assert.ok(scopedCalls.length >= 2);
  for (const call of scopedCalls) {
    assert.equal(call.values[0], tenantA, 'Every GRC read must bind tenant as first parameter');
    assert.ok(call.sql.includes('tenant_id'), 'Every GRC read must include explicit tenant predicate');
  }

  const disabledPool = fakePool(() => ({ rows: [{ is_enabled: false }], rowCount: 1 }));
  const disabled = createGrcService(disabledPool, { createJob: async () => ({}) });
  await assert.rejects(
    () => disabled.assertModuleEnabled(tenantA),
    error => error instanceof GrcError && error.code === 'GRC_PHASE1_DISABLED'
  );

  console.log('grc.service tests: OK');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
