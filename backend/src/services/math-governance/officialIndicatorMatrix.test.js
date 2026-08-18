'use strict';

const assert = require('assert');
const { FORMULAS, executeFormula } = require('./formulaRegistry.service');
const { FORMULA_SOURCE_MAP, listSourceContracts } = require('./sourceContracts.service');
const {
  OFFICIAL_INDICATOR_MATRIX_VERSION,
  buildOfficialIndicatorMatrix,
  validateOfficialIndicatorMatrix,
} = require('./officialIndicatorMatrix.service');

const matrix = buildOfficialIndicatorMatrix();
const validation = validateOfficialIndicatorMatrix(matrix);

assert.equal(OFFICIAL_INDICATOR_MATRIX_VERSION, 'pui-08-official-indicator-matrix-v1');
assert.equal(matrix.length, FORMULAS.length);
assert.equal(FORMULAS.length, 53);
assert.deepEqual(validation.errors, []);
assert.equal(validation.ok, true);

const byFormula = new Map(matrix.map((row) => [row.formula_code, row]));
const contracts = new Map(listSourceContracts().map((contract) => [contract.source_code, contract]));

for (const formula of FORMULAS) {
  const row = byFormula.get(formula.formula_code);
  assert.ok(row, `${formula.formula_code} missing from matrix`);
  assert.equal(row.formula_version, formula.version);
  assert.equal(row.expected_unit, formula.units.output);
  assert.equal(row.canonical_source_code, FORMULA_SOURCE_MAP[formula.formula_code]);
  assert.ok(contracts.has(row.canonical_source_code), `${formula.formula_code} source contract missing`);
  assert.ok(row.source_contract_version >= 1, `${formula.formula_code} source contract version missing`);
  assert.equal(typeof row.source_contract_checksum, 'string');
  assert.equal(row.source_contract_checksum.length, 64);
  assert.ok(row.physical_sources.length > 0, `${formula.formula_code} physical source missing`);
  assert.ok(row.temporal_semantics.classification, `${formula.formula_code} temporal semantics missing`);
  assert.ok(row.status_semantics.mapping_version, `${formula.formula_code} status mapping missing`);
  assert.ok(row.eligibility_semantics.count_semantics.population_size, `${formula.formula_code} count semantics missing`);
  assert.equal(row.population_sufficiency.no_null_to_zero, true);
  assert.equal(row.empty_behavior.expected_output_value, null);
  assert.equal(row.empty_behavior.no_fake_zero, true);
  assert.equal(row.partial_behavior.silent_fallback_allowed, false);
  assert.equal(row.sufficient_behavior.deterministic_formula_output, true);
  assert.equal(row.tenant_b_behavior.cross_tenant_lineage_leak_allowed, false);
  assert.equal(row.snapshot_required, true);
  assert.equal(row.lineage_required, true);
  assert.ok(row.consumers.every((consumer) => consumer.parallel_truth_allowed === false), `${formula.formula_code} parallel consumer truth`);

  const normal = formula.tests.find((test) => test.name === 'normal');
  assert.ok(normal, `${formula.formula_code} missing normal test`);
  const first = executeFormula(formula.formula_code, normal.inputs);
  const second = executeFormula(formula.formula_code, normal.inputs);
  assert.deepEqual(first, second, `${formula.formula_code} sufficient fixture is not deterministic`);
}

const severity = byFormula.get('F5_5_SEVERITY_INDEX');
assert.equal(severity.canonical_source_code, 'audit_findings_actions');
assert.deepEqual(severity.physical_sources, ['grc_readiness_findings', 'grc_readiness_snapshots']);
assert.equal(severity.producer, 'readiness snapshot producer: grc_readiness_findings joined to grc_readiness_snapshots');
assert.ok(!severity.temporal_semantics.source_time_fields.includes('source_as_of'));
assert.ok(!severity.temporal_semantics.valid_from_fields.includes('source_as_of'));
assert.ok(!severity.physical_sources.includes('grc_incidents'));
assert.notEqual(severity.canonical_source_code, 'incident_operational_events');

const health = byFormula.get('F5_5_GRC_HEALTH');
assert.deepEqual(health.dependencies, [
  'F5_5_COMPLIANCE_WEIGHTED',
  'F5_5_WEIGHTED_PROGRESS',
  'F5_5_FRESHNESS_CONTINUOUS',
  'F5_C3_DATA_TRUST',
  'F5_5_RESIDUAL_RISK',
]);

const dependencyCodes = new Set(FORMULAS.map((formula) => formula.formula_code));
for (const row of matrix) {
  for (const dependency of row.dependencies) assert.ok(dependencyCodes.has(dependency), `${row.formula_code} unknown dependency ${dependency}`);
}

const tenantScopedRows = matrix.filter((row) => row.canonical_source_code !== 'external_fx_rates');
assert.ok(tenantScopedRows.every((row) => contracts.get(row.canonical_source_code).tenant_filter.required === true));

process.stdout.write(JSON.stringify({
  status: 'PUI_08_OFFICIAL_INDICATOR_MATRIX_OK',
  matrix_version: OFFICIAL_INDICATOR_MATRIX_VERSION,
  formulas: matrix.length,
  source_contracts: validation.source_contract_count,
  consumers: validation.consumer_count,
  severity_source: severity.canonical_source_code,
}) + '\n');
