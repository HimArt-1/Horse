import { isAdmin, sendJson } from '../_lib/common.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
  return sendJson(res, 200, {
    authenticated: isAdmin(req),
    configured: Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET && process.env.DATABASE_URL)
  });
}
