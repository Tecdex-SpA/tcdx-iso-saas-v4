'use strict';

const pool = require('../../config/db');
const { FORMULAS, OfficialFormulaRegistry } = require('./formulaRegistry.service');
const { resolveFormulaSource } = require('./sourceResolver.service');
const phase5Service = require('../phase5/phase5.service');

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

function selectedFormulas(body = {}) {
  const requested = Array.isArray(body.formula_codes) ? new Set(body.formula_codes.map(String)) : null;
  const domain = body.domain ? String(body.domain) : null;
  return FORMULAS.filter((formula) => formula.status === 'published')
    .filter((formula) => !requested || requested.has(formula.formula_code))
    .filter((formula) => !domain || formula.category === domain);
}

function summarize(results) {
  return results.reduce((summary, item) => {
    summary.total += 1;
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, { total: 0, calculated: 0, unmeasured: 0, source_unavailable: 0, not_applicable: 0, failed: 0 });
}

async function persistSourceSnapshot(client, tenantId, source, persisted) {
  if (!persisted?.calculation_run_id || !source?.source_snapshot_hash) return null;
  const tables = await client.query(`SELECT to_regclass('public.calculation_snapshots') AS snapshots, to_regclass('public.official_formula_source_contracts') AS contracts`);
  if (!tables.rows[0]?.snapshots) return null;
  let sourceContractId = null;
  if (tables.rows[0]?.contracts) {
    const contract = await client.query(
      `SELECT id FROM official_formula_source_contracts WHERE tenant_id IS NULL AND source_code=$1 AND status='published' ORDER BY version_number DESC LIMIT 1`,
      [source.source_code]
    );
    sourceContractId = contract.rows[0]?.id || null;
  }
  const snapshot = await client.query(
    `INSERT INTO calculation_snapshots (tenant_id, run_id, source_contract_id, snapshot_type, snapshot_hash, row_count, payload, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'source',$4,$5,$6::jsonb,$7::jsonb)
     RETURNING id`,
    [tenantId, persisted.calculation_run_id, sourceContractId, source.source_snapshot_hash, Number(source.counts?.usable || 0), JSON.stringify(source.source_snapshot || {}), JSON.stringify({ source_code: source.source_code, exclusions: source.exclusions || [] })]
  );
  await client.query(
    `UPDATE calculation_runs SET source_contract_id=COALESCE($3::uuid,source_contract_id), source_snapshot_hash=$4 WHERE tenant_id=$1::uuid AND id=$2::uuid`,
    [tenantId, persisted.calculation_run_id, sourceContractId, source.source_snapshot_hash]
  );
  return snapshot.rows[0]?.id || null;
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

  for (const formula of formulas) {
    try {
      const source = await resolver({
        client,
        tenantId,
        formulaCode: formula.formula_code,
        period,
        timezone: period.timezone,
        permission: { allowed: true, required: 'metrics.engine' },
      });

      if (source.status === 'source_unavailable') {
        results.push({ formula_code: formula.formula_code, display_name: formula.display_name, domain: formula.category, status: 'source_unavailable', source_code: source.source_code, warnings: source.warnings || [] });
        continue;
      }
      if (!source.formula_input) {
        results.push({ formula_code: formula.formula_code, display_name: formula.display_name, domain: formula.category, status: 'not_applicable', source_code: source.source_code, warnings: ['La fuente existe, pero no hay equivalencia operativa para esta fórmula.'] });
        continue;
      }
      if (!source.counts?.usable) {
        results.push({ formula_code: formula.formula_code, display_name: formula.display_name, domain: formula.category, status: 'unmeasured', source_code: source.source_code, warnings: source.warnings || ['No hay datos utilizables para el período.'] });
        continue;
      }

      const calculated = registry.execute(formula.formula_code, source.formula_input);
      const officialResult = {
        ...calculated,
        formula_version: calculated.version || formula.version,
        status: calculated.status === 'calculated' ? 'completed' : 'unmeasured',
        period,
        components: source.formula_input,
        source_status: source.status,
        source_code: source.source_code,
        source_contract: source.contract?.source_code || source.source_code,
        input_hash: source.input_hash,
        source_snapshot: source.source_snapshot,
        source_snapshot_hash: source.source_snapshot_hash,
        lineage: source.lineage,
        warnings: source.warnings || [],
        details: {
          ...(calculated.details || {}),
          source_counts: source.counts,
          exclusions: source.exclusions || [],
          equivalence: source.equivalence || null,
        },
      };
      const persisted = await persist(scope, officialResult, requestId);
      const snapshotId = await persistSnapshot(client, tenantId, source, persisted);
      results.push({
        formula_code: formula.formula_code,
        display_name: formula.display_name,
        domain: formula.category,
        status: 'calculated',
        source_code: source.source_code,
        value: persisted.value,
        unit: persisted.unit,
        calculation_run_id: persisted.calculation_run_id || null,
        snapshot_id: snapshotId,
        warnings: persisted.warnings || [],
      });
    } catch (error) {
      results.push({
        formula_code: formula.formula_code,
        display_name: formula.display_name,
        domain: formula.category,
        status: 'failed',
        code: error.code || 'OFFICIAL_RECALC_FORMULA_FAILED',
        error: String(error.message || error).slice(0, 240),
      });
    }
  }

  return {
    status: 'OFFICIAL_RECALCULATION_COMPLETED',
    tenant_id: tenantId,
    requested_by: actorIdFrom(scope),
    period,
    summary: summarize(results),
    results,
  };
}

module.exports = {
  OfficialCalculationOrchestratorError,
  normalizePeriod,
  selectedFormulas,
  persistSourceSnapshot,
  recalculateOfficialAnalytics,
};
