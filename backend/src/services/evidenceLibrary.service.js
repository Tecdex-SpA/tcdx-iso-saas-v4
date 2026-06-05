'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const { analyzeDocument } = require('./documentAiAnalysis.service');
const { extractDocumentContent } = require('./documentContentExtraction.service');

const READ_ROLES = new Set(['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'auditor', 'responsable_area', 'area_owner', 'operativo']);
const MANAGE_ROLES = new Set(['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin']);
const SOURCE_TYPES = new Set(['document_index', 'evidence']);
const TARGET_TYPES = new Set(['control', 'nonconformity', 'finding', 'process', 'operation', 'risk', 'action']);
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const EVIDENCE_USAGES = new Set([
  'primary_evidence',
  'supporting_evidence',
  'remediation_evidence',
  'finding_evidence',
  'process_evidence',
  'operation_evidence',
  'risk_evidence',
  'action_evidence',
  'reference',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATION_REF_RE = /^(document_index|evidence):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemaCache = new Map();

function normalizeRole(user = {}) {
  return String(user.role || user.user_role || user.userRole || '').toLowerCase().trim();
}

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function assertAccess(user, mode = 'read') {
  const role = normalizeRole(user);
  const tenantId = getUserTenantId(user);
  const allowed = mode === 'manage' ? MANAGE_ROLES : READ_ROLES;

  if (!allowed.has(role)) {
    throw publicError(403, 'EVIDENCE_LIBRARY_RBAC_DENIED', 'No autorizado para la biblioteca documental.');
  }

  if (!tenantId) {
    throw publicError(403, 'TENANT_REQUIRED', 'Tenant no identificado para biblioteca documental.');
  }

  return { tenantId, userId: getUserId(user), role };
}

function asString(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function sourceIdShape(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'missing';
  if (OPERATION_REF_RE.test(raw)) return 'operation_ref';
  if (isUuid(raw)) return 'uuid';
  if (raw.includes(':')) return 'prefixed';
  if (/^[A-Za-z0-9_-]{12,}$/.test(raw)) return 'provider_like';
  return 'unknown';
}

function providerIdShape(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return sourceIdShape(raw);
}

function normalizeSourceInput(sourceType, sourceId) {
  let type = asString(sourceType, 40);
  let id = asString(sourceId, 160);

  if (id && id.includes(':')) {
    const [prefix, ...rest] = id.split(':');
    const normalizedPrefix = asString(prefix, 40);
    const normalizedId = rest.join(':');
    if (SOURCE_TYPES.has(normalizedPrefix)) {
      if (!type || type === normalizedPrefix) {
        type = normalizedPrefix;
        id = normalizedId;
      }
    }
  }

  return { sourceType: type, sourceId: id };
}

function normalizeSourcePayload(input = {}) {
  const operationRef = input.operation_ref || input.operationRef;
  if (operationRef) {
    const normalizedOperationRef = normalizeSourceInput(null, operationRef);
    if (SOURCE_TYPES.has(normalizedOperationRef.sourceType)) {
      return normalizedOperationRef;
    }
  }

  const type = input.source_type || input.sourceType;
  const candidates = [
    input.source_id,
    input.sourceId,
    input.library_item_id,
    input.libraryItemId,
    input.id,
    input.document_key,
    input.documentKey,
  ].filter((value) => value !== undefined && value !== null && String(value).trim());

  for (const candidate of candidates) {
    const normalized = normalizeSourceInput(type, candidate);
    if (SOURCE_TYPES.has(normalized.sourceType) && isUuid(normalized.sourceId)) {
      return normalized;
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes(':')) {
      const normalized = normalizeSourceInput(null, candidate);
      if (SOURCE_TYPES.has(normalized.sourceType) && isUuid(normalized.sourceId)) {
        return normalized;
      }
    }
  }

  return normalizeSourceInput(type, candidates[0] || '');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9./_\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scoreToPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

async function tableExists(tableName) {
  const cacheKey = `table:${tableName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(cacheKey, exists);
  return exists;
}

async function getColumns(tableName) {
  const cacheKey = `columns:${tableName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  schemaCache.set(cacheKey, columns);
  return columns;
}

function sourceLabel(sourceType, row = {}) {
  const provider = String(row.provider || sourceType || '').toLowerCase();
  if (provider.includes('google')) return 'Google Drive';
  if (provider.includes('zoho')) return 'Zoho Drive';
  if (provider.includes('sync')) return 'Sync Agent';
  if (provider.includes('mounted')) return 'Carpeta montada';
  if (sourceType === 'evidence') return 'Carga manual';
  return row.source_name || 'Repositorio documental';
}

function isFolderDocument(row = {}) {
  const mime = String(row.mime_type || '').toLowerCase();
  const extension = String(row.file_extension || '').toLowerCase();
  const documentType = String(row.document_type || row.detected_document_type || row.profile_document_type || '').toLowerCase();
  const metadata = row.metadata || row.metadata_json || {};
  const google = metadata.google || {};
  const zoho = metadata.zoho || {};

  return (
    mime === GOOGLE_FOLDER_MIME ||
    extension === 'folder' ||
    documentType === 'folder' ||
    google.is_folder === true ||
    String(google.is_folder || '').toLowerCase() === 'true' ||
    zoho.is_folder === true ||
    String(zoho.is_folder || '').toLowerCase() === 'true'
  );
}

function itemTypeForRow(row = {}) {
  if (row.item_type) return row.item_type;
  if (row.source_type === 'evidence') return 'file';
  return isFolderDocument(row) ? 'folder' : 'file';
}

function documentKey(row) {
  if (row.source_type === 'evidence') {
    return `evidence:${row.source_id}`;
  }

  const provider = normalizeText(row.origin || row.source_type || 'document_index');
  const external = normalizeText(row.provider_file_id || row.source_id);
  const path = normalizeText(row.normalized_path || row.filename || row.title || row.source_id);
  const hash = normalizeText(row.content_hash || row.checksum || '');
  return [provider, external || hash || path].filter(Boolean).join(':');
}

function classifyDocument({ filename = '', title = '', mimeType = '', text = '' }) {
  const haystack = normalizeText(`${filename} ${title} ${mimeType} ${text}`);
  const signals = [];
  let type = 'unknown';

  const has = (items) => items.some((item) => haystack.includes(item));

  if (has(['politica', 'policy', 'lineamiento'])) {
    type = 'policy';
    signals.push('nombre o contenido sugiere politica');
  } else if (has(['procedimiento', 'procedure', 'instructivo'])) {
    type = 'procedure';
    signals.push('nombre o contenido sugiere procedimiento');
  } else if (has(['registro', 'record', 'acta', 'matriz', 'formulario'])) {
    type = 'record';
    signals.push('nombre o contenido sugiere registro');
  } else if (has(['reporte', 'informe', 'report'])) {
    type = 'report';
    signals.push('nombre o contenido sugiere reporte');
  } else if (has(['certificado', 'certificate'])) {
    type = 'certificate';
    signals.push('nombre o contenido sugiere certificado');
  } else if (has(['auditoria', 'audit', 'hallazgo', 'evidencia'])) {
    type = 'audit_evidence';
    signals.push('nombre o contenido sugiere evidencia de auditoria');
  } else if (has(['riesgo', 'risk'])) {
    type = 'risk_document';
    signals.push('nombre o contenido sugiere documento de riesgos');
  } else if (has(['contrato', 'contract'])) {
    type = 'contract';
    signals.push('nombre o contenido sugiere contrato');
  } else if (has(['minuta', 'acta reunion', 'meeting'])) {
    type = 'meeting_minutes';
    signals.push('nombre o contenido sugiere acta de reunion');
  }

  return {
    document_type: type,
    confidence: type === 'unknown' ? 35 : Math.min(88, 55 + signals.length * 18),
    method: 'rule_based',
    reason: signals[0] || 'sin senales suficientes para clasificar con confianza',
  };
}

function buildChunks(text, maxSize = 1200) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const chunks = [];
  let cursor = 0;
  let index = 0;

  while (cursor < cleaned.length) {
    const piece = cleaned.slice(cursor, cursor + maxSize).trim();
    if (piece) {
      chunks.push({
        chunk_index: index,
        chunk_text: piece,
        chunk_hash: crypto.createHash('sha256').update(piece).digest('hex'),
      });
      index += 1;
    }
    cursor += maxSize;
  }

  return chunks;
}

function mapDocumentRow(row) {
  const itemType = itemTypeForRow(row);
  const sourceType = row.source_type;
  const sourceIdCandidate = sourceType === 'document_index'
    ? (row.db_source_id || row.document_index_id || (isUuid(row.source_id) ? row.source_id : null) || (isUuid(row.id) ? row.id : null))
    : (row.evidence_id || (isUuid(row.source_id) ? row.source_id : null) || (isUuid(row.id) ? row.id : null));
  const sourceId = sourceIdCandidate ? String(sourceIdCandidate) : null;
  const operationRef = sourceType && sourceId ? `${sourceType}:${sourceId}` : null;
  const doc = {
    id: operationRef,
    library_item_id: operationRef,
    operation_ref: operationRef,
    source_type: sourceType,
    source_table: row.source_table,
    source_id: sourceId,
    source_id_shape: sourceIdShape(sourceId),
    document_source_id: row.document_source_id || row.index_source_id || null,
    tenant_id: row.tenant_id,
    title: row.title || row.filename || 'Documento',
    filename: row.filename || row.title || 'Documento',
    normalized_path: row.normalized_path || null,
    relative_path: row.relative_path || null,
    web_view_url: row.web_view_url || null,
    origin: row.origin || row.source_type,
    source_label: row.source_label || sourceLabel(row.source_type, row),
    provider_file_id: row.provider_file_id || null,
    provider_file_id_shape: providerIdShape(row.provider_file_id),
    document_key: row.document_key || null,
    parent_key: row.parent_key || null,
    parent_source_id: row.parent_source_id || row.parent_id || null,
    checksum: row.checksum || null,
    mime_type: row.mime_type || null,
    file_extension: row.file_extension || null,
    item_type: itemType,
    can_analyze: itemType === 'file',
    can_associate: itemType === 'file',
    can_open: itemType === 'folder',
    can_sync: itemType === 'folder',
    disabled_reason: itemType === 'folder' ? 'Las carpetas no se pueden analizar ni asociar como evidencia. Abra la carpeta y seleccione un archivo.' : null,
    document_type: itemType === 'folder' ? 'folder' : (row.profile_document_type || row.detected_document_type || row.document_type || 'unknown'),
    status: row.status || 'indexed',
    semantic_status: row.semantic_status || (row.detected_document_type ? 'processed' : 'not_processed'),
    usefulness_score: scoreToPercent(row.usefulness_score ?? row.confidence_score ?? row.ai_acceptance_pct),
    last_indexed_at: row.last_indexed_at || row.updated_at || row.created_at || null,
    active_version: row.active_version || row.provider_version_id || 'v1',
    metadata: row.metadata || {},
    association_counts: row.association_counts || {},
  };
  doc.document_key = row.document_key || documentKey(doc);
  return doc;
}

function action(key, label, options = {}) {
  return {
    key,
    label,
    method: options.method || 'GET',
    path: options.path || null,
    kind: options.kind || 'api',
    enabled: options.enabled !== false,
    reason: options.reason || null,
    body: options.body || null,
  };
}

function defaultSourceActions(sourceType, sourceId = null, status = 'available') {
  const active = String(status || '').toLowerCase() === 'active';
  if (sourceType === 'google_drive') {
    return sourceId
      ? [action('sync', 'Sincronizar', { method: 'POST', path: `/api/document-integrations/sources/${sourceId}/sync` }), action('connect', 'Reconectar', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' })]
      : [action('connect', 'Conectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' })];
  }
  if (sourceType === 'zoho_drive' || sourceType === 'zoho_workdrive') {
    return sourceId
      ? [action('sync', 'Sincronizar', { method: 'POST', path: '/api/document-integrations/zoho/sync', body: { source_id: sourceId } }), action('connect', 'Reconectar', { method: 'GET', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' })]
      : [action('connect', 'Conectar Zoho Drive', { method: 'GET', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' })];
  }
  if (sourceType === 'sync_agent') {
    return [action('configure', active ? 'Validar agente' : 'Configurar agente', { method: 'POST', path: '/api/document-integrations/agents/pairing-codes' })];
  }
  if (sourceType === 'mounted_folder') {
    return sourceId
      ? [action('sync', 'Sincronizar carpeta', { method: 'POST', path: `/api/document-integrations/sources/${sourceId}/sync` })]
      : [action('configure', 'Configurar carpeta', { enabled: false, kind: 'info', reason: 'Configuración pendiente: requiere registrar ruta montada autorizada.' })];
  }
  if (sourceType === 'manual_upload') {
    return [action('upload', 'Subir archivo', { kind: 'info', enabled: false, reason: 'Carga manual general no implementada aún. Use carga asociada a control/plan de acción.' })];
  }
  return [action('info', 'Configuración pendiente', { enabled: false, kind: 'info', reason: 'Conector no implementado para esta fuente.' })];
}

async function listSources({ user }) {
  const { tenantId } = assertAccess(user, 'read');
  const cards = [
    { source_type: 'google_drive', source_name: 'Google Drive', status: 'available', documents_count: 0 },
    { source_type: 'zoho_drive', source_name: 'Zoho Drive', status: 'available', documents_count: 0 },
    { source_type: 'sync_agent', source_name: 'Sync Agent', status: 'available', documents_count: 0 },
    { source_type: 'mounted_folder', source_name: 'Carpeta montada', status: 'available', documents_count: 0 },
    { source_type: 'manual_upload', source_name: 'Carga manual', status: 'available', documents_count: 0 },
  ];

  if (await tableExists('document_index')) {
    const result = await pool.query(
      `
      SELECT provider, COUNT(*)::int AS documents_count, MAX(indexed_at) AS last_sync_at
      FROM document_index
      WHERE tenant_id = $1::uuid
        AND COALESCE(status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
      GROUP BY provider
      `,
      [tenantId]
    );
    for (const row of result.rows) {
      const provider = String(row.provider || '').toLowerCase();
      const match = cards.find((card) =>
        provider.includes('google') ? card.source_type === 'google_drive' :
        provider.includes('zoho') ? card.source_type === 'zoho_drive' :
        provider.includes('sync') ? card.source_type === 'sync_agent' :
        provider.includes('mounted') ? card.source_type === 'mounted_folder' :
        false
      );
      if (match) {
        match.status = 'active';
        match.documents_count = Number(row.documents_count || 0);
        match.last_sync_at = row.last_sync_at;
      }
    }
  }

  if (await tableExists('tenant_document_sources')) {
    const result = await pool.query(
      `
      SELECT id, provider, source_name, status, last_sync_at, updated_at
      FROM tenant_document_sources
      WHERE tenant_id = $1::uuid
        AND COALESCE(status, '') <> 'disconnected'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      `,
      [tenantId]
    ).catch((error) => {
      if (['42P01', '42703'].includes(error.code)) return { rows: [] };
      throw error;
    });

    for (const row of result.rows) {
      const provider = String(row.provider || '').toLowerCase();
      const cardType =
        provider.includes('google') ? 'google_drive' :
        provider.includes('zoho') ? 'zoho_drive' :
        provider.includes('local') || provider.includes('agent') ? 'sync_agent' :
        provider.includes('mounted') ? 'mounted_folder' :
        provider.includes('manual') ? 'manual_upload' :
        null;
      const match = cards.find((card) => card.source_type === cardType);
      if (match) {
        match.status = row.status || match.status || 'active';
        match.source_id = row.id;
        match.source_name = match.source_name || row.source_name;
        match.last_sync_at = match.last_sync_at || row.last_sync_at || row.updated_at || null;
      }
    }
  }

  if (await tableExists('evidences')) {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS documents_count, MAX(created_at) AS last_sync_at
      FROM evidences
      WHERE tenant_id = $1::uuid
        AND COALESCE(status, '') <> 'deleted'
      `,
      [tenantId]
    );
    const manual = cards.find((card) => card.source_type === 'manual_upload');
    manual.status = 'active';
    manual.documents_count = Number(result.rows[0]?.documents_count || 0);
    manual.last_sync_at = result.rows[0]?.last_sync_at || null;
  }

  return cards.map((card) => ({
    ...card,
    item_type: 'source',
    can_sync: true,
    actions: defaultSourceActions(card.source_type, card.source_id, card.status),
  }));
}

async function loadAssociationCounts(tenantId, documents) {
  if (!documents.length) return documents;
  const keys = documents.map((doc) => `${doc.source_type}:${doc.source_id}`);
  const counts = new Map();

  if (await tableExists('tenant_document_object_links')) {
    const result = await pool.query(
      `
      SELECT source_type, source_id, target_type, COUNT(*)::int AS count
      FROM tenant_document_object_links
      WHERE tenant_id = $1::uuid
        AND is_active = true
        AND (source_type || ':' || source_id::text) = ANY($2::text[])
      GROUP BY source_type, source_id, target_type
      `,
      [tenantId, keys]
    );
    for (const row of result.rows) {
      const key = `${row.source_type}:${row.source_id}`;
      if (!counts.has(key)) counts.set(key, {});
      counts.get(key)[row.target_type] = Number(row.count || 0);
    }
  }

  return documents.map((doc) => ({
    ...doc,
    association_counts: counts.get(`${doc.source_type}:${doc.source_id}`) || {},
  }));
}

async function listDocuments({ user, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  const params = [tenantId];
  const term = `%${String(filters.search || '').trim()}%`;
  const docs = [];

  if (await tableExists('document_index')) {
    const hasAiAnalysis = await tableExists('document_ai_analysis');
    const hasSemanticProfiles = await tableExists('tenant_evidence_semantic_profiles');
    const result = await pool.query(
      `
      ${hasAiAnalysis ? `
      WITH latest_analysis AS (
        SELECT DISTINCT ON (document_id)
          document_id,
          detected_document_type,
          confidence_score,
          evidence_quality,
          created_at AS analyzed_at
        FROM document_ai_analysis
        WHERE tenant_id = $1::uuid
        ORDER BY document_id, created_at DESC
      )
      ` : ''}
      SELECT
        d.tenant_id,
        'document_index' AS source_type,
        'document_index' AS source_table,
        d.id AS db_source_id,
        d.id AS document_index_id,
        d.id AS source_id,
        d.source_id AS document_source_id,
        d.file_name AS filename,
        d.file_name AS title,
        d.file_url AS normalized_path,
        d.relative_path,
        d.web_view_url,
        d.provider AS origin,
        d.provider,
        d.provider_file_id,
        d.provider_version_id,
        d.mime_type,
        d.file_extension,
        d.checksum,
        d.status,
        d.indexed_at AS last_indexed_at,
        COALESCE(${hasAiAnalysis ? 'la.detected_document_type,' : ''} ${hasSemanticProfiles ? 'p.document_type,' : ''} 'unknown') AS detected_document_type,
        COALESCE(${hasSemanticProfiles ? 'p.semantic_status,' : ''} ${hasAiAnalysis ? "CASE WHEN la.document_id IS NOT NULL THEN 'processed' ELSE 'not_processed' END" : "'not_processed'"}) AS semantic_status,
        COALESCE(${hasSemanticProfiles ? 'p.usefulness_score,' : ''} ${hasAiAnalysis ? 'la.confidence_score * 100,' : ''} NULL) AS usefulness_score,
        ${hasSemanticProfiles ? 'p.document_type' : 'NULL'} AS profile_document_type,
        d.metadata_json AS metadata
      FROM document_index d
      ${hasAiAnalysis ? `LEFT JOIN latest_analysis la
        ON la.document_id = d.id
      ` : ''}
      ${hasSemanticProfiles ? `LEFT JOIN tenant_evidence_semantic_profiles p
        ON p.tenant_id = d.tenant_id
       AND p.source_type = 'document_index'
       AND p.source_id = d.id
      ` : ''}
      WHERE d.tenant_id = $1::uuid
        AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
        AND ($2 = '%%' OR d.file_name ILIKE $2 OR COALESCE(d.file_url, '') ILIKE $2 OR COALESCE(d.metadata_json::text, '') ILIKE $2)
      ORDER BY d.indexed_at DESC NULLS LAST, d.modified_at DESC NULLS LAST
      LIMIT 500
      `,
      [tenantId, term]
    ).catch((error) => {
      if (['42P01', '42703'].includes(error.code)) return { rows: [] };
      throw error;
    });
    docs.push(...result.rows.map(mapDocumentRow));
  }

  if (await tableExists('evidences')) {
    const result = await pool.query(
      `
      SELECT
        tenant_id,
        'evidence' AS source_type,
        'evidences' AS source_table,
        id AS evidence_id,
        id AS source_id,
        NULL::uuid AS document_source_id,
        file_name AS filename,
        COALESCE(file_name, description, evidence_type, 'Evidencia') AS title,
        file_path AS normalized_path,
        file_path AS relative_path,
        NULL::text AS web_view_url,
        'manual_upload' AS origin,
        NULL::text AS provider,
        NULL::text AS provider_file_id,
        NULL::text AS provider_version_id,
        file_mime_type AS mime_type,
        NULL::text AS file_extension,
        NULL::text AS checksum,
        evidence_type AS document_type,
        status,
        COALESCE(created_at, reviewed_at) AS last_indexed_at,
        COALESCE(
          NULLIF((metadata->'semantic_evidence'->>'status'), ''),
          CASE WHEN analysis_status = 'completed' THEN 'processed' ELSE 'not_processed' END
        ) AS semantic_status,
        ai_acceptance_pct AS usefulness_score,
        metadata
      FROM evidences
      WHERE tenant_id = $1::uuid
        AND COALESCE(status, '') <> 'deleted'
        AND ($2 = '%%' OR file_name ILIKE $2 OR description ILIKE $2 OR evidence_type ILIKE $2 OR COALESCE(metadata::text, '') ILIKE $2)
      ORDER BY created_at DESC NULLS LAST, reviewed_at DESC NULLS LAST
      LIMIT 500
      `,
      [tenantId, term]
    ).catch((error) => {
      if (['42P01', '42703'].includes(error.code)) return { rows: [] };
      throw error;
    });
    docs.push(...result.rows.map(mapDocumentRow));
  }

  let enriched = await loadAssociationCounts(tenantId, docs);

  if (filters.origin) {
    enriched = enriched.filter((doc) => String(doc.origin || '').toLowerCase() === String(filters.origin).toLowerCase());
  }
  if (filters.document_type) {
    enriched = enriched.filter((doc) => String(doc.document_type || '').toLowerCase() === String(filters.document_type).toLowerCase());
  }
  if (filters.status) {
    enriched = enriched.filter((doc) => String(doc.status || '').toLowerCase() === String(filters.status).toLowerCase());
  }
  if (filters.semantic_status) {
    enriched = enriched.filter((doc) => String(doc.semantic_status || '').toLowerCase() === String(filters.semantic_status).toLowerCase());
  }
  if (filters.association && filters.association !== 'all') {
    enriched = enriched.filter((doc) => {
      const counts = doc.association_counts || {};
      if (filters.association === 'not_associated') return Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0) === 0;
      return Number(counts[filters.association] || 0) > 0;
    });
  }

  const groups = new Map();
  for (const doc of enriched) {
    if (!groups.has(doc.document_key)) groups.set(doc.document_key, []);
    groups.get(doc.document_key).push(doc);
  }

  const rows = [];
  for (const versions of groups.values()) {
    versions.sort((a, b) => new Date(b.last_indexed_at || 0).getTime() - new Date(a.last_indexed_at || 0).getTime());
    versions.forEach((doc, index) => {
      doc.is_active_version = index === 0;
      doc.has_previous_versions = versions.length > 1;
      doc.active_version = doc.active_version || `v${versions.length - index}`;
    });
    rows.push(...(filters.version === 'all' ? versions : [versions[0]]));
  }

  rows.sort((a, b) => new Date(b.last_indexed_at || 0).getTime() - new Date(a.last_indexed_at || 0).getTime());
  return { data: rows.slice(0, 500), total: rows.length };
}

function assertDocumentIsFile(source, message) {
  if (isFolderDocument(source)) {
    throw publicError(400, 'FOLDER_NOT_EVIDENCE_DOCUMENT', message);
  }
}

async function resolveDocumentIndexIdFromProviderLike(tenantId, providerLikeId) {
  const raw = asString(providerLikeId, 220);
  if (!raw) return null;
  const result = await pool.query(
    `
    SELECT id
    FROM document_index
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
      AND (
        provider_file_id = $2
        OR provider_version_id = $2
        OR COALESCE(metadata_json->>'provider_file_id', '') = $2
        OR COALESCE(metadata_json->>'provider_id', '') = $2
        OR COALESCE(metadata_json->>'external_file_id', '') = $2
        OR COALESCE(metadata_json->>'external_id', '') = $2
        OR COALESCE(metadata_json->>'file_id', '') = $2
        OR COALESCE(metadata_json->>'fileId', '') = $2
        OR COALESCE(metadata_json->>'id', '') = $2
        OR COALESCE(metadata_json->>'google_file_id', '') = $2
        OR COALESCE(metadata_json->>'source_file_id', '') = $2
        OR COALESCE(metadata_json->'google'->>'id', '') = $2
        OR COALESCE(metadata_json->'google'->>'file_id', '') = $2
        OR COALESCE(metadata_json->'google'->>'fileId', '') = $2
        OR COALESCE(metadata_json->'google'->>'google_file_id', '') = $2
        OR COALESCE(metadata_json->'google'->>'provider_file_id', '') = $2
        OR COALESCE(metadata_json->'zoho'->>'id', '') = $2
        OR COALESCE(metadata_json->'zoho'->>'file_id', '') = $2
        OR COALESCE(metadata_json->'zoho'->>'fileId', '') = $2
        OR COALESCE(metadata_json->'zoho'->>'provider_file_id', '') = $2
      )
    ORDER BY last_seen_at DESC NULLS LAST, indexed_at DESC NULLS LAST
    LIMIT 2
    `,
    [tenantId, raw]
  ).catch((error) => {
    if (['42P01', '42703'].includes(error.code)) return { rows: [] };
    throw error;
  });

  if (result.rows.length === 1) return String(result.rows[0].id);
  if (result.rows.length > 1) {
    throw publicError(400, 'AMBIGUOUS_PROVIDER_SOURCE_ID', 'El identificador externo coincide con más de un documento indexado. Seleccione el archivo desde la biblioteca actualizada.', {
      received_source_type: 'document_index',
      received_source_id_shape: sourceIdShape(providerLikeId),
      matched_rows: result.rows.length,
      expected: 'document_index.id UUID or operation_ref document_index:<uuid>',
    });
  }
  return null;
}

async function resolveEvidenceLibrarySource(input = {}, tenantId, options = {}) {
  const mode = options.mode || 'read';
  const normalizedPayload = normalizeSourcePayload(input);
  const sourceType = normalizedPayload.sourceType;
  let sourceId = normalizedPayload.sourceId;
  if (!SOURCE_TYPES.has(sourceType)) {
    throw publicError(400, 'INVALID_SOURCE_TYPE', 'Seleccione un archivo/documento válido de la biblioteca.', {
      received_source_type: sourceType || null,
      received_source_id_shape: sourceIdShape(sourceId),
      item_type: input.item_type || input.itemType || null,
      expected: 'document_index.id UUID or operation_ref document_index:<uuid>',
    });
  }
  if (!isUuid(sourceId)) {
    if (sourceType === 'document_index' && sourceIdShape(sourceId) === 'provider_like') {
      const resolvedId = await resolveDocumentIndexIdFromProviderLike(tenantId, sourceId);
      if (resolvedId) {
        sourceId = resolvedId;
      }
    }
  }
  if (!isUuid(sourceId)) {
    throw publicError(400, 'INVALID_SOURCE_ID', 'Identificador de documento/evidencia inválido. Seleccione un archivo de la biblioteca.', {
      received_source_type: sourceType,
      received_source_id_shape: sourceIdShape(sourceId),
      item_type: input.item_type || input.itemType || null,
      expected: 'document_index.id UUID or operation_ref document_index:<uuid>',
    });
  }

  let source = null;
  if (sourceType === 'document_index') {
    const result = await pool.query(
      `
      SELECT d.*, s.source_name
      FROM document_index d
      LEFT JOIN tenant_document_sources s
        ON s.id = d.source_id
       AND s.tenant_id = d.tenant_id
      WHERE d.tenant_id = $1::uuid
        AND d.id = $2::uuid
        AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
      LIMIT 1
      `,
      [tenantId, sourceId]
    );
    if (result.rowCount > 0) source = { source_type: sourceType, ...result.rows[0] };
  }

  if (!source && sourceType === 'evidence') {
    const result = await pool.query(
      `
      SELECT *
      FROM evidences
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(status, '') <> 'deleted'
      LIMIT 1
      `,
      [tenantId, sourceId]
    );
    if (result.rowCount > 0) source = { source_type: sourceType, ...result.rows[0] };
  }

  if (!source) {
    throw publicError(404, 'SOURCE_DOCUMENT_NOT_FOUND', 'Documento/evidencia no encontrado para el tenant autenticado.');
  }

  const isFolder = sourceType === 'document_index' && isFolderDocument(source);
  if (isFolder && mode === 'associate') {
    throw publicError(400, 'FOLDER_NOT_ASSOCIABLE', 'Las carpetas no se pueden asociar como evidencia. Abra la carpeta y seleccione un archivo.');
  }
  if (isFolder && mode === 'analyze') {
    throw publicError(400, 'FOLDER_NOT_EVIDENCE_DOCUMENT', 'Seleccione un archivo/documento, no una carpeta.');
  }
  if (isFolder && mode !== 'children' && mode !== 'read') {
    throw publicError(400, 'NON_ACTIONABLE_LIBRARY_ITEM', 'El elemento seleccionado no es un archivo analizable/asociable.');
  }

  return { sourceType, sourceId, source };
}

async function getSourceDocument(tenantId, rawSourceType, rawSourceId, options = {}) {
  const resolved = await resolveEvidenceLibrarySource({ source_type: rawSourceType, source_id: rawSourceId }, tenantId, options);
  return resolved.source;
}

async function listAssociations({ user, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  if (!(await tableExists('tenant_document_object_links'))) return { data: [] };
  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];

  if (filters.source_type && filters.source_id) {
    const normalizedSource = normalizeSourcePayload(filters);
    params.push(normalizedSource.sourceType, normalizedSource.sourceId);
    where.push(`source_type = $${params.length - 1}`, `source_id = $${params.length}::uuid`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM tenant_document_object_links
    WHERE ${where.join(' AND ')}
    ORDER BY is_active DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 300
    `,
    params
  );
  return { data: result.rows };
}

async function validateTarget(tenantId, targetType, targetId) {
  if (!TARGET_TYPES.has(targetType) || !isUuid(targetId)) {
    throw publicError(400, 'INVALID_TARGET', 'Objeto destino inválido.');
  }

  const configs = {
    control: { table: 'tenant_controls', label: "COALESCE(cc.description, 'Control')", join: 'LEFT JOIN controls_catalog cc ON cc.id = t.control_id' },
    nonconformity: { table: 'tenant_nonconformities', label: "COALESCE(t.control_description, t.description, t.status, 'No conformidad')" },
    finding: { table: 'findings', label: "COALESCE(t.title, t.description, t.finding_type, 'Hallazgo')" },
    process: { table: 'tenant_processes', label: "COALESCE(t.name, t.code, 'Proceso')" },
    operation: { table: 'tenant_operations', label: "COALESCE(t.name, t.code, 'Operacion')" },
    risk: { table: 'iso_risk_matrix_items', label: "COALESCE(t.risk_title, t.risk_code, t.risk_description, 'Riesgo')" },
    action: { table: 'action_plans', label: "COALESCE(t.title, t.description, 'Plan de accion')" },
  };
  const config = configs[targetType];
  if (!(await tableExists(config.table))) {
    throw publicError(404, 'TARGET_TABLE_NOT_AVAILABLE', 'El tipo de objeto destino no está disponible.');
  }

  const columns = await getColumns(config.table);
  if (!columns.has('tenant_id')) {
    throw publicError(404, 'TARGET_TABLE_NOT_TENANT_SCOPED', 'El objeto destino no confirma tenant_id.');
  }

  const result = await pool.query(
    `
    SELECT
      t.id,
      t.tenant_id,
      ${config.label} AS label,
      ${targetType === 'operation' && columns.has('process_id') ? 't.process_id' : 'NULL::uuid'} AS process_id
    FROM ${config.table} t
    ${config.join || ''}
    WHERE t.tenant_id = $1::uuid
      AND t.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, targetId]
  );

  if (result.rowCount === 0) {
    throw publicError(404, 'TARGET_NOT_FOUND', 'Objeto destino no encontrado para el tenant autenticado.');
  }

  return result.rows[0];
}

async function createAssociation({ user, payload = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  if (String(payload.item_type || '').toLowerCase() === 'folder') {
    throw publicError(400, 'FOLDER_NOT_ASSOCIABLE', 'Las carpetas no se pueden asociar como evidencia. Abra la carpeta y seleccione un archivo.');
  }
  const resolvedSource = await resolveEvidenceLibrarySource(payload, tenantId, { mode: 'associate' });
  const sourceType = resolvedSource.sourceType;
  const sourceId = resolvedSource.sourceId;
  const targetType = asString(payload.target_type, 40);
  const targetId = asString(payload.target_id, 80);
  const evidenceUsage = asString(payload.evidence_usage, 80) || 'supporting_evidence';

  if (!EVIDENCE_USAGES.has(evidenceUsage)) {
    throw publicError(400, 'INVALID_EVIDENCE_USAGE', 'Uso de evidencia inválido.');
  }

  const source = resolvedSource.source;
  assertDocumentIsFile(source, 'Las carpetas no se pueden asociar como evidencia. Abra la carpeta y seleccione un archivo.');
  const target = await validateTarget(tenantId, targetType, targetId);
  const doc = mapDocumentRow({
    tenant_id: tenantId,
    source_type: sourceType,
    source_table: sourceType === 'evidence' ? 'evidences' : 'document_index',
    source_id: sourceId,
    filename: source.file_name,
    title: source.file_name || source.description,
    normalized_path: source.file_url || source.file_path,
    origin: source.provider || 'manual_upload',
    checksum: source.checksum,
    provider_file_id: source.provider_file_id,
  });

  const result = await pool.query(
    `
    INSERT INTO tenant_document_object_links (
      tenant_id, source_type, source_id, document_key, target_type, target_id,
      target_label, evidence_usage, relation_type, status, is_active,
      created_by_user_id, reviewed_by_user_id, reviewed_at, notes, metadata, updated_at
    )
    VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6::uuid,$7,$8,'associated','active',true,$9::uuid,$9::uuid,now(),$10,$11::jsonb,now())
    ON CONFLICT ON CONSTRAINT tenant_document_object_links_pkey DO NOTHING
    RETURNING *
    `,
    [
      tenantId,
      sourceType,
      sourceId,
      doc.document_key,
      targetType,
      targetId,
      target.label,
      evidenceUsage,
      userId,
      asString(payload.notes, 1000),
      JSON.stringify({ created_from: payload.created_from || 'evidence_library' }),
    ]
  ).catch(async (error) => {
    if (error.code === '23505') {
      const existing = await pool.query(
        `
        UPDATE tenant_document_object_links
        SET is_active = true,
            status = 'active',
            notes = COALESCE($7, notes),
            reviewed_by_user_id = $8::uuid,
            reviewed_at = now(),
            updated_at = now()
        WHERE tenant_id = $1::uuid
          AND source_type = $2
          AND source_id = $3::uuid
          AND target_type = $4
          AND target_id = $5::uuid
          AND evidence_usage = $6
        RETURNING *
        `,
        [tenantId, sourceType, sourceId, targetType, targetId, evidenceUsage, asString(payload.notes, 1000), userId]
      );
      return existing;
    }
    throw error;
  });

  if (['process', 'operation'].includes(targetType) && await tableExists('tenant_process_entity_links')) {
    const processId = targetType === 'process' ? targetId : target.process_id;
    if (processId) {
      await pool.query(
        `
        INSERT INTO tenant_process_entity_links (
          tenant_id, process_id, operation_id, target_type, target_id, relation_type,
          source, notes, is_active, created_by_user_id, updated_at
        )
        VALUES ($1::uuid,$2::uuid,$3::uuid,'evidence',$4::uuid,'associated','manual',$5,true,$6::uuid,now())
        ON CONFLICT DO NOTHING
        `,
        [tenantId, processId, targetType === 'operation' ? targetId : null, sourceId, asString(payload.notes, 1000), userId]
      ).catch(() => null);
    }
  }

  return result.rows[0] || null;
}

async function setAssociationStatus({ user, id, isActive }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  const result = await pool.query(
    `
    UPDATE tenant_document_object_links
    SET is_active = $1,
        status = CASE WHEN $1 THEN 'active' ELSE 'inactive' END,
        reviewed_by_user_id = $2::uuid,
        reviewed_at = now(),
        updated_at = now()
    WHERE tenant_id = $3::uuid
      AND id = $4::uuid
    RETURNING *
    `,
    [Boolean(isActive), userId, tenantId, id]
  );
  if (result.rowCount === 0) throw publicError(404, 'ASSOCIATION_NOT_FOUND', 'Asociación no encontrada.');
  return result.rows[0];
}

async function listTargetCandidates({ user, targetType, search = '' }) {
  const { tenantId } = assertAccess(user, 'read');
  const term = `%${String(search || '').trim()}%`;
  const type = asString(targetType, 40);
  if (!TARGET_TYPES.has(type)) throw publicError(400, 'INVALID_TARGET_TYPE', 'Tipo de objeto inválido.');

  const queries = {
    control: `
      SELECT tc.id, 'control' AS target_type, COALESCE(cc.description, 'Control') AS label, COALESCE(op.name, tc.status, '') AS subtitle
      FROM tenant_controls tc
      LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
      LEFT JOIN tenant_operations op ON op.id = tc.operation_id AND op.tenant_id = tc.tenant_id
      WHERE tc.tenant_id = $1::uuid AND ($2 = '%%' OR cc.description ILIKE $2 OR op.name ILIKE $2)
      ORDER BY cc.description ASC NULLS LAST LIMIT 80
    `,
    process: `
      SELECT id, 'process' AS target_type, COALESCE(name, code, 'Proceso') AS label, COALESCE(area, criticality, '') AS subtitle
      FROM tenant_processes
      WHERE tenant_id = $1::uuid AND COALESCE(is_active, true) = true AND ($2 = '%%' OR name ILIKE $2 OR code ILIKE $2 OR area ILIKE $2)
      ORDER BY name LIMIT 80
    `,
    operation: `
      SELECT op.id, 'operation' AS target_type, COALESCE(op.name, op.code, 'Operacion') AS label, COALESCE(p.name, op.operation_type, '') AS subtitle
      FROM tenant_operations op
      LEFT JOIN tenant_processes p ON p.id = op.process_id AND p.tenant_id = op.tenant_id
      WHERE op.tenant_id = $1::uuid AND COALESCE(op.is_active, true) = true AND ($2 = '%%' OR op.name ILIKE $2 OR op.code ILIKE $2 OR p.name ILIKE $2)
      ORDER BY op.name LIMIT 80
    `,
    finding: `
      SELECT id, 'finding' AS target_type, COALESCE(title, description, finding_type, 'Hallazgo') AS label, COALESCE(status, severity, '') AS subtitle
      FROM findings
      WHERE tenant_id = $1::uuid AND ($2 = '%%' OR title ILIKE $2 OR description ILIKE $2 OR finding_type ILIKE $2)
      ORDER BY created_at DESC NULLS LAST LIMIT 80
    `,
    nonconformity: `
      SELECT id, 'nonconformity' AS target_type, COALESCE(control_description, description, 'No conformidad') AS label, COALESCE(status, '') AS subtitle
      FROM tenant_nonconformities
      WHERE tenant_id = $1::uuid AND ($2 = '%%' OR control_description ILIKE $2 OR description ILIKE $2 OR status ILIKE $2)
      ORDER BY detected_at DESC NULLS LAST, id DESC LIMIT 80
    `,
    risk: `
      SELECT id, 'risk' AS target_type, COALESCE(risk_title, risk_code, risk_description, 'Riesgo') AS label, COALESCE(residual_risk_level, inherent_risk_level, standard_code, '') AS subtitle
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid AND ($2 = '%%' OR risk_title ILIKE $2 OR risk_code ILIKE $2 OR risk_description ILIKE $2)
      ORDER BY created_at DESC NULLS LAST LIMIT 80
    `,
    action: `
      SELECT id, 'action' AS target_type, COALESCE(title, description, 'Plan de accion') AS label, COALESCE(status, priority, '') AS subtitle
      FROM action_plans
      WHERE tenant_id = $1::uuid AND ($2 = '%%' OR title ILIKE $2 OR description ILIKE $2 OR status ILIKE $2)
      ORDER BY created_at DESC NULLS LAST LIMIT 80
    `,
  };
  const tableMap = {
    control: 'tenant_controls',
    process: 'tenant_processes',
    operation: 'tenant_operations',
    finding: 'findings',
    nonconformity: 'tenant_nonconformities',
    risk: 'iso_risk_matrix_items',
    action: 'action_plans',
  };
  if (!(await tableExists(tableMap[type]))) return [];
  const result = await pool.query(queries[type], [tenantId, term]).catch((error) => {
    if (['42P01', '42703'].includes(error.code)) return { rows: [] };
    throw error;
  });
  return result.rows;
}

async function getDocumentDetail({ user, sourceType, sourceId }) {
  const { tenantId } = assertAccess(user, 'read');
  const normalizedSource = normalizeSourcePayload({ source_type: sourceType, source_id: sourceId });
  sourceType = normalizedSource.sourceType;
  sourceId = normalizedSource.sourceId;
  const source = await getSourceDocument(tenantId, sourceType, sourceId);
  const docs = await listDocuments({ user, filters: { version: 'all' } });
  const current = docs.data.find((doc) => doc.source_type === sourceType && String(doc.source_id) === String(sourceId));
  const document = current || mapDocumentRow({
    tenant_id: tenantId,
    source_type: sourceType,
    source_table: sourceType === 'evidence' ? 'evidences' : 'document_index',
    source_id: sourceId,
    document_source_id: source.source_id || null,
    filename: source.file_name,
    title: source.file_name || source.description,
    normalized_path: source.file_url || source.file_path,
    relative_path: source.relative_path || source.file_path,
    web_view_url: source.web_view_url || null,
    origin: source.provider || 'manual_upload',
    provider_file_id: source.provider_file_id || null,
    mime_type: source.mime_type || source.file_mime_type || null,
    file_extension: source.file_extension || null,
    status: source.status,
    metadata: source.metadata_json || source.metadata || {},
  });
  const versions = docs.data.filter((doc) => doc.document_key === document.document_key);
  const associations = await listAssociations({ user, filters: { source_type: sourceType, source_id: sourceId } });
  const chunks = await tableExists('tenant_evidence_chunks')
    ? await pool.query(
        `
        SELECT id, chunk_index, page_number, section_label, chunk_text, chunk_hash, created_at
        FROM tenant_evidence_chunks
        WHERE tenant_id = $1::uuid AND source_type = $2 AND source_id = $3::uuid
        ORDER BY created_at DESC, chunk_index
        LIMIT 30
        `,
        [tenantId, sourceType, sourceId]
      ).then((result) => result.rows).catch(() => [])
    : [];
  const suggestions = await tableExists('tenant_evidence_applicability_suggestions')
    ? await pool.query(
        `
        SELECT *
        FROM tenant_evidence_applicability_suggestions
        WHERE tenant_id = $1::uuid AND source_type = $2 AND source_id = $3::uuid
        ORDER BY status, score DESC NULLS LAST, created_at DESC
        LIMIT 80
        `,
        [tenantId, sourceType, sourceId]
      ).then((result) => result.rows).catch(() => [])
    : [];
  const profile = await tableExists('tenant_evidence_semantic_profiles')
    ? await pool.query(
        `
        SELECT *
        FROM tenant_evidence_semantic_profiles
        WHERE tenant_id = $1::uuid AND source_type = $2 AND source_id = $3::uuid
        LIMIT 1
        `,
        [tenantId, sourceType, sourceId]
      ).then((result) => result.rows[0] || null).catch(() => null)
    : null;

  return {
    document: { ...document, profile },
    versions,
    associations: associations.data,
    chunks,
    suggestions,
    history: [
      { event: 'indexed', at: document.last_indexed_at, label: 'Documento indexado o cargado' },
      ...(profile?.processed_at ? [{ event: 'semantic_processed', at: profile.processed_at, label: 'Análisis documental actualizado' }] : []),
      ...associations.data.map((row) => ({ event: 'associated', at: row.created_at, label: `Asociado a ${row.target_type}` })),
    ].filter((item) => item.at),
  };
}

async function listDocumentChildren({ user, sourceType, sourceId }) {
  const { tenantId } = assertAccess(user, 'read');
  const normalizedSource = normalizeSourcePayload({ source_type: sourceType, source_id: sourceId });
  const { source } = await resolveEvidenceLibrarySource(
    { source_type: normalizedSource.sourceType, source_id: normalizedSource.sourceId },
    tenantId,
    { mode: 'children' }
  );

  if (normalizedSource.sourceType !== 'document_index') {
    throw publicError(400, 'CHILDREN_NOT_AVAILABLE', 'Solo las carpetas indexadas pueden listar contenido.');
  }

  if (!isFolderDocument(source)) {
    throw publicError(400, 'NOT_A_FOLDER', 'El elemento seleccionado no es una carpeta.');
  }

  const sourceMetadata = source.metadata_json || source.metadata || {};
  const folderProviderId = asString(
    source.provider_file_id ||
      sourceMetadata.provider_file_id ||
      sourceMetadata.google?.id ||
      sourceMetadata.google?.folder_id ||
      sourceMetadata.zoho?.id ||
      sourceMetadata.zoho?.folder_id,
    200
  );
  const folderRelativePath = asString(
    source.relative_path ||
      source.metadata_json?.relative_path ||
      source.metadata_json?.google?.relative_path ||
      source.metadata_json?.zoho?.relative_path ||
      source.metadata_json?.path ||
      source.metadata_json?.folder_path ||
      source.metadata_json?.parent_path ||
      source.file_name,
    800
  );
  const folderPathLike = folderRelativePath ? `${folderRelativePath.replace(/\/+$/, '')}/%` : null;

  const result = await pool.query(
    `
    SELECT
      d.tenant_id,
      'document_index' AS source_type,
      'document_index' AS source_table,
      d.id AS db_source_id,
      d.id AS document_index_id,
      d.id AS source_id,
      d.source_id AS document_source_id,
      d.file_name AS filename,
      d.file_name AS title,
      d.file_url AS normalized_path,
      d.relative_path,
      d.web_view_url,
      d.provider AS origin,
      d.provider,
      d.provider_file_id,
      d.provider_version_id,
      d.mime_type,
      d.file_extension,
      d.checksum,
      d.status,
      d.indexed_at AS last_indexed_at,
      CASE
        WHEN COALESCE(d.mime_type, '') = 'application/vnd.google-apps.folder'
          OR COALESCE(d.metadata_json->'google'->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->'zoho'->>'is_folder', 'false') = 'true'
        THEN 'folder'
        ELSE 'unknown'
      END AS detected_document_type,
      'not_processed' AS semantic_status,
      NULL::numeric AS usefulness_score,
      NULL::text AS profile_document_type,
      d.metadata_json AS metadata
    FROM document_index d
    WHERE d.tenant_id = $1::uuid
      AND d.id <> $2::uuid
      AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
      AND (
        ($3::text IS NOT NULL AND COALESCE(d.metadata_json->'google'->>'parent_folder_id', '') = $3::text)
        OR ($3::text IS NOT NULL AND COALESCE(d.metadata_json->'zoho'->>'parent_folder_id', '') = $3::text)
        OR ($3::text IS NOT NULL AND COALESCE(d.metadata_json->>'parent_id', '') = $3::text)
        OR ($3::text IS NOT NULL AND COALESCE(d.metadata_json->>'source_folder_id', '') = $3::text)
        OR ($4::text IS NOT NULL AND d.relative_path ILIKE $4::text)
        OR ($4::text IS NOT NULL AND d.file_url ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'relative_path', '') ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'path', '') ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'folder_path', '') ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'parent_path', '') ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->'google'->>'relative_path', '') ILIKE $4::text)
        OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->'zoho'->>'relative_path', '') ILIKE $4::text)
      )
    ORDER BY
      CASE WHEN COALESCE(d.mime_type, '') = 'application/vnd.google-apps.folder' THEN 0 ELSE 1 END,
      d.file_name ASC
    LIMIT 250
    `,
    [tenantId, normalizedSource.sourceId, folderProviderId, folderPathLike]
  ).catch((error) => {
    if (['42P01', '42703'].includes(error.code)) return { rows: [] };
    throw error;
  });

  const rows = result.rows.map(mapDocumentRow);
  return { data: rows, total: rows.length };
}

async function getSourceText(tenantId, source) {
  if (source.source_type === 'document_index') {
    const document = await pool.query(
      `
      SELECT d.*, s.source_name, i.provider_account_email,
             i.encrypted_access_token, i.encrypted_refresh_token, i.token_expires_at, i.scopes
      FROM document_index d
      LEFT JOIN tenant_document_sources s ON s.id = d.source_id AND s.tenant_id = d.tenant_id
      LEFT JOIN tenant_integrations i ON i.id = d.integration_id AND i.tenant_id = d.tenant_id
      WHERE d.tenant_id = $1::uuid AND d.id = $2::uuid
      LIMIT 1
      `,
      [tenantId, source.id]
    );
    const row = document.rows[0] || source;
    const extracted = await extractDocumentContent({ document: row, integration: row }).catch((error) => ({
      ok: false,
      text: '',
      extraction: { warning: error.message, method: 'backend_extraction_error' },
    }));
    return {
      text: cleanText(extracted.text || buildMetadataTextForSource(row)),
      extraction: extracted.extraction || {},
    };
  }

  return {
    text: cleanText([
      source.file_name,
      source.description,
      source.evidence_type,
      source.control_fit,
      source.gap_summary,
      source.ai_headline,
      source.ai_narrative,
      JSON.stringify(source.metadata || {}),
    ].filter(Boolean).join('\n')),
    extraction: { method: 'evidence_metadata_reuse' },
  };
}

function buildMetadataTextForSource(source) {
  return [
    source.file_name,
    source.mime_type,
    source.provider,
    source.source_name,
    source.file_url,
    source.web_view_url,
    JSON.stringify(source.metadata_json || source.metadata || {}),
  ].filter(Boolean).join('\n');
}

function scoreTarget(text, target) {
  const haystack = normalizeText(text);
  const label = normalizeText(`${target.label || ''} ${target.subtitle || ''}`);
  const terms = label.split(' ').filter((term) => term.length >= 5);
  const matches = terms.filter((term) => haystack.includes(term));
  const score = Math.min(92, matches.length * 14 + (label && haystack.includes(label.slice(0, 40)) ? 25 : 0));
  return { score, matches };
}

async function loadCandidateTargets(user) {
  const targetTypes = ['control', 'process', 'operation', 'risk', 'action', 'finding', 'nonconformity'];
  const grouped = {};

  for (const targetType of targetTypes) {
    grouped[targetType] = await listTargetCandidates({ user, targetType }).catch(() => []);
  }

  return grouped;
}

async function callSemanticEvidenceEngine({ tenantId, sourceType, sourceId, source, text, candidateTargets }) {
  const aiEngineUrl = String(process.env.AI_ENGINE_URL || process.env.AI_ENGINE_BASE_URL || '').trim();
  const token = process.env.AI_INTERNAL_TOKEN || process.env.AI_ENGINE_TOKEN || process.env.OWN_AI_SHARED_SECRET || process.env.AI_TOKEN || '';

  if (!aiEngineUrl || !token) {
    return null;
  }

  const payload = {
    tenant_id: tenantId,
    source_type: sourceType,
    source_id: sourceId,
    document_key: null,
    filename: source.file_name || source.description || 'Documento',
    title: source.description || source.file_name || 'Documento',
    text,
    metadata: {
      mime_type: source.mime_type || null,
      provider: source.provider || null,
      status: source.status || null,
    },
    candidate_targets: candidateTargets,
  };

  return aiEngineClient.postJson('/semantic-evidence/analyze', payload, {
    timeoutMs: Number(process.env.AI_ENGINE_SEMANTIC_EVIDENCE_TIMEOUT_MS || process.env.AI_ENGINE_ANALYZE_TIMEOUT_MS || 60000),
  }).catch(() => null);
}

async function analyzeSemanticEvidence({ user, operationRef, sourceType, sourceId }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  const resolvedSource = await resolveEvidenceLibrarySource(
    { operation_ref: operationRef, source_type: sourceType, source_id: sourceId },
    tenantId,
    { mode: 'analyze' }
  );
  sourceType = resolvedSource.sourceType;
  sourceId = resolvedSource.sourceId;
  const source = resolvedSource.source;
  assertDocumentIsFile(source, 'Seleccione un archivo/documento, no una carpeta.');
  source.id = sourceId;

  let aiResult = null;
  if (sourceType === 'document_index') {
    aiResult = await analyzeDocument({ tenantId, documentId: sourceId, userId }).catch((error) => ({
      ok: false,
      error: error.message,
      analysis: null,
      suggestions: [],
    }));
  }

  const { text, extraction } = await getSourceText(tenantId, source);
  const candidateTargets = await loadCandidateTargets(user);
  const engineResult = await callSemanticEvidenceEngine({
    tenantId,
    sourceType,
    sourceId,
    source,
    text,
    candidateTargets,
  });
  const engineClassification = engineResult?.classification || null;
  const classification = engineClassification ? {
    document_type: engineClassification.type || 'unknown',
    confidence: scoreToPercent(engineClassification.confidence) || 50,
    method: engineClassification.method || 'ai_engine_assisted',
    reason: engineClassification.reason || 'Clasificación asistida por AI Engine.',
  } : classifyDocument({
    filename: source.file_name,
    title: source.description || source.file_name,
    mimeType: source.mime_type,
    text,
  });
  const engineChunks = Array.isArray(engineResult?.chunks)
    ? engineResult.chunks.map((chunk, index) => ({
        chunk_index: Number.isFinite(Number(chunk.chunk_index)) ? Number(chunk.chunk_index) : index,
        chunk_text: cleanText(chunk.chunk_text || chunk.text || chunk.snippet || ''),
        page_number: chunk.page_number || null,
        section_label: asString(chunk.section_label, 180),
        chunk_hash: chunk.hash || crypto.createHash('sha256').update(String(chunk.chunk_text || chunk.text || chunk.snippet || '')).digest('hex'),
      })).filter((chunk) => chunk.chunk_text)
    : [];
  const chunks = engineChunks.length ? engineChunks : buildChunks(text);
  const usefulnessScore = Math.min(
    95,
    Math.max(
      20,
      scoreToPercent(engineResult?.scoring?.relevance_to_object) ||
        (classification.confidence + (text.length > 1000 ? 10 : 0) + (aiResult?.suggestions?.length ? 8 : 0))
    )
  );
  const docKey = documentKey(mapDocumentRow({
    tenant_id: tenantId,
    source_type: sourceType,
    source_table: sourceType === 'evidence' ? 'evidences' : 'document_index',
    source_id: sourceId,
    filename: source.file_name,
    title: source.file_name || source.description,
    normalized_path: source.file_url || source.file_path,
    origin: source.provider || 'manual_upload',
    checksum: source.checksum,
    provider_file_id: source.provider_file_id,
  }));

  const profile = await pool.query(
    `
    INSERT INTO tenant_evidence_semantic_profiles (
      tenant_id, source_type, source_id, document_key, document_type, semantic_status,
      usefulness_score, classification_confidence, classification_method,
      classification_reason, scoring_json, metadata, processed_by_user_id, processed_at, updated_at
    )
    VALUES ($1::uuid,$2,$3::uuid,$4,$5,'processed',$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::uuid,now(),now())
    ON CONFLICT (tenant_id, source_type, source_id)
    DO UPDATE SET
      document_key = EXCLUDED.document_key,
      document_type = EXCLUDED.document_type,
      semantic_status = 'processed',
      usefulness_score = EXCLUDED.usefulness_score,
      classification_confidence = EXCLUDED.classification_confidence,
      classification_method = EXCLUDED.classification_method,
      classification_reason = EXCLUDED.classification_reason,
      scoring_json = EXCLUDED.scoring_json,
      metadata = EXCLUDED.metadata,
      processed_by_user_id = EXCLUDED.processed_by_user_id,
      processed_at = now(),
      updated_at = now()
    RETURNING *
    `,
    [
      tenantId,
      sourceType,
      sourceId,
      docKey,
      classification.document_type,
      usefulnessScore,
      classification.confidence,
      classification.method,
      classification.reason,
      JSON.stringify({
        relevance_to_object: usefulnessScore,
        document_quality: scoreToPercent(engineResult?.scoring?.document_quality) || classification.confidence,
        traceability: scoreToPercent(engineResult?.scoring?.traceability) || (chunks.length ? 80 : 45),
        freshness: source.modified_at || source.created_at ? 70 : 45,
        human_review_required: true,
      }),
      JSON.stringify({ extraction, ai_engine_result: Boolean(engineResult), legacy_document_ai_result: aiResult?.ok === true, text_char_count: text.length }),
      userId,
    ]
  );

  const insertedChunks = [];
  for (const chunk of chunks.slice(0, 40)) {
    const result = await pool.query(
      `
      INSERT INTO tenant_evidence_chunks (
        tenant_id, source_type, source_id, document_key, filename,
        chunk_index, chunk_text, chunk_hash, metadata
      )
      VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING id, chunk_index, chunk_text, chunk_hash
      `,
      [
        tenantId,
        sourceType,
        sourceId,
        docKey,
        source.file_name || source.description || 'Documento',
        chunk.chunk_index,
        chunk.chunk_text,
        chunk.chunk_hash,
        JSON.stringify({ extraction_method: extraction.method || null, page_number: chunk.page_number || null, section_label: chunk.section_label || null }),
      ]
    );
    insertedChunks.push(result.rows[0]);
  }

  const createdSuggestions = [];
  const bestChunk = insertedChunks[0] || null;
  const engineSuggestions = Array.isArray(engineResult?.suggestions) ? engineResult.suggestions : [];
  const suggestionsToPersist = engineSuggestions.length
    ? engineSuggestions
    : Object.entries(candidateTargets).flatMap(([targetType, candidates]) =>
        candidates.slice(0, 120).map((target) => {
          const scored = scoreTarget(text, target);
          return {
            target_type: targetType,
            target_id: target.id,
            target_label: target.label,
            score: scored.score,
            confidence: Math.min(95, scored.score + 5),
            reason: `Coincidencias detectadas: ${scored.matches.slice(0, 5).join(', ') || 'contexto documental relevante'}. Requiere revisión humana.`,
            snippet: bestChunk?.chunk_text?.slice(0, 600) || text.slice(0, 600),
            metadata: { method: 'rule_based_keyword_overlap', matches: scored.matches.slice(0, 12) },
          };
        }).filter((item) => item.score >= 28)
      );

  for (const suggestion of suggestionsToPersist.slice(0, 30)) {
    const targetType = asString(suggestion.target_type, 40);
    const targetId = asString(suggestion.target_id, 80);
    if (!TARGET_TYPES.has(targetType) || !isUuid(targetId)) continue;
    const matchedChunk = Number.isFinite(Number(suggestion.chunk_index))
      ? insertedChunks.find((chunk) => Number(chunk.chunk_index) === Number(suggestion.chunk_index))
      : bestChunk;
    const target = (candidateTargets[targetType] || []).find((candidate) => String(candidate.id) === String(targetId));
    if (!target && !engineSuggestions.length) continue;
    const result = await pool.query(
      `
      INSERT INTO tenant_evidence_applicability_suggestions (
        tenant_id, source_type, source_id, document_key, target_type, target_id,
        target_label, score, confidence, reason, chunk_id, snippet, status, metadata, updated_at
      )
      VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6::uuid,$7,$8,$9,$10,$11::uuid,$12,'suggested',$13::jsonb,now())
      RETURNING *
      `,
      [
        tenantId,
        sourceType,
        sourceId,
        docKey,
        targetType,
        targetId,
        suggestion.target_label || target?.label || 'Objeto sugerido',
        scoreToPercent(suggestion.score) || 0,
        scoreToPercent(suggestion.confidence) || scoreToPercent(suggestion.score) || 0,
        asString(suggestion.reason, 1000) || 'Sugerencia generada por análisis documental. Requiere revisión humana.',
        matchedChunk?.id || null,
        asString(suggestion.snippet, 1000) || matchedChunk?.chunk_text?.slice(0, 600) || text.slice(0, 600),
        JSON.stringify(suggestion.metadata || { method: engineSuggestions.length ? 'ai_engine_semantic_evidence' : 'rule_based_keyword_overlap' }),
      ]
    ).catch((error) => {
      if (['42P01', '42703'].includes(error.code)) return { rows: [] };
      throw error;
    });
    if (result.rows[0]) createdSuggestions.push(result.rows[0]);
  }

  return {
    profile: profile.rows[0],
    chunks: insertedChunks.slice(0, 20),
    suggestions: createdSuggestions,
    ai_engine_used: Boolean(engineResult),
    human_review_required: true,
  };
}

async function reviewSuggestion({ user, suggestionId, action }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  const status = action === 'accept' ? 'accepted' : 'rejected';
  const result = await pool.query(
    `
    UPDATE tenant_evidence_applicability_suggestions
    SET status = $1,
        reviewed_by_user_id = $2::uuid,
        reviewed_at = now(),
        updated_at = now()
    WHERE tenant_id = $3::uuid
      AND id = $4::uuid
    RETURNING *
    `,
    [status, userId, tenantId, suggestionId]
  );
  if (result.rowCount === 0) throw publicError(404, 'SUGGESTION_NOT_FOUND', 'Sugerencia no encontrada.');
  const suggestion = result.rows[0];
  let association = null;
  if (status === 'accepted' && suggestion.target_id) {
    association = await createAssociation({
      user,
      payload: {
        source_type: suggestion.source_type,
        source_id: suggestion.source_id,
        target_type: suggestion.target_type,
        target_id: suggestion.target_id,
        evidence_usage: suggestion.target_type === 'action' ? 'action_evidence' : 'supporting_evidence',
        notes: suggestion.reason,
        created_from: 'semantic_suggestion',
      },
    });
  }
  return { suggestion, association };
}

module.exports = {
  listSources,
  listDocuments,
  getDocumentDetail,
  listDocumentChildren,
  listAssociations,
  createAssociation,
  setAssociationStatus,
  listTargetCandidates,
  analyzeSemanticEvidence,
  reviewSuggestion,
};
