const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const auth = require('../middleware/auth');
const authService = require('../services/auth.service');
const { resolveLocale } = require('../utils/locale');
const { sendError } = require('../utils/errorResponse');
const { ERROR_CODES } = require('../utils/errorCodes');
const { safeErrorLog } = require('../utils/safeLogger');

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getHomePathByRole(role) {
  const normalizedRole = normalizeRole(role);
  if (['superadmin','super_admin','platform_admin','admin_global','global_admin','owner'].includes(normalizedRole)) return '/admin-saas';
  if (normalizedRole === 'dealer') return '/dealer';
  return '/dashboard';
}

function buildSessionFromToken(token, tenant = null) {
  const payload = jwt.decode(token) || {};
  const role = payload?.role || payload?.user_role || payload?.userRole || '';
  const tenantId = payload?.tenant_id || payload?.tenantId || payload?.tenant || payload?.company_id || payload?.companyId || tenant?.id || null;
  return {
    token,
    user: {
      id: payload?.user_id || payload?.userId || payload?.id || null,
      tenant_id: tenantId,
      tenant_name: tenant?.name || payload?.tenant_name || payload?.company_name || null,
      email: payload?.email || null,
      role,
    },
    tenant: tenant ? {
      id: tenant.id,
      tenant_id: tenant.id,
      name: tenant.name,
      tenant_name: tenant.name,
      service_status: tenant.service_status || 'active',
    } : tenantId ? { id: tenantId, tenant_id: tenantId, name: payload?.tenant_name || payload?.company_name || null } : null,
    home_path: getHomePathByRole(role),
    expires_at: payload?.exp ? new Date(Number(payload.exp) * 1000).toISOString() : null,
  };
}

router.post('/register', async (req, res) => {
  try {
    if (process.env.ENABLE_PUBLIC_REGISTER !== 'true') {
      const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
      return sendError(res, { status: 403, code: ERROR_CODES.AUTH_FORBIDDEN, message: 'Registro público deshabilitado', locale });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const tenant = req.body?.tenant || null;
    if (!email || !password) {
      const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
      return sendError(res, { status: 400, code: ERROR_CODES.VALIDATION_ERROR, message: 'Email y password son requeridos', locale });
    }
    return res.json(await authService.register(email, password, tenant));
  } catch (err) {
    safeErrorLog('REGISTER ERROR:', err, req);
    const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
    return sendError(res, { status: 500, code: ERROR_CODES.SERVER_ERROR, message: 'Error registrando usuario', locale });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
      return sendError(res, { status: 400, code: ERROR_CODES.VALIDATION_ERROR, message: 'Email y password son requeridos', locale });
    }
    const token = await authService.login(email, password);
    if (!token) {
      const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
      return sendError(res, { status: 401, code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: 'Credenciales inválidas', locale });
    }
    return res.json(buildSessionFromToken(token));
  } catch (err) {
    safeErrorLog('LOGIN ERROR:', err, req);
    const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
    return sendError(res, { status: 401, code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: 'Credenciales inválidas', locale });
  }
});

router.get('/validate', auth, async (req, res) => {
  try {
    return res.json({ ok: true, ...buildSessionFromToken(req.token, req.tenant_service_status || null) });
  } catch (err) {
    safeErrorLog('VALIDATE ERROR:', err, req);
    const locale = resolveLocale(req); res.set('x-tcdx-locale', locale);
    return sendError(res, { status: 500, code: ERROR_CODES.SERVER_ERROR, message: 'Error validando sesión', locale });
  }
});

module.exports = router;
