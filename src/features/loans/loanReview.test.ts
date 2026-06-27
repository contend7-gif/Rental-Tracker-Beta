import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLoanReviewInbox,
  getLoanReadiness,
  getLoanReviewIssues,
  getMissingLoanPaymentMonths,
} from "./loanReview.js";

const baseLoan = {
  id: "loan-1",
  propertyId: "property-1",
  lender: "Example Bank",
  loanType: "Primary Mortgage",
  lienPosition: 1,
  originatedOn: "2026-01-01",
  rate: 6,
  originalBalance: 120000,
  currentBalance: 119000,
  scheduledPI: 900,
  scheduledEscrow: 250,
  scheduledMortgageInsurance: 50,
  defaultExtraPrincipal: 0,
  interestYTD: 0,
  principalYTD: 0,
  escrowYTD: 0,
  nextPayment: "2026-01-01",
  yearEndReviews: [],
};

function payment(month: string, overrides = {}) {
  return {
    id: `payment-${month}`,
    loanId: "loan-1",
    paymentDate: `2026-${month}-01`,
    scheduledPI: 900,
    interest: 600,
    principal: 300,
    escrow: 250,
    mortgageInsurance: 50,
    extraPrincipal: 0,
    totalPayment: 1200,
    deductibleInterest: 600,
    ...overrides,
  };
}

const twelvePayments = Array.from({ length: 12 }, (_, index) => payment(String(index + 1).padStart(2, "0")));
const context = { yearFilter: "2026", todayIso: "2026-12-31", loanPayments: twelvePayments };

function issueKeys(loan = baseLoan, extraContext = {}) {
  return getLoanReviewIssues(loan, { ...context, ...extraContext }).map((issue) => issue.key);
}

test("loan with selected-year interest and no 1098 review returns missing_1098_review", () => {
  assert.ok(issueKeys().includes("missing_1098_review"));
});

test("loan with missing recorded payment month returns missing_monthly_payments", () => {
  const missing = getMissingLoanPaymentMonths(baseLoan, twelvePayments.slice(0, 11), context);
  assert.deepEqual(missing, ["2026-12"]);
  assert.ok(issueKeys(baseLoan, { loanPayments: twelvePayments.slice(0, 11) }).includes("missing_monthly_payments"));
});

test("late-month first payment can satisfy the next mortgage due month", () => {
  const loan = { ...baseLoan, originatedOn: "2025-12-30", nextPayment: "2026-07-01" };
  const payments = [
    payment("01", { paymentDate: "2026-01-29" }),
    payment("03"),
    payment("04"),
    payment("05"),
    payment("06"),
  ];
  const missing = getMissingLoanPaymentMonths(loan, payments, { yearFilter: "2026", todayIso: "2026-06-02" });
  assert.deepEqual(missing, []);
});

test("1098 interest materially different from recorded interest returns interest_mismatch", () => {
  const loan = { ...baseLoan, yearEndReviews: [{ year: "2026", form1098Received: true, form1098Interest: 5000 }] };
  assert.ok(issueKeys(loan).includes("interest_mismatch"));
});

test("escrow paid but no escrow review returns escrow_not_reviewed", () => {
  assert.ok(issueKeys().includes("escrow_not_reviewed"));
});

test("PMI paid but no PMI review returns pmi_review_needed", () => {
  assert.ok(issueKeys().includes("pmi_review_needed"));
});

test("extra principal exists and not reviewed returns extra_principal_review_needed", () => {
  const payments = twelvePayments.map((item, index) => index === 0 ? { ...item, extraPrincipal: 100, totalPayment: 1300 } : item);
  assert.ok(issueKeys(baseLoan, { loanPayments: payments }).includes("extra_principal_review_needed"));
});

test("loan balance mismatch returns loan_balance_mismatch", () => {
  const loan = { ...baseLoan, currentBalance: 60000 };
  assert.ok(issueKeys(loan).includes("loan_balance_mismatch"));
});

test("incomplete occupancy for property returns occupancy_dependency_open", () => {
  const occupancyReviewInbox = { records: [{ property: { id: "property-1" }, issues: [{ key: "coverage_gap" }] }] };
  assert.ok(issueKeys(baseLoan, { occupancyReviewInbox }).includes("occupancy_dependency_open"));
});

test("reviewed loan with matching annual figures returns readiness key ready", () => {
  const loan = {
    ...baseLoan,
    currentBalance: 116400,
    yearEndReviews: [{
      year: "2026",
      form1098Received: true,
      form1098Interest: 7200,
      form1098MortgageInsurance: 600,
      escrowPropertyTaxPaid: 1800,
      escrowInsurancePaid: 900,
      escrowOtherPaid: 300,
      reviewed: true,
    }],
  };
  const documents = [{ id: "doc-1", propertyId: "property-1", name: "Example 1098 mortgage statement", type: "Mortgage statement" }];
  assert.equal(getLoanReadiness(loan, { ...context, documents }).key, "ready");
});

test("loan with no selected-year activity returns not_applicable", () => {
  const loan = { ...baseLoan, originatedOn: "2027-01-01", nextPayment: "2027-01-01" };
  assert.equal(getLoanReadiness(loan, { yearFilter: "2026", todayIso: "2026-12-31", loanPayments: [] }).key, "not_applicable");
});

test("buildLoanReviewInbox summarizes year-end review counts", () => {
  const inbox = buildLoanReviewInbox({ loans: [baseLoan], loanPayments: twelvePayments, yearFilter: "2026", todayIso: "2026-12-31" });
  assert.equal(inbox.counts.total > 0, true);
  assert.equal(inbox.counts.missing1098Review, 1);
});
