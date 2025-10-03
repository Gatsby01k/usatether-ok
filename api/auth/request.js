// /api/auth/request.js
const crypto = require('crypto');
const { sendMail, MAIL_FROM } = require('../_mailer.js');

let pool; // lazy to avoid module-level crashes
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

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const pool = getPool();

    // 1) upsert user
    const u = await pool.query(
      `INSERT INTO users (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      [email.toLowerCase()]
    );
    const user = u.rows[0];

    // 2) generate token and store
    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 min
    await pool.query(
      `INSERT INTO auth_codes (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    // 3) magic link
    const baseURL = process.env.PUBLIC_BASE_URL || 'https://usatether.io';
    const verifyURL = `${baseURL}/#/login?token=${token}`;

    // 4) send email via unified Resend
    const subject = 'Your USATether sign-in link';
    const html = `<p>Hello,</p>
<p>Click the button below to sign in:</p>
<p><a href="${verifyURL}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#000;color:#fff;text-decoration:none">Sign in</a></p>
<p>Or open this link: <br/><a href="${verifyURL}">${verifyURL}</a></p>
<p>This link will expire in 15 minutes.</p>
<p>— ${MAIL_FROM}</p>`;

    try {
      await sendMail({ to: email, subject, html, text: `Sign in: ${verifyURL}` });
    } catch (mailErr) {
      console.error('sendMail error:', mailErr);
      // Upstream failure → 502, чтобы отличать от наших 500
      return res.status(502).json({ error: 'mail_failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('auth/request fatal:', err);
    return res.status(500).json({ error: err?.message || 'server_error' });
  }
};
