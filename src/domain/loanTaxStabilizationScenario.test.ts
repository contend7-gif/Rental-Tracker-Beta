import assert from "node:assert/strict";
import test from "node:test";
import { deductibleMortgageInterest, getRentalUsePctForDate } from "./accounting.ts";
import {
  buildLoanSelectorOptions,
  findLoanById,
  findLoanBySelectorValue,
  loanIdsMatch,
  projectedAmortizationRows,
} from "./loans.ts";
import { normalizeLoansWithUniqueIds } from "../store/loanStore.ts";
import { buildLoanReviewInbox, getMissingLoanPaymentMonths } from "../features/loans/loanReview.js";
import { getPropertyPurchaseValueSupport } from "../features/properties/propertyOperations.js";
import { buildTaxPacketSummary, buildTaxSummary } from "../features/tax/taxSummary.js";
import { buildTaxReadinessSummary } from "../features/tax/taxReadiness.js";

const yearFilter = "2026";
// Release-smoke invariants: selected loan, duplicate loan, missing month, principal, escrow, PMI, 1098, LTV, Tax Center.
const property = {
  id: "fictional-duplex",
  name: "Fictional Harbor Duplex",
  address: "100 Example Ave",
  type: "Duplex",
  purchasedOn: "2025-12-30",
  purchasePrice: 263000,
  currentValue: 257206.25,
  propertyValuations: [
    { id: "valuation-current", date: "2026-06-01", value: 257206.25, source: "Manual estimate" },
    { id: "valuation-closing", date: "2025-12-30", value: 254000, source: "Purchase / closing" },
  ],
};
const units = [
  { id: "unit-owner", propertyId: property.id, name: "Owner", status: "Owner-Occupied" },
  { id: "unit-rental", propertyId: property.id, name: "Rental", status: "Rental" },
];
const usePeriods = [
  { id: "owner-use", propertyId: property.id, unit: "Owner", startDate: "2025-12-30", useType: "Owner-Occupied", rentalUsePct: 0, reviewed: true },
];
const leases = [
  {
    id: "lease-rental",
    propertyId: property.id,
    unit: "Rental",
    tenantName: "Fictional Tenant",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRent: 1000,
    rentalType: "Long-term",
    utilitiesIncluded: false,
    monthToMonthAfterTerm: false,
    extensionTermMonths: 0,
    status: "Active",
    notes: "",
  },
];
const documents = [
  { id: "doc-1098", propertyId: property.id, name: "Fictional 2026 1098 mortgage statement", type: "Mortgage statement" },
];

const rawLoans = [
  {
    id: "loan-primary",
    propertyId: property.id,
    lender: "Fictional First Bank",
    loanType: "Primary Mortgage",
    lienPosition: 1,
    originatedOn: "2025-12-30",
    rate: 5.75,
    originalBalance: 241247.25,
    currentBalance: 239554.49,
    scheduledPI: 1408.16,
    scheduledEscrow: 450,
    scheduledMortgageInsurance: 60,
    defaultExtraPrincipal: 29,
    interestYTD: 0,
    principalYTD: 0,
    escrowYTD: 0,
    nextPayment: "2026-07-01",
    yearEndReviews: [{
      year: yearFilter,
      form1098Received: true,
      form1098Interest: 5600,
      escrowPropertyTaxPaid: 1400,
      escrowInsurancePaid: 600,
      escrowOtherPaid: 250,
      pmiOverride: 150,
      reviewNotes: "Fictional review confirms escrow split, PMI allocation, and extra principal as non-deductible principal.",
      reviewed: true,
      reviewedAt: "2026-12-31",
    }],
  },
  {
    id: "loan-primary",
    propertyId: property.id,
    lender: "Fictional Second Bank",
    loanType: "Second Mortgage",
    lienPosition: 2,
    originatedOn: "2026-02-15",
    rate: 8,
    originalBalance: 12000,
    currentBalance: 11012.04,
    scheduledPI: 180,
    scheduledEscrow: 0,
    scheduledMortgageInsurance: 0,
    defaultExtraPrincipal: 0,
    interestYTD: 0,
    principalYTD: 0,
    escrowYTD: 0,
    nextPayment: "2026-07-01",
    yearEndReviews: [{
      year: yearFilter,
      form1098Received: true,
      form1098Interest: 195,
      deductibleInterestOverride: 80,
      reviewNotes: "Fictional override intentionally differs from computed support for review visibility.",
      reviewed: false,
    }],
  },
  {
    id: "",
    propertyId: property.id,
    lender: "Fictional Legacy Blank",
    loanType: "Other",
    lienPosition: 3,
    originatedOn: "2026-01-01",
    rate: 0,
    originalBalance: 0,
    currentBalance: 0,
    scheduledPI: 0,
    scheduledEscrow: 0,
    scheduledMortgageInsurance: 0,
    defaultExtraPrincipal: 0,
    interestYTD: 0,
    principalYTD: 0,
    escrowYTD: 0,
    nextPayment: "2026-01-01",
    yearEndReviews: [],
  },
];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function rentalUsePctForLoanPayment(payment: Record<string, unknown>) {
  return getRentalUsePctForDate({
    propertyId: property.id,
    unit: "Shared",
    date: String(payment.paymentDate),
    usePeriods,
    leases,
    units,
  });
}

function deductibleInterestForPayment(payment: Record<string, unknown>) {
  return deductibleMortgageInterest({
    interest: Number(payment.interest || 0),
    propertyId: property.id,
    date: String(payment.paymentDate || ""),
    usePeriods,
    leases,
    units,
  });
}

test("loan and tax stabilization scenario locks selected loan, allocation, escrow, 1098, LTV, and packet totals", () => {
  const selectorOptions = buildLoanSelectorOptions(rawLoans);
  assert.equal(findLoanBySelectorValue(selectorOptions, "__loan_index_0")?.lender, "Fictional First Bank");
  assert.equal(findLoanBySelectorValue(selectorOptions, "__loan_index_1")?.lender, "Fictional Second Bank");
  assert.equal(loanIdsMatch(101, "101"), true);
  assert.equal(findLoanById([{ id: 101, lender: "Numeric Fictional Loan" }], "101")?.lender, "Numeric Fictional Loan");

  const loans = normalizeLoansWithUniqueIds(rawLoans);
  const primary = loans[0];
  const second = loans[1];
  assert.equal(primary.id, "loan-primary");
  assert.equal(second.id, "loan-primary-duplicate-2");
  assert.equal(loans[2].id, "loan-duplicate-3");

  const loanPayments = [
    { id: "primary-jan", loanId: primary.id, paymentDate: "2026-01-29", scheduledPI: 1408.16, interest: 1200, principal: 208.16, escrow: 450, mortgageInsurance: 60, extraPrincipal: 0, totalPayment: 1918.16, deductibleInterest: 600 },
    { id: "primary-mar", loanId: primary.id, paymentDate: "2026-03-01", scheduledPI: 1408.16, interest: 1100, principal: 308.16, escrow: 450, mortgageInsurance: 60, extraPrincipal: 29, totalPayment: 1947.16, deductibleInterest: 550 },
    { id: "primary-apr", loanId: primary.id, paymentDate: "2026-04-01", scheduledPI: 1408.16, interest: 1100, principal: 308.16, escrow: 450, mortgageInsurance: 60, extraPrincipal: 29, totalPayment: 1947.16, deductibleInterest: 550 },
    { id: "primary-may", loanId: primary.id, paymentDate: "2026-05-01", scheduledPI: 1408.16, interest: 1100, principal: 308.16, escrow: 450, mortgageInsurance: 60, extraPrincipal: 29, totalPayment: 1947.16, deductibleInterest: 550 },
    { id: "primary-jun", loanId: primary.id, paymentDate: "2026-06-01", scheduledPI: 1408.16, interest: 1100, principal: 308.16, escrow: 450, mortgageInsurance: 60, extraPrincipal: 29, totalPayment: 1947.16, deductibleInterest: 550 },
    { id: "second-apr", loanId: second.id, paymentDate: "2026-04-01", scheduledPI: 180, interest: 100, principal: 80, escrow: 0, mortgageInsurance: 0, extraPrincipal: 0, totalPayment: 180, deductibleInterest: 50 },
    { id: "second-jun", loanId: second.id, paymentDate: "2026-06-01", scheduledPI: 180, interest: 95, principal: 85, escrow: 0, mortgageInsurance: 0, extraPrincipal: 0, totalPayment: 180, deductibleInterest: 47.5 },
  ];
  assert.equal(loanPayments.find((payment) => payment.id === "primary-jan")?.loanId, primary.id);
  assert.equal(loanPayments.find((payment) => payment.id === "second-apr")?.loanId, second.id);

  assert.deepEqual(getMissingLoanPaymentMonths(primary, loanPayments, { yearFilter, todayIso: "2026-06-02" }), []);
  assert.deepEqual(getMissingLoanPaymentMonths(second, loanPayments, { yearFilter, todayIso: "2026-06-02" }), ["2026-05"]);

  const loanReviewInbox = buildLoanReviewInbox({
    loans,
    loanPayments,
    documents,
    yearFilter,
    todayIso: "2026-06-02",
    getDeductibleInterest: deductibleInterestForPayment,
  });
  const secondReview = loanReviewInbox.records.find((record) => record.loan.id === second.id);
  assert.deepEqual(secondReview?.missingMonths, ["2026-05"]);
  assert.equal(secondReview?.issues.some((issue) => issue.key === "missing_monthly_payments" && issue.detail.includes("2026-05")), true);
  assert.equal(loanReviewInbox.records.some((record) => record.loan.id === primary.id && record.issues.some((issue) => issue.key === "missing_monthly_payments")), false);

  const amortization = projectedAmortizationRows(primary, 1);
  assert.equal(amortization[0].projectedExtraPrincipal, 29);
  assert.equal(amortization[0].endingBalance < primary.currentBalance, true);

  const taxReadinessSummary = buildTaxReadinessSummary({ loanReviewInbox, documents, yearFilter, propertyFilter: property.id });
  const taxArgs = {
    yearFilter,
    propertyFilter: property.id,
    transactions: [{ id: "rent-jan-jun", date: "2026-06-01", propertyId: property.id, unit: "Rental", type: "Income", category: "Rent", amount: 6000, taxChecked: true }],
    loans: [primary, second],
    loanPayments,
    assets: [{ id: "asset-building", propertyId: property.id, unit: "Shared", description: "Fictional building basis", basis: 213000, yearDepreciation: 1000, assetReviewChecked: true }],
    documents,
    effectiveTransactionDeductibleAmount: (transaction: Record<string, unknown>) => Number(transaction.deductibleAmount ?? transaction.amount ?? 0),
    effectiveLoanPaymentDeductibleInterest: deductibleInterestForPayment,
    effectiveLoanPaymentRentalUsePct: rentalUsePctForLoanPayment,
    assetDepreciationForYear: (asset: Record<string, unknown>) => Number(asset.yearDepreciation || 0),
    taxReadinessSummary,
  };
  const taxSummary = buildTaxSummary(taxArgs);
  const taxPacket = buildTaxPacketSummary(taxArgs);

  assert.equal(round(rentalUsePctForLoanPayment(loanPayments[0])), 0.5);
  assert.equal(round(taxSummary.totals.mortgageInterest), 2880);
  assert.equal(round(taxSummary.totals.taxes), 700);
  assert.equal(round(taxSummary.totals.insurance), 450);
  assert.equal(round(taxSummary.totals.pmi), 150);
  assert.equal(round(taxSummary.totals.depreciation), 1000);
  assert.equal(round(taxSummary.totalIncome), 6000);
  assert.equal(round(taxSummary.totalExpenses), 5030);
  assert.equal(round(taxSummary.netRentalIncomeLoss), 970);
  assert.equal(taxSummary.details.mortgageInterest.length, 2);
  assert.equal(taxSummary.details.mortgageInterest.find((detail) => detail.source?.id === second.id)?.sourceType, "override");
  assert.equal(taxSummary.details.repairs.length, 0);

  assert.equal(round(taxPacket.loanSummary.mortgageInterest), round(taxSummary.totals.mortgageInterest));
  assert.equal(round(taxPacket.loanSummary.reviewedEscrowTaxes), round(taxSummary.totals.taxes));
  assert.equal(round(taxPacket.loanSummary.reviewedEscrowInsurance), 300);
  assert.equal(round(taxPacket.loanSummary.pmi), round(taxSummary.totals.pmi));
  assert.equal(taxPacket.openItems.some((item) => item.key === "loans"), true);

  const purchaseSupport = getPropertyPurchaseValueSupport(property);
  const totalBalance = primary.currentBalance + second.currentBalance;
  const ltvVsPurchase = (totalBalance / purchaseSupport.value) * 100;
  const ltvVsCurrentValue = (totalBalance / property.currentValue) * 100;
  assert.equal(purchaseSupport.value, 254000);
  assert.equal(round(ltvVsPurchase), 98.65);
  assert.equal(round(ltvVsCurrentValue), 97.42);
});
