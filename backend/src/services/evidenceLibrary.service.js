'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const { analyzeDocument } = require('./documentAiAnalysis.service');
const { extractDocumentContent } = require('./documentContentExtraction.service');
const zohoWorkdrive = require('./zohoWorkdriveClient.service');

const READ_ROLES = new Set(['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'auditor', 'responsable_area', 'area_owner', 'operativo']);
const MANAGE_ROLES = new Set(['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin']);
const SOURCE_TYPES = new Set(['document_index', 'evidence']);
const TARGET_TYPES = new Set(['control', 'nonconformity', 'finding', 'process', 'operation', 'risk', 'action']);
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const ZOHO_PROVIDER = 'zoho_workdrive';
const ZOHO_FOLDER_MIME = 'application/vnd.zoho.workdrive.folder';
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
const MANUAL_UPLOAD_PROVIDER = 'manual_upload';
const MANUAL_UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads', 'evidence-library');
const MANUAL_UPLOAD_MAX_FILES = Number(process.env.EVIDENCE_LIBRARY_UPLOAD_MAX_FILES || 50);
const MANUAL_UPLOAD_MAX_FILE_BYTES = Number(process.env.EVIDENCE_LIBRARY_UPLOAD_MAX_FILE_BYTES || 25 * 1024 * 1024);
const MANUAL_UPLOAD_ZIP_MAX_BYTES = Number(process.env.EVIDENCE_LIBRARY_ZIP_MAX_BYTES || 50 * 1024 * 1024);
const MANUAL_UPLOAD_ZIP_MAX_EXTRACTED_BYTES = Number(process.env.EVIDENCE_LIBRARY_ZIP_MAX_EXTRACTED_BYTES || 250 * 1024 * 1024);
const MANUAL_UPLOAD_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
]);
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

function shortLogId(value) {
  const raw = String(value || '');
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function documentVisibilityMode(filters = {}) {
  const mode = String(filters.version || filters.visibility || 'active').toLowerCase().trim();
  if (mode === 'excluded' || mode === 'all') return mode;
  return 'active';
}

function documentVisibilitySql(alias, mode, hasExclusions) {
  const status = `COALESCE(${alias}.status, 'indexed')`;
  const exclusionCheck = hasExclusions ? '(x.id IS NOT NULL OR sx.id IS NOT NULL)' : 'false';
  if (mode === 'excluded') {
    return `AND (${status} = 'excluded' OR ${exclusionCheck})`;
  }
  if (mode === 'all') {
    return `AND ${status} NOT IN ('deleted', 'ignored', 'missing')`;
  }
  return `AND ${status} NOT IN ('deleted', 'ignored', 'missing', 'excluded') ${hasExclusions ? 'AND x.id IS NULL AND sx.id IS NULL' : ''}`;
}

function isExcludedRow(row = {}) {
  return String(row.status || '').toLowerCase() === 'excluded' || Boolean(row.exclusion_id);
}

function safeUploadFileName(value, fallback = 'documento') {
  const base = path.basename(String(value || fallback)).replace(/[\r\n"]/g, '_');
  const clean = base.replace(/[^\w.\- ()\[\]áéíóúÁÉÍÓÚñÑ]/g, '_').replace(/_+/g, '_').slice(0, 180);
  return clean || fallback;
}

function normalizeRelativePath(value, fallbackName = 'documento') {
  const raw = String(value || fallbackName).replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) {
    throw publicError(400, 'INVALID_UPLOAD_PATH', 'Ruta de archivo inválida en carga manual.');
  }

  const normalized = path.posix.normalize(raw);
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.includes('\0')
  ) {
    throw publicError(400, 'INVALID_UPLOAD_PATH', 'Ruta de archivo inválida en carga manual.');
  }

  return normalized;
}

function fileExtension(fileName = '') {
  return path.extname(String(fileName || '')).toLowerCase();
}

function mimeTypeForFile(fileName = '', provided = '') {
  const mime = String(provided || '').trim();
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = fileExtension(fileName);
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return map[ext] || 'application/octet-stream';
}

function assertAllowedManualFile(fileName, size = 0) {
  const ext = fileExtension(fileName);
  if (!MANUAL_UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
    throw publicError(400, 'MANUAL_UPLOAD_FILE_TYPE_NOT_ALLOWED', `Tipo de archivo no permitido para biblioteca documental: ${ext || 'sin extensión'}`);
  }
  if (Number(size || 0) > MANUAL_UPLOAD_MAX_FILE_BYTES) {
    throw publicError(400, 'MANUAL_UPLOAD_FILE_TOO_LARGE', 'El archivo excede el tamaño máximo permitido para carga manual.');
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safeManualUploadError(error) {
  const message = String(error?.message || '').trim();
  const sqlLike = Boolean(error?.code) || /sql|postgres|parameter|\$\d+|inconsistent types|column|constraint|syntax/i.test(message);
  if (sqlLike) {
    console.warn('WARN MANUAL_UPLOAD_INDEX_CONTROLLED_ERROR:', {
      code: error?.code || null,
      detail: error?.detail ? 'present' : null,
      hint: error?.hint ? 'present' : null,
    });
    return 'No fue posible indexar el archivo. Revise logs del servidor.';
  }
  return message || 'No fue posible procesar el archivo.';
}

function tenantUploadRoot(tenantId) {
  const tenantPart = String(tenantId || '').replace(/[^0-9a-fA-F-]/g, '');
  return path.join(MANUAL_UPLOAD_ROOT, tenantPart, 'manual');
}

async function writeManualUploadFile({ tenantId, buffer, originalName, relativePath = null }) {
  const safeName = safeUploadFileName(originalName);
  const dateFolder = new Date().toISOString().slice(0, 10);
  const storageDir = path.join(tenantUploadRoot(tenantId), dateFolder);
  await fs.promises.mkdir(storageDir, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const absolutePath = path.join(storageDir, storedName);
  const root = tenantUploadRoot(tenantId);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(root))) {
    throw publicError(400, 'INVALID_UPLOAD_PATH', 'Ruta de almacenamiento inválida.');
  }
  await fs.promises.writeFile(resolved, buffer);
  const storageRelativePath = path.relative(path.resolve(__dirname, '..', '..'), resolved).replace(/\\/g, '/');
  return {
    absolutePath: resolved,
    storageRelativePath,
    relativePath: normalizeRelativePath(relativePath || safeName, safeName),
  };
}

function readZipEntries(buffer) {
  if (!buffer || buffer.length > MANUAL_UPLOAD_ZIP_MAX_BYTES) {
    throw publicError(400, 'ZIP_TOO_LARGE', 'El ZIP excede el tamaño máximo permitido.');
  }

  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw publicError(400, 'INVALID_ZIP', 'ZIP inválido o incompleto.');

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirOffset;
  let extractedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    offset += 46 + fileNameLength + extraLength + commentLength;

    if (!rawName || rawName.endsWith('/')) continue;
    if ((flags & 0x1) === 0x1) {
      entries.push({ skipped: true, relativePath: rawName, reason: 'Archivo ZIP cifrado omitido.' });
      continue;
    }
    if (![0, 8].includes(method)) {
      entries.push({ skipped: true, relativePath: rawName, reason: 'Método de compresión no soportado.' });
      continue;
    }
    if (uncompressedSize > MANUAL_UPLOAD_MAX_FILE_BYTES) {
      entries.push({ skipped: true, relativePath: rawName, reason: 'Archivo extraído excede límite por archivo.' });
      continue;
    }
    extractedBytes += uncompressedSize;
    if (extractedBytes > MANUAL_UPLOAD_ZIP_MAX_EXTRACTED_BYTES) {
      throw publicError(400, 'ZIP_EXTRACTED_TOO_LARGE', 'El contenido extraído del ZIP excede el límite permitido.');
    }

    let relativePath;
    try {
      relativePath = normalizeRelativePath(rawName, rawName);
      assertAllowedManualFile(relativePath, uncompressedSize);
    } catch (error) {
      entries.push({ skipped: true, relativePath: rawName, reason: error.message });
      continue;
    }

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      entries.push({ skipped: true, relativePath, reason: 'Entrada ZIP inválida.' });
      continue;
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : zlib.inflateRawSync(compressed);
    if (content.length !== uncompressedSize) {
      entries.push({ skipped: true, relativePath, reason: 'Tamaño extraído inesperado.' });
      continue;
    }
    entries.push({ relativePath, buffer: content });
  }

  return entries;
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
  if (provider.includes('manual')) return 'Carga manual';
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
    mime === ZOHO_FOLDER_MIME ||
    extension === 'folder' ||
    documentType === 'folder' ||
    google.is_folder === true ||
    String(google.is_folder || '').toLowerCase() === 'true' ||
    String(google.item_type || '').toLowerCase() === 'folder' ||
    zoho.is_folder === true ||
    String(zoho.is_folder || '').toLowerCase() === 'true' ||
    String(zoho.item_type || '').toLowerCase() === 'folder'
  );
}

function itemTypeForRow(row = {}) {
  if (row.item_type) return row.item_type;
  if (row.source_type === 'evidence') return 'file';
  return isFolderDocument(row) ? 'folder' : 'file';
}

function folderProviderFileId(source = {}) {
  const metadata = source.metadata || source.metadata_json || {};
  const provider = String(source.provider || source.origin || '').toLowerCase();
  if (provider === ZOHO_PROVIDER) {
    const zoho = metadata.zoho || {};
    return asString(
      source.provider_file_id ||
        zoho.provider_file_id ||
        zoho.id ||
        zoho.file_id,
      200
    );
  }

  return asString(
    source.provider_file_id ||
      metadata.provider_file_id ||
      metadata.google?.id ||
      metadata.google?.folder_id ||
      metadata.zoho?.provider_file_id ||
      metadata.zoho?.id ||
      metadata.zoho?.file_id,
    200
  );
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
  const excluded = isExcludedRow(row);
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
    is_excluded: excluded,
    exclusion_id: row.exclusion_id || null,
    exclusion_scope: row.exclusion_scope || null,
    can_analyze: itemType === 'file' && !excluded,
    can_associate: itemType === 'file' && !excluded,
    can_open: itemType === 'folder' && !excluded,
    can_sync: itemType === 'folder',
    can_exclude: sourceType === 'document_index' && !excluded,
    can_restore: sourceType === 'document_index' && excluded,
    disabled_reason: excluded
      ? 'Elemento excluido del índice visible. Restáurelo antes de analizarlo o asociarlo.'
      : (itemType === 'folder' ? 'Las carpetas no se pueden analizar ni asociar como evidencia. Abra la carpeta y seleccione un archivo.' : null),
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

async function ensureManualUploadSource(tenantId, userId) {
  if (!(await tableExists('tenant_document_sources'))) {
    throw publicError(500, 'DOCUMENT_SOURCES_TABLE_MISSING', 'No existe tabla de fuentes documentales.');
  }

  const existing = await pool.query(
    `
    SELECT *
    FROM tenant_document_sources
    WHERE tenant_id = $1::uuid
      AND provider = $2
      AND COALESCE(status, 'active') <> 'disconnected'
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [tenantId, MANUAL_UPLOAD_PROVIDER]
  );
  if (existing.rowCount > 0) return existing.rows[0];

  const result = await pool.query(
    `
    INSERT INTO tenant_document_sources (
      tenant_id,
      provider,
      source_name,
      status,
      sync_enabled,
      scan_frequency,
      metadata_json,
      created_by_user_id,
      created_by,
      last_sync_at,
      updated_at
    )
    VALUES ($1::uuid,$2::text,'Carga manual','active',false,'manual',$3::jsonb,$4::uuid,$4::uuid,NOW(),NOW())
    RETURNING *
    `,
    [
      tenantId,
      MANUAL_UPLOAD_PROVIDER,
      JSON.stringify({
        source_type: MANUAL_UPLOAD_PROVIDER,
        created_from: 'evidence_library_manual_upload',
      }),
      userId || null,
    ]
  );
  return result.rows[0];
}

async function touchDocumentSourceSync(sourceId, tenantId) {
  if (!sourceId || !(await tableExists('tenant_document_sources'))) return;
  await pool.query(
    `
    UPDATE tenant_document_sources
    SET last_sync_at = NOW(),
        status = 'active',
        updated_at = NOW()
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    `,
    [sourceId, tenantId]
  ).catch((error) => {
    if (!['42P01', '42703'].includes(error.code)) throw error;
  });
}

async function upsertManualDocumentIndex({
  tenantId,
  sourceId,
  userId,
  fileName,
  mimeType,
  sizeBytes,
  checksum,
  relativePath,
  localStoragePath,
  storageRelativePath,
  documentType = null,
  isFolder = false,
}) {
  if (!(await tableExists('document_index'))) {
    throw publicError(500, 'DOCUMENT_INDEX_TABLE_MISSING', 'No existe tabla de índice documental.');
  }

  const normalizedRelativePath = normalizeRelativePath(relativePath || fileName, fileName);
  const providerFileId = isFolder
    ? `manual_folder:${normalizedRelativePath}`
    : `manual:${checksum}:${normalizedRelativePath}`;
  const folderPath = normalizedRelativePath.includes('/')
    ? normalizedRelativePath.split('/').slice(0, -1).join('/')
    : null;
  const extension = isFolder ? 'folder' : fileExtension(fileName).replace(/^\./, '');
  const metadata = {
    manual_upload: true,
    is_folder: Boolean(isFolder),
    relative_path: normalizedRelativePath,
    folder_path: folderPath,
    uploaded_by_user_id: userId || null,
    uploaded_at: new Date().toISOString(),
    storage_relative_path: storageRelativePath || null,
  };

  const result = await pool.query(
    `
    INSERT INTO document_index (
      tenant_id,
      source_id,
      provider,
      provider_file_id,
      provider_version_id,
      file_name,
      mime_type,
      file_extension,
      file_url,
      size_bytes,
      checksum,
      content_hash,
      file_hash,
      relative_path,
      local_storage_path,
      modified_at,
      indexed_at,
      last_seen_at,
      status,
      metadata_json
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::text,
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::text,
      $10::bigint,
      $11::text,
      $11::text,
      $11::text,
      $12::text,
      $13::text,
      NOW(),
      NOW(),
      NOW(),
      'indexed',
      $14::jsonb
    )
    ON CONFLICT (tenant_id, provider, provider_file_id)
    DO UPDATE SET
      source_id = EXCLUDED.source_id,
      provider_version_id = EXCLUDED.provider_version_id,
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      file_extension = EXCLUDED.file_extension,
      file_url = EXCLUDED.file_url,
      size_bytes = EXCLUDED.size_bytes,
      checksum = EXCLUDED.checksum,
      content_hash = EXCLUDED.content_hash,
      file_hash = EXCLUDED.file_hash,
      relative_path = EXCLUDED.relative_path,
      local_storage_path = EXCLUDED.local_storage_path,
      modified_at = NOW(),
      last_seen_at = NOW(),
      status = 'indexed',
      metadata_json = EXCLUDED.metadata_json
    RETURNING
      tenant_id,
      'document_index' AS source_type,
      'document_index' AS source_table,
      id AS db_source_id,
      id AS document_index_id,
      id AS source_id,
      source_id AS document_source_id,
      file_name AS filename,
      file_name AS title,
      file_url AS normalized_path,
      relative_path,
      web_view_url,
      provider AS origin,
      provider,
      provider_file_id,
      provider_version_id,
      mime_type,
      file_extension,
      checksum,
      status,
      indexed_at AS last_indexed_at,
      $15::text AS detected_document_type,
      'not_processed' AS semantic_status,
      NULL::numeric AS usefulness_score,
      NULL::text AS profile_document_type,
      metadata_json AS metadata
    `,
    [
      tenantId,
      sourceId,
      MANUAL_UPLOAD_PROVIDER,
      providerFileId,
      checksum || providerFileId,
      fileName,
      mimeType,
      extension,
      storageRelativePath || null,
      Number(sizeBytes || 0),
      checksum || providerFileId,
      normalizedRelativePath,
      localStoragePath || null,
      JSON.stringify(metadata),
      isFolder ? 'folder' : (documentType || 'unknown'),
    ]
  );

  return mapDocumentRow(result.rows[0]);
}

async function indexZipFolders({ tenantId, sourceId, userId, relativePaths }) {
  const folders = new Set();
  for (const rel of relativePaths) {
    const parts = String(rel || '').split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i += 1) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }

  const indexed = [];
  for (const folderPath of folders) {
    const folderName = folderPath.split('/').pop() || folderPath;
    const checksum = crypto.createHash('sha256').update(`folder:${folderPath}`).digest('hex');
    const row = await upsertManualDocumentIndex({
      tenantId,
      sourceId,
      userId,
      fileName: folderName,
      mimeType: 'application/vnd.tcdx.folder',
      sizeBytes: 0,
      checksum,
      relativePath: folderPath,
      localStoragePath: null,
      storageRelativePath: null,
      documentType: 'folder',
      isFolder: true,
    });
    indexed.push(row);
  }
  return indexed;
}

async function manualUploadFiles({ user, files = [], fields = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  if (!Array.isArray(files) || files.length === 0) {
    throw publicError(400, 'MANUAL_UPLOAD_FILES_REQUIRED', 'Seleccione uno o más archivos para cargar.');
  }
  if (files.length > MANUAL_UPLOAD_MAX_FILES) {
    throw publicError(400, 'MANUAL_UPLOAD_TOO_MANY_FILES', 'La carga excede el máximo de archivos permitido.');
  }

  const source = await ensureManualUploadSource(tenantId, userId);
  const documents = [];
  const skipped = [];

  for (const file of files) {
    try {
      const originalName = safeUploadFileName(file.originalname || 'documento');
      assertAllowedManualFile(originalName, file.size || file.buffer?.length || 0);
      const checksum = sha256(file.buffer);
      const written = await writeManualUploadFile({
        tenantId,
        buffer: file.buffer,
        originalName,
        relativePath: fields.relative_path || originalName,
      });
      const row = await upsertManualDocumentIndex({
        tenantId,
        sourceId: source.id,
        userId,
        fileName: originalName,
        mimeType: mimeTypeForFile(originalName, file.mimetype),
        sizeBytes: file.size || file.buffer.length,
        checksum,
        relativePath: written.relativePath,
        localStoragePath: written.absolutePath,
        storageRelativePath: written.storageRelativePath,
        documentType: fields.document_type || null,
      });
      documents.push(row);
    } catch (error) {
      skipped.push({ filename: file.originalname || 'documento', reason: safeManualUploadError(error) });
    }
  }

  await touchDocumentSourceSync(source.id, tenantId);
  return {
    summary: {
      uploaded: files.length,
      indexed: documents.length,
      skipped: skipped.length,
      files_seen: files.length,
      files_indexed: documents.length,
      files_skipped: skipped.length,
      files_errors: skipped.length,
      folders_seen: 0,
      folders_indexed: 0,
      errors: skipped,
    },
    source: {
      source_type: 'manual_upload',
      source_id: source.id,
      source_name: source.source_name || 'Carga manual',
      status: source.status || 'active',
    },
    documents,
  };
}

async function manualUploadZip({ user, file, fields = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  if (!file?.buffer) {
    throw publicError(400, 'MANUAL_UPLOAD_ZIP_REQUIRED', 'Seleccione un archivo ZIP para cargar.');
  }
  if (!String(file.originalname || '').toLowerCase().endsWith('.zip')) {
    throw publicError(400, 'MANUAL_UPLOAD_ZIP_REQUIRED', 'El archivo debe ser ZIP.');
  }

  const source = await ensureManualUploadSource(tenantId, userId);
  const entries = readZipEntries(file.buffer);
  const files = entries.filter((entry) => !entry.skipped);
  const skipped = entries.filter((entry) => entry.skipped).map((entry) => ({
    filename: entry.relativePath || 'entrada_zip',
    reason: entry.reason || 'Entrada omitida.',
  }));
  if (files.length > MANUAL_UPLOAD_MAX_FILES) {
    throw publicError(400, 'MANUAL_UPLOAD_TOO_MANY_FILES', 'El ZIP excede el máximo de archivos permitido.');
  }

  const folderRows = await indexZipFolders({
    tenantId,
    sourceId: source.id,
    userId,
    relativePaths: files.map((entry) => entry.relativePath),
  });
  const documents = [...folderRows];

  for (const entry of files) {
    try {
      const originalName = safeUploadFileName(path.posix.basename(entry.relativePath));
      const checksum = sha256(entry.buffer);
      const written = await writeManualUploadFile({
        tenantId,
        buffer: entry.buffer,
        originalName,
        relativePath: entry.relativePath,
      });
      const row = await upsertManualDocumentIndex({
        tenantId,
        sourceId: source.id,
        userId,
        fileName: originalName,
        mimeType: mimeTypeForFile(originalName),
        sizeBytes: entry.buffer.length,
        checksum,
        relativePath: written.relativePath,
        localStoragePath: written.absolutePath,
        storageRelativePath: written.storageRelativePath,
        documentType: fields.document_type || null,
      });
      documents.push(row);
    } catch (error) {
      skipped.push({ filename: entry.relativePath || 'entrada_zip', reason: safeManualUploadError(error) });
    }
  }

  await touchDocumentSourceSync(source.id, tenantId);
  return {
    summary: {
      uploaded: 1,
      indexed: documents.filter((doc) => doc.item_type !== 'folder').length,
      skipped: skipped.length,
      files_seen: files.length,
      files_indexed: documents.filter((doc) => doc.item_type !== 'folder').length,
      files_skipped: skipped.length,
      files_errors: skipped.length,
      folders_seen: folderRows.length,
      folders_indexed: documents.filter((doc) => doc.item_type === 'folder').length,
      errors: skipped,
    },
    source: {
      source_type: 'manual_upload',
      source_id: source.id,
      source_name: source.source_name || 'Carga manual',
      status: source.status || 'active',
    },
    documents,
  };
}

function defaultSourceActions(sourceType, sourceId = null, status = 'available') {
  const currentStatus = String(status || '').toLowerCase();
  const active = ['active', 'connected'].includes(currentStatus);
  if (sourceType === 'google_drive') {
    if (!sourceId || currentStatus === 'not_connected' || currentStatus === 'available') {
      return [action('connect', 'Conectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' })];
    }
    if (currentStatus === 'folder_required') {
      return [
        action('select_folder', 'Seleccionar carpeta', { kind: 'google_folder_selector', body: { source_id: sourceId } }),
        action('reconnect', 'Reconectar', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' }),
        action('disconnect', 'Desconectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
      ];
    }
    if (currentStatus === 'needs_reconnection') {
      return [
        action('reconnect', 'Reconectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' }),
        action('disconnect', 'Desconectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
      ];
    }
    return [
      action('sync', currentStatus === 'sync_error' ? 'Sincronizar nuevamente' : 'Sincronizar carpeta', { method: 'POST', path: '/api/document-integrations/google/sync', body: { source_id: sourceId } }),
      action('change_folder', 'Cambiar carpeta', { kind: 'google_folder_selector', body: { source_id: sourceId } }),
      action('reconnect', 'Reconectar', { method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth' }),
      action('disconnect', 'Desconectar Google Drive', { method: 'POST', path: '/api/document-integrations/google/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
    ];
  }
  if (sourceType === 'zoho_drive' || sourceType === 'zoho_workdrive') {
    if (!zohoWorkdrive.isZohoConfigured()) {
      return [action('connect', 'Conectar Zoho WorkDrive', { enabled: false, kind: 'info', reason: 'Zoho WorkDrive no está configurado por la plataforma.' })];
    }
    if (!sourceId || currentStatus === 'not_connected' || currentStatus === 'available') {
      return [action('connect', 'Conectar Zoho WorkDrive', { method: 'POST', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' })];
    }
    if (currentStatus === 'folder_required') {
      return [
        action('select_folder', 'Seleccionar carpeta', { kind: 'zoho_folder_selector', body: { source_id: sourceId } }),
        action('select_folder_url', 'Pegar URL de carpeta', { kind: 'zoho_folder_url', body: { source_id: sourceId } }),
        action('reconnect', 'Reconectar', { method: 'POST', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' }),
        action('disconnect', 'Desconectar Zoho WorkDrive', { method: 'POST', path: '/api/document-integrations/zoho/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
      ];
    }
    if (currentStatus === 'needs_reconnection' || currentStatus === 'zoho_oauth_unauthorized') {
      return [
        action('reconnect', 'Reconectar Zoho WorkDrive', { method: 'POST', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' }),
        action('disconnect', 'Desconectar Zoho WorkDrive', { method: 'POST', path: '/api/document-integrations/zoho/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
      ];
    }
    return [
      action('sync', currentStatus === 'sync_error' ? 'Sincronizar nuevamente' : 'Sincronizar', { method: 'POST', path: '/api/document-integrations/zoho/sync', body: { source_id: sourceId } }),
      action('change_folder', 'Cambiar carpeta', { kind: 'zoho_folder_selector', body: { source_id: sourceId } }),
      action('select_folder_url', 'Pegar URL de carpeta', { kind: 'zoho_folder_url', body: { source_id: sourceId } }),
      action('reconnect', 'Reconectar', { method: 'POST', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth' }),
      action('disconnect', 'Desconectar Zoho WorkDrive', { method: 'POST', path: '/api/document-integrations/zoho/disconnect', kind: 'disconnect_provider', body: { source_id: sourceId } }),
    ];
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
    return [
      action('upload_files', 'Subir archivos', { kind: 'upload_files', path: '/api/evidence-library/manual-upload/files', method: 'POST' }),
      action('upload_zip', 'Subir ZIP', { kind: 'upload_zip', path: '/api/evidence-library/manual-upload/zip', method: 'POST' }),
    ];
  }
  return [action('info', 'Configuración pendiente', { enabled: false, kind: 'info', reason: 'Conector no implementado para esta fuente.' })];
}

async function listSources({ user }) {
  const { tenantId } = assertAccess(user, 'read');
  const cards = [
    { source_type: 'google_drive', source_name: 'Google Drive', status: 'available', documents_count: 0 },
    { source_type: 'zoho_drive', source_name: 'Zoho WorkDrive', status: zohoWorkdrive.isZohoConfigured() ? 'available' : 'configuration_required', documents_count: 0 },
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
        provider.includes('manual') ? card.source_type === 'manual_upload' :
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
      SELECT
        s.id,
        s.provider,
        s.source_name,
        s.status,
        s.last_sync_at,
        s.updated_at,
        s.folder_id,
        s.folder_path,
        s.folder_display_name,
        s.provider_account_email,
        s.last_sync_status,
        s.last_sync_error,
        i.status AS integration_status,
        COALESCE(dc.documents_count, 0)::int AS source_documents_count
      FROM tenant_document_sources s
      LEFT JOIN tenant_integrations i
        ON i.id = s.integration_id
       AND i.tenant_id = s.tenant_id
      LEFT JOIN (
        SELECT source_id, COUNT(*)::int AS documents_count
        FROM document_index
        WHERE tenant_id = $1::uuid
          AND COALESCE(status, 'indexed') NOT IN ('deleted', 'ignored', 'missing')
        GROUP BY source_id
      ) dc ON dc.source_id = s.id
      WHERE s.tenant_id = $1::uuid
        AND COALESCE(s.status, '') <> 'disconnected'
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC NULLS LAST
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
        let status = row.status || match.status || 'active';
        if (cardType === 'google_drive') {
          if (!row.integration_status || row.integration_status !== 'connected') {
            status = 'needs_reconnection';
          } else if (!row.folder_id) {
            status = 'folder_required';
          } else if (row.last_sync_status === 'failed' || row.last_sync_error) {
            status = 'sync_error';
          } else {
            status = 'connected';
          }
        } else if (cardType === 'zoho_drive') {
          if (!zohoWorkdrive.isZohoConfigured()) {
            status = 'configuration_required';
          } else if (row.status === 'error' && row.last_sync_status === 'zoho_oauth_unauthorized') {
            status = 'zoho_oauth_unauthorized';
          } else if (!row.folder_id) {
            status = 'folder_required';
          } else if (row.last_sync_status === 'failed' || row.last_sync_error) {
            status = 'sync_error';
          } else {
            status = 'active';
          }
        }
        match.status = status;
        match.source_id = row.id;
        match.source_name = match.source_name || row.source_name;
        match.root_folder_id = row.folder_id || null;
        match.root_folder_name = row.folder_display_name || row.folder_path || null;
        match.provider_account_email = row.provider_account_email || null;
        match.account_email = row.provider_account_email || null;
        match.last_sync_status = row.last_sync_status || null;
        match.last_sync_error = row.last_sync_error || null;
        match.last_sync_at = match.last_sync_at || row.last_sync_at || row.updated_at || null;
        if (Number(row.source_documents_count || 0) > 0) {
          match.documents_count = Number(row.source_documents_count || 0);
        }
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
    manual.status = manual.status || 'active';
    manual.documents_count = Number(manual.documents_count || 0) + Number(result.rows[0]?.documents_count || 0);
    manual.last_sync_at = manual.last_sync_at || result.rows[0]?.last_sync_at || null;
  }

  return cards.map((card) => {
    const normalizedCard = { ...card };
    if (normalizedCard.source_type === 'google_drive' && !normalizedCard.source_id) {
      normalizedCard.status = 'not_connected';
      normalizedCard.root_folder_id = null;
      normalizedCard.root_folder_name = null;
      normalizedCard.provider_account_email = null;
      normalizedCard.account_email = null;
    }
    if (normalizedCard.source_type === 'zoho_drive' && !zohoWorkdrive.isZohoConfigured()) {
      normalizedCard.status = 'configuration_required';
      normalizedCard.provider_account_email = null;
      normalizedCard.account_email = null;
      normalizedCard.last_sync_error = 'Zoho WorkDrive no está configurado por la plataforma.';
    } else if (normalizedCard.source_type === 'zoho_drive' && !normalizedCard.source_id) {
      normalizedCard.status = 'available';
      normalizedCard.root_folder_id = null;
      normalizedCard.root_folder_name = null;
      normalizedCard.provider_account_email = null;
      normalizedCard.account_email = null;
    }
    return {
      ...normalizedCard,
      connected: Boolean(normalizedCard.source_id && ['active', 'connected', 'folder_required', 'sync_error', 'zoho_oauth_unauthorized'].includes(String(normalizedCard.status || '').toLowerCase())),
      item_type: 'source',
      can_sync: true,
      actions: defaultSourceActions(normalizedCard.source_type, normalizedCard.source_id, normalizedCard.status),
    };
  });
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
  const visibilityMode = documentVisibilityMode(filters);

  if (await tableExists('document_index')) {
    const hasAiAnalysis = await tableExists('document_ai_analysis');
    const hasSemanticProfiles = await tableExists('tenant_evidence_semantic_profiles');
    const hasExclusions = await tableExists('tenant_document_index_exclusions');
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
        ${hasExclusions ? 'COALESCE(x.id, sx.id)' : 'NULL::uuid'} AS exclusion_id,
        ${hasExclusions ? 'COALESCE(x.exclusion_scope, sx.exclusion_scope)' : 'NULL::text'} AS exclusion_scope,
        ${hasExclusions ? 'COALESCE(x.reason, sx.reason)' : 'NULL::text'} AS exclusion_reason,
        ${hasExclusions ? 'COALESCE(x.excluded_at, sx.excluded_at)' : 'NULL::timestamp'} AS excluded_at,
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
      ${hasExclusions ? `LEFT JOIN tenant_document_index_exclusions x
        ON x.tenant_id = d.tenant_id
       AND x.provider = d.provider
       AND x.provider_file_id = d.provider_file_id
       AND x.is_active = true
      LEFT JOIN tenant_document_index_exclusions sx
        ON sx.tenant_id = d.tenant_id
       AND sx.provider = d.provider
       AND sx.is_active = true
       AND sx.exclusion_scope = 'subtree'
       AND sx.provider_file_id <> d.provider_file_id
       AND (
         COALESCE(d.metadata_json->'google'->>'parent_folder_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->'zoho'->>'parent_folder_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->'zoho'->>'parent_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->'zoho'->>'folder_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->>'parent_folder_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->>'parent_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->>'source_folder_id', '') = sx.provider_file_id
         OR COALESCE(d.metadata_json->'google'->'parents', '[]'::jsonb) ? sx.provider_file_id
         OR EXISTS (
           SELECT 1
           FROM document_index root
           WHERE root.tenant_id = sx.tenant_id
             AND root.id = sx.document_index_id
             AND root.provider = d.provider
             AND root.relative_path IS NOT NULL
             AND root.relative_path <> ''
             AND d.source_id IS NOT DISTINCT FROM root.source_id
             AND d.relative_path ILIKE root.relative_path || '/%'
         )
       )
      ` : ''}
      WHERE d.tenant_id = $1::uuid
        ${documentVisibilitySql('d', visibilityMode, hasExclusions)}
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

  if (visibilityMode !== 'excluded' && await tableExists('evidences')) {
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

async function documentIndexHasActiveExclusion(tenantId, source = {}) {
  if (String(source.status || '').toLowerCase() === 'excluded') return true;
  if (!source.id || !source.provider || !source.provider_file_id) return false;
  if (!(await tableExists('tenant_document_index_exclusions'))) return false;
  const result = await pool.query(
    `
    SELECT COALESCE(x.id, sx.id) AS exclusion_id
    FROM document_index d
    LEFT JOIN tenant_document_index_exclusions x
      ON x.tenant_id = d.tenant_id
     AND x.provider = d.provider
     AND x.provider_file_id = d.provider_file_id
     AND x.is_active = true
    LEFT JOIN tenant_document_index_exclusions sx
      ON sx.tenant_id = d.tenant_id
     AND sx.provider = d.provider
     AND sx.is_active = true
     AND sx.exclusion_scope = 'subtree'
     AND sx.provider_file_id <> d.provider_file_id
     AND (
       COALESCE(d.metadata_json->'google'->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'parent_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'parent_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'source_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'google'->'parents', '[]'::jsonb) ? sx.provider_file_id
       OR EXISTS (
         SELECT 1
         FROM document_index root
         WHERE root.tenant_id = sx.tenant_id
           AND root.id = sx.document_index_id
           AND root.provider = d.provider
           AND root.relative_path IS NOT NULL
           AND root.relative_path <> ''
           AND d.source_id IS NOT DISTINCT FROM root.source_id
           AND d.relative_path ILIKE root.relative_path || '/%'
       )
     )
    WHERE d.tenant_id = $1::uuid
      AND d.id = $2::uuid
      AND (x.id IS NOT NULL OR sx.id IS NOT NULL)
    LIMIT 1
    `,
    [tenantId, source.id]
  ).catch((error) => {
    if (['42P01', '42703'].includes(error.code)) return { rows: [] };
    throw error;
  });
  return result.rowCount > 0;
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
  const isExcluded = sourceType === 'document_index' && await documentIndexHasActiveExclusion(tenantId, source);
  if (isExcluded && ['analyze', 'associate'].includes(mode)) {
    throw publicError(409, 'DOCUMENT_INDEX_EXCLUDED', 'El elemento está excluido del índice. Restáurelo antes de analizarlo o asociarlo.');
  }
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

async function listDocumentChildren({ user, sourceType, sourceId, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  const visibilityMode = documentVisibilityMode(filters);
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

  const parentProvider = String(source.provider || '').toLowerCase();
  const isZohoFolder = parentProvider === ZOHO_PROVIDER;
  const sourceMetadata = source.metadata_json || source.metadata || {};
  const folderProviderId = folderProviderFileId(source);
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
  const hasExclusions = await tableExists('tenant_document_index_exclusions');

  if (isZohoFolder && !folderProviderId) {
    console.warn('ZOHO_HIERARCHY_WARNING:', {
      tenant: shortLogId(tenantId),
      source_id: source.source_id || null,
      folder_document_index_id: normalizedSource.sourceId,
      warning: 'missing_parent_provider_file_id',
    });
    throw publicError(409, 'ZOHO_FOLDER_PROVIDER_ID_MISSING', 'La carpeta Zoho no tiene identificador de proveedor para resolver sus hijos.');
  }

  if (isZohoFolder) {
    console.info('ZOHO_CHILDREN_QUERY:', {
      tenant: shortLogId(tenantId),
      source_id: source.source_id || null,
      folder_document_index_id: normalizedSource.sourceId,
      parent_provider_file_id: shortLogId(folderProviderId),
      visibility: visibilityMode,
    });
  }

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
          OR COALESCE(d.mime_type, '') = 'application/vnd.zoho.workdrive.folder'
          OR COALESCE(d.metadata_json->'google'->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->'google'->>'item_type', '') = 'folder'
          OR COALESCE(d.metadata_json->'zoho'->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->'zoho'->>'item_type', '') = 'folder'
          OR COALESCE(d.metadata_json->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->>'manual_upload', 'false') = 'true' AND COALESCE(d.file_extension, '') = 'folder'
          OR COALESCE(d.file_extension, '') = 'folder'
        THEN 'folder'
        ELSE 'unknown'
      END AS detected_document_type,
      'not_processed' AS semantic_status,
      NULL::numeric AS usefulness_score,
      NULL::text AS profile_document_type,
      ${hasExclusions ? 'COALESCE(x.id, sx.id)' : 'NULL::uuid'} AS exclusion_id,
      ${hasExclusions ? 'COALESCE(x.exclusion_scope, sx.exclusion_scope)' : 'NULL::text'} AS exclusion_scope,
      ${hasExclusions ? 'COALESCE(x.reason, sx.reason)' : 'NULL::text'} AS exclusion_reason,
      ${hasExclusions ? 'COALESCE(x.excluded_at, sx.excluded_at)' : 'NULL::timestamp'} AS excluded_at,
      d.metadata_json AS metadata
    FROM document_index d
    ${hasExclusions ? `LEFT JOIN tenant_document_index_exclusions x
      ON x.tenant_id = d.tenant_id
     AND x.provider = d.provider
     AND x.provider_file_id = d.provider_file_id
     AND x.is_active = true
    LEFT JOIN tenant_document_index_exclusions sx
      ON sx.tenant_id = d.tenant_id
     AND sx.provider = d.provider
     AND sx.is_active = true
     AND sx.exclusion_scope = 'subtree'
     AND sx.provider_file_id <> d.provider_file_id
     AND (
       COALESCE(d.metadata_json->'google'->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'parent_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'zoho'->>'folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'parent_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'parent_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->>'source_folder_id', '') = sx.provider_file_id
       OR COALESCE(d.metadata_json->'google'->'parents', '[]'::jsonb) ? sx.provider_file_id
       OR EXISTS (
         SELECT 1
         FROM document_index root
         WHERE root.tenant_id = sx.tenant_id
           AND root.id = sx.document_index_id
           AND root.provider = d.provider
           AND root.relative_path IS NOT NULL
           AND root.relative_path <> ''
           AND d.source_id IS NOT DISTINCT FROM root.source_id
           AND d.relative_path ILIKE root.relative_path || '/%'
       )
     )
    ` : ''}
    WHERE d.tenant_id = $1::uuid
      AND d.id <> $2::uuid
      AND d.provider = $5::text
      ${documentVisibilitySql('d', visibilityMode, hasExclusions)}
      AND (
        (
          $5::text = 'zoho_workdrive'
          AND $3::text IS NOT NULL
          AND (
            COALESCE(d.metadata_json->'zoho'->>'parent_folder_id', '') = $3::text
            OR COALESCE(d.metadata_json->'zoho'->>'parent_id', '') = $3::text
            OR COALESCE(d.metadata_json->'zoho'->>'folder_id', '') = $3::text
          )
        )
        OR (
          $5::text <> 'zoho_workdrive'
          AND (
            ($3::text IS NOT NULL AND COALESCE(d.metadata_json->'google'->>'parent_folder_id', '') = $3::text)
            OR ($3::text IS NOT NULL AND COALESCE(d.metadata_json->>'parent_id', '') = $3::text)
            OR ($3::text IS NOT NULL AND COALESCE(d.metadata_json->>'source_folder_id', '') = $3::text)
            OR ($4::text IS NOT NULL AND d.relative_path ILIKE $4::text)
            OR ($4::text IS NOT NULL AND d.file_url ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'relative_path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'folder_path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'parent_path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->>'relative_path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->'google'->>'relative_path', '') ILIKE $4::text)
            OR ($4::text IS NOT NULL AND COALESCE(d.metadata_json->'zoho'->>'relative_path', '') ILIKE $4::text)
          )
        )
      )
    ORDER BY
      CASE
        WHEN COALESCE(d.mime_type, '') = 'application/vnd.google-apps.folder'
          OR COALESCE(d.mime_type, '') = 'application/vnd.zoho.workdrive.folder'
          OR COALESCE(d.metadata_json->'google'->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->'google'->>'item_type', '') = 'folder'
          OR COALESCE(d.metadata_json->'zoho'->>'is_folder', 'false') = 'true'
          OR COALESCE(d.metadata_json->'zoho'->>'item_type', '') = 'folder'
          OR COALESCE(d.file_extension, '') = 'folder'
        THEN 0 ELSE 1 END,
      d.file_name ASC
    LIMIT 250
    `,
    [tenantId, normalizedSource.sourceId, folderProviderId, folderPathLike, parentProvider]
  ).catch((error) => {
    if (['42P01', '42703'].includes(error.code)) return { rows: [] };
    throw error;
  });

  const rows = result.rows.map(mapDocumentRow);
  if (isZohoFolder) {
    console.info('ZOHO_CHILDREN_RESULT:', {
      tenant: shortLogId(tenantId),
      source_id: source.source_id || null,
      folder_document_index_id: normalizedSource.sourceId,
      parent_provider_file_id: shortLogId(folderProviderId),
      children_count: rows.length,
      warnings_count: 0,
    });
  }
  return { data: rows, total: rows.length };
}

async function assertExclusionsTableAvailable() {
  if (!(await tableExists('tenant_document_index_exclusions'))) {
    throw publicError(500, 'DOCUMENT_INDEX_EXCLUSIONS_TABLE_MISSING', 'La tabla de exclusiones del índice documental no está disponible.');
  }
}

async function loadDocumentIndexForIndexAction(client, tenantId, sourceId) {
  if (!isUuid(sourceId)) {
    throw publicError(400, 'INVALID_SOURCE_ID', 'Identificador de documento inválido.');
  }
  const result = await client.query(
    `
    SELECT *
    FROM document_index
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
      AND COALESCE(status, 'indexed') NOT IN ('deleted', 'missing')
    LIMIT 1
    `,
    [tenantId, sourceId]
  );
  if (result.rowCount === 0) {
    throw publicError(404, 'DOCUMENT_INDEX_NOT_FOUND', 'Documento indexado no encontrado para el tenant autenticado.');
  }
  return result.rows[0];
}

async function listDocumentIndexSubtree(client, tenantId, rootId) {
  const result = await client.query(
    `
    WITH RECURSIVE tree AS (
      SELECT
        d.*,
        0 AS depth,
        ARRAY[COALESCE(d.provider_file_id, d.id::text)]::text[] AS visited_provider_ids
      FROM document_index d
      WHERE d.tenant_id = $1::uuid
        AND d.id = $2::uuid
        AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'missing')

      UNION ALL

      SELECT
        child.*,
        tree.depth + 1 AS depth,
        tree.visited_provider_ids || COALESCE(child.provider_file_id, child.id::text)
      FROM document_index child
      JOIN tree
        ON tree.tenant_id = child.tenant_id
       AND tree.provider = child.provider
       AND COALESCE(child.status, 'indexed') NOT IN ('deleted', 'missing')
       AND tree.depth < 50
       AND child.id <> tree.id
       AND COALESCE(child.provider_file_id, child.id::text) <> ALL(tree.visited_provider_ids)
       AND (
         (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->'google'->>'parent_folder_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->'zoho'->>'parent_folder_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->'zoho'->>'parent_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->'zoho'->>'folder_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->>'parent_folder_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->>'parent_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->>'source_folder_id', '') = tree.provider_file_id)
         OR (tree.provider_file_id IS NOT NULL AND COALESCE(child.metadata_json->'google'->'parents', '[]'::jsonb) ? tree.provider_file_id)
         OR (
           tree.relative_path IS NOT NULL
           AND tree.relative_path <> ''
           AND child.source_id IS NOT DISTINCT FROM tree.source_id
           AND child.relative_path ILIKE tree.relative_path || '/%'
         )
       )
    )
    SELECT DISTINCT ON (id) *
    FROM tree
    ORDER BY id, depth ASC
    `,
    [tenantId, rootId]
  );
  return result.rows;
}

function normalizeIndexScope(value, fallback = 'item') {
  const raw = String(value || fallback).toLowerCase().trim();
  return raw === 'subtree' ? 'subtree' : 'item';
}

async function excludeDocumentFromIndex({ user, payload = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  await assertExclusionsTableAvailable();
  const normalizedSource = normalizeSourcePayload(payload);
  if (normalizedSource.sourceType !== 'document_index') {
    throw publicError(400, 'INVALID_SOURCE_TYPE', 'Solo documentos indexados pueden excluirse del índice.');
  }
  const scope = normalizeIndexScope(payload.scope, 'item');
  const reason = asString(payload.reason, 120) || 'not_useful';
  const notes = asString(payload.notes, 1000);
  const warnings = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const root = await loadDocumentIndexForIndexAction(client, tenantId, normalizedSource.sourceId);
    const isFolder = isFolderDocument(root);
    let affectedRows = [root];
    if (scope === 'subtree') {
      if (!isFolder) {
        warnings.push('El elemento no es carpeta; se excluyó solo el archivo seleccionado.');
      } else {
        affectedRows = await listDocumentIndexSubtree(client, tenantId, root.id);
        if (affectedRows.length <= 1) {
          warnings.push('No se encontraron descendientes indexados por jerarquía exacta; se excluyó solo la carpeta seleccionada.');
        }
      }
    }

    const now = new Date().toISOString();
    for (const row of affectedRows) {
      await client.query(
        `
        INSERT INTO tenant_document_index_exclusions (
          tenant_id,
          provider,
          source_id,
          document_index_id,
          provider_file_id,
          exclusion_scope,
          reason,
          notes,
          is_active,
          excluded_by_user_id,
          excluded_at,
          metadata_json,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::text,
          $3::uuid,
          $4::uuid,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          true,
          $9::uuid,
          NOW(),
          $10::jsonb,
          NOW()
        )
        ON CONFLICT (tenant_id, provider, provider_file_id) WHERE is_active = true
        DO UPDATE SET
          document_index_id = EXCLUDED.document_index_id,
          source_id = EXCLUDED.source_id,
          exclusion_scope = EXCLUDED.exclusion_scope,
          reason = EXCLUDED.reason,
          notes = EXCLUDED.notes,
          excluded_by_user_id = EXCLUDED.excluded_by_user_id,
          excluded_at = NOW(),
          metadata_json = tenant_document_index_exclusions.metadata_json || EXCLUDED.metadata_json,
          updated_at = NOW()
        `,
        [
          tenantId,
          row.provider,
          row.source_id || null,
          row.id,
          row.provider_file_id,
          row.id === root.id ? scope : 'item',
          reason,
          notes,
          userId || null,
          JSON.stringify({
            source: 'evidence_library',
            root_document_index_id: root.id,
            requested_scope: scope,
          }),
        ]
      );
    }

    const affectedIds = affectedRows.map((row) => row.id);
    await client.query(
      `
      UPDATE document_index
      SET status = 'excluded',
          metadata_json = COALESCE(metadata_json, '{}'::jsonb)
            || jsonb_build_object(
              'excluded_at', $3::text,
              'excluded_by_user_id', $4::text,
              'exclusion_scope', $5::text,
              'exclusion_reason', $6::text,
              'exclusion_notes', $7::text
            )
      WHERE tenant_id = $1::uuid
        AND id = ANY($2::uuid[])
      `,
      [tenantId, affectedIds, now, userId || null, scope, reason, notes]
    );
    await client.query('COMMIT');
    return {
      excluded: {
        document_index_id: root.id,
        provider: root.provider,
        provider_file_id: root.provider_file_id,
        scope,
        affected_count: affectedRows.length,
        warnings,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function restoreDocumentIndex({ user, payload = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  await assertExclusionsTableAvailable();
  const normalizedSource = normalizeSourcePayload(payload);
  if (normalizedSource.sourceType !== 'document_index') {
    throw publicError(400, 'INVALID_SOURCE_TYPE', 'Solo documentos indexados pueden restaurarse al índice.');
  }
  const restoreScope = normalizeIndexScope(payload.restore_scope || payload.scope, 'item');
  const warnings = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const root = await loadDocumentIndexForIndexAction(client, tenantId, normalizedSource.sourceId);
    const isFolder = isFolderDocument(root);
    let affectedRows = [root];
    if (restoreScope === 'subtree') {
      if (!isFolder) {
        warnings.push('El elemento no es carpeta; se restauró solo el archivo seleccionado.');
      } else {
        affectedRows = await listDocumentIndexSubtree(client, tenantId, root.id);
        if (affectedRows.length <= 1) {
          warnings.push('No se encontraron descendientes indexados por jerarquía exacta; se restauró solo la carpeta seleccionada.');
        }
      }
    }

    const affectedIds = affectedRows.map((row) => row.id);
    const affectedProviderPairs = affectedRows.map((row) => `${row.provider}:${row.provider_file_id}`);
    await client.query(
      `
      UPDATE tenant_document_index_exclusions
      SET is_active = false,
          restored_by_user_id = $3::uuid,
          restored_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND is_active = true
        AND (provider || ':' || provider_file_id) = ANY($2::text[])
      `,
      [tenantId, affectedProviderPairs, userId || null]
    );
    const restored = await client.query(
      `
      UPDATE document_index
      SET status = 'indexed',
          metadata_json = COALESCE(metadata_json, '{}'::jsonb)
            || jsonb_build_object(
              'restored_at', $3::text,
              'restored_by_user_id', $4::text
            )
      WHERE tenant_id = $1::uuid
        AND id = ANY($2::uuid[])
        AND COALESCE(status, 'indexed') = 'excluded'
      `,
      [tenantId, affectedIds, new Date().toISOString(), userId || null]
    );
    await client.query('COMMIT');
    return {
      restored_count: restored.rowCount,
      warnings,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
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
  manualUploadFiles,
  manualUploadZip,
  excludeDocumentFromIndex,
  restoreDocumentIndex,
  analyzeSemanticEvidence,
  reviewSuggestion,
};
