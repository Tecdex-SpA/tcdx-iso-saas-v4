'use strict';

const pool = require('../../config/db');
const { FORMULAS, OfficialFormulaRegistry } = require('./formulaRegistry.service');
const { resolveFormulaSource } = require('./sourceResolver.service');
const { buildDecision, numeric } = require('./decisionInterpretation.service');
const phase5Service = require('../phase5/phase5.service');

const SOURCE_DATASET_SNAPSHOT_TYPE = 'source_dataset';
const FUNCTIONAL_FAILURE_CODES = Object.freeze({
  insufficient_data: 'Datos insuficientes',
  dependency_pending: 'Dependencia pendiente',
  source_incompatible: 'Fuente incompatible',
  technical_error: 'Error técnico',
});

class OfficialCalculationOrchestratorError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'OfficialCalculationOrchestratorError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function tenantIdFrom(scope) {
  const tenantId = scope?.tenant_id || scope?.tenantId || scope?.tenant;
  if (!tenantId) throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALC_TENANT_REQUIRED', 'Se requiere una empresa activa para recalcular.', 403);
  return String(tenantId);
}

function actorIdFrom(scope) {
  return scope?.user?.user_id || scope?.user?.userId || scope?.user?.id || null;
}

function normalizePeriod(period = {}) {
  const start = period.start || period.period_start || null;
  const end = period.end || period.period_end || null;
  if (start && Number.isNaN(new Date(start).getTime())) throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALC_PERIOD_INVALID', 'Fecha inicial inválida.', 422);
  if (end && Number.isNaN(new Date(end).getTime())) throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALC_PERIOD_INVALID', 'Fecha final inválida.', 422);
  if (start && end && new Date(start) > new Date(end)) throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALC_PERIOD_INVALID', 'La fecha inicial no puede ser posterior a la fecha final.', 422);
  return { start, end, timezone: period.timezone || 'America/Santiago' };
}

const FORMULA_PRIORITY = Object.freeze({
  F5_5_COMPLIANCE_WEIGHTED: 5,
  F5_5_COVERAGE: 6,
  F5_5_INHERENT_RISK: 7,
  F5_5_RESIDUAL_RISK: 8,
  F5_5_WEIGHTED_PROGRESS: 9,
  F5_5_EVIDENCE_QUALITY: 10,
  F5_5_COMPLETENESS: 11,
  F5_5_READINESS: 90,
  F5_5_GRC_HEALTH: 100,
});

function selectedFormulas(body = {}) {
  const requested = Array.isArray(body.formula_codes) ? new Set(body.formula_codes.map(String)) : null;
  const domain = body.domain ? String(body.domain) : null;
  return FORMULAS.filter((formula) => formula.status === 'published')
    .filter((formula) => !requested || requested.has(formula.formula_code))
    .filter((formula) => !domain || formula.category === domain)
    .sort((a, b) => (FORMULA_PRIORITY[a.formula_code] || 20) - (FORMULA_PRIORITY[b.formula_code] || 20));
}

function summarize(results) {
  return results.reduce((summary, item) => {
    summary.total += 1;
    summary[item.status] = (summary[item.status] || 0) + 1;
    if (item.failure_type) summary.failure_types[item.failure_type] = (summary.failure_types[item.failure_type] || 0) + 1;
    return summary;
  }, {
    total: 0,
    calculated: 0,
    unmeasured: 0,
    source_unavailable: 0,
    not_applicable: 0,
    failed: 0,
    dependency_pending: 0,
    source_incompatible: 0,
    failure_types: {},
  });
}

function functionalFailure({ formula, sourceContext = {}, status, failureType, code, message, warnings = [] }) {
  return {
    formula_code: formula.formula_code,
    display_name: formula.display_name,
    domain: formula.category,
    status,
    failure_type: failureType,
    failure_label: FUNCTIONAL_FAILURE_CODES[failureType] || FUNCTIONAL_FAILURE_CODES.technical_error,
    code,
    message,
    error: message,
    warnings,
    ...sourceContext,
  };
}

function enrichDependencies(formulaCode, input, calculatedByCode) {
  const enriched = { ...(input || {}) };
  if (formulaCode === 'F5_5_READINESS') {
    if (enriched.compliance === null || enriched.compliance === undefined) {
      const coverage = calculatedByCode.get('F5_5_COVERAGE') ?? calculatedByCode.get('F5_5_COMPLIANCE_WEIGHTED');
      if (coverage !== undefined) enriched.compliance = Number(coverage) > 1 ? Number(coverage) / 100 : Number(coverage);
    }
    const missing = ['compliance', 'evidence', 'health', 'actions'].filter((key) => enriched[key] === null || enriched[key] === undefined);
    if (missing.length) return { input: enriched, missing };
  }
  if (formulaCode === 'F5_5_RESIDUAL_RISK' && (enriched.inherentRisk === null || enriched.inherentRisk === undefined)) {
    const inherent = calculatedByCode.get('F5_5_INHERENT_RISK');
    if (inherent !== undefined) enriched.inherentRisk = inherent;
  }
  if (formulaCode === 'F5_5_GRC_HEALTH') {
    const dependencyMap = {
      compliance: 'F5_5_COMPLIANCE_WEIGHTED',
      actions: 'F5_5_WEIGHTED_PROGRESS',
      evidence: 'F5_5_EVIDENCE_QUALITY',
      dataTrust: 'F5_5_COMPLETENESS',
      risk: 'F5_5_RESIDUAL_RISK',
    };
    for (const [key, dependencyCode] of Object.entries(dependencyMap)) {
      if (enriched[key] === null || enriched[key] === undefined) {
        const raw = calculatedByCode.get(dependencyCode);
        if (raw !== undefined) {
          const value = Number(raw);
          enriched[key] = key === 'risk' ? Math.max(0, 1 - (value > 1 ? value / 100 : value)) : (value > 1 ? value / 100 : value);
        }
      }
    }
    const missing = ['compliance', 'actions', 'evidence', 'dataTrust', 'risk'].filter((key) => enriched[key] === null || enriched[key] === undefined);
    if (missing.length) return { input: enriched, missing };
  }
  return { input: enriched, missing: [] };
}

function classifyError(error) {
  const code = String(error?.code || 'OFFICIAL_RECALC_FORMULA_FAILED');
  const message = String(error?.message || error || 'Error procesando la fórmula.').slice(0, 320);
  if (['FORMULA_VARIABLE_REQUIRED', 'FORMULA_ZERO_DENOMINATOR', 'FORMULA_DIVISION_BY_ZERO', 'FORMULA_ZERO_WEIGHTS', 'AVAILABILITY_METHOD_REQUIRED'].includes(code)) {
    return { status: 'unmeasured', failureType: 'insufficient_data', code, message };
  }
  if (['42703', '42P01', '42883', '22P02', 'SOURCE_SCHEMA_INCOMPATIBLE'].includes(code) || /column .* does not exist|relation .* does not exist|invalid input syntax/i.test(message)) {
    return { status: 'source_incompatible', failureType: 'source_incompatible', code, message: 'La fuente operacional existe, pero su estructura no es compatible con el contrato analítico vigente.' };
  }
  return { status: 'failed', failureType: 'technical_error', code, message: 'Ocurrió un error técnico al procesar la fórmula. El detalle quedó registrado para soporte.' };
}

async function assertSnapshotContract(client) {
  const result = await client.query(`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    WHERE t.relname='calculation_snapshots'
      AND c.conname='calculation_snapshots_snapshot_type_check'
    LIMIT 1`);
  const definition = String(result.rows[0]?.definition || '');
  if (definition && !definition.includes(SOURCE_DATASET_SNAPSHOT_TYPE)) {
    throw new OfficialCalculationOrchestratorError('SNAPSHOT_TYPE_CONTRACT_MISMATCH', `La base de datos no admite snapshot_type=${SOURCE_DATASET_SNAPSHOT_TYPE}. Ejecute la migración oficial.`, 500);
  }
}

async function persistSourceSnapshot(client, tenantId, source, persisted) {
  if (!persisted?.calculation_run_id || !source?.source_snapshot_hash) return null;
  const tables = await client.query(`SELECT to_regclass('public.calculation_snapshots') AS snapshots, to_regclass('public.official_formula_source_contracts') AS contracts`);
  if (!tables.rows[0]?.snapshots) return null;
  await assertSnapshotContract(client);
  let sourceContractId = null;
  if (tables.rows[0]?.contracts) {
    const contract = await client.query(`SELECT id FROM official_formula_source_contracts WHERE tenant_id IS NULL AND source_code=$1 AND status='published' ORDER BY version_number DESC LIMIT 1`, [source.source_code]);
    sourceContractId = contract.rows[0]?.id || null;
  }
  const snapshot = await client.query(
    `INSERT INTO calculation_snapshots (tenant_id, run_id, source_contract_id, snapshot_type, snapshot_hash, row_count, payload, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,$8::jsonb)
     RETURNING id`,
    [tenantId, persisted.calculation_run_id, sourceContractId, SOURCE_DATASET_SNAPSHOT_TYPE, source.source_snapshot_hash, Number(source.counts?.usable || 0), JSON.stringify(source.source_snapshot || {}), JSON.stringify({ source_code: source.source_code, physical_sources: source.physical_sources || [], exclusions: source.exclusions || [] })]
  );
  await client.query(`UPDATE calculation_runs SET source_contract_id=COALESCE($3::uuid,source_contract_id), source_snapshot_hash=$4 WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, persisted.calculation_run_id, sourceContractId, source.source_snapshot_hash]);
  return snapshot.rows[0]?.id || null;
}

async function previousValue(client, tenantId, formulaCode, periodStart) {
  try {
    const result = await client.query(
      `SELECT co.output_value
       FROM calculation_runs cr
       JOIN calculation_outputs co ON co.run_id=cr.id AND co.tenant_id=cr.tenant_id
       WHERE cr.tenant_id=$1::uuid AND cr.formula_code=$2 AND cr.run_status='calculated'
         AND ($3::timestamptz IS NULL OR cr.period_end IS NULL OR cr.period_end < $3::timestamptz)
       ORDER BY cr.completed_at DESC NULLS LAST, cr.started_at DESC
       LIMIT 1`,
      [tenantId, formulaCode, periodStart || null]
    );
    const raw = result.rows[0]?.output_value;
    return numeric(raw?.value ?? raw);
  } catch {
    return null;
  }
}

async function recalculateOfficialAnalytics(scope, body = {}, requestId = null, dependencies = {}) {
  const tenantId = tenantIdFrom(scope);
  const period = normalizePeriod(body.period || {});
  const formulas = selectedFormulas(body);
  if (!formulas.length) throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALC_EMPTY_SCOPE', 'No hay fórmulas publicadas para el alcance solicitado.', 422);

  const client = dependencies.client || pool;
  const resolver = dependencies.resolveFormulaSource || resolveFormulaSource;
  const registry = dependencies.registry || new OfficialFormulaRegistry();
  const persist = dependencies.persistOfficialCalculation || phase5Service.persistOfficialCalculation;
  const persistSnapshot = dependencies.persistSourceSnapshot || persistSourceSnapshot;
  const results = [];
  const calculatedByCode = new Map();

  for (const formula of formulas) {
    let sourceContext = {};
    try {
      const source = await resolver({ client, tenantId, formulaCode: formula.formula_code, period, timezone: period.timezone, permission: { allowed: true, required: 'metrics.engine' } });
      sourceContext = {
        source_contract_status: source.contract?.availability || source.status || 'unknown',
        source_resolution_status: source.physical_sources?.length ? 'resolved' : 'not_resolved',
        source_code: source.source_code,
        physical_sources: source.physical_sources || source.source_snapshot?.physical_sources || [],
        source_counts: source.counts || { received: 0, usable: 0, excluded: 0 },
      };
      if (source.status === 'source_unavailable') {
        results.push(functionalFailure({ formula, sourceContext, status: 'source_unavailable', failureType: 'source_incompatible', code: 'SOURCE_UNAVAILABLE', message: source.reason || 'No existe una fuente operacional habilitada para esta fórmula.', warnings: source.warnings || [] }));
        continue;
      }
      if (!source.counts?.usable) {
        results.push(functionalFailure({ formula, sourceContext, status: 'unmeasured', failureType: 'insufficient_data', code: 'SOURCE_DATA_INSUFFICIENT', message: 'No hay datos utilizables para el período seleccionado.', warnings: source.warnings || [] }));
        continue;
      }
      if (!source.formula_input) {
        results.push(functionalFailure({ formula, sourceContext, status: 'source_incompatible', failureType: 'source_incompatible', code: 'FORMULA_SOURCE_EQUIVALENCE_MISSING', message: 'La fuente existe, pero todavía no dispone de equivalencia operacional completa para esta fórmula.' }));
        continue;
      }

      const dependency = enrichDependencies(formula.formula_code, source.formula_input, calculatedByCode);
      if (dependency.missing.length) {
        results.push(functionalFailure({ formula, sourceContext, status: 'dependency_pending', failureType: 'dependency_pending', code: 'FORMULA_DEPENDENCY_PENDING', message: `Faltan resultados previos requeridos: ${dependency.missing.join(', ')}.` }));
        continue;
      }

      const calculated = registry.execute(formula.formula_code, dependency.input);
      const resultValue = numeric(calculated.value);
      if (calculated.status !== 'calculated' || resultValue === null) {
        results.push(functionalFailure({ formula, sourceContext, status: 'unmeasured', failureType: 'insufficient_data', code: 'FORMULA_RESULT_EMPTY', message: 'La fórmula no produjo un valor numérico verificable y no será publicada.' }));
        continue;
      }

      const prior = await previousValue(client, tenantId, formula.formula_code, period.start);
      const decision = buildDecision({ formula, value: resultValue, unit: calculated.unit || formula.units?.output, source, previousValue: prior, details: calculated.details || {} });
      const officialResult = {
        ...calculated,
        value: resultValue,
        formula_version: calculated.version || formula.version,
        status: 'completed',
        period,
        components: dependency.input,
        source_status: source.status,
        source_code: source.source_code,
        physical_sources: source.physical_sources || [],
        source_contract: source.contract?.source_code || source.source_code,
        input_hash: source.input_hash,
        source_snapshot: source.source_snapshot,
        source_snapshot_hash: source.source_snapshot_hash,
        lineage: source.lineage,
        warnings: source.warnings || [],
        decision,
        details: { ...(calculated.details || {}), decision, source_counts: source.counts, physical_sources: source.physical_sources || [], exclusions: source.exclusions || [], equivalence: source.equivalence || null },
      };
      const persisted = await persist(scope, officialResult, requestId);
      const persistedValue = numeric(persisted.value);
      if (persistedValue === null) throw new OfficialCalculationOrchestratorError('CALCULATED_RESULT_WITHOUT_VALUE', 'El cálculo no puede marcarse como calculado sin valor numérico.', 500);
      const snapshotId = await persistSnapshot(client, tenantId, source, persisted);
      if (!snapshotId) throw new OfficialCalculationOrchestratorError('SOURCE_SNAPSHOT_NOT_PERSISTED', 'El cálculo no puede publicarse sin snapshot de fuente.', 500);
      calculatedByCode.set(formula.formula_code, persistedValue);
      results.push({ formula_code: formula.formula_code, display_name: formula.display_name, domain: formula.category, status: 'calculated', ...sourceContext, value: persistedValue, unit: persisted.unit, calculation_run_id: persisted.calculation_run_id || null, snapshot_id: snapshotId, warnings: persisted.warnings || [], decision });
    } catch (error) {
      const classified = classifyError(error);
      results.push(functionalFailure({ formula, sourceContext, status: classified.status, failureType: classified.failureType, code: classified.code, message: classified.message }));
    }
  }

  const summary = summarize(results);
  const invalidCalculated = results.filter((item) => item.status === 'calculated' && numeric(item.value) === null);
  if (invalidCalculated.length) throw new OfficialCalculationOrchestratorError('CALCULATED_RESULT_WITHOUT_VALUE', 'Se detectaron fórmulas calculadas sin valor.', 500, { formulas: invalidCalculated.map((item) => item.formula_code) });
  if (summary.failed > 0 && dependencies.failOnTechnicalError === true) {
    throw new OfficialCalculationOrchestratorError('OFFICIAL_RECALCULATION_TECHNICAL_FAILED', `${summary.failed} fórmulas terminaron con error técnico.`, 500, { summary, results });
  }
  return { status: 'OFFICIAL_RECALCULATION_COMPLETED', tenant_id: tenantId, requested_by: actorIdFrom(scope), period, summary, results };
}

module.exports = {
  SOURCE_DATASET_SNAPSHOT_TYPE,
  FUNCTIONAL_FAILURE_CODES,
  OfficialCalculationOrchestratorError,
  normalizePeriod,
  selectedFormulas,
  summarize,
  classifyError,
  enrichDependencies,
  assertSnapshotContract,
  persistSourceSnapshot,
  recalculateOfficialAnalytics,
};
