#!/usr/bin/env node
'use strict';
const { FORMULAS, OfficialFormulaRegistry, checksumFor } = require('../../backend/src/services/math-governance/formulaRegistry.service');
const { buildSourceContract } = require('../../backend/src/services/math-governance/sourceResolver.service');
const { getSourceContract } = require('../../backend/src/services/math-governance/sourceContracts.service');
const requiredFields = ['formula_code','display_name','category','version','expression','methodology','variables','units','source_contract','frequency','minimum_sample_size','null_policy','zero_division_policy','rounding_policy','precision','thresholds','confidence_method','applicability','limitations','owner','reviewer','approved_by','effective_from','status','checksum'];
const failures = [];
if (FORMULAS.length !== 50) failures.push(`expected_50_formulas_found_${FORMULAS.length}`);
const codes = new Set();
for (const formula of FORMULAS) {
  for (const field of requiredFields) if (formula[field] === undefined) failures.push(`${formula.formula_code || 'unknown'}_missing_${field}`);
  if (codes.has(formula.formula_code)) failures.push(`duplicate_${formula.formula_code}`);
  codes.add(formula.formula_code);
  if (formula.status !== 'published') failures.push(`${formula.formula_code}_not_published`);
  if (formula.checksum !== checksumFor(formula)) failures.push(`${formula.formula_code}_checksum_mismatch`);
  if (!Object.isFrozen(formula)) failures.push(`${formula.formula_code}_not_immutable`);
  if (!Array.isArray(formula.tests) || formula.tests.length < 6) failures.push(`${formula.formula_code}_missing_complete_tests`);
  if (!getSourceContract(formula.source_contract)) failures.push(`${formula.formula_code}_missing_package2_source_contract`);
}
const registry = new OfficialFormulaRegistry();
try {
  const formula = FORMULAS[0];
  registry.register({ ...formula, methodology: `${formula.methodology} changed`, checksum: 'changed' });
  failures.push('published_immutability_not_enforced');
} catch (error) {
  if (error.code !== 'FORMULA_PUBLISHED_IMMUTABLE') failures.push(`unexpected_immutability_error_${error.code || error.message}`);
}
try {
  buildSourceContract({ sourceKey: 'package2_contract_probe', entityType: 'metric_measurement' });
} catch (error) {
  failures.push(`source_contract_probe_failed_${error.code || error.message}`);
}
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'PHASE5_5_FORMULA_REGISTRY_FAILED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'PHASE5_5_FORMULA_REGISTRY_OK', formulas: FORMULAS.length, source_contracts: 'package2_bound' }) + '\n');
