import test from 'node:test';
import assert from 'node:assert/strict';
import { syncDesktopTurnovers } from './mobileTurnoverSync.ts';
import { blankTurnover, type TurnoverRecord } from '../../companion/lib/turnover-contract.ts';
import type { Lease, DocumentItem } from '../models.ts';
import type { DesktopSnapshot } from '../../companion/lib/desktop-snapshot.ts';

const lease = { id: 'lease', propertyId: 'property', unit: 'Unit A', tenantName: 'Example Tenant', rentAmount: 1200, startDate: '2026-01-01', turnover: blankTurnover() } as Lease;
function harness() {
  let leases = [structuredClone(lease)], documents: DocumentItem[] = [], saves = 0;
  const sentSnapshot = { leases: [{ ...lease, turnover: structuredClone(lease.turnover) }] } as DesktopSnapshot;
  const record: TurnoverRecord = { leaseId: lease.id, revision: 2, checklist: blankTurnover(), photos: [], updatedAt: '2026-10-18T12:00:00Z', syncedAt: null, conflict: null };
  const args = { records: [record], sentSnapshot, getLeases: () => leases, getDocuments: () => documents, api: {} as any,
    loadPhoto: async () => 'data:image/png;base64,AA==', saveTurnover: (id: string, turnover: NonNullable<Lease['turnover']>) => { leases = leases.map(l => l.id === id ? { ...l, turnover } : l); },
    addDocument: (document: DocumentItem) => { documents.push(document); }, persist: async () => { saves++; },
  };
  return { args, record, get leases() { return leases; }, get documents() { return documents; }, get saves() { return saves; } };
}
test('phone checklist changes merge with local changes made during sync and preserve financial terms', async () => {
  const h = harness(); h.record.checklist!.tasks[0].notes = 'Phone note'; h.leases[0].turnover!.tasks[1].dueDate = '2026-10-21';
  await syncDesktopTurnovers(h.args);
  assert.equal(h.leases[0].turnover!.tasks[0].notes, 'Phone note'); assert.equal(h.leases[0].turnover!.tasks[1].dueDate, '2026-10-21');
  const { turnover, ...agreement } = h.leases[0], { turnover: ignored, ...before } = lease;
  assert.deepEqual(agreement, before); assert.equal(h.saves, 1);
});
test('a conflicting or open lease is left untouched for explicit review', async () => {
  const h = harness(); h.record.checklist!.tasks[0].notes = 'Phone'; h.leases[0].turnover!.tasks[0].notes = 'Desktop';
  await assert.rejects(syncDesktopTurnovers(h.args), /changed during sync/); assert.equal(h.leases[0].turnover!.tasks[0].notes, 'Desktop');
  await assert.rejects(syncDesktopTurnovers({ ...h.args, isLeaseOpen: () => true }), /Close the open lease/);
});
test('photo integrity failure never links or imports bytes and a successful retry imports once', async () => {
  const h = harness(), photo = { id: 'turnover-photo-example', leaseId: lease.id, name: 'Before.png', mimeType: 'image/png', byteSize: 5, sha256: 'a'.repeat(64) };
  h.record.photos = [photo]; h.record.checklist!.tasks[0].photoIds = [photo.id];
  h.args.api.downloadTurnoverPhoto = async () => ({ ok: true, dataUrl: 'data:image/png;base64,AA==', byteSize: 5, mimeType: 'image/png', sha256: 'b'.repeat(64) });
  await assert.rejects(syncDesktopTurnovers(h.args), /integrity/); assert.equal(h.documents.length, 0); assert.deepEqual(h.leases[0].turnover!.tasks[0].photoIds, []);
  h.args.api.downloadTurnoverPhoto = async () => ({ ok: true, dataUrl: 'data:image/png;base64,AA==', ...photo });
  await syncDesktopTurnovers(h.args); await syncDesktopTurnovers(h.args);
  assert.equal(h.documents.length, 1); assert.equal(h.documents[0].leaseId, lease.id); assert.deepEqual(h.leases[0].turnover!.tasks[0].photoIds, [photo.id]);
});
test('turning sharing off during a photo download prevents import', async () => {
  const h = harness(); let enabled = true;
  const photo = { id: 'photo', leaseId: lease.id, name: 'Before.png', mimeType: 'image/png', byteSize: 5, sha256: 'a'.repeat(64) };
  h.record.photos = [photo]; h.record.checklist!.tasks[0].photoIds = [photo.id];
  h.args.api.downloadTurnoverPhoto = async () => { enabled = false; return { ok: true, dataUrl: 'data:image/png;base64,AA==', ...photo }; };
  await syncDesktopTurnovers({ ...h.args, canContinue: () => enabled }); assert.equal(h.documents.length, 0); assert.deepEqual(h.leases[0].turnover!.tasks[0].photoIds, []);
});
