import { isAdmin, makeSummary, sendJson } from '../_lib/common.js';
import { loadEventsSince } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
  if (!isAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    const requested = Number(req.query?.days);
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    const events = await loadEventsSince(Date.now() - days * 2 * 86400000);
    return sendJson(res, 200, makeSummary(events, days));
  } catch (error) {
    console.error('admin_summary_failed', error);
    return sendJson(res, 500, { error: 'تعذر تحميل بيانات لوحة التحكم.' });
  }
}
