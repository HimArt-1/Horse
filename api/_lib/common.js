import crypto from 'node:crypto';

export const EVENT_TYPES = new Set([
  'page_view', 'race_start', 'race_complete', 'contact_phone',
  'contact_whatsapp', 'contact_email', 'sponsorship_open', 'cta_click'
]);
export const COOKIE = 'ehr_admin';
export const SESSION_TTL = 12 * 60 * 60 * 1000;

export function sendJson(res, status, value, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, content] of Object.entries(headers)) res.setHeader(name, content);
  res.end(JSON.stringify(value));
}

export function secureEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

export function digest(value, secret = process.env.ANALYTICS_SALT || process.env.SESSION_SECRET || 'missing-secret', size = 32) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex').slice(0, size);
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

export function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(value => value.length === 2));
}

function sessionSignature(timestamp, userAgent) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(`${timestamp}:${digest(userAgent, process.env.SESSION_SECRET, 16)}`).digest('base64url');
}

export function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return false;
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  const [stamp, signature] = token.split('.');
  const timestamp = Number(stamp);
  if (!timestamp || Date.now() - timestamp > SESSION_TTL || timestamp > Date.now() + 60000) return false;
  return secureEqual(signature, sessionSignature(stamp, req.headers['user-agent'] || ''));
}

export function makeSessionCookie(req) {
  const stamp = String(Date.now());
  const secure = String(req.headers['x-forwarded-proto'] || 'https').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${stamp}.${sessionSignature(stamp, req.headers['user-agent'] || '')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${secure}`;
}

export function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export function cleanText(value, max = 120) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

export function cleanPath(value) {
  const cleaned = cleanText(value, 180).split('?')[0].split('#')[0];
  return cleaned.startsWith('/') ? cleaned : '/';
}

export function country(req) {
  return cleanText(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '', 3).toUpperCase() || '—';
}

export function deviceFrom(userAgent, requested) {
  const ua = String(userAgent || '').toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return ['mobile', 'tablet', 'desktop'].includes(requested) ? requested : 'desktop';
}

function dayKey(ts) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function countBy(items, getter) {
  const map = new Map();
  for (const item of items) { const key = getter(item) || '—'; map.set(key, (map.get(key) || 0) + 1); }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function makeSummary(events, days) {
  const now = Date.now(), period = days * 86400000;
  const current = events.filter(event => event.ts >= now - period);
  const previous = events.filter(event => event.ts >= now - period * 2 && event.ts < now - period);
  const pageViews = current.filter(event => event.type === 'page_view');
  const previousViews = previous.filter(event => event.type === 'page_view');
  const unique = new Set(pageViews.map(event => event.visitor)).size;
  const previousUnique = new Set(previousViews.map(event => event.visitor)).size;
  const sessions = new Set(pageViews.map(event => event.session)).size;
  const daily = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = dayKey(now - offset * 86400000);
    const rows = pageViews.filter(event => dayKey(event.ts) === key);
    daily.push({ date: key, visits: rows.length, visitors: new Set(rows.map(event => event.visitor)).size });
  }
  const eventCounts = Object.fromEntries([...EVENT_TYPES].map(type => [type, current.filter(event => event.type === type).length]));
  const recent = pageViews.slice().sort((a, b) => b.ts - a.ts).slice(0, 40).map(event => ({
    ts: event.ts, visitor: `زائر ${event.visitor.slice(0, 6).toUpperCase()}`, path: event.path,
    device: event.device, source: event.source, country: event.country
  }));
  return {
    generatedAt: now, range: days,
    metrics: { visits: pageViews.length, visitors: unique, sessions, pagesPerSession: sessions ? Number((pageViews.length / sessions).toFixed(1)) : 0, visitChange: percentChange(pageViews.length, previousViews.length), visitorChange: percentChange(unique, previousUnique) },
    daily, devices: countBy(pageViews, event => event.device), sources: countBy(pageViews, event => event.source).slice(0, 8),
    countries: countBy(pageViews, event => event.country).slice(0, 8), pages: countBy(pageViews, event => event.path).slice(0, 10), events: eventCounts, recent
  };
}
