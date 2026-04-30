const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

function getUserRole(req) {
  return String(
    req.user?.role ||
      req.user?.user_role ||
      req.user?.userRole ||
      ''
  ).toLowerCase();
}

function getUserTenantId(req) {
  return (
    req.user?.tenant_id ||
    req.user?.tenantId ||
    req.user?.tenant ||
    req.user?.company_id ||
    req.user?.companyId ||
    null
  );
}

const isSuperAdmin = (req) => {
  const role = getUserRole(req);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(role);
};

const isDealer = (req) => {
  return getUserRole(req) === 'dealer';
};

const isAdmin = (req) => {
  const role = getUserRole(req);

  return [
    'admin',
    'tenant_admin',
  ].includes(role);
};

const sanitizeUser = (row) => ({
  id: row.id,
  tenant_id: row.tenant_id,
  tenant_name: row.tenant_name || '',
  name: row.full_name || row.name || '',
  full_name: row.full_name || row.name || '',
  email: row.email,
  role: row.role,
  phone: row.phone || '',
  job_title: row.job_title || '',
  avatar: row.avatar || null,
  created_at: row.created_at
});

const allowedRolesForAdmin = [
  'admin',
  'auditor',
  'operativo',
  'viewer',
];

const allowedRolesForSuperAdmin = [
  'superadmin',
  'dealer',
  'admin',
  'auditor',
  'operativo',
  'viewer',
];

const canManageTenant = (req, tenantId) => {
  if (isSuperAdmin(req)) return true;

  const userTenantId = getUserTenantId(req);

  if (isAdmin(req) && userTenantId && String(userTenantId) === String(tenantId)) {
    return true;
  }

  return false;
};

// =============================
// LISTAR USUARIOS
// Superadmin: exige tenant_id por query para listar solo usuarios de esa empresa.
// Admin: siempre lista usuarios de su propio tenant.
// =============================
router.get('/', auth, async (req, res) => {
  try {
    let result;

    if (isSuperAdmin(req)) {
      const tenantId = String(req.query.tenant_id || '').trim();

      if (!tenantId) {
        return res.json([]);
      }

      result = await pool.query(
        `
        SELECT
          u.id,
          u.tenant_id,
          t.name AS tenant_name,
          u.full_name,
          u.name,
          u.email,
          u.role,
          u.phone,
          u.job_title,
          u.avatar,
          u.created_at
        FROM users u
        LEFT JOIN tenants t
          ON t.id = u.tenant_id
        WHERE u.tenant_id = $1::uuid
        ORDER BY u.created_at DESC
        `,
        [tenantId]
      );
    } else if (isAdmin(req)) {
      result = await pool.query(
        `
        SELECT
          u.id,
          u.tenant_id,
          t.name AS tenant_name,
          u.full_name,
          u.name,
          u.email,
          u.role,
          u.phone,
          u.job_title,
          u.avatar,
          u.created_at
        FROM users u
        LEFT JOIN tenants t
          ON t.id = u.tenant_id
        WHERE u.tenant_id = $1::uuid
        ORDER BY u.created_at DESC
        `,
        [getUserTenantId(req)]
      );
    } else {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(result.rows.map(sanitizeUser));
  } catch (err) {
    console.error('ERROR LIST USERS:', err);
    res.status(500).json({ error: 'Error listando usuarios' });
  }
});


// =============================
// CREAR USUARIO
// =============================
router.post('/', auth, async (req, res) => {
  try {
    const { tenant_id, name, password, email, role } = req.body;

    if (!tenant_id || !email || !password || !role) {
      return res.status(400).json({ error: 'tenant_id, email, password y role son obligatorios' });
    }

    if (!canManageTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para crear usuarios en esta empresa' });
    }

    const allowedRoles = isSuperAdmin(req)
      ? allowedRolesForSuperAdmin
      : allowedRolesForAdmin;

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }

    const exists = await pool.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (tenant_id, name, full_name, email, password_hash, role)
      VALUES ($1, $2, $2, $3, $4, $5)
      RETURNING
        id,
        tenant_id,
        full_name,
        name,
        email,
        role,
        phone,
        job_title,
        avatar,
        created_at
      `,
      [tenant_id, name || '', email, hashedPassword, role]
    );

    res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    console.error('ERROR CREATE USER:', err);
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// =============================
// EDITAR USUARIO
// =============================
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body;

    const current = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        full_name,
        name,
        email,
        role,
        phone,
        job_title,
        avatar,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userRow = current.rows[0];

    if (!canManageTenant(req, userRow.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para editar este usuario' });
    }

    if (!isSuperAdmin(req) && userRow.role === 'superadmin') {
      return res.status(403).json({ error: 'No puedes editar un superadmin' });
    }

    const allowedRoles = isSuperAdmin(req)
      ? allowedRolesForSuperAdmin
      : allowedRolesForAdmin;

    const nextRole = role ?? userRow.role;

    if (!allowedRoles.includes(nextRole)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }

    let hashedPassword = null;
    if (password && String(password).trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const nextName = name ?? userRow.full_name ?? userRow.name ?? '';

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        full_name = $1,
        role = $2,
        password_hash = COALESCE($3, password_hash)
      WHERE id = $4
      RETURNING
        id,
        tenant_id,
        full_name,
        name,
        email,
        role,
        phone,
        job_title,
        avatar,
        created_at
      `,
      [nextName, nextRole, hashedPassword, id]
    );

    res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    console.error('ERROR UPDATE USER:', err);
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

module.exports = router;
