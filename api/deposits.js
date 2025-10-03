// /api/deposits.js  — Vercel serverless (CommonJS)

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { sendMail, PROJECT_EMAIL } = require('./_mailer.js');

// --- DB pool (Neon) ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- helpers ---
function requireAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) throw new Error('unauthorized');
  return jwt.verify(h.slice(7), process.env.JWT_SECRET); // { sub, email }
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const auth = requireAuth(req);
      const r = await pool.query(
        'SELECT id, amount, currency, status, created_at FROM deposits WHERE user_id=$1 ORDER BY created_at DESC',
        [auth.sub]
      );
      return res.json({ items: r.rows });
    }

    if (req.method === 'POST') {
      const auth = requireAuth(req);
      const { amount, currency } = req.body || {};
      if (!amount || !currency) return res.status(400).json({ error: 'bad_request' });

      const i = await pool.query(
        'INSERT INTO deposits (user_id, amount, currency, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [auth.sub, amount, currency, 'pending']
      );
      const row = i.rows[0];

      // Notify project email about new deposit via Resend (non-blocking for client)
      try {
        await sendMail({
          to: PROJECT_EMAIL,
          subject: 'New deposit created',
          text: `User ${auth.email} created a deposit: ${amount} ${currency} (id ${row.id}).`
        });
      } catch (e) {
        console.error('deposit notify mail failed:', e?.message || e);
      }

      return res.json(row);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.message === 'unauthorized') {
      return res.status(401).json({ error: 'unauthorized' });
    }
    console.error('deposits error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
