import {
  bodyOf,
  clientIp,
  digest,
  makeSessionCookie,
  secureEqual,
  sendJson
} from '../_lib/common.js';
import { clearLoginAttempts, registerLoginAttempt } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || !process.env.DATABASE_URL) {
    return sendJson(res, 503, { error: 'Dashboard is not configured' });
  }

  try {
    const key = digest(clientIp(req), process.env.SESSION_SECRET, 24);
    const attempts = await registerLoginAttempt(key, Date.now());
    if (attempts > 6) return sendJson(res, 429, { error: 'محاولات كثيرة. حاول بعد 15 دقيقة.' });

    if (!secureEqual(bodyOf(req).password, process.env.ADMIN_PASSWORD)) {
      return sendJson(res, 401, { error: 'كلمة المرور غير صحيحة.' });
    }

    await clearLoginAttempts(key);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': makeSessionCookie(req) });
  } catch (error) {
    console.error('admin_login_failed', error);
    return sendJson(res, 500, { error: 'تعذر تسجيل الدخول الآن.' });
  }
}
