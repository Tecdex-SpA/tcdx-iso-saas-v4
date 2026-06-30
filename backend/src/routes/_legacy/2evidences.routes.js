const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const auth = require('../../middleware/auth');
const {
  DOCUMENT_MIME_TYPES,
  createDiskUpload,
  safeUploadError,
} = require('../../utils/secureUpload');

// =============================
// 📁 CONFIG STORAGE
// =============================
const upload = createDiskUpload({
  destination: 'uploads/',
  allowedTypes: DOCUMENT_MIME_TYPES,
  fileSize: Number(process.env.EVIDENCE_UPLOAD_MAX_BYTES || 25 * 1024 * 1024),
  files: 1,
  fields: 20,
  code: 'EVIDENCE_FILE_TYPE_NOT_ALLOWED',
  message: 'Tipo de archivo no permitido para evidencia',
});

function evidenceUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    const payload = safeUploadError(error, {
      code: 'EVIDENCE_UPLOAD_ERROR',
      sizeCode: 'EVIDENCE_FILE_TOO_LARGE',
      sizeMessage: 'La evidencia excede el tamaño máximo permitido',
      message: 'Tipo de archivo no permitido para evidencia',
    });
    return res.status(payload.status).json({ error: payload.error, code: payload.code });
  });
}

// =============================
// 📥 SUBIR PDF REAL
// =============================
router.post('/upload', auth, evidenceUpload, async (req, res) => {
  try {
    const { tenant_id, control_id, description } = req.body;

    const result = await pool.query(
      `
      INSERT INTO evidences (tenant_id, control_id, description, file_path)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        tenant_id,
        control_id,
        description || 'Evidencia subida',
        req.file.filename
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error upload evidencia' });
  }
});

// =============================
// 🤖 VALIDAR (FASE 1 SIMPLE)
// =============================
router.put('/validate/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE evidences
      SET validated = true
      WHERE id = $1
      `,
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error validación' });
  }
});

// =============================
// 👨‍⚖️ APROBACIÓN AUDITOR
// =============================
router.put('/approve/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // aprobado / rechazado

    await pool.query(
      `
      UPDATE evidences
      SET status = $1
      WHERE id = $2
      `,
      [status, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error aprobación' });
  }
});

// =============================
// 📋 LISTAR
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        e.*,
        cc.iso,
        cc.clause,
        cc.description AS control_description
      FROM evidences e
      LEFT JOIN controls_catalog cc 
        ON e.control_id = cc.id
      WHERE e.tenant_id = $1
      ORDER BY e.created_at DESC
      `,
      [req.params.tenant_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error evidencias' });
  }
});

module.exports = router;
