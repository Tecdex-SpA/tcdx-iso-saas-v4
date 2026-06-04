'use strict';

const pool = require('../config/db');

const READ_ROLES = new Set([
  'admin',
  'tenant_admin',
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
const MANAGE_ROLES = new Set(['admin', 'tenant_admin']);
const TARGET_TYPES = new Set(['control', 'evidence', 'risk', 'action']);
const RELATION_TYPES = new Set(['associated', 'primary', 'supporting', 'impacted', 'mitigates', 'requires_evidence']);
const SOURCES = new Set(['manual', 'system', 'import', 'ai_suggested']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function databaseError(error) {
  if (error?.code === '23505') {
    return publicError(409, 'PROCESS_LINK_ALREADY_EXISTS', 'La asociación ya existe para este proceso.');
  }

  if (error?.code === '42P01' || error?.code === '42703') {
    return publicError(
      500,
      'SPRINT3_MIGRATION_REQUIRED',
      'La migración Sprint 3 de asociaciones operacionales no ha sido aplicada.'
    );
  }

  return error;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function asString(value, max = 255) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function boolValue(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'active', 'activo'].includes(String(value).toLowerCase());
}

function assertAccess(user, mode = 'read') {
  const role = normalizeRole(user);
  const tenantId = getUserTenantId(user);
  const allowed = mode === 'manage' ? MANAGE_ROLES : READ_ROLES;

  if (!allowed.has(role)) {
    throw publicError(403, 'PROCESS_LINK_RBAC_DENIED', 'No autorizado para gestionar asociaciones operacionales.');
  }

  if (!tenantId) {
    throw publicError(403, 'TENANT_REQUIRED', 'Tenant no identificado para asociaciones operacionales.');
  }

  return { tenantId, userId: getUserId(user), role };
}

async function tableExists(tableName) {
  if (schemaCache.has(tableName)) return schemaCache.get(tableName);
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
  schemaCache.set(tableName, exists);
  return exists;
}

async function getProcess(tenantId, processId) {
  if (!isUuid(processId)) {
    throw publicError(400, 'INVALID_PROCESS_ID', 'process_id inválido.');
  }

  const result = await pool.query(
    `
    SELECT id, tenant_id, name, code, is_active
    FROM tenant_processes
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, processId]
  );

  if (result.rowCount === 0) {
    throw publicError(404, 'PROCESS_NOT_FOUND', 'Proceso no encontrado para el tenant autenticado.');
  }

  return result.rows[0];
}

async function getOperation(tenantId, operationId, processId = null) {
  if (!operationId) return null;
  if (!isUuid(operationId)) {
    throw publicError(400, 'INVALID_OPERATION_ID', 'operation_id inválido.');
  }

  const result = await pool.query(
    `
    SELECT id, tenant_id, process_id, name, code, is_active
    FROM tenant_operations
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, operationId]
  );

  if (result.rowCount === 0) {
    throw publicError(404, 'OPERATION_NOT_FOUND', 'Operación no encontrada para el tenant autenticado.');
  }

  const operation = result.rows[0];
  if (operation.process_id && processId && String(operation.process_id) !== String(processId)) {
    throw publicError(400, 'OPERATION_PROCESS_MISMATCH', 'La operación no pertenece al proceso seleccionado.');
  }

  return operation;
}

async function validateTarget(tenantId, targetType, targetId) {
  if (!TARGET_TYPES.has(targetType)) {
    throw publicError(400, 'INVALID_TARGET_TYPE', 'target_type inválido.');
  }

  if (!isUuid(targetId)) {
    throw publicError(400, 'INVALID_TARGET_ID', 'target_id inválido.');
  }

  if (targetType === 'control') {
    const result = await pool.query(
      `
      SELECT tc.id, tc.tenant_id, COALESCE(cc.description, 'Control') AS label
      FROM tenant_controls tc
      LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
      WHERE tc.tenant_id = $1::uuid
        AND tc.id = $2::uuid
      LIMIT 1
      `,
      [tenantId, targetId]
    );
    if (result.rowCount > 0) return { ...result.rows[0], target_table: 'tenant_controls' };
  }

  if (targetType === 'evidence') {
    const evidenceResult = await pool.query(
      `
      SELECT id, tenant_id, COALESCE(file_name, description, evidence_type, 'Evidencia') AS label
      FROM evidences
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(status, '') <> 'deleted'
      LIMIT 1
      `,
      [tenantId, targetId]
    );
    if (evidenceResult.rowCount > 0) return { ...evidenceResult.rows[0], target_table: 'evidences' };

    if (await tableExists('document_index')) {
      const documentResult = await pool.query(
        `
        SELECT id, tenant_id, COALESCE(file_name, relative_path, provider_file_id, 'Documento indexado') AS label
        FROM document_index
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
          AND COALESCE(status, 'indexed') NOT IN ('deleted', 'error', 'ignored', 'missing')
        LIMIT 1
        `,
        [tenantId, targetId]
      );
      if (documentResult.rowCount > 0) return { ...documentResult.rows[0], target_table: 'document_index' };
    }
  }

  if (targetType === 'action') {
    const result = await pool.query(
      `
      SELECT id, tenant_id, COALESCE(title, description, 'Plan de acción') AS label
      FROM action_plans
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
      `,
      [tenantId, targetId]
    );
    if (result.rowCount > 0) return { ...result.rows[0], target_table: 'action_plans' };
  }

  if (targetType === 'risk') {
    if (await tableExists('iso_risk_matrix_items')) {
      const result = await pool.query(
        `
        SELECT id, tenant_id, COALESCE(risk_title, risk_code, risk_description, 'Riesgo') AS label
        FROM iso_risk_matrix_items
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
        LIMIT 1
        `,
        [tenantId, targetId]
      );
      if (result.rowCount > 0) return { ...result.rows[0], target_table: 'iso_risk_matrix_items' };
    }

    if ((await tableExists('asset_risks')) && (await tableExists('assets'))) {
      const result = await pool.query(
        `
        SELECT ar.id, a.tenant_id, COALESCE(ar.risk, ar.impact, ar.level, 'Riesgo de activo') AS label
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1::uuid
          AND ar.id = $2::uuid
        LIMIT 1
        `,
        [tenantId, targetId]
      );
      if (result.rowCount > 0) return { ...result.rows[0], target_table: 'asset_risks' };
    }
  }

  throw publicError(404, 'TARGET_NOT_FOUND', 'Elemento asociado no encontrado para el tenant autenticado.');
}

function normalizePayload(payload = {}) {
  const targetType = asString(payload.target_type, 40);
  const relationType = asString(payload.relation_type, 60) || 'associated';
  const source = asString(payload.source, 60) || 'manual';

  if (!RELATION_TYPES.has(relationType)) {
    throw publicError(400, 'INVALID_RELATION_TYPE', 'relation_type inválido.');
  }

  if (!SOURCES.has(source)) {
    throw publicError(400, 'INVALID_LINK_SOURCE', 'source inválido.');
  }

  return {
    processId: asString(payload.process_id, 80),
    operationId: asString(payload.operation_id, 80),
    targetType,
    targetId: asString(payload.target_id, 80),
    relationType,
    source,
    notes: asString(payload.notes, 1000),
  };
}

function mapLink(row) {
  return {
    id: row.id,
    process_id: row.process_id,
    process_name: row.process_name || null,
    operation_id: row.operation_id || null,
    operation_name: row.operation_name || null,
    target_type: row.target_type,
    target_id: row.target_id,
    target_label: row.target_label || null,
    target_table: row.target_table || null,
    relation_type: row.relation_type,
    source: row.source,
    notes: row.notes || null,
    is_active: row.is_active === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function groupLinks(rows) {
  return rows.reduce((acc, row) => {
    const type = row.target_type;
    if (!acc[type]) acc[type] = { count: 0, active_count: 0, items: [] };
    acc[type].count += 1;
    if (row.is_active) acc[type].active_count += 1;
    acc[type].items.push(row);
    return acc;
  }, {
    control: { count: 0, active_count: 0, items: [] },
    evidence: { count: 0, active_count: 0, items: [] },
    risk: { count: 0, active_count: 0, items: [] },
    action: { count: 0, active_count: 0, items: [] },
  });
}

async function attachTargetSummaries(tenantId, rows) {
  const mapped = rows.map(mapLink);
  const byType = mapped.reduce((acc, row) => {
    if (!acc[row.target_type]) acc[row.target_type] = [];
    acc[row.target_type].push(row.target_id);
    return acc;
  }, {});
  const summaries = new Map();

  async function addRows(type, query, ids) {
    if (!ids?.length) return;
    const result = await pool.query(query, [tenantId, ids]);
    for (const row of result.rows) {
      summaries.set(`${type}:${row.id}`, row);
    }
  }

  await addRows('control', `
    SELECT tc.id, 'tenant_controls' AS target_table, COALESCE(cc.description, 'Control') AS target_label
    FROM tenant_controls tc
    LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
    WHERE tc.tenant_id = $1::uuid
      AND tc.id = ANY($2::uuid[])
  `, byType.control);

  await addRows('evidence', `
    SELECT id, 'evidences' AS target_table, COALESCE(file_name, description, evidence_type, 'Evidencia') AS target_label
    FROM evidences
    WHERE tenant_id = $1::uuid
      AND id = ANY($2::uuid[])
  `, byType.evidence);

  if (byType.evidence?.length && await tableExists('document_index')) {
    await addRows('evidence', `
      SELECT
        id,
        'document_index' AS target_table,
        COALESCE(file_name, relative_path, provider_file_id, 'Documento indexado') AS target_label
      FROM document_index
      WHERE tenant_id = $1::uuid
        AND id = ANY($2::uuid[])
        AND COALESCE(status, 'indexed') NOT IN ('deleted', 'error', 'ignored', 'missing')
    `, byType.evidence);
  }

  await addRows('action', `
    SELECT id, 'action_plans' AS target_table, COALESCE(title, description, 'Plan de acción') AS target_label
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND id = ANY($2::uuid[])
  `, byType.action);

  if (byType.risk?.length && await tableExists('iso_risk_matrix_items')) {
    await addRows('risk', `
      SELECT id, 'iso_risk_matrix_items' AS target_table, COALESCE(risk_title, risk_code, risk_description, 'Riesgo') AS target_label
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND id = ANY($2::uuid[])
    `, byType.risk);
  }

  if (byType.risk?.length && await tableExists('asset_risks') && await tableExists('assets')) {
    await addRows('risk', `
      SELECT ar.id, 'asset_risks' AS target_table, COALESCE(ar.risk, ar.impact, ar.level, 'Riesgo de activo') AS target_label
      FROM asset_risks ar
      JOIN assets a ON a.id = ar.asset_id
      WHERE a.tenant_id = $1::uuid
        AND ar.id = ANY($2::uuid[])
    `, byType.risk);
  }

  return mapped.map((row) => ({
    ...row,
    ...(summaries.get(`${row.target_type}:${row.target_id}`) || {}),
  }));
}

async function listLinks({ user, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  const params = [tenantId];
  const where = ['l.tenant_id = $1::uuid'];

  if (filters.process_id) {
    params.push(filters.process_id);
    where.push(`l.process_id = $${params.length}::uuid`);
  }

  if (filters.operation_id) {
    params.push(filters.operation_id);
    where.push(`l.operation_id = $${params.length}::uuid`);
  }

  if (filters.target_type) {
    const targetType = asString(filters.target_type, 40);
    if (!TARGET_TYPES.has(targetType)) throw publicError(400, 'INVALID_TARGET_TYPE', 'target_type inválido.');
    params.push(targetType);
    where.push(`l.target_type = $${params.length}`);
  }

  if (filters.is_active !== undefined && filters.is_active !== '') {
    params.push(boolValue(filters.is_active, true));
    where.push(`l.is_active = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `
      SELECT
        l.*,
        p.name AS process_name,
        op.name AS operation_name
      FROM tenant_process_entity_links l
      JOIN tenant_processes p
        ON p.id = l.process_id
       AND p.tenant_id = l.tenant_id
      LEFT JOIN tenant_operations op
        ON op.id = l.operation_id
       AND op.tenant_id = l.tenant_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.is_active DESC, l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
      LIMIT 300
      `,
      params
    );
    const data = await attachTargetSummaries(tenantId, result.rows);
    return { data, grouped: groupLinks(data) };
  } catch (error) {
    throw databaseError(error);
  }
}

async function listByProcess({ user, processId, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  const process = await getProcess(tenantId, processId);
  const links = await listLinks({ user, filters: { ...filters, process_id: processId } });
  return { process, ...links };
}

async function listByOperation({ user, operationId, filters = {} }) {
  const { tenantId } = assertAccess(user, 'read');
  const operation = await getOperation(tenantId, operationId);
  const links = await listLinks({ user, filters: { ...filters, operation_id: operationId } });
  return { operation, ...links };
}

async function listCandidates({ user, targetType, search = '' }) {
  const { tenantId } = assertAccess(user, 'read');
  const normalizedType = asString(targetType, 40);
  const term = `%${String(search || '').trim()}%`;

  if (!TARGET_TYPES.has(normalizedType)) {
    throw publicError(400, 'INVALID_TARGET_TYPE', 'target_type inválido.');
  }

  try {
    if (normalizedType === 'control') {
      const result = await pool.query(
        `
        SELECT
          tc.id,
          'control' AS target_type,
          COALESCE(cc.description, 'Control') AS label,
          COALESCE(op.name, 'Sin operación') AS subtitle
        FROM tenant_controls tc
        LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
        LEFT JOIN tenant_operations op ON op.id = tc.operation_id AND op.tenant_id = tc.tenant_id
        WHERE tc.tenant_id = $1::uuid
          AND ($2 = '%%' OR cc.description ILIKE $2 OR op.name ILIKE $2)
        ORDER BY cc.description ASC NULLS LAST
        LIMIT 50
        `,
        [tenantId, term]
      );
      return result.rows;
    }

    if (normalizedType === 'evidence') {
      const evidenceResult = await pool.query(
        `
        SELECT
          id,
          'evidence' AS target_type,
          COALESCE(file_name, description, evidence_type, 'Evidencia') AS label,
          file_name AS filename,
          COALESCE(description, evidence_type, '') AS title,
          'evidences' AS source_table,
          'formal_evidence' AS source_type,
          COALESCE(created_at, reviewed_at, expires_at) AS evidence_date,
          COALESCE(status, evidence_type, 'Sin estado') AS subtitle,
          metadata
        FROM evidences
        WHERE tenant_id = $1::uuid
          AND COALESCE(status, '') <> 'deleted'
          AND ($2 = '%%' OR file_name ILIKE $2 OR description ILIKE $2 OR evidence_type ILIKE $2)
        ORDER BY created_at DESC NULLS LAST, reviewed_at DESC NULLS LAST
        LIMIT 50
        `,
        [tenantId, term]
      );

      const rows = [...evidenceResult.rows];

      if (rows.length < 50 && await tableExists('document_index')) {
        const documentResult = await pool.query(
          `
          SELECT
            id,
            'evidence' AS target_type,
            COALESCE(file_name, relative_path, provider_file_id, 'Documento indexado') AS label,
            file_name AS filename,
            COALESCE(file_name, relative_path, provider_file_id, 'Documento indexado') AS title,
            'document_index' AS source_table,
            COALESCE(provider, 'document_index') AS source_type,
            COALESCE(indexed_at, modified_at, last_seen_at) AS evidence_date,
            COALESCE(provider, status, 'Documento indexado') AS subtitle,
            metadata_json AS metadata
          FROM document_index
          WHERE tenant_id = $1::uuid
            AND COALESCE(status, 'indexed') NOT IN ('deleted', 'error', 'ignored', 'missing')
            AND (
              $2 = '%%'
              OR file_name ILIKE $2
              OR relative_path ILIKE $2
              OR provider_file_id ILIKE $2
              OR COALESCE(metadata_json::text, '') ILIKE $2
            )
          ORDER BY indexed_at DESC NULLS LAST, modified_at DESC NULLS LAST, last_seen_at DESC NULLS LAST
          LIMIT $3
          `,
          [tenantId, term, Math.max(1, 50 - rows.length)]
        );
        rows.push(...documentResult.rows);
      }

      return rows;
    }

    if (normalizedType === 'action') {
      const result = await pool.query(
        `
        SELECT
          id,
          'action' AS target_type,
          COALESCE(title, description, 'Plan de acción') AS label,
          COALESCE(status, priority, 'Sin estado') AS subtitle
        FROM action_plans
        WHERE tenant_id = $1::uuid
          AND ($2 = '%%' OR title ILIKE $2 OR description ILIKE $2 OR status ILIKE $2)
        ORDER BY due_date ASC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 50
        `,
        [tenantId, term]
      );
      return result.rows;
    }

    const riskRows = [];
    if (await tableExists('iso_risk_matrix_items')) {
      const result = await pool.query(
        `
        SELECT
          id,
          'risk' AS target_type,
          COALESCE(risk_title, risk_code, risk_description, 'Riesgo') AS label,
          COALESCE(residual_risk_level, inherent_risk_level, standard_code, 'Sin nivel') AS subtitle
        FROM iso_risk_matrix_items
        WHERE tenant_id = $1::uuid
          AND ($2 = '%%' OR risk_title ILIKE $2 OR risk_code ILIKE $2 OR risk_description ILIKE $2)
        ORDER BY residual_risk_score DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 50
        `,
        [tenantId, term]
      );
      riskRows.push(...result.rows);
    }

    if (riskRows.length < 50 && await tableExists('asset_risks') && await tableExists('assets')) {
      const result = await pool.query(
        `
        SELECT
          ar.id,
          'risk' AS target_type,
          COALESCE(ar.risk, ar.impact, ar.level, 'Riesgo de activo') AS label,
          COALESCE(a.name, ar.level, 'Activo') AS subtitle
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1::uuid
          AND ($2 = '%%' OR ar.risk ILIKE $2 OR ar.impact ILIKE $2 OR ar.level ILIKE $2 OR a.name ILIKE $2)
        ORDER BY ar.created_at DESC NULLS LAST
        LIMIT $3
        `,
        [tenantId, term, Math.max(1, 50 - riskRows.length)]
      );
      riskRows.push(...result.rows);
    }

    return riskRows;
  } catch (error) {
    throw databaseError(error);
  }
}

async function createLink({ user, payload = {} }) {
  const { tenantId, userId } = assertAccess(user, 'manage');
  const normalized = normalizePayload(payload);
  await getProcess(tenantId, normalized.processId);
  await getOperation(tenantId, normalized.operationId, normalized.processId);
  await validateTarget(tenantId, normalized.targetType, normalized.targetId);

  try {
    const result = await pool.query(
      `
      INSERT INTO tenant_process_entity_links (
        tenant_id, process_id, operation_id, target_type, target_id,
        relation_type, source, notes, is_active, created_by_user_id, updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8, true, $9::uuid, now())
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [
        tenantId,
        normalized.processId,
        normalized.operationId,
        normalized.targetType,
        normalized.targetId,
        normalized.relationType,
        normalized.source,
        normalized.notes,
        userId,
      ]
    );

    if (result.rowCount > 0) {
      const [link] = await attachTargetSummaries(tenantId, result.rows);
      return link;
    }

    const existing = await pool.query(
      `
      SELECT *
      FROM tenant_process_entity_links
      WHERE tenant_id = $1::uuid
        AND process_id = $2::uuid
        AND COALESCE(operation_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND target_type = $4
        AND target_id = $5::uuid
        AND is_active = true
      LIMIT 1
      `,
      [tenantId, normalized.processId, normalized.operationId, normalized.targetType, normalized.targetId]
    );
    throw publicError(409, 'PROCESS_LINK_ALREADY_EXISTS', existing.rowCount ? 'La asociación ya existe para este proceso.' : 'No fue posible crear la asociación.');
  } catch (error) {
    throw databaseError(error);
  }
}

async function setLinkStatus({ user, linkId, isActive }) {
  const { tenantId } = assertAccess(user, 'manage');
  if (!isUuid(linkId)) throw publicError(400, 'INVALID_LINK_ID', 'id de asociación inválido.');

  try {
    const result = await pool.query(
      `
      UPDATE tenant_process_entity_links
      SET is_active = $1,
          updated_at = now()
      WHERE tenant_id = $2::uuid
        AND id = $3::uuid
      RETURNING *
      `,
      [boolValue(isActive, true), tenantId, linkId]
    );

    if (result.rowCount === 0) {
      throw publicError(404, 'PROCESS_LINK_NOT_FOUND', 'Asociación no encontrada para el tenant autenticado.');
    }

    const [link] = await attachTargetSummaries(tenantId, result.rows);
    return link;
  } catch (error) {
    throw databaseError(error);
  }
}

module.exports = {
  listLinks,
  listByProcess,
  listByOperation,
  listCandidates,
  createLink,
  setLinkStatus,
};
