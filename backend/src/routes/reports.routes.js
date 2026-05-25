const express = require('express');
const path = require('path');
const fs = require('fs');
const { errorDetail } = require('../utils/errorResponse');
const { resolveLocale, isEnglishLocale } = require('../utils/locale');

const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const asyncJobs = require('../services/asyncJob.service');

const { buildReportData } = require('../reports/services/reportData.service');
const { buildReportAiEnrichment } = require('../services/reportAiEnrichment.service');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const {
  renderExecutivePremiumTemplate,
} = require('../reports/templates/executivePremium.template');
const { renderControlHealthPremiumTemplate } = require('../reports/templates/controlHealthPremium.template');
const { renderMaturityGapDiagnosticPremiumTemplate } = require('../reports/templates/maturityGapDiagnosticPremium.template');
const { renderIsoRiskPremiumTemplate } = require('../reports/templates/isoRiskPremium.template');
const { renderInternalAuditPremiumTemplate } = require('../reports/templates/internalAuditPremium.template');
const { renderActionPlanPremiumTemplate } = require('../reports/templates/actionPlanPremium.template');
const { renderAiAuditorPremiumTemplate } = require('../reports/templates/aiAuditorPremium.template');
const {
  persistSeniorAuditorSuggestions,
  summarizeSeniorSuggestionSync,
} = require('../services/seniorAuditorSuggestions.service');

const {
  listCoverageForTenant,
  getCoverageForTenantStandard,
  assertCanGenerateReportByCoverage,
} = require('../reports/services/reportCoverage.service');

const REPORT_TYPE_ALIASES = {
  executive_summary: 'executive_iso_status',
  control_status: 'control_health_report',
  audit_report: 'internal_audit_report',
};

function resolveReportTypeCode(reportTypeCode) {
  const code = String(reportTypeCode || '').trim();
  return REPORT_TYPE_ALIASES[code] || code;
}

function getLegacyReportTypeCode(reportTypeCode) {
  const code = String(reportTypeCode || '').trim();

  const reverseAliases = Object.entries(REPORT_TYPE_ALIASES).reduce(
    (acc, [legacyCode, premiumCode]) => {
      acc[premiumCode] = legacyCode;
      return acc;
    },
    {}
  );

  return reverseAliases[code] || code;
}

function isPremiumReportTypeCode(reportTypeCode) {
  return Object.values(REPORT_TYPE_ALIASES).includes(String(reportTypeCode || '').trim());
}

const reportRuntimeJobs = new Map();
const REPORT_JOB_TTL_MS = Number(process.env.REPORT_JOB_TTL_MS || 1000 * 60 * 60 * 6);
const REPORT_DEEP_MIN_TIMEOUT_MS = 600000;

function parsePositiveInt(value, fallback = null) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveReportJobTimeoutMs(payload = {}) {
  const metadata = safeObject(payload.metadata);
  const modelMode = normalizeReportModelMode(
    payload.model_mode ||
      payload.modelMode ||
      metadata.model_mode ||
      metadata.modelMode ||
      (parseReportBoolean(payload.use_llm ?? metadata.use_llm, false) ? 'balanced' : 'fast')
  );
  const configured = parsePositiveInt(
    modelMode === 'deep'
      ? (process.env.REPORT_DEEP_JOB_TIMEOUT_MS ||
          process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS ||
          process.env.AI_ENGINE_REQUEST_TIMEOUT_MS)
      : (process.env.REPORT_JOB_TIMEOUT_MS ||
          process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS ||
          process.env.AI_ENGINE_REQUEST_TIMEOUT_MS),
    modelMode === 'deep' ? REPORT_DEEP_MIN_TIMEOUT_MS : 300000
  );

  return modelMode === 'deep'
    ? Math.max(configured, REPORT_DEEP_MIN_TIMEOUT_MS)
    : configured;
}

function buildReportAsyncFailure({ error = null, parsed = null, job = {}, timeoutMs = null, startedAtMs = null, stage = null } = {}) {
  const errorCode =
    parsed?.code ||
    error?.code ||
    (error?.name === 'AbortError' ? 'REPORT_ASYNC_TIMEOUT' : 'REPORT_ASYNC_GENERATION_FAILED');
  const modelMode = normalizeReportModelMode(
    job.payload?.model_mode ||
      job.payload?.modelMode ||
      parsed?.model_mode_used ||
      parsed?.data?.export?.payload_json?.ai_report_addendum?.model_mode_used ||
      'fast'
  );
  const isTimeout = error?.name === 'AbortError' || errorCode.includes('TIMEOUT') || String(parsed?.error || parsed?.message || '').toLowerCase().includes('timeout');
  const safeMessage =
    parsed?.error ||
    parsed?.message ||
    error?.message ||
    'No fue posible completar la generación del reporte.';

  return {
    code: errorCode,
    error_type: errorCode,
    message: 'No fue posible completar la generación del reporte.',
    error_message: String(safeMessage).slice(0, 500),
    timeout_stage: parsed?.timeout_stage || parsed?.stage || error?.timeout_stage || (isTimeout ? (stage || 'report_async_job') : null),
    timeout_ms: parsed?.timeout_ms || error?.timeout_ms || timeoutMs || null,
    selected_model: parsed?.selected_model || parsed?.model_name || parsed?.data?.export?.payload_json?.ai_report_addendum?.model_name || null,
    model_mode: modelMode,
    request_id: job.request_id || parsed?.request_id || null,
    ai_engine_request_id: parsed?.ai_engine_request_id || parsed?.request_id || null,
    duration_ms: startedAtMs ? Date.now() - startedAtMs : null,
  };
}

function normalizeRole(role) {
  const raw = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases = {
    admin: 'admin',
    administrator: 'admin',
    administrador: 'admin',
    tenant_admin: 'admin',
    admin_tenant: 'admin',
    cliente_admin: 'admin',
    admin_cliente: 'admin',
    company_admin: 'admin',
    account_admin: 'admin',
    user_admin: 'admin',
    administrador_rieltec: 'admin',

    manager: 'manager',
    gerente: 'manager',
    gerencia: 'manager',
    management: 'manager',

    compliance: 'compliance',
    compliance_manager: 'compliance',
    compliance_admin: 'compliance',
    encargado_cumplimiento: 'compliance',
    responsable_cumplimiento: 'compliance',

    auditor: 'auditor',
    internal_auditor: 'auditor',
    auditor_interno: 'auditor',
    external_auditor: 'auditor',
    auditor_externo: 'auditor',

    dealer: 'dealer',
    partner: 'dealer',
    reseller: 'dealer',

    superadmin: 'superadmin',
    super_admin: 'superadmin',
    owner: 'superadmin',

    platform_admin: 'platform_admin',
    admin_global: 'platform_admin',
    global_admin: 'platform_admin',
    administrador_global: 'platform_admin',
    plataforma_admin: 'platform_admin',
    admin_plataforma: 'platform_admin',
  };

  if (aliases[raw]) return aliases[raw];

  if (raw.includes('dealer') || raw.includes('partner') || raw.includes('reseller')) {
    return 'dealer';
  }

  if (
    raw.includes('superadmin') ||
    raw.includes('super_admin') ||
    raw.includes('platform') ||
    raw.includes('plataforma') ||
    raw.includes('global') ||
    raw.includes('owner')
  ) {
    return 'platform_admin';
  }

  if (raw.includes('auditor')) {
    return 'auditor';
  }

  if (raw.includes('compliance') || raw.includes('cumplimiento')) {
    return 'compliance';
  }

  if (raw.includes('manager') || raw.includes('gerente') || raw.includes('gerencia')) {
    return 'manager';
  }

  if (raw.includes('admin') || raw.includes('administrador')) {
    return 'admin';
  }

  return raw;
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
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

function isPlatformRole(role) {
  return ['superadmin', 'platform_admin'].includes(normalizeRole(role));
}

function isDealerRole(role) {
  return normalizeRole(role) === 'dealer';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function safeObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeReportModelMode(value) {
  const mode = String(value || 'fast').trim().toLowerCase();
  return ['fast', 'balanced', 'deep'].includes(mode) ? mode : 'fast';
}

function parseReportBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 's'].includes(String(value).trim().toLowerCase());
}

function resolveReportAiOptions(body = {}) {
  const metadata = safeObject(body.metadata);
  const explicitMode = body.model_mode || body.modelMode || metadata.model_mode || metadata.modelMode;
  const requestedUseLlm = body.use_llm ?? metadata.use_llm;
  const modelMode = normalizeReportModelMode(explicitMode || (parseReportBoolean(requestedUseLlm, false) ? 'balanced' : 'fast'));
  const useLlm = parseReportBoolean(body.use_llm ?? metadata.use_llm, modelMode !== 'fast');
  const depth = String(body.depth || metadata.depth || (modelMode === 'deep' ? 'deep' : 'executive')).trim();

  return {
    model_mode: modelMode,
    use_llm: useLlm,
    use_rag: parseReportBoolean(body.use_rag ?? metadata.use_rag, true),
    use_web: parseReportBoolean(body.use_web ?? metadata.use_web, false),
    use_drive: body.use_drive ?? metadata.use_drive ?? false,
    depth,
    quality: body.quality || metadata.quality || (modelMode === 'deep' ? 'premium_deep' : modelMode),
    include_deep_llm: modelMode !== 'fast' || useLlm,
  };
}

function getReportDownloadUrl(exportId) {
  return `/api/reports/download/${encodeURIComponent(String(exportId))}`;
}

function buildReportJobId() {
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneReportRuntimeJobs() {
  const now = Date.now();
  for (const [jobId, job] of reportRuntimeJobs.entries()) {
    if (now - Number(job.created_at_ms || 0) > REPORT_JOB_TTL_MS) {
      reportRuntimeJobs.delete(jobId);
    }
  }
}

function buildReportJobScope(req) {
  return {
    tenant_id: getUserTenantId(req.user),
    user_id: getUserId(req.user),
    is_platform: isPlatformRole(req.user?.role || req.user?.user_role || req.user?.userRole),
  };
}

function publicReportJob(job) {
  const result = job.result || job.result_json || null;
  const error = job.error || job.error_json || null;
  return {
    ok: true,
    job_id: job.job_id || job.id,
    request_id: job.request_id || null,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at || null,
    completed_at: job.completed_at || null,
    failed_at: job.failed_at || null,
    job_type: job.job_type || 'report_generation',
    source_module: job.source_module || 'exportes',
    result_available: job.status === 'completed' && Boolean(result),
    result_download_url: job.result_download_url || result?.data?.file_url || result?.file_url || null,
    result_file_url: job.result_file_url || result?.data?.export?.file_url || null,
    error,
  };
}

function getReportAsyncBaseUrl() {
  return String(
    process.env.REPORT_ASYNC_INTERNAL_BASE_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ).replace(/\/+$/, '');
}

async function getReportJobScoped(req, jobId) {
  try {
    return await asyncJobs.getJobScoped(jobId, buildReportJobScope(req));
  } catch (error) {
    const runtimeJob = reportRuntimeJobs.get(String(jobId || ''));
    if (runtimeJob && canAccessReportExport({
      role: normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole),
      userId: getUserId(req.user),
      userTenantId: getUserTenantId(req.user),
      row: { tenant_id: runtimeJob.tenant_id, requested_by: runtimeJob.user_id },
    })) {
      return runtimeJob;
    }
    throw error;
  }
}

async function runReportGenerationJob(jobId) {
  const job = reportRuntimeJobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  job.started_at = new Date().toISOString();
  job.updated_at = job.started_at;
  const startedAtMs = Date.now();
  const timeoutMs = resolveReportJobTimeoutMs(job.payload || {});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await asyncJobs.markRunning(jobId);
    const response = await fetch(`${getReportAsyncBaseUrl()}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: job.authorization,
        'x-request-id': job.request_id,
        'x-tcdx-locale': job.locale || 'es',
      },
      body: JSON.stringify(job.payload || {}),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const parsed = contentType.includes('application/json')
      ? await response.json()
      : { ok: false, code: 'REPORT_ASYNC_NON_JSON_RESPONSE', error: await response.text() };

    if (!response.ok || parsed?.ok === false) {
      const failure = buildReportAsyncFailure({
        parsed,
        job,
        timeoutMs,
        startedAtMs,
        stage: 'report_async_internal_generate',
      });
      job.status = 'failed';
      job.error = failure;
      job.failed_at = new Date().toISOString();
      job.updated_at = job.failed_at;
      await asyncJobs.markFailed(jobId, { error_json: failure });
      return;
    }

    const exportRow = parsed?.data?.export || null;
    const downloadUrl = parsed?.data?.file_url || exportRow?.file_url || null;
    job.status = 'completed';
    job.result = parsed;
    job.completed_at = new Date().toISOString();
    job.updated_at = job.completed_at;
    await asyncJobs.markCompleted(jobId, {
      result_json: parsed,
      result_file_id: exportRow?.id || null,
      result_file_url: exportRow?.file_url || null,
      result_download_url: downloadUrl,
    });
    reportRuntimeJobs.delete(jobId);
  } catch (error) {
    const failure = buildReportAsyncFailure({
      error,
      job,
      timeoutMs,
      startedAtMs,
      stage: 'report_async_internal_generate_fetch',
    });
    job.status = 'failed';
    job.error = failure;
    job.failed_at = new Date().toISOString();
    job.updated_at = job.failed_at;
    try {
      await asyncJobs.markFailed(jobId, { error_json: failure });
    } catch (dbError) {
      console.error('REPORT ASYNC JOB DB ERROR:', {
        job_id: jobId,
        request_id: job.request_id,
        error: dbError.message,
      });
    }
    console.error('REPORT ASYNC JOB ERROR:', {
      job_id: jobId,
      request_id: job.request_id,
      error: error.message,
      timeout_stage: failure.timeout_stage,
      timeout_ms: failure.timeout_ms,
      model_mode: failure.model_mode,
      duration_ms: failure.duration_ms,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function resolveReportFilePath(tenantId, fileUrl) {
  const raw = String(fileUrl || '');
  const fileName = path.basename(raw);

  if (!tenantId || !fileName || fileName !== path.basename(fileName)) {
    return null;
  }

  return path.join(
    __dirname,
    '..',
    '..',
    'uploads',
    'reports',
    String(tenantId),
    fileName
  );
}

function canAccessReportExport({ role, userId, userTenantId, row }) {
  if (!row) return false;
  if (isPlatformRole(role)) return true;

  if (isDealerRole(role)) {
    return row.dealer_can_access === true;
  }

  return String(row.tenant_id) === String(userTenantId) || String(row.requested_by) === String(userId);
}

async function getReportType(reportTypeCode) {
  const requestedCode = String(reportTypeCode || '').trim();
  const legacyFallbackCode = getLegacyReportTypeCode(requestedCode);

  const result = await pool.query(
    `
    SELECT
      code,
      name,
      description,
      category,
      default_format,
      template_key,
      is_active,
      sort_order,
      metadata
    FROM report_types
    WHERE code = $1
      AND is_active = TRUE
    LIMIT 1
    `,
    [requestedCode]
  );

  if (result.rowCount > 0) {
    return result.rows[0];
  }

  if (legacyFallbackCode && legacyFallbackCode !== requestedCode) {
    const fallback = await pool.query(
      `
      SELECT
        code,
        name,
        description,
        category,
        default_format,
        template_key,
        is_active,
        sort_order,
        metadata
      FROM report_types
      WHERE code = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [legacyFallbackCode]
    );

    if (fallback.rowCount > 0) {
      return {
        ...fallback.rows[0],
        requested_code: requestedCode,
        resolved_from_legacy: true,
      };
    }
  }

  return null;
}

async function getReportAccess(reportTypeCode, role) {
  const normalizedRole = normalizeRole(role);
  const requestedCode = String(reportTypeCode || '').trim();
  const legacyFallbackCode = getLegacyReportTypeCode(requestedCode);

  const result = await pool.query(
    `
    SELECT
      can_view,
      can_generate,
      can_schedule
    FROM report_access_rules
    WHERE report_type_code = $1
      AND role_code = $2
    LIMIT 1
    `,
    [requestedCode, normalizedRole]
  );

  if (result.rowCount > 0) {
    return result.rows[0];
  }

  if (legacyFallbackCode && legacyFallbackCode !== requestedCode) {
    const fallback = await pool.query(
      `
      SELECT
        can_view,
        can_generate,
        can_schedule
      FROM report_access_rules
      WHERE report_type_code = $1
        AND role_code = $2
      LIMIT 1
      `,
      [legacyFallbackCode, normalizedRole]
    );

    if (fallback.rowCount > 0) {
      return fallback.rows[0];
    }
  }

  return {
    can_view: false,
    can_generate: false,
    can_schedule: false,
  };
}

async function dealerHasTenantAccess(userId, tenantId) {
  const result = await pool.query(
    `
    SELECT id
    FROM dealer_tenant_access
    WHERE dealer_user_id = $1::uuid
      AND tenant_id = $2::uuid
      AND is_active = TRUE
    LIMIT 1
    `,
    [userId, tenantId]
  );

  return result.rowCount > 0;
}

async function getTenantById(tenantId) {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      logo_url,
      created_at
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}


function renderReportHtmlByType(reportData) {
  const code = String(
    reportData?.metadata?.resolved_report_type_code ||
    reportData?.report_type_code ||
    ''
  ).trim();

  if (code === 'control_health_report' || code === 'control_status') {
    return renderControlHealthPremiumTemplate(reportData);
  }

  if (code === 'maturity_gap_diagnostic') {
    return renderMaturityGapDiagnosticPremiumTemplate(reportData);
  }

  if (code === 'iso_risk_report') {
    return renderIsoRiskPremiumTemplate(reportData);
  }
  if (code === 'action_plan_report') {
    return renderActionPlanPremiumTemplate(reportData);
  }

  if (code === 'internal_audit_report' || code === 'audit_report') {
    return renderInternalAuditPremiumTemplate(reportData);
  }


  return renderExecutivePremiumTemplate(reportData);
}


function buildReportTitle(reportType, reportTypeCode, period, locale = 'es', profileContext = null) {
  const fallbackTitlesEs = {
    executive_summary: 'Informe para Gerencia',
    executive_iso_status: 'Informe Ejecutivo de Estado ISO',
    audit_report: 'Informe para Auditoría',
    internal_audit_report: 'Informe de Auditoría Interna',
    control_status: 'Informe de Control de Estado',
    control_health_report: 'Informe de Control Health',
    maturity_gap_diagnostic: 'Diagnóstico de Madurez y Brechas',
    iso_risk_report: 'Informe de Riesgos ISO',
    action_plan_report: 'Informe de Plan de Acción',
    platform_client_monthly: 'Informe Mensual de Plataforma por Cliente',
  };

  const fallbackTitlesEn = {
    executive_summary: 'Management Report',
    executive_iso_status: 'ISO Executive Status Report',
    audit_report: 'Audit Report',
    internal_audit_report: 'Internal Audit Report',
    control_status: 'Control Status Report',
    control_health_report: 'Control Health Report',
    maturity_gap_diagnostic: 'Maturity and Gap Diagnostic',
    iso_risk_report: 'ISO Risk Report',
    action_plan_report: 'Action Plan Report',
    platform_client_monthly: 'Monthly Client Platform Report',
  };

  const fallbackTitles = isEnglishLocale(locale) ? fallbackTitlesEn : fallbackTitlesEs;

  const baseTitle =
    profileContext?.report_title ||
    reportType?.name ||
    fallbackTitles[reportTypeCode] ||
    (isEnglishLocale(locale) ? 'Executive Report' : 'Informe Ejecutivo');

  if (!period) return baseTitle;

  return `${baseTitle} - ${period}`;
}

async function generatePdfFromHtml(html, outputPath, context = {}) {
  return renderHtmlToPdf({
    html,
    outputPath,
    requestId: context.requestId || null,
    format: process.env.PDF_RENDER_FORMAT || 'A4',
    printBackground: process.env.PDF_RENDER_PRINT_BACKGROUND !== 'false',
    timeoutMs: Number(process.env.PDF_RENDER_TIMEOUT_MS || 300000),
    metadata: { templateName: context.templateName || 'report-export', ...(context.metadata || {}) },
  });
}

async function resolveTargetTenantId({ role, userId, userTenantId, requestedTenantId }) {
  if (isPlatformRole(role)) {
    return requestedTenantId || userTenantId || null;
  }

  if (isDealerRole(role)) {
    return requestedTenantId || null;
  }

  return userTenantId || null;
}

async function ensureTargetTenantAccess({ role, userId, userTenantId, targetTenantId }) {
  if (!targetTenantId) {
    throw new Error('tenant_id es obligatorio para generar este informe');
  }

  if (isPlatformRole(role)) {
    return true;
  }

  if (isDealerRole(role)) {
    const hasAccess = await dealerHasTenantAccess(userId, targetTenantId);

    if (!hasAccess) {
      throw new Error('El dealer no tiene acceso a este cliente');
    }

    return true;
  }

  if (!userTenantId || String(userTenantId) !== String(targetTenantId)) {
    throw new Error('No autorizado para generar informes sobre este tenant');
  }

  return true;
}

// =====================================================
// GET /api/reports/types
// Devuelve reportes disponibles según perfil del usuario.
// =====================================================
router.get('/types', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const tenantId = getUserTenantId(req.user);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    const result = await pool.query(
      `
      SELECT
        rt.code,
        rt.name,
        rt.description,
        rt.category,
        rt.default_format,
        rt.template_key,
        rt.sort_order,
        rt.metadata,
        rar.can_view,
        rar.can_generate,
        rar.can_schedule
      FROM report_types rt
      INNER JOIN report_access_rules rar
        ON rar.report_type_code = rt.code
      WHERE rt.is_active = TRUE
        AND rar.role_code = $1
        AND rar.can_view = TRUE
      ORDER BY rt.sort_order ASC, rt.name ASC
      `,
      [role]
    );

    return res.json({
      ok: true,
      scope: {
        user_id: userId,
        tenant_id: tenantId,
        locale,
        original_role: originalRole || null,
        role,
        is_platform: isPlatformRole(role),
        is_dealer: isDealerRole(role),
      },
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT TYPES:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo tipos de reportes disponibles',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/reports/clients
// Para superadmin/platform_admin: devuelve todos los tenants.
// Para dealer: devuelve solo clientes asignados.
// Para usuario tenant: devuelve su propio tenant.
// =====================================================
router.get('/clients', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const tenantId = getUserTenantId(req.user);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (isPlatformRole(role)) {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          logo_url,
          created_at
        FROM tenants
        ORDER BY name ASC
        `
      );

      return res.json({
        ok: true,
        scope: {
          original_role: originalRole || null,
          role,
          locale,
          mode: 'platform',
        },
        data: result.rows,
      });
    }

    if (isDealerRole(role)) {
      const result = await pool.query(
        `
        SELECT
          t.id,
          t.name,
          t.logo_url,
          dta.created_at AS assigned_at
        FROM dealer_tenant_access dta
        INNER JOIN tenants t
          ON t.id = dta.tenant_id
        WHERE dta.dealer_user_id = $1::uuid
          AND dta.is_active = TRUE
        ORDER BY t.name ASC
        `,
        [userId]
      );

      return res.json({
        ok: true,
        scope: {
          original_role: originalRole || null,
          role,
          locale,
          mode: 'dealer',
        },
        data: result.rows,
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'El usuario no tiene tenant_id asociado',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        logo_url,
        created_at
      FROM tenants
      WHERE id = $1::uuid
      `,
      [tenantId]
    );

    return res.json({
      ok: true,
      scope: {
        original_role: originalRole || null,
        role,
        locale,
        mode: 'tenant',
      },
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT CLIENTS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo clientes disponibles para reportes',
      ...errorDetail(error),
    });
  }
});


// =====================================================
// GET /api/reports/standards
// Devuelve normas activas del tenant con cobertura para informes.
// Usado por Exportes para selector ISO/version y badges de cobertura.
// =====================================================
router.get('/standards', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      tenant_id,
      report_type_code,
    } = req.query || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    const targetTenantId = await resolveTargetTenantId({
      role,
      userId,
      userTenantId,
      requestedTenantId: tenant_id || null,
    });

    await ensureTargetTenantAccess({
      role,
      userId,
      userTenantId,
      targetTenantId,
    });

    const tenant = await getTenantById(targetTenantId);

    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: 'Cliente no encontrado',
      });
    }

    const coverage = await listCoverageForTenant({
      tenantId: targetTenantId,
      reportTypeCode: report_type_code || 'executive_iso_status',
    });

    const data = coverage.map((item) => ({
      tenant_id: item.tenant_id,
      standard_code: item.standard_code,
      version_code: item.version_code,
      label: item.display_name || `${item.standard_code}:${item.version_code}`,
      display_name: item.display_name || `${item.standard_code}:${item.version_code}`,

      coverage_status: item.coverage_status,
      coverage_label: item.coverage_label,
      coverage_severity: item.coverage_severity,

      can_generate_executive: item.can_generate_executive,
      can_generate_operational: item.can_generate_operational,
      can_generate_audit: item.can_generate_audit,

      profile_key: item.profile_context?.profile_key || null,
      is_default_profile: item.profile_context?.is_default_profile === true,
      management_system: item.profile_context?.management_system || null,
      executive_focus: item.profile_context?.executive_focus || null,
      risk_language: item.profile_context?.risk_language || null,
      evidence_focus: item.profile_context?.evidence_focus || null,
      report_title: item.profile_context?.report_title || null,
      chart_priority: item.profile_context?.chart_priority || [],

      metrics: item.metrics,
      warnings: item.warnings || [],
    }));

    return res.json({
      ok: true,
      scope: {
        original_role: originalRole || null,
        role,
        locale,
        tenant_id: userTenantId || null,
        target_tenant_id: targetTenantId,
        is_platform: isPlatformRole(role),
        is_dealer: isDealerRole(role),
      },
      tenant,
      data,
    });
  } catch (error) {
    console.error('ERROR GET REPORT STANDARDS:', error);

    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Error obteniendo normas disponibles para reportes',
      code: error.code || 'REPORT_STANDARDS_ERROR',
      ...errorDetail(error),
    });
  }
});


// =====================================================
// GET /api/reports/exports
// Historial de informes generados con filtros.
// =====================================================
router.get('/exports', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      report_type_code,
      tenant_id,
      q,
      date_from,
      date_to,
      status,
      limit,
    } = req.query || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    const params = [];
    const where = [];

    function addParam(value) {
      params.push(value);
      return `$${params.length}`;
    }

    if (isPlatformRole(role)) {
      if (tenant_id) {
        where.push(`re.tenant_id = ${addParam(tenant_id)}::uuid`);
      }
    } else if (isDealerRole(role)) {
      where.push(`
        re.tenant_id IN (
          SELECT dta.tenant_id
          FROM dealer_tenant_access dta
          WHERE dta.dealer_user_id = ${addParam(userId)}::uuid
            AND dta.is_active = TRUE
        )
      `);

      if (tenant_id) {
        where.push(`re.tenant_id = ${addParam(tenant_id)}::uuid`);
      }
    } else {
      if (!userTenantId) {
        return res.status(400).json({
          ok: false,
          error: 'El usuario no tiene tenant_id asociado',
        });
      }

      where.push(`re.tenant_id = ${addParam(userTenantId)}::uuid`);
    }

    if (report_type_code) {
      where.push(`re.report_type_code = ${addParam(report_type_code)}`);
    }

    if (status) {
      where.push(`LOWER(COALESCE(re.status, '')) = LOWER(${addParam(status)})`);
    }

    if (date_from) {
      where.push(`re.generated_at >= ${addParam(date_from)}::date`);
    }

    if (date_to) {
      where.push(`re.generated_at < (${addParam(date_to)}::date + INTERVAL '1 day')`);
    }

    if (q) {
      const search = `%${q}%`;
      const p = addParam(search);

      where.push(`
        (
          re.report_title ILIKE ${p}
          OR re.report_type_code ILIKE ${p}
          OR t.name ILIKE ${p}
          OR u.email ILIKE ${p}
          OR COALESCE(u.full_name, u.name, '') ILIKE ${p}
        )
      `);
    }

    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);

    const sql = `
      SELECT
        re.id,
        re.tenant_id,
        t.name AS tenant_name,
        re.requested_by,
        COALESCE(u.full_name, u.name, u.email, 'Usuario no identificado') AS requested_by_name,
        u.email AS requested_by_email,
        re.report_type_code,
        COALESCE(rt.name, re.report_title) AS report_type_name,
        re.report_title,
        re.report_format,
        re.status,
        re.file_url,
        re.generated_at
      FROM report_exports re
      LEFT JOIN tenants t
        ON t.id = re.tenant_id
      LEFT JOIN users u
        ON u.id = re.requested_by
      LEFT JOIN report_types rt
        ON rt.code = re.report_type_code
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY re.generated_at DESC
      LIMIT ${safeLimit}
    `;

    const result = await pool.query(sql, params);
    const rows = result.rows.map((row) => ({
      ...row,
      legacy_file_url: row.file_url,
      file_url: getReportDownloadUrl(row.id),
    }));

    return res.json({
      ok: true,
      scope: {
        original_role: originalRole || null,
        role,
        locale,
        tenant_id: userTenantId || null,
        is_platform: isPlatformRole(role),
        is_dealer: isDealerRole(role),
      },
      data: rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT EXPORTS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo historial de informes',
      ...errorDetail(error),
    });
  }
});


// =====================================================
// GET /api/reports/download/:id
// Descarga autenticada de reportes generados.
// =====================================================
router.get('/download/:id', auth, async (req, res) => {
  try {
    const exportId = String(req.params.id || '').trim();
    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exportId)) {
      return res.status(400).json({ ok: false, error: 'Reporte no especificado' });
    }

    const result = await pool.query(
      `
      SELECT
        re.id,
        re.tenant_id,
        re.requested_by,
        re.report_title,
        re.report_format,
        re.file_url,
        EXISTS (
          SELECT 1
          FROM dealer_tenant_access dta
          WHERE dta.tenant_id = re.tenant_id
            AND dta.dealer_user_id = $2::uuid
            AND dta.is_active = TRUE
        ) AS dealer_can_access
      FROM report_exports re
      WHERE re.id = $1::uuid
      LIMIT 1
      `,
      [exportId, userId]
    );

    const row = result.rows[0];

    if (!row || !canAccessReportExport({ role, userId, userTenantId, row })) {
      return res.status(404).json({ ok: false, error: 'Reporte no disponible' });
    }

    const filePath = resolveReportFilePath(row.tenant_id, row.file_url);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Archivo de reporte no disponible' });
    }

    const downloadName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', row.report_format === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('ERROR DOWNLOAD REPORT:', {
      request_id: req.requestId || null,
      message: error.message,
    });

    return res.status(500).json({
      ok: false,
      error: 'Error descargando reporte',
      request_id: req.requestId || null,
    });
  }
});


// =====================================================
// CICLO DE VIDA EN REPORTES PREMIUM
// Agrega una página de trazabilidad auditable al PDF.
// =====================================================
function escapeReportHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatReportDateTime(value) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value || '-');
  }
}

function lifecycleStageName(code) {
  const map = {
    diagnostico: 'Diagnóstico',
    diseno_planificacion: 'Diseño / Planificación',
    implementacion: 'Implementación',
    verificacion_auditoria: 'Verificación / Auditoría',
    certificacion: 'Certificación',
    mejora_continua: 'Mejora Continua',
    suspendida_fuera_alcance: 'Suspendida / Fuera de alcance',
  };

  return map[String(code || '').toLowerCase()] || code || 'Sin etapa';
}

function lifecycleStatusLabel(value) {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('rechaz')) return 'Rechazado';
  if (raw.includes('reject')) return 'Rechazado';
  if (raw.includes('confirm')) return 'Confirmado';
  if (raw.includes('aprobad')) return 'Aprobado';
  if (raw.includes('aprob')) return 'Aprobado';

  return value || 'Pendiente';
}

function quoteLifecycleIdentifier(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

async function getLifecycleHistoryTableForReports() {
  const candidates = [
    'standard_lifecycle_stage_requests',
    'tenant_lifecycle_stage_requests',
    'lifecycle_stage_requests',
    'standard_lifecycle_requests',
  ];

  const result = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY array_position($1, table_name)
    LIMIT 1
    `,
    [candidates]
  );

  return result.rows[0]?.table_name || null;
}

async function getLifecycleTableColumnsForReports(tableName) {
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function lifecycleColumnExpr(columns, candidates, fallbackSql) {
  const found = candidates.find((column) => columns.has(column));
  return found ? `r.${quoteLifecycleIdentifier(found)}` : fallbackSql;
}

async function getLifecycleHistoryForReport(tenantId, limit = 12) {
  try {
    const tableName = await getLifecycleHistoryTableForReports();

    if (!tableName) {
      return [];
    }

    const columns = await getLifecycleTableColumnsForReports(tableName);
    const tableRef = quoteLifecycleIdentifier(tableName);

    const tenantExpr = lifecycleColumnExpr(columns, ['tenant_id'], '$1::uuid');
    const standardExpr = lifecycleColumnExpr(columns, ['standard_code', 'iso', 'iso_code'], 'NULL');
    const operationExpr = lifecycleColumnExpr(columns, ['operation_id'], 'NULL');
    const fromStageExpr = lifecycleColumnExpr(columns, ['from_stage_code', 'from_stage'], 'NULL');
    const toStageExpr = lifecycleColumnExpr(columns, ['to_stage_code', 'to_stage', 'pending_stage_code'], 'NULL');
    const statusExpr = lifecycleColumnExpr(columns, ['request_status', 'status'], "'pendiente'");
    const reasonExpr = lifecycleColumnExpr(columns, ['request_reason', 'reason', 'comment'], 'NULL');
    const requestedAtExpr = lifecycleColumnExpr(columns, ['requested_at', 'created_at'], 'NULL');
    const reviewedAtExpr = lifecycleColumnExpr(columns, ['reviewed_at', 'updated_at'], 'NULL');
    const reviewCommentExpr = lifecycleColumnExpr(columns, ['review_comment', 'review_notes'], 'NULL');
    const requestedByExpr = lifecycleColumnExpr(columns, ['requested_by', 'created_by', 'user_id'], 'NULL');
    const reviewedByExpr = lifecycleColumnExpr(columns, ['reviewed_by', 'updated_by'], 'NULL');

    const safeLimit = Math.min(Math.max(Number(limit || 12), 1), 30);

    const sql = `
      SELECT
        ${standardExpr}::text AS standard_code,
        ${operationExpr}::text AS operation_id,
        op.name AS operation_name,
        ${fromStageExpr}::text AS from_stage_code,
        ${toStageExpr}::text AS to_stage_code,
        ${statusExpr}::text AS request_status,
        ${reasonExpr}::text AS request_reason,
        ${requestedAtExpr} AS requested_at,
        ${reviewedAtExpr} AS reviewed_at,
        ${reviewCommentExpr}::text AS review_comment,
        COALESCE(ru.full_name, ru.name, ru.email) AS requested_by_name,
        COALESCE(vu.full_name, vu.name, vu.email) AS reviewed_by_name
      FROM ${tableRef} r
      LEFT JOIN tenant_operations op
        ON op.id::text = ${operationExpr}::text
       AND op.tenant_id::text = ${tenantExpr}::text
      LEFT JOIN users ru
        ON ru.id::text = ${requestedByExpr}::text
      LEFT JOIN users vu
        ON vu.id::text = ${reviewedByExpr}::text
      WHERE ${tenantExpr} = $1::uuid
      ORDER BY COALESCE(${requestedAtExpr}, ${reviewedAtExpr}) DESC NULLS LAST
      LIMIT ${safeLimit}
    `;

    const result = await pool.query(sql, [tenantId]);

    return result.rows.map((row) => ({
      ...row,
      from_stage_name: lifecycleStageName(row.from_stage_code),
      to_stage_name: lifecycleStageName(row.to_stage_code),
      request_status_label: lifecycleStatusLabel(row.request_status),
    }));
  } catch (error) {
    console.error('REPORT LIFECYCLE HISTORY ERROR:', error.message);
    return [];
  }
}


function getReportPublicBaseUrl() {
  return (
    process.env.REPORT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    'https://181.212.166.187:8443'
  ).replace(/\/+$/, '');
}

function buildReportImageCandidates(rawSrc) {
  const raw = String(rawSrc || '').trim();
  const base = getReportPublicBaseUrl();

  if (!raw) return [];

  const candidates = [];

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('file:')
  ) {
    candidates.push(raw);
  }

  if (raw.startsWith('/')) {
    candidates.push(`${base}${raw}`);
  } else {
    candidates.push(`${base}/uploads/${raw}`);
    candidates.push(`${base}/uploads/logos/${raw}`);
    candidates.push(`${base}/uploads/tenants/${raw}`);
    candidates.push(`${base}/uploads/tenant-logos/${raw}`);
    candidates.push(`${base}/${raw}`);
    candidates.push(raw);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function renderReportLogo(rawSrc, fallbackText, align = 'left') {
  const candidates = buildReportImageCandidates(rawSrc);
  const first = candidates[0] || '';
  const fallback1 = candidates[1] || '';
  const fallback2 = candidates[2] || '';

  const safeText = escapeReportHtml(fallbackText || 'Logo');
  const textAlign = align === 'right' ? 'right' : 'left';
  const logoRole = align === 'right' ? 'tenant' : 'tcdx';

  if (!first) {
    return `
      <div data-logo-role="${logoRole}" data-logo-loaded="fallback" style="width:42mm;height:17mm;display:flex;align-items:center;justify-content:${align === 'right' ? 'flex-end' : 'flex-start'};">
        <div style="font-size:13px;font-weight:800;color:#0B2F4F;text-align:${textAlign};line-height:1.1;">${safeText}</div>
      </div>
    `;
  }

  const onError = [
    "if(!this.dataset.try1&&this.dataset.fallback1){this.dataset.try1='1';this.src=this.dataset.fallback1;return;}",
    "if(!this.dataset.try2&&this.dataset.fallback2){this.dataset.try2='1';this.src=this.dataset.fallback2;return;}",
    "this.style.display='none';",
    "if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}"
  ].join('');

  return `
    <div style="width:42mm;height:17mm;display:flex;align-items:center;justify-content:${align === 'right' ? 'flex-end' : 'flex-start'};">
      <img
        src="${escapeReportHtml(first)}"
        data-fallback1="${escapeReportHtml(fallback1)}"
        data-fallback2="${escapeReportHtml(fallback2)}"
        data-logo-role="${logoRole}"
        data-logo-source="${escapeReportHtml(first)}"
        onerror="${onError}"
        style="display:block;max-width:42mm;max-height:17mm;object-fit:contain;"
      />
      <div style="display:none;width:42mm;height:17mm;align-items:center;justify-content:${align === 'right' ? 'flex-end' : 'flex-start'};font-size:13px;font-weight:800;color:#0B2F4F;text-align:${textAlign};line-height:1.1;">${safeText}</div>
    </div>
  `;
}

function getTenantLogoSourceForReport(reportData) {
  const tenant = reportData?.tenant || {};

  return (
    tenant.report_logo_url ||
    tenant.logo_url ||
    tenant.logo_path ||
    tenant.client_logo_url ||
    tenant.logo ||
    tenant.brand_logo_url ||
    ''
  );
}

function getTcdxLogoSourceForReport() {
  return (
    process.env.REPORT_TCDX_LOGO_URL ||
    process.env.TCDX_LOGO_URL ||
    'https://181.212.166.187:8443/logo.png'
  );
}

function renderPremiumExtraHeader(reportData, title, subtitle = '') {
  const tenant = reportData?.tenant || {};
  const tenantName = tenant.name || 'Cliente';

  return `
    <div class="tcdxExtraHeader">
      <div class="tcdxExtraLogoLeft">
        ${renderReportLogo(getTcdxLogoSourceForReport(), 'TCDX by Tecdex', 'left')}
      </div>

      <div class="tcdxExtraHeaderCenter">
        <div class="tcdxExtraKicker">TCDX by Tecdex</div>
        <h1>${escapeReportHtml(title)}</h1>
        <p>${escapeReportHtml(subtitle)}</p>
      </div>

      <div class="tcdxExtraLogoRight">
        ${renderReportLogo(getTenantLogoSourceForReport(reportData), tenantName, 'right')}
      </div>
    </div>
  `;
}

function renderPremiumExtraFooter(pageLabel = 'Página adicional') {
  return `
    <div class="tcdxExtraFooter">
      <div>
        <strong>Documento confidencial.</strong>
        <span> Uso restringido al cliente y equipo autorizado.</span>
      </div>
      <div class="tcdxExtraFooterCenter">
        ${escapeReportHtml(pageLabel)}
      </div>
      <div class="tcdxExtraFooterRight">
        Página __TCDX_EXTRA_PAGE__ de __TCDX_TOTAL_PAGES__
      </div>
    </div>
  `;
}

function injectPremiumPdfQualityStyles(html) {
  const css = `
    <style id="tcdx-pdf-quality-fix">
      @page {
        size: Letter;
        margin: 0;
      }

      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .reportPage,
      .tcdxExtraPage {
        width: 216mm !important;
        height: 279mm !important;
        min-height: 279mm !important;
        max-height: 279mm !important;
        box-sizing: border-box !important;
        page-break-after: always !important;
        break-after: page !important;
        position: relative !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }

      .reportPage:last-child,
      .tcdxExtraPage:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .header,
      .tcdxExtraHeader,
      .footer,
      .tcdxExtraFooter {
        background: #0B2F4F !important;
        color: #ffffff !important;
      }

      .header {
        height: 26mm !important;
        min-height: 26mm !important;
        max-height: 26mm !important;
        box-sizing: border-box !important;
        padding: 5mm 10mm 4mm !important;
        border-bottom: none !important;
      }

      .footer {
        height: 16mm !important;
        min-height: 16mm !important;
        max-height: 16mm !important;
        box-sizing: border-box !important;
        padding: 3.5mm 10mm !important;
        border-top: none !important;
      }

      .footer *,
      .footerMuted,
      .pageNumber,
      .documentTitle,
      .documentDate {
        color: #ffffff !important;
      }

      .pageContent {
        box-sizing: border-box !important;
        height: 237mm !important;
        max-height: 237mm !important;
        overflow: hidden !important;
        padding: 7mm 10mm 5mm !important;
      }

      .logoHolder,
      .brandLogo,
      .clientLogo {
        background: #ffffff !important;
        border-radius: 12px !important;
        padding: 4px 8px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      .logoHolder img,
      .brandLogo img,
      .clientLogo img,
      .tcdxExtraLogoLeft img,
      .tcdxExtraLogoRight img {
        max-width: 42mm !important;
        max-height: 16mm !important;
        object-fit: contain !important;
      }

      .logoFallbackText,
      .brandTextLockup {
        color: #0B2F4F !important;
      }

      .sectionCard,
      .compact,
      .kpiCard,
      .recommendation,
      .metricLine,
      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .kpiCard {
        min-height: 28mm !important;
      }

      .tcdxExtraPage {
        padding: 0 !important;
        font-family: Arial, Helvetica, sans-serif;
        color: #0f172a;
      }

      .tcdxExtraHeader {
        height: 26mm;
        min-height: 26mm;
        max-height: 26mm;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 45mm 1fr 45mm;
        gap: 7mm;
        align-items: center;
        padding: 5mm 10mm 4mm;
      }

      .tcdxExtraHeaderCenter {
        text-align: center;
      }

      .tcdxExtraHeaderCenter h1 {
        margin: 1mm 0 1mm;
        color: #ffffff !important;
        font-size: 18px;
        line-height: 1.05;
        font-weight: 800;
      }

      .tcdxExtraHeaderCenter p {
        margin: 0;
        color: #dbeafe !important;
        font-size: 10.5px;
      }

      .tcdxExtraKicker {
        color: #bfdbfe !important;
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 800;
      }

      .tcdxExtraContent {
        height: 237mm;
        max-height: 237mm;
        box-sizing: border-box;
        padding: 7mm 10mm 5mm;
        overflow: hidden;
      }

      .tcdxExtraFooter {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 16mm;
        min-height: 16mm;
        max-height: 16mm;
        box-sizing: border-box;
        padding: 3.5mm 10mm;
        display: grid;
        grid-template-columns: 1.2fr 1fr 0.65fr;
        gap: 6mm;
        align-items: center;
        color: #ffffff;
        font-size: 9.3px;
      }

      .tcdxExtraFooterCenter {
        text-align: center;
        color: #dbeafe;
      }

      .tcdxExtraFooterRight {
        text-align: right;
        font-weight: 700;
      }

      .tcdxExtraKpiGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 9px;
        margin-bottom: 12px;
      }

      .tcdxExtraMiniCard,
      .tcdxAiBox {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
      }

      .tcdxExtraMiniCard {
        padding: 11px;
      }

      .tcdxExtraMiniCardLabel {
        font-size: 8.8px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .tcdxExtraMiniCardValue {
        font-size: 22px;
        font-weight: 800;
        color: #0B2F4F;
        margin-top: 4px;
      }

      .tcdxExtraTableWrap {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
      }

      .tcdxExtraTable {
        width: 100%;
        border-collapse: collapse;
        font-size: 8.8px;
      }

      .tcdxExtraTable th {
        background: #f1f5f9;
        color: #334155;
        text-align: left;
        padding: 5px;
        border-bottom: 1px solid #e2e8f0;
      }

      .tcdxExtraTable td {
        padding: 5px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: top;
      }

      .tcdxAiGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .tcdxAiBox {
        padding: 13px;
      }

      .tcdxAiBox h3 {
        margin: 0 0 7px;
        color: #0B2F4F;
        font-size: 13px;
        font-weight: 800;
      }

      .tcdxAiBox p,
      .tcdxAiBox li {
        font-size: 10.8px;
        line-height: 1.42;
        color: #334155;
      }

      .tcdxAiBox ul {
        margin: 0;
        padding-left: 17px;
      }
    </style>
  `;

  if (String(html || '').includes('id="tcdx-pdf-quality-fix"')) {
    return html;
  }

  if (String(html || '').includes('</head>')) {
    return String(html).replace('</head>', `${css}</head>`);
  }

  return `${css}${html || ''}`;
}

function normalizeReportList(items, limit = 6) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const out = [];

  for (const item of items) {
    const value = String(item || '').trim();
    const key = value.toLowerCase();

    if (!value || seen.has(key)) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= limit) break;
  }

  return out;
}

function buildFallbackAiReportAddendum(reportData) {
  const stats = reportData?.stats || {};
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const actions = stats.action_plans || {};
  const lifecycle = Array.isArray(reportData?.lifecycle_history) ? reportData.lifecycle_history : [];

  const controlsCritical = Number(controls.critical_controls || 0);
  const controlsWarning = Number(controls.warning_controls || 0);
  const pendingEvidences = Number(evidences.pending_evidences || 0);
  const criticalFindings = Number(findings.critical_findings || 0);
  const overdueActions = Number(actions.overdue_actions || 0);

  const priorities = [];

  if (controlsCritical > 0) {
    priorities.push(`Atender ${controlsCritical} control(es) deteriorado(s) antes de declarar avance de madurez.`);
  }

  if (controlsWarning > 0) {
    priorities.push(`Convertir ${controlsWarning} control(es) en atención en un plan operativo con responsables y fechas.`);
  }

  if (pendingEvidences > 0) {
    priorities.push(`Regularizar ${pendingEvidences} evidencia(s) pendiente(s) para fortalecer trazabilidad documental.`);
  }

  if (criticalFindings > 0) {
    priorities.push(`Escalar ${criticalFindings} hallazgo(s) crítico(s) a comité o responsable de cumplimiento.`);
  }

  if (overdueActions > 0) {
    priorities.push(`Reprogramar o escalar ${overdueActions} acción(es) vencida(s).`);
  }

  if (lifecycle.length > 0) {
    priorities.push('Revisar los últimos movimientos de ciclo de vida y asegurar que cada avance tenga respaldo documental.');
  }

  if (priorities.length === 0) {
    priorities.push('Mantener seguimiento mensual de controles, evidencias, auditorías y ciclo de vida.');
  }

  return {
    source: 'fallback-report-intelligence',
    headline: 'Lectura ejecutiva generada a partir del estado real del sistema.',
    summary: [
      `El informe consolida salud de controles, evidencias, hallazgos, acciones y trazabilidad del ciclo de vida.`,
      `La prioridad debe estar en sostener evidencia objetiva, reducir pendientes y mantener trazabilidad auditable de los avances.`
    ].join(' '),
    priorities: normalizeReportList(priorities, 6),
    risks: normalizeReportList([
      controlsCritical > 0 ? 'Persisten controles deteriorados que pueden afectar avance de certificación.' : '',
      pendingEvidences > 0 ? 'La falta de evidencia pendiente reduce la solidez del cumplimiento demostrado.' : '',
      criticalFindings > 0 ? 'Los hallazgos críticos abiertos pueden convertirse en no conformidades si no se tratan oportunamente.' : '',
      lifecycle.length === 0 ? 'No existe aún trazabilidad suficiente de movimientos de ciclo de vida.' : '',
    ], 4),
    decisions: normalizeReportList([
      'Definir responsables y fechas de cierre para los puntos críticos.',
      'Usar la trazabilidad del ciclo de vida como evidencia de gobierno del sistema.',
      'Priorizar próximos esfuerzos según salud, evidencia y hallazgos abiertos.',
    ], 4),
  };
}

function getSeniorAuditorDisplayText(item) {
  return String(
    item?.recommended_action ||
      item?.summary ||
      item?.observation ||
      item?.title ||
      ''
  ).trim();
}

function mergeAiReportAddendumWithSenior(addendum, reportData) {
  const seniorAuditor = reportData?.ai?.senior_auditor;

  if (!seniorAuditor || typeof seniorAuditor !== 'object') {
    return addendum;
  }

  const seniorSummary = String(
    seniorAuditor?.summary?.executive_message || ''
  ).trim();
  const taskLines = Array.isArray(seniorAuditor.suggested_tasks)
    ? seniorAuditor.suggested_tasks.map(getSeniorAuditorDisplayText)
    : [];
  const insightLines = Array.isArray(seniorAuditor.insights)
    ? seniorAuditor.insights.map(getSeniorAuditorDisplayText)
    : [];
  const observationLines = Array.isArray(seniorAuditor.audit_observations)
    ? seniorAuditor.audit_observations.map(getSeniorAuditorDisplayText)
    : [];

  const source = addendum.source?.includes('senior-auditor')
    ? addendum.source
    : `${addendum.source || 'report-intelligence'}+senior-auditor`;

  return {
    ...addendum,
    source,
    summary: cleanReportSentenceText(
      [addendum.summary, seniorSummary].filter(Boolean).join(' '),
      900
    ),
    priorities: normalizeReportList(
      [...taskLines, ...(addendum.priorities || [])],
      6
    ),
    risks: normalizeReportList(
      [...insightLines, ...(addendum.risks || [])],
      4
    ),
    decisions: normalizeReportList(
      [...observationLines, ...(addendum.decisions || [])],
      4
    ),
  };
}

async function syncReportSeniorAuditorSuggestionsSafe({
  tenantId,
  userId,
  reportTypeCode,
  period,
  reportData,
}) {
  try {
    const result = await persistSeniorAuditorSuggestions({
      tenantId,
      seniorAuditor: reportData?.ai?.senior_auditor,
      sourceModule: 'reports',
      sourceEntityType: 'tenant',
      sourceEntityId: tenantId,
      inputPayload: {
        report_type_code: reportTypeCode,
        period: period || null,
        source: 'report_generation',
      },
      createdBy: userId,
    });

    return summarizeSeniorSuggestionSync(result);
  } catch (error) {
    console.error('REPORT SENIOR AUDITOR SUGGESTION SYNC ERROR:', error.message);
    return {
      created: 0,
      reused: 0,
      skipped: 0,
      error: 'No fue posible sincronizar sugerencias del auditor senior',
    };
  }
}

async function buildAiReportAddendum(reportData, aiOptions = {}) {
  const fallback = buildFallbackAiReportAddendum(reportData);
  const modelMode = normalizeReportModelMode(aiOptions.model_mode);

  try {
    const existingAi = reportData?.ai?.ai_enrichment;
    const ai = existingAi && typeof existingAi === 'object'
      ? existingAi
      : null;
    const standards = Array.isArray(reportData?.standards)
      ? reportData.standards.map((item) => item.code || item.standard_code || item).filter(Boolean)
      : [];
    const aiResult = ai || await buildReportAiEnrichment({
        tenantId: reportData?.tenant?.id || reportData?.tenant_id || '',
        standardCode: standards.length === 1 ? standards[0] : null,
        reportType: reportData?.report_type_code || reportData?.reportTypeCode || 'executive',
        depth: aiOptions.depth || (modelMode === 'deep' ? 'deep' : 'executive'),
        includeDeepLlm: aiOptions.include_deep_llm === true,
        modelMode,
        useLlm: aiOptions.use_llm === true,
        useRag: aiOptions.use_rag !== false,
        useWeb: aiOptions.use_web === true,
        useDrive: aiOptions.use_drive ?? false,
        quality: aiOptions.quality || null,
        requestId: aiOptions.request_id || null,
      });
    const structured = aiResult.structured_result || {};
    const actions = Array.isArray(aiResult.recommended_actions) ? aiResult.recommended_actions : [];
    const correctiveActions = Array.isArray(aiResult.corrective_actions) ? aiResult.corrective_actions : [];
    const rootCauseAnalysis = Array.isArray(aiResult.root_cause_analysis) ? aiResult.root_cause_analysis : [];
    const evidenceRequests = Array.isArray(aiResult.evidence_requests) ? aiResult.evidence_requests : [];
    const auditQuestions = Array.isArray(aiResult.audit_questions) ? aiResult.audit_questions : [];
    const managementFocus = Array.isArray(aiResult.management_focus) ? aiResult.management_focus : [];
    const source = aiResult.source || aiResult.metrics?.source || (aiResult.llm_used ? 'ai-engine-v2-report-llm' : 'ai-engine-v2-report-fast');

    return mergeAiReportAddendumWithSenior({
      source,
      headline: String(aiResult.auditor_opinion || structured.auditor_opinion || fallback.headline || 'Resumen ejecutivo IA').trim(),
      summary: String(aiResult.executive_narrative || aiResult.executive_summary || structured.executive_narrative || structured.executive_summary || aiResult.answer || fallback.summary || '').trim(),
      priorities: normalizeReportList([
        ...managementFocus,
        ...actions.map((item) => item.title || item.description),
        ...correctiveActions.map((item) => item.title || item.description),
        ...fallback.priorities,
      ], 6),
      risks: normalizeReportList([
        structured.risk_impact,
        ...rootCauseAnalysis.map((item) => item.risk_if_not_corrected || item.issue),
        ...((structured.audit_readiness || {}).auditor_concerns || []),
        ...fallback.risks,
      ], 4),
      decisions: normalizeReportList([
        (structured.audit_readiness || {}).reason,
        ...correctiveActions.map((item) => item.effectiveness_check || item.closure_criteria?.[0]),
        ...fallback.decisions,
      ], 4),
      root_cause_analysis: rootCauseAnalysis,
      corrective_actions: correctiveActions,
      evidence_requests: evidenceRequests,
      audit_questions: auditQuestions,
      management_focus: managementFocus,
      ai_metrics: {
        ...(aiResult.metrics || {}),
        model_mode_used: aiResult.model_mode_used || modelMode,
        llm_used: aiResult.llm_used === true,
        llm_provider: aiResult.llm_provider || aiResult.engine?.llm_provider || null,
        model_name: aiResult.model_name || aiResult.engine?.model || null,
        source,
        duration_ms: aiResult.duration_ms ?? aiResult.metrics?.duration_ms ?? null,
        ai_enrichment_failed: aiResult.ai_enrichment_failed === true,
        fallback_used: aiResult.fallback_used === true,
      },
      model_mode_used: aiResult.model_mode_used || modelMode,
      llm_used: aiResult.llm_used === true,
      llm_provider: aiResult.llm_provider || aiResult.engine?.llm_provider || null,
      model_name: aiResult.model_name || aiResult.engine?.model || null,
      ai_enrichment_failed: aiResult.ai_enrichment_failed === true,
      fallback_used: aiResult.fallback_used === true,
    }, reportData);
  } catch (error) {
    console.error('REPORT AI ADDENDUM ERROR:', error.message);
    return mergeAiReportAddendumWithSenior({
      ...fallback,
      model_mode_used: modelMode,
      ai_enrichment_failed: true,
      fallback_used: true,
    }, reportData);
  }
}


function cleanReportSentenceText(value, maxLength = 620) {
  let text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/([.:;!?])(?=[A-ZÁÉÍÓÚÑ0-9])/g, '$1 ')
    .replace(/(relevantes:)(\d)/gi, '$1 $2')
    .replace(/(recomendadas:)(\d)/gi, '$1 $2')
    .trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
    text = `${text}...`;
  }

  return text;
}

function buildUsefulReportExecutiveSummary(reportData) {
  const stats = reportData?.stats || {};
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const actions = stats.action_plans || {};
  const lifecycle = Array.isArray(reportData?.lifecycle_history)
    ? reportData.lifecycle_history
    : [];

  const score = Number(controls.average_score || 0).toFixed(1);
  const totalControls = Number(controls.total_controls || 0);
  const warningControls = Number(controls.warning_controls || 0);
  const criticalControls = Number(controls.critical_controls || 0);
  const pendingEvidences = Number(evidences.pending_evidences || 0);
  const openFindings = Number(findings.open_findings || 0);
  const overdueActions = Number(actions.overdue_actions || 0);

  const parts = [
    `El periodo evaluado muestra un score consolidado de ${score}% sobre ${totalControls} controles activos.`,
  ];

  if (warningControls > 0) {
    parts.push(`Existen ${warningControls} controles en atención que deben transformarse en un plan operativo priorizado.`);
  }

  if (criticalControls > 0) {
    parts.push(`Se identifican ${criticalControls} controles deteriorados que requieren seguimiento ejecutivo.`);
  }

  if (pendingEvidences > 0) {
    parts.push(`Hay ${pendingEvidences} evidencias pendientes que reducen la solidez documental del cumplimiento.`);
  }

  if (openFindings > 0) {
    parts.push(`Se mantienen ${openFindings} hallazgos abiertos que deben vincularse a responsables, fechas y evidencia de cierre.`);
  }

  if (overdueActions > 0) {
    parts.push(`Existen ${overdueActions} acciones vencidas que deben escalarse o reprogramarse.`);
  }

  if (lifecycle.length > 0) {
    parts.push(`El historial de ciclo de vida registra ${lifecycle.length} movimientos recientes útiles como trazabilidad de gobierno.`);
  }

  return parts.join(' ');
}

function isLowQualityAiReportSummary(value) {
  const text = String(value || '').trim();

  if (!text) return true;
  if (text.length > 700) return true;
  if (/\basoc$/i.test(text)) return true;
  if (/Resumen de salud:/i.test(text) && /Prioridades recomendadas:/i.test(text)) return true;
  if (/Señales relevantes:\s*1\./i.test(text)) return true;

  return false;
}

function polishAiReportAddendum(addendum, reportData) {
  const fallback = buildFallbackAiReportAddendum(reportData);
  const rawSummary = addendum?.summary || fallback.summary;
  const cleanedSummary = cleanReportSentenceText(rawSummary);

  return {
    ...fallback,
    ...addendum,
    headline: cleanReportSentenceText(
      addendum?.headline || fallback.headline || 'Lectura ejecutiva del periodo',
      120
    ),
    summary: isLowQualityAiReportSummary(cleanedSummary)
      ? buildUsefulReportExecutiveSummary(reportData)
      : cleanedSummary,
    priorities: normalizeReportList([
      ...(addendum?.priorities || []),
      ...(fallback.priorities || []),
    ], 6),
    risks: normalizeReportList([
      ...(addendum?.risks || []),
      ...(fallback.risks || []),
    ], 4),
    decisions: normalizeReportList([
      ...(addendum?.decisions || []),
      ...(fallback.decisions || []),
    ], 4),
  };
}

function removeDuplicatedFirstPageAiFocus(html) {
  let out = String(html || '');

  // Este bloque queda duplicado con la página IA y en el PDF actual se pisa con el pie.
  const patterns = [
    /<section[^>]*class="[^"]*sectionCard[^"]*"[^>]*>\s*<h2[^>]*>\s*Foco ejecutivo asistido por IA\s*<\/h2>[\s\S]*?<\/section>/i,
    /<section[^>]*>\s*<h2[^>]*>\s*Foco ejecutivo asistido por IA\s*<\/h2>[\s\S]*?<\/section>/i,
    /<div[^>]*>\s*<h2[^>]*>\s*Foco ejecutivo asistido por IA\s*<\/h2>[\s\S]*?<\/div>/i,
  ];

  for (const pattern of patterns) {
    out = out.replace(pattern, '');
  }

  return out;
}

function normalizePremiumPageCount(html) {
  const raw = String(html || '');
  const reportPages = (raw.match(/class="[^"]*\breportPage\b/g) || []).length;
  const extraPages = (raw.match(/class="[^"]*\btcdxExtraPage\b/g) || []).length;
  const total = reportPages + extraPages;

  if (!total) return raw;

  let out = raw.replace(/Página\s+(\d+)\s+de\s+\d+/g, (_match, page) => {
    return `Página ${page} de ${total}`;
  });

  let currentExtraPage = reportPages + 1;

  out = out.replace(/Página __TCDX_EXTRA_PAGE__ de __TCDX_TOTAL_PAGES__/g, () => {
    const label = `Página ${currentExtraPage} de ${total}`;
    currentExtraPage += 1;
    return label;
  });

  return out;
}


function renderAiReportAddendumPage(reportData) {
  const ai = polishAiReportAddendum(
    reportData?.ai_report_addendum || buildFallbackAiReportAddendum(reportData),
    reportData
  );

  const priorities = normalizeReportList(ai.priorities, 6);
  const risks = normalizeReportList(ai.risks, 4);
  const decisions = normalizeReportList(ai.decisions, 4);

  const listHtml = (items) => {
    if (!items.length) {
      return '<p>No existen elementos priorizados para este bloque.</p>';
    }

    return `<ul>${items.map((item) => `<li>${escapeReportHtml(item)}</li>`).join('')}</ul>`;
  };

  return `
    <section class="tcdxExtraPage">
      ${renderPremiumExtraHeader(
        reportData,
        'Lectura Ejecutiva IA',
        'Análisis complementario generado con el motor IA de TCDX sobre los datos reales del sistema.'
      )}

      <main class="tcdxExtraContent">
        <div class="tcdxAiBox" style="margin-bottom:12px;background:#f8fafc;">
          <h3>${escapeReportHtml(ai.headline || 'Lectura ejecutiva del periodo')}</h3>
          <p>${escapeReportHtml(ai.summary || 'No fue posible generar una síntesis ejecutiva ampliada para este informe.')}</p>
          <p style="font-size:10px;color:#64748b;margin-top:6px;">Fuente: ${escapeReportHtml(ai.source || 'own-ai-engine')}</p>
        </div>

        <div class="tcdxAiGrid">
          <div class="tcdxAiBox">
            <h3>Prioridades recomendadas</h3>
            ${listHtml(priorities)}
          </div>

          <div class="tcdxAiBox">
            <h3>Riesgos ejecutivos</h3>
            ${listHtml(risks)}
          </div>

          <div class="tcdxAiBox">
            <h3>Decisiones sugeridas</h3>
            ${listHtml(decisions)}
          </div>

          <div class="tcdxAiBox">
            <h3>Uso recomendado del informe</h3>
            <ul>
              <li>Revisar los puntos críticos con responsables de proceso.</li>
              <li>Usar la trazabilidad del ciclo de vida como evidencia de gobierno.</li>
              <li>Convertir prioridades en planes de acción con fecha y responsable.</li>
            </ul>
          </div>
        </div>
      </main>

      ${renderPremiumExtraFooter('Lectura ejecutiva IA')}
    </section>
  `;
}

function injectAiReportAddendumIntoReportHtml(html, reportData) {
  const page = renderAiReportAddendumPage(reportData);

  if (String(html || '').includes('</body>')) {
    return String(html).replace('</body>', `${page}</body>`);
  }

  return `${html || ''}${page}`;
}

function renderLifecycleHistoryReportPage(reportData) {
  const rows = Array.isArray(reportData?.lifecycle_history)
    ? reportData.lifecycle_history
    : [];

  const rowsHtml = rows.length
    ? rows
        .map((row) => {
          const status = String(row.request_status || '').toLowerCase();
          const badgeColor = status.includes('rechaz') || status.includes('reject')
            ? '#b91c1c'
            : status.includes('confirm') || status.includes('aprobad') || status.includes('aprob')
            ? '#047857'
            : '#b45309';

          return `
            <tr>
              <td>${escapeReportHtml(formatReportDateTime(row.requested_at || row.reviewed_at))}</td>
              <td><strong>${escapeReportHtml(row.standard_code || '-')}</strong></td>
              <td>${escapeReportHtml(row.operation_name || row.operation_id || '-')}</td>
              <td>
                <div><strong>${escapeReportHtml(row.from_stage_name || row.from_stage_code || 'Sin etapa')}</strong></div>
                <div style="font-size:9px;color:#64748b;margin:2px 0;">hacia</div>
                <div><strong>${escapeReportHtml(row.to_stage_name || row.to_stage_code || 'Sin etapa')}</strong></div>
              </td>
              <td>
                <span style="display:inline-block;border:1px solid ${badgeColor};color:${badgeColor};border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;">
                  ${escapeReportHtml(row.request_status_label || row.request_status || 'Pendiente')}
                </span>
              </td>
              <td>${escapeReportHtml(row.requested_by_name || 'No informado')}</td>
              <td>${escapeReportHtml(row.reviewed_by_name || 'Pendiente')}</td>
              <td>
                <div>${escapeReportHtml(row.request_reason || 'Sin motivo informado')}</div>
                ${
                  row.review_comment
                    ? `<div style="margin-top:4px;color:#64748b;font-size:9px;">${escapeReportHtml(row.review_comment)}</div>`
                    : ''
                }
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="8" style="padding:18px;color:#64748b;text-align:center;">
          No existen movimientos de ciclo de vida registrados para este tenant.
        </td>
      </tr>
    `;

  return `
    <section class="tcdxExtraPage">
      ${renderPremiumExtraHeader(
        reportData,
        'Trazabilidad del Ciclo de Vida',
        'Historial auditable de movimientos, aprobaciones y rechazos.'
      )}

      <main class="tcdxExtraContent">
        <div class="tcdxExtraKpiGrid">
          <div class="tcdxExtraMiniCard">
            <div class="tcdxExtraMiniCardLabel">Movimientos incluidos</div>
            <div class="tcdxExtraMiniCardValue">${rows.length}</div>
          </div>

          <div class="tcdxExtraMiniCard">
            <div class="tcdxExtraMiniCardLabel">Uso auditor</div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:6px;">Evidencia de trazabilidad</div>
          </div>

          <div class="tcdxExtraMiniCard">
            <div class="tcdxExtraMiniCardLabel">Cobertura</div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:6px;">Últimos movimientos registrados</div>
          </div>
        </div>

        <div class="tcdxExtraTableWrap">
          <table class="tcdxExtraTable">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Norma</th>
                <th>Operación</th>
                <th>Movimiento</th>
                <th>Estado</th>
                <th>Solicitado por</th>
                <th>Revisado por</th>
                <th>Motivo / comentario</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </main>

      ${renderPremiumExtraFooter('Trazabilidad del ciclo de vida')}
    </section>
  `;
}

function injectLifecycleHistoryIntoReportHtml(html, reportData) {
  const page = renderLifecycleHistoryReportPage(reportData);

  if (String(html || '').includes('</body>')) {
    return String(html).replace('</body>', `${page}</body>`);
  }

  return `${html || ''}${page}`;
}





async function getAuditExecutionSummaryForReport(tenantId) {
  try {
    const reviewResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_reviews,
        COUNT(*) FILTER (WHERE result = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE result = 'conforme')::int AS conformes,
        COUNT(*) FILTER (WHERE result = 'observacion')::int AS observaciones,
        COUNT(*) FILTER (WHERE result = 'no_conforme')::int AS no_conformes,
        COUNT(*) FILTER (WHERE result = 'sin_evidencia')::int AS sin_evidencia
      FROM audit_control_reviews
      WHERE tenant_id = $1::uuid
      `,
      [tenantId]
    );

    const aiResult = await pool.query(
      `
      SELECT
        id,
        standard_code,
        audit_id,
        summary,
        suggestions_json,
        created_at
      FROM ai_auditor_runs
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId]
    );

    return {
      reviews: reviewResult.rows[0] || {},
      latest_ai_auditor_run: aiResult.rows[0] || null,
    };
  } catch (error) {
    console.error('REPORT AUDIT EXECUTION SUMMARY ERROR:', error.message);
    return {
      reviews: {},
      latest_ai_auditor_run: null,
    };
  }
}


async function getAuditSummaryForReport(tenantId) {
  try {
    const summaryResult = await pool.query(
      `
      WITH base AS (
        SELECT
          a.*,
          normalize_status_for_audits(a.status) AS normalized_status
        FROM audits a
        JOIN tenant_standards ts
          ON ts.tenant_id = a.tenant_id
         AND ts.standard_code = a.iso
         AND ts.is_active = TRUE
        WHERE a.tenant_id = $1::uuid
          AND EXISTS (
            SELECT 1
            FROM tenant_standard_operations tso
            JOIN tenant_operations op
              ON op.id = tso.operation_id
             AND op.tenant_id = tso.tenant_id
             AND op.is_active = TRUE
            WHERE tso.tenant_id = a.tenant_id
              AND tso.standard_code = a.iso
              AND tso.is_active = TRUE
          )
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE normalized_status = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE normalized_status = 'en_ejecucion')::int AS en_ejecucion,
        COUNT(*) FILTER (WHERE normalized_status = 'completada')::int AS completadas,
        COUNT(*) FILTER (WHERE report_file IS NOT NULL AND report_file <> '')::int AS con_informe,
        COUNT(*) FILTER (WHERE report_file IS NULL OR report_file = '')::int AS sin_informe
      FROM base
      `,
      [tenantId]
    );

    const relationResult = await pool.query(
      `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM findings f
          WHERE f.tenant_id = $1::uuid
            AND f.audit_id IS NOT NULL
        ) AS hallazgos,
        (
          SELECT COUNT(*)::int
          FROM action_plans ap
          WHERE ap.tenant_id = $1::uuid
            AND ap.audit_id IS NOT NULL
        ) AS acciones
      `,
      [tenantId]
    );

    const nextResult = await pool.query(
      `
      SELECT
        a.*,
        normalize_status_for_audits(a.status) AS normalized_status
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1::uuid
        AND normalize_status_for_audits(a.status) != 'completada'
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op
            ON op.id = tso.operation_id
           AND op.tenant_id = tso.tenant_id
           AND op.is_active = TRUE
          WHERE tso.tenant_id = a.tenant_id
            AND tso.standard_code = a.iso
            AND tso.is_active = TRUE
        )
      ORDER BY a.start_date ASC
      LIMIT 1
      `,
      [tenantId]
    );

    const recentResult = await pool.query(
      `
      SELECT
        a.*,
        normalize_status_for_audits(a.status) AS normalized_status
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1::uuid
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op
            ON op.id = tso.operation_id
           AND op.tenant_id = tso.tenant_id
           AND op.is_active = TRUE
          WHERE tso.tenant_id = a.tenant_id
            AND tso.standard_code = a.iso
            AND tso.is_active = TRUE
        )
      ORDER BY a.start_date DESC, a.created_at DESC NULLS LAST
      LIMIT 8
      `,
      [tenantId]
    );

    return {
      summary: {
        ...(summaryResult.rows[0] || {}),
        hallazgos: Number(relationResult.rows[0]?.hallazgos || 0),
        acciones: Number(relationResult.rows[0]?.acciones || 0),
      },
      next_audit: nextResult.rows[0] || null,
      recent_audits: recentResult.rows,
      note:
        'Las auditorías en ejecución no deterioran KPI hasta existir resultado formal de conformidad, hallazgo o cierre.',
    };
  } catch (error) {
    console.error('REPORT AUDIT SUMMARY ERROR:', error.message);

    return {
      summary: {
        total: 0,
        pendientes: 0,
        en_ejecucion: 0,
        completadas: 0,
        con_informe: 0,
        sin_informe: 0,
        hallazgos: 0,
        acciones: 0,
      },
      next_audit: null,
      recent_audits: [],
      note:
        'No fue posible consolidar auditorías para este informe.',
    };
  }
}


async function getTenantBrandingForReport(tenantId) {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        logo,
        logo_url
      FROM tenants
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );

    return result.rows[0] || {};
  } catch (error) {
    console.error('REPORT TENANT BRANDING ERROR:', error.message);
    return {};
  }
}

// =====================================================
// POST /api/reports/generate/start
// Encola generacion asincrona de reportes premium.
// =====================================================
router.post('/generate/start', auth, async (req, res) => {
  pruneReportRuntimeJobs();
  const requestId = req.requestId || buildReportJobId();
  try {
    const locale = resolveLocale(req);
    const originalRole = req.user?.role || req.user?.user_role || req.user?.userRole;
    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);
    const { report_type_code, tenant_id, period, metadata } = req.body || {};

    if (!userId) {
      return res.status(401).json({ ok: false, code: 'NO_USER', error: 'Usuario no identificado en token', request_id: requestId });
    }

    if (!report_type_code) {
      return res.status(400).json({ ok: false, code: 'REPORT_TYPE_REQUIRED', error: 'report_type_code es obligatorio', request_id: requestId });
    }

    const resolvedReportTypeCode = resolveReportTypeCode(report_type_code);
    const reportType = await getReportType(resolvedReportTypeCode);
    if (!reportType) {
      return res.status(404).json({ ok: false, code: 'REPORT_TYPE_NOT_FOUND', error: 'El tipo de reporte no existe o no está activo', request_id: requestId });
    }

    const access = await getReportAccess(resolvedReportTypeCode || report_type_code, role);
    if (!access.can_generate) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'El perfil del usuario no puede generar este tipo de informe', request_id: requestId });
    }

    const targetTenantId = await resolveTargetTenantId({
      role,
      userId,
      userTenantId,
      requestedTenantId: tenant_id,
    });
    await ensureTargetTenantAccess({ role, userId, userTenantId, targetTenantId });

    const authorization = req.headers.authorization || '';
    if (!authorization) {
      return res.status(401).json({ ok: false, code: 'NO_TOKEN', error: 'sin Token', request_id: requestId });
    }
    const reportAiOptions = resolveReportAiOptions(req.body || {});
    const normalizedPayload = {
      ...(req.body || {}),
      period: period || null,
      report_type_code,
      model_mode: reportAiOptions.model_mode,
      use_llm: reportAiOptions.use_llm,
      use_rag: reportAiOptions.use_rag,
      use_web: reportAiOptions.use_web,
      use_drive: reportAiOptions.use_drive,
      depth: reportAiOptions.depth,
      quality: reportAiOptions.quality,
      metadata: {
        ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : safeObject(metadata)),
        model_mode: reportAiOptions.model_mode,
        use_llm: reportAiOptions.use_llm,
        use_rag: reportAiOptions.use_rag,
        use_web: reportAiOptions.use_web,
        use_drive: reportAiOptions.use_drive,
        depth: reportAiOptions.depth,
        quality: reportAiOptions.quality,
      },
    };

    const job = await asyncJobs.createJob({
      tenant_id: targetTenantId,
      user_id: userId,
      job_type: 'report_generation',
      source_module: 'exportes',
      model_mode: reportAiOptions.model_mode,
      payload: normalizedPayload,
      request_id: requestId,
      expires_at: new Date(Date.now() + REPORT_JOB_TTL_MS).toISOString(),
    });

    reportRuntimeJobs.set(job.id, {
      job_id: job.id,
      request_id: requestId,
      tenant_id: targetTenantId,
      user_id: userId,
      locale,
      authorization,
      payload: normalizedPayload,
      status: 'queued',
      created_at: job.created_at,
      updated_at: job.updated_at,
      created_at_ms: Date.now(),
    });
    setImmediate(() => runReportGenerationJob(job.id));

    return res.status(202).json({
      ...publicReportJob(job),
      async_mode: true,
      poll_url: `/api/reports/jobs/${job.id}`,
      result_url: `/api/reports/jobs/${job.id}/result`,
      message: locale === 'en'
        ? 'Report generation is running. You can continue using the platform. We will notify you when it is ready to download.'
        : 'Reporte en generación. Puedes seguir usando la plataforma. Te avisaremos cuando esté disponible para descarga.',
    });
  } catch (error) {
    console.error('REPORT ASYNC START ERROR:', {
      request_id: requestId,
      error: error.message,
    });
    return res.status(500).json({
      ok: false,
      code: 'REPORT_ASYNC_START_FAILED',
      error: 'No fue posible iniciar la generación asincrónica del reporte.',
      request_id: requestId,
    });
  }
});

router.get('/jobs/:job_id', auth, async (req, res) => {
  pruneReportRuntimeJobs();
  try {
    const job = await getReportJobScoped(req, String(req.params.job_id || ''));
    if (!job) {
      return res.status(404).json({ ok: false, code: 'REPORT_JOB_NOT_FOUND', error: 'Job no encontrado' });
    }
    return res.json(publicReportJob(job));
  } catch (error) {
    return res.status(500).json({ ok: false, code: 'REPORT_JOB_STATUS_FAILED', error: 'No fue posible consultar el job de reporte.' });
  }
});

router.get('/jobs/:job_id/result', auth, async (req, res) => {
  pruneReportRuntimeJobs();
  try {
    const job = await getReportJobScoped(req, String(req.params.job_id || ''));
    if (!job) {
      return res.status(404).json({ ok: false, code: 'REPORT_JOB_NOT_FOUND', error: 'Job no encontrado' });
    }
    if (job.status !== 'completed') {
      return res.status(202).json(publicReportJob(job));
    }
    return res.json(job.result || job.result_json);
  } catch (error) {
    return res.status(500).json({ ok: false, code: 'REPORT_JOB_RESULT_FAILED', error: 'No fue posible consultar el resultado del reporte.' });
  }
});

// =====================================================
// POST /api/reports/generate
// Genera PDF premium según tipo de reporte y perfil.
// =====================================================
router.post('/generate', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      report_type_code,
      tenant_id,
      period,
      metadata,
      standard_code,
      version_code,
    } = req.body || {};
    const reportAiOptions = {
      ...resolveReportAiOptions(req.body || {}),
      request_id: req.requestId || null,
    };

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (!report_type_code) {
      return res.status(400).json({
        ok: false,
        error: 'report_type_code es obligatorio',
      });
    }

    const resolvedReportTypeCode = resolveReportTypeCode(report_type_code);
    const legacyReportTypeCode = getLegacyReportTypeCode(resolvedReportTypeCode);
    const reportType = await getReportType(resolvedReportTypeCode);

    if (!reportType) {
      return res.status(404).json({
        ok: false,
        error: 'El tipo de reporte no existe o no está activo',
      });
    }

    const access = await getReportAccess(resolvedReportTypeCode || report_type_code, role);

    if (!access.can_generate) {
      return res.status(403).json({
        ok: false,
        error: 'El perfil del usuario no puede generar este tipo de informe',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
          report_type_code,
        },
      });
    }

    const targetTenantId = await resolveTargetTenantId({
      role,
      userId,
      userTenantId,
      requestedTenantId: tenant_id,
    });

    await ensureTargetTenantAccess({
      role,
      userId,
      userTenantId,
      targetTenantId,
    });

    const requestedStandardCode = String(
      standard_code || metadata?.standard_code || ''
    ).trim();

    const requestedVersionCode = String(
      version_code || metadata?.version_code || ''
    ).trim();

    let reportCoverage = null;
    let profileContext = null;

    if (requestedStandardCode) {
      reportCoverage = await getCoverageForTenantStandard({
        tenantId: targetTenantId,
        standardCode: requestedStandardCode,
        versionCode: requestedVersionCode,
        reportTypeCode: resolvedReportTypeCode || report_type_code,
      });

      assertCanGenerateReportByCoverage(
        reportCoverage,
        resolvedReportTypeCode || report_type_code
      );

      profileContext = reportCoverage.profile_context || null;
    }

    const enrichedReportMetadata = {
      ...safeObject(metadata),
      report_type_code,
      resolved_report_type_code: resolvedReportTypeCode || report_type_code,
      legacy_report_type_code: legacyReportTypeCode || null,
      model_mode: reportAiOptions.model_mode,
      use_llm: reportAiOptions.use_llm,
      use_rag: reportAiOptions.use_rag,
      use_web: reportAiOptions.use_web,
      use_drive: reportAiOptions.use_drive,
      depth: reportAiOptions.depth,
      quality: reportAiOptions.quality,
      standard_code: reportCoverage?.standard_code || requestedStandardCode || null,
      version_code: reportCoverage?.version_code || requestedVersionCode || null,
      standard_label: reportCoverage?.display_name || metadata?.standard_label || null,
      coverage_status: reportCoverage?.coverage_status || metadata?.coverage_status || null,
      coverage_label: reportCoverage?.coverage_label || metadata?.coverage_label || null,
      coverage_metrics: reportCoverage?.metrics || null,
      coverage_warnings: reportCoverage?.warnings || [],
      profile_context: profileContext || null,
    };

    const tenant = await getTenantById(targetTenantId);

    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: 'El tenant indicado no existe',
      });
    }

    const reportData = await buildReportData({
      tenantId: targetTenantId,
      reportTypeCode: report_type_code,
      requestedBy: userId,
      period: period || null,
      requesterRole: role,
      aiOptions: reportAiOptions,
    });

    reportData.lifecycle_history = await getLifecycleHistoryForReport(targetTenantId);
    reportData.ai_report_addendum = await buildAiReportAddendum(reportData, reportAiOptions);
    reportData.senior_auditor_suggestions = await syncReportSeniorAuditorSuggestionsSafe({
      tenantId: targetTenantId,
      userId,
      reportTypeCode: report_type_code,
      period: period || null,
      reportData,
    });
    reportData.audit_summary = await getAuditSummaryForReport(targetTenantId);
    reportData.audit_execution_summary = await getAuditExecutionSummaryForReport(targetTenantId);

    const tenantBranding = await getTenantBrandingForReport(targetTenantId);

    reportData.tenant = {
      ...(tenantBranding || {}),
      ...(reportData.tenant || {}),
      logo: reportData.tenant?.logo || tenantBranding?.logo || null,
      logo_url: reportData.tenant?.logo_url || tenantBranding?.logo_url || null,
    };

    if (reportData && typeof reportData === 'object') {
      reportData.locale = locale;
      reportData.report_locale = locale;
      reportData.metadata = {
        ...(reportData.metadata || {}),
        locale,
      };
    }

        reportData.standard_context = reportCoverage || null;
    reportData.profile_context = profileContext || null;
    reportData.metadata = {
      ...(reportData.metadata || {}),
      ...enrichedReportMetadata,
    };

    const html = renderReportHtmlByType(reportData);

    const reportTitle = buildReportTitle(reportType, resolvedReportTypeCode || report_type_code, period, locale, profileContext);
    const tenantFolder = path.join(
      __dirname,
      '..',
      '..',
      'uploads',
      'reports',
      String(targetTenantId)
    );

    fs.mkdirSync(tenantFolder, { recursive: true });

    const fileName = `${slugify(report_type_code)}-${slugify(
      tenant.name
    )}-${Date.now()}.pdf`;

    const outputPath = path.join(tenantFolder, fileName);

    console.info('REPORT GENERATION START:', {
      request_id: req.requestId || null,
      tenant_id: targetTenantId,
      report_type_code,
      output_path: outputPath,
    });

    await generatePdfFromHtml(html, outputPath, {
      requestId: req.requestId || null,
      templateName: resolvedReportTypeCode || report_type_code,
      metadata: {
        ai_engine_used: reportData.ai_report_addendum?.ai_metrics ? true : null,
        used_llm: reportData.ai_report_addendum?.ai_metrics?.llm_used ?? reportData.ai_report_addendum?.llm_used ?? null,
        model_mode: reportData.ai_report_addendum?.model_mode_used || reportAiOptions.model_mode || null,
        selected_model: reportData.ai_report_addendum?.model_name || reportData.ai_report_addendum?.ai_metrics?.model_name || null,
        fallback_used: reportData.ai_report_addendum?.fallback_used ?? reportData.ai_report_addendum?.ai_metrics?.fallback_used ?? null,
      },
    });

    const legacyFileUrl = `/uploads/reports/${targetTenantId}/${fileName}`;

    const exportMetadata = {
      ...safeObject(metadata),
      template_key: reportType.template_key || null,
      requester_role: role,
      original_role: originalRole || null,
      tenant_name: tenant.name,
      generated_from: safeObject(metadata).generated_from || '/exportes',
      source: safeObject(metadata).source || 'frontend_exportes',
    };

    const exportResult = await pool.query(
      `
      INSERT INTO report_exports (
        tenant_id,
        requested_by,
        report_type_code,
        report_title,
        report_format,
        status,
        file_url,
        payload_json,
        metadata
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        'generated',
        $6,
        $7::jsonb,
        $8::jsonb
      )
      RETURNING *
      `,
      [
        targetTenantId,
        userId,
        report_type_code,
        reportTitle,
        reportType.default_format || 'pdf',
        legacyFileUrl,
        JSON.stringify(reportData),
        JSON.stringify(exportMetadata),
      ]
    );

    const exportRow = exportResult.rows[0];
    const downloadUrl = getReportDownloadUrl(exportRow.id);

    return res.status(201).json({
      ok: true,
      message: 'Informe generado correctamente',
      data: {
        export: {
          ...exportRow,
          legacy_file_url: exportRow.file_url,
          file_url: downloadUrl,
        },
        file_url: downloadUrl,
      },
    });
  } catch (error) {
    const errorCode = ['REPORT_BROWSER_UNAVAILABLE', 'REPORT_BROWSER_LAUNCH_FAILED', 'PDF_BROWSER_UNAVAILABLE', 'PDF_RENDER_FAILED', 'PDF_EMPTY_OUTPUT', 'PDF_TEMPLATE_FAILED'].includes(error.code)
      ? error.code
      : 'REPORT_GENERATION_FAILED';
    const errorStage = error.stage || null;
    console.error('ERROR GENERATE REPORT:', {
      request_id: req.requestId || null,
      code: errorCode,
      stage: errorStage,
      message: error.message,
      meta: error.meta || null,
      stack: error.stack,
    });

    return res.status(500).json({
      ok: false,
      code: errorCode,
      ...(errorStage ? { stage: errorStage } : {}),
      timeout_stage: error.timeout_stage || (error.name === 'AbortError' ? errorStage || 'report_generate' : null),
      timeout_ms: error.timeout_ms || null,
      error_type: error.code || error.name || errorCode,
      error_message: error.message ? String(error.message).slice(0, 500) : 'Error generando informe',
      selected_model: error.selected_model || null,
      error: errorStage === 'BROWSER_LAUNCH'
        ? 'No fue posible iniciar el motor de generación PDF.'
        : 'Error generando informe',
      request_id: req.requestId || null,
      ...errorDetail(error),
    });
  }
});

// =====================================================
// POST /api/reports/schedules
// Programa un reporte mensual para un tenant.
// =====================================================
router.post('/schedules', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      tenant_id,
      report_type_code,
      day_of_month,
      recipients,
      notes,
      metadata,
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (!isPlatformRole(role) && !isDealerRole(role)) {
      return res.status(403).json({
        ok: false,
        error:
          'Solo superadmin, platform_admin o dealer pueden programar informes mensuales de cliente',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
        },
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id es obligatorio',
      });
    }

    if (!report_type_code) {
      return res.status(400).json({
        ok: false,
        error: 'report_type_code es obligatorio',
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe indicar al menos un destinatario en recipients',
      });
    }

    const reportType = await getReportType(report_type_code);

    if (!reportType) {
      return res.status(404).json({
        ok: false,
        error: 'El tipo de reporte no existe o no está activo',
      });
    }

    const access = await getReportAccess(report_type_code, role);

    if (!access.can_schedule) {
      return res.status(403).json({
        ok: false,
        error: 'El perfil del usuario no puede programar este tipo de informe',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
          report_type_code,
        },
      });
    }

    await ensureTargetTenantAccess({
      role,
      userId,
      userTenantId,
      targetTenantId: tenant_id,
    });

    const targetTenant = await getTenantById(tenant_id);

    if (!targetTenant) {
      return res.status(404).json({
        ok: false,
        error: 'El tenant indicado no existe',
      });
    }

    const selectedDay = Number(day_of_month || 1);

    if (Number.isNaN(selectedDay) || selectedDay < 1 || selectedDay > 28) {
      return res.status(400).json({
        ok: false,
        error: 'day_of_month debe estar entre 1 y 28',
      });
    }

    const normalizedRecipients = recipients
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    if (normalizedRecipients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe indicar al menos un destinatario válido',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO report_schedules (
        tenant_id,
        report_type_code,
        frequency,
        day_of_month,
        recipients,
        is_active,
        created_by,
        notes,
        metadata
      )
      VALUES (
        $1::uuid,
        $2,
        'monthly',
        $3,
        $4::jsonb,
        TRUE,
        $5::uuid,
        $6,
        $7::jsonb
      )
      RETURNING *
      `,
      [
        tenant_id,
        report_type_code,
        selectedDay,
        JSON.stringify(normalizedRecipients),
        userId,
        notes || null,
        JSON.stringify({
          ...safeObject(metadata),
          tenant_name: targetTenant.name,
          report_name: reportType.name,
          requester_role: role,
          original_role: originalRole || null,
        }),
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Programación mensual de reporte creada correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR CREATE REPORT SCHEDULE:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error creando programación mensual de reporte',
      ...errorDetail(error),
    });
  }
});

module.exports = router;
