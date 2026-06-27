import assert from "node:assert/strict";
import test from "node:test";
import {
  countUpcomingLeaseExpirations,
  deriveCashflowSummary,
  deriveDashboardActionStatus,
  formatDashboardPlanningConcern,
  formatDashboardUnitLabel,
  derivePropertySnapshotMode,
  deriveRentCollectionSummary,
  deriveTransactionBadges,
} from "./dashboardDerived.js";

const property = { id: "p1", name: "Sample Duplex" };
const units = [
  { id: "u1", propertyId: "p1", name: "A", status: "Rental" },
  { id: "u2", propertyId: "p1", name: "B", status: "Vacant" },
];
const lease = {
  id: "l1",
  propertyId: "p1",
  unit: "A",
  tenantName: "Tenant A",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRent: 1000,
  rentDueDay: 1,
  rentalType: "Long-term",
  monthToMonthAfterTerm: false,
};

test("rent collection derives scheduled and recorded rent without fake balances", () => {
  const summary = deriveRentCollectionSummary({
    transactions: [
      { id: "t1", date: "2026-01-02", propertyId: "p1", unit: "A", type: "Income", category: "Rent", amount: 1000 },
      { id: "t2", date: "2026-02-02", propertyId: "p1", unit: "A", type: "Income", category: "Rents received", amount: 900 },
      { id: "future", date: "2026-03-02", propertyId: "p1", unit: "A", type: "Income", category: "Rents received", amount: 1000 },
    ],
    leases: [lease],
    properties: [property],
    units,
    yearFilter: "2026",
    asOfDate: "2026-02-15",
  });

  assert.equal(summary.expectedYtd, 2000);
  assert.equal(summary.collectedYtd, 1900);
  assert.equal(summary.outstanding, 100);
  assert.equal(summary.progressPct, 95);
  assert.equal(summary.showCollectionRate, true);
  assert.equal(summary.scheduleCoveragePartial, false);
  assert.equal(summary.mode, "units");
  assert.equal(summary.rows[0].monthlyRent, 1000);

  const unitSummary = deriveRentCollectionSummary({
    transactions: [{ id: "t1", date: "2026-01-02", propertyId: "p1", unit: "A", type: "Income", category: "Rent", amount: 1000 }],
    leases: [lease],
    properties: [property],
    units,
    yearFilter: "2026",
    propertyFilter: "p1",
    unitFilter: "A",
    asOfDate: "2026-01-15",
  });
  assert.deepEqual(unitSummary.rows.map((row) => row.label), ["Unit A"]);

  const partialSchedule = deriveRentCollectionSummary({
    transactions: [{ id: "t1", date: "2026-01-02", propertyId: "p1", unit: "A", type: "Income", category: "Rent", amount: 2000 }],
    leases: [lease],
    properties: [property],
    units,
    yearFilter: "2026",
    asOfDate: "2026-01-15",
  });
  assert.equal(partialSchedule.showCollectionRate, false);
  assert.equal(partialSchedule.scheduleCoveragePartial, true);
});

test("rent collection uses prorated ledger rent charges and ignores security deposits", () => {
  const endedLease = {
    ...lease,
    endDate: "2026-02-20",
    monthlyRent: 1400,
  };
  const summary = deriveRentCollectionSummary({
    transactions: [
      { id: "jan-rent", date: "2025-12-31", rentPeriod: "2026-01", propertyId: "p1", unit: "A", type: "Income", category: "Rents received", amount: 1400 },
      { id: "feb-rent", date: "2026-01-30", rentPeriod: "2026-02", propertyId: "p1", unit: "A", type: "Income", category: "Rents received", amount: 700 },
    ],
    leases: [endedLease],
    tenantLedgerEntries: [
      { id: "deposit", leaseId: "l1", date: "2025-12-30", kind: "payment", accountingTreatment: "security_deposit_liability", amount: 700 },
      { id: "jan-charge", leaseId: "l1", date: "2026-01-01", kind: "charge", accountingTreatment: "rent_income", amount: 1400 },
      { id: "feb-charge", leaseId: "l1", date: "2026-02-01", kind: "charge", accountingTreatment: "rent_income", amount: 700 },
      { id: "deposit-refund", leaseId: "l1", date: "2026-02-21", kind: "refund", accountingTreatment: "security_deposit_return", amount: 700 },
    ],
    properties: [property],
    units: [{ id: "u1", propertyId: "p1", name: "A", status: "Owner-Occupied" }],
    yearFilter: "2026",
    propertyFilter: "p1",
    unitFilter: "A",
    asOfDate: "2026-06-13",
  });

  assert.equal(summary.expectedYtd, 2100);
  assert.equal(summary.collectedYtd, 2100);
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.collectionRatePct, 100);
  assert.equal(summary.rows[0]?.status, "Owner");
});

test("rent collection fallback prorates a partial final month using a 30-day convention", () => {
  const summary = deriveRentCollectionSummary({
    transactions: [],
    leases: [{ ...lease, endDate: "2026-02-20", monthlyRent: 1500 }],
    tenantLedgerEntries: [],
    properties: [property],
    units,
    yearFilter: "2026",
    asOfDate: "2026-02-20",
  });

  assert.equal(summary.expectedYtd, 2500);
});

test("rent collection fallback includes a partial first month after the normal due day", () => {
  const summary = deriveRentCollectionSummary({
    transactions: [],
    leases: [{ ...lease, startDate: "2026-02-21", monthlyRent: 1500 }],
    tenantLedgerEntries: [],
    properties: [property],
    units,
    yearFilter: "2026",
    asOfDate: "2026-02-21",
  });

  assert.equal(summary.expectedYtd, 500);
});

test("rent collection recognizes prorated automated rent charges", () => {
  const summary = deriveRentCollectionSummary({
    transactions: [],
    leases: [{ ...lease, endDate: "2026-02-20", monthlyRent: 1500 }],
    tenantLedgerEntries: [
      { id: "jan-auto", leaseId: "l1", date: "2026-01-01", kind: "charge", accountingTreatment: "none", amount: 1500, automationKey: "auto-rent:l1:2026-01-01" },
      { id: "feb-auto", leaseId: "l1", date: "2026-02-01", kind: "charge", accountingTreatment: "none", amount: 1000, automationKey: "auto-rent:l1:2026-02-01" },
    ],
    properties: [property],
    units,
    yearFilter: "2026",
    asOfDate: "2026-02-20",
  });

  assert.equal(summary.expectedYtd, 2500);
});

test("cashflow summary reports sparse and meaningful trend states", () => {
  const sparse = deriveCashflowSummary([{ date: "2026-01-01", type: "Income", amount: 1000 }]);
  assert.equal(sparse.hasMeaningfulTrend, false);
  const trend = deriveCashflowSummary([
    { date: "2026-01-01", type: "Income", amount: 1000 },
    { date: "2026-02-01", type: "Income", amount: 1300 },
    { date: "2026-02-02", type: "Expense", amount: 200 },
  ]);
  assert.equal(trend.hasMeaningfulTrend, true);
  assert.equal(trend.totals.cashflow, 2100);

  const earlyRent = deriveCashflowSummary([
    { date: "2026-03-29", type: "Income", category: "Rents received", rentPeriod: "2026-04", amount: 1400 },
  ], { useRentPeriod: true });
  assert.deepEqual(earlyRent.rows.map((row) => row.key), ["2026-04"]);
});

test("action status uses clear landlord-facing labels", () => {
  assert.equal(deriveDashboardActionStatus({ openReviewCount: 3 }).label, "Needs Review");
  assert.equal(
    deriveDashboardActionStatus({ openReviewCount: 2, taxReadinessSummary: { reviewCount: 4 } }).explanation,
    "2 source-record items still need review.",
  );
  assert.equal(deriveDashboardActionStatus({ openReviewCount: 1 }).explanation, "1 source-record item still needs review.");
  assert.equal(deriveDashboardActionStatus({ planningHealth: { status: "fragile" }, openReviewCount: 2 }).label, "Needs Review");
  assert.equal(deriveDashboardActionStatus({ planningHealth: { status: "fragile" }, openReviewCount: 5 }).label, "At Risk");
  assert.equal(deriveDashboardActionStatus({ planningHealth: { status: "fragile", primaryConcern: "Reserve coverage is thin." } }).explanation, "Reserve coverage is thin.");
  assert.equal(deriveDashboardActionStatus({ upcomingLeaseCount: 1 }).label, "Watch");
  assert.equal(deriveDashboardActionStatus({ openMaintenanceCount: 1 }).label, "Watch");
  assert.equal(deriveDashboardActionStatus({}).label, "Healthy");
});

test("planning concern formats negative monthly cashflow as currency", () => {
  assert.equal(
    formatDashboardPlanningConcern("Projected cash flow is materially negative at about -2035 per month."),
    "Projected cashflow is negative by about $2,035/month.",
  );
  assert.equal(formatDashboardPlanningConcern("Reserve coverage is thin."), "Reserve coverage is thin.");
});

test("dashboard unit labels avoid duplicate prefixes", () => {
  assert.equal(formatDashboardUnitLabel("A"), "Unit A");
  assert.equal(formatDashboardUnitLabel("Unit B"), "Unit B");
});

test("snapshot mode favors unit detail for a single property", () => {
  assert.equal(derivePropertySnapshotMode([]), "empty");
  assert.equal(derivePropertySnapshotMode([property]), "units");
  assert.equal(derivePropertySnapshotMode([property, { id: "p2" }]), "properties");
});

test("transaction badges expose review, tax, deductible, and support state", () => {
  const badges = deriveTransactionBadges(
    { id: "t1", type: "Expense", deductibleAmount: 100, taxChecked: true, receiptName: "receipt.pdf" },
    { issues: [{ key: "missing_service_period" }] },
    [],
  );
  assert.deepEqual(badges.map((badge) => badge.key), ["deductible", "review", "tax_checked", "support"]);
});

test("lease expiration count excludes future and month-to-month leases", () => {
  assert.equal(countUpcomingLeaseExpirations([lease], "2026-10-01", 120), 1);
  assert.equal(countUpcomingLeaseExpirations([{ ...lease, monthToMonthAfterTerm: true }], "2026-10-01", 120), 0);
});
