require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./middleware/auth');
const { enforceApiAccess } = require('./middleware/rbac.middleware');
const reportsRoutes = require('./routes/reports.routes');
const billingRoutes = require('./routes/billing.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const dashboardV2Routes = require('./routes/dashboard-v2.routes');
const controlsRoutes = require('./routes/controls.routes');
const aiRoutes = require('./routes/ai.routes');
const aiAuditorRoutes = require('./routes/ai-auditor.routes');
const diagnosticRoutes = require('./routes/diagnostic.routes');
const ncRoutes = require('./routes/nonconformities.routes');
const dashboardControls = require('./routes/dashboard-controls.routes');
const evidencesRoutes = require('./routes/evidences.routes');
const documentIntegrationsRoutes = require('./routes/document-integrations.routes');
const documentIntegrationsGoogleRoutes = require('./routes/document-integrations-google.routes');
const documentIntegrationsSyncRoutes = require('./routes/document-integrations-sync.routes');
const documentIntegrationsFoldersRoutes = require('./routes/document-integrations-folders.routes');
const documentIntegrationsAnalysisRoutes = require('./routes/document-integrations-analysis.routes');
const policyRoutes = require('./routes/policy.routes');
const auditsRoutes = require('./routes/audits.routes');
const auditExecutionRoutes = require('./routes/audit-execution.routes');
const auditPreparationRoutes = require('./routes/auditPreparation.routes');
const assetsRoutes = require('./routes/assets.routes');
const usersRoutes = require('./routes/users.routes');
const tenantsRoutes = require('./routes/tenants.routes');
const tenantStandardsRoutes = require('./routes/tenant-standards.routes');
const soaRoutes = require('./routes/soa.routes');
const actionPlansRoutes = require('./routes/action-plans.routes');
const findingsRoutes = require('./routes/findings.routes');
const searchRoutes = require('./routes/search.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const kpiRoutes = require('./routes/kpi.routes');
const healthRoutes = require('./routes/health');
const meRoutes = require('./routes/me.routes');
const adminSaasRoutes = require('./routes/admin-saas.routes');
const meModulesRoutes = require('./routes/me-modules.routes');
const aiComplianceRoutes = require('./routes/ai-compliance.routes');
const aiAnswerRoutes = require('./routes/ai-answer.routes');
const aiBenchmarkRoutes = require('./routes/ai-benchmark.routes');
const aiKnowledgeRoutes = require('./routes/ai-knowledge.routes');
const isoKnowledgeRoutes = require('./routes/iso-knowledge.routes');
const isoControlMappingRoutes = require('./routes/iso-control-mapping.routes');
const isoExpressDiagnosticRoutes = require('./routes/iso-express-diagnostic.routes');
const isoDocumentGeneratorRoutes = require('./routes/iso-document-generator.routes');
const isoRiskMatrixRoutes = require('./routes/iso-risk-matrix.routes');
const isoOperationalExecutionRoutes = require('./routes/iso-operational-execution.routes');
const isoRecommendedActionsRoutes = require('./routes/iso-recommended-actions.routes');
const isoCommandCenterRoutes = require('./routes/iso-command-center.routes');
const isoAuditorRoutes = require('./routes/iso-auditor.routes');
const aiTenantSearchRoutes = require('./routes/ai-tenant-search.routes');
const lifecycleRoutes = require('./routes/lifecycle.routes');
const aiFeedbackRoutes = require('./routes/ai-feedback.routes');
const aiExternalLookupRoutes = require('./routes/ai-external-lookup.routes');
const aiTracesRoutes = require('./routes/ai-traces.routes');
const quotesRoutes = require('./routes/quotes.routes');
const objectivesRoutes = require('./routes/objectives.routes');
const companyProfileRoutes = require('./routes/company-profile.routes');
const { aiLocaleResponseGuard } = require('./middleware/aiLocaleResponseGuard');

const app = express();
app.use(aiLocaleResponseGuard);

const defaultFrontendUrl = 'https://181.212.166.187:8443';
const defaultFrontendInternalUrl = 'http://www.tcdx.int:8080';
const esxiFrontendUrl = 'https://181.212.166.187:8443';
const esxiFrontendInternalUrl = 'http://192.168.2.33:8080';
const esxiFrontendDnsUrl = 'http://www.tcdx.int:8080';
const allowedCorsOrigins = Array.from(new Set([
  ...String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_INTERNAL_URL,
  defaultFrontendUrl,
  defaultFrontendInternalUrl,
  esxiFrontendUrl,
  esxiFrontendInternalUrl,
  esxiFrontendDnsUrl,
].filter(Boolean)));
// =============================
// FASE 4B SECURITY HARDENING
// =============================
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '2mb';
const rateLimitWindowMs = Math.max(1000, Number(process.env.SECURITY_RATE_LIMIT_WINDOW_MS || 60000));
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
    const key = `${bucketName}:${sanitizeRateLimitKeyPart(getClientIp(req))}`;
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

function buildRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

app.use((req, res, next) => {
  const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
  req.requestId = incomingRequestId || buildRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const authLimiter = createMemoryRateLimiter({ name: 'auth', max: authRateLimitMax });
const aiLimiter = createMemoryRateLimiter({ name: 'ai', max: aiRateLimitMax });
const defaultLimiter = createMemoryRateLimiter({ name: 'default', max: defaultRateLimitMax });

app.use((req, res, next) => {
  if (req.path === '/api/auth/login') {
    return authLimiter(req, res, next);
  }

  if (
    req.path.startsWith('/api/ai') ||
    req.path.startsWith('/ai-external-lookup') ||
    req.path.startsWith('/api/search') ||
    req.path.includes('/report')
  ) {
    return aiLimiter(req, res, next);
  }

  return defaultLimiter(req, res, next);
});
// FIN FASE 4B SECURITY HARDENING

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.length === 0 || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    const corsError = new Error('Origen no permitido por CORS');
    corsError.status = 403;
    corsError.code = 'CORS_ORIGIN_DENIED';
    return callback(corsError);
  },
  credentials: true,
}));
app.use('/uploads/logos', express.static(path.join(__dirname, '..', 'uploads', 'logos')));
app.use('/uploads/profiles', express.static(path.join(__dirname, '..', 'uploads', 'profiles')));
app.use('/uploads/tenants', express.static(path.join(__dirname, '..', 'uploads', 'tenants')));
app.use('/uploads/tenant-logos', express.static(path.join(__dirname, '..', 'uploads', 'tenant-logos')));
app.use('/api/auth', express.json({ limit: jsonBodyLimit }), authRoutes);

// OAuth Google necesita exponer callback público.

// El endpoint /oauth/start mantiene auth propio dentro de la ruta.

app.use('/api/document-integrations/google', express.json({ limit: jsonBodyLimit }), documentIntegrationsGoogleRoutes);

app.use('/api', auth, enforceApiAccess);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use('/api/reports', reportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard-v2', dashboardV2Routes);
app.use('/api/controls', controlsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-auditor', aiAuditorRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/nonconformities', ncRoutes);
app.use('/api/dashboard-controls', dashboardControls);
app.use('/api/evidences', evidencesRoutes);
app.use('/api/document-integrations', documentIntegrationsAnalysisRoutes);
app.use('/api/document-integrations', documentIntegrationsFoldersRoutes);
app.use('/api/document-integrations', documentIntegrationsSyncRoutes);
app.use('/api/document-integrations', documentIntegrationsRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/audits', auditsRoutes);
app.use('/api/audit-execution', auditExecutionRoutes);
app.use('/api/audit-preparation', auditPreparationRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/tenant-standards', tenantStandardsRoutes);
app.use('/api/soa', soaRoutes);
app.use('/api/action-plans', actionPlansRoutes);
app.use('/api/findings', findingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/health', auth, enforceApiAccess, healthRoutes);
app.use('/ai-feedback', aiFeedbackRoutes);
app.use('/ai-external-lookup', aiExternalLookupRoutes);
app.use('/api/ai-traces', aiTracesRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin-saas', adminSaasRoutes);
app.use('/api/me', meModulesRoutes);
app.use('/api/ai-compliance/answer', aiAnswerRoutes);
app.use('/api/ai-compliance/benchmark', aiBenchmarkRoutes);
app.use('/api/ai-compliance', aiComplianceRoutes);
app.use('/api/ai-compliance/knowledge', aiKnowledgeRoutes);
app.use('/api/iso-knowledge', isoKnowledgeRoutes);
app.use('/api/iso-control-mapping', isoControlMappingRoutes);
app.use('/api/iso-express-diagnostic', isoExpressDiagnosticRoutes);
app.use('/api/iso-document-generator', isoDocumentGeneratorRoutes);
app.use('/api/iso-risk-matrix', isoRiskMatrixRoutes);
app.use('/api/iso-operational-execution', isoOperationalExecutionRoutes);
app.use('/api/iso-recommended-actions', isoRecommendedActionsRoutes);
app.use('/api/iso-command-center', isoCommandCenterRoutes);
app.use('/api/iso-auditor', isoAuditorRoutes);
app.use('/api/ai-compliance/tenant-search', aiTenantSearchRoutes);
app.use('/api/lifecycle', lifecycleRoutes);


/* KPI: compatibilidad con ambas rutas */
app.use('/api/kpi', kpiRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/objectives', objectivesRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando 🚀');
});


function securityErrorHandler(err, req, res, next) {
  if (!err) return next();

  const status = Number(err.status || err.statusCode || (err.type === 'entity.too.large' ? 413 : 500));
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const code = err.code || (safeStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'SERVER_ERROR');
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error('REQUEST ERROR:', {
      request_id: req.requestId || null,
      code,
      status: safeStatus,
      path: req.path,
      method: req.method,
      message: err.message,
    });
  }

  return res.status(safeStatus).json({
    ok: false,
    error_code: code,
    code,
    message: safeStatus === 500 ? 'Error procesando solicitud' : (err.message || 'Solicitud inválida'),
    error: safeStatus === 500 ? 'Error procesando solicitud' : (err.message || 'Solicitud inválida'),
    request_id: req.requestId || null,
  });
}

app.use(securityErrorHandler);

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
