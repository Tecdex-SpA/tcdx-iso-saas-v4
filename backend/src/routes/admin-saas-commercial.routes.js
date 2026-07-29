const express = require('express');
const router = express.Router();
const service = require('../services/commercial/commercialAdmin.service');
const pool = require('../config/db');

function userId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function roleOf(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').trim().toLowerCase();
}

function tenantOf(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null;
}

function isPlatform(user) {
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(roleOf(user));
}

async function assertTenantVisibility(req, tenantId) {
  if (isPlatform(req.user)) return true;
  if (roleOf(req.user) === 'dealer') {
    const result = await pool.query(
      'SELECT 1 FROM dealer_tenants WHERE dealer_user_id = $1::uuid AND tenant_id = $2::uuid AND status = $3 LIMIT 1',
      [userId(req.user), tenantId, 'active']
    ).catch(() => ({ rowCount: 0 }));
    if (result.rowCount === 1) return true;
    throw new service.CommercialError('TENANT_VISIBILITY_DENIED', 'No autorizado para ver este tenant.', 403);
  }
  if (String(tenantOf(req.user) || '') === String(tenantId)) return true;
  throw new service.CommercialError('TENANT_SCOPE_MISMATCH', 'El tenant solicitado no corresponde al usuario autenticado.', 403);
}

async function tenantRoute(req, action) {
  await assertTenantVisibility(req, req.params.tenantId);
  return action();
}

function sanitizeErrorMessage(error) {
  return String(error?.message || 'commercial admin error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function logicalRoute(req) {
  return `${req.method || 'UNKNOWN'} ${req.baseUrl || ''}${req.route?.path || req.path || ''}`;
}

function logCommercialError(req, status, error) {
  console.error(JSON.stringify({
    event: 'COMMERCIAL_ADMIN_ERROR',
    request_id: req.requestId || null,
    pg_code: typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null,
    operation: logicalRoute(req),
    route: logicalRoute(req),
    status,
    message: sanitizeErrorMessage(error),
  }));
}

function handleError(req, res, error) {
  const status = Number(error?.status || 500);
  res.locals = res.locals || {};
  res.locals.errorCode = error?.code || 'COMMERCIAL_ADMIN_ERROR';
  logCommercialError(req, status, error);
  return res.status(status).json({
    ok: false,
    code: error?.code || 'COMMERCIAL_ADMIN_ERROR',
    error: status >= 500 ? 'Error administrando dominio comercial.' : error.message,
    details: status >= 500 ? undefined : error.details,
    request_id: req.requestId || null,
  });
}

function route(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      return res.json({ ok: true, data, request_id: req.requestId || null });
    } catch (error) {
      return handleError(req, res, error);
    }
  };
}

router.get('/catalog', route(() => service.listCatalog()));
router.post('/catalog/items', route((req) => service.createCatalogItem({ body: req.body, user: req.user, requestId: req.requestId })));
router.get('/plans', route(() => service.listCatalog().then((catalog) => ({ plans: catalog.plans, versions: catalog.versions }))));
router.post('/plans/publish', route((req) => service.publishPlanVersion({ body: req.body, user: req.user, requestId: req.requestId })));
router.get('/packs', route(() => service.listCatalog().then((catalog) => ({ packs: catalog.packs }))));
router.get('/methodologies', route(() => service.listCatalog().then((catalog) => ({ methodologies: catalog.methodologies }))));
router.post('/methodologies', route((req) => service.upsertMethodology({ body: req.body, user: req.user, requestId: req.requestId })));
router.get('/workpapers', route(() => service.listCatalog().then((catalog) => ({ workpapers: catalog.workpapers }))));
router.post('/workpapers', route((req) => service.upsertWorkpaperTemplate({ body: req.body, user: req.user, requestId: req.requestId })));

router.get('/tenants/:tenantId/subscription', route((req) => tenantRoute(req, () => service.getTenantCommercialState(req.params.tenantId))));
router.get('/tenants/:tenantId/entitlements', route((req) => tenantRoute(req, () => service.getTenantCommercialState(req.params.tenantId))));
router.get('/tenants/:tenantId/limits', route((req) => tenantRoute(req, () => service.listTenantUsage(req.params.tenantId))));
router.put('/tenants/:tenantId/limits/:resourceKey', route((req) => tenantRoute(req, () => service.upsertTenantLimit({ tenantId: req.params.tenantId, body: { ...req.body, resource_key: req.params.resourceKey }, user: req.user, requestId: req.requestId }))));
router.get('/tenants/:tenantId/usage', route((req) => tenantRoute(req, () => service.listTenantUsage(req.params.tenantId))));
router.get('/tenants/:tenantId/health', route((req) => tenantRoute(req, () => service.calculateTenantHealth(req.params.tenantId))));
router.post('/tenants/:tenantId/change-preview', route((req) => tenantRoute(req, () => service.previewPlanChange({ tenantId: req.params.tenantId, body: req.body }))));
router.post('/tenants/:tenantId/change-plan', route((req) => tenantRoute(req, () => service.changePlan({ tenantId: req.params.tenantId, body: req.body, user: req.user, requestId: req.headers['idempotency-key'] || req.requestId }))));
router.post('/tenants/:tenantId/trials', route((req) => tenantRoute(req, () => service.startTrial({ tenantId: req.params.tenantId, body: req.body, user: req.user, requestId: req.requestId }))));
router.post('/tenants/:tenantId/overrides', route((req) => tenantRoute(req, () => service.applyOverride({ tenantId: req.params.tenantId, body: req.body, user: req.user, requestId: req.requestId }))));
router.post('/tenants/:tenantId/packs/:packKey/preview', route((req) => tenantRoute(req, () => service.previewPackInstall({ tenantId: req.params.tenantId, packKey: req.params.packKey }))));
router.post('/tenants/:tenantId/packs/:packKey/install', route((req) => tenantRoute(req, () => service.installPack({ tenantId: req.params.tenantId, packKey: req.params.packKey, user: req.user, requestId: req.headers['idempotency-key'] || req.requestId }))));
router.get('/history', route((req) => {
  const pool = require('../config/db');
  const params = [];
  let sql = 'SELECT * FROM commercial_events';
  if (req.query?.tenant_id) {
    params.push(req.query.tenant_id);
    sql += ' WHERE tenant_id = $1::uuid';
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  return pool.query(sql, params).then((result) => result.rows);
}));

module.exports = router;
