'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SEMANTIC_DIFF_CONTRACT_VERSION,
  REGULATORY_PACK_MODEL_VERSION,
  REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
  REGULATORY_APPLICABILITY_CONTRACT_VERSION,
  buildSemanticDiff,
  buildPackDefinition,
  evaluateApplicability,
  normalizePackInput,
  stableHash,
} = require('./regulatoryDiffPacks.service');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

function makeId(prefix, index) {
  const clean = String(index).padStart(12, '0');
  if (prefix === 'source') return `aaaaaaaa-aaaa-4aaa-8aaa-${clean}`;
  if (prefix === 'regulation') return `bbbbbbbb-bbbb-4bbb-8bbb-${clean}`;
  if (prefix === 'version') return `cccccccc-cccc-4ccc-8ccc-${clean}`;
  if (prefix === 'document') return `dddddddd-dddd-4ddd-8ddd-${clean}`;
  if (prefix === 'chunk') return `eeeeeeee-eeee-4eee-8eee-${clean}`;
  if (prefix === 'obligation') return `ffffffff-ffff-4fff-8fff-${clean}`;
  if (prefix === 'item') return `99999999-9999-4999-8999-${clean}`;
  return `88888888-8888-4888-8888-${clean}`;
}

function chunk(index, section, value) {
  return {
    id: makeId('chunk', index),
    chunk_ordinal: index,
    section_label: section,
    chunk_text: value,
    text_checksum: stableHash(value),
  };
}

function obligation(index, key, reference, value, extra = {}) {
  return {
    id: makeId('obligation', index),
    obligation_key: key,
    reference,
    obligation_text: value,
    obligation_text_checksum: stableHash(value),
    lifecycle_status: 'published',
    ...extra,
  };
}

async function expectThrowsCode(fn, code) {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown, `Expected ${code}`);
  assert.strictEqual(thrown.code, code);
}

async function main() {
  const regulation = { id: makeId('regulation', 1) };
  const fromVersion = {
    id: makeId('version', 1),
    regulation_id: regulation.id,
    knowledge_document_id: makeId('document', 1),
    version_identifier: '2026-01-01',
    publication_date: '2026-01-01',
    effective_from: '2026-02-01T00:00:00.000Z',
    effective_to: null,
    content_checksum: stableHash('from-version'),
  };
  const toVersion = {
    id: makeId('version', 2),
    regulation_id: regulation.id,
    knowledge_document_id: makeId('document', 2),
    version_identifier: '2026-03-01',
    publication_date: '2026-03-01',
    effective_from: '2026-04-01T00:00:00.000Z',
    effective_to: null,
    content_checksum: stableHash('to-version'),
  };
  const fromChunks = [
    chunk(1, 'Article 1', 'Covered entities must maintain documented privacy controls.'),
    chunk(2, 'Article 2', 'Controllers must notify the authority within five business days.'),
    chunk(3, 'Article 3', 'Processors must keep audit evidence for every processing activity.'),
    chunk(4, 'Article 4', 'Legacy transitional rule removed in the new version.'),
  ];
  const toChunks = [
    chunk(1, 'Article 1', 'Covered entities must maintain documented privacy controls.'),
    chunk(2, 'Article 2', 'Controllers must notify the authority within seventy two hours.'),
    chunk(5, 'Article 5', 'Processors must keep audit evidence for every processing activity.'),
    chunk(6, 'Article 6', 'Covered entities must appoint an accountable privacy lead.'),
  ];
  const fromObligations = [
    obligation(1, 'privacy-controls', 'Article 1', 'Covered entities must maintain documented privacy controls.'),
    obligation(2, 'incident-notice', 'Article 2', 'Controllers must notify the authority within five business days.'),
    obligation(3, 'legacy-transition', 'Article 4', 'Legacy transitional rule removed in the new version.'),
  ];
  const toObligations = [
    obligation(4, 'privacy-controls', 'Article 1', 'Covered entities must maintain documented privacy controls.'),
    obligation(5, 'incident-notice', 'Article 2', 'Controllers must notify the authority within seventy two hours.'),
    obligation(6, 'privacy-lead', 'Article 6', 'Covered entities must appoint an accountable privacy lead.'),
  ];

  const diffA = buildSemanticDiff({
    regulation,
    fromVersion,
    toVersion,
    fromChunks,
    toChunks,
    fromObligations,
    toObligations,
    source: { id: makeId('source', 1), source_key: 'official-test-registry' },
    requestId: 'f6-11-b-test',
  });
  const diffB = buildSemanticDiff({
    regulation,
    fromVersion,
    toVersion,
    fromChunks: [...fromChunks].reverse(),
    toChunks: [...toChunks].reverse(),
    fromObligations: [...fromObligations].reverse(),
    toObligations: [...toObligations].reverse(),
    source: { id: makeId('source', 1), source_key: 'official-test-registry' },
    requestId: 'f6-11-b-test',
  });
  assert.strictEqual(diffA.contract_version, SEMANTIC_DIFF_CONTRACT_VERSION);
  assert.strictEqual(diffA.semantic_diff_key, diffB.semantic_diff_key, 'semantic diff identity is deterministic');
  assert.strictEqual(diffA.structural_checksum, diffB.structural_checksum, 'structural checksum is deterministic');
  assert.strictEqual(diffA.provenance.ai_semantic_diff_truth_authority, false);
  assert.strictEqual(diffA.provenance.llm_direct_sql, false);
  assert.strictEqual(diffA.publication_status, 'not_published');
  assert(diffA.summary.added >= 2, 'added text/obligation changes are represented');
  assert(diffA.summary.removed >= 2, 'removed text/obligation changes are represented');
  assert(diffA.summary.modified >= 2, 'modified text/obligation/temporal changes are represented');
  assert(diffA.summary.moved >= 1, 'moved text sections are represented');
  assert(diffA.summary.unchanged >= 2, 'unchanged text/obligation changes are represented');
  assert(diffA.obligation_lineage.some((row) => row.lineage_type === 'modified' && row.previous_obligation_id && row.next_obligation_id));
  assert(diffA.obligation_lineage.some((row) => row.lineage_type === 'removed' && row.previous_obligation_id && !row.next_obligation_id));
  assert(diffA.obligation_lineage.some((row) => row.lineage_type === 'added' && !row.previous_obligation_id && row.next_obligation_id));
  assert(diffA.changes.every((change) => !String(change.provenance?.method || '').includes('llm')));

  await expectThrowsCode(() => buildSemanticDiff({
    regulation,
    fromVersion,
    toVersion: { ...toVersion, regulation_id: makeId('regulation', 2) },
  }), 'REGULATORY_DIFF_REGULATION_MISMATCH');

  const pack21719 = buildPackDefinition({
    pack: {
      pack_key: 'CL-LAW-21719',
      scope: 'JURISDICTIONAL',
      jurisdiction: 'CL',
      domain: 'privacy',
      subject: 'data_protection',
      display_name: 'Ley 21.719 regulatory pack',
      lifecycle_status: 'published',
    },
    version: {
      version_identifier: '2026-governed-test',
      lifecycle_status: 'published',
      effective_from: '2026-01-01T00:00:00.000Z',
    },
    items: [{
      item_type: 'source',
      source_id: makeId('source', 1),
      reference: 'official registry',
    }, {
      item_type: 'regulation_version',
      regulation_version_id: toVersion.id,
      reference: 'published version',
    }, {
      item_type: 'legal_obligation',
      legal_obligation_id: makeId('obligation', 6),
      reference: 'Article 6',
      applicability_rule: {
        required_fields: ['processes_personal_data'],
        matches: [{ field: 'processes_personal_data', equals: true }],
      },
      mapping_targets: [{ type: 'control', key: 'privacy-governance' }],
    }],
  });
  assert.strictEqual(pack21719.pack.pack_key, 'CL-LAW-21719');
  assert.strictEqual(pack21719.pack.scope, 'JURISDICTIONAL');
  assert.strictEqual(pack21719.pack.tenant_id, null);
  assert.strictEqual(pack21719.pack.model_version, REGULATORY_PACK_MODEL_VERSION);
  assert.strictEqual(pack21719.version.activation_contract_version, REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION);
  assert.strictEqual(pack21719.items.every((item) => item.provenance.copied_legal_text === false), true);
  assert.strictEqual(pack21719.composition_checksum, buildPackDefinition({
    pack: pack21719.pack,
    version: { ...pack21719.version, composition_checksum: undefined },
    items: [...pack21719.items].reverse(),
  }).composition_checksum, 'pack composition checksum is order-stable');

  const pack21663 = buildPackDefinition({
    pack: {
      pack_key: 'CL-LAW-21663',
      scope: 'JURISDICTIONAL',
      jurisdiction: 'CL',
      domain: 'cybersecurity',
      subject: 'incident_reporting',
      display_name: 'Ley 21.663 regulatory pack',
      lifecycle_status: 'published',
    },
    version: { version_identifier: '2026-governed-test', lifecycle_status: 'published' },
    items: [{
      item_type: 'regulation_version',
      regulation_version_id: makeId('version', 3),
      applicability_rule: {
        required_fields: ['operates_critical_service'],
        matches: [{ field: 'operates_critical_service', equals: true }],
      },
    }],
  });
  assert.strictEqual(pack21663.pack.pack_key, 'CL-LAW-21663');
  assert.notStrictEqual(pack21663.composition_checksum, pack21719.composition_checksum);

  assert.throws(() => normalizePackInput({
    scope: 'TENANT_PRIVATE',
    display_name: 'Tenant private pack',
  }), /tenant_id invalido/);

  const tenantAEvaluation = evaluateApplicability({
    tenantId: TENANT_A,
    packVersion: {
      id: makeId('version', 10),
      regulatory_pack_id: makeId('source', 10),
      composition_checksum: pack21719.composition_checksum,
    },
    items: pack21719.items.map((item, index) => ({ ...item, id: makeId('item', index + 1) })),
    tenantProfile: { processes_personal_data: true },
    requestId: 'tenant-a-eval',
  });
  assert.strictEqual(tenantAEvaluation.contract_version, REGULATORY_APPLICABILITY_CONTRACT_VERSION);
  assert.strictEqual(tenantAEvaluation.recommendation, 'applicable');
  assert.strictEqual(tenantAEvaluation.gates.cross_tenant_applicability_leakage, 0);
  assert.strictEqual(tenantAEvaluation.gates.ai_regulatory_truth_authority, 0);

  const tenantBEvaluation = evaluateApplicability({
    tenantId: TENANT_B,
    packVersion: {
      id: makeId('version', 10),
      regulatory_pack_id: makeId('source', 10),
      composition_checksum: pack21719.composition_checksum,
    },
    items: pack21719.items.map((item, index) => ({ ...item, id: makeId('item', index + 1) })),
    tenantProfile: {},
    requestId: 'tenant-b-empty-eval',
  });
  assert.strictEqual(tenantBEvaluation.recommendation, 'insufficient_data');
  assert.notStrictEqual(tenantAEvaluation.evaluation_key, tenantBEvaluation.evaluation_key);
  assert.deepStrictEqual(evaluateApplicability({
    tenantId: TENANT_A,
    packVersion: { id: makeId('version', 11), composition_checksum: stableHash('empty-pack') },
    items: [],
    tenantProfile: {},
  }).results, []);

  const migration = fs.readFileSync(path.resolve(__dirname, '../../../..', 'database/migrations/20260824_f6_11_b_semantic_diff_regulatory_packs.sql'), 'utf8');
  for (const table of [
    'regulatory_semantic_diffs',
    'regulatory_semantic_diff_changes',
    'regulatory_obligation_change_lineage',
    'regulatory_packs',
    'regulatory_pack_versions',
    'regulatory_pack_items',
    'regulatory_pack_tenant_activations',
    'regulatory_pack_applicability_evaluations',
    'regulatory_governance_audit',
  ]) {
    assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} migration exists`);
  }
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?regulatory_chunks\b/i.test(migration));
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?regulatory_embeddings\b/i.test(migration));
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?knowledge_base_v3\b/i.test(migration));

  const runner = fs.readFileSync(path.resolve(__dirname, '../../../..', 'scripts/f6-11/apply-f6-11-migration.js'), 'utf8');
  assert(runner.includes('20260824_f6_11_b_semantic_diff_regulatory_packs'));
  assert(runner.includes('postconditionsSemanticDiffRegulatoryPacks'));

  process.stdout.write('regulatoryDiffPacks.service.test.js PASS\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
