import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4344);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '.data'));
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_PASSWORD;
const ANALYTICS_SALT = process.env.ANALYTICS_SALT || SESSION_SECRET || 'local-analytics-only';
const COOKIE = 'ehr_admin';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_EVENTS = 50000;
const failedLogins = new Map();
const eventRate = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ version: 1, events: [] }));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
const EVENT_TYPES = new Set([
  'page_view', 'race_start', 'race_complete', 'contact_phone',
  'contact_whatsapp', 'contact_email', 'sponsorship_open', 'cta_click'
]);

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function digest(value, size = 32) {
  return crypto.createHmac('sha256', ANALYTICS_SALT).update(String(value)).digest('hex').slice(0, size);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2));
}

function sessionSignature(timestamp, userAgent) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(`${timestamp}:${digest(userAgent, 16)}`).digest('base64url');
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD || !SESSION_SECRET) return false;
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  const [stamp, signature] = token.split('.');
  const timestamp = Number(stamp);
  if (!timestamp || Date.now() - timestamp > SESSION_TTL || timestamp > Date.now() + 60000) return false;
  return safeEqual(signature, sessionSignature(stamp, req.headers['user-agent'] || ''));
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > limit) reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(Object.assign(new Error('invalid_json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function loadStore() {
  try {
    const value = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(value.events) ? value : { version: 1, events: [] };
  } catch { return { version: 1, events: [] }; }
}

function saveStore(store) {
  if (store.events.length > MAX_EVENTS) store.events = store.events.slice(-MAX_EVENTS);
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store));
  fs.renameSync(temp, DATA_FILE);
}

function cleanText(value, max = 120) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function cleanPath(value) {
  const cleaned = cleanText(value, 180).split('?')[0].split('#')[0];
  return cleaned.startsWith('/') ? cleaned : '/';
}

function country(req) {
  return cleanText(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '', 3).toUpperCase() || '—';
}

function deviceFrom(userAgent, requested) {
  const ua = String(userAgent || '').toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return ['mobile', 'tablet', 'desktop'].includes(requested) ? requested : 'desktop';
}

function allowRate(map, key, max, windowMs) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now - current.start > windowMs) { map.set(key, { start: now, count: 1 }); return true; }
  current.count += 1;
  return current.count <= max;
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
  for (const item of items) {
    const key = getter(item) || '—';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function summary(events, days) {
  const now = Date.now();
  const period = days * 86400000;
  const current = events.filter(e => e.ts >= now - period);
  const previous = events.filter(e => e.ts >= now - period * 2 && e.ts < now - period);
  const pageViews = current.filter(e => e.type === 'page_view');
  const previousViews = previous.filter(e => e.type === 'page_view');
  const unique = new Set(pageViews.map(e => e.visitor)).size;
  const previousUnique = new Set(previousViews.map(e => e.visitor)).size;
  const sessions = new Set(pageViews.map(e => e.session)).size;
  const daily = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now - offset * 86400000);
    const key = dayKey(date);
    const rows = pageViews.filter(e => dayKey(e.ts) === key);
    daily.push({ date: key, visits: rows.length, visitors: new Set(rows.map(e => e.visitor)).size });
  }
  const eventCounts = Object.fromEntries([...EVENT_TYPES].map(type => [type, current.filter(e => e.type === type).length]));
  const recent = pageViews.slice().sort((a, b) => b.ts - a.ts).slice(0, 40).map(e => ({
    ts: e.ts, visitor: `زائر ${e.visitor.slice(0, 6).toUpperCase()}`, path: e.path,
    device: e.device, source: e.source, country: e.country
  }));
  return {
    generatedAt: now,
    range: days,
    metrics: {
      visits: pageViews.length, visitors: unique, sessions,
      pagesPerSession: sessions ? Number((pageViews.length / sessions).toFixed(1)) : 0,
      visitChange: percentChange(pageViews.length, previousViews.length),
      visitorChange: percentChange(unique, previousUnique)
    },
    daily,
    devices: countBy(pageViews, e => e.device),
    sources: countBy(pageViews, e => e.source).slice(0, 8),
    countries: countBy(pageViews, e => e.country).slice(0, 8),
    pages: countBy(pageViews, e => e.path).slice(0, 10),
    events: eventCounts,
    recent
  };
}

async function api(req, res, url) {
  const ip = clientIp(req);
  if (url.pathname === '/api/analytics/event' && req.method === 'POST') {
    if (!allowRate(eventRate, ip, 120, 60000)) return json(res, 429, { error: 'rate_limited' });
    const body = await readBody(req);
    if (!EVENT_TYPES.has(body.type)) return json(res, 400, { error: 'invalid_event' });
    const session = /^[a-zA-Z0-9-]{8,64}$/.test(body.session || '') ? body.session : digest(`${ip}:${Date.now()}:${Math.random()}`, 20);
    const source = cleanText(body.source, 60) || 'مباشر';
    const store = loadStore();
    store.events.push({
      id: crypto.randomUUID(), ts: Date.now(), type: body.type, path: cleanPath(body.path), session,
      visitor: digest(`${ip}:${req.headers['user-agent'] || ''}`, 20),
      device: deviceFrom(req.headers['user-agent'], body.device), source,
      referrer: cleanText(body.referrer, 100), country: country(req),
      utm: cleanText(body.utm, 80), outcome: cleanText(body.outcome, 24),
      duration: Number.isFinite(body.duration) ? Math.max(0, Math.min(86400, body.duration)) : null
    });
    saveStore(store);
    res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    if (!ADMIN_PASSWORD || !SESSION_SECRET) return json(res, 503, { error: 'not_configured', message: 'لم يتم إعداد كلمة مرور الإدارة على الخادم.' });
    const loginKey = digest(ip, 20);
    if (!allowRate(failedLogins, loginKey, 6, 15 * 60000)) return json(res, 429, { error: 'too_many_attempts', message: 'محاولات كثيرة. أعد المحاولة بعد 15 دقيقة.' });
    const body = await readBody(req, 2048);
    if (!safeEqual(body.password || '', ADMIN_PASSWORD)) return json(res, 401, { error: 'invalid_credentials', message: 'كلمة المرور غير صحيحة.' });
    failedLogins.delete(loginKey);
    const stamp = String(Date.now());
    const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
    const cookie = `${COOKIE}=${stamp}.${sessionSignature(stamp, req.headers['user-agent'] || '')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${secure}`;
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  }

  if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  }

  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, analytics: true, adminConfigured: Boolean(ADMIN_PASSWORD && SESSION_SECRET) });

  if (url.pathname === '/api/admin/session' && req.method === 'GET') return json(res, 200, { authenticated: isAdmin(req), configured: Boolean(ADMIN_PASSWORD && SESSION_SECRET) });

  if (url.pathname === '/api/admin/summary' && req.method === 'GET') {
    if (!isAdmin(req)) return json(res, 401, { error: 'unauthorized' });
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7;
    return json(res, 200, summary(loadStore().events, days));
  }
  return json(res, 404, { error: 'not_found' });
}

function securityHeaders(admin = false) {
  const csp = admin
    ? "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    : "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
  return { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': admin ? 'DENY' : 'SAMEORIGIN' };
}

function serve(req, res, url) {
  let pathname = url.pathname === '/' ? '/landing.html' : url.pathname;
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return json(res, 400, { error: 'bad_path' }); }
  const file = path.resolve(ROOT, `.${decoded}`);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || /(^|\/)\./.test(relative) || ['server.mjs', 'package.json'].includes(relative)) return json(res, 404, { error: 'not_found' });
  let stat;
  try { stat = fs.statSync(file); } catch { return json(res, 404, { error: 'not_found' }); }
  if (!stat.isFile()) return json(res, 404, { error: 'not_found' });
  const ext = path.extname(file).toLowerCase();
  const cache = ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400, must-revalidate';
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': cache, ...securityHeaders(file.endsWith('admin.html')) });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'method_not_allowed' });
    serve(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { error: 'server_error' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Electronic Horse Racing site: http://localhost:${PORT}`);
  console.log(ADMIN_PASSWORD ? 'Admin authentication: configured' : 'Admin authentication: missing ADMIN_PASSWORD');
  console.log(`Analytics storage: ${DATA_FILE}`);
});
