import { getBearer, verifySupabaseJWT, ensureUserWithWelcome, supabaseAdmin } from './_helpers'

// Compounding every 5 seconds to match 25%/month
const MONTHLY_RATE = 0.25
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60
const STEP_SECONDS = 5
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS)
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH) // compounding factor per 5s

export default async function handler(req, res){
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const token = getBearer(req)
  const uid = verifySupabaseJWT(token)
  if (!uid) return res.status(401).json({ error: 'unauthorized' })

  const decoded = JSON.parse(Buffer.from((token.split('.')[1]||''), 'base64').toString('utf8') || '{}')
  const email = decoded?.email || ''
  await ensureUserWithWelcome(uid, email)

  const { data: deposits, error } = await supabaseAdmin.from('deposits').select('*').eq('user_id', uid)
  if (error) return res.status(500).json({ error: 'db_error' })

  const now = Date.now() / 1000
  let principal = 0
  let total = 0
  for (const d of deposits || []){
    const t = new Date(d.created_at).getTime() / 1000
    const seconds = Math.max(0, now - t)
    const steps = Math.floor(seconds / STEP_SECONDS)
    principal += Number(d.amount_usat)
    // compound per step
    const grown = Number(d.amount_usat) * Math.pow(FACTOR_PER_STEP, steps)
    total += grown
  }

  const yield_usat = total - principal

  return res.json({
    principal_usat: Number(principal.toFixed(6)),
    yield_usat: Number(yield_usat.toFixed(6)),
    total_usat: Number(total.toFixed(6)),
    rate_monthly: MONTHLY_RATE,
    compounding: { step_seconds: STEP_SECONDS, factor_per_step: Number(FACTOR_PER_STEP.toPrecision(12)) }
  })
}
