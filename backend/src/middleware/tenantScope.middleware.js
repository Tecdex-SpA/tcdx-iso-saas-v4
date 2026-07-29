function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(role));
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

function cleanTenantId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').trim();
}

function compactTenantIds(values) {
  return Array.from(new Set(
    values
      .map(cleanTenantId)
      .filter(Boolean)
  ));
}

function getBodyTenantIds(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];

  return compactTenantIds([
    body.tenant_id,
    body.tenantId,
    body.company_id,
    body.companyId,
    body?.context?.tenant_id,
    body?.context?.tenantId,
    body?.tenant?.id,
    body?.payload?.tenant_id,
    body?.payload?.tenantId,
    body?.filters?.tenant_id,
    body?.filters?.tenantId,
  ]);
}

function getQueryTenantIds(query) {
  if (!query || typeof query !== 'object') return [];

  return compactTenantIds([
    query.tenant_id,
    query.tenantId,
    query.company_id,
    query.companyId,
    query?.context_tenant_id,
    query?.filters?.tenant_id,
    query?.filters?.tenantId,
  ]);
}

function methodMatches(method, methods) {
  if (!methods || methods.length === 0) return true;
  return methods.includes(String(method || '').toUpperCase());
}

const PATH_TENANT_PATTERNS = [
  { pattern: /^\/api\/dashboard\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/dashboard-controls\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/objectives\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/controls\/(?:workbench|catalog|catalog-mode)\/([^/?]+)(?:\/[^/?]+)?\/?$/i },
  { pattern: /^\/api\/controls\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/evidences\/jobs\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/evidences\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/findings\/controls\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/findings\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/nonconformities\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/action-plans\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/audits\/(?:summary|next-all|next)\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/audits\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/ai-auditor\/runs\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/assets\/risk-summary\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/assets\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/tenant-standards\/(?:operations|scope)\/([^/?]+)(?:\/[^/?]+)?\/?$/i },
  { pattern: /^\/api\/tenant-standards\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/policy\/([^/?]+)(?:\/[^/?]+)?\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/soa\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/(?:kpi|kpis)\/(?:recalculate|dashboard|effective-health-summary|catalog|admin)\/([^/?]+)\/?$/i },
  { pattern: /^\/api\/search\/(?:global|history)\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/intelligence\/brief\/([^/?]+)\/?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/files\/tenant\/([^/?]+)(?:\/.*)?$/i, methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/iso-risk-matrix\/([^/?]+)(?:\/.*)?$/i },
  { pattern: /^\/api\/billing\/preinvoice\/([^/?]+)(?:\/materialize)?\/?$/i },
  { pattern: /^\/api\/lifecycle\/(?:rebuild|board|summary|insights|ai-context|ai-feed|history)\/([^/?]+)\/?$/i },
];

function getPathTenantIds(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const method = req.method;
  const ids = [];

  const patterns = [
    ...PATH_TENANT_PATTERNS,
  ];

  for (const { pattern, methods } of patterns) {
    if (!methodMatches(method, methods)) continue;

    const match = path.match(pattern);
    if (match?.[1]) return compactTenantIds([decodeURIComponent(match[1])]);
  }

  const params = req.params || {};
  ids.push(
    params.tenant_id,
    params.tenantId,
    params.company_id,
    params.companyId
  );

  return compactTenantIds(ids);
}

function getRequestedTenantIds(req) {
  return compactTenantIds([
    req.headers?.['x-tenant-id'],
    req.headers?.['x-tenant'],
    ...getPathTenantIds(req),
    ...getQueryTenantIds(req.query),
    ...getBodyTenantIds(req.body),
  ]);
}

function enforceTenantRequestScope(req, res, next) {
  const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);

  if (!role || isPlatformRole(role)) {
    return next();
  }

  // Dealer scope is handled by dealer-specific routes because assignment data is not present in JWT.
  if (isDealerRole(role)) {
    return next();
  }

  const userTenantId = cleanTenantId(getUserTenantId(req.user));
  const requestedTenantIds = getRequestedTenantIds(req);

  if (requestedTenantIds.length === 0) {
    return next();
  }

  if (!userTenantId) {
    return res.status(403).json({
      ok: false,
      code: 'TENANT_SCOPE_REQUIRED',
      error: 'El usuario no tiene tenant asociado para esta operación.',
      request_id: req.requestId || null,
    });
  }

  const hasMismatch = requestedTenantIds.some(
    (requestedTenantId) => String(requestedTenantId) !== String(userTenantId)
  );

  if (hasMismatch) {
    return res.status(403).json({
      ok: false,
      code: 'TENANT_SCOPE_MISMATCH',
      error: 'El tenant solicitado no corresponde al tenant autenticado.',
      request_id: req.requestId || null,
    });
  }

  req.resolvedTenantId = userTenantId;
  return next();
}

module.exports = {
  enforceTenantRequestScope,
  getRequestedTenantIds,
};
