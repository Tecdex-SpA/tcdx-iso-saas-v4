const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const {
  createDiskUpload,
  safeUploadError,
} = require('../utils/secureUpload');
const { safeErrorLog } = require('../utils/safeLogger');

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

function isTenantAdmin(user) {
  return ['admin', 'tenant_admin'].includes(normalizeRole(user));
}

function isAuditor(user) {
  return normalizeRole(user) === 'auditor';
}

function isOperativo(user) {
  return normalizeRole(user) === 'operativo';
}

function isViewer(user) {
  return [
    'viewer',
    'cliente',
    'client',
    'solo_lectura',
    'read_only',
    'readonly',
    'ejecutivo',
  ].includes(normalizeRole(user));
}

function canReadAudits(user) {
  return (
    isSuperAdmin(user) ||
    isTenantAdmin(user) ||
    isAuditor(user) ||
    isOperativo(user) ||
    isViewer(user)
  );
}

function canManageAudits(user) {
  return isSuperAdmin(user) || isTenantAdmin(user) || isAuditor(user);
}

function denyReadAudits(res) {
  return res.status(403).json({
    ok: false,
    code: 'RBAC_DENIED',
    error: 'No autorizado para consultar auditorías',
  });
}

function denyManageAudits(res) {
  return res.status(403).json({
    ok: false,
    code: 'RBAC_DENIED',
    error: 'No autorizado para crear o modificar auditorías',
  });
}

function normalizeAuditStatusForSql(status) {
  const raw = String(status || '').toLowerCase().trim();

  if (raw === 'completada') return 'completada';
  if (raw === 'en_ejecucion' || raw === 'en ejecución') return 'en_ejecucion';
  return 'pendiente';
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
const auditReportDir = path.join(__dirname, '..', '..', 'uploads', 'audit-reports');
fs.mkdirSync(auditReportDir, { recursive: true });

const upload = createDiskUpload({
  destination: auditReportDir,
  allowedTypes: {
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.pdf': ['application/pdf'],
  },
  fileSize: Number(process.env.AUDIT_REPORT_UPLOAD_MAX_BYTES || 25 * 1024 * 1024),
  files: 1,
  fields: 10,
  code: 'AUDIT_REPORT_TYPE_NOT_ALLOWED',
  message: 'Tipo de informe no permitido',
});

function auditReportUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    const payload = safeUploadError(err, {
      code: 'AUDIT_REPORT_UPLOAD_ERROR',
      sizeCode: 'AUDIT_REPORT_TOO_LARGE',
      sizeMessage: 'El informe excede el tamaño máximo permitido',
      message: 'Tipo de informe no permitido',
    });
    return res.status(payload.status).json(payload);
  });
}

function resolveAuditReportPath(filePath) {
  const safeName = path.basename(String(filePath || ''));
  if (!safeName) return null;

  const candidates = [
    path.join(auditReportDir, safeName),
    path.join(__dirname, '..', '..', 'uploads', safeName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

// =============================
// 📥 CREAR AUDITORÍA
// =============================
router.post('/', auth, async (req, res) => {
  try {
    if (!canManageAudits(req.user)) {
      return denyManageAudits(res);
    }

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
    safeErrorLog('ERROR CREATE AUDIT:', err, req);
    return res.status(500).json({
      error: 'Error creando auditoría',
    });
  }
});

// =============================
// ▶ INICIAR AUDITORÍA
// =============================
router.put('/start/:id', auth, async (req, res) => {
  try {
    if (!canManageAudits(req.user)) {
      return denyManageAudits(res);
    }

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
    safeErrorLog('ERROR START AUDIT:', err, req);
    return res.status(500).json({
      error: 'Error iniciando auditoría',
    });
  }
});

// =============================
// 📎 SUBIR INFORME
// =============================
router.post('/upload/:id', auth, auditReportUpload, async (req, res) => {
  try {
    if (!canManageAudits(req.user)) {
      return denyManageAudits(res);
    }

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
    safeErrorLog('ERROR UPLOAD AUDIT REPORT:', err, req);
    return res.status(500).json({
      error: 'Error subiendo informe',
    });
  }
});

// =============================
// ✅ COMPLETAR AUDITORÍA
// =============================
router.put('/complete/:id', auth, async (req, res) => {
  try {
    if (!canManageAudits(req.user)) {
      return denyManageAudits(res);
    }

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
    safeErrorLog('ERROR COMPLETE AUDIT:', err, req);
    return res.status(500).json({
      error: 'Error completando auditoría',
    });
  }
});

// =============================
// Descargar informe de auditoría con autorización tenant
// =============================
router.get('/report/:id', auth, async (req, res) => {
  try {
    const current = await getAuditById(req.params.id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const audit = current.rows[0];

    if (!canReadAudits(req.user)) {
      return denyReadAudits(res);
    }

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!audit.report_file) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const filePath = resolveAuditReportPath(audit.report_file);

    if (!filePath) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }

    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    return res.sendFile(filePath);
  } catch (err) {
    safeErrorLog('ERROR DOWNLOAD AUDIT REPORT:', err, req);
    return res.status(500).json({
      error: 'Error descargando informe',
    });
  }
});


// =============================
// 📊 RESUMEN EJECUTIVO AUDITORÍAS
// GET /api/audits/summary/:tenant_id
// No deteriora KPI. Solo entrega lectura ejecutiva.
// =============================
router.get('/summary/:tenant_id', auth, async (req, res) => {
  try {
    if (!canReadAudits(req.user)) {
      return denyReadAudits(res);
    }

    const { tenant_id } = req.params;
    const { iso } = req.query || {};

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
      });
    }

    const params = [tenant_id];
    let isoFilterSql = '';

    if (iso) {
      const activeStandard = await ensureOperationalStandard(tenant_id, String(iso));

      if (activeStandard.rowCount === 0) {
        return res.json({
          ok: true,
          tenant_id,
          iso,
          summary: {
            total: 0,
            pendientes: 0,
            en_ejecucion: 0,
            completadas: 0,
            con_informe: 0,
            sin_informe: 0,
            hallazgos: 0,
            acciones: 0,
          },
          next_audit: null,
          recent_audits: [],
        });
      }

      params.push(String(iso));
      isoFilterSql = ` AND a.iso = $2 `;
    }

    const summaryResult = await pool.query(
      `
      WITH base AS (
        SELECT
          a.id,
          a.tenant_id,
          a.iso,
          a.start_date,
          a.end_date,
          a.requester_name,
          a.auditor_type,
          a.auditor_name,
          a.status,
          a.report_file,
          a.created_at,
          normalize_status_for_audits(a.status) AS normalized_status
        FROM audits a
        JOIN tenant_standards ts
          ON ts.tenant_id = a.tenant_id
         AND ts.standard_code = a.iso
         AND ts.is_active = TRUE
        WHERE a.tenant_id = $1
          ${isoFilterSql}
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
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE normalized_status = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE normalized_status = 'en_ejecucion')::int AS en_ejecucion,
        COUNT(*) FILTER (WHERE normalized_status = 'completada')::int AS completadas,
        COUNT(*) FILTER (WHERE report_file IS NOT NULL AND report_file <> '')::int AS con_informe,
        COUNT(*) FILTER (WHERE report_file IS NULL OR report_file = '')::int AS sin_informe
      FROM base
      `,
      params
    );

    const relationResult = await pool.query(
      `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM findings f
          WHERE f.tenant_id = $1::uuid
            AND f.audit_id IS NOT NULL
            ${iso ? 'AND f.iso_code = $2' : ''}
        ) AS hallazgos,
        (
          SELECT COUNT(*)::int
          FROM action_plans ap
          WHERE ap.tenant_id = $1::uuid
            AND ap.audit_id IS NOT NULL
            ${iso ? 'AND ap.iso_code = $2' : ''}
        ) AS acciones
      `,
      params
    );

    const nextResult = await pool.query(
      `
      SELECT
        a.*,
        normalize_status_for_audits(a.status) AS normalized_status
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1
        ${isoFilterSql}
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
      ORDER BY a.start_date ASC
      LIMIT 1
      `,
      params
    );

    const recentResult = await pool.query(
      `
      SELECT
        a.*,
        normalize_status_for_audits(a.status) AS normalized_status
      FROM audits a
      JOIN tenant_standards ts
        ON ts.tenant_id = a.tenant_id
       AND ts.standard_code = a.iso
       AND ts.is_active = TRUE
      WHERE a.tenant_id = $1
        ${isoFilterSql}
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
      ORDER BY a.start_date DESC, a.created_at DESC NULLS LAST
      LIMIT 8
      `,
      params
    );

    const summary = {
      ...(summaryResult.rows[0] || {}),
      hallazgos: Number(relationResult.rows[0]?.hallazgos || 0),
      acciones: Number(relationResult.rows[0]?.acciones || 0),
    };

    return res.json({
      ok: true,
      tenant_id,
      iso: iso || null,
      summary,
      next_audit: nextResult.rows[0] || null,
      recent_audits: recentResult.rows,
      note:
        'Las auditorías en ejecución son trazabilidad operativa y no deterioran KPI hasta existir resultado formal.',
    });
  } catch (err) {
    safeErrorLog('ERROR GET AUDIT SUMMARY:', err, req);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo resumen ejecutivo de auditorías',
    });
  }
});


// =============================
// 📅 PRÓXIMAS AUDITORÍAS POR ISO
// solo alcance operativo real
// =============================
router.get('/next-all/:tenant_id', auth, async (req, res) => {
  try {
    if (!canReadAudits(req.user)) {
      return denyReadAudits(res);
    }

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
      safeErrorLog('ERROR NEXT ALL AUDITS:', err, req);
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
      safeErrorLog('ERROR NEXT ALL AUDITS:', innerErr, req);
      return res.status(500).json({
        error: 'Error próximas auditorías',
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
    if (!canReadAudits(req.user)) {
      return denyReadAudits(res);
    }

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
    safeErrorLog('ERROR NEXT AUDIT:', err, req);
    return res.status(500).json({
      error: 'Error próxima auditoría',
    });
  }
});

// =============================
// 📋 LISTAR
// solo alcance operativo real
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    if (!canReadAudits(req.user)) {
      return denyReadAudits(res);
    }

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
    safeErrorLog('ERROR GET AUDITS:', err, req);
    return res.status(500).json({
      error: 'Error obteniendo auditorías',
    });
  }
});

module.exports = router;
