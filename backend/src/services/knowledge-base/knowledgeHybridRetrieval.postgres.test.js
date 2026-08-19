'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  HYBRID_RETRIEVAL_CONTRACT_VERSION,
  HYBRID_RANKING_VERSION,
  KnowledgeHybridRetrievalError,
  createKnowledgeHybridRetrievalService,
} = require('./knowledgeHybridRetrieval.service');
const {
  KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
} = require('./knowledgeEmbedding.service');

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomId() {
  return crypto.randomUUID();
}

function embeddingConfig(overrides = {}) {
  return {
    provider: 'fixture',
    model: 'fixture-embedding-model',
    model_version: 'fixture-embedding-model@2026-08-19',
    dimensions: 3,
    embedding_contract_version: KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
    ...overrides,
  };
}

function vector(values) {
  return `[${values.join(',')}]`;
}

async function insertDocument(pool, { tenantId, title, text, status = 'active', version = 'v1', vectorValues = [0.1, 0.2, 0.3], embeddingStatus = 'ready', config = embeddingConfig() }) {
  const document = await pool.query(
    `INSERT INTO knowledge_documents (
       document_key, scope, tenant_id, classification, document_type, title,
       version, status, effective_from, source_authority, content_checksum, metadata
     )
     VALUES ($1,'TENANT',$2::uuid,'tenant_private','policy',$3,$4,$5,now(),'tenant_private',$6,$7::jsonb)
     RETURNING id, version`,
    [
      `retrieval-${randomId()}`,
      tenantId,
      title,
      version,
      status,
      sha256(`${tenantId}:${title}:${text}:${version}`),
      JSON.stringify({ test_scope: 'f6_10_04_hybrid_retrieval' }),
    ]
  );
  const doc = document.rows[0];
  const chunk = await pool.query(
    `INSERT INTO knowledge_document_chunks (
       tenant_id, knowledge_document_id, document_version, chunk_ordinal,
       chunk_text, text_checksum, page_number, section_label, heading,
       source_start_offset, source_end_offset, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,0,$4,$5,1,'security','Access Control',0,$6,$7::jsonb)
     RETURNING id, text_checksum`,
    [
      tenantId,
      doc.id,
      doc.version,
      text,
      sha256(text),
      text.length,
      JSON.stringify({ source: 'fixture', page: 1 }),
    ]
  );
  const chunkRow = chunk.rows[0];
  await pool.query(
    `INSERT INTO knowledge_chunk_embeddings (
       tenant_id, chunk_id, knowledge_document_id, document_version,
       embedding_contract_version, provider, model, model_version, dimensions,
       input_checksum, embedding_checksum, embedding, status, generated_at, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,$13,now(),$14::jsonb)`,
    [
      tenantId,
      chunkRow.id,
      doc.id,
      doc.version,
      config.embedding_contract_version,
      config.provider,
      config.model,
      config.model_version,
      config.dimensions,
      chunkRow.text_checksum,
      sha256(`${chunkRow.id}:${vector(vectorValues)}:${config.model_version}`),
      vector(vectorValues),
      embeddingStatus,
      JSON.stringify({ embedding_fixture: true }),
    ]
  );
  return { documentId: doc.id, chunkId: chunkRow.id, textChecksum: chunkRow.text_checksum };
}

async function runTests() {
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or MIGRATION_DATABASE_URL is required for knowledgeHybridRetrieval.postgres.test.js');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const service = createKnowledgeHybridRetrievalService({ db: pool });
  const tenantA = randomId();
  const tenantB = randomId();
  const emptyTenant = randomId();

  try {
    const noSecondKb = await pool.query("SELECT to_regclass('public.knowledge_base_v3') IS NULL AS ok");
    assert.equal(noSecondKb.rows[0].ok, true);
    const noSecondChunkText = await pool.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='knowledge_chunk_embeddings'
           AND column_name='chunk_text'
       ) AS ok`
    );
    assert.equal(noSecondChunkText.rows[0].ok, true);

    const aPrimary = await insertDocument(pool, {
      tenantId: tenantA,
      title: 'Access Control Policy',
      text: 'Access control requires MFA for privileged users and quarterly review.',
      vectorValues: [0.1, 0.2, 0.3],
    });
    await insertDocument(pool, {
      tenantId: tenantA,
      title: 'Business Continuity Policy',
      text: 'Continuity plans define recovery testing and incident communication.',
      vectorValues: [0.8, 0.7, 0.6],
    });
    const bPrimary = await insertDocument(pool, {
      tenantId: tenantB,
      title: 'Access Control Tenant B',
      text: 'Access control tenant-b policy with MFA content must stay private.',
      vectorValues: [0.11, 0.21, 0.31],
    });
    const deprecated = await insertDocument(pool, {
      tenantId: tenantA,
      title: 'Deprecated Access',
      text: 'Access control deprecated document should be excluded.',
      status: 'deprecated',
      version: 'v2',
      vectorValues: [0.1, 0.2, 0.3],
    });
    await insertDocument(pool, {
      tenantId: tenantA,
      title: 'Stale Embedding',
      text: 'MFA stale embedding should not be returned by vector retrieval.',
      vectorValues: [0.1, 0.2, 0.3],
      embeddingStatus: 'stale',
      version: 'v3',
    });
    await insertDocument(pool, {
      tenantId: tenantA,
      title: 'Incompatible Embedding',
      text: 'MFA incompatible embedding model should be excluded.',
      vectorValues: [0.1, 0.2, 0.3],
      config: embeddingConfig({ model_version: 'other-model-version' }),
      version: 'v4',
    });

    const hybrid = await service.search({
      tenantId: tenantA,
      query: 'access control MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
      limit: 5,
      lexicalLimit: 10,
      vectorLimit: 10,
    });
    assert.equal(hybrid.contract_version, HYBRID_RETRIEVAL_CONTRACT_VERSION);
    assert.equal(hybrid.ranking_version, HYBRID_RANKING_VERSION);
    assert.equal(hybrid.tenant_id, tenantA);
    assert.equal(hybrid.candidates.length >= 1, true);
    assert.equal(hybrid.candidates[0].chunk_id, aPrimary.chunkId);
    assert.equal(hybrid.candidates[0].rank, 1);
    assert.equal(hybrid.candidates[0].provenance.retrieval_contract_version, HYBRID_RETRIEVAL_CONTRACT_VERSION);
    assert.equal(hybrid.candidates[0].provenance.embedding_contract_version, KNOWLEDGE_EMBEDDING_CONTRACT_VERSION);
    assert.equal(hybrid.candidates[0].chunk.text_checksum, aPrimary.textChecksum);
    assert.equal(hybrid.candidates.some((candidate) => candidate.chunk_id === bPrimary.chunkId), false);
    assert.equal(hybrid.candidates.some((candidate) => candidate.chunk_id === deprecated.chunkId), false);
    assert.equal(Object.prototype.hasOwnProperty.call(hybrid.candidates[0], 'answer'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(hybrid.candidates[0], 'citation'), false);

    const secondHybrid = await service.search({
      tenantId: tenantA,
      query: 'access control MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
      limit: 5,
      lexicalLimit: 10,
      vectorLimit: 10,
    });
    assert.deepEqual(
      secondHybrid.candidates.map((candidate) => [candidate.chunk_id, candidate.hybrid_score, candidate.rank]),
      hybrid.candidates.map((candidate) => [candidate.chunk_id, candidate.hybrid_score, candidate.rank])
    );

    const tenantBResult = await service.search({
      tenantId: tenantB,
      query: 'access control MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
    });
    assert.equal(tenantBResult.candidates.length, 1);
    assert.equal(tenantBResult.candidates[0].chunk_id, bPrimary.chunkId);

    const empty = await service.search({
      tenantId: emptyTenant,
      query: 'access control MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
    });
    assert.deepEqual(empty.candidates, []);

    const forcedForeign = await service.search({
      tenantId: tenantA,
      query: 'access control MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
      filters: { chunk_id: bPrimary.chunkId },
    });
    assert.deepEqual(forcedForeign.candidates, []);

    const lexicalOnly = await service.search({
      tenantId: tenantA,
      query: 'quarterly privileged review',
      limit: 3,
    });
    assert.equal(lexicalOnly.candidates[0].chunk_id, aPrimary.chunkId);
    assert.equal(lexicalOnly.candidates[0].vector_score, 0);

    const vectorOnly = await service.search({
      tenantId: tenantA,
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
      limit: 3,
    });
    assert.equal(vectorOnly.candidates[0].chunk_id, aPrimary.chunkId);
    assert.equal(vectorOnly.candidates[0].lexical_score, 0);

    const limited = await service.search({
      tenantId: tenantA,
      query: 'policy access continuity recovery MFA',
      queryEmbedding: [0.1, 0.2, 0.29],
      embedding: embeddingConfig(),
      limit: 1,
      lexicalLimit: 1000,
      vectorLimit: 1000,
    });
    assert.equal(limited.candidates.length, 1);
    assert.equal(limited.limits.result_limit, 1);
    assert.equal(limited.limits.lexical_candidate_limit, 80);
    assert.equal(limited.limits.vector_candidate_limit, 80);

    await assert.rejects(
      () => service.search({ tenantId: tenantA, query: '   ' }),
      (error) => error instanceof KnowledgeHybridRetrievalError &&
        error.code === 'KNOWLEDGE_RETRIEVAL_QUERY_REQUIRED'
    );
    await assert.rejects(
      () => service.search({
        tenantId: tenantA,
        query: 'access',
        queryEmbedding: [0.1, 0.2],
        embedding: embeddingConfig(),
      }),
      (error) => error.code === 'KNOWLEDGE_EMBEDDING_DIMENSIONS_MISMATCH'
    );
  } finally {
    await pool.end();
  }
}

runTests()
  .then(() => {
    console.log('knowledgeHybridRetrieval.postgres.test.js PASS');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
