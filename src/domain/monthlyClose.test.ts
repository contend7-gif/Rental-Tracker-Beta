import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyCloseReview, monthBounds } from "./monthlyClose.ts";

test("monthly close recognizes direct and shared document links as expense support", () => {
  const review = buildMonthlyCloseReview({
    month: "2026-08", todayIso: "2026-09-05",
    transactions: ["direct", "shared", "missing"].map((id) => ({
      id, date: "2026-08-10", type: "Expense", amount: 20, status: "active", receiptName: "",
    })) as never[],
    documents: [{ id: "receipt", transactionId: "direct", relatedTransactionIds: ["shared"] }] as never[],
  });
  assert.equal(review?.issues.find((issue) => issue.kind === "missing_support")?.count, 1);
});

test("monthly close accepts a recorded mileage log without a separate receipt", () => {
  const review = buildMonthlyCloseReview({
    month: "2026-08", todayIso: "2026-09-05",
    transactions: [{ id: "mileage", date: "2026-08-10", type: "Expense", category: "Auto and travel", mileageMiles: 20.4, amount: 14.82, status: "active", receiptName: "" }] as never[],
  });
  assert.equal(review?.issues.some((issue) => issue.kind === "missing_support"), false);
});

test("monthly close uses the same early-payment and first-due rules as Loans", () => {
  const loans = [
    { id: "paid", originatedOn: "2025-01-01", scheduledPI: 100 },
    { id: "new", originatedOn: "2026-07-15", scheduledPI: 100 },
    { id: "missing", originatedOn: "2025-01-01", scheduledPI: 100 },
  ] as never[];
  const review = buildMonthlyCloseReview({
    month: "2026-08", todayIso: "2026-09-05", loans,
    loanPayments: [{ loanId: "paid", paymentDate: "2026-07-31" }] as never[],
  });
  assert.equal(review?.issues.find((issue) => issue.kind === "loan_payment")?.count, 1);
});

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

test("close snapshots detect record edits even when counts and totals stay unchanged", () => {
  const base = {
    month: "2026-08", todayIso: "2026-09-05", propertyFilter: "p1",
    transactions: [{ id: "t1", propertyId: "p1", date: "2026-08-01", type: "Expense", amount: 100, category: "Repairs", status: "active", receiptName: "receipt.pdf" }],
    loans: [{ id: "l1", propertyId: "p1", originatedOn: "2025-01-01", scheduledPI: 100 }],
    loanPayments: [{ id: "lp1", loanId: "l1", paymentDate: "2026-08-01", interest: 60, principal: 40, totalPayment: 100 }],
  };
  const review = (args = base) => buildMonthlyCloseReview(args as never)!;
  assert.notEqual(review().signature, review({ ...base, transactions: [{ ...base.transactions[0], category: "Supplies" }] }).signature);
  assert.notEqual(review().signature, review({ ...base, loanPayments: [{ ...base.loanPayments[0], interest: 50, principal: 50 }] }).signature);
  assert.equal(review().signature, review({ ...base, transactions: [...base.transactions, { ...base.transactions[0], id: "other", propertyId: "p2" }] }).signature);
});

test("close signatures ignore record ordering and document preview hydration", () => {
  const base = { month: "2026-08", todayIso: "2026-09-05",
    transactions: ["a", "b"].map(id => ({ id, date: "2026-08-01", type: "Expense", amount: 10, status: "active" })),
    documents: [{ id: "doc", transactionId: "a", name: "Receipt", dataUrl: "" }],
  };
  const first = buildMonthlyCloseReview(base as never)!;
  const hydrated = buildMonthlyCloseReview({ ...base, transactions: [...base.transactions].reverse(), documents: [{ ...base.documents[0], dataUrl: "data:preview" }] } as never)!;
  assert.equal(first.signature, hydrated.signature);
});
