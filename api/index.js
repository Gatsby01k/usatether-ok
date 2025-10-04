// /api/index.js
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const url = require('url')

// ---------- ENV & DB ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon/Vercel
})

// ---------- helpers ----------
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

function send(res, code, data) {
  res.statusCode = code
  cors(res)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data ?? {}))
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

function sign(payload) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set')
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function auth(req) {
  const h = req.headers['authorization'] || ''
  if (!h.startsWith('Bearer ')) return null
  try {
    return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET)
  } catch {
    return null
  }
}

// ---------- balance math ----------
const MONTHLY_RATE = 0.25
const STEP_SECONDS = 5
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS)
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH)

// ---------- handlers ----------
async function handleHealth(req, res) {
  return send(res, 200, { ok: true })
}

async function handleAuthRegister(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const body = await parseBody(req)
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')
  if (!email || !password || password.length < 6) return send(res, 400, { error: 'bad_input' })

  const exists = await pool.query('select id from users where lower(email)=lower($1) limit 1', [email])
  if (exists.rows.length) return send(res, 409, { error: 'email_taken' })

  const hash = await bcrypt.hash(password, 10)
  const ins = await pool.query(
    `insert into users (email, password_hash) values ($1, $2)
     returning id, email`,
    [email, hash]
  )
  const { id } = ins.rows[0]
  const token = sign({ sub: id, email })
  return send(res, 200, { token, user: { id, email } })
}

async function handleAuthLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const body = await parseBody(req)
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')
  if (!email || !password) return send(res, 400, { error: 'bad_input' })

  const r = await pool.query('select id, email, password_hash from users where lower(email)=lower($1) limit 1', [email])
  if (!r.rows.length) return send(res, 401, { error: 'invalid_credentials' })

  const ok = await bcrypt.compare(password, r.rows[0].password_hash || '')
  if (!ok) return send(res, 401, { error: 'invalid_credentials' })

  const token = sign({ sub: r.rows[0].id, email: r.rows[0].email })
  return send(res, 200, { token, user: { id: r.rows[0].id, email: r.rows[0].email } })
}

async function handleMe(req, res, user) {
  const r = await pool.query('select email from users where id=$1 limit 1', [user.sub])
  return send(res, 200, { id: user.sub, email: r.rows?.[0]?.email || user.email || null })
}

async function handleBalance(req, res, user) {
  const [dRes, wRes] = await Promise.all([
    pool.query('select amount_usat, created_at from deposits where user_id=$1', [user.sub]),
    pool.query('select amount_usat, created_at from withdrawals where user_id=$1', [user.sub]),
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
      'select id, amount_usat, created_at from deposits where user_id=$1 order by created_at desc limit 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const amount = Number(body.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    await pool.query('insert into deposits (user_id, amount_usat) values ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

async function handleWithdrawals(req, res, user) {
  if (req.method === 'GET') {
    const r = await pool.query(
      'select id, amount_usat, created_at from withdrawals where user_id=$1 order by created_at desc limit 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const amount = Number(body.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    // здесь можно добавить проверку доступного баланса/лимитов
    await pool.query('insert into withdrawals (user_id, amount_usat) values ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

// ---------- router ----------
module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 200, { ok: true })

    // Получаем путь после /api/
    const parsed = url.parse(req.url, true)
    // поддержка варианта rewrite с ?path=$1
    let path = parsed.query.path
      || req.headers['x-forwarded-uri']
      || req.headers['x-vercel-pathname']
      || parsed.pathname
      || ''

    // нормализуем
    if (path.startsWith('/')) path = path.slice(1)
    if (path.startsWith('api/')) path = path.slice(4)
    path = path.replace(/^index\.js$/, '') // если вдруг пришло /api/index.js

    // публичные
    if (path === '' || path === 'health') return await handleHealth(req, res)
    if (path === 'auth/register') return await handleAuthRegister(req, res)
    if (path === 'auth/login') return await handleAuthLogin(req, res)

    // приватные
    const user = auth(req)
    if (!user) return send(res, 401, { error: 'unauthorized' })

    switch (path) {
      case 'me':            return await handleMe(req, res, user)
      case 'balance':       return await handleBalance(req, res, user)
      case 'deposits':      return await handleDeposits(req, res, user)
      case 'withdrawals':   return await handleWithdrawals(req, res, user)
      default:              return send(res, 404, { error: 'not_found', path })
    }
  } catch (e) {
    console.error('API error:', e)
    return send(res, 500, { error: 'server_error' })
  }
}
