 'use strict';
const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { FORMULA_MAP } = require('./formulaRegistry.service');
const { validateDataset } = require('./datasetValidation.service');
const { getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings } = require('./sourceContracts.service');

const SOURCE_STATES = new Set(['ready', 'source_unavailable', 'empty_dataset', 'partially_available', 'legacy_adapter_required', 'validated_with_warnings']);
const FIXED_QUERY_BY_SOURCE = Object.freeze({
  loss_events_operational: `
    SELECT le.id, le.tenant_id, le.event_date, le.gross_loss_amount, le.net_loss_amount, le.currency, le.status,
           COALESCE(SUM(lr.recovery_amount), 0) AS recovery_amount
    FROM loss_events le
    LEFT JOIN loss_recoveries lr ON lr.tenant_id = le.tenant_id AND lr.loss_event_id = le.id
    WHERE le.tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR le.event_date >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR le.event_date <= $3::timestamptz)
    GROUP BY le.id`,
  continuity_resilience_tests: `
    SELECT id, tenant_id, tested_at, rto_hours, rpo_hours, actual_recovery_hours, actual_data_loss_hours, result, status
    FROM grc_continuity_tests
    WHERE tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR tested_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR tested_at <= $3::timestamptz)`,
  supplier_tprm_assessments: `
    SELECT s.id, s.tenant_id, s.status, s.criticality, a.security_score, a.dependency_score, a.resilience_score, a.privacy_score, a.assessed_at
    FROM grc_suppliers s
    LEFT JOIN grc_supplier_assessments a ON a.tenant_id = s.tenant_id AND a.supplier_id = s.id
    WHERE s.tenant_id = $1::uuid`,
  survey_response_scoring: `
    SELECT ri.id, r.tenant_id, r.status, r.submitted_at, ri.question_id, ri.score, ri.max_score, ri.weight
    FROM survey_responses r
    JOIN survey_response_items ri ON ri.response_id = r.id
    WHERE r.tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR r.submitted_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR r.submitted_at <= $3::timestamptz)`,
  assurance_test_results: `
    SELECT r.id, e.tenant_id, e.status, e.executed_at, r.result, r.weight, r.sample_id
    FROM assurance_test_results r
    JOIN assurance_test_executions e ON e.id = r.execution_id
    WHERE e.tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR e.executed_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR e.executed_at <= $3::timestamptz)`,
  data_quality_observations: `
    SELECT id, tenant_id, assessed_at, rule_type, expected_count, valid_count, invalid_count, coverage, status
    FROM data_quality_assessments
    WHERE tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR assessed_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR assessed_at <= $3::timestamptz)`,
  data_lineage_observations: `
    SELECT id, tenant_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type, created_at
    FROM data_lineage_edges
    WHERE tenant_id = $1::uuid`,
  statistical_metric_measurements: `
    SELECT id, tenant_id, metric_id, numeric_value, measured_at, unit, dimension_values, status
    FROM metric_measurements
    WHERE tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR measured_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR measured_at <= $3::timestamptz)`,
  asset_inventory_security: `
    SELECT id, tenant_id, name, classification, owner_user_id, metadata, status, created_at
    FROM data_elements
    WHERE tenant_id = $1::uuid
      AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)`,
});

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
}
function buildSourceContract({ sourceKey, entityType, requiredFields = [], tenantScoped = true, status = 'source_unavailable', unit = null } = {}) {
  if (!sourceKey || !entityType) throw new MathGovernanceError('SOURCE_CONTRACT_INVALID', 'sourceKey y entityType son obligatorios.');
  if (!SOURCE_STATES.has(status) && status !== 'available') throw new MathGovernanceError('SOURCE_STATUS_INVALID', 'Estado de fuente invalido.');
  return Object.freeze({ sourceKey, entityType, requiredFields, tenantScoped, status, unit, lineageRequired: true });
}
function sourceUnavailable(sourceKey, reason = 'Operational source is not available for this formula.') {
  return Object.freeze({ sourceKey, source_code: sourceKey, status: 'source_unavailable', rows: [], reason, warnings: [reason], inputHash: null, source_snapshot: null, lineage: [] });
}
async function tableExists(client, tableName) {
  if (!client || typeof client.query !== 'function') return false;
  const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]);
  return result.rows[0]?.exists === true;
}
async function allTablesExist(client, tables) {
  for (const table of tables) {
    if (!(await tableExists(client, table))) return false;
  }
  return true;
}
function assertTenant(tenantId) {
  if (!tenantId) throw new MathGovernanceError('SOURCE_TENANT_REQUIRED', 'Resolver de fuentes requiere tenant efectivo.');
}
function assertPermission(permission) {
  if (permission && permission.allowed === false) throw new MathGovernanceError('SOURCE_PERMISSION_DENIED', 'Permiso insuficiente para resolver dataset matematico.', { required: permission.required });
}
function normalizeRows(rows, contract) {
  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) normalized[key] = typeof value === 'string' ? value.trim() : value;
    normalized.__source_code = contract.source_code;
    return normalized;
  });
}
function buildLineage({ rows, contract, formula, runId = null, snapshotHash = null }) {
  return rows.slice(0, 1000).map((row) => ({
    source_record: row.id || row.source_entity_id || null,
    source_contract: contract.source_code,
    dataset_snapshot: snapshotHash,
    formula_version: `${formula.formula_code}@${formula.version}`,
    calculation_run: runId,
  }));
}
async function queryOperationalRows({ client, contract, tenantId, period = {} }) {
  const fixedQuery = FIXED_QUERY_BY_SOURCE[contract.source_code];
  if (!fixedQuery) return { rows: [], unavailable: true, reason: `No fixed adapter query registered for ${contract.source_code}.` };
  const ready = await allTablesExist(client, contract.tables);
  if (!ready) return { rows: [], unavailable: true, reason: `One or more source tables are not present for ${contract.source_code}.` };
  const result = await client.query(fixedQuery, [tenantId, period.start || null, period.end || null]);
  return { rows: result.rows || [], unavailable: false, reason: null };
}
async function resolveFormulaSource({ client, tenantId, formulaCode, sourceCode = null, period = {}, timezone = 'UTC', permission = null, runId = null } = {}) {
  assertTenant(tenantId);
  assertPermission(permission);
  const formula = FORMULA_MAP.get(formulaCode);
  if (!formula) throw new MathGovernanceError('SOURCE_FORMULA_NOT_FOUND', 'Formula no registrada para resolver fuente.', { formulaCode });
  const resolvedSourceCode = sourceCode || getSourceCodeForFormula(formulaCode);
  const contract = getSourceContract(resolvedSourceCode);
  if (!contract) return sourceUnavailable(resolvedSourceCode, 'No existe contrato de fuente para la formula.');
  if (contract.availability === 'source_unavailable' || contract.availability === 'legacy_adapter_required') {
    return sourceUnavailable(contract.source_code, contract.limitations || `Fuente ${contract.availability}.`);
  }
  const queried = await queryOperationalRows({ client, contract, tenantId, period });
  if (queried.unavailable) return sourceUnavailable(contract.source_code, queried.reason);
  const rows = normalizeRows(queried.rows, contract);
  const validation = validateDataset({
    rows,
    tenantId,
    period,
    timezone,
    unit: contract.unit,
    requiredFields: contract.required_fields,
    minimumSampleSize: formula.minimum_sample_size || 1,
    sourceKey: contract.source_code,
    allowedStates: contract.status_filter?.allowed || null,
  });
  const sourceSnapshot = {
    source_code: contract.source_code,
    formula_code: formula.formula_code,
    contract_checksum: contract.checksum,
    row_count: rows.length,
    usable_rows: validation.usable_rows.length,
    exclusions: validation.exclusions.length,
    period,
    timezone,
  };
  const snapshotHash = hash(sourceSnapshot);
  return {
    source_code: contract.source_code,
    status: validation.status,
    rows: validation.usable_rows,
    warnings: validation.warnings,
    exclusions: validation.exclusions,
    invalid_rows: validation.invalid_rows,
    counts: { received: rows.length, usable: validation.usable_rows.length, excluded: validation.exclusions.length },
    inputHash: validation.hash,
    input_hash: validation.hash,
    source_snapshot: sourceSnapshot,
    source_snapshot_hash: snapshotHash,
    lineage: buildLineage({ rows: validation.usable_rows, contract, formula, runId, snapshotHash }),
    contract,
  };
}
async function resolveFormulaSources(args) {
  return resolveFormulaSource(args);
}
module.exports = { SOURCE_STATES, buildSourceContract, sourceUnavailable, listSourceContracts, listFormulaSourceBindings, resolveFormulaSource, resolveFormulaSources, getSourceContract, tableExists };
