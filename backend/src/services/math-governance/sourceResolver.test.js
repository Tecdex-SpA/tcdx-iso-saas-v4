'use strict';
const assert = require('assert');
const { FORMULAS, executeFormula } = require('./formulaRegistry.service');
const { listFormulaSourceBindings, listSourceContracts } = require('./sourceContracts.service');
const { validateDataset } = require('./datasetValidation.service');
const { resolveFormulaSource, mapFormulaInput, firstPopulated } = require('./sourceResolver.service');

async function main() {
  const bindings = listFormulaSourceBindings();
  assert.strictEqual(bindings.length, 53, 'every official formula must have a source binding');
  assert.strictEqual(FORMULAS.filter((formula) => formula.source_contract === 'pending_package_2').length, 0, 'package 2 must replace pending source markers');
  const contracts = listSourceContracts();
  assert.ok(contracts.some((contract) => contract.availability === 'available'), 'available operational adapters expected');
  assert.deepStrictEqual(contracts.filter((contract) => contract.availability === 'source_unavailable').map((contract) => contract.source_code), ['external_fx_rates']);
  assert.strictEqual(contracts.filter((contract) => ['legacy_adapter_required','partially_available'].includes(contract.availability)).length, 0, 'internal contracts must be resolved');
  for (const contract of contracts) {
    assert.ok(contract.checksum && contract.checksum.length === 64, `contract checksum missing for ${contract.source_code}`);
    assert.ok(!/;\s*(drop|delete|update|insert|alter)\b/i.test(contract.query || ''), `contract must not contain mutable SQL: ${contract.source_code}`);
    assert.ok(contract.variable_map && typeof contract.variable_map === 'object', `variable equivalence missing for ${contract.source_code}`);
  }

  const dataset = validateDataset({
    tenantId: 'tenant-a', sourceKey: 'unit-test', requiredFields: ['id', 'tenant_id', 'value'], minimumSampleSize: 1, naturalKey: 'id', rangeRules: { value: { min: 0, max: 100 } },
    rows: [
      { id: 'a', tenant_id: 'tenant-a', value: 10, measured_at: '2026-01-01T00:00:00Z' },
      { id: 'b', tenant_id: 'tenant-b', value: 20, measured_at: '2026-01-01T00:00:00Z' },
      { id: 'a', tenant_id: 'tenant-a', value: 120, measured_at: '2026-01-01T00:00:00Z' },
    ],
  });
  assert.strictEqual(dataset.valid, false);
  assert.strictEqual(dataset.usable_rows.length, 1);
  assert.ok(dataset.hash.length === 64);
  assert.ok(dataset.exclusions.some((item) => item.code === 'tenant_mismatch'));
  assert.ok(dataset.exclusions.some((item) => item.code === 'duplicate_natural_key'));

  const inherentInput = mapFormulaInput('F5_5_INHERENT_RISK', [{ id: 'risk-a', probability: 4, impact: 5 }]);
  assert.deepStrictEqual(inherentInput.risks, [{ source_record: 'risk-a', physical_source: null, probability: 4, impact: 5, inherent_risk_score: 20 }]);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', inherentInput).value, 20);

  const multiRiskRows = [
    { id: 'risk-a', likelihood: 4, impact: 5 },
    { id: 'risk-b', likelihood: 2, impact: 5 },
    { id: 'risk-c', likelihood: 3, impact: 5 },
  ];
  const multiRiskInput = mapFormulaInput('F5_5_INHERENT_RISK', multiRiskRows);
  assert.deepStrictEqual(multiRiskInput.scores, [20, 10, 15]);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', multiRiskInput).value, 15);
  const reorderedRiskInput = mapFormulaInput('F5_5_INHERENT_RISK', [multiRiskRows[2], multiRiskRows[0], multiRiskRows[1]]);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', reorderedRiskInput).value, 15);
  const causalRiskInput = mapFormulaInput('F5_5_INHERENT_RISK', [
    { id: 'risk-a', likelihood: 3, impact: 5 },
    { id: 'risk-b', likelihood: 2, impact: 5 },
    { id: 'risk-c', likelihood: 3, impact: 5 },
  ]);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', causalRiskInput).value, 13.3333);
  assert.throws(
    () => executeFormula('F5_5_INHERENT_RISK', mapFormulaInput('F5_5_INHERENT_RISK', [{ id: 'invalid-risk', likelihood: null, impact: 5 }])),
    (error) => error?.code === 'FORMULA_ZERO_DENOMINATOR',
    'zero usable risks must not become zero'
  );

  const residualInput = mapFormulaInput('F5_5_RESIDUAL_RISK', [{ exposure: 20, assurance_score: 65 }]);
  assert.deepStrictEqual(residualInput, { inherentRisk: 20, controlEffectiveness: 0.65 });
  assert.strictEqual(executeFormula('F5_5_RESIDUAL_RISK', residualInput).value, 7);
  const residualMissingControl = mapFormulaInput('F5_5_RESIDUAL_RISK', [{ exposure: 20 }]);
  assert.deepStrictEqual(residualMissingControl, { inherentRisk: 20, controlEffectiveness: null });
  assert.throws(
    () => executeFormula('F5_5_RESIDUAL_RISK', residualMissingControl),
    (error) => error?.code === 'FORMULA_VARIABLE_REQUIRED' && error?.details?.variable === 'controlEffectiveness',
    'missing control effectiveness must not become zero'
  );

  const coverageInput = mapFormulaInput('F5_5_COVERAGE', [{ status: 'conform', applicability: true }, { status: 'pending', applicability: true }, { status: 'not_applicable', applicability: false }]);
  assert.deepStrictEqual(coverageInput, { evaluated: 2, applicable: 2 });
  assert.strictEqual(executeFormula('F5_5_COVERAGE', coverageInput).value, 100);

  const complianceInput = mapFormulaInput('F5_5_COMPLIANCE_WEIGHTED', [{ status: 'conform', weight: 2, applicability: true }, { status: 'not_applicable', weight: 1, applicability: false }]);
  assert.strictEqual(complianceInput.assessments.length, 2);
  assert.strictEqual(complianceInput.assessments[1].notApplicable, true);
  assert.strictEqual(executeFormula('F5_5_COMPLIANCE_WEIGHTED', complianceInput).value, 100);

  const controlInput = mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS', [{ design_score: 80, implementation_score: 70, operation_score: 90, evidence_score: 60 }]);
  assert.deepStrictEqual(controlInput, { design: 0.8, implementation: 0.7, operation: 0.9, evidence: 0.6 });
  assert.strictEqual(executeFormula('F5_5_CONTROL_EFFECTIVENESS', controlInput).value, 0.75);
  const globalControlScore = mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS', [{ score: 85 }]);
  assert.deepStrictEqual(globalControlScore, { design: null, implementation: null, operation: null, evidence: null });
  assert.throws(() => executeFormula('F5_5_CONTROL_EFFECTIVENESS', globalControlScore), (error) => error?.code === 'FORMULA_VARIABLE_REQUIRED', 'global control score must not be copied into D/I/O/E dimensions');

  const likelihoodInput = mapFormulaInput('F5_5_INHERENT_RISK', [{ id: 'risk-likelihood', likelihood: 4, impact: 5 }]);
  assert.strictEqual(likelihoodInput.risks[0].probability, 4);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', likelihoodInput).value, 20);
  const updatedLikelihoodInput = mapFormulaInput('F5_5_INHERENT_RISK', [{ id: 'risk-likelihood', likelihood: 3, impact: 5 }]);
  assert.strictEqual(updatedLikelihoodInput.risks[0].probability, 3);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', updatedLikelihoodInput).value, 15);

  const severityInput = mapFormulaInput('F5_5_SEVERITY_INDEX', [{ severity: 'low' }, { severity: 'critical' }, { severity: 'high' }]);
  assert.deepStrictEqual(severityInput, { low: 1, medium: 0, high: 1, critical: 1 });
  assert.ok(executeFormula('F5_5_SEVERITY_INDEX', severityInput).value > 0);

  const actionInput = mapFormulaInput('F5_5_WEIGHTED_PROGRESS', [
    { opened_at: '2026-01-01T00:00:00Z', progress_percent: 25, weight: 1 },
    { opened_at: '2026-01-01T00:00:00Z', latest_progress_percent: 50, weight: 1 },
    { opened_at: '2026-01-01T00:00:00Z', progress: 1, weight: 2 },
    { opened_at: '2026-01-01T00:00:00Z', weight: 1 },
  ]);
  assert.deepStrictEqual(actionInput.items.map((item) => item.progress), [0.25, 0.5, 1]);
  assert.strictEqual(executeFormula('F5_5_WEIGHTED_PROGRESS', actionInput).value, 68.75);

  const lossInputFromUiColumns = mapFormulaInput('F5_5_NET_LOSS', [
    { gross_loss: '100000.00', recoveries: '25000.00', net_loss: '75000.00' },
  ]);
  assert.deepStrictEqual(lossInputFromUiColumns, { grossLoss: 100000, recoveries: 25000 });
  assert.strictEqual(executeFormula('F5_5_NET_LOSS', lossInputFromUiColumns).value, 75000);

  const maturityInput = mapFormulaInput('F5_5_MATURITY', [{ level: 2, weight: 1 }, { level: 4, weight: 3 }]);
  assert.deepStrictEqual(maturityInput, { levels: [{ level: 2, weight: 1 }, { level: 4, weight: 3 }] });
  assert.strictEqual(executeFormula('F5_5_MATURITY', maturityInput).value, 3.5);

  const trustInput = mapFormulaInput('F5_C3_DATA_TRUST', [{ dimensions: { completeness:{score:90},accuracy:{score:80},consistency:{score:85},freshness:{score:75},lineage:{score:100},validation:{score:90},stability:{score:70},coverage:{score:80} } }]);
  assert.strictEqual(executeFormula('F5_C3_DATA_TRUST', trustInput).value, 84.75);
  const partialTrust = mapFormulaInput('F5_C3_DATA_TRUST', [{ dimensions: { completeness:{score:90} } }]);
  assert.throws(() => executeFormula('F5_C3_DATA_TRUST', partialTrust), (error) => error?.code === 'FORMULA_VARIABLE_REQUIRED', 'unknown trust dimensions must not be renormalized');

  const calls = [];
  const fallbackClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return { rows: [{ exists: true }] };
    calls.push({ sql, params });
    if (sql === 'primary') return { rows: [] };
    if (sql === 'legacy') return { rows: [{ id: 'risk-1', tenant_id: 'tenant-a' }] };
    throw new Error('unexpected query');
  } };
  const fallback = await firstPopulated(fallbackClient, [
    { table: 'primary_table', sql: 'primary', params: ['tenant-a'] },
    { table: 'legacy_table', sql: 'legacy', params: ['tenant-a'] },
  ]);
  assert.strictEqual(calls.length, 2, 'empty primary source must continue to legacy source');
  assert.strictEqual(fallback.length, 1);
  assert.strictEqual(fallback[0].__physical_source, 'legacy_table');

  const lossQueries = [];
  const lossClient = { async query(sql, params) {
    if (sql.includes('to_regclass')) return { rows: [{ exists: true }] };
    lossQueries.push({ sql, params });
    if (sql.includes('FROM loss_events e')) {
      return { rows: [{
        id: 'loss-1',
        tenant_id: 'tenant-a',
        status: 'confirmed',
        currency: 'CLP',
        raw_event_date: '2999-08-31T23:59:59.999Z',
        event_date: '2026-08-10T12:00:00.000Z',
        __event_time: '2026-08-10T12:00:00.000Z',
        gross_loss_amount: '100000.00',
        recovery_amount: '25000.00',
        net_loss_amount: '75000.00',
        raw_event_date_was_future: true,
      }] };
    }
    throw new Error(`unexpected loss query: ${sql}`);
  } };
  const lossSource = await resolveFormulaSource({
    client: lossClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_NET_LOSS',
    sourceCode: 'loss_events_operational',
  });
  assert.strictEqual(lossQueries.length, 1);
  assert.strictEqual(lossSource.status, 'ready');
  assert.strictEqual(lossSource.rows.length, 1);
  assert.deepStrictEqual(lossSource.formula_input, { grossLoss: 100000, recoveries: 25000 });
  assert.strictEqual(executeFormula('F5_5_NET_LOSS', lossSource.formula_input).value, 75000);
  assert.ok(lossSource.warnings.some((warning) => String(warning).includes('occurred_at viene en el futuro')), 'future occurrence warning expected');

  const riskRows = [
    { id: 'risk-a', tenant_id: '70000000-0000-0000-0000-000000000701', likelihood: 4, impact: 5 },
    { id: 'risk-b', tenant_id: '70000000-0000-0000-0000-000000000701', likelihood: 2, impact: 5 },
    { id: 'risk-c', tenant_id: '70000000-0000-0000-0000-000000000701', likelihood: 3, impact: 5 },
    { id: 'risk-invalid', tenant_id: '70000000-0000-0000-0000-000000000701', likelihood: null, impact: 5 },
  ];
  const riskClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) return { rows: [{ exists: String(params[0] || '').includes('grc_quantitative_risk_assessments') }] };
    if (sql.includes('FROM grc_quantitative_risk_assessments x')) return { rows: riskRows };
    throw new Error(`unexpected risk query: ${sql}`);
  } };
  const riskSource = await resolveFormulaSource({
    client: riskClient,
    tenantId: '70000000-0000-0000-0000-000000000701',
    formulaCode: 'F5_5_INHERENT_RISK',
  });
  assert.strictEqual(riskSource.counts.received, 4);
  assert.strictEqual(riskSource.counts.usable, 3);
  assert.strictEqual(riskSource.counts.excluded, 1);
  assert.strictEqual(riskSource.lineage.length, 3);
  assert.deepStrictEqual(riskSource.formula_input.scores, [20, 10, 15]);
  assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', riskSource.formula_input).value, 15);

  const missingClient = { async query(sql) { if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }; throw new Error('unexpected query'); } };
  const missingTables = await resolveFormulaSource({ client: missingClient, tenantId: 'tenant-a', formulaCode: 'F5_5_ASSET_CRITICALITY' });
  assert.strictEqual(missingTables.status, 'source_unavailable');
  assert.ok(missingTables.reason.includes('No existen tablas operacionales'));
  process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_RESOLVER_TESTS_OK', formulas: FORMULAS.length, contracts: contracts.length, unresolved_internal: 0, fallback_assertions: 3, equivalence_assertions: 9, formula_execution_assertions: 8 }) + '\n');
}
main().catch((error) => { console.error(error); process.exit(1); });
