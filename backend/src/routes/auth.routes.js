const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const auth = require('../middleware/auth');
const authService = require('../services/auth.service');

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getHomePathByRole(role) {
  const normalizedRole = normalizeRole(role);

  if (
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin' ||
    normalizedRole === 'owner'
  ) {
    return '/admin-saas';
  }

  if (normalizedRole === 'dealer') {
    return '/dealer';
  }

  return '/dashboard';
}

function buildSessionFromToken(token) {
  const payload = jwt.decode(token) || {};

  const role =
    payload?.role ||
    payload?.user_role ||
    payload?.userRole ||
    '';

  return {
    token,
    user: {
      id: payload?.user_id || payload?.userId || payload?.id || null,
      tenant_id:
        payload?.tenant_id ||
        payload?.tenantId ||
        payload?.tenant ||
        payload?.company_id ||
        payload?.companyId ||
        null,
      email: payload?.email || null,
      role,
    },
    home_path: getHomePathByRole(role),
    expires_at: payload?.exp
      ? new Date(Number(payload.exp) * 1000).toISOString()
      : null,
  };
}

// =============================
// 📝 REGISTRO
// =============================
router.post('/register', async (req, res) => {
  try {
    if (process.env.ENABLE_PUBLIC_REGISTER !== 'true') {
      return res.status(403).json({
        error: 'Registro público deshabilitado',
        code: 'PUBLIC_REGISTER_DISABLED',
      });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const tenant = req.body?.tenant || null;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const user = await authService.register(email, password, tenant);

    return res.json(user);
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    return res.status(500).json({ error: 'Error registrando usuario' });
  }
});

// =============================
// 🔐 LOGIN
// =============================
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const token = await authService.login(email, password);

    if (!token) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    return res.json(buildSessionFromToken(token));
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// =============================
// ✅ VALIDAR SESIÓN
// =============================
router.get('/validate', auth, async (req, res) => {
  try {
    const token = req.token;
    return res.json({
      ok: true,
      ...buildSessionFromToken(token),
    });
  } catch (err) {
    console.error('VALIDATE ERROR:', err);
    return res.status(500).json({ error: 'Error validando sesión' });
  }
});

module.exports = router;
