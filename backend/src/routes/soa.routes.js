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

// =============================
// 🔐 AUTORIZACIÓN BÁSICA
// =============================
const ensureTenantAccess = (req, tenantId) => {
  if (req.user?.role === 'superadmin') return true;
  return req.user?.tenant_id === tenantId;
};

// =============================
// 🧱 BOOTSTRAP SOA
// crea filas faltantes para controles del tenant/iso
// =============================
const bootstrapSoA = async (tenantId, iso) => {
  await pool.query(
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

    await bootstrapSoA(tenant_id, iso);

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
