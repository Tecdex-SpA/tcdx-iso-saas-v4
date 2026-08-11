'use strict';

const assert = require('assert');
const pool = require('../../config/db');

const TENANT_WITHOUT_SNAPSHOT = '11111111-1111-4111-8111-111111111111';
const TENANT_WITH_SNAPSHOT = '22222222-2222-4222-8222-222222222222';
const DEFINITION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SNAPSHOT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function catalogRow(snapshotId = null) {
  return {
    id: DEFINITION_ID,
    metric_code: 'ACTIONS',
    display_name: 'Actions',
    business_definition: 'Action progress.',
    metric_type: 'official_indicator',
    unit: '%',
    direction: 'higher_is_better',
    frequency: 'monthly',
    functional_code: 'ACTIONS',
    functional_display_name: 'Actions',
    functional_business_definition: 'Action progress.',
    functional_unit: '%',
    functional_direction: 'higher_is_better',
    functional_frequency: 'monthly',
    domain: 'actions',
    objective: 'Track actions.',
    population_definition: 'Applicable actions.',
    definition_version: 1,
    snapshot_id: snapshotId,
    snapshot_payload: snapshotId ? {
      period: { key: '2026-08' },
      result: { status: 'calculated', value: 75 },
      unit: '%',
      sufficiency: { status: 'sufficient', sample_size: 3, population_size: 3 },
    } : null,
    content_hash: snapshotId ? 'snapshot-hash' : null,
    period_key: snapshotId ? '2026-08' : null,
    effective_at: snapshotId ? '2026-08-31T23:59:59.000Z' : null,
    published_at: snapshotId ? '2026-08-31T23:59:59.000Z' : null,
    created_at: snapshotId ? '2026-08-31T23:59:59.000Z' : null,
  };
}

async function run() {
  const originalQuery = pool.query;
  const queryLog = [];
  pool.query = async (sql, params = []) => {
    queryLog.push({ sql, params });
    if (!sql.includes('FROM metric_definitions')) throw new Error(`Unexpected query: ${sql}`);
    if (params[0] === TENANT_WITHOUT_SNAPSHOT) return { rows: [catalogRow()] };
    if (params[0] === TENANT_WITH_SNAPSHOT) return { rows: [catalogRow(SNAPSHOT_ID)] };
    return { rows: [] };
  };

  try {
    const service = require('./indicatorGovernance.service');
    const withoutSnapshot = await service.listCatalog({ tenant_id: TENANT_WITHOUT_SNAPSHOT });
    const withSnapshot = await service.listCatalog({ tenant_id: TENANT_WITH_SNAPSHOT });

    assert.strictEqual(withoutSnapshot.length, 1);
    assert.strictEqual(withoutSnapshot[0].definition.id, DEFINITION_ID);
    assert.strictEqual(withoutSnapshot[0].latest_snapshot, null);

    assert.strictEqual(withSnapshot.length, 1);
    assert.strictEqual(withSnapshot[0].latest_snapshot.snapshot_id, SNAPSHOT_ID);
    assert.strictEqual(withSnapshot[0].latest_snapshot.state, 'calculated');
    assert.strictEqual(withSnapshot[0].latest_snapshot.value, 75);

    assert.deepStrictEqual(queryLog.map(({ params }) => params[0]), [TENANT_WITHOUT_SNAPSHOT, TENANT_WITH_SNAPSHOT]);
    process.stdout.write('indicator catalog snapshot isolation tests OK\n');
  } finally {
    pool.query = originalQuery;
    await pool.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
