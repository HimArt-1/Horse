import { neon } from '@neondatabase/serverless';

let initialized;
function client() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema() {
  if (!initialized) initialized = (async () => {
    const sql = client();
    await sql`CREATE TABLE IF NOT EXISTS ehr_analytics_events (
      id UUID PRIMARY KEY,
      ts BIGINT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      session TEXT NOT NULL,
      visitor TEXT NOT NULL,
      device TEXT NOT NULL,
      source TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '—',
      utm TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      duration INTEGER
    )`;
    await sql`CREATE INDEX IF NOT EXISTS ehr_analytics_ts_idx ON ehr_analytics_events (ts DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS ehr_analytics_type_idx ON ehr_analytics_events (type, ts DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS ehr_login_attempts (key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, attempts INTEGER NOT NULL)`;
  })();
  return initialized;
}

export async function insertEvent(event) {
  await ensureSchema(); const sql = client();
  await sql`INSERT INTO ehr_analytics_events (id,ts,type,path,session,visitor,device,source,referrer,country,utm,outcome,duration)
    VALUES (${event.id},${event.ts},${event.type},${event.path},${event.session},${event.visitor},${event.device},${event.source},${event.referrer},${event.country},${event.utm},${event.outcome},${event.duration})`;
}

export async function loadEventsSince(cutoff) {
  await ensureSchema(); const sql = client();
  const rows = await sql`SELECT ts,type,path,session,visitor,device,source,referrer,country,utm,outcome,duration FROM ehr_analytics_events WHERE ts >= ${cutoff} ORDER BY ts ASC LIMIT 50000`;
  return rows.map(row => ({ ...row, ts: Number(row.ts), duration: row.duration == null ? null : Number(row.duration) }));
}

export async function countRecentEvents(visitor, cutoff) {
  await ensureSchema(); const sql = client();
  const rows = await sql`SELECT COUNT(*)::int AS count FROM ehr_analytics_events WHERE visitor=${visitor} AND ts>=${cutoff}`;
  return Number(rows[0]?.count || 0);
}

export async function registerLoginAttempt(key, now) {
  await ensureSchema(); const sql = client(); const cutoff = now - 15 * 60000;
  const rows = await sql`INSERT INTO ehr_login_attempts (key,window_start,attempts) VALUES (${key},${now},1)
    ON CONFLICT (key) DO UPDATE SET
      window_start=CASE WHEN ehr_login_attempts.window_start < ${cutoff} THEN ${now} ELSE ehr_login_attempts.window_start END,
      attempts=CASE WHEN ehr_login_attempts.window_start < ${cutoff} THEN 1 ELSE ehr_login_attempts.attempts+1 END
    RETURNING attempts`;
  return Number(rows[0]?.attempts || 1);
}

export async function clearLoginAttempts(key) {
  await ensureSchema(); const sql = client(); await sql`DELETE FROM ehr_login_attempts WHERE key=${key}`;
}
