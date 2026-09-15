const {
  isPlatformRole,
} = require('../services/auth/roleCompatibility.service');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function getUserRole(user) {
  return String(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      user?.profile ||
      ''
  ).toLowerCase();
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

  return isPlatformRole(role);
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;

  const userTenantId = getUserTenantId(req.user);
  return Boolean(
    userTenantId &&
      tenantId &&
      String(userTenantId) === String(tenantId)
  );
}

router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      WITH active_standards AS (
        SELECT standard_code
        FROM tenant_standards
        WHERE tenant_id = $1
          AND is_active = TRUE
      ),
      latest_health AS (
        SELECT DISTINCT ON (veh.tenant_control_id)
          veh.tenant_control_id,
          veh.standard_code,
          veh.effective_health_score AS health_score,
          CASE
            WHEN veh.effective_health_score IS NULL THEN 'sin_datos'
            WHEN veh.effective_health_score < 50 THEN 'no cumple'
            WHEN veh.effective_health_score < 80 THEN 'parcial'
            ELSE 'cumple'
          END AS status
        FROM public.v_iso_control_effective_health veh
        INNER JOIN active_standards ast
          ON ast.standard_code = veh.standard_code
        WHERE veh.tenant_id = $1
        ORDER BY veh.tenant_control_id,
          NULLIF(veh.health_trace_json->>'effective_at', '')::timestamptz DESC NULLS LAST,
          NULLIF(veh.health_trace_json->>'published_at', '')::timestamptz DESC NULLS LAST
      ),
      operational_controls AS (
        SELECT DISTINCT ON (tc.id)
          tc.id,
          tc.tenant_id,
          LOWER(COALESCE(tc.status, 'pendiente')) AS tenant_status,
          COALESCE(cc.id, tc.control_id) AS control_id,
          cc.iso,
          cc.clause,
          cc.category,
          COALESCE(cc.description, 'Control sin descripción') AS description,
          COALESCE(cc.source_type, 'tenant_controls') AS source_type
        FROM tenant_controls tc
        INNER JOIN tenant_applicable_controls tac
          ON tac.tenant_id = tc.tenant_id
         AND tac.active = true
         AND tac.visible_to_tenant = true
         AND (
           tac.tenant_control_id = tc.id
           OR tac.control_catalog_id = tc.control_id
         )
        LEFT JOIN controls_catalog cc
          ON cc.id = tc.control_id
         AND cc.is_active = TRUE
        WHERE tc.tenant_id = $1
          AND (
            tac.standard_code IS NULL
            OR EXISTS (
              SELECT 1
              FROM active_standards ast
              WHERE ast.standard_code = tac.standard_code
            )
          )
        ORDER BY tc.id, tac.updated_at DESC NULLS LAST, tac.created_at DESC NULLS LAST
      )
      SELECT
        oc.id,
        oc.tenant_id,
        COALESCE(oc.tenant_status, 'pendiente') AS status,
        oc.control_id,
        COALESCE(oc.iso, lh.standard_code) AS iso,
        oc.clause,
        oc.category,
        oc.description,
        oc.source_type,
        lh.health_score
      FROM operational_controls oc
      LEFT JOIN latest_health lh
        ON lh.tenant_control_id = oc.id
      ORDER BY
        COALESCE(oc.iso, lh.standard_code),
        oc.clause NULLS LAST,
        oc.category NULLS LAST,
        oc.description NULLS LAST,
        oc.id
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR DASHBOARD CONTROLS:', err);
    return res.status(500).json({
      error: 'Error dashboard controls',
      detail: err.message,
    });
  }
});

module.exports = router;
