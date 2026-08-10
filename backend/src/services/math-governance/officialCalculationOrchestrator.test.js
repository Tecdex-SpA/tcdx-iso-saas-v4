'use strict';

const assert = require('assert');
const { OfficialFormulaRegistry } = require('./formulaRegistry.service');
const { recalculateOfficialAnalytics } = require('./officialCalculationOrchestrator.service');

async function run() {
  const persisted = [];
  const calculated = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'], period: { start: '2026-01-01', end: '2026-12-31', timezone: 'America/Santiago' } },
    'orchestrator-test',
    {
      client: {},
      registry: new OfficialFormulaRegistry(),
      resolveFormulaSource: async () => ({
        status: 'ready',
        source_code: 'risk_register_controls',
        counts: { received: 1, usable: 1, excluded: 0 },
        formula_input: { probability: 4, impact: 5 },
        input_hash: 'a'.repeat(64),
        source_snapshot: { row_count: 1 },
        source_snapshot_hash: 'b'.repeat(64),
        lineage: [{ source_record: '70000000-0000-0000-0000-000000000799' }],
        warnings: [],
        exclusions: [],
        equivalence: { probability: 'probability', impact: 'impact' },
        contract: { source_code: 'risk_register_controls' },
      }),
      persistOfficialCalculation: async (_scope, result) => {
        persisted.push(result);
        return { ...result, calculation_run_id: '70000000-0000-0000-0000-000000000799' };
      },
      persistSourceSnapshot: async () => '70000000-0000-0000-0000-000000000798',
    }
  );

  assert.equal(calculated.status, 'OFFICIAL_RECALCULATION_COMPLETED');
  assert.equal(calculated.summary.calculated, 1);
  assert.equal(calculated.results[0].value, 20);
  assert.equal(calculated.results[0].snapshot_id, '70000000-0000-0000-0000-000000000798');
  assert.equal(persisted[0].source_code, 'risk_register_controls');
  assert.equal(persisted[0].lineage.length, 1);
  assert.deepEqual(persisted[0].components, { probability: 4, impact: 5 });

  const overrideCalls = [];
  await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_SEVERITY_INDEX'], source_overrides: { F5_5_SEVERITY_INDEX: 'incident_operational_events' } },
    'orchestrator-source-override-test',
    {
      client: {},
      registry: new OfficialFormulaRegistry(),
      resolveFormulaSource: async (args) => {
        overrideCalls.push(args);
        return {
          status: 'ready',
          source_code: args.sourceCode,
          counts: { received: 1, usable: 1, excluded: 0 },
          formula_input: { low: 0, medium: 0, high: 1, critical: 0 },
          input_hash: 'c'.repeat(64),
          source_snapshot: { row_count: 1 },
          source_snapshot_hash: 'd'.repeat(64),
          lineage: [],
          warnings: [],
          exclusions: [],
          equivalence: {},
          contract: { source_code: args.sourceCode },
        };
      },
      persistOfficialCalculation: async (_scope, result) => result,
      persistSourceSnapshot: async () => '70000000-0000-0000-0000-000000000797',
    }
  );
  assert.equal(overrideCalls[0].sourceCode, 'incident_operational_events');

  const unavailable = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => ({ status: 'source_unavailable', source_code: 'risk_register_controls', warnings: ['tabla ausente'] }),
      persistOfficialCalculation: async () => { throw new Error('no debe persistir'); },
      persistSourceSnapshot: async () => { throw new Error('no debe persistir snapshot'); },
    }
  );
  assert.equal(unavailable.summary.source_unavailable, 1);
  assert.equal(unavailable.results[0].data_requirements.status, 'source_unavailable');
  assert.ok(unavailable.results[0].data_requirements.route_to_fix);

  const unmeasured = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => ({ status: 'empty_dataset', source_code: 'risk_register_controls', counts: { usable: 0 }, formula_input: { probability: null, impact: null }, warnings: ['sin datos'] }),
      persistOfficialCalculation: async () => { throw new Error('no debe persistir'); },
      persistSourceSnapshot: async () => { throw new Error('no debe persistir snapshot'); },
    }
  );
  assert.equal(unmeasured.summary.unmeasured, 1);
  assert.equal(unmeasured.results[0].data_requirements.status, 'insufficient');
  assert.equal(unmeasured.results[0].data_requirements.current_population, 0);

  console.log(JSON.stringify({ status: 'OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK', assertions: 16 }));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
