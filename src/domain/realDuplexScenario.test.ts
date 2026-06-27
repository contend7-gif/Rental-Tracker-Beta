import assert from "node:assert/strict";
import { test } from "node:test";

import { BACKUP_SCHEMA_VERSION, normalizeAndMigrateBackup } from "./backupMigrations.ts";
import { buildAssetReviewInbox } from "../features/assets/assetReview.js";
import { buildLoanReviewInbox } from "../features/loans/loanReview.js";
import { buildOccupancyReviewInbox } from "../features/properties/occupancyReview.js";
import { buildTaxReadinessSummary } from "../features/tax/taxReadiness.js";
import { buildTaxPacketSummary, buildTaxSummary } from "../features/tax/taxSummary.js";
import { buildTransactionReviewInbox, getTransactionTaxReadiness } from "../features/transactions/transactionReview.js";
import { isTaxReviewRelevantTransaction } from "../app/accountingShared.js";

const yearFilter = "2026";
const propertyFilter = "sample-duplex";
const todayIso = "2026-12-31";

function createRealDuplexScenario({ includeAsset = true, includeEscrowReview = true } = {}) {
  const property = {
    id: "sample-duplex",
    name: "Sample Duplex",
    address: "100 Example Street",
    type: "Duplex",
    purchasedOn: "2025-12-30",
    purchasePrice: 240000,
    landValue: 40000,
    currentValue: 250000,
    propertyValuations: [{
      id: "valuation-1",
      date: "2025-12-30",
      value: 240000,
      source: "Purchase / closing",
      notes: "Fictional closing support.",
    }],
  };
  const units = [
    { id: "unit-a", propertyId: property.id, name: "Unit A", bedrooms: 2, status: "In Service" },
    { id: "unit-b", propertyId: property.id, name: "Unit B", bedrooms: 2, status: "In Service" },
  ];
  const leases = [{
    id: "lease-b",
    propertyId: property.id,
    unit: "Unit B",
    tenantName: "Example Tenant",
    startDate: "2026-02-01",
    endDate: "2026-12-31",
    originalEndDate: "2026-07-31",
    furnished: true,
    leaseType: "Mid-term furnished",
    status: "Active",
  }];
  const usePeriods = [{
    id: "owner-a",
    propertyId: property.id,
    unit: "Unit A",
    useType: "Owner-Occupied",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    reviewed: true,
  }];
  const transactions = [
    {
      id: "rent-b",
      date: "2026-02-01",
      propertyId: property.id,
      unit: "Unit B",
      type: "Income",
      category: "Rent",
      description: "February furnished rent",
      vendor: "Example Tenant",
      amount: 1800,
      taxChecked: true,
      status: "active",
    },
    {
      id: "cleaning-fee-b",
      date: "2026-02-01",
      propertyId: property.id,
      unit: "Unit B",
      type: "Income",
      category: "Cleaning fee",
      description: "Fictional cleaning fee",
      amount: 150,
      taxChecked: true,
      status: "active",
    },
    {
      id: "utility-shared",
      date: "2026-03-10",
      propertyId: property.id,
      unit: "Shared",
      type: "Expense",
      category: "Utilities",
      description: "Example Utilities electric bill",
      vendor: "Example Utilities",
      amount: 240,
      deductibleAmount: 120,
      servicePeriodStart: "2026-02-15",
      servicePeriodEnd: "2026-03-14",
      taxChecked: true,
      status: "active",
    },
    {
      id: "owner-contribution",
      date: "2026-03-15",
      propertyId: property.id,
      unit: "Shared",
      type: "Owner Contribution",
      category: "Owner Contribution",
      description: "Owner funding transfer",
      amount: 1000,
      deductibleAmount: 1000,
      taxChecked: true,
      status: "active",
    },
    {
      id: "owner-draw",
      date: "2026-04-01",
      propertyId: property.id,
      unit: "Shared",
      type: "Owner Draw",
      category: "Owner Draw",
      description: "Owner draw transfer",
      amount: 500,
      deductibleAmount: 500,
      taxChecked: true,
      status: "active",
    },
    {
      id: "repair-sink",
      date: "2026-05-05",
      propertyId: property.id,
      unit: "Unit B",
      type: "Expense",
      category: "Repairs",
      description: "Example Hardware sink repair",
      vendor: "Example Hardware",
      amount: 325,
      deductibleAmount: 325,
      taxChecked: true,
      status: "active",
    },
    {
      id: "capital-washer",
      date: "2026-06-12",
      propertyId: property.id,
      unit: "Unit B",
      type: "Expense",
      category: "Repairs",
      description: "Furnished unit washer replacement",
      vendor: "Example Hardware",
      amount: 900,
      deductibleAmount: 900,
      capitalImprovement: true,
      taxChecked: true,
      status: "active",
    },
  ];
  const documents = [
    { id: "doc-lease", propertyId: property.id, leaseId: "lease-b", name: "Example furnished lease extension.pdf", type: "Lease" },
    { id: "doc-utility", propertyId: property.id, transactionId: "utility-shared", name: "Example Utilities bill.pdf", type: "Utility bill" },
    { id: "doc-repair", propertyId: property.id, transactionId: "repair-sink", name: "Example Hardware repair receipt.pdf", type: "Receipt" },
    { id: "doc-capital", propertyId: property.id, transactionId: "capital-washer", relatedTransactionIds: ["capital-washer"], name: "Example Hardware washer receipt.pdf", type: "Receipt" },
    { id: "doc-mortgage", propertyId: property.id, name: "Example Bank 1098 mortgage statement.pdf", type: "Mortgage statement", tags: ["supporting-only"] },
  ];
  const loan = {
    id: "loan-1",
    propertyId: property.id,
    lender: "Example Bank",
    loanType: "Primary Mortgage",
    lienPosition: 1,
    originatedOn: "2025-12-30",
    rate: 6,
    originalBalance: 200000,
    currentBalance: 199200,
    scheduledPI: 1400,
    scheduledEscrow: 400,
    scheduledMortgageInsurance: 0,
    defaultExtraPrincipal: 0,
    nextPayment: "2026-02-01",
    yearEndReviews: includeEscrowReview
      ? [{
          year: "2026",
          form1098Received: true,
          form1098Interest: 700,
          escrowPropertyTaxPaid: 250,
          escrowInsurancePaid: 150,
          reviewed: true,
        }]
      : [],
  };
  const loanPayments = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return {
      id: `loan-payment-${month}`,
      loanId: loan.id,
      paymentDate: `2026-${month}-01`,
      interest: index === 0 ? 700 : 0,
      deductibleInterest: index === 0 ? 350 : 0,
      principal: index === 0 ? 800 : 0,
      escrow: index === 0 ? 400 : 0,
      mortgageInsurance: 0,
      totalPayment: index === 0 ? 1900 : 0,
    };
  });
  const assets = includeAsset
    ? [{
        id: "asset-washer",
        propertyId: property.id,
        unit: "Unit B",
        description: "Furnished unit washer replacement",
        type: "Capital Improvement",
        placedInService: "2026-06-12",
        cost: 900,
        basis: 900,
        life: 5,
        currentYearDep: 90,
        yearDepreciation: 90,
        sourceTransactionId: "capital-washer",
      }]
    : [];

  return {
    properties: [property],
    units,
    leases,
    usePeriods,
    transactions,
    documents,
    loans: [loan],
    loanPayments,
    assets,
    workOrders: [],
    tenantLedgerEntries: [],
    vendors: [],
  };
}

function leaseCoverageForScenario(scenario: ReturnType<typeof createRealDuplexScenario>) {
  return scenario.properties.map((property) => ({
    property,
    unitRows: scenario.units
      .filter((unit) => unit.propertyId === property.id)
      .map((unit) => {
        const leasesForUnit = scenario.leases.filter((lease) => lease.propertyId === property.id && lease.unit === unit.name);
        const occupancyForUnit = scenario.usePeriods.filter((period) => period.propertyId === property.id && period.unit === unit.name);
        return {
          unit,
          propertyId: property.id,
          auditStart: "2026-01-01",
          auditEnd: "2026-12-31",
          inServiceForYear: true,
          coveredDays: 365,
          totalDays: 365,
          gaps: [],
          overlaps: [],
          leasesForUnit,
          occupancyForUnit,
        };
      }),
  }));
}

function buildWorkflow(scenario = createRealDuplexScenario()) {
  const occupancyReviewInbox = buildOccupancyReviewInbox(leaseCoverageForScenario(scenario), {
    transactions: scenario.transactions,
    assets: scenario.assets,
    loans: scenario.loans,
    yearFilter,
    todayIso,
  });
  const transactionReviewInbox = buildTransactionReviewInbox(scenario.transactions, {
    documents: scenario.documents,
    assets: scenario.assets,
    isTaxReviewRelevantTransaction,
  });
  const assetReviewInbox = buildAssetReviewInbox({
    assets: scenario.assets,
    transactions: scenario.transactions,
    documents: scenario.documents,
    properties: scenario.properties,
    units: scenario.units,
    leases: scenario.leases,
    usePeriods: scenario.usePeriods,
    yearFilter,
  });
  const loanReviewInbox = buildLoanReviewInbox({
    loans: scenario.loans,
    loanPayments: scenario.loanPayments,
    transactions: scenario.transactions,
    documents: scenario.documents,
    occupancyReviewInbox,
    yearFilter,
    propertyFilter,
    todayIso,
  });
  const taxReadinessSummary = buildTaxReadinessSummary({
    transactionReviewInbox,
    assetReviewInbox,
    maintenanceReviewInbox: { counts: { total: 0 } },
    occupancyReviewInbox,
    tenantLedgerReviewInbox: { counts: { total: 0 } },
    loanReviewInbox,
    documents: scenario.documents,
    yearFilter,
    propertyFilter,
  });
  const taxArgs = {
    ...scenario,
    yearFilter,
    propertyFilter,
    taxReadinessSummary,
    effectiveTransactionDeductibleAmount: (transaction: Record<string, unknown>) => Number(transaction.deductibleAmount ?? transaction.amount ?? 0),
    effectiveLoanPaymentDeductibleInterest: (payment: Record<string, unknown>) => Number(payment.deductibleInterest ?? payment.interest ?? 0),
    assetDepreciationForYear: (asset: Record<string, unknown>) => Number(asset.currentYearDep ?? asset.yearDepreciation ?? 0),
  };

  return {
    scenario,
    transactionReviewInbox,
    assetReviewInbox,
    occupancyReviewInbox,
    loanReviewInbox,
    taxReadinessSummary,
    taxSummary: buildTaxSummary(taxArgs),
    taxPacket: buildTaxPacketSummary(taxArgs),
  };
}

test("owner draw is ledger-only and absent from current Schedule E lines", () => {
  const { taxSummary } = buildWorkflow();
  const currentExpenseRows = Object.values(taxSummary.details).flat().filter((row: any) => row.sourceType === "transaction");

  assert.equal(taxSummary.totalIncome, 1950);
  assert.equal(taxSummary.totalExpenses, 1285);
  assert.equal(currentExpenseRows.some((row: any) => row.sourceId === "owner-draw" || row.source?.id === "owner-draw"), false);
});

test("owner contribution is ledger-only and not deductible", () => {
  const { taxSummary } = buildWorkflow();
  const allRows = Object.values(taxSummary.details).flat();

  assert.equal(taxSummary.totalIncome, 1950);
  assert.equal(allRows.some((row: any) => row.source?.id === "owner-contribution"), false);
});

test("mortgage principal is excluded while interest can appear from loan support", () => {
  const { taxSummary } = buildWorkflow();

  assert.equal(taxSummary.totals.mortgageInterest, 350);
  assert.equal(taxSummary.details.mortgageInterest.length, 1);
  assert.equal(
    Object.values(taxSummary.details).flat().some((row: any) => String(row.description || "").toLowerCase().includes("principal")),
    false,
  );
});

test("escrow deposits are not deductible until review values are entered", () => {
  const noReview = buildWorkflow(createRealDuplexScenario({ includeEscrowReview: false })).taxSummary;
  const reviewed = buildWorkflow(createRealDuplexScenario({ includeEscrowReview: true })).taxSummary;

  assert.equal(noReview.totals.taxes, 0);
  assert.equal(noReview.totals.insurance, 0);
  assert.equal(reviewed.totals.taxes, 250);
  assert.equal(reviewed.totals.insurance, 150);
  assert.equal(reviewed.details.taxes[0].sourceType, "loan_review");
});

test("utility bill with service period remains tax-relevant and appears in utilities", () => {
  const { scenario, taxSummary } = buildWorkflow();
  const utility = scenario.transactions.find((transaction) => transaction.id === "utility-shared");

  assert.equal(getTransactionTaxReadiness(utility, { documents: scenario.documents, assets: scenario.assets, isTaxReviewRelevantTransaction }).key, "ready");
  assert.equal(taxSummary.totals.utilities, 120);
  assert.equal(taxSummary.details.utilities[0].source?.id, "utility-shared");
});

test("capital improvement is excluded from current repairs and clears after asset linkage", () => {
  const beforeAsset = buildWorkflow(createRealDuplexScenario({ includeAsset: false }));
  const afterAsset = buildWorkflow(createRealDuplexScenario({ includeAsset: true }));

  assert.equal(beforeAsset.transactionReviewInbox.some((record) => record.issues.some((issue) => issue.key === "capital_improvement_needs_asset")), true);
  assert.equal(beforeAsset.assetReviewInbox.counts.transactionCandidates, 1);
  assert.equal(afterAsset.transactionReviewInbox.some((record) => record.transaction.id === "capital-washer"), false);
  assert.equal(afterAsset.assetReviewInbox.counts.transactionCandidates, 0);
  assert.equal(afterAsset.taxSummary.totals.repairs, 325);
  assert.equal(afterAsset.taxSummary.totals.depreciation, 90);
});

test("lease extension covers the mid-term rental unit without a false gap", () => {
  const { occupancyReviewInbox, scenario } = buildWorkflow();
  const lease = scenario.leases[0];

  assert.equal(lease.originalEndDate, "2026-07-31");
  assert.equal(lease.endDate, "2026-12-31");
  assert.equal(occupancyReviewInbox.counts.total, 0);
});

test("document-created transaction keeps source document support attached", () => {
  const { scenario, taxPacket } = buildWorkflow();
  const utilityDocument = scenario.documents.find((document) => document.id === "doc-utility");

  assert.equal(utilityDocument?.transactionId, "utility-shared");
  assert.equal(taxPacket.documentChecklist.missingSupport.some((row: any) => row.sourceId === "utility-shared"), false);
});

test("tax packet readiness responds to blocking cleanup state", () => {
  const dirty = buildWorkflow(createRealDuplexScenario({ includeAsset: false, includeEscrowReview: false }));
  const clean = buildWorkflow(createRealDuplexScenario({ includeAsset: true, includeEscrowReview: true }));

  assert.equal(dirty.taxReadinessSummary.status, "needs_review");
  assert.ok(dirty.taxPacket.openItems.length > 0);
  assert.equal(clean.taxReadinessSummary.status, "ready");
  assert.equal(clean.taxPacket.openItems.length, 0);
});

test("backup-normalized data preserves key fictional duplex records", () => {
  const scenario = createRealDuplexScenario();
  const migration = normalizeAndMigrateBackup({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: "1.38.0",
    exportedAt: "2026-12-31T12:00:00.000Z",
    data: scenario,
  });
  const data = migration.backup.data as Record<string, any>;

  assert.equal(data.properties[0].name, "Sample Duplex");
  assert.equal(data.properties[0].address, "100 Example Street");
  assert.deepEqual(data.units.map((unit: any) => unit.name), ["Unit A", "Unit B"]);
  assert.equal(data.leases[0].endDate, "2026-12-31");
  assert.equal(data.usePeriods[0].useType, "Owner-Occupied");
  assert.ok(data.transactions.some((transaction: any) => transaction.id === "owner-draw"));
  assert.ok(data.transactions.some((transaction: any) => transaction.id === "capital-washer"));
  assert.equal(data.documents.find((document: any) => document.id === "doc-utility").transactionId, "utility-shared");
  assert.equal(data.assets[0].sourceTransactionId, "capital-washer");
  assert.equal(data.loans[0].yearEndReviews[0].escrowPropertyTaxPaid, 250);
  assert.equal(data.loanPayments[0].principal, 800);
});
