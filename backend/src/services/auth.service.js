const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// =============================
// 📝 REGISTRO
// =============================
const register = async (email, password, tenant_id = null, role = 'user') => {
  try {
    // 🔒 validar duplicado
    const exists = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (exists.rowCount > 0) {
      throw new Error('Usuario ya existe');
    }

    // 🔐 hash password
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash, tenant_id, role)
      VALUES ($1,$2,$3,$4)
      RETURNING id, email, tenant_id, role
      `,
      [email, hashed, tenant_id, role]
    );

    return result.rows[0];

  } catch (err) {
    console.error('REGISTER SERVICE ERROR:', err);
    throw err;
  }
};


// =============================
// 🔐 LOGIN
// =============================
const login = async (email, password) => {
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      throw new Error('Usuario no existe');
    }

    const user = result.rows[0];

    // 🔐 comparar password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      throw new Error('Password incorrecto');
    }

    // =============================
    // 🔥 JWT CON ROLE
    // =============================
    const token = jwt.sign(
      {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role || 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return token;

  } catch (err) {
    console.error('LOGIN SERVICE ERROR:', err);
    throw err;
  }
};

module.exports = {
  register,
  login
};
