import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { loadDocumentDataUrlFromDesktop } from "./documentFileAccess.ts";

const document: DocumentItem = {
  id: "d1",
  propertyId: "p1",
  name: "invoice.pdf",
  type: "Invoice",
  mimeType: "application/pdf",
};

test("document file loading skips desktop reads when data is already present", async () => {
  let reads = 0;
  const existing = { ...document, dataUrl: "data:application/pdf;base64,abc" };
  const result = await loadDocumentDataUrlFromDesktop({
    document: existing,
    desktopPersistenceApi: { readDocumentDataUrl: async () => { reads += 1; return { ok: true }; } },
    setNotice: () => undefined,
  });
  assert.equal(result, existing);
  assert.equal(reads, 0);
});

test("document file loading merges desktop data without mutating metadata", async () => {
  const notices: string[] = [];
  const result = await loadDocumentDataUrlFromDesktop({
    document,
    desktopPersistenceApi: { readDocumentDataUrl: async () => ({ ok: true, dataUrl: "data:application/pdf;base64,xyz" }) },
    setNotice: (notice) => notices.push(notice),
  });
  assert.equal(result?.id, "d1");
  assert.equal(result?.dataUrl, "data:application/pdf;base64,xyz");
  assert.deepEqual(notices, []);
});

test("document file loading reports desktop read failures and returns metadata", async () => {
  const notices: string[] = [];
  const result = await loadDocumentDataUrlFromDesktop({
    document,
    desktopPersistenceApi: { readDocumentDataUrl: async () => { throw new Error("missing file"); } },
    setNotice: (notice) => notices.push(notice),
  });
  assert.equal(result, document);
  assert.deepEqual(notices, ["Could not read this document: missing file"]);
});
