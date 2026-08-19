const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') {
    return {
      Pool: class {
        async query() {
          return { rows: [], rowCount: 0 };
        }
        async connect() {
          return {
            async query() {
              return { rows: [], rowCount: 0 };
            },
            release() {},
          };
        }
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  KNOWLEDGE_DOCUMENT_MODEL_VERSION,
  KnowledgeDocumentError,
  createKnowledgeDocumentService,
  normalizeDocumentInput,
} = require('./knowledgeDocument.service');

const repoRoot = path.resolve(__dirname, '../../../..');
const migrationFile = path.join(repoRoot, 'database/migrations/20260819_f6_10_01_knowledge_document_model.sql');
const migrationRunnerFile = path.join(repoRoot, 'scripts/f6-10/apply-f6-10-migration.js');
const deployFile = path.join(repoRoot, 'scripts/deploy-vms.sh');
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const emptyTenant = '33333333-3333-4333-8333-333333333333';

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function nextUuid(counter) {
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function visibleTo(row, tenantId) {
  return row.scope === 'GLOBAL' || row.scope === 'REGULATORY' || row.tenant_id === tenantId;
}

function createFakeDb() {
  const state = {
    documents: [],
    transactions: [],
    releases: 0,
    inserts: 0,
  };

  async function query(sql, params = []) {
    if (/^BEGIN/.test(sql)) {
      state.transactions.push('BEGIN');
      return { rows: [], rowCount: 0 };
    }
    if (/^COMMIT/.test(sql)) {
      state.transactions.push('COMMIT');
      return { rows: [], rowCount: 0 };
    }
    if (/^ROLLBACK/.test(sql)) {
      state.transactions.push('ROLLBACK');
      return { rows: [], rowCount: 0 };
    }
    if (/INSERT INTO knowledge_documents/.test(sql)) {
      state.inserts += 1;
      const metadata = typeof params[18] === 'string' ? JSON.parse(params[18]) : params[18];
      const row = {
        id: nextUuid(state.inserts),
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
        metadata,
        created_at: '2026-08-19T00:00:00.000Z',
        updated_at: '2026-08-19T00:00:00.000Z',
      };
      state.documents.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (/SELECT \*\s+FROM knowledge_documents\s+WHERE id=\$1::uuid/.test(sql)) {
      const [id, tenantId] = params;
      const row = state.documents.find((document) => document.id === id && visibleTo(document, tenantId));
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/SELECT \*\s+FROM knowledge_documents\s+WHERE \(\$1::text IS NULL OR scope=\$1\)/.test(sql)) {
      const [scope, status, tenantId, limit] = params;
      const rows = state.documents
        .filter((document) => (!scope || document.scope === scope) && (!status || document.status === status))
        .filter((document) => visibleTo(document, tenantId))
        .sort((left, right) => `${left.scope}|${left.document_key}|${left.version}|${left.id}`.localeCompare(`${right.scope}|${right.document_key}|${right.version}|${right.id}`))
        .slice(0, limit);
      return { rows, rowCount: rows.length };
    }
    if (/UPDATE knowledge_documents/.test(sql)) {
      const [id, tenantId, status, metadataJson] = params;
      const row = state.documents.find((document) => document.id === id && visibleTo(document, tenantId));
      if (!row) return { rows: [], rowCount: 0 };
      row.status = status;
      row.metadata = { ...row.metadata, ...JSON.parse(metadataJson) };
      row.updated_at = '2026-08-19T00:01:00.000Z';
      return { rows: [row], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL in knowledge document test: ${sql}`);
  }

  return {
    state,
    async query(sql, params) {
      return query(sql, params);
    },
    async connect() {
      return {
        query,
        release() {
          state.releases += 1;
        },
      };
    },
  };
}

function baseDocument(overrides = {}) {
  return {
    scope: 'TENANT',
    tenant_id: tenantA,
    classification: 'internal',
    document_type: 'policy',
    title: 'Knowledge tenant policy',
    version: 'v1',
    status: 'draft',
    effective_from: '2026-08-19T00:00:00.000Z',
    source_uri_or_reference: 'tenant://policy/source',
    original_file_reference: 'storage://tenant-a/policy.pdf',
    original_file_checksum: hash('original-v1'),
    extracted_text_reference: 'storage://tenant-a/policy.txt',
    extracted_text_checksum: hash('extracted-v1'),
    content_checksum: hash('content-v1'),
    metadata: { extraction: { method: 'fixture' } },
    ...overrides,
  };
}

async function runTests() {
  const db = createFakeDb();
  const service = createKnowledgeDocumentService(db);

  const globalDoc = await service.createDocument(baseDocument({
    scope: 'GLOBAL',
    tenant_id: null,
    document_type: 'guideline',
    title: 'Global knowledge guideline',
    version: '2026.1',
    source_authority: 'tcdx_internal',
    original_file_checksum: hash('global-original'),
    extracted_text_checksum: hash('global-extracted'),
    content_checksum: hash('global-content'),
  }));
  assert.equal(globalDoc.scope, 'GLOBAL');
  assert.equal(globalDoc.tenant_id, null);
  assert.equal(globalDoc.metadata.model_version, KNOWLEDGE_DOCUMENT_MODEL_VERSION);
  assert.equal(globalDoc.operational_attachment_auto_promotion, false);

  const regulatoryDoc = await service.createDocument(baseDocument({
    scope: 'REGULATORY',
    tenant_id: null,
    document_type: 'regulation',
    title: 'Authoritative regulation',
    version: '2026.1',
    source_authority: 'authoritative',
    source_uri_or_reference: 'regulator://authority/reference',
    original_file_checksum: hash('reg-original'),
    extracted_text_checksum: hash('reg-extracted'),
    content_checksum: hash('reg-content'),
  }));
  assert.equal(regulatoryDoc.scope, 'REGULATORY');
  assert.equal(regulatoryDoc.tenant_id, null);
  assert.equal(regulatoryDoc.source_authority, 'authoritative');

  const tenantDoc = await service.createDocument(baseDocument());
  assert.equal(tenantDoc.scope, 'TENANT');
  assert.equal(tenantDoc.tenant_id, tenantA);
  assert.equal(tenantDoc.source_authority, 'tenant_private');
  assert.equal(tenantDoc.original_file_reference, 'storage://tenant-a/policy.pdf');
  assert.equal(tenantDoc.extracted_text_reference, 'storage://tenant-a/policy.txt');

  await assert.rejects(
    () => service.createDocument(baseDocument({ tenant_id: null })),
    (error) => error instanceof KnowledgeDocumentError && error.code === 'KNOWLEDGE_DOCUMENT_TENANT_REQUIRED'
  );
  await assert.rejects(
    () => service.createDocument(baseDocument({ scope: 'GLOBAL', tenant_id: tenantA })),
    (error) => error instanceof KnowledgeDocumentError && error.code === 'KNOWLEDGE_DOCUMENT_TENANT_FORBIDDEN'
  );

  const tenantAList = await service.listDocuments({ tenantId: tenantA });
  assert.deepEqual(tenantAList.map((document) => document.id), [globalDoc.id, regulatoryDoc.id, tenantDoc.id]);
  const tenantBPrivate = await service.listDocuments({ tenantId: tenantB, filters: { scope: 'TENANT' } });
  assert.deepEqual(tenantBPrivate, []);
  const emptyTenantPrivate = await service.listDocuments({ tenantId: emptyTenant, filters: { scope: 'TENANT' } });
  assert.deepEqual(emptyTenantPrivate, []);
  await assert.rejects(
    () => service.getDocumentForTenant({ tenantId: tenantB, documentId: tenantDoc.id }),
    (error) => error instanceof KnowledgeDocumentError && error.status === 404
  );

  const version2 = await service.createVersion({
    tenantId: tenantA,
    documentId: tenantDoc.id,
    body: {
      version: 'v2',
      content_checksum: hash('content-v2'),
      original_file_checksum: hash('original-v2'),
      extracted_text_checksum: hash('extracted-v2'),
      effective_from: '2026-09-01T00:00:00.000Z',
    },
  });
  assert.notEqual(version2.id, tenantDoc.id);
  assert.equal(version2.supersedes_document_id, tenantDoc.id);
  assert.equal(version2.content_checksum, hash('content-v2'));
  assert.equal(db.state.documents.find((document) => document.id === tenantDoc.id).version, 'v1');
  await assert.rejects(
    () => service.createVersion({ tenantId: tenantA, documentId: version2.id, body: { version: 'v2', content_checksum: hash('content-v3') } }),
    (error) => error instanceof KnowledgeDocumentError && error.code === 'KNOWLEDGE_DOCUMENT_VERSION_CONFLICT'
  );

  const activated = await service.transitionDocument({ tenantId: tenantA, documentId: version2.id, status: 'active' });
  assert.equal(activated.status, 'active');
  assert.equal(activated.metadata.last_transition.from, 'draft');
  await assert.rejects(
    () => service.transitionDocument({ tenantId: tenantA, documentId: activated.id, status: 'draft' }),
    (error) => error instanceof KnowledgeDocumentError && error.code === 'KNOWLEDGE_DOCUMENT_TRANSITION_INVALID'
  );

  const normalized = normalizeDocumentInput(baseDocument({ content_checksum: undefined }));
  assert.match(normalized.content_checksum, /^[a-f0-9]{64}$/);
  assert.equal(normalized.metadata.operational_attachment_auto_promotion, false);

  const migrationSql = fs.readFileSync(migrationFile, 'utf8');
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS knowledge_documents/);
  assert.match(migrationSql, /knowledge_documents_tenant_scope_check/);
  assert.match(migrationSql, /knowledge_documents_status_check/);
  assert.match(migrationSql, /ALTER TABLE knowledge_sources/);
  assert.doesNotMatch(migrationSql, /CREATE TABLE IF NOT EXISTS knowledge_base_v3/i);
  assert.doesNotMatch(migrationSql, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.doesNotMatch(migrationSql, /embedding_vector|content_vector/i);

  const migrationRunner = fs.readFileSync(migrationRunnerFile, 'utf8');
  assert.match(migrationRunner, /20260819_f6_10_01_knowledge_document_model/);
  assert.match(migrationRunner, /schema_migrations/);
  assert.match(migrationRunner, /knowledge_items_ready/);
  assert.match(migrationRunner, /no_second_kb/);

  const deployScript = fs.readFileSync(deployFile, 'utf8');
  assert.match(deployScript, /Fase 6\.10\|scripts\/f6-10\/apply-f6-10-migration\.js/);
  assert.equal(db.state.releases, 4);
}

runTests()
  .then(() => {
    console.log('knowledgeDocument.service.test.js PASS');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
