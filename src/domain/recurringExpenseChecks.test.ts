import assert from "node:assert/strict";
import test from "node:test";

import type { Transaction } from "../models.ts";
import { buildRecurringExpenseChecks } from "./recurringExpenseChecks.ts";

function expense(id: string, date: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date,
    propertyId: "p1",
    unit: "Shared",
    type: "Expense",
    category: "Utilities",
    description: "Electric service",
    amount: 100,
    ownerUsePct: 0,
    rentalUsePct: 100,
    deductibleAmount: 100,
    paidFrom: "Checking",
    paymentMethod: "ACH",
    reimbursable: false,
    reimbursed: false,
    capitalImprovement: false,
    vendor: "Example Energy",
    receiptName: "",
    notes: "",
    taxChecked: false,
    status: "active",
    ...overrides,
  };
}

test("stable monthly utilities become a review check only after the grace period", () => {
  const transactions = [
    expense("t1", "2026-05-05"),
    expense("t2", "2026-06-05"),
    expense("t3", "2026-07-05"),
  ];

  assert.equal(buildRecurringExpenseChecks({ transactions, todayIso: "2026-08-11" }).length, 0);
  const checks = buildRecurringExpenseChecks({ transactions, todayIso: "2026-08-12" });
  assert.equal(checks.length, 1);
  assert.equal(checks[0].expectedDate, "2026-08-05");
  assert.equal(checks[0].reviewDate, "2026-08-12");
  assert.equal(checks[0].vendor, "Example Energy");
  assert.match(checks[0].patternKey, /^repeat-[0-9a-f]{8}$/);
});

test("irregular, unsupported, voided, and under-observed expenses do not create checks", () => {
  const irregular = [expense("t1", "2026-01-01"), expense("t2", "2026-02-01"), expense("t3", "2026-04-20")];
  const repairs = [expense("r1", "2026-05-01", { category: "Repairs" }), expense("r2", "2026-06-01", { category: "Repairs" }), expense("r3", "2026-07-01", { category: "Repairs" })];
  const voided = [expense("v1", "2026-05-01"), expense("v2", "2026-06-01"), expense("v3", "2026-07-01", { status: "voided" })];
  const twoOnly = [expense("o1", "2026-06-01"), expense("o2", "2026-07-01")];
  assert.deepEqual(buildRecurringExpenseChecks({ transactions: [...irregular, ...repairs, ...voided, ...twoOnly], todayIso: "2026-09-01" }), []);
});

test("active recurring rules suppress a matching inferred check", () => {
  const transactions = [expense("t1", "2026-05-05"), expense("t2", "2026-06-05"), expense("t3", "2026-07-05")];
  const checks = buildRecurringExpenseChecks({
    transactions,
    recurringTemplates: [{
      id: "rt1",
      description: "Example Energy monthly service",
      propertyId: "p1",
      unit: "Shared",
      type: "Expense",
      category: "Utilities",
      amount: 100,
      frequency: "Monthly",
      nextDueDate: "2026-08-05",
      reviewRequired: true,
      ownerUsePct: 0,
      active: true,
    }],
    todayIso: "2026-08-20",
  });
  assert.deepEqual(checks, []);
});

test("marking a missed cycle intentional resumes checking on the next expected cycle", () => {
  const transactions = [expense("t1", "2026-05-05"), expense("t2", "2026-06-05"), expense("t3", "2026-07-05")];
  const first = buildRecurringExpenseChecks({ transactions, todayIso: "2026-08-20" })[0];
  assert.ok(first);

  assert.equal(buildRecurringExpenseChecks({
    transactions,
    todayIso: "2026-08-20",
    acknowledgements: { [first.patternKey]: "2026-08-20" },
  }).length, 0);

  const resumed = buildRecurringExpenseChecks({
    transactions,
    todayIso: "2026-09-12",
    acknowledgements: { [first.patternKey]: "2026-08-20" },
  });
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].expectedDate, "2026-09-05");
});
