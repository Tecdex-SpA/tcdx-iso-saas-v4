'use strict';

const assert = require('assert');
const { OfficialFormulaRegistry } = require('./formulaRegistry.service');
const { recalculateOfficialAnalytics } = require('./officialCalculationOrchestrator.service');
const phase5Package3 = require('./phase5Package3.service');

async function run() {
  const persisted = [];
  const calculated = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'], period: { start: '2026-01-01', end: '2026-12-31', timezone: 'tenant-configured' } },
    'orchestrator-test',
    {
      client: {},
      registry: new OfficialFormulaRegistry(),
      resolveFormulaSource: async () => ({
        status: 'ready',
        source_code: 'risk_register_controls',
        counts: { received: 3, usable: 3, excluded: 0 },
        formula_input: {
          risks: [
            { source_record: '70000000-0000-0000-0000-000000000791', probability: 4, impact: 5, inherent_risk_score: 20 },
            { source_record: '70000000-0000-0000-0000-000000000792', probability: 2, impact: 5, inherent_risk_score: 10 },
            { source_record: '70000000-0000-0000-0000-000000000793', probability: 3, impact: 5, inherent_risk_score: 15 },
          ],
          aggregation_method: 'arithmetic_mean',
          sample_size: 3,
          population_size: 3,
          scores: [20, 10, 15],
        },
        input_hash: 'a'.repeat(64),
        source_snapshot: { row_count: 3, usable_rows: 3, aggregation_method: 'arithmetic_mean' },
        source_snapshot_hash: 'b'.repeat(64),
        lineage: [
          { source_record: '70000000-0000-0000-0000-000000000791' },
          { source_record: '70000000-0000-0000-0000-000000000792' },
          { source_record: '70000000-0000-0000-0000-000000000793' },
        ],
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
  assert.equal(calculated.results[0].value, 15);
  assert.equal(calculated.results[0].snapshot_id, '70000000-0000-0000-0000-000000000798');
  assert.equal(persisted[0].source_code, 'risk_register_controls');
  assert.equal(persisted[0].lineage.length, 3);
  assert.deepEqual(persisted[0].components.scores, [20, 10, 15]);
  assert.equal(persisted[0].details.aggregation_method, 'arithmetic_mean');

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

  const package3Overview = phase5Package3.buildOverviewOfficialCalculations({
    compliance: { status: 'ok', data: { score: 80 }, trust: { score: 80 }, source_count: 3, warnings: [] },
    actions: { status: 'ok', trust: { score: 70 }, source_count: 2, warnings: [] },
  }, { period: { as_of: '2026-12-31T00:00:00.000Z' } });
  assert.equal(package3Overview.compliance.status, 'unmeasured');
  assert.ok(package3Overview.compliance.warnings.includes('canonical_orchestrator_required'));
  assert.throws(() => phase5Package3.calculateOfficialByKey('actions-progress', {}), /officialCalculationOrchestrator/);

  const unavailablePersisted = [];
  const unavailableSnapshots = [];
  const unavailable = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_WEIGHTED_PROGRESS'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => ({ status: 'source_unavailable', source_code: 'audit_findings_actions', warnings: ['tabla ausente'], data_trust: { model_version: 'data-trust-model-v1', state: 'UNTRUSTED', reasons: ['source_unavailable'] } }),
      persistOfficialCalculation: async (_scope, result) => {
        unavailablePersisted.push(result);
        return { ...result, calculation_run_id: '70000000-0000-0000-0000-000000000796' };
      },
      persistSourceSnapshot: async (_client, _tenantId, source) => {
        unavailableSnapshots.push(source);
        return '70000000-0000-0000-0000-000000000795';
      },
    }
  );
  assert.equal(unavailable.summary.source_unavailable, 1);
  assert.equal(unavailable.results[0].data_requirements.status, 'source_unavailable');
  assert.ok(unavailable.results[0].data_requirements.route_to_fix);
  assert.equal(unavailable.results[0].calculation_run_id, '70000000-0000-0000-0000-000000000796');
  assert.equal(unavailable.results[0].snapshot_id, '70000000-0000-0000-0000-000000000795');
  assert.equal(unavailablePersisted[0].status, 'unmeasured');
  assert.equal(unavailablePersisted[0].source_status, 'source_unavailable');
  assert.equal(unavailablePersisted[0].data_trust.state, 'UNTRUSTED');
  assert.equal(unavailableSnapshots[0].source_snapshot.machine_reason, 'SOURCE_UNAVAILABLE');
  assert.equal(unavailableSnapshots[0].source_snapshot.run_status, 'not_calculable');

  const unmeasuredPersisted = [];
  const unmeasuredSnapshots = [];
  const unmeasured = await recalculateOfficialAnalytics(
    { tenant_id: '70000000-0000-0000-0000-000000000701', user: { id: '70000000-0000-0000-0000-000000000711' } },
    { formula_codes: ['F5_5_INHERENT_RISK'] },
    null,
    {
      client: {},
      resolveFormulaSource: async () => ({
        status: 'empty_dataset',
        source_code: 'risk_register_controls',
        counts: { received: 4, eligible: 4, usable: 0, excluded: 4 },
        formula_input: { probability: null, impact: null },
        warnings: ['sin datos'],
        source_snapshot: { counts: { received: 4, eligible: 4, usable: 0, excluded: 4 }, exclusions: [{ code: 'risk_axis_invalid' }] },
        source_snapshot_hash: 'e'.repeat(64),
        data_trust: { model_version: 'data-trust-model-v1', state: 'INSUFFICIENT_DATA', reasons: ['insufficient_population'] },
      }),
      persistOfficialCalculation: async (_scope, result) => {
        unmeasuredPersisted.push(result);
        return { ...result, calculation_run_id: '70000000-0000-0000-0000-000000000794' };
      },
      persistSourceSnapshot: async (_client, _tenantId, source) => {
        unmeasuredSnapshots.push(source);
        return '70000000-0000-0000-0000-000000000793';
      },
    }
  );
  assert.equal(unmeasured.summary.unmeasured, 1);
  assert.equal(unmeasured.results[0].data_requirements.status, 'insufficient');
  assert.equal(unmeasured.results[0].data_requirements.current_population, 0);
  assert.equal(unmeasured.results[0].snapshot_id, '70000000-0000-0000-0000-000000000793');
  assert.equal(unmeasuredPersisted[0].data_trust.state, 'INSUFFICIENT_DATA');
  assert.deepEqual(unmeasuredSnapshots[0].counts, { received: 4, eligible: 4, usable: 0, excluded: 4 });

  console.log(JSON.stringify({ status: 'OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK', assertions: 32 }));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
