import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDocumentQualityWarnings,
  buildLinkedRecordSummary,
  formatDocumentUnitLabel,
} from "./documentPresentation.js";

test("document unit labels avoid duplicate Unit prefixes", () => {
  assert.equal(formatDocumentUnitLabel("B"), "Unit B");
  assert.equal(formatDocumentUnitLabel("Unit B"), "Unit B");
  assert.equal(formatDocumentUnitLabel("Shared"), "Shared");
});

test("linked transaction summary includes date, vendor, amount, and clean unit label", () => {
  const summary = buildLinkedRecordSummary(
    { id: "doc-1", transactionId: "txn-1", unit: "Unit B" },
    {
      currency: (value) => `$${Number(value).toFixed(2)}`,
      transactionById: {
        "txn-1": {
          id: "txn-1",
          date: "2026-06-18",
          vendor: "Example Hardware",
          amount: 6200,
          unit: "Unit B",
        },
      },
    },
  );

  assert.equal(summary?.label, "Linked transaction: 2026-06-18 | Example Hardware | $6200.00 | Unit B");
});

test("document quality warnings flag OCR amount mismatch and service amount text", () => {
  const warnings = buildDocumentQualityWarnings(
    {
      id: "doc-1",
      extractedText: "Example invoice text",
    },
    {
      currency: (value) => `$${Number(value).toFixed(2)}`,
      extractedFields: {
        confidence: "medium",
        serviceSummary: "Repairs Amount 6200.00",
        totalAmount: 620,
      },
      linkedTransaction: {
        amount: 6200,
      },
    },
  );

  assert.deepEqual(warnings.map((warning) => warning.key), [
    "low_confidence",
    "amount_mismatch",
    "missing_vendor",
    "missing_date",
    "service_amount_text",
  ]);
});
