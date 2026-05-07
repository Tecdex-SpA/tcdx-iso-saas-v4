const pool = require('../config/db');
const isoCommandCenter = require('./isoCommandCenter.service');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
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

function resolveTenantId(user) {
  const tenantId = getUserTenantId(user);
  if (!tenantId && PLATFORM_ROLES.has(normalizeRole(user?.role || user?.user_role || user?.userRole))) {
    throw publicError(400, 'TENANT_CONTEXT_REQUIRED', 'Dashboard v2 requiere contexto de tenant');
  }
  return tenantId;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

async function safeQuery(sql, params, notes, label, fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    notes.push(`No se pudo consultar ${label}: ${error.code || error.message}`);
    return fallback;
  }
}

async function tableExists(tableName) {
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );

  return result.rowCount > 0;
}

async function getTenant(tenantId, notes) {
  const rows = await safeQuery(
    `
    SELECT id, name, legal_name, service_status, updated_at
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId],
    notes,
    'tenant',
    []
  );

  const tenant = rows[0] || {};

  return {
    id: tenantId,
    name: tenant.name || tenant.legal_name || 'Empresa',
    service_status: tenant.service_status || null,
    updated_at: tenant.updated_at || null,
  };
}

async function getKpiSummary(tenantId, notes) {
  let hasKpiSnapshots = false;
  try {
    hasKpiSnapshots = await tableExists('kpi_snapshots');
  } catch (error) {
    notes.push(`No se pudo verificar kpi_snapshots: ${error.code || error.message}`);
  }

  if (!hasKpiSnapshots) {
    return {
      total_kpis: 0,
      measured_kpis: 0,
      green: 0,
      yellow: 0,
      red: 0,
      gray: 0,
      data_quality: 'limited',
    };
  }

  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::integer AS measured_kpis,
      COUNT(*) FILTER (WHERE status_color = 'green')::integer AS green,
      COUNT(*) FILTER (WHERE status_color = 'yellow')::integer AS yellow,
      COUNT(*) FILTER (WHERE status_color = 'red')::integer AS red,
      COUNT(*) FILTER (WHERE status_color IS NULL OR status_color = 'gray')::integer AS gray,
      MAX(calculated_at) AS last_calculated_at
    FROM kpi_snapshots
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    notes,
    'kpi_snapshots',
    []
  );

  const row = rows[0] || {};
  const measured = toNumber(row.measured_kpis);

  return {
    total_kpis: measured,
    measured_kpis: measured,
    green: toNumber(row.green),
    yellow: toNumber(row.yellow),
    red: toNumber(row.red),
    gray: toNumber(row.gray),
    last_calculated_at: row.last_calculated_at || null,
    data_quality: measured > 0 ? 'partial' : 'limited',
  };
}

function buildExecutiveMessage(summary, priorities, alerts) {
  const score = toNumber(summary.readiness_score);
  const blockers = [];

  if (toNumber(summary.high_risks) > 0) blockers.push(`${summary.high_risks} riesgo(s) alto/critico`);
  if (toNumber(summary.recommended_actions_open) > 0) blockers.push(`${summary.recommended_actions_open} accion(es) recomendada(s) abierta(s)`);
  if (toNumber(summary.open_nonconformities) > 0) blockers.push(`${summary.open_nonconformities} no conformidad(es) abierta(s)`);
  if (priorities.length > 0) blockers.push(`${priorities.length} prioridad(es) operativas`);

  let headline = 'Cumplimiento en etapa inicial';
  if (score >= 85) headline = 'Buen nivel de preparacion para revision';
  else if (score >= 70) headline = 'Preparacion avanzada con ajustes pendientes';
  else if (score >= 50) headline = 'Preparacion en progreso';

  return {
    headline,
    score: round2(score),
    readiness_label: summary.readiness_label,
    statement: score >= 70
      ? 'El sistema muestra una base operativa consistente para avanzar hacia auditoria, con foco en cerrar bloqueadores abiertos.'
      : 'El sistema requiere priorizar brechas, acciones y riesgos antes de una auditoria formal.',
    blockers,
    blockers_summary: blockers.length ? blockers.join(', ') : 'Sin bloqueadores criticos detectados con los datos actuales.',
    calculated_at: new Date().toISOString(),
    alert_count: alerts.length,
  };
}

function buildTabs(unified, kpis) {
  return [
    {
      key: 'resumen',
      title: 'Resumen',
      status: unified.standard_cards.length > 0 ? 'ready' : 'empty',
      metric: unified.summary.readiness_score,
    },
    {
      key: 'salud_iso',
      title: 'Salud ISO',
      status: unified.health?.data_quality || unified.data_quality?.level || 'partial',
      metric: unified.summary.coverage_pct,
    },
    {
      key: 'ciclo_vida',
      title: 'Ciclo de vida',
      status: 'prepared',
      metric: unified.workflow?.open_action_plans || 0,
    },
    {
      key: 'acciones',
      title: 'Acciones',
      status: unified.summary.recommended_actions_open > 0 ? 'attention' : 'ready',
      metric: unified.summary.recommended_actions_open,
    },
    {
      key: 'riesgos',
      title: 'Riesgos',
      status: unified.summary.high_risks > 0 ? 'attention' : 'ready',
      metric: unified.summary.high_risks,
    },
    {
      key: 'kpis',
      title: 'KPIs',
      status: kpis.measured_kpis > 0 ? 'partial' : 'prepared',
      metric: kpis.measured_kpis,
    },
    {
      key: 'alertas',
      title: 'Alertas',
      status: unified.alerts.length > 0 ? 'attention' : 'ready',
      metric: unified.alerts.length,
    },
  ];
}

function normalizeStandardCards(cards) {
  return cards.map((standard) => ({
    standard_code: standard.standard_code,
    version_code: standard.version_code,
    display_name: standard.display_name,
    certifiable: standard.certifiable === true,
    publication_status: standard.publication_status,
    health_status: standard.semaphore,
    readiness_score: standard.readiness_score,
    readiness_label: standard.readiness_label,
    coverage_pct: standard.coverage_pct,
    open_gaps: standard.gaps_count,
    high_risks: toNumber(standard.high_risks) + toNumber(standard.critical_risks),
    pending_actions: standard.recommended_actions_open,
    lifecycle_status: standard.open_action_plans > 0 ? 'acciones_abiertas' : 'sin_bloqueos_operativos',
    documents_generated: standard.documents_generated,
    last_reviewed_at: null,
    updated_at: null,
    data_quality: standard.data_quality || 'partial',
  }));
}

async function getSummary(user) {
  const tenantId = resolveTenantId(user);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');

  const notes = [];
  const [tenant, unified] = await Promise.all([
    getTenant(tenantId, notes),
    isoCommandCenter.getUnified(user, {}),
  ]);
  const kpis = await getKpiSummary(tenantId, notes);
  const standardCards = normalizeStandardCards(unified.standard_cards || []);
  const executiveReadiness = buildExecutiveMessage(unified.summary, unified.priorities || [], unified.alerts || []);
  const tabs = buildTabs(unified, kpis);

  return {
    tenant,
    tenant_id: tenantId,
    last_updated_at: new Date().toISOString(),
    executive_readiness: executiveReadiness,
    general_health: {
      score: unified.summary.readiness_score,
      label: unified.summary.readiness_label,
      coverage_pct: unified.summary.coverage_pct,
      status: unified.summary.readiness_score >= 70 ? 'estable' : 'requiere_atencion',
    },
    audit_readiness: {
      score: executiveReadiness.score,
      label: executiveReadiness.readiness_label,
      message: executiveReadiness.statement,
      blockers: executiveReadiness.blockers,
      calculated_at: executiveReadiness.calculated_at,
    },
    active_standards: standardCards,
    summary: {
      active_standards: unified.summary.contracted_standards || standardCards.length,
      operational_versions: standardCards.length,
      transition_versions: unified.transition_items?.length || 0,
      readiness_score: unified.summary.readiness_score,
      coverage_pct: unified.summary.coverage_pct,
      pending_actions: unified.summary.recommended_actions_open,
      converted_actions: unified.summary.recommended_actions_converted,
      high_risks: unified.summary.high_risks,
      open_findings: unified.summary.open_findings,
      open_nonconformities: unified.summary.open_nonconformities,
      open_action_plans: unified.summary.open_action_plans,
    },
    work: {
      actions: unified.workflow || {},
      risks: unified.risks || {},
      kpis,
    },
    alerts: unified.alerts || [],
    priorities: unified.priorities || [],
    quick_links: unified.quick_links || [],
    tabs,
    panels: {
      resumen: { status: 'ready' },
      salud_iso: { status: 'prepared' },
      ciclo_vida: { status: 'prepared' },
      acciones: { status: 'prepared' },
      riesgos: { status: 'prepared' },
      kpis: { status: 'prepared' },
      alertas: { status: 'prepared' },
    },
    customization: {
      layout_version: 'dashboard_v2_base',
      supports_reorder: true,
      supports_user_layout: false,
      planned_storage: 'future_user_dashboard_layout',
      blocks: ['executive_header', 'standard_cards', 'priorities', 'workflow', 'risks', 'kpis', 'alerts'],
    },
    data_quality: {
      level: notes.length > 0 || unified.data_quality?.level !== 'complete' ? 'partial' : 'complete',
      notes: [...notes, ...(unified.data_quality?.notes || [])],
    },
  };
}

module.exports = {
  getSummary,
};
