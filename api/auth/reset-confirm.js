const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { token, password } = req.body || {};
    if (!token)    return res.status(400).json({ error: 'token_required' });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'weak_password' });
    }

    const hash = await bcrypt.hash(password, 12);

    // атомарно: удалить токен, обновить пароль, пометить верифицированным
    const q = `
      WITH deleted AS (
        DELETE FROM password_reset_codes
        WHERE token = $1 AND expires_at > now()
        RETURNING user_id
      )
      UPDATE users u
      SET password_hash = $2,
          password_set_at = now(),
          is_verified = TRUE
      FROM deleted d
      WHERE u.id = d.user_id
      RETURNING u.id AS user_id, u.email
    `;
    const r = await pool.query(q, [token, hash]);
    const row = r.rows[0];

    if (!row) return res.status(400).json({ error: 'invalid_or_expired' });

    // логиним сразу
    const jwtToken = jwt.sign(
      { sub: row.user_id, email: row.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.setHeader('Set-Cookie', [
      `jwt=${jwtToken}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    ]);
    return res.json({ token: jwtToken, user: { id: row.user_id, email: row.email } });
  } catch (e) {
    console.error('reset-confirm error', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
