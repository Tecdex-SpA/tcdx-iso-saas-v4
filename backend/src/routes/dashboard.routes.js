const {
  isPlatformRole: isCanonicalPlatformRole,
} = require('../services/auth/roleCompatibility.service');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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

function isPlatformRole(role) {
  return isCanonicalPlatformRole(normalizeRole(role));
}

function canAccessTenant(req, tenantId) {
  if (isPlatformRole(req.user?.role || req.user?.user_role || req.user?.userRole)) {
    return true;
  }

  return String(getUserTenantId(req.user)) === String(tenantId);
}

router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      WITH operational_controls AS (
        SELECT DISTINCT ON (tc.id)
          tc.id AS tenant_control_id,
          tc.control_id AS catalog_control_id,
          LOWER(COALESCE(tc.status, 'pendiente')) AS status,
          COALESCE(tac.standard_code, cc.iso) AS matched_standard_code
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
          ON tc.control_id = cc.id
         AND cc.is_active = TRUE
        WHERE tc.tenant_id = $1
          AND (
            tac.standard_code IS NULL
            OR EXISTS (
              SELECT 1
              FROM tenant_standards ts
              WHERE ts.tenant_id = tc.tenant_id
                AND ts.standard_code = tac.standard_code
                AND ts.is_active = TRUE
            )
          )
        ORDER BY tc.id, tac.updated_at DESC NULLS LAST, tac.created_at DESC NULLS LAST
      ),
      control_status_counts AS (
        SELECT
          COUNT(*)::int AS total_controls,
          COUNT(*) FILTER (WHERE status = 'cumple')::int AS cumple,
          COUNT(*) FILTER (WHERE status = 'parcial')::int AS parcial,
          COUNT(*) FILTER (WHERE status = 'no cumple')::int AS no_cumple,
          COUNT(*) FILTER (WHERE status = 'pendiente')::int AS pendientes
        FROM operational_controls
      ),
      active_operational_standards AS (
        SELECT DISTINCT matched_standard_code AS standard_code
        FROM operational_controls
      ),
      finding_counts AS (
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(f.status, '')) <> 'cerrado'
          )::int AS open_findings,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(f.status, '')) = 'cerrado'
          )::int AS closed_findings
        FROM findings f
        WHERE f.tenant_id = $1
          AND (
            (
              f.iso_code IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM active_operational_standards aos
                WHERE aos.standard_code = f.iso_code
              )
            )
            OR
            (
              f.iso_code IS NULL
              AND f.tenant_control_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM operational_controls oc
                WHERE oc.tenant_control_id = f.tenant_control_id
              )
            )
          )
      ),
      nc_counts AS (
        SELECT
          COUNT(*) FILTER (
            WHERE tnc.resolved_at IS NULL
               OR LOWER(COALESCE(tnc.status, '')) <> 'resuelta'
          )::int AS open_nonconformities,
          COUNT(*) FILTER (
            WHERE tnc.resolved_at IS NOT NULL
               OR LOWER(COALESCE(tnc.status, '')) = 'resuelta'
          )::int AS closed_nonconformities
        FROM tenant_nonconformities tnc
        JOIN controls_catalog cc
          ON cc.id = tnc.control_id
         AND cc.is_active = TRUE
        WHERE tnc.tenant_id = $1
          AND EXISTS (
            SELECT 1
            FROM active_operational_standards aos
            WHERE aos.standard_code = cc.iso
          )
      )
      SELECT
        csc.total_controls,
        csc.cumple,
        csc.parcial,
        csc.no_cumple,
        csc.pendientes,
        fc.open_findings,
        fc.closed_findings,
        nc.open_nonconformities,
        nc.closed_nonconformities
      FROM control_status_counts csc
      CROSS JOIN finding_counts fc
      CROSS JOIN nc_counts nc
      `,
      [tenant_id]
    );

    const row = result.rows[0] || {
      total_controls: 0,
      cumple: 0,
      parcial: 0,
      no_cumple: 0,
      pendientes: 0,
      open_findings: 0,
      closed_findings: 0,
      open_nonconformities: 0,
      closed_nonconformities: 0,
    };

    const total = Number(row.total_controls || 0);
    const cumple = Number(row.cumple || 0);
    const parcial = Number(row.parcial || 0);
    const noCumple = Number(row.no_cumple || 0);
    const pendientes = Number(row.pendientes || 0);

    const porcentaje = total > 0 ? Math.round((cumple / total) * 100) : null;
    const riesgo = total > 0 ? Math.round((noCumple / total) * 100) : null;

    let nivel_riesgo = 'sin_datos';
    if (riesgo !== null) {
      nivel_riesgo = 'Bajo';
      if (riesgo > 50) nivel_riesgo = 'Alto';
      else if (riesgo > 20) nivel_riesgo = 'Medio';
    }

    return res.json({
      total,
      cumple,
      parcial,
      noCumple,
      pendientes,
      porcentaje,
      riesgo,
      nivel_riesgo,
      open_findings: Number(row.open_findings || 0),
      closed_findings: Number(row.closed_findings || 0),
      open_nonconformities: Number(row.open_nonconformities || 0),
      closed_nonconformities: Number(row.closed_nonconformities || 0),
      semantics: {
        universe: 'tenant_applicable_controls active=true visible_to_tenant=true joined to tenant_controls for active tenant standards',
        measured_controls: total,
        no_data_policy: 'missing universe returns null percentages, not zero',
        no_applicable_policy: 'controls excluded from tenant_applicable_controls active/visible universe are not counted',
      },
    });
  } catch (err) {
    console.error('ERROR DASHBOARD SUMMARY:', err);
    return res.status(500).json({
      error: 'Error dashboard',
      detail: err.message,
    });
  }
});

module.exports = router;
