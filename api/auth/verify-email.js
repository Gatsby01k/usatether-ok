const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getToken(req) {
  try {
    const t1 = req.query?.token;
    if (t1) return String(t1);
    const url = new URL(req.url, 'http://x');
    const t2 = url.searchParams.get('token');
    if (t2) return String(t2);
  } catch {}
  return '';
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/,'');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const token = getToken(req);
    if (!token) return res.status(400).json({ error: 'token_required' });

    // АТОМАРНО: берём валидный токен, отмечаем юзера как verified
    const q = `
      WITH deleted AS (
        DELETE FROM email_verification_codes
        WHERE token = $1 AND expires_at > now()
        RETURNING user_id
      )
      UPDATE users u
      SET is_verified = TRUE
      FROM deleted d
      WHERE u.id = d.user_id
      RETURNING u.id AS user_id, u.email
    `;
    const r = await pool.query(q, [token]);
    const row = r.rows[0];
    if (!row) return res.status(400).json({ error: 'invalid_or_expired' });

    // выдаём JWT и ставим cookie
    const jwtToken = jwt.sign(
      { sub: row.user_id, email: row.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.setHeader('Set-Cookie', [
      `jwt=${jwtToken}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    ]);

    // редирект прямо в кабинет
    const redirectTo = `${baseUrl(req)}/#/dashboard`;
    res.statusCode = 302;
    res.setHeader('Location', redirectTo);
    res.end('Verified. Redirecting…');
  } catch (e) {
    console.error('verify-email error', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
