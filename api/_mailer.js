import { Resend } from 'resend'

const resendKey = process.env.RESEND_API_KEY
export const PROJECT_EMAIL = process.env.PROJECT_EMAIL || 'info@usatether.io'
export const RESEND_FROM = process.env.RESEND_FROM || `USATether <${PROJECT_EMAIL}>`

let resend = null
if (resendKey) {
  resend = new Resend(resendKey)
}

export async function sendMail({ to, subject, text, html }){
  if (!resend) return { skipped: true, reason: 'No RESEND_API_KEY' }
  try {
    const r = await resend.emails.send({
      from: RESEND_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || '',
      html: html || `<p>${(text||'').replace(/\n/g,'<br/>')}</p>`
    })
    return { ok: true, id: r?.data?.id || null }
  } catch (e){
    return { ok: false, error: e?.message || String(e) }
  }
}
