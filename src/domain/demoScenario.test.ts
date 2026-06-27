import assert from "node:assert/strict";
import { test } from "node:test";

import { createFullYearDemoScenario } from "./demoScenario.ts";
import { buildTaxSummary } from "../features/tax/taxSummary.js";

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
