#!/usr/bin/env node
'use strict';
const { FORMULAS } = require('../../backend/src/services/math-governance/formulaRegistry.service');
const { listFormulaSourceBindings, listSourceContracts, getSourceContract } = require('../../backend/src/services/math-governance/sourceContracts.service');
const { buildSourceContract, sourceUnavailable } = require('../../backend/src/services/math-governance/sourceResolver.service');
const { validateDataset } = require('../../backend/src/services/math-governance/datasetValidation.service');
const failures = [];
const bindings = listFormulaSourceBindings();
const bindingMap = new Map(bindings.map((item) => [item.formula_code, item.source_code]));
if (bindings.length !== 50) failures.push(`expected_50_bindings_found_${bindings.length}`);
for (const formula of FORMULAS) {
  if (formula.source_contract === 'pending_package_2') failures.push(`${formula.formula_code}_source_contract_still_pending`);
  const bound = bindingMap.get(formula.formula_code);
  if (!bound) failures.push(`${formula.formula_code}_missing_source_binding`);
  if (bound !== formula.source_contract) failures.push(`${formula.formula_code}_source_contract_mismatch`);
  const contract = getSourceContract(formula.source_contract);
  if (!contract) failures.push(`${formula.formula_code}_source_contract_not_registered`);
}
const contracts = listSourceContracts();
if (contracts.length < 12) failures.push(`expected_at_least_12_contracts_found_${contracts.length}`);
for (const contract of contracts) {
  for (const field of ['source_code','entity','tables','columns','tenant_filter','period','timezone','cardinality','required_fields','availability','version','checksum','variable_map']) {
    if (contract[field] === undefined) failures.push(`${contract.source_code || 'unknown'}_missing_${field}`);
  }
  if (contract.checksum?.length !== 64) failures.push(`${contract.source_code}_checksum_invalid`);
  if (!['available','source_unavailable'].includes(contract.availability)) failures.push(`${contract.source_code}_unresolved_availability_${contract.availability}`);
  if (!contract.tenant_filter?.required) failures.push(`${contract.source_code}_tenant_filter_not_required`);
  if (contract.availability === 'available' && (!contract.adapter || !contract.tables.length)) failures.push(`${contract.source_code}_available_without_adapter_or_tables`);
}
const unresolvedInternal = contracts.filter((item) => ['legacy_adapter_required','partially_available'].includes(item.availability));
if (unresolvedInternal.length) failures.push(`unresolved_internal_contracts_${unresolvedInternal.map((item) => item.source_code).join(',')}`);
const unavailableContracts = contracts.filter((item) => item.availability === 'source_unavailable');
if (unavailableContracts.length !== 1 || unavailableContracts[0]?.source_code !== 'external_fx_rates') failures.push(`unexpected_unavailable_contracts_${unavailableContracts.map((item) => item.source_code).join(',')}`);
const availability = contracts.reduce((acc, item) => { acc[item.availability] = (acc[item.availability] || 0) + 1; return acc; }, {});
if (!availability.available) failures.push('missing_available_contracts');
const contract = buildSourceContract({ sourceKey: 'risks', entityType: 'risk', requiredFields: ['id','impact'], status: 'source_unavailable' });
if (contract.status !== 'source_unavailable' || contract.tenantScoped !== true) failures.push('source_contract_shape_invalid');
const unavailable = sourceUnavailable('risks');
if (unavailable.status !== 'source_unavailable' || unavailable.rows.length !== 0) failures.push('source_unavailable_shape_invalid');
const dataset = validateDataset({ tenantId: 'tenant-a', sourceKey: 'unit_test', rows: [{ id: 'a', tenant_id: 'tenant-a', value: 1 }, { id: 'b', tenant_id: 'tenant-a', value: 2 }], requiredFields: ['id','value'], minimumSampleSize: 2 });
if (dataset.rowCount !== 2 || dataset.inputHash.length !== 64 || dataset.valid !== true) failures.push('dataset_validation_invalid');
if (failures.length) {
  process.stderr.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_CONTRACTS_FAILED', failures }, null, 2) + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_CONTRACTS_OK', formulas: FORMULAS.length, contracts: contracts.length, availability, unresolved_internal: 0, external_unavailable: 'external_fx_rates' }) + '\n');
