'use strict';
const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { FORMULA_MAP } = require('./formulaRegistry.service');
const { validateDataset } = require('./datasetValidation.service');
const { getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings } = require('./sourceContracts.service');

const SOURCE_STATES = new Set(['ready', 'source_unavailable', 'empty_dataset', 'partially_available', 'legacy_adapter_required', 'validated_with_warnings']);
const FIXED_QUERY_BY_SOURCE = Object.freeze({
  loss_events_operational: `SELECT le.id, le.tenant_id, le.event_date, le.gross_loss_amount, le.net_loss_amount, le.currency, le.status, COALESCE(SUM(lr.recovery_amount), 0) AS recovery_amount FROM loss_events le LEFT JOIN loss_recoveries lr ON lr.tenant_id = le.tenant_id AND lr.loss_event_id = le.id WHERE le.tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR le.event_date >= $2::timestamptz) AND ($3::timestamptz IS NULL OR le.event_date <= $3::timestamptz) GROUP BY le.id`,
  continuity_resilience_tests: `SELECT id, tenant_id, tested_at, rto_hours, rpo_hours, actual_recovery_hours, actual_data_loss_hours, result, status FROM grc_continuity_tests WHERE tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR tested_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR tested_at <= $3::timestamptz)`,
  supplier_tprm_assessments: `SELECT s.id, s.tenant_id, s.status, s.criticality, a.security_score, a.dependency_score, a.resilience_score, a.privacy_score, a.assessed_at FROM grc_suppliers s LEFT JOIN grc_supplier_assessments a ON a.tenant_id = s.tenant_id AND a.supplier_id = s.id WHERE s.tenant_id = $1::uuid`,
  survey_response_scoring: `SELECT ri.id, r.tenant_id, r.status, r.submitted_at, ri.question_id, ri.score, ri.max_score, ri.weight FROM survey_responses r JOIN survey_response_items ri ON ri.response_id = r.id WHERE r.tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR r.submitted_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR r.submitted_at <= $3::timestamptz)`,
  assurance_test_results: `SELECT r.id, e.tenant_id, e.status, e.executed_at, r.result, r.weight, r.sample_id FROM assurance_test_results r JOIN assurance_test_executions e ON e.id = r.execution_id WHERE e.tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR e.executed_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR e.executed_at <= $3::timestamptz)`,
  data_quality_observations: `SELECT id, tenant_id, assessed_at, rule_type, expected_count, valid_count, invalid_count, coverage, status FROM data_quality_assessments WHERE tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR assessed_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR assessed_at <= $3::timestamptz)`,
  data_lineage_observations: `SELECT id, tenant_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type, created_at FROM data_lineage_edges WHERE tenant_id = $1::uuid`,
  statistical_metric_measurements: `SELECT id, tenant_id, metric_id, numeric_value, measured_at, unit, dimension_values, status FROM metric_measurements WHERE tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR measured_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR measured_at <= $3::timestamptz)`,
  asset_inventory_security: `SELECT id, tenant_id, name, classification, owner_user_id, metadata, status, created_at FROM data_elements WHERE tenant_id = $1::uuid AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz) AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)`,
});

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex'); }
function number(value, fallback = null) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function ratio(value) { const n = number(value); return n === null ? null : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); }
function buildSourceContract({ sourceKey, entityType, requiredFields = [], tenantScoped = true, status = 'source_unavailable', unit = null } = {}) { if (!sourceKey || !entityType) throw new MathGovernanceError('SOURCE_CONTRACT_INVALID', 'sourceKey y entityType son obligatorios.'); if (!SOURCE_STATES.has(status) && status !== 'available') throw new MathGovernanceError('SOURCE_STATUS_INVALID', 'Estado de fuente invalido.'); return Object.freeze({ sourceKey, entityType, requiredFields, tenantScoped, status, unit, lineageRequired: true }); }
function sourceUnavailable(sourceKey, reason = 'Operational source is not available for this formula.') { return Object.freeze({ sourceKey, source_code: sourceKey, status: 'source_unavailable', rows: [], reason, warnings: [reason], inputHash: null, source_snapshot: null, lineage: [], formula_input: null }); }
async function tableExists(client, tableName) { if (!client || typeof client.query !== 'function') return false; const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]); return result.rows[0]?.exists === true; }
async function allTablesExist(client, tables) { for (const table of tables) if (!(await tableExists(client, table))) return false; return true; }
function assertTenant(tenantId) { if (!tenantId) throw new MathGovernanceError('SOURCE_TENANT_REQUIRED', 'Resolver de fuentes requiere tenant efectivo.'); }
function assertPermission(permission) { if (permission && permission.allowed === false) throw new MathGovernanceError('SOURCE_PERMISSION_DENIED', 'Permiso insuficiente para resolver dataset matematico.', { required: permission.required }); }
function normalizeRows(rows, contract) { return rows.map((row) => { const normalized = {}; for (const [key, value] of Object.entries(row)) normalized[key] = typeof value === 'string' ? value.trim() : value; normalized.__source_code = contract.source_code; return normalized; }); }
function buildLineage({ rows, contract, formula, runId = null, snapshotHash = null }) { return rows.slice(0, 1000).map((row) => ({ source_record: row.id || row.source_entity_id || null, source_contract: contract.source_code, dataset_snapshot: snapshotHash, formula_version: `${formula.formula_code}@${formula.version}`, calculation_run: runId })); }
function periodArgs(tenantId, period = {}) { return [tenantId, period.start || null, period.end || null]; }

async function queryCompliance(client, tenantId, period) {
  if (!(await allTablesExist(client, ['grc_framework_requirements','grc_requirement_control_mappings','grc_control_assurance']))) return null;
  return (await client.query(`
    SELECT m.id, COALESCE(m.tenant_id, r.tenant_id) AS tenant_id, m.requirement_id, m.tenant_control_id,
      CASE WHEN m.mapping_type='not_equivalent' THEN 'not_applicable' WHEN m.status IN ('published','reviewed') AND COALESCE(a.score,m.coverage_level,0)>=80 THEN 'conform' WHEN m.status IN ('published','reviewed') AND COALESCE(a.score,m.coverage_level,0)>0 THEN 'partial' WHEN m.status='rejected' THEN 'non_conform' ELSE 'pending' END AS status,
      (m.mapping_type <> 'not_equivalent') AS applicability, 1::numeric AS weight,
      COALESCE(m.updated_at,m.created_at) AS assessed_at, a.score AS assurance_score
    FROM grc_requirement_control_mappings m JOIN grc_framework_requirements r ON r.id=m.requirement_id
    LEFT JOIN grc_control_assurance a ON a.tenant_id=COALESCE(m.tenant_id,r.tenant_id) AND a.tenant_control_id=m.tenant_control_id
    WHERE COALESCE(m.tenant_id,r.tenant_id)=$1::uuid AND ($2::timestamptz IS NULL OR COALESCE(m.updated_at,m.created_at)>=$2) AND ($3::timestamptz IS NULL OR COALESCE(m.updated_at,m.created_at)<=$3)`, periodArgs(tenantId, period))).rows;
}
async function queryReadiness(client, tenantId, period) {
  if (!(await allTablesExist(client, ['grc_readiness_snapshots','grc_readiness_results']))) return null;
  return (await client.query(`SELECT rr.id, rr.tenant_id, rr.snapshot_id, rr.dimension, rr.score, rr.weight, rr.source_as_of, 'evaluated'::text AS status FROM grc_readiness_results rr JOIN grc_readiness_snapshots rs ON rs.id=rr.snapshot_id AND rs.tenant_id=rr.tenant_id WHERE rr.tenant_id=$1::uuid AND ($2::timestamptz IS NULL OR rr.source_as_of >= $2) AND ($3::timestamptz IS NULL OR rr.source_as_of <= $3) AND rr.snapshot_id=(SELECT id FROM grc_readiness_snapshots WHERE tenant_id=$1::uuid ORDER BY generated_at DESC LIMIT 1)`, periodArgs(tenantId, period))).rows;
}
async function queryRisk(client, tenantId, period) {
  for (const table of ['grc_quantitative_risk_assessments','iso_risk_matrix_items']) {
    if (!(await tableExists(client, table))) continue;
    const sql = `SELECT (to_jsonb(x)->>'id')::uuid AS id, (to_jsonb(x)->>'tenant_id')::uuid AS tenant_id, COALESCE(NULLIF(to_jsonb(x)->>'risk_id','')::uuid,(to_jsonb(x)->>'id')::uuid) AS risk_id, COALESCE(NULLIF(to_jsonb(x)->>'probability','')::numeric,NULLIF(to_jsonb(x)->>'likelihood','')::numeric) AS probability, COALESCE(NULLIF(to_jsonb(x)->>'impact','')::numeric,NULLIF(to_jsonb(x)->>'severity','')::numeric) AS impact, COALESCE(NULLIF(to_jsonb(x)->>'exposure','')::numeric,NULLIF(to_jsonb(x)->>'inherent_score','')::numeric) AS exposure, NULLIF(to_jsonb(x)->>'occurrence','')::numeric AS occurrence, NULLIF(to_jsonb(x)->>'detection','')::numeric AS detection, COALESCE(to_jsonb(x)->>'status','evaluated') AS status, COALESCE(NULLIF(to_jsonb(x)->>'assessed_at','')::timestamptz,NULLIF(to_jsonb(x)->>'created_at','')::timestamptz) AS assessed_at FROM ${table} x WHERE (to_jsonb(x)->>'tenant_id')::uuid=$1::uuid AND ($2::timestamptz IS NULL OR COALESCE(NULLIF(to_jsonb(x)->>'assessed_at','')::timestamptz,NULLIF(to_jsonb(x)->>'created_at','')::timestamptz)>=$2) AND ($3::timestamptz IS NULL OR COALESCE(NULLIF(to_jsonb(x)->>'assessed_at','')::timestamptz,NULLIF(to_jsonb(x)->>'created_at','')::timestamptz)<=$3)`;
    return (await client.query(sql, periodArgs(tenantId, period))).rows;
  }
  return null;
}
async function queryControls(client, tenantId, period) {
  if (!(await tableExists(client, 'grc_control_assurance'))) return null;
  return (await client.query(`SELECT id, tenant_id, tenant_control_id AS control_id, score, score/100.0 AS design_score, score/100.0 AS implementation_score, score/100.0 AS operation_score, score/100.0 AS evidence_score, assurance_status AS status, calculated_at FROM grc_control_assurance WHERE tenant_id=$1::uuid AND ($2::timestamptz IS NULL OR calculated_at >= $2) AND ($3::timestamptz IS NULL OR calculated_at <= $3)`, periodArgs(tenantId, period))).rows;
}
async function queryAuditActions(client, tenantId, period) {
  const rows = [];
  if (await tableExists(client, 'grc_readiness_findings')) rows.push(...(await client.query(`SELECT f.id,f.tenant_id,f.severity,'open'::text AS status,NULL::timestamptz AS opened_at,NULL::timestamptz AS closed_at,NULL::timestamptz AS due_at,0::numeric AS progress,1::numeric AS weight FROM grc_readiness_findings f WHERE f.tenant_id=$1::uuid`, [tenantId])).rows);
  if (await tableExists(client, 'action_plans')) rows.push(...(await client.query(`SELECT (to_jsonb(a)->>'id')::uuid AS id,(to_jsonb(a)->>'tenant_id')::uuid AS tenant_id,COALESCE(to_jsonb(a)->>'severity','medium') AS severity,COALESCE(to_jsonb(a)->>'status','open') AS status,COALESCE(NULLIF(to_jsonb(a)->>'opened_at','')::timestamptz,NULLIF(to_jsonb(a)->>'created_at','')::timestamptz) AS opened_at,COALESCE(NULLIF(to_jsonb(a)->>'closed_at','')::timestamptz,NULLIF(to_jsonb(a)->>'completed_at','')::timestamptz) AS closed_at,NULLIF(COALESCE(to_jsonb(a)->>'due_at',to_jsonb(a)->>'due_date'),'')::timestamptz AS due_at,COALESCE(NULLIF(to_jsonb(a)->>'progress','')::numeric,NULLIF(to_jsonb(a)->>'progress_ratio','')::numeric,0) AS progress,COALESCE(NULLIF(to_jsonb(a)->>'weight','')::numeric,1) AS weight FROM action_plans a WHERE (to_jsonb(a)->>'tenant_id')::uuid=$1::uuid`, [tenantId])).rows);
  return rows.length ? rows : null;
}
async function queryHealth(client, tenantId, period) {
  if (!(await allTablesExist(client, ['calculation_runs','calculation_outputs']))) return null;
  return (await client.query(`SELECT cr.id,cr.tenant_id,cr.formula_code,cr.run_status AS status,cr.period_start,cr.period_end,co.output_value,co.unit FROM calculation_runs cr JOIN calculation_outputs co ON co.run_id=cr.id AND co.tenant_id=cr.tenant_id WHERE cr.tenant_id=$1::uuid AND cr.run_status='calculated' AND cr.formula_code IN ('F5_5_RESIDUAL_RISK','F5_5_COMPLIANCE_WEIGHTED','F5_5_WEIGHTED_PROGRESS','F5_5_EVIDENCE_QUALITY','F5_5_COMPLETENESS','F5_5_GRC_HEALTH') AND ($2::timestamptz IS NULL OR cr.period_end >= $2) AND ($3::timestamptz IS NULL OR cr.period_start <= $3) ORDER BY cr.completed_at DESC`, periodArgs(tenantId, period))).rows;
}
async function queryMaturity(client, tenantId, period) {
  for (const table of ['survey_evaluations','metric_measurements']) {
    if (!(await tableExists(client, table))) continue;
    const sql = `SELECT (to_jsonb(x)->>'id')::uuid AS id,(to_jsonb(x)->>'tenant_id')::uuid AS tenant_id,COALESCE(NULLIF(to_jsonb(x)->>'level','')::numeric,NULLIF(to_jsonb(x)->>'score','')::numeric,NULLIF(to_jsonb(x)->>'numeric_value','')::numeric) AS level,COALESCE(NULLIF(to_jsonb(x)->>'weight','')::numeric,1) AS weight,COALESCE(NULLIF(to_jsonb(x)->>'evaluated_at','')::timestamptz,NULLIF(to_jsonb(x)->>'measured_at','')::timestamptz,NULLIF(to_jsonb(x)->>'created_at','')::timestamptz) AS evaluated_at,COALESCE(to_jsonb(x)->>'status','evaluated') AS status FROM ${table} x WHERE (to_jsonb(x)->>'tenant_id')::uuid=$1::uuid`;
    return (await client.query(sql, [tenantId])).rows;
  }
  return null;
}
const ADAPTER_BY_SOURCE = Object.freeze({ compliance_requirements_assessments: queryCompliance, grc_readiness_operational_snapshot: queryReadiness, risk_register_controls: queryRisk, control_assurance_evidence: queryControls, audit_findings_actions: queryAuditActions, grc_health_components: queryHealth, maturity_assessments: queryMaturity });

async function queryOperationalRows({ client, contract, tenantId, period = {} }) {
  const adapter = ADAPTER_BY_SOURCE[contract.source_code];
  if (adapter) { const rows = await adapter(client, tenantId, period); return rows === null ? { rows: [], unavailable: true, reason: `Operational tables are not present for ${contract.source_code}.` } : { rows, unavailable: false, reason: null }; }
  const fixedQuery = FIXED_QUERY_BY_SOURCE[contract.source_code];
  if (!fixedQuery) return { rows: [], unavailable: true, reason: `No fixed adapter query registered for ${contract.source_code}.` };
  const ready = await allTablesExist(client, contract.tables);
  if (!ready) return { rows: [], unavailable: true, reason: `One or more source tables are not present for ${contract.source_code}.` };
  const result = await client.query(fixedQuery, periodArgs(tenantId, period));
  return { rows: result.rows || [], unavailable: false, reason: null };
}

function mapFormulaInput(formulaCode, rows) {
  const first = rows[0] || {};
  if (formulaCode === 'F5_5_COMPLIANCE_WEIGHTED') return { assessments: rows.map((r) => ({ status: r.status, weight: number(r.weight, 1), notApplicable: r.applicability === false })) };
  if (formulaCode === 'F5_5_COVERAGE') return { evaluated: rows.filter((r) => !['pending','not_evaluated'].includes(String(r.status))).length, applicable: rows.filter((r) => r.applicability !== false).length };
  if (formulaCode === 'F5_5_READINESS') { const by = Object.fromEntries(rows.map((r) => [String(r.dimension).toLowerCase(), ratio(r.score)])); return { compliance: by.compliance, evidence: by.evidence, health: by.health, actions: by.actions }; }
  if (formulaCode === 'F5_5_INHERENT_RISK') return { probability: number(first.probability), impact: number(first.impact) };
  if (formulaCode === 'F5_5_RESIDUAL_RISK') return { inherentRisk: number(first.exposure, number(first.probability, 0) * number(first.impact, 0)), controlEffectiveness: ratio(first.control_effectiveness ?? first.assurance_score ?? 0) };
  if (formulaCode === 'F5_5_FMEA_RPN') return { severity: number(first.impact ?? first.severity), occurrence: number(first.occurrence ?? first.probability), detection: number(first.detection) };
  if (formulaCode === 'F5_5_COMBINED_EFFECTIVENESS') return { effectivenesses: rows.map((r) => ratio(r.score)).filter((v) => v !== null) };
  if (formulaCode === 'F5_5_CONTROL_EFFECTIVENESS') return { design: ratio(first.design_score), implementation: ratio(first.implementation_score), operation: ratio(first.operation_score), evidence: ratio(first.evidence_score) };
  if (formulaCode === 'F5_5_CONTROL_COVERAGE') return { risksWithControl: rows.filter((r) => number(r.score, 0) > 0).length, relevantRisks: rows.length };
  if (formulaCode === 'F5_5_FREQUENCY_COMPLIANCE') return { onTimeExecutions: rows.filter((r) => ['effective','completed','on_time'].includes(String(r.status))).length, scheduledExecutions: rows.length };
  if (formulaCode === 'F5_5_SEVERITY_INDEX') return { low: rows.filter((r) => r.severity === 'low').length, medium: rows.filter((r) => r.severity === 'medium').length, high: rows.filter((r) => r.severity === 'high').length, critical: rows.filter((r) => r.severity === 'critical').length };
  if (['F5_5_MTTC','F5_5_AGE','F5_5_WEIGHTED_PROGRESS'].includes(formulaCode)) return { items: rows.map((r) => ({ openedAt: r.opened_at, closedAt: r.closed_at, createdAt: r.opened_at, progress: number(r.progress, 0), weight: number(r.weight, 1) })), now: new Date().toISOString() };
  if (formulaCode === 'F5_5_CLOSURE_RATE') return { closed: rows.filter((r) => ['closed','completed'].includes(String(r.status))).length, openAtStart: rows.filter((r) => !['closed','completed'].includes(String(r.status))).length, created: 0 };
  if (formulaCode === 'F5_5_OVERDUE_RATE') { const open = rows.filter((r) => !['closed','completed'].includes(String(r.status))); return { overdueOpen: open.filter((r) => r.due_at && new Date(r.due_at) < new Date()).length, openActions: open.length, items: open.map((r) => ({ overdue: r.due_at && new Date(r.due_at) < new Date() ? 1 : 0, weight: number(r.weight, 1) })) }; }
  if (formulaCode === 'F5_5_GRC_HEALTH') { const values = {}; for (const r of rows) { const raw = r.output_value?.value ?? r.output_value; const value = ratio(raw); if (r.formula_code === 'F5_5_RESIDUAL_RISK') values.risk = value === null ? null : 1 - value; if (r.formula_code === 'F5_5_COMPLIANCE_WEIGHTED') values.compliance = value; if (r.formula_code === 'F5_5_WEIGHTED_PROGRESS') values.actions = value; if (r.formula_code === 'F5_5_EVIDENCE_QUALITY') values.evidence = value; if (r.formula_code === 'F5_5_COMPLETENESS') values.dataTrust = value; } return values; }
  if (formulaCode === 'F5_5_MATURITY') return { items: rows.map((r) => ({ level: number(r.level), weight: number(r.weight, 1) })).filter((r) => r.level !== null) };
  return null;
}

async function resolveFormulaSource({ client, tenantId, formulaCode, sourceCode = null, period = {}, timezone = 'UTC', permission = null, runId = null } = {}) {
  assertTenant(tenantId); assertPermission(permission);
  const formula = FORMULA_MAP.get(formulaCode); if (!formula) throw new MathGovernanceError('SOURCE_FORMULA_NOT_FOUND', 'Formula no registrada para resolver fuente.', { formulaCode });
  const resolvedSourceCode = sourceCode || getSourceCodeForFormula(formulaCode); const contract = getSourceContract(resolvedSourceCode);
  if (!contract) return sourceUnavailable(resolvedSourceCode, 'No existe contrato de fuente para la formula.');
  if (contract.availability === 'source_unavailable') return sourceUnavailable(contract.source_code, contract.limitations || 'Fuente no disponible.');
  const queried = await queryOperationalRows({ client, contract, tenantId, period }); if (queried.unavailable) return sourceUnavailable(contract.source_code, queried.reason);
  const rows = normalizeRows(queried.rows, contract);
  const validation = validateDataset({ rows, tenantId, period, timezone, unit: contract.unit, requiredFields: contract.required_fields, minimumSampleSize: formula.minimum_sample_size || 1, sourceKey: contract.source_code, allowedStates: contract.status_filter?.allowed || null });
  const sourceSnapshot = { source_code: contract.source_code, formula_code: formula.formula_code, contract_checksum: contract.checksum, row_count: rows.length, usable_rows: validation.usable_rows.length, exclusions: validation.exclusions.length, period, timezone };
  const snapshotHash = hash(sourceSnapshot);
  return { source_code: contract.source_code, status: validation.status, rows: validation.usable_rows, warnings: validation.warnings, exclusions: validation.exclusions, invalid_rows: validation.invalid_rows, counts: { received: rows.length, usable: validation.usable_rows.length, excluded: validation.exclusions.length }, inputHash: validation.hash, input_hash: validation.hash, source_snapshot: sourceSnapshot, source_snapshot_hash: snapshotHash, lineage: buildLineage({ rows: validation.usable_rows, contract, formula, runId, snapshotHash }), formula_input: mapFormulaInput(formulaCode, validation.usable_rows), equivalence: contract.variable_map, contract };
}
async function resolveFormulaSources(args) { return resolveFormulaSource(args); }
module.exports = { SOURCE_STATES, buildSourceContract, sourceUnavailable, listSourceContracts, listFormulaSourceBindings, resolveFormulaSource, resolveFormulaSources, getSourceContract, tableExists, mapFormulaInput, queryOperationalRows };
