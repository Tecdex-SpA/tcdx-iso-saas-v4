'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createRegulatoryFoundationService,
  normalizeSourceInput,
  normalizeArtifactInput,
  chunkText,
} = require('./regulatoryFoundation.service');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function makeId(prefix, index) {
  const clean = String(index).padStart(12, '0');
  if (prefix === 'source') return `aaaaaaaa-aaaa-4aaa-8aaa-${clean}`;
  if (prefix === 'document') return `bbbbbbbb-bbbb-4bbb-8bbb-${clean}`;
  if (prefix === 'ingestion') return `cccccccc-cccc-4ccc-8ccc-${clean}`;
  if (prefix === 'chunk') return `dddddddd-dddd-4ddd-8ddd-${clean}`;
  if (prefix === 'regulation') return `eeeeeeee-eeee-4eee-8eee-${clean}`;
  if (prefix === 'version') return `ffffffff-ffff-4fff-8fff-${clean}`;
  return `99999999-9999-4999-8999-${clean}`;
}

function parseJson(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function scopedKey(scope, tenantId, key) {
  return `${scope}:${tenantId || ZERO_UUID}:${key}`;
}

function createFakeDb() {
  const state = {
    sources: [],
    documents: [],
    ingestions: [],
    chunks: [],
    regulations: [],
    versions: [],
    obligations: [],
    counters: {},
  };
  const nextId = (prefix) => {
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    return makeId(prefix, state.counters[prefix]);
  };
  const result = (rows) => ({ rowCount: rows.length, rows });

  async function query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(compact)) return result([]);

    if (compact.startsWith('SELECT id FROM regulatory_authoritative_sources')) {
      const [scope, tenantId, sourceKey] = params;
      return result(state.sources.filter((row) => scopedKey(row.scope, row.tenant_id, row.source_key) === scopedKey(scope, tenantId, sourceKey)).slice(0, 1));
    }
    if (compact.startsWith('INSERT INTO regulatory_authoritative_sources')) {
      const row = {
        id: nextId('source'),
        source_key: params[0],
        scope: params[1],
        tenant_id: params[2],
        authority_classification: params[3],
        authority_type: params[4],
        jurisdiction: params[5],
        country_region: params[6],
        issuing_authority: params[7],
        official_name: params[8],
        stable_identifier: params[9],
        official_domain: params[10],
        official_source_uri: params[11],
        allowed_ingestion_method: params[12],
        content_type: params[13],
        status: params[14],
        effective_from: params[15],
        effective_to: params[16],
        owner: params[17],
        metadata: parseJson(params[18]),
        provenance: parseJson(params[19]),
        health_status: params[20],
      };
      state.sources.push(row);
      return result([row]);
    }
    if (compact.startsWith('UPDATE regulatory_authoritative_sources')) {
      const id = params[21];
      const row = state.sources.find((item) => item.id === id);
      Object.assign(row, {
        authority_classification: params[3],
        authority_type: params[4],
        jurisdiction: params[5],
        country_region: params[6],
        issuing_authority: params[7],
        official_name: params[8],
        stable_identifier: params[9],
        official_domain: params[10],
        official_source_uri: params[11],
        allowed_ingestion_method: params[12],
        content_type: params[13],
        status: params[14],
        effective_from: params[15],
        effective_to: params[16],
        owner: params[17],
        metadata: parseJson(params[18]),
        provenance: parseJson(params[19]),
        health_status: params[20],
      });
      return result([row]);
    }
    if (compact.includes('FROM regulatory_authoritative_sources') && compact.includes('ORDER BY jurisdiction')) {
      const [jurisdiction, classification, tenantId, limit] = params;
      return result(state.sources
        .filter((row) => (!jurisdiction || row.jurisdiction === jurisdiction)
          && (!classification || row.authority_classification === classification)
          && (['GLOBAL', 'JURISDICTIONAL'].includes(row.scope) || (row.scope === 'TENANT_PRIVATE' && row.tenant_id === tenantId)))
        .sort((a, b) => `${a.jurisdiction}:${a.source_key}:${a.id}`.localeCompare(`${b.jurisdiction}:${b.source_key}:${b.id}`))
        .slice(0, limit));
    }
    if (compact.startsWith('SELECT * FROM regulatory_authoritative_sources') && compact.includes('($1::uuid IS NULL')) {
      const [sourceId, sourceKey, tenantId] = params;
      return result(state.sources.filter((row) => {
        const idOk = !sourceId || row.id === sourceId;
        const keyOk = !sourceKey || row.source_key === sourceKey;
        const scopeOk = ['GLOBAL', 'JURISDICTIONAL'].includes(row.scope) || (row.scope === 'TENANT_PRIVATE' && row.tenant_id === tenantId);
        return idOk && keyOk && scopeOk;
      }).slice(0, 1));
    }
    if (compact.startsWith('SELECT id, version FROM knowledge_documents')) {
      const [documentKey] = params;
      return result(state.documents.filter((row) => row.scope === 'REGULATORY' && !row.tenant_id && row.document_key === documentKey).slice(-1));
    }
    if (compact.startsWith('INSERT INTO knowledge_documents')) {
      const row = {
        id: nextId('document'),
        document_key: params[0],
        scope: params[1],
        tenant_id: params[2],
        classification: params[3],
        document_type: params[4],
        title: params[5],
        version: params[6],
        status: params[7],
        effective_from: params[8],
        effective_to: params[9],
        supersedes_document_id: params[10],
        source_authority: params[11],
        source_uri_or_reference: params[12],
        original_file_reference: params[13],
        original_file_checksum: params[14],
        extracted_text_reference: params[15],
        extracted_text_checksum: params[16],
        content_checksum: params[17],
        metadata: parseJson(params[18]),
      };
      state.documents.push(row);
      return result([row]);
    }
    if (compact.startsWith('INSERT INTO regulatory_ingestions')) {
      const row = {
        id: nextId('ingestion'),
        source_id: params[0],
        scope: 'REGULATORY',
        tenant_id: null,
        knowledge_document_id: params[1],
        regulation_source_identifier: params[2],
        version_identifier: params[3],
        retrieved_uri: params[4],
        original_artifact_reference: params[5],
        original_artifact_checksum: params[6],
        extracted_text_reference: params[7],
        extracted_text_checksum: params[8],
        content_checksum: params[9],
        acquired_at: params[10],
        publication_date: params[11],
        effective_from: params[12],
        effective_to: params[13],
        ingestion_contract_version: params[14],
        parser_version: params[15],
        extraction_method: params[16],
        lifecycle_status: 'active',
        provenance: parseJson(params[17]),
        actor_user_id: params[18],
        correlation_id: params[19],
      };
      state.ingestions.push(row);
      return result([row]);
    }
    if (compact.startsWith('INSERT INTO knowledge_document_chunks')) {
      const row = {
        id: nextId('chunk'),
        scope: 'REGULATORY',
        tenant_id: null,
        knowledge_document_id: params[0],
        document_version: params[1],
        chunk_ordinal: params[2],
        chunk_text: params[3],
        text_checksum: params[4],
        section_label: params[5],
        heading: params[6],
        source_start_offset: params[7],
        source_end_offset: params[8],
        metadata: parseJson(params[9]),
      };
      state.chunks.push(row);
      return result([row]);
    }
    if (compact.startsWith('SELECT id FROM regulations')) {
      const [scope, tenantId, regulationKey] = params;
      return result(state.regulations.filter((row) => scopedKey(row.scope, row.tenant_id, row.regulation_key) === scopedKey(scope, tenantId, regulationKey)).slice(0, 1));
    }
    if (compact.startsWith('INSERT INTO regulations')) {
      const row = {
        id: nextId('regulation'),
        regulation_key: params[0],
        scope: params[1],
        tenant_id: params[2],
        jurisdiction: params[3],
        source_id: params[4],
        issuing_authority: params[5],
        official_identifier: params[6],
        official_title: params[7],
        regulation_type: params[8],
        status: params[9],
        metadata: parseJson(params[10]),
        provenance: parseJson(params[11]),
      };
      state.regulations.push(row);
      return result([row]);
    }
    if (compact.startsWith('UPDATE regulations')) {
      const id = params[12];
      const row = state.regulations.find((item) => item.id === id);
      Object.assign(row, {
        jurisdiction: params[3],
        source_id: params[4],
        issuing_authority: params[5],
        official_identifier: params[6],
        official_title: params[7],
        regulation_type: params[8],
        status: params[9],
        metadata: parseJson(params[10]),
        provenance: parseJson(params[11]),
      });
      return result([row]);
    }
    if (compact.startsWith('SELECT id FROM regulation_versions')) {
      return result(state.versions.filter((row) => row.regulation_id === params[0]).slice(-1));
    }
    if (compact.startsWith('INSERT INTO regulation_versions')) {
      const row = {
        id: nextId('version'),
        regulation_id: params[0],
        source_id: params[1],
        regulatory_ingestion_id: params[2],
        knowledge_document_id: params[3],
        version_identifier: params[4],
        publication_date: params[5],
        effective_from: params[6],
        effective_to: params[7],
        content_checksum: params[8],
        supersedes_version_id: params[9],
        lifecycle_status: params[10],
        reviewed_by: params[11],
        reviewed_at: params[12],
        provenance: parseJson(params[13]),
        metadata: parseJson(params[14]),
      };
      state.versions.push(row);
      return result([row]);
    }
    if (compact.startsWith('INSERT INTO legal_obligations')) {
      const row = {
        id: nextId('obligation'),
        regulation_id: params[0],
        regulation_version_id: params[1],
        obligation_key: params[2],
        reference: params[3],
        obligation_text: params[4],
        obligation_text_checksum: params[5],
        subject: params[6],
        action_type: params[7],
        requirement_summary: params[8],
        applicability: parseJson(params[9]),
        effective_from: params[10],
        effective_to: params[11],
        source_chunk_id: params[12],
        source_text_checksum: params[13],
        lifecycle_status: params[14],
        reviewed_by: params[15],
        reviewed_at: params[16],
        provenance: parseJson(params[17]),
        metadata: parseJson(params[18]),
      };
      state.obligations.push(row);
      return result([row]);
    }
    if (compact.includes('FROM regulations r')) {
      const [jurisdiction, status, tenantId, limit] = params;
      return result(state.regulations
        .filter((row) => (!jurisdiction || row.jurisdiction === jurisdiction)
          && (!status || row.status === status)
          && (['GLOBAL', 'JURISDICTIONAL'].includes(row.scope) || (row.scope === 'TENANT_PRIVATE' && row.tenant_id === tenantId)))
        .sort((a, b) => `${a.jurisdiction}:${a.regulation_key}:${a.id}`.localeCompare(`${b.jurisdiction}:${b.regulation_key}:${b.id}`))
        .slice(0, limit));
    }
    throw new Error(`Unhandled fake query: ${compact.slice(0, 180)}`);
  }

  return {
    state,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

async function expectRejectsCode(fn, code) {
  let rejected = null;
  try {
    await fn();
  } catch (error) {
    rejected = error;
  }
  assert(rejected, `Expected rejection ${code}`);
  assert.strictEqual(rejected.code, code);
}

async function main() {
  assert.throws(() => normalizeSourceInput({
    scope: 'TENANT_PRIVATE',
    authority_classification: 'AUTHORITATIVE',
    authority_type: 'agency',
    jurisdiction: 'JX',
    issuing_authority: 'Authority',
    official_name: 'Private Source',
    stable_identifier: 'private-source',
    official_domain: 'authority.example',
    official_source_uri: 'https://authority.example/private',
  }), /tenant_id invalido/);

  const fakeDb = createFakeDb();
  const service = createRegulatoryFoundationService({ db: fakeDb });
  const publicSource = await service.registerSource({
    user: { id: ACTOR },
    body: {
      source_key: 'jx-authority-official',
      scope: 'JURISDICTIONAL',
      authority_classification: 'AUTHORITATIVE',
      authority_type: 'regulator',
      jurisdiction: 'JX',
      country_region: 'JX',
      issuing_authority: 'JX Data Authority',
      official_name: 'JX Official Gazette',
      stable_identifier: 'jx-gazette',
      official_domain: 'gazette.jx.example',
      official_source_uri: 'https://gazette.jx.example/regulations',
      allowed_ingestion_method: 'manual_upload',
      status: 'active',
    },
  });
  assert.strictEqual(publicSource.tenant_id, null);
  assert.strictEqual(publicSource.provenance.ai_regulatory_truth_authority, false);

  const tenantSource = await service.registerSource({
    user: { id: ACTOR, tenant_id: TENANT_A },
    body: {
      source_key: 'tenant-private-policy-registry',
      scope: 'TENANT_PRIVATE',
      authority_classification: 'APPROVED_REFERENCE',
      authority_type: 'internal',
      jurisdiction: 'JX',
      issuing_authority: 'Tenant Compliance',
      official_name: 'Tenant Private Registry',
      stable_identifier: 'tenant-registry',
      official_domain: 'tenant.example',
      official_source_uri: 'https://tenant.example/private',
      allowed_ingestion_method: 'registry_reference',
      status: 'active',
    },
  });
  assert.strictEqual(tenantSource.tenant_id, TENANT_A);

  const tenantAVisible = await service.listSources({ user: { tenant_id: TENANT_A }, filters: { jurisdiction: 'JX' } });
  const tenantBVisible = await service.listSources({ user: { tenant_id: TENANT_B }, filters: { jurisdiction: 'JX' } });
  assert(tenantAVisible.some((row) => row.id === tenantSource.id));
  assert(!tenantBVisible.some((row) => row.id === tenantSource.id));
  assert(tenantBVisible.some((row) => row.id === publicSource.id));

  const extractedText = [
    'Article 1. Covered entities must maintain documented privacy controls.',
    'Article 2. Controllers must notify authority when reportable incidents occur.',
  ].join('\n\n');
  const artifactPreview = normalizeArtifactInput({
    version_identifier: '2026-08-19',
    regulation_source_identifier: 'JX-REG-1',
    title: 'JX Data Protection Regulation',
    extracted_text: extractedText,
    publication_date: '2026-08-19',
  }, publicSource);
  const expectedChunks = chunkText(extractedText);
  assert.strictEqual(expectedChunks.length, 2);

  const ingested = await service.ingestRegulatoryArtifact({
    user: { id: ACTOR },
    sourceId: publicSource.id,
    requestId: 'f6-11-a-test',
    artifact: {
      version_identifier: '2026-08-19',
      regulation_source_identifier: 'JX-REG-1',
      title: 'JX Data Protection Regulation',
      extracted_text: extractedText,
      content_checksum: artifactPreview.content_checksum,
      original_artifact_reference: 'object://regulatory/jx-reg-1.pdf',
      publication_date: '2026-08-19',
    },
    regulation: {
      official_title: 'JX Data Protection Regulation',
      regulation_type: 'data_protection',
      status: 'published',
    },
    obligations: [{
      reference: 'Article 1',
      obligation_text: 'Covered entities must maintain documented privacy controls.',
      subject: 'covered_entities',
      action_type: 'maintain_controls',
      lifecycle_status: 'published',
      source_chunk_ordinal: 0,
    }],
  });

  assert.strictEqual(ingested.contract_version, 'regulatory-ingestion-contract-v1');
  assert.strictEqual(ingested.knowledge_document.scope, 'REGULATORY');
  assert.strictEqual(ingested.knowledge_document.tenant_id, null);
  assert.strictEqual(ingested.knowledge_document.source_authority, 'authoritative');
  assert.strictEqual(ingested.chunk_count, 2);
  assert.strictEqual(ingested.regulation.scope, 'JURISDICTIONAL');
  assert.strictEqual(ingested.regulation_version.content_checksum, artifactPreview.content_checksum);
  assert.strictEqual(ingested.legal_obligations.length, 1);
  assert.strictEqual(ingested.legal_obligations[0].source_chunk_id, fakeDb.state.chunks[0].id);
  assert.strictEqual(ingested.gates.second_kb_created, 0);
  assert.strictEqual(fakeDb.state.chunks.every((row) => row.scope === 'REGULATORY' && row.tenant_id === null), true);

  const ingestedV2 = await service.ingestRegulatoryArtifact({
    user: { id: ACTOR },
    sourceId: publicSource.id,
    artifact: {
      version_identifier: '2026-08-20',
      regulation_source_identifier: 'JX-REG-1',
      title: 'JX Data Protection Regulation',
      extracted_text: `${extractedText}\n\nArticle 3. Processors must preserve audit evidence.`,
      publication_date: '2026-08-20',
    },
    regulation: {
      official_title: 'JX Data Protection Regulation',
      regulation_type: 'data_protection',
      status: 'published',
    },
  });
  assert.notStrictEqual(ingestedV2.knowledge_document.id, ingested.knowledge_document.id);
  assert.strictEqual(ingestedV2.knowledge_document.supersedes_document_id, ingested.knowledge_document.id);
  assert.strictEqual(ingestedV2.regulation_version.supersedes_version_id, ingested.regulation_version.id);

  const emptyService = createRegulatoryFoundationService({ db: createFakeDb() });
  assert.deepStrictEqual(await emptyService.listSources({ user: { tenant_id: TENANT_B } }), []);
  assert.deepStrictEqual(await emptyService.listRegulations({ user: { tenant_id: TENANT_B } }), []);

  const informational = { ...publicSource, id: makeId('source', 99), authority_classification: 'INFORMATIONAL' };
  await expectRejectsCode(() => normalizeArtifactInput({
    version_identifier: 'v1',
    regulation_source_identifier: 'INFO-1',
    extracted_text: 'Informational text is not legal source of truth.',
  }, informational), 'REGULATORY_SOURCE_NOT_AUTHORITATIVE');

  const migration = fs.readFileSync(path.resolve(__dirname, '../../../..', 'database/migrations/20260819_f6_11_a_regulatory_foundation.sql'), 'utf8');
  assert(migration.includes('CREATE TABLE IF NOT EXISTS regulatory_authoritative_sources'));
  assert(migration.includes('CREATE TABLE IF NOT EXISTS regulatory_ingestions'));
  assert(migration.includes('CREATE TABLE IF NOT EXISTS regulations'));
  assert(migration.includes('CREATE TABLE IF NOT EXISTS regulation_versions'));
  assert(migration.includes('CREATE TABLE IF NOT EXISTS legal_obligations'));
  assert(migration.includes('ALTER TABLE knowledge_document_chunks'));
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?regulatory_chunks\b/i.test(migration));
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?regulatory_documents_v2\b/i.test(migration));
  assert(!/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?regulatory_embeddings\b/i.test(migration));

  process.stdout.write('regulatoryFoundation.service.test.js PASS\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
