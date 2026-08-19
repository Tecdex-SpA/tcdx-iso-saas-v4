'use strict';

const pool = require('../../config/db');
const {
  KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
  resolveEmbeddingConfig,
  vectorLiteral,
} = require('./knowledgeEmbedding.service');

const HYBRID_RETRIEVAL_CONTRACT_VERSION = 'hybrid-retrieval-contract-v1';
const HYBRID_RANKING_VERSION = 'hybrid-rank-weighted-rank-normalization-v1';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const DEFAULT_METHOD_LIMIT = 40;
const MAX_METHOD_LIMIT = 80;
const MAX_QUERY_CHARS = 500;
const DEFAULT_VECTOR_WEIGHT = 0.55;
const DEFAULT_LEXICAL_WEIGHT = 0.45;
const ALLOWED_DOCUMENT_STATUSES = Object.freeze(['active']);
const FILTER_FIELDS = Object.freeze([
  'document_type',
  'classification',
  'document_key',
  'document_version',
  'source_authority',
  'knowledge_document_id',
  'chunk_id',
]);

class KnowledgeHybridRetrievalError extends Error {
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
    throw new KnowledgeHybridRetrievalError('KNOWLEDGE_RETRIEVAL_UUID_INVALID', `${field} inválido.`, 400, { field });
  }
  return clean;
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function normalizeQuery(value) {
  const query = asText(value, MAX_QUERY_CHARS);
  if (!query) return '';
  return query
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(query) {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 20);
}

function normalizeFilters(filters = {}) {
  const normalized = {};
  for (const field of FILTER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(filters, field)) continue;
    const value = asText(filters[field], 220);
    if (value) normalized[field] = value;
  }
  if (normalized.knowledge_document_id) normalized.knowledge_document_id = assertUuid(normalized.knowledge_document_id, 'knowledge_document_id');
  if (normalized.chunk_id) normalized.chunk_id = assertUuid(normalized.chunk_id, 'chunk_id');
  const asOf = asText(filters.as_of, 80);
  if (asOf) {
    const date = new Date(asOf);
    if (!Number.isFinite(date.getTime())) {
      throw new KnowledgeHybridRetrievalError('KNOWLEDGE_RETRIEVAL_AS_OF_INVALID', 'as_of inválido.', 400);
    }
    normalized.as_of = date.toISOString();
  }
  return normalized;
}

function rankingConfig(input = {}) {
  const vectorWeight = clampNumber(input.vector_weight, DEFAULT_VECTOR_WEIGHT, 0, 1);
  const lexicalWeight = clampNumber(input.lexical_weight, DEFAULT_LEXICAL_WEIGHT, 0, 1);
  const total = vectorWeight + lexicalWeight;
  if (total <= 0) {
    throw new KnowledgeHybridRetrievalError('KNOWLEDGE_RETRIEVAL_WEIGHTS_INVALID', 'Los pesos de ranking deben sumar más que cero.', 400);
  }
  return {
    ranking_version: HYBRID_RANKING_VERSION,
    vector_weight: Number((vectorWeight / total).toFixed(6)),
    lexical_weight: Number((lexicalWeight / total).toFixed(6)),
  };
}

function filterSql(filters, params, alias = 'd', chunkAlias = 'c') {
  const where = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (filters.document_type) add(`${alias}.document_type = ?`, filters.document_type);
  if (filters.classification) add(`${alias}.classification = ?`, filters.classification);
  if (filters.document_key) add(`${alias}.document_key = ?`, filters.document_key);
  if (filters.document_version) add(`${chunkAlias}.document_version = ?`, filters.document_version);
  if (filters.source_authority) add(`${alias}.source_authority = ?`, filters.source_authority);
  if (filters.knowledge_document_id) add(`${alias}.id = ?::uuid`, filters.knowledge_document_id);
  if (filters.chunk_id) add(`${chunkAlias}.id = ?::uuid`, filters.chunk_id);
  if (filters.as_of) {
    add(`(${alias}.effective_from IS NULL OR ${alias}.effective_from <= ?::timestamptz)`, filters.as_of);
    add(`(${alias}.effective_to IS NULL OR ${alias}.effective_to > ?::timestamptz)`, filters.as_of);
  }
  return where;
}

function lexicalScore(row, query, tokens) {
  const text = String(row.chunk_text || '').toLowerCase();
  const normalizedText = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedQuery = query.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const phrase = normalizedQuery && normalizedText.includes(normalizedQuery) ? 1 : 0;
  const hits = tokens.reduce((count, token) => count + (normalizedText.includes(token) ? 1 : 0), 0);
  const tokenRatio = tokens.length ? hits / tokens.length : 0;
  return Number((phrase + tokenRatio).toFixed(6));
}

function normalizeRankScore(rank, total) {
  if (!rank || rank <= 0 || total <= 0) return 0;
  if (total === 1) return 1;
  return Number((1 - ((rank - 1) / (total - 1))).toFixed(6));
}

function candidateKey(row) {
  return `${row.tenant_id}:${row.chunk_id}`;
}

function projectCandidate(row, methods, ranking) {
  const vector = methods.vector || null;
  const lexical = methods.lexical || null;
  const vectorScore = vector ? normalizeRankScore(vector.rank, vector.total) : 0;
  const lexicalScoreNormalized = lexical ? normalizeRankScore(lexical.rank, lexical.total) : 0;
  const hybridScore = Number(((ranking.vector_weight * vectorScore + ranking.lexical_weight * lexicalScoreNormalized) * 100).toFixed(6));
  return {
    tenant_id: row.tenant_id,
    chunk_id: row.chunk_id,
    knowledge_document_id: row.knowledge_document_id,
    document_version: row.document_version,
    document: {
      document_key: row.document_key,
      title: row.title,
      document_type: row.document_type,
      classification: row.classification,
      status: row.document_status,
      scope: row.scope,
      source_authority: row.source_authority,
    },
    chunk: {
      chunk_ordinal: Number(row.chunk_ordinal),
      text_checksum: row.text_checksum,
      page_number: row.page_number,
      section_label: row.section_label,
      heading: row.heading,
      source_start_offset: row.source_start_offset,
      source_end_offset: row.source_end_offset,
      metadata: row.chunk_metadata || {},
    },
    hybrid_score: hybridScore,
    vector_score: vectorScore,
    lexical_score: lexicalScoreNormalized,
    rank: null,
    methods: {
      lexical: lexical ? {
        rank: lexical.rank,
        raw_score: lexical.raw_score,
      } : null,
      vector: vector ? {
        rank: vector.rank,
        distance: vector.distance,
      } : null,
    },
    provenance: {
      retrieval_contract_version: HYBRID_RETRIEVAL_CONTRACT_VERSION,
      ranking_version: ranking.ranking_version,
      embedding_contract_version: vector?.embedding_contract_version || null,
      provider: vector?.provider || null,
      model: vector?.model || null,
      model_version: vector?.model_version || null,
      dimensions: vector?.dimensions || null,
      input_checksum: vector?.input_checksum || row.text_checksum,
      embedding_checksum: vector?.embedding_checksum || null,
      source: {
        chunk_table: 'knowledge_document_chunks',
        embedding_table: vector ? 'knowledge_chunk_embeddings' : null,
        document_table: 'knowledge_documents',
      },
    },
  };
}

function sortCandidates(a, b) {
  return (
    b.hybrid_score - a.hybrid_score ||
    b.vector_score - a.vector_score ||
    b.lexical_score - a.lexical_score ||
    String(a.knowledge_document_id).localeCompare(String(b.knowledge_document_id)) ||
    String(a.chunk_id).localeCompare(String(b.chunk_id))
  );
}

function createKnowledgeHybridRetrievalService({ db = pool } = {}) {
  async function lexicalSearch({ tenantId, query, filters, limit }) {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const params = [tenantId];
    const likes = tokens.slice(0, 8).map((token) => {
      params.push(`%${token}%`);
      return `lower(c.chunk_text) LIKE $${params.length}`;
    });
    const where = [
      'c.tenant_id=$1::uuid',
      "d.scope='TENANT'",
      'd.tenant_id=$1::uuid',
      `d.status = ANY($${params.push(ALLOWED_DOCUMENT_STATUSES)}::text[])`,
      `(${likes.join(' OR ')})`,
      ...filterSql(filters, params, 'd', 'c'),
    ];
    params.push(Math.min(limit, MAX_METHOD_LIMIT));
    const result = await db.query(
      `SELECT
         c.id AS chunk_id,
         c.tenant_id,
         c.knowledge_document_id,
         c.document_version,
         c.chunk_ordinal,
         c.chunk_text,
         c.text_checksum,
         c.page_number,
         c.section_label,
         c.heading,
         c.source_start_offset,
         c.source_end_offset,
         c.metadata AS chunk_metadata,
         d.document_key,
         d.title,
         d.document_type,
         d.classification,
         d.status AS document_status,
         d.scope,
         d.source_authority
       FROM knowledge_document_chunks c
       JOIN knowledge_documents d
         ON d.id=c.knowledge_document_id
        AND d.tenant_id=$1::uuid
        AND d.scope='TENANT'
       WHERE ${where.join(' AND ')}
       ORDER BY c.knowledge_document_id ASC, c.chunk_ordinal ASC, c.id ASC
       LIMIT $${params.length}`,
      params
    );
    return result.rows
      .map((row) => ({ ...row, raw_score: lexicalScore(row, query, tokens) }))
      .filter((row) => row.raw_score > 0)
      .sort((a, b) => b.raw_score - a.raw_score || a.knowledge_document_id.localeCompare(b.knowledge_document_id) || a.chunk_ordinal - b.chunk_ordinal || a.chunk_id.localeCompare(b.chunk_id))
      .map((row, index, rows) => ({ ...row, rank: index + 1, total: rows.length }));
  }

  async function vectorSearch({ tenantId, queryEmbedding, embeddingConfig, filters, limit }) {
    if (!queryEmbedding) return [];
    const config = resolveEmbeddingConfig({
      embedding_contract_version: KNOWLEDGE_EMBEDDING_CONTRACT_VERSION,
      ...embeddingConfig,
    });
    const queryVector = vectorLiteral(queryEmbedding, config.dimensions);
    const params = [
      tenantId,
      config.embedding_contract_version,
      config.provider,
      config.model,
      config.model_version,
      config.dimensions,
      queryVector,
    ];
    const where = [
      'e.tenant_id=$1::uuid',
      'c.tenant_id=$1::uuid',
      "e.status='ready'",
      'e.embedding_contract_version=$2',
      'e.provider=$3',
      'e.model=$4',
      'e.model_version=$5',
      'e.dimensions=$6',
      'e.embedding IS NOT NULL',
      "d.scope='TENANT'",
      'd.tenant_id=$1::uuid',
      `d.status = ANY($${params.push(ALLOWED_DOCUMENT_STATUSES)}::text[])`,
      ...filterSql(filters, params, 'd', 'c'),
    ];
    params.push(Math.min(limit, MAX_METHOD_LIMIT));
    const result = await db.query(
      `SELECT
         c.id AS chunk_id,
         c.tenant_id,
         c.knowledge_document_id,
         c.document_version,
         c.chunk_ordinal,
         c.text_checksum,
         c.page_number,
         c.section_label,
         c.heading,
         c.source_start_offset,
         c.source_end_offset,
         c.metadata AS chunk_metadata,
         d.document_key,
         d.title,
         d.document_type,
         d.classification,
         d.status AS document_status,
         d.scope,
         d.source_authority,
         e.embedding_contract_version,
         e.provider,
         e.model,
         e.model_version,
         e.dimensions,
         e.input_checksum,
         e.embedding_checksum,
         (e.embedding <=> $7::vector) AS distance
       FROM knowledge_chunk_embeddings e
       JOIN knowledge_document_chunks c
         ON c.id=e.chunk_id
        AND c.tenant_id=e.tenant_id
       JOIN knowledge_documents d
         ON d.id=e.knowledge_document_id
        AND d.id=c.knowledge_document_id
        AND d.tenant_id=$1::uuid
        AND d.scope='TENANT'
       WHERE ${where.join(' AND ')}
       ORDER BY e.embedding <=> $7::vector, c.knowledge_document_id ASC, c.chunk_ordinal ASC, c.id ASC
       LIMIT $${params.length}`,
      params
    );
    return result.rows.map((row, index, rows) => ({
      ...row,
      distance: Number(row.distance),
      dimensions: Number(row.dimensions || 0),
      rank: index + 1,
      total: rows.length,
    }));
  }

  async function search({ user = {}, tenantId = null, query = '', queryEmbedding = null, filters = {}, embedding = {}, ranking = {}, limit, lexicalLimit, vectorLimit } = {}) {
    const effectiveTenantId = assertUuid(tenantId || tenantIdFromUser(user), 'tenant_id');
    const normalizedQuery = normalizeQuery(query);
    const normalizedFilters = normalizeFilters(filters);
    const effectiveLimit = Math.floor(clampNumber(limit, DEFAULT_LIMIT, 1, MAX_LIMIT));
    const effectiveLexicalLimit = Math.floor(clampNumber(lexicalLimit || embedding.lexical_limit, DEFAULT_METHOD_LIMIT, 1, MAX_METHOD_LIMIT));
    const effectiveVectorLimit = Math.floor(clampNumber(vectorLimit || embedding.vector_limit, DEFAULT_METHOD_LIMIT, 1, MAX_METHOD_LIMIT));
    if (!normalizedQuery && !queryEmbedding) {
      throw new KnowledgeHybridRetrievalError('KNOWLEDGE_RETRIEVAL_QUERY_REQUIRED', 'query o query_embedding es requerido.', 400);
    }

    const rankingResolved = rankingConfig(ranking);
    const [lexicalRows, vectorRows] = await Promise.all([
      normalizedQuery
        ? lexicalSearch({ tenantId: effectiveTenantId, query: normalizedQuery, filters: normalizedFilters, limit: effectiveLexicalLimit })
        : Promise.resolve([]),
      queryEmbedding
        ? vectorSearch({ tenantId: effectiveTenantId, queryEmbedding, embeddingConfig: embedding, filters: normalizedFilters, limit: effectiveVectorLimit })
        : Promise.resolve([]),
    ]);

    const byKey = new Map();
    for (const row of lexicalRows) {
      const key = candidateKey(row);
      const entry = byKey.get(key) || { row, methods: {} };
      entry.row = entry.row || row;
      entry.methods.lexical = { rank: row.rank, total: row.total, raw_score: row.raw_score };
      byKey.set(key, entry);
    }
    for (const row of vectorRows) {
      const key = candidateKey(row);
      const entry = byKey.get(key) || { row, methods: {} };
      entry.row = { ...entry.row, ...row };
      entry.methods.vector = {
        rank: row.rank,
        total: row.total,
        distance: row.distance,
        embedding_contract_version: row.embedding_contract_version,
        provider: row.provider,
        model: row.model,
        model_version: row.model_version,
        dimensions: row.dimensions,
        input_checksum: row.input_checksum,
        embedding_checksum: row.embedding_checksum,
      };
      byKey.set(key, entry);
    }

    const candidates = Array.from(byKey.values())
      .map((entry) => projectCandidate(entry.row, entry.methods, rankingResolved))
      .sort(sortCandidates)
      .slice(0, effectiveLimit)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

    return {
      contract_version: HYBRID_RETRIEVAL_CONTRACT_VERSION,
      ranking_version: HYBRID_RANKING_VERSION,
      tenant_id: effectiveTenantId,
      query: normalizedQuery || null,
      filters: normalizedFilters,
      limits: {
        result_limit: effectiveLimit,
        lexical_candidate_limit: effectiveLexicalLimit,
        vector_candidate_limit: effectiveVectorLimit,
      },
      ranking: rankingResolved,
      counts: {
        lexical_candidates: lexicalRows.length,
        vector_candidates: vectorRows.length,
        hybrid_candidates: candidates.length,
      },
      candidates,
    };
  }

  return {
    contractVersion: HYBRID_RETRIEVAL_CONTRACT_VERSION,
    rankingVersion: HYBRID_RANKING_VERSION,
    search,
  };
}

module.exports = {
  HYBRID_RETRIEVAL_CONTRACT_VERSION,
  HYBRID_RANKING_VERSION,
  KnowledgeHybridRetrievalError,
  createKnowledgeHybridRetrievalService,
  normalizeQuery,
  tokenize,
  rankingConfig,
};
