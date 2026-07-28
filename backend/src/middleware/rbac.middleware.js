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
const REPORT_READ_ROLES = [
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
  ...AREA_OWNER_ROLES,
  ...EXECUTIVE_ROLES,
];
const REPORT_GENERATE_ROLES = [
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
];
const TENANT_DASHBOARD_ROLES = ['admin', 'tenant_admin', ...AREA_OWNER_ROLES, ...EXECUTIVE_ROLES];
const IMPORT_READ_ROLES = [...TENANT_ADMIN_ROLES, 'auditor'];
const IMPORT_OPERATE_ROLES = [...TENANT_ADMIN_ROLES];

function roleIsPlatform(role) {
  return PLATFORM_ROLES.includes(role);
}

function deny(req, res, message = 'No autorizado para ejecutar esta acción') {
  res.locals = res.locals || {};
  res.locals.errorCode = 'RBAC_DENIED';
  return res.status(403).json({
    ok: false,
    code: 'RBAC_DENIED',
    error: message,
    request_id: req.requestId || null,
  });
}

function pathOf(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function starts(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function getReportPermission(req, path) {
  if (!starts(path, '/api/reports')) return null;

  const method = String(req.method || '').toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (starts(path, '/api/reports/download')) return 'download';
    if (starts(path, '/api/reports/jobs')) return 'generate';
    return 'read';
  }

  if (starts(path, '/api/reports/schedules')) return 'admin';
  return 'generate';
}

function roleCanUseReports(role, permission) {
  if (role === 'dealer') {
    // reports.routes.js valida asignacion tenant-dealer antes de operar.
    return ['read', 'download', 'generate', 'admin'].includes(permission);
  }

  if (permission === 'read' || permission === 'download') {
    return REPORT_READ_ROLES.includes(role);
  }

  if (permission === 'generate') {
    return REPORT_GENERATE_ROLES.includes(role);
  }

  return false;
}

const API_RULES = [
  // Importaciones: rutas explícitas; no agregar un prefijo amplio /api/imports.
  {
    method: 'GET',
    pattern: /^\/api\/imports\/definitions$/,
    permission: 'imports.read',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/definitions\/[^/]+$/,
    permission: 'imports.read',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/templates\/[^/]+\.xlsx$/,
    permission: 'imports.template.download',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/catalogs\/[^/]+\.xlsx$/,
    permission: 'imports.catalog.download',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'POST',
    pattern: /^\/api\/imports\/preview$/,
    permission: 'imports.preview',
    roles: IMPORT_OPERATE_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/history$/,
    permission: 'imports.history.read',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/[^/]+$/,
    permission: 'imports.read',
    roles: IMPORT_READ_ROLES,
  },
  {
    method: 'POST',
    pattern: /^\/api\/imports\/[^/]+\/confirm$/,
    permission: 'imports.confirm',
    roles: IMPORT_OPERATE_ROLES,
  },
  {
    method: 'POST',
    pattern: /^\/api\/imports\/[^/]+\/rollback$/,
    permission: 'imports.rollback',
    roles: IMPORT_OPERATE_ROLES,
  },
  {
    method: 'GET',
    pattern: /^\/api\/imports\/[^/]+\/errors\.xlsx$/,
    permission: 'imports.errors.download',
    roles: IMPORT_READ_ROLES,
  },

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
    prefix: '/api/knowledge-base',
    read: TENANT_READ_ROLES,
    write: [],
  },
  {
    prefix: '/api/intelligence',
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
    prefix: '/api/operational-risks',
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
    prefix: '/api/grc',
    read: TENANT_READ_ROLES,
    write: TENANT_OPERATE_ROLES,
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

function findRule(method, path) {
  return API_RULES.find(rule => (
    rule.pattern
      ? rule.method === method && rule.pattern.test(path)
      : starts(path, rule.prefix)
  )) || null;
}

function enforceApiAccess(req, res, next) {
  const role = getUserRole(req);
  const path = pathOf(req);
  const method = String(req.method || '').toUpperCase();
  const read = isReadMethod(req);

  if (!role) {
    return deny(req, res, 'Usuario sin rol válido');
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

  const reportPermission = getReportPermission(req, path);
  if (reportPermission) {
    if (roleCanUseReports(role, reportPermission)) {
      return next();
    }

    return deny(req, res, `Permiso reports:${reportPermission} requerido`);
  }

  if (role === 'dealer') {
    const dealerAllowed =
      starts(path, '/api/me') ||
      starts(path, '/api/quotes') ||
      (starts(path, '/api/admin-saas/dealer') && read) ||
      starts(path, '/api/billing');

    if (dealerAllowed) return next();

    return deny(req, res, 'Rol dealer no autorizado para esta sección');
  }

  const rule = findRule(method, path);

  if (!rule) {
    return deny(req, res, 'Ruta API sin regla RBAC explícita');
  }

  const allowedRoles = rule.roles || (read ? rule.read : rule.write);

  if (allowedRoles.includes(role)) {
    return next();
  }

  return deny(
    req,
    res,
    rule.permission ? `Permiso ${rule.permission} requerido` : undefined
  );
}

module.exports = {
  enforceApiAccess,
};
