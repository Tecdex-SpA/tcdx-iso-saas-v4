const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const {
  getJwtSecret,
  getJwtVerifyOptions,
} = require('../config/security');
const {
  authenticatedRateLimit,
} = require('./authenticatedRateLimit.middleware');

function getBearerToken(req) {
  const header =
    req.headers.authorization ||
    req.headers.Authorization ||
    '';

  if (!header) return null;

  if (String(header).startsWith('Bearer ')) {
    return String(header).replace('Bearer ', '').trim();
  }

  return String(header).trim();
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  const normalized = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalized);
}

function isDealerRole(role) {
  return normalizeRole(role) === 'dealer';
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

function getPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function getInternalAiToken(req) {
  return (
    req.headers['x-ai-token'] ||
    req.headers['x-internal-token'] ||
    req.headers['x-ai-internal-token'] ||
    ''
  );
}

function isInternalAiKnowledgePath(req) {
  return getPath(req) === '/api/ai-compliance/knowledge/internal-search';
}

function isValidInternalAiRequest(req) {
  const configuredToken = process.env.AI_INTERNAL_TOKEN || '';
  const incomingToken = getInternalAiToken(req);

  return Boolean(configuredToken) && Boolean(incomingToken) && incomingToken === configuredToken;
}

async function validateTenantServiceStatus(req, res, decoded) {
  const role = normalizeRole(
    decoded?.role ||
      decoded?.user_role ||
      decoded?.userRole
  );

  // Superadmin/plataforma no se bloquea por estado de tenant.
  if (isPlatformRole(role)) {
    return true;
  }

  // Dealer usa portal propio y no depende de tenant operativo directo.
  if (isDealerRole(role)) {
    return true;
  }

  const tenantId = getUserTenantId(decoded);

  // Si el token no trae tenant, dejamos seguir para no romper rutas existentes.
  // Los endpoints específicos ya validan tenant cuando corresponde.
  if (!tenantId) {
    return true;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      name,
      COALESCE(service_status, 'active') AS service_status,
      suspended_at,
      suspension_reason,
      deleted_at,
      deletion_reason
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  const tenant = result.rows[0];

  if (!tenant) {
    return res.status(403).json({
      ok: false,
      code: 'TENANT_NOT_FOUND',
      error: 'La empresa asociada al usuario no existe o no está disponible.',
    });
  }

  const serviceStatus = String(tenant.service_status || 'active').toLowerCase();

  if (
    serviceStatus === 'suspended' ||
    serviceStatus === 'suspended_non_payment'
  ) {
    return res.status(403).json({
      ok: false,
      code: 'TENANT_SERVICE_SUSPENDED',
      error: `El servicio de ${tenant.name} está suspendido por no pago. Contacta al administrador comercial de TCDX para regularizar la cuenta.`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      service_status: serviceStatus,
      suspended_at: tenant.suspended_at,
      suspension_reason: tenant.suspension_reason,
    });
  }

  if (serviceStatus === 'deleted' || tenant.deleted_at) {
    return res.status(403).json({
      ok: false,
      code: 'TENANT_SERVICE_DELETED',
      error: `El servicio de ${tenant.name} ya no se encuentra activo. La empresa fue dada de baja administrativamente.`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      service_status: serviceStatus,
      deleted_at: tenant.deleted_at,
      deletion_reason: tenant.deletion_reason,
    });
  }

  req.tenant_service_status = tenant;

  return true;
}

module.exports = async function auth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      if (isInternalAiKnowledgePath(req)) {
        const incomingToken = getInternalAiToken(req);

        if (isValidInternalAiRequest(req)) {
          req.user = {
            role: 'internal_ai',
            is_internal_ai: true,
            tenant_id: null,
          };
          return authenticatedRateLimit(req, res, next);
        }

        if (incomingToken) {
          return res.status(401).json({
            ok: false,
            error: 'Token interno IA inválido',
            code: 'INTERNAL_AI_TOKEN_INVALID',
            request_id: req.requestId || null,
          });
        }
      }

      return res.status(401).json({
        error: 'sin Token',
        code: 'NO_TOKEN',
        request_id: req.requestId || null,
      });
    }

    const secret = getJwtSecret();

    if (!secret) {
      console.error('AUTH ERROR: JWT secret no configurado');

      return res.status(500).json({
        error: 'Servicio de autenticación no disponible',
        code: 'JWT_SECRET_MISSING',
        request_id: req.requestId || null,
      });
    }

    const decoded = jwt.verify(token, secret, getJwtVerifyOptions());

    req.token = token;
    req.user = decoded;

    const allowed = await validateTenantServiceStatus(req, res, decoded);

    if (allowed !== true) {
      return;
    }

    return authenticatedRateLimit(req, res, next);
  } catch (error) {
    console.error('AUTH ERROR:', error.message);

    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      request_id: req.requestId || null,
    });
  }
};
