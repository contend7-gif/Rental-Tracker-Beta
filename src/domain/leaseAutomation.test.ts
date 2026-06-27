import test from "node:test";
import assert from "node:assert/strict";
import { buildLeaseAutomationPlan, findStaleAutomatedRentChargeIds, lateFeeAutomationKey, rentChargeAutomationKey } from "./leaseAutomation.ts";

const DEFAULTS = {
  rentDueDay: 1,
  reminderDaysBefore: 3,
  lateFeeGraceDays: 5,
  lateFeeType: "flat" as const,
  lateFeeValue: 50,
  autoLateFeeEnabled: false,
};

function baseLease(overrides = {}) {
  return {
    id: "lease-1",
    propertyId: "p1",
    unit: "A",
    tenantName: "Casey Tenant",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    actualEndDate: "",
    monthlyRent: 1200,
    rentalType: "Long-term" as const,
    utilitiesIncluded: false,
    monthToMonthAfterTerm: false,
    extensionTermMonths: 0,
    status: "Active" as const,
    notes: "",
    ...overrides,
  };
}

test("buildLeaseAutomationPlan creates only missing rent charges", () => {
  const janKey = rentChargeAutomationKey("lease-1", "2026-01-01");
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease()],
    tenantLedgerEntries: [
      {
        id: "tle-january",
        leaseId: "lease-1",
        date: "2026-01-01",
        kind: "charge",
        amount: 1200,
        memo: "Auto rent charge (2026-01)",
        accountingTreatment: "none",
        automationKey: janKey,
        createdAt: "2026-01-01T08:00:00.000Z",
      },
    ],
    todayIso: "2026-02-05",
    defaults: DEFAULTS,
  });

  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].date, "2026-02-01");
  assert.equal(plan.entries[0].automationKey, rentChargeAutomationKey("lease-1", "2026-02-01"));
});

test("buildLeaseAutomationPlan does not create an auto rent charge when a manual rent charge already exists for that due date", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease()],
    tenantLedgerEntries: [
      {
        id: "tle-manual-jan",
        leaseId: "lease-1",
        date: "2026-01-01",
        kind: "charge",
        amount: 1200,
        memo: "January 2026 rent",
        accountingTreatment: "rent_income",
        createdAt: "2026-01-01T08:00:00.000Z",
      },
    ],
    todayIso: "2026-01-10",
    defaults: DEFAULTS,
  });

  const rentEntries = plan.entries.filter((entry) => String(entry.automationKey || "").startsWith("auto-rent:"));
  assert.equal(rentEntries.length, 0);
  assert.equal(plan.reminders.some((reminder) => reminder.kind === "late"), true);
});

test("findStaleAutomatedRentChargeIds flags auto charges that duplicate manual rent charges", () => {
  const duplicateIds = findStaleAutomatedRentChargeIds([
    {
      id: "tle-auto-rent-lease-1-2026-01-01",
      leaseId: "lease-1",
      date: "2026-01-01",
      kind: "charge",
      amount: 1200,
      memo: "Auto rent charge (2026-01)",
      accountingTreatment: "none",
      automationKey: rentChargeAutomationKey("lease-1", "2026-01-01"),
      createdAt: "2026-03-26T03:22:22.000Z",
    },
    {
      id: "tle-manual-jan",
      leaseId: "lease-1",
      date: "2026-01-01",
      kind: "charge",
      amount: 1200,
      memo: "January 2026 rent",
      accountingTreatment: "rent_income",
      createdAt: "2026-01-01T08:00:00.000Z",
    },
  ]);

  assert.deepEqual(duplicateIds, ["tle-auto-rent-lease-1-2026-01-01"]);
});

test("buildLeaseAutomationPlan prorates a partial final month using a 30-day convention", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease({ endDate: "2026-02-20", monthlyRent: 1500 })],
    tenantLedgerEntries: [],
    todayIso: "2026-02-20",
    defaults: DEFAULTS,
  });

  const februaryCharge = plan.entries.find((entry) => entry.date === "2026-02-01");
  assert.equal(februaryCharge?.amount, 1000);
});

test("buildLeaseAutomationPlan creates a prorated first-month charge when the lease starts after rent due day", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease({ startDate: "2026-02-21", monthlyRent: 1500 })],
    tenantLedgerEntries: [],
    todayIso: "2026-02-21",
    defaults: DEFAULTS,
  });

  const firstCharge = plan.entries.find((entry) => entry.date === "2026-02-21");
  assert.equal(firstCharge?.amount, 500);
});

test("buildLeaseAutomationPlan keeps a full month at the full monthly rent", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease({ endDate: "2026-02-28", monthlyRent: 1500 })],
    tenantLedgerEntries: [],
    todayIso: "2026-02-28",
    defaults: DEFAULTS,
  });

  const februaryCharge = plan.entries.find((entry) => entry.date === "2026-02-01");
  assert.equal(februaryCharge?.amount, 1500);
});

test("buildLeaseAutomationPlan does not mark prepaid manual rent as late when the charge row is reused", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease({ startDate: "2026-03-01", endDate: "2026-03-31" })],
    tenantLedgerEntries: [
      {
        id: "tle-january-payment",
        leaseId: "lease-1",
        date: "2026-02-26",
        kind: "payment",
        amount: 1200,
        memo: "March 2026 rent received",
        accountingTreatment: "rent_income",
        createdAt: "2026-02-26T08:00:00.000Z",
      },
      {
        id: "tle-march-charge",
        leaseId: "lease-1",
        date: "2026-03-01",
        kind: "charge",
        amount: 1200,
        memo: "March 2026 rent",
        accountingTreatment: "rent_income",
        createdAt: "2026-03-01T08:00:00.000Z",
      },
    ],
    todayIso: "2026-03-27",
    defaults: DEFAULTS,
  });

  assert.equal(plan.reminders.some((reminder) => reminder.kind === "late"), false);
});

test("buildLeaseAutomationPlan adds late fee when overdue and auto late fees are enabled", () => {
  const janRentKey = rentChargeAutomationKey("lease-1", "2026-01-01");
  const plan = buildLeaseAutomationPlan({
    leases: [
      baseLease({
        lateFeeType: "percent",
        lateFeeValue: 10,
        lateFeeGraceDays: 3,
        autoLateFeeEnabled: true,
      }),
    ],
    tenantLedgerEntries: [
      {
        id: "tle-jan-rent",
        leaseId: "lease-1",
        date: "2026-01-01",
        kind: "charge",
        amount: 1200,
        memo: "Auto rent charge (2026-01)",
        accountingTreatment: "none",
        automationKey: janRentKey,
        createdAt: "2026-01-01T08:00:00.000Z",
      },
    ],
    todayIso: "2026-01-10",
    defaults: DEFAULTS,
  });

  const lateFee = plan.entries.find((entry) => String(entry.automationKey || "").startsWith("auto-late-fee:"));
  assert.ok(lateFee);
  assert.equal(lateFee?.automationKey, lateFeeAutomationKey("lease-1", "2026-01-01"));
  assert.equal(lateFee?.amount, 120);
  assert.equal(lateFee?.date, "2026-01-05");
  assert.ok(plan.reminders.some((reminder) => reminder.kind === "late"));
});

test("late reminders format unit labels and avoid repeating the amount", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [baseLease({ tenantName: "", unit: "Unit A" })],
    tenantLedgerEntries: [],
    todayIso: "2026-01-10",
    defaults: DEFAULTS,
  });

  const reminder = plan.reminders.find((item) => item.kind === "late");
  assert.equal(reminder?.title, "Late rent: Unit A");
  assert.equal(reminder?.message, "$1,200.00 unpaid, due Jan 1, 2026.");
});

test("buildLeaseAutomationPlan emits due soon reminders within configured window", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [
      baseLease({
        rentDueDay: 15,
        reminderDaysBefore: 5,
      }),
    ],
    tenantLedgerEntries: [],
    todayIso: "2026-03-12",
    defaults: DEFAULTS,
  });

  const dueSoonReminder = plan.reminders.find((reminder) => reminder.kind === "due_soon");
  assert.ok(dueSoonReminder);
  assert.equal(dueSoonReminder?.dueDate, "2026-03-15");
  assert.equal(dueSoonReminder?.daysUntilDue, 3);
});

test("buildLeaseAutomationPlan does not backfill prior years for old leases", () => {
  const plan = buildLeaseAutomationPlan({
    leases: [
      baseLease({
        startDate: "2024-09-01",
      }),
    ],
    tenantLedgerEntries: [],
    todayIso: "2026-03-12",
    defaults: DEFAULTS,
  });

  const rentEntries = plan.entries.filter((entry) => String(entry.automationKey || "").startsWith("auto-rent:"));
  assert.equal(rentEntries.every((entry) => entry.date >= "2026-01-01"), true);
});
