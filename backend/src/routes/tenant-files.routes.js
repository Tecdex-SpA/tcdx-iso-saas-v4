const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const TENANT_UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads', 'tenants');

function getUserRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').trim().toLowerCase();
}

function isPlatformUser(user) {
  return PLATFORM_ROLES.has(getUserRole(user));
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function getRequestedRelativePath(req) {
  const splat = req.params.filePath;
  const raw = Array.isArray(splat) ? splat.join('/') : String(splat || '');
  return raw.replace(/\\/g, '/').replace(/^\/+/, '');
}

async function safeResolveTenantFile(tenantId, relativePath) {
  if (!isUuid(tenantId)) {
    const err = new Error('tenantId inválido');
    err.statusCode = 400;
    err.code = 'INVALID_TENANT_ID';
    throw err;
  }

  if (!relativePath || relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    const err = new Error('Ruta de archivo inválida');
    err.statusCode = 400;
    err.code = 'INVALID_FILE_PATH';
    throw err;
  }

  const normalized = path.posix.normalize(relativePath);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    const err = new Error('Ruta de archivo inválida');
    err.statusCode = 400;
    err.code = 'INVALID_FILE_PATH';
    throw err;
  }

  const tenantRoot = path.resolve(TENANT_UPLOADS_ROOT, tenantId);
  const absolutePath = path.resolve(tenantRoot, normalized);
  const rootWithSep = `${tenantRoot}${path.sep}`;

  if (absolutePath !== tenantRoot && !absolutePath.startsWith(rootWithSep)) {
    const err = new Error('Ruta fuera del directorio permitido');
    err.statusCode = 403;
    err.code = 'PATH_TRAVERSAL_BLOCKED';
    throw err;
  }

  const [realRoot, realFile] = await Promise.all([
    fs.promises.realpath(tenantRoot).catch(() => null),
    fs.promises.realpath(absolutePath).catch(() => null),
  ]);

  if (!realRoot || !realFile) {
    const err = new Error('Archivo no encontrado');
    err.statusCode = 404;
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }

  const realRootWithSep = `${realRoot}${path.sep}`;
  if (realFile !== realRoot && !realFile.startsWith(realRootWithSep)) {
    const err = new Error('Ruta fuera del directorio permitido');
    err.statusCode = 403;
    err.code = 'PATH_TRAVERSAL_BLOCKED';
    throw err;
  }

  const stat = await fs.promises.stat(realFile);
  if (!stat.isFile()) {
    const err = new Error('Archivo no encontrado');
    err.statusCode = 404;
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }

  return realFile;
}

router.get('/:tenantId/*filePath', async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const tokenTenantId = getUserTenantId(req.user);

    if (!isPlatformUser(req.user) && String(tokenTenantId || '') !== tenantId) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para descargar archivos de este tenant',
      });
    }

    const relativePath = getRequestedRelativePath(req);
    const filePath = await safeResolveTenantFile(tenantId, relativePath);
    const fileName = path.basename(filePath).replace(/[\r\n"]/g, '_');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, fileName);
  } catch (error) {
    const status = Number(error.statusCode || error.status || 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return res.status(safeStatus).json({
      ok: false,
      code: error.code || 'TENANT_FILE_DOWNLOAD_ERROR',
      error: safeStatus === 500 ? 'Error descargando archivo' : error.message,
    });
  }
});

module.exports = router;
