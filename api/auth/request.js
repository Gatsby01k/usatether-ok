// Serverless-функция Vercel: POST /api/auth/request
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

    // генерим токен на 15 минут
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO login_tokens (token, email, expires_at) VALUES ($1,$2,$3)`,
      [token, email, expires]
    );

    const baseUrl =
      process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ||
      `https://${req.headers.host}`;
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465, // true для 465 (SSL)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `USATether <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'USATether — вход по ссылке',
      text: `Нажми, чтобы войти: ${verifyUrl}\nСсылка действует 15 минут.`,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('auth/request error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
