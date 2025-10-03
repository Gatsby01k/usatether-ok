// /api/auth/verify.js
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// аккуратно читаем token как из req.query, так и из сырого URL
function getQueryToken(req) {
  try {
    const t1 = req?.query?.token;
    if (t1) return String(t1).trim();
    const url = new URL(req.url, 'http://x');
    const t2 = url.searchParams.get('token');
    if (t2) return String(t2).trim();
  } catch {}
  return '';
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const token = getQueryToken(req);
    if (!token) return res.status(400).json({ error: 'token_required' });

    // АТОМАРНО: удаляем ровно одну запись с валидным токеном и ещё не истёкшим сроком,
    // сразу получаем user_id/email через JOIN.
    const q = `
      WITH deleted AS (
        DELETE FROM auth_codes
        WHERE token = $1 AND expires_at > now()
        RETURNING user_id
      )
      SELECT u.id AS user_id, u.email
      FROM deleted d
      JOIN users u ON u.id = d.user_id
      LIMIT 1
    `;
    const r = await pool.query(q, [token]);
    const row = r.rows[0];

    if (!row) {
      // либо токен не найден, либо уже истёк/использован → одно сообщение
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    // JWT на 7 дней
    const jwtToken = jwt.sign(
      { sub: row.user_id, email: row.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // (опционально) Параллельно кладём JWT в HttpOnly cookie — безопаснее, чем localStorage.
    // Оставляем и JSON, чтобы фронт не ломать.
    try {
      res.setHeader('Set-Cookie', [
        `jwt=${jwtToken}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
      ]);
    } catch {}

    return res.json({ token: jwtToken, user: { id: row.user_id, email: row.email } });
  } catch (e) {
    console.error('auth/verify error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
