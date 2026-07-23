require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const auth = require('./middleware/auth');
const { enforceApiAccess } = require('./middleware/rbac.middleware');
const { enforceTenantRequestScope } = require('./middleware/tenantScope.middleware');
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
const evidenceLibraryRoutes = require('./routes/evidence-library.routes');
const documentIntegrationsRoutes = require('./routes/document-integrations.routes');
const documentIntegrationsGoogleRoutes = require('./routes/document-integrations-google.routes');
const documentIntegrationsZohoRoutes = require('./routes/document-integrations-zoho.routes');
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
const operationalRisksRoutes = require('./routes/operational-risks.routes');
const isoOperationalExecutionRoutes = require('./routes/iso-operational-execution.routes');
const isoRecommendedActionsRoutes = require('./routes/iso-recommended-actions.routes');
const isoCommandCenterRoutes = require('./routes/iso-command-center.routes');
const isoAuditorRoutes = require('./routes/iso-auditor.routes');
const isoScopeRoutes = require('./routes/iso-scope.routes');
const aiTenantSearchRoutes = require('./routes/ai-tenant-search.routes');
const lifecycleRoutes = require('./routes/lifecycle.routes');
const aiFeedbackRoutes = require('./routes/ai-feedback.routes');
const aiExternalLookupRoutes = require('./routes/ai-external-lookup.routes');
const aiTracesRoutes = require('./routes/ai-traces.routes');
const quotesRoutes = require('./routes/quotes.routes');
const objectivesRoutes = require('./routes/objectives.routes');
const companyProfileRoutes = require('./routes/company-profile.routes');
const tenantProcessesRoutes = require('./routes/tenant-processes.routes');
const tenantOperationsRoutes = require('./routes/tenant-operations.routes');
const tenantProcessLinksRoutes = require('./routes/tenant-process-links.routes');
const tenantFilesRoutes = require('./routes/tenant-files.routes');
const syncAgentRoutes = require('./routes/sync-agent.routes');
const knowledgeBaseRoutes = require('./routes/knowledge-base.routes');
const intelligenceRoutes = require('./routes/intelligence.routes');
const grcRoutes = require('./routes/grc.routes');
const { prometheusLines: grcPrometheusLines } = require('./services/grc/grcObservability');
const { startSchedulerRunner } = require('./services/grc/grcSchedulerRunner');
const { aiLocaleResponseGuard } = require('./middleware/aiLocaleResponseGuard');

const app = express();
app.use(aiLocaleResponseGuard);
const runtimeStartedAt = Date.now();
const runtimeMetrics = {
  requestsTotal: 0,
  errorsTotal: 0,
  durationMsTotal: 0,
  byStatus: new Map(),
};

const allowedCorsOrigins = Array.from(new Set([
  ...String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_INTERNAL_URL,
  process.env.PUBLIC_APP_URL,
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
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    runtimeMetrics.requestsTotal += 1;
    runtimeMetrics.durationMsTotal += durationMs;
    runtimeMetrics.byStatus.set(res.statusCode, (runtimeMetrics.byStatus.get(res.statusCode) || 0) + 1);
    if (res.statusCode >= 500) runtimeMetrics.errorsTotal += 1;
    console.log(JSON.stringify({
      event: 'HTTP_REQUEST',
      request_id: req.requestId,
      tenant_id: req.user?.tenant_id || req.tenantId || null,
      user_id: req.user?.id || req.user?.user_id || null,
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      error_code: res.locals?.errorCode || null,
    }));
  });
  next();
});

function bounded(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs)),
  ]);
}

async function runtimeDependencyStatus() {
  const timeoutMs = Math.max(250, Math.min(2000, Number(process.env.READINESS_DEPENDENCY_TIMEOUT_MS || 1200)));
  const uploadsPath = path.resolve(__dirname, '..', 'uploads');
  const checks = {
    database: () => pool.query('SELECT 1 AS ok'),
    storage: () => fs.promises.access(uploadsPath, fs.constants.R_OK | fs.constants.W_OK),
    jobs: () => pool.query("SELECT to_regclass('public.tcdx_async_jobs') AS table_name"),
  };
  if (process.env.AI_ENGINE_URL) {
    checks.ai_engine = async () => {
      const response = await fetch(`${String(process.env.AI_ENGINE_URL).replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`AI_ENGINE_HTTP_${response.status}`);
    };
  }

  const entries = await Promise.all(Object.entries(checks).map(async ([name, check]) => {
    const started = Date.now();
    try {
      await bounded(Promise.resolve().then(check), timeoutMs, name.toUpperCase());
      return [name, { ok: true, latency_ms: Date.now() - started }];
    } catch (_error) {
      return [name, {
        ok: false,
        latency_ms: Date.now() - started,
        error_code: `${name.toUpperCase()}_UNAVAILABLE`,
      }];
    }
  }));
  return Object.fromEntries(entries);
}

app.get('/live', (_req, res) => {
  res.json({ ok: true, status: 'live', uptime_seconds: Math.floor((Date.now() - runtimeStartedAt) / 1000) });
});

app.get('/ready', async (_req, res) => {
  const dependencies = await runtimeDependencyStatus();
  const ready = Object.values(dependencies).every(item => item.ok);
  res.status(ready ? 200 : 503).json({ ok: ready, status: ready ? 'ready' : 'degraded', dependencies });
});

app.get('/health', async (_req, res) => {
  const dependencies = await runtimeDependencyStatus();
  const healthy = Object.values(dependencies).every(item => item.ok);
  res.status(200).json({
    ok: healthy,
    status: healthy ? 'healthy' : 'degraded',
    service: 'tcdx-iso-saas-v4-backend',
    uptime_seconds: Math.floor((Date.now() - runtimeStartedAt) / 1000),
    dependencies,
  });
});

app.get('/metrics', (_req, res) => {
  const averageDuration = runtimeMetrics.requestsTotal
    ? runtimeMetrics.durationMsTotal / runtimeMetrics.requestsTotal
    : 0;
  const statusLines = Array.from(runtimeMetrics.byStatus.entries())
    .map(([status, count]) => `tcdx_http_responses_total{status="${status}"} ${count}`);
  res.type('text/plain; version=0.0.4').send([
    '# HELP tcdx_http_requests_total Total HTTP requests.',
    '# TYPE tcdx_http_requests_total counter',
    `tcdx_http_requests_total ${runtimeMetrics.requestsTotal}`,
    '# HELP tcdx_http_errors_total Total HTTP responses with status >= 500.',
    '# TYPE tcdx_http_errors_total counter',
    `tcdx_http_errors_total ${runtimeMetrics.errorsTotal}`,
    '# HELP tcdx_http_request_duration_ms_average Average request duration in milliseconds.',
    '# TYPE tcdx_http_request_duration_ms_average gauge',
    `tcdx_http_request_duration_ms_average ${averageDuration.toFixed(2)}`,
    ...statusLines,
    '# HELP tcdx_grc_phase1_operations_total Total Phase 1 GRC operations by type and outcome.',
    '# TYPE tcdx_grc_phase1_operations_total counter',
    ...grcPrometheusLines(),
    '',
  ].join('\n'));
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
app.get('/uploads/tenants/:fileName', (req, res) => {
  const fileName = path.basename(String(req.params.fileName || ''));
  const ext = path.extname(fileName).toLowerCase();
  const allowedLogoExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

  if (!fileName || fileName !== String(req.params.fileName || '') || !allowedLogoExtensions.has(ext)) {
    return res.status(404).json({ ok: false, code: 'PUBLIC_TENANT_ASSET_NOT_FOUND', error: 'Archivo no encontrado' });
  }

  const filePath = path.resolve(__dirname, '..', 'uploads', 'tenants', fileName);
  const publicRoot = path.resolve(__dirname, '..', 'uploads', 'tenants');
  if (!filePath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, code: 'PUBLIC_TENANT_ASSET_NOT_FOUND', error: 'Archivo no encontrado' });
  }

  try {
    const fileStat = fs.lstatSync(filePath);
    const realFilePath = fs.realpathSync(filePath);
    const realPublicRoot = fs.realpathSync(publicRoot);
    if (
      !fileStat.isFile() ||
      fileStat.isSymbolicLink() ||
      (realFilePath !== realPublicRoot && !realFilePath.startsWith(`${realPublicRoot}${path.sep}`))
    ) {
      return res.status(404).json({ ok: false, code: 'PUBLIC_TENANT_ASSET_NOT_FOUND', error: 'Archivo no encontrado' });
    }
  } catch (_error) {
    return res.status(404).json({ ok: false, code: 'PUBLIC_TENANT_ASSET_NOT_FOUND', error: 'Archivo no encontrado' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  return res.sendFile(filePath);
});
app.use('/uploads/tenants', (_req, res) => {
  return res.status(404).json({
    ok: false,
    code: 'PUBLIC_TENANT_ASSET_NOT_FOUND',
    error: 'Archivo no encontrado',
  });
});
app.use('/uploads/tenant-logos', express.static(path.join(__dirname, '..', 'uploads', 'tenant-logos')));
app.use('/api/auth', express.json({ limit: jsonBodyLimit }), authRoutes);

// OAuth Google necesita exponer callback público.

// El endpoint /oauth/start mantiene auth propio dentro de la ruta.

app.use('/api/document-integrations/google', express.json({ limit: jsonBodyLimit }), documentIntegrationsGoogleRoutes);
app.use('/api/document-integrations/zoho', express.json({ limit: jsonBodyLimit }), documentIntegrationsZohoRoutes);
app.use('/api/agent', express.json({ limit: jsonBodyLimit }), syncAgentRoutes);

app.use('/api', auth, enforceApiAccess);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use('/api', enforceTenantRequestScope);
app.use('/api/reports', reportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard-v2', dashboardV2Routes);
app.use('/api/controls', controlsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-auditor', aiAuditorRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/nonconformities', ncRoutes);
app.use('/api/dashboard-controls', dashboardControls);
app.use('/api/evidences', evidencesRoutes);
app.use('/api/evidence-library', evidenceLibraryRoutes);
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
app.use('/api/tenant-processes', tenantProcessesRoutes);
app.use('/api/tenant-operations', tenantOperationsRoutes);
app.use('/api/tenant-process-links', tenantProcessLinksRoutes);
app.use('/api/tenant-standards', tenantStandardsRoutes);
app.use('/api/soa', soaRoutes);
app.use('/api/action-plans', actionPlansRoutes);
app.use('/api/findings', findingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/health', auth, enforceApiAccess, healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/files/tenant', tenantFilesRoutes);
app.use('/api/ai-feedback', aiFeedbackRoutes);
app.use('/api/ai-external-lookup', aiExternalLookupRoutes);
app.use('/ai-feedback', auth, enforceApiAccess, aiFeedbackRoutes);
app.use('/ai-external-lookup', auth, enforceApiAccess, aiExternalLookupRoutes);
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
app.use('/api/operational-risks', operationalRisksRoutes);
app.use('/api/iso-operational-execution', isoOperationalExecutionRoutes);
app.use('/api/iso-recommended-actions', isoRecommendedActionsRoutes);
app.use('/api/iso-command-center', isoCommandCenterRoutes);
app.use('/api/iso-auditor', isoAuditorRoutes);
app.use('/api/iso-scope', isoScopeRoutes);
app.use('/api/ai-compliance/tenant-search', aiTenantSearchRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/grc', grcRoutes);


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
  res.locals.errorCode = code;
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

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
startSchedulerRunner();

const backendRequestTimeoutMs = Math.max(
  Number.parseInt(
    process.env.BACKEND_REQUEST_TIMEOUT_MS ||
      process.env.REPORT_DEEP_JOB_TIMEOUT_MS ||
      '660000',
    10
  ) || 660000,
  660000
);
server.requestTimeout = backendRequestTimeoutMs;
server.headersTimeout = Math.max(
  Number.parseInt(process.env.BACKEND_HEADERS_TIMEOUT_MS || String(backendRequestTimeoutMs + 10000), 10) || (backendRequestTimeoutMs + 10000),
  backendRequestTimeoutMs + 10000
);
server.keepAliveTimeout = Math.max(
  Number.parseInt(process.env.BACKEND_KEEP_ALIVE_TIMEOUT_MS || '65000', 10) || 65000,
  65000
);
