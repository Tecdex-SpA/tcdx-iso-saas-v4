const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const PROFILE_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'profiles');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(PROFILE_UPLOAD_DIR, { recursive: true }, (err) => {
      cb(err, PROFILE_UPLOAD_DIR);
    });
  },
  filename: (req, file, cb) => {
    const safeOriginalName = String(file.originalname || 'avatar')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .slice(-120);
    cb(null, `${Date.now()}-${safeOriginalName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }

    cb(new Error('INVALID_AVATAR_TYPE'));
  }
});

function uploadAvatar(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen no debe superar 5 MB' });
    }

    if (err.message === 'INVALID_AVATAR_TYPE') {
      return res.status(400).json({ error: 'Selecciona un archivo de imagen válido' });
    }

    console.error('ERROR AVATAR UPLOAD MIDDLEWARE:', err);
    return res.status(500).json({ error: 'Error procesando foto de perfil' });
  });
}

// =============================
// PERFIL PROPIO
// =============================
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        email,
        full_name,
        name,
        role,
        phone,
        job_title,
        avatar,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR GET ME:', err);
    res.status(500).json({ error: 'Error servidor' });
  }
});

// =============================
// ACTUALIZAR PERFIL PROPIO
// =============================
router.put('/me', auth, async (req, res) => {
  try {
    const { full_name, phone, job_title } = req.body;

    const result = await pool.query(
      `
      UPDATE users
      SET
        full_name = $1,
        name = $1,
        phone = $2,
        job_title = $3
      WHERE id = $4
      RETURNING
        id,
        tenant_id,
        email,
        full_name,
        name,
        role,
        phone,
        job_title,
        avatar,
        created_at
      `,
      [
        full_name || '',
        phone || '',
        job_title || '',
        req.user.user_id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR UPDATE ME:', err);
    res.status(500).json({ error: 'Error actualizando perfil' });
  }
});

// =============================
// CAMBIAR CONTRASEÑA PROPIA
// =============================
router.put('/me/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Debes ingresar contraseña actual y nueva contraseña' });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const current = await pool.query(
      `
      SELECT id, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.user_id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userRow = current.rows[0];
    const validPassword = await bcrypt.compare(current_password, userRow.password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [hashedPassword, req.user.user_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('ERROR CHANGE PASSWORD:', err);
    res.status(500).json({ error: 'Error cambiando contraseña' });
  }
});

// =============================
// SUBIR FOTO DE PERFIL
// =============================
router.post('/me/avatar', auth, uploadAvatar, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET avatar = $1
      WHERE id = $2
      RETURNING
        id,
        tenant_id,
        email,
        full_name,
        name,
        role,
        phone,
        job_title,
        avatar,
        created_at
      `,
      [req.file.filename, req.user.user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR UPLOAD AVATAR:', err);
    res.status(500).json({ error: 'Error subiendo foto' });
  }
});

// =============================
// GET POR ID
// =============================
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'superadmin' && req.user.user_id !== id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        email,
        full_name,
        name,
        role,
        phone,
        job_title,
        avatar,
        created_at
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR BACKEND:', err);
    res.status(500).json({ error: 'Error servidor' });
  }
});

module.exports = router;
