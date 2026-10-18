import assert from "node:assert/strict";
import { test } from "node:test";

import { createFullYearDemoScenario } from "./demoScenario.ts";
import { buildTaxSummary } from "../features/tax/taxSummary.js";
import { buildLeaseAutomationPlan } from "./leaseAutomation.ts";
import { buildTenantLedgerSummary } from "./tenantLedger.ts";

function buildDemoTaxSummary() {
  const scenario = createFullYearDemoScenario();
  return buildTaxSummary({
    ...scenario,
    yearFilter: "2026",
    propertyFilter: "all",
    taxReadinessSummary: { status: "ready", sections: [] },
    effectiveTransactionDeductibleAmount: (transaction: Record<string, unknown>) => Number(transaction.deductibleAmount ?? transaction.amount ?? 0),
    effectiveLoanPaymentDeductibleInterest: (payment: Record<string, unknown>) => Number(payment.deductibleInterest ?? payment.interest ?? 0),
    assetDepreciationForYear: (asset: Record<string, unknown>) => Number(asset.currentYearDep ?? asset.yearDepreciation ?? 0),
  });
}

test("fictional full-year demo scenario contains required entities", () => {
  const scenario = createFullYearDemoScenario();

  assert.equal(scenario.properties[0].name, "Sample Duplex");
  assert.equal(scenario.units.length, 2);
  assert.ok(scenario.leases.length >= 1);
  assert.ok(scenario.transactions.some((transaction) => transaction.type === "Income"));
  assert.ok(scenario.transactions.some((transaction) => transaction.capitalImprovement));
  assert.ok(scenario.assets.some((asset) => asset.sourceTransactionId === "demo-capital-roof"));
  assert.ok(scenario.workOrders.some((workOrder) => workOrder.transactionId === "demo-repair-expense"));
  assert.ok(scenario.loans[0].yearEndReviews?.some((review) => review.year === "2026" && review.reviewed));
  assert.ok(scenario.documents.some((document) => document.transactionId));
  assert.ok(scenario.tenantLedgerEntries.some((entry) => entry.accountingTreatment === "security_deposit_liability"));
});

test("demo rent receipts cover every sample month without false overdue reminders", () => {
  const scenario = createFullYearDemoScenario();
  const rentTransactions = scenario.transactions.filter((transaction) => transaction.category === "Rent");
  assert.equal(rentTransactions.length, 12);
  for (const transaction of rentTransactions) {
    const receipts = scenario.tenantLedgerEntries.filter((entry) => entry.kind === "payment" && entry.transactionId === transaction.id);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].id, transaction.tenantLedgerEntryId);
    assert.equal(receipts[0].amount, transaction.amount);
    assert.equal(receipts[0].date, transaction.date);
  }
  const defaults = { rentDueDay: 1, reminderDaysBefore: 3, lateFeeGraceDays: 5, lateFeeType: "flat" as const, lateFeeValue: 50, autoLateFeeEnabled: true };
  for (const month of Array.from({ length: 12 }, (_, index) => index + 1)) {
    const todayIso = `2026-${String(month).padStart(2, "0")}-20`;
    const entriesThroughToday = scenario.tenantLedgerEntries.filter((entry) => entry.date <= todayIso);
    assert.equal(buildTenantLedgerSummary(entriesThroughToday).totalDue, 0);
    const plan = buildLeaseAutomationPlan({ leases: scenario.leases, tenantLedgerEntries: entriesThroughToday, todayIso, defaults });
    assert.deepEqual(plan.entries, [], todayIso);
    assert.deepEqual(plan.reminders, [], todayIso);
  }
});

test("fictional full-year demo scenario avoids known private-data markers", () => {
  const text = JSON.stringify(createFullYearDemoScenario());

  assert.equal(text.includes("Sample Duplex"), true);
  assert.equal(text.includes("100 Example Street"), true);
  assert.equal(/\b\d{5}-\d{4}\b/.test(text), false);
  assert.equal(/\b\d{9,}\b/.test(text), false);
});

test("fictional full-year demo scenario produces nonzero tax summary lines", () => {
  const summary = buildDemoTaxSummary();

  assert.ok(summary.totals.rentalIncome > 0);
  assert.ok(summary.totals.utilities > 0);
  assert.ok(summary.totals.repairs > 0);
  assert.ok(summary.totals.mortgageInterest > 0);
  assert.ok(summary.totals.depreciation > 0);
});


test("demo mileage amounts produce a tax net rounded to cents", () => {
  const summary = buildDemoTaxSummary();
  assert.equal(summary.netRentalIncomeLoss, -7807.35);
});
