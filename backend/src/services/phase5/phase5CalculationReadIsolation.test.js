'use strict';

const assert = require('assert');
const pool = require('../../config/db');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const RUN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RUN_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function run() {
  const originalQuery = pool.query;
  const queryLog = [];
  pool.query = async (sql, params = []) => {
    queryLog.push({ sql, params });
    if (sql.includes('FROM calculation_runs') && !sql.includes('JOIN calculation_runs')) {
      const [tenantId, runId] = params;
      if ((tenantId === TENANT_A && runId === RUN_A) || (tenantId === TENANT_B && runId === RUN_B)) {
        const suffix = tenantId === TENANT_A ? 'a' : 'b';
        return {
          rows: [{
            id: runId,
            formula_code: 'F5_5_WEIGHTED_PROGRESS',
            run_status: 'calculated',
            input_hash: `input-${suffix}`,
            output_hash: `output-${suffix}`,
            source_snapshot_hash: `source-${suffix}`,
            started_at: '2026-08-11T00:00:00.000Z',
            completed_at: '2026-08-11T00:00:01.000Z',
            metadata: {},
          }],
        };
      }
      return { rows: [] };
    }
    if (sql.includes('SELECT to_regclass')) {
      return { rows: [{ regclass: 'calculation_explanations' }] };
    }
    if (sql.includes('FROM calculation_explanations')) {
      const [tenantId] = params;
      const suffix = tenantId === TENANT_A ? 'a' : 'b';
      return {
        rows: [{
          explanation_type: 'formula',
          explanation: `Tenant ${suffix.toUpperCase()} explanation`,
          variables: { actions: suffix === 'a' ? 1 : 2 },
          lineage: [{ source_record: `tenant-${suffix}-row` }],
          metadata: {},
          formula_code: 'F5_5_WEIGHTED_PROGRESS',
          run_status: 'calculated',
          input_hash: `input-${suffix}`,
          output_hash: `output-${suffix}`,
          source_snapshot_hash: `source-${suffix}`,
          started_at: '2026-08-11T00:00:00.000Z',
          completed_at: '2026-08-11T00:00:01.000Z',
        }],
      };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  try {
    const service = require('./phase5.service');
    const scopeA = { tenant_id: TENANT_A };
    const scopeB = { tenant_id: TENANT_B };

    const ownLineage = await service.getOfficialCalculationLineage(scopeA, RUN_A);
    assert.strictEqual(ownLineage.calculation_run_id, RUN_A);
    assert.deepStrictEqual(ownLineage.lineage, [{ source_record: 'tenant-a-row' }]);

    const ownExplanation = await service.getOfficialCalculationExplanation(scopeA, RUN_A);
    assert.strictEqual(ownExplanation.explanation, 'Tenant A explanation');

    const ownTenantBLineage = await service.getOfficialCalculationLineage(scopeB, RUN_B);
    assert.deepStrictEqual(ownTenantBLineage.lineage, [{ source_record: 'tenant-b-row' }]);

    await assert.rejects(
      () => service.getOfficialCalculationLineage(scopeA, RUN_B),
      (error) => error?.code === 'PHASE5_CALCULATION_RUN_NOT_FOUND' && error?.status === 404
    );
    await assert.rejects(
      () => service.getOfficialCalculationLineage(scopeB, RUN_A),
      (error) => error?.code === 'PHASE5_CALCULATION_RUN_NOT_FOUND' && error?.status === 404
    );
    await assert.rejects(
      () => service.getOfficialCalculationExplanation(scopeA, RUN_B),
      (error) => error?.code === 'PHASE5_CALCULATION_RUN_NOT_FOUND' && error?.status === 404
    );

    const crossTenantLookups = queryLog.filter(({ sql, params }) =>
      sql.includes('FROM calculation_runs') && (
        (params[0] === TENANT_A && params[1] === RUN_B)
        || (params[0] === TENANT_B && params[1] === RUN_A)
      )
    );
    assert.strictEqual(crossTenantLookups.length, 3);
    process.stdout.write('phase5 calculation read isolation tests OK\n');
  } finally {
    pool.query = originalQuery;
    await pool.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
