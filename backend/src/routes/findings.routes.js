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
  const role = String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner'
  ].includes(role);
}

const ensureTenantAccess = (req, tenantId) => {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
};

const allowedTypes = [
  'no conformidad',
  'observacion',
  'oportunidad de mejora',
  'fortaleza'
];

const allowedSeverities = ['alta', 'media', 'baja'];
const allowedStatuses = ['abierto', 'en revision', 'accion definida', 'cerrado'];
const allowedSources = ['manual', 'audit', 'diagnostic', 'risk', 'soa', 'ia', 'evidence'];

const operationalStandardExistsSql = `
  EXISTS (
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
  )
`;

async function ensureOperationalStandard(client, tenantId, standardCode) {
  return client.query(
    `
    SELECT 1
    WHERE ${operationalStandardExistsSql}
    LIMIT 1
    `,
    [tenantId, standardCode]
  );
}

async function ensureOperationalControl(
  client,
  tenantId,
  standardCode,
  tenantControlModernId,
  operationId
) {
  if (!tenantControlModernId || !operationId) {
    return { rowCount: 0 };
  }

  return client.query(
    `
    SELECT 1
    FROM tenant_controls tc
    JOIN tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.standard_code = $2
     AND tso.operation_id = tc.operation_id
     AND tso.is_active = TRUE
    JOIN tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
     AND op.is_active = TRUE
    JOIN tenant_standards ts
      ON ts.tenant_id = tso.tenant_id
     AND ts.standard_code = tso.standard_code
     AND ts.is_active = TRUE
    WHERE tc.tenant_id = $1
      AND tc.id = $3
      AND tc.operation_id = $4
    LIMIT 1
    `,
    [tenantId, standardCode, tenantControlModernId, operationId]
  );
}

const getLinkedRecord = async (table, id) => {
  const map = {
    tenant_controls: `SELECT id, tenant_id FROM tenant_controls WHERE id = $1 LIMIT 1`,
    tenant_nonconformities: `SELECT id, tenant_id FROM tenant_nonconformities WHERE id = $1 LIMIT 1`,
    audits: `SELECT id, tenant_id FROM audits WHERE id = $1 LIMIT 1`,
    assets: `SELECT id, tenant_id FROM assets WHERE id = $1 LIMIT 1`
  };

  if (!map[table]) {
    throw new Error(`Tabla no permitida: ${table}`);
  }

  return pool.query(map[table], [id]);
};

const inferSourceType = ({
  source_type,
  tenant_control_id,
  nonconformity_id,
  audit_id,
  asset_id
}) => {
  if (source_type) return source_type;
  if (nonconformity_id) return 'diagnostic';
  if (audit_id) return 'audit';
  if (asset_id) return 'risk';
  if (tenant_control_id) return 'diagnostic';
  return 'manual';
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeNullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/**
 * Resuelve cualquier ID recibido desde frontend:
 * - tenant_controls.id moderno
 * - controls.id legacy
 * - controls_catalog.id catálogo
 *
 * findings.tenant_control_id actualmente referencia controls.id legacy.
 * action_plans.tenant_control_id debe usar tenant_controls.id moderno.
 */
const resolveFindingControl = async (client, tenantId, rawControlId, isoCode = null) => {
  if (!rawControlId) return null;

  const value = String(rawControlId).trim();
  if (!value) return null;

  // 1) ID moderno: tenant_controls.id
  const byTenantControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      op.code AS operation_code,
      op.name AS operation_name,
      op.is_active AS operation_is_active,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.catalog_control_id = tc.control_id
      ORDER BY c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE tc.id = $1
      AND tc.tenant_id = $2
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byTenantControl.rowCount > 0) {
    const row = byTenantControl.rows[0];

    if (isoCode && String(row.iso) !== String(isoCode)) {
      return { ...row, iso_mismatch: true };
    }

    return row;
  }

  // 2) ID legacy: controls.id
  const byLegacyControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
      tc.tenant_id,
      c.catalog_control_id,
      tc.operation_id,
      op.code AS operation_code,
      op.name AS operation_name,
      op.is_active AS operation_is_active,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM controls c
    JOIN controls_catalog cc
      ON cc.id = c.catalog_control_id
    JOIN tenant_controls tc
      ON tc.tenant_id = $2
     AND tc.control_id = cc.id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    WHERE c.id = $1
    ORDER BY
      CASE WHEN op.is_default = TRUE THEN 0 ELSE 1 END,
      tc.created_at ASC,
      tc.id ASC
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byLegacyControl.rowCount > 0) {
    const row = byLegacyControl.rows[0];

    if (isoCode && String(row.iso) !== String(isoCode)) {
      return { ...row, iso_mismatch: true };
    }

    return row;
  }

  // 3) ID catálogo: controls_catalog.id
  const byCatalogControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
      tc.tenant_id,
      cc.id AS catalog_control_id,
      tc.operation_id,
      op.code AS operation_code,
      op.name AS operation_name,
      op.is_active AS operation_is_active,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM controls_catalog cc
    JOIN tenant_controls tc
      ON tc.tenant_id = $2
     AND tc.control_id = cc.id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.catalog_control_id = cc.id
      ORDER BY c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE cc.id = $1
    ORDER BY
      CASE WHEN op.is_default = TRUE THEN 0 ELSE 1 END,
      tc.created_at ASC,
      tc.id ASC
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byCatalogControl.rowCount > 0) {
    const row = byCatalogControl.rows[0];

    if (isoCode && String(row.iso) !== String(isoCode)) {
      return { ...row, iso_mismatch: true };
    }

    return row;
  }

  return null;
};

const findRecentDuplicateFinding = async (
  client,
  {
    tenant_id,
    iso_code,
    title,
    description,
    finding_type,
    severity,
    source_type,
    source_id,
    owner,
    detected_by,
    due_date,
    created_by,
    tenant_control_id
  }
) => {
  const result = await client.query(
    `
    SELECT f.id
    FROM findings f
    WHERE f.tenant_id = $1
      AND f.iso_code = $2
      AND LOWER(BTRIM(COALESCE(f.title, ''))) = LOWER(BTRIM(COALESCE($3, '')))
      AND BTRIM(COALESCE(f.description, '')) = BTRIM(COALESCE($4, ''))
      AND f.finding_type = $5
      AND f.severity = $6
      AND f.source_type = $7
      AND COALESCE(f.source_id::text, '') = COALESCE($8::text, '')
      AND BTRIM(COALESCE(f.owner, '')) = BTRIM(COALESCE($9, ''))
      AND BTRIM(COALESCE(f.detected_by, '')) = BTRIM(COALESCE($10, ''))
      AND COALESCE(f.due_date::date::text, '') = COALESCE($11::text, '')
      AND COALESCE(f.created_by::text, '') = COALESCE($12::text, '')
      AND COALESCE(f.tenant_control_id::text, '') = COALESCE($13::text, '')
      AND f.created_at >= NOW() - INTERVAL '2 minutes'
    ORDER BY f.created_at DESC
    LIMIT 1
    `,
    [
      tenant_id,
      iso_code,
      normalizeText(title),
      normalizeNullableText(description) || '',
      finding_type,
      severity,
      source_type,
      source_id || null,
      normalizeNullableText(owner) || '',
      normalizeNullableText(detected_by) || '',
      normalizeDateOnly(due_date) || '',
      created_by || null,
      tenant_control_id || null
    ]
  );

  return result.rows[0] || null;
};

const enrichedFindingsSelect = `
  SELECT
    f.*,

    EXISTS (
      SELECT 1
      FROM action_plans ap
      WHERE ap.finding_id = f.id
         OR (ap.source_type = 'finding' AND ap.source_id = f.id)
    ) AS has_action_plan,

    c_legacy.id AS controls_id_legacy,
    tc.id AS tenant_control_modern_id,
    tc.status AS tenant_control_status,
    tc.operation_id AS finding_operation_id,

    op_current.code AS finding_operation_code,
    op_current.name AS finding_operation_name,
    op_current.operation_type AS finding_operation_type,

    cc.id AS catalog_control_id,
    cc.iso AS control_iso,
    cc.clause AS control_clause,
    cc.description AS control_description,
    cc.category AS control_category,

    nc.control_description AS nonconformity_description,
    nc.status AS nonconformity_status,

    a.iso AS audit_iso,
    a.start_date AS audit_start_date,
    a.end_date AS audit_end_date,
    a.auditor_name AS audit_auditor_name,
    a.auditor_type AS audit_auditor_type,

    ast.name AS asset_name,
    ast.type AS asset_type,
    ast.owner AS asset_owner

  FROM findings f

  LEFT JOIN controls c_legacy
    ON f.tenant_control_id = c_legacy.id

  LEFT JOIN LATERAL (
    SELECT
      tc1.id,
      tc1.status,
      tc1.control_id,
      tc1.operation_id
    FROM tenant_controls tc1
    LEFT JOIN tenant_operations op1
      ON op1.id = tc1.operation_id
     AND op1.tenant_id = tc1.tenant_id
    WHERE tc1.tenant_id = f.tenant_id
      AND (
        tc1.id = f.tenant_control_id
        OR (
          c_legacy.catalog_control_id IS NOT NULL
          AND tc1.control_id = c_legacy.catalog_control_id
        )
      )
    ORDER BY
      CASE WHEN tc1.id = f.tenant_control_id THEN 0 ELSE 1 END,
      CASE WHEN op1.is_default = TRUE THEN 0 ELSE 1 END,
      tc1.created_at ASC,
      tc1.id ASC
    LIMIT 1
  ) tc ON TRUE

  LEFT JOIN tenant_operations op_current
    ON op_current.id = tc.operation_id
   AND op_current.tenant_id = f.tenant_id

  LEFT JOIN controls_catalog cc
    ON cc.id = COALESCE(tc.control_id, c_legacy.catalog_control_id)

  LEFT JOIN tenant_nonconformities nc
    ON f.nonconformity_id = nc.id

  LEFT JOIN audits a
    ON f.audit_id = a.id

  LEFT JOIN assets ast
    ON f.asset_id = ast.id
`;

// =============================
// 🎛️ LISTAR CONTROLES PARA SELECTOR DE HALLAZGOS
// solo alcance operativo real
// =============================
router.get('/controls/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    let query = `
      SELECT DISTINCT ON (tc.id)
        tc.id AS tenant_control_id,
        tc.id AS tenant_control_id_moderno,
        c.id AS controls_id_legacy,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.clause,
        cc.category,
        cc.description,
        tc.status AS tenant_control_status,
        tc.priority,
        tc.applicability,
        tc.operation_id,
        op.code AS operation_code,
        op.name AS operation_name
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
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
      LEFT JOIN LATERAL (
        SELECT c1.id
        FROM controls c1
        WHERE c1.catalog_control_id = cc.id
        ORDER BY c1.id ASC
        LIMIT 1
      ) c ON TRUE
      WHERE tc.tenant_id = $1
        AND cc.is_active = TRUE
    `;

    const params = [tenant_id];

    if (iso) {
      query += ` AND cc.iso = $2`;
      params.push(iso);
    }

    query += `
      ORDER BY
        tc.id,
        cc.iso,
        op.sort_order,
        op.name,
        cc.clause,
        cc.description
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows
    });
  } catch (err) {
    console.error('ERROR GET FINDING CONTROLS:', err);
    return res.status(500).json({
      error: 'Error obteniendo controles para hallazgos',
      detail: err.message
    });
  }
});

// =============================
// 📋 LISTAR HALLAZGOS
// solo alcance operativo real
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso, status, finding_type } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    let innerQuery = `
      ${enrichedFindingsSelect}
      JOIN tenant_standards ts
        ON ts.tenant_id = f.tenant_id
       AND ts.standard_code = f.iso_code
      WHERE f.tenant_id = $1
        AND ts.is_active = TRUE
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op_scope
            ON op_scope.id = tso.operation_id
           AND op_scope.tenant_id = tso.tenant_id
           AND op_scope.is_active = TRUE
          WHERE tso.tenant_id = f.tenant_id
            AND tso.standard_code = f.iso_code
            AND tso.operation_id = tc.operation_id
            AND tso.is_active = TRUE
        )
    `;

    const params = [tenant_id];
    let idx = 2;

    if (iso) {
      innerQuery += ` AND f.iso_code = $${idx}`;
      params.push(iso);
      idx++;
    }

    if (status) {
      innerQuery += ` AND f.status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (finding_type) {
      innerQuery += ` AND f.finding_type = $${idx}`;
      params.push(finding_type);
      idx++;
    }

    const query = `
      WITH enriched AS (
        ${innerQuery}
      ),
      dedup AS (
        SELECT DISTINCT ON (enriched.id) enriched.*
        FROM enriched
        ORDER BY enriched.id, enriched.created_at DESC
      )
      SELECT *
      FROM dedup
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET FINDINGS:', err);
    return res.status(500).json({
      error: 'Error obteniendo hallazgos',
      detail: err.message
    });
  }
});

// =============================
// ➕ CREAR HALLAZGO
// =============================
router.post('/', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    let {
      tenant_id,
      iso_code,
      title,
      description,
      finding_type,
      severity,
      status,
      source_type,
      source_id,
      owner,
      detected_by,
      due_date,
      tenant_control_id,
      nonconformity_id,
      audit_id,
      asset_id
    } = req.body;

    if (!tenant_id || !title) {
      return res.status(400).json({ error: 'tenant_id y title son obligatorios' });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const finalType = finding_type || (nonconformity_id ? 'no conformidad' : 'observacion');
    const finalSeverity = severity || 'media';
    const finalStatus = status || 'abierto';

    if (!allowedTypes.includes(finalType)) {
      return res.status(400).json({ error: 'finding_type inválido' });
    }

    if (!allowedSeverities.includes(finalSeverity)) {
      return res.status(400).json({ error: 'severity inválida' });
    }

    if (!allowedStatuses.includes(finalStatus)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    if (!tenant_control_id) {
      return res.status(400).json({
        error: 'Debes asociar un control al hallazgo'
      });
    }

    await client.query('BEGIN');

    const resolvedControl = await resolveFindingControl(
      client,
      tenant_id,
      tenant_control_id,
      iso_code
    );

    if (!resolvedControl) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'No se pudo resolver el control asociado al hallazgo'
      });
    }

    if (resolvedControl.iso_mismatch) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'El control seleccionado no pertenece a la norma ISO seleccionada'
      });
    }

    if (!resolvedControl.controls_id_legacy) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'El control no tiene equivalente legacy en controls.id. Revisa el mapeo controls.catalog_control_id'
      });
    }

    if (!iso_code) {
      iso_code = resolvedControl.iso;
    }

    if (nonconformity_id) {
      const linked = await getLinkedRecord('tenant_nonconformities', nonconformity_id);
      if (linked.rowCount === 0 || String(linked.rows[0].tenant_id) !== String(tenant_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'nonconformity_id inválido para este tenant' });
      }
    }

    if (audit_id) {
      const linked = await getLinkedRecord('audits', audit_id);
      if (linked.rowCount === 0 || String(linked.rows[0].tenant_id) !== String(tenant_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'audit_id inválido para este tenant' });
      }
    }

    if (asset_id) {
      const linked = await getLinkedRecord('assets', asset_id);
      if (linked.rowCount === 0 || String(linked.rows[0].tenant_id) !== String(tenant_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'asset_id inválido para este tenant' });
      }
    }

    const activeStandard = await ensureOperationalStandard(client, tenant_id, iso_code);

    if (activeStandard.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'La norma seleccionada no está dentro del alcance operativo activo de esta empresa'
      });
    }

    const activeControl = await ensureOperationalControl(
      client,
      tenant_id,
      iso_code,
      resolvedControl.tenant_control_id_moderno,
      resolvedControl.operation_id
    );

    if (activeControl.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'El control asociado no pertenece al alcance operativo activo de la norma seleccionada'
      });
    }

    const finalSourceType = inferSourceType({
      source_type,
      tenant_control_id,
      nonconformity_id,
      audit_id,
      asset_id
    });

    if (!allowedSources.includes(finalSourceType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'source_type inválido' });
    }

    const finalSourceId =
      source_id ||
      nonconformity_id ||
      audit_id ||
      asset_id ||
      resolvedControl.controls_id_legacy ||
      null;

    const duplicate = await findRecentDuplicateFinding(client, {
      tenant_id,
      iso_code,
      title,
      description,
      finding_type: finalType,
      severity: finalSeverity,
      source_type: finalSourceType,
      source_id: finalSourceId,
      owner,
      detected_by,
      due_date,
      created_by: getUserId(req.user),
      tenant_control_id: resolvedControl.controls_id_legacy
    });

    if (duplicate?.id) {
      const existing = await client.query(
        `
        ${enrichedFindingsSelect}
        WHERE f.id = $1
        `,
        [duplicate.id]
      );

      await client.query('ROLLBACK');

      return res.json({
        ...existing.rows[0],
        duplicate_prevented: true
      });
    }

    const insertResult = await client.query(
      `
      INSERT INTO findings (
        tenant_id,
        iso_code,
        title,
        description,
        finding_type,
        severity,
        status,
        source_type,
        source_id,
        owner,
        detected_by,
        due_date,
        created_by,
        tenant_control_id,
        nonconformity_id,
        audit_id,
        asset_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id
      `,
      [
        tenant_id,
        iso_code,
        normalizeText(title),
        normalizeNullableText(description),
        finalType,
        finalSeverity,
        finalStatus,
        finalSourceType,
        finalSourceId,
        normalizeNullableText(owner),
        normalizeNullableText(detected_by),
        due_date || null,
        getUserId(req.user),
        resolvedControl.controls_id_legacy,
        nonconformity_id || null,
        audit_id || null,
        asset_id || null
      ]
    );

    const result = await client.query(
      `
      ${enrichedFindingsSelect}
      WHERE f.id = $1
      `,
      [insertResult.rows[0].id]
    );

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE FINDING:', err);
    return res.status(500).json({
      error: 'Error creando hallazgo',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// ✏️ ACTUALIZAR HALLAZGO
// =============================
router.put('/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      title,
      description,
      finding_type,
      severity,
      status,
      owner,
      detected_by,
      due_date,
      tenant_control_id
    } = req.body;

    const current = await client.query(
      `
      SELECT *
      FROM findings
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Hallazgo no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const finalType = finding_type ?? row.finding_type;
    const finalSeverity = severity ?? row.severity;
    const nextStatus = status ?? row.status;

    if (!allowedTypes.includes(finalType)) {
      return res.status(400).json({ error: 'finding_type inválido' });
    }

    if (!allowedSeverities.includes(finalSeverity)) {
      return res.status(400).json({ error: 'severity inválida' });
    }

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const resolvedControl = await resolveFindingControl(
      client,
      row.tenant_id,
      tenant_control_id !== undefined ? tenant_control_id : row.tenant_control_id,
      row.iso_code
    );

    if (!resolvedControl) {
      return res.status(400).json({
        error: 'No se pudo resolver el control asociado al hallazgo'
      });
    }

    if (resolvedControl.iso_mismatch) {
      return res.status(400).json({
        error: 'El control seleccionado no pertenece a la norma ISO del hallazgo'
      });
    }

    if (!resolvedControl.controls_id_legacy) {
      return res.status(400).json({
        error: 'El control no tiene equivalente legacy en controls.id. Revisa el mapeo controls.catalog_control_id'
      });
    }

    const activeStandard = await ensureOperationalStandard(
      client,
      row.tenant_id,
      row.iso_code
    );

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error: 'La norma del hallazgo ya no está dentro del alcance operativo activo'
      });
    }

    const activeControl = await ensureOperationalControl(
      client,
      row.tenant_id,
      row.iso_code,
      resolvedControl.tenant_control_id_moderno,
      resolvedControl.operation_id
    );

    if (activeControl.rowCount === 0) {
      return res.status(400).json({
        error: 'El control asociado no pertenece al alcance operativo activo de la norma del hallazgo'
      });
    }

    const closedAt =
      nextStatus === 'cerrado'
        ? row.closed_at || new Date()
        : null;

    await client.query(
      `
      UPDATE findings
      SET
        title = $1,
        description = $2,
        finding_type = $3,
        severity = $4,
        status = $5,
        owner = $6,
        detected_by = $7,
        due_date = $8,
        closed_at = $9,
        tenant_control_id = $10,
        updated_at = NOW()
      WHERE id = $11
      `,
      [
        title ?? row.title,
        description ?? row.description,
        finalType,
        finalSeverity,
        nextStatus,
        owner ?? row.owner,
        detected_by ?? row.detected_by,
        due_date ?? row.due_date,
        closedAt,
        resolvedControl.controls_id_legacy,
        id
      ]
    );

    const result = await client.query(
      `
      ${enrichedFindingsSelect}
      WHERE f.id = $1
      `,
      [id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR UPDATE FINDING:', err);
    return res.status(500).json({
      error: 'Error actualizando hallazgo',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// 🗑️ ELIMINAR HALLAZGO
// =============================
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      `
      SELECT *
      FROM findings
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Hallazgo no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    await pool.query(`DELETE FROM findings WHERE id = $1`, [id]);

    return res.json({ success: true });
  } catch (err) {
    console.error('ERROR DELETE FINDING:', err);
    return res.status(500).json({
      error: 'Error eliminando hallazgo',
      detail: err.message
    });
  }
});

// =============================
// 🔁 CREAR ACCIÓN DESDE HALLAZGO
// =============================
router.post('/:id/create-action', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const findingResult = await client.query(
      `
      SELECT *
      FROM findings
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (findingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Hallazgo no encontrado' });
    }

    const finding = findingResult.rows[0];

    if (!ensureTenantAccess(req, finding.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!finding.tenant_control_id) {
      return res.status(400).json({
        error: 'El hallazgo no tiene control asociado. Asocia un control antes de crear la acción.'
      });
    }

    const resolvedControl = await resolveFindingControl(
      client,
      finding.tenant_id,
      finding.tenant_control_id,
      finding.iso_code
    );

    if (!resolvedControl || !resolvedControl.tenant_control_id_moderno) {
      return res.status(400).json({
        error: 'No se pudo resolver el control del hallazgo al tenant_control moderno'
      });
    }

    if (resolvedControl.iso_mismatch) {
      return res.status(400).json({
        error: 'El control asociado no pertenece a la norma ISO del hallazgo'
      });
    }

    const activeStandard = await ensureOperationalStandard(
      client,
      finding.tenant_id,
      finding.iso_code
    );

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error: 'La norma del hallazgo ya no está dentro del alcance operativo activo de esta empresa'
      });
    }

    const activeControl = await ensureOperationalControl(
      client,
      finding.tenant_id,
      finding.iso_code,
      resolvedControl.tenant_control_id_moderno,
      resolvedControl.operation_id
    );

    if (activeControl.rowCount === 0) {
      return res.status(400).json({
        error: 'El control del hallazgo ya no pertenece al alcance operativo activo'
      });
    }

    await client.query('BEGIN');

    const existingAction = await client.query(
      `
      SELECT *
      FROM action_plans
      WHERE finding_id = $1
         OR (source_type = 'finding' AND source_id = $1)
      LIMIT 1
      `,
      [id]
    );

    if (existingAction.rowCount > 0) {
      const existing = existingAction.rows[0];

      if (!existing.tenant_control_id) {
        await client.query(
          `
          UPDATE action_plans
          SET tenant_control_id = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [resolvedControl.tenant_control_id_moderno, existing.id]
        );
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        already_exists: true,
        action_plan: {
          ...existing,
          tenant_control_id: existing.tenant_control_id || resolvedControl.tenant_control_id_moderno
        }
      });
    }

    const actionResult = await client.query(
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
        finding_id,
        tenant_control_id,
        nonconformity_id,
        audit_id,
        asset_id,
        approval_status
      )
      VALUES ($1,$2,$3,$4,'finding',$5,$6,'abierto',$7,$8,$9,$10,$11,$12,$13,$14,'no_requerida')
      RETURNING *
      `,
      [
        finding.tenant_id,
        finding.iso_code,
        `Acción derivada: ${finding.title}`,
        finding.description || null,
        finding.id,
        finding.severity || 'media',
        finding.owner || null,
        finding.due_date || null,
        getUserId(req.user),
        finding.id,
        resolvedControl.tenant_control_id_moderno,
        finding.nonconformity_id || null,
        finding.audit_id || null,
        finding.asset_id || null
      ]
    );

    await client.query(
      `
      INSERT INTO action_plan_updates (
        action_plan_id,
        tenant_id,
        comment,
        progress_percent,
        status_after,
        blocked_reason,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        actionResult.rows[0].id,
        finding.tenant_id,
        'Plan creado desde hallazgo.',
        0,
        'abierto',
        null,
        getUserId(req.user)
      ]
    );

    await client.query(
      `
      UPDATE findings
      SET status = 'accion definida',
          updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      already_exists: false,
      action_plan: actionResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE ACTION FROM FINDING:', err);
    return res.status(500).json({
      error: 'Error creando acción desde hallazgo',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
