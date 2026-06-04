'use strict';

const pool = require('../config/db');

const ADMIN_ROLES = ['admin', 'tenant_admin'];
const PROCESS_CRITICALITIES = ['baja', 'media', 'alta', 'low', 'medium', 'high'];
const OPERATION_TYPES = [
  'empresa',
  'operacion',
  'proceso',
  'sede',
  'area',
  'unidad',
  'servicio',
  'planta',
  'sucursal',
];

function normalizeRole(user = {}) {
  return String(user.role || user.user_role || user.userRole || '').toLowerCase().trim();
}

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function requireTenantAdmin(user = {}) {
  const role = normalizeRole(user);
  const tenantId = getUserTenantId(user);

  if (!ADMIN_ROLES.includes(role)) {
    const error = new Error('No autorizado para administrar procesos y operaciones');
    error.status = 403;
    error.code = 'PROCESS_RBAC_DENIED';
    throw error;
  }

  if (!tenantId) {
    const error = new Error('Tenant no identificado para administrar procesos y operaciones');
    error.status = 403;
    error.code = 'TENANT_REQUIRED';
    throw error;
  }

  return { tenantId, userId: getUserId(user), role };
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

function normalizeCriticality(value) {
  const normalized = String(value || 'media').toLowerCase().trim();
  return PROCESS_CRITICALITIES.includes(normalized) ? normalized : 'media';
}

function normalizeOperationType(value) {
  const normalized = String(value || 'operacion').toLowerCase().trim();
  return OPERATION_TYPES.includes(normalized) ? normalized : 'operacion';
}

function safeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function databaseError(error) {
  if (error?.code === '23505') {
    return publicError(409, 'DUPLICATE_PROCESS_OR_OPERATION', 'Ya existe un proceso u operación con esos datos.');
  }

  if (error?.code === '42P01' || error?.code === '42703') {
    return publicError(
      500,
      'SPRINT2_MIGRATION_REQUIRED',
      'La migración Sprint 2 de procesos y operaciones no ha sido aplicada.'
    );
  }

  return error;
}

async function assertOwnerBelongsToTenant(client, tenantId, ownerUserId) {
  if (!ownerUserId) return null;

  const result = await client.query(
    `
    SELECT id
    FROM users
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [ownerUserId, tenantId]
  );

  if (result.rowCount === 0) {
    throw publicError(400, 'OWNER_NOT_IN_TENANT', 'El responsable indicado no pertenece al tenant autenticado.');
  }

  return ownerUserId;
}

function mapProcess(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    code: row.code || null,
    name: row.name,
    description: row.description || null,
    area: row.area || null,
    owner_user_id: row.owner_user_id || null,
    owner_name: row.owner_name || null,
    owner_email: row.owner_email || null,
    criticality: row.criticality || 'media',
    is_active: row.is_active === true,
    sort_order: Number(row.sort_order || 0),
    metadata: row.metadata || {},
    operations_count: Number(row.operations_count || 0),
    active_operations_count: Number(row.active_operations_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOperation(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    process_id: row.process_id || null,
    code: row.code || null,
    name: row.name,
    description: row.description || null,
    operation_type: row.operation_type || 'operacion',
    frequency: row.frequency || null,
    owner_user_id: row.owner_user_id || null,
    owner_name: row.owner_name || null,
    owner_email: row.owner_email || null,
    is_active: row.is_active === true,
    is_default: row.is_default === true,
    sort_order: Number(row.sort_order || 0),
    metadata: row.metadata || {},
    active_standards_count: Number(row.active_standards_count || 0),
    active_standards: Array.isArray(row.active_standards) ? row.active_standards : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listProcesses({ user, filters = {} }) {
  const { tenantId } = requireTenantAdmin(user);
  const params = [tenantId];
  const where = ['p.tenant_id = $1::uuid'];

  if (filters.is_active !== undefined && filters.is_active !== '') {
    params.push(boolValue(filters.is_active, true));
    where.push(`p.is_active = $${params.length}`);
  }

  if (filters.area) {
    params.push(`%${String(filters.area).trim()}%`);
    where.push(`p.area ILIKE $${params.length}`);
  }

  if (filters.criticality) {
    params.push(normalizeCriticality(filters.criticality));
    where.push(`p.criticality = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${String(filters.search).trim()}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }

  try {
    const result = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(u.full_name, u.name, u.email) AS owner_name,
        u.email AS owner_email,
        COUNT(op.id)::int AS operations_count,
        COUNT(op.id) FILTER (WHERE op.is_active = TRUE)::int AS active_operations_count
      FROM tenant_processes p
      LEFT JOIN users u
        ON u.id = p.owner_user_id
      LEFT JOIN tenant_operations op
        ON op.tenant_id = p.tenant_id
       AND op.process_id = p.id
      WHERE ${where.join(' AND ')}
      GROUP BY p.id, u.full_name, u.name, u.email
      ORDER BY p.is_active DESC, p.sort_order, p.name
      `,
      params
    );

    return result.rows.map(mapProcess);
  } catch (error) {
    throw databaseError(error);
  }
}

async function getProcess({ user, processId }) {
  const { tenantId } = requireTenantAdmin(user);

  try {
    const result = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(u.full_name, u.name, u.email) AS owner_name,
        u.email AS owner_email,
        COUNT(op.id)::int AS operations_count,
        COUNT(op.id) FILTER (WHERE op.is_active = TRUE)::int AS active_operations_count
      FROM tenant_processes p
      LEFT JOIN users u
        ON u.id = p.owner_user_id
      LEFT JOIN tenant_operations op
        ON op.tenant_id = p.tenant_id
       AND op.process_id = p.id
      WHERE p.tenant_id = $1::uuid
        AND p.id = $2::uuid
      GROUP BY p.id, u.full_name, u.name, u.email
      LIMIT 1
      `,
      [tenantId, processId]
    );

    if (result.rowCount === 0) {
      throw publicError(404, 'PROCESS_NOT_FOUND', 'Proceso no encontrado.');
    }

    return mapProcess(result.rows[0]);
  } catch (error) {
    throw databaseError(error);
  }
}

async function createProcess({ user, payload = {} }) {
  const { tenantId, userId } = requireTenantAdmin(user);
  const name = asString(payload.name, 180);
  if (!name) throw publicError(400, 'PROCESS_NAME_REQUIRED', 'El nombre del proceso es obligatorio.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerUserId = await assertOwnerBelongsToTenant(client, tenantId, asString(payload.owner_user_id, 80));

    const result = await client.query(
      `
      INSERT INTO tenant_processes (
        tenant_id, code, name, description, area, owner_user_id, criticality,
        is_active, sort_order, metadata, created_by_user_id, updated_by_user_id, updated_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10::jsonb, $11::uuid, $11::uuid, now())
      RETURNING *
      `,
      [
        tenantId,
        asString(payload.code, 60),
        name,
        asString(payload.description, 2000),
        asString(payload.area, 160),
        ownerUserId,
        normalizeCriticality(payload.criticality),
        boolValue(payload.is_active, true),
        Number(payload.sort_order || 0),
        JSON.stringify(safeMetadata(payload.metadata)),
        userId,
      ]
    );

    await client.query('COMMIT');
    return mapProcess(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    client.release();
  }
}

async function updateProcess({ user, processId, payload = {} }) {
  const { tenantId, userId } = requireTenantAdmin(user);
  const current = await getProcess({ user, processId });
  if (!current) throw publicError(404, 'PROCESS_NOT_FOUND', 'Proceso no encontrado.');
  const nextName = payload.name !== undefined ? asString(payload.name, 180) : current.name;

  if (!nextName) {
    throw publicError(400, 'PROCESS_NAME_REQUIRED', 'El nombre del proceso es obligatorio.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerUserId = await assertOwnerBelongsToTenant(client, tenantId, asString(payload.owner_user_id, 80));

    const result = await client.query(
      `
      UPDATE tenant_processes
      SET
        code = $1,
        name = $2,
        description = $3,
        area = $4,
        owner_user_id = $5::uuid,
        criticality = $6,
        is_active = $7,
        sort_order = $8,
        metadata = $9::jsonb,
        updated_by_user_id = $10::uuid,
        updated_at = now()
      WHERE tenant_id = $11::uuid
        AND id = $12::uuid
      RETURNING *
      `,
      [
        payload.code !== undefined ? asString(payload.code, 60) : current.code,
        nextName,
        payload.description !== undefined ? asString(payload.description, 2000) : current.description,
        payload.area !== undefined ? asString(payload.area, 160) : current.area,
        payload.owner_user_id !== undefined ? ownerUserId : current.owner_user_id,
        payload.criticality !== undefined ? normalizeCriticality(payload.criticality) : current.criticality,
        payload.is_active !== undefined ? boolValue(payload.is_active, current.is_active) : current.is_active,
        payload.sort_order !== undefined ? Number(payload.sort_order || 0) : current.sort_order,
        payload.metadata !== undefined ? JSON.stringify(safeMetadata(payload.metadata)) : JSON.stringify(current.metadata || {}),
        userId,
        tenantId,
        processId,
      ]
    );

    await client.query('COMMIT');
    return mapProcess(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    client.release();
  }
}

async function setProcessStatus({ user, processId, isActive }) {
  const { tenantId, userId } = requireTenantAdmin(user);

  try {
    const result = await pool.query(
      `
      UPDATE tenant_processes
      SET is_active = $1,
          updated_by_user_id = $2::uuid,
          updated_at = now()
      WHERE tenant_id = $3::uuid
        AND id = $4::uuid
      RETURNING *
      `,
      [boolValue(isActive, true), userId, tenantId, processId]
    );

    if (result.rowCount === 0) {
      throw publicError(404, 'PROCESS_NOT_FOUND', 'Proceso no encontrado.');
    }

    return mapProcess(result.rows[0]);
  } catch (error) {
    throw databaseError(error);
  }
}

async function listOperationsForProcess({ user, processId, filters = {} }) {
  const { tenantId } = requireTenantAdmin(user);
  await getProcess({ user, processId });

  const params = [tenantId, processId];
  const where = ['op.tenant_id = $1::uuid', 'op.process_id = $2::uuid'];

  if (filters.is_active !== undefined && filters.is_active !== '') {
    params.push(boolValue(filters.is_active, true));
    where.push(`op.is_active = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `
      SELECT
        op.*,
        COALESCE(u.full_name, u.name, u.email) AS owner_name,
        u.email AS owner_email,
        COUNT(tso.id) FILTER (WHERE tso.is_active = TRUE)::int AS active_standards_count,
        COALESCE(
          array_agg(DISTINCT tso.standard_code ORDER BY tso.standard_code)
            FILTER (WHERE tso.is_active = TRUE),
          ARRAY[]::text[]
        ) AS active_standards
      FROM tenant_operations op
      LEFT JOIN users u
        ON u.id = op.owner_user_id
      LEFT JOIN tenant_standard_operations tso
        ON tso.tenant_id = op.tenant_id
       AND tso.operation_id = op.id
      WHERE ${where.join(' AND ')}
      GROUP BY op.id, u.full_name, u.name, u.email
      ORDER BY op.is_active DESC, op.sort_order, op.name
      `,
      params
    );

    return result.rows.map(mapOperation);
  } catch (error) {
    throw databaseError(error);
  }
}

async function createOperation({ user, processId, payload = {} }) {
  const { tenantId } = requireTenantAdmin(user);
  await getProcess({ user, processId });
  const name = asString(payload.name, 180);
  if (!name) throw publicError(400, 'OPERATION_NAME_REQUIRED', 'El nombre de la operación es obligatorio.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerUserId = await assertOwnerBelongsToTenant(client, tenantId, asString(payload.owner_user_id, 80));

    const result = await client.query(
      `
      INSERT INTO tenant_operations (
        tenant_id, process_id, code, name, description, operation_type, frequency,
        owner_user_id, is_active, is_default, sort_order, metadata, updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9, FALSE, $10, $11::jsonb, now())
      RETURNING *
      `,
      [
        tenantId,
        processId,
        asString(payload.code, 60),
        name,
        asString(payload.description, 2000),
        normalizeOperationType(payload.operation_type),
        asString(payload.frequency, 120),
        ownerUserId,
        boolValue(payload.is_active, true),
        Number(payload.sort_order || 0),
        JSON.stringify(safeMetadata(payload.metadata)),
      ]
    );

    await client.query('COMMIT');
    return mapOperation(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    client.release();
  }
}

async function updateOperation({ user, operationId, payload = {} }) {
  const { tenantId } = requireTenantAdmin(user);
  const currentResult = await pool.query(
    `
    SELECT *
    FROM tenant_operations
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, operationId]
  );

  if (currentResult.rowCount === 0) {
    throw publicError(404, 'OPERATION_NOT_FOUND', 'Operación no encontrada.');
  }

  const current = currentResult.rows[0];
  const nextProcessId = payload.process_id !== undefined ? asString(payload.process_id, 80) : current.process_id;
  const nextName = payload.name !== undefined ? asString(payload.name, 180) : current.name;

  if (!nextName) {
    throw publicError(400, 'OPERATION_NAME_REQUIRED', 'El nombre de la operación es obligatorio.');
  }

  if (nextProcessId) await getProcess({ user, processId: nextProcessId });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerUserId = await assertOwnerBelongsToTenant(client, tenantId, asString(payload.owner_user_id, 80));

    const result = await client.query(
      `
      UPDATE tenant_operations
      SET
        process_id = $1::uuid,
        code = $2,
        name = $3,
        description = $4,
        operation_type = $5,
        frequency = $6,
        owner_user_id = $7::uuid,
        is_active = $8,
        sort_order = $9,
        metadata = $10::jsonb,
        updated_at = now()
      WHERE tenant_id = $11::uuid
        AND id = $12::uuid
      RETURNING *
      `,
      [
        nextProcessId,
        payload.code !== undefined ? asString(payload.code, 60) : current.code,
        nextName,
        payload.description !== undefined ? asString(payload.description, 2000) : current.description,
        payload.operation_type !== undefined ? normalizeOperationType(payload.operation_type) : current.operation_type,
        payload.frequency !== undefined ? asString(payload.frequency, 120) : current.frequency,
        payload.owner_user_id !== undefined ? ownerUserId : current.owner_user_id,
        payload.is_active !== undefined ? boolValue(payload.is_active, current.is_active) : current.is_active,
        payload.sort_order !== undefined ? Number(payload.sort_order || 0) : Number(current.sort_order || 0),
        payload.metadata !== undefined ? JSON.stringify(safeMetadata(payload.metadata)) : JSON.stringify(current.metadata || {}),
        tenantId,
        operationId,
      ]
    );

    await client.query('COMMIT');
    return mapOperation(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    client.release();
  }
}

async function setOperationStatus({ user, operationId, isActive }) {
  const { tenantId } = requireTenantAdmin(user);

  try {
    const result = await pool.query(
      `
      UPDATE tenant_operations
      SET is_active = $1,
          updated_at = now()
      WHERE tenant_id = $2::uuid
        AND id = $3::uuid
        AND is_default = FALSE
      RETURNING *
      `,
      [boolValue(isActive, true), tenantId, operationId]
    );

    if (result.rowCount === 0) {
      throw publicError(404, 'OPERATION_NOT_FOUND_OR_DEFAULT', 'Operación no encontrada o es la operación por defecto.');
    }

    return mapOperation(result.rows[0]);
  } catch (error) {
    throw databaseError(error);
  }
}

module.exports = {
  listProcesses,
  getProcess,
  createProcess,
  updateProcess,
  setProcessStatus,
  listOperationsForProcess,
  createOperation,
  updateOperation,
  setOperationStatus,
};
