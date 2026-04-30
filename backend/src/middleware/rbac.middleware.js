function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function getUserRole(req) {
  return normalizeRole(
    req.user?.role ||
      req.user?.user_role ||
      req.user?.userRole ||
      ''
  );
}

function isReadMethod(req) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase());
}

const PLATFORM_ROLES = [
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
];

const TENANT_READ_ROLES = ['admin', 'tenant_admin', 'auditor', 'operativo', 'viewer'];
const TENANT_OPERATE_ROLES = ['admin', 'tenant_admin', 'auditor', 'operativo'];
const TENANT_ADMIN_ROLES = ['admin', 'tenant_admin'];

function roleIsPlatform(role) {
  return PLATFORM_ROLES.includes(role);
}

function deny(res, message = 'No autorizado para ejecutar esta acción') {
  return res.status(403).json({
    ok: false,
    code: 'RBAC_DENIED',
    error: message,
  });
}

function pathOf(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function starts(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const API_RULES = [
  // Perfil / contexto / módulos
  {
    prefix: '/api/me',
    read: [...TENANT_READ_ROLES, 'dealer'],
    write: [...TENANT_READ_ROLES, 'dealer'],
  },
  {
    prefix: '/api/user',
    read: TENANT_READ_ROLES,
    write: TENANT_READ_ROLES,
  },
  {
    prefix: '/api/tenant-standards',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },

  // Dashboard y lectura ejecutiva
  {
    prefix: '/api/dashboard',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/dashboard-controls',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/kpis/dashboard',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/kpi/dashboard',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },

  // KPI: dashboard sí para viewer; administración/recalcular/manual solo admin
  {
    prefix: '/api/kpis',
    read: TENANT_ADMIN_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/kpi',
    read: TENANT_ADMIN_ROLES,
    write: TENANT_ADMIN_ROLES,
  },

  // Ciclo de vida: viewer solo lectura del board; no mueve tarjetas
  {
    prefix: '/api/lifecycle/board',
    read: TENANT_READ_ROLES,
    write: TENANT_OPERATE_ROLES,
  },
  {
    prefix: '/api/lifecycle',
    read: TENANT_READ_ROLES,
    write: TENANT_OPERATE_ROLES,
  },

  // Objetivos: viewer no entra
  {
    prefix: '/api/objectives',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'operativo'],
  },

  // Salud ISO: viewer puede leer, no recalcular ni generar acciones
  {
    prefix: '/health',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // Reportes: viewer puede ver/descargar lo disponible, no administrar/generar si es POST
  {
    prefix: '/api/reports',
    read: [...TENANT_READ_ROLES, 'dealer'],
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // Usuarios / SaaS / plataforma
  {
    prefix: '/api/users',
    read: TENANT_ADMIN_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/admin-saas',
    read: [],
    write: [],
  },
  {
    prefix: '/api/tenants',
    read: [],
    write: [],
  },
  {
    prefix: '/api/tenant',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },

  // Operación
  {
    prefix: '/api/controls',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/diagnostic',
    read: TENANT_OPERATE_ROLES,
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/assets',
    read: TENANT_OPERATE_ROLES,
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/soa',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/action-plans',
    read: TENANT_OPERATE_ROLES,
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/evidences',
    read: TENANT_OPERATE_ROLES,
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/findings',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_OPERATE_ROLES,
  },
  {
    prefix: '/api/nonconformities',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_OPERATE_ROLES,
  },

  // Auditorías
  {
    prefix: '/api/audits',
    read: ['admin', 'tenant_admin', 'auditor'],
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // IA
  {
    prefix: '/api/ai-compliance',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/ai',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'operativo'],
  },

  // Búsqueda / notificaciones
  {
    prefix: '/api/search',
    read: TENANT_READ_ROLES,
    write: TENANT_READ_ROLES,
  },
  {
    prefix: '/api/notifications',
    read: TENANT_READ_ROLES,
    write: TENANT_READ_ROLES,
  },

  // Dealer
  {
    prefix: '/api/quotes',
    read: ['dealer'],
    write: ['dealer'],
  },
];

function findRule(path) {
  return API_RULES.find((rule) => starts(path, rule.prefix)) || null;
}

function enforceApiAccess(req, res, next) {
  const role = getUserRole(req);
  const path = pathOf(req);
  const read = isReadMethod(req);

  if (!role) {
    return deny(res, 'Usuario sin rol válido');
  }

  if (roleIsPlatform(role)) {
    return next();
  }

  if (path.startsWith('/api/auth')) {
    return next();
  }

  if (role === 'dealer') {
    const dealerAllowed =
      starts(path, '/api/me') ||
      starts(path, '/api/quotes') ||
      (starts(path, '/api/reports') && read);

    if (dealerAllowed) return next();

    return deny(res, 'Rol dealer no autorizado para esta sección');
  }

  const rule = findRule(path);

  if (!rule) {
    if (role === 'viewer') {
      return deny(res, 'Rol viewer solo tiene acceso de lectura ejecutiva');
    }

    return next();
  }

  const allowedRoles = read ? rule.read : rule.write;

  if (allowedRoles.includes(role)) {
    return next();
  }

  return deny(res);
}

module.exports = {
  enforceApiAccess,
};
