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

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(role);
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
        SELECT DISTINCT ON (chs.tenant_control_id)
          chs.tenant_control_id,
          chs.standard_code,
          COALESCE(chs.health_score, 0) AS health_score,
          CASE
            WHEN COALESCE(chs.health_score, 0) < 50 THEN 'no cumple'
            WHEN COALESCE(chs.health_score, 0) < 80 THEN 'parcial'
            ELSE 'cumple'
          END AS status
        FROM control_health_scores chs
        INNER JOIN active_standards ast
          ON ast.standard_code = chs.standard_code
        WHERE chs.tenant_id = $1
        ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
      )
      SELECT
        tc.id,
        tc.tenant_id,
        lh.status,
        COALESCE(cc.id, tc.control_id) AS control_id,
        COALESCE(cc.iso, lh.standard_code) AS iso,
        cc.clause,
        cc.category,
        COALESCE(cc.description, 'Control sin descripción') AS description,
        COALESCE(cc.source_type, 'health_scope') AS source_type,
        lh.health_score
      FROM latest_health lh
      INNER JOIN tenant_controls tc
        ON tc.id = lh.tenant_control_id
       AND tc.tenant_id = $1
      LEFT JOIN controls_catalog cc
        ON cc.id = tc.control_id
       AND cc.is_active = TRUE
      ORDER BY
        COALESCE(cc.iso, lh.standard_code),
        cc.clause NULLS LAST,
        cc.category NULLS LAST,
        cc.description NULLS LAST,
        tc.id
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
