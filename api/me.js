// /api/me.js
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function readToken(req) {
  // 1) Authorization: Bearer ...
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  // 2) cookie: jwt=...
  const c = req.headers['cookie'] || '';
  const m = c.match(/(?:^|;\s*)jwt=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const tok = readToken(req);
    if (!tok) return res.status(401).json({ error: 'unauthorized' });

    let payload;
    try { payload = jwt.verify(tok, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'unauthorized' }); }

    const r = await pool.query('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    return res.json(user);
  } catch (e) {
    console.error('me error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
