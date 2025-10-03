const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendMail } = require('../_mailer.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/,'');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { email, password } = req.body || {};
    const em = normalizeEmail(email);
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'weak_password' });
    }

    const hash = await bcrypt.hash(password, 12);

    // создаём/обновляем пользователя, отмечаем НЕ подтверждённым
    const up = await pool.query(
      `INSERT INTO users(email, password_hash, password_set_at, is_verified)
       VALUES ($1,$2,now(),FALSE)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             password_set_at = EXCLUDED.password_set_at,
             is_verified = FALSE
       RETURNING id, email, is_verified`,
      [em, hash]
    );
    const user = up.rows[0];

    // токен подтверждения
    await pool.query('DELETE FROM email_verification_codes WHERE user_id=$1', [user.id]);
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 24*60*60*1000); // 24h
    await pool.query(
      'INSERT INTO email_verification_codes(user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expires]
    );

    const verifyUrl = `${baseUrl(req)}/api/auth/verify-email?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your USATether account',
      text: `Click to verify: ${verifyUrl}`,
      html: `<p>Welcome to USATether!</p>
             <p><a href="${verifyUrl}" target="_blank" rel="noopener">Verify your account</a></p>
             <p>Link valid for 24 hours.</p>`
    });

    // JWT НЕ выдаём: сначала подтверждение
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('auth/register error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
