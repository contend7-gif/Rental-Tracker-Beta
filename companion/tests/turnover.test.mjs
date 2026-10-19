import test from 'node:test';
import assert from 'node:assert/strict';
import { blankTurnover, cleanTurnover, mergeTurnover } from '../lib/turnover-contract.ts';
import { normalizeDesktopSnapshot } from '../lib/desktop-snapshot.ts';
test('turnover merge preserves phone work when an unchanged desktop checks in', () => {
  const base = blankTurnover(), phone = structuredClone(base);
  phone.tasks[0].notes = 'Before inspection'; phone.tasks[0].completedAt = '2026-10-18T12:00:00.000Z';
  assert.deepEqual(mergeTurnover(base, structuredClone(base), phone), { checklist: phone, conflicts: [] });
});
test('turnover merge combines different fields, new tasks, and photo additions without resurrecting an unlinked photo', () => {
  const base = blankTurnover(); base.tasks[0].photoIds = ['old'];
  const desktop = structuredClone(base), phone = structuredClone(base);
  desktop.tasks[0].notes = 'Desktop note'; phone.tasks[0].dueDate = '2026-10-20';
  desktop.tasks[0].photoIds.push('new-desktop'); phone.tasks[0].photoIds = ['new-phone'];
  phone.tasks.push({ ...phone.tasks[1], id: 'phone-task', title: 'Check towels' });
  const merged = mergeTurnover(base, desktop, phone);
  assert.deepEqual(merged.conflicts, []); assert.equal(merged.checklist.tasks.length, 8);
  assert.equal(merged.checklist.tasks[0].notes, 'Desktop note'); assert.equal(merged.checklist.tasks[0].dueDate, '2026-10-20');
  assert.deepEqual(new Set(merged.checklist.tasks[0].photoIds), new Set(['new-desktop', 'new-phone']));
});
test('overlapping notes require an explicit choice and retain the phone version until resolved', () => {
  const base = blankTurnover(), desktop = structuredClone(base), phone = structuredClone(base);
  desktop.tasks[0].notes = 'Desktop'; phone.tasks[0].notes = 'Phone';
  const merged = mergeTurnover(base, desktop, phone);
  assert.equal(merged.conflicts.length, 1); assert.equal(merged.checklist.tasks[0].notes, 'Phone');
  assert.deepEqual(mergeTurnover(base, base, phone).conflicts, []);
});
test('checking the same task on both devices does not create a timestamp conflict', () => {
  const base = blankTurnover(), desktop = structuredClone(base), phone = structuredClone(base);
  desktop.tasks[0].completedAt = '2026-10-18T12:00:00.000Z'; phone.tasks[0].completedAt = '2026-10-18T12:01:00.000Z';
  assert.deepEqual(mergeTurnover(base, desktop, phone).conflicts, []);
});
test('snapshot shares only explicit turnover fields after the desktop advertises turnover support', () => {
  const base = { version: 1, generatedAt: '2026-10-18T12:00:00Z', properties: [{ id: 'p' }], leases: [{ id: 'l', propertyId: 'p', turnover: { ...blankTurnover(), privateKey: 'private-secret', tasks: [{ ...blankTurnover().tasks[0], privateTenantNotes: 'private-secret', dataUrl: 'private-secret' }] } }] };
  assert.equal(normalizeDesktopSnapshot(base).leases[0].turnover, undefined);
  const snapshot = normalizeDesktopSnapshot({ ...base, turnoverSync: true });
  assert.equal(snapshot.leases[0].turnover.tasks.length, 1);
  assert.equal(JSON.stringify(snapshot).includes('private-secret'), false);
  assert.equal(cleanTurnover({ ...blankTurnover(), tasks: [{ ...blankTurnover().tasks[0], dueDate: '2026-02-30' }] }).tasks[0].dueDate, '');
});
