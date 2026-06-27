import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateAmountToYearByServicePeriod,
  createLoanPayment,
  deductibleAmountForTransaction,
  deductibleMortgageInterest,
  generateRecurringDrafts,
  generateRecurringTransactions,
  getRentalUsePctForDate,
  getRentalUsePctForRange,
  loanBreakdown,
} from "./accounting.ts";
import { initialLoans, initialRecurringTemplates, initialUsePeriods } from "../data/mockData.ts";

test("date-based rental-use lookup handles mid-year shared changes", () => {
  const pct = getRentalUsePctForDate({ propertyId: "p1", unit: "Shared", date: "2026-06-15", usePeriods: initialUsePeriods });
  assert.equal(pct, 0.5);
});

test("mortgage payment breakdown separates escrow and extra principal", () => {
  const breakdown = loanBreakdown(initialLoans[0]);
  assert.equal(breakdown.scheduledEscrow, 420);
  assert.equal(breakdown.extraPrincipal, 200);
  assert.equal(breakdown.totalMonthlyPayment, 2078);
});

test("mortgage payment breakdown includes mortgage insurance when present", () => {
  const breakdown = loanBreakdown({
    ...initialLoans[0],
    scheduledMortgageInsurance: 85,
  });

  assert.equal(breakdown.mortgageInsurance, 85);
  assert.equal(breakdown.totalMonthlyPayment, 2163);
});

test("deductible amount excludes capital improvements", () => {
  const deductible = deductibleAmountForTransaction({ amount: 1200, type: "Expense", capitalImprovement: true, rentalUsePct: 0.5 });
  assert.equal(deductible, 0);
});

test("owner draws and equity transfers are not deductible expenses", () => {
  assert.equal(deductibleAmountForTransaction({ amount: 900, type: "Owner Draw", capitalImprovement: false, rentalUsePct: 1 }), 0);
  assert.equal(deductibleAmountForTransaction({ amount: 900, type: "Owner Contribution", capitalImprovement: false, rentalUsePct: 1 }), 0);
  assert.equal(deductibleAmountForTransaction({ amount: 900, type: "Transfer", capitalImprovement: false, rentalUsePct: 1 }), 0);
});

test("deductible mortgage interest uses active use period", () => {
  const deductible = deductibleMortgageInterest({ interest: 1000, propertyId: "p1", date: "2026-06-15", usePeriods: initialUsePeriods });
  assert.equal(deductible, 500);
});

test("deductible mortgage interest derives shared duplex use from unit occupancy", () => {
  const deductible = deductibleMortgageInterest({
    interest: 1000,
    propertyId: "p-duplex",
    date: "2026-06-15",
    usePeriods: [
      {
        id: "owner-a",
        propertyId: "p-duplex",
        unit: "Unit A",
        startDate: "2026-01-01",
        endDate: "",
        useType: "Owner-occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-b",
        propertyId: "p-duplex",
        unit: "Unit B",
        tenant: "Example Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1200,
        rentalType: "Mid-term",
      },
    ],
    units: [
      { id: "unit-a", propertyId: "p-duplex", name: "Unit A" },
      { id: "unit-b", propertyId: "p-duplex", name: "Unit B" },
    ],
  });

  assert.equal(deductible, 500);
});

test("service-period allocation prorates prepaid insurance into the selected tax year", () => {
  const allocated = allocateAmountToYearByServicePeriod({
    amount: 1200,
    year: 2026,
    servicePeriodStart: "2026-07-01",
    servicePeriodEnd: "2027-06-30",
  });

  assert.equal(Number(allocated.toFixed(2)), 604.93);
});

test("service-period allocation returns zero when the coverage is outside the selected year", () => {
  const allocated = allocateAmountToYearByServicePeriod({
    amount: 1200,
    year: 2026,
    servicePeriodStart: "2027-01-01",
    servicePeriodEnd: "2027-12-31",
  });

  assert.equal(allocated, 0);
});

test("recurring template behavior generates drafts for review", () => {
  const drafts = generateRecurringDrafts({ template: initialRecurringTemplates[0], throughDate: "2026-06-30", usePeriods: initialUsePeriods });
  assert.ok(drafts.length >= 2);
  assert.ok(drafts.every((d) => d.status === "draft"));
  assert.ok(drafts.every((d) => d.transactionSeed.notes.includes("review")));
});

test("recurring draft and posting cadence stay aligned", () => {
  const template = {
    ...initialRecurringTemplates[0],
    id: "r-alignment",
    nextDueDate: "2026-01-31",
    frequency: "Monthly" as const,
  };

  const drafts = generateRecurringDrafts({
    template,
    throughDate: "2026-04-30",
    usePeriods: initialUsePeriods,
  });

  const generated = generateRecurringTransactions({
    template,
    throughDate: "2026-04-30",
    usePeriods: initialUsePeriods,
    existingTransactionKeys: new Set(),
  });

  assert.deepEqual(
    drafts.map((draft) => draft.dueDate),
    generated.transactions.map((txn) => txn.date),
  );
});

test("loan payment model stores deductible interest explicitly", () => {
  const loan = initialLoans[0];
  const payment = createLoanPayment({ loan, paymentDate: "2026-04-01", interest: 1200, principal: 800, deductibleInterest: 600 });
  assert.equal(payment.totalPayment, 2620);
  assert.equal(payment.deductibleInterest, 600);
});


test("shared fallback owner-use percentage is applied when no use period exists", () => {
  const pct = getRentalUsePctForDate({
    propertyId: "missing-property",
    unit: "Shared",
    date: "2026-06-15",
    usePeriods: [],
    fallbackOwnerUsePct: 0.25,
  });
  assert.equal(pct, 0.75);
});

test("shared rental use can be derived from underlying units when no shared use period exists", () => {
  const pct = getRentalUsePctForDate({
    propertyId: "p-shared",
    unit: "Shared",
    date: "2026-03-15",
    usePeriods: [
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
  });

  assert.equal(pct, 0.5);
});

test("manual owner-use override can replace shared occupancy-derived percentage", () => {
  const pct = getRentalUsePctForDate({
    propertyId: "p-shared",
    unit: "Shared",
    date: "2026-03-15",
    usePeriods: [
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
    fallbackOwnerUsePct: 0.3,
    ownerUsePctOverride: true,
  });

  assert.equal(pct, 0.7);
});

test("rental use can be prorated across a utility billing period", () => {
  const pct = getRentalUsePctForRange({
    propertyId: "p1",
    unit: "Shared",
    startDate: "2026-06-28",
    endDate: "2026-07-03",
    usePeriods: initialUsePeriods,
  });

  assert.equal(Number(pct.toFixed(4)), 0.625);
});

test("shared rental use range follows unit occupancy across a service period", () => {
  const pct = getRentalUsePctForRange({
    propertyId: "p-shared",
    unit: "Shared",
    startDate: "2026-02-13",
    endDate: "2026-03-12",
    usePeriods: [
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
  });

  assert.equal(Number(pct.toFixed(4)), 0.6429);
});

test("manual owner-use override applies across a service period", () => {
  const pct = getRentalUsePctForRange({
    propertyId: "p-shared",
    unit: "Shared",
    startDate: "2026-02-13",
    endDate: "2026-03-12",
    usePeriods: [
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
    fallbackOwnerUsePct: 0.2,
    ownerUsePctOverride: true,
  });

  assert.equal(Number(pct.toFixed(4)), 0.8);
});

test("legacy shared mixed-use periods do not override tracked unit-level shared expense math", () => {
  const pct = getRentalUsePctForDate({
    propertyId: "p-shared",
    unit: "Shared",
    date: "2026-11-01",
    usePeriods: [
      {
        id: "shared-mixed",
        propertyId: "p-shared",
        unit: "Shared",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Shared - mixed use",
        rentalUsePct: 0.8,
      },
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "2026-09-30",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-614",
        propertyId: "p-shared",
        unit: "614",
        tenantName: "Tenant A",
        startDate: "2026-10-01",
        endDate: "2027-03-07",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Mid-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant B",
        startDate: "2026-01-01",
        endDate: "2027-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
  });

  assert.equal(pct, 1);
});

test("shared utility proration follows the transition from full rental to half rental", () => {
  const pct = getRentalUsePctForRange({
    propertyId: "p-shared",
    unit: "Shared",
    startDate: "2026-02-13",
    endDate: "2026-03-12",
    usePeriods: [
      {
        id: "shared-mixed",
        propertyId: "p-shared",
        unit: "Shared",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Shared - mixed use",
        rentalUsePct: 0.8,
      },
      {
        id: "owner-614",
        propertyId: "p-shared",
        unit: "614",
        startDate: "2026-02-21",
        endDate: "",
        useType: "Owner-Occupied",
        rentalUsePct: 0,
      },
    ],
    leases: [
      {
        id: "lease-616",
        propertyId: "p-shared",
        unit: "616",
        tenantName: "Tenant",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 1000,
        deposit: 1000,
        rentalType: "Long-term",
        status: "Active",
        rentDueDay: 1,
        reminderDaysBefore: 3,
        lateFeeGraceDays: 5,
        lateFeeType: "flat",
        lateFeeValue: 50,
        autoLateFeeEnabled: false,
        monthToMonthAfterTerm: false,
      },
    ],
    units: [
      { id: "u1", propertyId: "p-shared", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p-shared", name: "616", status: "Rental" },
    ],
  });

  assert.equal(Number(pct.toFixed(4)), 0.6429);
});

test("recurring generation skips existing keys and still advances next due date", () => {
  const template = {
    ...initialRecurringTemplates[0],
    id: "r-existing-keys",
    nextDueDate: "2026-01-01",
    frequency: "Monthly" as const,
  };

  const existing = new Set<string>(["r-existing-keys:2026-01-01"]);
  const result = generateRecurringTransactions({
    template,
    throughDate: "2026-03-31",
    usePeriods: initialUsePeriods,
    existingTransactionKeys: existing,
  });

  assert.deepEqual(
    result.transactions.map((txn) => txn.date),
    ["2026-02-01", "2026-03-01"],
  );
  assert.equal(result.nextDueDate, "2026-04-01");
});
