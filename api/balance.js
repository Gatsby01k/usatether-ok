// /api/balance.js — Vercel serverless (CommonJS)

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// === compounding every 5s to match 25%/month ===
const MONTHLY_RATE = 0.25;
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60;
const STEP_SECONDS = 5;
const STEPS_PER_MONTH = Math.floor(SECONDS_IN_MONTH / STEP_SECONDS);
const FACTOR_PER_STEP = Math.pow(1 + MONTHLY_RATE, 1 / STEPS_PER_MONTH); // per 5s

// DB pool (Neon)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// auth helper
function requireAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) throw new Error('unauthorized');
  return jwt.verify(h.slice(7), process.env.JWT_SECRET); // -> { sub, email }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { sub: userId } = requireAuth(req);

    // получаем депозиты пользователя
    const { rows: deposits } = await pool.query(
      `SELECT amount_usat, created_at
         FROM deposits
        WHERE user_id = $1`,
      [userId]
    );

    const now = Date.now() / 1000;
    let principal = 0;
    let total = 0;

    for (const d of deposits || []) {
      const t = new Date(d.created_at).getTime() / 1000;
      const seconds = Math.max(0, now - t);
      const steps = Math.floor(seconds / STEP_SECONDS);
      const amt = Number(d.amount_usat);
      principal += amt;

      // compound per 5s step
      const grown = amt * Math.pow(FACTOR_PER_STEP, steps);
      total += grown;
    }

    const yield_usat = total - principal;

    return res.json({
      principal_usat: Number(principal.toFixed(6)),
      yield_usat: Number(yield_usat.toFixed(6)),
      total_usat: Number(total.toFixed(6)),
      rate_monthly: MONTHLY_RATE,
      compounding: {
        step_seconds: STEP_SECONDS,
        factor_per_step: Number(FACTOR_PER_STEP.toPrecision(12)),
      },
    });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.message === 'unauthorized') {
      return res.status(401).json({ error: 'unauthorized' });
    }
    console.error('balance error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
