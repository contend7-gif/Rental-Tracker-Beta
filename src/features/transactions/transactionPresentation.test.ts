import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionWorkspaceModes,
  formatRentReportingMonth,
  formatTransactionUnitLabel,
  getRentReportingMonth,
  getTransactionVisual,
  isFutureDatedTransaction,
  ledgerViewForTransactionWorkspaceMode,
  summarizeLedgerTransactions,
  transactionCategoryStatusLabel,
  transactionPostingStatusLabel,
  transactionReconciliationStatusLabel,
  transactionSupportStatusLabel,
  transactionTaxStatusLabel,
} from "./transactionPresentation.js";

test("transaction workspace modes keep activity, cleanup, recurring, and imports distinct", () => {
  const modes = buildTransactionWorkspaceModes({
    attentionCount: 31,
    bankMatchOpenCount: 2,
    expectedRecurringCount: 1,
    importedCount: 8,
    recurringCount: 6,
    transactionCount: 59,
  });

  assert.deepEqual(modes.map((mode) => [mode.key, mode.count]), [
    ["activity", 59],
    ["attention", 31],
    ["recurring", 6],
    ["imports", 8],
  ]);
  assert.match(modes[1].description, /Work Queue/);
  assert.match(modes[2].description, /1 expected posting due/);
  assert.equal(ledgerViewForTransactionWorkspaceMode("activity"), "all");
  assert.equal(ledgerViewForTransactionWorkspaceMode("attention"), "review");
  assert.equal(ledgerViewForTransactionWorkspaceMode("recurring"), "recurring");
  assert.equal(ledgerViewForTransactionWorkspaceMode("imports"), "imported");
});

test("rent reporting month prefers explicit period and understands month descriptions", () => {
  assert.equal(getRentReportingMonth({ type: "Income", category: "Rents received", date: "2026-03-29", rentPeriod: "2026-04" }), "2026-04");
  assert.equal(getRentReportingMonth({ type: "Income", category: "Rents received", date: "2026-03-29", description: "April rent" }), "2026-04");
  assert.equal(getRentReportingMonth({ type: "Income", category: "Rents received", date: "2026-12-29", description: "January rent" }), "2027-01");
  assert.equal(formatRentReportingMonth({ type: "Income", category: "Rents received", date: "2026-03-29", rentPeriod: "2026-04" }), "Apr 2026 rent");
  assert.equal(formatRentReportingMonth({ type: "Expense", category: "Utilities", date: "2026-03-29" }), "");
});

test("transaction unit labels do not duplicate the Unit prefix", () => {
  assert.equal(formatTransactionUnitLabel("B"), "Unit B");
  assert.equal(formatTransactionUnitLabel("Unit B"), "Unit B");
});

test("transaction visuals distinguish common rental categories", () => {
  const rent = getTransactionVisual({ type: "Income", category: "Rents received" });
  const utility = getTransactionVisual({ type: "Expense", category: "Utilities" });
  const repair = getTransactionVisual({ type: "Expense", category: "Repairs" });
  assert.notEqual(rent.Icon, utility.Icon);
  assert.notEqual(utility.Icon, repair.Icon);
  assert.equal(repair.amountClass, "text-rose-700");
});

test("rent income uses mapped tax language instead of not tax relevant", () => {
  const rent = { type: "Income", category: "Rents received", taxChecked: true };
  assert.equal(transactionTaxStatusLabel(rent, { key: "not_tax_relevant", label: "Not tax relevant" }, false), "Tax mapped");
  assert.notEqual(transactionTaxStatusLabel(rent, { key: "not_tax_relevant", label: "Not tax relevant" }, false), "Not tax relevant");
});

test("future-dated transactions compare against today", () => {
  assert.equal(isFutureDatedTransaction({ date: "2026-06-20" }, "2026-06-19"), true);
  assert.equal(isFutureDatedTransaction({ date: "2026-06-19" }, "2026-06-19"), false);
});

test("future-dated scheduled entries do not look reconciled by default", () => {
  const scheduled = { date: "2026-06-20", recurringTemplateId: "rent-template", reconciled: true };
  assert.equal(transactionPostingStatusLabel(scheduled, "2026-06-19"), "Scheduled");
  assert.equal(transactionReconciliationStatusLabel(scheduled, "2026-06-19"), "Scheduled");
  assert.equal(transactionReconciliationStatusLabel({ bankImportId: "import-1", reconciled: false }), "Needs bank match");
  assert.equal(transactionReconciliationStatusLabel({ bankImportId: "import-1", reconciled: true }), "Bank matched");
  assert.equal(transactionReconciliationStatusLabel({ reconciled: false }), "Manual entry");
});

test("tax status distinguishes open sign-off from blocking review", () => {
  assert.equal(transactionTaxStatusLabel({ taxChecked: false }, { key: "needs_review", issues: [{ key: "tax_open" }] }, true), "Review open");
  assert.equal(
    transactionTaxStatusLabel({ taxChecked: false }, { key: "needs_review", issues: [{ key: "tax_open" }, { key: "missing_receipt" }] }, true),
    "Needs tax review",
  );
});

test("ledger summaries can include or exclude future-dated transactions", () => {
  const transactions = [
    { date: "2026-06-18", type: "Income", amount: 1000 },
    { date: "2026-06-20", type: "Income", amount: 500 },
    { date: "2026-06-19", type: "Expense", amount: -100 },
  ];
  assert.deepEqual(summarizeLedgerTransactions(transactions, { todayIso: "2026-06-19", includeFuture: false }), {
    expenses: 100,
    income: 1000,
    netCashflow: 900,
    transactionCount: 2,
  });
  assert.deepEqual(summarizeLedgerTransactions(transactions, { todayIso: "2026-06-19", includeFuture: true }), {
    expenses: 100,
    income: 1500,
    netCashflow: 1400,
    transactionCount: 3,
  });
});

test("rent income uses receipt-not-required support wording when no document is linked", () => {
  const rent = { type: "Income", category: "Rents received" };
  assert.equal(transactionSupportStatusLabel(rent), "Receipt not required");
  assert.equal(transactionSupportStatusLabel(rent, { documentCount: 1 }), "Receipt attached");
  assert.equal(transactionCategoryStatusLabel(rent), "Rent");
});
