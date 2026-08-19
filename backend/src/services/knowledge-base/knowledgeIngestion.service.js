'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../../config/db');
const { sanitizeOriginalName, getSafeExtension } = require('../../utils/secureUpload');
const { extractDocumentContent } = require('../documentContentExtraction.service');
const {
  KnowledgeDocumentError,
  insertKnowledgeDocumentRow,
  normalizeDocumentInput,
} = require('./knowledgeDocument.service');

const KNOWLEDGE_INGESTION_CONTRACT_VERSION = 'knowledge-ingestion-pipeline-v1';
const DEFAULT_STORAGE_ROOT = path.resolve(__dirname, '..', '..', '..', 'uploads', 'knowledge-ingestion');
const MAX_CHUNKS = Number(process.env.KNOWLEDGE_INGESTION_MAX_CHUNKS || 80);
const MAX_CHUNK_CHARS = Number(process.env.KNOWLEDGE_INGESTION_CHUNK_CHARS || 1200);
const SUPPORTED_TYPES = Object.freeze({
  '.pdf': new Set(['application/pdf']),
  '.txt': new Set(['text/plain']),
  '.md': new Set(['text/plain', 'text/markdown', 'application/octet-stream']),
  '.docx': new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
});

class KnowledgeIngestionError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function text(value, max = 1000) {
  const clean = String(value || '').trim();
  return clean ? clean.slice(0, max) : null;
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function sha256Stable(value) {
  return sha256(Buffer.from(JSON.stringify(stable(value))));
}

function assertUuid(value, field) {
  const clean = text(value, 80);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clean || '')) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_UUID_INVALID', `${field} inválido.`, 400, { field });
  }
  return clean;
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function actorIdFromUser(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function detectSupportedType(file = {}) {
  const originalName = file.originalname || file.originalName || file.filename || '';
  const extension = getSafeExtension(originalName);
  const mime = String(file.mimetype || file.mime_type || '').toLowerCase();
  const allowed = SUPPORTED_TYPES[extension];
  if (!allowed || !allowed.has(mime)) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_TYPE_NOT_SUPPORTED', 'Tipo documental no soportado para ingestion tenant.', 400, {
      extension,
      detected_mime: mime,
    });
  }
  return { extension, mime };
}

function validateFileSignature(buffer, { extension, mime }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_FILE_EMPTY', 'El archivo está vacío.');
  }
  if (extension === '.pdf' && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_SIGNATURE_MISMATCH', 'La firma del archivo no coincide con PDF.', 400, { extension, detected_mime: mime });
  }
  if (extension === '.docx' && !buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_SIGNATURE_MISMATCH', 'La firma del archivo no coincide con DOCX.', 400, { extension, detected_mime: mime });
  }
  if ((extension === '.txt' || extension === '.md') && buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0)) {
    throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_SIGNATURE_MISMATCH', 'El archivo de texto contiene bytes nulos.', 400, { extension, detected_mime: mime });
  }
}

function inferClassification({ title, documentType, fileName }) {
  const haystack = `${title || ''} ${documentType || ''} ${fileName || ''}`.toLowerCase();
  if (/pol[ií]tica|policy/.test(haystack)) return 'policy';
  if (/procedimiento|procedure/.test(haystack)) return 'procedure';
  if (/manual/.test(haystack)) return 'manual';
  if (/contrato|contract/.test(haystack)) return 'contract';
  if (/auditor|evidencia|evidence/.test(haystack)) return 'audit_evidence';
  return 'tenant_private_document';
}

function detectSensitiveContent(extractedText) {
  const value = String(extractedText || '');
  const findings = [];
  const secretPatterns = [
    ['password_assignment', /\b(password|passwd|pwd|contrase(?:ñ|n)a)\s*[:=]\s*\S{6,}/i],
    ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/],
    ['api_key_assignment', /\b(api[_-]?key|secret|token)\s*[:=]\s*[A-Za-z0-9._~+/=-]{20,}/i],
    ['private_key_marker', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ];
  const sensitivePatterns = [
    ['email_address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
    ['chile_rut_like', /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/],
  ];

  for (const [code, pattern] of secretPatterns) {
    if (pattern.test(value)) findings.push({ code, severity: 'secret' });
  }
  if (findings.some((finding) => finding.severity === 'secret')) {
    return { classification: 'secret_detected', findings };
  }
  for (const [code, pattern] of sensitivePatterns) {
    if (pattern.test(value)) findings.push({ code, severity: 'sensitive' });
  }
  return {
    classification: findings.length ? 'sensitive' : 'none',
    findings,
  };
}

function cleanExtractedText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function headingFromLine(line) {
  const value = String(line || '').trim();
  if (!value) return null;
  const markdown = value.match(/^#{1,6}\s+(.+)$/);
  if (markdown) return markdown[1].trim().slice(0, 180);
  const numbered = value.match(/^(?:\d+(?:\.\d+)*\.?|[IVXLC]+\.)\s+([A-ZÁÉÍÓÚÑ][^\n]{3,160})$/);
  if (numbered) return numbered[1].trim().slice(0, 180);
  if (value.length <= 120 && value.length >= 6 && value === value.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(value)) {
    return value.slice(0, 180);
  }
  return null;
}

function buildSemanticChunks(rawText, { maxChars = MAX_CHUNK_CHARS, maxChunks = MAX_CHUNKS } = {}) {
  const source = cleanExtractedText(rawText);
  if (!source) return [];
  const chunks = [];
  const blocks = source.split(/\n{2,}/);
  let current = '';
  let currentStart = 0;
  let cursor = 0;
  let currentHeading = null;
  let page = 1;

  function pushChunk(endOffset) {
    const chunkText = current.trim();
    if (!chunkText || chunks.length >= maxChunks) return;
    chunks.push({
      chunk_ordinal: chunks.length,
      chunk_text: chunkText,
      text_checksum: sha256(Buffer.from(chunkText)),
      page_number: page,
      section_label: currentHeading,
      heading: currentHeading,
      source_start_offset: currentStart,
      source_end_offset: Math.max(currentStart, endOffset),
      metadata: {
        chunk_contract_version: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
        chunking_method: 'deterministic-heading-paragraph-v1',
      },
    });
  }

  for (const block of blocks) {
    const trimmed = block.trim();
    const blockStart = source.indexOf(block, cursor);
    const start = blockStart >= 0 ? blockStart : cursor;
    const end = start + block.length;
    cursor = end;
    if (!trimmed) continue;
    if (trimmed.includes('\f')) page += trimmed.split('\f').length - 1;
    const firstLine = trimmed.split('\n')[0];
    const heading = headingFromLine(firstLine);
    if (heading) currentHeading = heading;
    if (!current) currentStart = start;
    if ((current.length + trimmed.length + 2) > maxChars) {
      pushChunk(start);
      current = '';
      currentStart = start;
    }
    current = current ? `${current}\n\n${trimmed}` : trimmed;
  }
  pushChunk(source.length);
  return chunks;
}

async function writeBuffer(filePath, buffer) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer, { flag: 'wx' }).catch(async (error) => {
    if (error.code === 'EEXIST') return;
    throw error;
  });
}

function storageReference(tenantId, checksum, fileName, kind) {
  return `local://knowledge-ingestion/${tenantId}/${checksum}/${kind}/${fileName}`;
}

function ingestionPublic(row = {}) {
  return {
    id: row.id,
    document_id: row.knowledge_document_id,
    tenant_id: row.tenant_id,
    scope: row.scope,
    document_key: row.document_key,
    document_version: row.document_version,
    ingestion_status: row.ingestion_status,
    original_file_reference: row.original_file_reference,
    original_file_checksum: row.original_file_checksum,
    extracted_text_reference: row.extracted_text_reference,
    extracted_text_checksum: row.extracted_text_checksum,
    content_checksum: row.content_checksum,
    detected_mime: row.detected_mime,
    file_size: Number(row.file_size || 0),
    extraction_method: row.extraction_method,
    extraction_status: row.extraction_status,
    classification: row.classification,
    sensitive_classification: row.sensitive_classification,
    chunking_status: row.chunking_status,
    chunk_count: Number(row.chunk_count || 0),
    malware_scan_status: row.malware_scan_status,
    error_code: row.error_code,
    provenance: row.provenance || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    contract_version: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
  };
}

function createKnowledgeIngestionService({
  db = pool,
  storageRoot = DEFAULT_STORAGE_ROOT,
  extractor = extractDocumentContent,
  now = () => new Date(),
} = {}) {
  async function findExisting(client, tenantId, idempotencyKey) {
    const result = await client.query(
      `SELECT *
         FROM knowledge_document_ingestions
        WHERE tenant_id=$1::uuid
          AND idempotency_key=$2
        LIMIT 1`,
      [tenantId, idempotencyKey]
    );
    return result.rows[0] || null;
  }

  async function getPreviousDocument(client, tenantId, documentId) {
    const result = await client.query(
      `SELECT *
         FROM knowledge_documents
        WHERE id=$1::uuid
          AND scope='TENANT'
          AND tenant_id=$2::uuid
        LIMIT 1`,
      [assertUuid(documentId, 'supersedes_document_id'), tenantId]
    );
    if (!result.rowCount) throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_SUPERSEDES_NOT_FOUND', 'Documento previo no encontrado para este tenant.', 404);
    const row = result.rows[0];
    if (['deprecated', 'rejected'].includes(String(row.status || '').toLowerCase())) {
      throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_SUPERSEDES_CLOSED', 'No se puede versionar un documento deprecated/rejected.', 409);
    }
    return row;
  }

  async function insertKnowledgeSource(client, document, sourceMetadata) {
    const sourceKey = `tenant-knowledge-document:${document.id}`;
    await client.query(
      `INSERT INTO knowledge_sources (
         source_key, source_name, source_type, license_class, use_in_system,
         source_file, seed_version, metadata_json, knowledge_document_id, updated_at
       )
       VALUES ($1,$2,'tenant_document_ingestion','tenant_private',ARRAY['tenant_rag_memory']::text[],$3,$4,$5::jsonb,$6::uuid,now())
       ON CONFLICT (source_key)
       DO UPDATE SET
         source_name=EXCLUDED.source_name,
         source_file=EXCLUDED.source_file,
         seed_version=EXCLUDED.seed_version,
         metadata_json=EXCLUDED.metadata_json,
         knowledge_document_id=EXCLUDED.knowledge_document_id,
         updated_at=now()`,
      [
        sourceKey,
        document.title,
        document.original_file_reference,
        KNOWLEDGE_INGESTION_CONTRACT_VERSION,
        JSON.stringify(sourceMetadata),
        document.id,
      ]
    );
    return sourceKey;
  }

  async function insertChunks(client, tenantId, document, chunks) {
    await client.query(
      `DELETE FROM knowledge_document_chunks
        WHERE tenant_id=$1::uuid
          AND knowledge_document_id=$2::uuid
          AND document_version=$3`,
      [tenantId, document.id, document.version]
    );
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO knowledge_document_chunks (
           tenant_id, knowledge_document_id, document_version, chunk_ordinal,
           chunk_text, text_checksum, page_number, section_label, heading,
           source_start_offset, source_end_offset, metadata
         )
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [
          tenantId,
          document.id,
          document.version,
          chunk.chunk_ordinal,
          chunk.chunk_text,
          chunk.text_checksum,
          chunk.page_number,
          chunk.section_label,
          chunk.heading,
          chunk.source_start_offset,
          chunk.source_end_offset,
          JSON.stringify(chunk.metadata || {}),
        ]
      );
    }
  }

  async function insertIngestion(client, payload) {
    const result = await client.query(
      `INSERT INTO knowledge_document_ingestions (
         tenant_id, knowledge_document_id, scope, document_key, document_version,
         ingestion_status, idempotency_key, original_file_reference, original_file_checksum,
         extracted_text_reference, extracted_text_checksum, content_checksum,
         detected_mime, file_size, original_filename, sanitized_filename,
         extraction_method, extraction_status, classification, sensitive_classification,
         chunking_status, chunk_count, malware_scan_status, actor_user_id,
         correlation_id, error_code, provenance
       )
       VALUES (
         $1::uuid,$2::uuid,'TENANT',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
         $22,$23::uuid,$24,$25,$26::jsonb
       )
       RETURNING *`,
      [
        payload.tenant_id,
        payload.knowledge_document_id,
        payload.document_key,
        payload.document_version,
        payload.ingestion_status,
        payload.idempotency_key,
        payload.original_file_reference,
        payload.original_file_checksum,
        payload.extracted_text_reference,
        payload.extracted_text_checksum,
        payload.content_checksum,
        payload.detected_mime,
        payload.file_size,
        payload.original_filename,
        payload.sanitized_filename,
        payload.extraction_method,
        payload.extraction_status,
        payload.classification,
        payload.sensitive_classification,
        payload.chunking_status,
        payload.chunk_count,
        payload.malware_scan_status,
        payload.actor_user_id,
        payload.correlation_id,
        payload.error_code,
        JSON.stringify(payload.provenance || {}),
      ]
    );
    return result.rows[0];
  }

  async function insertAudit(client, payload) {
    await client.query(
      `INSERT INTO knowledge_document_ingestion_audit (
         tenant_id, ingestion_id, knowledge_document_id, action, status, actor_user_id,
         original_file_checksum, extracted_text_checksum, ingestion_contract_version,
         extraction_method, correlation_id, error_code, metadata
       )
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [
        payload.tenant_id,
        payload.ingestion_id,
        payload.knowledge_document_id,
        payload.action,
        payload.status,
        payload.actor_user_id,
        payload.original_file_checksum,
        payload.extracted_text_checksum,
        KNOWLEDGE_INGESTION_CONTRACT_VERSION,
        payload.extraction_method,
        payload.correlation_id,
        payload.error_code,
        JSON.stringify(payload.metadata || {}),
      ]
    );
  }

  async function updateDocumentStatus(client, tenantId, documentId, status, metadata) {
    const result = await client.query(
      `UPDATE knowledge_documents
          SET status=$3,
              metadata=metadata || $4::jsonb,
              updated_at=now()
        WHERE id=$1::uuid
          AND tenant_id=$2::uuid
          AND scope='TENANT'
        RETURNING *`,
      [documentId, tenantId, status, JSON.stringify(metadata || {})]
    );
    return result.rows[0] || null;
  }

  async function ingestTenantDocument({ user, file, body = {}, requestId = null } = {}) {
    const tenantId = assertUuid(tenantIdFromUser(user), 'tenant_id');
    const actorUserId = actorIdFromUser(user) ? assertUuid(actorIdFromUser(user), 'actor_user_id') : null;
    const uploaded = file || {};
    const buffer = uploaded.buffer;
    const type = detectSupportedType(uploaded);
    validateFileSignature(buffer, type);

    const originalFilename = text(uploaded.originalname || uploaded.originalName || 'documento', 240);
    const sanitizedFilename = sanitizeOriginalName(originalFilename, 'tenant-knowledge-document');
    const originalChecksum = sha256(buffer);
    const title = text(body.title, 300) || path.basename(sanitizedFilename, type.extension) || 'Tenant knowledge document';
    const documentType = text(body.document_type, 120) || inferClassification({ title, fileName: sanitizedFilename });
    const version = text(body.version, 80) || 'v1';
    const documentKey = text(body.document_key || body.key, 200) || `tenant-${sha256Stable({ tenantId, documentType, title }).slice(0, 32)}`;
    const idempotencyKey = text(body.idempotency_key, 128) || sha256Stable({
      contract: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
      tenantId,
      documentKey,
      version,
      originalChecksum,
    });

    const client = await db.connect();
    let originalPath = null;
    let extractedPath = null;
    try {
      await client.query('BEGIN');
      const existing = await findExisting(client, tenantId, idempotencyKey);
      if (existing) {
        await insertAudit(client, {
          tenant_id: tenantId,
          ingestion_id: existing.id,
          knowledge_document_id: existing.knowledge_document_id,
          action: 'ingestion.replay',
          status: 'replayed',
          actor_user_id: actorUserId,
          original_file_checksum: existing.original_file_checksum,
          extracted_text_checksum: existing.extracted_text_checksum,
          extraction_method: existing.extraction_method,
          correlation_id: requestId,
          metadata: { replayed_from_ingestion_id: existing.id },
        });
        await client.query('COMMIT');
        return { replayed: true, ingestion: ingestionPublic({ ...existing, ingestion_status: 'replayed' }) };
      }

      const previous = body.supersedes_document_id
        ? await getPreviousDocument(client, tenantId, body.supersedes_document_id)
        : null;
      const storageDir = path.join(storageRoot, tenantId, originalChecksum);
      originalPath = path.join(storageDir, 'original', sanitizedFilename);
      await writeBuffer(originalPath, buffer);
      const originalReference = storageReference(tenantId, originalChecksum, sanitizedFilename, 'original');

      const extracted = await extractor({
        document: {
          provider: 'manual_upload',
          local_storage_path: originalPath,
          file_name: sanitizedFilename,
          mime_type: type.mime,
        },
        integration: null,
      });
      const extractedText = cleanExtractedText(extracted?.text || '');
      const extraction = object(extracted?.extraction);
      const sensitive = detectSensitiveContent(extractedText);
      const extractionStatus = extractedText
        ? 'extracted'
        : (extraction.extraction_type === 'unknown' ? 'not_supported' : 'no_text');
      const secretDetected = sensitive.classification === 'secret_detected';
      const canActivate = extractionStatus === 'extracted' && !secretDetected;
      const extractedChecksum = canActivate ? sha256(Buffer.from(extractedText)) : null;
      const contentChecksum = extractedChecksum || originalChecksum;
      const extractedReference = extractedChecksum
        ? storageReference(tenantId, extractedChecksum, `${path.basename(sanitizedFilename, type.extension)}.txt`, 'extracted')
        : null;
      if (canActivate) {
        extractedPath = path.join(storageRoot, tenantId, originalChecksum, 'extracted', `${path.basename(sanitizedFilename, type.extension)}.txt`);
        await writeBuffer(extractedPath, Buffer.from(extractedText, 'utf8'));
      }
      const chunks = canActivate ? buildSemanticChunks(extractedText) : [];
      const documentStatus = secretDetected ? 'rejected' : (canActivate && chunks.length ? 'indexing' : 'error');
      const finalDocumentStatus = secretDetected ? 'rejected' : (canActivate && chunks.length ? 'active' : 'error');
      const ingestionStatus = secretDetected ? 'rejected' : (canActivate && chunks.length ? 'completed' : 'error');
      const errorCode = secretDetected
        ? 'KNOWLEDGE_INGESTION_SECRET_DETECTED'
        : (!extractedText ? 'KNOWLEDGE_INGESTION_NO_EXTRACTED_TEXT' : null);

      const documentInput = normalizeDocumentInput({
        scope: 'TENANT',
        tenant_id: tenantId,
        document_key: previous?.document_key || documentKey,
        classification: text(body.classification, 120) || 'tenant_private',
        document_type: previous?.document_type || documentType,
        title: previous?.title || title,
        version,
        status: documentStatus,
        effective_from: body.effective_from || now().toISOString(),
        effective_to: body.effective_to || null,
        supersedes_document_id: previous?.id || null,
        source_authority: 'tenant_private',
        source_uri_or_reference: originalReference,
        original_file_reference: originalReference,
        original_file_checksum: originalChecksum,
        extracted_text_reference: extractedReference,
        extracted_text_checksum: extractedChecksum,
        content_checksum: contentChecksum,
        metadata: {
          ingestion_contract_version: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
          ingestion_lifecycle_path: documentStatus === 'indexing' ? ['draft', 'indexing', finalDocumentStatus] : ['draft', finalDocumentStatus],
          detected_mime: type.mime,
          file_size: Number(uploaded.size || buffer.length),
          malware_scan_status: 'not_available',
          sensitive_classification: sensitive.classification,
          sensitive_findings: sensitive.findings.map((finding) => finding.code),
          extraction,
          operational_attachment_auto_promotion: false,
        },
      });
      const document = await insertKnowledgeDocumentRow(client, documentInput);
      const activeDocument = finalDocumentStatus === document.status
        ? document
        : await updateDocumentStatus(client, tenantId, document.id, finalDocumentStatus, {
          ingestion_contract_version: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
          ingestion_finalized_at: now().toISOString(),
        });
      const sourceKey = finalDocumentStatus === 'active'
        ? await insertKnowledgeSource(client, activeDocument, {
          ingestion_contract_version: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
          tenant_id: tenantId,
          document_id: activeDocument.id,
          source_kind: 'tenant_private_ingestion',
          original_file_reference: originalReference,
          extracted_text_reference: extractedReference,
          content_checksum: contentChecksum,
        })
        : null;
      if (finalDocumentStatus === 'active') await insertChunks(client, tenantId, activeDocument, chunks);
      const ingestionRow = await insertIngestion(client, {
        tenant_id: tenantId,
        knowledge_document_id: activeDocument.id,
        document_key: activeDocument.document_key,
        document_version: activeDocument.version,
        ingestion_status: ingestionStatus,
        idempotency_key: idempotencyKey,
        original_file_reference: originalReference,
        original_file_checksum: originalChecksum,
        extracted_text_reference: extractedReference,
        extracted_text_checksum: extractedChecksum,
        content_checksum: contentChecksum,
        detected_mime: type.mime,
        file_size: Number(uploaded.size || buffer.length),
        original_filename: originalFilename,
        sanitized_filename: sanitizedFilename,
        extraction_method: extraction.method || extraction.parser || 'local_storage_extract',
        extraction_status: extractionStatus,
        classification: documentType,
        sensitive_classification: sensitive.classification,
        chunking_status: chunks.length ? 'chunked' : (extractedText ? 'skipped' : 'no_text'),
        chunk_count: chunks.length,
        malware_scan_status: 'not_available',
        actor_user_id: actorUserId,
        correlation_id: requestId,
        error_code: errorCode,
        provenance: {
          request_id: requestId,
          source_key: sourceKey,
          storage: { original: originalReference, extracted: extractedReference },
          extraction,
          sensitive_findings: sensitive.findings.map((finding) => finding.code),
          chunking_method: 'deterministic-heading-paragraph-v1',
          vectorization: { pgvector_implemented: false, embeddings_implemented: false },
        },
      });
      await insertAudit(client, {
        tenant_id: tenantId,
        ingestion_id: ingestionRow.id,
        knowledge_document_id: activeDocument.id,
        action: 'ingestion.completed',
        status: ingestionStatus,
        actor_user_id: actorUserId,
        original_file_checksum: originalChecksum,
        extracted_text_checksum: extractedChecksum,
        extraction_method: extraction.method || extraction.parser || 'local_storage_extract',
        correlation_id: requestId,
        error_code: errorCode,
        metadata: {
          chunk_count: chunks.length,
          source_key: sourceKey,
          sensitive_classification: sensitive.classification,
          malware_scan_status: 'not_available',
        },
      });
      await client.query('COMMIT');
      return {
        replayed: false,
        ingestion: ingestionPublic(ingestionRow),
        document: activeDocument,
        chunks: chunks.map((chunk) => ({
          chunk_ordinal: chunk.chunk_ordinal,
          text_checksum: chunk.text_checksum,
          page_number: chunk.page_number,
          section_label: chunk.section_label,
          heading: chunk.heading,
          source_start_offset: chunk.source_start_offset,
          source_end_offset: chunk.source_end_offset,
        })),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function listIngestions({ user, filters = {} } = {}) {
    const tenantId = assertUuid(tenantIdFromUser(user), 'tenant_id');
    const limit = Math.max(1, Math.min(Number(filters.limit || 50), 100));
    const result = await db.query(
      `SELECT *
         FROM knowledge_document_ingestions
        WHERE tenant_id=$1::uuid
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows.map(ingestionPublic);
  }

  async function getIngestion({ user, ingestionId } = {}) {
    const tenantId = assertUuid(tenantIdFromUser(user), 'tenant_id');
    const result = await db.query(
      `SELECT *
         FROM knowledge_document_ingestions
        WHERE tenant_id=$1::uuid
          AND id=$2::uuid
        LIMIT 1`,
      [tenantId, assertUuid(ingestionId, 'ingestion_id')]
    );
    if (!result.rowCount) throw new KnowledgeIngestionError('KNOWLEDGE_INGESTION_NOT_FOUND', 'Ingestion no encontrada para este tenant.', 404);
    return ingestionPublic(result.rows[0]);
  }

  return {
    contractVersion: KNOWLEDGE_INGESTION_CONTRACT_VERSION,
    ingestTenantDocument,
    listIngestions,
    getIngestion,
  };
}

module.exports = {
  KNOWLEDGE_INGESTION_CONTRACT_VERSION,
  SUPPORTED_TYPES,
  KnowledgeIngestionError,
  buildSemanticChunks,
  detectSensitiveContent,
  createKnowledgeIngestionService,
};
