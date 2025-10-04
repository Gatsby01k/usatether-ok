// /api/index.js — единый роутер под Vercel
// Зависимости: pg, jsonwebtoken, bcryptjs
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const url = require('url')

// -------- DB --------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon/Vercel
})

// кэш инициализации схемы, чтобы не гонять CREATE TABLE каждый вызов
let __initPromise = null

async function ensureSchema() {
  // Важно: генерилка UUID из pgcrypto (на Neon's OK)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `)

  // Явный индекс на lower(email), чтобы регистр не имел значения
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_lower_key'
      ) THEN
        CREATE UNIQUE INDEX users_email_lower_key ON users ((lower(email)));
      END IF;
    END$$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_usat NUMERIC(18,2) NOT NULL CHECK (amount_usat > 0),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_usat NUMERIC(18,2) NOT NULL CHECK (amount_usat > 0),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'deposits_user_created_idx'
      ) THEN
        CREATE INDEX deposits_user_created_idx ON deposits(user_id, created_at DESC);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'withdrawals_user_created_idx'
      ) THEN
        CREATE INDEX withdrawals_user_created_idx ON withdrawals(user_id, created_at DESC);
      END IF;
    END$$;
  `)
}

// -------- util --------
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

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} not set`)
  return v
}

function sign(payload) {
  return jwt.sign(payload, requireEnv('JWT_SECRET'), { expiresIn: '7d' })
}

function auth(req) {
  const h = req.headers['authorization'] || ''
  if (!h.startsWith('Bearer ')) return null
  try { return jwt.verify(h.slice(7).trim(), requireEnv('JWT_SECRET')) } catch { return null }
}

// -------- доходность --------
const MONTHLY_RATE = 0.25
const STEP_SECONDS = 5
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS)
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH)

// -------- handlers --------
async function health(req, res) { return send(res, 200, { ok: true }) }

async function authRegister(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const b = await parseBody(req)
  const email = String(b.email || '').toLowerCase().trim()
  const password = String(b.password || '')
  if (!email || password.length < 8) return send(res, 400, { error: 'bad_input', hint: 'password_min_8' })

  const exists = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email])
  if (exists.rows.length) return send(res, 409, { error: 'email_taken' })

  const hash = await bcrypt.hash(password, 10)
  const ins = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
    [email, hash]
  )
  const { id } = ins.rows[0]
  const token = sign({ sub: id, email })
  return send(res, 200, { token, user: { id, email } })
}

async function authLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const b = await parseBody(req)
  const email = String(b.email || '').toLowerCase().trim()
  const password = String(b.password || '')
  if (!email || !password) return send(res, 400, { error: 'bad_input' })

  const r = await pool.query('SELECT id, email, password_hash FROM users WHERE lower(email)=lower($1) LIMIT 1', [email])
  if (!r.rows.length) return send(res, 401, { error: 'invalid_credentials' })
  const ok = await bcrypt.compare(password, r.rows[0].password_hash || '')
  if (!ok) return send(res, 401, { error: 'invalid_credentials' })

  const token = sign({ sub: r.rows[0].id, email: r.rows[0].email })
  return send(res, 200, { token, user: { id: r.rows[0].id, email: r.rows[0].email } })
}

async function me(req, res, user) {
  const r = await pool.query('SELECT email FROM users WHERE id=$1 LIMIT 1', [user.sub])
  return send(res, 200, { id: user.sub, email: r.rows?.[0]?.email || user.email || null })
}

async function balance(req, res, user) {
  const [dRes, wRes] = await Promise.all([
    pool.query('SELECT amount_usat, created_at FROM deposits WHERE user_id=$1', [user.sub]),
    pool.query('SELECT amount_usat, created_at FROM withdrawals WHERE user_id=$1', [user.sub]),
  ])
  const now = Date.now() / 1000
  let principal = 0, total = 0
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

async function deposits(req, res, user) {
  if (req.method === 'GET') {
    const r = await pool.query(
      'SELECT id, amount_usat, created_at FROM deposits WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const b = await parseBody(req)
    const amount = Number(b.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    await pool.query('INSERT INTO deposits (user_id, amount_usat) VALUES ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

async function withdrawals(req, res, user) {
  if (req.method === 'GET') {
    const r = await pool.query(
      'SELECT id, amount_usat, created_at FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',
      [user.sub]
    )
    return send(res, 200, { items: r.rows })
  }
  if (req.method === 'POST') {
    const b = await parseBody(req)
    const amount = Number(b.amount_usat)
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'bad_amount' })
    await pool.query('INSERT INTO withdrawals (user_id, amount_usat) VALUES ($1, $2)', [user.sub, amount])
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'method_not_allowed' })
}

// -------- router --------
module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 200, { ok: true })

    if (!__initPromise) __initPromise = ensureSchema()
    await __initPromise

    // Достаём путь после /api/ (поддержка и rewrite, и прямого вызова)
    const parsed = url.parse(req.url, true)
    let path = parsed.query.path
      || req.headers['x-forwarded-uri']
      || req.headers['x-vercel-pathname']
      || parsed.pathname
      || ''

    if (path.startsWith('/')) path = path.slice(1)
    if (path.startsWith('api/')) path = path.slice(4)
    path = path.replace(/\/+$/, '') // убрать хвостовой слэш

    // Алиасы, чтобы совпасть со старым фронтом
    const publicMap = {
      '': health,
      'health': health,
      'auth/register': authRegister,
      'auth/signup': authRegister,
      'signup': authRegister,
      'auth/request': authRegister, // старый маршрут — считаем регистрацией
      'auth/login': authLogin,
      'login': authLogin,
      'auth/email-login': authLogin, // вдруг такой был
    }

    if (publicMap[path]) return await publicMap[path](req, res)

    // приватка
    const user = auth(req)
    if (!user) return send(res, 401, { error: 'unauthorized' })

    const privateMap = {
      'me': me,
      'balance': balance,
      'deposits': deposits,
      'withdrawals': withdrawals,
    }
    if (privateMap[path]) return await privateMap[path](req, res, user)

    return send(res, 404, { error: 'not_found', path })
  } catch (e) {
    console.error('API error:', e)
    // отдаём человекочитаемую причину
    return send(res, 500, { error: 'server_error', reason: String(e && e.message || e) })
  }
}
