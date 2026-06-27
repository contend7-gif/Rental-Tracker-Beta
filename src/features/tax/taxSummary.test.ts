import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTaxPacketSummary,
  buildTaxSummary,
  buildTaxSummaryTieOut,
  buildTaxLineDetailsCsvRows,
  compareFiledAmounts,
  getTaxDoubleCountingWarnings,
  getTaxCenterReadinessLabel,
} from "./taxSummary.js";
import { buildTaxReadinessSummary } from "./taxReadiness.js";

const baseArgs = {
  yearFilter: "2026",
  propertyFilter: "property-1",
  effectiveTransactionDeductibleAmount: (transaction: Record<string, unknown>) => Number(transaction.deductibleAmount ?? transaction.amount ?? 0),
  effectiveLoanPaymentDeductibleInterest: (payment: Record<string, unknown>) => Number(payment.deductibleInterest ?? payment.interest ?? 0),
  assetDepreciationForYear: (asset: Record<string, unknown>) => Number(asset.yearDepreciation ?? 0),
  taxReadinessSummary: { status: "ready", sections: [] },
};

test("rental income totals selected-year income transactions", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      { id: "t1", date: "2026-01-01", propertyId: "property-1", unit: "A", type: "Income", category: "Rent", amount: 1200, description: "January rent" },
      { id: "t2", date: "2025-01-01", propertyId: "property-1", unit: "A", type: "Income", category: "Rent", amount: 900 },
    ],
  });
  assert.equal(summary.totals.rentalIncome, 1200);
});

test("Schedule E line definitions follow current Part I line numbers", () => {
  const summary = buildTaxSummary(baseArgs);
  assert.deepEqual(
    summary.lineDefs.map((line: any) => [line.line, line.label]),
    [
      ["3", "Rents received"],
      ["4", "Royalties / other income"],
      ["5", "Advertising"],
      ["6", "Auto and travel"],
      ["7", "Cleaning and maintenance"],
      ["8", "Commissions"],
      ["9", "Insurance"],
      ["10", "Legal and other professional fees"],
      ["11", "Management fees"],
      ["12", "Mortgage interest paid to banks, etc."],
      ["13", "Other interest"],
      ["14", "Repairs"],
      ["15", "Supplies"],
      ["16", "Taxes"],
      ["17", "Utilities"],
      ["18", "Depreciation expense or depletion"],
      ["19", "Other"],
    ],
  );
});

test("expense totals exclude capital improvements from current expenses", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      { id: "repair", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Expense", category: "Repairs", amount: 200 },
      { id: "roof", date: "2026-03-01", propertyId: "property-1", unit: "Shared", type: "Expense", category: "Repairs", amount: 9000, capitalImprovement: true },
    ],
  });
  assert.equal(summary.totals.repairs, 200);
});

test("PMI is reported on Schedule E insurance line while preserving loan subtotal", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    effectiveLoanPaymentRentalUsePct: () => 0.5,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", reviewed: true }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", mortgageInsurance: 200 }],
  });
  assert.equal(summary.totals.insurance, 100);
  assert.equal(summary.totals.pmi, 100);
  assert.equal(summary.details.insurance[0].supportSubtype, "pmi");
});

test("owner draw transactions do not feed Schedule E totals", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      { id: "draw", date: "2026-02-01", propertyId: "property-1", unit: "Shared", type: "Owner Draw", category: "Owner Draw", amount: 1000, deductibleAmount: 1000 },
    ],
  });
  assert.equal(summary.totalIncome, 0);
  assert.equal(summary.totalExpenses, 0);
});

test("owner contributions stay ledger-only and do not feed Schedule E totals", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      { id: "contribution", date: "2026-02-01", propertyId: "property-1", unit: "Shared", type: "Owner Contribution", category: "Owner Contribution", amount: 1500, deductibleAmount: 1500 },
    ],
  });
  assert.equal(summary.totalIncome, 0);
  assert.equal(summary.totalExpenses, 0);
});

test("shared expenses use existing deductible/rental-use helper behavior", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    effectiveTransactionDeductibleAmount: () => 60,
    transactions: [
      { id: "utility", date: "2026-02-01", propertyId: "property-1", unit: "Shared", type: "Expense", category: "Utilities", amount: 100 },
    ],
  });
  assert.equal(summary.totals.utilities, 60);
});

test("auto and travel detail can show mileage support", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      {
        id: "mileage",
        date: "2026-02-01",
        propertyId: "property-1",
        unit: "Shared",
        type: "Expense",
        category: "Auto and travel",
        description: "Property inspection mileage",
        amount: 210,
        deductibleAmount: 210,
        mileageMiles: 300,
        mileageRate: 0.7,
      },
    ],
  });
  assert.equal(summary.totals.travel, 210);
  assert.match(summary.details.travel[0].description, /300 miles x \$0\.700\/mi/);
});

test("depreciation total comes from asset depreciation helpers", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    assets: [{ id: "asset-1", propertyId: "property-1", unit: "Shared", description: "Roof", basis: 10000, yearDepreciation: 364 }],
  });
  assert.equal(summary.totals.depreciation, 364);
});

test("mortgage interest total uses loan deductible interest and year-end review override", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", deductibleInterestOverride: 7000, reviewed: true }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500 }],
  });
  assert.equal(summary.totals.mortgageInterest, 7000);
});

test("mortgage principal is excluded even when recorded in loan payments", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", reviewed: true }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500, principal: 900, escrow: 300 }],
  });

  assert.equal(summary.totals.mortgageInterest, 500);
  assert.equal(summary.totalExpenses, 500);
  assert.equal(Object.values(summary.details).flat().some((detail: any) => detail.description?.toLowerCase().includes("principal")), false);
});

test("escrow deposits are not automatically counted as property tax or insurance", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026" }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 500, interest: 0, deductibleInterest: 0 }],
  });
  assert.equal(summary.totals.taxes, 0);
  assert.equal(summary.totals.insurance, 0);
});

test("unreviewed escrow allocation is included as open loan-review support", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", escrowPropertyTaxPaid: 300, escrowInsurancePaid: 200 }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 500 }],
  });

  assert.equal(summary.totals.taxes, 300);
  assert.equal(summary.totals.insurance, 200);
  assert.equal(summary.details.taxes[0].sourceType, "loan_review");
  assert.equal(summary.details.taxes[0].reviewStatus, "open");
});

test("reviewed escrow tax and insurance allocations can appear as tax line support", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", escrowPropertyTaxPaid: 300, escrowInsurancePaid: 200, reviewed: true }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 500 }],
  });
  assert.equal(summary.totals.taxes, 300);
  assert.equal(summary.totals.insurance, 200);
});

test("escrow-derived tax and insurance estimates appear in visible tax summary totals", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    escrowEstimateSupport: {
      taxes: { actual: 700, estimatedFromEscrow: true, estimatedAmount: 700 },
      insurance: { actual: 300, estimatedFromEscrow: true, estimatedAmount: 300 },
    },
  });

  assert.equal(summary.totals.taxes, 700);
  assert.equal(summary.totals.insurance, 300);
  assert.equal(summary.totalExpenses, 1000);
  assert.equal(summary.details.taxes[0].sourceType, "escrow_estimate");
  assert.equal(summary.details.insurance[0].reviewStatus, "open");
});

test("escrow-derived estimates inherit the only scoped property in all-property views", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    propertyFilter: "all",
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026" }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 1000 }],
    transactions: [{ id: "rent-1", date: "2026-01-01", propertyId: "property-1", type: "Income", category: "Rent", amount: 1000 }],
    escrowEstimateSupport: {
      taxes: { estimatedFromEscrow: true, estimatedAmount: 700, rentalUseApplied: true },
      insurance: { estimatedFromEscrow: true, estimatedAmount: 300, rentalUseApplied: true },
    },
  });

  assert.equal(summary.details.taxes[0].propertyId, "property-1");
  assert.equal(summary.details.insurance[0].propertyId, "property-1");
});

test("PMI and escrow-derived estimates follow loan payment rental use", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026" }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 1000, mortgageInsurance: 200 }],
    effectiveLoanPaymentRentalUsePct: () => 0.5,
    escrowEstimateSupport: {
      taxes: { estimatedFromEscrow: true, estimatedAmount: 600 },
      insurance: { estimatedFromEscrow: true, estimatedAmount: 400 },
    },
  });

  assert.equal(summary.totals.pmi, 100);
  assert.equal(summary.totals.taxes, 300);
  assert.equal(summary.totals.insurance, 300);
});

test("already allocated escrow estimates are not split twice", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026" }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", escrow: 1000 }],
    effectiveLoanPaymentRentalUsePct: () => 0.5,
    escrowEstimateSupport: {
      taxes: { estimatedFromEscrow: true, estimatedAmount: 300, rentalUseApplied: true },
    },
  });

  assert.equal(summary.totals.taxes, 300);
});

test("filed amount differences are flagged when materially different", () => {
  const differences = compareFiledAmounts({ rentalIncome: 1200 }, { rentalIncome: 1000 });
  assert.equal(differences.length, 1);
  assert.equal(differences[0].field, "rentalIncome");
});

test("tax summary respects propertyFilter", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [
      { id: "p1", date: "2026-01-01", propertyId: "property-1", type: "Income", category: "Rent", amount: 1000 },
      { id: "p2", date: "2026-01-01", propertyId: "property-2", type: "Income", category: "Rent", amount: 800 },
    ],
  });
  assert.equal(summary.totals.rentalIncome, 1000);
});

test("tax summary marked preliminary when taxReadinessSummary status is needs_review", () => {
  const summary = buildTaxSummary({ ...baseArgs, taxReadinessSummary: { status: "needs_review" } });
  assert.equal(summary.status, "preliminary");
  assert.equal(getTaxCenterReadinessLabel({ status: "needs_review" }).key, "preliminary");
});

test("tax packet includes open items when readiness sections have review counts", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    taxReadinessSummary: { status: "needs_review", sections: [{ key: "loans", label: "Loans", reviewCount: 2, targetView: "loans" }] },
  });
  assert.equal(packet.openItems.length, 1);
  assert.equal(packet.openItems[0].label, "Loans");
});

test("ready tax packet has reviewed schedule state and no cleanup open items", () => {
  const taxReadinessSummary = buildTaxReadinessSummary({
    transactionReviewInbox: [],
    assetReviewInbox: { transactionCandidates: [], assetRecords: [] },
    maintenanceReviewInbox: { counts: { total: 0 } },
    occupancyReviewInbox: { counts: { total: 0 } },
    tenantLedgerReviewInbox: { counts: { total: 0 } },
    loanReviewInbox: { counts: { total: 0 } },
    documents: [{ id: "doc-1", transactionId: "rent", name: "Fictional rent support.pdf" }],
    yearFilter: "2026",
    propertyFilter: "property-1",
  });
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    taxReadinessSummary,
    transactions: [{ id: "rent", date: "2026-01-01", propertyId: "property-1", unit: "A", type: "Income", category: "Rent", amount: 1000, taxChecked: true }],
    documents: [{ id: "doc-1", transactionId: "rent", name: "Fictional rent support.pdf" }],
  });

  assert.equal(taxReadinessSummary.status, "ready");
  assert.equal(packet.scheduleSummary.status, "reviewed");
  assert.equal(packet.openItems.length, 0);
});

test("missing documents/support warnings appear in packet checklist", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    transactions: [{ id: "repair", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Expense", category: "Repairs", amount: 200 }],
    documents: [],
  });
  assert.equal(packet.documentChecklist.missingSupportCount, 1);
});

test("rent income without a document is not treated as a missing receipt", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    transactions: [{ id: "rent", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Income", category: "Rent", amount: 1200, taxChecked: true }],
    documents: [],
  });

  assert.equal(packet.documentChecklist.missingSupportCount, 0);
  assert.equal(packet.documentChecklist.rentIncomeSupportWarnings.length, 0);
});

test("unreviewed rent income without source support is reported separately", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    transactions: [{ id: "rent", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Income", category: "Rent", amount: 1200 }],
    documents: [],
  });

  assert.equal(packet.documentChecklist.missingSupportCount, 0);
  assert.equal(packet.documentChecklist.rentIncomeSupportWarnings.length, 1);
});

test("tax packet groups repeated blocking warnings", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    tenantLedgerEntries: [
      { id: "rent-1", propertyId: "property-1", date: "2026-01-01", kind: "charge", accountingTreatment: "rent_income", memo: "January rent" },
      { id: "rent-2", propertyId: "property-1", date: "2026-02-01", kind: "charge", accountingTreatment: "rent_income", memo: "February rent" },
    ],
  });

  const warning = packet.openItems.find((item) => item.key === "tenant_ledger_unposted_income");
  assert.equal(warning?.reviewCount, 2);
});

test("security deposit liability is not included as rental income", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    tenantLedgerEntries: [{ id: "dep", propertyId: "property-1", date: "2026-01-01", kind: "charge", accountingTreatment: "security_deposit_liability", amount: 1000 }],
  });
  assert.equal(summary.totals.rentalIncome, 0);
});

test("security deposit applied to damages is not automatically double-counted unless posted", () => {
  const warnings = getTaxDoubleCountingWarnings({
    ...baseArgs,
    tenantLedgerEntries: [{ id: "dep-app", propertyId: "property-1", date: "2026-01-01", kind: "charge", accountingTreatment: "security_deposit_applied_damages", memo: "Damage" }],
  });
  assert.equal(warnings.some((warning) => warning.key === "tenant_ledger_unposted_income"), false);
});

test("tenant ledger rent charge without income transaction creates unposted income warning", () => {
  const warnings = getTaxDoubleCountingWarnings({
    ...baseArgs,
    tenantLedgerEntries: [{ id: "rent-charge", propertyId: "property-1", date: "2026-01-01", kind: "charge", accountingTreatment: "rent_income", memo: "January rent" }],
  });
  assert.equal(warnings.some((warning) => warning.key === "tenant_ledger_unposted_income"), true);
});

test("tenant fee with linked income transaction does not warn", () => {
  const warnings = getTaxDoubleCountingWarnings({
    ...baseArgs,
    tenantLedgerEntries: [{ id: "fee", propertyId: "property-1", date: "2026-01-01", kind: "charge", accountingTreatment: "fee_income", memo: "Pet fee", transactionId: "txn-fee" }],
    transactions: [{ id: "txn-fee", tenantLedgerEntryId: "fee", propertyId: "property-1", date: "2026-01-01", type: "Income", amount: 50 }],
  });
  assert.equal(warnings.some((warning) => warning.key === "tenant_ledger_unposted_income"), false);
});

test("escrow allocation plus same-category transaction creates double-counting warning", () => {
  const warnings = getTaxDoubleCountingWarnings({
    ...baseArgs,
    loans: [{ id: "loan", propertyId: "property-1", yearEndReviews: [{ year: "2026", escrowPropertyTaxPaid: 500, escrowInsurancePaid: 300 }] }],
    transactions: [
      { id: "tax", propertyId: "property-1", date: "2026-01-01", type: "Expense", category: "Taxes", amount: 500 },
      { id: "ins", propertyId: "property-1", date: "2026-01-01", type: "Expense", category: "Insurance", amount: 300 },
    ],
  });
  assert.equal(warnings.some((warning) => warning.key === "escrow_tax_possible_duplicate"), true);
  assert.equal(warnings.some((warning) => warning.key === "escrow_insurance_possible_duplicate"), true);
});

test("mortgage interest override replaces computed deductible interest in summary", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", deductibleInterestOverride: 7000 }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500 }],
  });
  assert.equal(summary.totals.mortgageInterest, 7000);
});

test("mortgage interest override row clearly identifies sourceType override", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", deductibleInterestOverride: 7000 }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500 }],
  });
  assert.equal(summary.details.mortgageInterest[0].sourceType, "override");
});

test("blank mortgage interest override keeps computed deductible interest", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", deductibleInterestOverride: "" }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500 }],
  });
  assert.equal(summary.totals.mortgageInterest, 500);
  assert.equal(summary.details.mortgageInterest[0].sourceType, "loan");
});

test("Schedule E detail CSV includes expected columns", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [{ id: "repair", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Expense", category: "Repairs", amount: 200 }],
  });
  const csv = buildTaxLineDetailsCsvRows(summary);
  assert.match(csv.split("\n")[0], /Tax line,Date,Source type,Description/);
  assert.match(csv, /Repairs/);
});

test("detail CSV keeps capital improvements out of current expense rows", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    transactions: [{ id: "roof", date: "2026-02-01", propertyId: "property-1", unit: "Shared", type: "Expense", category: "Repairs", amount: 9000, capitalImprovement: true }],
  });
  assert.equal(buildTaxLineDetailsCsvRows(summary).includes("roof"), false);
});

test("detail CSV includes loan override and depreciation rows", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    loans: [{ id: "loan-1", propertyId: "property-1", lender: "Example Bank", yearEndReviews: [{ year: "2026", deductibleInterestOverride: 7000 }] }],
    loanPayments: [{ id: "lp1", loanId: "loan-1", paymentDate: "2026-01-01", interest: 600, deductibleInterest: 500 }],
    assets: [{ id: "asset-1", propertyId: "property-1", unit: "Shared", description: "Roof", basis: 10000, yearDepreciation: 364 }],
  });
  const csv = buildTaxLineDetailsCsvRows(summary);
  assert.match(csv, /override/);
  assert.match(csv, /Depreciation/);
});

test("tax packet helper excludes sensitive note fields", () => {
  const packet = buildTaxPacketSummary({
    ...baseArgs,
    transactions: [{ id: "repair", date: "2026-02-01", propertyId: "property-1", unit: "A", type: "Expense", category: "Repairs", amount: 200, privateNotes: "do not export" }],
  });
  assert.equal(JSON.stringify(packet).includes("do not export"), false);
});

test("filed amount difference without note returns Needs note", () => {
  const summary = buildTaxSummary({
    ...baseArgs,
    filedAmounts: { rentalIncome: 900 },
    transactions: [{ id: "rent", date: "2026-01-01", propertyId: "property-1", type: "Income", category: "Rent", amount: 1000 }],
  });
  assert.equal(summary.computedFiledRows.find((row) => row.field === "rentalIncome")?.status, "needs_note");
});

test("tax summary tie-out flags difference between legacy snapshot and new summary", () => {
  const rows = buildTaxSummaryTieOut({
    taxSnapshot: { metrics: { grossRent: 1000, opExp: 100, deductibleLoanInterest: 50, depreciation: 25, scheduleE: 825 } },
    taxReportingSummary: { totalIncome: 900, totals: { repairs: 100, mortgageInterest: 50, depreciation: 25 }, netRentalIncomeLoss: 725 },
  });
  assert.equal(rows.find((row) => row.key === "grossRent")?.material, true);
});

test("matching tie-out totals return no material differences", () => {
  const rows = buildTaxSummaryTieOut({
    taxSnapshot: { metrics: { grossRent: 1000, opExp: 100, deductibleLoanInterest: 50, depreciation: 25, scheduleE: 825 } },
    taxReportingSummary: { totalIncome: 1000, totals: { repairs: 100, mortgageInterest: 50, depreciation: 25 }, netRentalIncomeLoss: 825 },
  });
  assert.equal(rows.filter((row) => row.material).length, 0);
});

test("non-comparable tie-out fields include helper text", () => {
  const rows = buildTaxSummaryTieOut({ taxSnapshot: { metrics: {} }, taxReportingSummary: { totals: {} } });
  assert.equal(rows.find((row) => row.key === "scheduleE")?.comparable, false);
  assert.match(rows.find((row) => row.key === "scheduleE")?.helperText || "", /different grouping/);
});
