import assert from "node:assert/strict";
import test from "node:test";
import { buildEscrowAllocationEstimate } from "./taxEscrow.ts";

test("buildEscrowAllocationEstimate uses same-property history to split escrow when both categories are missing", () => {
  const estimate = buildEscrowAllocationEstimate({
    year: "2026",
    currentYear: "2026",
    propertyFilter: "p1",
    unitFilter: "all",
    loans: [
      { id: "l1", propertyId: "p1", escrowYTD: 1200 },
    ],
    loanPayments: [
      { id: "lp1", loanId: "l1", paymentDate: "2026-03-01", escrow: 1200 },
    ],
    transactions: [
      { id: "t1", propertyId: "p1", type: "Expense", category: "Taxes", amount: 1800 },
      { id: "t2", propertyId: "p1", type: "Expense", category: "Insurance", amount: 600 },
    ],
    escrowDisbursements: [],
    directTaxesAmount: 0,
    directInsuranceAmount: 0,
    taxesOverridden: false,
    insuranceOverridden: false,
  });

  assert.equal(estimate.escrowTotal, 1200);
  assert.equal(estimate.taxesEstimate, 900);
  assert.equal(estimate.insuranceEstimate, 300);
  assert.equal(estimate.taxesSource, "property_history");
  assert.equal(estimate.insuranceSource, "property_history");
});

test("buildEscrowAllocationEstimate uses residual escrow when one category is already supported", () => {
  const estimate = buildEscrowAllocationEstimate({
    year: "2026",
    currentYear: "2026",
    propertyFilter: "p1",
    unitFilter: "all",
    loans: [
      { id: "l1", propertyId: "p1", escrowYTD: 1200 },
    ],
    loanPayments: [
      { id: "lp1", loanId: "l1", paymentDate: "2026-03-01", escrow: 1200 },
    ],
    transactions: [],
    escrowDisbursements: [],
    directTaxesAmount: 900,
    directInsuranceAmount: 0,
    taxesOverridden: false,
    insuranceOverridden: false,
  });

  assert.equal(estimate.taxesEstimate, 0);
  assert.equal(estimate.insuranceEstimate, 300);
  assert.equal(estimate.insuranceSource, "residual_after_taxes");
});

test("buildEscrowAllocationEstimate falls back to current-year escrowYTD when payment history is missing", () => {
  const estimate = buildEscrowAllocationEstimate({
    year: "2026",
    currentYear: "2026",
    propertyFilter: "p1",
    unitFilter: "all",
    loans: [
      { id: "l1", propertyId: "p1", escrowYTD: 840 },
    ],
    loanPayments: [],
    transactions: [],
    escrowDisbursements: [],
    directTaxesAmount: 0,
    directInsuranceAmount: 0,
    taxesOverridden: false,
    insuranceOverridden: false,
  });

  assert.equal(estimate.escrowTotal, 840);
  assert.equal(estimate.taxesEstimate, 420);
  assert.equal(estimate.insuranceEstimate, 420);
  assert.equal(estimate.taxesSource, "equal_split");
});
