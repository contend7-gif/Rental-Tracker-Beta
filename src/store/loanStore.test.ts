import assert from "node:assert/strict";
import test from "node:test";
import type { Loan, LoanPayment } from "../models.ts";
import { createLoanActions, loanIdsNeedRepair, normalizeLoansWithUniqueIds } from "./loanStore.ts";

const baseLoan: Loan = {
  id: "loan-1",
  propertyId: "property-1",
  lender: "Example Bank",
  loanType: "Primary Mortgage",
  lienPosition: 1,
  originatedOn: "2026-01-01",
  rate: 6,
  originalBalance: 100000,
  currentBalance: 99000,
  scheduledPI: 1200,
  scheduledEscrow: 200,
  scheduledMortgageInsurance: 0,
  defaultExtraPrincipal: 0,
  interestYTD: 0,
  principalYTD: 0,
  escrowYTD: 0,
  nextPayment: "2026-02-01",
};

test("normalizeLoansWithUniqueIds repairs duplicate loan ids while keeping the first id stable", () => {
  const loans = normalizeLoansWithUniqueIds([
    { ...baseLoan, id: "loan-1", lender: "Example Primary" },
    { ...baseLoan, id: "loan-1", lender: "Example Second" },
    { ...baseLoan, id: "", lender: "Example Blank" },
  ]);

  assert.equal(loans[0].id, "loan-1");
  assert.equal(loans[1].id, "loan-1-duplicate-2");
  assert.equal(loans[2].id, "loan-duplicate-3");
  assert.equal(new Set(loans.map((loan) => loan.id)).size, loans.length);
});

test("loanIdsNeedRepair detects duplicate and blank ids", () => {
  assert.equal(loanIdsNeedRepair([{ ...baseLoan, id: "loan-1" }, { ...baseLoan, id: "loan-2" }]), false);
  assert.equal(loanIdsNeedRepair([{ ...baseLoan, id: "loan-1" }, { ...baseLoan, id: "loan-1" }]), true);
  assert.equal(loanIdsNeedRepair([{ ...baseLoan, id: "" }]), true);
});

test("loan payment actions keep balances and year totals reversible", () => {
  const currentYear = new Date().toISOString().slice(0, 4);
  let loans: Loan[] = [{ ...baseLoan, currentBalance: 99000, interestYTD: 0, principalYTD: 0, escrowYTD: 0 }];
  let payments: LoanPayment[] = [];
  const setLoans = (updater: Loan[] | ((previous: Loan[]) => Loan[])) => {
    loans = typeof updater === "function" ? updater(loans) : updater;
  };
  const setLoanPayments = (updater: LoanPayment[] | ((previous: LoanPayment[]) => LoanPayment[])) => {
    payments = typeof updater === "function" ? updater(payments) : updater;
  };
  const actions = createLoanActions({
    getLoans: () => loans,
    getLoanPayments: () => payments,
    setLoans,
    setLoanPayments,
    appendActivityLog: () => undefined,
  });
  const payment: LoanPayment = {
    id: "payment-1",
    loanId: baseLoan.id,
    paymentDate: `${currentYear}-03-01`,
    scheduledPI: 1200,
    interest: 500,
    principal: 700,
    escrow: 200,
    mortgageInsurance: 0,
    extraPrincipal: 100,
    totalPayment: 1500,
    deductibleInterest: 500,
  };

  actions.saveLoanPayment(payment);
  assert.equal(loans[0].currentBalance, 98200);
  assert.equal(loans[0].principalYTD, 800);
  assert.equal(loans[0].interestYTD, 500);
  assert.equal(loans[0].escrowYTD, 200);

  actions.updateLoanPayment({ ...payment, principal: 750, extraPrincipal: 150, interest: 450, escrow: 225 });
  assert.equal(loans[0].currentBalance, 98100);
  assert.equal(loans[0].principalYTD, 900);
  assert.equal(loans[0].interestYTD, 450);
  assert.equal(loans[0].escrowYTD, 225);

  actions.deleteLoanPayment(payment.id);
  assert.equal(payments.length, 0);
  assert.equal(loans[0].currentBalance, 99000);
  assert.equal(loans[0].principalYTD, 0);
  assert.equal(loans[0].interestYTD, 0);
  assert.equal(loans[0].escrowYTD, 0);
});
