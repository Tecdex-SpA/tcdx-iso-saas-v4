'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');
const {
  insertKnowledgeDocumentRow,
  normalizeDocumentInput,
} = require('./knowledgeDocument.service');

const AUTHORITATIVE_SOURCE_REGISTRY_VERSION = 'authoritative-source-registry-v1';
const REGULATORY_INGESTION_CONTRACT_VERSION = 'regulatory-ingestion-contract-v1';
const REGULATION_MODEL_VERSION = 'regulation-model-v1';
const REGULATION_VERSION_MODEL_VERSION = 'regulation-version-model-v1';
const LEGAL_OBLIGATION_MODEL_VERSION = 'legal-obligation-model-v1';

const SOURCE_SCOPES = Object.freeze(['GLOBAL', 'JURISDICTIONAL', 'TENANT_PRIVATE']);
const SOURCE_CLASSIFICATIONS = Object.freeze(['AUTHORITATIVE', 'APPROVED_REFERENCE', 'INFORMATIONAL']);
const INGESTION_METHODS = Object.freeze(['manual_upload', 'official_url_fetch', 'api', 'registry_reference']);
const SOURCE_STATUSES = Object.freeze(['draft', 'active', 'deprecated', 'rejected', 'error']);
const REGULATION_STATUSES = Object.freeze(['draft', 'reviewed', 'published', 'deprecated', 'rejected', 'error']);
const MAX_CHUNKS = Number(process.env.REGULATORY_INGESTION_MAX_CHUNKS || 160);
const MAX_CHUNK_CHARS = Number(process.env.REGULATORY_INGESTION_CHUNK_CHARS || 1600);

class RegulatoryFoundationError extends Error {
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
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function assertUuid(value, field = 'id') {
  const clean = text(value, 80);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clean || '')) {
    throw new RegulatoryFoundationError('REGULATORY_UUID_INVALID', `${field} invalido.`, 400, { field });
  }
  return clean;
}

function assertSha256(value, field, required = false) {
  const clean = text(value, 64);
  if (!clean && !required) return null;
  if (!/^[a-f0-9]{64}$/.test(clean || '')) {
    throw new RegulatoryFoundationError('REGULATORY_CHECKSUM_INVALID', `${field} debe ser sha256 hex de 64 caracteres.`, 400, { field });
  }
  return clean;
}

function parseTimestamp(value, field, required = false) {
  if (!value && !required) return null;
  const date = new Date(value || Date.now());
  if (!Number.isFinite(date.getTime())) {
    throw new RegulatoryFoundationError('REGULATORY_TIMESTAMP_INVALID', `${field} invalido.`, 400, { field });
  }
  return date.toISOString();
}

function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RegulatoryFoundationError('REGULATORY_DATE_INVALID', `${field} invalido.`, 400, { field });
  }
  return date.toISOString().slice(0, 10);
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function actorIdFromUser(user = {}) {
  const id = user.id || user.user_id || user.userId || user.sub || null;
  return id ? assertUuid(id, 'actor_user_id') : null;
}

function slug(value, max = 180) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

function normalizeEnum(value, allowed, fallback, field) {
  const normalized = String(value || fallback || '').trim();
  if (!allowed.includes(normalized)) {
    throw new RegulatoryFoundationError('REGULATORY_ENUM_INVALID', `${field} invalido.`, 400, {
      field,
      allowed,
    });
  }
  return normalized;
}

function normalizeSourceInput(body = {}, { user = {} } = {}) {
  const scope = normalizeEnum(String(body.scope || 'JURISDICTIONAL').toUpperCase(), SOURCE_SCOPES, 'JURISDICTIONAL', 'scope');
  const tenantId = scope === 'TENANT_PRIVATE' ? assertUuid(body.tenant_id || body.tenantId || tenantIdFromUser(user), 'tenant_id') : null;
  if (scope !== 'TENANT_PRIVATE' && (body.tenant_id || body.tenantId)) {
    throw new RegulatoryFoundationError('REGULATORY_SOURCE_TENANT_FORBIDDEN', 'GLOBAL/JURISDICTIONAL no aceptan tenant_id.', 400);
  }
  const authorityClassification = normalizeEnum(
    String(body.authority_classification || body.authorityClassification || 'INFORMATIONAL').toUpperCase(),
    SOURCE_CLASSIFICATIONS,
    'INFORMATIONAL',
    'authority_classification'
  );
  const allowedMethod = normalizeEnum(
    String(body.allowed_ingestion_method || body.allowedIngestionMethod || 'registry_reference'),
    INGESTION_METHODS,
    'registry_reference',
    'allowed_ingestion_method'
  );
  const status = normalizeEnum(String(body.status || 'draft').toLowerCase(), SOURCE_STATUSES, 'draft', 'status');
  const officialName = text(body.official_name || body.officialName || body.source_name, 300);
  const jurisdiction = text(body.jurisdiction, 120);
  const stableIdentifier = text(body.stable_identifier || body.stableIdentifier || body.source_identifier, 220);
  const sourceKey = text(body.source_key || body.sourceKey, 180) || slug([scope, jurisdiction, stableIdentifier, officialName].filter(Boolean).join(':'));
  const source = {
    source_key: sourceKey,
    scope,
    tenant_id: tenantId,
    authority_classification: authorityClassification,
    authority_type: text(body.authority_type || body.authorityType, 120),
    jurisdiction,
    country_region: text(body.country_region || body.countryRegion, 120),
    issuing_authority: text(body.issuing_authority || body.issuingAuthority, 240),
    official_name: officialName,
    stable_identifier: stableIdentifier,
    official_domain: text(body.official_domain || body.officialDomain, 240),
    official_source_uri: text(body.official_source_uri || body.officialSourceUri || body.source_uri, 2000),
    allowed_ingestion_method: allowedMethod,
    content_type: text(body.content_type || body.contentType, 120),
    status,
    effective_from: parseTimestamp(body.effective_from || body.effectiveFrom, 'effective_from'),
    effective_to: parseTimestamp(body.effective_to || body.effectiveTo, 'effective_to'),
    owner: text(body.owner, 160) || 'CODEX_B_REGULATORY',
    metadata: {
      ...object(body.metadata),
      registry_version: AUTHORITATIVE_SOURCE_REGISTRY_VERSION,
      general_web_is_not_authoritative: true,
    },
    provenance: {
      ...object(body.provenance),
      created_by_contract: AUTHORITATIVE_SOURCE_REGISTRY_VERSION,
      ai_regulatory_truth_authority: false,
    },
    health_status: text(body.health_status || body.healthStatus, 40) || 'unknown',
  };
  for (const field of ['source_key', 'authority_type', 'jurisdiction', 'issuing_authority', 'official_name', 'stable_identifier', 'official_domain', 'official_source_uri']) {
    if (!source[field]) throw new RegulatoryFoundationError('REGULATORY_SOURCE_FIELD_REQUIRED', `${field} es requerido.`, 400, { field });
  }
  return source;
}

function normalizeRegulationInput(body = {}, source) {
  const jurisdiction = text(body.jurisdiction, 120) || source.jurisdiction;
  const officialIdentifier = text(body.official_identifier || body.officialIdentifier || body.regulation_source_identifier, 220);
  const officialTitle = text(body.official_title || body.officialTitle || body.title, 300);
  const regulationKey = text(body.regulation_key || body.regulationKey, 220) || slug([jurisdiction, source.stable_identifier, officialIdentifier, officialTitle].filter(Boolean).join(':'));
  const status = normalizeEnum(String(body.status || 'draft').toLowerCase(), REGULATION_STATUSES, 'draft', 'regulation.status');
  return {
    regulation_key: regulationKey,
    scope: source.scope,
    tenant_id: source.tenant_id,
    jurisdiction,
    source_id: source.id,
    issuing_authority: text(body.issuing_authority || body.issuingAuthority, 240) || source.issuing_authority,
    official_identifier: officialIdentifier,
    official_title: officialTitle,
    regulation_type: text(body.regulation_type || body.regulationType, 120),
    status,
    metadata: {
      ...object(body.metadata),
      model_version: REGULATION_MODEL_VERSION,
    },
    provenance: {
      ...object(body.provenance),
      source_id: source.id,
      source_key: source.source_key,
    },
  };
}

function normalizeObligationInput(body = {}, { regulation, version, chunk }) {
  const obligationText = text(body.obligation_text || body.text, 10000);
  if (!obligationText) throw new RegulatoryFoundationError('LEGAL_OBLIGATION_TEXT_REQUIRED', 'obligation_text es requerido.', 400);
  const reference = text(body.reference || body.article || body.section, 220);
  const obligationKey = text(body.obligation_key || body.obligationKey, 220) || slug([regulation.regulation_key, version.version_identifier, reference || obligationText.slice(0, 80)].join(':'));
  const status = normalizeEnum(String(body.lifecycle_status || body.status || 'draft').toLowerCase(), REGULATION_STATUSES, 'draft', 'obligation.lifecycle_status');
  return {
    obligation_key: obligationKey,
    reference,
    obligation_text: obligationText,
    obligation_text_checksum: sha256(obligationText),
    subject: text(body.subject, 240),
    action_type: text(body.action_type || body.actionType, 160),
    requirement_summary: text(body.requirement_summary || body.requirementSummary, 1000),
    applicability: object(body.applicability),
    effective_from: parseTimestamp(body.effective_from || body.effectiveFrom, 'obligation.effective_from') || version.effective_from,
    effective_to: parseTimestamp(body.effective_to || body.effectiveTo, 'obligation.effective_to') || version.effective_to,
    source_chunk_id: body.source_chunk_id || chunk?.id || null,
    source_text_checksum: body.source_text_checksum || chunk?.text_checksum || null,
    lifecycle_status: status,
    reviewed_by: body.reviewed_by ? assertUuid(body.reviewed_by, 'reviewed_by') : null,
    reviewed_at: parseTimestamp(body.reviewed_at || body.reviewedAt, 'reviewed_at'),
    provenance: {
      ...object(body.provenance),
      model_version: LEGAL_OBLIGATION_MODEL_VERSION,
      ai_legal_obligation_publish_authority: false,
    },
    metadata: {
      ...object(body.metadata),
      model_version: LEGAL_OBLIGATION_MODEL_VERSION,
    },
  };
}

function normalizeArtifactInput(input = {}, source) {
  if (source.authority_classification !== 'AUTHORITATIVE') {
    throw new RegulatoryFoundationError('REGULATORY_SOURCE_NOT_AUTHORITATIVE', 'Sólo fuentes AUTHORITATIVE pueden crear verdad regulatoria canónica.', 409, {
      source_id: source.id,
      authority_classification: source.authority_classification,
    });
  }
  if (source.status !== 'active') {
    throw new RegulatoryFoundationError('REGULATORY_SOURCE_NOT_ACTIVE', 'La fuente regulatoria debe estar active para ingestión canónica.', 409, {
      source_id: source.id,
      status: source.status,
    });
  }
  const extractedText = text(input.extracted_text || input.content || input.text, 300000);
  if (!extractedText) throw new RegulatoryFoundationError('REGULATORY_ARTIFACT_TEXT_REQUIRED', 'extracted_text/content es requerido.', 400);
  const versionIdentifier = text(input.version_identifier || input.version || input.publication_date, 120);
  if (!versionIdentifier) throw new RegulatoryFoundationError('REGULATORY_ARTIFACT_VERSION_REQUIRED', 'version_identifier es requerido.', 400);
  const regulationIdentifier = text(input.regulation_source_identifier || input.official_identifier, 220);
  if (!regulationIdentifier) throw new RegulatoryFoundationError('REGULATORY_ARTIFACT_IDENTIFIER_REQUIRED', 'regulation_source_identifier es requerido.', 400);
  const contentChecksum = assertSha256(input.content_checksum || sha256(extractedText), 'content_checksum', true);
  return {
    extracted_text: extractedText,
    version_identifier: versionIdentifier,
    regulation_source_identifier: regulationIdentifier,
    title: text(input.title, 300),
    retrieved_uri: text(input.retrieved_uri || input.source_uri || source.official_source_uri, 2000),
    original_artifact_reference: text(input.original_artifact_reference || input.original_file_reference, 2000),
    original_artifact_checksum: assertSha256(input.original_artifact_checksum || input.original_file_checksum || contentChecksum, 'original_artifact_checksum'),
    extracted_text_reference: text(input.extracted_text_reference, 2000),
    extracted_text_checksum: assertSha256(input.extracted_text_checksum || contentChecksum, 'extracted_text_checksum'),
    content_checksum: contentChecksum,
    acquired_at: parseTimestamp(input.acquired_at, 'acquired_at') || new Date().toISOString(),
    publication_date: parseDate(input.publication_date, 'publication_date'),
    effective_from: parseTimestamp(input.effective_from, 'effective_from'),
    effective_to: parseTimestamp(input.effective_to, 'effective_to'),
    parser_version: text(input.parser_version, 120) || 'regulatory-foundation-parser-v1',
    extraction_method: text(input.extraction_method, 120) || 'governed_explicit_text',
    provenance: {
      ...object(input.provenance),
      ingestion_contract_version: REGULATORY_INGESTION_CONTRACT_VERSION,
      source_registry_id: source.id,
      source_registry_key: source.source_key,
    },
    metadata: object(input.metadata),
  };
}

function chunkText(value) {
  const paragraphs = String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const chunks = [];
  let offset = 0;
  for (const paragraph of paragraphs) {
    for (let start = 0; start < paragraph.length; start += MAX_CHUNK_CHARS) {
      if (chunks.length >= MAX_CHUNKS) return chunks;
      const textPart = paragraph.slice(start, start + MAX_CHUNK_CHARS).trim();
      if (!textPart) continue;
      chunks.push({
        chunk_ordinal: chunks.length,
        chunk_text: textPart,
        text_checksum: sha256(textPart),
        section_label: null,
        heading: null,
        source_start_offset: offset + start,
        source_end_offset: offset + start + textPart.length,
        metadata: {
          chunking_contract: 'regulatory-deterministic-chunking-v1',
        },
      });
    }
    offset += paragraph.length + 2;
  }
  return chunks;
}

async function fetchSource(client, { sourceId = null, sourceKey = null, tenantId = null }) {
  const result = await client.query(
    `SELECT *
       FROM regulatory_authoritative_sources
      WHERE ($1::uuid IS NULL OR id=$1::uuid)
        AND ($2::text IS NULL OR source_key=$2)
        AND (
          scope IN ('GLOBAL','JURISDICTIONAL')
          OR (scope='TENANT_PRIVATE' AND tenant_id=$3::uuid)
        )
      ORDER BY created_at DESC
      LIMIT 1`,
    [sourceId ? assertUuid(sourceId, 'source_id') : null, sourceKey || null, tenantId ? assertUuid(tenantId, 'tenant_id') : null]
  );
  if (!result.rowCount) throw new RegulatoryFoundationError('REGULATORY_SOURCE_NOT_FOUND', 'Fuente regulatoria no encontrada para el contexto.', 404);
  return result.rows[0];
}

async function insertChunks(client, { document, artifact }) {
  const chunks = chunkText(artifact.extracted_text);
  const inserted = [];
  for (const chunk of chunks) {
    const result = await client.query(
      `INSERT INTO knowledge_document_chunks (
         scope,tenant_id,knowledge_document_id,document_version,chunk_ordinal,chunk_text,text_checksum,
         page_number,section_label,heading,source_start_offset,source_end_offset,metadata
       ) VALUES (
         'REGULATORY',NULL,$1::uuid,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10::jsonb
       )
       RETURNING id, text_checksum`,
      [
        document.id,
        document.version,
        chunk.chunk_ordinal,
        chunk.chunk_text,
        chunk.text_checksum,
        chunk.section_label,
        chunk.heading,
        chunk.source_start_offset,
        chunk.source_end_offset,
        JSON.stringify(chunk.metadata),
      ]
    );
    inserted.push({ ...chunk, ...result.rows[0] });
  }
  return inserted;
}

function createRegulatoryFoundationService({ db = pool } = {}) {
  async function registerSource({ user = {}, body = {} } = {}) {
    const input = normalizeSourceInput(body, { user });
    const existing = await db.query(
      `SELECT id
         FROM regulatory_authoritative_sources
        WHERE scope=$1
          AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)=COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          AND source_key=$3
        LIMIT 1`,
      [input.scope, input.tenant_id, input.source_key]
    );
    const values = [
      input.source_key, input.scope, input.tenant_id, input.authority_classification, input.authority_type,
      input.jurisdiction, input.country_region, input.issuing_authority, input.official_name, input.stable_identifier,
      input.official_domain, input.official_source_uri, input.allowed_ingestion_method, input.content_type,
      input.status, input.effective_from, input.effective_to, input.owner, JSON.stringify(input.metadata),
      JSON.stringify(input.provenance), input.health_status,
    ];
    const result = existing.rowCount
      ? await db.query(
        `UPDATE regulatory_authoritative_sources
            SET authority_classification=$4,
                authority_type=$5,
                jurisdiction=$6,
                country_region=$7,
                issuing_authority=$8,
                official_name=$9,
                stable_identifier=$10,
                official_domain=$11,
                official_source_uri=$12,
                allowed_ingestion_method=$13,
                content_type=$14,
                status=$15,
                effective_from=$16::timestamptz,
                effective_to=$17::timestamptz,
                owner=$18,
                metadata=$19::jsonb,
                provenance=$20::jsonb,
                health_status=$21,
                updated_at=now()
          WHERE id=$22::uuid
          RETURNING *`,
        [...values, existing.rows[0].id]
      )
      : await db.query(
      `INSERT INTO regulatory_authoritative_sources (
         source_key,scope,tenant_id,authority_classification,authority_type,jurisdiction,country_region,
         issuing_authority,official_name,stable_identifier,official_domain,official_source_uri,
         allowed_ingestion_method,content_type,status,effective_from,effective_to,owner,metadata,provenance,health_status
       ) VALUES (
         $1,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::timestamptz,$17::timestamptz,$18,$19::jsonb,$20::jsonb,$21
       )
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async function listSources({ user = {}, filters = {} } = {}) {
    const tenantId = tenantIdFromUser(user);
    const result = await db.query(
      `SELECT *
         FROM regulatory_authoritative_sources
        WHERE ($1::text IS NULL OR jurisdiction=$1)
          AND ($2::text IS NULL OR authority_classification=$2)
          AND (
            scope IN ('GLOBAL','JURISDICTIONAL')
            OR (scope='TENANT_PRIVATE' AND tenant_id=$3::uuid)
          )
        ORDER BY jurisdiction, source_key, id
        LIMIT $4`,
      [
        text(filters.jurisdiction, 120),
        filters.authority_classification ? normalizeEnum(String(filters.authority_classification).toUpperCase(), SOURCE_CLASSIFICATIONS, null, 'authority_classification') : null,
        tenantId ? assertUuid(tenantId, 'tenant_id') : null,
        Math.max(1, Math.min(Number(filters.limit || 50), 100)),
      ]
    );
    return result.rows;
  }

  async function ingestRegulatoryArtifact({ user = {}, sourceId = null, sourceKey = null, artifact = {}, regulation = {}, obligations = [], requestId = null } = {}) {
    const tenantId = tenantIdFromUser(user);
    const actorUserId = actorIdFromUser(user);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const source = await fetchSource(client, { sourceId, sourceKey, tenantId });
      const normalizedArtifact = normalizeArtifactInput(artifact, source);
      const normalizedRegulation = normalizeRegulationInput({
        ...regulation,
        regulation_source_identifier: normalizedArtifact.regulation_source_identifier,
        title: regulation.title || normalizedArtifact.title,
      }, source);
      if (!normalizedRegulation.official_identifier || !normalizedRegulation.official_title || !normalizedRegulation.regulation_type) {
        throw new RegulatoryFoundationError('REGULATION_FIELD_REQUIRED', 'official_identifier, official_title y regulation_type son requeridos.', 400);
      }

      const previousDoc = await client.query(
        `SELECT id, version
           FROM knowledge_documents
          WHERE scope='REGULATORY'
            AND tenant_id IS NULL
            AND document_key=$1
          ORDER BY created_at DESC
          LIMIT 1`,
        [normalizedRegulation.regulation_key]
      );
      const previousDocumentId = previousDoc.rows[0]?.id || null;

      const documentInput = normalizeDocumentInput({
        scope: 'REGULATORY',
        document_key: normalizedRegulation.regulation_key,
        classification: 'regulatory',
        document_type: 'regulation',
        title: normalizedRegulation.official_title,
        version: normalizedArtifact.version_identifier,
        status: 'active',
        effective_from: normalizedArtifact.effective_from,
        effective_to: normalizedArtifact.effective_to,
        supersedes_document_id: previousDocumentId,
        source_authority: 'authoritative',
        source_uri_or_reference: normalizedArtifact.retrieved_uri,
        original_file_reference: normalizedArtifact.original_artifact_reference,
        original_file_checksum: normalizedArtifact.original_artifact_checksum,
        extracted_text_reference: normalizedArtifact.extracted_text_reference,
        extracted_text_checksum: normalizedArtifact.extracted_text_checksum,
        content_checksum: normalizedArtifact.content_checksum,
        metadata: {
          ...normalizedArtifact.metadata,
          regulatory_source_id: source.id,
          regulatory_source_key: source.source_key,
          regulatory_ingestion_contract_version: REGULATORY_INGESTION_CONTRACT_VERSION,
          jurisdiction: source.jurisdiction,
        },
      });
      const document = await insertKnowledgeDocumentRow(client, documentInput);

      const ingestionResult = await client.query(
        `INSERT INTO regulatory_ingestions (
           source_id,scope,tenant_id,knowledge_document_id,regulation_source_identifier,version_identifier,
           retrieved_uri,original_artifact_reference,original_artifact_checksum,extracted_text_reference,
           extracted_text_checksum,content_checksum,acquired_at,publication_date,effective_from,effective_to,
           ingestion_contract_version,parser_version,extraction_method,lifecycle_status,provenance,actor_user_id,correlation_id
         ) VALUES (
           $1::uuid,'REGULATORY',NULL,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::date,
           $13::timestamptz,$14::timestamptz,$15,$16,$17,'active',$18::jsonb,$19::uuid,$20
         )
         RETURNING *`,
        [
          source.id, document.id, normalizedArtifact.regulation_source_identifier, normalizedArtifact.version_identifier,
          normalizedArtifact.retrieved_uri, normalizedArtifact.original_artifact_reference, normalizedArtifact.original_artifact_checksum,
          normalizedArtifact.extracted_text_reference, normalizedArtifact.extracted_text_checksum, normalizedArtifact.content_checksum,
          normalizedArtifact.acquired_at, normalizedArtifact.publication_date, normalizedArtifact.effective_from,
          normalizedArtifact.effective_to, REGULATORY_INGESTION_CONTRACT_VERSION, normalizedArtifact.parser_version,
          normalizedArtifact.extraction_method, JSON.stringify(normalizedArtifact.provenance), actorUserId, requestId,
        ]
      );
      const ingestion = ingestionResult.rows[0];
      const chunks = await insertChunks(client, { document, artifact: normalizedArtifact });

      const existingRegulation = await client.query(
        `SELECT id
           FROM regulations
          WHERE scope=$1
            AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)=COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
            AND regulation_key=$3
          LIMIT 1`,
        [normalizedRegulation.scope, normalizedRegulation.tenant_id, normalizedRegulation.regulation_key]
      );
      const regulationValues = [
        normalizedRegulation.regulation_key, normalizedRegulation.scope, normalizedRegulation.tenant_id,
        normalizedRegulation.jurisdiction, normalizedRegulation.source_id, normalizedRegulation.issuing_authority,
        normalizedRegulation.official_identifier, normalizedRegulation.official_title, normalizedRegulation.regulation_type,
        normalizedRegulation.status, JSON.stringify(normalizedRegulation.metadata), JSON.stringify(normalizedRegulation.provenance),
      ];
      const regulationResult = existingRegulation.rowCount
        ? await client.query(
          `UPDATE regulations
              SET jurisdiction=$4,
                  source_id=$5::uuid,
                  issuing_authority=$6,
                  official_identifier=$7,
                  official_title=$8,
                  regulation_type=$9,
                  status=$10,
                  metadata=$11::jsonb,
                  provenance=$12::jsonb,
                  updated_at=now()
            WHERE id=$13::uuid
            RETURNING *`,
          [...regulationValues, existingRegulation.rows[0].id]
        )
        : await client.query(
        `INSERT INTO regulations (
           regulation_key,scope,tenant_id,jurisdiction,source_id,issuing_authority,official_identifier,
           official_title,regulation_type,status,metadata,provenance
         ) VALUES ($1,$2,$3::uuid,$4,$5::uuid,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
         RETURNING *`,
        regulationValues
      );
      const regulationRow = regulationResult.rows[0];

      const previousVersion = await client.query(
        `SELECT id
           FROM regulation_versions
          WHERE regulation_id=$1::uuid
          ORDER BY created_at DESC
          LIMIT 1`,
        [regulationRow.id]
      );
      const versionResult = await client.query(
        `INSERT INTO regulation_versions (
           regulation_id,source_id,regulatory_ingestion_id,knowledge_document_id,version_identifier,
           publication_date,effective_from,effective_to,content_checksum,supersedes_version_id,
           lifecycle_status,reviewed_by,reviewed_at,provenance,metadata
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::date,$7::timestamptz,$8::timestamptz,$9,$10::uuid,
           $11,$12::uuid,$13::timestamptz,$14::jsonb,$15::jsonb
         )
         RETURNING *`,
        [
          regulationRow.id, source.id, ingestion.id, document.id, normalizedArtifact.version_identifier,
          normalizedArtifact.publication_date, normalizedArtifact.effective_from, normalizedArtifact.effective_to,
          normalizedArtifact.content_checksum, previousVersion.rows[0]?.id || null,
          regulation.status || 'draft', regulation.reviewed_by ? assertUuid(regulation.reviewed_by, 'reviewed_by') : null,
          parseTimestamp(regulation.reviewed_at || regulation.reviewedAt, 'reviewed_at'),
          JSON.stringify({
            source_id: source.id,
            ingestion_id: ingestion.id,
            knowledge_document_id: document.id,
            model_version: REGULATION_VERSION_MODEL_VERSION,
          }),
          JSON.stringify({ model_version: REGULATION_VERSION_MODEL_VERSION, ...object(regulation.version_metadata) }),
        ]
      );
      const version = versionResult.rows[0];

      const insertedObligations = [];
      for (const obligation of obligations || []) {
        const chunk = chunks.find((item) => obligation.source_chunk_ordinal === item.chunk_ordinal) || chunks[0] || null;
        const normalized = normalizeObligationInput(obligation, { regulation: regulationRow, version, chunk });
        const result = await client.query(
          `INSERT INTO legal_obligations (
             regulation_id,regulation_version_id,obligation_key,reference,obligation_text,obligation_text_checksum,
             subject,action_type,requirement_summary,applicability,effective_from,effective_to,source_chunk_id,
             source_text_checksum,lifecycle_status,reviewed_by,reviewed_at,provenance,metadata
           ) VALUES (
             $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::timestamptz,$12::timestamptz,$13::uuid,
             $14,$15,$16::uuid,$17::timestamptz,$18::jsonb,$19::jsonb
           )
           RETURNING *`,
          [
            regulationRow.id, version.id, normalized.obligation_key, normalized.reference, normalized.obligation_text,
            normalized.obligation_text_checksum, normalized.subject, normalized.action_type, normalized.requirement_summary,
            JSON.stringify(normalized.applicability), normalized.effective_from, normalized.effective_to, normalized.source_chunk_id,
            normalized.source_text_checksum, normalized.lifecycle_status, normalized.reviewed_by, normalized.reviewed_at,
            JSON.stringify(normalized.provenance), JSON.stringify(normalized.metadata),
          ]
        );
        insertedObligations.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return {
        contract_version: REGULATORY_INGESTION_CONTRACT_VERSION,
        source,
        ingestion,
        knowledge_document: document,
        chunk_count: chunks.length,
        regulation: regulationRow,
        regulation_version: version,
        legal_obligations: insertedObligations,
        gates: {
          knowledge_document_reuse: true,
          second_kb_created: 0,
          second_chunk_truth: 0,
          ai_regulatory_truth_authority: 0,
          ai_legal_obligation_publish_authority: 0,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function listRegulations({ user = {}, filters = {} } = {}) {
    const tenantId = tenantIdFromUser(user);
    const result = await db.query(
      `SELECT r.*
         FROM regulations r
        WHERE ($1::text IS NULL OR r.jurisdiction=$1)
          AND ($2::text IS NULL OR r.status=$2)
          AND (
            r.scope IN ('GLOBAL','JURISDICTIONAL')
            OR (r.scope='TENANT_PRIVATE' AND r.tenant_id=$3::uuid)
          )
        ORDER BY r.jurisdiction, r.regulation_key, r.id
        LIMIT $4`,
      [
        text(filters.jurisdiction, 120),
        filters.status ? normalizeEnum(String(filters.status).toLowerCase(), REGULATION_STATUSES, null, 'status') : null,
        tenantId ? assertUuid(tenantId, 'tenant_id') : null,
        Math.max(1, Math.min(Number(filters.limit || 50), 100)),
      ]
    );
    return result.rows;
  }

  return {
    authoritativeSourceRegistryVersion: AUTHORITATIVE_SOURCE_REGISTRY_VERSION,
    regulatoryIngestionContractVersion: REGULATORY_INGESTION_CONTRACT_VERSION,
    regulationModelVersion: REGULATION_MODEL_VERSION,
    regulationVersionModelVersion: REGULATION_VERSION_MODEL_VERSION,
    legalObligationModelVersion: LEGAL_OBLIGATION_MODEL_VERSION,
    registerSource,
    listSources,
    ingestRegulatoryArtifact,
    listRegulations,
  };
}

module.exports = {
  AUTHORITATIVE_SOURCE_REGISTRY_VERSION,
  REGULATORY_INGESTION_CONTRACT_VERSION,
  REGULATION_MODEL_VERSION,
  REGULATION_VERSION_MODEL_VERSION,
  LEGAL_OBLIGATION_MODEL_VERSION,
  RegulatoryFoundationError,
  normalizeSourceInput,
  normalizeRegulationInput,
  normalizeArtifactInput,
  normalizeObligationInput,
  chunkText,
  createRegulatoryFoundationService,
};
