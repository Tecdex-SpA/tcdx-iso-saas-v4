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
  const controlContract = contracts.find((contract) => contract.source_code === 'control_assurance_evidence');
  assert.ok(controlContract, 'CONTROL-EFFECT source contract expected');
  assert.ok(!String(controlContract.variable_map.design).includes('score/100'), 'aggregate assurance score must not feed design dimension');
  assert.ok(String(controlContract.variable_map.effectivenesses).includes('aggregate assurance score'), 'aggregate assurance score remains valid for composite effectivenesses');
  assert.ok(String(controlContract.limitations).includes('nunca fabrica dimensiones desde score'), 'CONTROL-EFFECT anti-fabrication contract must be explicit');
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
  const residualPortfolioInput = mapFormulaInput('F5_5_RESIDUAL_RISK', [
    { likelihood: 4, impact: 5, assurance_score: 60 },
    { likelihood: 2, impact: 5, assurance_score: 80 },
  ]);
  assert.deepStrictEqual(residualPortfolioInput, { inherentRisk: 15, controlEffectiveness: 0.7 });
  assert.strictEqual(executeFormula('F5_5_RESIDUAL_RISK', residualPortfolioInput).value, 4.5);
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
  const invalidMaturityInput = mapFormulaInput('F5_5_MATURITY', [{ level: null, weight: 1 }, { level: 87, weight: 1 }]);
  assert.deepStrictEqual(invalidMaturityInput, { levels: [] });
  assert.strictEqual(executeFormula('F5_5_MATURITY', invalidMaturityInput).value, null, 'maturity rows without a 0..5 level must not become a numeric value');

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

  const evidenceFreshnessInput = mapFormulaInput('F5_5_FRESHNESS_CONTINUOUS', [
    { id: 'evidence-a', tenant_id: 'tenant-a', status: 'aprobada', reviewed_at: new Date(Date.now() - 6 * 3600000).toISOString() },
    { id: 'evidence-b', tenant_id: 'tenant-a', status: 'pendiente', created_at: new Date(Date.now() - 72 * 3600000).toISOString() },
  ]);
  assert.strictEqual(evidenceFreshnessInput.halfLifeHours, 24 * 30);
  assert.ok(evidenceFreshnessInput.ageHours >= 0 && evidenceFreshnessInput.ageHours < 24, 'EVIDENCE-FRESH must derive age from latest effective evidence date');
  assert.ok(executeFormula('F5_5_FRESHNESS_CONTINUOUS', evidenceFreshnessInput).value > 0, 'EVIDENCE-FRESH must calculate from real evidence dates');

  const evidenceQueries = [];
  const evidenceClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['evidences', 'grc_evidence_versions', 'grc_evidence_submissions', 'grc_evidence_reviews'].includes(table) }] };
    }
    evidenceQueries.push({ sql, params });
    if (sql.includes('FROM evidences e')) return { rows: [] };
    if (sql.includes('FROM grc_evidence_versions v')) {
      assert.ok(!/\bv\.status\b/.test(sql), 'grc_evidence_versions has no direct status column; adapter must derive it from submissions/reviews');
      assert.ok(sql.includes('grc_evidence_submissions s'), 'version evidence freshness must join submission metadata when available');
      assert.ok(sql.includes('grc_evidence_reviews r'), 'version evidence freshness must join latest review metadata when available');
      return { rows: [{
        id: 'version-a',
        tenant_id: 'tenant-a',
        status: 'approved',
        validated: true,
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
        reviewed_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        expires_at: null,
        __event_time: new Date(Date.now() - 3 * 3600000).toISOString(),
        freshness_score: null,
        appears_expired: false,
      }] };
    }
    throw new Error(`unexpected evidence query: ${sql}`);
  } };
  const evidenceSource = await resolveFormulaSource({
    client: evidenceClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_FRESHNESS_CONTINUOUS',
    sourceCode: 'evidence_freshness_records',
  });
  assert.strictEqual(evidenceQueries.length, 2, 'empty primary evidence table must continue to governed version evidence fallback');
  assert.strictEqual(evidenceSource.status, 'ready');
  assert.strictEqual(evidenceSource.rows.length, 1);
  assert.strictEqual(evidenceSource.rows[0].__physical_source, 'grc_evidence_versions');
  assert.ok(evidenceSource.formula_input.ageHours >= 0 && evidenceSource.formula_input.ageHours < 24);
  assert.ok(executeFormula('F5_5_FRESHNESS_CONTINUOUS', evidenceSource.formula_input).value > 0);

  const healthClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['calculation_runs', 'calculation_outputs'].includes(table) }] };
    }
    assert.ok(sql.includes('FROM calculation_runs cr'), 'GRC-HEALTH source must include formula_code from calculation_runs');
    assert.ok(sql.includes('JOIN calculation_outputs co'), 'GRC-HEALTH source must consume official calculation outputs');
    assert.ok(Array.isArray(params[3]) && params[3].includes('F5_5_FRESHNESS_CONTINUOUS') && params[3].includes('F5_C3_DATA_TRUST'));
    return { rows: [
      { id: 'out-risk', tenant_id: 'tenant-a', formula_code: 'F5_5_RESIDUAL_RISK', output_value: { value: 7 }, __event_time: new Date().toISOString() },
      { id: 'out-compliance', tenant_id: 'tenant-a', formula_code: 'F5_5_COMPLIANCE_WEIGHTED', output_value: { value: 83.33 }, __event_time: new Date().toISOString() },
      { id: 'out-actions', tenant_id: 'tenant-a', formula_code: 'F5_5_WEIGHTED_PROGRESS', output_value: { value: 62.5 }, __event_time: new Date().toISOString() },
      { id: 'out-evidence', tenant_id: 'tenant-a', formula_code: 'F5_5_FRESHNESS_CONTINUOUS', output_value: { value: 99 }, __event_time: new Date().toISOString() },
      { id: 'out-trust', tenant_id: 'tenant-a', formula_code: 'F5_C3_DATA_TRUST', output_value: { value: 85 }, __event_time: new Date().toISOString() },
    ] };
  } };
  const healthSource = await resolveFormulaSource({
    client: healthClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_GRC_HEALTH',
    sourceCode: 'grc_health_components',
  });
  assert.strictEqual(healthSource.status, 'ready');
  assert.strictEqual(healthSource.formula_input.evidence, 0.99);
  assert.strictEqual(healthSource.formula_input.dataTrust, 0.85);
  assert.ok(executeFormula('F5_5_GRC_HEALTH', healthSource.formula_input).value > 0);

  const maturityClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['survey_evaluations', 'metric_measurements', 'metric_definitions', 'metric_source_bindings'].includes(table) }] };
    }
    if (sql.includes('FROM survey_evaluations e')) return { rows: [] };
    if (sql.includes('FROM metric_measurements mm')) {
      assert.ok(sql.includes("msb.formula_code='F5_5_MATURITY'"), 'maturity fallback must not consume all metric measurements');
      return { rows: [{ id: 'maturity-mm', tenant_id: 'tenant-a', level: 3, weight: 2, status: 'calculated', __event_time: new Date().toISOString() }] };
    }
    throw new Error(`unexpected maturity query: ${sql}`);
  } };
  const maturitySource = await resolveFormulaSource({
    client: maturityClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_MATURITY',
    sourceCode: 'maturity_assessments',
  });
  assert.strictEqual(maturitySource.counts.received, 1);
  assert.deepStrictEqual(maturitySource.formula_input, { levels: [{ level: 3, weight: 2 }] });
  assert.strictEqual(executeFormula('F5_5_MATURITY', maturitySource.formula_input).value, 3);

  const invalidMaturityClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['survey_evaluations'].includes(table) }] };
    }
    if (sql.includes('FROM survey_evaluations e')) return { rows: [
      { id: 'maturity-missing-level', tenant_id: 'tenant-a', level: null, weight: 1, status: 'evaluated', __event_time: new Date().toISOString() },
      { id: 'maturity-percentage-score', tenant_id: 'tenant-a', level: 87, weight: 1, status: 'evaluated', __event_time: new Date().toISOString() },
    ] };
    throw new Error(`unexpected invalid maturity query: ${sql}`);
  } };
  const invalidMaturitySource = await resolveFormulaSource({
    client: invalidMaturityClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_MATURITY',
    sourceCode: 'maturity_assessments',
  });
  assert.strictEqual(invalidMaturitySource.counts.received, 2);
  assert.strictEqual(invalidMaturitySource.counts.usable, 0);
  assert.deepStrictEqual(invalidMaturitySource.formula_input, { levels: [] });
  assert.ok(invalidMaturitySource.exclusions.some((item) => item.code === 'maturity_level_missing_or_invalid'));
  assert.ok(invalidMaturitySource.exclusions.some((item) => item.code === 'maturity_level_out_of_range'));

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

  const findingsClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: table === 'grc_readiness_findings' }] };
    }
    if (sql.includes('FROM grc_readiness_findings x')) return { rows: [
      { id: 'finding-without-severity', tenant_id: 'tenant-a', status: 'open', __event_time: new Date().toISOString() },
    ] };
    throw new Error(`unexpected findings query: ${sql}`);
  } };
  const findingsSource = await resolveFormulaSource({
    client: findingsClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_SEVERITY_INDEX',
    sourceCode: 'audit_findings_actions',
  });
  assert.strictEqual(findingsSource.counts.received, 1);
  assert.strictEqual(findingsSource.counts.usable, 0);
  assert.strictEqual(findingsSource.exclusions[0].code, 'severity_missing_or_invalid');

  const missingClient = { async query(sql) { if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }; throw new Error('unexpected query'); } };
  const missingTables = await resolveFormulaSource({ client: missingClient, tenantId: 'tenant-a', formulaCode: 'F5_5_ASSET_CRITICALITY' });
  assert.strictEqual(missingTables.status, 'source_unavailable');
  assert.ok(missingTables.reason.includes('No existen tablas operacionales'));
  process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_RESOLVER_TESTS_OK', formulas: FORMULAS.length, contracts: contracts.length, unresolved_internal: 0, fallback_assertions: 3, equivalence_assertions: 9, formula_execution_assertions: 8 }) + '\n');
}
main().catch((error) => { console.error(error); process.exit(1); });
