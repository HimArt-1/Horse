import crypto from 'node:crypto';
import {
  EVENT_TYPES,
  bodyOf,
  cleanPath,
  cleanText,
  clientIp,
  country,
  deviceFrom,
  digest,
  sendJson
} from '../_lib/common.js';
import { countRecentEvents, insertEvent } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });

  try {
    const body = bodyOf(req);
    const type = cleanText(body.type, 40);
    if (!EVENT_TYPES.has(type)) return sendJson(res, 400, { error: 'Invalid event type' });

    const userAgent = cleanText(req.headers['user-agent'], 320);
    const visitor = digest(`${clientIp(req)}:${userAgent}`, process.env.ANALYTICS_SALT, 32);
    if (await countRecentEvents(visitor, Date.now() - 60000) >= 120) {
      return sendJson(res, 429, { error: 'Too many events' });
    }

    const requestedSession = cleanText(body.session, 64);
    const session = /^[a-zA-Z0-9-]{8,64}$/.test(requestedSession)
      ? requestedSession
      : digest(crypto.randomUUID(), process.env.ANALYTICS_SALT, 24);
    const durationValue = Number(body.duration);

    await insertEvent({
      id: crypto.randomUUID(),
      ts: Date.now(),
      type,
      path: cleanPath(body.path),
      session,
      visitor,
      device: deviceFrom(userAgent, cleanText(body.device, 20)),
      source: cleanText(body.source, 80) || 'direct',
      referrer: cleanText(body.referrer, 260),
      country: country(req),
      utm: cleanText(body.utm, 160),
      outcome: cleanText(body.outcome, 80),
      duration: Number.isFinite(durationValue) ? Math.max(0, Math.min(Math.round(durationValue), 86400000)) : null
    });

    res.statusCode = 204;
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  } catch (error) {
    console.error('analytics_event_failed', error);
    return sendJson(res, 500, { error: 'Analytics service unavailable' });
  }
}
