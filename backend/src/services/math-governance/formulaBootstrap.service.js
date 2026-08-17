'use strict';
const { FORMULAS } = require('./formulaRegistry.service');
const { getSourceContract, listSourceContracts } = require('./sourceContracts.service');

function publicFormula(definition) {
  const { execute, tests, ...serializable } = definition;
  return serializable;
}
function sourceContractMetadata(contract) {
  return {
    package: 'phase5_5',
    adapter: contract.adapter,
    variable_map: contract.variable_map,
    limitations: contract.limitations,
    scale_metadata: contract.scale_metadata || {},
    count_semantics: contract.count_semantics || {},
    temporal_semantics: contract.temporal_semantics || {},
  };
}

async function syncOfficialFormulaRegistry(client, { actorId = null, status = 'published' } = {}) {
  if (!client || typeof client.query !== 'function') throw new Error('syncOfficialFormulaRegistry requires a PostgreSQL client');
  const results = [];
  for (const formula of FORMULAS) {
    const sourceContract = getSourceContract(formula.source_contract);
    const definitionLookup = await client.query(
      `SELECT id FROM official_formula_definitions WHERE tenant_id IS NULL AND formula_code = $1 LIMIT 1`,
      [formula.formula_code]
    );
    let definitionId = definitionLookup.rows[0]?.id;
    if (definitionId) {
      await client.query(
        `UPDATE official_formula_definitions
         SET display_name = $2, category = $3, description = $4, owner = $5, updated_by = $6, updated_at = now(), metadata = metadata || $7::jsonb
         WHERE id = $1`,
        [definitionId, formula.display_name, formula.category, formula.methodology, formula.owner, actorId, JSON.stringify({ package: 'phase5_5', global: true })]
      );
    } else {
      const definitionResult = await client.query(
        `INSERT INTO official_formula_definitions (tenant_id, formula_code, display_name, category, description, owner, status, created_by, updated_by, metadata)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $7, $8::jsonb)
         RETURNING id`,
        [formula.formula_code, formula.display_name, formula.category, formula.methodology, formula.owner, status, actorId, JSON.stringify({ package: 'phase5_5', global: true })]
      );
      definitionId = definitionResult.rows[0].id;
    }
    const existing = await client.query(
      `SELECT id, checksum, status FROM official_formula_versions WHERE formula_definition_id = $1 AND version_number = $2`,
      [definitionId, formula.version]
    );
    if (existing.rowCount && existing.rows[0].status === 'published' && existing.rows[0].checksum !== formula.checksum) {
      throw new Error(`Published formula checksum mismatch: ${formula.formula_code}@${formula.version}`);
    }
    if (!existing.rowCount) {
      await client.query(
        `INSERT INTO official_formula_versions (
          formula_definition_id, tenant_id, version_number, methodology, expression, units, precision, rounding_policy,
          null_policy, zero_division_policy, minimum_sample_size, applicability, limitations, source_contract_code,
          checksum, status, effective_from, reviewed_by, approved_by, created_by, metadata
        ) VALUES ($1,NULL,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::timestamptz,$17,$18,$19,$20::jsonb)`,
        [definitionId, formula.version, formula.methodology, formula.expression, JSON.stringify(formula.units), formula.precision, formula.rounding_policy,
          formula.null_policy, formula.zero_division_policy, formula.minimum_sample_size, formula.applicability, formula.limitations,
          formula.source_contract, formula.checksum, formula.status, formula.effective_from, formula.reviewer, formula.approved_by, actorId,
          JSON.stringify({ package: 'phase5_5', source_contract_checksum: sourceContract?.checksum || null, definition: publicFormula(formula) })]
      );
      results.push({ formula_code: formula.formula_code, action: 'created', checksum: formula.checksum });
    } else {
      results.push({ formula_code: formula.formula_code, action: 'already_registered', checksum: formula.checksum });
    }
  }
  return { status: 'OFFICIAL_FORMULA_REGISTRY_SYNCED', formulas: results.length, results };
}

async function syncOfficialSourceContracts(client, { actorId = null } = {}) {
  if (!client || typeof client.query !== 'function') throw new Error('syncOfficialSourceContracts requires a PostgreSQL client');
  const results = [];
  for (const contract of listSourceContracts()) {
    const existing = await client.query(
      `SELECT id, checksum, status FROM official_formula_source_contracts WHERE tenant_id IS NULL AND source_code = $1 AND version_number = $2`,
      [contract.source_code, contract.version]
    );
    if (existing.rowCount && existing.rows[0].status === 'published' && existing.rows[0].checksum !== contract.checksum) {
      throw new Error(`Published source contract checksum mismatch: ${contract.source_code}@${contract.version}`);
    }
    if (!existing.rowCount) {
      await client.query(
        `INSERT INTO official_formula_source_contracts (
          tenant_id, source_code, formula_code, entity_name, version_number, tables, columns, allowed_joins,
          tenant_filter, status_filter, period_policy, timezone_policy, unit, cardinality, required_fields,
          exclusions, null_policy, availability, checksum, status, created_by, metadata
        ) VALUES (NULL,$1,NULL,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20::jsonb)`,
        [contract.source_code, contract.entity, contract.version, JSON.stringify(contract.tables), JSON.stringify(contract.columns), JSON.stringify(contract.joins),
          JSON.stringify(contract.tenant_filter), JSON.stringify(contract.status_filter), JSON.stringify(contract.period), contract.timezone, contract.unit,
          contract.cardinality, JSON.stringify(contract.required_fields), JSON.stringify(contract.exclusions), contract.null_policy, contract.availability,
          contract.checksum, contract.status, actorId, JSON.stringify(sourceContractMetadata(contract))]
      );
      results.push({ source_code: contract.source_code, action: 'created', checksum: contract.checksum });
    } else {
      results.push({ source_code: contract.source_code, action: 'already_registered', checksum: contract.checksum });
    }
  }
  return { status: 'OFFICIAL_SOURCE_CONTRACTS_SYNCED', contracts: results.length, results };
}

async function syncMathGovernanceCatalog(client, options = {}) {
  const sourceContracts = await syncOfficialSourceContracts(client, options);
  const formulas = await syncOfficialFormulaRegistry(client, options);
  return { status: 'OFFICIAL_MATH_GOVERNANCE_SYNCED', sourceContracts, formulas };
}

module.exports = { syncOfficialFormulaRegistry, syncOfficialSourceContracts, syncMathGovernanceCatalog, publicFormula, sourceContractMetadata };
