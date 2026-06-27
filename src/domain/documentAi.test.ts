import test from "node:test";
import assert from "node:assert/strict";
import { documentAiActionLabel, normalizeDocumentAiAnalysis } from "./documentAi.ts";

test("normalizeDocumentAiAnalysis trims and preserves useful AI analysis fields", () => {
  const result = normalizeDocumentAiAnalysis({
    summary: "  Tenant-ready invoice for plumbing repair.  ",
    actionItems: [" Review vendor total ", "Review vendor total", "Create expense draft"],
    suggestedAction: "create_expense_draft",
    suggestedActionReason: "  Total, vendor, and date were all present in the OCR text. ",
    vendorName: "  Badger Plumbing  ",
    invoiceRef: " INV-204 ",
    invoiceDate: "2026-03-20",
    dueDate: "2026-04-01",
    totalAmount: "425.32",
    propertyAddress: "  412 State St ",
    unit: "2A",
    serviceSummary: "  Replaced leaking shutoff valve. ",
    model: "gpt-4o-mini",
    analyzedAt: "2026-03-25T12:00:00.000Z",
  });

  assert.equal(result?.summary, "Tenant-ready invoice for plumbing repair.");
  assert.deepEqual(result?.actionItems, ["Review vendor total", "Create expense draft"]);
  assert.equal(result?.suggestedAction, "create_expense_draft");
  assert.equal(result?.vendorName, "Badger Plumbing");
  assert.equal(result?.invoiceRef, "INV-204");
  assert.equal(result?.totalAmount, 425.32);
  assert.equal(result?.serviceSummary, "Replaced leaking shutoff valve.");
});

test("documentAiActionLabel falls back to review only for unknown actions", () => {
  assert.equal(documentAiActionLabel("create_work_order_draft"), "Create work order draft");
  assert.equal(documentAiActionLabel("unknown"), "Review only");
});
