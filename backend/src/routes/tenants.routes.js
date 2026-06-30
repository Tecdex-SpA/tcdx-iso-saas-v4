const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const fs = require('fs');
const path = require('path');
const {
  IMAGE_MIME_TYPES,
  createDiskUpload,
  safeUploadError,
} = require('../utils/secureUpload');
const { safeErrorLog } = require('../utils/safeLogger');

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
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

function isPlatform(user) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(user));
}

const logoUploadDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
fs.mkdirSync(logoUploadDir, { recursive: true });

const upload = createDiskUpload({
  destination: logoUploadDir,
  allowedTypes: IMAGE_MIME_TYPES,
  fileSize: 5 * 1024 * 1024,
  files: 1,
  fields: 20,
  code: 'TENANT_LOGO_TYPE_NOT_ALLOWED',
  message: 'Selecciona una imagen válida para el logo',
});

function tenantLogoUpload(req, res, next) {
  upload.single('logo')(req, res, (error) => {
    if (!error) return next();

    const payload = safeUploadError(error, {
      code: 'TENANT_LOGO_UPLOAD_ERROR',
      sizeCode: 'TENANT_LOGO_TOO_LARGE',
      sizeMessage: 'El logo no debe superar 5 MB',
      message: 'Selecciona una imagen válida para el logo',
    });
    return res.status(payload.status).json({ error: payload.error, code: payload.code });
  });
}

function buildTenantLogoPublicUrl(tenant) {
  if (!tenant) return null;

  const logoUrl = String(tenant.logo_url || '').trim();
  if (logoUrl) return logoUrl;

  const logo = String(tenant.logo || '').trim();
  if (logo) return `/uploads/logos/${logo}`;

  return null;
}

function decorateTenantLogo(tenant) {
  if (!tenant) return tenant;

  return {
    ...tenant,
    logo_public_url: buildTenantLogoPublicUrl(tenant),
  };
}



// =============================
// LISTAR
// =============================
router.get('/', auth, async (req, res) => {
  try {
    if (!isPlatform(req.user)) {
      const tenantId = getUserTenantId(req.user);

      if (!tenantId) {
        return res.status(403).json({ error: 'No autorizado para listar empresas' });
      }

      const currentTenant = await pool.query(
        `SELECT * FROM tenants WHERE id = $1::uuid LIMIT 1`,
        [tenantId]
      );

      return res.json(currentTenant.rows.map(decorateTenantLogo));
    }

    const result = await pool.query(`SELECT * FROM tenants ORDER BY name`);
    res.json(result.rows.map(decorateTenantLogo));
  } catch (err) {
    safeErrorLog('ERROR GET TENANTS:', err, req);
    res.status(500).json({ error: 'Error obteniendo empresas' });
  }
});


// =============================
// GET POR ID (FIX ADMIN)
// =============================
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isPlatform(req.user) && String(getUserTenantId(req.user)) !== String(req.params.id)) {
      return res.status(403).json({ error: 'No autorizado para esta empresa' });
    }

    const result = await pool.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [req.params.id]
    );

    res.json(decorateTenantLogo(result.rows[0] || null));

  } catch (err) {
    safeErrorLog('ERROR GET TENANT:', err, req);
    res.status(500).json({ error: 'Error obteniendo empresa' });
  }
});


// =============================
// CREAR
// =============================
router.post('/', auth, tenantLogoUpload, async (req, res) => {
  try {
    const { name, rut, address, business, branches } = req.body;

    if (!name || !rut) {
      return res.status(400).json({ error: 'Nombre y RUT obligatorios' });
    }

    const result = await pool.query(
      `
      INSERT INTO tenants (name, rut, address, business, branches, logo)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        name,
        rut,
        address || '',
        business || '',
        branches || '',
        req.file ? req.file.filename : null
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    safeErrorLog('TENANT ERROR:', err, req);
    res.status(500).json({ error: 'Error creando empresa' });
  }
});

module.exports = router;
