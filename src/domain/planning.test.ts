import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlanningAssumptionAudit,
  buildPlanningCapitalTargets,
  buildPlanningDebtPayoffAnalysis,
  buildPlanningDecisionComparison,
  buildPlanningExitAnalysis,
  buildPlanningFinancingComparison,
  buildPlanningGoalStatus,
  buildPlanningHealthSummary,
  buildPlanningManualCapitalTargets,
  buildPlanningMilestones,
  buildPlanningProjection,
  buildPlanningPropertySnapshots,
  buildPlanningReviewInbox,
  buildPlanningRecommendedMoves,
  buildPlanningRecommendations,
  buildPlanningRentStrategy,
  buildPlanningReserveSummary,
  buildPlanningScenarioDiff,
  buildPlanningScenarioRange,
  buildPlanningSensitivity,
  buildPlanningTaxProjection,
  buildPlanningTriggerAlerts,
  buildPlanningTurnoverPlanner,
  planningProjectionCsv,
} from "./planning.ts";

test("buildPlanningProjection respects future lease starts and vacancy assumptions", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [
      { id: "t1", date: "2026-02-03", propertyId: "p1", unit: "Shared", type: "Expense", category: "Utilities", description: "Water", amount: 240, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 240, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
      { id: "t2", date: "2026-03-03", propertyId: "p1", unit: "Shared", type: "Expense", category: "Repairs", description: "Repair", amount: 120, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 120, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "l2", propertyId: "p1", unit: "614", tenantName: "Tenant 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
    ],
    loans: [],
    usePeriods: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0.05,
      monthlyCapexReserve: 100,
    },
  });

  const april = result.rows[0];
  const october = result.rows.find((row) => row.month === "2026-10");
  assert.equal(april.month, "2026-04");
  assert.equal(april.scheduledRent, 1400);
  assert.equal(april.effectiveRent, 1330);
  assert.ok(october);
  assert.equal(october?.scheduledRent, 2900);
  assert.equal(october?.effectiveRent, 2755);
});

test("buildPlanningProjection grosses up recent utilities when a utilities-included lease is active", () => {
  const result = buildPlanningProjection({
    today: "2026-06-15",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [
      { id: "t1", date: "2026-05-05", propertyId: "p1", unit: "614", type: "Expense", category: "Utilities", description: "Electric", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
      { id: "t2", date: "2026-06-05", propertyId: "p1", unit: "614", type: "Expense", category: "Utilities", description: "Electric", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "614", tenantName: "Tenant 614", startDate: "2026-05-01", endDate: "2026-07-31", monthlyRent: 1800, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [],
    usePeriods: [],
    units: [{ id: "u1", propertyId: "p1", name: "614", status: "Rental" }],
    assumptions: {
      horizonMonths: 3,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
  });

  const july = result.rows.find((row) => row.month === "2026-07");
  const august = result.rows.find((row) => row.month === "2026-08");
  assert.equal(july?.operatingExpenses, 300);
  assert.equal(july?.utilityIncludedAdjustment, 250);
  assert.equal(july?.driverLabel, "Utilities included");
  assert.equal(august?.operatingExpenses, 0);
  assert.equal(august?.utilityIncludedAdjustment, -50);
});

test("buildPlanningProjection can use a manual utilities-included monthly estimate", () => {
  const result = buildPlanningProjection({
    today: "2026-06-15",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [
      { id: "t1", date: "2026-06-05", propertyId: "p1", unit: "614", type: "Expense", category: "Utilities", description: "Electric", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "614", tenantName: "Tenant 614", startDate: "2026-05-01", endDate: "2026-07-31", monthlyRent: 1800, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [],
    usePeriods: [],
    units: [{ id: "u1", propertyId: "p1", name: "614", status: "Rental" }],
    assumptions: {
      horizonMonths: 1,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
      includedUtilitiesMonthly: 425,
    },
  });

  assert.equal(result.rows[0]?.operatingExpenses, 425);
  assert.equal(result.rows[0]?.utilityIncludedAdjustment, 400);
  assert.match(result.rows[0]?.driverDetail || "", /manual planning override/);
});

test("buildPlanningProjection adjusts debt service and equity for mixed-use properties", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "l2", propertyId: "p1", unit: "614", tenantName: "Tenant 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "2026-09-30", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0.03,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
  });

  assert.equal(result.summary.adjustedMonthlyDebtService, 1000);
  assert.equal(Math.round(result.summary.currentRentalUsePct * 100), 50);

  const april = result.rows[0];
  const october = result.rows.find((row) => row.month === "2026-10");
  assert.equal(april.debtService, 1000);
  assert.equal(october?.debtService, 2000);
  assert.ok((result.summary.horizonEndingEquity || 0) > result.summary.currentEquity);
});

test("buildPlanningProjection can bridge a lease end with turnover downtime and assumed re-rent", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-05-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [],
    usePeriods: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 6,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
    rentStrategies: [
      { propertyId: "p1", unit: "616", targetRent: 1450, renewalTermMonths: 12 },
    ],
    turnoverInputs: [
      { propertyId: "p1", unit: "616", downtimeDays: 21, leasingFeePct: 4, concessionWeeks: 0, makeReadyCost: 0 },
    ],
    forecastOptions: {
      assumeRerentAfterTurnover: true,
      rerentRentSource: "target",
      rerentTermMonths: 12,
    },
  });

  const june = result.rows.find((row) => row.month === "2026-06");
  const july = result.rows.find((row) => row.month === "2026-07");
  assert.ok(june);
  assert.ok(july);
  assert.equal(june?.scheduledRent, 0);
  assert.equal(june?.driverLabel, "Turnover downtime");
  assert.equal(july?.scheduledRent, 1450);
  assert.equal(july?.driverLabel, "Assumed re-rent");
});

test("buildPlanningProjection keeps signed and assumed rent flat within a term", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-05-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [],
    usePeriods: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 6,
      annualRentGrowthPct: 0.03,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
    rentStrategies: [
      { propertyId: "p1", unit: "616", targetRent: 1400, renewalTermMonths: 12 },
    ],
    turnoverInputs: [
      { propertyId: "p1", unit: "616", downtimeDays: 21, leasingFeePct: 4, concessionWeeks: 0, makeReadyCost: 0 },
    ],
    forecastOptions: {
      assumeRerentAfterTurnover: true,
      rerentRentSource: "target",
      rerentTermMonths: 12,
    },
  });

  const may = result.rows.find((row) => row.month === "2026-05");
  const july = result.rows.find((row) => row.month === "2026-07");
  const august = result.rows.find((row) => row.month === "2026-08");
  assert.equal(may?.scheduledRent, 1400);
  assert.equal(july?.scheduledRent, 1400);
  assert.equal(august?.scheduledRent, 1400);
});

test("buildPlanningPropertySnapshots and milestones summarize the portfolio view", () => {
  const properties = [
    { id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 },
    { id: "p2", name: "Cottage", address: "10 Lake", type: "Single-family", currentValue: 120000 },
  ];
  const leases = [
    { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    { id: "l2", propertyId: "p1", unit: "614", tenantName: "New 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
  ];
  const snapshots = buildPlanningPropertySnapshots({
    today: "2026-03-30",
    properties,
    leases,
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "2026-09-30", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
  });

  const duplexSnapshot = snapshots.find((entry) => entry.propertyId === "p1");
  assert.ok(duplexSnapshot);
  assert.equal(duplexSnapshot?.adjustedMonthlyDebtService, 1000);
  assert.equal(Math.round((duplexSnapshot?.currentRentalUsePct || 0) * 100), 50);

  const milestones = buildPlanningMilestones({
    today: "2026-03-30",
    properties,
    leases,
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Rental", startDate: "2026-10-01", endDate: "", rentalUsePct: 1 },
    ],
    horizonMonths: 12,
  });

  assert.equal(milestones[0]?.date, "2026-10-01");
  assert.ok(milestones.some((item) => item.title.includes("Lease starts")));
});

test("buildPlanningMilestones can include assumed re-rent starts", () => {
  const milestones = buildPlanningMilestones({
    today: "2026-03-30",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-05-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    usePeriods: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    horizonMonths: 6,
    rentStrategies: [
      { propertyId: "p1", unit: "616", targetRent: 1450, renewalTermMonths: 12 },
    ],
    turnoverInputs: [
      { propertyId: "p1", unit: "616", downtimeDays: 21, leasingFeePct: 4, concessionWeeks: 0, makeReadyCost: 0 },
    ],
    forecastOptions: {
      assumeRerentAfterTurnover: true,
      rerentRentSource: "target",
      rerentTermMonths: 12,
    },
  });

  assert.ok(milestones.some((item) => item.title.includes("Assumed re-rent")));
  assert.ok(milestones.some((item) => item.date === "2026-06-22"));
});

test("buildPlanningDecisionComparison estimates upside from returning an owner unit to rental use", () => {
  const comparison = buildPlanningDecisionComparison({
    today: "2026-03-30",
    propertyId: "p1",
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "l2", propertyId: "p1", unit: "614", tenantName: "Future 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "2026-09-30", rentalUsePct: 0 },
    ],
    transactions: [
      { id: "t1", date: "2026-03-03", propertyId: "p1", unit: "Shared", type: "Expense", category: "Utilities", description: "Water", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    vacancyRatePct: 0.05,
    monthlyCapexReserve: 250,
  });

  assert.equal(comparison.currentMonthlyRent, 1400);
  assert.equal(comparison.fullRentalMonthlyRent, 2900);
  assert.equal(comparison.monthlyRentUpside, 1500);
  assert.ok(comparison.monthlyCashFlowUpside > 0);
  assert.equal(comparison.rentableUnitCount, 2);
});

test("buildPlanningReserveSummary and planningProjectionCsv expose reserve targets and export data", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [
      { id: "t1", date: "2026-03-03", propertyId: "p1", unit: "Shared", type: "Expense", category: "Utilities", description: "Water", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "2026-09-30", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 150,
    },
  });
  const reserve = buildPlanningReserveSummary({
    summary: result.summary,
    horizonMonths: 12,
    monthlyCapexReserve: 150,
  });
  const csv = planningProjectionCsv({
    scopeLabel: "Duplex",
    generatedAt: "2026-03-31T12:00:00.000Z",
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 150,
    },
    summary: result.summary,
    reserve,
    rows: result.rows,
  });

  assert.equal(reserve.annualReserveContribution, 1800);
  assert.equal(reserve.firstYearReserveContribution, 1800);
  assert.equal(reserve.sixMonthCushionTarget, 6150);
  assert.match(csv, /Planning report,Duplex,2026-03-31T12:00:00.000Z/);
  assert.match(csv, /6-mo cushion target,6150/);
  assert.match(csv, /2026-04,1400,0,1400,25,0,1375,1000,150,225/);
});

test("buildPlanningCapitalTargets ranks asset reserve targets by timing", () => {
  const targets = buildPlanningCapitalTargets({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    assets: [
      {
        id: "a1",
        propertyId: "p1",
        unit: "614",
        description: "Water heater",
        type: "Appliance",
        placedInService: "2020-04-15",
        cost: 1800,
        basis: 1800,
        life: 7,
        currentYearDep: 0,
      },
      {
        id: "a2",
        propertyId: "p1",
        unit: "Shared",
        description: "Roof",
        type: "Capital Improvement",
        placedInService: "2025-12-30",
        cost: 12000,
        basis: 12000,
        life: 15,
        currentYearDep: 0,
      },
    ],
    annualExpenseGrowthPct: 0.03,
  });

  assert.equal(targets[0]?.description, "Water heater");
  assert.equal(targets[0]?.urgency, "near_term");
  assert.ok((targets[0]?.monthlyReserveTarget || 0) > 0);
  assert.equal(targets[1]?.description, "Roof");
  assert.equal(targets[1]?.urgency, "long_range");
});

test("buildPlanningProjection can use scenario-specific occupancy and rent overrides", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
    scenarioOverrides: [
      { propertyId: "p1", unit: "614", mode: "rented", monthlyRent: 1500 },
    ],
  });

  assert.equal(result.summary.currentMonthlyRent, 2900);
  assert.equal(result.summary.adjustedMonthlyDebtService, 2000);
  assert.equal(result.rows[0]?.scheduledRent, 2900);
});

test("buildPlanningProjection can apply dated scenario events for occupancy and reserve changes", () => {
  const result = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 200,
    },
    scenarioEvents: [
      { id: "e1", propertyId: "p1", unit: "614", date: "2026-10-01", eventType: "unit_override", mode: "rented", monthlyRent: 1500 },
      { id: "e2", propertyId: "p1", date: "2026-11-01", eventType: "reserve_change", monthlyCapexReserve: 350 },
    ],
  });

  const april = result.rows.find((row) => row.month === "2026-04");
  const october = result.rows.find((row) => row.month === "2026-10");
  const november = result.rows.find((row) => row.month === "2026-11");
  assert.equal(april?.scheduledRent, 1400);
  assert.equal(october?.scheduledRent, 2900);
  assert.equal(october?.capexReserve, 200);
  assert.equal(november?.capexReserve, 350);
});

test("buildPlanningManualCapitalTargets produces manual reserve targets with notes", () => {
  const targets = buildPlanningManualCapitalTargets({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    projects: [
      { id: "m1", propertyId: "p1", unit: "Shared", title: "Exterior paint", targetDate: "2027-06-30", estimatedCost: 6000, notes: "Before next full turnover", linkedAssetId: "", priority: "high", fundingSource: "reserve", scheduleType: "phased", mustFundBy: "2027-03-01" },
    ],
  });

  assert.equal(targets[0]?.source, "manual");
  assert.equal(targets[0]?.description, "Exterior paint");
  assert.equal(targets[0]?.notes, "Before next full turnover");
  assert.equal(targets[0]?.priority, "high");
  assert.equal(targets[0]?.scheduleType, "phased");
  assert.ok((targets[0]?.monthlyReserveTarget || 0) > 0);
});

test("buildPlanningMilestones includes dated scenario events", () => {
  const milestones = buildPlanningMilestones({
    today: "2026-03-30",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    leases: [],
    usePeriods: [],
    propertyId: "p1",
    horizonMonths: 12,
    scenarioEvents: [
      { id: "e1", propertyId: "p1", unit: "614", date: "2026-10-01", eventType: "unit_override", mode: "rented", monthlyRent: 1500, notes: "Re-rent after owner move" },
      { id: "e2", propertyId: "p1", date: "2026-11-01", eventType: "reserve_change", monthlyCapexReserve: 350 },
    ],
  });

  assert.ok(milestones.some((item) => item.title.includes("Scenario change")));
  assert.ok(milestones.some((item) => item.title.includes("Reserve target change")));
});

test("buildPlanningRecommendations prioritizes cash flow, reserve, and capital signals", () => {
  const recommendations = buildPlanningRecommendations({
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 210000,
      currentEquity: 50000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 300,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: 11000,
      firstYearCashFlow: -2400,
      horizonEndingValue: 270000,
      horizonEndingLoanBalance: 200000,
      horizonEndingEquity: 70000,
    },
    reserveGap: 175,
    capitalTargets: [
      {
        source: "manual",
        assetId: "m1",
        propertyId: "p1",
        propertyName: "Duplex",
        unit: "Shared",
        description: "Exterior paint",
        assetType: "Manual plan",
        placedInService: "",
        targetDate: "2026-09-01",
        monthsRemaining: 5,
        yearsRemaining: 0.4,
        estimatedReplacementCost: 6000,
        monthlyReserveTarget: 1200,
        urgency: "near_term",
        notes: "",
        linkedAssetId: "",
      },
    ],
    milestones: [
      {
        propertyId: "p1",
        propertyName: "Duplex",
        date: "2026-10-01",
        title: "Lease starts for Unit 614",
        detail: "Scenario tenant at 1500 / mo.",
      },
    ],
    decisionComparison: {
      currentMonthlyRent: 1400,
      fullRentalMonthlyRent: 2900,
      monthlyRentUpside: 1500,
      currentMonthlyCashFlow: -200,
      fullRentalMonthlyCashFlow: 500,
      monthlyCashFlowUpside: 700,
      currentDebtService: 1000,
      fullDebtService: 2000,
      rentableUnitCount: 2,
      upsideUnits: [],
    },
  });

  assert.equal(recommendations[0]?.priority, "high");
  assert.match(recommendations[0]?.title || "", /cash-flow gap/i);
  assert.ok(recommendations.some((item) => /reserve/i.test(item.title)));
  assert.ok(recommendations.some((item) => /prepare for/i.test(item.title.toLowerCase())));
});

test("buildPlanningGoalStatus scores common planning targets", () => {
  const rows = buildPlanningGoalStatus({
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 210000,
      currentEquity: 50000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 300,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: 11000,
      firstYearCashFlow: -2400,
      horizonEndingValue: 270000,
      horizonEndingLoanBalance: 200000,
      horizonEndingEquity: 70000,
    },
    reserve: {
      monthlyCarryCost: 1300,
      annualReserveContribution: 2400,
      firstYearReserveContribution: 2400,
      horizonReserveContribution: 2400,
      sixMonthCushionTarget: 7800,
      firstYearCoverageMonths: 1.8,
    },
    goals: {
      minMonthlyCashFlow: 0,
      minAnnualCashFlow: 0,
      minReserveMonths: 3,
      minEndingEquity: 65000,
      maxLtvPct: 0.8,
      minDscr: 1,
    },
  });

  assert.ok(rows.some((row) => row.id === "minReserveMonths" && row.status === "off_track"));
  assert.ok(rows.some((row) => row.id === "minEndingEquity" && row.status === "on_track"));
  assert.ok(rows.some((row) => row.id === "maxLtvPct" && row.status === "watch"));
});

test("buildPlanningDebtPayoffAnalysis shows payoff acceleration from extra principal", () => {
  const analysis = buildPlanningDebtPayoffAnalysis({
    today: "2026-03-30",
    propertyId: "p1",
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    plan: {
      extraPrincipalMonthly: 250,
      lumpSumAmount: 5000,
      lumpSumDate: "2026-06-01",
    },
  });

  assert.ok(analysis.monthsSaved > 0);
  assert.ok(analysis.interestSaved > 0);
  assert.equal(analysis.monthlyExtraOutlay, 250);
});

test("buildPlanningTaxProjection estimates a next-12-month Schedule E view", () => {
  const projection = buildPlanningProjection({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [
      { id: "t1", date: "2026-03-03", propertyId: "p1", unit: "Shared", type: "Expense", category: "Utilities", description: "Water", amount: 300, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 300, paidFrom: "", paymentMethod: "", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "", receiptName: "", notes: "", taxChecked: false, status: "active" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "", rentalUsePct: 0 },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 0,
      annualExpenseGrowthPct: 0,
      annualValueGrowthPct: 0,
      vacancyRatePct: 0,
      monthlyCapexReserve: 0,
    },
  });

  const tax = buildPlanningTaxProjection({
    today: "2026-03-30",
    propertyId: "p1",
    rows: projection.rows,
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    assets: [
      { id: "a1", propertyId: "p1", unit: "Shared", description: "Building", type: "Residential Building", placedInService: "2025-12-30", cost: 263000, basis: 213000, life: 27.5, currentYearDep: 0 },
    ],
    usePeriods: [
      { id: "up1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "", rentalUsePct: 0 },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
  });

  assert.ok(tax.grossRent > 0);
  assert.ok(tax.mortgageInterest > 0);
  assert.ok(tax.depreciation > 0);
  assert.match(tax.note, /rough next-12-month planning forecast/i);
});

test("buildPlanningCapitalTargets excludes residential building basis from reserve targets", () => {
  const targets = buildPlanningCapitalTargets({
    today: "2026-04-03",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    assets: [
      { id: "a1", propertyId: "p1", unit: "Shared", description: "Duplex building", type: "Residential Building", placedInService: "2025-12-30", cost: 263000, basis: 213000, life: 27.5, currentYearDep: 0, landValue: 50000 },
      { id: "a2", propertyId: "p1", unit: "Shared", description: "Roof", type: "Capital Improvement", placedInService: "2020-01-01", cost: 12000, basis: 12000, life: 7, currentYearDep: 0 },
    ],
    propertyId: "p1",
    annualExpenseGrowthPct: 0.03,
  });

  assert.equal(targets.length, 1);
  assert.equal(targets[0].assetId, "a2");
  assert.equal(targets[0].description, "Roof");
});

test("buildPlanningScenarioDiff and range summarize intelligent planning comparisons", () => {
  const diff = buildPlanningScenarioDiff({
    baselineLabel: "Base",
    scenarioLabel: "Re-rent 614",
    baseline: {
      assumptions: {
        horizonMonths: 24,
        annualRentGrowthPct: 3,
        annualExpenseGrowthPct: 2,
        annualValueGrowthPct: 3,
        vacancyRatePct: 5,
        monthlyCapexReserve: 250,
      },
      summary: {
        currentMarketValue: 260000,
        currentLoanBalance: 210000,
        currentEquity: 50000,
        currentMonthlyRent: 1400,
        trailingMonthlyOperatingExpenses: 300,
        fullMonthlyDebtService: 2000,
        adjustedMonthlyDebtService: 1000,
        currentRentalUsePct: 0.5,
        firstYearEffectiveRent: 15000,
        firstYearNetOperatingIncome: 11000,
        firstYearCashFlow: -2400,
        horizonEndingValue: 270000,
        horizonEndingLoanBalance: 200000,
        horizonEndingEquity: 70000,
      },
      overrides: [],
      events: [],
      goals: { minReserveMonths: 3 },
      debtPayoffPlan: { extraPrincipalMonthly: 0 },
    },
    scenario: {
      assumptions: {
        horizonMonths: 24,
        annualRentGrowthPct: 4,
        annualExpenseGrowthPct: 2,
        annualValueGrowthPct: 3,
        vacancyRatePct: 4,
        monthlyCapexReserve: 350,
      },
      summary: {
        currentMarketValue: 260000,
        currentLoanBalance: 210000,
        currentEquity: 50000,
        currentMonthlyRent: 2900,
        trailingMonthlyOperatingExpenses: 300,
        fullMonthlyDebtService: 2000,
        adjustedMonthlyDebtService: 2000,
        currentRentalUsePct: 1,
        firstYearEffectiveRent: 32000,
        firstYearNetOperatingIncome: 26000,
        firstYearCashFlow: 8000,
        horizonEndingValue: 275000,
        horizonEndingLoanBalance: 198000,
        horizonEndingEquity: 77000,
      },
      overrides: [{ propertyId: "p1", unit: "614", mode: "rented", monthlyRent: 1500 }],
      events: [{ id: "e1", propertyId: "p1", unit: "614", date: "2026-10-01", eventType: "unit_override", mode: "rented", monthlyRent: 1500 }],
      goals: { minReserveMonths: 3, minAnnualCashFlow: 0 },
      debtPayoffPlan: { extraPrincipalMonthly: 250 },
    },
  });

  const range = buildPlanningScenarioRange({
    scenarios: [
      { key: "conservative", label: "Conservative", summary: { firstYearCashFlow: -3000, firstYearNetOperatingIncome: 10000, horizonEndingEquity: 68000 } },
      { key: "base", label: "Base", summary: { firstYearCashFlow: 1200, firstYearNetOperatingIncome: 12500, horizonEndingEquity: 72000 } },
      { key: "growth", label: "Growth", summary: { firstYearCashFlow: 6400, firstYearNetOperatingIncome: 18000, horizonEndingEquity: 81000 } },
    ],
  });

  assert.ok(diff.some((row) => row.field === "Rent growth"));
  assert.ok(diff.some((row) => row.field === "Timeline events"));
  assert.equal(range.baseCashFlow, 1200);
  assert.equal(range.upsideEquity, 81000);
  assert.equal(range.downsideCashFlow, -3000);
});

test("buildPlanningRentStrategy summarizes target rent upside by unit", () => {
  const strategy = buildPlanningRentStrategy({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "l2", propertyId: "p1", unit: "614", tenantName: "Future 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
    ],
    strategies: [
      { propertyId: "p1", unit: "614", marketRent: 1525, targetRent: 1550, renewalStart: "2026-10-01", renewalTermMonths: 12, notes: "List after refresh" },
      { propertyId: "p1", unit: "616", marketRent: 1475, targetRent: 1495, renewalStart: "2027-01-01", renewalTermMonths: 12, notes: "" },
    ],
  });

  assert.equal(strategy.summary.pricedUnitCount, 2);
  assert.equal(strategy.rows[0]?.unit, "614");
  assert.equal(strategy.rows[0]?.targetRent, 1550);
  assert.ok(strategy.summary.totalAnnualUpside > 0);
  assert.equal(strategy.summary.averageIncreasePct, 0.068);
});

test("buildPlanningExitAnalysis supports refi and sell modes", () => {
  const summary = {
    currentMarketValue: 260000,
    currentLoanBalance: 210000,
    currentEquity: 50000,
    currentMonthlyRent: 1400,
    trailingMonthlyOperatingExpenses: 300,
    fullMonthlyDebtService: 2000,
    adjustedMonthlyDebtService: 1000,
    currentRentalUsePct: 0.5,
    firstYearEffectiveRent: 15000,
    firstYearNetOperatingIncome: 11000,
    firstYearCashFlow: -2400,
    horizonEndingValue: 270000,
    horizonEndingLoanBalance: 200000,
    horizonEndingEquity: 70000,
  };
  const refi = buildPlanningExitAnalysis({
    today: "2026-03-30",
    summary,
    plan: {
      mode: "refi",
      targetRatePct: 5,
      termYears: 30,
      cashOutAmount: 10000,
    },
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    propertyId: "p1",
  });
  const sale = buildPlanningExitAnalysis({
    today: "2026-03-30",
    summary,
    plan: {
      mode: "sell",
      saleDate: "2026-09-30",
      sellingCostsPct: 0.08,
    },
    properties: [
      { id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", purchasePrice: 260000, landValue: 50000, currentValue: 260000 },
    ],
    assets: [
      { id: "a1", propertyId: "p1", unit: "Shared", description: "Building", type: "Residential Building", placedInService: "2025-12-30", cost: 263000, basis: 213000, life: 27.5, currentYearDep: 0, landValue: 50000 },
    ],
    usePeriods: [],
    leases: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Rental" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    propertyId: "p1",
    annualValueGrowthPct: 0.03,
  });

  assert.equal(refi.mode, "refi");
  assert.ok(refi.projectedMonthlyDebtService > 0);
  assert.ok(refi.projectedMonthlyDebtService > 700);
  assert.match(refi.headline, /\$/);
  assert.equal(sale.mode, "sell");
  assert.ok(sale.projectedNetProceeds > 0);
  assert.ok(sale.projectedSaleValue > 260000);
  assert.ok(sale.projectedLoanPayoff > 0);
  assert.ok(sale.projectedSaleCosts > 0);
  assert.ok(sale.roughTaxEstimate >= 0);
  assert.ok(sale.roughAfterTaxProceeds <= sale.projectedNetProceeds);
  assert.match(sale.headline, /\$/);
  assert.ok(sale.monthsToExit >= 5);

  const exchange = buildPlanningExitAnalysis({
    today: "2026-03-30",
    summary,
    plan: {
      mode: "sell",
      taxTreatment: "exchange_1031",
      saleDate: "2026-09-30",
      sellingCostsPct: 0.08,
    },
    properties: [
      { id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", purchasePrice: 260000, landValue: 50000, currentValue: 260000 },
    ],
    assets: [
      { id: "a1", propertyId: "p1", unit: "Shared", description: "Building", type: "Residential Building", placedInService: "2025-12-30", cost: 263000, basis: 213000, life: 27.5, currentYearDep: 0, landValue: 50000 },
    ],
    usePeriods: [],
    leases: [],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Rental" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    propertyId: "p1",
    annualValueGrowthPct: 0.03,
  });

  assert.equal(exchange.taxTreatment, "exchange_1031");
  assert.equal(exchange.roughAfterTaxProceeds, exchange.projectedNetProceeds);
  assert.ok(exchange.roughTaxEstimate >= 0);
});

test("buildPlanningTriggerAlerts surfaces cash flow, reserve, lease, and capex warnings", () => {
  const alerts = buildPlanningTriggerAlerts({
    today: "2026-03-30",
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 210000,
      currentEquity: 50000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 300,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: 9000,
      firstYearCashFlow: -1200,
      horizonEndingValue: 270000,
      horizonEndingLoanBalance: 200000,
      horizonEndingEquity: 70000,
    },
    reserve: {
      monthlyCarryCost: 1300,
      annualReserveContribution: 1200,
      firstYearReserveContribution: 1200,
      horizonReserveContribution: 1200,
      sixMonthCushionTarget: 7800,
      firstYearCoverageMonths: 0.9,
    },
    milestones: [
      { propertyId: "p1", propertyName: "Duplex", date: "2026-04-20", title: "Lease ends for Unit 616", detail: "Plan the turnover." },
    ],
    capitalTargets: [
      { source: "asset", assetId: "a1", propertyId: "p1", propertyName: "Duplex", unit: "Shared", description: "Roof", assetType: "Capital Improvement", placedInService: "2020-01-01", targetDate: "2026-08-01", monthsRemaining: 4, yearsRemaining: 0.3, estimatedReplacementCost: 12000, monthlyReserveTarget: 500, urgency: "near_term" },
    ],
    triggers: {
      minMonthlyCashFlow: 100,
      minReserveMonths: 3,
      leaseRolloverDays: 30,
      capexWarningMonths: 6,
    },
  });

  assert.ok(alerts.some((alert) => alert.id === "minMonthlyCashFlow"));
  assert.ok(alerts.some((alert) => alert.id === "minReserveMonths"));
  assert.ok(alerts.some((alert) => alert.id === "leaseRolloverDays"));
  assert.ok(alerts.some((alert) => alert.id === "capexWarningMonths"));
});

test("buildPlanningFinancingComparison compares current, refi, and accelerated payoff paths", () => {
  const comparison = buildPlanningFinancingComparison({
    today: "2026-03-30",
    propertyId: "p1",
    loans: [
      { id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2025-12-30", rate: 6, originalBalance: 220000, currentBalance: 210000, scheduledPI: 1700, scheduledEscrow: 300, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-04-01" },
    ],
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 210000,
      currentEquity: 50000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 300,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: 11000,
      firstYearCashFlow: -2400,
      horizonEndingValue: 270000,
      horizonEndingLoanBalance: 200000,
      horizonEndingEquity: 70000,
    },
    exitPlan: {
      mode: "refi",
      targetRatePct: 5,
      termYears: 30,
      cashOutAmount: 10000,
    },
    debtPayoffPlan: {
      extraPrincipalMonthly: 200,
      lumpSumAmount: 5000,
      lumpSumDate: "2026-06-01",
    },
  });

  assert.equal(comparison.rows.length, 3);
  assert.equal(comparison.rows[0]?.id, "current");
  assert.equal(comparison.rows[1]?.id, "refi");
  assert.equal(comparison.rows[2]?.id, "accelerated");
  assert.ok((comparison.rows[0]?.fullMonthlyOutlay || 0) > (comparison.rows[0]?.planningMonthlyOutlay || 0));
  assert.ok((comparison.rows[1]?.fullMonthlyOutlay || 0) > 1400);
  assert.ok((comparison.rows[1]?.interestRemaining || 0) > 100000);
  assert.ok(comparison.rows[2]?.payoffMonths < comparison.rows[0]?.payoffMonths);
});

test("buildPlanningTurnoverPlanner estimates downtime and make-ready costs by unit", () => {
  const turnover = buildPlanningTurnoverPlanner({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    units: [
      { id: "u1", propertyId: "p1", name: "614", status: "Owner-Occupied" },
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "l2", propertyId: "p1", unit: "614", tenantName: "Future 614", startDate: "2026-10-01", endDate: "2027-03-31", monthlyRent: 1500, rentalType: "Mid-term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Pending Renewal", notes: "" },
    ],
    strategies: [
      { propertyId: "p1", unit: "614", targetRent: 1550, renewalStart: "2026-10-01", renewalTermMonths: 12 },
    ],
    plans: [
      { propertyId: "p1", unit: "614", makeReadyCost: 1800, downtimeDays: 21, leasingFeePct: 5, concessionWeeks: 1, notes: "Paint before listing" },
    ],
  });

  const unit614 = turnover.rows.find((row) => row.unit === "614");
  assert.ok(unit614);
  assert.equal(unit614?.monthlyRent, 1550);
  assert.ok((unit614?.lostRent || 0) > 0);
  assert.ok((unit614?.totalTurnoverCost || 0) > 1800);
  assert.ok(turnover.summary.totalProjectedCost > 0);
});

test("buildPlanningTurnoverPlanner uses displayed default downtime and leasing friction even before edits", () => {
  const turnover = buildPlanningTurnoverPlanner({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    units: [
      { id: "u2", propertyId: "p1", name: "616", status: "Rental" },
    ],
    leases: [
      { id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    strategies: [],
    plans: [],
  });

  assert.equal(turnover.rows[0]?.downtimeDays, 21);
  assert.equal(turnover.rows[0]?.leasingFeePct, 4);
  assert.ok((turnover.rows[0]?.lostRent || 0) > 0);
  assert.ok((turnover.rows[0]?.totalTurnoverCost || 0) > 0);
});

test("buildPlanningHealthSummary marks a negative-cash-flow thin-reserve plan as fragile", () => {
  const health = buildPlanningHealthSummary({
    today: "2026-04-03",
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 245000,
      currentEquity: 15000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 120,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: -200,
      firstYearCashFlow: -4800,
      horizonEndingValue: 268000,
      horizonEndingLoanBalance: 238000,
      horizonEndingEquity: 30000,
    },
    reserve: {
      monthlyCarryCost: 1120,
      annualReserveContribution: 3000,
      firstYearReserveContribution: 3000,
      horizonReserveContribution: 6000,
      sixMonthCushionTarget: 6720,
      firstYearCoverageMonths: 2.7,
    },
    reserveGap: 900,
    milestones: [{ propertyId: "p1", propertyName: "Duplex", date: "2026-05-31", title: "Lease ends for Unit 616", detail: "Tenant rollover risk." }],
    capitalTargets: [{ source: "asset", assetId: "a1", propertyId: "p1", propertyName: "Duplex", unit: "Shared", description: "Roof", assetType: "Roof", placedInService: "2020-01-01", targetDate: "2026-11-01", monthsRemaining: 7, yearsRemaining: 0.6, estimatedReplacementCost: 12000, monthlyReserveTarget: 900, urgency: "near_term" }],
    goalStatus: [{ id: "goal1", label: "Monthly cash flow", targetLabel: ">= 0", actualLabel: "-400", status: "off_track" }],
    projectedCashFlow: -4800,
  });

  assert.equal(health.status, "fragile");
  assert.ok(health.score < 80);
  assert.ok(health.primaryConcern.length > 0);
  assert.ok(health.factors.some((factor) => factor.status === "weak"));
});

test("buildPlanningAssumptionAudit summarizes forecast mode and scenario inputs", () => {
  const audit = buildPlanningAssumptionAudit({
    scopeLabel: "Portfolio",
    scenarioLabel: "Base hold",
    baselineLabel: "Base preset",
    assumptions: {
      horizonMonths: 24,
      annualRentGrowthPct: 3,
      annualExpenseGrowthPct: 2.5,
      annualValueGrowthPct: 3,
      vacancyRatePct: 5,
      monthlyCapexReserve: 250,
    },
    overrides: [{ propertyId: "p1", unit: "614", mode: "rented", monthlyRent: 1500 }],
    events: [{ id: "evt1", propertyId: "p1", unit: "614", date: "2026-10-01", eventType: "unit_override", mode: "rented", monthlyRent: 1500 }],
    forecastOptions: { assumeRerentAfterTurnover: true, rerentRentSource: "target", rerentTermMonths: 12 },
    exitPlan: { mode: "refi", targetRatePct: 5, termYears: 30 },
    goals: { minMonthlyCashFlow: 100 },
    triggers: { leaseRolloverDays: 60 },
    manualProjects: [{ id: "m1", propertyId: "p1", unit: "Shared", title: "Roof", targetDate: "2027-06-01", estimatedCost: 12000 }],
    capitalTargets: [{ source: "manual", assetId: "m1", propertyId: "p1", propertyName: "Duplex", unit: "Shared", description: "Roof", assetType: "Manual", placedInService: "", targetDate: "2027-06-01", monthsRemaining: 14, yearsRemaining: 1.2, estimatedReplacementCost: 12000, monthlyReserveTarget: 600, urgency: "watchlist" }],
    rentStrategyRows: [{ propertyId: "p1", propertyName: "Duplex", unit: "614", currentStatus: "Owner-Occupied", currentRent: 0, marketRent: 1500, targetRent: 1500, suggestedIncrease: 0, suggestedIncreasePct: 0, annualizedUpside: 18000, renewalStart: "", renewalTermMonths: 12, notes: "" }],
    turnoverRows: [{ propertyId: "p1", propertyName: "Duplex", unit: "614", monthlyRent: 1500, nextTurnoverDate: "2026-10-01", monthsUntilTurnover: 6, makeReadyCost: 500, downtimeDays: 21, leasingFeePct: 4, concessionWeeks: 0, lostRent: 1050, leasingFeeCost: 720, concessionCost: 0, totalTurnoverCost: 2270, recoveryMonths: 1.5, notes: "" }],
  });

  assert.ok(audit.some((row) => row.label === "Rent forecast mode" && row.value.includes("Assume re-rent")));
  assert.ok(audit.some((row) => row.label === "Unit overrides" && row.value === "1"));
  assert.ok(audit.some((row) => row.label === "Exit mode" && row.value === "Refi"));
});

test("buildPlanningRecommendedMoves and sensitivity surface actionable next steps", () => {
  const moves = buildPlanningRecommendedMoves({
    summary: {
      currentMarketValue: 260000,
      currentLoanBalance: 245000,
      currentEquity: 15000,
      currentMonthlyRent: 1400,
      trailingMonthlyOperatingExpenses: 120,
      fullMonthlyDebtService: 2000,
      adjustedMonthlyDebtService: 1000,
      currentRentalUsePct: 0.5,
      firstYearEffectiveRent: 15000,
      firstYearNetOperatingIncome: 200,
      firstYearCashFlow: -4200,
      horizonEndingValue: 268000,
      horizonEndingLoanBalance: 238000,
      horizonEndingEquity: 30000,
    },
    reserveGap: 800,
    milestones: [{ propertyId: "p1", propertyName: "Duplex", date: "2026-05-31", title: "Lease ends for Unit 616", detail: "Tenant rollover risk." }],
    triggerAlerts: [{ id: "lease", priority: "medium", title: "Lease rollover trigger fired", detail: "Unit 616 rolls soon." }],
    turnoverRows: [{ propertyId: "p1", propertyName: "Duplex", unit: "616", monthlyRent: 1400, nextTurnoverDate: "2026-05-31", monthsUntilTurnover: 2, makeReadyCost: 0, downtimeDays: 21, leasingFeePct: 4, concessionWeeks: 0, lostRent: 980, leasingFeeCost: 672, concessionCost: 0, totalTurnoverCost: 1652, recoveryMonths: 1.2, notes: "" }],
    decisionComparison: {
      currentMonthlyRent: 1400,
      fullRentalMonthlyRent: 2900,
      monthlyRentUpside: 1500,
      currentMonthlyCashFlow: -18,
      fullRentalMonthlyCashFlow: 305,
      monthlyCashFlowUpside: 323,
      currentDebtService: 1000,
      fullDebtService: 2000,
      rentableUnitCount: 2,
      upsideUnits: [{ propertyId: "p1", unit: "614", monthlyRent: 1500 }],
    },
    horizonMonths: 24,
    projectedCashFlow: -14859.84,
  });
  assert.ok(moves.some((row) => row.actionLabel.toLowerCase().includes("re-rent") || row.actionLabel.toLowerCase().includes("timeline")));

  const sensitivity = buildPlanningSensitivity({
    today: "2026-03-30",
    propertyId: "p1",
    properties: [{ id: "p1", name: "Duplex", address: "614-616 Main", type: "Duplex", currentValue: 260000 }],
    transactions: [],
    leases: [{ id: "l1", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", monthlyRent: 1400, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" }],
    loans: [],
    usePeriods: [],
    units: [{ id: "u1", propertyId: "p1", name: "616", status: "Rental" }],
    assumptions: {
      horizonMonths: 12,
      annualRentGrowthPct: 3,
      annualExpenseGrowthPct: 2.5,
      annualValueGrowthPct: 3,
      vacancyRatePct: 5,
      monthlyCapexReserve: 250,
    },
  });
  const vacancyRow = sensitivity.find((row) => row.id === "vacancy-plus-1pt");
  assert.ok(vacancyRow);
  assert.ok((vacancyRow?.deltaCashFlow || 0) <= 0);
});

test("buildPlanningReviewInbox surfaces due-soon planning work and stale assumptions", () => {
  const inbox = buildPlanningReviewInbox({
    today: "2026-03-30",
    horizonMonths: 24,
    activeScenario: { name: "Base hold", updatedAt: "2026-01-10T10:00:00.000Z" },
    scenarioIsDirty: true,
    forecastOptions: { assumeRerentAfterTurnover: false, rerentRentSource: "target", rerentTermMonths: 12 },
    milestones: [{ propertyId: "p1", propertyName: "Duplex", date: "2026-05-31", title: "Lease ends for Unit 616", detail: "Tenant rollover risk." }],
    capitalTargets: [{ source: "manual", assetId: "m1", propertyId: "p1", propertyName: "Duplex", unit: "Shared", description: "Roof", assetType: "Manual", placedInService: "", targetDate: "2026-09-01", monthsRemaining: 5, yearsRemaining: 0.4, estimatedReplacementCost: 12000, monthlyReserveTarget: 800, urgency: "near_term" }],
    triggerAlerts: [{ id: "lease", priority: "medium", title: "Lease rollover trigger fired", detail: "Unit 616 rolls soon." }],
    recommendedMoves: [{ id: "reserve-gap", priority: "medium", title: "Increase reserve funding", detail: "Tracked capital needs run ahead of the current reserve.", actionLabel: "Raise monthly reserve target" }],
    actionItems: [{ id: "a1", title: "Call lender", status: "idea", priority: "high", dueDate: "2026-03-25", notes: "Discuss reserve line." }],
    confidence: { label: "Medium confidence", detail: "Still relies on a few planning assumptions rather than confirmed future leases." },
    goalCount: 0,
    triggerCount: 1,
  });

  assert.ok(inbox.some((item) => item.title.includes("Action overdue")));
  assert.ok(inbox.some((item) => item.title.includes("Save or branch")));
  assert.ok(inbox.some((item) => item.title.includes("Decide what happens after the signed leases end")));
  assert.ok(inbox.some((item) => item.title.includes("Fund the next capital target")));
});
