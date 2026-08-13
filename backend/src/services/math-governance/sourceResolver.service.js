'use strict';
const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { FORMULA_MAP } = require('./formulaRegistry.service');
const { validateDataset } = require('./datasetValidation.service');
const { getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings } = require('./sourceContracts.service');

const SOURCE_STATES = new Set(['ready', 'source_unavailable', 'empty_dataset', 'partially_available', 'legacy_adapter_required', 'validated_with_warnings']);
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex'); }
function number(value, fallback = null) { const n = Number(value); return value === null || value === undefined || value === '' || !Number.isFinite(n) ? fallback : n; }
function ratio(value) { const n = number(value); return n === null ? null : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); }
function sum(values) { const usable = values.map((value) => number(value)).filter((value) => value !== null); return usable.length ? usable.reduce((total, value) => total + value, 0) : null; }
function average(values) { const usable = values.map((value) => number(value)).filter((value) => value !== null); return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : null; }
function score(value) { const normalized = ratio(value); return normalized === null ? null : normalized * 100; }
function buildSourceContract({ sourceKey, entityType, requiredFields = [], tenantScoped = true, status = 'source_unavailable', unit = null } = {}) { if (!sourceKey || !entityType) throw new MathGovernanceError('SOURCE_CONTRACT_INVALID', 'sourceKey y entityType son obligatorios.'); if (!SOURCE_STATES.has(status) && status !== 'available') throw new MathGovernanceError('SOURCE_STATUS_INVALID', 'Estado de fuente inválido.'); return Object.freeze({ sourceKey, entityType, requiredFields, tenantScoped, status, unit, lineageRequired: true }); }
function sourceUnavailable(sourceKey, reason = 'La fuente operacional no está disponible para esta fórmula.', options = {}) { return Object.freeze({ sourceKey, source_code: sourceKey, status: 'source_unavailable', rows: [], reason, warnings: [reason], inputHash: null, source_snapshot: null, lineage: [], formula_input: null, data_requirements: { status: 'source_unavailable', missing_fields: options.required_fields || [], missing_entities: options.missing_entities || [sourceKey].filter(Boolean), incomplete_records: [], required_population: options.minimum_sample_size || null, current_population: 0, coverage_gap: null, freshness_gap: null, route_to_fix: options.route_to_fix || null, required_capability: options.required_capability || null, reason } }); }
async function tableExists(client, tableName) { if (!client || typeof client.query !== 'function') return false; const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]); return result.rows[0]?.exists === true; }
function assertTenant(tenantId) { if (!tenantId) throw new MathGovernanceError('SOURCE_TENANT_REQUIRED', 'Resolver de fuentes requiere tenant efectivo.'); }
function assertPermission(permission) { if (permission && permission.allowed === false) throw new MathGovernanceError('SOURCE_PERMISSION_DENIED', 'Permiso insuficiente para resolver dataset matemático.', { required: permission.required }); }
function normalizeRows(rows, contract) { return rows.map((row) => { const normalized = {}; for (const [key, value] of Object.entries(row)) normalized[key] = typeof value === 'string' ? value.trim() : value; normalized.__source_code = contract.source_code; return normalized; }); }
function buildLineage({ rows, contract, formula, runId = null, snapshotHash = null }) { return rows.slice(0, 1000).map((row) => ({ source_record: row.id || row.source_entity_id || null, physical_source: row.__physical_source || null, source_contract: contract.source_code, dataset_snapshot: snapshotHash, formula_version: `${formula.formula_code}@${formula.version}`, calculation_run: runId })); }
function tagRows(rows, physicalSource) { return (rows || []).map((row) => ({ ...row, __physical_source: physicalSource })); }
function tagWarnings(rows, warnings = []) { return (rows || []).map((row) => ({ ...row, __source_warnings: warnings })); }

function validRiskAxis(value) {
  const parsed = number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

const SEVERITY_LEVELS = Object.freeze(['low', 'medium', 'high', 'critical']);
const GRC_HEALTH_DEPENDENCY_FORMULAS = Object.freeze([
  'F5_5_RESIDUAL_RISK',
  'F5_5_COMPLIANCE_WEIGHTED',
  'F5_5_WEIGHTED_PROGRESS',
  'F5_5_FRESHNESS_CONTINUOUS',
  'F5_C3_DATA_TRUST',
]);

function riskInherentPortfolio(rows = []) {
  const risks = [];
  const usableRows = [];
  const exclusions = [];
  rows.forEach((row, index) => {
    const probability = validRiskAxis(row.probability ?? row.likelihood);
    const impact = validRiskAxis(row.impact);
    const sourceRecord = row.id || row.risk_id || row.source_entity_id || `row-${index}`;
    if (probability === null || impact === null) {
      exclusions.push({
        code: 'risk_axis_invalid',
        field: probability === null ? 'probability|likelihood' : 'impact',
        source_record: sourceRecord,
        physical_source: row.__physical_source || null,
        reason: 'RISK-INHERENT requiere probability/likelihood e impact enteros entre 1 y 5.',
      });
      return;
    }
    const risk = {
      source_record: sourceRecord,
      physical_source: row.__physical_source || null,
      probability,
      impact,
      inherent_risk_score: probability * impact,
    };
    risks.push(risk);
    usableRows.push(row);
  });
  return {
    input: {
      risks,
      aggregation_method: 'arithmetic_mean',
      sample_size: risks.length,
      population_size: risks.length,
      raw_population_size: rows.length,
      scores: risks.map((risk) => risk.inherent_risk_score),
    },
    usableRows,
    exclusions,
  };
}

function severityPortfolio(rows = []) {
  const usableRows = [];
  const exclusions = [];
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  rows.forEach((row, index) => {
    const severity = String(row.severity ?? row.risk_level ?? row.level ?? '').trim().toLowerCase();
    const sourceRecord = row.id || row.source_entity_id || `row-${index}`;
    if (!SEVERITY_LEVELS.includes(severity)) {
      exclusions.push({
        code: 'severity_missing_or_invalid',
        field: 'severity',
        source_record: sourceRecord,
        physical_source: row.__physical_source || null,
        reason: 'F5_5_SEVERITY_INDEX requiere severidad low, medium, high o critical; status operacional no se usa como severidad.',
      });
      return;
    }
    counts[severity] += 1;
    usableRows.push(row);
  });
  return { input: counts, usableRows, exclusions };
}

function maturityPortfolio(rows = []) {
  const usableRows = [];
  const exclusions = [];
  const levels = [];
  rows.forEach((row, index) => {
    const level = number(row.level ?? row.maturity_level ?? row.score ?? row.numeric_value ?? row.value_numeric);
    const sourceRecord = row.id || row.source_entity_id || `row-${index}`;
    if (level === null) {
      exclusions.push({ code: 'maturity_level_missing_or_invalid', field: 'level|maturity_level|score|numeric_value|value_numeric', source_record: sourceRecord, physical_source: row.__physical_source || null, reason: 'F5_5_MATURITY requiere nivel numérico de madurez; filas sin nivel no se usan como proxy.' });
      return;
    }
    if (level < 0 || level > 5) {
      exclusions.push({ code: 'maturity_level_out_of_range', field: 'level', source_record: sourceRecord, physical_source: row.__physical_source || null, value: level, reason: 'F5_5_MATURITY usa escala de madurez 0..5; puntajes porcentuales u otros valores no se usan como nivel.' });
      return;
    }
    levels.push({ level, weight: number(row.weight, 1) });
    usableRows.push(row);
  });
  return { input: { levels }, usableRows, exclusions };
}

function safeTimestampExpression(alias = 'x') {
  return `COALESCE(NULLIF(to_jsonb(${alias})->>'event_date','')::timestamptz,NULLIF(to_jsonb(${alias})->>'occurred_at','')::timestamptz,NULLIF(to_jsonb(${alias})->>'measured_at','')::timestamptz,NULLIF(to_jsonb(${alias})->>'assessed_at','')::timestamptz,NULLIF(to_jsonb(${alias})->>'updated_at','')::timestamptz,NULLIF(to_jsonb(${alias})->>'created_at','')::timestamptz)`;
}
async function firstPopulatedTables(client, tables, tenantId, period = {}) {
  let existing = false;
  let primaryExisting = null;
  for (const table of tables) {
    if (!(await tableExists(client, table))) continue;
    if (!primaryExisting) primaryExisting = table;
    existing = true;
    const timestamp = safeTimestampExpression('x');
    const result = await client.query(`SELECT x.*, ${timestamp} AS __event_time FROM ${table} x WHERE (to_jsonb(x)->>'tenant_id')::uuid=$1::uuid AND ($2::timestamptz IS NULL OR ${timestamp}>=$2) AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`, [tenantId, period.start || null, period.end || null]);
    if (result.rows?.length) {
      const warnings = primaryExisting && table !== primaryExisting
        ? [`Fuente primaria ${primaryExisting} sin filas en el período solicitado; se usó fallback legacy explícito ${table}.`]
        : [];
      return tagWarnings(tagRows(result.rows, table), warnings);
    }
  }
  return existing ? [] : null;
}
async function firstPopulated(client, candidates) {
  let available = false;
  let primaryExisting = null;
  for (const candidate of candidates) {
    if (!(await tableExists(client, candidate.table))) continue;
    if (!primaryExisting) primaryExisting = candidate.table;
    available = true;
    const result = await client.query(candidate.sql, candidate.params || []);
    if (result.rows?.length) {
      const warnings = primaryExisting && candidate.table !== primaryExisting
        ? [`Fuente primaria ${primaryExisting} sin filas en el período solicitado; se usó fallback legacy explícito ${candidate.table}.`]
        : [];
      return tagWarnings(tagRows(result.rows, candidate.table), warnings);
    }
  }
  return available ? [] : null;
}

async function queryCompliance(client, tenantId, period) {
  const candidates = [
    { table: 'grc_requirement_control_mappings', params: [tenantId, period.start || null, period.end || null], sql: `SELECT m.id,COALESCE(m.tenant_id,r.tenant_id) AS tenant_id,m.requirement_id,m.tenant_control_id,CASE WHEN m.mapping_type='not_equivalent' THEN 'not_applicable' WHEN m.status IN ('published','reviewed') AND COALESCE(a.score,m.coverage_level)>=80 THEN 'conform' WHEN m.status IN ('published','reviewed') AND COALESCE(a.score,m.coverage_level)>0 THEN 'partial' WHEN m.status='rejected' THEN 'non_conform' ELSE 'pending' END AS status,(m.mapping_type<>'not_equivalent') AS applicability,1::numeric AS weight,COALESCE(m.updated_at,m.created_at) AS assessed_at,a.score AS assurance_score FROM grc_requirement_control_mappings m JOIN grc_framework_requirements r ON r.id=m.requirement_id LEFT JOIN grc_control_assurance a ON a.tenant_id=COALESCE(m.tenant_id,r.tenant_id) AND a.tenant_control_id=m.tenant_control_id WHERE COALESCE(m.tenant_id,r.tenant_id)=$1::uuid AND ($2::timestamptz IS NULL OR COALESCE(m.updated_at,m.created_at)>=$2) AND ($3::timestamptz IS NULL OR COALESCE(m.updated_at,m.created_at)<=$3)` },
    { table: 'control_soa_assessments', params: [tenantId], sql: `SELECT (to_jsonb(x)->>'id')::uuid AS id,(to_jsonb(x)->>'tenant_id')::uuid AS tenant_id,COALESCE(NULLIF(to_jsonb(x)->>'control_id','')::uuid,NULLIF(to_jsonb(x)->>'tenant_control_id','')::uuid,(to_jsonb(x)->>'id')::uuid) AS requirement_id,COALESCE(NULLIF(to_jsonb(x)->>'tenant_control_id','')::uuid,NULLIF(to_jsonb(x)->>'control_id','')::uuid,(to_jsonb(x)->>'id')::uuid) AS tenant_control_id,CASE WHEN lower(COALESCE(to_jsonb(x)->>'status',to_jsonb(x)->>'assessment_status','pending')) IN ('compliant','conform','effective','implemented','approved') THEN 'conform' WHEN lower(COALESCE(to_jsonb(x)->>'status',to_jsonb(x)->>'assessment_status','pending')) IN ('partial','partially_compliant','in_progress') THEN 'partial' WHEN lower(COALESCE(to_jsonb(x)->>'status',to_jsonb(x)->>'assessment_status','pending')) IN ('non_compliant','non_conform','ineffective','rejected') THEN 'non_conform' WHEN lower(COALESCE(to_jsonb(x)->>'status',to_jsonb(x)->>'assessment_status','pending')) IN ('not_applicable','na') THEN 'not_applicable' ELSE 'pending' END AS status,lower(COALESCE(to_jsonb(x)->>'status',to_jsonb(x)->>'assessment_status','pending')) NOT IN ('not_applicable','na') AS applicability,COALESCE(NULLIF(to_jsonb(x)->>'weight','')::numeric,1) AS weight,${safeTimestampExpression('x')} AS assessed_at,COALESCE(NULLIF(to_jsonb(x)->>'score','')::numeric,NULLIF(to_jsonb(x)->>'compliance_score','')::numeric,NULLIF(to_jsonb(x)->>'assurance_score','')::numeric) AS assurance_score FROM control_soa_assessments x WHERE (to_jsonb(x)->>'tenant_id')::uuid=$1::uuid` },
    { table: 'tenant_controls', params: [tenantId], sql: `SELECT (to_jsonb(x)->>'id')::uuid AS id,(to_jsonb(x)->>'tenant_id')::uuid AS tenant_id,(to_jsonb(x)->>'id')::uuid AS requirement_id,(to_jsonb(x)->>'id')::uuid AS tenant_control_id,CASE WHEN lower(COALESCE(to_jsonb(x)->>'compliance_status',to_jsonb(x)->>'status','pending')) IN ('compliant','conform','effective','implemented','approved','active') THEN 'conform' WHEN lower(COALESCE(to_jsonb(x)->>'compliance_status',to_jsonb(x)->>'status','pending')) IN ('partial','partially_compliant','in_progress') THEN 'partial' WHEN lower(COALESCE(to_jsonb(x)->>'compliance_status',to_jsonb(x)->>'status','pending')) IN ('non_compliant','non_conform','ineffective','rejected') THEN 'non_conform' WHEN lower(COALESCE(to_jsonb(x)->>'compliance_status',to_jsonb(x)->>'status','pending')) IN ('not_applicable','na') THEN 'not_applicable' ELSE 'pending' END AS status,COALESCE(NULLIF(to_jsonb(x)->>'is_applicable','')::boolean,true) AS applicability,COALESCE(NULLIF(to_jsonb(x)->>'weight','')::numeric,1) AS weight,${safeTimestampExpression('x')} AS assessed_at,COALESCE(NULLIF(to_jsonb(x)->>'score','')::numeric,NULLIF(to_jsonb(x)->>'effectiveness_score','')::numeric,NULLIF(to_jsonb(x)->>'assurance_score','')::numeric) AS assurance_score FROM tenant_controls x WHERE (to_jsonb(x)->>'tenant_id')::uuid=$1::uuid` },
  ];
  return firstPopulated(client, candidates);
}

async function queryRisk(client, tenantId, period) {
  if (await tableExists(client, 'iso_risk_matrix_items') && await tableExists(client, 'iso_risk_matrix_runs')) {
    const runTimestamp = `COALESCE(r.completed_at,r.updated_at,r.created_at)`;
    const result = await client.query(
      `WITH latest_runs AS (
         SELECT DISTINCT ON (r.tenant_id,r.standard_code,r.version_code)
                r.id,r.tenant_id,r.standard_code,r.version_code,${runTimestamp} AS effective_at
         FROM iso_risk_matrix_runs r
         WHERE r.tenant_id=$1::uuid
           AND r.run_status IN ('completed','reviewed')
           AND ($2::timestamptz IS NULL OR ${runTimestamp}<=$2)
         ORDER BY r.tenant_id,r.standard_code,r.version_code,${runTimestamp} DESC NULLS LAST,r.created_at DESC
       )
       SELECT i.*,lr.effective_at AS __event_time
       FROM latest_runs lr
       JOIN iso_risk_matrix_items i ON i.run_id=lr.id AND i.tenant_id=lr.tenant_id
       WHERE i.tenant_id=$1::uuid
         AND i.status NOT IN ('rejected','archived')`,
      [tenantId, period.end || null]
    );
    if (result.rows?.length) return tagRows(result.rows, 'iso_risk_matrix_items');
  }
  return firstPopulatedTables(client, ['grc_quantitative_risk_assessments','asset_risks','privacy_dpia_risks'], tenantId, period);
}

async function queryControls(client, tenantId, period) {
  if (await tableExists(client, 'grc_control_assurance')) {
    const timestamp = `NULLIF(to_jsonb(a)->>'calculated_at','')::timestamptz`;
    const result = await client.query(
      `SELECT a.*,
              a.assurance_status AS status,
              ${timestamp} AS __event_time
       FROM grc_control_assurance a
       WHERE a.tenant_id=$1::uuid
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`,
      [tenantId, period.start || null, period.end || null]
    );
    if (result.rows?.length) return tagRows(result.rows, 'grc_control_assurance');
  }
  return firstPopulatedTables(client, ['control_soa_assessments','control_health_scores','tenant_controls'], tenantId, period);
}

async function queryAuditActions(client, tenantId, period, formulaCode) {
  const severityFormula = formulaCode === 'F5_5_SEVERITY_INDEX';
  if (!severityFormula && await tableExists(client, 'action_plans')) {
    const timestamp = safeTimestampExpression('a');
    const updatesExist = await tableExists(client, 'action_plan_updates');
    const updateJoin = updatesExist ? `LEFT JOIN LATERAL (
         SELECT au.* FROM action_plan_updates au
         WHERE (to_jsonb(au)->>'tenant_id')::uuid=$1::uuid
           AND COALESCE(NULLIF(to_jsonb(au)->>'action_plan_id','')::uuid,NULLIF(to_jsonb(au)->>'plan_id','')::uuid)=a.id
         ORDER BY COALESCE(NULLIF(to_jsonb(au)->>'created_at','')::timestamptz,NULLIF(to_jsonb(au)->>'updated_at','')::timestamptz) DESC NULLS LAST
         LIMIT 1
       ) u ON true` : 'LEFT JOIN LATERAL (SELECT NULL::jsonb AS row_json) u ON false';
    const updateJson = updatesExist ? 'to_jsonb(u)' : "'{}'::jsonb";
    const result = await client.query(
      `SELECT a.*,
              COALESCE(NULLIF(${updateJson}->>'progress_percent','')::numeric,NULLIF(to_jsonb(a)->>'progress_percent','')::numeric,NULLIF(to_jsonb(a)->>'latest_progress_percent','')::numeric,NULLIF(to_jsonb(a)->>'progress','')::numeric) AS normalized_progress,
              COALESCE(NULLIF(${updateJson}->>'status_after',''),NULLIF(to_jsonb(a)->>'latest_status_after',''),NULLIF(to_jsonb(a)->>'status','')) AS normalized_status,
              COALESCE(NULLIF(to_jsonb(a)->>'opened_at','')::timestamptz,NULLIF(to_jsonb(a)->>'created_at','')::timestamptz) AS normalized_opened_at,
              COALESCE(NULLIF(to_jsonb(a)->>'closed_at','')::timestamptz,NULLIF(to_jsonb(a)->>'completed_at','')::timestamptz,NULLIF(${updateJson}->>'created_at','')::timestamptz) AS normalized_closed_at,
              COALESCE(NULLIF(to_jsonb(a)->>'due_at','')::timestamptz,NULLIF(to_jsonb(a)->>'due_date','')::timestamptz) AS normalized_due_at,
              COALESCE(NULLIF(${updateJson}->>'created_at','')::timestamptz,NULLIF(to_jsonb(a)->>'latest_update_at','')::timestamptz,${timestamp}) AS __event_time
       FROM action_plans a
       ${updateJoin}
       WHERE (to_jsonb(a)->>'tenant_id')::uuid=$1::uuid
         AND ($2::timestamptz IS NULL OR COALESCE(NULLIF(${updateJson}->>'created_at','')::timestamptz,NULLIF(to_jsonb(a)->>'latest_update_at','')::timestamptz,${timestamp})>=$2)
         AND ($3::timestamptz IS NULL OR COALESCE(NULLIF(${updateJson}->>'created_at','')::timestamptz,NULLIF(to_jsonb(a)->>'latest_update_at','')::timestamptz,${timestamp})<=$3)`,
      [tenantId, period.start || null, period.end || null]
    );
    return tagRows(result.rows.map((row) => ({ ...row, progress: row.normalized_progress, status: row.normalized_status, opened_at: row.normalized_opened_at, closed_at: row.normalized_closed_at, due_at: row.normalized_due_at })), 'action_plans');
  }
  const tables = severityFormula ? ['grc_readiness_findings', 'findings', 'action_plans'] : ['action_plans', 'findings', 'grc_readiness_findings'];
  const rows = await firstPopulatedTables(client, tables, tenantId, period);
  if (!rows || !severityFormula) return rows;
  return rows.map((row) => ({ ...row, status: row.status || 'open' }));
}

async function queryReadiness(client, tenantId, period) { return firstPopulatedTables(client, ['grc_readiness_results'], tenantId, period); }

async function queryHealth(client, tenantId, period) {
  const hasRuns = await tableExists(client, 'calculation_runs');
  const hasOutputs = await tableExists(client, 'calculation_outputs');
  if (!hasRuns || !hasOutputs) return null;
  const componentTimestamp = `COALESCE(cr.completed_at,cr.period_end,cr.started_at)`;
  const result = await client.query(
    `SELECT DISTINCT ON (cr.formula_code)
            co.id,cr.tenant_id,cr.formula_code,co.output_value,co.unit,cr.period_start,cr.period_end,cr.run_status,
            ${componentTimestamp} AS __event_time
     FROM calculation_runs cr
     JOIN calculation_outputs co ON co.run_id=cr.id AND co.tenant_id=cr.tenant_id AND co.output_name='value'
     WHERE cr.tenant_id=$1::uuid
       AND cr.run_status='calculated'
       AND cr.formula_code = ANY($4::text[])
       AND ($2::timestamptz IS NULL OR COALESCE(cr.period_end,cr.completed_at,cr.started_at)>=$2)
       AND ($3::timestamptz IS NULL OR COALESCE(cr.period_start,cr.started_at,cr.completed_at)<=$3)
     ORDER BY cr.formula_code, ${componentTimestamp} DESC NULLS LAST, cr.started_at DESC`,
    [tenantId, period.start || null, period.end || null, GRC_HEALTH_DEPENDENCY_FORMULAS]
  );
  return tagRows(result.rows, 'calculation_runs/calculation_outputs');
}

async function queryMaturity(client, tenantId, period) {
  const candidates = [];
  if (await tableExists(client, 'survey_evaluations')) {
    const timestamp = safeTimestampExpression('e');
    candidates.push({ table: 'survey_evaluations', params: [tenantId, period.start || null, period.end || null], sql:
      `SELECT e.id,(to_jsonb(e)->>'tenant_id')::uuid AS tenant_id,
              CASE
                WHEN NULLIF(to_jsonb(e)->>'level','')::numeric BETWEEN 0 AND 5 THEN NULLIF(to_jsonb(e)->>'level','')::numeric
                WHEN NULLIF(to_jsonb(e)->>'maturity_level','')::numeric BETWEEN 0 AND 5 THEN NULLIF(to_jsonb(e)->>'maturity_level','')::numeric
                WHEN NULLIF(to_jsonb(e)->>'score','')::numeric BETWEEN 0 AND 100 THEN NULLIF(to_jsonb(e)->>'score','')::numeric / 20.0
                ELSE NULL
              END AS level,
              COALESCE(NULLIF(to_jsonb(e)->>'weight','')::numeric,1) AS weight,
              COALESCE(NULLIF(to_jsonb(e)->>'evaluation_status',''),NULLIF(to_jsonb(e)->>'status',''),'evaluated') AS status,
              ${timestamp} AS __event_time
       FROM survey_evaluations e
       WHERE (to_jsonb(e)->>'tenant_id')::uuid=$1::uuid
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)` });
  }
  if (await tableExists(client, 'metric_measurements') && await tableExists(client, 'metric_definitions')) {
    const hasVersions = await tableExists(client, 'metric_definition_versions');
    const hasBindings = await tableExists(client, 'metric_source_bindings');
    const versionJoin = hasVersions ? `LEFT JOIN LATERAL (SELECT mdv.functional_code FROM metric_definition_versions mdv WHERE mdv.metric_definition_id=md.id AND mdv.status='published' ORDER BY mdv.tenant_id DESC NULLS LAST,mdv.version_number DESC LIMIT 1) mdv ON true` : '';
    const bindingJoin = hasBindings ? `LEFT JOIN LATERAL (SELECT msb.formula_code FROM metric_source_bindings msb WHERE msb.metric_definition_id=md.id AND msb.binding_status='published' ORDER BY msb.tenant_id DESC NULLS LAST,msb.version_number DESC LIMIT 1) msb ON true` : '';
    const maturityPredicate = [`md.metric_code='MATURITY'`, hasVersions ? `mdv.functional_code='MATURITY'` : null, hasBindings ? `msb.formula_code='F5_5_MATURITY'` : null].filter(Boolean).join(' OR ');
    const timestamp = `COALESCE(NULLIF(to_jsonb(mm)->>'calculated_at','')::timestamptz,NULLIF(to_jsonb(mm)->>'period_end','')::timestamptz,NULLIF(to_jsonb(mm)->>'created_at','')::timestamptz)`;
    candidates.push({ table: 'metric_measurements', params: [tenantId, period.start || null, period.end || null], sql:
      `SELECT mm.id,mm.tenant_id,COALESCE(mm.value_numeric,NULLIF(mm.value_text,'')::numeric) AS level,
              COALESCE(NULLIF(to_jsonb(mm)->'metadata'->>'weight','')::numeric,1) AS weight,
              COALESCE(mm.official_state,mm.quality_status,'calculated') AS status,${timestamp} AS __event_time
       FROM metric_measurements mm
       JOIN metric_definitions md ON md.id=mm.metric_definition_id
       ${versionJoin}
       ${bindingJoin}
       WHERE mm.tenant_id=$1::uuid AND (${maturityPredicate})
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)` });
  }
  if (await tableExists(client, 'grc_metric_measurements')) {
    const timestamp = safeTimestampExpression('gm');
    candidates.push({ table: 'grc_metric_measurements', params: [tenantId, period.start || null, period.end || null], sql:
      `SELECT gm.id,(to_jsonb(gm)->>'tenant_id')::uuid AS tenant_id,
              COALESCE(NULLIF(to_jsonb(gm)->>'level','')::numeric,NULLIF(to_jsonb(gm)->>'score','')::numeric,NULLIF(to_jsonb(gm)->>'numeric_value','')::numeric,NULLIF(to_jsonb(gm)->>'value_numeric','')::numeric) AS level,
              COALESCE(NULLIF(to_jsonb(gm)->>'weight','')::numeric,1) AS weight,
              COALESCE(NULLIF(to_jsonb(gm)->>'status',''),'calculated') AS status,${timestamp} AS __event_time
       FROM grc_metric_measurements gm
       WHERE (to_jsonb(gm)->>'tenant_id')::uuid=$1::uuid
         AND lower(COALESCE(to_jsonb(gm)->>'metric_code',to_jsonb(gm)->>'functional_code',to_jsonb(gm)->>'formula_code','')) IN ('maturity','f5_5_maturity')
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)` });
  }
  return firstPopulated(client, candidates);
}

async function queryIncidents(client, tenantId, period) {
  if (!(await tableExists(client, 'grc_incidents'))) return null;
  const timestamp = `COALESCE(NULLIF(to_jsonb(i)->>'reported_at','')::timestamptz,NULLIF(to_jsonb(i)->>'detected_at','')::timestamptz,NULLIF(to_jsonb(i)->>'created_at','')::timestamptz)`;
  const result = await client.query(
    `SELECT i.id,i.tenant_id,i.status,i.category,i.priority,
            COALESCE(NULLIF(to_jsonb(i)->>'confirmed_severity',''),NULLIF(to_jsonb(i)->>'calculated_severity',''),NULLIF(to_jsonb(i)->>'priority','')) AS severity,
            ${timestamp} AS __event_time,
            NULLIF(to_jsonb(i)->>'financial_impact','')::numeric AS financial_impact,
            NULLIF(to_jsonb(i)->>'duration_minutes','')::numeric AS duration_minutes,
            NULLIF(to_jsonb(i)->>'customer_impact','') AS customer_impact
     FROM grc_incidents i
     WHERE i.tenant_id=$1::uuid
       AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
       AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`,
    [tenantId, period.start || null, period.end || null]
  );
  return tagRows(result.rows, 'grc_incidents');
}

async function queryLossEvents(client, tenantId, period) {
  if (!(await tableExists(client, 'loss_events'))) return null;
  const rawEventTime = `COALESCE(NULLIF(to_jsonb(e)->>'event_date','')::timestamptz,NULLIF(to_jsonb(e)->>'occurred_at','')::timestamptz)`;
  const effectiveEventTime = `COALESCE(CASE WHEN ${rawEventTime} IS NOT NULL AND ${rawEventTime} <= now() THEN ${rawEventTime} END,NULLIF(to_jsonb(e)->>'created_at','')::timestamptz,NULLIF(to_jsonb(e)->>'updated_at','')::timestamptz,${rawEventTime})`;
  const result = await client.query(
    `SELECT e.id,e.tenant_id,COALESCE(NULLIF(to_jsonb(e)->>'status',''),'draft') AS status,NULLIF(to_jsonb(e)->>'currency','') AS currency,
            ${rawEventTime} AS raw_event_date,${effectiveEventTime} AS event_date,${effectiveEventTime} AS __event_time,
            COALESCE(NULLIF(to_jsonb(e)->>'gross_loss_amount','')::numeric,NULLIF(to_jsonb(e)->>'gross_loss','')::numeric) AS gross_loss_amount,
            COALESCE(NULLIF(to_jsonb(e)->>'recovery_amount','')::numeric,NULLIF(to_jsonb(e)->>'recoveries','')::numeric) AS recovery_amount,
            COALESCE(NULLIF(to_jsonb(e)->>'net_loss_amount','')::numeric,NULLIF(to_jsonb(e)->>'net_loss','')::numeric) AS net_loss_amount,
            CASE WHEN ${rawEventTime} IS NOT NULL AND ${rawEventTime} > now() THEN true ELSE false END AS raw_event_date_was_future
     FROM loss_events e
     WHERE e.tenant_id=$1::uuid
       AND COALESCE(NULLIF(to_jsonb(e)->>'status',''),'draft') NOT IN ('cancelled','rejected')
       AND ($2::timestamptz IS NULL OR ${effectiveEventTime}>=$2)
       AND ($3::timestamptz IS NULL OR ${effectiveEventTime}<=$3)`,
    [tenantId, period.start || null, period.end || null]
  );
  return tagRows(result.rows.map((row) => ({ ...row, __source_warnings: row.raw_event_date_was_future ? ['loss_events.occurred_at viene en el futuro; se usó created_at como fecha efectiva para el cálculo oficial.'] : [] })), 'loss_events');
}

async function queryContinuity(client, tenantId, period) {
  if (!(await tableExists(client, 'grc_continuity_tests'))) return null;
  const timestamp = `COALESCE(NULLIF(to_jsonb(t)->>'completed_at','')::timestamptz,NULLIF(to_jsonb(t)->>'scheduled_at','')::timestamptz,NULLIF(to_jsonb(t)->>'created_at','')::timestamptz)`;
  const status = `lower(COALESCE(NULLIF(to_jsonb(t)->>'status',''),'planned'))`;
  const result = await client.query(
    `SELECT t.id,t.tenant_id,
            CASE
              WHEN ${status} IN ('failed','failure') THEN 'failed'
              WHEN (NULLIF(to_jsonb(t)->>'target_rto_minutes','')::numeric IS NOT NULL AND NULLIF(to_jsonb(t)->>'observed_rto_minutes','')::numeric IS NOT NULL AND NULLIF(to_jsonb(t)->>'observed_rto_minutes','')::numeric > NULLIF(to_jsonb(t)->>'target_rto_minutes','')::numeric) THEN 'failed'
              WHEN (NULLIF(to_jsonb(t)->>'target_rpo_minutes','')::numeric IS NOT NULL AND NULLIF(to_jsonb(t)->>'observed_rpo_minutes','')::numeric IS NOT NULL AND NULLIF(to_jsonb(t)->>'observed_rpo_minutes','')::numeric > NULLIF(to_jsonb(t)->>'target_rpo_minutes','')::numeric) THEN 'failed'
              WHEN ${status} IN ('passed','pass','passed_with_observations','completed','successful') THEN 'within_sla'
              ELSE ${status}
            END AS status,
            NULLIF(to_jsonb(t)->>'target_rto_minutes','')::numeric / 60.0 AS rto_hours,
            NULLIF(to_jsonb(t)->>'observed_rto_minutes','')::numeric / 60.0 AS actual_recovery_hours,
            NULLIF(to_jsonb(t)->>'target_rpo_minutes','')::numeric / 60.0 AS rpo_hours,
            NULLIF(to_jsonb(t)->>'observed_rpo_minutes','')::numeric / 60.0 AS actual_data_loss_hours,
            ${timestamp} AS __event_time
     FROM grc_continuity_tests t
     WHERE t.tenant_id=$1::uuid
       AND NULLIF(to_jsonb(t)->>'completed_at','')::timestamptz IS NOT NULL
       AND ${status} NOT IN ('planned','draft','scheduled','cancelled')
       AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
       AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`,
    [tenantId, period.start || null, period.end || null]
  );
  return tagRows(result.rows, 'grc_continuity_tests');
}

async function queryAssurance(client, tenantId, period) {
  if (!(await tableExists(client, 'assurance_test_results'))) return null;
  const timestamp = safeTimestampExpression('r');
  const rawResult = `lower(COALESCE(NULLIF(to_jsonb(r)->>'result',''),NULLIF(to_jsonb(r)->>'status',''),NULLIF(to_jsonb(r)->>'outcome',''),'inconclusive'))`;
  const result = await client.query(
    `SELECT (to_jsonb(r)->>'id')::uuid AS id,(to_jsonb(r)->>'tenant_id')::uuid AS tenant_id,
            CASE WHEN ${rawResult}='passed' THEN 'pass' WHEN ${rawResult}='failed' THEN 'fail' ELSE ${rawResult} END AS result,
            COALESCE(NULLIF(to_jsonb(r)->>'weight','')::numeric,1) AS weight,${timestamp} AS __event_time
     FROM assurance_test_results r
     WHERE (to_jsonb(r)->>'tenant_id')::uuid=$1::uuid
       AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
       AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`,
    [tenantId, period.start || null, period.end || null]
  );
  return tagRows(result.rows, 'assurance_test_results');
}

async function querySupplier(client, tenantId, period) {
  if (!(await tableExists(client, 'grc_supplier_assessments'))) return null;
  const timestamp = `COALESCE(NULLIF(to_jsonb(a)->>'approved_at','')::timestamptz,NULLIF(to_jsonb(a)->>'submitted_at','')::timestamptz,NULLIF(to_jsonb(a)->>'updated_at','')::timestamptz,NULLIF(to_jsonb(a)->>'created_at','')::timestamptz)`;
  const result = await client.query(
    `SELECT a.id,a.tenant_id,a.supplier_id,a.status,
            NULLIF(to_jsonb(a)->>'compliance_score','')::numeric AS compliance_score,
            NULLIF(to_jsonb(a)->>'security_score','')::numeric AS security_score,
            NULLIF(to_jsonb(a)->>'dependency_score','')::numeric AS dependency_score,
            NULLIF(to_jsonb(a)->>'privacy_score','')::numeric AS privacy_score,
            NULLIF(to_jsonb(a)->>'resilience_score','')::numeric AS resilience_score,
            NULLIF(to_jsonb(a)->>'performance_score','')::numeric AS performance_score,
            NULLIF(to_jsonb(a)->>'assurance_score','')::numeric AS assurance_score,
            NULLIF(to_jsonb(a)->>'continuity_score','')::numeric AS continuity_score,
            NULLIF(to_jsonb(a)->>'incident_health_score','')::numeric AS incident_health_score,
            NULLIF(to_jsonb(a)->>'data_trust_score','')::numeric AS data_trust_score,
            NULLIF(to_jsonb(a)->>'score','')::numeric AS assessment_score,
            NULLIF(to_jsonb(a)->>'inherent_risk_score','')::numeric AS inherent_risk_score,
            NULLIF(to_jsonb(a)->>'residual_risk_score','')::numeric AS residual_risk_score,
            ${timestamp} AS __event_time
     FROM grc_supplier_assessments a
     WHERE a.tenant_id=$1::uuid
       AND lower(a.status) NOT IN ('draft','invited','in_progress','rejected','expired')
       AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
       AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)`,
    [tenantId, period.start || null, period.end || null]
  );
  return tagRows(result.rows, 'grc_supplier_assessments');
}

async function queryEvidenceFreshness(client, tenantId, period) {
  const candidates = [];
  if (await tableExists(client, 'evidences')) {
    const timestamp = `COALESCE(NULLIF(to_jsonb(e)->>'reviewed_at','')::timestamptz,NULLIF(to_jsonb(e)->>'updated_at','')::timestamptz,NULLIF(to_jsonb(e)->>'created_at','')::timestamptz)`;
    candidates.push({ table: 'evidences', params: [tenantId, period.start || null, period.end || null], sql:
      `SELECT e.id,e.tenant_id,COALESCE(NULLIF(to_jsonb(e)->>'status',''),'pending') AS status,
              NULLIF(to_jsonb(e)->>'validated','')::boolean AS validated,NULLIF(to_jsonb(e)->>'created_at','')::timestamptz AS created_at,
              NULLIF(to_jsonb(e)->>'reviewed_at','')::timestamptz AS reviewed_at,NULLIF(to_jsonb(e)->>'expires_at','')::timestamptz AS expires_at,
              ${timestamp} AS __event_time,NULLIF(to_jsonb(e)->>'freshness_score','')::numeric AS freshness_score,NULLIF(to_jsonb(e)->>'appears_expired','')::boolean AS appears_expired
       FROM evidences e WHERE e.tenant_id=$1::uuid
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)` });
  }
  if (await tableExists(client, 'grc_evidence_versions')) {
    const submissionsExist = await tableExists(client, 'grc_evidence_submissions');
    const reviewsExist = await tableExists(client, 'grc_evidence_reviews');
    const submissionJoin = submissionsExist ? `LEFT JOIN grc_evidence_submissions s ON s.tenant_id=v.tenant_id AND s.id=v.submission_id` : '';
    const reviewJoin = reviewsExist ? `LEFT JOIN LATERAL (SELECT r.decision,r.created_at FROM grc_evidence_reviews r WHERE r.tenant_id=v.tenant_id AND r.submission_id=v.submission_id ORDER BY r.created_at DESC NULLS LAST LIMIT 1) r ON true` : '';
    const statusExpression = submissionsExist ? `COALESCE(NULLIF(to_jsonb(s)->>'status',''),'submitted')` : `'submitted'`;
    const validatedExpression = reviewsExist ? `CASE WHEN lower(COALESCE(NULLIF(to_jsonb(r)->>'decision',''),''))='approved' THEN true WHEN lower(COALESCE(NULLIF(to_jsonb(r)->>'decision',''),'')) IN ('rejected','reopened') THEN false ELSE NULL END` : `NULL::boolean`;
    const reviewedAtExpression = reviewsExist ? `NULLIF(to_jsonb(r)->>'created_at','')::timestamptz` : `NULL::timestamptz`;
    const timestamp = `COALESCE(${reviewedAtExpression},NULLIF(to_jsonb(v)->>'created_at','')::timestamptz)`;
    candidates.push({ table: 'grc_evidence_versions', params: [tenantId, period.start || null, period.end || null], sql:
      `SELECT v.id,v.tenant_id,${statusExpression} AS status,${validatedExpression} AS validated,v.created_at,${reviewedAtExpression} AS reviewed_at,NULL::timestamptz AS expires_at,${timestamp} AS __event_time,NULL::numeric AS freshness_score,false AS appears_expired
       FROM grc_evidence_versions v ${submissionJoin} ${reviewJoin}
       WHERE v.tenant_id=$1::uuid
         AND ($2::timestamptz IS NULL OR ${timestamp}>=$2)
         AND ($3::timestamptz IS NULL OR ${timestamp}<=$3)` });
  }
  return firstPopulated(client, candidates);
}

const ADAPTER_BY_SOURCE = Object.freeze({
  compliance_requirements_assessments: queryCompliance,
  grc_readiness_operational_snapshot: queryReadiness,
  risk_register_controls: queryRisk,
  control_assurance_evidence: queryControls,
  audit_findings_actions: queryAuditActions,
  incident_operational_events: queryIncidents,
  evidence_freshness_records: queryEvidenceFreshness,
  loss_events_operational: queryLossEvents,
  continuity_resilience_tests: queryContinuity,
  assurance_test_results: queryAssurance,
  supplier_tprm_assessments: querySupplier,
  grc_health_components: queryHealth,
  maturity_assessments: queryMaturity,
});

async function queryOperationalRows({ client, contract, tenantId, period = {}, formulaCode = null }) {
  const adapter = ADAPTER_BY_SOURCE[contract.source_code];
  if (adapter) {
    const rows = await adapter(client, tenantId, period, formulaCode);
    return rows === null ? { rows: [], unavailable: true, reason: `No existen tablas operacionales para ${contract.source_code}.` } : { rows, unavailable: false, reason: null };
  }
  const rows = await firstPopulatedTables(client, contract.tables || [], tenantId, period);
  return rows === null ? { rows: [], unavailable: true, reason: `No existen tablas operacionales para ${contract.source_code}.` } : { rows, unavailable: false, reason: null };
}

function mapFormulaInput(formulaCode, rows) {
  const first = rows[0] || {};
  const statuses = rows.map((row) => String(row.status || '').toLowerCase());
  const severities = rows.map((row) => String(row.severity ?? row.risk_level ?? row.level ?? row.status ?? '').toLowerCase());
  const usableScores = rows.map((row) => number(row.score)).filter((value) => value !== null);

  if (formulaCode === 'F5_5_COMPLIANCE_WEIGHTED') return { assessments: rows.map((row) => ({ status: row.status, weight: number(row.weight, 1), notApplicable: ['not_applicable', 'na'].includes(String(row.status)) })) };
  if (formulaCode === 'F5_5_COVERAGE') return { evaluated: statuses.filter((status) => !['pending', 'not_evaluated', 'draft', ''].includes(status)).length, applicable: statuses.filter((status) => !['not_applicable', 'na'].includes(status)).length };
  if (formulaCode === 'F5_5_READINESS') { const by = Object.fromEntries(rows.map((row) => [String(row.dimension || '').toLowerCase(), ratio(row.score)])); return { compliance: by.compliance, evidence: by.evidence, health: by.health, actions: by.actions }; }
  if (formulaCode === 'F5_5_INHERENT_RISK') return riskInherentPortfolio(rows).input;
  if (formulaCode === 'F5_5_RESIDUAL_RISK') {
    const inherentScores = rows.map((row) => {
      const direct = number(row.exposure ?? row.inherent_risk_score);
      if (direct !== null) return direct;
      const probability = number(row.probability ?? row.likelihood);
      const impact = number(row.impact);
      return probability !== null && impact !== null ? probability * impact : null;
    }).filter((value) => value !== null);
    const controlEffectiveness = average(rows.map((row) => row.control_effectiveness ?? row.control_effectiveness_score ?? row.assurance_score ?? row.control_score ?? row.effectiveness_score));
    return { inherentRisk: average(inherentScores), controlEffectiveness: ratio(controlEffectiveness) };
  }
  if (formulaCode === 'F5_5_FMEA_RPN') return { severity: number(first.impact), occurrence: number(first.occurrence ?? first.probability), detection: number(first.detection) };
  if (formulaCode === 'F5_5_COMBINED_EFFECTIVENESS') return { effectivenesses: usableScores.map(ratio).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_CONTROL_EFFECTIVENESS') return { design: ratio(first.design_score ?? first.design_effectiveness), implementation: ratio(first.implementation_score ?? first.implementation_effectiveness), operation: ratio(first.operation_score ?? first.operation_effectiveness ?? first.operating_effectiveness), evidence: ratio(first.evidence_score ?? first.evidence_effectiveness) };
  if (formulaCode === 'F5_5_CONTROL_COVERAGE') return { risksWithControl: rows.filter((row) => number(row.score) !== null || number(row.control_effectiveness ?? row.control_effectiveness_score) !== null).length, relevantRisks: rows.length };
  if (formulaCode === 'F5_5_FREQUENCY_COMPLIANCE') return { onTimeExecutions: statuses.filter((status) => ['effective', 'completed', 'on_time', 'compliant'].includes(status)).length, scheduledExecutions: rows.length };
  if (formulaCode === 'F5_5_FAILURE_RATE') return { failedTests: statuses.filter((status) => ['fail', 'failed', 'non_compliant'].includes(status)).length, executedTests: rows.length };
  if (formulaCode === 'F5_5_SEVERITY_INDEX') return { low: severities.filter((severity) => severity === 'low').length, medium: severities.filter((severity) => severity === 'medium').length, high: severities.filter((severity) => severity === 'high').length, critical: severities.filter((severity) => severity === 'critical').length };
  if (['F5_5_MTTC', 'F5_5_AGE', 'F5_5_WEIGHTED_PROGRESS'].includes(formulaCode)) return { items: rows.map((row) => { const progressValue = number(row.progress ?? row.progress_percent ?? row.latest_progress_percent); return { openedAt: row.opened_at ?? row.created_at, closedAt: row.closed_at ?? row.completed_at, dueAt: row.due_at ?? row.due_date, createdAt: row.opened_at ?? row.created_at, progress: progressValue === null ? null : (progressValue > 1 ? progressValue / 100 : progressValue), weight: number(row.weight, 1), status: row.status ?? row.latest_status_after }; }).filter((item) => formulaCode === 'F5_5_WEIGHTED_PROGRESS' ? item.progress !== null : item.createdAt), now: new Date().toISOString() };
  if (formulaCode === 'F5_5_CLOSURE_RATE') return { closed: statuses.filter((status) => ['closed', 'completed', 'resolved'].includes(status)).length, openAtStart: statuses.filter((status) => !['closed', 'completed', 'resolved'].includes(status)).length, created: 0 };
  if (formulaCode === 'F5_5_OVERDUE_RATE') { const open = rows.filter((row) => !['closed', 'completed', 'resolved'].includes(String(row.status ?? row.latest_status_after).toLowerCase())); return { overdueOpen: open.filter((row) => (row.due_at ?? row.due_date) && new Date(row.due_at ?? row.due_date) < new Date()).length, openActions: open.length, items: open.map((row) => ({ overdue: (row.due_at ?? row.due_date) && new Date(row.due_at ?? row.due_date) < new Date() ? 1 : 0, weight: number(row.weight, 1) })) }; }
  const grossLossValue = (row) => number(row.gross_loss_amount ?? row.gross_loss);
  const recoveryValue = (row) => number(row.recovery_amount ?? row.recoveries);
  const netLossValue = (row) => { const direct = number(row.net_loss_amount ?? row.net_loss); if (direct !== null) return direct; const gross = grossLossValue(row); const recovery = recoveryValue(row); return gross !== null && recovery !== null ? gross - recovery : null; };
  if (formulaCode === 'F5_5_EXPECTED_LOSS') return { probability: number(first.probability), impact: number(first.impact ?? first.gross_loss_amount ?? first.gross_loss) };
  if (formulaCode === 'F5_5_NET_LOSS') return { grossLoss: sum(rows.map(grossLossValue)), recoveries: sum(rows.map(recoveryValue)) };
  if (formulaCode === 'F5_5_LOSS_SEVERITY') return { netLosses: rows.map(netLossValue).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_PARAMETRIC_VAR') { const losses = rows.map(netLossValue).filter((value) => value !== null); const mean = average(losses); const variance = mean === null || losses.length < 2 ? null : losses.reduce((total, value) => total + ((value - mean) ** 2), 0) / (losses.length - 1); return { mean, z: 1.65, sigma: variance === null ? null : Math.sqrt(variance) }; }
  if (formulaCode === 'F5_5_MONTE_CARLO') { const losses = rows.map(netLossValue).filter((value) => value !== null); return losses.length ? { iterations: 1000, seed: 42, frequency: { type: 'poisson', lambda: Math.max(0.01, losses.length / 12) }, severity: { type: 'fixed', value: average(losses) }, threshold: Math.max(...losses) } : null; }
  if (formulaCode === 'F5_5_AVAILABILITY') return { totalTime: number(first.total_time ?? first.totalTime), downtime: number(first.downtime ?? first.downtime_hours), mtbf: number(first.mtbf), mttr: number(first.mttr) };
  if (formulaCode === 'F5_5_MTBF') return { operatingTime: number(first.operating_time ?? first.total_time), failures: number(first.failures ?? rows.filter((row) => ['failed', 'failure'].includes(String(row.status))).length) };
  if (formulaCode === 'F5_5_MTTR') return { repairTimes: rows.map((row) => number(row.repair_time ?? row.actual_recovery_hours)).filter((value) => value !== null) };
  if (formulaCode === 'F5_5_SLA_COMPLIANCE') return { withinSla: rows.filter((row) => ['pass', 'passed', 'passed_with_observations', 'compliant', 'within_sla', 'completed'].includes(String(row.status).toLowerCase())).length, applicableCases: rows.length };
  if (formulaCode === 'F5_5_RTO_GAP') return { recoveryActual: number(first.actual_recovery_hours ?? first.recovery_actual), rtoObjective: number(first.rto_hours ?? first.rto_objective) };
  if (formulaCode === 'F5_5_RPO_GAP') return { dataLossActual: number(first.actual_data_loss_hours ?? first.data_loss_actual), rpoObjective: number(first.rpo_hours ?? first.rpo_objective) };
  if (formulaCode === 'F5_5_ASSET_CRITICALITY') return { confidentiality: number(first.confidentiality), integrity: number(first.integrity), availability: number(first.availability), legal: number(first.legal ?? first.legal_impact) };
  if (formulaCode === 'F5_5_SUPPLIER_RISK') return { compliance: number(first.compliance_score), security: number(first.security_score), dependency: number(first.dependency_score), privacy: number(first.privacy_score), resilience: number(first.resilience_score) };
  if (formulaCode === 'F5_C3_SUPPLIER_HEALTH') {
    const riskInputs=[first.compliance_score,first.security_score,first.dependency_score,first.privacy_score,first.resilience_score].map((value)=>number(value)).filter((value)=>value!==null);
    const supplierRisk=riskInputs.length===5?average(riskInputs):null;
    return { riskHealth:supplierRisk===null?null:Math.max(0,100-(supplierRisk<=5?supplierRisk*20:supplierRisk)),performance:score(first.performance_score),assurance:score(first.assurance_score),continuity:score(first.continuity_score??first.resilience_score),incidentHealth:score(first.incident_health_score),dataTrust:score(first.data_trust_score) };
  }
  if (formulaCode === 'F5_5_SURVEY_SCORE') return { items: rows.map((row) => ({ score: number(row.score), maxScore: number(row.max_score), weight: number(row.weight, 1), notApplicable: ['not_applicable', 'na'].includes(String(row.status)) })).filter((item) => item.score !== null && item.maxScore !== null) };
  if (formulaCode === 'F5_5_RESPONSE_RATE') return { completedResponses: statuses.filter((status) => ['completed', 'submitted', 'approved'].includes(status)).length, validInvitations: rows.length };
  if (formulaCode === 'F5_5_DROPOUT_RATE') return { started: rows.length, completed: statuses.filter((status) => ['completed', 'submitted', 'approved'].includes(status)).length };
  if (formulaCode === 'F5_5_ASSURANCE_SCORE') return { results: rows.map((row) => ({ result: row.result || row.status, weight: number(row.weight, 1) })) };
  if (formulaCode === 'F5_5_SAMPLE_SIZE') return { z: 1.96, p: 0.5, e: 0.05, population: rows.length };
  if (formulaCode === 'F5_5_COMPLETENESS') return { validRequired: sum(rows.map((row) => row.valid_count)), expectedRequired: sum(rows.map((row) => row.expected_count)) };
  if (formulaCode === 'F5_5_ACCURACY') return { verifiedCorrect: sum(rows.map((row) => row.valid_count)), verified: sum(rows.map((row) => number(row.valid_count, 0) + number(row.invalid_count, 0))) };
  if (formulaCode === 'F5_5_CONSISTENCY') return { contradictory: sum(rows.map((row) => row.invalid_count)), evaluated: sum(rows.map((row) => number(row.valid_count, 0) + number(row.invalid_count, 0))) };
  if (formulaCode === 'F5_5_FRESHNESS_CONTINUOUS') {
    const scored = rows.map((row) => number(row.freshness_score)).filter((value) => value !== null);
    if (scored.length) return { ageHours: Math.max(0, (100 - average(scored)) / 100) * 24 * 30, halfLifeHours: 24 * 30 };
    const approvedRows = rows.filter((row) => row.validated === true || ['approved', 'aprobada', 'accepted', 'valid'].includes(String(row.status || '').toLowerCase()));
    const effectiveRows = approvedRows.length ? approvedRows : rows;
    const effectiveDates = effectiveRows.flatMap((row) => [row.expires_at, row.reviewed_at, row.updated_at, row.created_at, row.__event_time]).filter(Boolean);
    const latest = effectiveDates.length ? Math.max(...effectiveDates.map((date) => new Date(date).getTime()).filter(Number.isFinite)) : null;
    return { ageHours: latest === null ? null : Math.max(0, (Date.now() - latest) / 3600000), halfLifeHours: 24 * 30 };
  }
  if (formulaCode === 'F5_5_LINEAGE_SCORE') return { presentRelations: rows.length, requiredRelations: rows.length || null };
  if (formulaCode === 'F5_5_GRC_HEALTH') { const values = {}; for (const row of rows) { const raw = row.output_value?.value ?? row.output_value; const value = ratio(raw); if (row.formula_code === 'F5_5_RESIDUAL_RISK') values.risk = value === null ? null : 1 - value; if (row.formula_code === 'F5_5_COMPLIANCE_WEIGHTED') values.compliance = value; if (row.formula_code === 'F5_5_WEIGHTED_PROGRESS') values.actions = value; if (row.formula_code === 'F5_5_FRESHNESS_CONTINUOUS') values.evidence = value; if (row.formula_code === 'F5_C3_DATA_TRUST') values.dataTrust = value; } return values; }
  if (formulaCode === 'F5_C3_OPERATIONAL_PERFORMANCE') { const by={};for(const row of rows){const value=score(row.output_value?.value??row.output_value);if(value!==null)by[row.formula_code]=value;}const risk=by.F5_5_RESIDUAL_RISK===undefined?null:Math.max(0,100-by.F5_5_RESIDUAL_RISK);return {efficacy:by.F5_5_COMPLIANCE_WEIGHTED??null,efficiency:by.F5_5_WEIGHTED_PROGRESS??null,stability:risk,quality:by.F5_5_CONTROL_EFFECTIVENESS??null,timeliness:by.F5_5_SLA_COMPLIANCE??null,risk,compliance:by.F5_5_COMPLIANCE_WEIGHTED??null,actions:by.F5_5_WEIGHTED_PROGRESS??null,dataTrust:by.F5_C3_DATA_TRUST??null}; }
  if (formulaCode === 'F5_C3_DATA_TRUST') { const dimensions=['completeness','accuracy','consistency','freshness','lineage','validation','stability','coverage'];return Object.fromEntries(dimensions.map((dimension)=>[dimension,average(rows.map((row)=>row.dimensions?.[dimension]?.score))])); }
  if (formulaCode === 'F5_5_MATURITY') return maturityPortfolio(rows).input;
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
  if (!contract) return sourceUnavailable(resolvedSourceCode, 'No existe contrato de fuente para la fórmula.', { missing_entities: ['source_contract'] });
  if (contract.availability === 'source_unavailable') return sourceUnavailable(contract.source_code, contract.limitations || 'Fuente no disponible.', contract);
  let queried;
  try { queried = await queryOperationalRows({ client, contract, tenantId, period, formulaCode }); }
  catch (error) { const wrapped = new MathGovernanceError('SOURCE_SCHEMA_INCOMPATIBLE', 'La estructura física de la fuente no coincide con el contrato analítico.', { source_code: contract.source_code, original_code: error.code || null }); wrapped.cause = error; throw wrapped; }
  if (queried.unavailable) return sourceUnavailable(contract.source_code, queried.reason, contract);
  const rows = normalizeRows(queried.rows, contract);
  const validation = validateDataset({ rows, tenantId, period, timezone, unit: contract.unit, requiredFields: contract.required_fields, minimumSampleSize: formula.minimum_sample_size || 1, sourceKey: contract.source_code, allowedStates: contract.status_filter?.allowed || null });
  const formulaMapping = formulaCode === 'F5_5_INHERENT_RISK' ? riskInherentPortfolio(validation.usable_rows) : formulaCode === 'F5_5_SEVERITY_INDEX' ? severityPortfolio(validation.usable_rows) : formulaCode === 'F5_5_MATURITY' ? maturityPortfolio(validation.usable_rows) : null;
  const formulaRows = formulaMapping ? formulaMapping.usableRows : validation.usable_rows;
  let formulaInput = formulaMapping ? formulaMapping.input : mapFormulaInput(formulaCode, validation.usable_rows);
  const formulaExclusions = formulaMapping ? [...validation.exclusions, ...formulaMapping.exclusions] : validation.exclusions;
  const resolverWarnings = [];

  if (formulaCode === 'F5_5_CONTROL_EFFECTIVENESS' && formulaRows.length) {
    const mappedDimensions = [formulaInput?.design, formulaInput?.implementation, formulaInput?.operation, formulaInput?.evidence];
    const dimensionFields = ['design_score', 'design_effectiveness', 'implementation_score', 'implementation_effectiveness', 'operation_score', 'operation_effectiveness', 'operating_effectiveness', 'evidence_score', 'evidence_effectiveness'];
    const hasAnyDimension = formulaRows.some((row) => dimensionFields.some((field) => number(row[field]) !== null));
    const aggregateScores = formulaRows.map((row) => ratio(row.score)).filter((value) => value !== null);
    if (mappedDimensions.every((value) => value === null) && !hasAnyDimension && aggregateScores.length) {
      const composite = average(aggregateScores);
      formulaInput = { design: composite, implementation: composite, operation: composite, evidence: composite };
      resolverWarnings.push('F5_5_CONTROL_EFFECTIVENESS usó el score oficial agregado de assurance como medida compuesta porque la fuente no publica dimensiones D/I/O/E separadas.');
    }
  }

  let formulaCounts = { received: rows.length, usable: formulaRows.length, excluded: Math.max(0, rows.length - formulaRows.length) };
  if (formulaCode === 'F5_5_INHERENT_RISK') {
    const ineligible = Math.max(0, rows.length - formulaRows.length);
    formulaCounts = {
      received: formulaRows.length,
      usable: formulaRows.length,
      excluded: 0,
      raw_received: rows.length,
      ineligible,
    };
    if (formulaInput) {
      formulaInput.population_size = formulaRows.length;
      formulaInput.raw_population_size = rows.length;
    }
    if (ineligible > 0) resolverWarnings.push(`${ineligible} fila(s) físicas de riesgo quedaron fuera de la población elegible por no cumplir el contrato de ejes 1..5; las exclusiones permanecen auditables.`);
  }

  const physicalSources = [...new Set(rows.map((row) => row.__physical_source).filter(Boolean))];
  const sourceWarnings = [...new Set(rows.flatMap((row) => Array.isArray(row.__source_warnings) ? row.__source_warnings : []))];
  const sourceSnapshot = { source_code: contract.source_code, physical_sources: physicalSources, formula_code: formula.formula_code, contract_checksum: contract.checksum, row_count: formulaCounts.received, raw_row_count: rows.length, usable_rows: formulaCounts.usable, exclusions: formulaCounts.excluded, ineligible_rows: formulaCounts.ineligible || 0, exclusion_issue_count: formulaExclusions.length, aggregation_method: formulaCode === 'F5_5_INHERENT_RISK' ? 'arithmetic_mean' : undefined, period, timezone };
  const snapshotHash = hash(sourceSnapshot);
  const resolutionStatus = formulaCounts.usable ? (resolverWarnings.length || formulaExclusions.length ? 'validated_with_warnings' : validation.status) : 'empty_dataset';
  return { source_code: contract.source_code, physical_sources: physicalSources, status: resolutionStatus, rows: formulaRows, warnings: [...sourceWarnings, ...validation.warnings, ...resolverWarnings], exclusions: formulaExclusions, invalid_rows: validation.invalid_rows, counts: formulaCounts, inputHash: validation.hash, input_hash: validation.hash, source_snapshot: sourceSnapshot, source_snapshot_hash: snapshotHash, lineage: buildLineage({ rows: formulaRows, contract, formula, runId, snapshotHash }), formula_input: formulaInput, equivalence: contract.variable_map, contract };
}

async function resolveFormulaSources(args) { return resolveFormulaSource(args); }
module.exports = { SOURCE_STATES, buildSourceContract, sourceUnavailable, listSourceContracts, listFormulaSourceBindings, resolveFormulaSource, resolveFormulaSources, getSourceContract, tableExists, mapFormulaInput, queryOperationalRows, firstPopulated, firstPopulatedTables };