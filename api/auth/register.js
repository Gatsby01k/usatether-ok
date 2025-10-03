// /api/auth/register.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../_mailer.js'); // опционально: welcome

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { email, password } = req.body || {};
    const em = normalizeEmail(email);
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'weak_password' });
    }

    const pwHash = await bcrypt.hash(password, 12);

    // если юзер есть — обновим ему пароль; если нет — создадим
    const q = `
      INSERT INTO users (email, password_hash, password_set_at)
      VALUES ($1, $2, now())
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            password_set_at = EXCLUDED.password_set_at
      RETURNING id, email
    `;
    const u = await pool.query(q, [em, pwHash]);
    const user = u.rows[0];

    // welcome (не критично)
    try {
      await sendMail({
        to: em,
        subject: 'Welcome to USATether',
        text: 'Your account has been created.',
      });
    } catch {}

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // HttpOnly cookie (и вернём JSON для совместимости)
    res.setHeader('Set-Cookie', [
      `jwt=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    ]);
    return res.json({ token, user });
  } catch (e) {
    console.error('auth/register error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
