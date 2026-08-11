'use strict';

const assert = require('assert');
const phase5 = require('./phase5.service');

async function run() {
  const { buildDataTrustOverviewBlock, buildReportingOverviewBlock, firstExistingColumn, assertSqlIdentifier } = phase5._test;

  assert.strictEqual(assertSqlIdentifier('data_trust_scores'), 'data_trust_scores');
  assert.throws(() => assertSqlIdentifier('data_trust_scores;DROP'), /invalido/);

  const fakeClient = {
    async query(_sql, params) {
      const [, columnName] = params;
      return { rowCount: columnName === 'status' ? 1 : 0, rows: columnName === 'status' ? [{ '?column?': 1 }] : [] };
    },
  };
  assert.strictEqual(await firstExistingColumn(fakeClient, 'data_trust_scores', ['trust_status', 'status']), 'status');

  const dataTrustQueries = [];
  const dataTrustBlock = await buildDataTrustOverviewBlock('70000000-0000-0000-0000-000000000701', '2026-08-10T00:00:00.000Z', {
    firstExistingColumn: async (table, candidates) => {
      assert.strictEqual(table, 'data_trust_scores');
      assert.deepStrictEqual(candidates, ['trust_status', 'status']);
      return 'status';
    },
    countWhere: async (table, _tenantId, whereSql = 'TRUE') => {
      dataTrustQueries.push({ table, whereSql });
      assert.ok(!whereSql.includes('trust_status'), 'data_trust overview must not query a missing trust_status column');
      return whereSql.includes("status IN ('untrusted','unknown')") ? 1 : 4;
    },
  });
  assert.strictEqual(dataTrustBlock.status, 'attention');
  assert.strictEqual(dataTrustBlock.data.scores, 4);
  assert.strictEqual(dataTrustBlock.data.untrusted, 1);

  const reportingQueries = [];
  const reportingBlock = await buildReportingOverviewBlock('70000000-0000-0000-0000-000000000701', '2026-08-10T00:00:00.000Z', {
    firstExistingColumn: async (table) => {
      assert.ok(['report_generations', 'report_schedules'].includes(table));
      return null;
    },
    countWhere: async (table, _tenantId, whereSql = 'TRUE') => {
      reportingQueries.push({ table, whereSql });
      assert.ok(!whereSql.includes('status'), 'reporting overview must not query a missing status column');
      return table === 'report_generations' ? 2 : 1;
    },
  });
  assert.strictEqual(reportingBlock.status, 'ok');
  assert.strictEqual(reportingBlock.data.generations, 2);
  assert.strictEqual(reportingBlock.data.scheduled, 1);
  assert.strictEqual(reportingBlock.data.failed, 0);
  assert.ok(reportingBlock.warnings.some((warning) => warning.includes('sin columna de estado')));
  assert.ok(dataTrustQueries.length >= 2);
  assert.ok(reportingQueries.length >= 2);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
