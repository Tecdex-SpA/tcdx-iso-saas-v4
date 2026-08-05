'use strict';

const DEFAULT_WINDOW_MS = Math.max(
  1000,
  Number(process.env.AUTHENTICATED_RATE_LIMIT_WINDOW_MS || 60000)
);

const DEFAULT_POLICIES = Object.freeze({
  read: {
    name: 'authenticated_read',
    max: Math.max(1, Number(process.env.AUTHENTICATED_READ_RATE_LIMIT_MAX || 600)),
    windowMs: DEFAULT_WINDOW_MS,
  },
  write: {
    name: 'authenticated_write',
    max: Math.max(1, Number(process.env.AUTHENTICATED_WRITE_RATE_LIMIT_MAX || 180)),
    windowMs: DEFAULT_WINDOW_MS,
  },
  ai: {
    name: 'authenticated_ai',
    max: Math.max(1, Number(process.env.AUTHENTICATED_AI_RATE_LIMIT_MAX || 30)),
    windowMs: DEFAULT_WINDOW_MS,
  },
  report: {
    name: 'authenticated_report',
    max: Math.max(1, Number(process.env.AUTHENTICATED_REPORT_RATE_LIMIT_MAX || 10)),
    windowMs: Math.max(
      DEFAULT_WINDOW_MS,
      Number(process.env.AUTHENTICATED_REPORT_RATE_LIMIT_WINDOW_MS || 300000)
    ),
  },
});

const store = new Map();
const metrics = {
  allowed: new Map(),
  blocked: new Map(),
};

function sanitizeKeyPart(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9:._-]/g, '_')
    .slice(0, 180);
}

function getTenantId(req) {
  return req.user?.tenant_id || req.user?.tenantId || req.tenantId || 'platform';
}

function getUserId(req) {
  return req.user?.id || req.user?.user_id || req.user?.sub || req.user?.email || 'unknown-user';
}

function getRequestPath(req) {
  return String(req.originalUrl || req.url || req.path || '').split('?')[0];
}

function isHeavyReportOperation(method, path) {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;

  return (
    /^\/api\/reports\/generate(?:\/|$)/.test(path) ||
    /^\/api\/reports\/export(?:\/|$)/.test(path) ||
    /^\/api\/reports\/render(?:\/|$)/.test(path) ||
    /^\/api\/reports\/bulk-export(?:\/|$)/.test(path) ||
    /^\/api\/reports\/schedules\/[^/]+\/run(?:\/|$)/.test(path) ||
    /^\/api\/report-studio\/(?:generate|export|render)(?:\/|$)/.test(path)
  );
}

function classifyPolicy(req) {
  const path = getRequestPath(req).toLowerCase();
  const method = String(req.method || '').toUpperCase();

  if (
    path.startsWith('/api/ai') ||
    path.startsWith('/api/search') ||
    path.startsWith('/ai-feedback') ||
    path.startsWith('/ai-external-lookup')
  ) {
    return DEFAULT_POLICIES.ai;
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return DEFAULT_POLICIES.read;
  }

  if (isHeavyReportOperation(method, path)) {
    return DEFAULT_POLICIES.report;
  }

  return DEFAULT_POLICIES.write;
}

function incrementMetric(map, policyName) {
  map.set(policyName, (map.get(policyName) || 0) + 1);
}

function setRateLimitHeaders(res, policy, remaining, resetAt) {
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Limit', String(policy.max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  res.setHeader('X-RateLimit-Policy', policy.name);

  return retryAfterSeconds;
}

function authenticatedRateLimit(req, res, next) {
  const policy = classifyPolicy(req);
  const now = Date.now();
  const key = [policy.name, sanitizeKeyPart(getTenantId(req)), sanitizeKeyPart(getUserId(req))].join(':');

  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + policy.windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = policy.max - bucket.count;
  const retryAfterSeconds = setRateLimitHeaders(res, policy, remaining, bucket.resetAt);

  if (bucket.count > policy.max) {
    incrementMetric(metrics.blocked, policy.name);
    res.locals.errorCode = 'RATE_LIMITED';
    res.setHeader('Retry-After', String(retryAfterSeconds));

    return res.status(429).json({
      ok: false,
      error_code: 'RATE_LIMITED',
      code: 'RATE_LIMITED',
      message: 'Se alcanzó temporalmente el límite de solicitudes.',
      error: 'Se alcanzó temporalmente el límite de solicitudes.',
      retry_after_seconds: retryAfterSeconds,
      policy: policy.name,
      request_id: req.requestId || null,
    });
  }

  incrementMetric(metrics.allowed, policy.name);
  return next();
}

function cleanupExpiredBuckets() {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (!bucket || bucket.resetAt <= now) store.delete(key);
  }
}

const cleanupTimer = setInterval(cleanupExpiredBuckets, Math.max(DEFAULT_WINDOW_MS, 60000));
cleanupTimer.unref?.();

function prometheusLines() {
  const lines = [];
  for (const [policy, count] of metrics.allowed.entries()) {
    lines.push(`tcdx_rate_limit_allowed_total{policy="${sanitizeKeyPart(policy)}"} ${count}`);
  }
  for (const [policy, count] of metrics.blocked.entries()) {
    lines.push(`tcdx_rate_limit_blocked_total{policy="${sanitizeKeyPart(policy)}"} ${count}`);
  }
  return lines;
}

function resetForTests() {
  store.clear();
  metrics.allowed.clear();
  metrics.blocked.clear();
}

module.exports = {
  authenticatedRateLimit,
  classifyPolicy,
  prometheusLines,
  resetForTests,
  DEFAULT_POLICIES,
};
