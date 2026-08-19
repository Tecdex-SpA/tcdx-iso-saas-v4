'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');

const KNOWLEDGE_DOCUMENT_MODEL_VERSION = 'knowledge-document-model-v1';
const SCOPES = Object.freeze(['GLOBAL', 'REGULATORY', 'TENANT']);
const STATUSES = Object.freeze(['draft', 'indexing', 'active', 'deprecated', 'rejected', 'error']);
const SOURCE_AUTHORITIES = Object.freeze(['tcdx_internal', 'authoritative', 'tenant_private', 'imported', 'derived']);
const VALID_TRANSITIONS = Object.freeze({
  draft: new Set(['indexing', 'active', 'rejected', 'error']),
  indexing: new Set(['active', 'rejected', 'error']),
  active: new Set(['deprecated', 'error']),
  deprecated: new Set([]),
  rejected: new Set([]),
  error: new Set(['draft']),
});

class KnowledgeDocumentError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asText(value, max = 1000) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function normalizeScope(value) {
  const scope = String(value || '').trim().toUpperCase();
  return SCOPES.includes(scope) ? scope : null;
}

function normalizeStatus(value) {
  const status = String(value || 'draft').trim().toLowerCase();
  return STATUSES.includes(status) ? status : null;
}

function normalizeAuthority(value, scope) {
  const authority = String(value || '').trim().toLowerCase();
  if (SOURCE_AUTHORITIES.includes(authority)) return authority;
  if (scope === 'TENANT') return 'tenant_private';
  if (scope === 'REGULATORY') return 'authoritative';
  return 'tcdx_internal';
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

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sha256Stable(value) {
  return sha256(JSON.stringify(stable(value)));
}

function assertSha256(value, field, required = false) {
  const text = asText(value, 64);
  if (!text && !required) return null;
  if (!/^[a-f0-9]{64}$/.test(text || '')) {
    throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_CHECKSUM_INVALID', `${field} debe ser sha256 hex de 64 caracteres.`);
  }
  return text;
}

function parseOptionalTimestamp(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TIMESTAMP_INVALID', `${field} inválido.`);
  }
  return date.toISOString();
}

function assertUuid(value, field = 'tenant_id') {
  const text = asText(value, 80);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text || '')) {
    throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_UUID_INVALID', `${field} inválido.`);
  }
  return text;
}

function documentKey(body = {}) {
  const explicit = asText(body.document_key || body.key, 200);
  if (explicit) return explicit;
  const title = asText(body.title, 300);
  const type = asText(body.document_type, 120);
  const scope = normalizeScope(body.scope);
  if (!title || !type || !scope) return null;
  return [scope, type, title]
    .join(':')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

function computeContentChecksum(body = {}) {
  if (body.content_checksum) return body.content_checksum;
  return sha256Stable({
    title: asText(body.title, 300),
    document_type: asText(body.document_type, 120),
    classification: asText(body.classification, 120),
    source_uri_or_reference: asText(body.source_uri_or_reference, 2000),
    extracted_text_reference: asText(body.extracted_text_reference, 2000),
    extracted_text_checksum: asText(body.extracted_text_checksum, 64),
    metadata: asObject(body.metadata),
  });
}

function normalizeDocumentInput(body = {}, { previous = null } = {}) {
  const scope = normalizeScope(body.scope || previous?.scope);
  if (!scope) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_SCOPE_INVALID', 'scope debe ser GLOBAL, REGULATORY o TENANT.');

  const tenantId = body.tenant_id === undefined ? previous?.tenant_id || null : body.tenant_id;
  if (scope === 'TENANT' && !tenantId) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TENANT_REQUIRED', 'TENANT requiere tenant_id.');
  if (scope !== 'TENANT' && tenantId) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TENANT_FORBIDDEN', 'GLOBAL/REGULATORY requieren tenant_id NULL.');

  const status = normalizeStatus(body.status || 'draft');
  if (!status) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_STATUS_INVALID', 'status documental inválido.');

  const authority = normalizeAuthority(body.source_authority, scope);
  if (scope === 'REGULATORY' && authority !== 'authoritative') {
    throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_AUTHORITY_INVALID', 'REGULATORY requiere source_authority authoritative.');
  }

  const effectiveFrom = parseOptionalTimestamp(body.effective_from, 'effective_from');
  const effectiveTo = parseOptionalTimestamp(body.effective_to, 'effective_to');
  if (effectiveFrom && effectiveTo && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_EFFECTIVE_RANGE_INVALID', 'effective_to debe ser posterior a effective_from.');
  }

  const normalized = {
    document_key: documentKey(body),
    scope,
    tenant_id: scope === 'TENANT' ? assertUuid(tenantId, 'tenant_id') : null,
    classification: asText(body.classification || 'internal', 120),
    document_type: asText(body.document_type, 120),
    title: asText(body.title, 300),
    version: asText(body.version, 80),
    status,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    supersedes_document_id: body.supersedes_document_id || previous?.id || null,
    source_authority: authority,
    source_uri_or_reference: asText(body.source_uri_or_reference || body.source_reference, 2000),
    original_file_reference: asText(body.original_file_reference, 2000),
    original_file_checksum: assertSha256(body.original_file_checksum, 'original_file_checksum'),
    extracted_text_reference: asText(body.extracted_text_reference, 2000),
    extracted_text_checksum: assertSha256(body.extracted_text_checksum, 'extracted_text_checksum'),
    content_checksum: assertSha256(computeContentChecksum(body), 'content_checksum', true),
    metadata: {
      ...asObject(body.metadata),
      model_version: KNOWLEDGE_DOCUMENT_MODEL_VERSION,
      operational_attachment_auto_promotion: false,
    },
  };

  if (!normalized.document_key) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_KEY_REQUIRED', 'document_key o title/document_type/scope son obligatorios.');
  if (!normalized.document_type) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TYPE_REQUIRED', 'document_type es obligatorio.');
  if (!normalized.title) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TITLE_REQUIRED', 'title es obligatorio.');
  if (!normalized.version) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_VERSION_REQUIRED', 'version es obligatoria.');
  return normalized;
}

function projectDocument(row = {}) {
  return {
    ...row,
    model_version: KNOWLEDGE_DOCUMENT_MODEL_VERSION,
    operational_attachment_auto_promotion: false,
  };
}

async function insertKnowledgeDocumentRow(client, input) {
  const result = await client.query(
    `INSERT INTO knowledge_documents (
         document_key,scope,tenant_id,classification,document_type,title,version,status,
         effective_from,effective_to,supersedes_document_id,source_authority,source_uri_or_reference,
         original_file_reference,original_file_checksum,extracted_text_reference,extracted_text_checksum,
         content_checksum,metadata
       ) VALUES (
         $1,$2,$3::uuid,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11::uuid,$12,$13,
         $14,$15,$16,$17,$18,$19::jsonb
       )
       RETURNING *`,
    [
      input.document_key, input.scope, input.tenant_id, input.classification, input.document_type,
      input.title, input.version, input.status, input.effective_from, input.effective_to,
      input.supersedes_document_id, input.source_authority, input.source_uri_or_reference,
      input.original_file_reference, input.original_file_checksum, input.extracted_text_reference,
      input.extracted_text_checksum, input.content_checksum, JSON.stringify(input.metadata),
    ]
  );
  return projectDocument(result.rows[0]);
}

function createKnowledgeDocumentService(db = pool) {
  async function createDocument(body = {}) {
    const input = normalizeDocumentInput(body);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const row = await insertKnowledgeDocumentRow(client, input);
      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function getDocumentForTenant({ tenantId = null, documentId }) {
    const result = await db.query(
      `SELECT *
         FROM knowledge_documents
        WHERE id=$1::uuid
          AND (
            scope IN ('GLOBAL','REGULATORY')
            OR (scope='TENANT' AND tenant_id=$2::uuid)
          )
        LIMIT 1`,
      [assertUuid(documentId, 'document_id'), tenantId ? assertUuid(tenantId, 'tenant_id') : null]
    );
    if (!result.rowCount) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento no encontrado para el tenant/contexto solicitado.', 404);
    return projectDocument(result.rows[0]);
  }

  async function listDocuments({ tenantId = null, filters = {} } = {}) {
    const scope = filters.scope ? normalizeScope(filters.scope) : null;
    if (filters.scope && !scope) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_SCOPE_INVALID', 'scope inválido.');
    const status = filters.status ? normalizeStatus(filters.status) : null;
    if (filters.status && !status) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_STATUS_INVALID', 'status inválido.');
    const limit = Math.max(1, Math.min(Number(filters.limit || 50), 100));
    const result = await db.query(
      `SELECT *
         FROM knowledge_documents
        WHERE ($1::text IS NULL OR scope=$1)
          AND ($2::text IS NULL OR status=$2)
          AND (
            scope IN ('GLOBAL','REGULATORY')
            OR (scope='TENANT' AND tenant_id=$3::uuid)
          )
        ORDER BY scope, document_key, version, id
        LIMIT $4`,
      [scope, status, tenantId ? assertUuid(tenantId, 'tenant_id') : null, limit]
    );
    return result.rows.map(projectDocument);
  }

  async function createVersion({ tenantId = null, documentId, body = {} }) {
    const previous = await getDocumentForTenant({ tenantId, documentId });
    const input = normalizeDocumentInput({
      ...body,
      scope: previous.scope,
      tenant_id: previous.tenant_id,
      document_key: previous.document_key,
      document_type: body.document_type || previous.document_type,
      title: body.title || previous.title,
      classification: body.classification || previous.classification,
      source_authority: body.source_authority || previous.source_authority,
      supersedes_document_id: previous.id,
    }, { previous });
    if (String(input.version) === String(previous.version)) {
      throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_VERSION_CONFLICT', 'La nueva versión debe tener identificador distinto.');
    }
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const row = await insertKnowledgeDocumentRow(client, input);
      await client.query('COMMIT');
      return row;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function transitionDocument({ tenantId = null, documentId, status }) {
    const current = await getDocumentForTenant({ tenantId, documentId });
    const next = normalizeStatus(status);
    if (!next) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_STATUS_INVALID', 'status inválido.');
    if (next !== current.status && !VALID_TRANSITIONS[current.status]?.has(next)) {
      throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_TRANSITION_INVALID', 'Transición documental inválida.', 409, {
        from: current.status,
        to: next,
      });
    }
    const result = await db.query(
      `UPDATE knowledge_documents
          SET status=$3,
              updated_at=now(),
              metadata=metadata || $4::jsonb
        WHERE id=$1::uuid
          AND (
            scope IN ('GLOBAL','REGULATORY')
            OR (scope='TENANT' AND tenant_id=$2::uuid)
          )
        RETURNING *`,
      [
        assertUuid(documentId, 'document_id'),
        tenantId ? assertUuid(tenantId, 'tenant_id') : null,
        next,
        JSON.stringify({ last_transition: { from: current.status, to: next }, model_version: KNOWLEDGE_DOCUMENT_MODEL_VERSION }),
      ]
    );
    if (!result.rowCount) throw new KnowledgeDocumentError('KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento no encontrado para transición.', 404);
    return projectDocument(result.rows[0]);
  }

  return {
    modelVersion: KNOWLEDGE_DOCUMENT_MODEL_VERSION,
    createDocument,
    createVersion,
    getDocumentForTenant,
    listDocuments,
    transitionDocument,
  };
}

module.exports = {
  KNOWLEDGE_DOCUMENT_MODEL_VERSION,
  SCOPES,
  STATUSES,
  SOURCE_AUTHORITIES,
  VALID_TRANSITIONS,
  KnowledgeDocumentError,
  normalizeDocumentInput,
  insertKnowledgeDocumentRow,
  createKnowledgeDocumentService,
};
