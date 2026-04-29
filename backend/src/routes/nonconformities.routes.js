const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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
  return user?.user_id || user?.userId || user?.id || null;
}

function isSuperAdmin(user) {
  const role = String(
    user?.role || user?.user_role || user?.userRole || ''
  ).toLowerCase();

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(role);
}

const ensureTenantAccess = (req, tenantId) => {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
};

const ALLOWED_STATUSES = [
  'abierta',
  'en progreso',
  'pendiente_aprobacion',
  'resuelta',
];

async function ensureOperationalTenantStandard(client, tenantId, isoCode) {
  if (!tenantId || !isoCode) return false;

  const result = await client.query(
    `
    SELECT 1
    FROM tenant_standards ts
    WHERE ts.tenant_id = $1
      AND ts.standard_code = $2
      AND ts.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM tenant_standard_operations tso
        JOIN tenant_operations op
          ON op.id = tso.operation_id
         AND op.tenant_id = tso.tenant_id
         AND op.is_active = TRUE
        WHERE tso.tenant_id = ts.tenant_id
          AND tso.standard_code = ts.standard_code
          AND tso.is_active = TRUE
      )
    LIMIT 1
    `,
    [tenantId, isoCode]
  );

  return result.rowCount > 0;
}

async function getNcWithStandard(client, id) {
  return client.query(
    `
    SELECT
      tnc.*,
      cc.iso,
      cc.clause,
      cc.category,
      cc.description AS catalog_control_description,
      active_scope.tenant_control_id,
      active_scope.operation_id,
      active_scope.operation_name,
      active_scope.operation_code,
      active_scope.operation_type
    FROM tenant_nonconformities tnc
    LEFT JOIN controls_catalog cc
      ON cc.id = tnc.control_id
    LEFT JOIN LATERAL (
      SELECT
        tc.id AS tenant_control_id,
        tc.operation_id,
        op.name AS operation_name,
        op.code AS operation_code,
        op.operation_type
      FROM tenant_controls tc
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      JOIN tenant_standard_operations tso
        ON tso.tenant_id = tc.tenant_id
       AND tso.standard_code = cc.iso
       AND tso.operation_id = tc.operation_id
       AND tso.is_active = TRUE
      WHERE tc.tenant_id = tnc.tenant_id
        AND tc.control_id = tnc.control_id
      ORDER BY
        op.is_default DESC,
        op.sort_order ASC,
        op.name ASC,
        tc.created_at ASC
      LIMIT 1
    ) active_scope ON TRUE
    WHERE tnc.id = $1
    LIMIT 1
    `,
    [id]
  );
}

async function upsertTenantControlStatusForNc(
  client,
  tenantId,
  controlId,
  isoCode,
  nextNcStatus
) {
  let controlStatus = 'no cumple';

  if (nextNcStatus === 'resuelta') {
    controlStatus = 'cumple';
  } else if (nextNcStatus === 'en progreso') {
    controlStatus = 'parcial';
  } else if (nextNcStatus === 'pendiente_aprobacion') {
    controlStatus = 'parcial';
  } else if (nextNcStatus === 'abierta') {
    controlStatus = 'no cumple';
  }

  await client.query(
    `
    UPDATE tenant_controls tc
    SET
      status = $1,
      updated_at = NOW()
    WHERE tc.tenant_id = $2
      AND tc.control_id = $3
      AND EXISTS (
        SELECT 1
        FROM tenant_operations op
        JOIN tenant_standard_operations tso
          ON tso.tenant_id = tc.tenant_id
         AND tso.operation_id = tc.operation_id
         AND tso.standard_code = $4
         AND tso.is_active = TRUE
        WHERE op.id = tc.operation_id
          AND op.tenant_id = tc.tenant_id
          AND op.is_active = TRUE
      )
    `,
    [controlStatus, tenantId, controlId, isoCode]
  );
}

async function findExistingResolutionEvidence(
  client,
  tenantId,
  nonconformityId
) {
  return client.query(
    `
    SELECT id
    FROM evidences
    WHERE tenant_id = $1
      AND metadata->>'nonconformity_id' = $2
      AND status = 'aprobada'
      AND validated = TRUE
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, String(nonconformityId)]
  );
}

async function createResolutionEvidenceIfMissing(client, ncRow, currentNc, reviewerId) {
  const existing = await findExistingResolutionEvidence(
    client,
    ncRow.tenant_id,
    ncRow.id
  );

  if (existing.rowCount > 0) {
    return;
  }

  await client.query(
    `
    INSERT INTO evidences (
      tenant_id,
      control_id,
      tenant_control_id,
      description,
      status,
      validated,
      reviewed_by,
      reviewed_at,
      evidence_type,
      metadata
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'aprobada',
      TRUE,
      $5,
      NOW(),
      'registro_sistema',
      $6::jsonb
    )
    `,
    [
      ncRow.tenant_id,
      ncRow.control_id,
      currentNc.tenant_control_id || null,
      `Control "${ncRow.control_description}" resuelto el ${new Date().toISOString()}`,
      reviewerId,
      JSON.stringify({
        uploaded_from: 'nonconformities',
        nonconformity_id: ncRow.id,
        iso: currentNc.iso,
        clause: currentNc.clause,
        operation_id: currentNc.operation_id || null,
        operation_name: currentNc.operation_name || null,
        reviewed_from: 'nonconformities',
        last_review_status: 'aprobada',
      }),
    ]
  );
}

// =============================
// GET NC
// Solo normas operativas reales
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (iso) {
      const operational = await ensureOperationalTenantStandard(pool, tenant_id, iso);
      if (!operational) {
        return res.json([]);
      }
    }

    const params = [tenant_id];
    let idx = 2;

    let query = `
      SELECT
        tnc.id,
        tnc.tenant_id,
        tnc.control_id,
        active_scope.tenant_control_id,
        active_scope.operation_id,
        active_scope.operation_name,
        active_scope.operation_code,
        active_scope.operation_type,
        tnc.control_description,
        cc.iso,
        cc.clause,
        cc.category,
        tnc.status,
        tnc.detected_at,
        tnc.resolved_at
      FROM tenant_nonconformities tnc
      JOIN controls_catalog cc
        ON tnc.control_id = cc.id
       AND cc.is_active = TRUE
      JOIN tenant_standards ts
        ON ts.tenant_id = tnc.tenant_id
       AND ts.standard_code = cc.iso
       AND ts.is_active = TRUE
      JOIN LATERAL (
        SELECT
          tc.id AS tenant_control_id,
          tc.operation_id,
          op.name AS operation_name,
          op.code AS operation_code,
          op.operation_type
        FROM tenant_controls tc
        JOIN tenant_operations op
          ON op.id = tc.operation_id
         AND op.tenant_id = tc.tenant_id
         AND op.is_active = TRUE
        JOIN tenant_standard_operations tso
          ON tso.tenant_id = tc.tenant_id
         AND tso.standard_code = cc.iso
         AND tso.operation_id = tc.operation_id
         AND tso.is_active = TRUE
        WHERE tc.tenant_id = tnc.tenant_id
          AND tc.control_id = tnc.control_id
        ORDER BY
          op.is_default DESC,
          op.sort_order ASC,
          op.name ASC,
          tc.created_at ASC
        LIMIT 1
      ) active_scope ON TRUE
      WHERE tnc.tenant_id = $1
    `;

    if (iso) {
      query += ` AND cc.iso = $${idx}`;
      params.push(String(iso));
      idx++;
    }

    query += ` ORDER BY tnc.detected_at DESC NULLS LAST, tnc.id DESC`;

    const result = await pool.query(query, params);

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET NC:', err);
    return res.status(500).json({
      error: 'Error obteniendo no conformidades',
      detail: err.message,
    });
  }
});

// =============================
// UPDATE NC + WORKFLOW + EVIDENCIA
// Solo si la norma sigue operativa
// =============================
router.put('/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const current = await getNcWithStandard(client, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'No conformidad no encontrada' });
    }

    const currentNc = current.rows[0];

    if (!ensureTenantAccess(req, currentNc.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!currentNc.iso) {
      return res.status(400).json({
        error: 'La no conformidad no tiene norma ISO asociada',
      });
    }

    const activeStandard = await ensureOperationalTenantStandard(
      client,
      currentNc.tenant_id,
      currentNc.iso
    );

    if (!activeStandard) {
      return res.status(400).json({
        error:
          'La norma asociada a esta no conformidad ya no está activa dentro del alcance operativo',
      });
    }

    const resolvedAt = status === 'resuelta' ? new Date() : null;
    const wasResolved = currentNc.status === 'resuelta';

    await client.query('BEGIN');

    const result = await client.query(
      `
      UPDATE tenant_nonconformities
      SET
        status = $1,
        resolved_at = $2
      WHERE id = $3
      RETURNING *
      `,
      [status, resolvedAt, id]
    );

    const nc = result.rows[0];

    await upsertTenantControlStatusForNc(
      client,
      nc.tenant_id,
      nc.control_id,
      currentNc.iso,
      status
    );

    if (status === 'resuelta' && !wasResolved) {
      await createResolutionEvidenceIfMissing(
        client,
        nc,
        currentNc,
        getUserId(req.user)
      );
    }

    const refreshed = await getNcWithStandard(client, id);

    await client.query('COMMIT');

    return res.json(refreshed.rows[0] || nc);
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('ERROR UPDATE NC:', err);

    return res.status(500).json({
      error: 'Error actualizando no conformidad',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
