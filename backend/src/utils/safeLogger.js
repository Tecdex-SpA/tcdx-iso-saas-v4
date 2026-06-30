function safeErrorFields(error) {
  if (!error || typeof error !== 'object') {
    return { message: String(error || 'Unknown error') };
  }

  return {
    name: error.name || null,
    code: error.code || null,
    status: error.status || error.statusCode || null,
    message: error.message || 'Unknown error',
    detail: error.detail || null,
    constraint: error.constraint || null,
    table: error.table || null,
    column: error.column || null,
  };
}

function requestContext(req) {
  if (!req) return {};

  return {
    request_id: req.requestId || null,
    method: req.method || null,
    path: req.originalUrl || req.path || null,
    user_id: req.user?.user_id || req.user?.userId || req.user?.id || null,
    tenant_id:
      req.user?.tenant_id ||
      req.user?.tenantId ||
      req.user?.tenant ||
      req.user?.company_id ||
      req.user?.companyId ||
      null,
  };
}

function safeErrorLog(label, error, req) {
  console.error(label, {
    ...requestContext(req),
    ...safeErrorFields(error),
  });
}

function safeWarnLog(label, error, req) {
  console.warn(label, {
    ...requestContext(req),
    ...safeErrorFields(error),
  });
}

module.exports = {
  safeErrorFields,
  safeErrorLog,
  safeWarnLog,
};
