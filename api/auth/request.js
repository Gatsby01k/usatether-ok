// /api/auth/request.js
const { Pool } = require('pg');
const crypto = require('crypto');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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

    // ЛОГ ДЛЯ ПРОВЕРКИ DB
    console.log('Saving token for', email);
    await pool.query(
      `INSERT INTO login_tokens (token, email, expires_at) VALUES ($1,$2,$3)`,
      [token, email, expires]
    );

    const baseUrl =
      (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/$/, '')) ||
      `https://${req.headers.host}`;
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

    console.log('Sending email via Resend to', email);

    const mailRes = await resend.emails.send({
      from: process.env.MAIL_FROM || `USATether <info@usatether.io>`,
      to: email,
      subject: 'USATether — вход по ссылке',
      text: `Нажми, чтобы войти: ${verifyUrl}\nСсылка действует 15 минут.`,
    });

    console.log('Resend response:', mailRes);

    return res.json({ ok: true });
  } catch (err) {
    console.error('auth/request error:', err);
    return res.status(500).json({ error: err?.message || 'server_error' });
  }
};
