const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../config/db');
const { errorDetail } = require('../utils/errorResponse');
const {
  getJwtSecret,
  getJwtVerifyOptions,
} = require('../config/security');
const {
  getTenantApplicabilityScope,
  filterApplicableControls,
  filterApplicableKpis,
} = require('../services/applicabilityScope.service');
const {
  buildTenantApplicabilityUniverse,
} = require('../services/companyProfileApplicabilityEngine.service');
const sprintHealthService = require('../services/health.service');

// =====================================================
// Middleware local de autenticación para rutas Health
// =====================================================
function authenticateHealth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Token requerido',
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const secret = getJwtSecret();

    if (!secret) {
      return res.status(500).json({
        ok: false,
        error: 'Servicio de autenticación no disponible',
      });
    }

    const decoded = jwt.verify(token, secret, getJwtVerifyOptions());
    req.user = decoded;

    next();
  } catch (error) {
    console.error('Error autenticando Health:', error.message);

    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado',
    });
  }
}

// =====================================================
// Helpers multitenant
// =====================================================
function getUserRole(user) {
  return String(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      user?.profile ||
      ''
  ).toLowerCase();
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.userID || user?.id || null;
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

function isSuperAdmin(user) {
  const role = getUserRole(user);

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(role);
}

function resolveTenantScope(req) {
  const user = req.user;
  const superAdmin = isSuperAdmin(user);
  const userTenantId = getUserTenantId(user);

  if (superAdmin) {
    return {
      isSuperAdmin: true,
      tenantId: req.query.tenant_id || req.body?.tenant_id || null,
    };
  }

  return {
    isSuperAdmin: false,
    tenantId: userTenantId,
  };
}

function requireTenantForNonSuper(req, res) {
  const scope = resolveTenantScope(req);

  if (!scope.isSuperAdmin && !scope.tenantId) {
    res.status(403).json({
      ok: false,
      error: 'Usuario sin tenant_id asociado',
    });
    return null;
  }

  return scope;
}

function isApiHealthRequest(req) {
  return String(req.baseUrl || '').startsWith('/api/health');
}

function healthQueryParams(req) {
  return {
    standardId: req.query.standard_id || req.query.standardId || req.query.standard_code || req.query.standardCode || null,
    standardCode: req.query.standard_code || req.query.standardCode || null,
    processId: req.query.process_id || req.query.processId || null,
    operationId: req.query.operation_id || req.query.operationId || null,
  };
}

function sendSprintHealth(res, data, extra = {}) {
  return res.json({
    ok: true,
    data,
    ...extra,
  });
}

function normalizePriority(priority) {
  if (priority === 'urgente') return 'alta';
  if (priority === 'alta') return 'alta';
  if (priority === 'media') return 'media';
  if (priority === 'baja') return 'baja';
  return 'media';
}

function addTenantCondition({ query, params, tenantId, alias = '' }) {
  if (!tenantId) return query;

  params.push(tenantId);
  const prefix = alias ? `${alias}.` : '';

  if (query.toLowerCase().includes(' where ')) {
    return `${query} AND ${prefix}tenant_id = $${params.length}`;
  }

  return `${query} WHERE ${prefix}tenant_id = $${params.length}`;
}

function addActiveStandardCondition({
  query,
  alias = '',
  nullableStandard = false,
}) {
  const prefix = alias ? `${alias}.` : '';

  const condition = nullableStandard
    ? `
      (
        ${prefix}standard_code IS NULL
        OR EXISTS (
          SELECT 1
          FROM tenant_standards ts_scope
          WHERE ts_scope.tenant_id = ${prefix}tenant_id
            AND ts_scope.standard_code = ${prefix}standard_code
            AND ts_scope.is_active = TRUE
        )
      )
    `
    : `
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = ${prefix}tenant_id
          AND ts_scope.standard_code = ${prefix}standard_code
          AND ts_scope.is_active = TRUE
      )
    `;

  if (query.toLowerCase().includes(' where ')) {
    return `${query} AND ${condition}`;
  }

  return `${query} WHERE ${condition}`;
}

async function ensureActiveTenantStandard(client, tenantId, standardCode) {
  if (!tenantId || !standardCode) return false;

  const result = await client.query(
    `
    SELECT 1
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = $2
      AND is_active = TRUE
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return result.rowCount > 0;
}

const relationExistsCache = new Map();

async function relationExists(relationName) {
  if (relationExistsCache.has(relationName)) return relationExistsCache.get(relationName);
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    UNION ALL
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [relationName]
  );
  const exists = result.rowCount > 0;
  relationExistsCache.set(relationName, exists);
  return exists;
}

function isRecoverableHealthSqlError(error) {
  const code = String(error?.code || '');
  return ['42P01', '42703', '42702', '42883', '42P10'].includes(code);
}

function safeHealthFallbackReason(error, fallback = 'applicable_view_unavailable') {
  if (!error) return fallback;
  return {
    reason: fallback,
    code: error.code || error.name || 'SQL_ERROR',
    message: String(error.message || 'Vista aplicable no disponible').slice(0, 220),
  };
}

async function runHealthSourceQuery({ preferred, fallback, buildQuery }) {
  const preferredExists = await relationExists(preferred);
  const sources = preferredExists ? [preferred, fallback] : [fallback];
  let preferredError = null;

  for (const sourceName of sources) {
    const { query, params } = buildQuery(sourceName);
    try {
      const result = await pool.query(query, params);
      const fallbackUsed = sourceName === fallback && preferred !== fallback;
      return {
        sourceName,
        result,
        fallback_legacy_used: fallbackUsed,
        legacy_fallback_used: fallbackUsed,
        fallback_reason: fallbackUsed
          ? safeHealthFallbackReason(preferredError, 'applicable_view_query_failed')
          : (!preferredExists ? 'applicable_view_not_found' : null),
      };
    } catch (error) {
      if (sourceName === preferred && isRecoverableHealthSqlError(error)) {
        preferredError = error;
        console.warn('HEALTH APPLICABLE VIEW FALLBACK:', {
          preferred,
          fallback,
          code: error.code || error.name,
          message: String(error.message || '').slice(0, 220),
        });
        continue;
      }
      throw error;
    }
  }

  throw preferredError || new Error('No fue posible consultar salud');
}

async function buildHealthScope(scope, sourceName, extra = {}) {
  const applicability = await getTenantApplicabilityScope(scope.tenantId);
  const fallbackUsed = extra.fallback_legacy_used === true || extra.legacy_fallback_used === true;
  return {
    is_superadmin: scope.isSuperAdmin,
    tenant_id: scope.tenantId,
    source: sourceName,
    tenant_filter_enforced: applicability.tenant_filter_enforced === true,
    filtered_by_tenant_id: applicability.filtered_by_tenant_id === true,
    active_universe: applicability.active_universe === true,
    applicability_universe_applied: applicability.applicability_universe_applied === true && !fallbackUsed,
    filtered_by_applicability_universe: applicability.filtered_by_applicability_universe === true && !fallbackUsed,
    fallback_legacy_used: fallbackUsed,
    legacy_fallback_used: fallbackUsed,
    fallback_reason: extra.fallback_reason || null,
    applicability_scope: {
      ...applicability,
      fallback_legacy_used: fallbackUsed,
      legacy_fallback_used: fallbackUsed,
      fallback_reason: extra.fallback_reason || null,
    },
  };
}

// =====================================================
// Aplicar autenticación a todo /health
// =====================================================
router.use(authenticateHealth);

// =====================================================
// GET /api/health/summary
// =====================================================
router.get('/summary', async (req, res) => {
  try {
    const params = healthQueryParams(req);
    const data = await sprintHealthService.getSummary({
      user: req.user,
      standardId: params.standardId,
      standardCode: params.standardCode,
    });
    return sendSprintHealth(res, data);
  } catch (error) {
    console.error('Error en /api/health/summary:', error);
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Error obteniendo resumen de salud del sistema',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/health/processes
// =====================================================
router.get('/processes', async (req, res) => {
  try {
    const params = healthQueryParams(req);
    const data = await sprintHealthService.getProcessesHealth({
      user: req.user,
      standardId: params.standardId,
      standardCode: params.standardCode,
      processId: params.processId,
      operationId: params.operationId,
    });
    return sendSprintHealth(res, data.processes, {
      data_quality_warnings: data.data_quality_warnings,
      count: data.processes.length,
    });
  } catch (error) {
    console.error('Error en /api/health/processes:', error);
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Error obteniendo salud por proceso',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/health/process-detail
// =====================================================
router.get('/process-detail', async (req, res) => {
  try {
    const params = healthQueryParams(req);
    const data = await sprintHealthService.getProcessDetail({
      user: req.user,
      standardId: params.standardId,
      standardCode: params.standardCode,
      processId: params.processId,
      operationId: params.operationId,
    });
    return sendSprintHealth(res, data);
  } catch (error) {
    console.error('Error en /api/health/process-detail:', error);
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Error obteniendo detalle de salud por proceso',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/dashboard
// =====================================================
router.get('/dashboard', async (req, res) => {
  try {
    if (isApiHealthRequest(req)) {
      const data = await sprintHealthService.getDashboard({ user: req.user });
      return sendSprintHealth(res, data);
    }

    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const healthQuery = await runHealthSourceQuery({
      preferred: 'v_health_dashboard_summary_applicable',
      fallback: 'v_health_dashboard_summary',
      buildQuery: (sourceName) => {
        let query = `
          SELECT *
          FROM ${sourceName} v
        `;

        const params = [];

        query = addTenantCondition({
          query,
          params,
          tenantId: scope.tenantId,
          alias: 'v',
        });

        query += ` ORDER BY v.avg_health_score DESC`;
        return { query, params };
      },
    });

    const { sourceName, result } = healthQuery;

    const rows = sourceName.endsWith('_applicable') || (scope.isSuperAdmin && req.query.include_exclusions === 'true')
      ? result.rows
      : await filterApplicableKpis(result.rows, scope.tenantId);
    const responseScope = await buildHealthScope(scope, sourceName, healthQuery);

    return res.json({
      ok: true,
      data: rows,
      scope: responseScope,
    });
  } catch (error) {
    console.error('Error en /health/dashboard:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo dashboard de salud',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/standards
// =====================================================
router.get('/standards', async (req, res) => {
  try {
    if (isApiHealthRequest(req)) {
      const params = healthQueryParams(req);
      const data = await sprintHealthService.getStandardsHealth({
        user: req.user,
        standardId: params.standardId,
        standardCode: params.standardCode,
      });
      return sendSprintHealth(res, data.standards, {
        data_quality_warnings: data.data_quality_warnings,
        count: data.standards.length,
      });
    }

    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;
    const standardCode = req.query.standard_code || req.query.standardCode || '';

    const healthQuery = await runHealthSourceQuery({
      preferred: 'v_health_dashboard_by_standard_applicable',
      fallback: 'v_health_dashboard_by_standard',
      buildQuery: (sourceName) => {
        let query = `
          SELECT *
          FROM ${sourceName} v
        `;

        const params = [];

        query = addTenantCondition({
          query,
          params,
          tenantId: scope.tenantId,
          alias: 'v',
        });

        query = addActiveStandardCondition({
          query,
          alias: 'v',
        });

        if (standardCode) {
          params.push(standardCode);
          query += ` AND v.standard_code = $${params.length}`;
        }

        query += ` ORDER BY v.tenant_name, v.standard_code`;
        return { query, params };
      },
    });

    const { sourceName, result } = healthQuery;

    const rows = sourceName.endsWith('_applicable') || (scope.isSuperAdmin && req.query.include_exclusions === 'true')
      ? result.rows
      : await filterApplicableControls(result.rows, scope.tenantId, { standardCode });
    const responseScope = await buildHealthScope(scope, sourceName, healthQuery);

    return res.json({
      ok: true,
      data: rows,
      scope: responseScope,
    });
  } catch (error) {
    console.error('Error en /health/standards:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo salud por norma',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/kpis
// =====================================================
router.get('/kpis', async (req, res) => {
  try {
    if (isApiHealthRequest(req)) {
      const data = await sprintHealthService.getKpis({ user: req.user });
      return sendSprintHealth(res, data, { count: data.length });
    }

    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const healthQuery = await runHealthSourceQuery({
      preferred: 'v_latest_health_kpi_snapshots_applicable',
      fallback: 'v_latest_health_kpi_snapshots',
      buildQuery: (sourceName) => {
        let query = `
          SELECT *
          FROM ${sourceName} v
        `;

        const params = [];

        query = addTenantCondition({
          query,
          params,
          tenantId: scope.tenantId,
          alias: 'v',
        });

        query = addActiveStandardCondition({
          query,
          alias: 'v',
          nullableStandard: true,
        });

        query += `
          ORDER BY v.tenant_name, v.kpi_code, v.standard_code NULLS FIRST
        `;
        return { query, params };
      },
    });

    const { sourceName, result } = healthQuery;
    const rows = sourceName.endsWith('_applicable') || (scope.isSuperAdmin && req.query.include_exclusions === 'true')
      ? result.rows
      : await filterApplicableKpis(result.rows, scope.tenantId);
    const responseScope = await buildHealthScope(scope, sourceName, healthQuery);

    return res.json({
      ok: true,
      data: rows,
      scope: responseScope,
    });
  } catch (error) {
    console.error('Error en /health/kpis:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo KPIs de salud',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/controls-risk
// =====================================================
router.get('/controls-risk', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code;

    const healthQuery = await runHealthSourceQuery({
      preferred: 'v_control_health_risks_applicable',
      fallback: 'v_control_health_risks',
      buildQuery: (sourceName) => {
        let query = `
          SELECT
            v.tenant_id,
            v.tenant_name,
            v.tenant_control_id,
            v.standard_code,
            v.clause,
            v.category,
            v.control_description,
            v.control_status,
            v.priority,
            v.applicability,
            v.health_score,
            v.health_status,
            v.evidence_score,
            v.compliance_score,
            v.findings_score,
            v.action_score,
            v.risk_score,
            v.review_score,
            v.evidence_count,
            v.approved_evidence_count,
            v.pending_evidence_count,
            v.rejected_evidence_count,
            v.open_findings_count,
            v.open_actions_count,
            v.overdue_actions_count,
            v.high_risks_count,
            v.calculated_at
          FROM ${sourceName} v
        `;

        const params = [];
        const conditions = [];

        if (scope.tenantId) {
          params.push(scope.tenantId);
          conditions.push(`v.tenant_id = $${params.length}`);
        }

        if (standardCode) {
          params.push(standardCode);
          conditions.push(`v.standard_code = $${params.length}`);
        }

        conditions.push(`
          EXISTS (
            SELECT 1
            FROM tenant_standards ts_scope
            WHERE ts_scope.tenant_id = v.tenant_id
              AND ts_scope.standard_code = v.standard_code
              AND ts_scope.is_active = TRUE
          )
        `);

        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += `
          ORDER BY v.health_score ASC, v.evidence_count ASC, v.standard_code, v.clause
          LIMIT 100
        `;
        return { query, params };
      },
    });

    const { sourceName, result } = healthQuery;
    const rows = sourceName.endsWith('_applicable') || (scope.isSuperAdmin && req.query.include_exclusions === 'true')
      ? result.rows
      : await filterApplicableControls(result.rows, scope.tenantId, { standardCode });
    const responseScope = await buildHealthScope(scope, sourceName, healthQuery);

    return res.json({
      ok: true,
      data: rows,
      scope: responseScope,
    });
  } catch (error) {
    console.error('Error en /health/controls-risk:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo controles deteriorados',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/root-causes
// =====================================================
router.get('/root-causes', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    let query = `
      SELECT *
      FROM v_health_root_causes_by_tenant v
    `;

    const params = [];

    query = addTenantCondition({
      query,
      params,
      tenantId: scope.tenantId,
      alias: 'v',
    });

    query += ` ORDER BY v.avg_health_score ASC`;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/root-causes:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo causas raíz por empresa',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/root-causes/standards
// =====================================================
router.get('/root-causes/standards', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code;

    let query = `
      SELECT *
      FROM v_health_root_causes_by_standard v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY v.tenant_name, v.avg_health_score ASC, v.standard_code`;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/root-causes/standards:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo causas raíz por norma',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/remediation-summary
// =====================================================
router.get('/remediation-summary', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    let query = `
      SELECT *
      FROM v_health_remediation_summary_by_tenant v
    `;

    const params = [];

    query = addTenantCondition({
      query,
      params,
      tenantId: scope.tenantId,
      alias: 'v',
    });

    query += `
      ORDER BY v.urgent_actions DESC, v.high_actions DESC, v.total_suggested_actions DESC
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/remediation-summary:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo resumen de remediación',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/remediation-summary/standards
// =====================================================
router.get('/remediation-summary/standards', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code;

    let query = `
      SELECT *
      FROM v_health_remediation_summary_by_standard v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      ORDER BY v.tenant_name, v.urgent_actions DESC, v.high_actions DESC, v.standard_code
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/remediation-summary/standards:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo resumen de remediación por norma',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/remediation-plan
// =====================================================
router.get('/remediation-plan', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const priority = req.query.priority || '';
    const gap = req.query.gap || '';
    const limit = Math.min(Number(req.query.limit || 50), 200);

    let query = `
      SELECT *
      FROM v_health_remediation_plan v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    if (priority) {
      params.push(priority);
      conditions.push(`v.remediation_priority = $${params.length}`);
    }

    if (gap) {
      params.push(gap);
      conditions.push(`v.main_gap_key = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.remediation_priority_order ASC, v.health_score ASC, v.suggested_due_date ASC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/remediation-plan:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo plan de remediación',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/remediation-executive
// =====================================================
router.get('/remediation-executive', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    let query = `
      SELECT *
      FROM v_remediation_executive_by_tenant v
    `;

    const params = [];

    query = addTenantCondition({
      query,
      params,
      tenantId: scope.tenantId,
      alias: 'v',
    });

    query += `
      ORDER BY v.open_actions DESC, v.overdue_actions DESC, v.tenant_name
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/remediation-executive:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo ejecutivo de remediación',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/remediation-executive/standards
// =====================================================
router.get('/remediation-executive/standards', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';

    let query = `
      SELECT *
      FROM v_remediation_executive_by_standard v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      ORDER BY v.tenant_name, v.open_actions DESC, v.overdue_actions DESC, v.standard_code
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/remediation-executive/standards:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo ejecutivo de remediación por norma',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/evidence-approval-queue
// =====================================================
router.get('/evidence-approval-queue', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const limit = Math.min(Number(req.query.limit || 20), 200);

    let query = `
      SELECT *
      FROM v_evidence_approval_queue v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.created_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/evidence-approval-queue:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo cola de aprobación de evidencias',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/controls-recovered
// =====================================================
router.get('/controls-recovered', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const limit = Math.min(Number(req.query.limit || 20), 200);

    let query = `
      SELECT *
      FROM v_controls_recovered_by_remediation v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.standard_code = $${params.length}`);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM tenant_standards ts_scope
        WHERE ts_scope.tenant_id = v.tenant_id
          AND ts_scope.standard_code = v.standard_code
          AND ts_scope.is_active = TRUE
      )
    `);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.latest_evidence_reviewed_at DESC NULLS LAST, v.completed_at DESC NULLS LAST
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/controls-recovered:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo controles recuperados',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/audit-log
// =====================================================
router.get('/audit-log', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const tableName = req.query.table_name || '';
    const action = req.query.action || '';
    const limit = Math.min(Number(req.query.limit || 100), 500);

    let query = `
      SELECT *
      FROM v_audit_event_log_enriched v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (tableName) {
      params.push(tableName);
      conditions.push(`v.table_name = $${params.length}`);
    }

    if (action) {
      params.push(action);
      conditions.push(`v.action = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.changed_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/audit-log:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo bitácora de auditoría',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/audit-log/action-plans
// =====================================================
router.get('/audit-log/action-plans', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const limit = Math.min(Number(req.query.limit || 100), 500);

    let query = `
      SELECT *
      FROM v_audit_action_plan_timeline v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.iso_code = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.changed_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/audit-log/action-plans:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo auditoría de planes de acción',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/audit-log/evidences
// =====================================================
router.get('/audit-log/evidences', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const limit = Math.min(Number(req.query.limit || 100), 500);

    let query = `
      SELECT *
      FROM v_audit_evidence_timeline v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.iso_code = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.changed_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/audit-log/evidences:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo auditoría de evidencias',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /health/audit-log/control-recovery
// =====================================================
router.get('/audit-log/control-recovery', async (req, res) => {
  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const standardCode = req.query.standard_code || '';
    const limit = Math.min(Number(req.query.limit || 100), 500);

    let query = `
      SELECT *
      FROM v_audit_control_recovery_timeline v
    `;

    const params = [];
    const conditions = [];

    if (scope.tenantId) {
      params.push(scope.tenantId);
      conditions.push(`v.tenant_id = $${params.length}`);
    }

    if (standardCode) {
      params.push(standardCode);
      conditions.push(`v.iso_code = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);

    query += `
      ORDER BY v.recovered_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
      scope: {
        is_superadmin: scope.isSuperAdmin,
        tenant_id: scope.tenantId,
      },
    });
  } catch (error) {
    console.error('Error en /health/audit-log/control-recovery:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo auditoría de recuperación de controles',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// POST /health/remediation-plan/create-action
// =====================================================
router.post('/remediation-plan/create-action', async (req, res) => {
  const client = await pool.connect();

  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const body = req.body || {};

    const requestedTenantId = body.tenant_id || null;
    const finalTenantId = scope.isSuperAdmin ? requestedTenantId : scope.tenantId;

    if (!finalTenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id requerido',
      });
    }

    if (
      !scope.isSuperAdmin &&
      requestedTenantId &&
      String(requestedTenantId) !== String(scope.tenantId)
    ) {
      return res.status(403).json({
        ok: false,
        error: 'No autorizado para crear acciones en otra empresa',
      });
    }

    const tenantControlId = body.tenant_control_id || null;
    const isoCode = body.iso_code || body.standard_code || null;
    const title = body.title || 'Acción correctiva sugerida';
    const description = body.description || null;
    const owner = body.owner || null;
    const dueDate = body.due_date || null;
    const priority = normalizePriority(body.priority);
    const mainGapKey = body.main_gap_key || null;
    const mainGapLabel = body.main_gap_label || null;

    if (!tenantControlId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_control_id requerido',
      });
    }

    if (!isoCode) {
      return res.status(400).json({
        ok: false,
        error: 'iso_code requerido',
      });
    }

    const activeStandard = await ensureActiveTenantStandard(
      client,
      finalTenantId,
      isoCode
    );

    if (!activeStandard) {
      return res.status(400).json({
        ok: false,
        error: 'La norma no está contratada/activa para esta empresa',
      });
    }

    const validTenantControl = await client.query(
      `
      SELECT
        tc.id,
        tc.tenant_id,
        cc.iso
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.id = $1
        AND tc.tenant_id = $2
        AND cc.iso = $3
      LIMIT 1
      `,
      [tenantControlId, finalTenantId, isoCode]
    );

    if (validTenantControl.rowCount === 0) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_control_id no pertenece a la empresa o norma indicada',
      });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT *
      FROM action_plans
      WHERE tenant_id = $1
        AND tenant_control_id = $2
        AND source_type = 'control'
        AND status IN ('abierto', 'en progreso', 'bloqueado')
        AND (
          source_id = $2
          OR title = $3
        )
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [finalTenantId, tenantControlId, title]
    );

    if (existing.rows.length > 0) {
      await client.query('COMMIT');

      return res.json({
        ok: true,
        already_exists: true,
        data: existing.rows[0],
      });
    }

    const metadataText = [
      description,
      '',
      '---',
      'Origen: Motor de Salud ISO',
      mainGapLabel ? `Brecha principal: ${mainGapLabel}` : null,
      mainGapKey ? `Código brecha: ${mainGapKey}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const insert = await client.query(
      `
      INSERT INTO action_plans (
        tenant_id,
        iso_code,
        title,
        description,
        source_type,
        source_id,
        priority,
        status,
        owner,
        due_date,
        created_by,
        tenant_control_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'control',
        $5,
        $6,
        'abierto',
        $7,
        $8,
        $9,
        $5
      )
      RETURNING *
      `,
      [
        finalTenantId,
        isoCode,
        title,
        metadataText,
        tenantControlId,
        priority,
        owner,
        dueDate,
        getUserId(req.user),
      ]
    );

    await client.query('COMMIT');

    let applicability = null;
    if (finalTenantId) {
      try {
        const rebuilt = await buildTenantApplicabilityUniverse({
          tenantId: finalTenantId,
          userId: getUserId(req.user),
          forceRebuild: false,
        });
        applicability = rebuilt?.summary || null;
      } catch (applicabilityError) {
        applicability = {
          active_universe: false,
          applicability_universe_missing: true,
          warning: 'applicability_refresh_failed',
          error_type: applicabilityError?.code || applicabilityError?.name || 'APPLICABILITY_REFRESH_ERROR',
        };
      }
    }

    return res.json({
      ok: true,
      already_exists: false,
      data: insert.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en /health/remediation-plan/create-action:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error creando plan de acción desde remediación',
      ...errorDetail(error),
    });
  } finally {
    client.release();
  }
});

// =====================================================
// POST /health/refresh
// =====================================================
router.post('/refresh', async (req, res) => {
  const client = await pool.connect();

  try {
    const scope = requireTenantForNonSuper(req, res);
    if (!scope) return;

    const finalTenantId = scope.tenantId || null;

    await client.query('BEGIN');

    const healthResult = await client.query(
      `SELECT * FROM refresh_control_health_scores_v2_1($1::uuid)`,
      [finalTenantId]
    );

    const cleanupAfterHealth = await client.query(
      `SELECT * FROM cleanup_inactive_health_scope($1::uuid)`,
      [finalTenantId]
    );

    const kpiResult = await client.query(
      `SELECT * FROM refresh_kpi_health_snapshots($1::uuid)`,
      [finalTenantId]
    );

    const cleanupAfterKpis = await client.query(
      `SELECT * FROM cleanup_inactive_health_scope($1::uuid)`,
      [finalTenantId]
    );

    await client.query('COMMIT');

    let applicabilityScope = null;
    if (finalTenantId) {
      try {
        applicabilityScope = await getTenantApplicabilityScope(finalTenantId);
        if (applicabilityScope.active_universe !== true) {
          try {
            const rebuilt = await buildTenantApplicabilityUniverse({
              tenantId: finalTenantId,
              userId: getUserId(req.user),
              forceRebuild: false,
            });
            applicabilityScope = {
              ...applicabilityScope,
              ...(rebuilt?.summary || {}),
              active_universe: rebuilt?.summary?.active_universe !== false,
              applicability_universe_applied: rebuilt?.summary?.active_universe !== false,
              filtered_by_applicability_universe: rebuilt?.summary?.active_universe !== false,
              rebuild_attempted: true,
            };
          } catch (rebuildError) {
            applicabilityScope = {
              ...applicabilityScope,
              active_universe: false,
              applicability_universe_applied: false,
              filtered_by_applicability_universe: false,
              fallback_legacy_used: true,
              legacy_fallback_used: true,
              fallback_reason: {
                reason: 'applicability_rebuild_failed',
                code: rebuildError?.code || rebuildError?.name || 'APPLICABILITY_REBUILD_ERROR',
                message: String(rebuildError?.message || '').slice(0, 220),
              },
            };
          }
        }
      } catch (scopeError) {
        applicabilityScope = {
          active_universe: false,
          applicability_universe_applied: false,
          filtered_by_applicability_universe: false,
          tenant_filter_enforced: Boolean(finalTenantId),
          filtered_by_tenant_id: Boolean(finalTenantId),
          fallback_legacy_used: true,
          legacy_fallback_used: true,
          fallback_reason: {
            reason: 'applicability_scope_unavailable',
            code: scopeError?.code || scopeError?.name || 'APPLICABILITY_SCOPE_ERROR',
            message: String(scopeError?.message || '').slice(0, 220),
          },
        };
      }
    }

    return res.json({
      ok: true,
      engine: 'control_health_v2_1',
      scope: finalTenantId ? 'tenant' : 'global',
      tenant_id: finalTenantId,
      active_universe: applicabilityScope?.active_universe === true,
      applicability_universe_applied: applicabilityScope?.applicability_universe_applied === true,
      filtered_by_applicability_universe: applicabilityScope?.filtered_by_applicability_universe === true,
      fallback_legacy_used: applicabilityScope?.fallback_legacy_used === true || applicabilityScope?.legacy_fallback_used === true,
      legacy_fallback_used: applicabilityScope?.legacy_fallback_used === true || applicabilityScope?.fallback_legacy_used === true,
      tenant_filter_enforced: Boolean(finalTenantId),
      filtered_by_tenant_id: Boolean(finalTenantId),
      health: healthResult.rows[0] || null,
      kpis: kpiResult.rows[0] || null,
      cleanup: {
        after_health: cleanupAfterHealth.rows[0] || null,
        after_kpis: cleanupAfterKpis.rows[0] || null,
      },
      applicability_scope: applicabilityScope,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('ERROR REFRESH HEALTH V2.1:', err);

    return res.status(500).json({
      ok: false,
      error: 'Error recalculando salud de controles',
    });
  } finally {
    client.release();
  }
});

module.exports = router;
