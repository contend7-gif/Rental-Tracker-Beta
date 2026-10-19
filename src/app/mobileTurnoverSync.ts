import type { DocumentItem, Lease } from '../models.ts';
import type { DesktopSnapshot } from '../../companion/lib/desktop-snapshot.ts';
import { cleanTurnover, mergeTurnover, validTurnoverId, type TurnoverRecord } from '../../companion/lib/turnover-contract.ts';
import type { DesktopCompanionApi } from '../types/desktop.d.ts';

export async function syncDesktopTurnovers({ records, sentSnapshot, getLeases, getDocuments, api, loadPhoto, saveTurnover, addDocument, persist, canContinue = () => true, isLeaseOpen = () => false }: {
  records: TurnoverRecord[]; sentSnapshot: DesktopSnapshot; getLeases: () => Lease[]; getDocuments: () => DocumentItem[];
  api: DesktopCompanionApi; loadPhoto: (document: DocumentItem) => Promise<string>;
  saveTurnover: (leaseId: string, turnover: NonNullable<Lease['turnover']>) => void;
  addDocument: (document: DocumentItem) => void; persist: () => Promise<unknown>; canContinue?: () => boolean; isLeaseOpen?: (id: string) => boolean;
}) {
  const errors: string[] = [];
  for (const record of Array.isArray(records) ? records.slice(0, 500) : []) {
    if (!canContinue()) return;
    const sent = sentSnapshot.leases.find(lease => lease.id === record?.leaseId);
    const lease = getLeases().find(lease => lease.id === record?.leaseId);
    if (!sent || !lease || lease.propertyId !== sent.propertyId || lease.unit !== sent.unit || !validTurnoverId(record.leaseId)) continue;
    try {
      if (record.conflict) throw new Error('Phone and desktop checklist edits overlap. Open Turnover on your phone to choose a version.');
      const remote = cleanTurnover(record.checklist);
      const photos = Array.isArray(record.photos) ? record.photos : [];
      // Send only images explicitly linked to this lease's turnover tasks.
      for (const id of new Set(sent.turnover?.tasks.flatMap(task => task.photoIds) || [])) {
        if (!canContinue()) return;
        if (photos.some(photo => photo.id === id && photo.leaseId === lease.id)) continue;
        const document = getDocuments().find(document => document.id === id);
        if (!document) throw new Error('A turnover photo is missing from desktop Documents. Unlink it or restore the file.');
        if (document.propertyId !== lease.propertyId || document.unit && document.unit !== lease.unit && document.unit !== 'Shared' || !['image/jpeg', 'image/png', 'image/webp'].includes(document.mimeType || '')) throw new Error('A linked turnover photo does not match this property or photo type.');
        if (!api.uploadTurnoverPhoto) throw new Error('Update the desktop app to share turnover photos.');
        const dataUrl = await loadPhoto(document); if (!canContinue()) return;
        const result = await api.uploadTurnoverPhoto({ id, leaseId: lease.id, name: document.name, dataUrl });
        if (result.ok === false) throw new Error(result.message || result.error || 'Turnover photo upload failed.');
      }
      if (!remote) continue;
      if (JSON.stringify(remote) === JSON.stringify(getLeases().find(item => item.id === lease.id)?.turnover)) continue;
      if (isLeaseOpen(lease.id)) throw new Error('Close the open lease to receive its phone checklist changes.');
      for (const id of new Set(remote.tasks.flatMap(task => task.photoIds))) {
        if (!canContinue()) return;
        const existing = getDocuments().find(document => document.id === id);
        if (existing) {
          if (existing.propertyId !== lease.propertyId) throw new Error('A phone photo ID conflicts with another property document.');
          continue;
        }
        const photo = photos.find(photo => photo.id === id && photo.leaseId === lease.id);
        if (!photo || !validTurnoverId(photo.id) || !/^[a-f0-9]{64}$/i.test(photo.sha256) || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType) || !Number.isFinite(photo.byteSize) || photo.byteSize <= 0 || photo.byteSize > 15 * 1024 * 1024) throw new Error('A phone photo has not finished uploading. Save it on the phone and retry sync.');
        if (!api.downloadTurnoverPhoto) throw new Error('Update the desktop app to import turnover photos.');
        const result = await api.downloadTurnoverPhoto(photo.id); if (!canContinue()) return;
        if (result.ok === false || !result.dataUrl || result.sha256 !== photo.sha256 || result.byteSize !== photo.byteSize || result.mimeType !== photo.mimeType) throw new Error('A turnover photo failed its integrity check. Retry sync.');
        addDocument({ id: photo.id, leaseId: lease.id, propertyId: lease.propertyId, unit: lease.unit, name: String(photo.name || 'Turnover photo'), type: 'Turnover photo', mimeType: photo.mimeType, dataUrl: result.dataUrl, uploadedAt: new Date().toISOString(), tags: ['turnover', 'mobile'], sourceRef: { provider: 'rental-tracker-companion', kind: 'turnover', submissionId: photo.id, sha256: photo.sha256 } });
      }
      const current = getLeases().find(item => item.id === lease.id);
      if (!current || !canContinue()) continue;
      if (current.propertyId !== lease.propertyId || current.unit !== lease.unit || isLeaseOpen(lease.id)) throw new Error('Close the lease and retry turnover sync.');
      const merged = mergeTurnover(sent.turnover || null, current.turnover || null, remote);
      if (merged.conflicts.length) throw new Error('The lease changed during sync. Your desktop edits are preserved; retry to review differences.');
      if (merged.checklist && JSON.stringify(merged.checklist) !== JSON.stringify(current.turnover)) saveTurnover(lease.id, merged.checklist);
    } catch (error) { errors.push(`${lease.unit}: ${error instanceof Error ? error.message : 'Turnover sync failed.'}`); }
  }
  await persist();
  if (errors.length) throw new Error([...new Set(errors)].join(' '));
}
