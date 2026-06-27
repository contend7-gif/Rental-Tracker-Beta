import assert from "node:assert/strict";
import test from "node:test";

import { countVisibleSafeSuggestions } from "./useVisibleSafeSuggestionCount.js";

const baseArgs = {
  canAutoCreateExpenseFromSuggestion: () => false,
  canAutoCreateWorkOrderFromSuggestion: () => false,
  getDocumentExpenseSuggestion: () => null,
  getDocumentWorkOrderSuggestion: () => null,
  getSafeDocumentLinkSuggestion: () => null,
  getSafeDocumentTagSuggestions: () => [],
};

test("safe suggestion count excludes documents with quality warnings", () => {
  const visibleDocuments = [
    { id: "safe-doc", name: "safe.pdf", extractedText: "Receipt text", tags: [] },
    { id: "flagged-doc", name: "flagged.pdf", extractedText: "Receipt text", tags: [], transactionId: "txn-1" },
  ];

  const count = countVisibleSafeSuggestions({
    ...baseArgs,
    getSafeDocumentTagSuggestions: (document) => document.id === "safe-doc" || document.id === "flagged-doc" ? [{ tag: "receipt" }] : [],
    getDocumentExtractedFields: (document) => document.id === "flagged-doc"
      ? { confidence: "medium", totalAmount: 50, vendorName: "Vendor", invoiceDate: "2026-06-01" }
      : null,
    transactionById: {
      "txn-1": { id: "txn-1", amount: 75 },
    },
    visibleDocuments,
  });

  assert.equal(count, 1);
});
