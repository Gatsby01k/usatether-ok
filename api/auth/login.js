const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    if (!em || !password) return res.status(400).json({ error: 'bad_request' });

    const r = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
      [em]
    );
    const user = r.rows[0];

    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.setHeader('Set-Cookie', [
      `jwt=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    ]);
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('auth/login error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
