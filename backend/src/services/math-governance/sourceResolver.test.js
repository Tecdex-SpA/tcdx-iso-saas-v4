'use strict';
const assert = require('assert');
const { FORMULAS, FORMULA_MAP, executeFormula } = require('./formulaRegistry.service');
const { listFormulaSourceBindings, listSourceContracts } = require('./sourceContracts.service');
const { validateDataset } = require('./datasetValidation.service');
const { resolveFormulaSource, mapFormulaInput, firstPopulated, getSourceContract, PRIMARY_STATES } = require('./sourceResolver.service');
const { sourceContractMetadata } = require('./formulaBootstrap.service');
const { STATUS_SEMANTICS_BY_SOURCE, normalizeRowsStatus, normalizeStatus } = require('./statusSemantics.service');

async function main() {
  const bindings = listFormulaSourceBindings();
  assert.strictEqual(bindings.length, 53, 'every official formula must have a source binding');
  assert.strictEqual(FORMULAS.filter((formula) => formula.source_contract === 'pending_package_2').length, 0, 'package 2 must replace pending source markers');
  assert.strictEqual(FORMULA_MAP.get('F5_5_CONTROL_EFFECTIVENESS').version, 2, 'changed CONTROL-EFFECT governed payload must publish as a new formula version');
  assert.strictEqual(FORMULA_MAP.get('F5_5_INHERENT_RISK').version, 2, 'already-versioned inherent risk formula must not be bumped again');
  const contracts = listSourceContracts();
  assert.ok(contracts.some((contract) => contract.availability === 'available'), 'available operational adapters expected');
  assert.strictEqual(contracts.length, 20, 'all source contracts must be version-governed');
  for (const contract of contracts) {
    assert.ok(contract.version >= 2, `PUI-03 count_semantics governance version bump missing for ${contract.source_code}`);
    assert.strictEqual(contract.count_semantics?.received, 'physical_rows_after_tenant_source_scope', `count semantics missing for ${contract.source_code}`);
    assert.ok(contract.count_semantics?.population_size, `population_size semantics missing for ${contract.source_code}`);
    assert.strictEqual(contract.period?.mode, 'contract_temporal_semantics', `generic created_at period default must not remain for ${contract.source_code}`);
    assert.ok(contract.temporal_semantics?.canonical_time_field, `temporal semantics missing for ${contract.source_code}`);
    assert.ok(contract.temporal_semantics?.time_meaning, `time meaning missing for ${contract.source_code}`);
    assert.ok(contract.status_semantics?.domain, `status semantics missing for ${contract.source_code}`);
    assert.ok(contract.status_semantics?.mapping_version, `status mapping version missing for ${contract.source_code}`);
  }
  assert.deepStrictEqual(contracts.filter((contract) => contract.availability === 'source_unavailable').map((contract) => contract.source_code), ['external_fx_rates']);
  assert.strictEqual(contracts.filter((contract) => ['legacy_adapter_required','partially_available'].includes(contract.availability)).length, 0, 'internal contracts must be resolved');
  const controlContract = contracts.find((contract) => contract.source_code === 'control_assurance_evidence');
  assert.ok(controlContract, 'CONTROL-EFFECT source contract expected');
  const controlContractMetadata = sourceContractMetadata(controlContract);
  assert.strictEqual(controlContractMetadata.scale_metadata.variables.design.source_scale, 'PERCENT_0_100');
  assert.strictEqual(controlContractMetadata.count_semantics.received, 'physical_rows_after_tenant_source_scope');
  assert.strictEqual(controlContractMetadata.temporal_semantics.time_meaning, 'control_assurance_calculation_time');
  assert.strictEqual(controlContractMetadata.status_semantics.domain, 'control');
  assert.ok(!String(controlContract.variable_map.design).includes('score/100'), 'aggregate assurance score must not feed design dimension');
  assert.ok(String(controlContract.variable_map.effectivenesses).includes('aggregate assurance score'), 'aggregate assurance score remains valid for composite effectivenesses');
  assert.ok(String(controlContract.limitations).includes('nunca fabrica dimensiones desde score'), 'CONTROL-EFFECT anti-fabrication contract must be explicit');
  assert.strictEqual(controlContract.scale_metadata.variables.design.source_scale, 'PERCENT_0_100');
  assert.strictEqual(controlContract.scale_metadata.variables.design.canonical_scale, 'RATIO_0_1');
  assert.strictEqual(controlContract.scale_metadata.variables.effectivenesses.normalization_strategy, 'percent_to_ratio');
  const riskContract = contracts.find((contract) => contract.source_code === 'risk_register_controls');
  assert.strictEqual(riskContract.scale_metadata.variables.probability.source_scale, 'SCORE_1_5');
  assert.strictEqual(riskContract.scale_metadata.variables.impact.allow_zero, false);
  const maturityContract = contracts.find((contract) => contract.source_code === 'maturity_assessments');
  assert.strictEqual(maturityContract.scale_metadata.variables.level.canonical_scale, 'SCORE_0_5');
  assert.strictEqual(maturityContract.scale_metadata.variables.score.normalization_strategy, 'percent_to_score_0_5');
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
  assert.strictEqual(dataset.receivedCount, 3);
  assert.strictEqual(dataset.eligibleCount, 1);
  assert.strictEqual(dataset.usable_rows.length, 1);
  assert.strictEqual(dataset.excludedCount, 2);
  assert.strictEqual(dataset.exclusionIssueCount, 3);
  assert.strictEqual(dataset.exclusionIssueInstanceCount, 3);
  assert.strictEqual(dataset.population_size, 1);
  assert.ok(dataset.hash.length === 64);
  assert.ok(dataset.exclusions.some((item) => item.code === 'tenant_mismatch'));
  assert.ok(dataset.exclusions.some((item) => item.code === 'duplicate_natural_key'));
  assert.ok(dataset.exclusions.every((item) => item.source_record), 'dataset exclusions must expose source record for audit');

  const auditClosed = normalizeStatus('audit', 'closed');
  const incidentClosed = normalizeStatus('incident', 'closed');
  assert.strictEqual(auditClosed.canonical_status, 'closed');
  assert.strictEqual(incidentClosed.canonical_status, 'closed');
  assert.notStrictEqual(auditClosed.reason, incidentClosed.reason, 'same source status must remain domain-specific');
  const statusRows = normalizeRowsStatus([
    { id: 'supplier-approved', tenant_id: 'tenant-a', status: 'approved' },
    { id: 'supplier-draft', tenant_id: 'tenant-a', status: 'draft' },
    { id: 'supplier-mystery', tenant_id: 'tenant-a', status: 'mystery' },
  ], STATUS_SEMANTICS_BY_SOURCE.supplier_tprm_assessments);
  const statusDataset = validateDataset({
    tenantId: 'tenant-a',
    sourceKey: 'status-unit-test',
    requiredFields: ['id', 'tenant_id', 'status'],
    minimumSampleSize: 1,
    rows: statusRows,
  });
  assert.strictEqual(statusRows[2].status, 'unknown', 'unknown status must remain visible');
  assert.strictEqual(statusDataset.receivedCount, 3);
  assert.strictEqual(statusDataset.usableCount, 1);
  assert.strictEqual(statusDataset.excludedCount, 2);
  assert.strictEqual(statusDataset.counts.ineligible, 2);
  assert.ok(statusDataset.exclusions.some((item) => item.code === 'status_not_eligible'));
  assert.ok(statusDataset.exclusions.some((item) => item.code === 'status_unmapped'));
  assert.ok(statusDataset.status_summary.classifications.every((item) => item.mapping_version === 'supplier-status-map-v1'));

  const temporalDataset = validateDataset({
    tenantId: 'tenant-a',
    sourceKey: 'temporal-unit-test',
    requiredFields: ['id', 'tenant_id'],
    minimumSampleSize: 1,
    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z', as_of: '2026-01-20T00:00:00Z' },
    now: new Date('2026-02-15T00:00:00Z'),
    temporalSemantics: {
      canonical_time_field: '__event_time',
      time_meaning: 'unit_test_measurement_time',
      period_policy: 'start_inclusive_end_exclusive',
      validity_policy: 'measurement_time_in_requested_period',
      missing_time_policy: 'exclude_with_reason',
      as_of_policy: 'exclude_future_canonical_time',
    },
    rows: [
      { id: 'in', tenant_id: 'tenant-a', __event_time: '2026-01-10T00:00:00Z' },
      { id: 'before', tenant_id: 'tenant-a', __event_time: '2025-12-31T23:59:59Z' },
      { id: 'after', tenant_id: 'tenant-a', __event_time: '2026-02-01T00:00:00Z' },
      { id: 'missing', tenant_id: 'tenant-a' },
      { id: 'future-asof', tenant_id: 'tenant-a', __event_time: '2026-01-25T00:00:00Z' },
      { id: 'other-tenant', tenant_id: 'tenant-b', __event_time: '2026-01-10T00:00:00Z' },
    ],
  });
  assert.strictEqual(temporalDataset.receivedCount, 6);
  assert.strictEqual(temporalDataset.usableCount, 1);
  assert.strictEqual(temporalDataset.excludedCount, 5);
  assert.strictEqual(temporalDataset.counts.population_size, 1);
  assert.ok(temporalDataset.exclusions.some((item) => item.code === 'date_before_period'));
  assert.ok(temporalDataset.exclusions.some((item) => item.code === 'date_after_period'));
  assert.ok(temporalDataset.exclusions.some((item) => item.code === 'temporal_missing_required_time'));
  assert.ok(temporalDataset.exclusions.some((item) => item.code === 'temporal_after_as_of'));
  assert.ok(temporalDataset.exclusions.some((item) => item.code === 'tenant_mismatch'));
  assert.ok(temporalDataset.temporal_summary.classifications.some((item) => item.classification === 'missing_required_time'));

  const intervalDataset = validateDataset({
    tenantId: 'tenant-a',
    sourceKey: 'temporal-interval-test',
    requiredFields: ['id', 'tenant_id'],
    minimumSampleSize: 1,
    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
    now: new Date('2026-02-15T00:00:00Z'),
    temporalSemantics: {
      classification: 'validity_interval',
      canonical_time_field: '__event_time',
      valid_from_fields: ['opened_at'],
      valid_to_fields: ['closed_at'],
      time_meaning: 'action_lifecycle_state_time',
      validity_policy: 'action_state_in_requested_period',
      missing_time_policy: 'exclude_with_reason',
    },
    rows: [
      { id: 'vigente', tenant_id: 'tenant-a', opened_at: '2025-12-15T00:00:00Z', closed_at: null },
      { id: 'cerrado-antes', tenant_id: 'tenant-a', opened_at: '2025-10-01T00:00:00Z', closed_at: '2025-12-31T00:00:00Z' },
    ],
  });
  assert.strictEqual(intervalDataset.usableCount, 1, 'validity interval created before the period must remain eligible when still open');
  assert.ok(intervalDataset.exclusions.some((item) => item.code === 'date_before_period'));

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
  const lowPercentControlInput = mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS', [{ design_score: 0.8, implementation_score: 0.7, operation_score: 0.9, evidence_score: 0.6 }]);
  assert.deepStrictEqual(lowPercentControlInput, { design: 0.008, implementation: 0.006999999999999999, operation: 0.009000000000000001, evidence: 0.006 });
  assert.strictEqual(executeFormula('F5_5_CONTROL_EFFECTIVENESS', lowPercentControlInput).value, 0.0075, 'CONTROL-EFFECT percent source scale must not infer 0.8 as 80%');
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
  const maturityPercentInput = mapFormulaInput('F5_5_MATURITY', [{ score: 80, __scale_level_source: 'PERCENT_0_100', weight: 1 }]);
  assert.deepStrictEqual(maturityPercentInput, { levels: [{ level: 4, weight: 1 }] });
  assert.strictEqual(executeFormula('F5_5_MATURITY', maturityPercentInput).value, 4);
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
  ], getSourceContract('risk_register_controls'));
  assert.strictEqual(calls.length, 2, 'empty primary source must continue to legacy source');
  assert.strictEqual(fallback.length, 1);
  assert.strictEqual(fallback[0].__physical_source, 'legacy_table');
  assert.strictEqual(fallback[0].__fallback_used, true);
  assert.strictEqual(fallback[0].__fallback_reason, 'primary_no_rows');
  assert.strictEqual(fallback[0].__primary_state, PRIMARY_STATES.NO_ROWS);

  const primaryValid = await firstPopulated(fallbackClient, [
    { table: 'primary_table', sql: 'legacy', params: ['tenant-a'] },
    { table: 'legacy_table', sql: 'legacy', params: ['tenant-a'] },
  ], getSourceContract('risk_register_controls'));
  assert.strictEqual(primaryValid[0].__fallback_used, false, 'primary rows must not use fallback');

  const disallowedFallback = await firstPopulated(fallbackClient, [
    { table: 'primary_table', sql: 'primary', params: ['tenant-a'] },
    { table: 'legacy_table', sql: 'legacy', params: ['tenant-a'] },
  ], getSourceContract('incident_operational_events'));
  assert.strictEqual(disallowedFallback.length, 0, 'primary no rows must not fallback without explicit policy');

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
        event_date: '2999-08-31T23:59:59.999Z',
        __event_time: '2999-08-31T23:59:59.999Z',
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
  assert.strictEqual(lossSource.status, 'validated_with_warnings');
  assert.strictEqual(lossSource.fallback_used, false);
  assert.strictEqual(lossSource.primary_state, PRIMARY_STATES.ROWS_EXCLUDED);
  assert.strictEqual(lossSource.counts.received, 1);
  assert.strictEqual(lossSource.counts.usable, 0);
  assert.ok(lossSource.exclusions.some((item) => item.code === 'date_in_future'), 'future occurrence must be excluded instead of falling back to created_at');
  assert.ok(lossSource.warnings.some((warning) => String(warning).includes('sin fallback a created_at')), 'future occurrence warning expected');

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
  assert.strictEqual(evidenceSource.fallback_used, true);
  assert.strictEqual(evidenceSource.fallback_reason, 'primary_no_rows');
  assert.strictEqual(evidenceSource.primary_state, PRIMARY_STATES.NO_ROWS);
  assert.strictEqual(evidenceSource.rows.length, 1);
  assert.strictEqual(evidenceSource.rows[0].__physical_source, 'grc_evidence_versions');
  assert.strictEqual(evidenceSource.source_snapshot.fallback_summary.fallback_source, 'grc_evidence_versions');
  assert.ok(String(evidenceSource.source_snapshot.fallback_summary.warning).includes('fallback legacy'));
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
  assert.strictEqual(invalidMaturitySource.fallback_used, false);
  assert.strictEqual(invalidMaturitySource.primary_state, PRIMARY_STATES.ROWS_EXCLUDED);
  assert.strictEqual(invalidMaturitySource.counts.eligible, 2);
  assert.strictEqual(invalidMaturitySource.counts.usable, 0);
  assert.strictEqual(invalidMaturitySource.counts.excluded, 2);
  assert.strictEqual(invalidMaturitySource.counts.exclusionIssueCount, 1);
  assert.strictEqual(invalidMaturitySource.counts.population_size, 2);
  assert.strictEqual(invalidMaturitySource.status, 'validated_with_warnings');
  assert.deepStrictEqual(invalidMaturitySource.formula_input, { levels: [] });
  assert.ok(invalidMaturitySource.exclusions.some((item) => item.code === 'maturity_level_scale_invalid'));

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
  assert.strictEqual(riskSource.fallback_used, true);
  assert.strictEqual(riskSource.fallback_reason, 'primary_source_absent');
  assert.strictEqual(riskSource.primary_state, PRIMARY_STATES.ABSENT);
  assert.strictEqual(riskSource.counts.eligible, 4);
  assert.strictEqual(riskSource.counts.usable, 3);
  assert.strictEqual(riskSource.counts.excluded, 1);
  assert.strictEqual(riskSource.counts.exclusionIssueCount, 1);
  assert.strictEqual(riskSource.counts.population_size, 4);
  assert.strictEqual(riskSource.source_snapshot.row_count, 4);
  assert.strictEqual(riskSource.source_snapshot.excluded_rows, 1);
  assert.strictEqual(riskSource.source_snapshot.exclusion_issue_count, 1);
  assert.ok(Array.isArray(riskSource.source_snapshot.exclusions), 'snapshot exclusions must carry auditable issue details');
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
  assert.strictEqual(findingsSource.fallback_used, false);
  assert.strictEqual(findingsSource.primary_state, PRIMARY_STATES.ROWS_EXCLUDED);
  assert.strictEqual(findingsSource.counts.eligible, 1);
  assert.strictEqual(findingsSource.counts.usable, 0);
  assert.strictEqual(findingsSource.counts.excluded, 1);
  assert.strictEqual(findingsSource.counts.exclusionIssueCount, 1);
  assert.strictEqual(findingsSource.counts.population_size, 1);
  assert.strictEqual(findingsSource.status, 'validated_with_warnings');
  assert.strictEqual(findingsSource.exclusions[0].code, 'severity_missing_or_invalid');

  const missingClient = { async query(sql) { if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }; throw new Error('unexpected query'); } };
  const missingTables = await resolveFormulaSource({ client: missingClient, tenantId: 'tenant-a', formulaCode: 'F5_5_ASSET_CRITICALITY' });
  assert.strictEqual(missingTables.status, 'source_unavailable');
  assert.ok(missingTables.reason.includes('No existen tablas operacionales'));
  const incompatibleClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) return { rows: [{ exists: String(params[0] || '').includes('grc_incidents') }] };
    throw Object.assign(new Error('schema incompatible'), { code: '42703' });
  } };
  await assert.rejects(
    () => resolveFormulaSource({ client: incompatibleClient, tenantId: 'tenant-a', formulaCode: 'F5_5_SEVERITY_INDEX', sourceCode: 'incident_operational_events' }),
    (error) => error?.code === 'SOURCE_SCHEMA_INCOMPATIBLE',
    'source incompatible must remain visible and must not fallback'
  );
  process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_RESOLVER_TESTS_OK', formulas: FORMULAS.length, contracts: contracts.length, unresolved_internal: 0, fallback_assertions: 3, equivalence_assertions: 9, formula_execution_assertions: 8 }) + '\n');
}
main().catch((error) => { console.error(error); process.exit(1); });
