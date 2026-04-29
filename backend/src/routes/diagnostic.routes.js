const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

const ALLOWED_STATUSES = [
  'cumple',
  'parcial',
  'no cumple',
  'pendiente',
  'no aplica'
];

const OPEN_NC_STATUSES = [
  'abierta',
  'abierto',
  'open',
  'pendiente',
  'en curso'
];

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

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  const normalized = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner'
  ].includes(normalized);
}

function ensureTenantAccess(req, tenantId) {
  if (isPlatformRole(req.user?.role || req.user?.user_role || req.user?.userRole)) {
    return true;
  }

  return String(getUserTenantId(req.user)) === String(tenantId);
}

const getEffectiveWhere = () => `
(
  (ts.catalog_mode = 'generic'
    AND cc.source_type = 'generic'
    AND cc.tenant_id IS NULL)
  OR
  (ts.catalog_mode = 'personalized'
    AND cc.source_type = 'personalized'
    AND cc.tenant_id = tc.tenant_id)
  OR
  (ts.catalog_mode = 'mixed'
    AND (
      (cc.source_type = 'generic' AND cc.tenant_id IS NULL)
      OR
      (cc.source_type = 'personalized' AND cc.tenant_id = tc.tenant_id)
    ))
)
`;

async function refreshHealthForTenant(client, tenantId) {
  const healthRes = await client.query(
    `
    SELECT *
    FROM refresh_control_health_scores_v2_1($1::uuid)
    `,
    [tenantId]
  );

  const kpiRes = await client.query(
    `
    SELECT *
    FROM refresh_kpi_health_snapshots($1::uuid)
    `,
    [tenantId]
  );

  return {
    health: healthRes.rows || [],
    kpis: kpiRes.rows || []
  };
}

async function getDiagnosticControlById(client, id) {
  const result = await client.query(
    `
    SELECT
      tc.id,
      tc.tenant_id,
      tc.control_id,
      tc.operation_id,
      tc.status,
      tc.priority,
      tc.applicability,
      cc.id AS catalog_control_id,
      cc.iso,
      cc.clause,
      cc.category,
      cc.description,
      cc.source_type,
      op.name AS operation_name,
      op.code AS operation_code,
      op.operation_type
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON tc.control_id = cc.id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
    WHERE tc.id = $1::uuid
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

// =============================
// GET DIAGNÓSTICO
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso, operation_id } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    let query = `
      SELECT
        tc.id,
        tc.tenant_id,
        tc.control_id,
        tc.operation_id,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.clause,
        cc.category,
        cc.description,
        tc.status,
        tc.priority,
        tc.applicability,
        cc.source_type,
        op.name AS operation_name,
        op.code AS operation_code,
        op.operation_type,
        EXISTS (
          SELECT 1
          FROM tenant_nonconformities tnc
          WHERE tnc.tenant_id = tc.tenant_id
            AND tnc.control_id = tc.control_id
            AND LOWER(COALESCE(tnc.status, 'abierta')) IN (${OPEN_NC_STATUSES.map((_, i) => `$${i + 2}`).join(', ')})
        ) AS has_open_nonconformity
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON tc.control_id = cc.id
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
       AND ts.is_active = TRUE
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      JOIN tenant_standard_operations tso
        ON tso.tenant_id = tc.tenant_id
       AND tso.standard_code = cc.iso
       AND tso.operation_id = tc.operation_id
       AND tso.is_active = TRUE
      WHERE tc.tenant_id = $1::uuid
        AND cc.is_active = TRUE
        AND ${getEffectiveWhere()}
    `;

    const params = [tenant_id, ...OPEN_NC_STATUSES];
    let idx = params.length + 1;

    if (iso) {
      query += ` AND cc.iso = $${idx}`;
      params.push(String(iso));
      idx++;
    }

    if (operation_id) {
      query += ` AND tc.operation_id = $${idx}::uuid`;
      params.push(String(operation_id));
      idx++;
    }

    query += `
      ORDER BY
        cc.iso,
        op.sort_order,
        op.name,
        cc.clause,
        cc.category,
        cc.description
    `;

    const result = await pool.query(query, params);

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET DIAGNOSTIC:', err);
    return res.status(500).json({
      error: 'Error diagnóstico',
      detail: err.message
    });
  }
});

// =============================
// UPDATE CONTROL + CREAR / RESOLVER NC + REFRESH HEALTH
// =============================
router.put('/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const requestedStatus = String(req.body?.status || '').trim().toLowerCase();

    if (!requestedStatus) {
      return res.status(400).json({ error: 'status es obligatorio' });
    }

    if (!ALLOWED_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({
        error: 'status inválido',
        allowed: ALLOWED_STATUSES
      });
    }

    await client.query('BEGIN');

    const current = await getDiagnosticControlById(client, id);

    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    if (!ensureTenantAccess(req, current.tenant_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const update = await client.query(
      `
      UPDATE tenant_controls
      SET status = $1
      WHERE id = $2::uuid
      RETURNING id, tenant_id, control_id, operation_id, status, priority, applicability
      `,
      [requestedStatus, id]
    );

    const control = update.rows[0];

    let nonconformityAction = null;

    if (requestedStatus === 'parcial' || requestedStatus === 'no cumple') {
      const exists = await client.query(
        `
        SELECT
          id,
          tenant_id,
          control_id,
          status,
          detected_at,
          resolved_at
        FROM tenant_nonconformities
        WHERE tenant_id = $1::uuid
          AND control_id = $2::uuid
          AND LOWER(COALESCE(status, 'abierta')) IN ('abierta', 'abierto', 'open', 'pendiente', 'en curso')
        ORDER BY detected_at DESC NULLS LAST, id DESC
        LIMIT 1
        `,
        [control.tenant_id, control.control_id]
      );

      if (exists.rowCount === 0) {
        const insertNc = await client.query(
          `
          INSERT INTO tenant_nonconformities (
            tenant_id,
            control_id,
            control_description,
            status,
            detected_at
          )
          VALUES ($1::uuid, $2::uuid, $3, 'abierta', NOW())
          RETURNING *
          `,
          [control.tenant_id, control.control_id, current.description]
        );

        nonconformityAction = {
          action: 'created',
          record: insertNc.rows[0]
        };
      } else {
        nonconformityAction = {
          action: 'reused_open',
          record: exists.rows[0]
        };
      }
    }

    if (
      requestedStatus === 'cumple' ||
      requestedStatus === 'pendiente' ||
      requestedStatus === 'no aplica'
    ) {
      const resolveNc = await client.query(
        `
        UPDATE tenant_nonconformities
        SET
          status = 'resuelta',
          resolved_at = NOW()
        WHERE tenant_id = $1::uuid
          AND control_id = $2::uuid
          AND LOWER(COALESCE(status, 'abierta')) IN ('abierta', 'abierto', 'open', 'pendiente', 'en curso')
        RETURNING *
        `,
        [control.tenant_id, control.control_id]
      );

      if (resolveNc.rowCount > 0) {
        nonconformityAction = {
          action: 'resolved_open',
          affected_rows: resolveNc.rowCount,
          records: resolveNc.rows
        };
      }
    }

    const refresh = await refreshHealthForTenant(client, control.tenant_id);

    await client.query('COMMIT');

    const freshControl = await getDiagnosticControlById(pool, control.id);

    return res.json({
      ok: true,
      control: freshControl,
      nonconformity_action: nonconformityAction,
      refresh
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR UPDATE DIAGNOSTIC:', err);
    return res.status(500).json({
      error: 'Error update diagnóstico',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
