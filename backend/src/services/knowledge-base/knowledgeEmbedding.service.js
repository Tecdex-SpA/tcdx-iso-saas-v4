'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');

const KNOWLEDGE_EMBEDDING_CONTRACT_VERSION = 'knowledge-embedding-contract-v1';
const EMBEDDING_STATUSES = Object.freeze(['pending', 'ready', 'failed', 'stale', 'skipped']);
const INDEXABLE_DOCUMENT_STATUSES = Object.freeze(['active']);

class KnowledgeEmbeddingError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asText(value, max = 1000) {
  const clean = String(value || '').trim();
  return clean ? clean.slice(0, max) : null;
}

function assertUuid(value, field = 'id') {
  const clean = asText(value, 80);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clean || '')) {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_UUID_INVALID', `${field} inválido.`, 400, { field });
  }
  return clean;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function parseDimensions(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 4096) {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_DIMENSIONS_INVALID', 'dimensions debe ser entero positivo y gobernado.', 400);
  }
  return parsed;
}

function resolveEmbeddingConfig(options = {}) {
  const provider = asText(options.provider || process.env.KNOWLEDGE_EMBEDDING_PROVIDER, 80);
  const model = asText(options.model || process.env.KNOWLEDGE_EMBEDDING_MODEL, 160);
  const modelVersion = asText(
    options.model_version ||
      options.modelVersion ||
      process.env.KNOWLEDGE_EMBEDDING_MODEL_VERSION ||
      model,
    160
  );
  const dimensions = parseDimensions(options.dimensions || process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS);
  const embeddingContractVersion = asText(
    options.embedding_contract_version ||
      options.embeddingContractVersion ||
      process.env.KNOWLEDGE_EMBEDDING_CONTRACT_VERSION ||
      KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
    120
  );
  if (!provider || provider === 'none' || provider === 'disabled' || provider === 'off') {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_PROVIDER_NOT_CONFIGURED', 'Embedding provider no configurado.', 503);
  }
  if (!model || !modelVersion || !embeddingContractVersion) {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_CONFIG_INCOMPLETE', 'provider/model/model_version/contract_version son requeridos.', 503);
  }
  return {
    provider: provider.toLowerCase(),
    model,
    model_version: modelVersion,
    dimensions,
    embedding_contract_version: embeddingContractVersion,
  };
}

function vectorLiteral(values, expectedDimensions) {
  if (!Array.isArray(values) || values.length !== expectedDimensions) {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_DIMENSIONS_MISMATCH', 'El embedding no coincide con dimensions.', 502, {
      expected_dimensions: expectedDimensions,
      actual_dimensions: Array.isArray(values) ? values.length : null,
    });
  }
  const normalized = values.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_VALUE_INVALID', 'El embedding contiene valores no finitos.', 502);
    }
    return Number(number.toFixed(8));
  });
  return `[${normalized.join(',')}]`;
}

function embeddingChecksum(values, identity) {
  return sha256(JSON.stringify(stable({ identity, values })));
}

function projectEmbedding(row = {}) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    chunk_id: row.chunk_id,
    knowledge_document_id: row.knowledge_document_id,
    document_version: row.document_version,
    embedding_contract_version: row.embedding_contract_version,
    provider: row.provider,
    model: row.model,
    model_version: row.model_version,
    dimensions: Number(row.dimensions || 0),
    input_checksum: row.input_checksum,
    embedding_checksum: row.embedding_checksum,
    status: row.status,
    failure_code: row.failure_code,
    generated_at: row.generated_at,
    stale_at: row.stale_at,
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createOpenAiEmbeddingProvider({ apiKey = process.env.OPENAI_API_KEY, baseURL = process.env.OPENAI_BASE_URL } = {}) {
  if (!apiKey) {
    throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_PROVIDER_NOT_CONFIGURED', 'OPENAI_API_KEY no configurado.', 503);
  }
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined });
  return {
    async embed({ text, model, dimensions }) {
      const payload = { model, input: text };
      if (dimensions) payload.dimensions = dimensions;
      const response = await client.embeddings.create(payload);
      const vector = response?.data?.[0]?.embedding;
      if (!Array.isArray(vector)) {
        throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_PROVIDER_BAD_RESPONSE', 'Provider no devolvió embedding vectorial.', 502);
      }
      return vector;
    },
  };
}

async function resolveProviderAdapter(config, injectedProvider) {
  if (injectedProvider && typeof injectedProvider.embed === 'function') return injectedProvider;
  if (config.provider === 'openai') return createOpenAiEmbeddingProvider();
  throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_PROVIDER_UNSUPPORTED', 'Embedding provider no soportado por el adapter actual.', 503, {
    provider: config.provider,
  });
}

function needsReindex(row, chunk, config) {
  if (!row) return true;
  return (
    row.status !== 'ready' ||
    row.input_checksum !== chunk.text_checksum ||
    row.embedding_contract_version !== config.embedding_contract_version ||
    row.provider !== config.provider ||
    row.model !== config.model ||
    row.model_version !== config.model_version ||
    Number(row.dimensions) !== config.dimensions
  );
}

function createKnowledgeEmbeddingService({ db = pool, providerAdapter = null, now = () => new Date() } = {}) {
  async function loadChunkForTenant(client, tenantId, chunkId) {
    const result = await client.query(
      `SELECT
         c.id AS chunk_id,
         c.tenant_id,
         c.knowledge_document_id,
         c.document_version,
         c.chunk_text,
         c.text_checksum,
         c.chunk_ordinal,
         c.metadata AS chunk_metadata,
         d.status AS document_status,
         d.scope AS document_scope
       FROM knowledge_document_chunks c
       JOIN knowledge_documents d
         ON d.id=c.knowledge_document_id
        AND d.scope='TENANT'
        AND d.tenant_id=$1::uuid
       WHERE c.tenant_id=$1::uuid
         AND c.id=$2::uuid
       LIMIT 1`,
      [tenantId, chunkId]
    );
    return result.rows[0] || null;
  }

  async function findEmbedding(client, tenantId, chunk, config) {
    const result = await client.query(
      `SELECT *
         FROM knowledge_chunk_embeddings
        WHERE tenant_id=$1::uuid
          AND chunk_id=$2::uuid
          AND embedding_contract_version=$3
          AND provider=$4
          AND model=$5
          AND model_version=$6
          AND dimensions=$7
          AND input_checksum=$8
        LIMIT 1`,
      [
        tenantId,
        chunk.chunk_id,
        config.embedding_contract_version,
        config.provider,
        config.model,
        config.model_version,
        config.dimensions,
        chunk.text_checksum,
      ]
    );
    return result.rows[0] || null;
  }

  async function markSupersededEmbeddingsStale(client, tenantId, chunk, config) {
    await client.query(
      `UPDATE knowledge_chunk_embeddings
          SET status='stale',
              stale_at=COALESCE(stale_at, now()),
              updated_at=now(),
              metadata=metadata || $8::jsonb
        WHERE tenant_id=$1::uuid
          AND chunk_id=$2::uuid
          AND embedding_contract_version=$3
          AND provider=$4
          AND model=$5
          AND model_version=$6
          AND dimensions=$7
          AND input_checksum<>$9
          AND status IN ('pending','ready','failed')`,
      [
        tenantId,
        chunk.chunk_id,
        config.embedding_contract_version,
        config.provider,
        config.model,
        config.model_version,
        config.dimensions,
        JSON.stringify({ stale_reason: 'input_checksum_changed' }),
        chunk.text_checksum,
      ]
    );
  }

  async function upsertEmbedding(client, payload) {
    const result = await client.query(
      `INSERT INTO knowledge_chunk_embeddings (
         tenant_id, chunk_id, knowledge_document_id, document_version,
         embedding_contract_version, provider, model, model_version, dimensions,
         input_checksum, embedding_checksum, embedding, status, failure_code,
         failure_message, generated_at, stale_at, metadata
       )
       VALUES (
         $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,$13,$14,$15,
         $16::timestamptz,$17::timestamptz,$18::jsonb
       )
       ON CONFLICT (
         tenant_id, chunk_id, embedding_contract_version, provider, model,
         model_version, dimensions, input_checksum
       )
       DO UPDATE SET
         knowledge_document_id=EXCLUDED.knowledge_document_id,
         document_version=EXCLUDED.document_version,
         embedding_checksum=EXCLUDED.embedding_checksum,
         embedding=EXCLUDED.embedding,
         status=EXCLUDED.status,
         failure_code=EXCLUDED.failure_code,
         failure_message=EXCLUDED.failure_message,
         generated_at=EXCLUDED.generated_at,
         stale_at=EXCLUDED.stale_at,
         metadata=knowledge_chunk_embeddings.metadata || EXCLUDED.metadata,
         updated_at=now()
       RETURNING *`,
      [
        payload.tenant_id,
        payload.chunk_id,
        payload.knowledge_document_id,
        payload.document_version,
        payload.embedding_contract_version,
        payload.provider,
        payload.model,
        payload.model_version,
        payload.dimensions,
        payload.input_checksum,
        payload.embedding_checksum,
        payload.embedding_literal,
        payload.status,
        payload.failure_code,
        payload.failure_message,
        payload.generated_at,
        payload.stale_at,
        JSON.stringify(payload.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  async function generateEmbeddingForChunk({ tenantId, chunkId, config: configInput = {}, requestId = null } = {}) {
    const effectiveTenantId = assertUuid(tenantId, 'tenant_id');
    const effectiveChunkId = assertUuid(chunkId, 'chunk_id');
    let config;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const chunk = await loadChunkForTenant(client, effectiveTenantId, effectiveChunkId);
      if (!chunk) {
        throw new KnowledgeEmbeddingError('KNOWLEDGE_EMBEDDING_CHUNK_NOT_FOUND', 'Chunk no encontrado para este tenant.', 404);
      }
      config = resolveEmbeddingConfig(configInput);
      const existing = await findEmbedding(client, effectiveTenantId, chunk, config);
      if (existing && !needsReindex(existing, chunk, config)) {
        await client.query('COMMIT');
        return { replayed: true, embedding: projectEmbedding(existing) };
      }

      await markSupersededEmbeddingsStale(client, effectiveTenantId, chunk, config);

      if (!INDEXABLE_DOCUMENT_STATUSES.includes(String(chunk.document_status || '').toLowerCase())) {
        const skipped = await upsertEmbedding(client, {
          tenant_id: effectiveTenantId,
          chunk_id: chunk.chunk_id,
          knowledge_document_id: chunk.knowledge_document_id,
          document_version: chunk.document_version,
          ...config,
          input_checksum: chunk.text_checksum,
          embedding_checksum: null,
          embedding_literal: null,
          status: 'skipped',
          failure_code: 'KNOWLEDGE_DOCUMENT_NOT_INDEXABLE',
          failure_message: null,
          generated_at: null,
          stale_at: null,
          metadata: {
            request_id: requestId,
            document_status: chunk.document_status,
            reason: 'document_lifecycle_not_indexable',
          },
        });
        await client.query('COMMIT');
        return { replayed: false, embedding: projectEmbedding(skipped) };
      }

      let provider;
      let vector;
      try {
        provider = await resolveProviderAdapter(config, providerAdapter);
        vector = await provider.embed({
          text: chunk.chunk_text,
          tenant_id: effectiveTenantId,
          chunk_id: chunk.chunk_id,
          input_checksum: chunk.text_checksum,
          provider: config.provider,
          model: config.model,
          model_version: config.model_version,
          dimensions: config.dimensions,
          embedding_contract_version: config.embedding_contract_version,
        });
      } catch (error) {
        const failed = await upsertEmbedding(client, {
          tenant_id: effectiveTenantId,
          chunk_id: chunk.chunk_id,
          knowledge_document_id: chunk.knowledge_document_id,
          document_version: chunk.document_version,
          ...config,
          input_checksum: chunk.text_checksum,
          embedding_checksum: null,
          embedding_literal: null,
          status: 'failed',
          failure_code: error.code || 'KNOWLEDGE_EMBEDDING_PROVIDER_FAILED',
          failure_message: asText(error.message, 500),
          generated_at: null,
          stale_at: null,
          metadata: {
            request_id: requestId,
            failure_stage: 'provider',
          },
        });
        await client.query('COMMIT');
        return { replayed: false, embedding: projectEmbedding(failed) };
      }

      const literal = vectorLiteral(vector, config.dimensions);
      const identity = {
        tenant_id: effectiveTenantId,
        chunk_id: chunk.chunk_id,
        input_checksum: chunk.text_checksum,
        ...config,
      };
      const ready = await upsertEmbedding(client, {
        tenant_id: effectiveTenantId,
        chunk_id: chunk.chunk_id,
        knowledge_document_id: chunk.knowledge_document_id,
        document_version: chunk.document_version,
        ...config,
        input_checksum: chunk.text_checksum,
        embedding_checksum: embeddingChecksum(vector, identity),
        embedding_literal: literal,
        status: 'ready',
        failure_code: null,
        failure_message: null,
        generated_at: now().toISOString(),
        stale_at: null,
        metadata: {
          request_id: requestId,
          embedding_contract_version: config.embedding_contract_version,
          provider: config.provider,
          model: config.model,
          model_version: config.model_version,
          dimensions: config.dimensions,
        },
      });
      await client.query('COMMIT');
      return { replayed: false, embedding: projectEmbedding(ready) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function searchTenantVectorCandidates({ tenantId, queryEmbedding, config: configInput = {}, limit = 10 } = {}) {
    const effectiveTenantId = assertUuid(tenantId, 'tenant_id');
    const config = resolveEmbeddingConfig(configInput);
    const cappedLimit = Math.max(1, Math.min(Number(limit || 10), 50));
    const queryVector = vectorLiteral(queryEmbedding, config.dimensions);
    const result = await db.query(
      `SELECT
         e.chunk_id,
         e.knowledge_document_id,
         e.document_version,
         e.embedding_contract_version,
         e.provider,
         e.model,
         e.model_version,
         e.dimensions,
         e.input_checksum,
         e.embedding_checksum,
         (e.embedding <=> $8::vector) AS distance,
         e.metadata
       FROM knowledge_chunk_embeddings e
       JOIN knowledge_document_chunks c
         ON c.id=e.chunk_id
        AND c.tenant_id=e.tenant_id
       JOIN knowledge_documents d
         ON d.id=e.knowledge_document_id
        AND d.id=c.knowledge_document_id
        AND d.scope='TENANT'
        AND d.tenant_id=$1::uuid
       WHERE e.tenant_id=$1::uuid
         AND c.tenant_id=$1::uuid
         AND e.status='ready'
         AND d.status='active'
         AND e.embedding_contract_version=$2
         AND e.provider=$3
         AND e.model=$4
         AND e.model_version=$5
         AND e.dimensions=$6
         AND e.embedding IS NOT NULL
       ORDER BY e.embedding <=> $8::vector, e.chunk_id ASC
       LIMIT $7`,
      [
        effectiveTenantId,
        config.embedding_contract_version,
        config.provider,
        config.model,
        config.model_version,
        config.dimensions,
        cappedLimit,
        queryVector,
      ]
    );
    return result.rows.map((row) => ({
      chunk_id: row.chunk_id,
      knowledge_document_id: row.knowledge_document_id,
      document_version: row.document_version,
      embedding_contract_version: row.embedding_contract_version,
      provider: row.provider,
      model: row.model,
      model_version: row.model_version,
      dimensions: Number(row.dimensions || 0),
      input_checksum: row.input_checksum,
      embedding_checksum: row.embedding_checksum,
      distance: Number(row.distance),
      metadata: row.metadata || {},
    }));
  }

  return {
    generateEmbeddingForChunk,
    searchTenantVectorCandidates,
  };
}

module.exports = {
  KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
  EMBEDDING_STATUSES,
  KnowledgeEmbeddingError,
  createKnowledgeEmbeddingService,
  createOpenAiEmbeddingProvider,
  needsReindex,
  resolveEmbeddingConfig,
  vectorLiteral,
};
