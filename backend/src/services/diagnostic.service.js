'use strict';

const pool = require('../config/db');
const { buildRecommendationPayload } = require('./evidenceRecommendationEngine.service');

const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);
const READ_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
  'operativo',
  'responsable_area',
  'area_owner',
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
  'ejecutivo',
]);
const EXECUTIVE_ROLES = new Set(['viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo']);
const AREA_ROLES = new Set(['operativo', 'responsable_area', 'area_owner']);
const OPEN_STATUSES = new Set(['abierta', 'abierto', 'open', 'pendiente', 'en curso', 'en_progreso', 'in_progress']);
const CLOSED_STATUSES = new Set(['cerrada', 'cerrado', 'closed', 'resuelta', 'resuelto', 'completed', 'completada', 'completado']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schemaCache = new Map();

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function normalizeRole(user = {}) {
  return String(user.role || user.user_role || user.userRole || '').toLowerCase().trim();
}

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(String(role || '').toLowerCase().trim());
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function normalizeStandardCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO');
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase().trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 10000) / 100;
}

function assertReadAccess(user) {
  const role = normalizeRole(user);
  const tenantId = getUserTenantId(user);

  if (!role) {
    throw publicError(403, 'DIAGNOSTIC_ROLE_REQUIRED', 'Usuario sin rol valido para diagnostico.');
  }

  if (!READ_ROLES.has(role) && !isPlatformRole(role)) {
    throw publicError(403, 'DIAGNOSTIC_RBAC_DENIED', 'Rol no autorizado para diagnostico.');
  }

  if (!tenantId && !isPlatformRole(role)) {
    throw publicError(403, 'TENANT_REQUIRED', 'Tenant no identificado para diagnostico.');
  }

  return { role, tenantId, userId: getUserId(user), isPlatform: isPlatformRole(role) };
}

function resolveTenantId(user, requestedTenantId = null) {
  const access = assertReadAccess(user);
  if (access.isPlatform && requestedTenantId) return String(requestedTenantId);
  return String(access.tenantId || '');
}

function assertTenantAccess(user, tenantId) {
  const access = assertReadAccess(user);
  if (access.isPlatform) return access;

  if (String(access.tenantId || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant.');
  }

  return access;
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

async function columnExists(tableName, columnName) {
  const cacheKey = `column:${tableName}.${columnName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);

  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(cacheKey, exists);
  return exists;
}

async function getSchemaCapabilities() {
  const [
    hasIsoVersions,
    hasProcesses,
    hasProcessLinks,
    hasObjectLinks,
    hasSemanticSuggestions,
    hasLegacyDocumentSuggestions,
    hasDocumentIndex,
    hasExclusions,
    hasRisks,
    opHasProcess,
    opHasOwner,
    tcHasResponsible,
    processHasOwner,
    processHasArea,
    processHasCriticality,
    processHasSortOrder,
  ] = await Promise.all([
    tableExists('iso_standard_versions'),
    tableExists('tenant_processes'),
    tableExists('tenant_process_entity_links'),
    tableExists('tenant_document_object_links'),
    tableExists('tenant_evidence_applicability_suggestions'),
    tableExists('document_association_suggestions'),
    tableExists('document_index'),
    tableExists('tenant_document_index_exclusions'),
    tableExists('iso_risk_matrix_items'),
    columnExists('tenant_operations', 'process_id'),
    columnExists('tenant_operations', 'owner_user_id'),
    columnExists('tenant_controls', 'responsible_user_id'),
    columnExists('tenant_processes', 'owner_user_id'),
    columnExists('tenant_processes', 'area'),
    columnExists('tenant_processes', 'criticality'),
    columnExists('tenant_processes', 'sort_order'),
  ]);

  return {
    hasIsoVersions,
    hasProcesses,
    hasProcessLinks,
    hasObjectLinks,
    hasSemanticSuggestions,
    hasLegacyDocumentSuggestions,
    hasDocumentIndex,
    hasExclusions,
    hasRisks,
    opHasProcess,
    opHasOwner,
    tcHasResponsible,
    processHasOwner,
    processHasArea,
    processHasCriticality,
    processHasSortOrder,
  };
}

async function listActiveStandards({ user, tenantId: requestedTenantId = null } = {}) {
  const tenantId = resolveTenantId(user, requestedTenantId);
  assertTenantAccess(user, tenantId);
  const caps = await getSchemaCapabilities();

  const versionJoin = caps.hasIsoVersions
    ? `
      LEFT JOIN LATERAL (
        SELECT version_code, display_name, publication_status, certifiable
        FROM iso_standard_versions v
        WHERE v.standard_code = ts.standard_code
          AND v.is_active IS DISTINCT FROM false
        ORDER BY v.certifiable DESC NULLS LAST, v.version_code DESC
        LIMIT 1
      ) v ON true
    `
    : '';

  const result = await pool.query(
    `
    SELECT
      ts.id,
      ts.tenant_id,
      ts.standard_code,
      ts.catalog_mode,
      ts.lifecycle_status,
      ts.is_active,
      ts.contracted_at,
      ${caps.hasIsoVersions ? 'v.version_code, v.display_name, v.publication_status, v.certifiable' : 'NULL::text AS version_code, ts.standard_code AS display_name, NULL::text AS publication_status, NULL::boolean AS certifiable'}
    FROM tenant_standards ts
    ${versionJoin}
    WHERE ts.tenant_id = $1::uuid
      AND ts.is_active IS DISTINCT FROM false
      AND ts.lifecycle_status IS DISTINCT FROM 'permanently_deactivated'
    ORDER BY ts.standard_code
    `,
    [tenantId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    standard_id: row.id,
    standard_code: row.standard_code,
    version_code: row.version_code || null,
    display_name: row.display_name || row.standard_code,
    catalog_mode: row.catalog_mode,
    lifecycle_status: row.lifecycle_status,
    publication_status: row.publication_status || null,
    certifiable: row.certifiable,
    diagnostic_available: true,
  }));
}

async function resolveStandard({ tenantId, standardId, standardCode }) {
  const normalized = normalizeStandardCode(standardCode || standardId);
  const params = [tenantId];
  const where = ['ts.tenant_id = $1::uuid', 'ts.is_active IS DISTINCT FROM false'];

  if (standardId && isUuid(standardId)) {
    params.push(standardId);
    where.push(`ts.id = $${params.length}::uuid`);
  } else if (normalized) {
    params.push(normalized);
    where.push(`ts.standard_code = $${params.length}`);
  } else {
    throw publicError(400, 'STANDARD_REQUIRED', 'standard_id o standard_code es obligatorio.');
  }

  const result = await pool.query(
    `
    SELECT id, tenant_id, standard_code, catalog_mode, lifecycle_status
    FROM tenant_standards ts
    WHERE ${where.join(' AND ')}
    LIMIT 1
    `,
    params
  );

  if (result.rowCount === 0) {
    throw publicError(404, 'STANDARD_NOT_ACTIVE', 'Norma no activa o no disponible para diagnostico del tenant.');
  }

  return result.rows[0];
}

function effectiveCatalogWhere() {
  return `
    (
      (ts.catalog_mode = 'generic' AND cc.source_type = 'generic' AND cc.tenant_id IS NULL)
      OR
      (ts.catalog_mode = 'personalized' AND cc.source_type = 'personalized' AND cc.tenant_id = tc.tenant_id)
      OR
      (ts.catalog_mode = 'mixed' AND (
        (cc.source_type = 'generic' AND cc.tenant_id IS NULL)
        OR (cc.source_type = 'personalized' AND cc.tenant_id = tc.tenant_id)
      ))
    )
  `;
}

function appendAreaVisibility({ where, params, access, caps }) {
  if (!AREA_ROLES.has(access.role)) return;

  if (!access.userId) {
    where.push('FALSE');
    return;
  }

  const predicates = [];
  params.push(access.userId);
  const userParam = `$${params.length}::uuid`;
  if (caps.tcHasResponsible) predicates.push(`tc.responsible_user_id = ${userParam}`);
  if (caps.opHasOwner) predicates.push(`op.owner_user_id = ${userParam}`);
  if (caps.hasProcesses && caps.opHasProcess && caps.processHasOwner) predicates.push(`p.owner_user_id = ${userParam}`);

  where.push(predicates.length ? `(${predicates.join(' OR ')})` : 'FALSE');
}

function appendProcessFilter({ where, params, processId, caps }) {
  if (!processId) return;
  if (!isUuid(processId)) throw publicError(400, 'INVALID_PROCESS_ID', 'process_id invalido.');

  params.push(processId);
  const processParam = `$${params.length}::uuid`;
  const predicates = [];

  if (caps.hasProcesses && caps.opHasProcess) {
    predicates.push(`op.process_id = ${processParam}`);
  }

  if (caps.hasProcessLinks) {
    predicates.push(`
      EXISTS (
        SELECT 1
        FROM tenant_process_entity_links pel
        WHERE pel.tenant_id = tc.tenant_id
          AND pel.process_id = ${processParam}
          AND pel.is_active IS DISTINCT FROM false
          AND (
            (pel.target_type = 'control' AND pel.target_id = tc.id)
            OR (pel.operation_id IS NOT NULL AND pel.operation_id = tc.operation_id)
          )
      )
    `);
  }

  where.push(predicates.length ? `(${predicates.join(' OR ')})` : 'FALSE');
}

async function loadControls({ tenantId, standard, user, filters = {}, caps }) {
  const access = assertTenantAccess(user, tenantId);
  const params = [tenantId, standard.standard_code];
  const where = [
    'tc.tenant_id = $1::uuid',
    'cc.iso = $2',
    'cc.is_active IS DISTINCT FROM false',
    effectiveCatalogWhere(),
  ];

  if (filters.operation_id) {
    if (!isUuid(filters.operation_id)) throw publicError(400, 'INVALID_OPERATION_ID', 'operation_id invalido.');
    params.push(filters.operation_id);
    where.push(`tc.operation_id = $${params.length}::uuid`);
  }

  appendProcessFilter({ where, params, processId: filters.process_id, caps });

  if (filters.responsible_user_id) {
    if (!isUuid(filters.responsible_user_id)) throw publicError(400, 'INVALID_RESPONSIBLE_ID', 'responsible_user_id invalido.');
    const predicates = [];
    params.push(filters.responsible_user_id);
    const responsibleParam = `$${params.length}::uuid`;
    if (caps.tcHasResponsible) predicates.push(`tc.responsible_user_id = ${responsibleParam}`);
    if (caps.opHasOwner) predicates.push(`op.owner_user_id = ${responsibleParam}`);
    if (caps.hasProcesses && caps.opHasProcess && caps.processHasOwner) predicates.push(`p.owner_user_id = ${responsibleParam}`);
    where.push(predicates.length ? `(${predicates.join(' OR ')})` : 'FALSE');
  }

  if (filters.area && caps.hasProcesses && caps.opHasProcess && caps.processHasArea) {
    params.push(String(filters.area));
    where.push(`p.area = $${params.length}`);
  }

  appendAreaVisibility({ where, params, access, caps });

  const processJoin = caps.hasProcesses && caps.opHasProcess
    ? `
      LEFT JOIN tenant_processes p
        ON p.id = op.process_id
       AND p.tenant_id = op.tenant_id
    `
    : '';

  const processSelect = caps.hasProcesses && caps.opHasProcess
    ? `
      p.id AS process_id,
      p.code AS process_code,
      p.name AS process_name,
      ${caps.processHasArea ? 'p.area' : 'NULL::text'} AS process_area,
      ${caps.processHasCriticality ? 'p.criticality' : 'NULL::text'} AS process_criticality,
      ${caps.processHasOwner ? 'p.owner_user_id' : 'NULL::uuid'} AS process_owner_user_id,
    `
    : `
      NULL::uuid AS process_id,
      NULL::text AS process_code,
      NULL::text AS process_name,
      NULL::text AS process_area,
      NULL::text AS process_criticality,
      NULL::uuid AS process_owner_user_id,
    `;
  const orderBy = caps.hasProcesses && caps.opHasProcess
    ? `
      ${caps.processHasSortOrder ? 'COALESCE(p.sort_order, op.sort_order, 0)' : 'op.sort_order'},
      COALESCE(p.name, op.name),
      op.sort_order,
      op.name,
      cc.clause,
      cc.category,
      cc.description
    `
    : `
      op.sort_order,
      op.name,
      cc.clause,
      cc.category,
      cc.description
    `;

  const result = await pool.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      tc.status AS control_status,
      tc.priority,
      tc.applicability,
      tc.score,
      tc.health_status,
      ${caps.tcHasResponsible ? 'tc.responsible_user_id' : 'NULL::uuid'} AS responsible_user_id,
      cc.iso AS standard_code,
      cc.clause,
      cc.category,
      cc.description AS control_description,
      cc.source_type AS catalog_source_type,
      op.code AS operation_code,
      op.name AS operation_name,
      op.operation_type,
      ${caps.opHasOwner ? 'op.owner_user_id' : 'NULL::uuid'} AS operation_owner_user_id,
      ${processSelect}
      tso.id AS tenant_standard_operation_id
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    JOIN tenant_standards ts
      ON ts.tenant_id = tc.tenant_id
     AND ts.standard_code = cc.iso
     AND ts.is_active IS DISTINCT FROM false
    JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active IS DISTINCT FROM false
    JOIN tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.standard_code = cc.iso
     AND tso.operation_id = tc.operation_id
     AND tso.is_active IS DISTINCT FROM false
    ${processJoin}
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    `,
    params
  );

  return result.rows;
}

function activeEvidenceStatus(status) {
  const normalized = normalizeStatus(status || 'active');
  return !['deleted', 'eliminada', 'eliminado', 'rechazada', 'rechazado', 'rejected', 'archived', 'archivada'].includes(normalized);
}

function activeDocumentStatus(status) {
  const normalized = normalizeStatus(status || 'indexed');
  return !['deleted', 'ignored', 'missing', 'excluded', 'error'].includes(normalized);
}

function pushGrouped(map, key, value) {
  if (!key) return;
  if (!map.has(String(key))) map.set(String(key), []);
  map.get(String(key)).push(value);
}

async function loadDirectEvidences(tenantId, controls) {
  if (!controls.length) return new Map();
  const tenantControlIds = controls.map((row) => row.tenant_control_id);
  const catalogControlIds = controls.map((row) => row.catalog_control_id).filter(Boolean);
  const catalogToTenant = new Map(controls.map((row) => [String(row.catalog_control_id), row.tenant_control_id]));

  const result = await pool.query(
    `
    SELECT
      e.id,
      e.tenant_control_id,
      e.control_id,
      e.file_name,
      e.description,
      e.status,
      e.validated,
      e.evidence_type,
      e.created_at,
      e.expires_at,
      e.metadata
    FROM evidences e
    WHERE e.tenant_id = $1::uuid
      AND (
        e.tenant_control_id = ANY($2::uuid[])
        OR e.control_id = ANY($3::uuid[])
      )
      AND COALESCE(e.status, 'active') NOT IN ('deleted', 'eliminada', 'eliminado', 'rechazada', 'rechazado', 'rejected')
    ORDER BY e.created_at DESC NULLS LAST
    `,
    [tenantId, tenantControlIds, catalogControlIds]
  );

  const map = new Map();
  for (const row of result.rows) {
    const tenantControlId = row.tenant_control_id || catalogToTenant.get(String(row.control_id));
    pushGrouped(map, tenantControlId, {
      id: row.id,
      source_type: 'evidence',
      source_id: row.id,
      name: row.file_name || row.description || row.evidence_type || 'Evidencia',
      file_name: row.file_name,
      description: row.description,
      status: row.status,
      validated: row.validated,
      evidence_type: row.evidence_type,
      created_at: row.created_at,
      expires_at: row.expires_at,
      strength: row.validated ? 'primary' : 'supporting',
      active: activeEvidenceStatus(row.status),
    });
  }

  return map;
}

async function loadObjectLinks(tenantId, controls, caps) {
  const map = new Map();
  if (!caps.hasObjectLinks || !controls.length) return map;

  const result = await pool.query(
    `
    SELECT
      l.id AS link_id,
      l.target_id AS tenant_control_id,
      l.source_type,
      l.source_id,
      l.evidence_usage,
      l.relation_type,
      l.status AS link_status,
      l.created_at,
      d.file_name AS document_file_name,
      d.relative_path AS document_relative_path,
      d.provider AS document_provider,
      d.status AS document_status,
      e.file_name AS evidence_file_name,
      e.description AS evidence_description,
      e.status AS evidence_status,
      e.validated AS evidence_validated
    FROM tenant_document_object_links l
    LEFT JOIN document_index d
      ON l.source_type = 'document_index'
     AND d.id = l.source_id
     AND d.tenant_id = l.tenant_id
    LEFT JOIN evidences e
      ON l.source_type = 'evidence'
     AND e.id = l.source_id
     AND e.tenant_id = l.tenant_id
    WHERE l.tenant_id = $1::uuid
      AND l.target_type = 'control'
      AND l.target_id = ANY($2::uuid[])
      AND l.is_active IS DISTINCT FROM false
      AND COALESCE(l.status, 'active') NOT IN ('deleted', 'rejected', 'inactive')
      AND (
        (l.source_type = 'document_index' AND d.id IS NOT NULL AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing', 'excluded', 'error'))
        OR
        (l.source_type = 'evidence' AND e.id IS NOT NULL AND COALESCE(e.status, 'active') NOT IN ('deleted', 'eliminada', 'eliminado', 'rechazada', 'rechazado', 'rejected'))
      )
    ORDER BY l.created_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.tenant_control_id)]
  );

  for (const row of result.rows) {
    pushGrouped(map, row.tenant_control_id, {
      id: row.link_id,
      source_type: row.source_type,
      source_id: row.source_id,
      name: row.document_file_name || row.document_relative_path || row.evidence_file_name || row.evidence_description || 'Documento asociado',
      evidence_usage: row.evidence_usage,
      relation_type: row.relation_type,
      status: row.link_status,
      provider: row.document_provider || null,
      strength: row.evidence_usage === 'primary_evidence' ? 'primary' : 'supporting',
      active: row.source_type === 'document_index' ? activeDocumentStatus(row.document_status) : activeEvidenceStatus(row.evidence_status),
    });
  }

  return map;
}

async function loadSemanticSuggestions(tenantId, controls, caps) {
  const map = new Map();
  if (!caps.hasSemanticSuggestions || !controls.length) return map;

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.target_id AS tenant_control_id,
      s.source_type,
      s.source_id,
      s.target_label,
      s.score,
      s.confidence,
      s.reason,
      s.snippet,
      s.status,
      s.created_at,
      d.file_name AS document_file_name,
      d.relative_path AS document_relative_path,
      d.status AS document_status,
      e.file_name AS evidence_file_name,
      e.description AS evidence_description,
      e.status AS evidence_status
    FROM tenant_evidence_applicability_suggestions s
    LEFT JOIN document_index d
      ON s.source_type = 'document_index'
     AND d.id = s.source_id
     AND d.tenant_id = s.tenant_id
    LEFT JOIN evidences e
      ON s.source_type = 'evidence'
     AND e.id = s.source_id
     AND e.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1::uuid
      AND s.target_type = 'control'
      AND s.target_id = ANY($2::uuid[])
      AND COALESCE(s.status, 'suggested') IN ('suggested', 'pending', 'accepted')
      AND (
        s.source_type = 'evidence'
        OR d.id IS NULL
        OR COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing', 'excluded', 'error')
      )
    ORDER BY s.confidence DESC NULLS LAST, s.score DESC NULLS LAST, s.created_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.tenant_control_id)]
  );

  for (const row of result.rows) {
    pushGrouped(map, row.tenant_control_id, {
      id: row.id,
      source_type: row.source_type,
      source_id: row.source_id,
      name: row.document_file_name || row.document_relative_path || row.evidence_file_name || row.evidence_description || row.target_label || 'Evidencia sugerida',
      score: row.score,
      confidence_score: row.confidence,
      confidence: toNumber(row.confidence) >= 0.75 ? 'high' : toNumber(row.confidence) >= 0.45 ? 'medium' : 'low',
      reason: row.reason,
      snippet: row.snippet,
      status: row.status,
      active: row.source_type === 'document_index' ? activeDocumentStatus(row.document_status) : activeEvidenceStatus(row.evidence_status),
    });
  }

  return map;
}

async function loadLegacySuggestions(tenantId, controls, caps) {
  const map = new Map();
  if (!caps.hasLegacyDocumentSuggestions || !controls.length) return map;

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.target_id AS tenant_control_id,
      s.document_id,
      s.suggested_reason,
      s.confidence_score,
      s.status,
      s.created_at,
      d.file_name,
      d.relative_path,
      d.status AS document_status
    FROM document_association_suggestions s
    JOIN document_index d
      ON d.id = s.document_id
     AND d.tenant_id = s.tenant_id
     AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing', 'excluded', 'error')
    WHERE s.tenant_id = $1::uuid
      AND s.target_type = 'control'
      AND s.target_id = ANY($2::uuid[])
      AND COALESCE(s.status, 'pending') IN ('pending', 'suggested', 'accepted')
    ORDER BY s.confidence_score DESC NULLS LAST, s.created_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.tenant_control_id)]
  );

  for (const row of result.rows) {
    pushGrouped(map, row.tenant_control_id, {
      id: row.id,
      source_type: 'document_index',
      source_id: row.document_id,
      name: row.file_name || row.relative_path || 'Documento sugerido',
      confidence_score: row.confidence_score,
      confidence: toNumber(row.confidence_score) >= 0.75 ? 'high' : toNumber(row.confidence_score) >= 0.45 ? 'medium' : 'low',
      reason: row.suggested_reason,
      status: row.status,
      active: activeDocumentStatus(row.document_status),
    });
  }

  return map;
}

async function loadGaps(tenantId, controls) {
  const map = new Map();
  if (!controls.length) return map;
  const catalogToTenant = new Map(controls.map((row) => [String(row.catalog_control_id), row.tenant_control_id]));

  const result = await pool.query(
    `
    SELECT id, control_id, status, detected_at, resolved_at, control_description
    FROM tenant_nonconformities
    WHERE tenant_id = $1::uuid
      AND control_id = ANY($2::uuid[])
    ORDER BY detected_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.catalog_control_id).filter(Boolean)]
  );

  for (const row of result.rows) {
    const tenantControlId = catalogToTenant.get(String(row.control_id));
    pushGrouped(map, tenantControlId, {
      id: row.id,
      status: row.status,
      open: OPEN_STATUSES.has(normalizeStatus(row.status)) && !row.resolved_at,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
      description: row.control_description,
    });
  }

  return map;
}

async function loadFindings(tenantId, controls) {
  const map = new Map();
  if (!controls.length) return map;

  const result = await pool.query(
    `
    SELECT id, tenant_control_id, title, description, severity, status, created_at, closed_at
    FROM findings
    WHERE tenant_id = $1::uuid
      AND tenant_control_id = ANY($2::uuid[])
    ORDER BY created_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.tenant_control_id)]
  );

  for (const row of result.rows) {
    pushGrouped(map, row.tenant_control_id, {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      open: !CLOSED_STATUSES.has(normalizeStatus(row.status)) && !row.closed_at,
      created_at: row.created_at,
      closed_at: row.closed_at,
    });
  }

  return map;
}

async function loadActions(tenantId, controls) {
  const map = new Map();
  if (!controls.length) return map;

  const result = await pool.query(
    `
    SELECT id, tenant_control_id, title, description, priority, status, owner, due_date, created_at, completed_at
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND tenant_control_id = ANY($2::uuid[])
    ORDER BY due_date ASC NULLS LAST, created_at DESC NULLS LAST
    `,
    [tenantId, controls.map((row) => row.tenant_control_id)]
  );

  for (const row of result.rows) {
    pushGrouped(map, row.tenant_control_id, {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      owner: row.owner,
      due_date: row.due_date,
      open: !CLOSED_STATUSES.has(normalizeStatus(row.status)) && !row.completed_at,
      created_at: row.created_at,
      completed_at: row.completed_at,
    });
  }

  return map;
}

async function loadRisks(tenantId, controls, caps) {
  const map = new Map();
  if (!caps.hasRisks || !controls.length) return map;

  const hasTenantControlId = await columnExists('iso_risk_matrix_items', 'tenant_control_id');
  const hasStandardCode = await columnExists('iso_risk_matrix_items', 'standard_code');
  if (!hasTenantControlId && !hasStandardCode) return map;

  const params = [tenantId];
  const predicates = [];
  if (hasTenantControlId) {
    params.push(controls.map((row) => row.tenant_control_id));
    predicates.push(`tenant_control_id = ANY($${params.length}::uuid[])`);
  }
  if (hasStandardCode) {
    params.push(controls[0]?.standard_code || null);
    predicates.push(`standard_code = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      id,
      ${hasTenantControlId ? 'tenant_control_id' : 'NULL::uuid AS tenant_control_id'},
      ${hasStandardCode ? 'standard_code' : 'NULL::text AS standard_code'},
      risk_title,
      risk_description,
      inherent_risk_level,
      residual_risk_level,
      status,
      created_at
    FROM iso_risk_matrix_items
    WHERE tenant_id = $1::uuid
      AND (${predicates.join(' OR ')})
    ORDER BY created_at DESC NULLS LAST
    LIMIT 300
    `,
    params
  ).catch(() => ({ rows: [] }));

  for (const row of result.rows) {
    if (row.tenant_control_id) {
      pushGrouped(map, row.tenant_control_id, row);
    }
  }

  return map;
}

function mergeMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [key, rows] of map.entries()) {
      if (!merged.has(key)) merged.set(key, []);
      merged.get(key).push(...rows);
    }
  }
  return merged;
}

function classifyControl(row, evidences, candidates, gaps) {
  const applicability = normalizeStatus(row.applicability);
  const status = normalizeStatus(row.control_status);
  const activeEvidenceCount = evidences.filter((item) => item.active !== false).length;
  const primaryEvidenceCount = evidences.filter((item) => item.active !== false && item.strength === 'primary').length;
  const candidateEvidenceCount = candidates.filter((item) => item.active !== false).length;
  const lowConfidenceCandidate = candidates.some((item) => item.confidence === 'low');
  const hasOpenGap = gaps.some((item) => item.open);

  if (['no aplica', 'not_applicable', 'not applicable', 'n/a', 'na'].includes(applicability)) {
    return 'not_applicable';
  }

  if (activeEvidenceCount > 0 && primaryEvidenceCount > 0 && !hasOpenGap && ['cumple', 'compliant', 'implementado', 'implemented'].includes(status)) {
    return 'covered';
  }

  if (activeEvidenceCount > 0 && !hasOpenGap) {
    return status === 'pendiente' || lowConfidenceCandidate ? 'needs_review' : 'partially_covered';
  }

  if (candidateEvidenceCount > 0) {
    return lowConfidenceCandidate ? 'needs_review' : 'partially_covered';
  }

  return 'missing_evidence';
}

function confidenceForControl(state, evidences, candidates) {
  if (state === 'covered') return 'high';
  if (state === 'missing_evidence') return 'high';
  if (candidates.some((item) => item.confidence === 'high')) return 'medium';
  if (candidates.length > 0) return 'low';
  return 'medium';
}

function buildTrace({ evidences, candidates, state }) {
  if (evidences.length > 0) {
    return {
      source: 'active_association',
      fragment: `Se encontraron ${evidences.length} evidencia(s) activa(s) asociada(s).`,
      documents: evidences.slice(0, 5).map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        name: item.name,
        status: item.status || null,
      })),
    };
  }

  if (candidates.length > 0) {
    return {
      source: 'candidate_semantic_evidence',
      fragment: `Se encontraron ${candidates.length} evidencia(s) candidata(s), pendiente(s) de revision humana.`,
      documents: candidates.slice(0, 5).map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        name: item.name,
        confidence: item.confidence,
        reason: item.reason || null,
      })),
    };
  }

  return {
    source: state === 'not_applicable' ? 'explicit_not_applicable' : 'no_active_evidence',
    fragment: state === 'not_applicable'
      ? 'El control fue marcado como no aplicable.'
      : 'No se encontraron documentos indexados activos ni evidencias asociadas suficientes.',
    documents: [],
  };
}

function withRecommendations(row, evidences, candidates, gaps, actions, risks, state) {
  if (!['missing_evidence', 'partially_covered', 'needs_review'].includes(state)) {
    return [];
  }

  return buildRecommendationPayload({
    tenant_id: row.tenant_id,
    standard_code: row.standard_code,
    clause: row.clause,
    tenant_control_id: row.tenant_control_id,
    control_id: row.catalog_control_id,
    control_description: row.control_description,
    process_name: row.process_name,
    operation_name: row.operation_name,
    area: row.process_area,
    priority: row.priority,
    criticality: row.process_criticality,
    active_evidence_count: evidences.length,
    candidate_evidence_count: candidates.length,
    existing_evidences: evidences,
    existing_gaps: gaps,
    existing_actions: actions,
    existing_risks: risks,
    max_recommendations: 3,
  }).recommended_evidence;
}

function enrichControls({ controls, evidences, candidates, gaps, findings, actions, risks }) {
  return controls.map((row) => {
    const directEvidence = evidences.get(String(row.tenant_control_id)) || [];
    const candidateEvidence = candidates.get(String(row.tenant_control_id)) || [];
    const controlGaps = gaps.get(String(row.tenant_control_id)) || [];
    const controlFindings = findings.get(String(row.tenant_control_id)) || [];
    const controlActions = actions.get(String(row.tenant_control_id)) || [];
    const controlRisks = risks.get(String(row.tenant_control_id)) || [];
    const state = classifyControl(row, directEvidence, candidateEvidence, controlGaps);

    return {
      tenant_control_id: row.tenant_control_id,
      catalog_control_id: row.catalog_control_id,
      standard_code: row.standard_code,
      clause: row.clause,
      category: row.category,
      description: row.control_description,
      status: state,
      raw_status: row.control_status,
      applicability: row.applicability,
      priority: row.priority,
      health_status: row.health_status,
      process: {
        id: row.process_id,
        code: row.process_code,
        name: row.process_name,
        area: row.process_area,
        criticality: row.process_criticality,
        owner_user_id: row.process_owner_user_id,
      },
      operation: {
        id: row.operation_id,
        code: row.operation_code,
        name: row.operation_name,
        operation_type: row.operation_type,
        owner_user_id: row.operation_owner_user_id,
      },
      responsible_user_id: row.responsible_user_id,
      evidence: {
        active_count: directEvidence.length,
        candidate_count: candidateEvidence.length,
        existing: directEvidence,
        candidates: candidateEvidence,
        recommended: withRecommendations(row, directEvidence, candidateEvidence, controlGaps, controlActions, controlRisks, state),
      },
      gaps: {
        existing_count: controlGaps.length + controlFindings.length,
        open_count: controlGaps.filter((item) => item.open).length + controlFindings.filter((item) => item.open).length,
        nonconformities: controlGaps,
        findings: controlFindings,
        suggested_count: ['missing_evidence', 'partially_covered', 'needs_review'].includes(state) ? 1 : 0,
      },
      actions: {
        existing_count: controlActions.length,
        open_count: controlActions.filter((item) => item.open).length,
        existing: controlActions,
        suggested_count: ['missing_evidence', 'partially_covered', 'needs_review'].includes(state) ? 1 : 0,
      },
      risks: {
        associated_count: controlRisks.length,
        existing: controlRisks,
      },
      confidence: confidenceForControl(state, directEvidence, candidateEvidence),
      traceability: buildTrace({ evidences: directEvidence, candidates: candidateEvidence, state }),
      human_review_required: true,
    };
  });
}

function summarizeControls(controls) {
  const total = controls.length;
  const counts = {
    controls_applicable: controls.filter((row) => row.status !== 'not_applicable').length,
    controls_covered: controls.filter((row) => row.status === 'covered').length,
    controls_partially_covered: controls.filter((row) => row.status === 'partially_covered').length,
    controls_missing_evidence: controls.filter((row) => row.status === 'missing_evidence').length,
    controls_needs_review: controls.filter((row) => row.status === 'needs_review').length,
    controls_not_applicable: controls.filter((row) => row.status === 'not_applicable').length,
    evidences_existing: controls.reduce((sum, row) => sum + row.evidence.active_count, 0),
    evidences_suggested: controls.reduce((sum, row) => sum + row.evidence.recommended.length, 0),
    gaps_existing: controls.reduce((sum, row) => sum + row.gaps.existing_count, 0),
    gaps_open: controls.reduce((sum, row) => sum + row.gaps.open_count, 0),
    gaps_suggested: controls.reduce((sum, row) => sum + row.gaps.suggested_count, 0),
    actions_existing: controls.reduce((sum, row) => sum + row.actions.existing_count, 0),
    actions_open: controls.reduce((sum, row) => sum + row.actions.open_count, 0),
    actions_suggested: controls.reduce((sum, row) => sum + row.actions.suggested_count, 0),
  };

  const applicable = counts.controls_applicable || total;
  const weighted =
    counts.controls_covered * 1 +
    counts.controls_partially_covered * 0.55 +
    counts.controls_needs_review * 0.35;

  return {
    ...counts,
    controls_evaluated: total,
    coverage_level: percent(weighted, applicable),
    confidence_level: counts.controls_missing_evidence > 0 && counts.evidences_existing === 0
      ? 'medium'
      : counts.controls_needs_review > 0
        ? 'medium'
        : 'high',
    document_traceability: percent(
      controls.filter((row) => row.evidence.active_count > 0 || row.evidence.candidate_count > 0).length,
      applicable
    ),
  };
}

function applyComputedFilters(controls, filters = {}) {
  return controls.filter((row) => {
    if (filters.evidence_status && row.status !== filters.evidence_status) return false;
    if (filters.gap_status === 'open' && row.gaps.open_count === 0) return false;
    if (filters.gap_status === 'none' && row.gaps.existing_count > 0) return false;
    if (filters.action_status === 'open' && row.actions.open_count === 0) return false;
    if (filters.action_status === 'none' && row.actions.existing_count > 0) return false;
    if (filters.criticality && String(row.process.criticality || row.priority || '').toLowerCase() !== String(filters.criticality).toLowerCase()) return false;
    return true;
  });
}

async function buildDiagnostic({ user, tenantId: requestedTenantId = null, standardId, standardCode, filters = {} } = {}) {
  const tenantId = resolveTenantId(user, requestedTenantId);
  const standard = await resolveStandard({ tenantId, standardId, standardCode });
  const caps = await getSchemaCapabilities();
  const rawControls = await loadControls({ tenantId, standard, user, filters, caps });
  const [
    directEvidence,
    objectLinks,
    semanticSuggestions,
    legacySuggestions,
    gaps,
    findings,
    actions,
    risks,
  ] = await Promise.all([
    loadDirectEvidences(tenantId, rawControls),
    loadObjectLinks(tenantId, rawControls, caps),
    loadSemanticSuggestions(tenantId, rawControls, caps),
    loadLegacySuggestions(tenantId, rawControls, caps),
    loadGaps(tenantId, rawControls),
    loadFindings(tenantId, rawControls),
    loadActions(tenantId, rawControls),
    loadRisks(tenantId, rawControls, caps),
  ]);

  const controls = applyComputedFilters(
    enrichControls({
      controls: rawControls,
      evidences: mergeMaps(directEvidence, objectLinks),
      candidates: mergeMaps(semanticSuggestions, legacySuggestions),
      gaps,
      findings,
      actions,
      risks,
    }),
    filters
  );

  return {
    tenant_id: tenantId,
    standard: {
      id: standard.id,
      standard_id: standard.id,
      standard_code: standard.standard_code,
      catalog_mode: standard.catalog_mode,
      lifecycle_status: standard.lifecycle_status,
    },
    summary: summarizeControls(controls),
    controls,
    metadata: {
      deterministic: true,
      ai_used: false,
      generated_at: new Date().toISOString(),
      governance_notice: 'El diagnostico es una ayuda operativa. No aprueba cumplimiento, no certifica y requiere revision humana.',
    },
  };
}

function groupKeyForProcess(control) {
  return control.process.id || `operation:${control.operation.id}`;
}

function processLabel(control) {
  return {
    id: control.process.id,
    code: control.process.code,
    name: control.process.name || control.operation.name || 'Operacion sin proceso',
    area: control.process.area || null,
    criticality: control.process.criticality || control.priority || null,
    operation_id: control.process.id ? null : control.operation.id,
    operation_name: control.process.id ? null : control.operation.name,
  };
}

function summarizeByProcess(diagnostic) {
  const groups = new Map();
  for (const control of diagnostic.controls) {
    const key = groupKeyForProcess(control);
    if (!groups.has(key)) {
      groups.set(key, {
        process: processLabel(control),
        controls: [],
      });
    }
    groups.get(key).controls.push(control);
  }

  return Array.from(groups.values()).map((group) => ({
    process: group.process,
    standard: diagnostic.standard,
    summary: {
      proceso_evaluado: group.process.name,
      norma_evaluada: diagnostic.standard.standard_code,
      ...summarizeControls(group.controls),
      riesgo_o_prioridad_sugerida: group.controls.some((control) => control.status === 'missing_evidence')
        ? 'alta'
        : group.controls.some((control) => control.status === 'partially_covered' || control.status === 'needs_review')
          ? 'media'
          : 'baja',
    },
    operations: Array.from(new Map(group.controls.map((control) => [control.operation.id, control.operation])).values()),
  }));
}

async function getSummary({ user, tenantId, standardId, standardCode, filters = {} } = {}) {
  const diagnostic = await buildDiagnostic({ user, tenantId, standardId, standardCode, filters });
  return {
    tenant_id: diagnostic.tenant_id,
    standard: diagnostic.standard,
    summary: diagnostic.summary,
    top_missing_controls: diagnostic.controls
      .filter((control) => control.status === 'missing_evidence')
      .slice(0, 10),
    metadata: diagnostic.metadata,
  };
}

async function getProcesses({ user, tenantId, standardId, standardCode, filters = {} } = {}) {
  const diagnostic = await buildDiagnostic({ user, tenantId, standardId, standardCode, filters });
  return {
    tenant_id: diagnostic.tenant_id,
    standard: diagnostic.standard,
    summary: diagnostic.summary,
    processes: summarizeByProcess(diagnostic),
    metadata: diagnostic.metadata,
  };
}

async function getProcessDetail({ user, tenantId, standardId, standardCode, processId, operationId, filters = {} } = {}) {
  const diagnostic = await buildDiagnostic({
    user,
    tenantId,
    standardId,
    standardCode,
    filters: {
      ...filters,
      process_id: processId || filters.process_id,
      operation_id: operationId || filters.operation_id,
    },
  });

  return {
    tenant_id: diagnostic.tenant_id,
    standard: diagnostic.standard,
    summary: diagnostic.summary,
    controls: diagnostic.controls,
    metadata: diagnostic.metadata,
  };
}

async function generateRecommendations({ user, tenantId: requestedTenantId = null, payload = {} } = {}) {
  const tenantId = resolveTenantId(user, requestedTenantId || payload.tenant_id);
  assertTenantAccess(user, tenantId);

  if (payload.control_id || payload.tenant_control_id) {
    const standardId = payload.standard_id || payload.standard_code;
    const diagnostic = await buildDiagnostic({
      user,
      tenantId,
      standardId,
      standardCode: payload.standard_code,
      filters: {
        process_id: payload.process_id,
        operation_id: payload.operation_id,
      },
    });
    const control = diagnostic.controls.find((item) => (
      String(item.tenant_control_id) === String(payload.control_id || payload.tenant_control_id) ||
      String(item.catalog_control_id) === String(payload.control_id)
    ));

    if (!control) {
      throw publicError(404, 'CONTROL_NOT_FOUND', 'Control no encontrado en el diagnostico solicitado.');
    }

    return {
      tenant_id: tenantId,
      standard: diagnostic.standard,
      control,
      recommendation: buildRecommendationPayload({
        tenant_id: tenantId,
        standard_code: control.standard_code,
        clause: control.clause,
        tenant_control_id: control.tenant_control_id,
        control_id: control.catalog_control_id,
        control_description: control.description,
        process_name: control.process.name,
        operation_name: control.operation.name,
        area: control.process.area,
        priority: control.priority,
        criticality: control.process.criticality,
        active_evidence_count: control.evidence.active_count,
        candidate_evidence_count: control.evidence.candidate_count,
        existing_evidences: control.evidence.existing,
        existing_gaps: [...control.gaps.nonconformities, ...control.gaps.findings],
        existing_actions: control.actions.existing,
        existing_risks: control.risks.existing,
      }),
    };
  }

  return {
    tenant_id: tenantId,
    recommendation: buildRecommendationPayload({
      ...payload,
      tenant_id: tenantId,
    }),
  };
}

module.exports = {
  listActiveStandards,
  getSummary,
  getProcesses,
  getProcessDetail,
  generateRecommendations,
  buildDiagnostic,
  publicError,
};
