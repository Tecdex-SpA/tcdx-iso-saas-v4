const pool = require('../config/db');
const isoCommandCenter = require('./isoCommandCenter.service');
const { renderAiAuditorPremiumTemplate } = require('../reports/templates/aiAuditorPremium.template');

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

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || user?.sub || null;
}

function resolveTenantId(user) {
  const tenantId = getUserTenantId(user);
  if (!tenantId && PLATFORM_ROLES.has(normalizeRole(user?.role || user?.user_role || user?.userRole))) {
    throw publicError(400, 'TENANT_CONTEXT_REQUIRED', 'Dashboard v2 requiere contexto de tenant');
  }
  return tenantId;
}

function resolveUserId(user) {
  const userId = getUserId(user);
  if (!userId) {
    throw publicError(400, 'USER_CONTEXT_REQUIRED', 'Dashboard v2 requiere contexto de usuario');
  }
  return userId;
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
    console.error('ERROR DASHBOARD V2 SAFE QUERY:', {
      label,
      code: error.code,
      message: error.message,
    });
    notes.push(`No fue posible cargar ${label}.`);
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

async function tableColumns(tableName) {
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

const DASHBOARD_V2_KEY = 'dashboard_v2';
const DEFAULT_LAYOUT = {
  version: 1,
  order: ['standards', 'salud_iso', 'ciclo_vida', 'acciones', 'riesgos', 'kpis', 'alertas'],
  collapsed: {},
};
const ALLOWED_LAYOUT_BLOCKS = new Set(DEFAULT_LAYOUT.order);

function normalizeDashboardKey(value = DASHBOARD_V2_KEY) {
  const key = String(value || DASHBOARD_V2_KEY).trim();
  if (key !== DASHBOARD_V2_KEY) {
    throw publicError(400, 'INVALID_DASHBOARD_KEY', 'dashboard_key invalido');
  }
  return key;
}

function normalizeLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    throw publicError(400, 'INVALID_LAYOUT', 'layout_json debe ser un objeto');
  }

  const serialized = JSON.stringify(layout);
  if (serialized.length > 20000) {
    throw publicError(413, 'LAYOUT_TOO_LARGE', 'layout_json excede el tamano permitido');
  }

  const rawOrder = Array.isArray(layout.order) ? layout.order : DEFAULT_LAYOUT.order;
  const order = [];
  rawOrder.forEach((block) => {
    const key = String(block || '').trim();
    if (ALLOWED_LAYOUT_BLOCKS.has(key) && !order.includes(key)) {
      order.push(key);
    }
  });
  DEFAULT_LAYOUT.order.forEach((block) => {
    if (!order.includes(block)) order.push(block);
  });

  const rawCollapsed = layout.collapsed && typeof layout.collapsed === 'object' && !Array.isArray(layout.collapsed)
    ? layout.collapsed
    : {};
  const collapsed = {};
  DEFAULT_LAYOUT.order.forEach((block) => {
    collapsed[block] = rawCollapsed[block] === true;
  });

  return {
    version: 1,
    order,
    collapsed,
    updated_at: new Date().toISOString(),
  };
}

async function getTenant(tenantId, notes) {
  try {
    const columns = await tableColumns('tenants');
    const select = ['id'];
    [
      'name',
      'business_name',
      'legal_name',
      'company_name',
      'razon_social',
      'service_status',
      'status',
      'updated_at',
      'created_at',
      'logo_url',
      'logo',
    ].forEach((column) => {
      if (columns.has(column)) select.push(column);
    });

    const result = await pool.query(
      `
      SELECT ${select.map((column) => `"${column}"`).join(', ')}
      FROM tenants
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );
    const tenant = result.rows[0] || {};

    return {
      id: tenantId,
      name: tenant.name ||
        tenant.business_name ||
        tenant.legal_name ||
        tenant.company_name ||
        tenant.razon_social ||
        'Empresa',
      service_status: tenant.service_status || tenant.status || null,
      updated_at: tenant.updated_at || tenant.created_at || null,
      logo_url: tenant.logo_url || tenant.logo || null,
    };
  } catch (error) {
    console.error('ERROR DASHBOARD V2 TENANT LOOKUP:', {
      tenant_id: tenantId,
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible cargar todos los datos del tenant. Revisa configuracion del cliente.');
    return {
      id: tenantId,
      name: 'Empresa',
      service_status: null,
      updated_at: null,
      logo_url: null,
    };
  }
}

async function getKpiSummary(tenantId, notes) {
  let hasKpiSnapshots = false;
  try {
    hasKpiSnapshots = await tableExists('kpi_snapshots');
  } catch (error) {
    console.error('ERROR DASHBOARD V2 KPI TABLE CHECK:', {
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible verificar KPIs.');
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

function activeStandardCodes(standards = []) {
  return Array.from(new Set(
    standards
      .map((standard) => standard.standard_code)
      .filter(Boolean)
  ));
}

function standardBelongsToDashboard(standards = [], standardCode, versionCode = null) {
  if (!standardCode) return true;
  return standards.some((standard) => {
    if (standard.standard_code !== standardCode) return false;
    if (!versionCode) return true;
    return standard.version_code === versionCode;
  });
}

function compactRowsByDashboardStandards(rows = [], standards = []) {
  return rows.filter((row) =>
    standardBelongsToDashboard(standards, row.standard_code, row.version_code)
  );
}

async function getActionsPanelForTenant(tenantId, standards, notes) {
  const hasSuggestions = await tableExists('iso_operational_suggestions').catch((error) => {
    console.error('ERROR DASHBOARD V2 SUGGESTIONS TABLE CHECK:', {
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible verificar acciones recomendadas.');
    return false;
  });
  const hasConversions = await tableExists('iso_recommended_action_conversions').catch((error) => {
    console.error('ERROR DASHBOARD V2 CONVERSIONS TABLE CHECK:', {
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible verificar conversiones de acciones.');
    return false;
  });
  const hasActionPlans = await tableExists('action_plans').catch(() => false);
  const hasFindings = await tableExists('findings').catch(() => false);
  const hasNonconformities = await tableExists('tenant_nonconformities').catch(() => false);

  if (!hasSuggestions) {
    return {
      summary: {
        total: 0,
        pending: 0,
        converted: 0,
        overdue: 0,
        pending_approval: 0,
        critical: 0,
        open_action_plans: 0,
        open_findings: 0,
        open_nonconformities: 0,
      },
      by_standard: [],
      recent: [],
      work_pending: [],
      data_quality: 'limited',
    };
  }

  const standardCodes = activeStandardCodes(standards);
  const params = [tenantId, standardCodes];

  const [summaryRows, byStandardRows, recentRows, conversionRows, actionPlanRows, findingRows, ncRows] = await Promise.all([
    safeQuery(
      `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status IN ('pending','approved'))::integer AS pending,
        COUNT(*) FILTER (WHERE status = 'applied')::integer AS converted,
        COUNT(*) FILTER (
          WHERE suggested_due_date < CURRENT_DATE
            AND status IN ('pending','approved','error')
        )::integer AS overdue,
        COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending_approval,
        COUNT(*) FILTER (WHERE priority = 'critica')::integer AS critical
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND (
          standard_code IS NULL
          OR standard_code = ANY($2::text[])
        )
        AND COALESCE(payload_json->>'version_code', source_trace_json->>'version_code', '') <> '2026_FDIS'
      `,
      params,
      notes,
      'acciones recomendadas dashboard v2',
      []
    ),
    safeQuery(
      `
      SELECT
        standard_code,
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status IN ('pending','approved'))::integer AS pending,
        COUNT(*) FILTER (WHERE status = 'applied')::integer AS converted,
        COUNT(*) FILTER (
          WHERE suggested_due_date < CURRENT_DATE
            AND status IN ('pending','approved','error')
        )::integer AS overdue,
        COUNT(*) FILTER (WHERE priority = 'critica')::integer AS critical
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND (
          standard_code IS NULL
          OR standard_code = ANY($2::text[])
        )
        AND COALESCE(payload_json->>'version_code', source_trace_json->>'version_code', '') <> '2026_FDIS'
      GROUP BY standard_code
      ORDER BY critical DESC, overdue DESC, pending DESC, standard_code NULLS LAST
      `,
      params,
      notes,
      'acciones por norma dashboard v2',
      []
    ),
    safeQuery(
      `
      SELECT
        id,
        standard_code,
        source_module,
        suggestion_type,
        target_record_type,
        title,
        description,
        rationale,
        priority,
        status,
        suggested_owner,
        suggested_due_date,
        operation_id,
        tenant_control_id,
        source_entity_type,
        source_entity_id,
        source_reason,
        payload_json,
        source_trace_json,
        created_record_type,
        created_record_id,
        created_at,
        updated_at
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND (
          standard_code IS NULL
          OR standard_code = ANY($2::text[])
        )
        AND COALESCE(payload_json->>'version_code', source_trace_json->>'version_code', '') <> '2026_FDIS'
      ORDER BY
        CASE priority
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        suggested_due_date ASC NULLS LAST,
        created_at DESC
      LIMIT 25
      `,
      params,
      notes,
      'ultimas acciones dashboard v2',
      []
    ),
    hasConversions
      ? safeQuery(
        `
        SELECT COUNT(*)::integer AS conversions_count
        FROM iso_recommended_action_conversions c
        JOIN iso_operational_suggestions s
          ON s.id = c.recommendation_id
         AND s.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1::uuid
          AND c.conversion_status = 'converted'
          AND (
            s.standard_code IS NULL
            OR s.standard_code = ANY($2::text[])
          )
        `,
        params,
        notes,
        'conversiones dashboard v2',
        []
      )
      : [],
    hasActionPlans
      ? safeQuery(
        `
        SELECT
          iso_code AS standard_code,
          COUNT(*)::integer AS open_count,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::integer AS overdue_count
        FROM action_plans
        WHERE tenant_id = $1::uuid
          AND status NOT IN ('completado','cancelado')
          AND (
            iso_code IS NULL
            OR iso_code = ANY($2::text[])
          )
        GROUP BY iso_code
        `,
        params,
        notes,
        'planes pendientes dashboard v2',
        []
      )
      : [],
    hasFindings
      ? safeQuery(
        `
        SELECT
          iso_code AS standard_code,
          COUNT(*)::integer AS open_count
        FROM findings
        WHERE tenant_id = $1::uuid
          AND status IS DISTINCT FROM 'cerrado'
          AND (
            iso_code IS NULL
            OR iso_code = ANY($2::text[])
          )
        GROUP BY iso_code
        `,
        params,
        notes,
        'hallazgos dashboard v2',
        []
      )
      : [],
    hasNonconformities
      ? safeQuery(
        `
        SELECT
          cc.iso AS standard_code,
          COUNT(*)::integer AS open_count
        FROM tenant_nonconformities nc
        LEFT JOIN controls_catalog cc
          ON cc.id = nc.control_id
        WHERE nc.tenant_id = $1::uuid
          AND nc.status NOT IN ('resuelta','cerrada','cerrado')
          AND (
            cc.iso IS NULL
            OR cc.iso = ANY($2::text[])
          )
        GROUP BY cc.iso
        `,
        params,
        notes,
        'no conformidades dashboard v2',
        []
      )
      : [],
  ]);

  const summary = summaryRows[0] || {};
  const converted = toNumber(summary.converted) + toNumber(conversionRows[0]?.conversions_count);
  const openActionPlans = actionPlanRows.reduce((sum, row) => sum + toNumber(row.open_count), 0);
  const openFindings = findingRows.reduce((sum, row) => sum + toNumber(row.open_count), 0);
  const openNonconformities = ncRows.reduce((sum, row) => sum + toNumber(row.open_count), 0);

  return {
    summary: {
      total: toNumber(summary.total),
      pending: toNumber(summary.pending),
      converted,
      overdue: toNumber(summary.overdue) + actionPlanRows.reduce((sum, row) => sum + toNumber(row.overdue_count), 0),
      pending_approval: toNumber(summary.pending_approval),
      critical: toNumber(summary.critical),
      open_action_plans: openActionPlans,
      open_findings: openFindings,
      open_nonconformities: openNonconformities,
    },
    by_standard: byStandardRows,
    recent: recentRows,
    work_pending: [
      ...actionPlanRows.map((row) => ({
        kind: 'action_plan',
        standard_code: row.standard_code,
        open_count: toNumber(row.open_count),
        overdue_count: toNumber(row.overdue_count),
        route: '/plan-accion',
      })),
      ...findingRows.map((row) => ({
        kind: 'finding',
        standard_code: row.standard_code,
        open_count: toNumber(row.open_count),
        overdue_count: 0,
        route: '/hallazgos',
      })),
      ...ncRows.map((row) => ({
        kind: 'nonconformity',
        standard_code: row.standard_code,
        open_count: toNumber(row.open_count),
        overdue_count: 0,
        route: '/no-conformidades',
      })),
    ],
    data_quality: 'partial',
  };
}

async function getRisksPanelForTenant(tenantId, standards, notes) {
  const hasRisks = await tableExists('iso_risk_matrix_items').catch((error) => {
    console.error('ERROR DASHBOARD V2 RISKS TABLE CHECK:', {
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible verificar matriz de riesgos.');
    return false;
  });

  if (!hasRisks) {
    return {
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        without_owner: 0,
        without_treatment: 0,
        upcoming_due: 0,
      },
      by_standard: [],
      priority_risks: [],
      all_risks: [],
      data_quality: 'limited',
    };
  }

  const standardCodes = activeStandardCodes(standards);
  const params = [tenantId, standardCodes];
  const [summaryRows, byStandardRows, riskRows] = await Promise.all([
    safeQuery(
      `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE residual_risk_level = 'critico')::integer AS critical,
        COUNT(*) FILTER (WHERE residual_risk_level = 'alto')::integer AS high,
        COUNT(*) FILTER (WHERE residual_risk_level = 'medio')::integer AS medium,
        COUNT(*) FILTER (WHERE residual_risk_level = 'bajo')::integer AS low,
        COUNT(*) FILTER (WHERE reviewer_user_id IS NULL)::integer AS without_owner,
        COUNT(*) FILTER (WHERE treatment_strategy IS NULL OR treatment_strategy = '' OR status = 'needs_review')::integer AS without_treatment
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND standard_code = ANY($2::text[])
        AND NOT (standard_code = 'ISO9001' AND version_code = '2026_FDIS')
      `,
      params,
      notes,
      'riesgos dashboard v2',
      []
    ),
    safeQuery(
      `
      SELECT
        standard_code,
        version_code,
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE residual_risk_level = 'critico')::integer AS critical,
        COUNT(*) FILTER (WHERE residual_risk_level = 'alto')::integer AS high,
        COUNT(*) FILTER (WHERE reviewer_user_id IS NULL)::integer AS without_owner,
        COUNT(*) FILTER (WHERE treatment_strategy IS NULL OR treatment_strategy = '' OR status = 'needs_review')::integer AS without_treatment
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND standard_code = ANY($2::text[])
        AND NOT (standard_code = 'ISO9001' AND version_code = '2026_FDIS')
      GROUP BY standard_code, version_code
      ORDER BY critical DESC, high DESC, total DESC
      `,
      params,
      notes,
      'riesgos por norma dashboard v2',
      []
    ),
    safeQuery(
      `
      SELECT
        id,
        standard_code,
        version_code,
        risk_code,
        risk_title,
        risk_description,
        risk_category,
        asset_name,
        asset_type,
        asset_criticality,
        likelihood,
        impact,
        inherent_risk_score,
        inherent_risk_level,
        residual_risk_score,
        residual_risk_level,
        treatment_strategy,
        status,
        confidence,
        created_at,
        updated_at
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
        AND standard_code = ANY($2::text[])
        AND NOT (standard_code = 'ISO9001' AND version_code = '2026_FDIS')
      ORDER BY residual_risk_score DESC, created_at DESC
      LIMIT 120
      `,
      params,
      notes,
      'lista riesgos dashboard v2',
      []
    ),
  ]);

  const summary = summaryRows[0] || {};

  return {
    summary: {
      total: toNumber(summary.total),
      critical: toNumber(summary.critical),
      high: toNumber(summary.high),
      medium: toNumber(summary.medium),
      low: toNumber(summary.low),
      without_owner: toNumber(summary.without_owner),
      without_treatment: toNumber(summary.without_treatment),
      upcoming_due: 0,
    },
    by_standard: compactRowsByDashboardStandards(byStandardRows, standards),
    priority_risks: riskRows.slice(0, 8),
    all_risks: riskRows,
    data_quality: 'partial',
  };
}

async function getKpisPanelForTenant(tenantId, standards, notes) {
  const hasSnapshots = await tableExists('kpi_snapshots').catch((error) => {
    console.error('ERROR DASHBOARD V2 KPI SNAPSHOTS TABLE CHECK:', {
      code: error.code,
      message: error.message,
    });
    notes.push('No fue posible verificar KPIs.');
    return false;
  });
  const hasDefinitions = await tableExists('kpi_definitions').catch(() => false);

  if (!hasSnapshots || !hasDefinitions) {
    return {
      summary: {
        measured_kpis: 0,
        green: 0,
        yellow: 0,
        red: 0,
        gray: 0,
        executive_score: 0,
      },
      by_standard: [],
      items: [],
      data_quality: 'limited',
    };
  }

  const standardCodes = activeStandardCodes(standards);
  const params = [tenantId, standardCodes];
  const [summaryRows, byStandardRows, itemRows] = await Promise.all([
    safeQuery(
      `
      WITH latest AS (
        SELECT
          ks.*,
          kd.code,
          kd.name,
          kd.category,
          ROW_NUMBER() OVER (
            PARTITION BY ks.kpi_id, COALESCE(NULLIF(ks.standard_code, ''), 'GLOBAL')
            ORDER BY ks.calculated_at DESC NULLS LAST, ks.period_start DESC NULLS LAST
          ) AS rn
        FROM kpi_snapshots ks
        JOIN kpi_definitions kd ON kd.id = ks.kpi_id
        WHERE ks.tenant_id = $1::uuid
      )
      SELECT
        COUNT(*)::integer AS measured_kpis,
        COUNT(*) FILTER (WHERE status_color = 'green')::integer AS green,
        COUNT(*) FILTER (WHERE status_color = 'yellow')::integer AS yellow,
        COUNT(*) FILTER (WHERE status_color = 'red')::integer AS red,
        COUNT(*) FILTER (WHERE status_color IS NULL OR status_color = 'gray')::integer AS gray,
        MAX(calculated_at) AS last_calculated_at
      FROM latest
      WHERE rn = 1
        AND (
          standard_code IS NULL
          OR standard_code = ''
          OR standard_code = ANY($2::text[])
        )
      `,
      params,
      notes,
      'kpis dashboard v2',
      []
    ),
    safeQuery(
      `
      WITH latest AS (
        SELECT
          ks.*,
          ROW_NUMBER() OVER (
            PARTITION BY ks.kpi_id, COALESCE(NULLIF(ks.standard_code, ''), 'GLOBAL')
            ORDER BY ks.calculated_at DESC NULLS LAST, ks.period_start DESC NULLS LAST
          ) AS rn
        FROM kpi_snapshots ks
        WHERE ks.tenant_id = $1::uuid
      )
      SELECT
        standard_code,
        COUNT(*)::integer AS measured_kpis,
        COUNT(*) FILTER (WHERE status_color = 'green')::integer AS green,
        COUNT(*) FILTER (WHERE status_color = 'yellow')::integer AS yellow,
        COUNT(*) FILTER (WHERE status_color = 'red')::integer AS red,
        COUNT(*) FILTER (WHERE status_color IS NULL OR status_color = 'gray')::integer AS gray,
        MAX(calculated_at) AS last_calculated_at
      FROM latest
      WHERE rn = 1
        AND standard_code = ANY($2::text[])
      GROUP BY standard_code
      ORDER BY red DESC, yellow DESC, standard_code
      `,
      params,
      notes,
      'kpis por norma dashboard v2',
      []
    ),
    safeQuery(
      `
      WITH latest AS (
        SELECT
          ks.*,
          kd.code,
          kd.name,
          kd.category,
          kd.unit,
          ROW_NUMBER() OVER (
            PARTITION BY ks.kpi_id, COALESCE(NULLIF(ks.standard_code, ''), 'GLOBAL')
            ORDER BY ks.calculated_at DESC NULLS LAST, ks.period_start DESC NULLS LAST
          ) AS rn
        FROM kpi_snapshots ks
        JOIN kpi_definitions kd ON kd.id = ks.kpi_id
        WHERE ks.tenant_id = $1::uuid
      )
      SELECT
        id,
        kpi_id,
        code,
        name,
        category,
        unit,
        standard_code,
        value,
        numerator_value,
        denominator_value,
        status_color,
        calculated_at
      FROM latest
      WHERE rn = 1
        AND (
          standard_code IS NULL
          OR standard_code = ''
          OR standard_code = ANY($2::text[])
        )
      ORDER BY
        CASE status_color
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          WHEN 'green' THEN 3
          ELSE 4
        END,
        calculated_at DESC NULLS LAST
      LIMIT 30
      `,
      params,
      notes,
      'items kpi dashboard v2',
      []
    ),
  ]);

  const summary = summaryRows[0] || {};
  const measured = toNumber(summary.measured_kpis);
  const executiveScore = measured > 0
    ? round2(((toNumber(summary.green) * 1) + (toNumber(summary.yellow) * 0.6) + (toNumber(summary.red) * 0.2)) / measured * 100)
    : 0;

  return {
    summary: {
      measured_kpis: measured,
      green: toNumber(summary.green),
      yellow: toNumber(summary.yellow),
      red: toNumber(summary.red),
      gray: toNumber(summary.gray),
      executive_score: executiveScore,
      last_calculated_at: summary.last_calculated_at || null,
    },
    by_standard: byStandardRows,
    items: itemRows,
    data_quality: measured > 0 ? 'partial' : 'limited',
  };
}

function buildOperationalAlerts({ standards, actionsPanel, risksPanel, kpisPanel, baseAlerts = [] }) {
  const alerts = [];

  standards.forEach((standard) => {
    if (toNumber(standard.readiness_score) < 50) {
      alerts.push({
        level: 'critica',
        type: 'readiness',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `${standard.standard_code} con readiness bajo`,
        message: `Readiness ${round2(standard.readiness_score)}%. Requiere priorizar riesgos, brechas y acciones.`,
        route: '/diagnostico',
      });
    }
    if (toNumber(standard.open_gaps) > 0 || toNumber(standard.gaps_count) > 0) {
      alerts.push({
        level: toNumber(standard.critical_gaps_count) > 0 ? 'critica' : 'alta',
        type: 'gap',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `${standard.standard_code} mantiene brechas abiertas`,
        message: `${toNumber(standard.gaps_count || standard.open_gaps)} brecha(s) detectadas por diagnostico ISO.`,
        route: '/diagnostico',
      });
    }
  });

  if (toNumber(risksPanel.summary.critical) > 0) {
    alerts.push({
      level: 'critica',
      type: 'risk',
      title: 'Riesgos criticos sin resolver',
      message: `${risksPanel.summary.critical} riesgo(s) critico(s) requieren tratamiento y seguimiento.`,
      route: '/matriz-riesgo',
    });
  }

  if (toNumber(risksPanel.summary.without_treatment) > 0) {
    alerts.push({
      level: 'alta',
      type: 'risk_treatment',
      title: 'Riesgos sin tratamiento claro',
      message: `${risksPanel.summary.without_treatment} riesgo(s) necesitan estrategia de tratamiento o revision.`,
      route: '/matriz-riesgo',
    });
  }

  if (toNumber(actionsPanel.summary.overdue) > 0) {
    alerts.push({
      level: 'alta',
      type: 'overdue_action',
      title: 'Acciones vencidas',
      message: `${actionsPanel.summary.overdue} accion(es) o planes requieren regularizacion.`,
      route: '/acciones-recomendadas',
    });
  }

  if (toNumber(actionsPanel.summary.pending_approval) > 0) {
    alerts.push({
      level: 'media',
      type: 'conversion_ready',
      title: 'Acciones listas para revision',
      message: `${actionsPanel.summary.pending_approval} sugerencia(s) pendientes de aprobar, convertir o descartar.`,
      route: '/acciones-recomendadas',
    });
  }

  if (toNumber(kpisPanel.summary.red) > 0) {
    alerts.push({
      level: 'alta',
      type: 'kpi',
      title: 'KPIs en rojo',
      message: `${kpisPanel.summary.red} KPI(s) requieren revision ejecutiva.`,
      route: '/dashboard?view=kpi',
    });
  }

  baseAlerts.forEach((alert) => {
    if (!alerts.some((item) => item.type === alert.type && item.title === alert.title)) {
      alerts.push(alert);
    }
  });

  const rank = { critica: 1, critical: 1, alta: 2, warning: 2, media: 3, info: 4, baja: 5 };

  return alerts
    .sort((a, b) => (rank[String(a.level).toLowerCase()] || 9) - (rank[String(b.level).toLowerCase()] || 9))
    .slice(0, 20);
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
  return cards
    .filter((standard) => !(standard.standard_code === 'ISO9001' && standard.version_code === '2026_FDIS'))
    .map((standard) => ({
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
  const [actionsPanel, risksPanel, kpisPanel] = await Promise.all([
    getActionsPanelForTenant(tenantId, standardCards, notes),
    getRisksPanelForTenant(tenantId, standardCards, notes),
    getKpisPanelForTenant(tenantId, standardCards, notes),
  ]);
  const operationalAlerts = buildOperationalAlerts({
    standards: standardCards,
    actionsPanel,
    risksPanel,
    kpisPanel,
    baseAlerts: unified.alerts || [],
  });
  const executiveReadiness = buildExecutiveMessage(unified.summary, unified.priorities || [], operationalAlerts);
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
    operational_panels: {
      actions: actionsPanel,
      risks: risksPanel,
      kpis: kpisPanel,
      alerts: operationalAlerts,
    },
    alerts: operationalAlerts,
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

async function getOperationalStandardsForUser(user) {
  const tenantId = resolveTenantId(user);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  const notes = [];
  const unified = await isoCommandCenter.getUnified(user, {});
  const standardCards = normalizeStandardCards(unified.standard_cards || []);

  return {
    tenantId,
    notes,
    standardCards,
    baseAlerts: unified.alerts || [],
  };
}

async function getActions(user) {
  const { tenantId, notes, standardCards } = await getOperationalStandardsForUser(user);
  const data = await getActionsPanelForTenant(tenantId, standardCards, notes);

  return {
    tenant_id: tenantId,
    actions: data,
    active_standards: standardCards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
    })),
    data_quality: {
      level: notes.length > 0 || data.data_quality !== 'complete' ? 'partial' : 'complete',
      notes,
    },
  };
}

async function getRisks(user) {
  const { tenantId, notes, standardCards } = await getOperationalStandardsForUser(user);
  const data = await getRisksPanelForTenant(tenantId, standardCards, notes);

  return {
    tenant_id: tenantId,
    risks: data,
    active_standards: standardCards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
    })),
    data_quality: {
      level: notes.length > 0 || data.data_quality !== 'complete' ? 'partial' : 'complete',
      notes,
    },
  };
}

async function getKpis(user) {
  const { tenantId, notes, standardCards } = await getOperationalStandardsForUser(user);
  const data = await getKpisPanelForTenant(tenantId, standardCards, notes);

  return {
    tenant_id: tenantId,
    kpis: data,
    active_standards: standardCards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
    })),
    data_quality: {
      level: notes.length > 0 || data.data_quality !== 'complete' ? 'partial' : 'complete',
      notes,
    },
  };
}

async function getAlerts(user) {
  const { tenantId, notes, standardCards, baseAlerts } = await getOperationalStandardsForUser(user);
  const [actionsPanel, risksPanel, kpisPanel] = await Promise.all([
    getActionsPanelForTenant(tenantId, standardCards, notes),
    getRisksPanelForTenant(tenantId, standardCards, notes),
    getKpisPanelForTenant(tenantId, standardCards, notes),
  ]);
  const alerts = buildOperationalAlerts({
    standards: standardCards,
    actionsPanel,
    risksPanel,
    kpisPanel,
    baseAlerts,
  });

  return {
    tenant_id: tenantId,
    alerts,
    active_standards: standardCards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
    })),
    data_quality: {
      level: notes.length > 0 ? 'partial' : 'complete',
      notes,
    },
  };
}

async function getPreferences(user, query = {}) {
  const tenantId = resolveTenantId(user);
  const userId = resolveUserId(user);
  const dashboardKey = normalizeDashboardKey(query.dashboard_key);

  const exists = await tableExists('user_dashboard_preferences');
  if (!exists) {
    return {
      tenant_id: tenantId,
      user_id: userId,
      dashboard_key: dashboardKey,
      layout_json: DEFAULT_LAYOUT,
      is_default: true,
      data_quality: {
        level: 'limited',
        notes: ['Tabla user_dashboard_preferences aun no existe. Aplicar migracion 20260507_dashboard_v2_user_preferences.sql.'],
      },
    };
  }

  const result = await pool.query(
    `
    SELECT id, tenant_id, user_id, dashboard_key, layout_json, created_at, updated_at
    FROM user_dashboard_preferences
    WHERE tenant_id = $1::uuid
      AND user_id = $2::uuid
      AND dashboard_key = $3
    LIMIT 1
    `,
    [tenantId, userId, dashboardKey]
  );

  if (!result.rowCount) {
    return {
      tenant_id: tenantId,
      user_id: userId,
      dashboard_key: dashboardKey,
      layout_json: DEFAULT_LAYOUT,
      is_default: true,
      data_quality: {
        level: 'complete',
        notes: [],
      },
    };
  }

  const row = result.rows[0];
  return {
    id: row.id,
    tenant_id: tenantId,
    user_id: userId,
    dashboard_key: dashboardKey,
    layout_json: normalizeLayout(row.layout_json || DEFAULT_LAYOUT),
    is_default: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data_quality: {
      level: 'complete',
      notes: [],
    },
  };
}

async function savePreferences(user, payload = {}) {
  const tenantId = resolveTenantId(user);
  const userId = resolveUserId(user);
  const dashboardKey = normalizeDashboardKey(payload.dashboard_key);
  const layout = normalizeLayout(payload.layout_json || payload.layout || {});

  const exists = await tableExists('user_dashboard_preferences');
  if (!exists) {
    throw publicError(500, 'PREFERENCES_TABLE_MISSING', 'Tabla user_dashboard_preferences no existe; aplicar migracion');
  }

  const result = await pool.query(
    `
    INSERT INTO user_dashboard_preferences (
      tenant_id,
      user_id,
      dashboard_key,
      layout_json
    )
    VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)
    ON CONFLICT (tenant_id, user_id, dashboard_key)
    DO UPDATE SET
      layout_json = EXCLUDED.layout_json,
      updated_at = now()
    RETURNING id, tenant_id, user_id, dashboard_key, layout_json, created_at, updated_at
    `,
    [tenantId, userId, dashboardKey, JSON.stringify(layout)]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    tenant_id: tenantId,
    user_id: userId,
    dashboard_key: dashboardKey,
    layout_json: row.layout_json,
    is_default: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resetPreferences(user, query = {}) {
  const tenantId = resolveTenantId(user);
  const userId = resolveUserId(user);
  const dashboardKey = normalizeDashboardKey(query.dashboard_key);

  const exists = await tableExists('user_dashboard_preferences');
  if (exists) {
    await pool.query(
      `
      DELETE FROM user_dashboard_preferences
      WHERE tenant_id = $1::uuid
        AND user_id = $2::uuid
        AND dashboard_key = $3
      `,
      [tenantId, userId, dashboardKey]
    );
  }

  return {
    tenant_id: tenantId,
    user_id: userId,
    dashboard_key: dashboardKey,
    layout_json: DEFAULT_LAYOUT,
    is_default: true,
  };
}

module.exports = {
  getSummary,
  getActions,
  getRisks,
  getKpis,
  getAlerts,
  getPreferences,
  savePreferences,
  resetPreferences,
};
