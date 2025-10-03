// CommonJS mailer wrapper around Resend for serverless funcs
let resend; // ← ленивое создание после первого вызова

const PROJECT_EMAIL = process.env.PROJECT_EMAIL || 'info@usatether.io';
const MAIL_FROM = process.env.MAIL_FROM || `USATether <${PROJECT_EMAIL}>`;

function getResend() {
  if (!resend) {
    // импортируем и создаём экземпляр только при реальной отправке
    const { Resend } = require('resend');
    const key = process.env.RESEND_API_KEY || '';
    // сам по себе конструктор теперь не завалит импорт модуля, даже если ключ пустой
    resend = new Resend(key);
  }
  return resend;
}

/**
 * sendMail - unified mail sender via Resend
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 */
async function sendMail({ to, subject, text, html }) {
  // Явно проверим конфиг — вернём понятную ошибку, а не упадём на импорте
  if (!process.env.RESEND_API_KEY) {
    const e = new Error('mail_config_missing');
    e.details = 'RESEND_API_KEY is not set';
    e.code = 'CONFIG';
    throw e;
  }

  const client = getResend();
  const payload = {
    from: MAIL_FROM,
    to,
    subject,
    text,
    html: html || (text ? `<p>${text}</p>` : undefined),
  };
  try {
    const res = await client.emails.send(payload);
    console.log('Resend send ok:', { id: res?.id || res });
    return res;
  } catch (err) {
    console.error('Resend send failed:', err?.message || err);
    throw err;
  }
}

module.exports = { sendMail, PROJECT_EMAIL, MAIL_FROM };
