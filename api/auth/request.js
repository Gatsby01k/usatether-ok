// /api/auth/request.js
const crypto = require('crypto');
const { Resend } = require('resend');

let pool; // ленивое создание, чтобы не падать на уровне модуля
function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    const cs = process.env.DATABASE_URL;
    if (!cs || !/^postgres/i.test(cs)) {
      throw new Error('DATABASE_URL is invalid or empty');
    }
    pool = new Pool({ connectionString: cs });
  }
  return pool;
}

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { email } = req.body || {};
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: 'email_required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // --- DB insert ---
    try {
      const p = getPool();
      await p.query(
        'INSERT INTO login_tokens (token, email, expires_at) VALUES ($1,$2,$3)',
        [token, email, expires]
      );
    } catch (dbErr) {
      console.error('DB error:', dbErr);
      return res.status(500).json({ error: dbErr.message || 'db_error' });
    }

    // --- verify URL ---
    const base =
      (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/$/, '')) ||
      `https://${req.headers.host}`;
    const verifyUrl = `${base}/api/auth/verify?token=${token}`;

    // --- send email via Resend ---
    try {
      const mailFrom = process.env.MAIL_FROM || 'USATether <info@usatether.io>';
      const sendRes = await resend.emails.send({
        from: mailFrom,
        to: email,
        subject: 'USATether — вход по ссылке',
        text: `Нажми, чтобы войти: ${verifyUrl}\nСсылка действует 15 минут.`
      });
      // опционально лог:
      console.log('Resend ok:', sendRes?.id || sendRes);
    } catch (mailErr) {
      console.error('Resend error:', mailErr);
      return res.status(500).json({ error: mailErr?.message || 'mail_error' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('auth/request fatal:', err);
    return res.status(500).json({ error: err?.message || 'server_error' });
  }
};
