import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { queueDocumentForOcrWorkflow } from "./documentOcrQueue.ts";

const document: DocumentItem = {
  id: "d1",
  propertyId: "p1",
  name: "invoice.pdf",
  type: "Invoice",
  mimeType: "application/pdf",
  dataUrl: "data:application/pdf;base64,abc",
};

function dependencies(overrides: Partial<Parameters<typeof queueDocumentForOcrWorkflow>[0]> = {}) {
  const notices: string[] = [];
  const updates: Array<{ id: string; update: Partial<DocumentItem> }> = [];
  let busy: Record<string, boolean> = {};
  return {
    notices,
    updates,
    getBusy: () => busy,
    args: {
      document,
      silent: false,
      requirePermission: () => true,
      loadDocumentDataUrl: async (item: DocumentItem) => item,
      documentSupportsAutomaticOcr: () => true,
      automaticDocumentOcrAvailable: true,
      updateDocument: (id: string, update: Partial<DocumentItem>) => updates.push({ id, update }),
      setNotice: (notice: string) => notices.push(notice),
      setDocumentOcrBusyById: (updater: (previous: Record<string, boolean>) => Record<string, boolean>) => { busy = updater(busy); },
      runAutomaticDocumentOcr: async () => ({ ok: true, text: " Invoice total 50 " }),
      normalizeExtractedDocumentText: (value: unknown) => String(value || "").trim(),
      ...overrides,
    },
  };
}

test("OCR queue stops before reading files when permission is denied", async () => {
  let reads = 0;
  const state = dependencies({
    requirePermission: () => false,
    loadDocumentDataUrl: async (item) => { reads += 1; return item; },
  });
  const result = await queueDocumentForOcrWorkflow(state.args);
  assert.equal(result.ok, false);
  assert.equal(reads, 0);
});

test("OCR queue reports missing document files", async () => {
  const state = dependencies({ loadDocumentDataUrl: async (item) => ({ ...item, dataUrl: undefined }) });
  const result = await queueDocumentForOcrWorkflow(state.args);
  assert.equal(result.reason, "missing-file");
  assert.deepEqual(state.notices, ["This document has no file attached for OCR."]);
});

test("unsupported files remain queued for manual OCR", async () => {
  const state = dependencies({ documentSupportsAutomaticOcr: () => false });
  const result = await queueDocumentForOcrWorkflow(state.args);
  assert.deepEqual(result, { ok: true, queued: true, completed: false });
  assert.deepEqual(state.updates[0], { id: "d1", update: { ocrStatus: "pending" } });
});

test("successful OCR saves normalized text and always clears busy state", async () => {
  const state = dependencies();
  const result = await queueDocumentForOcrWorkflow(state.args);
  assert.equal(result.completed, true);
  assert.equal(result.text, "Invoice total 50");
  assert.equal(state.updates[0].update.ocrStatus, "completed");
  assert.equal(state.updates[0].update.extractedText, "Invoice total 50");
  assert.deepEqual(state.getBusy(), {});
});
