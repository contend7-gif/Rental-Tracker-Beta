import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLoanPaymentDraft,
  buildLoanSelectorOptions,
  findLoanById,
  findLoanBySelectorValue,
  loanIdsMatch,
  projectedAmortizationRows,
  reconcileLoanPaymentsAgainstSchedule,
} from "./loans.ts";

test("loan id matching tolerates native select string values", () => {
  const loans = [
    { id: 101, lender: "Example First Bank" },
    { id: 202, lender: "Example Second Bank" },
  ];

  assert.equal(loanIdsMatch(202, "202"), true);
  assert.equal(findLoanById(loans, "202")?.lender, "Example Second Bank");
  assert.equal(findLoanById(loans, "999"), undefined);
});

test("loan payment draft stores loan id as a select-safe string", () => {
  const draft = buildLoanPaymentDraft({ id: 202, nextPayment: "2026-02-01" }, {}, "2026-01-15");

  assert.equal(draft.loanId, "202");
  assert.equal(draft.loanSelectorValue, "202");
});

test("loan selector options use UI-only values instead of persisted loan ids", () => {
  const loans = [
    { id: "loan-1", lender: "Example First Bank" },
    { id: "", lender: "Example Missing Id Bank" },
    { id: "loan-1", lender: "Example Duplicate Id Bank" },
    { id: "loan-4", lender: "Example Unique Id Bank" },
  ];

  const options = buildLoanSelectorOptions(loans);

  assert.deepEqual(options.map((option) => option.value), ["__loan_index_0", "__loan_index_1", "__loan_index_2", "__loan_index_3"]);
  assert.equal(findLoanBySelectorValue(options, "__loan_index_2")?.lender, "Example Duplicate Id Bank");
  assert.equal(findLoanBySelectorValue(options, "__loan_index_3")?.lender, "Example Unique Id Bank");
});

test("projected amortization principal includes scheduled extra principal", () => {
  const rows = projectedAmortizationRows({
    id: "loan-example",
    currentBalance: 1000,
    rate: 0,
    scheduledPI: 100,
    defaultExtraPrincipal: 25,
    nextPayment: "2026-07-01",
  }, 2);

  assert.equal(rows[0].projectedPrincipal, 125);
  assert.equal(rows[0].projectedScheduledPrincipal, 100);
  assert.equal(rows[0].projectedExtraPrincipal, 25);
  assert.equal(rows[0].endingBalance, 875);
  assert.equal(rows[1].projectedPrincipal, 125);
  assert.equal(rows[1].endingBalance, 750);
});

test("loan repair insight ignores immaterial schedule and balance differences", () => {
  const insight = reconcileLoanPaymentsAgainstSchedule({
    loan: {
      id: "loan-example",
      propertyId: "property-example",
      originalBalance: 1000,
      currentBalance: 899,
      rate: 0,
      scheduledPI: 100,
    },
    payments: [
      {
        id: "payment-example",
        loanId: "loan-example",
        paymentDate: "2026-01-01",
        scheduledPI: 100,
        interest: 0,
        principal: 101,
        deductibleInterest: 0,
        totalPayment: 101,
      },
    ],
    usePeriods: [],
    leases: [],
    units: [],
  });

  assert.equal(insight.hasRepairableDifferences, false);
  assert.equal(insight.balanceMismatch, false);
});

test("loan repair insight flags material schedule and balance mismatches", () => {
  const insight = reconcileLoanPaymentsAgainstSchedule({
    loan: {
      id: "loan-example",
      propertyId: "property-example",
      originalBalance: 1000,
      currentBalance: 800,
      rate: 0,
      scheduledPI: 100,
    },
    payments: [
      {
        id: "payment-example",
        loanId: "loan-example",
        paymentDate: "2026-01-01",
        scheduledPI: 100,
        interest: 40,
        principal: 60,
        deductibleInterest: 40,
        totalPayment: 100,
      },
    ],
    usePeriods: [],
    leases: [],
    units: [],
  });

  assert.equal(insight.hasRepairableDifferences, true);
  assert.equal(insight.balanceMismatch, true);
  assert.equal(insight.derivedBalance, 900);
});
