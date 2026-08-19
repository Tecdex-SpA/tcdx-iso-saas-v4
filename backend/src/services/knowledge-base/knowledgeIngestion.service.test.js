const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const os = require('os');
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
  if (request === 'googleapis') {
    return { google: { drive: () => ({}) } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  KNOWLEDGE_INGESTION_CONTRACT_VERSION,
  KnowledgeIngestionError,
  buildSemanticChunks,
  detectSensitiveContent,
  createKnowledgeIngestionService,
} = require('./knowledgeIngestion.service');

const repoRoot = path.resolve(__dirname, '../../../..');
const migrationFile = path.join(repoRoot, 'database/migrations/20260819_f6_10_02_tenant_document_ingestion.sql');
const runnerFile = path.join(repoRoot, 'scripts/f6-10/apply-f6-10-migration.js');
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'tenant_admin', tenant_id: tenantA };
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'tenant_admin', tenant_id: tenantB };

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function uuid(prefix, counter) {
  return `${prefix}${String(counter).padStart(12, '0')}`;
}

function createTextFile(name, text, mimetype = 'text/plain') {
  const buffer = Buffer.from(text, 'utf8');
  return { originalname: name, mimetype, buffer, size: buffer.length };
}

function createFakeDb() {
  const state = {
    documents: [],
    ingestions: [],
    chunks: [],
    audits: [],
    sources: [],
    transactions: [],
    releases: 0,
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
    if (/SELECT \*\s+FROM knowledge_document_ingestions\s+WHERE tenant_id=\$1::uuid\s+AND idempotency_key=\$2/.test(sql)) {
      const row = state.ingestions.find((item) => item.tenant_id === params[0] && item.idempotency_key === params[1]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/SELECT \*\s+FROM knowledge_documents\s+WHERE id=\$1::uuid\s+AND scope='TENANT'/.test(sql)) {
      const row = state.documents.find((item) => item.id === params[0] && item.tenant_id === params[1] && item.scope === 'TENANT');
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/INSERT INTO knowledge_documents/.test(sql)) {
      const duplicate = state.documents.find((item) =>
        item.scope === params[1] &&
        item.tenant_id === params[2] &&
        item.document_key === params[0] &&
        item.version === params[6]
      );
      if (duplicate) {
        const error = new Error('duplicate key value violates unique constraint');
        error.code = '23505';
        throw error;
      }
      const row = {
        id: uuid('00000000-0000-4000-8000-', state.documents.length + 1),
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
        metadata: JSON.parse(params[18]),
        created_at: '2026-08-19T00:00:00.000Z',
        updated_at: '2026-08-19T00:00:00.000Z',
      };
      state.documents.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (/UPDATE knowledge_documents\s+SET status=\$3/.test(sql)) {
      const row = state.documents.find((item) => item.id === params[0] && item.tenant_id === params[1] && item.scope === 'TENANT');
      if (!row) return { rows: [], rowCount: 0 };
      row.status = params[2];
      row.metadata = { ...row.metadata, ...JSON.parse(params[3]) };
      return { rows: [row], rowCount: 1 };
    }
    if (/INSERT INTO knowledge_sources/.test(sql)) {
      state.sources.push({
        source_key: params[0],
        source_name: params[1],
        source_file: params[2],
        seed_version: params[3],
        metadata_json: JSON.parse(params[4]),
        knowledge_document_id: params[5],
      });
      return { rows: [], rowCount: 1 };
    }
    if (/DELETE FROM knowledge_document_chunks/.test(sql)) {
      state.chunks = state.chunks.filter((chunk) => !(chunk.tenant_id === params[0] && chunk.knowledge_document_id === params[1] && chunk.document_version === params[2]));
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO knowledge_document_chunks/.test(sql)) {
      const row = {
        tenant_id: params[0],
        knowledge_document_id: params[1],
        document_version: params[2],
        chunk_ordinal: params[3],
        chunk_text: params[4],
        text_checksum: params[5],
        page_number: params[6],
        section_label: params[7],
        heading: params[8],
        source_start_offset: params[9],
        source_end_offset: params[10],
        metadata: JSON.parse(params[11]),
      };
      state.chunks.push(row);
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO knowledge_document_ingestions/.test(sql)) {
      const row = {
        id: uuid('10000000-0000-4000-8000-', state.ingestions.length + 1),
        tenant_id: params[0],
        knowledge_document_id: params[1],
        scope: 'TENANT',
        document_key: params[2],
        document_version: params[3],
        ingestion_status: params[4],
        idempotency_key: params[5],
        original_file_reference: params[6],
        original_file_checksum: params[7],
        extracted_text_reference: params[8],
        extracted_text_checksum: params[9],
        content_checksum: params[10],
        detected_mime: params[11],
        file_size: params[12],
        original_filename: params[13],
        sanitized_filename: params[14],
        extraction_method: params[15],
        extraction_status: params[16],
        classification: params[17],
        sensitive_classification: params[18],
        chunking_status: params[19],
        chunk_count: params[20],
        malware_scan_status: params[21],
        actor_user_id: params[22],
        correlation_id: params[23],
        error_code: params[24],
        provenance: JSON.parse(params[25]),
        created_at: '2026-08-19T00:00:00.000Z',
        updated_at: '2026-08-19T00:00:00.000Z',
      };
      state.ingestions.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (/INSERT INTO knowledge_document_ingestion_audit/.test(sql)) {
      state.audits.push({
        tenant_id: params[0],
        ingestion_id: params[1],
        knowledge_document_id: params[2],
        action: params[3],
        status: params[4],
        actor_user_id: params[5],
        original_file_checksum: params[6],
        extracted_text_checksum: params[7],
        ingestion_contract_version: params[8],
        extraction_method: params[9],
        correlation_id: params[10],
        error_code: params[11],
        metadata: JSON.parse(params[12]),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT \*\s+FROM knowledge_document_ingestions\s+WHERE tenant_id=\$1::uuid\s+ORDER BY/.test(sql)) {
      const rows = state.ingestions.filter((item) => item.tenant_id === params[0]).slice(0, params[1]);
      return { rows, rowCount: rows.length };
    }
    if (/SELECT \*\s+FROM knowledge_document_ingestions\s+WHERE tenant_id=\$1::uuid\s+AND id=\$2::uuid/.test(sql)) {
      const row = state.ingestions.find((item) => item.tenant_id === params[0] && item.id === params[1]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    throw new Error(`Unexpected SQL in knowledge ingestion test: ${sql}`);
  }

  return {
    state,
    async connect() {
      return {
        query,
        release() {
          state.releases += 1;
        },
      };
    },
    query,
  };
}

async function runTests() {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-ingestion-test-'));
  const db = createFakeDb();
  const extractor = async ({ document }) => ({
    ok: !String(document.file_name || '').includes('empty'),
    text: String(document.file_name || '').includes('empty') ? '' : fs.readFileSync(document.local_storage_path, 'utf8'),
    extraction: {
      method: 'local_storage_extract',
      parser: 'fixture',
      extraction_type: document.file_name.endsWith('.txt') ? 'txt' : 'pdf',
      truncated: false,
      original_bytes: fs.statSync(document.local_storage_path).size,
      warning: null,
    },
  });
  const service = createKnowledgeIngestionService({ db, storageRoot, extractor, now: () => new Date('2026-08-19T00:00:00.000Z') });

  const result = await service.ingestTenantDocument({
    user: userA,
    file: createTextFile('Politica Seguridad.txt', '# Politica\n\nControl de acceso documentado.\n\n## Evidencia\n\nRegistro aprobado.'),
    body: {
      tenant_id: tenantB,
      title: 'Politica Seguridad',
      document_type: 'policy',
      version: 'v1',
    },
    requestId: 'req-ingestion-1',
  });
  assert.equal(result.replayed, false);
  assert.equal(result.ingestion.contract_version, KNOWLEDGE_INGESTION_CONTRACT_VERSION);
  assert.equal(result.ingestion.tenant_id, tenantA);
  assert.equal(result.ingestion.scope, 'TENANT');
  assert.equal(result.ingestion.ingestion_status, 'completed');
  assert.equal(result.ingestion.extraction_status, 'extracted');
  assert.equal(result.ingestion.chunking_status, 'chunked');
  assert.equal(result.ingestion.malware_scan_status, 'not_available');
  assert.equal(result.document.status, 'active');
  assert.equal(result.document.tenant_id, tenantA);
  assert.equal(result.document.metadata.operational_attachment_auto_promotion, false);
  assert.ok(result.ingestion.original_file_reference.startsWith(`local://knowledge-ingestion/${tenantA}/`));
  assert.ok(result.ingestion.extracted_text_reference.startsWith(`local://knowledge-ingestion/${tenantA}/`));
  assert.equal(db.state.sources.length, 1);
  assert.equal(db.state.sources[0].knowledge_document_id, result.document.id);
  assert.equal(db.state.chunks.length, result.ingestion.chunk_count);
  assert.equal(db.state.chunks[0].tenant_id, tenantA);
  assert.equal(db.state.chunks[0].metadata.chunking_method, 'deterministic-heading-paragraph-v1');
  assert.equal(db.state.audits[0].ingestion_contract_version, KNOWLEDGE_INGESTION_CONTRACT_VERSION);
  assert.equal(db.state.audits[0].original_file_checksum, result.ingestion.original_file_checksum);

  const tenantBList = await service.listIngestions({ user: userB, filters: {} });
  assert.deepEqual(tenantBList, []);
  await assert.rejects(
    () => service.getIngestion({ user: userB, ingestionId: result.ingestion.id }),
    (error) => error instanceof KnowledgeIngestionError && error.status === 404
  );

  const replay = await service.ingestTenantDocument({
    user: userA,
    file: createTextFile('Politica Seguridad.txt', '# Politica\n\nControl de acceso documentado.\n\n## Evidencia\n\nRegistro aprobado.'),
    body: {
      title: 'Politica Seguridad',
      document_type: 'policy',
      version: 'v1',
    },
    requestId: 'req-ingestion-replay',
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.ingestion.ingestion_status, 'replayed');
  assert.equal(db.state.documents.length, 1);
  assert.equal(db.state.audits.at(-1).action, 'ingestion.replay');

  const secret = await service.ingestTenantDocument({
    user: userA,
    file: createTextFile('Secretos.txt', 'password = supersecretvalue\nNo persistir como chunks.'),
    body: { title: 'Secretos', document_type: 'policy', version: 'v2' },
    requestId: 'req-secret',
  });
  assert.equal(secret.ingestion.ingestion_status, 'rejected');
  assert.equal(secret.ingestion.sensitive_classification, 'secret_detected');
  assert.equal(secret.ingestion.error_code, 'KNOWLEDGE_INGESTION_SECRET_DETECTED');
  assert.equal(db.state.documents.find((document) => document.id === secret.ingestion.document_id).status, 'rejected');
  assert.equal(db.state.chunks.some((chunk) => chunk.knowledge_document_id === secret.ingestion.document_id), false);

  const empty = await service.ingestTenantDocument({
    user: userA,
    file: createTextFile('empty.txt', '   '),
    body: { title: 'Empty', document_type: 'policy', version: 'v3' },
    requestId: 'req-empty',
  });
  assert.equal(empty.ingestion.ingestion_status, 'error');
  assert.equal(empty.ingestion.extraction_status, 'no_text');
  assert.equal(empty.ingestion.chunk_count, 0);
  assert.equal(empty.ingestion.error_code, 'KNOWLEDGE_INGESTION_NO_EXTRACTED_TEXT');

  await assert.rejects(
    () => service.ingestTenantDocument({
      user: userA,
      file: { originalname: 'bad.pdf', mimetype: 'application/pdf', buffer: Buffer.from('not a pdf'), size: 9 },
      body: { title: 'Bad PDF', version: 'v4' },
    }),
    (error) => error instanceof KnowledgeIngestionError && error.code === 'KNOWLEDGE_INGESTION_SIGNATURE_MISMATCH'
  );

  db.state.documents[0].status = 'deprecated';
  await assert.rejects(
    () => service.ingestTenantDocument({
      user: userA,
      file: createTextFile('Nueva.txt', 'Nueva version'),
      body: { supersedes_document_id: db.state.documents[0].id, version: 'v5' },
    }),
    (error) => error instanceof KnowledgeIngestionError && error.code === 'KNOWLEDGE_INGESTION_SUPERSEDES_CLOSED'
  );

  const chunks = buildSemanticChunks('# Intro\n\nTexto de introduccion.\n\n## Control\n\nDetalle controlado.');
  assert.equal(chunks.length >= 1, true);
  assert.equal(chunks[0].chunk_ordinal, 0);
  assert.match(chunks[0].text_checksum, /^[a-f0-9]{64}$/);
  assert.equal(detectSensitiveContent('contacto: persona@example.com').classification, 'sensitive');
  assert.equal(detectSensitiveContent('api_key = abcdefghijklmnopqrstuvwxyz123456').classification, 'secret_detected');

  const migrationSql = fs.readFileSync(migrationFile, 'utf8');
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS knowledge_document_ingestions/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS knowledge_document_chunks/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS knowledge_document_ingestion_audit/);
  assert.match(migrationSql, /ux_knowledge_document_ingestions_idempotency/);
  assert.doesNotMatch(migrationSql, /knowledge_base_v3/i);
  assert.doesNotMatch(migrationSql, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.doesNotMatch(migrationSql, /embedding_vector|content_vector/i);

  const runner = fs.readFileSync(runnerFile, 'utf8');
  assert.match(runner, /20260819_f6_10_02_tenant_document_ingestion/);
  assert.match(runner, /postconditionsTenantDocumentIngestion/);
  assert.match(runner, /no_vector_columns/);
}

runTests()
  .then(() => {
    console.log('knowledgeIngestion.service.test.js PASS');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
