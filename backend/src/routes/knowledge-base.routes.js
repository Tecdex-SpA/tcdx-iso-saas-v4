const express = require('express');
const { errorDetail } = require('../utils/errorResponse');
const repository = require('../services/knowledge-base/knowledge.repository');
const knowledge = require('../services/knowledge-base/knowledge.service');
const {
  createKnowledgeIngestionService,
} = require('../services/knowledge-base/knowledgeIngestion.service');
const {
  createKnowledgeHybridRetrievalService,
} = require('../services/knowledge-base/knowledgeHybridRetrieval.service');
const {
  createMemoryUpload,
  safeUploadError,
} = require('../utils/secureUpload');

const router = express.Router();
const ingestion = createKnowledgeIngestionService();
const retrieval = createKnowledgeHybridRetrievalService();
const tenantKnowledgeUpload = createMemoryUpload({
  allowedTypes: {
    '.pdf': ['application/pdf'],
    '.txt': ['text/plain'],
    '.md': ['text/plain', 'text/markdown', 'application/octet-stream'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  fileSize: Number(process.env.KNOWLEDGE_INGESTION_MAX_FILE_BYTES || 15 * 1024 * 1024),
  files: 1,
  fields: 20,
  code: 'KNOWLEDGE_INGESTION_FILE_TYPE_NOT_ALLOWED',
  message: 'Tipo documental no soportado para ingestion tenant',
});

function uploadTenantKnowledgeDocument(req, res, next) {
  tenantKnowledgeUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const payload = safeUploadError(error, {
      code: 'KNOWLEDGE_INGESTION_UPLOAD_ERROR',
      sizeCode: 'KNOWLEDGE_INGESTION_FILE_TOO_LARGE',
      sizeMessage: 'El documento excede el tamaño máximo permitido para ingestion tenant',
      message: 'Tipo documental no soportado para ingestion tenant',
    });
    return res.status(payload.status).json({ ok: false, code: payload.code, error: payload.error });
  });
}

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    count: Array.isArray(data) ? data.length : undefined,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error('ERROR KNOWLEDGE BASE:', error);
  }
  return res.status(status).json({
    ok: false,
    code: error.code || 'KNOWLEDGE_BASE_ERROR',
    error: error.message || 'Error consultando Knowledge Base',
    ...errorDetail(error),
  });
}

router.get('/search', async (req, res) => {
  try {
    const rows = await knowledge.searchKnowledge(req.query, { limit: req.query.limit });
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/standards', async (_req, res) => {
  try {
    const rows = await repository.listStandards();
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rows = await repository.listRules(req.query);
    return sendData(res, rows);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/ingestions', async (req, res) => {
  try {
    const rows = await ingestion.listIngestions({ user: req.user, filters: req.query || {} });
    return sendData(res, rows, { contract_version: ingestion.contractVersion });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/ingestions/:id', async (req, res) => {
  try {
    const row = await ingestion.getIngestion({ user: req.user, ingestionId: req.params.id });
    return sendData(res, row, { contract_version: ingestion.contractVersion });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/retrieval/search', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await retrieval.search({
      user: req.user,
      query: body.query || body.q || '',
      queryEmbedding: body.query_embedding || body.queryEmbedding || null,
      filters: body.filters || {},
      embedding: body.embedding || {},
      ranking: body.ranking || {},
      limit: body.limit,
      lexicalLimit: body.lexical_candidate_limit,
      vectorLimit: body.vector_candidate_limit,
    });
    return sendData(res, result.candidates, {
      contract_version: retrieval.contractVersion,
      ranking_version: retrieval.rankingVersion,
      tenant_id: result.tenant_id,
      counts: result.counts,
      limits: result.limits,
      filters: result.filters,
      ranking: result.ranking,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/ingestions', uploadTenantKnowledgeDocument, async (req, res) => {
  try {
    const result = await ingestion.ingestTenantDocument({
      user: req.user,
      file: req.file,
      body: req.body || {},
      requestId: req.requestId || null,
    });
    return res.status(result.replayed ? 200 : 201).json({
      ok: true,
      contract_version: ingestion.contractVersion,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
