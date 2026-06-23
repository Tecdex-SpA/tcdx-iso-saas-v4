const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

const SOA_STANDARDS = [
  'ISO27001',
  'ISO/IEC27701',
  'ISO/IEC27017',
  'ISO/IEC27018'
];

const READ_ONLY_ROLES = ['auditor'];
const MANAGE_ROLES = ['admin', 'tenant_admin', 'superadmin'];

// =============================
// 🔐 AUTORIZACIÓN BÁSICA
// =============================
const ensureTenantAccess = (req, tenantId) => {
  if (req.user?.role === 'superadmin') return true;
  return req.user?.tenant_id === tenantId;
};

const canManageSoA = (req, tenantId) => {
  if (!ensureTenantAccess(req, tenantId)) return false;
  return MANAGE_ROLES.includes(String(req.user?.role || '').toLowerCase());
};

const normalizeIso = (value) => String(value || '').trim();

const countValue = (result, key = 'total') => Number(result.rows[0]?.[key] || 0);

const getSoAPreflight = async (client, tenantId, iso) => {
  const usesSoA = SOA_STANDARDS.includes(iso);

  if (!usesSoA) {
    return {
      tenant_id: tenantId,
      iso,
      uses_soa: false,
      standard_active: false,
      active_operations_count: 0,
      catalog_controls_count: 0,
      tenant_controls_count: 0,
      legacy_controls_count: 0,
      soa_rows_count: 0,
      data_source: null,
      can_initialize_soa: false,
      blocking_reason: 'standard_does_not_use_soa',
      recommended_action: null
    };
  }

  const standardResult = await client.query(
    `
    SELECT is_active
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = $2
    LIMIT 1
    `,
    [tenantId, iso]
  );
  const standardActive = standardResult.rows[0]?.is_active === true;

  const activeOpsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_standard_operations tso
    JOIN tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
    WHERE tso.tenant_id = $1
      AND tso.standard_code = $2
      AND tso.is_active = TRUE
      AND op.is_active = TRUE
    `,
    [tenantId, iso]
  );

  const catalogResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM controls_catalog cc
    WHERE cc.iso = $1
      AND cc.is_active = TRUE
      AND (cc.tenant_id IS NULL OR cc.tenant_id = $2)
    `,
    [iso, tenantId]
  );

  const tenantControlsResult = await client.query(
    `
    SELECT COUNT(DISTINCT tc.id)::int AS total
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active = TRUE
    JOIN tenant_standard_operations tso
      ON tso.operation_id = tc.operation_id
     AND tso.tenant_id = tc.tenant_id
     AND tso.standard_code = cc.iso
     AND tso.is_active = TRUE
    WHERE tc.tenant_id = $1
      AND cc.iso = $2
      AND cc.is_active = TRUE
    `,
    [tenantId, iso]
  );

  const legacyControlsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM controls
    WHERE tenant_id = $1
      AND iso_code = $2
    `,
    [tenantId, iso]
  );

  const soaRowsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM control_soa cs
    JOIN controls c
      ON c.id = cs.tenant_control_id
    WHERE c.tenant_id = $1
      AND c.iso_code = $2
    `,
    [tenantId, iso]
  );

  const activeOperationsCount = countValue(activeOpsResult);
  const tenantControlsCount = countValue(tenantControlsResult);
  const legacyControlsCount = countValue(legacyControlsResult);
  const soaRowsCount = countValue(soaRowsResult);

  let blockingReason = null;
  if (!standardActive) blockingReason = 'standard_not_active';
  else if (activeOperationsCount === 0) blockingReason = 'no_active_operations';
  else if (tenantControlsCount === 0) blockingReason = 'no_tenant_controls';

  const canInitialize = !blockingReason && (legacyControlsCount === 0 || soaRowsCount < legacyControlsCount);

  return {
    tenant_id: tenantId,
    iso,
    uses_soa: true,
    standard_active: standardActive,
    active_operations_count: activeOperationsCount,
    catalog_controls_count: countValue(catalogResult),
    tenant_controls_count: tenantControlsCount,
    legacy_controls_count: legacyControlsCount,
    soa_rows_count: soaRowsCount,
    data_source: tenantControlsCount > 0 ? 'tenant_controls' : 'controls',
    can_initialize_soa: canInitialize,
    blocking_reason: blockingReason,
    recommended_action: canInitialize ? 'initialize_soa_from_tenant_controls' : null
  };
};

// =============================
// 🧱 BOOTSTRAP SOA
// crea filas faltantes para controles del tenant/iso
// =============================
const bootstrapSoA = async (client, tenantId, iso) => {
  await client.query(
    `
    INSERT INTO control_soa (tenant_control_id)
    SELECT c.id
    FROM controls c
    LEFT JOIN control_soa cs
      ON cs.tenant_control_id = c.id
    WHERE c.tenant_id = $1
      AND c.iso_code = $2
      AND cs.tenant_control_id IS NULL
    `,
    [tenantId, iso]
  );
};

const materializeControlsFromTenantControls = async (client, tenantId, iso) => {
  const result = await client.query(
    `
    WITH source_controls AS (
      SELECT DISTINCT ON (tc.control_id)
        tc.tenant_id,
        cc.iso AS iso_code,
        cc.clause,
        COALESCE(NULLIF(tc.status, ''), 'pendiente') AS status,
        COALESCE(ROUND(tc.score)::int, 0) AS score,
        tc.control_id AS catalog_control_id,
        tc.created_at
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      JOIN tenant_standard_operations tso
        ON tso.operation_id = tc.operation_id
       AND tso.tenant_id = tc.tenant_id
       AND tso.standard_code = cc.iso
       AND tso.is_active = TRUE
      WHERE tc.tenant_id = $1
        AND cc.iso = $2
        AND cc.is_active = TRUE
      ORDER BY tc.control_id, tc.created_at DESC NULLS LAST, tc.id
    )
    INSERT INTO controls (
      tenant_id,
      iso_code,
      clause,
      status,
      score,
      catalog_control_id
    )
    SELECT
      sc.tenant_id,
      sc.iso_code,
      sc.clause,
      sc.status,
      sc.score,
      sc.catalog_control_id
    FROM source_controls sc
    WHERE NOT EXISTS (
      SELECT 1
      FROM controls c
      WHERE c.tenant_id = sc.tenant_id
        AND c.iso_code = sc.iso_code
        AND c.catalog_control_id = sc.catalog_control_id
    )
    `,
    [tenantId, iso]
  );

  return result.rowCount || 0;
};

const getSoACount = async (client, tenantId, iso) => {
  const result = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM control_soa cs
    JOIN controls c
      ON c.id = cs.tenant_control_id
    WHERE c.tenant_id = $1
      AND c.iso_code = $2
    `,
    [tenantId, iso]
  );
  return countValue(result);
};

// =============================
// 🧭 PREFLIGHT SOA
// diagnostico no destructivo del origen de datos
// =============================
router.get('/:tenant_id/preflight', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    const preflight = await getSoAPreflight(pool, tenant_id, iso);
    res.json(preflight);
  } catch (err) {
    console.error('ERROR PREFLIGHT SOA:', err);
    res.status(500).json({ error: 'Error diagnosticando SoA' });
  }
});

// =============================
// 🚀 INITIALIZE SOA
// materializa controls desde tenant_controls y crea control_soa faltante
// =============================
router.post('/:tenant_id/initialize', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para inicializar SoA' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    await client.query('BEGIN');

    const preflightBefore = await getSoAPreflight(client, tenant_id, iso);
    if (!preflightBefore.uses_soa) {
      await client.query('ROLLBACK');
      return res.status(400).json(preflightBefore);
    }
    if (!preflightBefore.standard_active || preflightBefore.blocking_reason) {
      await client.query('ROLLBACK');
      return res.status(409).json(preflightBefore);
    }

    const legacyControlsBefore = preflightBefore.legacy_controls_count;
    const soaRowsBefore = preflightBefore.soa_rows_count;
    const legacyControlsCreated = await materializeControlsFromTenantControls(client, tenant_id, iso);
    await bootstrapSoA(pool, tenant_id, iso);
    const soaRowsTotal = await getSoACount(client, tenant_id, iso);

    await client.query('COMMIT');

    res.json({
      ok: true,
      tenant_id,
      iso,
      tenant_controls_count: preflightBefore.tenant_controls_count,
      legacy_controls_before: legacyControlsBefore,
      legacy_controls_created: legacyControlsCreated,
      soa_rows_created: Math.max(0, soaRowsTotal - soaRowsBefore),
      soa_rows_total: soaRowsTotal,
      message: legacyControlsCreated === 0 && soaRowsTotal === soaRowsBefore
        ? 'SoA ya inicializado'
        : 'SoA inicializado desde controles existentes'
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR INITIALIZE SOA:', err);
    res.status(500).json({ error: 'Error inicializando SoA' });
  } finally {
    client.release();
  }
});

// =============================
// 📋 GET SOA POR TENANT + ISO
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    if (!SOA_STANDARDS.includes(iso)) {
      return res.status(400).json({ error: 'La norma no usa SoA' });
    }

    await bootstrapSoA(client, tenant_id, iso);

    const result = await pool.query(
      `
      SELECT
        c.id AS tenant_control_id,
        c.tenant_id,
        c.iso_code AS iso,
        c.clause,
        COALESCE(cc.category, 'General') AS category,
        COALESCE(cc.description, 'Control ' || c.clause) AS description,
        COALESCE(NULLIF(c.status, ''), 'pendiente') AS diagnostic_status,

        cs.applicable,
        cs.implementation_status,
        cs.justification,
        cs.notes,
        cs.owner,
        cs.review_date,
        cs.created_at,
        cs.updated_at
      FROM controls c
      LEFT JOIN control_soa cs
        ON cs.tenant_control_id = c.id
      LEFT JOIN LATERAL (
        SELECT cc2.*
        FROM controls_catalog cc2
        WHERE cc2.id = c.catalog_control_id
           OR (
             c.catalog_control_id IS NULL
             AND cc2.iso = c.iso_code
             AND cc2.clause = c.clause
           )
        ORDER BY
          CASE WHEN cc2.id = c.catalog_control_id THEN 0 ELSE 1 END,
          cc2.id
        LIMIT 1
      ) cc ON TRUE
      WHERE c.tenant_id = $1
        AND c.iso_code = $2
      ORDER BY c.clause, c.created_at
      `,
      [tenant_id, iso]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('ERROR GET SOA:', err);
    res.status(500).json({ error: 'Error obteniendo SoA' });
  }
});

// =============================
// 💾 UPDATE SOA
// =============================
router.put('/:tenant_control_id', auth, async (req, res) => {
  try {
    const { tenant_control_id } = req.params;
    const {
      applicable,
      implementation_status,
      justification,
      notes,
      owner,
      review_date
    } = req.body;

    const controlResult = await pool.query(
      `
      SELECT id, tenant_id, iso_code
      FROM controls
      WHERE id = $1
      LIMIT 1
      `,
      [tenant_control_id]
    );

    if (controlResult.rowCount === 0) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const control = controlResult.rows[0];

    if (!ensureTenantAccess(req, control.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!SOA_STANDARDS.includes(control.iso_code)) {
      return res.status(400).json({ error: 'Este control no pertenece a una norma SoA' });
    }

    const allowedStatuses = [
      'pendiente',
      'implementado',
      'parcial',
      'no implementado',
      'no aplica'
    ];

    if (implementation_status && !allowedStatuses.includes(implementation_status)) {
      return res.status(400).json({ error: 'implementation_status inválido' });
    }

    await pool.query(
      `
      INSERT INTO control_soa (
        tenant_control_id,
        applicable,
        implementation_status,
        justification,
        notes,
        owner,
        review_date,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (tenant_control_id)
      DO UPDATE SET
        applicable = EXCLUDED.applicable,
        implementation_status = EXCLUDED.implementation_status,
        justification = EXCLUDED.justification,
        notes = EXCLUDED.notes,
        owner = EXCLUDED.owner,
        review_date = EXCLUDED.review_date,
        updated_at = NOW()
      `,
      [
        tenant_control_id,
        applicable,
        implementation_status || 'pendiente',
        justification || null,
        notes || null,
        owner || null,
        review_date || null
      ]
    );

    const result = await pool.query(
      `
      SELECT
        c.id AS tenant_control_id,
        c.tenant_id,
        c.iso_code AS iso,
        c.clause,
        COALESCE(cc.category, 'General') AS category,
        COALESCE(cc.description, 'Control ' || c.clause) AS description,
        COALESCE(NULLIF(c.status, ''), 'pendiente') AS diagnostic_status,
        cs.applicable,
        cs.implementation_status,
        cs.justification,
        cs.notes,
        cs.owner,
        cs.review_date,
        cs.created_at,
        cs.updated_at
      FROM controls c
      LEFT JOIN control_soa cs
        ON cs.tenant_control_id = c.id
      LEFT JOIN LATERAL (
        SELECT cc2.*
        FROM controls_catalog cc2
        WHERE cc2.id = c.catalog_control_id
           OR (
             c.catalog_control_id IS NULL
             AND cc2.iso = c.iso_code
             AND cc2.clause = c.clause
           )
        ORDER BY
          CASE WHEN cc2.id = c.catalog_control_id THEN 0 ELSE 1 END,
          cc2.id
        LIMIT 1
      ) cc ON TRUE
      WHERE c.id = $1
      LIMIT 1
      `,
      [tenant_control_id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error('ERROR UPDATE SOA:', err);
    res.status(500).json({ error: 'Error actualizando SoA' });
  }
});

module.exports = router;
