'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../../..');
const migrationPath = path.join(root, 'database/migrations/20260818_f6_8_01_hf2_manual_observation_contract_bootstrap.sql');
const runnerPath = path.join(root, 'scripts/f6-8/apply-f6-8-migration.js');
const deployPath = path.join(root, 'scripts/deploy-vms.sh');
const packagePath = path.join(root, 'package.json');

const CONTRACT_CODE = 'grc.manual_observations';
const EXPECTED_CONTRACT = Object.freeze({
  tenant_id: null,
  source_code: CONTRACT_CODE,
  display_name: 'GRC manual observations API',
  entity_type: 'grc_manual_observation',
  adapter_key: 'grc_manual_observation_api',
  status: 'published',
  metadata: {
    owner: 'semantic_layer',
    purpose: 'canonical provenance for manual GRC observation facade',
  },
});
const EXPECTED_VERSION = Object.freeze({
  version_number: 1,
  physical_tables: [{ table: 'data_snapshots', role: 'manual_observation_payload' }],
  allowed_joins: [],
  tenant_key_candidates: ['tenant_id'],
  timestamp_candidates: ['observed_at'],
  required_fields: ['observation_type', 'entity_type', 'observed_at', 'status_value', 'severity_value'],
  optional_fields: ['period_start', 'period_end', 'numeric_value', 'text_value', 'boolean_value', 'unit', 'owner_user_id', 'evidence_id', 'metadata'],
  field_equivalences: {},
  unit_policy: {},
  period_policy: { source: 'api_payload', observed_at: 'required', period: 'optional' },
  exclusion_policy: [],
  fallback_policy: {},
  minimum_coverage: 0,
  status: 'published',
  checksum_source: 'grc.manual_observations:v1:canonical-semantic-observation-facade',
  metadata: { owner: 'semantic_layer', append_only: true, manual_api_facade: true },
});

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function stable(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stable(item))));
  if (value && typeof value === 'object') {
    return JSON.stringify(Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = JSON.parse(stable(value[key]));
      return acc;
    }, {}));
  }
  return JSON.stringify(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compatibleContract(contract) {
  return contract.display_name === EXPECTED_CONTRACT.display_name &&
    contract.entity_type === EXPECTED_CONTRACT.entity_type &&
    contract.adapter_key === EXPECTED_CONTRACT.adapter_key &&
    ['published', 'approved', 'reviewed', 'draft'].includes(contract.status) &&
    contract.metadata?.owner === EXPECTED_CONTRACT.metadata.owner &&
    contract.metadata?.purpose === EXPECTED_CONTRACT.metadata.purpose;
}

function compatibleVersion(version) {
  return version.version_number === EXPECTED_VERSION.version_number &&
    stable(version.physical_tables) === stable(EXPECTED_VERSION.physical_tables) &&
    stable(version.allowed_joins) === stable(EXPECTED_VERSION.allowed_joins) &&
    stable(version.tenant_key_candidates) === stable(EXPECTED_VERSION.tenant_key_candidates) &&
    stable(version.timestamp_candidates) === stable(EXPECTED_VERSION.timestamp_candidates) &&
    stable(version.required_fields) === stable(EXPECTED_VERSION.required_fields) &&
    stable(version.optional_fields) === stable(EXPECTED_VERSION.optional_fields) &&
    stable(version.field_equivalences) === stable(EXPECTED_VERSION.field_equivalences) &&
    stable(version.unit_policy) === stable(EXPECTED_VERSION.unit_policy) &&
    stable(version.period_policy) === stable(EXPECTED_VERSION.period_policy) &&
    stable(version.exclusion_policy) === stable(EXPECTED_VERSION.exclusion_policy) &&
    stable(version.fallback_policy) === stable(EXPECTED_VERSION.fallback_policy) &&
    Number(version.minimum_coverage) === 0 &&
    version.status === 'published' &&
    version.checksum_source === EXPECTED_VERSION.checksum_source &&
    version.metadata?.owner === 'semantic_layer' &&
    version.metadata?.append_only === true &&
    version.metadata?.manual_api_facade === true;
}

function applyBootstrap(state) {
  const contracts = state.contracts.filter((item) => item.source_code === CONTRACT_CODE);
  const globalContracts = contracts.filter((item) => item.tenant_id === null);
  const tenantContracts = contracts.filter((item) => item.tenant_id !== null);
  if (globalContracts.length > 1) throw new Error('duplicate global grc.manual_observations contracts');
  if (tenantContracts.length > 0) throw new Error('tenant-specific grc.manual_observations contracts are not allowed');

  let contract = globalContracts[0];
  if (!contract) {
    contract = { id: `contract-${state.contracts.length + 1}`, current_version_id: null, ...clone(EXPECTED_CONTRACT) };
    state.contracts.push(contract);
  }
  if (!compatibleContract(contract)) throw new Error('incompatible grc.manual_observations contract');

  const versions = state.versions.filter((item) => item.contract_id === contract.id && item.version_number === 1);
  if (versions.length > 1) throw new Error('duplicate grc.manual_observations v1 rows');
  let version = versions[0];
  if (!version) {
    version = { id: `version-${state.versions.length + 1}`, contract_id: contract.id, ...clone(EXPECTED_VERSION) };
    state.versions.push(version);
  }
  if (!compatibleVersion(version)) throw new Error('incompatible grc.manual_observations v1');

  contract.current_version_id = version.id;
  contract.status = 'published';
  contract.metadata = { ...contract.metadata, ...EXPECTED_CONTRACT.metadata };
  return { contract, version };
}

function assertStaticMigrationContract() {
  const migration = read(migrationPath);
  const runner = read(runnerPath);
  const deploy = read(deployPath);
  const pkg = JSON.parse(read(packagePath));

  assert.ok(migration.includes('BEGIN;') && migration.includes('COMMIT;'));
  assert.ok(migration.includes("source_code = 'grc.manual_observations'"));
  assert.ok(migration.includes("'GRC manual observations API'"));
  assert.ok(migration.includes("'grc_manual_observation'"));
  assert.ok(migration.includes("'grc_manual_observation_api'"));
  assert.ok(migration.includes("'[{\"table\":\"data_snapshots\",\"role\":\"manual_observation_payload\"}]'::jsonb"));
  assert.ok(migration.includes("'[\"observation_type\",\"entity_type\",\"observed_at\",\"status_value\",\"severity_value\"]'::jsonb"));
  assert.ok(migration.includes("digest('grc.manual_observations:v1:canonical-semantic-observation-facade'"));
  assert.ok(migration.includes('tenant-specific grc.manual_observations contracts are not allowed'));
  assert.ok(migration.includes('incompatible grc.manual_observations contract'));
  assert.ok(migration.includes('incompatible grc.manual_observations v1'));
  assert.ok(migration.includes('current_version_id = manual_v1.version_id'));
  assert.ok(!/UPDATE\s+data_source_contract_versions/i.test(migration));
  assert.ok(!/ALTER\s+TABLE\s+grc_observations/i.test(migration));
  assert.ok(!/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?grc_observation_links/i.test(migration));
  assert.ok(!migration.includes('grc_observation_links') || migration.includes('does not'));
  assert.ok(runner.includes('schema_migrations'));
  assert.ok(runner.includes('pgcrypto_available'));
  assert.ok(runner.includes('20260818_f6_8_01_hf2_manual_observation_contract_bootstrap'));
  assert.ok(deploy.includes('scripts/f6-8/apply-f6-8-migration.js'));
  assert.equal(pkg.scripts['f6-8:migration:checksum'], 'node scripts/f6-8/apply-f6-8-migration.js --checksum');
}

function run() {
  assertStaticMigrationContract();

  const missing = { contracts: [], versions: [] };
  const created = applyBootstrap(missing);
  assert.equal(missing.contracts.length, 1);
  assert.equal(missing.versions.length, 1);
  assert.equal(created.contract.current_version_id, created.version.id);
  assert.equal(created.contract.status, 'published');

  applyBootstrap(missing);
  assert.equal(missing.contracts.length, 1);
  assert.equal(missing.versions.length, 1);

  const existing = {
    contracts: [{ id: 'contract-existing', current_version_id: null, ...clone(EXPECTED_CONTRACT) }],
    versions: [{ id: 'version-existing', contract_id: 'contract-existing', ...clone(EXPECTED_VERSION) }],
  };
  const beforeVersion = clone(existing.versions[0]);
  const reused = applyBootstrap(existing);
  assert.equal(reused.version.id, 'version-existing');
  assert.equal(reused.contract.current_version_id, 'version-existing');
  assert.deepStrictEqual(existing.versions[0], beforeVersion);

  const missingCurrent = {
    contracts: [{ id: 'contract-current', current_version_id: null, ...clone(EXPECTED_CONTRACT) }],
    versions: [{ id: 'version-current', contract_id: 'contract-current', ...clone(EXPECTED_VERSION) }],
  };
  applyBootstrap(missingCurrent);
  assert.equal(missingCurrent.contracts[0].current_version_id, 'version-current');

  assert.throws(() => applyBootstrap({
    contracts: [{ id: 'contract-bad', current_version_id: null, ...clone(EXPECTED_CONTRACT), entity_type: 'bad_entity' }],
    versions: [],
  }), /incompatible grc\.manual_observations contract/);

  assert.throws(() => applyBootstrap({
    contracts: [{ id: 'contract-tenant', current_version_id: null, ...clone(EXPECTED_CONTRACT), tenant_id: '70000000-0000-4000-8000-000000000801' }],
    versions: [],
  }), /tenant-specific grc\.manual_observations contracts/);

  assert.throws(() => applyBootstrap({
    contracts: [{ id: 'contract-bad-v1', current_version_id: 'version-bad-v1', ...clone(EXPECTED_CONTRACT) }],
    versions: [{ id: 'version-bad-v1', contract_id: 'contract-bad-v1', ...clone(EXPECTED_VERSION), status: 'draft' }],
  }), /incompatible grc\.manual_observations v1/);

  process.stdout.write('manualObservationContractBootstrap.test: OK\n');
}

run();
