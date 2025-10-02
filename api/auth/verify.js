// Serverless-функция Vercel: GET /api/auth/verify?token=...
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'token_required' });

    const { rows } = await pool.query(
      `SELECT * FROM login_tokens WHERE token=$1`,
      [token]
    );
    const row = rows[0];
    if (!row) return res.status(400).json({ error: 'invalid_token' });
    if (row.used) return res.status(400).json({ error: 'token_used' });
    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ error: 'token_expired' });

    // ensure user exists
    let userRes = await pool.query(`SELECT * FROM users WHERE email=$1`, [row.email]);
    let user = userRes.rows[0];
    if (!user) {
      userRes = await pool.query(
        `INSERT INTO users (email) VALUES ($1) RETURNING *`,
        [row.email]
      );
      user = userRes.rows[0];
    }

    await pool.query(`UPDATE login_tokens SET used=true WHERE token=$1`, [token]);

    const jwtToken = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Можно редиректить на фронт с токеном, но проще вернуть JSON
    return res.json({ token: jwtToken, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('auth/verify error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
