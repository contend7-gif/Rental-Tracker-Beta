import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { createBlankDocumentImportDraft } from "./draftFactories.js";
import {
  buildDocumentExtractedTextUpdate,
  buildDocumentTagsUpdate,
  buildImportedDocumentRecord,
} from "./documentRecordUpdates.ts";

const document: DocumentItem = {
  id: "d1",
  propertyId: "p1",
  name: "invoice.pdf",
  type: "Invoice",
  tags: ["Utility", "Tax"],
  extractedText: "Existing text",
  expenseReviewDismissedAt: "2026-07-01T00:00:00.000Z",
  workOrderReviewDismissedAt: "2026-07-01T00:00:00.000Z",
};

function buildRecord(overrides: Partial<Parameters<typeof buildImportedDocumentRecord>[0]> = {}) {
  return buildImportedDocumentRecord({
    draft: {
      ...createBlankDocumentImportDraft("p1", "Shared"),
      name: " invoice.pdf ",
      dataUrl: "data:application/pdf;base64,abc",
      tags: "Utility, Tax",
    },
    effectiveLinkType: "none",
    effectiveLinkedId: "",
    extractedText: "Invoice total 50",
    leaseById: {},
    transactionById: {},
    workOrderById: {},
    id: "d2",
    uploadedAt: "2026-07-12T00:00:00.000Z",
    ocrStatus: "completed",
    ...overrides,
  });
}

test("imported documents inherit linked transaction scope", () => {
  const result = buildRecord({
    effectiveLinkType: "transaction",
    effectiveLinkedId: "t1",
    transactionById: { t1: { id: "t1", propertyId: "p2", unit: "Unit 2" } },
  });
  assert.equal(result?.propertyId, "p2");
  assert.equal(result?.unit, "Unit 2");
  assert.equal(result?.transactionId, "t1");
  assert.equal(result?.name, "invoice.pdf");
  assert.deepEqual(result?.tags, ["Utility", "Tax"]);
});

test("manual unit scope overrides linked-record unit scope", () => {
  const result = buildRecord({
    draft: {
      ...createBlankDocumentImportDraft("p1", "Unit 1"),
      name: "invoice.pdf",
      dataUrl: "data:application/pdf;base64,abc",
      unitScopeOverride: true,
    },
    effectiveLinkType: "workOrder",
    effectiveLinkedId: "wo1",
    workOrderById: { wo1: { id: "wo1", propertyId: "p2", unit: "Unit 2" } },
  });
  assert.equal(result?.propertyId, "p2");
  assert.equal(result?.unit, "Unit 1");
});

test("imported documents require a property after link resolution", () => {
  const result = buildRecord({
    draft: { ...createBlankDocumentImportDraft(), name: "invoice.pdf", dataUrl: "data:application/pdf;base64,abc" },
  });
  assert.equal(result, null);
});

test("tag updates ignore casing-only changes and retain meaningful changes", () => {
  assert.equal(buildDocumentTagsUpdate(document, "utility, tax"), null);
  assert.deepEqual(buildDocumentTagsUpdate(document, "Utility, Tax, Receipt"), {
    tags: ["Utility", "Tax", "Receipt"],
  });
});

test("new extracted text reopens dismissed review queues", () => {
  const update = buildDocumentExtractedTextUpdate(document, " New text ", (value) => String(value || "").trim());
  assert.equal(update?.extractedText, "New text");
  assert.equal(update?.expenseReviewDismissedAt, undefined);
  assert.equal(update?.workOrderReviewDismissedAt, undefined);
});

test("clearing extracted text preserves existing dismissal state", () => {
  const update = buildDocumentExtractedTextUpdate(document, "", (value) => String(value || "").trim());
  assert.equal(update?.extractedText, "");
  assert.equal(update?.expenseReviewDismissedAt, document.expenseReviewDismissedAt);
  assert.equal(update?.workOrderReviewDismissedAt, document.workOrderReviewDismissedAt);
  assert.equal(buildDocumentExtractedTextUpdate(document, "Existing text", (value) => String(value || "").trim()), null);
});
