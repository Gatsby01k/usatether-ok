import { getBearer, verifySupabaseJWT, ensureUserWithWelcome, supabaseAdmin } from './_helpers'
import { sendMail, PROJECT_EMAIL } from './_mailer'

export default async function handler(req, res){
  const token = getBearer(req)
  const uid = verifySupabaseJWT(token)
  if (!uid) return res.status(401).json({ error: 'unauthorized' })

  const decoded = JSON.parse(Buffer.from((token.split('.')[1]||''), 'base64').toString('utf8') || '{}')
  const email = decoded?.email || ''

  await ensureUserWithWelcome(uid, email)

  if (req.method === 'GET'){
    const { data, error } = await supabaseAdmin.from('deposits').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: 'db_error' })
    return res.json(data || [])
  }

  if (req.method === 'POST'){
    const { amount } = req.body || {}
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ error: 'bad_amount' })
    const { data, error } = await supabaseAdmin.from('deposits').insert({ user_id: uid, amount_usat: amt }).select('*').single()
    if (error) return res.status(500).json({ error: 'db_error' })

    // email both user and project inbox
    if (email) {
      await sendMail({
        to: [email, PROJECT_EMAIL],
        subject: 'USATether: депозит создан',
        text: `Мы зафиксировали депозит на сумму ${amt.toFixed(2)} USA₮. Спасибо!`
      })
    }

    return res.json(data)
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
