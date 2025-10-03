const { Pool } = require('pg');
const crypto = require('crypto');
const { sendMail } = require('../_mailer.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}
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
    const em = normalizeEmail(req.body?.email);
    if (!em) return res.status(400).json({ error: 'bad_request' });

    const r = await pool.query('SELECT id, email, is_verified FROM users WHERE email=$1 LIMIT 1', [em]);
    const u = r.rows[0];
    if (!u) return res.status(200).json({ ok: true }); // не раскрываем

    if (u.is_verified) return res.status(200).json({ ok: true });

    // удалить старые токены, создать новый
    await pool.query('DELETE FROM email_verification_codes WHERE user_id=$1', [u.id]);
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 24*60*60*1000); // 24h
    await pool.query(
      'INSERT INTO email_verification_codes(user_id, token, expires_at) VALUES ($1,$2,$3)',
      [u.id, token, expires]
    );

    const verifyUrl = `${baseUrl(req)}/api/auth/verify-email?token=${token}`;
    await sendMail({
      to: u.email,
      subject: 'Verify your USATether account',
      text: `Click the link to verify your email: ${verifyUrl}`,
      html: `<p>Confirm your email:</p>
             <p><a href="${verifyUrl}" target="_blank" rel="noopener">Verify account</a></p>
             <p>This link is valid for 24 hours.</p>`
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('resend-verification error', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
