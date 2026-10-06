import { checkPassword, sessionCookie, clearCookie, configured } from './_auth.js';

// POST /api/login  {password}  -> sets session cookie
// DELETE /api/login            -> logout
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!configured()) return res.status(500).json({ error: 'APP_PASSWORD is not set on the server' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!checkPassword(body && body.password)) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return res.status(401).json({ error: 'bad password' });
  }
  res.setHeader('Set-Cookie', sessionCookie());
  return res.status(200).json({ ok: true });
}
