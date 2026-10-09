import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanCaptureNote, formatMaintenanceReport, parseMaintenanceReport } from '../lib/maintenance-report.ts';
import { emptyMemory, hasDraftContent, parseCaptureMemory } from '../lib/capture-drafts.ts';
test('maintenance details round-trip within the existing note limit and stay readable on older desktops', () => {
 const report = { title: 'Sink leak', location: 'Kitchen cabinet', urgency: 'Urgent', details: 'Water under the drain.' };
 assert.deepEqual(parseMaintenanceReport(cleanCaptureNote(formatMaintenanceReport(report))), report);
 assert.deepEqual(parseMaintenanceReport(cleanCaptureNote(formatMaintenanceReport(report).replace(/\n/g, "\r\n"))), report);
 const bounded = formatMaintenanceReport({ title: 'x'.repeat(200), location: 'y'.repeat(200), urgency: 'Routine', details: 'z'.repeat(600) });
 assert.ok(bounded.length <= 500); assert.ok(parseMaintenanceReport(bounded));
 assert.equal(parseMaintenanceReport('Kitchen sink leaks'), null);
 assert.equal(cleanCaptureNote(' Kitchen\n sink leaks '), 'Kitchen sink leaks');
 assert.equal(parseMaintenanceReport('Issue: Leak\nLocation: Kitchen\nUrgency: Anything\nDetails: Water'), null);
});
test('maintenance draft fields survive recovery without changing legacy draft format', () => {
 const memory = emptyMemory();
 const draft = { selectedPropertyId:'', selectedUnitId:'', propertyLabel:'Example', unitLabel:'', note:'', tripDate:'2026-10-09', businessMiles:'', purpose:'', startLocation:'', endLocation:'', maintenanceTitle:'Leak', maintenanceLocation:'Kitchen', maintenanceUrgency:'Soon' };
 memory.drafts.maintenance = draft;
 assert.deepEqual(parseCaptureMemory(JSON.stringify(memory)).drafts.maintenance, draft);
 assert.equal(hasDraftContent(draft), true);
});
