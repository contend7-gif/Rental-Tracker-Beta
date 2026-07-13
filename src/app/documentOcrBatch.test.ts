import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { markVisibleDocumentsPendingOcrWorkflow, runVisibleDocumentOcrWorkflow } from "./documentOcrBatch.ts";

const documents: DocumentItem[] = [
  { id: "d1", propertyId: "p1", name: "one.pdf", type: "Invoice" },
  { id: "d2", propertyId: "p1", name: "two.pdf", type: "Invoice" },
];

test("visible missing-index documents are queued together", () => {
  const updates: string[] = [];
  const notices: string[] = [];
  const audits: unknown[] = [];
  const count = markVisibleDocumentsPendingOcrWorkflow({
    documents,
    documentStatusFilter: "needs-ocr",
    requirePermission: () => true,
    updateDocument: (id) => updates.push(id),
    addAuditEntry: (entry) => audits.push(entry),
    setNotice: (notice) => notices.push(notice),
  });
  assert.equal(count, 2);
  assert.deepEqual(updates, ["d1", "d2"]);
  assert.equal(audits.length, 1);
  assert.match(notices[0], /Queued 2 visible documents/);
});

test("visible OCR batch counts completed documents and clears busy state", async () => {
  const busy: boolean[] = [];
  const notices: string[] = [];
  const audits: unknown[] = [];
  const count = await runVisibleDocumentOcrWorkflow({
    documents,
    requirePermission: () => true,
    setBusy: (value) => busy.push(value),
    queueDocument: async (document) => ({ ok: true, completed: document.id === "d1" }),
    addAuditEntry: (entry) => audits.push(entry),
    setNotice: (notice) => notices.push(notice),
  });
  assert.equal(count, 1);
  assert.deepEqual(busy, [true, false]);
  assert.equal(audits.length, 1);
  assert.match(notices[0], /finished for 1 visible document/);
});

test("empty visible OCR batches do not enter busy state", async () => {
  const busy: boolean[] = [];
  const notices: string[] = [];
  await runVisibleDocumentOcrWorkflow({
    documents: [],
    requirePermission: () => true,
    setBusy: (value) => busy.push(value),
    queueDocument: async () => ({ ok: true }),
    addAuditEntry: () => {},
    setNotice: (notice) => notices.push(notice),
  });
  assert.deepEqual(busy, []);
  assert.match(notices[0], /No visible OCR-ready/);
});
