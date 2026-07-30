 'use strict';
const assert = require('assert');
const { FORMULAS } = require('./formulaRegistry.service');
const { listFormulaSourceBindings, listSourceContracts } = require('./sourceContracts.service');
const { validateDataset } = require('./datasetValidation.service');
const { resolveFormulaSource } = require('./sourceResolver.service');

async function main() {
  const bindings = listFormulaSourceBindings();
  assert.strictEqual(bindings.length, 50, 'every official formula must have a source binding');
  assert.strictEqual(FORMULAS.filter((formula) => formula.source_contract === 'pending_package_2').length, 0, 'package 2 must replace pending source markers');
  const contracts = listSourceContracts();
  assert.ok(contracts.some((contract) => contract.availability === 'available'), 'available operational adapters expected');
  assert.ok(contracts.some((contract) => contract.availability === 'source_unavailable'), 'explicit unavailable sources expected');
  for (const contract of contracts) {
    assert.ok(contract.checksum && contract.checksum.length === 64, `contract checksum missing for ${contract.source_code}`);
    assert.ok(!/;\s*(drop|delete|update|insert|alter)\b/i.test(contract.query || ''), `contract must not contain mutable SQL: ${contract.source_code}`);
  }

  const dataset = validateDataset({
    tenantId: 'tenant-a',
    sourceKey: 'unit-test',
    requiredFields: ['id', 'tenant_id', 'value'],
    minimumSampleSize: 1,
    naturalKey: 'id',
    rangeRules: { value: { min: 0, max: 100 } },
    rows: [
      { id: 'a', tenant_id: 'tenant-a', value: 10, measured_at: '2026-01-01T00:00:00Z' },
      { id: 'b', tenant_id: 'tenant-b', value: 20, measured_at: '2026-01-01T00:00:00Z' },
      { id: 'a', tenant_id: 'tenant-a', value: 120, measured_at: '2026-01-01T00:00:00Z' },
    ],
  });
  assert.strictEqual(dataset.valid, false);
  assert.strictEqual(dataset.usable_rows.length, 1);
  assert.ok(dataset.hash.length === 64);
  assert.ok(dataset.exclusions.some((item) => item.code === 'tenant_mismatch'));
  assert.ok(dataset.exclusions.some((item) => item.code === 'duplicate_natural_key'));

  const unavailableContract = contracts.find((contract) => contract.source_code === 'external_fx_rates');
  assert.strictEqual(unavailableContract.availability, 'source_unavailable');

  const fakeClient = {
    async query(sql) {
      if (sql.includes('to_regclass')) return { rows: [{ exists: false }] };
      throw new Error('unexpected query');
    },
  };
  const missingTables = await resolveFormulaSource({ client: fakeClient, tenantId: 'tenant-a', formulaCode: 'F5_5_ASSET_CRITICALITY' });
  assert.strictEqual(missingTables.status, 'source_unavailable');
  assert.ok(missingTables.reason.includes('not present'));
  process.stdout.write(JSON.stringify({ status: 'PHASE5_5_SOURCE_RESOLVER_TESTS_OK', formulas: FORMULAS.length, contracts: contracts.length }) + '\n');
}
main().catch((error) => { console.error(error); process.exit(1); });
