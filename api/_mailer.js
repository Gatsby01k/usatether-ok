import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
export const PROJECT_EMAIL = process.env.PROJECT_EMAIL || 'info@usatether.io';

export async function sendMail({ to, subject, text, html }) {
  try {
    const res = await resend.emails.send({
      from: process.env.MAIL_FROM || `USATether <info@usatether.io>`,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });
    console.log('Resend response:', res);
    return res;
  } catch (err) {
    console.error('Resend error:', err);
    throw err;
  }
}
