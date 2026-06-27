import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTransactionReviewInbox,
  getTransactionReviewIssues,
  getTransactionTaxReadiness,
} from "./transactionReview.js";
import { isTaxReviewRelevantTransaction } from "../../app/accountingShared.js";

const baseTransaction = {
  id: "txn-1",
  date: "2026-05-01",
  propertyId: "p1",
  unit: "616",
  type: "Expense",
  category: "Repairs",
  description: "Sink repair",
  amount: 125,
  receiptName: "receipt.pdf",
  reconciled: true,
  taxChecked: true,
  status: "active",
};

const context = {
  documents: [],
  assets: [],
  isTaxReviewRelevantTransaction: (transaction) => transaction.type === "Expense",
};

test("transaction review flags missing receipts unless a document is attached", () => {
  const transaction = { ...baseTransaction, receiptName: "", taxChecked: false };

  assert.ok(getTransactionReviewIssues(transaction, context).some((issue) => issue.key === "missing_receipt"));
  assert.match(getTransactionReviewIssues(transaction, context).find((issue) => issue.key === "missing_receipt")?.help || "", /receipt/i);
  assert.equal(
    getTransactionReviewIssues(transaction, { ...context, documents: [{ id: "doc-1", transactionId: transaction.id }] })
      .some((issue) => issue.key === "missing_receipt"),
    false,
  );
});

test("document-created related transaction attachment clears missing receipt review", () => {
  const transaction = { ...baseTransaction, receiptName: "", taxChecked: true };
  const issues = getTransactionReviewIssues(transaction, {
    ...context,
    documents: [{ id: "doc-1", relatedTransactionIds: [transaction.id], name: "Fictional utility bill.pdf" }],
  });

  assert.equal(issues.some((issue) => issue.key === "missing_receipt"), false);
});

test("transaction review allows support-unavailable override for missing receipt", () => {
  const transaction = {
    ...baseTransaction,
    receiptName: "",
    taxChecked: false,
    reviewOverrides: { missing_receipt: "not_available" },
  };
  const issues = getTransactionReviewIssues(transaction, context);

  assert.equal(issues.some((issue) => issue.key === "missing_receipt"), false);
  assert.equal(issues.some((issue) => issue.key === "tax_open"), true);
});

test("transaction review flags shared utility expenses without service periods", () => {
  const transaction = { ...baseTransaction, unit: "Shared", category: "Utilities", servicePeriodStart: "", servicePeriodEnd: "" };

  assert.ok(getTransactionReviewIssues(transaction, context).some((issue) => issue.key === "missing_service_period"));
});

test("shared utility with a service period remains tax-relevant and ready", () => {
  const transaction = {
    ...baseTransaction,
    unit: "Shared",
    category: "Utilities",
    description: "Fictional electric bill",
    receiptName: "utility-bill.pdf",
    servicePeriodStart: "2026-02-01",
    servicePeriodEnd: "2026-02-28",
    taxChecked: true,
  };

  assert.equal(isTaxReviewRelevantTransaction(transaction), true);
  assert.equal(getTransactionTaxReadiness(transaction, { ...context, isTaxReviewRelevantTransaction }).key, "ready");
});

test("transaction review catches possible improvements and owner-use overrides", () => {
  const transaction = {
    ...baseTransaction,
    capitalImprovement: false,
    description: "Kitchen cabinet replacement",
    ownerUsePctOverride: true,
  };
  const issueKeys = getTransactionReviewIssues(transaction, context).map((issue) => issue.key);

  assert.ok(issueKeys.includes("possible_improvement"));
  assert.ok(issueKeys.includes("owner_use_override"));
});

test("marking possible improvement as repair suppresses the warning", () => {
  const transaction = {
    ...baseTransaction,
    capitalImprovement: false,
    description: "Kitchen cabinet replacement",
    reviewOverrides: { possible_improvement: "repair_confirmed" },
  };

  assert.equal(getTransactionReviewIssues(transaction, context).some((issue) => issue.key === "possible_improvement"), false);
});

test("capital improvement without linked asset gets asset-needed warning", () => {
  const transaction = {
    ...baseTransaction,
    capitalImprovement: true,
    description: "Kitchen cabinet replacement",
  };

  assert.ok(getTransactionReviewIssues(transaction, context).some((issue) => issue.key === "capital_improvement_needs_asset"));
});

test("capital improvement with linked asset does not get asset-needed warning", () => {
  const transaction = {
    ...baseTransaction,
    capitalImprovement: true,
    description: "Kitchen cabinet replacement",
  };

  assert.equal(
    getTransactionReviewIssues(transaction, { ...context, assets: [{ id: "a1", sourceTransactionId: transaction.id }] })
      .some((issue) => issue.key === "capital_improvement_needs_asset"),
    false,
  );
});

test("transaction readiness is ready only when review issues are clear", () => {
  assert.equal(getTransactionTaxReadiness(baseTransaction, context).key, "ready");
  assert.equal(getTransactionTaxReadiness({ ...baseTransaction, taxChecked: false }, context).key, "needs_review");
});

test("supported utilities remain tax-relevant even when no cleanup is needed", () => {
  const transaction = {
    ...baseTransaction,
    category: "Utilities",
    description: "Electric bill",
    receiptName: "utility-bill.pdf",
    taxChecked: true,
  };

  assert.equal(isTaxReviewRelevantTransaction(transaction), true);
  assert.deepEqual(getTransactionTaxReadiness(transaction, { ...context, isTaxReviewRelevantTransaction }).key, "ready");
});

test("ledger-only expense categories stay outside tax review", () => {
  const transaction = {
    ...baseTransaction,
    category: "Mortgage principal",
    description: "Principal-only payment",
    receiptName: "payment.pdf",
    taxChecked: true,
  };

  assert.equal(isTaxReviewRelevantTransaction(transaction), false);
  assert.equal(getTransactionTaxReadiness(transaction, { ...context, isTaxReviewRelevantTransaction }).key, "not_tax_relevant");
});

test("transaction review inbox sorts highest issue count first", () => {
  const records = buildTransactionReviewInbox([
    { ...baseTransaction, id: "clean" },
    { ...baseTransaction, id: "one", taxChecked: false },
    { ...baseTransaction, id: "two", receiptName: "", taxChecked: false },
  ], context);

  assert.deepEqual(records.map((record) => record.transaction.id), ["two", "one"]);
});
