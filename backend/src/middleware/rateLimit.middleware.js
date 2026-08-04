const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function positiveNumber(value, fallback, minimum = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

const DEFAULT_WINDOW_MS = positiveNumber(process.env.SECURITY_RATE_LIMIT_WINDOW_MS, 60000, 1000);
const POLICY_CONFIG = Object.freeze({
  public: {
    name: 'public',
    max: positiveNumber(process.env.PUBLIC_RATE_LIMIT_MAX, 240),
    windowMs: DEFAULT_WINDOW_MS,
  },
  login: {
    name: 'login',
    max: positiveNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
    windowMs: positiveNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 1000),
  },
  authenticated_read: {
    name: 'authenticated_read',
    max: positiveNumber(process.env.AUTHENTICATED_READ_RATE_LIMIT_MAX, 600),
    windowMs: DEFAULT_WINDOW_MS,
  },
  authenticated_write: {
    name: 'authenticated_write',
    max: positiveNumber(process.env.AUTHENTICATED_WRITE_RATE_LIMIT_MAX, 180),
    windowMs: DEFAULT_WINDOW_MS,
  },
  ai: {
    name: 'ai',
    max: positiveNumber(process.env.AI_RATE_LIMIT_MAX, 30),
    windowMs: DEFAULT_WINDOW_MS,
  },
  heavy_report: {
    name: 'heavy_report',
    max: positiveNumber(process.env.REPORT_RATE_LIMIT_MAX, 10),
    windowMs: positiveNumber(process.env.REPORT_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000, 1000),
  },
});

function sanitizeKeyPart(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9:._@-]/g, '_').slice(0, 180);
}

function getClientIp(req) {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
}

function getLoginIdentity(req) {
  const email = req.body && typeof req.body.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : 'unknown';
  return `${getClientIp(req)}:${email}`;
}

function getAuthenticatedIdentity(req) {
  const tenantId = req.user?.tenant_id || req.user?.tenantId || req.tenantId || 'unknown-tenant';
  const userId = req.user?.id || req.user?.user_id || req.user?.userId || 'unknown-user';
  return `${tenantId}:${userId}`;
}

function classifyAuthenticatedPolicy(req) {
  const path = String(req.path || req.originalUrl || '').toLowerCase();
  if (
    path.startsWith('/api/ai') ||
    path.startsWith('/api/search') ||
    path.startsWith('/ai-feedback') ||
    path.startsWith('/ai-external-lookup')
  ) {
    return 'ai';
  }
  if (
    path.includes('/report') ||
    path.includes('/export') ||
    path.includes('/import')
  ) {
    return 'heavy_report';
  }
  return SAFE_METHODS.has(String(req.method || 'GET').toUpperCase())
    ? 'authenticated_read'
    : 'authenticated_write';
}

function setHeaders(res, policy, remaining, resetAt) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  res.setHeader('X-RateLimit-Limit', String(policy.max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  res.setHeader('X-RateLimit-Policy', policy.name);
  return retryAfterSeconds;
}

function createRateLimitController({ store = new Map(), now = () => Date.now() } = {}) {
  function consume({ req, res, next, policyName, identity }) {
    const policy = POLICY_CONFIG[policyName];
    if (!policy) return next();

    const currentTime = now();
    const key = `${policy.name}:${sanitizeKeyPart(identity)}`;
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { count: 0, resetAt: currentTime + policy.windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = policy.max - bucket.count;
    const retryAfterSeconds = setHeaders(res, policy, remaining, bucket.resetAt);

    if (bucket.count > policy.max) {
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

    return next();
  }

  function publicLimiter(req, res, next) {
    const policyName = req.path === '/api/auth/login' ? 'login' : 'public';
    const identity = policyName === 'login' ? getLoginIdentity(req) : getClientIp(req);
    return consume({ req, res, next, policyName, identity });
  }

  function authenticatedLimiter(req, res, next) {
    const policyName = classifyAuthenticatedPolicy(req);
    return consume({ req, res, next, policyName, identity: getAuthenticatedIdentity(req) });
  }

  function cleanup() {
    const currentTime = now();
    for (const [key, bucket] of store.entries()) {
      if (!bucket || bucket.resetAt <= currentTime) store.delete(key);
    }
  }

  return { publicLimiter, authenticatedLimiter, cleanup, store };
}

module.exports = {
  POLICY_CONFIG,
  classifyAuthenticatedPolicy,
  createRateLimitController,
  getAuthenticatedIdentity,
  getClientIp,
  getLoginIdentity,
};
