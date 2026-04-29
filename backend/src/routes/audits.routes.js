const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');

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

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function isSuperAdmin(user) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(normalizeRole(user));
}

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

async function getAuditById(id) {
  return pool.query(
    `
    SELECT *
    FROM audits
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
}

async function ensureOperationalStandard(tenantId, iso) {
  return pool.query(
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
    [tenantId, iso]
  );
}

function normalizeStatus(value) {
  const raw = String(value || '').toLowerCase().trim();

  if (raw === 'completada') return 'completada';
  if (raw === 'en_ejecucion' || raw === 'en ejecución') return 'en_ejecucion';
  return 'pendiente';
}

// =============================
// 📁 STORAGE INFORME
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// =============================
// 📥 CREAR AUDITORÍA
// =============================
router.post('/', auth, async (req, res) => {
  try {
    const {
      tenant_id,
      iso,
      start_date,
      end_date,
      requester_name,
      auditor_type,
      auditor_name,
    } = req.body;

    if (!tenant_id || !iso || !start_date) {
      return res.status(400).json({
        error: 'tenant_id, iso y start_date son obligatorios',
      });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureOperationalStandard(tenant_id, iso);

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma seleccionada no está dentro del alcance operativo activo de esta empresa',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO audits (
        tenant_id,
        iso,
        start_date,
        end_date,
        requester_name,
        auditor_type,
        auditor_name,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente')
      RETURNING *
      `,
      [
        tenant_id,
        iso,
        start_date,
        end_date || null,
        requester_name || null,
        auditor_type || null,
        auditor_name || null,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR CREATE AUDIT:', err);
    return res.status(500).json({
      error: 'Error creando auditoría',
      detail: err.message,
    });
  }
});

// =============================
// ▶ INICIAR AUDITORÍA
// =============================
router.put('/start/:id', auth, async (req, res) => {
  try {
    const current = await getAuditById(req.params.id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const audit = current.rows[0];

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureOperationalStandard(audit.tenant_id, audit.iso);

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma de esta auditoría ya no está dentro del alcance operativo activo de esta empresa',
      });
    }

    if (normalizeStatus(audit.status) === 'completada') {
      return res.status(400).json({
        error: 'La auditoría ya está completada',
      });
    }

    await pool.query(
      `
      UPDATE audits
      SET status = 'en_ejecucion'
      WHERE id = $1
      `,
      [req.params.id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('ERROR START AUDIT:', err);
    return res.status(500).json({
      error: 'Error iniciando auditoría',
      detail: err.message,
    });
  }
});

// =============================
// 📎 SUBIR INFORME
// =============================
router.post('/upload/:id', auth, upload.single('file'), async (req, res) => {
  try {
    const current = await getAuditById(req.params.id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const audit = current.rows[0];

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureOperationalStandard(audit.tenant_id, audit.iso);

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma de esta auditoría ya no está dentro del alcance operativo activo de esta empresa',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    await pool.query(
      `
      UPDATE audits
      SET report_file = $1
      WHERE id = $2
      `,
      [req.file.filename, req.params.id]
    );

    return res.json({
      success: true,
      report_file: req.file.filename,
    });
  } catch (err) {
    console.error('ERROR UPLOAD AUDIT REPORT:', err);
    return res.status(500).json({
      error: 'Error subiendo informe',
      detail: err.message,
    });
  }
});

// =============================
// ✅ COMPLETAR AUDITORÍA
// =============================
router.put('/complete/:id', auth, async (req, res) => {
  try {
    const current = await getAuditById(req.params.id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const audit = current.rows[0];

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureOperationalStandard(audit.tenant_id, audit.iso);

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma de esta auditoría ya no está dentro del alcance operativo activo de esta empresa',
      });
    }

    if (!audit.report_file) {
      return res.status(400).json({
        error: 'Debes cargar el informe antes de completar la auditoría',
      });
    }

    await pool.query(
      `
      UPDATE audits
      SET status = 'completada'
      WHERE id = $1
      `,
      [req.params.id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('ERROR COMPLETE AUDIT:', err);
    return res.status(500).json({
      error: 'Error completando auditoría',
      detail: err.message,
    });
  }
});

// =============================
// 📅 PRÓXIMAS AUDITORÍAS POR ISO
// solo alcance operativo real
// =============================
router.get('/next-all/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT ON (a.iso)
        a.*
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1
        AND normalize_status_for_audits(a.status) != 'completada'
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op
            ON op.id = tso.operation_id
           AND op.tenant_id = tso.tenant_id
           AND op.is_active = TRUE
          WHERE tso.tenant_id = a.tenant_id
            AND tso.standard_code = a.iso
            AND tso.is_active = TRUE
        )
      ORDER BY a.iso, a.start_date ASC
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    if (!String(err.message || '').includes('normalize_status_for_audits')) {
      console.error('ERROR NEXT ALL AUDITS:', err);
    }

    try {
      const { tenant_id } = req.params;
      const result = await pool.query(
        `
        SELECT DISTINCT ON (a.iso)
          a.*
        FROM audits a
        JOIN tenant_standards ts
          ON ts.tenant_id = a.tenant_id
         AND ts.standard_code = a.iso
         AND ts.is_active = TRUE
        WHERE a.tenant_id = $1
          AND LOWER(COALESCE(a.status, 'pendiente')) != 'completada'
          AND EXISTS (
            SELECT 1
            FROM tenant_standard_operations tso
            JOIN tenant_operations op
              ON op.id = tso.operation_id
             AND op.tenant_id = tso.tenant_id
             AND op.is_active = TRUE
            WHERE tso.tenant_id = a.tenant_id
              AND tso.standard_code = a.iso
              AND tso.is_active = TRUE
          )
        ORDER BY a.iso, a.start_date ASC
        `,
        [tenant_id]
      );

      return res.json(result.rows);
    } catch (innerErr) {
      console.error('ERROR NEXT ALL AUDITS:', innerErr);
      return res.status(500).json({
        error: 'Error próximas auditorías',
        detail: innerErr.message,
      });
    }
  }
});

// =============================
// 📅 PRÓXIMA AUDITORÍA (legacy)
// solo alcance operativo real
// =============================
router.get('/next/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT a.*
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1
        AND LOWER(COALESCE(a.status, 'pendiente')) != 'completada'
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op
            ON op.id = tso.operation_id
           AND op.tenant_id = tso.tenant_id
           AND op.is_active = TRUE
          WHERE tso.tenant_id = a.tenant_id
            AND tso.standard_code = a.iso
            AND tso.is_active = TRUE
        )
      ORDER BY a.start_date ASC
      LIMIT 1
      `,
      [tenant_id]
    );

    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error('ERROR NEXT AUDIT:', err);
    return res.status(500).json({
      error: 'Error próxima auditoría',
      detail: err.message,
    });
  }
});

// =============================
// 📋 LISTAR
// solo alcance operativo real
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (iso) {
      const activeStandard = await ensureOperationalStandard(tenant_id, String(iso));
      if (activeStandard.rowCount === 0) {
        return res.json([]);
      }
    }

    const params = [tenant_id];
    let idx = 2;

    let query = `
      SELECT a.*
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM tenant_standard_operations tso
          JOIN tenant_operations op
            ON op.id = tso.operation_id
           AND op.tenant_id = tso.tenant_id
           AND op.is_active = TRUE
          WHERE tso.tenant_id = a.tenant_id
            AND tso.standard_code = a.iso
            AND tso.is_active = TRUE
        )
    `;

    if (iso) {
      query += ` AND a.iso = $${idx}`;
      params.push(String(iso));
      idx++;
    }

    query += ` ORDER BY a.start_date DESC, a.created_at DESC NULLS LAST`;

    const result = await pool.query(query, params);

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET AUDITS:', err);
    return res.status(500).json({
      error: 'Error obteniendo auditorías',
      detail: err.message,
    });
  }
});

module.exports = router;
