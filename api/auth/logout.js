// /api/auth/logout.js
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    res.setHeader('Set-Cookie', [
      'jwt=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
