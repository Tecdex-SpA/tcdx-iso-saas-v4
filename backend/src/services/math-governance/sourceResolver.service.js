'use strict';

const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { FORMULA_MAP } = require('./formulaRegistry.service');
const { validateDataset } = require('./datasetValidation.service');
const { getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings } = require('./sourceContracts.service');

const SOURCE_STATES = new Set(['ready', 'source_unavailable', 'empty_dataset', 'partially_available', 'legacy_adapter_required', 'validated_with_warnings']);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex'); }
function number(value, fallback = null) { if (value === '' || value === null || value === undefined) return fallback; const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function ratio(value) { const n = number(value); return n === null ? null : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); }
function average(values) { const usable = values.map((value) => number(value)).filter((value) => value !== null); return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null; }
function sum(values) { const usable = values.map((value) => number(value)).filter((value) => value !== null); return usable.length ? usable.reduce((total, value) => total + value, 0) : null; }
function buildSourceContract({ sourceKey, entityType, requiredFields = [], tenantScoped = true, status = 'source_unavailable', unit = null } = {}) { if (!sourceKey || !entityType) throw new MathGovernanceError('SOURCE_CONTRACT_INVALID', 'sourceKey y entityType son obligatorios.'); if (!SOURCE_STATES.has(status) && status !== 'available') throw new MathGovernanceError('SOURCE_STATUS_INVALID', 'Estado de fuente inválido.'); return Object.freeze({ sourceKey, entityType, requiredFields, tenantScoped, status, unit, lineageRequired: true }); }
function sourceUnavailable(sourceKey, reason = 'La fuente operacional no está disponible para esta fórmula.') { return Object.freeze({ sourceKey, source_code: sourceKey, status: 'source_unavailable', rows: [], reason, warnings: [reason], inputHash: null, source_snapshot: null, lineage: [], formula_input: null, counts: { received: 0, usable: 0, excluded: 0 } }); }
async function tableExists(client, tableName) { if (!client || typeof client.query !== 'function') return false; const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]); return result.rows[0]?.exists === true; }
async function allTablesExist(client, tables) { for (const table of tables || []) if (!(await tableExists(client, table))) return false; return true; }
function assertTenant(tenantId) { if (!tenantId) throw new MathGovernanceError('SOURCE_TENANT_REQUIRED', 'Resolver de fuentes requiere tenant efectivo.'); }
function assertPermission(permission) { if (permission && permission.allowed === false) throw new MathGovernanceError('SOURCE_PERMISSION_DENIED', 'Permiso insuficiente para resolver dataset matemático.', { required: permission.required }); }
function periodArgs(tenantId, period = {}) { return [tenantId, period.start || null, period.end || null]; }
function tagRows(rows, physicalSource) { return (rows || []).map((row) => ({ ...row, __physical_source: physicalSource })); }
function normalizeRows(rows, contract) { return rows.map((row) => { const normalized = {}; for (const [key, value] of Object.entries(row)) normalized[key] = typeof value === 'string' ? value.trim() : value; normalized.__source_code = contract.source_code; return normalized; }); }
function buildLineage({ rows, contract, formula, runId = null, snapshotHash = null }) { return rows.slice(0, 1000).map((row) => ({ source_record: row.id || row.source_entity_id || null, physical_source: row.__physical_source || null, source_contract: contract.source_code, dataset_snapshot: snapshotHash, formula_version: `${formula.formula_code}@${formula.version}`, calculation_run: runId })); }

function jsonValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizePayload(payload, table) {
  const occurredAt = jsonValue(payload, ['event_date', 'occurred_at', 'detected_at', 'reported_at', 'assessed_at', 'measured_at', 'tested_at', 'executed_at', 'submitted_at', 'updated_at', 'created_at']);
  const status = String(jsonValue(payload, ['status', 'assessment_status', 'compliance_status', 'result']) || 'pending').toLowerCase();
  return {
    ...payload,
    id: jsonValue(payload, ['id', 'risk_id', 'control_id', 'metric_id']),
    tenant_id: jsonValue(payload, ['tenant_id', 'tenantId']),
    status,
    event_date: occurredAt,
    assessed_at: occurredAt,
    measured_at: occurredAt,
    probability: number(jsonValue(payload, ['probability', 'likelihood', 'probability_score', 'frequency'])),
    impact: number(jsonValue(payload, ['impact', 'severity_score', 'impact_score', 'severity'])),
    exposure: number(jsonValue(payload, ['exposure', 'inherent_score', 'risk_score'])),
    control_effectiveness: number(jsonValue(payload, ['control_effectiveness', 'control_score', 'effectiveness_score'])),
    score: number(jsonValue(payload, ['score', 'numeric_value', 'value', 'health_score', 'overall_score', 'compliance_score'])),
    weight: number(jsonValue(payload, ['weight']), 1),
    progress: number(jsonValue(payload, ['progress', 'progress_ratio', 'completion_percentage'])),
    opened_at: jsonValue(payload, ['opened_at', 'created_at']),
    closed_at: jsonValue(payload, ['closed_at', 'completed_at']),
    due_at: jsonValue(payload, ['due_at', 'due_date', 'target_date']),
    gross_loss_amount: number(jsonValue(payload, ['gross_loss_amount', 'gross_amount', 'loss_amount', 'amount'])),
    net_loss_amount: number(jsonValue(payload, ['net_loss_amount', 'net_amount'])),
    recovery_amount: number(jsonValue(payload, ['recovery_amount', 'recovered_amount']), 0),
    expected_count: number(jsonValue(payload, ['expected_count', 'expected', 'total_count'])),
    valid_count: number(jsonValue(payload, ['valid_count', 'valid', 'correct_count'])),
    invalid_count: number(jsonValue(payload, ['invalid_count', 'invalid', 'contradictory_count'])),
    max_score: number(jsonValue(payload, ['max_score', 'maximum_score'])),
    dimension: jsonValue(payload, ['dimension', 'category', 'domain']),
    owner_user_id: jsonValue(payload, ['owner_user_id', 'owner_id', 'responsible_user_id']),
    __physical_source: table,
  };
}

async function rawRows(client, table, tenantId, period = {}) {
  if (!SAFE_IDENTIFIER.test(table)) throw new MathGovernanceError('SOURCE_SCHEMA_INCOMPATIBLE', 'Nombre de tabla operacional inválido.');
  if (!(await tableExists(client, table))) return null;
  const result = await client.query(`SELECT to_jsonb(x) AS payload FROM ${table} x WHERE (to_jsonb(x)->>'tenant_id')=$1`, [String(tenantId)]);
  return (result.rows || []).map((row) => normalizePayload(row.payload || {}, table)).filter((row) => {
    if (!period.start && !period.end) return true;
    if (!row.event_date) return true;
    const date = new Date(row.event_date).getTime();
    if (!Number.isFinite(date)) return true;
    if (period.start && date < new Date(period.start).getTime()) return false;
    if (period.end && date > new Date(period.end).getTime()) return false;
    return true;
  });
}

async function firstPopulatedTables(client, tables, tenantId, period = {}) {
  let available = false;
  for (const table of tables || []) {
    const rows = await rawRows(client, table, tenantId, period);
    if (rows === null) continue;
    available = true;
    if (rows.length) return rows;
  }
  return available ? [] : null;
}

async function queryCompliance(client, tenantId, period) { return firstPopulatedTables(client, ['grc_requirement_control_mappings', 'control_soa_assessments', 'tenant_controls'], tenantId, period); }
async function queryReadiness(client, tenantId, period) { return firstPopulatedTables(client, ['grc_readiness_results'], tenantId, period); }
async function queryRisk(client, tenantId, period) { return firstPopulatedTables(client, ['grc_quantitative_risk_assessments', 'iso_risk_matrix_items', 'asset_risks', 'privacy_dpia_risks'], tenantId, period); }
async function queryControls(client, tenantId, period) { return firstPopulatedTables(client, ['grc_control_assurance', 'control_soa_assessments', 'control_health_scores', 'tenant_controls'], tenantId, period); }
async function queryAuditActions(client, tenantId, period) { return firstPopulatedTables(client, ['grc_readiness_findings', 'findings', 'action_plans'], tenantId, period); }
async function queryMaturity(client, tenantId, period) { return firstPopulatedTables(client, ['survey_evaluations', 'metric_measurements', 'grc_metric_measurements'], tenantId, period); }

async function queryHealth(client, tenantId, period) {
  if (!(await allTablesExist(client, ['calculation_runs', 'calculation_outputs']))) return null;
  const rows = (await client.query(`SELECT DISTINCT ON (cr.formula_code) cr.id,cr.tenant_id,cr.formula_code,cr.run_status AS status,cr.period_start,cr.period_end,co.output_value,co.unit FROM calculation_runs cr JOIN calculation_outputs co ON co.run_id=cr.id AND co.tenant_id=cr.tenant_id WHERE cr.tenant_id=$1::uuid AND cr.run_status='calculated' AND cr.formula_code IN ('F5_5_RESIDUAL_RISK','F5_5_COMPLIANCE_WEIGHTED','F5_5_WEIGHTED_PROGRESS','F5_5_EVIDENCE_QUALITY','F5_5_COMPLETENESS') AND ($2::timestamptz IS NULL OR cr.period_end IS NULL OR cr.period_end >= $2) AND ($3::timestamptz IS NULL OR cr.period_start IS NULL OR cr.period_start <= $3) ORDER BY cr.formula_code,cr.completed_at DESC NULLS LAST,cr.started_at DESC`, periodArgs(tenantId, period))).rows;
  return tagRows(rows, 'calculation_runs');
}

const ADAPTER_BY_SOURCE = Object.freeze({
  compliance_requirements_assessments: queryCompliance,
  grc_readiness_operational_snapshot: queryReadiness,
  risk_register_controls: queryRisk,
  control_assurance_evidence: queryControls,
  audit_findings_actions: queryAuditActions,
  grc_health_components: queryHealth,
  maturity_assessments: queryMaturity,
});

async function queryOperationalRows({ client, contract, tenantId, period = {} }) {
  const adapter = ADAPTER_BY_SOURCE[contract.source_code];
  if (adapter) {
    const rows = await adapter(client, tenantId, period);
    return rows === null ? { rows: [], unavailable: true, reason: `No existen tablas operacionales para ${contract.source_code}.` } : { rows, unavailable: false, reason: null };
  }
  const rows = await firstPopulatedTables(client, contract.tables || [], tenantId, period);
  return rows === null ? { rows: [], unavailable: true, reason: `No existen tablas operacionales para ${contract.source_code}.` } : { rows, unavailable: false, reason: null };
}

function mapFormulaInput(formulaCode, rows) {
  const first = rows[0] || {};
  const statuses = rows.map((row) => String(row.status || '').toLowerCase());
  const usableScores = rows.map((row) => number(row.score)).filter((value) => value !== null);
  const dates = rows.map((row) => row.event_date || row.measured_at || row.assessed_at).filter(Boolean);

  if (formulaCode === 'F5_5_COMPLIANCE_WEIGHTED') return { assessments: rows.map((row) => ({ status: row.status, weight: number(row.weight, 1), notApplicable: ['not_applicable', 'na'].includes(String(row.status)) })) };
  if (formulaCode === 'F5_5_COVERAGE') return { evaluated: statuses.filter((status) => !['pending', 'not_evaluated', 'draft', ''].includes(status)).length, applicable: statuses.filter((status) => !['not_applicable', 'na'].includes(status)).length };
  if (formulaCode === 'F5_5_READINESS') { const by = Object.fromEntries(rows.map((row) => [String(row.dimension || '').toLowerCase(), ratio(row.score)])); return { compliance: by.compliance, evidence: by.evidence, health: by.health, actions: by.actions }; }
  if (formulaCode === 'F5_5_INHERENT_RISK') return { probability: number(first.probability), impact: number(first.impact) };
  if (formulaCode === 'F5_5_RESIDUAL_RISK') { const inherent = number(first.exposure); const probability = number(first.probability); const impact = number(first.impact); return { inherentRisk: inherent ?? (probability !== null && impact !== null ? probability * impact : null), controlEffectiveness: ratio(first.control_effectiveness) }; }
  if (formulaCode === 'F5_5_FMEA_RPN') return { severity: number(first.impact), occurrence: number(first.occurrence ?? first.probability), detection: number(first.detection) };
  if (formulaCode === 'F5_5_COMBINED_EFFECTIVENESS') return { effectivenesses: usableScores.map(ratio).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_CONTROL_EFFECTIVENESS') return { design: ratio(first.design_score ?? first.score), implementation: ratio(first.implementation_score ?? first.score), operation: ratio(first.operation_score ?? first.score), evidence: ratio(first.evidence_score ?? first.score) };
  if (formulaCode === 'F5_5_CONTROL_COVERAGE') return { risksWithControl: rows.filter((row) => number(row.score) !== null || number(row.control_effectiveness) !== null).length, relevantRisks: rows.length };
  if (formulaCode === 'F5_5_FREQUENCY_COMPLIANCE') return { onTimeExecutions: statuses.filter((status) => ['effective', 'completed', 'on_time', 'compliant'].includes(status)).length, scheduledExecutions: rows.length };
  if (formulaCode === 'F5_5_FAILURE_RATE') return { failedTests: statuses.filter((status) => ['fail', 'failed', 'non_compliant'].includes(status)).length, executedTests: rows.length };
  if (formulaCode === 'F5_5_SEVERITY_INDEX') return { low: statuses.filter((status) => status === 'low').length, medium: statuses.filter((status) => status === 'medium').length, high: statuses.filter((status) => status === 'high').length, critical: statuses.filter((status) => status === 'critical').length };
  if (['F5_5_MTTC', 'F5_5_AGE', 'F5_5_WEIGHTED_PROGRESS'].includes(formulaCode)) return { items: rows.map((row) => ({ openedAt: row.opened_at, closedAt: row.closed_at, createdAt: row.opened_at, progress: number(row.progress), weight: number(row.weight, 1) })).filter((item) => formulaCode === 'F5_5_WEIGHTED_PROGRESS' ? item.progress !== null : item.createdAt), now: new Date().toISOString() };
  if (formulaCode === 'F5_5_CLOSURE_RATE') return { closed: statuses.filter((status) => ['closed', 'completed', 'resolved'].includes(status)).length, openAtStart: statuses.filter((status) => !['closed', 'completed', 'resolved'].includes(status)).length, created: 0 };
  if (formulaCode === 'F5_5_OVERDUE_RATE') { const open = rows.filter((row) => !['closed', 'completed', 'resolved'].includes(String(row.status))); return { overdueOpen: open.filter((row) => row.due_at && new Date(row.due_at) < new Date()).length, openActions: open.length, items: open.map((row) => ({ overdue: row.due_at && new Date(row.due_at) < new Date() ? 1 : 0, weight: number(row.weight, 1) })) }; }
  if (formulaCode === 'F5_5_EXPECTED_LOSS') return { probability: number(first.probability), impact: number(first.impact ?? first.gross_loss_amount) };
  if (formulaCode === 'F5_5_NET_LOSS') return { grossLoss: sum(rows.map((row) => row.gross_loss_amount)), recoveries: sum(rows.map((row) => row.recovery_amount)) };
  if (formulaCode === 'F5_5_LOSS_SEVERITY') return { netLosses: rows.map((row) => number(row.net_loss_amount, number(row.gross_loss_amount) !== null ? number(row.gross_loss_amount) - number(row.recovery_amount, 0) : null)).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_PARAMETRIC_VAR') { const losses = rows.map((row) => number(row.net_loss_amount ?? row.gross_loss_amount)).filter((value) => value !== null); const mean = average(losses); const variance = mean === null || losses.length < 2 ? null : losses.reduce((total, value) => total + ((value - mean) ** 2), 0) / (losses.length - 1); return { mean, z: 1.65, sigma: variance === null ? null : Math.sqrt(variance) }; }
  if (formulaCode === 'F5_5_MONTE_CARLO') { const losses = rows.map((row) => number(row.net_loss_amount ?? row.gross_loss_amount)).filter((value) => value !== null); return losses.length ? { iterations: 1000, seed: 42, frequency: { type: 'poisson', lambda: Math.max(0.01, losses.length / 12) }, severity: { type: 'fixed', value: average(losses) }, threshold: Math.max(...losses) } : null; }
  if (formulaCode === 'F5_5_AVAILABILITY') return { totalTime: number(first.total_time ?? first.totalTime), downtime: number(first.downtime ?? first.downtime_hours), mtbf: number(first.mtbf), mttr: number(first.mttr) };
  if (formulaCode === 'F5_5_MTBF') return { operatingTime: number(first.operating_time ?? first.total_time), failures: number(first.failures ?? rows.filter((row) => ['failed', 'failure'].includes(String(row.status))).length) };
  if (formulaCode === 'F5_5_MTTR') return { repairTimes: rows.map((row) => number(row.repair_time ?? row.actual_recovery_hours)).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_SLA_COMPLIANCE') return { withinSla: rows.filter((row) => ['pass', 'compliant', 'within_sla', 'completed'].includes(String(row.status))).length, applicableCases: rows.length };
  if (formulaCode === 'F5_5_RTO_GAP') return { recoveryActual: number(first.actual_recovery_hours ?? first.recovery_actual), rtoObjective: number(first.rto_hours ?? first.rto_objective) };
  if (formulaCode === 'F5_5_RPO_GAP') return { dataLossActual: number(first.actual_data_loss_hours ?? first.data_loss_actual), rpoObjective: number(first.rpo_hours ?? first.rpo_objective) };
  if (formulaCode === 'F5_5_ASSET_CRITICALITY') return { confidentiality: number(first.confidentiality), integrity: number(first.integrity), availability: number(first.availability), legal: number(first.legal ?? first.legal_impact) };
  if (formulaCode === 'F5_5_SUPPLIER_RISK') return { compliance: number(first.compliance_score ?? first.score), security: number(first.security_score), dependency: number(first.dependency_score), privacy: number(first.privacy_score), resilience: number(first.resilience_score) };
  if (formulaCode === 'F5_5_SURVEY_SCORE') return { items: rows.map((row) => ({ score: number(row.score), maxScore: number(row.max_score), weight: number(row.weight, 1), notApplicable: ['not_applicable', 'na'].includes(String(row.status)) })).filter((item) => item.score !== null && item.maxScore !== null) };
  if (formulaCode === 'F5_5_RESPONSE_RATE') return { completedResponses: statuses.filter((status) => ['completed', 'submitted', 'approved'].includes(status)).length, validInvitations: rows.length };
  if (formulaCode === 'F5_5_DROPOUT_RATE') return { started: rows.length, completed: statuses.filter((status) => ['completed', 'submitted', 'approved'].includes(status)).length };
  if (formulaCode === 'F5_5_ASSURANCE_SCORE') return { results: rows.map((row) => ({ result: row.result || row.status, weight: number(row.weight, 1) })) };
  if (formulaCode === 'F5_5_SAMPLE_SIZE') return { z: 1.96, p: 0.5, e: 0.05, population: rows.length };
  if (formulaCode === 'F5_5_COMPLETENESS') return { validRequired: sum(rows.map((row) => row.valid_count)), expectedRequired: sum(rows.map((row) => row.expected_count)) };
  if (formulaCode === 'F5_5_ACCURACY') return { verifiedCorrect: sum(rows.map((row) => row.valid_count)), verified: sum(rows.map((row) => number(row.valid_count, 0) + number(row.invalid_count, 0))) };
  if (formulaCode === 'F5_5_CONSISTENCY') return { contradictory: sum(rows.map((row) => row.invalid_count)), evaluated: sum(rows.map((row) => number(row.valid_count, 0) + number(row.invalid_count, 0))) };
  if (formulaCode === 'F5_5_FRESHNESS_CONTINUOUS') { const latest = dates.length ? Math.max(...dates.map((date) => new Date(date).getTime()).filter(Number.isFinite)) : null; return { ageHours: latest === null ? null : (Date.now() - latest) / 3600000, halfLifeHours: 24 * 30 }; }
  if (formulaCode === 'F5_5_LINEAGE_SCORE') return { presentRelations: rows.length, requiredRelations: rows.length || null };
  if (formulaCode === 'F5_5_GRC_HEALTH') { const values = {}; for (const row of rows) { const raw = row.output_value?.value ?? row.output_value; const value = ratio(raw); if (row.formula_code === 'F5_5_RESIDUAL_RISK') values.risk = value === null ? null : 1 - value; if (row.formula_code === 'F5_5_COMPLIANCE_WEIGHTED') values.compliance = value; if (row.formula_code === 'F5_5_WEIGHTED_PROGRESS') values.actions = value; if (row.formula_code === 'F5_5_EVIDENCE_QUALITY') values.evidence = value; if (row.formula_code === 'F5_5_COMPLETENESS') values.dataTrust = value; } return values; }
  if (formulaCode === 'F5_5_MATURITY') return { levels: rows.map((row) => ({ level: number(row.level ?? row.score), weight: number(row.weight, 1) })).filter((row) => row.level !== null) };
  if (['F5_5_ROBUST_Z_SCORE', 'F5_5_LINEAR_TREND', 'F5_5_PERCENT_VARIATION', 'F5_5_MOVING_AVERAGE', 'F5_5_EMA', 'F5_5_CONFIDENCE_INTERVAL'].includes(formulaCode)) {
    const values = usableScores;
    if (formulaCode === 'F5_5_ROBUST_Z_SCORE') return values.length ? { x: values[values.length - 1], values } : null;
    if (formulaCode === 'F5_5_LINEAR_TREND') return values.length > 1 ? { points: values.map((value, index) => ({ x: index + 1, y: value })) } : null;
    if (formulaCode === 'F5_5_PERCENT_VARIATION') return values.length > 1 ? { current: values[values.length - 1], previous: values[values.length - 2] } : null;
    if (formulaCode === 'F5_5_MOVING_AVERAGE' || formulaCode === 'F5_5_EMA') return values.length ? { values, windowSize: Math.min(3, values.length) } : null;
    if (formulaCode === 'F5_5_CONFIDENCE_INTERVAL') return rows.length ? { successes: statuses.filter((status) => ['pass', 'compliant', 'completed', 'valid'].includes(status)).length, sampleSize: rows.length, z: 1.96 } : null;
  }
  return null;
}

async function resolveFormulaSource({ client, tenantId, formulaCode, sourceCode = null, period = {}, timezone = 'UTC', permission = null, runId = null } = {}) {
  assertTenant(tenantId); assertPermission(permission);
  const formula = FORMULA_MAP.get(formulaCode); if (!formula) throw new MathGovernanceError('SOURCE_FORMULA_NOT_FOUND', 'Fórmula no registrada para resolver fuente.', { formulaCode });
  const resolvedSourceCode = sourceCode || getSourceCodeForFormula(formulaCode); const contract = getSourceContract(resolvedSourceCode);
  if (!contract) return sourceUnavailable(resolvedSourceCode, 'No existe contrato de fuente para la fórmula.');
  if (contract.availability === 'source_unavailable') return sourceUnavailable(contract.source_code, contract.limitations || 'Fuente no disponible.');
  let queried;
  try { queried = await queryOperationalRows({ client, contract, tenantId, period }); }
  catch (error) { const wrapped = new MathGovernanceError('SOURCE_SCHEMA_INCOMPATIBLE', 'La estructura física de la fuente no coincide con el contrato analítico.', { source_code: contract.source_code, original_code: error.code || null }); wrapped.cause = error; throw wrapped; }
  if (queried.unavailable) return sourceUnavailable(contract.source_code, queried.reason);
  const rows = normalizeRows(queried.rows, contract);
  const validation = validateDataset({ rows, tenantId, period, timezone, unit: contract.unit, requiredFields: contract.required_fields, minimumSampleSize: formula.minimum_sample_size || 1, sourceKey: contract.source_code, allowedStates: contract.status_filter?.allowed || null });
  const physicalSources = [...new Set(rows.map((row) => row.__physical_source).filter(Boolean))];
  const sourceSnapshot = { source_code: contract.source_code, physical_sources: physicalSources, formula_code: formula.formula_code, contract_checksum: contract.checksum, row_count: rows.length, usable_rows: validation.usable_rows.length, exclusions: validation.exclusions.length, period, timezone };
  const snapshotHash = hash(sourceSnapshot);
  return { source_code: contract.source_code, physical_sources: physicalSources, status: validation.status, rows: validation.usable_rows, warnings: validation.warnings, exclusions: validation.exclusions, invalid_rows: validation.invalid_rows, counts: { received: rows.length, usable: validation.usable_rows.length, excluded: validation.exclusions.length }, inputHash: validation.hash, input_hash: validation.hash, source_snapshot: sourceSnapshot, source_snapshot_hash: snapshotHash, lineage: buildLineage({ rows: validation.usable_rows, contract, formula, runId, snapshotHash }), formula_input: mapFormulaInput(formulaCode, validation.usable_rows), equivalence: contract.variable_map, contract };
}

async function resolveFormulaSources(args) { return resolveFormulaSource(args); }
module.exports = { SOURCE_STATES, buildSourceContract, sourceUnavailable, listSourceContracts, listFormulaSourceBindings, resolveFormulaSource, resolveFormulaSources, getSourceContract, tableExists, mapFormulaInput, queryOperationalRows, firstPopulated: firstPopulatedTables };
