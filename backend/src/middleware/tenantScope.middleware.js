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

function getBodyTenantId(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '';

  return cleanTenantId(
    body.tenant_id ||
      body.tenantId ||
      body.company_id ||
      body.companyId ||
      body?.context?.tenant_id ||
      body?.context?.tenantId ||
      body?.tenant?.id
  );
}

function getQueryTenantId(query) {
  if (!query || typeof query !== 'object') return '';

  return cleanTenantId(
    query.tenant_id ||
      query.tenantId ||
      query.company_id ||
      query.companyId ||
      query?.context_tenant_id
  );
}

function getPathTenantId(path) {
  const patterns = [
    /^\/api\/tenant-standards\/scope\/([^/?]+)/,
    /^\/api\/lifecycle\/(?:rebuild|board|summary|insights|ai-context|ai-feed|history)\/([^/?]+)/,
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match?.[1]) return cleanTenantId(decodeURIComponent(match[1]));
  }

  return '';
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
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const requestedTenantId =
    getPathTenantId(path) ||
    getQueryTenantId(req.query) ||
    getBodyTenantId(req.body);

  if (!requestedTenantId) {
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

  if (String(requestedTenantId) !== String(userTenantId)) {
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
};
