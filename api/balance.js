// /api/balance.js
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')

const MONTHLY_RATE = 0.25
const STEP_SECONDS = 5
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS)
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH)

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

function auth(req) {
  const h = req.headers['authorization'] || ''
  if (!h.startsWith('Bearer ')) return null
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET) } catch { return null }
}

module.exports = async (req, res) => {
  try {
    const user = auth(req)
    if (!user) return res.status(401).json({ error: 'unauthorized' })

    const [dRes, wRes] = await Promise.all([
      pool.query('SELECT amount_usat, created_at FROM deposits WHERE user_id = $1', [user.sub]),
      pool.query('SELECT amount_usat, created_at FROM withdrawals WHERE user_id = $1', [user.sub]),
    ])

    const now = Date.now() / 1000
    let principal = 0
    let total = 0

    for (const d of dRes.rows) {
      const t = new Date(d.created_at).getTime() / 1000
      const steps = Math.max(0, Math.floor((now - t) / STEP_SECONDS))
      const amt = Number(d.amount_usat)
      principal += amt
      total += amt * Math.pow(FACTOR_PER_STEP, steps)
    }

    // Вычитаем выводы (без доходности — считаем как снятие текущего тотала)
    let withdrawn = 0
    for (const w of wRes.rows) withdrawn += Number(w.amount_usat)
    total = Math.max(0, total - withdrawn)

    const accrued = Math.max(0, total - principal)
    return res.json({
      principal_usat: Number(principal.toFixed(2)),
      accrued_usat: Number(accrued.toFixed(2)),
      total_usat: Number(total.toFixed(2)),
    })
  } catch (e) {
    console.error('balance error:', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
