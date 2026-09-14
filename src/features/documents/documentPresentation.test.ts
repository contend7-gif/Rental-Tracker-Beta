import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDocumentDuplicateCandidates,
  buildDocumentHealthBadges,
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

test("document quality warnings exclude warnings reviewed by the user", () => {
  const warnings = buildDocumentQualityWarnings(
    {
      id: "doc-1",
      extractedText: "Fuzzy receipt text",
      reviewedWarningKeys: ["missing_amount"],
    },
    {
      extractedFields: {
        confidence: "high",
        vendorName: "Fleet Farm",
      },
    },
  );

  assert.equal(warnings.some((warning) => warning.key === "missing_amount"), false);
});

test("document duplicate candidates match same transaction and vendor date amount", () => {
  const current = {
    id: "doc-1",
    name: "Fleet receipt.jpg",
    transactionId: "txn-1",
  };
  const duplicate = {
    id: "doc-2",
    name: "Fleet receipt copy.jpg",
    transactionId: "txn-1",
  };
  const candidates = buildDocumentDuplicateCandidates(current, {
    documents: [current, duplicate],
    getDocumentExtractedFields: (document) => ({
      vendorName: "Fleet Farm",
      invoiceDate: "2026-06-15",
      totalAmount: 40,
      confidence: "high",
    }),
    transactionById: {
      "txn-1": {
        id: "txn-1",
        vendor: "Fleet Farm",
        date: "2026-06-15",
        amount: 40,
      },
    },
  });

  assert.equal(candidates[0]?.document.id, "doc-2");
  assert.ok(candidates[0]?.reasons.includes("same linked record"));

  const warnings = buildDocumentQualityWarnings(current, {
    duplicateCandidates: candidates,
    extractedFields: {
      vendorName: "Fleet Farm",
      invoiceDate: "2026-06-15",
      totalAmount: 40,
      confidence: "high",
    },
  });
  assert.equal(warnings[0]?.key, "duplicate_document");
});

test("document health badges summarize warnings and attachment state", () => {
  const warningBadges = buildDocumentHealthBadges(
    { id: "doc-1", extractedText: "Receipt", ocrStatus: "completed" },
    {
      getDocumentQualityWarnings: () => [
        { key: "amount_mismatch", label: "Amount mismatch" },
        { key: "missing_amount", label: "Amount missing" },
      ],
    },
  );

  assert.deepEqual(warningBadges.map((badge) => badge.label), ["Linked mismatch", "Missing amount"]);

  const readyBadges = buildDocumentHealthBadges(
    { id: "doc-2", extractedText: "Receipt", ocrStatus: "completed" },
    {
      documentSupportsAutomaticOcr: () => true,
      getDocumentExpenseSuggestion: () => null,
      getDocumentLinkedWorkOrder: () => null,
      getDocumentQualityWarnings: () => [],
      getSafeDocumentLinkSuggestion: () => ({ id: "txn-1", kind: "transaction" }),
    },
  );

  assert.ok(readyBadges.some((badge) => badge.label === "Suggested link"));
  assert.ok(readyBadges.some((badge) => badge.label === "Ready to attach"));
});

test("separate monthly bills are not duplicates despite matching vendor and amount", () => {
  const documents = [
    { id: "jan", name: "January internet.pdf", transactionId: "t-jan" },
    { id: "feb", name: "February internet.pdf", transactionId: "t-feb" },
  ];
  const transactionById = {
    "t-jan": { vendor: "Example Internet", amount: 40, date: "2026-01-17" },
    "t-feb": { vendor: "Example Internet", amount: 40, date: "2026-02-17" },
  };
  assert.deepEqual(buildDocumentDuplicateCandidates(documents[0], { documents, transactionById }), []);
  const sameNames = documents.map((document) => ({ ...document, name: "statement.pdf" }));
  assert.deepEqual(buildDocumentDuplicateCandidates(sameNames[0], { documents: sameNames, transactionById }), []);
});

test("OCR invoice dates distinguish monthly subscriptions imported together", () => {
  const documents = [
    { id: "jan", name: "invoice-001.pdf", uploadedAt: "2026-09-14T12:00:00Z" },
    { id: "feb", name: "invoice-002.pdf", uploadedAt: "2026-09-14T12:00:00Z" },
  ];
  const getDocumentExtractedFields = (document) => ({
    vendorName: "Example Software", totalAmount: 20,
    invoiceDate: document.id === "jan" ? "2026-01-05" : "2026-02-05",
  });
  assert.deepEqual(buildDocumentDuplicateCandidates(documents[0], { documents, getDocumentExtractedFields }), []);
  assert.deepEqual(buildDocumentDuplicateCandidates(documents[0], {
    documents, getDocumentExtractedFields: () => ({ vendorName: "Example Software", totalAmount: 20 }),
  }), []);
});

test("different file names still match when vendor amount and invoice date agree", () => {
  const documents = [{ id: "a", name: "original.pdf" }, { id: "b", name: "scan.pdf" }];
  const candidates = buildDocumentDuplicateCandidates(documents[0], {
    documents, getDocumentExtractedFields: () => ({ vendorName: "Example Software", totalAmount: 20, invoiceDate: "2026-01-05" }),
  });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].reasons, ["same amount", "same date", "same vendor"]);
});

test("identical file hashes remain duplicates when names and parsed dates differ", () => {
  const documents = [
    { id: "a", name: "original.pdf", fileHash: "same-hash" },
    { id: "b", name: "renamed.pdf", fileHash: "same-hash" },
  ];
  const candidates = buildDocumentDuplicateCandidates(documents[0], {
    documents, getDocumentExtractedFields: (document) => ({ invoiceDate: document.id === "a" ? "2026-01-05" : "2026-02-05" }),
  });
  assert.equal(candidates.length, 1);
  assert.ok(candidates[0].reasons.includes("same file contents"));
});

test("missing amounts do not count as matching zero-dollar invoices", () => {
  const documents = [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }];
  for (const totalAmount of [null, undefined, ""]) {
    assert.deepEqual(buildDocumentDuplicateCandidates(documents[0], {
      documents, getDocumentExtractedFields: () => ({ vendorName: "Example Software", totalAmount, invoiceDate: "2026-01-05" }),
    }), []);
  }
  assert.equal(buildDocumentDuplicateCandidates(documents[0], {
    documents, getDocumentExtractedFields: () => ({ vendorName: "Example Software", totalAmount: 0, invoiceDate: "2026-01-05" }),
  }).length, 1);
});
