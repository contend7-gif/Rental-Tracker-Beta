import assert from "node:assert/strict";
import test from "node:test";
import { loanIdsNeedRepair, normalizeLoansWithUniqueIds } from "./loanStore.ts";

const baseLoan = {
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
