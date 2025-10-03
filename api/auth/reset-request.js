const { Pool } = require('pg');
const crypto = require('crypto');
const { sendMail } = require('../_mailer.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const em = normalizeEmail(req.body?.email);
    if (!em) return res.status(200).json({ ok: true }); // не раскрываем

    const u = await pool.query('SELECT id, email FROM users WHERE email=$1 LIMIT 1', [em]);
    const user = u.rows[0];
    if (!user) return res.status(200).json({ ok: true }); // не выдаём существование

    // гасим старые, создаём новый
    await pool.query('DELETE FROM password_reset_codes WHERE user_id=$1', [user.id]);
    const token   = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 час

    await pool.query(
      'INSERT INTO password_reset_codes(user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expires]
    );

    const resetUrl = `${baseUrl(req)}/#/reset?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'USATether — password reset',
      text: `To reset your password, open: ${resetUrl}`,
      html: `<p>Reset your password:</p>
             <p><a href="${resetUrl}" target="_blank" rel="noopener">Set new password</a></p>
             <p>This link will expire in 1 hour.</p>`
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('reset-request error', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
