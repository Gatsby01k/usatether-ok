// Serverless-функция Vercel: GET /api/me
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    return res.json({ id: payload.sub, email: payload.email });
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
};
