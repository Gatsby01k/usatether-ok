import { getBearer, verifySupabaseJWT, ensureUserWithWelcome, supabaseAdmin } from './_helpers'

export default async function handler(req, res){
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const token = getBearer(req)
  const uid = verifySupabaseJWT(token)
  if (!uid) return res.status(401).json({ error: 'unauthorized' })

  const decoded = JSON.parse(Buffer.from((token.split('.')[1]||''), 'base64').toString('utf8') || '{}')
  const email = decoded?.email || ''

  await ensureUserWithWelcome(uid, email)
  const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', uid).single()

  return res.json({ id: user.id, email: user.email, name: user.name || '', kyc_status: 'pending' })
}
