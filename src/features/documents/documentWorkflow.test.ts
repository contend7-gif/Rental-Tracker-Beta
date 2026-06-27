import assert from "node:assert/strict";
import test from "node:test";

import {
  getDocumentPrimaryAction,
  getDocumentWorkflowStatus,
  isDocumentReviewed,
  removeSupportingOnlyTag,
  sortDocumentAttachOptions,
} from "./documentWorkflow.js";

const baseDocument = {
  id: "doc-1",
  propertyId: "p1",
  unit: "Shared",
  name: "receipt.pdf",
  type: "Receipt",
  uploadedAt: "2026-05-01T12:00:00.000Z",
  dataUrl: "data:application/pdf;base64,abc",
  mimeType: "application/pdf",
  tags: [],
};

const context = {
  documentSupportsAutomaticOcr: () => true,
  getDocumentExpenseSuggestion: () => null,
  getDocumentWorkOrderSuggestion: () => null,
  getSafeDocumentLinkSuggestion: () => null,
  getDocumentLinkedWorkOrder: (document) => (document.workOrderId ? { id: document.workOrderId } : null),
};

test("workflow flags supported documents without extracted text as needing OCR", () => {
  const document = { ...baseDocument, ocrStatus: "pending", extractedText: "" };

  assert.equal(getDocumentWorkflowStatus(document, context), "needs_ocr");
  assert.equal(getDocumentPrimaryAction(document, context).key, "extract_text");
});

test("workflow prioritizes pending expense suggestions after OCR", () => {
  const document = { ...baseDocument, extractedText: "Invoice total $42.00" };
  const expenseContext = {
    ...context,
    getDocumentExpenseSuggestion: () => ({ category: "Repairs", amount: 42, confidence: "high" }),
  };

  assert.equal(getDocumentWorkflowStatus(document, expenseContext), "needs_expense_review");
  assert.equal(getDocumentPrimaryAction(document, expenseContext).key, "review_expense");
});

test("workflow prioritizes pending work-order suggestions", () => {
  const document = { ...baseDocument, extractedText: "Repair estimate" };
  const workOrderContext = {
    ...context,
    getDocumentWorkOrderSuggestion: () => ({ title: "Fix sink", confidence: "high" }),
  };

  assert.equal(getDocumentWorkflowStatus(document, workOrderContext), "needs_work_order_review");
  assert.equal(getDocumentPrimaryAction(document, workOrderContext).key, "review_work_order");
});

test("workflow treats linked transactions as reviewed", () => {
  const document = { ...baseDocument, transactionId: "txn-1", extractedText: "Receipt" };

  assert.equal(getDocumentWorkflowStatus(document, context), "reviewed");
  assert.equal(getDocumentPrimaryAction(document, context).key, "view_linked");
  assert.equal(isDocumentReviewed(document, context), true);
});

test("workflow keeps linked documents needing review when quality warnings exist", () => {
  const document = { ...baseDocument, transactionId: "txn-1", extractedText: "Receipt" };
  const warningContext = {
    ...context,
    getDocumentQualityWarnings: () => [{ key: "amount_mismatch", detail: "Amount mismatch needs review." }],
  };

  assert.equal(getDocumentWorkflowStatus(document, warningContext), "needs_review");
  assert.equal(getDocumentPrimaryAction(document, warningContext).key, "review");
  assert.equal(isDocumentReviewed(document, warningContext), false);
});

test("workflow treats linked work orders as reviewed", () => {
  const document = { ...baseDocument, workOrderId: "wo-1", extractedText: "Estimate" };

  assert.equal(getDocumentWorkflowStatus(document, context), "reviewed");
  assert.equal(getDocumentPrimaryAction(document, context).key, "view_linked");
});

test("workflow recognizes supporting-only tag", () => {
  const document = { ...baseDocument, extractedText: "Supporting doc", tags: ["supporting-only"] };

  assert.equal(getDocumentWorkflowStatus(document, context), "supporting_only");
  assert.equal(isDocumentReviewed(document, context), true);
});

test("workflow keeps supporting-only documents needing review when quality warnings exist", () => {
  const document = { ...baseDocument, extractedText: "Supporting doc", tags: ["supporting-only"] };
  const warningContext = {
    ...context,
    getDocumentQualityWarnings: () => [{ key: "low_confidence", detail: "Review extracted fields." }],
  };

  assert.equal(getDocumentWorkflowStatus(document, warningContext), "needs_review");
  assert.equal(isDocumentReviewed(document, warningContext), false);
});

test("workflow keeps linked documents reviewed even if supporting-only tag exists", () => {
  const document = { ...baseDocument, transactionId: "txn-1", extractedText: "Receipt", tags: ["supporting-only"] };

  assert.equal(getDocumentWorkflowStatus(document, context), "reviewed");
  assert.equal(getDocumentPrimaryAction(document, context).key, "view_linked");
});

test("workflow leaves unlinked documents with no suggestion in attachment review", () => {
  const document = { ...baseDocument, extractedText: "General note", tags: ["note"] };

  assert.equal(getDocumentWorkflowStatus(document, context), "needs_attachment");
  assert.equal(getDocumentPrimaryAction(document, context).key, "choose_next_step");
});

test("workflow removes supporting-only tag while preserving other tags", () => {
  assert.deepEqual(removeSupportingOnlyTag(["invoice", "supporting-only", "vendor"]), ["invoice", "vendor"]);
  assert.deepEqual(removeSupportingOnlyTag(["Supporting-Only", "lease"]), ["lease"]);
});

test("attach options prioritize property, unit, then text relevance", () => {
  const document = {
    ...baseDocument,
    unit: "102",
    extractedText: "Example Gas Utility invoice for 2026-05-13",
  };
  const ranked = sortDocumentAttachOptions(document, [
    { id: "other-property", label: "Other property exact vendor", propertyId: "p2", unit: "102", date: "2026-05-13", vendor: "Example Gas Utility" },
    { id: "same-property-unit", label: "Same property and unit", propertyId: "p1", unit: "102", date: "2026-04-01", vendor: "Other" },
    { id: "same-property-date", label: "Same property date match", propertyId: "p1", unit: "Shared", date: "2026-05-13", vendor: "Other" },
  ]);

  assert.deepEqual(ranked.map((option) => option.id), ["same-property-unit", "same-property-date", "other-property"]);
});
