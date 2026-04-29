const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// =============================
// 🔐 VALIDADOR UUID
// =============================
const isUUID = (str) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

const ensureTenantAccess = (req, tenantId) => {
  if (req.user?.role === 'superadmin') return true;
  return req.user?.tenant_id === tenantId;
};

// =============================
// ✅ IA RECOMMENDATIONS
// Solo normas activas + tenant_controls
// =============================
router.get('/recommendations/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!isUUID(tenant_id)) {
      return res.status(400).json({ error: 'tenant_id inválido' });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT ON (tc.id)
        tc.id AS tenant_control_id,
        tc.tenant_id,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.clause,
        COALESCE(cc.category, '') AS category,
        COALESCE(cc.description, 'Control sin información') AS description,
        COALESCE(NULLIF(tc.status, ''), 'pendiente') AS status,
        COALESCE(g.accion, 'Implementar el control, definir responsables y documentar el proceso.') AS accion,
        COALESCE(g.evidencia, 'Generar evidencia documentada.') AS evidencia
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON tc.control_id = cc.id
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
      LEFT JOIN iso_clause_guides g
        ON g.iso = cc.iso
       AND (
         g.clause = cc.clause
         OR g.clause LIKE cc.clause || '%'
       )
      WHERE tc.tenant_id = $1
        AND ts.is_active = TRUE
        AND cc.is_active = TRUE
      ORDER BY tc.id, g.clause
      `,
      [tenant_id]
    );

    const response = result.rows.map((c) => {
      let prioridad = 'baja';

      if (c.status === 'no cumple') prioridad = 'alta';
      else if (c.status === 'parcial') prioridad = 'media';
      else if (c.status === 'pendiente') prioridad = 'media';

      return {
        tenant_control_id: c.tenant_control_id,
        tenant_id: c.tenant_id,
        iso: c.iso || 'N/A',
        clause: c.clause || '-',
        category: c.category || '',
        description: c.description || 'Control sin información',
        prioridad,
        accion: c.accion,
        evidencia: c.evidencia,
        catalog_control_id: c.catalog_control_id,

        auditor_explicacion:
          c.status === 'no cumple'
            ? 'El control no se encuentra implementado, lo que representa un riesgo significativo y requiere acción inmediata.'
            : c.status === 'parcial'
            ? 'El control está parcialmente implementado, pero necesita fortalecerse para cumplir completamente con la norma.'
            : c.status === 'pendiente'
            ? 'El control aún no ha sido evaluado o implementado formalmente, por lo que requiere revisión prioritaria.'
            : 'El control está implementado correctamente, pero debe mantenerse bajo monitoreo continuo.'
      };
    });

    res.json(response);

  } catch (err) {
    console.error('ERROR IA:', err);
    res.status(500).json({ error: 'Error IA recommendations' });
  }
});

// =============================
// 🔥 APPLY IA
// tenant_controls + normas activas
// =============================
router.put('/apply/:tenant_control_id', auth, async (req, res) => {
  try {
    const { tenant_control_id } = req.params;

    if (!isUUID(tenant_control_id)) {
      return res.status(400).json({ error: 'control_id inválido' });
    }

    const controlResult = await pool.query(
      `
      SELECT
        tc.*,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.description AS control_description,
        cc.is_active AS catalog_is_active,
        ts.is_active AS standard_is_active
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON tc.control_id = cc.id
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
      WHERE tc.id = $1
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

    if (!control.standard_is_active || !control.catalog_is_active) {
      return res.status(400).json({ error: 'La norma o el control ya no están activos para esta empresa' });
    }

    const ncResult = await pool.query(
      `
      SELECT *
      FROM tenant_nonconformities
      WHERE control_id = $1
        AND tenant_id = $2
        AND status != 'resuelta'
      LIMIT 1
      `,
      [control.catalog_control_id, control.tenant_id]
    );

    if (ncResult.rowCount > 0) {
      const nc = ncResult.rows[0];

      await pool.query(
        `
        UPDATE tenant_nonconformities
        SET status = 'resuelta',
            resolved_at = NOW()
        WHERE id = $1
        `,
        [nc.id]
      );
    }

    await pool.query(
      `
      UPDATE tenant_controls
      SET status = 'cumple'
      WHERE id = $1
      `,
      [tenant_control_id]
    );

    await pool.query(
      `
      INSERT INTO evidences (tenant_id, control_id, description)
      VALUES ($1, $2, $3)
      `,
      [
        control.tenant_id,
        control.catalog_control_id,
        'Control corregido automáticamente mediante IA'
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error('ERROR APPLY IA:', err);
    res.status(500).json({ error: 'Error apply IA' });
  }
});

module.exports = router;
