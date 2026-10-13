import { env } from 'cloudflare:workers';
import { normalizeDesktopSnapshot, type DesktopSnapshot } from './desktop-snapshot';
let ready: Promise<void> | null = null;
function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('Companion database binding is unavailable.');
  return db;
}
async function ensureSchema() {
  if (!ready) ready = database().prepare('CREATE TABLE IF NOT EXISTS desktop_snapshot (id INTEGER PRIMARY KEY CHECK(id = 1), generated_at TEXT NOT NULL, received_at TEXT NOT NULL, payload TEXT NOT NULL)').run().then(() => undefined).catch(error => { ready = null; throw error; });
  await ready;
}
export async function readDesktopSnapshot(): Promise<{ snapshot: DesktopSnapshot | null; receivedAt: string | null }> {
  await ensureSchema();
  const row = await database().prepare('SELECT payload, received_at FROM desktop_snapshot WHERE id = 1').first<{ payload: string; received_at: string }>();
  return row ? { snapshot: normalizeDesktopSnapshot(JSON.parse(row.payload)), receivedAt: row.received_at } : { snapshot: null, receivedAt: null };
}
export async function saveDesktopSnapshot(value: unknown) {
  const snapshot = normalizeDesktopSnapshot(value);
  if (Date.parse(snapshot.generatedAt) > Date.now() + 300_000) throw new Error('Desktop clock is ahead. Check its date and time.');
  await ensureSchema();
  const receivedAt = new Date().toISOString();
  await database().prepare(`INSERT INTO desktop_snapshot (id, generated_at, received_at, payload) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, received_at = excluded.received_at, payload = excluded.payload
    WHERE excluded.generated_at >= desktop_snapshot.generated_at`).bind(snapshot.generatedAt, receivedAt, JSON.stringify(snapshot)).run();
  return readDesktopSnapshot();
}
export async function clearDesktopSnapshot() { await ensureSchema(); await database().prepare('DELETE FROM desktop_snapshot WHERE id = 1').run(); }
