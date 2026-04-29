const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');

// =============================
// 📁 CONFIG STORAGE
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// =============================
// 📥 SUBIR PDF REAL
// =============================
router.post('/upload', auth, upload.single('file'), async (req, res) => {
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
