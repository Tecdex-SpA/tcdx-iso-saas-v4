'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
  KnowledgeEmbeddingError,
  createKnowledgeEmbeddingService,
} = require('./knowledgeEmbedding.service');

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomId() {
  return crypto.randomUUID();
}

function config() {
  return {
    provider: 'fixture',
    model: 'fixture-embedding-model',
    model_version: 'fixture-embedding-model@2026-08-19',
    dimensions: 3,
    embedding_contract_version: KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
  };
}

async function insertDocumentAndChunk(pool, { tenantId, title, text, status = 'active', version = 'v1' }) {
  const documentResult = await pool.query(
    `INSERT INTO knowledge_documents (
       document_key, scope, tenant_id, classification, document_type, title,
       version, status, effective_from, source_authority, content_checksum, metadata
     )
     VALUES ($1,'TENANT',$2::uuid,'tenant_private','policy',$3,$4,$5,now(),'tenant_private',$6,$7::jsonb)
     RETURNING id, version`,
    [
      `test-${randomId()}`,
      tenantId,
      title,
      version,
      status,
      sha256(`${tenantId}:${title}:${text}:${version}`),
      JSON.stringify({ test_scope: 'f6_10_03_embedding_postgres' }),
    ]
  );
  const document = documentResult.rows[0];
  const chunkResult = await pool.query(
    `INSERT INTO knowledge_document_chunks (
       tenant_id, knowledge_document_id, document_version, chunk_ordinal,
       chunk_text, text_checksum, page_number, section_label, heading,
       source_start_offset, source_end_offset, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,0,$4,$5,1,'section','heading',0,$6,$7::jsonb)
     RETURNING id`,
    [
      tenantId,
      document.id,
      document.version,
      text,
      sha256(text),
      text.length,
      JSON.stringify({ test_scope: 'f6_10_03_embedding_postgres' }),
    ]
  );
  return { documentId: document.id, chunkId: chunkResult.rows[0].id, textChecksum: sha256(text) };
}

async function runTests() {
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or MIGRATION_DATABASE_URL is required for knowledgeEmbedding.postgres.test.js');
  }

  const tenantA = randomId();
  const tenantB = randomId();
  const emptyTenant = randomId();
  const pool = new Pool({ connectionString: databaseUrl });
  const provider = {
    async embed({ text }) {
      if (text.includes('provider failure')) throw new Error('fixture provider failure');
      if (text.includes('tenant-b')) return [0.9, 0.8, 0.7];
      return [0.11, 0.21, 0.31];
    },
  };
  const service = createKnowledgeEmbeddingService({
    db: pool,
    providerAdapter: provider,
    now: () => new Date('2026-08-19T12:00:00.000Z'),
  });

  try {
    const extension = await pool.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS ready");
    assert.equal(extension.rows[0].ready, true);

    const noSecondKb = await pool.query("SELECT to_regclass('public.knowledge_base_v3') IS NULL AS ok");
    assert.equal(noSecondKb.rows[0].ok, true);

    const noChunkTextCopy = await pool.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='knowledge_chunk_embeddings'
           AND column_name='chunk_text'
       ) AS ok`
    );
    assert.equal(noChunkTextCopy.rows[0].ok, true);

    const tenantAChunk = await insertDocumentAndChunk(pool, {
      tenantId: tenantA,
      title: 'Tenant A policy',
      text: 'tenant-a access control policy',
    });
    const tenantBChunk = await insertDocumentAndChunk(pool, {
      tenantId: tenantB,
      title: 'Tenant B policy',
      text: 'tenant-b business continuity policy',
    });

    const first = await service.generateEmbeddingForChunk({
      tenantId: tenantA,
      chunkId: tenantAChunk.chunkId,
      config: config(),
      requestId: 'f6-10-03-first',
    });
    assert.equal(first.replayed, false);
    assert.equal(first.embedding.status, 'ready');
    assert.equal(first.embedding.tenant_id, tenantA);
    assert.equal(first.embedding.input_checksum, tenantAChunk.textChecksum);
    assert.equal(first.embedding.dimensions, 3);

    const replay = await service.generateEmbeddingForChunk({
      tenantId: tenantA,
      chunkId: tenantAChunk.chunkId,
      config: config(),
      requestId: 'f6-10-03-replay',
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.embedding.id, first.embedding.id);

    await service.generateEmbeddingForChunk({
      tenantId: tenantB,
      chunkId: tenantBChunk.chunkId,
      config: config(),
      requestId: 'f6-10-03-tenant-b',
    });

    const tenantAResults = await service.searchTenantVectorCandidates({
      tenantId: tenantA,
      queryEmbedding: [0.1, 0.2, 0.3],
      config: config(),
      limit: 5,
    });
    assert.equal(tenantAResults.length, 1);
    assert.equal(tenantAResults[0].chunk_id, tenantAChunk.chunkId);
    assert.notEqual(tenantAResults[0].chunk_id, tenantBChunk.chunkId);

    const tenantBResults = await service.searchTenantVectorCandidates({
      tenantId: tenantB,
      queryEmbedding: [0.91, 0.81, 0.71],
      config: config(),
      limit: 5,
    });
    assert.equal(tenantBResults.length, 1);
    assert.equal(tenantBResults[0].chunk_id, tenantBChunk.chunkId);

    const emptyResults = await service.searchTenantVectorCandidates({
      tenantId: emptyTenant,
      queryEmbedding: [0.1, 0.2, 0.3],
      config: config(),
      limit: 5,
    });
    assert.deepEqual(emptyResults, []);

    await assert.rejects(
      () => service.generateEmbeddingForChunk({
        tenantId: tenantA,
        chunkId: tenantBChunk.chunkId,
        config: config(),
        requestId: 'f6-10-03-foreign',
      }),
      (error) => error instanceof KnowledgeEmbeddingError &&
        error.code === 'KNOWLEDGE_EMBEDDING_CHUNK_NOT_FOUND' &&
        error.status === 404
    );

    const failedChunk = await insertDocumentAndChunk(pool, {
      tenantId: tenantA,
      title: 'Failure policy',
      text: 'provider failure should persist failed state',
      version: 'v2',
    });
    const failed = await service.generateEmbeddingForChunk({
      tenantId: tenantA,
      chunkId: failedChunk.chunkId,
      config: config(),
      requestId: 'f6-10-03-failed',
    });
    assert.equal(failed.embedding.status, 'failed');
    assert.equal(failed.embedding.failure_code, 'KNOWLEDGE_EMBEDDING_PROVIDER_FAILED');

    const deprecatedChunk = await insertDocumentAndChunk(pool, {
      tenantId: tenantA,
      title: 'Deprecated policy',
      text: 'deprecated content should not be indexed',
      status: 'deprecated',
      version: 'v3',
    });
    const skipped = await service.generateEmbeddingForChunk({
      tenantId: tenantA,
      chunkId: deprecatedChunk.chunkId,
      config: config(),
      requestId: 'f6-10-03-skipped',
    });
    assert.equal(skipped.embedding.status, 'skipped');
    assert.equal(skipped.embedding.failure_code, 'KNOWLEDGE_DOCUMENT_NOT_INDEXABLE');

    const duplicateCount = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM knowledge_chunk_embeddings
        WHERE tenant_id=$1::uuid
          AND chunk_id=$2::uuid
          AND status='ready'`,
      [tenantA, tenantAChunk.chunkId]
    );
    assert.equal(duplicateCount.rows[0].count, 1);
  } finally {
    await pool.end();
  }
}

runTests()
  .then(() => {
    console.log('knowledgeEmbedding.postgres.test.js PASS');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
