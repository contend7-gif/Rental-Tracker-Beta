import assert from "node:assert/strict";
import { test } from "node:test";

import { BACKUP_SCHEMA_VERSION, normalizeAndMigrateBackup } from "./backupMigrations.ts";
import { createFullYearDemoScenario } from "./demoScenario.ts";
import { buildAssetReviewInbox } from "../features/assets/assetReview.js";
import { buildLoanReviewInbox } from "../features/loans/loanReview.js";
import { buildMaintenanceReviewInbox } from "../features/maintenance/maintenanceReview.js";
import { buildOccupancyReviewInbox } from "../features/properties/occupancyReview.js";
import { buildTaxReadinessSummary } from "../features/tax/taxReadiness.js";
import { buildTaxPacketSummary, buildTaxSummary } from "../features/tax/taxSummary.js";
import { buildTenantLedgerReviewInbox } from "../features/leases/tenantLedgerReview.js";
import { buildTransactionReviewInbox } from "../features/transactions/transactionReview.js";

function buildLeaseCoverageByProperty(scenario: ReturnType<typeof createFullYearDemoScenario>) {
  return scenario.properties.map((property) => ({
    property,
    unitRows: scenario.units
      .filter((unit) => unit.propertyId === property.id)
      .map((unit) => ({
        unit,
        propertyId: property.id,
        inServiceForYear: true,
        coveredDays: 365,
        gaps: [],
        overlaps: [],
        occupancyForUnit: scenario.usePeriods.filter((period) => period.propertyId === property.id && period.unit === unit.name),
        leasesForUnit: scenario.leases.filter((lease) => lease.propertyId === property.id && lease.unit === unit.name),
      })),
  }));
}

function buildWorkflow() {
  const scenario = createFullYearDemoScenario();
  const yearFilter = "2026";
  const propertyFilter = "all";
  const transactionReviewInbox = buildTransactionReviewInbox(scenario.transactions, {
    documents: scenario.documents,
    assets: scenario.assets,
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
  const maintenanceReviewInbox = buildMaintenanceReviewInbox(scenario.workOrders, {
    documents: scenario.documents,
    assets: scenario.assets,
    transactions: scenario.transactions,
    vendors: scenario.vendors,
    todayIso: "2026-12-31",
  });
  const occupancyReviewInbox = buildOccupancyReviewInbox(buildLeaseCoverageByProperty(scenario), {
    transactions: scenario.transactions,
    assets: scenario.assets,
    loans: scenario.loans,
    yearFilter,
    todayIso: "2026-12-31",
  });
  const tenantLedgerReviewInbox = buildTenantLedgerReviewInbox({
    leases: scenario.leases,
    tenantLedgerEntries: scenario.tenantLedgerEntries,
    transactions: scenario.transactions,
    documents: scenario.documents,
    workOrders: scenario.workOrders,
    yearFilter,
    propertyFilter,
    todayIso: "2026-12-31",
  });
  const loanReviewInbox = buildLoanReviewInbox({
    loans: scenario.loans,
    loanPayments: scenario.loanPayments,
    transactions: scenario.transactions,
    documents: scenario.documents,
    occupancyReviewInbox,
    yearFilter,
    propertyFilter,
    todayIso: "2026-12-31",
  });
  const taxReadinessSummary = buildTaxReadinessSummary({
    transactionReviewInbox,
    assetReviewInbox,
    maintenanceReviewInbox,
    occupancyReviewInbox,
    tenantLedgerReviewInbox,
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
  const taxSummary = buildTaxSummary(taxArgs);
  const taxPacket = buildTaxPacketSummary(taxArgs);

  return {
    scenario,
    transactionReviewInbox,
    assetReviewInbox,
    maintenanceReviewInbox,
    occupancyReviewInbox,
    tenantLedgerReviewInbox,
    loanReviewInbox,
    taxReadinessSummary,
    taxSummary,
    taxPacket,
  };
}

test("fictional full-year workflow builds review inboxes, readiness, summary, and packet", () => {
  const workflow = buildWorkflow();

  assert.equal(workflow.transactionReviewInbox.length, 0);
  assert.equal(workflow.assetReviewInbox.counts.transactionCandidates, 0);
  assert.equal(workflow.maintenanceReviewInbox.counts.total, 0);
  assert.equal(workflow.occupancyReviewInbox.counts.total, 0);
  assert.equal(workflow.tenantLedgerReviewInbox.counts.total, 0);
  assert.equal(workflow.loanReviewInbox.counts.total, 0);
  assert.equal(workflow.taxReadinessSummary.status, "ready");

  assert.equal(workflow.taxSummary.totals.rentalIncome, 17400);
  assert.equal(workflow.taxSummary.totals.repairs, 385);
  assert.equal(workflow.taxSummary.totals.utilities, 120);
  assert.ok(workflow.taxSummary.totals.mortgageInterest > 0);
  assert.ok(workflow.taxSummary.totals.depreciation > 0);
  assert.equal(workflow.taxSummary.totals.otherIncome, 0);

  const allDetailRows = Object.values(workflow.taxSummary.details).flat();
  assert.equal(allDetailRows.some((row) => row.source?.id === "demo-capital-roof"), false);
  assert.equal(workflow.taxSummary.totals.taxes, 2100);
  assert.equal(workflow.taxSummary.totals.insurance, 1350);
  assert.equal(workflow.taxPacket.openItems.length, 0);
  assert.ok(workflow.taxPacket.documentChecklist.missingSupportCount > 0);
});

test("fictional full-year tax packet excludes known sensitive/private fields", () => {
  const { taxPacket } = buildWorkflow();
  const packetText = JSON.stringify(taxPacket);

  assert.equal(packetText.includes("operationNotes"), false);
  assert.equal(packetText.includes("privateNotes"), false);
  assert.equal(/\b\d{5}-\d{4}\b/.test(packetText), false);
  assert.equal(/\b\d{9,}\b/.test(packetText), false);
});

test("representative demo backup envelope survives normalization and migration", () => {
  const scenario = createFullYearDemoScenario();
  const backup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: "1.30.0",
    exportedAt: "2026-12-31T12:00:00.000Z",
    data: {
      ...scenario,
      taxFiledAmountOverrides: {
        "2026|all": {
          mortgageInterest: 10222,
          overrideNotes: { mortgageInterest: "Example preparer adjustment." },
        },
      },
    },
  };

  const migration = normalizeAndMigrateBackup(backup);
  const data = migration.backup.data as Record<string, any>;

  assert.equal(data.properties.length, 1);
  assert.equal(data.units.length, 2);
  assert.ok(data.transactions.some((transaction: Record<string, unknown>) => transaction.id === "demo-capital-roof"));
  assert.ok(data.documents.some((document: Record<string, unknown>) => document.id === "demo-doc-repair"));
  assert.ok(data.assets.some((asset: Record<string, unknown>) => asset.id === "demo-roof-asset"));
  assert.ok(data.loans[0].yearEndReviews.some((review: Record<string, unknown>) => review.year === "2026"));
  assert.ok(data.leases.length >= 1);
  assert.ok(data.tenantLedgerEntries.length >= 1);
  assert.ok(data.workOrders.length >= 1);
  assert.equal(data.taxFiledAmountOverrides["2026|all"].mortgageInterest, 10222);
});
