#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  assertPlatformContext,
  assertTenantContext,
  createTenantAwarePool,
  currentDbTenantContext,
  runWithDbTenantContext,
  runWithPlatformDbContext,
  setLocalTenantContext,
  withPlatformTransaction,
  withTenantTransaction,
} = require('./dbTenantContext');

const tenantA = '70000000-0000-4000-8000-000000000701';
const tenantB = '70000000-0000-4000-8000-000000000702';

function createFakeClient() {
  const calls = [];
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), values });
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push({ sql: 'RELEASE', values: [] });
    },
  };
}

function createFakePool(client) {
  return {
    calls: client.calls,
    async connect() {
      return client;
    },
    async query(sql, values = []) {
      client.calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), values, via: 'pool' });
      return { rows: [], rowCount: 0 };
    },
  };
}

async function main() {
  assert.deepStrictEqual(assertTenantContext({ tenantId: tenantA }), {
    tenantId: tenantA,
    platformScope: false,
    role: 'tenant_runtime',
  });

  assert.throws(
    () => assertTenantContext({ tenantId: tenantA, platformScope: true }),
    /platform scope requires explicit platform DB context/,
  );

  assert.deepStrictEqual(assertPlatformContext({ role: 'platform_admin', reason: 'admin_read' }), {
    tenantId: '',
    platformScope: true,
    role: 'platform_admin',
    reason: 'admin_read',
  });

  assert.throws(
    () => assertPlatformContext({ tenantId: tenantA, role: 'platform_admin' }),
    /must not carry tenant_id/,
  );

  assert.throws(
    () => assertTenantContext({ tenantId: 'not-a-uuid' }),
    /tenant_id must be a valid UUID/,
  );

  const client = createFakeClient();
  const normalized = await setLocalTenantContext(client, { tenant_id: tenantB });
  assert.strictEqual(normalized.tenantId, tenantB);
  assert.match(client.calls[0].sql, /set_config\('app\.tenant_id'/);
  assert.deepStrictEqual(client.calls[0].values, [tenantB, 'false', 'tenant_runtime']);

  const txClient = createFakeClient();
  const result = await withTenantTransaction(
    createFakePool(txClient),
    { tenantId: tenantA },
    async (scopedClient, scopedContext) => {
      assert.strictEqual(scopedClient, txClient);
      assert.strictEqual(scopedContext.tenantId, tenantA);
      await scopedClient.query('SELECT current_setting($1, true)', ['app.tenant_id']);
      return 'ok';
    },
  );

  assert.strictEqual(result, 'ok');
  assert.deepStrictEqual(txClient.calls.map((call) => call.sql), [
    'BEGIN',
    "SELECT set_config('app.tenant_id', $1, true), set_config('app.platform_scope', $2, true), set_config('app.runtime_role', $3, true)",
    'SELECT current_setting($1, true)',
    'COMMIT',
    'RELEASE',
  ]);

  const leakClient = createFakeClient();
  await withTenantTransaction(createFakePool(leakClient), { tenantId: tenantA }, async () => 'a');
  await withTenantTransaction(createFakePool(leakClient), { tenantId: tenantB }, async () => 'b');
  const setConfigValues = leakClient.calls
    .filter((call) => call.sql.includes("set_config('app.tenant_id'"))
    .map((call) => call.values[0]);
  assert.deepStrictEqual(setConfigValues, [tenantA, tenantB], 'each reused client transaction must set its own tenant context');

  const platformClient = createFakeClient();
  const platformResult = await withPlatformTransaction(
    createFakePool(platformClient),
    { role: 'platform_worker', reason: 'job_claim' },
    async (_client, scopedContext) => {
      assert.strictEqual(scopedContext.platformScope, true);
      return 'platform-ok';
    },
  );
  assert.strictEqual(platformResult, 'platform-ok');
  assert.deepStrictEqual(platformClient.calls[1].values, ['', 'true', 'platform_worker']);

  const directQueryClient = createFakeClient();
  const tenantAwarePool = createTenantAwarePool(createFakePool(directQueryClient));
  await runWithDbTenantContext({ tenantId: tenantA, role: 'route_runtime' }, async () => {
    assert.strictEqual(currentDbTenantContext().tenantId, tenantA);
    await tenantAwarePool.query('SELECT * FROM findings WHERE tenant_id = $1::uuid', [tenantA]);
  });
  assert.deepStrictEqual(directQueryClient.calls.map((call) => call.sql), [
    'BEGIN',
    "SELECT set_config('app.tenant_id', $1, true), set_config('app.platform_scope', $2, true), set_config('app.runtime_role', $3, true)",
    'SELECT * FROM findings WHERE tenant_id = $1::uuid',
    'COMMIT',
    'RELEASE',
  ]);

  const manualTxClient = createFakeClient();
  const manualTxPool = createTenantAwarePool(createFakePool(manualTxClient));
  await runWithDbTenantContext({ tenantId: tenantB, role: 'manual_tx_route' }, async () => {
    const scopedClient = await manualTxPool.connect();
    try {
      await scopedClient.query('BEGIN');
      await scopedClient.query('UPDATE evidences SET status=$1 WHERE tenant_id=$2::uuid', ['approved', tenantB]);
      await scopedClient.query('COMMIT');
    } finally {
      scopedClient.release();
    }
  });
  assert.deepStrictEqual(manualTxClient.calls.map((call) => call.sql), [
    'BEGIN',
    "SELECT set_config('app.tenant_id', $1, true), set_config('app.platform_scope', $2, true), set_config('app.runtime_role', $3, true)",
    'UPDATE evidences SET status=$1 WHERE tenant_id=$2::uuid',
    'COMMIT',
    'RELEASE',
  ]);
  assert.deepStrictEqual(manualTxClient.calls[1].values, [tenantB, 'false', 'manual_tx_route']);

  const platformPoolClient = createFakeClient();
  const platformAwarePool = createTenantAwarePool(createFakePool(platformPoolClient));
  await runWithPlatformDbContext(
    { role: 'platform_scheduler', reason: 'tenant_discovery' },
    () => platformAwarePool.query('SELECT tenant_id FROM tenant_module_settings ORDER BY tenant_id')
  );
  assert.deepStrictEqual(platformPoolClient.calls[1].values, ['', 'true', 'platform_scheduler']);

  console.log('DB-N04 tenant DB context tests: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
