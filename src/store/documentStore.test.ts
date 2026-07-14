import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { createDocumentActions, normalizeDocument } from "./documentStore.ts";

test("normalizeDocument preserves a trimmed renewal date", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Insurance declaration",
    type: "Insurance",
    expiresOn: " 2026-09-30 ",
  });

  assert.equal(document.expiresOn, "2026-09-30");
});

test("normalizeDocument removes an empty renewal date", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Deed",
    type: "Deed",
    expiresOn: "   ",
  });

  assert.equal(document.expiresOn, undefined);
});

test("normalizeDocument preserves reviewed warning acknowledgements", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Receipt",
    type: "Transaction Receipt",
    reviewedWarningKeys: [" missing_amount ", "missing_amount", "low_confidence"],
    reviewedWarningsAt: " 2026-07-08T12:00:00.000Z ",
  });

  assert.deepEqual(document.reviewedWarningKeys, ["missing_amount", "low_confidence"]);
  assert.equal(document.reviewedWarningsAt, "2026-07-08T12:00:00.000Z");
});

test("normalizeDocument preserves OCR field corrections", () => {
  const document = normalizeDocument({
    id: "doc-4",
    propertyId: "p1",
    name: "internet.pdf",
    type: "Scanned PDF",
    ocrFieldOverrides: {
      vendorName: " Spectrum ",
      totalAmount: 42.505,
      servicePeriodStart: "2026-06-18",
      servicePeriodEnd: "2026-07-17",
    },
  });

  assert.deepEqual(document.ocrFieldOverrides, {
    vendorName: "Spectrum",
    totalAmount: 42.51,
    servicePeriodStart: "2026-06-18",
    servicePeriodEnd: "2026-07-17",
  });
});

test("document actions read current slice state and preserve audit behavior", () => {
  let documents: DocumentItem[] = [];
  const activity: Array<{ action: string; summary: string; details?: string }> = [];
  const actions = createDocumentActions({
    getDocuments: () => documents,
    setDocuments(updater) {
      documents = typeof updater === "function" ? updater(documents) : updater;
    },
    appendActivityLog(entry) {
      activity.push(entry);
    },
  });

  actions.addDocument({
    id: "doc-1",
    propertyId: "p1",
    name: " First receipt ",
    type: "Receipt",
  });
  actions.updateDocument("doc-1", { name: "Updated receipt", unit: " Unit B " });
  actions.addDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Replacement receipt",
    type: "Receipt",
  });
  actions.deleteDocument("doc-1");

  assert.deepEqual(documents, []);
  assert.deepEqual(activity.map((entry) => [entry.action, entry.summary, entry.details]), [
    ["create", "Document added.", "First receipt"],
    ["update", "Document metadata updated.", "Updated receipt"],
    ["update", "Document updated.", "Replacement receipt"],
    ["delete", "Document deleted.", "Replacement receipt"],
  ]);
});
