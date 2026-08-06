'use strict';

const assert = require('assert');
const pool = require('../config/db');
const service = require('./tenantProcessLinks.service');

const LEGACY_PROCESS_ID = 'a6534ef8-2a87-2d80-38bb-bcea295a9a1e';
const TENANT_A = '70000000-0000-0000-0000-000000000701';
const TENANT_B = '76c44a0e-6041-8bda-99c7-b740fccea001';

async function run() {
  assert.equal(service.isUuid(LEGACY_PROCESS_ID), true);
  assert.equal(service.isUuid('a6534ef8-2a87-2d80-38zz-bcea295a9a1e'), false);
  assert.equal(service.isUuid('../a6534ef8-2a87-2d80-38bb-bcea295a9a1e'), false);

  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql: String(sql), params });
    if (String(sql).includes('FROM tenant_processes') && params[0] === TENANT_A) {
      return {
        rowCount: 1,
        rows: [{ id: LEGACY_PROCESS_ID, tenant_id: TENANT_A, name: 'Proceso legacy', code: 'LEGACY', is_active: true }],
      };
    }
    if (String(sql).includes('FROM tenant_processes')) return { rowCount: 0, rows: [] };
    return { rowCount: 0, rows: [] };
  };

  try {
    const result = await service.listByProcess({
      user: { id: '70000000-0000-0000-0000-000000000712', tenant_id: TENANT_A, role: 'admin' },
      processId: LEGACY_PROCESS_ID,
    });
    assert.equal(result.process.id, LEGACY_PROCESS_ID);
    assert.deepEqual(result.data, []);
    assert.ok(calls.every((call) => call.params[0] === TENANT_A));
    assert.match(calls[0].sql, /tenant_id\s*=\s*\$1::uuid/);
    assert.match(calls[0].sql, /id\s*=\s*\$2::uuid/);

    await assert.rejects(
      service.listByProcess({
        user: { id: '99493ee8-0f4d-160d-03b1-47ac923f9768', tenant_id: TENANT_B, role: 'admin' },
        processId: LEGACY_PROCESS_ID,
      }),
      (error) => error?.status === 404 && error?.code === 'PROCESS_NOT_FOUND'
    );
  } finally {
    pool.query = originalQuery;
  }

  console.log('tenantProcessLinks.service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
