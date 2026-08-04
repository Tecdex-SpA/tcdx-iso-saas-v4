'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const appPath = path.join(repoRoot, 'backend', 'src', 'app.js');
let source = fs.readFileSync(appPath, 'utf8');

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`No se encontró bloque esperado: ${label}`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  'imports rate limit',
  "const { aiLocaleResponseGuard } = require('./middleware/aiLocaleResponseGuard');\n",
  "const { aiLocaleResponseGuard } = require('./middleware/aiLocaleResponseGuard');\n" +
    "const {\n" +
    "  createPublicAuthRateLimiter,\n" +
    "  prometheusLines: publicRateLimitPrometheusLines,\n" +
    "} = require('./middleware/publicRateLimit.middleware');\n" +
    "const {\n" +
    "  prometheusLines: authenticatedRateLimitPrometheusLines,\n" +
    "} = require('./middleware/authenticatedRateLimit.middleware');\n"
);

replaceOnce(
  'legacy limiter implementation',
  `const rateLimitWindowMs = Math.max(1000, Number(process.env.SECURITY_RATE_LIMIT_WINDOW_MS || 60000));
const defaultRateLimitMax = Math.max(1, Number(process.env.SECURITY_RATE_LIMIT_MAX || 300));
const authRateLimitMax = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_MAX || 30));
const aiRateLimitMax = Math.max(1, Number(process.env.AI_RATE_LIMIT_MAX || 60));
const rateLimitStore = new Map();

function sanitizeRateLimitKeyPart(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0, 160);
}

function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
}

function createMemoryRateLimiter({ name, max = defaultRateLimitMax, windowMs = rateLimitWindowMs } = {}) {
  const bucketName = sanitizeRateLimitKeyPart(name || 'default');

  return function memoryRateLimiter(req, res, next) {
    const now = Date.now();
    const key = \`${'${bucketName}'}:${'${sanitizeRateLimitKeyPart(getClientIp(req))}'}\`;
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(0, max - current.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (current.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        ok: false,
        error_code: 'RATE_LIMITED',
        code: 'RATE_LIMITED',
        message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
        error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
        request_id: req.requestId || null,
      });
    }

    return next();
  };
}

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (!value || value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, Math.max(rateLimitWindowMs, 60000)).unref?.();
`,
  `const publicAuthLimiter = createPublicAuthRateLimiter();
`
);

replaceOnce(
  'prometheus rate limit lines',
  "    ...grcPrometheusLines(),\n    '',\n",
  "    ...grcPrometheusLines(),\n" +
    "    '# HELP tcdx_public_auth_rate_limit_allowed_total Allowed public login requests.',\n" +
    "    '# TYPE tcdx_public_auth_rate_limit_allowed_total counter',\n" +
    "    '# HELP tcdx_public_auth_rate_limit_blocked_total Blocked public login requests.',\n" +
    "    '# TYPE tcdx_public_auth_rate_limit_blocked_total counter',\n" +
    "    '# HELP tcdx_rate_limit_allowed_total Allowed authenticated requests by policy.',\n" +
    "    '# TYPE tcdx_rate_limit_allowed_total counter',\n" +
    "    '# HELP tcdx_rate_limit_blocked_total Blocked authenticated requests by policy.',\n" +
    "    '# TYPE tcdx_rate_limit_blocked_total counter',\n" +
    "    ...publicRateLimitPrometheusLines(),\n" +
    "    ...authenticatedRateLimitPrometheusLines(),\n" +
    "    '',\n"
);

replaceOnce(
  'legacy global limiter mount',
  `const authLimiter = createMemoryRateLimiter({ name: 'auth', max: authRateLimitMax });
const aiLimiter = createMemoryRateLimiter({ name: 'ai', max: aiRateLimitMax });
const defaultLimiter = createMemoryRateLimiter({ name: 'default', max: defaultRateLimitMax });

app.use((req, res, next) => {
  if (req.path === '/api/auth/login') {
    return authLimiter(req, res, next);
  }

  if (
    req.path.startsWith('/api/ai') ||
    req.path.startsWith('/ai-feedback') ||
    req.path.startsWith('/ai-external-lookup') ||
    req.path.startsWith('/api/search') ||
    req.path.includes('/report')
  ) {
    return aiLimiter(req, res, next);
  }

  return defaultLimiter(req, res, next);
});
// FIN FASE 4B SECURITY HARDENING
`,
  `// El login público se limita después de parsear JSON para usar IP + correo.
// El tráfico autenticado se limita dentro del middleware auth, una vez resueltos tenant y usuario.
// FIN FASE 4B SECURITY HARDENING
`
);

replaceOnce(
  'auth route mount',
  "app.use('/api/auth', express.json({ limit: jsonBodyLimit }), authRoutes);",
  "app.use('/api/auth', express.json({ limit: jsonBodyLimit }), publicAuthLimiter, authRoutes);"
);

fs.writeFileSync(appPath, source, 'utf8');
console.log(`app.js actualizado: ${appPath}`);
