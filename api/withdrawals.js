// /api/withdrawals.js
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')

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

    if (req.method === 'GET') {
      const r = await pool.query(
        'SELECT id, amount_usat, created_at FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
        [user.sub]
      )
      return res.json({ items: r.rows })
    }

    if (req.method === 'POST') {
      const { amount_usat } = req.body || {}
      const amount = Number(amount_usat)
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'bad_amount' })

      // тут можно проверить достаточно ли средств, комиссию и лимиты
      await pool.query(
        'INSERT INTO withdrawals (user_id, amount_usat) VALUES ($1, $2)',
        [user.sub, amount]
      )
      return res.json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  } catch (e) {
    console.error('withdrawals error:', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
