import { COOKIE, sendJson } from '../_lib/common.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
  return sendJson(res, 200, { ok: true }, {
    'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`
  });
}
