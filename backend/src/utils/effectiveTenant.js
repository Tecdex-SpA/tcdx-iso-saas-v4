'use strict';

const pool = require('../config/db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);

class TenantResolutionError extends Error {
  constructor(code, message, status = 403, details = null) {
    super(message);
    this.name = 'TenantResolutionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isPlatformUser(user) {
  return PLATFORM_ROLES.has(normalizeRole(user?.role || user?.user_role || user?.userRole));
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || user?.sub || null;
}

function cleanTenantId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').trim();
}

function isUuid(value) {
  return UUID_RE.test(cleanTenantId(value));
}

function requestedTenantIdFromRequest(req) {
  return cleanTenantId(
    req?.resolvedTenantId ||
      req?.tenantId ||
      req?.headers?.['x-tenant-id'] ||
      req?.headers?.['x-tenant'] ||
      req?.query?.tenant_id ||
      req?.query?.tenantId ||
      req?.body?.tenant_id ||
      req?.body?.tenantId ||
      null
  );
}

async function tenantExists(tenantId) {
  const result = await pool.query(
    `SELECT id, name
       FROM tenants
      WHERE id = $1::uuid
      LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function resolveEffectiveTenant(req, options = {}) {
  const required = options.required !== false;
  const user = req?.user || {};
  const requestedTenantId = cleanTenantId(options.tenantId || requestedTenantIdFromRequest(req));
  const userTenantId = cleanTenantId(getUserTenantId(user));
  const platform = isPlatformUser(user);

  if (platform) {
    if (!requestedTenantId) {
      if (!required) return null;
      throw new TenantResolutionError(
        'TENANT_REQUIRED',
        'Selecciona una empresa para operar este módulo.',
        400
      );
    }
    if (!isUuid(requestedTenantId)) {
      throw new TenantResolutionError('TENANT_INVALID', 'tenant_id debe ser UUID valido.', 422);
    }
    const tenant = await tenantExists(requestedTenantId);
    if (!tenant) {
      throw new TenantResolutionError('TENANT_FORBIDDEN', 'La empresa seleccionada no existe o no está disponible.', 403);
    }
    req.resolvedTenantId = requestedTenantId;
    req.tenantId = requestedTenantId;
    req.effectiveTenant = tenant;
    return requestedTenantId;
  }

  if (!userTenantId) {
    if (!required) return null;
    throw new TenantResolutionError('TENANT_REQUIRED', 'El usuario no tiene empresa asociada.', 403);
  }
  if (!isUuid(userTenantId)) {
    throw new TenantResolutionError('TENANT_INVALID', 'tenant_id debe ser UUID valido.', 422);
  }
  if (requestedTenantId && requestedTenantId !== userTenantId) {
    throw new TenantResolutionError('TENANT_FORBIDDEN', 'No autorizado para operar datos de otra empresa.', 403);
  }
  req.resolvedTenantId = userTenantId;
  req.tenantId = userTenantId;
  return userTenantId;
}

module.exports = {
  PLATFORM_ROLES,
  TenantResolutionError,
  cleanTenantId,
  getUserId,
  getUserTenantId,
  isPlatformUser,
  isUuid,
  normalizeRole,
  requestedTenantIdFromRequest,
  resolveEffectiveTenant,
};
