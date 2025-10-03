// /api/auth/verify.js
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getQueryToken(req) {
  try {
    // Vercel часто даёт req.query, но подстрахуемся
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

    // 1) Ищем запись (без фильтра по NOW(), сперва смотрим что нашли)
    const r = await pool.query(
      `SELECT ac.id, ac.expires_at, ac.created_at, u.id AS user_id, u.email, NOW() AS now_utc
       FROM auth_codes ac
       JOIN users u ON u.id = ac.user_id
       WHERE ac.token = $1
       ORDER BY ac.created_at DESC
       LIMIT 1`,
      [token]
    );

    const row = r.rows[0];
    if (!row) {
      console.log('verify: token_not_found', token.slice(0, 8));
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    // 2) Проверяем срок годности
    if (row.expires_at <= row.now_utc) {
      console.log('verify: token_expired', token.slice(0, 8), 'exp=', row.expires_at, 'now=', row.now_utc);
      // Можно сразу удалить протухший токен:
      await pool.query('DELETE FROM auth_codes WHERE id = $1', [row.id]).catch(() => {});
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    // 3) Делаем токен одноразовым
    await pool.query('DELETE FROM auth_codes WHERE id = $1', [row.id]).catch(() => {});

    // 4) JWT на 7 дней
    const jwtToken = jwt.sign(
      { sub: row.user_id, email: row.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token: jwtToken, user: { id: row.user_id, email: row.email } });
  } catch (e) {
    console.error('auth/verify error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
