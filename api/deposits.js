// /api/deposits.js  — Vercel serverless (CommonJS)

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// --- DB pool (Neon) ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- helpers ---
function requireAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) throw new Error('unauthorized');
  return jwt.verify(h.slice(7), process.env.JWT_SECRET); // { sub, email }
}

async function sendMail({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465, // true для 465 (SSL)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `USATether <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

// --- handler ---
module.exports = async (req, res) => {
  try {
    const user = requireAuth(req); // { sub: user_id, email }
    const userId = user.sub;
    const email = user.email || '';

    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT id, amount_usat, created_at
           FROM deposits
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 100`,
        [userId]
      );
      return res.json(rows || []);
    }

    if (req.method === 'POST') {
      const { amount, amount_usat } = req.body || {};
      const amt = Number(amount ?? amount_usat);
      if (!amt || amt <= 0) return res.status(400).json({ error: 'bad_amount' });

      const insert = await pool.query(
        `INSERT INTO deposits (user_id, amount_usat)
         VALUES ($1, $2)
         RETURNING id, user_id, amount_usat, created_at`,
        [userId, amt]
      );
      const row = insert.rows[0];

      // письмо пользователю и на проектную почту (если указана)
      const projectEmail = process.env.PROJECT_EMAIL || '';
      const recipients = [email, projectEmail].filter(Boolean).join(', ');
      if (recipients) {
        await sendMail({
          to: recipients,
          subject: 'USATether: депозит создан',
          text: `Мы зафиксировали депозит на сумму ${amt.toFixed(2)} USA₮. Спасибо!`,
        });
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
