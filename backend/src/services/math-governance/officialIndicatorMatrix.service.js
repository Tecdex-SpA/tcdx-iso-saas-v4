'use strict';

const { FORMULAS } = require('./formulaRegistry.service');
const {
  FORMULA_SOURCE_MAP,
  getSourceContract,
  listSourceContracts,
  listFormulaSourceBindings,
} = require('./sourceContracts.service');
const { LEGACY_FALLBACK_POLICY_BY_SOURCE } = require('./sourceResolver.service');
const { listAnalyticalResults } = require('./analyticsCatalog.service');
const { FUNCTIONAL_INDICATORS } = require('../indicators/functionalIndicatorCatalog');

const OFFICIAL_INDICATOR_MATRIX_VERSION = 'pui-08-official-indicator-matrix-v1';

const FORMULA_DEPENDENCIES = Object.freeze({
  F5_5_READINESS: Object.freeze(['F5_5_COVERAGE', 'F5_5_COMPLIANCE_WEIGHTED']),
  F5_5_RESIDUAL_RISK: Object.freeze(['F5_5_INHERENT_RISK']),
  F5_5_GRC_HEALTH: Object.freeze([
    'F5_5_COMPLIANCE_WEIGHTED',
    'F5_5_WEIGHTED_PROGRESS',
    'F5_5_FRESHNESS_CONTINUOUS',
    'F5_C3_DATA_TRUST',
    'F5_5_RESIDUAL_RISK',
  ]),
});

const CONSUMER_REGISTRY = Object.freeze([
  Object.freeze({
    consumer: 'officialCalculationOrchestrator',
    path: 'backend/src/services/math-governance/officialCalculationOrchestrator.service.js',
    mode: 'canonical_pipeline',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'sourceResolver',
    path: 'backend/src/services/math-governance/sourceResolver.service.js',
    mode: 'canonical_source_resolution',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'analyticsCatalog',
    path: 'backend/src/services/math-governance/analyticsCatalog.service.js',
    mode: 'official_result_projection',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'functionalIndicatorCatalog',
    path: 'backend/src/services/indicators/functionalIndicatorCatalog.js',
    mode: 'official_indicator_projection',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'phase5Package3',
    path: 'backend/src/services/math-governance/phase5Package3.service.js',
    mode: 'compatibility_projection_requires_orchestrator',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'official calculation persistence',
    path: 'calculation_runs/calculation_outputs/calculation_snapshots/calculation_explanations',
    mode: 'persisted_official_truth',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'metrics official dashboard API',
    path: 'frontend/src/app/dashboard/page.tsx -> /api/metrics/official/dashboard',
    mode: 'dashboard_projection_from_official_results',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'math governance formula catalog',
    path: 'frontend/src/components/math-governance/FormulaCatalog.tsx -> /api/grc/official/recalculate',
    mode: 'orchestrator_recalculation_and_evidence_projection',
    parallel_truth_allowed: false,
  }),
  Object.freeze({
    consumer: 'reports and exports',
    path: 'backend/frontend report-export consumers via persisted official calculations',
    mode: 'report_projection_from_calculation_runs_outputs_snapshots',
    parallel_truth_allowed: false,
  }),
]);

const EMPTY_BEHAVIOR = Object.freeze({
  scenario: 'empty',
  expected_run_status: 'not_calculable',
  expected_output_value: null,
  no_fake_zero: true,
  snapshot_required: true,
  data_trust_required: true,
  machine_reason_required: true,
});

const PARTIAL_BEHAVIOR = Object.freeze({
  scenario: 'partial',
  exclusions_visible: true,
  count_reconciliation_required: true,
  data_trust_required: true,
  silent_fallback_allowed: false,
});

const SUFFICIENT_BEHAVIOR = Object.freeze({
  scenario: 'sufficient',
  expected_run_status: 'calculated',
  deterministic_formula_output: true,
  snapshot_required: true,
  lineage_required: true,
  data_trust_required: true,
});

const TENANT_B_BEHAVIOR = Object.freeze({
  scenario: 'tenant_b',
  tenant_isolation_required: true,
  cross_tenant_lineage_leak_allowed: false,
});

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sourceContract(sourceCode) {
  const contract = getSourceContract(sourceCode);
  if (!contract) {
    const error = new Error(`Source contract not found for ${sourceCode}`);
    error.code = 'SOURCE_CONTRACT_NOT_FOUND';
    throw error;
  }
  return contract;
}

function directionForFormula(formula) {
  const code = formula.formula_code;
  if (/(RISK|LOSS|SEVERITY|OVERDUE|FAILURE|DROPOUT|RTO|RPO|AGE|MTTC|MTTR|MTBF|VAR)/.test(code)) return 'lower_is_better';
  if (/(Z_SCORE|ROBUST_Z_SCORE|LINEAR_TREND|PERCENT_VARIATION|CONFIDENCE_INTERVAL|MONTE_CARLO|PARAMETRIC_VAR|SAMPLE_SIZE)/.test(code)) return 'statistical';
  return 'higher_is_better';
}

function formulaConsumerIndex() {
  const analytics = new Map();
  for (const definition of listAnalyticalResults()) {
    const list = analytics.get(definition.formula_code) || [];
    list.push(definition.analytical_result_code);
    analytics.set(definition.formula_code, list);
  }
  const functional = new Map();
  for (const definition of FUNCTIONAL_INDICATORS) {
    const list = functional.get(definition.formula_code) || [];
    list.push(definition.functional_code);
    functional.set(definition.formula_code, list);
  }
  return { analytics, functional };
}

function physicalSourcesFor(formulaCode, contract) {
  if (formulaCode === 'F5_5_SEVERITY_INDEX') return Object.freeze(['grc_readiness_findings', 'grc_readiness_snapshots']);
  return Object.freeze([...(contract.tables || [])]);
}

function producerFor(formulaCode, contract) {
  if (formulaCode === 'F5_5_SEVERITY_INDEX') return 'readiness snapshot producer: grc_readiness_findings joined to grc_readiness_snapshots';
  return `${contract.entity}:${(contract.tables || []).join(',')}`;
}

function consumersFor(formulaCode, indexes) {
  const formulaConsumers = CONSUMER_REGISTRY.map((entry) => ({ ...entry }));
  const analytics = indexes.analytics.get(formulaCode) || [];
  const functional = indexes.functional.get(formulaCode) || [];
  if (analytics.length) {
    formulaConsumers.push({
      consumer: 'analyticsCatalog bindings',
      path: 'backend/src/services/math-governance/analyticsCatalog.service.js',
      mode: 'formula_bound_projection',
      result_codes: analytics,
      parallel_truth_allowed: false,
    });
  }
  if (functional.length) {
    formulaConsumers.push({
      consumer: 'functionalIndicatorCatalog bindings',
      path: 'backend/src/services/indicators/functionalIndicatorCatalog.js',
      mode: 'formula_bound_projection',
      functional_codes: functional,
      parallel_truth_allowed: false,
    });
  }
  return Object.freeze(formulaConsumers);
}

function buildMatrixRow(formula, indexes) {
  const sourceCode = FORMULA_SOURCE_MAP[formula.formula_code];
  const contract = sourceContract(sourceCode);
  const physicalSources = physicalSourcesFor(formula.formula_code, contract);
  return Object.freeze({
    matrix_version: OFFICIAL_INDICATOR_MATRIX_VERSION,
    formula_code: formula.formula_code,
    business_concept: formula.display_name,
    formula_version: formula.version,
    expected_unit: formula.units?.output || null,
    direction: directionForFormula(formula),
    canonical_source_code: sourceCode,
    source_contract_version: contract.version,
    source_contract_checksum: contract.checksum,
    physical_sources: physicalSources,
    producer: producerFor(formula.formula_code, contract),
    required_fields: Object.freeze([...(contract.required_fields || [])]),
    optional_fields: Object.freeze((contract.columns || []).filter((field) => !(contract.required_fields || []).includes(field))),
    status_semantics: clone(contract.status_semantics || {}),
    temporal_semantics: clone(contract.temporal_semantics || {}),
    eligibility_semantics: Object.freeze({
      source_availability: contract.availability,
      null_policy: contract.null_policy,
      count_semantics: clone(contract.count_semantics || {}),
      status_policy: contract.status_semantics?.unknown_policy || null,
      temporal_policy: contract.temporal_semantics?.validity_policy || null,
      required_input_policy: 'formula_input_must_be_present_or_not_calculable',
    }),
    population_sufficiency: Object.freeze({
      minimum_sample_size: formula.minimum_sample_size ?? 1,
      insufficient_data_status: 'not_calculable',
      no_null_to_zero: true,
    }),
    scale_semantics: clone(contract.scale_metadata || {}),
    dependencies: Object.freeze([...(FORMULA_DEPENDENCIES[formula.formula_code] || [])]),
    fallback_policy: Object.freeze(LEGACY_FALLBACK_POLICY_BY_SOURCE[sourceCode] || { allowed: false, triggers: Object.freeze([]) }),
    empty_behavior: EMPTY_BEHAVIOR,
    partial_behavior: PARTIAL_BEHAVIOR,
    sufficient_behavior: SUFFICIENT_BEHAVIOR,
    tenant_b_behavior: TENANT_B_BEHAVIOR,
    snapshot_required: true,
    lineage_required: true,
    consumers: consumersFor(formula.formula_code, indexes),
  });
}

function buildOfficialIndicatorMatrix() {
  const indexes = formulaConsumerIndex();
  return Object.freeze(FORMULAS.map((formula) => buildMatrixRow(formula, indexes)));
}

function validateDependencyGraph(matrix) {
  const codes = new Set(matrix.map((row) => row.formula_code));
  const visiting = new Set();
  const visited = new Set();
  const errors = [];
  for (const row of matrix) {
    for (const dependency of row.dependencies) {
      if (!codes.has(dependency)) errors.push(`${row.formula_code} references unknown dependency ${dependency}`);
    }
  }
  function visit(code, path = []) {
    if (visiting.has(code)) {
      errors.push(`circular dependency: ${[...path, code].join(' -> ')}`);
      return;
    }
    if (visited.has(code)) return;
    visiting.add(code);
    const row = matrix.find((item) => item.formula_code === code);
    for (const dependency of row?.dependencies || []) visit(dependency, [...path, code]);
    visiting.delete(code);
    visited.add(code);
  }
  for (const row of matrix) visit(row.formula_code);
  return errors;
}

function validateOfficialIndicatorMatrix(matrix = buildOfficialIndicatorMatrix()) {
  const errors = [];
  const formulaCodes = new Set(FORMULAS.map((formula) => formula.formula_code));
  const matrixCodes = new Set(matrix.map((row) => row.formula_code));
  const sourceCodes = new Set(listSourceContracts().map((contract) => contract.source_code));
  const bindings = new Map(listFormulaSourceBindings().map((binding) => [binding.formula_code, binding.source_code]));

  if (matrix.length !== FORMULAS.length) errors.push(`matrix row count ${matrix.length} does not match official formula count ${FORMULAS.length}`);
  for (const code of formulaCodes) {
    if (!matrixCodes.has(code)) errors.push(`missing matrix row for ${code}`);
  }
  for (const row of matrix) {
    const formula = FORMULAS.find((item) => item.formula_code === row.formula_code);
    if (!formula) errors.push(`matrix contains unknown formula ${row.formula_code}`);
    if (row.canonical_source_code !== bindings.get(row.formula_code)) errors.push(`${row.formula_code} source drift`);
    if (!sourceCodes.has(row.canonical_source_code)) errors.push(`${row.formula_code} has unknown source contract ${row.canonical_source_code}`);
    if (!row.source_contract_version || !row.source_contract_checksum) errors.push(`${row.formula_code} missing source version/checksum`);
    if (!row.physical_sources?.length) errors.push(`${row.formula_code} missing physical sources`);
    if (!row.temporal_semantics?.classification || !row.temporal_semantics?.source_time_fields?.length) errors.push(`${row.formula_code} missing temporal semantics`);
    if (!row.status_semantics?.domain || !row.status_semantics?.mapping_version) errors.push(`${row.formula_code} missing status semantics`);
    if (!row.eligibility_semantics?.count_semantics?.population_size) errors.push(`${row.formula_code} missing count semantics`);
    if (row.empty_behavior.expected_output_value !== null || row.empty_behavior.no_fake_zero !== true) errors.push(`${row.formula_code} empty behavior can fake zero`);
    if (!row.snapshot_required || !row.lineage_required) errors.push(`${row.formula_code} missing snapshot/lineage requirement`);
    if (row.consumers.some((consumer) => consumer.parallel_truth_allowed)) errors.push(`${row.formula_code} allows parallel consumer truth`);
    const contract = sourceContract(row.canonical_source_code);
    const missingFields = (contract.required_fields || []).filter((field) => !['id', 'tenant_id'].includes(field) && !(contract.columns || []).includes(field));
    if (missingFields.length) errors.push(`${row.formula_code} references non-contract required fields ${missingFields.join(',')}`);
    if (contract.tenant_filter?.required !== true && contract.source_code !== 'external_fx_rates') errors.push(`${row.formula_code} source is not tenant scoped`);
  }

  const severity = matrix.find((row) => row.formula_code === 'F5_5_SEVERITY_INDEX');
  if (!severity) errors.push('missing F5_5_SEVERITY_INDEX');
  else {
    if (severity.canonical_source_code !== 'audit_findings_actions') errors.push('Severity Index canonical source changed');
    const severitySources = severity.physical_sources.join('+');
    if (severitySources !== 'grc_readiness_findings+grc_readiness_snapshots') errors.push(`Severity Index physical source drift: ${severitySources}`);
    const temporalFields = [
      ...(severity.temporal_semantics.source_time_fields || []),
      ...(severity.temporal_semantics.valid_from_fields || []),
      ...(severity.temporal_semantics.valid_to_fields || []),
    ];
    if (temporalFields.includes('source_as_of')) errors.push('Severity Index reintroduced source_as_of');
    if (severity.physical_sources.includes('grc_incidents') || severity.canonical_source_code === 'incident_operational_events') errors.push('Severity Index reintroduced incident source truth');
  }

  errors.push(...validateDependencyGraph(matrix));

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    formula_count: FORMULAS.length,
    matrix_count: matrix.length,
    source_contract_count: sourceCodes.size,
    consumer_count: CONSUMER_REGISTRY.length,
  });
}

module.exports = {
  OFFICIAL_INDICATOR_MATRIX_VERSION,
  FORMULA_DEPENDENCIES,
  CONSUMER_REGISTRY,
  buildOfficialIndicatorMatrix,
  validateOfficialIndicatorMatrix,
};
