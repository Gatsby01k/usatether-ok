// /api/index.js
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const url = require('url')

// === ENV ===
// DATABASE_URL (Neon, sslmode=require), JWT_SECRET
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// === Utils ===
function send(res, code, data) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // CORS (на случай если дергаешь API с другого origin)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.end(JSON.stringify(data))
}

function auth(req) {
  const h = req.headers['authorization'] || ''
  if (!h.startsWith('Bearer ')) return null
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET) } catch { return null }
}

async function parseBody(req) {
  return await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => {
      if (!data) return resolve({})
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// ==== Domain logic: balance calc ====
const MONTHLY_RATE = 0.25
const STEP_SECONDS = 5
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS)
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH)

async function handleMe(req, res, user) {
  // Можно достать имейл из users
  const r = await pool.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [user.sub])
  return send(res, 200, { id: user.sub, email: r.rows?.[0]?.email || null })
}

async function handleBalance(req, res, user) {
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
  let withdrawn = 0
  for (const w of wRes.rows) withdrawn += Number(w.amount_usat)
  total = Math.max(0, total - withdrawn)
  const accrued = Math.max(0, total - principal)
  return send(res, 200, {
    principal_usat: Number(principal.toFixed(2)),
    accrued_usat: Number(accrued.toFixed(2)),
    total_usat: Number(total.toFixed(2)),
  })
}

async function handleDeposits(req, res, user) {
  if (req.method === 'GET') {
    const r = await pool.query(
      'SELECT id, amount_usat, created_at FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const amount = Number(body.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    await pool.query('INSERT INTO deposits (user_id, amount_usat) VALUES ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

async function handleWithdrawals(req, res, user) {
  if (req.method === 'GET') {
    const r = await pool.query(
      'SELECT id, amount_usat, created_at FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const amount = Number(body.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    // тут можно проверять доступный баланс и лимиты
    await pool.query('INSERT INTO withdrawals (user_id, amount_usat) VALUES ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

// === Exported handler ===
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true })

  const { pathname } = url.parse(req.url)
  // pathname e.g. "/api/balance" → берем часть после "/api/"
  const p = pathname.replace(/^\/+/, '')
  const afterApi = p.startsWith('api/') ? p.slice(4) : p

  // public (без токена) — если нужно, добавляй тут
  if (afterApi === '' || afterApi === 'health') return send(res, 200, { ok: true })

  // auth
  const user = auth(req)
  if (!user) return send(res, 401, { error: 'unauthorized' })

  try {
    switch (afterApi) {
      case 'me':            return await handleMe(req, res, user)
      case 'balance':       return await handleBalance(req, res, user)
      case 'deposits':      return await handleDeposits(req, res, user)
      case 'withdrawals':   return await handleWithdrawals(req, res, user)
      default:
        return send(res, 404, { error: 'not_found', path: afterApi })
    }
  } catch (e) {
    console.error('API error:', e)
    return send(res, 500, { error: 'server_error' })
  }
}
