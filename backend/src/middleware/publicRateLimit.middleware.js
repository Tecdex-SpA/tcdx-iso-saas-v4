'use strict';

const crypto = require('crypto');

const DEFAULT_WINDOW_MS = Math.max(
  1000,
  Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
);
const DEFAULT_MAX = Math.max(
  1,
  Number(process.env.AUTH_RATE_LIMIT_MAX || 10)
);

const store = new Map();
const metrics = {
  allowed: 0,
  blocked: 0,
};

function sanitizeKeyPart(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._@-]/g, '_')
    .slice(0, 180);
}

function getClientIp(req) {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();

  return forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
}

function normalizeEmail(req) {
  return sanitizeKeyPart(req.body?.email || req.body?.username || 'unknown-user');
}

function hashIdentity(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

function setHeaders(res, max, remaining, resetAt, policy) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  res.setHeader('X-RateLimit-Policy', policy);

  return retryAfterSeconds;
}

function createPublicAuthRateLimiter({
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS,
  policy = 'public_auth_login',
} = {}) {
  const safeMax = Math.max(1, Number(max));
  const safeWindowMs = Math.max(1000, Number(windowMs));

  return function publicAuthRateLimit(req, res, next) {
    if (String(req.path || '') !== '/login') {
      return next();
    }

    const identity = `${sanitizeKeyPart(getClientIp(req))}:${normalizeEmail(req)}`;
    const key = `${policy}:${hashIdentity(identity)}`;
    const now = Date.now();
    let bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + safeWindowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = safeMax - bucket.count;
    const retryAfterSeconds = setHeaders(
      res,
      safeMax,
      remaining,
      bucket.resetAt,
      policy
    );

    if (bucket.count > safeMax) {
      metrics.blocked += 1;
      res.locals.errorCode = 'RATE_LIMITED';
      res.setHeader('Retry-After', String(retryAfterSeconds));

      return res.status(429).json({
        ok: false,
        error_code: 'RATE_LIMITED',
        code: 'RATE_LIMITED',
        message: 'Se alcanzó temporalmente el límite de intentos de acceso.',
        error: 'Se alcanzó temporalmente el límite de intentos de acceso.',
        retry_after_seconds: retryAfterSeconds,
        policy,
        request_id: req.requestId || null,
      });
    }

    metrics.allowed += 1;
    return next();
  };
}

function cleanupExpiredBuckets() {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (!bucket || bucket.resetAt <= now) store.delete(key);
  }
}

const cleanupTimer = setInterval(
  cleanupExpiredBuckets,
  Math.max(DEFAULT_WINDOW_MS, 60000)
);
cleanupTimer.unref?.();

function prometheusLines() {
  return [
    `tcdx_public_auth_rate_limit_allowed_total ${metrics.allowed}`,
    `tcdx_public_auth_rate_limit_blocked_total ${metrics.blocked}`,
  ];
}

function resetForTests() {
  store.clear();
  metrics.allowed = 0;
  metrics.blocked = 0;
}

module.exports = {
  createPublicAuthRateLimiter,
  prometheusLines,
  resetForTests,
};
