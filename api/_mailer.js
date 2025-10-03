const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendMail({ to, subject, text, html, from }) {
  const fromAddr = from || process.env.MAIL_FROM || 'USATether <info@usatether.io>';
  await resend.emails.send({
    from: fromAddr,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
