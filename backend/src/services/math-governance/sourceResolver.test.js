'use strict';
const assert = require('assert');
const { FORMULAS, FORMULA_MAP, executeFormula } = require('./formulaRegistry.service');
const { listFormulaSourceBindings, listSourceContracts } = require('./sourceContracts.service');
const { validateDataset } = require('./datasetValidation.service');
const { resolveFormulaSource, mapFormulaInput, firstPopulated, getSourceContract, PRIMARY_STATES } = require('./sourceResolver.service');
const { sourceContractMetadata } = require('./formulaBootstrap.service');
const { STATUS_SEMANTICS_BY_SOURCE, PRODUCER_STATUS_CONTRACTS, normalizeRowsStatus, normalizeStatus } = require('./statusSemantics.service');
const { DATA_TRUST_MODEL_VERSION, DATA_TRUST_STATES } = require('./dataTrust.service');

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
  assert.strictEqual(riskContract.version, 7, 'risk status semantics v2 must publish under a new source contract version');
  assert.strictEqual(riskContract.status_semantics.mapping_version, 'risk-status-map-v2');
  assert.strictEqual(riskContract.scale_metadata.variables.probability.source_scale, 'SCORE_1_5');
  assert.strictEqual(riskContract.scale_metadata.variables.impact.allow_zero, false);
  const changedStatusContractVersions = new Map([
    ['control_assurance_evidence', [7, 'control-status-map-v2']],
    ['audit_findings_actions', [9, 'audit-status-map-v3']],
    ['incident_operational_events', [5, 'incident-status-map-v2']],
    ['loss_events_operational', [6, 'loss-status-map-v2']],
    ['supplier_tprm_assessments', [5, 'supplier-status-map-v2']],
    ['assurance_test_results', [5, 'assurance-status-map-v2']],
    ['indicator_data_trust_assessments', [5, 'data_trust-status-map-v2']],
  ]);
  for (const [sourceCode, [version, mappingVersion]] of changedStatusContractVersions.entries()) {
    const contract = contracts.find((item) => item.source_code === sourceCode);
    assert.strictEqual(contract.version, version, `${sourceCode} status semantics changed payload must be versioned`);
    assert.strictEqual(contract.status_semantics.mapping_version, mappingVersion, `${sourceCode} must expose expected status mapping version`);
  }
  const auditContract = contracts.find((contract) => contract.source_code === 'audit_findings_actions');
  assert.strictEqual(auditContract.version, 9, 'Severity schema compatibility change must publish audit_findings_actions as a new source contract version');
  assert.ok(!auditContract.columns.includes('source_as_of'), 'audit_findings_actions must not require non-existent grc_readiness_snapshots.source_as_of');
  assert.ok(!auditContract.temporal_semantics.source_time_fields.includes('source_as_of'), 'Severity temporal fields must use produced snapshot fields only');
  assert.ok(!auditContract.temporal_semantics.valid_from_fields.includes('source_as_of'), 'Severity valid-from fields must not include non-existent source_as_of');
  const maturityContract = contracts.find((contract) => contract.source_code === 'maturity_assessments');
  assert.strictEqual(maturityContract.version, 7, 'maturity producer status/temporal drift closure must publish under a new source contract version');
  assert.strictEqual(maturityContract.status_semantics.mapping_version, 'maturity-status-map-v2');
  assert.strictEqual(maturityContract.scale_metadata.variables.level.canonical_scale, 'SCORE_0_5');
  assert.strictEqual(maturityContract.scale_metadata.variables.score.normalization_strategy, 'percent_to_score_0_5');
  const healthContract = contracts.find((contract) => contract.source_code === 'grc_health_components');
  assert.strictEqual(healthContract.version, 6, 'health component adapter projection change must be source-contract versioned');
  assert.ok(healthContract.columns.includes('started_at') && healthContract.columns.includes('completed_at'), 'health contract must expose temporal fallback fields used by validation');
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
  for (const [domain, statuses] of Object.entries(PRODUCER_STATUS_CONTRACTS)) {
    for (const status of statuses) {
      const normalized = normalizeStatus(domain, status, { required: true });
      assert.notStrictEqual(normalized.reason, 'status_unmapped', `${domain}.${status} must not drift from producer vocabulary`);
    }
  }
  assert.strictEqual(normalizeStatus('risk', 'suggested').eligible, false, 'suggested risk rows are visible but not official accepted risk population');
  assert.strictEqual(normalizeStatus('risk', 'needs_review').eligible, false, 'needs_review risk rows require workflow review before official risk population');
  assert.strictEqual(normalizeStatus('risk', 'accepted').eligible, true);
  assert.deepStrictEqual(
    {
      canonical_status: normalizeStatus('audit', ' En Progreso ').canonical_status,
      eligible: normalizeStatus('audit', ' En Progreso ').eligible,
    },
    { canonical_status: 'in_progress', eligible: true },
    'Spanish action status aliases must normalize without whitespace/casing drift'
  );
  assert.strictEqual(normalizeStatus('audit', 'bloqueado').canonical_status, 'blocked');
  assert.strictEqual(normalizeStatus('audit', 'bloqueado').eligible, true);
  assert.strictEqual(normalizeStatus('control', 'degraded').canonical_status, 'partially_effective');
  assert.strictEqual(normalizeStatus('control', 'degraded').eligible, true);
  assert.strictEqual(normalizeStatus('control', 'unknown').eligible, false);
  assert.strictEqual(normalizeStatus('assurance', 'pass with observations').canonical_status, 'pass_with_observations');
  assert.strictEqual(normalizeStatus('assurance', 'pass with observations').eligible, true);
  assert.strictEqual(normalizeStatus('audit', 'not applicable').canonical_status, 'not_applicable');
  assert.strictEqual(normalizeStatus('audit', 'mystery').reason, 'status_unmapped');
  assert.strictEqual(normalizeStatus('maturity', 'confirmed').eligible, true);
  assert.strictEqual(normalizeStatus('maturity', 'previewed').reason, 'status_not_eligible');
  assert.strictEqual(normalizeStatus('maturity', 'valid').canonical_status, 'calculated');
  assert.strictEqual(normalizeStatus('maturity', 'mystery').reason, 'status_unmapped');
  assert.strictEqual(normalizeStatus('data_trust', 'trusted').mapped, true);
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
  assert.ok(statusDataset.status_summary.classifications.every((item) => item.mapping_version === 'supplier-status-map-v2'));

  const auditStatusRows = normalizeRowsStatus([
    { id: 'action-in-progress', tenant_id: 'tenant-a', status: 'en progreso' },
    { id: 'action-blocked', tenant_id: 'tenant-a', status: 'bloqueado' },
    { id: 'action-cancelled', tenant_id: 'tenant-a', status: 'cancelado' },
  ], STATUS_SEMANTICS_BY_SOURCE.audit_findings_actions);
  const auditStatusDataset = validateDataset({
    tenantId: 'tenant-a',
    sourceKey: 'audit-status-unit-test',
    requiredFields: ['id', 'tenant_id', 'status'],
    minimumSampleSize: 1,
    rows: auditStatusRows,
  });
  assert.strictEqual(auditStatusDataset.receivedCount, 3);
  assert.strictEqual(auditStatusDataset.usableCount, 2);
  assert.strictEqual(auditStatusDataset.excludedCount, 1);
  assert.strictEqual(auditStatusDataset.counts.ineligible, 1);
  assert.ok(auditStatusDataset.exclusions.some((item) => item.code === 'status_not_eligible' && item.source_record === 'action-cancelled'));

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
      { id: 'cierra-despues', tenant_id: 'tenant-a', opened_at: '2025-12-15T00:00:00Z', closed_at: '2026-12-31T00:00:00Z' },
      { id: 'cerrado-antes', tenant_id: 'tenant-a', opened_at: '2025-10-01T00:00:00Z', closed_at: '2025-12-31T00:00:00Z' },
    ],
  });
  assert.strictEqual(intervalDataset.usableCount, 2, 'validity interval created before the period must remain eligible when still open or closing later');
  assert.ok(intervalDataset.exclusions.some((item) => item.code === 'date_before_period'));
  assert.ok(!intervalDataset.exclusions.some((item) => item.source_record === 'cierra-despues' && item.code === 'date_in_future'), 'future valid_to must not be treated as a future event');

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

	  const readinessFindingsClient = { async query(sql, params = []) {
	    if (sql.includes('to_regclass')) {
	      const table = String(params[0] || '').replace(/^public\./, '');
	      return { rows: [{ exists: ['grc_readiness_findings', 'grc_readiness_snapshots'].includes(table) }] };
	    }
	    assert.ok(sql.includes('JOIN grc_readiness_snapshots s'), 'readiness findings severity must derive temporal context from the parent snapshot');
	    assert.ok(!sql.includes('s.source_as_of'), 'readiness snapshot adapter must not reference non-existent source_as_of');
	    return { rows: [
	      { id: 'finding-low', tenant_id: 'tenant-a', severity: 'low', status: 'not_applicable', period_start: '2026-01-01T00:00:00Z', period_end: '2026-02-01T00:00:00Z', generated_at: '2026-01-31T00:00:00Z', __event_time: '2026-02-01T00:00:00Z' },
	      { id: 'finding-medium', tenant_id: 'tenant-a', severity: 'medium', status: 'not_applicable', period_start: null, period_end: null, generated_at: '2026-01-20T00:00:00Z', __event_time: '2026-01-20T00:00:00Z' },
	      { id: 'finding-high', tenant_id: 'tenant-a', severity: 'high', status: 'not_applicable', period_start: '2026-01-05T00:00:00Z', period_end: '2026-01-25T00:00:00Z', generated_at: '2026-01-25T00:00:00Z', __event_time: '2026-01-25T00:00:00Z' },
	      { id: 'finding-critical', tenant_id: 'tenant-a', severity: 'critical', status: 'not_applicable', period_start: '2026-01-10T00:00:00Z', period_end: '2026-01-30T00:00:00Z', generated_at: '2026-01-30T00:00:00Z', __event_time: '2026-01-30T00:00:00Z' },
	      { id: 'finding-info', tenant_id: 'tenant-a', severity: 'info', status: 'not_applicable', period_start: '2026-01-01T00:00:00Z', period_end: '2026-02-01T00:00:00Z', generated_at: '2026-01-31T00:00:00Z', __event_time: '2026-02-01T00:00:00Z' },
	      { id: 'finding-unknown', tenant_id: 'tenant-a', severity: 'unknown', status: 'not_applicable', period_start: '2026-01-01T00:00:00Z', period_end: '2026-02-01T00:00:00Z', generated_at: '2026-01-31T00:00:00Z', __event_time: '2026-02-01T00:00:00Z' },
	      { id: 'finding-before-period', tenant_id: 'tenant-a', severity: 'low', status: 'not_applicable', period_start: '2025-12-01T00:00:00Z', period_end: '2025-12-31T00:00:00Z', generated_at: '2025-12-31T00:00:00Z', __event_time: '2025-12-31T00:00:00Z' },
	    ] };
	  } };
	  const readinessFindingsSource = await resolveFormulaSource({
	    client: readinessFindingsClient,
	    tenantId: 'tenant-a',
	    formulaCode: 'F5_5_SEVERITY_INDEX',
	    sourceCode: 'audit_findings_actions',
	    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
	  });
	  assert.strictEqual(readinessFindingsSource.counts.received, 7);
	  assert.strictEqual(readinessFindingsSource.counts.usable, 4);
	  assert.strictEqual(readinessFindingsSource.counts.excluded, 3);
	  assert.deepStrictEqual(readinessFindingsSource.formula_input, { low: 1, medium: 1, high: 1, critical: 1 });
	  assert.ok(readinessFindingsSource.exclusions.some((item) => item.code === 'severity_not_eligible' && item.source_record === 'finding-info'));
	  assert.ok(readinessFindingsSource.exclusions.some((item) => item.code === 'severity_missing_or_invalid' && item.source_record === 'finding-unknown'));
	  assert.ok(readinessFindingsSource.exclusions.some((item) => item.code === 'date_before_period' && item.source_record === 'finding-before-period'));
	  assert.ok(!readinessFindingsSource.exclusions.some((item) => item.code === 'status_unmapped' || item.code === 'temporal_missing_required_time'), 'readiness finding status/temporal contract must not drift');

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
  assert.strictEqual(lossSource.data_trust.model_version, DATA_TRUST_MODEL_VERSION);
  assert.strictEqual(lossSource.data_trust.state, DATA_TRUST_STATES.INSUFFICIENT_DATA);
  assert.ok(lossSource.data_trust.reasons.includes('temporal_invalid'));
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
  assert.strictEqual(evidenceSource.data_trust.state, DATA_TRUST_STATES.TRUSTED_WITH_WARNINGS);
  assert.ok(evidenceSource.data_trust.reasons.includes('fallback_used'));
  assert.strictEqual(evidenceSource.source_snapshot.data_trust.model_version, DATA_TRUST_MODEL_VERSION);
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
	    assert.ok(sql.includes('cr.started_at') && sql.includes('cr.completed_at'), 'GRC-HEALTH adapter must project temporal fallback fields declared by the contract');
	    assert.ok(Array.isArray(params[3]) && params[3].includes('F5_5_FRESHNESS_CONTINUOUS') && params[3].includes('F5_C3_DATA_TRUST'));
	    const startedAt = '2026-01-10T00:00:00Z';
	    const completedAt = '2026-01-15T00:00:00Z';
	    return { rows: [
	      { id: 'out-risk', tenant_id: 'tenant-a', formula_code: 'F5_5_RESIDUAL_RISK', output_value: { value: 7 }, period_start: null, period_end: null, started_at: startedAt, completed_at: completedAt, __event_time: completedAt },
	      { id: 'out-compliance', tenant_id: 'tenant-a', formula_code: 'F5_5_COMPLIANCE_WEIGHTED', output_value: { value: 83.33 }, period_start: null, period_end: null, started_at: startedAt, completed_at: completedAt, __event_time: completedAt },
	      { id: 'out-actions', tenant_id: 'tenant-a', formula_code: 'F5_5_WEIGHTED_PROGRESS', output_value: { value: 62.5 }, period_start: null, period_end: null, started_at: startedAt, completed_at: completedAt, __event_time: completedAt },
	      { id: 'out-evidence', tenant_id: 'tenant-a', formula_code: 'F5_5_FRESHNESS_CONTINUOUS', output_value: { value: 99 }, period_start: null, period_end: null, started_at: startedAt, completed_at: completedAt, __event_time: completedAt },
	      { id: 'out-trust', tenant_id: 'tenant-a', formula_code: 'F5_C3_DATA_TRUST', output_value: { value: 85 }, period_start: null, period_end: null, started_at: startedAt, completed_at: completedAt, __event_time: completedAt },
	    ] };
	  } };
	  const healthSource = await resolveFormulaSource({
	    client: healthClient,
	    tenantId: 'tenant-a',
	    formulaCode: 'F5_5_GRC_HEALTH',
	    sourceCode: 'grc_health_components',
	    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
	  });
  assert.strictEqual(healthSource.status, 'ready');
  assert.strictEqual(healthSource.data_trust.state, DATA_TRUST_STATES.TRUSTED);
  assert.strictEqual(healthSource.data_trust.dimensions.population_sufficiency.status, 'pass');
	  assert.strictEqual(healthSource.formula_input.evidence, 0.99);
	  assert.strictEqual(healthSource.formula_input.dataTrust, 0.85);
	  assert.ok(!healthSource.exclusions.some((item) => item.code === 'temporal_missing_required_time'), 'missing period_start must not exclude health rows when started_at/completed_at prove the calculation interval');
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

	  const maturityStatusClient = { async query(sql, params = []) {
	    if (sql.includes('to_regclass')) {
	      const table = String(params[0] || '').replace(/^public\./, '');
	      return { rows: [{ exists: table === 'survey_evaluations' }] };
	    }
	    if (sql.includes('FROM survey_evaluations e')) {
	      assert.ok(sql.includes('confirmed_at') && sql.includes('created_at'), 'survey maturity adapter must use producer temporal fields without synthetic timestamps');
	      return { rows: [
	        { id: 'maturity-confirmed', tenant_id: 'tenant-a', level: 80, __scale_level_source: 'PERCENT_0_100', weight: 1, status: 'confirmed', evaluated_at: '2026-01-15T00:00:00Z', confirmed_at: '2026-01-15T00:00:00Z', created_at: '2026-01-10T00:00:00Z', __event_time: '2026-01-15T00:00:00Z' },
	        { id: 'maturity-previewed', tenant_id: 'tenant-a', level: 60, __scale_level_source: 'PERCENT_0_100', weight: 1, status: 'previewed', evaluated_at: '2026-01-10T00:00:00Z', confirmed_at: null, created_at: '2026-01-10T00:00:00Z', __event_time: '2026-01-10T00:00:00Z' },
	        { id: 'maturity-unknown-status', tenant_id: 'tenant-a', level: 70, __scale_level_source: 'PERCENT_0_100', weight: 1, status: 'mystery', evaluated_at: '2026-01-12T00:00:00Z', confirmed_at: null, created_at: '2026-01-12T00:00:00Z', __event_time: '2026-01-12T00:00:00Z' },
	      ] };
	    }
	    throw new Error(`unexpected maturity status query: ${sql}`);
	  } };
	  const maturityStatusSource = await resolveFormulaSource({
	    client: maturityStatusClient,
	    tenantId: 'tenant-a',
	    formulaCode: 'F5_5_MATURITY',
	    sourceCode: 'maturity_assessments',
	    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
	  });
	  assert.strictEqual(maturityStatusSource.counts.received, 3);
	  assert.strictEqual(maturityStatusSource.counts.usable, 1);
	  assert.strictEqual(maturityStatusSource.counts.excluded, 2);
	  assert.deepStrictEqual(maturityStatusSource.formula_input, { levels: [{ level: 4, weight: 1 }] });
	  assert.ok(maturityStatusSource.exclusions.some((item) => item.code === 'status_not_eligible' && item.source_record === 'maturity-previewed'));
	  assert.ok(maturityStatusSource.exclusions.some((item) => item.code === 'status_unmapped' && item.source_record === 'maturity-unknown-status'));
	  assert.ok(!maturityStatusSource.exclusions.some((item) => item.code === 'temporal_missing_required_time'), 'producer-confirmed maturity timestamps must satisfy temporal contract');

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
  assert.strictEqual(invalidMaturitySource.data_trust.state, DATA_TRUST_STATES.INSUFFICIENT_DATA);
  assert.ok(invalidMaturitySource.data_trust.reasons.includes('insufficient_population'));
  assert.ok(invalidMaturitySource.data_trust.reasons.includes('scale_unit_invalid'));
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
  assert.strictEqual(riskSource.data_trust.state, DATA_TRUST_STATES.TRUSTED_WITH_WARNINGS);
  assert.ok(riskSource.data_trust.reasons.includes('fallback_used'));
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

  const lowTrustRiskRows = [
    { id: 'risk-ok-a', tenant_id: 'tenant-b', likelihood: 4, impact: 5 },
    { id: 'risk-ok-b', tenant_id: 'tenant-b', likelihood: 2, impact: 5 },
    { id: 'risk-invalid-a', tenant_id: 'tenant-b', likelihood: null, impact: 5 },
    { id: 'risk-invalid-b', tenant_id: 'tenant-b', likelihood: 2, impact: null },
  ];
  const lowTrustRiskClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) return { rows: [{ exists: String(params[0] || '').includes('grc_quantitative_risk_assessments') }] };
    if (sql.includes('FROM grc_quantitative_risk_assessments x')) return { rows: lowTrustRiskRows.filter((row) => row.tenant_id === params[0]) };
    throw new Error(`unexpected low trust risk query: ${sql}`);
  } };
  const lowTrustRiskSource = await resolveFormulaSource({
    client: lowTrustRiskClient,
    tenantId: 'tenant-b',
    formulaCode: 'F5_5_INHERENT_RISK',
  });
  assert.strictEqual(lowTrustRiskSource.counts.received, 4);
  assert.strictEqual(lowTrustRiskSource.counts.usable, 2);
  assert.strictEqual(lowTrustRiskSource.data_trust.state, DATA_TRUST_STATES.LOW_CONFIDENCE);
  assert.ok(lowTrustRiskSource.data_trust.reasons.includes('high_exclusion_ratio'));
  assert.notStrictEqual(lowTrustRiskSource.data_trust.state, riskSource.data_trust.state, 'tenant-scoped datasets must produce independent trust states');

  const findingsClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['grc_readiness_findings', 'grc_readiness_snapshots'].includes(table) }] };
    }
    if (sql.includes('JOIN grc_readiness_snapshots s')) return { rows: [
      { id: 'finding-without-severity', tenant_id: 'tenant-a', status: 'not_applicable', period_start: '2026-01-01T00:00:00Z', period_end: '2026-02-01T00:00:00Z', generated_at: '2026-01-31T00:00:00Z', __event_time: '2026-02-01T00:00:00Z' },
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

  const emptySeverityClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['grc_readiness_findings', 'grc_readiness_snapshots'].includes(table) }] };
    }
    if (sql.includes('JOIN grc_readiness_snapshots s')) return { rows: [] };
    throw new Error(`unexpected empty severity query: ${sql}`);
  } };
  const emptySeveritySource = await resolveFormulaSource({
    client: emptySeverityClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_SEVERITY_INDEX',
    sourceCode: 'audit_findings_actions',
    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
  });
  assert.strictEqual(emptySeveritySource.status, 'empty_dataset');
  assert.strictEqual(emptySeveritySource.counts.received, 0);
  assert.strictEqual(emptySeveritySource.formula_input, null);

  const missingClient = { async query(sql) { if (sql.includes('to_regclass')) return { rows: [{ exists: false }] }; throw new Error('unexpected query'); } };
  const missingTables = await resolveFormulaSource({ client: missingClient, tenantId: 'tenant-a', formulaCode: 'F5_5_ASSET_CRITICALITY' });
  assert.strictEqual(missingTables.status, 'source_unavailable');
  assert.strictEqual(missingTables.data_trust.state, DATA_TRUST_STATES.UNTRUSTED);
  assert.ok(missingTables.data_trust.reasons.includes('source_unavailable'));
  assert.ok(missingTables.reason.includes('No existen tablas operacionales'));
  const nonCanonicalSourceClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['grc_readiness_findings', 'grc_readiness_snapshots', 'grc_incidents'].includes(table) }] };
    }
    assert.ok(!sql.includes('FROM grc_incidents'), 'non-canonical incident source must not displace Severity Index ownership');
    assert.ok(!sql.includes('s.source_as_of'), 'non-canonical override path must still use schema-compatible canonical query');
    if (sql.includes('JOIN grc_readiness_snapshots s')) return { rows: [
      { id: 'canonical-finding-high', tenant_id: 'tenant-a', severity: 'high', status: 'not_applicable', period_start: '2026-01-01T00:00:00Z', period_end: '2026-02-01T00:00:00Z', generated_at: '2026-01-31T00:00:00Z', __event_time: '2026-02-01T00:00:00Z' },
    ] };
    throw new Error(`unexpected non-canonical source query: ${sql}`);
  } };
  const severityOverrideSource = await resolveFormulaSource({
    client: nonCanonicalSourceClient,
    tenantId: 'tenant-a',
    formulaCode: 'F5_5_SEVERITY_INDEX',
    sourceCode: 'incident_operational_events',
    period: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
  });
  assert.strictEqual(severityOverrideSource.source_code, 'audit_findings_actions');
  assert.strictEqual(severityOverrideSource.requested_source_code, 'incident_operational_events');
  assert.strictEqual(severityOverrideSource.canonical_source_code, 'audit_findings_actions');
  assert.strictEqual(severityOverrideSource.source_override_ignored, true);
  assert.deepStrictEqual(severityOverrideSource.formula_input, { low: 0, medium: 0, high: 1, critical: 0 });
  assert.ok(severityOverrideSource.warnings.some((warning) => warning.includes('source_override_ignored_non_canonical')));
  assert.ok(severityOverrideSource.source_snapshot.source_override_ignored, 'source snapshot must expose ignored non-canonical override');

  const incompatibleClient = { async query(sql, params = []) {
    if (sql.includes('to_regclass')) {
      const table = String(params[0] || '').replace(/^public\./, '');
      return { rows: [{ exists: ['grc_readiness_findings', 'grc_readiness_snapshots'].includes(table) }] };
    }
    if (sql.includes('JOIN grc_readiness_snapshots s')) throw Object.assign(new Error('schema incompatible'), { code: '42703' });
    throw new Error(`unexpected incompatible query: ${sql}`);
  } };
  await assert.rejects(
    () => resolveFormulaSource({ client: incompatibleClient, tenantId: 'tenant-a', formulaCode: 'F5_5_SEVERITY_INDEX', sourceCode: 'audit_findings_actions' }),
    (error) => error?.code === 'SOURCE_SCHEMA_INCOMPATIBLE',
    'canonical source incompatible must remain visible and must not fallback'
  );
  process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_RESOLVER_TESTS_OK', formulas: FORMULAS.length, contracts: contracts.length, unresolved_internal: 0, fallback_assertions: 3, equivalence_assertions: 9, formula_execution_assertions: 8 }) + '\n');
}
main().catch((error) => { console.error(error); process.exit(1); });
