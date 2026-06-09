'use strict';

const pool = require('../config/db');
const healthService = require('./health.service');
const diagnosticService = require('./diagnostic.service');
const reportTemplates = require('./reportTemplates.service');
const reportSources = require('./reportSources.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXECUTIVE_ROLES = new Set(['ejecutivo_cliente', 'viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo']);
const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function asString(value) {
  return String(value ?? '').trim();
}

function normalizeRole(user = {}) {
  return reportTemplates.normalizeRole(user.role || user.user_role || user.userRole || '');
}

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(role);
}

function isExecutiveRole(role) {
  return EXECUTIVE_ROLES.has(role);
}

function isUuid(value) {
  return UUID_RE.test(asString(value));
}

function normalizeStandardCode(value) {
  return asString(value).toUpperCase().replace(/\s+/g, '').replace('ISO/IEC', 'ISO').replace('ISO-', 'ISO');
}

function normalizeDate(value) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw publicError(400, 'REPORT_INVALID_PERIOD', 'Periodo inválido. Use fechas ISO YYYY-MM-DD.');
  }
  return raw.slice(0, 10);
}

function assertUuidFilter(value, name) {
  if (!value) return null;
  if (!isUuid(value)) {
    throw publicError(400, 'REPORT_INVALID_FILTER', `${name} debe ser un UUID interno válido.`);
  }
  return asString(value);
}

function normalizeFilters(payload = {}) {
  const periodFrom = normalizeDate(payload.period_from);
  const periodTo = normalizeDate(payload.period_to);
  if (periodFrom && periodTo && new Date(periodFrom).getTime() > new Date(periodTo).getTime()) {
    throw publicError(400, 'REPORT_INVALID_PERIOD', 'period_from no puede ser posterior a period_to.');
  }

  return {
    standard_id: assertUuidFilter(payload.standard_id, 'standard_id'),
    process_id: assertUuidFilter(payload.process_id, 'process_id'),
    operation_id: assertUuidFilter(payload.operation_id, 'operation_id'),
    standard_code: payload.standard_code ? normalizeStandardCode(payload.standard_code) : null,
    period_from: periodFrom,
    period_to: periodTo,
    include_sources: payload.include_sources !== false,
    include_sensitive_evidence: payload.include_sensitive_evidence === true,
    sections: Array.isArray(payload.sections)
      ? payload.sections.map((item) => asString(item)).filter(Boolean)
      : null,
  };
}

function assertReportAccess({ user, templateCode, requestedTenantId = null } = {}) {
  const role = normalizeRole(user);
  const userId = getUserId(user);
  const userTenantId = getUserTenantId(user);

  if (!userId) {
    throw publicError(401, 'REPORT_USER_REQUIRED', 'Usuario no identificado en token.');
  }

  if (!role || role === 'partner') {
    throw publicError(403, 'REPORT_RBAC_DENIED', 'Rol no autorizado para reportes de operación interna.');
  }

  const template = reportTemplates.getTemplate(templateCode, role);
  if (!template) {
    throw publicError(403, 'REPORT_TEMPLATE_DENIED', 'Plantilla no disponible para este rol o no existe.');
  }

  const tenantId = isPlatformRole(role) && requestedTenantId
    ? requestedTenantId
    : userTenantId;

  if (!tenantId) {
    throw publicError(403, 'REPORT_TENANT_REQUIRED', 'Tenant no identificado para reportes.');
  }

  return { role, userId, tenantId, template };
}

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows || fallback;
  } catch {
    return fallback;
  }
}

async function getTenant(tenantId) {
  const rows = await safeQuery(
    `
    SELECT id, name, logo_url, created_at
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId],
    []
  );
  return rows[0] || { id: tenantId, name: 'Tenant' };
}

function dateInPeriod(value, filters = {}) {
  if (!filters.period_from && !filters.period_to) return true;
  if (!value) return true;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  if (filters.period_from && time < new Date(filters.period_from).getTime()) return false;
  if (filters.period_to && time >= new Date(`${filters.period_to}T23:59:59.999Z`).getTime()) return false;
  return true;
}

function selectedSections(template, filters) {
  const requested = filters.sections && filters.sections.length ? filters.sections : template.default_sections;
  const allowed = new Set(template.default_sections);
  return requested.filter((code) => allowed.has(code) || ['summary'].includes(code));
}

function buildScopedUser(user, tenantId, normalizedRole = null) {
  const dependencyRole = normalizedRole === 'ejecutivo_cliente'
    ? 'ejecutivo'
    : (user.role || user.user_role || user.userRole);

  return {
    ...user,
    role: dependencyRole,
    user_role: dependencyRole,
    userRole: dependencyRole,
    tenant_id: tenantId,
    tenantId,
  };
}

async function buildHealthBundle({ user, filters }) {
  const [summary, dashboard, standardsResult, processesResult, kpis] = await Promise.all([
    healthService.getSummary({
      user,
      standardId: filters.standard_id,
      standardCode: filters.standard_code,
    }),
    healthService.getDashboard({ user }),
    healthService.getStandardsHealth({
      user,
      standardId: filters.standard_id,
      standardCode: filters.standard_code,
    }),
    healthService.getProcessesHealth({
      user,
      standardId: filters.standard_id,
      standardCode: filters.standard_code,
      processId: filters.process_id,
      operationId: filters.operation_id,
    }),
    healthService.getKpis({ user }),
  ]);

  const standards = standardsResult.standards || [];
  const processes = processesResult.processes || [];

  return {
    summary,
    dashboard,
    standards,
    processes,
    kpis,
    warnings: [
      ...(summary.data_quality_warnings || []),
      ...(standardsResult.data_quality_warnings || []),
      ...(processesResult.data_quality_warnings || []),
    ],
  };
}

async function buildDiagnostics({ user, filters }) {
  if (filters.standard_id || filters.standard_code) {
    const diagnostic = await diagnosticService.buildDiagnostic({
      user,
      standardId: filters.standard_id,
      standardCode: filters.standard_code,
      filters: {
        process_id: filters.process_id,
        operation_id: filters.operation_id,
      },
    });
    return [diagnostic];
  }

  const standards = await diagnosticService.listActiveStandards({ user });
  const diagnostics = [];
  for (const standard of standards.slice(0, 8)) {
    diagnostics.push(await diagnosticService.buildDiagnostic({
      user,
      standardId: standard.id || standard.standard_id,
      filters: {
        process_id: filters.process_id,
        operation_id: filters.operation_id,
      },
    }));
  }
  return diagnostics;
}

function flattenControls(diagnostics = []) {
  return diagnostics.flatMap((diagnostic) => (
    (diagnostic.controls || []).map((control) => ({
      standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
      standard_code: diagnostic.standard?.standard_code || control.standard_code,
      control_id: control.tenant_control_id,
      catalog_control_id: control.catalog_control_id,
      code: control.clause || control.category,
      name: control.category || control.description || control.clause,
      description: control.description,
      status: control.status,
      process: control.process,
      operation: control.operation,
      evidence_active_count: control.evidence?.active_count || 0,
      evidence_candidate_count: control.evidence?.candidate_count || 0,
      recommended_evidence_count: control.evidence?.recommended?.length || 0,
      open_gaps: control.gaps?.open_count || 0,
      open_actions: control.actions?.open_count || 0,
      high_risks: (control.risks?.existing || []).filter((risk) => ['alto', 'alta', 'high', 'critico', 'critica', 'critical'].includes(asString(risk.residual_risk_level || risk.inherent_risk_level).toLowerCase())).length,
      traceability: control.traceability,
    }))
  ));
}

function flattenGaps(diagnostics = [], filters = {}) {
  const rows = [];
  for (const diagnostic of diagnostics) {
    for (const control of diagnostic.controls || []) {
      for (const gap of [...(control.gaps?.findings || []), ...(control.gaps?.nonconformities || [])]) {
        if (!dateInPeriod(gap.created_at || gap.detected_at, filters)) continue;
        rows.push({
          id: gap.id,
          source_type: gap.title ? 'finding' : 'nonconformity',
          standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_id: control.process?.id || null,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          control_name: control.category || control.description,
          title: gap.title || gap.description || 'Brecha',
          description: gap.description || null,
          severity: gap.severity || gap.priority || null,
          status: gap.status || (gap.open ? 'open' : 'closed'),
          open: gap.open === true,
          created_at: gap.created_at || gap.detected_at || null,
          closed_at: gap.closed_at || gap.resolved_at || null,
          missing_evidence: control.status === 'missing_evidence' ? 'Evidencia activa suficiente no encontrada para el control.' : null,
          recommendation: control.evidence?.recommended?.[0]?.name || null,
          actions_related: control.actions?.existing?.length || 0,
          age_days: gap.created_at
            ? Math.max(0, Math.floor((Date.now() - new Date(gap.created_at).getTime()) / 86400000))
            : null,
        });
      }
    }
  }
  return rows;
}

function flattenActions(diagnostics = [], filters = {}) {
  const rows = [];
  for (const diagnostic of diagnostics) {
    for (const control of diagnostic.controls || []) {
      for (const action of control.actions?.existing || []) {
        if (!dateInPeriod(action.created_at || action.due_date, filters)) continue;
        rows.push({
          id: action.id,
          standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_id: control.process?.id || null,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          title: action.title || action.description || 'Acción',
          description: action.description || null,
          priority: action.priority || null,
          status: action.status || (action.open ? 'open' : 'closed'),
          owner: action.owner || null,
          due_date: action.due_date || null,
          overdue: action.open === true && action.due_date ? new Date(action.due_date).getTime() < Date.now() : false,
          created_at: action.created_at || null,
          completed_at: action.completed_at || null,
        });
      }
    }
  }
  return rows;
}

function flattenEvidence(diagnostics = [], filters = {}, executive = false) {
  const rows = [];
  const missing = [];
  const suggested = [];

  for (const diagnostic of diagnostics) {
    for (const control of diagnostic.controls || []) {
      for (const evidence of control.evidence?.existing || []) {
        if (!dateInPeriod(evidence.created_at, filters)) continue;
        rows.push({
          id: evidence.source_id || evidence.id,
          source_type: evidence.source_type || 'evidence',
          standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_id: control.process?.id || null,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          name: evidence.name || evidence.file_name || evidence.description || 'Evidencia',
          status: evidence.status || 'active',
          active: evidence.active !== false,
          evidence_strength: evidence.strength || (evidence.validated ? 'primary' : 'secondary'),
          provider: evidence.provider || 'internal',
          created_at: evidence.created_at || null,
          detail: executive ? null : evidence.description || evidence.evidence_type || null,
        });
      }

      if (control.status === 'missing_evidence') {
        missing.push({
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          control_name: control.category || control.description,
          reason: 'No se encontró evidencia activa suficiente asociada al control.',
        });
      }

      for (const recommendation of control.evidence?.recommended || []) {
        suggested.push({
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          name: recommendation.name,
          purpose: recommendation.purpose,
          recommended_formats: recommendation.recommended_format || recommendation.recommended_formats || [],
          minimum_fields: recommendation.minimum_fields || [],
          owner_role: recommendation.owner_role || null,
          frequency: recommendation.frequency || null,
        });
      }
    }
  }

  return { active: rows, missing, suggested };
}

function flattenRisks(diagnostics = [], filters = {}) {
  const rows = [];
  for (const diagnostic of diagnostics) {
    for (const control of diagnostic.controls || []) {
      for (const risk of control.risks?.existing || []) {
        if (!dateInPeriod(risk.created_at || risk.updated_at, filters)) continue;
        rows.push({
          id: risk.id,
          standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          standard_code: diagnostic.standard?.standard_code || control.standard_code,
          process_id: control.process?.id || null,
          process_name: control.process?.name || control.operation?.name || null,
          control_id: control.tenant_control_id,
          title: risk.risk_title || risk.title || risk.risk_description || 'Riesgo',
          category: risk.risk_category || null,
          inherent_risk_level: risk.inherent_risk_level || null,
          residual_risk_level: risk.residual_risk_level || null,
          treatment: risk.treatment_strategy || risk.treatment || null,
          status: risk.status || 'active',
          actions_pending: control.actions?.existing?.filter((action) => action.open).length || 0,
        });
      }
    }
  }
  return rows;
}

async function loadAuditSection({ tenantId, filters }) {
  if (!(await reportSources.relationExists('audits'))) {
    return { audits: [], findings: [], actions: [], warnings: ['No existe tabla de auditorías disponible.'] };
  }

  const hasIso = await reportSources.columnExists('audits', 'iso');
  const hasIsoCode = await reportSources.columnExists('audits', 'iso_code');
  const isoColumn = hasIsoCode ? 'iso_code' : hasIso ? 'iso' : null;
  const titleExpr = await reportSources.columnExists('audits', 'title')
    ? 'title'
    : await reportSources.columnExists('audits', 'name')
      ? 'name'
      : "'Auditoría'";
  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];

  if (filters.standard_code && isoColumn) {
    params.push(filters.standard_code);
    where.push(`${isoColumn} = $${params.length}`);
  }
  if (filters.period_from) {
    params.push(filters.period_from);
    where.push(`created_at >= $${params.length}::date`);
  }
  if (filters.period_to) {
    params.push(filters.period_to);
    where.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const rows = await safeQuery(
    `
    SELECT id, ${isoColumn || 'NULL'} AS standard_code, ${titleExpr} AS title, status, auditor_name, start_date, end_date, created_at
    FROM audits
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC NULLS LAST
    LIMIT 50
    `,
    params,
    []
  );

  return {
    audits: rows,
    findings: [],
    actions: [],
    warnings: rows.length ? [] : ['No se encontraron auditorías para el filtro solicitado.'],
  };
}

async function loadLifecycleSection({ tenantId, filters }) {
  if (!(await reportSources.relationExists('lifecycle_transitions'))) {
    return { transitions: [], warnings: ['No existe historial de ciclo ISO disponible.'] };
  }

  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];
  if (filters.standard_code && await reportSources.columnExists('lifecycle_transitions', 'standard_code')) {
    params.push(filters.standard_code);
    where.push(`standard_code = $${params.length}`);
  }
  if (filters.period_from) {
    params.push(filters.period_from);
    where.push(`created_at >= $${params.length}::date`);
  }
  if (filters.period_to) {
    params.push(filters.period_to);
    where.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const rows = await safeQuery(
    `
    SELECT id, standard_code, from_stage, to_stage, status, actor_user_id, comment, created_at
    FROM lifecycle_transitions
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC NULLS LAST
    LIMIT 80
    `,
    params,
    []
  );

  return {
    transitions: rows,
    warnings: rows.length ? [] : ['No se encontraron movimientos de ciclo ISO para el filtro solicitado.'],
  };
}

function section(code, title, data) {
  return { code, title, data };
}

function buildSummarySection({ tenant, filters, template, healthBundle, diagnostics }) {
  return section('summary', 'Resumen ejecutivo', {
    tenant,
    period: {
      from: filters.period_from,
      to: filters.period_to,
    },
    norms_active: healthBundle.standards.map((item) => ({
      id: item.id,
      standard_code: item.standard_code,
      name: item.name,
      score: item.score,
      status: item.status,
    })),
    health_global: {
      score: healthBundle.summary.global_score,
      status: healthBundle.summary.status,
      label: healthBundle.summary.label,
      drivers: healthBundle.summary.drivers || [],
    },
    controls_evaluated: diagnostics.reduce((sum, item) => sum + (item.controls?.length || 0), 0),
    recommendation_management: 'Revisar primero los drivers principales, controles sin evidencia, acciones vencidas y brechas abiertas antes de emitir conclusiones formales.',
    disclaimer: 'Este preview no certifica, no aprueba cumplimiento y no reemplaza una auditoría o revisión humana competente.',
    template_code: template.code,
  });
}

function buildHealthSection(healthBundle) {
  return section('health', 'Salud del sistema', {
    formula: {
      control_coverage: { weight: 35 },
      evidence: { weight: 20 },
      gaps: { weight: 15 },
      actions: { weight: 15 },
      risks: { weight: 10 },
      lifecycle_audit: { weight: 5 },
    },
    summary: healthBundle.summary,
    dashboard: healthBundle.dashboard,
    standards: healthBundle.standards,
    processes: healthBundle.processes,
    warnings: healthBundle.warnings,
  });
}

function buildKpisSection(healthBundle) {
  return section('kpis', 'KPIs mínimos', healthBundle.kpis);
}

function buildControlsSection(controls) {
  return section('controls', 'Controles', {
    controls,
    totals: {
      applicable: controls.length,
      covered: controls.filter((item) => item.status === 'covered').length,
      partially_covered: controls.filter((item) => item.status === 'partially_covered').length,
      missing_evidence: controls.filter((item) => item.status === 'missing_evidence').length,
      not_applicable: controls.filter((item) => item.status === 'not_applicable').length,
    },
  });
}

function buildGapsSection(gaps) {
  return section('gaps', 'Brechas', {
    gaps,
    totals: {
      open: gaps.filter((item) => item.open).length,
      critical: gaps.filter((item) => ['critical', 'critico', 'crítico', 'alta', 'high'].includes(asString(item.severity).toLowerCase())).length,
      by_standard: gaps.reduce((acc, item) => {
        const key = item.standard_code || 'sin_norma';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      by_process: gaps.reduce((acc, item) => {
        const key = item.process_name || 'sin_proceso';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    },
  });
}

function buildActionsSection(actions) {
  return section('actions', 'Acciones', {
    actions,
    totals: {
      open: actions.filter((item) => ['open', 'abierto', 'pendiente', 'en_progreso'].includes(asString(item.status).toLowerCase())).length,
      overdue: actions.filter((item) => item.overdue).length,
      high_priority: actions.filter((item) => ['alta', 'high', 'critical', 'critica', 'crítica'].includes(asString(item.priority).toLowerCase())).length,
    },
  });
}

function buildEvidenceSection(evidence, executive) {
  return section('evidence', 'Evidencias', {
    active: executive ? evidence.active.slice(0, 20).map((item) => ({ ...item, detail: null })) : evidence.active,
    missing: evidence.missing,
    suggested: evidence.suggested,
    totals: {
      active: evidence.active.length,
      missing: evidence.missing.length,
      suggested: evidence.suggested.length,
    },
  });
}

function buildRisksSection(risks) {
  return section('risks', 'Riesgos', {
    risks,
    totals: {
      high_or_critical: risks.filter((item) => ['alto', 'alta', 'high', 'critico', 'critica', 'critical'].includes(asString(item.residual_risk_level || item.inherent_risk_level).toLowerCase())).length,
      without_treatment: risks.filter((item) => !item.treatment).length,
      pending_actions: risks.reduce((sum, item) => sum + Number(item.actions_pending || 0), 0),
    },
  });
}

function buildDocumentPreparationSection(evidence) {
  return section('document_preparation', 'Preparación documental', {
    documents_found: evidence.active.length,
    required_or_suggested: evidence.suggested,
    missing_evidence: evidence.missing,
    completeness_status: evidence.missing.length === 0 ? 'complete_or_no_missing_detected' : 'incomplete',
  });
}

async function buildPreview({ user, payload = {}, requestedTenantId = null } = {}) {
  if (payload.tenant_id) {
    throw publicError(400, 'REPORT_BODY_TENANT_NOT_ALLOWED', 'tenant_id no debe enviarse en el body; se resuelve desde el token.');
  }

  const templateCode = asString(payload.template_code);
  if (!templateCode) {
    throw publicError(400, 'REPORT_TEMPLATE_REQUIRED', 'template_code es obligatorio.');
  }

  const access = assertReportAccess({ user, templateCode, requestedTenantId });
  const filters = normalizeFilters(payload);
  const scopedUser = buildScopedUser(user, access.tenantId, access.role);
  const template = access.template;
  const tenant = await getTenant(access.tenantId);
  const executive = isExecutiveRole(access.role);

  const warnings = [];
  const [healthBundle, diagnostics] = await Promise.all([
    buildHealthBundle({ user: scopedUser, filters }),
    buildDiagnostics({ user: scopedUser, filters }),
  ]);

  if ((filters.process_id || filters.operation_id) && diagnostics.every((item) => (item.controls || []).length === 0)) {
    throw publicError(404, 'REPORT_PROCESS_NOT_FOUND', 'No se encontraron controles para el proceso/operación solicitado.');
  }

  const controls = flattenControls(diagnostics);
  const gaps = flattenGaps(diagnostics, filters);
  const actions = flattenActions(diagnostics, filters);
  const evidence = flattenEvidence(diagnostics, filters, executive);
  const risks = flattenRisks(diagnostics, filters);
  const sectionsToBuild = selectedSections(template, filters);
  const sections = [];

  if (sectionsToBuild.includes('summary')) sections.push(buildSummarySection({ tenant, filters, template, healthBundle, diagnostics }));
  if (sectionsToBuild.includes('health')) sections.push(buildHealthSection(healthBundle));
  if (sectionsToBuild.includes('kpis')) sections.push(buildKpisSection(healthBundle));
  if (sectionsToBuild.includes('controls')) sections.push(buildControlsSection(controls));
  if (sectionsToBuild.includes('gaps')) sections.push(buildGapsSection(gaps));
  if (sectionsToBuild.includes('actions')) sections.push(buildActionsSection(actions));
  if (sectionsToBuild.includes('evidence')) sections.push(buildEvidenceSection(evidence, executive));
  if (sectionsToBuild.includes('risks')) sections.push(buildRisksSection(risks));

  if (sectionsToBuild.includes('audit')) {
    const audit = await loadAuditSection({ tenantId: access.tenantId, filters });
    warnings.push(...audit.warnings);
    sections.push(section('audit', 'Auditoría', audit));
  }

  if (sectionsToBuild.includes('lifecycle')) {
    const lifecycle = await loadLifecycleSection({ tenantId: access.tenantId, filters });
    warnings.push(...lifecycle.warnings);
    sections.push(section('lifecycle', 'Ciclo ISO', lifecycle));
  }

  if (template.code === 'document_preparation_report' && !sections.some((item) => item.code === 'document_preparation')) {
    sections.push(buildDocumentPreparationSection(evidence));
  }

  const sources = filters.include_sources
    ? await reportSources.buildSources({
      tenantId: access.tenantId,
      diagnostics,
      filters,
      includeExcludedDocuments: !executive && filters.include_sensitive_evidence,
    })
    : [];

  return {
    report_id: null,
    template_code: template.code,
    status: 'preview',
    requires_human_review: true,
    ai_narrative_ready: false,
    pdf_ready: false,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      logo_url: executive ? null : tenant.logo_url || null,
    },
    filters,
    sections,
    sources: executive
      ? sources.filter((item) => ['executive', 'operational'].includes(item.visibility)).slice(0, 60)
      : sources.slice(0, 160),
    warnings: Array.from(new Set([
      ...warnings,
      ...(healthBundle.warnings || []),
      ...(controls.length === 0 ? ['No se encontraron controles para el alcance seleccionado.'] : []),
      'Preview estructurado: requiere revisión humana y no constituye certificación.',
    ])).slice(0, 20),
    generated_at: new Date().toISOString(),
    generated_by: access.userId,
  };
}

async function listSources({ user, query = {} } = {}) {
  const templateCode = asString(query.template_code || 'executive_compliance');
  const access = assertReportAccess({ user, templateCode, requestedTenantId: query.tenant_id || null });
  const filters = normalizeFilters(query);
  const scopedUser = buildScopedUser(user, access.tenantId, access.role);
  const diagnostics = await buildDiagnostics({ user: scopedUser, filters });
  const sources = await reportSources.buildSources({
    tenantId: access.tenantId,
    diagnostics,
    filters,
    includeExcludedDocuments: filters.include_sensitive_evidence === true && !isExecutiveRole(access.role),
  });

  return {
    tenant_id: access.tenantId,
    filters,
    sources,
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  publicError,
  normalizeFilters,
  buildPreview,
  listSources,
};
