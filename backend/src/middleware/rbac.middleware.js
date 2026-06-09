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

const EXECUTIVE_ROLES = ['viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo'];
const AREA_OWNER_ROLES = ['operativo', 'responsable_area', 'area_owner'];
const TENANT_READ_ROLES = ['admin', 'tenant_admin', 'auditor', ...AREA_OWNER_ROLES, ...EXECUTIVE_ROLES];
const TENANT_OPERATE_ROLES = ['admin', 'tenant_admin', 'auditor', ...AREA_OWNER_ROLES];
const TENANT_ADMIN_ROLES = ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin'];
const TENANT_AREA_WRITE_ROLES = ['admin', 'tenant_admin', ...AREA_OWNER_ROLES];
const TENANT_AUDIT_WRITE_ROLES = ['admin', 'tenant_admin', 'auditor'];
const TENANT_REPORT_ROLES = ['admin', 'tenant_admin', 'auditor', ...EXECUTIVE_ROLES];
const TENANT_DASHBOARD_ROLES = ['admin', 'tenant_admin', ...AREA_OWNER_ROLES, ...EXECUTIVE_ROLES];

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
    prefix: '/api/company-profile',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/tenant-standards',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/tenant-processes',
    read: TENANT_ADMIN_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/tenant-operations',
    read: TENANT_ADMIN_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/tenant-process-links',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/iso-knowledge',
    read: TENANT_READ_ROLES,
    write: [],
  },
  {
    prefix: '/api/iso-control-mapping',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/iso-express-diagnostic',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/iso-document-generator',
    read: TENANT_READ_ROLES,
    write: TENANT_OPERATE_ROLES,
  },
  {
    prefix: '/api/iso-risk-matrix',
    read: TENANT_READ_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/iso-operational-execution',
    read: TENANT_READ_ROLES,
    write: TENANT_OPERATE_ROLES,
  },
  {
    prefix: '/api/iso-recommended-actions',
    read: TENANT_READ_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/iso-command-center',
    read: TENANT_READ_ROLES,
    write: [],
  },
  {
    prefix: '/api/iso-auditor',
    read: TENANT_READ_ROLES,
    write: [],
  },

  // Dashboard y lectura ejecutiva
  {
    prefix: '/api/dashboard',
    read: TENANT_DASHBOARD_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/dashboard-v2/preferences',
    read: TENANT_DASHBOARD_ROLES,
    write: TENANT_DASHBOARD_ROLES,
  },
  {
    prefix: '/api/dashboard-v2',
    read: TENANT_DASHBOARD_ROLES,
    write: [],
  },
  {
    prefix: '/api/dashboard-controls',
    read: TENANT_DASHBOARD_ROLES,
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
    write: TENANT_AUDIT_WRITE_ROLES,
  },
  {
    prefix: '/api/lifecycle',
    read: TENANT_READ_ROLES,
    write: TENANT_AUDIT_WRITE_ROLES,
  },

  // Objetivos: viewer no entra
  {
    prefix: '/api/objectives',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'operativo'],
  },

  // Salud ISO: viewer puede leer, no recalcular ni generar acciones
  {
    prefix: '/api/health',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },
  {
    prefix: '/health',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // Reportes: viewer puede ver/descargar lo disponible, no administrar/generar si es POST
  {
    prefix: '/api/reports',
    read: [...TENANT_REPORT_ROLES, 'dealer'],
    write: [...TENANT_REPORT_ROLES, 'dealer'],
  },
  {
    prefix: '/api/iso-scope',
    read: [...TENANT_READ_ROLES, 'admin_cumplimiento', 'compliance_admin'],
    write: [...TENANT_READ_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/files/tenant',
    read: TENANT_READ_ROLES,
    write: [],
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
    read: TENANT_READ_ROLES,
    write: ['superadmin', 'platform_admin', 'admin_global', 'global_admin'],
  },

  // Operación
  {
    prefix: '/api/controls',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/diagnostic/recommendations',
    read: TENANT_READ_ROLES,
    write: [...TENANT_OPERATE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostics/recommendations',
    read: TENANT_READ_ROLES,
    write: [...TENANT_OPERATE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostic/ai-contextual-recommendations',
    read: TENANT_READ_ROLES,
    write: [...TENANT_OPERATE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostics/ai-contextual-recommendations',
    read: TENANT_READ_ROLES,
    write: [...TENANT_OPERATE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostic/suggestions/accept-gap',
    read: TENANT_READ_ROLES,
    write: [...TENANT_AUDIT_WRITE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostics/suggestions/accept-gap',
    read: TENANT_READ_ROLES,
    write: [...TENANT_AUDIT_WRITE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostic/suggestions/accept-action',
    read: TENANT_READ_ROLES,
    write: [...TENANT_AREA_WRITE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostics/suggestions/accept-action',
    read: TENANT_READ_ROLES,
    write: [...TENANT_AREA_WRITE_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/diagnostic',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/diagnostics',
    read: TENANT_READ_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/policy',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/assets',
    read: TENANT_READ_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/soa',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_ADMIN_ROLES,
  },
  {
    prefix: '/api/action-plans',
    read: TENANT_READ_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/evidences',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/evidence-library',
    read: ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'auditor', ...AREA_OWNER_ROLES],
    write: ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin'],
  },
  {
    prefix: '/api/document-integrations',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_AREA_WRITE_ROLES,
  },
  {
    prefix: '/api/findings',
    read: TENANT_READ_ROLES,
    write: TENANT_AUDIT_WRITE_ROLES,
  },
  {
    prefix: '/api/nonconformities',
    read: TENANT_OPERATE_ROLES,
    write: TENANT_AUDIT_WRITE_ROLES,
  },

  // Auditoría operativa / checklist / IA Auditor
  {
    prefix: '/api/audit-execution',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },
  {
    prefix: '/api/audit-preparation',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },
  {
    prefix: '/api/ai-auditor',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // Prefacturación SaaS
  {
    prefix: '/api/billing',
    read: ['dealer'],
    write: ['dealer'],
  },

  // Auditorías
  {
    prefix: '/api/audits',
    read: TENANT_READ_ROLES,
    write: ['admin', 'tenant_admin', 'auditor'],
  },

  // IA
  {
    prefix: '/api/ai-compliance/knowledge',
    read: [],
    write: [],
  },
  {
    prefix: '/api/ai-compliance/benchmark',
    read: [],
    write: [],
  },
  {
    prefix: '/api/ai-compliance/tenant-search',
    read: ['admin', 'tenant_admin', 'auditor'],
    write: ['admin', 'tenant_admin', 'auditor'],
  },
  {
    prefix: '/api/ai-compliance',
    read: ['admin', 'tenant_admin', 'auditor'],
    write: ['admin', 'tenant_admin', 'auditor'],
  },
  {
    prefix: '/api/ai-feedback',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'auditor', 'operativo'],
  },
  {
    prefix: '/api/ai-external-lookup',
    read: [],
    write: [],
  },
  {
    prefix: '/ai-feedback',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'auditor', 'operativo'],
  },
  {
    prefix: '/ai-external-lookup',
    read: [],
    write: [],
  },
  {
    prefix: '/api/ai',
    read: ['admin', 'tenant_admin', 'auditor', 'operativo'],
    write: ['admin', 'tenant_admin', 'operativo'],
  },
  {
    prefix: '/api/ai-traces',
    read: [],
    write: [],
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

  if (
    role === 'internal_ai' &&
    path === '/api/ai-compliance/knowledge/internal-search'
  ) {
    return next();
  }

  if (path.startsWith('/api/auth')) {
    return next();
  }

  if (role === 'dealer') {
    const dealerAllowed =
      starts(path, '/api/me') ||
      starts(path, '/api/quotes') ||
      (starts(path, '/api/admin-saas/dealer') && read) ||
      (starts(path, '/api/reports') && read) ||
      starts(path, '/api/billing');

    if (dealerAllowed) return next();

    return deny(res, 'Rol dealer no autorizado para esta sección');
  }

  const rule = findRule(path);

  if (!rule) {
    return deny(res, 'Ruta API sin regla RBAC explícita');
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
