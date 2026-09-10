'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  getSourceContract,
  publishedSourceContractChecksum,
} = require('./sourceContracts.service');
const {
  sourceContractMetadata,
  sourceContractPayload,
  stableJson,
  sourceContractDiff,
  assertPublishedSourceContractCompatible,
  syncOfficialSourceContracts,
} = require('./formulaBootstrap.service');

const EXPECTED_RISK_V7_CHECKSUM = 'b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function persistedRowFor(contract, overrides = {}) {
  return {
    id: 'source-contract-row',
    status: contract.status,
    checksum: contract.checksum,
    entity_name: contract.entity,
    tables: contract.tables,
    columns: contract.columns,
    allowed_joins: contract.joins,
    tenant_filter: contract.tenant_filter,
    status_filter: contract.status_filter,
    period_policy: contract.period,
    timezone_policy: contract.timezone,
    unit: contract.unit,
    cardinality: contract.cardinality,
    required_fields: contract.required_fields,
    exclusions: contract.exclusions,
    null_policy: contract.null_policy,
    availability: contract.availability,
    metadata: sourceContractMetadata(contract),
    ...overrides,
  };
}

async function main() {
  const risk = getSourceContract('risk_register_controls');
  assert.strictEqual(risk.version, 7);
  assert.strictEqual(risk.status, 'published');
  assert.strictEqual(risk.checksum, EXPECTED_RISK_V7_CHECKSUM);
  assert.strictEqual(publishedSourceContractChecksum(sourceContractPayload(risk)), EXPECTED_RISK_V7_CHECKSUM);

  const metadata = sourceContractMetadata(risk);
  assert.deepStrictEqual(metadata.scale_metadata.variables.probability.source_fields, ['probability', 'likelihood']);
  assert.strictEqual(metadata.temporal_semantics.validity_policy, 'latest_completed_or_reviewed_state_at_as_of');
  assert.strictEqual(metadata.status_semantics.mapping_version, 'risk-status-map-v2');

  const ordered = { a: { z: 1, b: [3, { y: 2, a: 1 }] }, c: true };
  const reordered = { c: true, a: { b: [3, { a: 1, y: 2 }], z: 1 } };
  assert.strictEqual(stableJson(ordered), stableJson(reordered));
  assert.strictEqual(sha256(stableJson(ordered)), sha256(stableJson(reordered)));

  const semanticChange = { ...sourceContractPayload(risk), required_fields: [...risk.required_fields, 'status'] };
  assert.notStrictEqual(
    publishedSourceContractChecksum(semanticChange),
    EXPECTED_RISK_V7_CHECKSUM,
    'real source contract semantic changes must alter the published checksum'
  );

  const identicalRow = persistedRowFor(risk);
  assert.doesNotThrow(() => assertPublishedSourceContractCompatible(risk, identicalRow));
  assert.deepStrictEqual(sourceContractDiff(risk, identicalRow), []);

  assert.throws(
    () => assertPublishedSourceContractCompatible(risk, persistedRowFor(risk, { checksum: '3730882daa3b15aca62ce62568fc0efa580373a4c5a8ac730cd802bc042b0103' })),
    (error) => error.code === 'PUBLISHED_SOURCE_CONTRACT_CHECKSUM_MISMATCH' &&
      error.message.includes('db_checksum=3730882daa3b15aca62ce62568fc0efa580373a4c5a8ac730cd802bc042b0103') &&
      error.message.includes(`code_checksum=${EXPECTED_RISK_V7_CHECKSUM}`)
  );

  const queries = [];
  const fakeClient = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM official_formula_source_contracts/i.test(sql) && /source_code = \$1/i.test(sql)) {
        const contract = getSourceContract(params[0]);
        return { rowCount: 1, rows: [persistedRowFor(contract)] };
      }
      throw new Error(`Unexpected query in source contract checksum test: ${sql}`);
    },
  };
  const synced = await syncOfficialSourceContracts(fakeClient);
  assert.strictEqual(synced.status, 'OFFICIAL_SOURCE_CONTRACTS_SYNCED');
  assert.ok(synced.results.some((row) => row.source_code === 'risk_register_controls' && row.action === 'already_registered'));
  assert.ok(queries.some((query) => query.params?.[0] === 'risk_register_controls' && query.params?.[1] === 7));

  process.stdout.write(JSON.stringify({
    status: 'SOURCE_CONTRACT_CHECKSUM_TESTS_OK',
    risk_register_controls_version: risk.version,
    checksum: risk.checksum,
    assertions: 15,
  }) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
