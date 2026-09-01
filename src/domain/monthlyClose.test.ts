import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyCloseReview, monthBounds } from "./monthlyClose.ts";

test("month bounds handle leap years and reject invalid months", () => {
  assert.deepEqual(monthBounds("2028-02"), { monthStart: "2028-02-01", monthEnd: "2028-02-29" });
  assert.equal(monthBounds("2028-13"), null);
});

test("monthly close collects open accounting and operations checks", () => {
  const review = buildMonthlyCloseReview({
    month: "2026-08",
    todayIso: "2026-08-31",
    propertyFilter: "property-1",
    transactions: [
      { id: "expense", date: "2026-08-10", propertyId: "property-1", unit: "A", type: "Expense", amount: 80, vendor: "Water", category: "Utilities", receiptName: "", bankImportId: "bank-1", reconciled: false, status: "active" },
      { id: "other-property", date: "2026-08-10", propertyId: "property-2", unit: "A", type: "Expense", amount: 40, vendor: "Other", category: "Utilities", receiptName: "", status: "active" },
    ] as never[],
    leases: [{ id: "lease-1", propertyId: "property-1", startDate: "2026-01-01" }] as never[],
    tenantLedgerEntries: [
      { id: "charge", leaseId: "lease-1", date: "2026-08-01", kind: "charge", amount: 1000, memo: "Rent", accountingTreatment: "rent_income" },
      { id: "payment", leaseId: "lease-1", date: "2026-08-05", kind: "payment", amount: 900, memo: "Rent payment", accountingTreatment: "rent_income" },
    ] as never[],
    recurringExpenseChecks: [{ patternKey: "repeat-1", propertyId: "property-1", expectedDate: "2026-08-20" }] as never[],
    loans: [{ id: "loan-1", propertyId: "property-1", originatedOn: "2025-01-01", scheduledPI: 900, scheduledEscrow: 200, scheduledMortgageInsurance: 0 }] as never[],
    loanPayments: [],
    workOrders: [{ id: "work-1", propertyId: "property-1", status: "Completed", actualCost: 125, completedAt: "2026-08-12" }] as never[],
    backupValidated: false,
  });

  assert.ok(review);
  assert.deepEqual(review.issues.map((issue) => issue.kind), [
    "bank_match",
    "missing_support",
    "rent_balance",
    "smart_check",
    "loan_payment",
    "maintenance_handoff",
    "backup",
  ]);
  assert.equal(review.summary.transactionCount, 1);
  assert.equal(review.summary.expenses, 80);
  assert.equal(review.summary.rentCharged, 1000);
  assert.equal(review.summary.rentPaid, 900);
});

test("monthly close is ready when reviewed records have no gaps", () => {
  const review = buildMonthlyCloseReview({
    month: "2026-08",
    todayIso: "2026-08-31",
    transactions: [{ id: "income", date: "2026-08-02", propertyId: "property-1", type: "Income", amount: 1000, status: "active" }] as never[],
    backupValidated: true,
  });
  assert.ok(review);
  assert.equal(review.issues.length, 0);
  assert.match(review.signature, /^close-[0-9a-f]{8}$/);
});

