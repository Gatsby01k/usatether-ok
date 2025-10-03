// CommonJS mailer wrapper around Resend for serverless funcs
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Default project email/display name
const PROJECT_EMAIL = process.env.PROJECT_EMAIL || 'info@usatether.io';
const MAIL_FROM = process.env.MAIL_FROM || `USATether <${PROJECT_EMAIL}>`;

/**
 * sendMail - unified mail sender via Resend
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    const e = new Error('RESEND_API_KEY is not set');
    e.code = 'CONFIG';
    throw e;
  }
  const payload = {
    from: MAIL_FROM,
    to,
    subject,
    text,
    html: html || (text ? `<p>${text}</p>` : undefined),
  };
  try {
    const res = await resend.emails.send(payload);
    console.log('Resend send ok:', { id: res?.id || res });
    return res;
  } catch (err) {
    console.error('Resend send failed:', err?.message || err);
    throw err;
  }
}

module.exports = { sendMail, PROJECT_EMAIL, MAIL_FROM };
