import { env } from 'cloudflare:workers';
import { readDesktopSnapshot } from './snapshot-storage';
import type { DesktopSnapshot } from './desktop-snapshot';
import { cleanTurnover, mergeTurnover, validTurnoverId, type TurnoverChecklist, type TurnoverPhoto, type TurnoverRecord } from './turnover-contract';

type Row = { lease_id: string; revision: number; payload: string; desktop_base: string; desktop_generated_at: string; conflict: string | null; updated_at: string; synced_at: string | null };
type PhotoRow = { id: string; lease_id: string; name: string; mime_type: string; byte_size: number; sha256: string; storage_key: string };
let ready: Promise<void> | null = null;
const bindings = () => env as unknown as { DB: D1Database; UPLOADS: R2Bucket };
async function schema() {
  if (!ready) ready = bindings().DB.batch([
    bindings().DB.prepare('CREATE TABLE IF NOT EXISTS lease_turnovers (lease_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, desktop_base TEXT NOT NULL, desktop_generated_at TEXT NOT NULL, conflict TEXT, updated_at TEXT NOT NULL, synced_at TEXT)'),
    bindings().DB.prepare('CREATE TABLE IF NOT EXISTS turnover_photos (id TEXT PRIMARY KEY, lease_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL, storage_key TEXT NOT NULL)'),
    bindings().DB.prepare('CREATE INDEX IF NOT EXISTS turnover_photos_lease_idx ON turnover_photos (lease_id)'),
  ]).then(() => undefined).catch(error => { ready = null; throw error; });
  await ready;
}
export class TurnoverError extends Error { constructor(message: string, public status = 400) { super(message); } }
async function row(leaseId: string) { await schema(); return bindings().DB.prepare('SELECT * FROM lease_turnovers WHERE lease_id = ?').bind(leaseId).first<Row>(); }
async function requireLease(leaseId: string) {
  if (!validTurnoverId(leaseId)) throw new TurnoverError('Invalid lease.', 400);
  const { snapshot } = await readDesktopSnapshot();
  const lease = snapshot?.turnoverSync && snapshot.leases.find(lease => lease.id === leaseId);
  if (!lease) throw new TurnoverError('Refresh from your updated desktop app before editing this lease.', 409);
  return lease;
}
const photoView = (p: PhotoRow): TurnoverPhoto => ({ id: p.id, leaseId: p.lease_id, name: p.name, mimeType: p.mime_type, byteSize: p.byte_size, sha256: p.sha256 });
export async function readTurnover(leaseId: string): Promise<TurnoverRecord | null> {
  const saved = await row(leaseId);
  if (!saved) return null;
  const photos = await bindings().DB.prepare('SELECT * FROM turnover_photos WHERE lease_id = ?').bind(leaseId).all<PhotoRow>();
  return { leaseId, revision: saved.revision, checklist: cleanTurnover(JSON.parse(saved.payload)), updatedAt: saved.updated_at, syncedAt: saved.synced_at, conflict: saved.conflict ? JSON.parse(saved.conflict) : null, photos: photos.results.map(photoView) };
}
export async function listTurnovers() {
  const { snapshot } = await readDesktopSnapshot();
  if (!snapshot?.turnoverSync) return { supported: false, generatedAt: snapshot?.generatedAt || null, leases: [], records: [] };
  const records = await Promise.all(snapshot.leases.map(lease => readTurnover(lease.id)));
  return { supported: true, generatedAt: snapshot.generatedAt, leases: snapshot.leases.map(lease => ({ id: lease.id, propertyId: lease.propertyId, propertyName: snapshot.properties.find(p => p.id === lease.propertyId)?.name || 'Property', unit: lease.unit, tenantName: lease.tenantName, endDate: lease.endDate })), records: records.filter((r): r is TurnoverRecord => Boolean(r)) };
}
export async function syncDesktopTurnovers(snapshot: DesktopSnapshot) {
  if (!snapshot.turnoverSync) return [];
  await schema();
  const current = await readDesktopSnapshot();
  if (current.snapshot?.generatedAt !== snapshot.generatedAt) return [];
  const results: TurnoverRecord[] = [];
  for (const lease of snapshot.leases) {
    const incoming = cleanTurnover(lease.turnover);
    for (let attempt = 0; attempt < 4; attempt++) {
      const saved = await row(lease.id), now = new Date().toISOString();
      if (!saved) {
        const inserted = await bindings().DB.prepare('INSERT OR IGNORE INTO lease_turnovers (lease_id, revision, payload, desktop_base, desktop_generated_at, conflict, updated_at, synced_at) SELECT ?, 1, ?, ?, ?, NULL, ?, ? WHERE EXISTS (SELECT 1 FROM desktop_snapshot WHERE id = 1 AND generated_at = ?)').bind(lease.id, JSON.stringify(incoming), JSON.stringify(incoming), snapshot.generatedAt, now, now, snapshot.generatedAt).run();
        if (!inserted.meta.changes) continue;
      } else {
        if (saved.desktop_generated_at > snapshot.generatedAt) break;
        const phone = cleanTurnover(JSON.parse(saved.payload));
        const merged = mergeTurnover(cleanTurnover(JSON.parse(saved.desktop_base)), incoming, phone);
        const conflict = merged.conflicts.length ? { desktop: incoming, fields: merged.conflicts } : null;
        const same = JSON.stringify(incoming) === JSON.stringify(merged.checklist);
        const revisionChange = JSON.stringify(phone) !== JSON.stringify(merged.checklist) || JSON.stringify(conflict) !== (saved.conflict || 'null') ? 1 : 0;
        const changed = await bindings().DB.prepare('UPDATE lease_turnovers SET revision = revision + ?, payload = ?, desktop_base = ?, desktop_generated_at = ?, conflict = ?, updated_at = ?, synced_at = ? WHERE lease_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM desktop_snapshot WHERE id = 1 AND generated_at = ?)').bind(revisionChange, JSON.stringify(merged.checklist), conflict ? saved.desktop_base : JSON.stringify(incoming), snapshot.generatedAt, conflict ? JSON.stringify(conflict) : null, JSON.stringify(phone) === JSON.stringify(merged.checklist) ? saved.updated_at : now, same && !conflict ? now : saved.synced_at, lease.id, saved.revision, snapshot.generatedAt).run();
        if (!changed.meta.changes) continue;
      }
      const result = await readTurnover(lease.id);
      if (result) results.push(result);
      break;
    }
  }
  return results;
}
export async function savePhoneTurnover(leaseId: string, input: { revision?: number; checklist?: unknown; resolve?: string }) {
  await requireLease(leaseId);
  const saved = await row(leaseId);
  if (!saved || input.revision !== saved.revision) throw new TurnoverError('This checklist changed elsewhere. Refresh, review the latest version, and try again. Your unsaved work is still on this phone.', 409);
  const conflict = saved.conflict ? JSON.parse(saved.conflict) as { desktop: TurnoverChecklist | null } : null;
  if (conflict && !['phone', 'desktop'].includes(input.resolve || '')) throw new TurnoverError('Resolve the phone and desktop differences before saving.', 409);
  const checklist = input.resolve === 'desktop' && conflict ? conflict.desktop : cleanTurnover(input.checklist);
  if (!checklist || !checklist.tasks.length) throw new TurnoverError('Keep at least one checklist task.');
  const known = new Set((await readTurnover(leaseId))?.photos.map(p => p.id));
  const existing = cleanTurnover(JSON.parse(saved.payload));
  const previousIds = new Set(existing?.tasks.flatMap(t => t.photoIds));
  if (checklist.tasks.some(t => t.photoIds.some(id => !known.has(id) && !previousIds.has(id)))) throw new TurnoverError('A linked photo has not finished uploading. Retry the photo upload first.');
  const changed = await bindings().DB.prepare('UPDATE lease_turnovers SET revision = revision + 1, payload = ?, desktop_base = CASE WHEN ? THEN ? ELSE desktop_base END, conflict = NULL, updated_at = ?, synced_at = NULL WHERE lease_id = ? AND revision = ?').bind(JSON.stringify(checklist), conflict ? 1 : 0, conflict ? JSON.stringify(conflict.desktop) : saved.desktop_base, new Date().toISOString(), leaseId, saved.revision).run();
  if (!changed.meta.changes) throw new TurnoverError('This checklist changed while saving. Refresh and try again.', 409);
  return readTurnover(leaseId);
}
export async function saveTurnoverPhoto(leaseId: string, id: string, file: File) {
  await requireLease(leaseId); await schema();
  if (!validTurnoverId(id)) throw new TurnoverError('Invalid photo ID.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024) throw new TurnoverError('Choose a JPEG, PNG or WebP photo up to 15 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8, png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/jpeg' ? jpeg : file.type === 'image/png' ? png : webp)) throw new TurnoverError('This file does not match its photo type.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
  const existing = await bindings().DB.prepare('SELECT * FROM turnover_photos WHERE id = ?').bind(id).first<PhotoRow>();
  if (existing) {
    if (existing.lease_id !== leaseId || existing.sha256 !== sha256) throw new TurnoverError('That photo ID is already in use. Choose the photo again.', 409);
    return photoView(existing);
  }
  const key = `turnover/${leaseId}/${id}/${sha256}`;
  await bindings().UPLOADS.put(key, bytes, { httpMetadata: { contentType: file.type } });
  const name = file.name.replace(/[\r\n\0]/g, '').slice(0, 200) || 'Turnover photo';
  await bindings().DB.prepare('INSERT OR IGNORE INTO turnover_photos (id, lease_id, name, mime_type, byte_size, sha256, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, leaseId, name, file.type, bytes.length, sha256, key).run();
  const stored = await bindings().DB.prepare('SELECT * FROM turnover_photos WHERE id = ?').bind(id).first<PhotoRow>();
  if (!stored || stored.sha256 !== sha256 || stored.lease_id !== leaseId) throw new TurnoverError('The photo changed during upload. Choose it again.', 409);
  return photoView(stored);
}
export async function readTurnoverPhoto(id: string) {
  if (!validTurnoverId(id)) throw new TurnoverError('Photo not found.', 404);
  await schema();
  const stored = await bindings().DB.prepare('SELECT * FROM turnover_photos WHERE id = ?').bind(id).first<PhotoRow>();
  if (!stored) throw new TurnoverError('Photo not found.', 404);
  await requireLease(stored.lease_id);
  const object = await bindings().UPLOADS.get(stored.storage_key);
  if (!object) throw new TurnoverError('Photo file is unavailable.', 404);
  return new Response(object.body, { headers: { 'content-type': stored.mime_type, 'content-length': String(stored.byte_size), 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
export async function clearTurnovers() {
  await schema();
  const photos = await bindings().DB.prepare('SELECT storage_key FROM turnover_photos').all<{ storage_key: string }>();
  for (let i = 0; i < photos.results.length; i += 100) await bindings().UPLOADS.delete(photos.results.slice(i, i + 100).map(p => p.storage_key));
  await bindings().DB.batch([bindings().DB.prepare('DELETE FROM lease_turnovers'), bindings().DB.prepare('DELETE FROM turnover_photos')]);
}
