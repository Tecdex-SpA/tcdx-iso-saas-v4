const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const multer = require('multer');

// 🔥 STORAGE SEGURO
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/logos/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

function buildTenantLogoPublicUrl(tenant) {
  if (!tenant) return null;

  const logoUrl = String(tenant.logo_url || '').trim();
  if (logoUrl) return logoUrl;

  const logo = String(tenant.logo || '').trim();
  if (logo) return `/uploads/logos/${logo}`;

  return null;
}

function decorateTenantLogo(tenant) {
  if (!tenant) return tenant;

  return {
    ...tenant,
    logo_public_url: buildTenantLogoPublicUrl(tenant),
  };
}



// =============================
// LISTAR
// =============================
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM tenants ORDER BY name`);
    res.json(result.rows.map(decorateTenantLogo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo empresas' });
  }
});


// =============================
// GET POR ID (FIX ADMIN)
// =============================
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [req.params.id]
    );

    res.json(decorateTenantLogo(result.rows[0] || null));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo empresa' });
  }
});


// =============================
// CREAR
// =============================
router.post('/', auth, upload.single('logo'), async (req, res) => {
  try {
    const { name, rut, address, business, branches } = req.body;

    if (!name || !rut) {
      return res.status(400).json({ error: 'Nombre y RUT obligatorios' });
    }

    const result = await pool.query(
      `
      INSERT INTO tenants (name, rut, address, business, branches, logo)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        name,
        rut,
        address || '',
        business || '',
        branches || '',
        req.file ? req.file.filename : null
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("TENANT ERROR:", err);
    res.status(500).json({ error: 'Error creando empresa' });
  }
});

module.exports = router;
