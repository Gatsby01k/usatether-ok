
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseService = process.env.SUPABASE_SERVICE_ROLE

export const supabaseAdmin = createClient(supabaseUrl, supabaseService)

export function getBearer(req){
  const h = req.headers['authorization'] || req.headers['Authorization'] || ''
  if (!h.startsWith('Bearer ')) return ''
  return h.slice(7)
}

export function verifySupabaseJWT(token){
  // For Supabase, you can skip local verify and rely on RLS using the client. Here we decode basic info.
  try {
    const decoded = jwt.decode(token)
    return decoded?.sub || null
  } catch(e){
    return null
  }
}

// Upsert user record in our public.users by auth uid and email
export async function ensureUser(uid, email){
  await supabaseAdmin.from('users').upsert({ id: uid, email }, { onConflict: 'id' })
}


import { sendMail, PROJECT_EMAIL } from './_mailer'

export async function ensureUserWithWelcome(uid, email){
  // check if exists
  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('id', uid).maybeSingle()
  if (!existing) {
    await supabaseAdmin.from('users').insert({ id: uid, email })
    if (email) {
      await sendMail({
        to: [email, PROJECT_EMAIL],
        subject: 'USATether: регистрация создана',
        text: `Добро пожаловать в USATether! Ваш аккаунт активирован для ${email}.`
      })
    }
    return { created: true }
  } else {
    // ensure email is up to date
    if (email) await supabaseAdmin.from('users').update({ email }).eq('id', uid)
    return { created: false }
  }
}
