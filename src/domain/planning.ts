import { getPropertyCostBasis, type Asset, type Lease, type Loan, type Property, type Transaction, type Unit, type UsePeriod } from "../models.ts";
import { deductibleMortgageInterest, getRentalUsePctForDate, loanBreakdown } from "./accounting.ts";
import { adjustedAssetDepreciationForYear } from "./assetDepreciation.ts";
import { formatUnitLabel } from "./unitLabels.js";
import { leaseIsOpenEnded, normalizeLeaseAgreementType } from "./leaseTerms.js";

export type PlanningAssumptions = {
  horizonMonths: number;
  annualRentGrowthPct: number;
  annualExpenseGrowthPct: number;
  annualValueGrowthPct: number;
  vacancyRatePct: number;
  monthlyCapexReserve: number;
  includedUtilitiesMonthly?: number;
};

export type PlanningForecastOptions = {
  assumeRerentAfterTurnover?: boolean;
  rerentRentSource?: "target" | "market" | "current";
  rerentTermMonths?: number;
};

export type PlanningScenarioUnitOverride = {
  propertyId: string;
  unit: string;
  mode: "auto" | "rented" | "owner" | "vacant";
  monthlyRent?: number;
};

export type PlanningScenarioEvent = {
  id: string;
  propertyId: string;
  unit?: string;
  date: string;
  eventType: "unit_override" | "reserve_change";
  mode?: "rented" | "owner" | "vacant";
  monthlyRent?: number;
  monthlyCapexReserve?: number;
  notes?: string;
};

export type PlanningProjectionRow = {
  month: string;
  scheduledRent: number;
  vacancyLoss: number;
  effectiveRent: number;
  operatingExpenses: number;
  utilityIncludedAdjustment: number;
  netOperatingIncome: number;
  debtService: number;
  capexReserve: number;
  cashFlow: number;
  projectedValue: number;
  projectedLoanBalance: number;
  projectedEquity: number;
  driverLabel?: string;
  driverDetail?: string;
};

export type PlanningProjectionSummary = {
  currentMarketValue: number;
  currentLoanBalance: number;
  currentEquity: number;
  currentMonthlyRent: number;
  trailingMonthlyOperatingExpenses: number;
  fullMonthlyDebtService: number;
  adjustedMonthlyDebtService: number;
  currentRentalUsePct: number;
  firstYearEffectiveRent: number;
  firstYearNetOperatingIncome: number;
  firstYearCashFlow: number;
  horizonEndingValue: number;
  horizonEndingLoanBalance: number;
  horizonEndingEquity: number;
};

export type PlanningProjectionResult = {
  rows: PlanningProjectionRow[];
  summary: PlanningProjectionSummary;
};

export type PlanningPropertySnapshot = {
  propertyId: string;
  propertyName: string;
  currentMarketValue: number;
  currentLoanBalance: number;
  currentEquity: number;
  currentMonthlyRent: number;
  adjustedMonthlyDebtService: number;
  currentRentalUsePct: number;
};

export type PlanningMilestone = {
  propertyId: string;
  propertyName: string;
  date: string;
  title: string;
  detail: string;
};

export type PlanningDecisionComparison = {
  currentMonthlyRent: number;
  fullRentalMonthlyRent: number;
  monthlyRentUpside: number;
  currentMonthlyCashFlow: number;
  fullRentalMonthlyCashFlow: number;
  monthlyCashFlowUpside: number;
  currentDebtService: number;
  fullDebtService: number;
  rentableUnitCount: number;
  upsideUnits: Array<{
    propertyId: string;
    unit: string;
    monthlyRent: number;
  }>;
};

export type PlanningReserveSummary = {
  monthlyCarryCost: number;
  annualReserveContribution: number;
  firstYearReserveContribution: number;
  horizonReserveContribution: number;
  sixMonthCushionTarget: number;
  firstYearCoverageMonths: number;
};

export type PlanningCapitalTarget = {
  source: "asset" | "manual";
  assetId: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  description: string;
  assetType: string;
  placedInService: string;
  targetDate: string;
  monthsRemaining: number;
  yearsRemaining: number;
  estimatedReplacementCost: number;
  monthlyReserveTarget: number;
  urgency: "near_term" | "watchlist" | "long_range";
  notes?: string;
  linkedAssetId?: string;
  priority?: "high" | "medium" | "low";
  fundingSource?: "reserve" | "cash" | "financing" | "heloc" | "tbd";
  scheduleType?: "one_time" | "phased";
  mustFundBy?: string;
};

export type PlanningManualCapitalProject = {
  id: string;
  propertyId: string;
  unit: string;
  title: string;
  targetDate: string;
  estimatedCost: number;
  linkedAssetId?: string;
  notes?: string;
  priority?: "high" | "medium" | "low";
  fundingSource?: "reserve" | "cash" | "financing" | "heloc" | "tbd";
  scheduleType?: "one_time" | "phased";
  mustFundBy?: string;
};

export type PlanningRecommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type PlanningRentStrategyInput = {
  propertyId: string;
  unit: string;
  marketRent?: number;
  targetRent?: number;
  renewalStart?: string;
  renewalTermMonths?: number;
  notes?: string;
};

export type PlanningRentStrategyRow = {
  propertyId: string;
  propertyName: string;
  unit: string;
  currentStatus: string;
  currentRent: number;
  marketRent: number;
  targetRent: number;
  suggestedIncrease: number;
  suggestedIncreasePct: number;
  annualizedUpside: number;
  renewalStart: string;
  renewalTermMonths: number;
  notes: string;
};

export type PlanningRentStrategySummary = {
  pricedUnitCount: number;
  totalAnnualUpside: number;
  averageIncreasePct: number;
};

export type PlanningExitPlan = {
  mode: "hold" | "refi" | "sell";
  taxTreatment?: "taxable_sale" | "exchange_1031";
  targetRatePct?: number;
  termYears?: number;
  cashOutAmount?: number;
  saleDate?: string;
  sellingCostsPct?: number;
};

export type PlanningExitAnalysis = {
  mode: "hold" | "refi" | "sell";
  taxTreatment: "taxable_sale" | "exchange_1031";
  currentEquity: number;
  currentAdjustedDebtService: number;
  projectedMonthlyDebtService: number;
  monthlyCashFlowChange: number;
  projectedSaleValue: number;
  projectedLoanPayoff: number;
  projectedNetProceeds: number;
  projectedSaleCosts: number;
  roughTaxBasis: number;
  roughAccumulatedDepreciation: number;
  roughTaxableGain: number;
  roughDepreciationRecapture: number;
  roughCapitalGain: number;
  roughTaxEstimate: number;
  roughAfterTaxProceeds: number;
  monthsToExit: number;
  headline: string;
};

export type PlanningGoalSet = {
  minMonthlyCashFlow?: number;
  minAnnualCashFlow?: number;
  minReserveMonths?: number;
  minEndingEquity?: number;
  maxLtvPct?: number;
  minDscr?: number;
};

export type PlanningTriggerSet = {
  minMonthlyCashFlow?: number;
  minReserveMonths?: number;
  leaseRolloverDays?: number;
  capexWarningMonths?: number;
};

export type PlanningTriggerAlert = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type PlanningGoalStatus = {
  id: string;
  label: string;
  targetLabel: string;
  actualLabel: string;
  status: "on_track" | "watch" | "off_track";
};

export type PlanningDebtPayoffPlan = {
  extraPrincipalMonthly?: number;
  lumpSumAmount?: number;
  lumpSumDate?: string;
};

export type PlanningDebtPayoffAnalysis = {
  currentMonthsToPayoff: number;
  acceleratedMonthsToPayoff: number;
  monthsSaved: number;
  currentInterestRemaining: number;
  acceleratedInterestRemaining: number;
  interestSaved: number;
  projectedPayoffDate: string;
  monthlyExtraOutlay: number;
};

export type PlanningFinancingComparisonRow = {
  id: "current" | "refi" | "accelerated";
  label: string;
  fullMonthlyOutlay: number;
  planningMonthlyOutlay: number;
  payoffMonths: number;
  payoffDate: string;
  interestRemaining: number;
  cashFlowImpact: number;
  note: string;
};

export type PlanningFinancingComparison = {
  weightedCurrentRatePct: number;
  currentLoanBalance: number;
  rows: PlanningFinancingComparisonRow[];
};

export type PlanningTaxProjection = {
  grossRent: number;
  operatingExpenses: number;
  mortgageInterest: number;
  depreciation: number;
  projectedScheduleE: number;
  projectedTaxableIncome: number;
  note: string;
};

export type PlanningTurnoverInput = {
  propertyId: string;
  unit: string;
  makeReadyCost?: number;
  downtimeDays?: number;
  leasingFeePct?: number;
  concessionWeeks?: number;
  notes?: string;
};

export type PlanningTurnoverRow = {
  propertyId: string;
  propertyName: string;
  unit: string;
  monthlyRent: number;
  nextTurnoverDate: string;
  monthsUntilTurnover: number;
  makeReadyCost: number;
  downtimeDays: number;
  leasingFeePct: number;
  concessionWeeks: number;
  lostRent: number;
  leasingFeeCost: number;
  concessionCost: number;
  totalTurnoverCost: number;
  recoveryMonths: number;
  notes: string;
};

export type PlanningTurnoverSummary = {
  pricedUnitCount: number;
  totalProjectedCost: number;
  averageDowntimeDays: number;
  soonestTurnoverDate: string;
};

export type PlanningScenarioDiffRow = {
  field: string;
  baselineValue: string;
  scenarioValue: string;
};

export type PlanningScenarioRange = {
  downsideCashFlow: number;
  baseCashFlow: number;
  upsideCashFlow: number;
  downsideNoi: number;
  baseNoi: number;
  upsideNoi: number;
  downsideEquity: number;
  baseEquity: number;
  upsideEquity: number;
};

export type PlanningHealthFactor = {
  id: string;
  label: string;
  status: "strong" | "watch" | "weak";
  detail: string;
};

export type PlanningHealthSummary = {
  score: number;
  status: "stable" | "watch" | "fragile";
  label: string;
  primaryConcern: string;
  factors: PlanningHealthFactor[];
};

export type PlanningAssumptionAuditRow = {
  category: string;
  label: string;
  value: string;
  note?: string;
};

export type PlanningRecommendedMove = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  actionLabel: string;
};

export type PlanningSensitivityRow = {
  id: string;
  label: string;
  adjustmentLabel: string;
  direction: "positive" | "negative";
  deltaCashFlow: number;
  deltaNoi: number;
  deltaEquity: number;
  note: string;
};

export type PlanningReviewInboxItem = {
  id: string;
  category: "scenario" | "decision" | "trigger" | "action" | "capital" | "data";
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  actionLabel: string;
  dueDate?: string;
};

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function csvCell(value: string | number) {
  const asText = String(value ?? "");
  if (/[,"\n]/.test(asText)) {
    return `"${asText.replace(/"/g, '""')}"`;
  }
  return asText;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function firstDayOfNextMonth(dateText: string) {
  const [year, month] = String(dateText || "").slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

function isoDateFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthMidpointIso(date: Date) {
  return isoDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, 15);
}

function addYears(dateText: string, years: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function addDays(dateText: string, offset: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function monthDifference(startDateText: string, endDateText: string) {
  const [startYear, startMonth, startDay] = String(startDateText || "").split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endDateText || "").split("-").map(Number);
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return 0;
  let months = ((endYear - startYear) * 12) + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  return months;
}

function dayDifference(startDateText: string, endDateText: string) {
  const start = new Date(`${String(startDateText || "").slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(endDateText || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function addMonths(dateText: string, offset: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function amortizedPayment(balance: number, annualRatePct: number, termYears: number) {
  const principal = Math.max(0, Number(balance || 0));
  const years = Math.max(1, Number(termYears || 0));
  const monthlyRate = Math.max(0, Number(annualRatePct || 0)) / 100 / 12;
  const totalPayments = Math.max(1, Math.round(years * 12));
  if (!principal) return 0;
  if (!monthlyRate) return principal / totalPayments;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalPayments));
}

function leaseIsActiveByDate(lease: Lease, dateText: string) {
  if (!dateText) return false;
  if (lease.startDate > dateText) return false;
  if (lease.actualEndDate) return lease.actualEndDate >= dateText;
  if (leaseIsOpenEnded(lease)) return true;
  return lease.endDate >= dateText;
}

function usePeriodIsActiveByDate(period: UsePeriod, dateText: string) {
  if (!dateText) return false;
  if (period.startDate > dateText) return false;
  if (!period.endDate) return true;
  return period.endDate >= dateText;
}

function matchesPropertyScope(propertyId: string, scopePropertyId?: string) {
  return !scopePropertyId || scopePropertyId === "all" || propertyId === scopePropertyId;
}

function sumCurrentValue(properties: Property[], scopePropertyId?: string) {
  return properties
    .filter((property) => matchesPropertyScope(property.id, scopePropertyId))
    .reduce((sum, property) => sum + Number(property.currentValue || property.purchasePrice || 0), 0);
}

function sumLoanBalance(loans: Loan[], scopePropertyId?: string) {
  return loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => sum + Number(loan.currentBalance || 0), 0);
}

function trailingMonthlyOperatingExpenses(args: {
  today: string;
  transactions: Transaction[];
  scopePropertyId?: string;
}) {
  return trailingMonthlyOperatingExpenseProfile(args).monthlyTotal;
}

function transactionIsOperatingExpense(txn: Transaction, scopePropertyId?: string) {
  if (txn.type !== "Expense" || txn.capitalImprovement) return false;
  if (!matchesPropertyScope(txn.propertyId, scopePropertyId)) return false;
  if (txn.category === "Escrow" || txn.category === "Mortgage Interest" || txn.category === "Mortgage interest paid to banks") return false;
  return true;
}

function transactionIsUtilityExpense(txn: Transaction) {
  return String(txn.category || "").toLowerCase() === "utilities";
}

function trailingMonthlyOperatingExpenseProfile(args: {
  today: string;
  transactions: Transaction[];
  scopePropertyId?: string;
}) {
  const end = new Date(`${args.today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 12);
  const startIso = start.toISOString().slice(0, 10);

  const utilityMonths = new Set<string>();
  const totals = args.transactions.reduce((sum, txn) => {
    if (!transactionIsOperatingExpense(txn, args.scopePropertyId)) return sum;
    if (!txn.date || txn.date < startIso || txn.date > args.today) return sum;
    const amount = Number(txn.amount || 0);
    sum.total += amount;
    if (transactionIsUtilityExpense(txn)) {
      sum.utilities += amount;
      utilityMonths.add(txn.date.slice(0, 7));
    }
    return sum;
  }, { total: 0, utilities: 0 });

  const monthlyTotal = totals.total / 12;
  const utilityBaselineMonthly = totals.utilities / 12;
  const monthlyUtilityEstimate = utilityMonths.size > 0 ? totals.utilities / utilityMonths.size : 0;

  return {
    monthlyTotal,
    utilityBaselineMonthly,
    monthlyUtilityEstimate,
    utilitySampleMonths: utilityMonths.size,
  };
}

function utilitiesIncludedLeaseCountForDate(args: {
  date: string;
  leases: Lease[];
  scopePropertyId?: string;
}) {
  return args.leases.reduce((count, lease) => {
    if (!lease.utilitiesIncluded) return count;
    if (!matchesPropertyScope(lease.propertyId, args.scopePropertyId)) return count;
    if (!leaseIsActiveByDate(lease, args.date)) return count;
    return count + 1;
  }, 0);
}

function scheduledRentForDate(args: {
  date: string;
  leases: Lease[];
  scopePropertyId?: string;
}) {
  return args.leases.reduce((sum, lease) => {
    if (!matchesPropertyScope(lease.propertyId, args.scopePropertyId)) return sum;
    if (!leaseIsActiveByDate(lease, args.date)) return sum;
    return sum + Number(lease.monthlyRent || 0);
  }, 0);
}

function bestKnownRentForUnit(args: {
  propertyId: string;
  unitName: string;
  leases: Lease[];
  today: string;
}) {
  const scoped = args.leases.filter((lease) => lease.propertyId === args.propertyId && lease.unit === args.unitName);
  const active = scoped.find((lease) => leaseIsActiveByDate(lease, args.today));
  if (active) return Number(active.monthlyRent || 0);

  const next = scoped
    .filter((lease) => lease.startDate >= args.today)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
  if (next) return Number(next.monthlyRent || 0);

  const previous = scoped
    .slice()
    .sort((left, right) => {
      const leftEnd = left.actualEndDate || left.endDate || left.startDate;
      const rightEnd = right.actualEndDate || right.endDate || right.startDate;
      return rightEnd.localeCompare(leftEnd);
    })[0];
  return Number(previous?.monthlyRent || 0);
}

function overrideKey(propertyId: string, unit: string) {
  return `${propertyId}::${unit}`;
}

function normalizeScenarioOverrideMode(mode?: string) {
  if (mode === "rented" || mode === "owner" || mode === "vacant") return mode;
  return "auto";
}

function normalizeScenarioEvent(args: {
  event: PlanningScenarioEvent;
  today: string;
}) {
  const event = args.event;
  return {
    id: String(event.id || ""),
    propertyId: String(event.propertyId || ""),
    unit: String(event.unit || "Shared"),
    date: String(event.date || args.today),
    eventType: event.eventType,
    mode: normalizeScenarioOverrideMode(event.mode),
    monthlyRent: Math.max(0, Number(event.monthlyRent || 0)),
    monthlyCapexReserve: Math.max(0, Number(event.monthlyCapexReserve || 0)),
    notes: String(event.notes || ""),
  };
}

function buildPlanningScenarioStateAtDate(args: {
  today: string;
  date: string;
  baseOverrides?: PlanningScenarioUnitOverride[];
  scenarioEvents?: PlanningScenarioEvent[];
  baseMonthlyCapexReserve?: number;
}) {
  const overrideMap = (args.baseOverrides || [])
    .filter((override) => override?.propertyId && override?.unit && override.mode && override.mode !== "auto")
    .reduce((map, override) => {
      map[overrideKey(override.propertyId, override.unit)] = {
        propertyId: override.propertyId,
        unit: override.unit,
        mode: override.mode,
        monthlyRent: Number(override.monthlyRent || 0),
      };
      return map;
    }, {} as Record<string, { propertyId: string; unit: string; mode: "rented" | "owner" | "vacant"; monthlyRent: number }>);

  let monthlyCapexReserve = Math.max(0, Number(args.baseMonthlyCapexReserve || 0));
  const relevantEvents = (args.scenarioEvents || [])
    .filter((event) => event?.propertyId && event?.date && event.date <= args.date)
    .map((event) => normalizeScenarioEvent({ event, today: args.today }))
    .sort((left, right) => {
      const dateCompare = left.date.localeCompare(right.date);
      if (dateCompare !== 0) return dateCompare;
      return left.id.localeCompare(right.id);
    });

  relevantEvents.forEach((event) => {
    if (event.eventType === "reserve_change") {
      monthlyCapexReserve = Math.max(0, Number(event.monthlyCapexReserve || 0));
      return;
    }
    if (event.eventType === "unit_override" && event.propertyId && event.unit && event.mode !== "auto") {
      overrideMap[overrideKey(event.propertyId, event.unit)] = {
        propertyId: event.propertyId,
        unit: event.unit,
        mode: event.mode,
        monthlyRent: Number(event.monthlyRent || 0),
      };
    }
  });

  return {
    overrides: Object.values(overrideMap),
    monthlyCapexReserve,
  };
}

function applyPlanningScenarioOverrides(args: {
  today: string;
  leases: Lease[];
  usePeriods: UsePeriod[];
  units: Unit[];
  overrides?: PlanningScenarioUnitOverride[];
}) {
  const normalizedOverrides = (args.overrides || [])
    .filter((override) => override?.propertyId && override?.unit && override.mode && override.mode !== "auto")
    .reduce((map, override) => {
      map[overrideKey(override.propertyId, override.unit)] = {
        propertyId: override.propertyId,
        unit: override.unit,
        mode: override.mode,
        monthlyRent: Number(override.monthlyRent || 0),
      };
      return map;
    }, {} as Record<string, { propertyId: string; unit: string; mode: "rented" | "owner" | "vacant"; monthlyRent: number }>);

  if (Object.keys(normalizedOverrides).length === 0) {
    return {
      leases: args.leases,
      usePeriods: args.usePeriods,
      units: args.units,
    };
  }

  const leases = args.leases.filter((lease) => !normalizedOverrides[overrideKey(lease.propertyId, String(lease.unit || ""))]);
  const usePeriods = args.usePeriods.filter((period) => !normalizedOverrides[overrideKey(period.propertyId, String(period.unit || ""))]);
  const units = args.units.map((unit) => {
    const override = normalizedOverrides[overrideKey(unit.propertyId, unit.name)];
    if (!override) return unit;
    return {
      ...unit,
      status: override.mode === "rented" ? "Rental" : override.mode === "owner" ? "Owner-Occupied" : "Vacant",
    };
  });

  const scenarioEnd = addMonths(args.today, 120);
  Object.values(normalizedOverrides).forEach((override) => {
    if (override.mode === "rented") {
      leases.push({
        id: `planning-override-${override.propertyId}-${override.unit}`,
        propertyId: override.propertyId,
        unit: override.unit,
        tenantName: "Scenario override",
        startDate: args.today,
        endDate: scenarioEnd,
        monthlyRent: Number(override.monthlyRent || 0),
        rentalType: "Long-term",
        utilitiesIncluded: false,
        monthToMonthAfterTerm: true,
        extensionTermMonths: 0,
        status: "Active",
        notes: "Planning override",
      });
      return;
    }

    usePeriods.push({
      id: `planning-override-${override.propertyId}-${override.unit}`,
      propertyId: override.propertyId,
      unit: override.unit,
      startDate: args.today,
      endDate: "",
      useType: override.mode === "owner" ? "Owner-Occupied" : "Vacant",
      rentalUsePct: 0,
    });
  });

  return { leases, usePeriods, units };
}

function currentAdjustedDebtService(args: {
  today: string;
  loans: Loan[];
  scopePropertyId?: string;
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
}) {
  const fullDebtService = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, args.scopePropertyId))
    .reduce((sum, loan) => sum + loanBreakdown(loan).totalMonthlyPayment, 0);

  const adjustedDebtService = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, args.scopePropertyId))
    .reduce((sum, loan) => {
      const rentalUsePct = getRentalUsePctForDate({
        propertyId: loan.propertyId,
        unit: "Shared",
        date: args.today,
        usePeriods: args.usePeriods,
        leases: args.leases,
        units: args.units,
        fallbackOwnerUsePct: 0,
      });
      return sum + (loanBreakdown(loan).totalMonthlyPayment * rentalUsePct);
    }, 0);

  return {
    fullDebtService,
    adjustedDebtService,
    currentRentalUsePct: fullDebtService > 0 ? adjustedDebtService / fullDebtService : 1,
  };
}

export function buildPlanningPropertySnapshots(args: {
  today: string;
  properties: Property[];
  leases: Lease[];
  loans: Loan[];
  usePeriods: UsePeriod[];
  units: Unit[];
  propertyId?: string;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
}): PlanningPropertySnapshot[] {
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: args.usePeriods,
    units: args.units,
    overrides: args.scenarioOverrides,
  });
  return args.properties
    .filter((property) => matchesPropertyScope(property.id, args.propertyId))
    .map((property) => {
      const currentMarketValue = Number(property.currentValue || property.purchasePrice || 0);
      const currentLoanBalance = sumLoanBalance(args.loans, property.id);
      const currentMonthlyRent = scheduledRentForDate({
        date: args.today,
        leases: effective.leases,
        scopePropertyId: property.id,
      });
      const debtSnapshot = currentAdjustedDebtService({
        today: args.today,
        loans: args.loans,
        scopePropertyId: property.id,
        usePeriods: effective.usePeriods,
        leases: effective.leases,
        units: effective.units,
      });
      return {
        propertyId: property.id,
        propertyName: property.name,
        currentMarketValue: Math.round(currentMarketValue * 100) / 100,
        currentLoanBalance: Math.round(currentLoanBalance * 100) / 100,
        currentEquity: Math.round((currentMarketValue - currentLoanBalance) * 100) / 100,
        currentMonthlyRent: Math.round(currentMonthlyRent * 100) / 100,
        adjustedMonthlyDebtService: Math.round(debtSnapshot.adjustedDebtService * 100) / 100,
        currentRentalUsePct: clampPct(debtSnapshot.currentRentalUsePct),
      };
    })
    .sort((left, right) => right.currentEquity - left.currentEquity);
}

export function buildPlanningMilestones(args: {
  today: string;
  properties: Property[];
  leases: Lease[];
  usePeriods: UsePeriod[];
  units?: Unit[];
  propertyId?: string;
  horizonMonths?: number;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
  scenarioEvents?: PlanningScenarioEvent[];
  rentStrategies?: PlanningRentStrategyInput[];
  turnoverInputs?: PlanningTurnoverInput[];
  forecastOptions?: PlanningForecastOptions;
}): PlanningMilestone[] {
  const horizonEnd = addMonths(args.today, Math.max(1, Math.min(60, Math.round(Number(args.horizonMonths || 12)))));
  const propertyNameById = Object.fromEntries(args.properties.map((property) => [property.id, property.name]));
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: args.usePeriods,
    units: [],
    overrides: args.scenarioOverrides,
  });

  const leaseMilestones = effective.leases
    .filter((lease) => matchesPropertyScope(lease.propertyId, args.propertyId))
    .flatMap((lease) => {
      const milestones: PlanningMilestone[] = [];
      if (lease.startDate >= args.today && lease.startDate <= horizonEnd) {
        milestones.push({
          propertyId: lease.propertyId,
          propertyName: propertyNameById[lease.propertyId] || lease.propertyId,
          date: lease.startDate,
          title: `Lease starts for ${formatUnitLabel(lease.unit)}`,
          detail: `${lease.tenantName} at ${lease.monthlyRent.toFixed(0)} / mo.`,
        });
      }
      const endDate = lease.actualEndDate || lease.endDate;
      if (endDate >= args.today && endDate <= horizonEnd) {
        milestones.push({
          propertyId: lease.propertyId,
          propertyName: propertyNameById[lease.propertyId] || lease.propertyId,
          date: endDate,
          title: `Lease ends for ${formatUnitLabel(lease.unit)}`,
          detail: `${lease.tenantName}${lease.monthToMonthAfterTerm ? " (month-to-month)" : ""}`,
        });
      }
      return milestones;
    });

  const usePeriodMilestones = effective.usePeriods
    .filter((period) => matchesPropertyScope(period.propertyId, args.propertyId))
    .filter((period) => period.startDate >= args.today && period.startDate <= horizonEnd)
    .map((period) => ({
      propertyId: period.propertyId,
      propertyName: propertyNameById[period.propertyId] || period.propertyId,
      date: period.startDate,
      title: `${period.useType} starts for ${formatUnitLabel(period.unit)}`,
      detail: period.endDate ? `Scheduled through ${period.endDate}` : "Open-ended until changed",
    }));

  const scenarioEventMilestones = (args.scenarioEvents || [])
    .filter((event) => event?.propertyId && matchesPropertyScope(event.propertyId, args.propertyId))
    .filter((event) => event.date >= args.today && event.date <= horizonEnd)
    .map((event) => {
      const normalized = normalizeScenarioEvent({ event, today: args.today });
      if (normalized.eventType === "reserve_change") {
        return {
          propertyId: normalized.propertyId,
          propertyName: propertyNameById[normalized.propertyId] || normalized.propertyId,
          date: normalized.date,
          title: "Reserve target change",
          detail: `Planning reserve changes to ${Math.round(normalized.monthlyCapexReserve)} / mo.`,
        };
      }

      return {
        propertyId: normalized.propertyId,
        propertyName: propertyNameById[normalized.propertyId] || normalized.propertyId,
        date: normalized.date,
        title: `Scenario change for ${formatUnitLabel(normalized.unit)}`,
        detail: `${normalized.mode === "rented" ? "Rented" : normalized.mode === "owner" ? "Owner-Occupied" : "Vacant"}${normalized.mode === "rented" && normalized.monthlyRent ? ` at ${Math.round(normalized.monthlyRent)} / mo.` : ""}${normalized.notes ? ` ${normalized.notes}` : ""}`,
      };
    });

  const forecastRerentAssumptions = buildPlanningForecastRerentAssumptions({
    today: args.today,
    propertyId: args.propertyId,
    units: args.units || [],
    leases: effective.leases,
    rentStrategies: args.rentStrategies,
    turnoverInputs: args.turnoverInputs,
    forecastOptions: args.forecastOptions,
  });

  const rerentMilestones = forecastRerentAssumptions
    .filter((assumption) => assumption.startDate >= args.today && assumption.startDate <= horizonEnd)
    .map((assumption) => ({
      propertyId: assumption.propertyId,
      propertyName: propertyNameById[assumption.propertyId] || assumption.propertyId,
      date: assumption.startDate,
      title: `Assumed re-rent for ${formatUnitLabel(assumption.unit)}`,
      detail: `${Math.round(assumption.monthlyRent)} / mo after ${assumption.downtimeDays} downtime days (${assumption.sourceLabel} rent source).`,
    }));

  return [...leaseMilestones, ...usePeriodMilestones, ...scenarioEventMilestones, ...rerentMilestones]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 8);
}

function projectLoanBalance(balance: number, loan: Loan) {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  const monthlyRate = Number(loan.rate || 0) / 100 / 12;
  const scheduledPI = Number(loan.scheduledPI || 0);
  const extraPrincipal = Number(loan.defaultExtraPrincipal || 0);
  const interest = balance * monthlyRate;
  const scheduledPrincipal = Math.max(0, scheduledPI - interest);
  const principalReduction = Math.min(balance, scheduledPrincipal + extraPrincipal);
  const nextBalance = balance - principalReduction;
  return Math.max(0, Math.round(nextBalance * 100) / 100);
}

type PlanningForecastRerentAssumption = {
  propertyId: string;
  unit: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  downtimeDays: number;
  priorLeaseEnd: string;
  sourceLabel: string;
};

function buildPlanningForecastRerentAssumptions(args: {
  today: string;
  propertyId?: string;
  units: Unit[];
  leases: Lease[];
  rentStrategies?: PlanningRentStrategyInput[];
  turnoverInputs?: PlanningTurnoverInput[];
  forecastOptions?: PlanningForecastOptions;
}) {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const options = args.forecastOptions || {};
  if (!options.assumeRerentAfterTurnover) return [] as PlanningForecastRerentAssumption[];

  const source = options.rerentRentSource || "target";
  const defaultTermMonths = Math.max(1, Number(options.rerentTermMonths || 12));

  return args.units
    .filter((unit) => unit.name !== "Shared" && matchesPropertyScope(unit.propertyId, scopePropertyId))
    .flatMap((unit) => {
      const unitLeases = args.leases
        .filter((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name)
        .sort((left, right) => left.startDate.localeCompare(right.startDate));
      const activeLease = unitLeases.find((lease) => leaseIsActiveByDate(lease, args.today));
      if (!activeLease || normalizeLeaseAgreementType(activeLease) !== "fixed_term" || !activeLease.endDate) return [];

      const successorLease = unitLeases.find((lease) => lease.startDate > activeLease.endDate);
      if (successorLease) return [];

      const strategy = (args.rentStrategies || []).find((item) => item.propertyId === unit.propertyId && item.unit === unit.name);
      const turnover = (args.turnoverInputs || []).find((item) => item.propertyId === unit.propertyId && item.unit === unit.name);
      const targetRent = Math.max(0, Number(strategy?.targetRent || 0));
      const marketRent = Math.max(0, Number(strategy?.marketRent || 0));
      const currentRent = Math.max(0, Number(activeLease.monthlyRent || 0));
      const monthlyRent = source === "market"
        ? (marketRent || targetRent || currentRent)
        : source === "current"
          ? (currentRent || targetRent || marketRent)
          : (targetRent || marketRent || currentRent);
      if (!monthlyRent) return [];

      const downtimeDays = Math.max(0, Number(turnover?.downtimeDays ?? 21));
      const computedStart = addDays(activeLease.endDate, downtimeDays + 1);
      const renewalStart = strategy?.renewalStart && strategy.renewalStart >= computedStart
        ? strategy.renewalStart
        : computedStart;
      const termMonths = Math.max(1, Number(strategy?.renewalTermMonths || defaultTermMonths));
      const endDate = addDays(addMonths(renewalStart, termMonths), -1);

      return [{
        propertyId: unit.propertyId,
        unit: unit.name,
        startDate: renewalStart,
        endDate,
        monthlyRent: Math.round(monthlyRent * 100) / 100,
        downtimeDays,
        priorLeaseEnd: activeLease.endDate,
        sourceLabel: source,
      }];
    });
}

function projectLoanBalancesToDate(args: {
  today: string;
  targetDate: string;
  loans: Loan[];
  propertyId?: string;
}) {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const months = Math.max(0, monthDifference(args.today, args.targetDate || args.today));
  return args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => {
      let balance = Math.max(0, Number(loan.currentBalance || 0));
      for (let index = 0; index < months; index += 1) {
        balance = projectLoanBalance(balance, loan);
      }
      return sum + balance;
    }, 0);
}

function adjustedAssetDepreciationThroughDate(args: {
  asset: Asset;
  date: string;
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
}) {
  if (!args.asset.placedInService || !args.date || args.asset.placedInService > args.date) return 0;
  const saleYear = Number(String(args.date).slice(0, 4));
  if (!saleYear) return 0;

  let total = 0;
  for (let year = Number(String(args.asset.placedInService).slice(0, 4)); year <= saleYear; year += 1) {
    const annual = adjustedAssetDepreciationForYear({
      asset: args.asset,
      year,
      usePeriods: args.usePeriods,
      leases: args.leases,
      units: args.units,
    });
    if (!annual) continue;
    if (year < saleYear) {
      total += annual;
      continue;
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const inYearStart = args.asset.placedInService > yearStart ? args.asset.placedInService : yearStart;
    const inYearEnd = args.date < yearEnd ? args.date : yearEnd;
    const daysInService = Math.max(0, dayDifference(inYearStart, inYearEnd) + 1);
    const daysInYear = Math.max(1, dayDifference(yearStart, yearEnd) + 1);
    total += annual * (daysInService / daysInYear);
  }

  return Math.round(total * 100) / 100;
}

export function buildPlanningProjection(args: {
  today: string;
  properties: Property[];
  transactions: Transaction[];
  leases: Lease[];
  loans: Loan[];
  usePeriods: UsePeriod[];
  units: Unit[];
  assumptions: PlanningAssumptions;
  propertyId?: string;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
  scenarioEvents?: PlanningScenarioEvent[];
  rentStrategies?: PlanningRentStrategyInput[];
  turnoverInputs?: PlanningTurnoverInput[];
  forecastOptions?: PlanningForecastOptions;
}) : PlanningProjectionResult {
  const horizonMonths = Math.max(1, Math.min(60, Math.round(Number(args.assumptions.horizonMonths || 12))));
  const expenseGrowthPct = clampPct(Number(args.assumptions.annualExpenseGrowthPct || 0));
  const valueGrowthPct = clampPct(Number(args.assumptions.annualValueGrowthPct || 0));
  const vacancyRatePct = clampPct(Number(args.assumptions.vacancyRatePct || 0));
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const currentScenarioState = buildPlanningScenarioStateAtDate({
    today: args.today,
    date: args.today,
    baseOverrides: args.scenarioOverrides,
    scenarioEvents: args.scenarioEvents,
    baseMonthlyCapexReserve: Number(args.assumptions.monthlyCapexReserve || 0),
  });
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: args.usePeriods,
    units: args.units,
    overrides: currentScenarioState.overrides,
  });

  const currentMarketValue = sumCurrentValue(args.properties, scopePropertyId);
  const currentLoanBalance = sumLoanBalance(args.loans, scopePropertyId);
  const currentEquity = currentMarketValue - currentLoanBalance;
  const currentMonthlyRent = scheduledRentForDate({
    date: args.today,
    leases: effective.leases,
    scopePropertyId,
  });
  const trailingMonthlyOpEx = trailingMonthlyOperatingExpenses({
    today: args.today,
    transactions: args.transactions,
    scopePropertyId,
  });
  const operatingExpenseProfile = trailingMonthlyOperatingExpenseProfile({
    today: args.today,
    transactions: args.transactions,
    scopePropertyId,
  });
  const currentUtilitiesIncludedLeaseCount = utilitiesIncludedLeaseCountForDate({
    date: args.today,
    leases: effective.leases,
    scopePropertyId,
  });
  const includedUtilitiesOverride = Math.max(0, Number(args.assumptions.includedUtilitiesMonthly || 0));
  const includedUtilitiesMonthlyEstimate = includedUtilitiesOverride || operatingExpenseProfile.monthlyUtilityEstimate;
  const utilityEstimatePerIncludedLease = includedUtilitiesMonthlyEstimate / Math.max(1, currentUtilitiesIncludedLeaseCount);
  const currentIncludedUtilityBaseline = currentUtilitiesIncludedLeaseCount > 0
    ? operatingExpenseProfile.utilityBaselineMonthly
    : 0;
  const debtServiceSnapshot = currentAdjustedDebtService({
    today: args.today,
    loans: args.loans,
    scopePropertyId,
    usePeriods: effective.usePeriods,
    leases: effective.leases,
    units: effective.units,
  });

  const trackedLoans = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .map((loan) => ({
      loan,
      balance: Number(loan.currentBalance || 0),
    }));
  const forecastRerentAssumptions = buildPlanningForecastRerentAssumptions({
    today: args.today,
    propertyId: scopePropertyId,
    units: args.units,
    leases: args.leases,
    rentStrategies: args.rentStrategies,
    turnoverInputs: args.turnoverInputs,
    forecastOptions: args.forecastOptions,
  });

  const forecastStart = firstDayOfNextMonth(args.today);
  const rows: PlanningProjectionRow[] = [];
  let previousLeaseKeys = new Set(
    effective.leases
      .filter((lease) => matchesPropertyScope(lease.propertyId, scopePropertyId))
      .filter((lease) => leaseIsActiveByDate(lease, args.today))
      .map((lease) => overrideKey(lease.propertyId, String(lease.unit || ""))),
  );
  let previousScheduledRent = currentMonthlyRent;
  let previousCapexReserve = Number(args.assumptions.monthlyCapexReserve || 0);

  for (let index = 0; index < horizonMonths; index += 1) {
    const monthDate = new Date(forecastStart);
    monthDate.setUTCMonth(forecastStart.getUTCMonth() + index);
    const month = monthKey(monthDate);
    const midpoint = monthMidpointIso(monthDate);
    const scenarioState = buildPlanningScenarioStateAtDate({
      today: args.today,
      date: midpoint,
      baseOverrides: args.scenarioOverrides,
      scenarioEvents: args.scenarioEvents,
      baseMonthlyCapexReserve: Number(args.assumptions.monthlyCapexReserve || 0),
    });
    const monthEffective = applyPlanningScenarioOverrides({
      today: args.today,
      leases: args.leases,
      usePeriods: args.usePeriods,
      units: args.units,
      overrides: scenarioState.overrides,
    });
    const expenseGrowthFactor = Math.pow(1 + expenseGrowthPct, index / 12);
    const valueGrowthFactor = Math.pow(1 + valueGrowthPct, (index + 1) / 12);
    const monthLeaseKeys = new Set(
      monthEffective.leases
        .filter((lease) => matchesPropertyScope(lease.propertyId, scopePropertyId))
        .filter((lease) => leaseIsActiveByDate(lease, midpoint))
        .map((lease) => overrideKey(lease.propertyId, String(lease.unit || ""))),
    );
    const activeOverrideKeys = new Set(
      (scenarioState.overrides || [])
        .filter((override) => matchesPropertyScope(override.propertyId, scopePropertyId))
        .map((override) => overrideKey(override.propertyId, override.unit)),
    );
    const activeRerentAssumptions = forecastRerentAssumptions.filter((assumption) => {
      if (assumption.startDate > midpoint || assumption.endDate < midpoint) return false;
      if (monthLeaseKeys.has(overrideKey(assumption.propertyId, assumption.unit))) return false;
      if (activeOverrideKeys.has(overrideKey(assumption.propertyId, assumption.unit))) return false;
      const blockingUsePeriod = monthEffective.usePeriods.some((period) =>
        period.propertyId === assumption.propertyId &&
        String(period.unit || "") === assumption.unit &&
        usePeriodIsActiveByDate(period, midpoint) &&
        period.useType !== "Rental",
      );
      return !blockingUsePeriod;
    });
    const downtimeAssumptions = forecastRerentAssumptions.filter((assumption) => {
      if (assumption.priorLeaseEnd >= midpoint || assumption.startDate <= midpoint) return false;
      if (monthLeaseKeys.has(overrideKey(assumption.propertyId, assumption.unit))) return false;
      if (activeOverrideKeys.has(overrideKey(assumption.propertyId, assumption.unit))) return false;
      const blockingUsePeriod = monthEffective.usePeriods.some((period) =>
        period.propertyId === assumption.propertyId &&
        String(period.unit || "") === assumption.unit &&
        usePeriodIsActiveByDate(period, midpoint) &&
        period.useType !== "Rental",
      );
      return !blockingUsePeriod;
    });
    const leaseScheduledRent = scheduledRentForDate({
      date: midpoint,
      leases: monthEffective.leases,
      scopePropertyId,
    });
    const rerentScheduledRent = activeRerentAssumptions.reduce((sum, assumption) => sum + Number(assumption.monthlyRent || 0), 0);
    const scheduledRent = leaseScheduledRent + rerentScheduledRent;
    const vacancyLoss = scheduledRent * vacancyRatePct;
    const effectiveRent = scheduledRent - vacancyLoss;
    const monthUtilitiesIncludedLeaseCount = utilitiesIncludedLeaseCountForDate({
      date: midpoint,
      leases: monthEffective.leases,
      scopePropertyId,
    });
    const modeledIncludedUtilities = monthUtilitiesIncludedLeaseCount * utilityEstimatePerIncludedLease;
    const utilityIncludedAdjustment = modeledIncludedUtilities - currentIncludedUtilityBaseline;
    const operatingExpenses = Math.max(0, (trailingMonthlyOpEx + utilityIncludedAdjustment) * expenseGrowthFactor);
    const netOperatingIncome = effectiveRent - operatingExpenses;

    let debtService = 0;
    trackedLoans.forEach((entry) => {
      const rentalUsePct = getRentalUsePctForDate({
        propertyId: entry.loan.propertyId,
        unit: "Shared",
        date: midpoint,
        usePeriods: monthEffective.usePeriods,
        leases: monthEffective.leases,
        units: monthEffective.units,
        fallbackOwnerUsePct: 0,
      });
      debtService += loanBreakdown(entry.loan).totalMonthlyPayment * rentalUsePct;
      entry.balance = projectLoanBalance(entry.balance, entry.loan);
    });

    const projectedLoanBalance = trackedLoans.reduce((sum, entry) => sum + entry.balance, 0);
    const projectedValue = currentMarketValue * valueGrowthFactor;
    const projectedEquity = projectedValue - projectedLoanBalance;
    const monthlyCapexReserve = Math.max(0, Number(scenarioState.monthlyCapexReserve || 0));
    const cashFlow = netOperatingIncome - debtService - monthlyCapexReserve;

    const startedLeaseKeys = [...monthLeaseKeys].filter((key) => !previousLeaseKeys.has(key));
    const endedLeaseKeys = [...previousLeaseKeys].filter((key) => !monthLeaseKeys.has(key));
    const startedRerents = activeRerentAssumptions.filter((assumption) => assumption.startDate.slice(0, 7) === month);
    const reserveChanged = Math.abs(monthlyCapexReserve - previousCapexReserve) >= 0.01;
    let driverLabel = "Signed leases + assumptions";
    let driverDetail = "Monthly forecast is following current leases, growth, vacancy, debt, and reserve settings.";

    if (activeRerentAssumptions.length > 0) {
      const first = startedRerents[0] || activeRerentAssumptions[0];
      driverLabel = "Assumed re-rent";
      driverDetail = startedRerents.length > 0
        ? `${formatUnitLabel(first.unit)} resumes at ${Math.round(first.monthlyRent)} / mo after ${first.downtimeDays} downtime days using the ${first.sourceLabel} rent source.`
        : `${formatUnitLabel(first.unit)} is using the planning-only modeled re-rent assumption at ${Math.round(first.monthlyRent)} / mo.`;
    } else if (downtimeAssumptions.length > 0) {
      const first = downtimeAssumptions[0];
      driverLabel = "Turnover downtime";
      driverDetail = `${formatUnitLabel(first.unit)} is in planning-only downtime after the prior lease ended on ${first.priorLeaseEnd}. Assumed re-rent starts ${first.startDate}.`;
    } else if (startedLeaseKeys.length > 0) {
      const first = startedLeaseKeys[0].split("::");
      driverLabel = "Lease start";
      driverDetail = `A signed lease is active for ${formatUnitLabel(first[1])} in this month, which lifts scheduled rent.`;
    } else if (endedLeaseKeys.length > 0 && scheduledRent <= 0) {
      const first = endedLeaseKeys[0].split("::");
      driverLabel = "No future lease";
      driverDetail = `${formatUnitLabel(first[1])} no longer has a signed lease in the forecast, so rent falls dark until a lease, override, or modeled re-rent assumption is added.`;
    } else if (endedLeaseKeys.length > 0 || scheduledRent < previousScheduledRent) {
      const first = endedLeaseKeys[0]?.split("::");
      driverLabel = "Lease mix changed";
      driverDetail = first
        ? `${formatUnitLabel(first[1])} dropped out of the signed-rent mix for this month.`
        : "Scheduled rent changed because the active lease mix changed.";
    } else if (reserveChanged) {
      driverLabel = "Reserve change";
      driverDetail = `CapEx reserve shifts to ${Math.round(monthlyCapexReserve)} / mo based on the current scenario settings.`;
    } else if (Math.abs(utilityIncludedAdjustment) >= 0.01) {
      driverLabel = "Utilities included";
      driverDetail = utilityIncludedAdjustment > 0
        ? `OpEx includes an estimated ${Math.round(modeledIncludedUtilities)} / mo utility burden for active utilities-included leases${includedUtilitiesOverride ? " from the manual planning override" : ""}.`
        : "OpEx removes the recent utilities-included burden after those leases are no longer active.";
    }

    rows.push({
      month,
      scheduledRent: Math.round(scheduledRent * 100) / 100,
      vacancyLoss: Math.round(vacancyLoss * 100) / 100,
      effectiveRent: Math.round(effectiveRent * 100) / 100,
      operatingExpenses: Math.round(operatingExpenses * 100) / 100,
      utilityIncludedAdjustment: Math.round(utilityIncludedAdjustment * 100) / 100,
      netOperatingIncome: Math.round(netOperatingIncome * 100) / 100,
      debtService: Math.round(debtService * 100) / 100,
      capexReserve: Math.round(monthlyCapexReserve * 100) / 100,
      cashFlow: Math.round(cashFlow * 100) / 100,
      projectedValue: Math.round(projectedValue * 100) / 100,
      projectedLoanBalance: Math.round(projectedLoanBalance * 100) / 100,
      projectedEquity: Math.round(projectedEquity * 100) / 100,
      driverLabel,
      driverDetail,
    });

    previousLeaseKeys = monthLeaseKeys;
    previousScheduledRent = scheduledRent;
    previousCapexReserve = monthlyCapexReserve;
  }

  const firstYearRows = rows.slice(0, 12);
  const finalRow = rows[rows.length - 1];

  return {
    rows,
    summary: {
      currentMarketValue: Math.round(currentMarketValue * 100) / 100,
      currentLoanBalance: Math.round(currentLoanBalance * 100) / 100,
      currentEquity: Math.round(currentEquity * 100) / 100,
      currentMonthlyRent: Math.round(currentMonthlyRent * 100) / 100,
      trailingMonthlyOperatingExpenses: Math.round(trailingMonthlyOpEx * 100) / 100,
      fullMonthlyDebtService: Math.round(debtServiceSnapshot.fullDebtService * 100) / 100,
      adjustedMonthlyDebtService: Math.round(debtServiceSnapshot.adjustedDebtService * 100) / 100,
      currentRentalUsePct: clampPct(debtServiceSnapshot.currentRentalUsePct),
      firstYearEffectiveRent: Math.round(firstYearRows.reduce((sum, row) => sum + row.effectiveRent, 0) * 100) / 100,
      firstYearNetOperatingIncome: Math.round(firstYearRows.reduce((sum, row) => sum + row.netOperatingIncome, 0) * 100) / 100,
      firstYearCashFlow: Math.round(firstYearRows.reduce((sum, row) => sum + row.cashFlow, 0) * 100) / 100,
      horizonEndingValue: finalRow?.projectedValue || Math.round(currentMarketValue * 100) / 100,
      horizonEndingLoanBalance: finalRow?.projectedLoanBalance || Math.round(currentLoanBalance * 100) / 100,
      horizonEndingEquity: finalRow?.projectedEquity || Math.round(currentEquity * 100) / 100,
    },
  };
}

export function buildPlanningDecisionComparison(args: {
  today: string;
  propertyId?: string;
  units: Unit[];
  leases: Lease[];
  loans: Loan[];
  usePeriods: UsePeriod[];
  transactions: Transaction[];
  vacancyRatePct: number;
  monthlyCapexReserve: number;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
}): PlanningDecisionComparison {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: args.usePeriods,
    units: args.units,
    overrides: args.scenarioOverrides,
  });
  const realUnits = effective.units.filter((unit) => unit.name !== "Shared" && matchesPropertyScope(unit.propertyId, scopePropertyId));
  const currentMonthlyRent = scheduledRentForDate({
    date: args.today,
    leases: effective.leases,
    scopePropertyId,
  });
  const trailingMonthlyOpEx = trailingMonthlyOperatingExpenses({
    today: args.today,
    transactions: args.transactions,
    scopePropertyId,
  });
  const debtSnapshot = currentAdjustedDebtService({
    today: args.today,
    loans: args.loans,
    scopePropertyId,
    usePeriods: effective.usePeriods,
    leases: effective.leases,
    units: effective.units,
  });

  const upsideUnits = realUnits
    .map((unit) => ({
      propertyId: unit.propertyId,
      unit: unit.name,
      monthlyRent: bestKnownRentForUnit({
        propertyId: unit.propertyId,
        unitName: unit.name,
        leases: effective.leases,
        today: args.today,
      }),
    }))
    .filter((unit) => unit.monthlyRent > 0);

  const fullRentalMonthlyRent = upsideUnits.reduce((sum, unit) => sum + unit.monthlyRent, 0);
  const vacancyFactor = 1 - clampPct(args.vacancyRatePct);
  const reserve = Math.max(0, Number(args.monthlyCapexReserve || 0));
  const currentMonthlyCashFlow =
    (currentMonthlyRent * vacancyFactor) -
    trailingMonthlyOpEx -
    debtSnapshot.adjustedDebtService -
    reserve;
  const fullRentalMonthlyCashFlow =
    (fullRentalMonthlyRent * vacancyFactor) -
    trailingMonthlyOpEx -
    debtSnapshot.fullDebtService -
    reserve;

  return {
    currentMonthlyRent: Math.round(currentMonthlyRent * 100) / 100,
    fullRentalMonthlyRent: Math.round(fullRentalMonthlyRent * 100) / 100,
    monthlyRentUpside: Math.round((fullRentalMonthlyRent - currentMonthlyRent) * 100) / 100,
    currentMonthlyCashFlow: Math.round(currentMonthlyCashFlow * 100) / 100,
    fullRentalMonthlyCashFlow: Math.round(fullRentalMonthlyCashFlow * 100) / 100,
    monthlyCashFlowUpside: Math.round((fullRentalMonthlyCashFlow - currentMonthlyCashFlow) * 100) / 100,
    currentDebtService: Math.round(debtSnapshot.adjustedDebtService * 100) / 100,
    fullDebtService: Math.round(debtSnapshot.fullDebtService * 100) / 100,
    rentableUnitCount: upsideUnits.length,
    upsideUnits,
  };
}

export function buildPlanningReserveSummary(args: {
  summary: PlanningProjectionSummary;
  horizonMonths: number;
  monthlyCapexReserve: number;
}): PlanningReserveSummary {
  const monthlyCarryCost = Math.max(
    0,
    Number(args.summary.trailingMonthlyOperatingExpenses || 0) + Number(args.summary.adjustedMonthlyDebtService || 0),
  );
  const annualReserveContribution = Math.max(0, Number(args.monthlyCapexReserve || 0)) * 12;
  const firstYearReserveContribution = Math.max(
    0,
    Math.min(12, Math.max(1, Math.round(Number(args.horizonMonths || 12)))) * Number(args.monthlyCapexReserve || 0),
  );
  const horizonReserveContribution = Math.max(0, Math.max(1, Math.round(Number(args.horizonMonths || 12))) * Number(args.monthlyCapexReserve || 0));
  const sixMonthCushionTarget = monthlyCarryCost * 6;
  const firstYearCoverageMonths = monthlyCarryCost > 0 ? firstYearReserveContribution / monthlyCarryCost : 0;

  return {
    monthlyCarryCost: Math.round(monthlyCarryCost * 100) / 100,
    annualReserveContribution: Math.round(annualReserveContribution * 100) / 100,
    firstYearReserveContribution: Math.round(firstYearReserveContribution * 100) / 100,
    horizonReserveContribution: Math.round(horizonReserveContribution * 100) / 100,
    sixMonthCushionTarget: Math.round(sixMonthCushionTarget * 100) / 100,
    firstYearCoverageMonths: Math.round(firstYearCoverageMonths * 10) / 10,
  };
}

export function buildPlanningCapitalTargets(args: {
  today: string;
  properties: Property[];
  assets: Asset[];
  propertyId?: string;
  annualExpenseGrowthPct?: number;
}): PlanningCapitalTarget[] {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const annualExpenseGrowthPct = clampPct(Number(args.annualExpenseGrowthPct || 0));
  const propertyNameById = Object.fromEntries(args.properties.map((property) => [property.id, property.name]));

  return args.assets
    .filter((asset) =>
      matchesPropertyScope(asset.propertyId, scopePropertyId)
      && String(asset.type || "") !== "Residential Building",
    )
    .flatMap((asset) => {
      const life = Math.max(0, Number(asset.life || 0));
      const basis = Math.max(0, Number(asset.cost || asset.basis || 0));
      if (!asset.placedInService || !life || !basis) return [];

      const wholeLifeYears = Math.max(1, Math.round(life));
      const targetDate = addYears(asset.placedInService, wholeLifeYears);
      if (!targetDate) return [];

      const monthsRemaining = Math.max(1, monthDifference(args.today, targetDate));
      const yearsRemaining = monthsRemaining / 12;
      const estimatedReplacementCost = basis * Math.pow(1 + annualExpenseGrowthPct, yearsRemaining);
      const monthlyReserveTarget = estimatedReplacementCost / monthsRemaining;
      const urgency =
        monthsRemaining <= 12
          ? "near_term"
          : monthsRemaining <= 36
            ? "watchlist"
            : "long_range";

      return [{
        source: "asset",
        assetId: asset.id,
        propertyId: asset.propertyId,
        propertyName: propertyNameById[asset.propertyId] || asset.propertyId,
        unit: String(asset.unit || "Shared"),
        description: asset.description,
        assetType: asset.type,
        placedInService: asset.placedInService,
        targetDate,
        monthsRemaining,
        yearsRemaining: Math.round(yearsRemaining * 10) / 10,
        estimatedReplacementCost: Math.round(estimatedReplacementCost * 100) / 100,
        monthlyReserveTarget: Math.round(monthlyReserveTarget * 100) / 100,
        urgency,
        notes: "",
      }];
    })
    .sort((left, right) => {
      if (left.monthsRemaining !== right.monthsRemaining) return left.monthsRemaining - right.monthsRemaining;
      return right.monthlyReserveTarget - left.monthlyReserveTarget;
    });
}

export function buildPlanningManualCapitalTargets(args: {
  today: string;
  properties: Property[];
  projects: PlanningManualCapitalProject[];
  propertyId?: string;
}): PlanningCapitalTarget[] {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const propertyNameById = Object.fromEntries(args.properties.map((property) => [property.id, property.name]));

  return args.projects
    .filter((project) => matchesPropertyScope(project.propertyId, scopePropertyId))
    .map((project) => {
      const monthsRemaining = Math.max(1, monthDifference(args.today, project.targetDate));
      const yearsRemaining = monthsRemaining / 12;
      const estimatedReplacementCost = Math.max(0, Number(project.estimatedCost || 0));
      const monthlyReserveTarget = estimatedReplacementCost / monthsRemaining;
      const urgency =
        monthsRemaining <= 12
          ? "near_term"
          : monthsRemaining <= 36
            ? "watchlist"
            : "long_range";

      return {
        source: "manual" as const,
        assetId: project.linkedAssetId || project.id,
        propertyId: project.propertyId,
        propertyName: propertyNameById[project.propertyId] || project.propertyId,
        unit: String(project.unit || "Shared"),
        description: project.title,
        assetType: "Manual plan",
        placedInService: "",
        targetDate: project.targetDate,
        monthsRemaining,
        yearsRemaining: Math.round(yearsRemaining * 10) / 10,
        estimatedReplacementCost: Math.round(estimatedReplacementCost * 100) / 100,
        monthlyReserveTarget: Math.round(monthlyReserveTarget * 100) / 100,
        urgency,
        notes: project.notes || "",
        linkedAssetId: project.linkedAssetId || "",
        priority: project.priority || "medium",
        fundingSource: project.fundingSource || "tbd",
        scheduleType: project.scheduleType || "one_time",
        mustFundBy: project.mustFundBy || "",
      };
    })
    .sort((left, right) => {
      if (left.monthsRemaining !== right.monthsRemaining) return left.monthsRemaining - right.monthsRemaining;
      return right.monthlyReserveTarget - left.monthlyReserveTarget;
    });
}

export function buildPlanningRentStrategy(args: {
  today: string;
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  propertyId?: string;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
  strategies?: PlanningRentStrategyInput[];
}): { rows: PlanningRentStrategyRow[]; summary: PlanningRentStrategySummary } {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const propertyNameById = Object.fromEntries(args.properties.map((property) => [property.id, property.name]));
  const strategyByKey = Object.fromEntries(
    (args.strategies || [])
      .filter((item) => item?.propertyId && item?.unit)
      .map((item) => [overrideKey(item.propertyId, item.unit), item]),
  );
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: [],
    units: args.units,
    overrides: args.scenarioOverrides,
  });

  const rows = effective.units
    .filter((unit) => unit.name !== "Shared" && matchesPropertyScope(unit.propertyId, scopePropertyId))
    .map((unit) => {
      const activeLease = effective.leases.find((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseIsActiveByDate(lease, args.today));
      const liveRent = Number(activeLease?.monthlyRent || 0);
      const strategy = strategyByKey[overrideKey(unit.propertyId, unit.name)] || {};
      const inferredMarketRent = bestKnownRentForUnit({
        propertyId: unit.propertyId,
        unitName: unit.name,
        leases: effective.leases,
        today: args.today,
      });
      const marketRent = Number(strategy.marketRent || inferredMarketRent || 0);
      const targetRent = Number(strategy.targetRent || marketRent || 0);
      const suggestedIncrease = targetRent - liveRent;
      const suggestedIncreasePct = liveRent > 0 ? suggestedIncrease / liveRent : targetRent > 0 ? 1 : 0;
      return {
        propertyId: unit.propertyId,
        propertyName: propertyNameById[unit.propertyId] || unit.propertyId,
        unit: unit.name,
        currentStatus: unit.status,
        currentRent: Math.round(liveRent * 100) / 100,
        marketRent: Math.round(marketRent * 100) / 100,
        targetRent: Math.round(targetRent * 100) / 100,
        suggestedIncrease: Math.round(suggestedIncrease * 100) / 100,
        suggestedIncreasePct: Math.round(suggestedIncreasePct * 1000) / 1000,
        annualizedUpside: Math.round((suggestedIncrease * 12) * 100) / 100,
        renewalStart: String(strategy.renewalStart || activeLease?.endDate || ""),
        renewalTermMonths: Math.max(0, Number(strategy.renewalTermMonths || 12)),
        notes: String(strategy.notes || ""),
      };
    })
    .sort((left, right) => right.annualizedUpside - left.annualizedUpside);

  const pricedRows = rows.filter((row) => row.targetRent > 0);
  const comparableRows = pricedRows.filter((row) => row.currentRent > 0);
  const totalAnnualUpside = pricedRows.reduce((sum, row) => sum + row.annualizedUpside, 0);
  const averageIncreasePct = comparableRows.length
    ? comparableRows.reduce((sum, row) => sum + row.suggestedIncreasePct, 0) / comparableRows.length
    : 0;

  return {
    rows,
    summary: {
      pricedUnitCount: pricedRows.length,
      totalAnnualUpside: Math.round(totalAnnualUpside * 100) / 100,
      averageIncreasePct: Math.round(averageIncreasePct * 1000) / 1000,
    },
  };
}

export function buildPlanningExitAnalysis(args: {
  today: string;
  summary: PlanningProjectionSummary;
  plan: PlanningExitPlan;
  loans?: Loan[];
  propertyId?: string;
  properties?: Property[];
  assets?: Asset[];
  usePeriods?: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
  annualValueGrowthPct?: number;
}): PlanningExitAnalysis {
  const mode = args.plan.mode || "hold";
  const taxTreatment = args.plan.taxTreatment === "exchange_1031" ? "exchange_1031" : "taxable_sale";
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const scopedProperties = (args.properties || []).filter((property) => matchesPropertyScope(property.id, scopePropertyId));
  const scopedAssets = (args.assets || []).filter((asset) => matchesPropertyScope(asset.propertyId, scopePropertyId));
  const currentCarryCostsMonthly = (args.loans || [])
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => sum + Number(loan.scheduledEscrow || 0) + Number(loan.scheduledMortgageInsurance || 0), 0);
  if (mode === "refi") {
    const newBalance = Math.max(0, Number(args.summary.currentLoanBalance || 0) + Number(args.plan.cashOutAmount || 0));
    const projectedFullMonthlyDebtService = amortizedPayment(newBalance, Number(args.plan.targetRatePct || 0), Number(args.plan.termYears || 30))
      + currentCarryCostsMonthly;
    const projectedMonthlyDebtService = projectedFullMonthlyDebtService * clampPct(Number(args.summary.currentRentalUsePct || 1));
    const monthlyCashFlowChange = Number(args.summary.adjustedMonthlyDebtService || 0) - projectedMonthlyDebtService;
    return {
      mode,
      taxTreatment,
      currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
      currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedMonthlyDebtService: Math.round(projectedMonthlyDebtService * 100) / 100,
      monthlyCashFlowChange: Math.round(monthlyCashFlowChange * 100) / 100,
      projectedSaleValue: Math.round(Number(args.summary.currentMarketValue || 0) * 100) / 100,
      projectedLoanPayoff: Math.round(Number(args.summary.currentLoanBalance || 0) * 100) / 100,
      projectedNetProceeds: Math.round(Math.max(0, Number(args.plan.cashOutAmount || 0)) * 100) / 100,
      projectedSaleCosts: 0,
      roughTaxBasis: 0,
      roughAccumulatedDepreciation: 0,
      roughTaxableGain: 0,
      roughDepreciationRecapture: 0,
      roughCapitalGain: 0,
      roughTaxEstimate: 0,
      roughAfterTaxProceeds: Math.round(Math.max(0, Number(args.plan.cashOutAmount || 0)) * 100) / 100,
      monthsToExit: 0,
      headline: `Refi could shift rental-share debt service to about $${Math.round(projectedMonthlyDebtService)} per month.`,
    };
  }

  if (mode === "sell") {
    const saleDate = args.plan.saleDate || args.today;
    const monthsToExit = Math.max(0, monthDifference(args.today, saleDate));
    const annualValueGrowthPct = clampPct(Number(args.annualValueGrowthPct || 0));
    const projectedSaleValue = Math.max(
      0,
      Number(args.summary.currentMarketValue || 0) * Math.pow(1 + annualValueGrowthPct, monthsToExit / 12),
    );
    const projectedLoanPayoff = Math.max(0, projectLoanBalancesToDate({
      today: args.today,
      targetDate: saleDate,
      loans: args.loans || [],
      propertyId: scopePropertyId,
    }));
    const saleCosts = Math.max(0, projectedSaleValue * clampPct(Number(args.plan.sellingCostsPct || 0)));
    const netProceeds = Math.max(0, projectedSaleValue - saleCosts - projectedLoanPayoff);
    const landBasis = scopedProperties.reduce((sum, property) => {
      const costBasis = getPropertyCostBasis(property);
      return costBasis.ok ? sum + costBasis.landValue : sum;
    }, 0);
    const depreciableBasis = scopedAssets.reduce((sum, asset) => sum + Math.max(0, Number(asset.basis || asset.cost || 0)), 0);
    const accumulatedDepreciation = scopedAssets.reduce((sum, asset) => sum + adjustedAssetDepreciationThroughDate({
      asset,
      date: saleDate,
      usePeriods: args.usePeriods || [],
      leases: args.leases || [],
      units: args.units || [],
    }), 0);
    const roughTaxBasis = Math.max(0, landBasis + depreciableBasis - accumulatedDepreciation);
    const amountRealized = Math.max(0, projectedSaleValue - saleCosts);
    const roughTaxableGain = Math.max(0, amountRealized - roughTaxBasis);
    const roughDepreciationRecapture = Math.max(0, Math.min(accumulatedDepreciation, roughTaxableGain));
    const roughCapitalGain = Math.max(0, roughTaxableGain - roughDepreciationRecapture);
    const roughTaxEstimate = Math.max(0, (roughDepreciationRecapture * 0.25) + (roughCapitalGain * 0.15));
    const roughAfterTaxProceeds = taxTreatment === "exchange_1031"
      ? Math.max(0, netProceeds)
      : Math.max(0, netProceeds - roughTaxEstimate);
    return {
      mode,
      taxTreatment,
      currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
      currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedMonthlyDebtService: 0,
      monthlyCashFlowChange: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedSaleValue: Math.round(projectedSaleValue * 100) / 100,
      projectedLoanPayoff: Math.round(projectedLoanPayoff * 100) / 100,
      projectedNetProceeds: Math.round(netProceeds * 100) / 100,
      projectedSaleCosts: Math.round(saleCosts * 100) / 100,
      roughTaxBasis: Math.round(roughTaxBasis * 100) / 100,
      roughAccumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      roughTaxableGain: Math.round(roughTaxableGain * 100) / 100,
      roughDepreciationRecapture: Math.round(roughDepreciationRecapture * 100) / 100,
      roughCapitalGain: Math.round(roughCapitalGain * 100) / 100,
      roughTaxEstimate: Math.round(roughTaxEstimate * 100) / 100,
      roughAfterTaxProceeds: Math.round(roughAfterTaxProceeds * 100) / 100,
      monthsToExit,
      headline: taxTreatment === "exchange_1031"
        ? `Estimated exchange equity after debt and selling costs is about $${Math.round(netProceeds)}, with roughly $${Math.round(roughTaxEstimate)} of tax potentially deferred in a 1031 path.`
        : `Estimated net proceeds after debt and selling costs are about $${Math.round(netProceeds)}, or roughly $${Math.round(roughAfterTaxProceeds)} after a conservative tax haircut.`,
    };
  }

  return {
    mode: "hold",
    taxTreatment,
    currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
    currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
    projectedMonthlyDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
    monthlyCashFlowChange: 0,
    projectedSaleValue: Math.round(Number(args.summary.currentMarketValue || 0) * 100) / 100,
    projectedLoanPayoff: Math.round(Number(args.summary.currentLoanBalance || 0) * 100) / 100,
    projectedNetProceeds: Math.round(Number(args.summary.horizonEndingEquity || args.summary.currentEquity || 0) * 100) / 100,
    projectedSaleCosts: 0,
    roughTaxBasis: 0,
    roughAccumulatedDepreciation: 0,
    roughTaxableGain: 0,
    roughDepreciationRecapture: 0,
    roughCapitalGain: 0,
    roughTaxEstimate: 0,
    roughAfterTaxProceeds: Math.round(Number(args.summary.horizonEndingEquity || args.summary.currentEquity || 0) * 100) / 100,
    monthsToExit: 0,
    headline: `Hold mode keeps the focus on cash flow and growing equity to about $${Math.round(Number(args.summary.horizonEndingEquity || 0))}.`,
  };
}

export function buildPlanningRecommendations(args: {
  summary: PlanningProjectionSummary;
  reserveGap: number;
  capitalTargets: PlanningCapitalTarget[];
  milestones: PlanningMilestone[];
  decisionComparison: PlanningDecisionComparison;
  horizonMonths?: number;
  projectedCashFlow?: number;
}): PlanningRecommendation[] {
  const recommendations: PlanningRecommendation[] = [];
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);

  if (projectedCashFlow < 0) {
    recommendations.push({
      priority: "high",
      title: "Close the projected cash-flow gap",
      detail: `The current scenario is projecting ${Math.abs(projectedCashFlow).toFixed(0)} of negative cash flow over the next ${horizonMonths} months. Revisit rent, debt load, vacancy, or reserve timing before treating this plan as sustainable.`,
    });
  }

  if (Number(args.reserveGap || 0) > 0) {
    recommendations.push({
      priority: "medium",
      title: "Increase monthly reserve funding",
      detail: `Tracked capital targets suggest about ${Number(args.reserveGap || 0).toFixed(0)} more per month than the current reserve setting. Raising the reserve closes the gap before larger projects arrive.`,
    });
  }

  const nearTermProject = args.capitalTargets.find((target) => target.urgency === "near_term");
  if (nearTermProject) {
    recommendations.push({
      priority: "medium",
      title: `Prepare for ${nearTermProject.description.toLowerCase()}`,
      detail: `${nearTermProject.propertyName} ${formatUnitLabel(nearTermProject.unit)} has a near-term target around ${nearTermProject.targetDate}. The current reserve target for that item is about ${nearTermProject.monthlyReserveTarget.toFixed(0)} per month.`,
    });
  }

  const nextMilestone = args.milestones[0];
  if (nextMilestone) {
    recommendations.push({
      priority: "low",
      title: "Review the next lease or occupancy milestone",
      detail: `${nextMilestone.title} on ${nextMilestone.date}. ${nextMilestone.detail}. Make sure the plan still reflects what you expect to happen on that date.`,
    });
  }

  if (Number(args.decisionComparison.monthlyCashFlowUpside || 0) > 0) {
    recommendations.push({
      priority: "low",
      title: "Compare this plan against a fuller rent roll",
      detail: `A fully rented version of the current scope improves monthly cash flow by about ${Number(args.decisionComparison.monthlyCashFlowUpside || 0).toFixed(0)}. That makes the rent and occupancy assumptions worth pressure-testing.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      title: "Keep monitoring the current plan",
      detail: "The current planning inputs do not surface an obvious stress point right now. Keep the scenario updated as leases, debt, and capital timing change.",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return recommendations
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 5);
}

export function buildPlanningHealthSummary(args: {
  today?: string;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  reserveGap: number;
  milestones?: PlanningMilestone[];
  capitalTargets?: PlanningCapitalTarget[];
  goalStatus?: PlanningGoalStatus[];
  projectedCashFlow?: number;
}): PlanningHealthSummary {
  const factors: PlanningHealthFactor[] = [];
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);
  const avgMonthlyCashFlow = projectedCashFlow / 12;
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);
  const dscr = Number(args.summary.adjustedMonthlyDebtService || 0) > 0
    ? Number(args.summary.firstYearNetOperatingIncome || 0) / (Number(args.summary.adjustedMonthlyDebtService || 0) * 12)
    : 0;
  const nextMilestone = (args.milestones || [])[0] || null;
  const nearTermCapital = (args.capitalTargets || []).find((target) => target.urgency === "near_term") || null;
  const offTrackGoalCount = (args.goalStatus || []).filter((row) => row.status === "off_track").length;
  const watchGoalCount = (args.goalStatus || []).filter((row) => row.status === "watch").length;

  if (projectedCashFlow >= 0) {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "strong",
      detail: `Projected cash flow is positive over the working horizon, averaging about ${Math.round(avgMonthlyCashFlow)} per month.`,
    });
  } else if (avgMonthlyCashFlow >= -250) {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "watch",
      detail: `Projected cash flow is slightly negative at about ${Math.round(avgMonthlyCashFlow)} per month, so vacancy, reserve timing, or rent needs a closer look.`,
    });
  } else {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "weak",
      detail: `Projected cash flow is materially negative at about ${Math.round(avgMonthlyCashFlow)} per month.`,
    });
  }

  if (reserveMonths >= 6 && Number(args.reserveGap || 0) <= 0) {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "strong",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months and current funding pace is keeping up with tracked capital targets.`,
    });
  } else if (reserveMonths >= 3 || Number(args.reserveGap || 0) <= 0) {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "watch",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months, with a monthly reserve gap of ${Math.round(Math.max(0, Number(args.reserveGap || 0)))} if tracked targets stay in place.`,
    });
  } else {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "weak",
      detail: `Reserve coverage is only about ${reserveMonths.toFixed(1)} months, and tracked projects are running ahead of current reserve funding.`,
    });
  }

  if (dscr >= 1.2) {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "strong",
      detail: `The current plan covers debt service at about ${dscr.toFixed(2)}x.`,
    });
  } else if (dscr >= 1) {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "watch",
      detail: `Debt coverage is close at about ${dscr.toFixed(2)}x, so small misses in rent or OpEx would matter.`,
    });
  } else {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "weak",
      detail: `Debt coverage is under 1.0x at about ${dscr.toFixed(2)}x.`,
    });
  }

  if (nearTermCapital) {
    factors.push({
      id: "capital",
      label: "Capital pressure",
      status: nearTermCapital.monthsRemaining <= 6 ? "weak" : "watch",
      detail: `${nearTermCapital.description} is the next tracked project, due around ${nearTermCapital.targetDate}.`,
    });
  } else {
    factors.push({
      id: "capital",
      label: "Capital pressure",
      status: "strong",
      detail: "No near-term tracked capital project is currently inside the planning horizon.",
    });
  }

  if (nextMilestone) {
    const milestoneDays = args.today ? Math.max(0, dayDifference(args.today, nextMilestone.date)) : 999;
    factors.push({
      id: "lease_cycle",
      label: "Lease cycle",
      status: milestoneDays <= 60 ? "watch" : "strong",
      detail: `${nextMilestone.title} is the next tracked milestone on ${nextMilestone.date}.`,
    });
  } else {
    factors.push({
      id: "lease_cycle",
      label: "Lease cycle",
      status: "strong",
      detail: "No lease or occupancy milestone is currently sitting near the front of the planning horizon.",
    });
  }

  if (offTrackGoalCount > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "weak",
      detail: `${offTrackGoalCount} planning goal${offTrackGoalCount === 1 ? " is" : "s are"} currently off track.`,
    });
  } else if (watchGoalCount > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "watch",
      detail: `${watchGoalCount} planning goal${watchGoalCount === 1 ? " is" : "s are"} in watch status.`,
    });
  } else if ((args.goalStatus || []).length > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "strong",
      detail: "All tracked planning goals are on track.",
    });
  }

  const weakCount = factors.filter((factor) => factor.status === "weak").length;
  const watchCount = factors.filter((factor) => factor.status === "watch").length;
  let score = 100 - (weakCount * 25) - (watchCount * 10);
  if (!Number.isFinite(score)) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = weakCount > 0 ? "fragile" : watchCount > 1 ? "watch" : "stable";
  const label = status === "fragile" ? "Fragile plan" : status === "watch" ? "Watch list" : "Stable plan";
  const primaryConcern = (factors.find((factor) => factor.status === "weak") || factors.find((factor) => factor.status === "watch") || factors[0])?.detail || "No major stress point surfaced.";

  return {
    score,
    status,
    label,
    primaryConcern,
    factors,
  };
}

export function buildPlanningAssumptionAudit(args: {
  scopeLabel: string;
  scenarioLabel: string;
  baselineLabel?: string;
  assumptions: PlanningAssumptions;
  overrides?: PlanningScenarioUnitOverride[];
  events?: PlanningScenarioEvent[];
  forecastOptions?: PlanningForecastOptions;
  exitPlan?: PlanningExitPlan;
  goals?: PlanningGoalSet;
  triggers?: PlanningTriggerSet;
  manualProjects?: PlanningManualCapitalProject[];
  capitalTargets?: PlanningCapitalTarget[];
  rentStrategyRows?: PlanningRentStrategyRow[];
  turnoverRows?: PlanningTurnoverRow[];
}): PlanningAssumptionAuditRow[] {
  const goals = args.goals || {};
  const triggers = args.triggers || {};
  const forecastOptions = args.forecastOptions || {};
  const exitPlan = args.exitPlan || { mode: "hold" };
  const goalCount = Object.values(goals).filter((value) => Number(value || 0) > 0).length;
  const triggerCount = Object.values(triggers).filter((value) => Number(value || 0) > 0).length;
  const overrides = args.overrides || [];
  const events = args.events || [];
  const manualProjects = args.manualProjects || [];
  const capitalTargets = args.capitalTargets || [];
  const pricedUnits = (args.rentStrategyRows || []).filter((row) => Number(row.targetRent || row.marketRent || 0) > 0).length;
  const turnoverPlans = (args.turnoverRows || []).filter((row) =>
    Number(row.makeReadyCost || 0) > 0
    || Number(row.downtimeDays || 0) > 0
    || Number(row.leasingFeePct || 0) > 0
    || Number(row.concessionWeeks || 0) > 0,
  ).length;

  const rows: PlanningAssumptionAuditRow[] = [
    { category: "Context", label: "Scope", value: args.scopeLabel },
    { category: "Context", label: "Scenario", value: args.scenarioLabel, note: args.baselineLabel ? `Baseline ${args.baselineLabel}` : "" },
    { category: "Model", label: "Forecast horizon", value: `${args.assumptions.horizonMonths} months` },
    { category: "Model", label: "Rent growth", value: `${args.assumptions.annualRentGrowthPct}% / yr` },
    { category: "Model", label: "OpEx growth", value: `${args.assumptions.annualExpenseGrowthPct}% / yr` },
    { category: "Model", label: "Value growth", value: `${args.assumptions.annualValueGrowthPct}% / yr` },
    { category: "Model", label: "Vacancy / credit loss", value: `${args.assumptions.vacancyRatePct}%` },
    { category: "Model", label: "Monthly CapEx reserve", value: `${Math.round(Number(args.assumptions.monthlyCapexReserve || 0))}` },
    { category: "Model", label: "Included utilities / mo", value: Number(args.assumptions.includedUtilitiesMonthly || 0) > 0 ? `${Math.round(Number(args.assumptions.includedUtilitiesMonthly || 0))}` : "Auto" },
    {
      category: "Forecast",
      label: "Rent forecast mode",
      value: forecastOptions.assumeRerentAfterTurnover ? "Assume re-rent after turnover" : "Only signed leases",
      note: forecastOptions.assumeRerentAfterTurnover ? `Rent source ${forecastOptions.rerentRentSource || "target"} | term ${Number(forecastOptions.rerentTermMonths || 12)} mo` : "",
    },
    { category: "Scenario", label: "Unit overrides", value: `${overrides.length}`, note: overrides.length ? `${overrides.filter((row) => row.mode !== "auto").length} active override${overrides.filter((row) => row.mode !== "auto").length === 1 ? "" : "s"}` : "No planning-only overrides" },
    { category: "Scenario", label: "Timeline events", value: `${events.length}`, note: events.length ? `${events.filter((event) => event.eventType === "unit_override").length} occupancy/rent event${events.filter((event) => event.eventType === "unit_override").length === 1 ? "" : "s"}` : "No dated scenario events" },
    { category: "Scenario", label: "Rent strategies", value: `${pricedUnits} priced unit${pricedUnits === 1 ? "" : "s"}` },
    { category: "Scenario", label: "Turnover assumptions", value: `${turnoverPlans} unit${turnoverPlans === 1 ? "" : "s"}`, note: turnoverPlans ? "Make-ready / downtime / concessions are feeding forecast assumptions." : "No explicit turnover costs yet" },
    { category: "Guardrails", label: "Goals tracked", value: `${goalCount}` },
    { category: "Guardrails", label: "Triggers enabled", value: `${triggerCount}` },
    {
      category: "Exit",
      label: "Exit mode",
      value: exitPlan.mode === "sell" ? "Sell" : exitPlan.mode === "refi" ? "Refi" : "Hold",
      note: exitPlan.mode === "sell"
        ? `${exitPlan.taxTreatment === "exchange_1031" ? "1031 exchange" : "Taxable sale"}`
        : exitPlan.mode === "refi"
          ? `${Number(exitPlan.targetRatePct || 0).toFixed(2)}% | ${Math.max(1, Number(exitPlan.termYears || 30))} years`
          : "No structural exit overlay",
    },
    { category: "Capital", label: "Manual projects", value: `${manualProjects.length}` },
    { category: "Capital", label: "Tracked capital targets", value: `${capitalTargets.length}` },
  ];

  return rows;
}

export function buildPlanningRecommendedMoves(args: {
  summary: PlanningProjectionSummary;
  reserveGap: number;
  milestones?: PlanningMilestone[];
  triggerAlerts?: PlanningTriggerAlert[];
  turnoverRows?: PlanningTurnoverRow[];
  decisionComparison: PlanningDecisionComparison;
  horizonMonths?: number;
  projectedCashFlow?: number;
}): PlanningRecommendedMove[] {
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);
  const moves: PlanningRecommendedMove[] = [];
  const nextMilestone = (args.milestones || [])[0] || null;
  const turnoverCandidate = (args.turnoverRows || []).find((row) => row.nextTurnoverDate);

  if (projectedCashFlow < 0) {
    moves.push({
      id: "cash-flow-gap",
      priority: "high",
      title: "Raise cash flow before treating this as the working plan",
      detail: `Projected cash flow is negative over the next ${horizonMonths} months. Pressure-test rent timing, vacancy, debt load, or reserve pacing before locking this in.`,
      actionLabel: "Test a stronger cash-flow scenario",
    });
  }

  if (Number(args.reserveGap || 0) > 0) {
    moves.push({
      id: "reserve-gap",
      priority: "medium",
      title: "Increase reserve funding to match tracked capital pressure",
      detail: `Tracked capital targets are asking for about ${Math.round(Number(args.reserveGap || 0))} more per month than the current reserve setting.`,
      actionLabel: "Raise monthly reserve target",
    });
  }

  if (Number(args.decisionComparison.monthlyCashFlowUpside || 0) > 0) {
    moves.push({
      id: "rent-roll-upside",
      priority: "medium",
      title: "Model the fuller rent roll explicitly",
      detail: `A fuller rent roll improves monthly cash flow by about ${Math.round(Number(args.decisionComparison.monthlyCashFlowUpside || 0))}. Turn that upside into a dated scenario instead of leaving it as a thought experiment.`,
      actionLabel: "Add a re-rent or occupancy event",
    });
  }

  if (turnoverCandidate && turnoverCandidate.nextTurnoverDate) {
    moves.push({
      id: "turnover-plan",
      priority: "medium",
      title: `Prepare for ${formatUnitLabel(turnoverCandidate.unit)} turnover`,
      detail: `${turnoverCandidate.propertyName} ${formatUnitLabel(turnoverCandidate.unit)} turns over on ${turnoverCandidate.nextTurnoverDate}. Capturing downtime, concessions, and target rent will make the forecast more trustworthy.`,
      actionLabel: "Set turnover assumptions",
    });
  }

  if (nextMilestone) {
    moves.push({
      id: "next-milestone",
      priority: "low",
      title: "Convert the next milestone into a dated scenario event",
      detail: `${nextMilestone.title} is coming on ${nextMilestone.date}. Dated scenario events make the forecast read more like a real operating plan.`,
      actionLabel: "Add a timeline event",
    });
  }

  const triggerAlert = (args.triggerAlerts || [])[0];
  if (triggerAlert) {
    moves.push({
      id: `trigger-${triggerAlert.id}`,
      priority: triggerAlert.priority,
      title: `Resolve the trigger: ${triggerAlert.title}`,
      detail: triggerAlert.detail,
      actionLabel: "Tune the trigger or the plan",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return moves
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 6);
}

export function buildPlanningTriggerAlerts(args: {
  today: string;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  milestones: PlanningMilestone[];
  capitalTargets: PlanningCapitalTarget[];
  triggers?: PlanningTriggerSet;
}): PlanningTriggerAlert[] {
  const triggers = args.triggers || {};
  const alerts: PlanningTriggerAlert[] = [];
  const avgMonthlyCashFlow = Number(args.summary.firstYearCashFlow || 0) / 12;
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);

  if (Number.isFinite(Number(triggers.minMonthlyCashFlow)) && Number(triggers.minMonthlyCashFlow) > 0 && avgMonthlyCashFlow < Number(triggers.minMonthlyCashFlow)) {
    alerts.push({
      id: "minMonthlyCashFlow",
      priority: avgMonthlyCashFlow < 0 ? "high" : "medium",
      title: "Cash-flow trigger fired",
      detail: `Average monthly cash flow is running about ${Math.round(avgMonthlyCashFlow)} against a trigger floor of ${Math.round(Number(triggers.minMonthlyCashFlow || 0))}.`,
    });
  }

  if (Number.isFinite(Number(triggers.minReserveMonths)) && Number(triggers.minReserveMonths) > 0 && reserveMonths < Number(triggers.minReserveMonths)) {
    alerts.push({
      id: "minReserveMonths",
      priority: reserveMonths < Number(triggers.minReserveMonths || 0) * 0.75 ? "high" : "medium",
      title: "Reserve coverage trigger fired",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months versus a target floor of ${Number(triggers.minReserveMonths || 0).toFixed(1)} months.`,
    });
  }

  if (Number.isFinite(Number(triggers.leaseRolloverDays)) && Number(triggers.leaseRolloverDays) > 0) {
    const leaseMilestone = args.milestones.find((milestone) => milestone.title.includes("Lease ends") && dayDifference(args.today, milestone.date) >= 0 && dayDifference(args.today, milestone.date) <= Number(triggers.leaseRolloverDays || 0));
    if (leaseMilestone) {
      alerts.push({
        id: "leaseRolloverDays",
        priority: "medium",
        title: "Lease rollover trigger fired",
        detail: `${leaseMilestone.title} is within ${Math.max(0, dayDifference(args.today, leaseMilestone.date))} days. ${leaseMilestone.detail}.`,
      });
    }
  }

  if (Number.isFinite(Number(triggers.capexWarningMonths)) && Number(triggers.capexWarningMonths) > 0) {
    const capitalTarget = args.capitalTargets.find((target) => Number(target.monthsRemaining || 999) <= Number(triggers.capexWarningMonths || 0));
    if (capitalTarget) {
      alerts.push({
        id: "capexWarningMonths",
        priority: capitalTarget.urgency === "near_term" ? "high" : "medium",
        title: "Capital timing trigger fired",
        detail: `${capitalTarget.description} for ${capitalTarget.propertyName} ${formatUnitLabel(capitalTarget.unit)} is due in about ${capitalTarget.monthsRemaining} months, with roughly ${Math.round(capitalTarget.monthlyReserveTarget)} per month needed.`,
      });
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);
}

export function buildPlanningReviewInbox(args: {
  today: string;
  horizonMonths?: number;
  activeScenario?: { name?: string; updatedAt?: string } | null;
  scenarioIsDirty?: boolean;
  forecastOptions?: PlanningForecastOptions;
  milestones?: PlanningMilestone[];
  capitalTargets?: PlanningCapitalTarget[];
  triggerAlerts?: PlanningTriggerAlert[];
  recommendedMoves?: PlanningRecommendedMove[];
  actionItems?: Array<{
    id: string;
    title: string;
    notes?: string;
    status?: string;
    priority?: "high" | "medium" | "low";
    dueDate?: string;
  }>;
  confidence?: { label?: string; detail?: string } | null;
  goalCount?: number;
  triggerCount?: number;
}): PlanningReviewInboxItem[] {
  const today = String(args.today || "").slice(0, 10);
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const milestones = args.milestones || [];
  const capitalTargets = args.capitalTargets || [];
  const triggerAlerts = args.triggerAlerts || [];
  const recommendedMoves = args.recommendedMoves || [];
  const actionItems = args.actionItems || [];
  const items: PlanningReviewInboxItem[] = [];
  const addItem = (item?: PlanningReviewInboxItem | null) => {
    if (!item) return;
    if (items.some((existing) => existing.title === item.title && existing.dueDate === item.dueDate)) return;
    items.push(item);
  };

  const openActionItems = actionItems.filter((item) => item.status !== "done");
  const overdueAction = openActionItems.find((item) => item.dueDate && item.dueDate < today);
  const dueSoonAction = openActionItems.find((item) => item.dueDate && item.dueDate >= today && item.dueDate <= addDays(today, 21));
  if (overdueAction) {
    addItem({
      id: `action-overdue-${overdueAction.id}`,
      category: "action",
      priority: overdueAction.priority || "high",
      title: `Action overdue: ${overdueAction.title}`,
      detail: `This action item was due ${overdueAction.dueDate}.${overdueAction.notes ? ` ${overdueAction.notes}` : ""}`,
      actionLabel: "Update or complete the action",
      dueDate: overdueAction.dueDate,
    });
  } else if (dueSoonAction) {
    addItem({
      id: `action-soon-${dueSoonAction.id}`,
      category: "action",
      priority: dueSoonAction.priority || "medium",
      title: `Action due soon: ${dueSoonAction.title}`,
      detail: `This action item is due ${dueSoonAction.dueDate}.${dueSoonAction.notes ? ` ${dueSoonAction.notes}` : ""}`,
      actionLabel: "Review the due-soon action",
      dueDate: dueSoonAction.dueDate,
    });
  }

  if (args.scenarioIsDirty) {
    addItem({
      id: "scenario-unsaved",
      category: "scenario",
      priority: "medium",
      title: "Save or branch the current scenario edits",
      detail: "The current planning workspace has unsaved changes, so this version can drift away from the named scenario you started from.",
      actionLabel: "Save branch or update the scenario",
    });
  } else if (args.activeScenario?.updatedAt) {
    const updatedDate = String(args.activeScenario.updatedAt).slice(0, 10);
    const daysSinceUpdate = dayDifference(updatedDate, today);
    if (daysSinceUpdate >= 45) {
      addItem({
        id: "scenario-stale",
        category: "scenario",
        priority: daysSinceUpdate >= 90 ? "medium" : "low",
        title: "Refresh the saved scenario assumptions",
        detail: `${args.activeScenario.name || "This scenario"} has not been updated since ${updatedDate}. Recheck rent, reserve, and exit assumptions before treating it as current.`,
        actionLabel: "Review and refresh the scenario",
        dueDate: updatedDate,
      });
    }
  }

  const nextMilestone = milestones[0] || null;
  if (nextMilestone) {
    const milestoneDays = Math.max(0, dayDifference(today, nextMilestone.date));
    addItem({
      id: `milestone-${nextMilestone.propertyId}-${nextMilestone.date}`,
      category: "decision",
      priority: milestoneDays <= 30 ? "high" : milestoneDays <= 60 ? "medium" : "low",
      title: `Upcoming decision: ${nextMilestone.title}`,
      detail: `${nextMilestone.detail} This lands on ${nextMilestone.date}, about ${milestoneDays} day${milestoneDays === 1 ? "" : "s"} out.`,
      actionLabel: "Convert this milestone into a scenario decision",
      dueDate: nextMilestone.date,
    });

    if (!args.forecastOptions?.assumeRerentAfterTurnover && nextMilestone.title.includes("Lease ends") && milestoneDays <= horizonMonths * 31) {
      addItem({
        id: `forecast-cliff-${nextMilestone.propertyId}-${nextMilestone.date}`,
        category: "decision",
        priority: milestoneDays <= 60 ? "medium" : "low",
        title: "Decide what happens after the signed leases end",
        detail: "Forecast is set to signed leases only, so rent can fall to zero after the next lease end unless you add a scenario event or assumed re-rent path.",
        actionLabel: "Choose a post-lease forecast path",
        dueDate: nextMilestone.date,
      });
    }
  }

  const nextCapital = capitalTargets[0] || null;
  if (nextCapital && Number(nextCapital.monthsRemaining || 999) <= 18) {
    addItem({
      id: `capital-${nextCapital.assetId || nextCapital.description}-${nextCapital.targetDate}`,
      category: "capital",
      priority: nextCapital.urgency === "near_term" ? "high" : "medium",
      title: `Fund the next capital target: ${nextCapital.description}`,
      detail: `${nextCapital.propertyName} | ${formatUnitLabel(nextCapital.unit)} is due ${nextCapital.targetDate} with about ${Math.round(Number(nextCapital.monthlyReserveTarget || 0))}/mo implied reserve pressure.`,
      actionLabel: "Plan or fund the capital target",
      dueDate: nextCapital.mustFundBy || nextCapital.targetDate,
    });
  }

  triggerAlerts.slice(0, 2).forEach((alert) => {
    addItem({
      id: `trigger-${alert.id}`,
      category: "trigger",
      priority: alert.priority,
      title: alert.title,
      detail: alert.detail,
      actionLabel: "Tune the trigger or the plan",
    });
  });

  if ((args.confidence?.label || "").toLowerCase() !== "high confidence") {
    addItem({
      id: "data-confidence",
      category: "data",
      priority: "low",
      title: "Tighten the planning inputs before treating this as final",
      detail: args.confidence?.detail || "Some planning assumptions are still approximate, so this forecast is better as a draft than a locked plan.",
      actionLabel: "Review the assumptions audit",
    });
  }

  if (Number(args.goalCount || 0) === 0 && Number(args.triggerCount || 0) === 0) {
    addItem({
      id: "guardrails",
      category: "data",
      priority: "low",
      title: "Add at least one planning guardrail",
      detail: "No goals or triggers are set yet, so the plan has no explicit line for what counts as acceptable cash flow, reserve coverage, or rollover timing.",
      actionLabel: "Set goals or triggers",
    });
  }

  recommendedMoves.slice(0, 2).forEach((move) => {
    addItem({
      id: `move-${move.id}`,
      category: "decision",
      priority: move.priority,
      title: move.title,
      detail: move.detail,
      actionLabel: move.actionLabel,
    });
  });

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return items
    .sort((left, right) => {
      const priorityCompare = priorityRank[left.priority] - priorityRank[right.priority];
      if (priorityCompare !== 0) return priorityCompare;
      if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 8);
}

export function buildPlanningGoalStatus(args: {
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  goals?: PlanningGoalSet;
}): PlanningGoalStatus[] {
  const goals = args.goals || {};
  const rows: PlanningGoalStatus[] = [];
  const addRow = (row?: PlanningGoalStatus | null) => {
    if (row) rows.push(row);
  };
  const statusForMinimum = (actual: number, target: number) => {
    if (actual >= target) return "on_track" as const;
    if (actual >= target * 0.9) return "watch" as const;
    return "off_track" as const;
  };
  const statusForMaximum = (actual: number, target: number) => {
    if (actual <= target) return "on_track" as const;
    if (actual <= target * 1.1) return "watch" as const;
    return "off_track" as const;
  };

  const monthlyCashFlow = Number(args.summary.firstYearCashFlow || 0) / 12;
  const annualCashFlow = Number(args.summary.firstYearCashFlow || 0);
  const endingEquity = Number(args.summary.horizonEndingEquity || 0);
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);
  const ltv = Number(args.summary.currentMarketValue || 0) > 0
    ? Number(args.summary.currentLoanBalance || 0) / Number(args.summary.currentMarketValue || 0)
    : 0;
  const dscr = Number(args.summary.adjustedMonthlyDebtService || 0) > 0
    ? Number(args.summary.firstYearNetOperatingIncome || 0) / (Number(args.summary.adjustedMonthlyDebtService || 0) * 12)
    : 0;

  if (Number.isFinite(Number(goals.minMonthlyCashFlow)) && Number(goals.minMonthlyCashFlow) > 0) {
    addRow({
      id: "minMonthlyCashFlow",
      label: "Monthly cash flow",
      targetLabel: `>= ${Math.round(Number(goals.minMonthlyCashFlow || 0))}`,
      actualLabel: Math.round(monthlyCashFlow).toString(),
      status: statusForMinimum(monthlyCashFlow, Number(goals.minMonthlyCashFlow || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minAnnualCashFlow)) && Number(goals.minAnnualCashFlow) > 0) {
    addRow({
      id: "minAnnualCashFlow",
      label: "Year-1 cash flow",
      targetLabel: `>= ${Math.round(Number(goals.minAnnualCashFlow || 0))}`,
      actualLabel: Math.round(annualCashFlow).toString(),
      status: statusForMinimum(annualCashFlow, Number(goals.minAnnualCashFlow || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minReserveMonths)) && Number(goals.minReserveMonths) > 0) {
    addRow({
      id: "minReserveMonths",
      label: "Reserve coverage",
      targetLabel: `>= ${Number(goals.minReserveMonths || 0).toFixed(1)} mo`,
      actualLabel: `${reserveMonths.toFixed(1)} mo`,
      status: statusForMinimum(reserveMonths, Number(goals.minReserveMonths || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minEndingEquity)) && Number(goals.minEndingEquity) > 0) {
    addRow({
      id: "minEndingEquity",
      label: "Horizon-end equity",
      targetLabel: `>= ${Math.round(Number(goals.minEndingEquity || 0))}`,
      actualLabel: Math.round(endingEquity).toString(),
      status: statusForMinimum(endingEquity, Number(goals.minEndingEquity || 0)),
    });
  }
  if (Number.isFinite(Number(goals.maxLtvPct)) && Number(goals.maxLtvPct) > 0) {
    addRow({
      id: "maxLtvPct",
      label: "Current LTV",
      targetLabel: `<= ${Math.round(Number(goals.maxLtvPct || 0) * 100)}%`,
      actualLabel: `${Math.round(ltv * 100)}%`,
      status: statusForMaximum(ltv, Number(goals.maxLtvPct || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minDscr)) && Number(goals.minDscr) > 0) {
    addRow({
      id: "minDscr",
      label: "Debt-service coverage",
      targetLabel: `>= ${Number(goals.minDscr || 0).toFixed(2)}x`,
      actualLabel: `${dscr.toFixed(2)}x`,
      status: statusForMinimum(dscr, Number(goals.minDscr || 0)),
    });
  }

  return rows;
}

export function buildPlanningFinancingComparison(args: {
  today: string;
  loans: Loan[];
  propertyId?: string;
  summary: PlanningProjectionSummary;
  exitPlan?: PlanningExitPlan;
  debtPayoffPlan?: PlanningDebtPayoffPlan;
}): PlanningFinancingComparison {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const scopedLoans = args.loans.filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId));
  const totalBalance = scopedLoans.reduce((sum, loan) => sum + Number(loan.currentBalance || 0), 0);
  const weightedCurrentRatePct = totalBalance > 0
    ? scopedLoans.reduce((sum, loan) => sum + (Number(loan.currentBalance || 0) * Number(loan.rate || 0)), 0) / totalBalance
    : 0;
  const currentPayoff = buildPlanningDebtPayoffAnalysis({
    today: args.today,
    loans: args.loans,
    propertyId: scopePropertyId,
    plan: {},
  });
  const acceleratedPayoff = buildPlanningDebtPayoffAnalysis({
    today: args.today,
    loans: args.loans,
    propertyId: scopePropertyId,
    plan: args.debtPayoffPlan,
  });
  const refiRatePct = Number(args.exitPlan?.targetRatePct || weightedCurrentRatePct || 0);
  const refiTermYears = Math.max(1, Number(args.exitPlan?.termYears || 30));
  const refiBalance = Math.max(0, totalBalance + Number(args.exitPlan?.cashOutAmount || 0));
  const currentCarryCostsMonthly = scopedLoans.reduce((sum, loan) => sum + Number(loan.scheduledEscrow || 0) + Number(loan.scheduledMortgageInsurance || 0), 0);
  const refiFullMonthlyOutlay = amortizedPayment(refiBalance, refiRatePct, refiTermYears) + currentCarryCostsMonthly;
  const refiPlanningMonthlyOutlay = refiFullMonthlyOutlay * clampPct(Number(args.summary.currentRentalUsePct || 1));
  const refiPayoffMonths = refiTermYears * 12;
  const refiTotalPayments = refiFullMonthlyOutlay * refiPayoffMonths;
  const refiInterestRemaining = Math.max(0, refiTotalPayments - refiBalance);

  return {
    weightedCurrentRatePct: Math.round(weightedCurrentRatePct * 100) / 100,
    currentLoanBalance: Math.round(totalBalance * 100) / 100,
    rows: [
      {
        id: "current",
        label: "Current financing",
        fullMonthlyOutlay: Math.round(Number(args.summary.fullMonthlyDebtService || 0) * 100) / 100,
        planningMonthlyOutlay: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
        payoffMonths: currentPayoff.currentMonthsToPayoff,
        payoffDate: currentPayoff.projectedPayoffDate,
        interestRemaining: currentPayoff.currentInterestRemaining,
        cashFlowImpact: 0,
        note: `Blended current rate about ${weightedCurrentRatePct.toFixed(2)}%. Planning outlay reflects the current rental-share mix.`,
      },
      {
        id: "refi",
        label: "Refi scenario",
        fullMonthlyOutlay: Math.round(refiFullMonthlyOutlay * 100) / 100,
        planningMonthlyOutlay: Math.round(refiPlanningMonthlyOutlay * 100) / 100,
        payoffMonths: refiPayoffMonths,
        payoffDate: addMonths(args.today, refiPayoffMonths),
        interestRemaining: Math.round(refiInterestRemaining * 100) / 100,
        cashFlowImpact: Math.round((Number(args.summary.adjustedMonthlyDebtService || 0) - refiPlanningMonthlyOutlay) * 100) / 100,
        note: `Rate ${refiRatePct.toFixed(2)}% | ${refiTermYears} years${Number(args.exitPlan?.cashOutAmount || 0) > 0 ? ` | Cash out ${Math.round(Number(args.exitPlan?.cashOutAmount || 0))}` : ""}.`,
      },
      {
        id: "accelerated",
        label: "Accelerated payoff",
        fullMonthlyOutlay: Math.round((Number(args.summary.fullMonthlyDebtService || 0) + acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        planningMonthlyOutlay: Math.round((Number(args.summary.adjustedMonthlyDebtService || 0) + acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        payoffMonths: acceleratedPayoff.acceleratedMonthsToPayoff,
        payoffDate: acceleratedPayoff.projectedPayoffDate,
        interestRemaining: acceleratedPayoff.acceleratedInterestRemaining,
        cashFlowImpact: Math.round((-acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        note: `Saves about ${acceleratedPayoff.monthsSaved} months and ${Math.round(acceleratedPayoff.interestSaved)} of interest.`,
      },
    ],
  };
}

export function buildPlanningDebtPayoffAnalysis(args: {
  today: string;
  loans: Loan[];
  propertyId?: string;
  plan?: PlanningDebtPayoffPlan;
}): PlanningDebtPayoffAnalysis {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const monthlyExtra = Math.max(0, Number(args.plan?.extraPrincipalMonthly || 0));
  const lumpSumAmount = Math.max(0, Number(args.plan?.lumpSumAmount || 0));
  const lumpSumDate = String(args.plan?.lumpSumDate || args.today);

  const simulate = (accelerated = false) => {
    const entries = args.loans
      .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
      .map((loan) => ({
        balance: Math.max(0, Number(loan.currentBalance || 0)),
        rate: Math.max(0, Number(loan.rate || 0)) / 100 / 12,
        scheduledPI: Math.max(0, Number(loan.scheduledPI || 0)),
        extraDefault: Math.max(0, Number(loan.defaultExtraPrincipal || 0)),
        nextPayment: String(loan.nextPayment || args.today),
      }));

    let months = 0;
    let interestTotal = 0;
    let cursor = args.today;
    let lumpSumApplied = false;
    while (entries.some((entry) => entry.balance > 0.01) && months < 720) {
      months += 1;
      cursor = addMonths(cursor, 1);
      entries.forEach((entry) => {
        if (entry.balance <= 0.01) {
          entry.balance = 0;
          return;
        }
        if (accelerated && !lumpSumApplied && cursor >= lumpSumDate && lumpSumAmount > 0) {
          entry.balance = Math.max(0, entry.balance - (lumpSumAmount / Math.max(1, entries.length)));
        }
        const interest = entry.balance * entry.rate;
        interestTotal += interest;
        const principal = Math.max(0, entry.scheduledPI - interest) + entry.extraDefault + (accelerated ? monthlyExtra : 0);
        entry.balance = Math.max(0, entry.balance - principal);
      });
      if (accelerated && !lumpSumApplied && cursor >= lumpSumDate && lumpSumAmount > 0) {
        lumpSumApplied = true;
      }
    }
    return {
      months,
      interestTotal: Math.round(interestTotal * 100) / 100,
      payoffDate: cursor,
    };
  };

  const current = simulate(false);
  const accelerated = simulate(true);

  return {
    currentMonthsToPayoff: current.months,
    acceleratedMonthsToPayoff: accelerated.months,
    monthsSaved: Math.max(0, current.months - accelerated.months),
    currentInterestRemaining: current.interestTotal,
    acceleratedInterestRemaining: accelerated.interestTotal,
    interestSaved: Math.max(0, Math.round((current.interestTotal - accelerated.interestTotal) * 100) / 100),
    projectedPayoffDate: accelerated.payoffDate,
    monthlyExtraOutlay: Math.round(monthlyExtra * 100) / 100,
  };
}

export function buildPlanningTurnoverPlanner(args: {
  today: string;
  propertyId?: string;
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  strategies?: PlanningRentStrategyInput[];
  plans?: PlanningTurnoverInput[];
}): { rows: PlanningTurnoverRow[]; summary: PlanningTurnoverSummary } {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const strategyMap = new Map((args.strategies || []).map((strategy) => [`${strategy.propertyId}::${strategy.unit}`, strategy]));
  const planMap = new Map((args.plans || []).map((plan) => [`${plan.propertyId}::${plan.unit}`, plan]));

  const rows = args.units
    .filter((unit) => unit.name !== "Shared" && matchesPropertyScope(unit.propertyId, scopePropertyId))
    .map((unit) => {
      const property = args.properties.find((item) => item.id === unit.propertyId);
      const activeLease = args.leases.find((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseIsActiveByDate(lease, args.today));
      const nextLease = args.leases
        .filter((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && lease.startDate >= args.today)
        .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
      const strategy = strategyMap.get(`${unit.propertyId}::${unit.name}`);
      const plan = planMap.get(`${unit.propertyId}::${unit.name}`);
      const monthlyRent = Math.max(0, Number(strategy?.targetRent || strategy?.marketRent || activeLease?.monthlyRent || nextLease?.monthlyRent || bestKnownRentForUnit({
        propertyId: unit.propertyId,
        unitName: unit.name,
        leases: args.leases,
        today: args.today,
      }) || 0));
      const nextTurnoverDate = String(strategy?.renewalStart || activeLease?.endDate || nextLease?.startDate || "");
      const makeReadyCost = Math.max(0, Number(plan?.makeReadyCost || 0));
      const downtimeDays = Math.max(0, Number(plan?.downtimeDays ?? 21));
      const leasingFeePct = Math.max(0, Number(plan?.leasingFeePct ?? 4));
      const concessionWeeks = Math.max(0, Number(plan?.concessionWeeks ?? 0));
      const lostRent = monthlyRent * (downtimeDays / 30);
      const leasingFeeCost = monthlyRent * 12 * (leasingFeePct / 100);
      const concessionCost = monthlyRent * (concessionWeeks / 4);
      const totalTurnoverCost = makeReadyCost + lostRent + leasingFeeCost + concessionCost;
      const recoveryMonths = monthlyRent > 0 ? totalTurnoverCost / monthlyRent : 0;

      return {
        propertyId: unit.propertyId,
        propertyName: property?.name || unit.propertyId,
        unit: unit.name,
        monthlyRent: Math.round(monthlyRent * 100) / 100,
        nextTurnoverDate,
        monthsUntilTurnover: nextTurnoverDate ? Math.max(0, monthDifference(args.today, nextTurnoverDate)) : 0,
        makeReadyCost: Math.round(makeReadyCost * 100) / 100,
        downtimeDays: Math.round(downtimeDays),
        leasingFeePct: Math.round(leasingFeePct * 100) / 100,
        concessionWeeks: Math.round(concessionWeeks * 100) / 100,
        lostRent: Math.round(lostRent * 100) / 100,
        leasingFeeCost: Math.round(leasingFeeCost * 100) / 100,
        concessionCost: Math.round(concessionCost * 100) / 100,
        totalTurnoverCost: Math.round(totalTurnoverCost * 100) / 100,
        recoveryMonths: Math.round(recoveryMonths * 100) / 100,
        notes: String(plan?.notes || ""),
      };
    })
    .sort((left, right) => {
      if (left.nextTurnoverDate && right.nextTurnoverDate) return left.nextTurnoverDate.localeCompare(right.nextTurnoverDate);
      if (left.nextTurnoverDate) return -1;
      if (right.nextTurnoverDate) return 1;
      return right.totalTurnoverCost - left.totalTurnoverCost;
    });

  const pricedRows = rows.filter((row) => row.monthlyRent > 0);
  return {
    rows,
    summary: {
      pricedUnitCount: pricedRows.length,
      totalProjectedCost: Math.round(rows.reduce((sum, row) => sum + row.totalTurnoverCost, 0) * 100) / 100,
      averageDowntimeDays: rows.length ? Math.round((rows.reduce((sum, row) => sum + row.downtimeDays, 0) / rows.length) * 10) / 10 : 0,
      soonestTurnoverDate: rows.find((row) => row.nextTurnoverDate)?.nextTurnoverDate || "",
    },
  };
}

export function buildPlanningTaxProjection(args: {
  today: string;
  rows: PlanningProjectionRow[];
  loans: Loan[];
  assets: Asset[];
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
  propertyId?: string;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
  scenarioEvents?: PlanningScenarioEvent[];
}): PlanningTaxProjection {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const forecastStart = firstDayOfNextMonth(args.today);
  const grossRent = Math.round(args.rows.slice(0, 12).reduce((sum, row) => sum + Number(row.effectiveRent || 0), 0) * 100) / 100;
  const operatingExpenses = Math.round(args.rows.slice(0, 12).reduce((sum, row) => sum + Number(row.operatingExpenses || 0), 0) * 100) / 100;

  const trackedLoans = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .map((loan) => ({ loan, balance: Number(loan.currentBalance || 0) }));
  let mortgageInterest = 0;
  for (let index = 0; index < Math.min(12, args.rows.length); index += 1) {
    const monthDate = new Date(forecastStart);
    monthDate.setUTCMonth(forecastStart.getUTCMonth() + index);
    const midpoint = monthMidpointIso(monthDate);
    const scenarioState = buildPlanningScenarioStateAtDate({
      today: args.today,
      date: midpoint,
      baseOverrides: args.scenarioOverrides,
      scenarioEvents: args.scenarioEvents,
      baseMonthlyCapexReserve: 0,
    });
    const effective = applyPlanningScenarioOverrides({
      today: args.today,
      leases: args.leases,
      usePeriods: args.usePeriods,
      units: args.units,
      overrides: scenarioState.overrides,
    });
    trackedLoans.forEach((entry) => {
      const monthlyRate = Number(entry.loan.rate || 0) / 100 / 12;
      const interest = entry.balance * monthlyRate;
      mortgageInterest += deductibleMortgageInterest({
        interest,
        propertyId: entry.loan.propertyId,
        date: midpoint,
        usePeriods: effective.usePeriods,
        leases: effective.leases,
        units: effective.units,
      });
      entry.balance = projectLoanBalance(entry.balance, entry.loan);
    });
  }

  const monthCountsByYear = args.rows.slice(0, 12).reduce((map, row) => {
    const year = Number(String(row.month || "").slice(0, 4));
    if (!year) return map;
    map[year] = (map[year] || 0) + 1;
    return map;
  }, {} as Record<number, number>);
  const currentScenarioState = buildPlanningScenarioStateAtDate({
    today: args.today,
    date: args.today,
    baseOverrides: args.scenarioOverrides,
    scenarioEvents: args.scenarioEvents,
    baseMonthlyCapexReserve: 0,
  });
  const effective = applyPlanningScenarioOverrides({
    today: args.today,
    leases: args.leases,
    usePeriods: args.usePeriods,
    units: args.units,
    overrides: currentScenarioState.overrides,
  });
  const depreciation = Object.entries(monthCountsByYear).reduce((sum, [yearText, monthCount]) => {
    const year = Number(yearText);
    const annual = args.assets
      .filter((asset) => matchesPropertyScope(asset.propertyId, scopePropertyId))
      .reduce((assetSum, asset) => assetSum + adjustedAssetDepreciationForYear({
        asset,
        year,
        usePeriods: effective.usePeriods,
        leases: effective.leases,
        units: effective.units,
      }), 0);
    return sum + (annual * (Number(monthCount || 0) / 12));
  }, 0);

  const roundedMortgageInterest = Math.round(mortgageInterest * 100) / 100;
  const roundedDepreciation = Math.round(depreciation * 100) / 100;
  const projectedScheduleE = Math.round((grossRent - operatingExpenses - roundedMortgageInterest - roundedDepreciation) * 100) / 100;

  return {
    grossRent,
    operatingExpenses,
    mortgageInterest: roundedMortgageInterest,
    depreciation: roundedDepreciation,
    projectedScheduleE,
    projectedTaxableIncome: projectedScheduleE,
    note: "Rough next-12-month planning forecast using forecast rent/OpEx, projected deductible mortgage interest, and blended depreciation.",
  };
}

export function buildPlanningScenarioDiff(args: {
  baselineLabel: string;
  scenarioLabel: string;
  baseline: {
    assumptions: PlanningAssumptions;
    summary: PlanningProjectionSummary;
    overrides?: PlanningScenarioUnitOverride[];
    events?: PlanningScenarioEvent[];
    goals?: PlanningGoalSet;
    debtPayoffPlan?: PlanningDebtPayoffPlan;
  };
  scenario: {
    assumptions: PlanningAssumptions;
    summary: PlanningProjectionSummary;
    overrides?: PlanningScenarioUnitOverride[];
    events?: PlanningScenarioEvent[];
    goals?: PlanningGoalSet;
    debtPayoffPlan?: PlanningDebtPayoffPlan;
  };
}): PlanningScenarioDiffRow[] {
  const rows: PlanningScenarioDiffRow[] = [];
  const pushIfChanged = (field: string, baselineValue: string, scenarioValue: string) => {
    if (baselineValue === scenarioValue) return;
    rows.push({ field, baselineValue, scenarioValue });
  };

  pushIfChanged("Forecast horizon", `${args.baseline.assumptions.horizonMonths} mo`, `${args.scenario.assumptions.horizonMonths} mo`);
  pushIfChanged("Rent growth", `${args.baseline.assumptions.annualRentGrowthPct}%`, `${args.scenario.assumptions.annualRentGrowthPct}%`);
  pushIfChanged("OpEx growth", `${args.baseline.assumptions.annualExpenseGrowthPct}%`, `${args.scenario.assumptions.annualExpenseGrowthPct}%`);
  pushIfChanged("Value growth", `${args.baseline.assumptions.annualValueGrowthPct}%`, `${args.scenario.assumptions.annualValueGrowthPct}%`);
  pushIfChanged("Vacancy", `${args.baseline.assumptions.vacancyRatePct}%`, `${args.scenario.assumptions.vacancyRatePct}%`);
  pushIfChanged("Monthly reserve", `${args.baseline.assumptions.monthlyCapexReserve}`, `${args.scenario.assumptions.monthlyCapexReserve}`);
  pushIfChanged("Included utilities", `${args.baseline.assumptions.includedUtilitiesMonthly || 0}`, `${args.scenario.assumptions.includedUtilitiesMonthly || 0}`);
  pushIfChanged("Year-1 cash flow", `${Math.round(args.baseline.summary.firstYearCashFlow)}`, `${Math.round(args.scenario.summary.firstYearCashFlow)}`);
  pushIfChanged("Year-1 NOI", `${Math.round(args.baseline.summary.firstYearNetOperatingIncome)}`, `${Math.round(args.scenario.summary.firstYearNetOperatingIncome)}`);
  pushIfChanged("Horizon-end equity", `${Math.round(args.baseline.summary.horizonEndingEquity)}`, `${Math.round(args.scenario.summary.horizonEndingEquity)}`);
  pushIfChanged("Unit overrides", `${(args.baseline.overrides || []).length}`, `${(args.scenario.overrides || []).length}`);
  pushIfChanged("Timeline events", `${(args.baseline.events || []).length}`, `${(args.scenario.events || []).length}`);
  pushIfChanged("Goal count", `${Object.values(args.baseline.goals || {}).filter((value) => Number(value || 0) > 0).length}`, `${Object.values(args.scenario.goals || {}).filter((value) => Number(value || 0) > 0).length}`);
  pushIfChanged("Extra payoff / mo", `${Math.round(Number(args.baseline.debtPayoffPlan?.extraPrincipalMonthly || 0))}`, `${Math.round(Number(args.scenario.debtPayoffPlan?.extraPrincipalMonthly || 0))}`);

  return rows;
}

export function buildPlanningScenarioRange(args: {
  scenarios: Array<{ key: string; label: string; summary: PlanningProjectionSummary }>;
}): PlanningScenarioRange {
  const scenarios = args.scenarios || [];
  const baseScenario = scenarios.find((item) => item.key === "base") || scenarios[Math.floor(scenarios.length / 2)] || {
    summary: {
      firstYearCashFlow: 0,
      firstYearNetOperatingIncome: 0,
      horizonEndingEquity: 0,
    },
  };
  const cashFlows = scenarios.map((item) => Number(item.summary.firstYearCashFlow || 0));
  const nois = scenarios.map((item) => Number(item.summary.firstYearNetOperatingIncome || 0));
  const equities = scenarios.map((item) => Number(item.summary.horizonEndingEquity || 0));

  return {
    downsideCashFlow: Math.min(...cashFlows, 0),
    baseCashFlow: Number(baseScenario.summary.firstYearCashFlow || 0),
    upsideCashFlow: Math.max(...cashFlows, 0),
    downsideNoi: Math.min(...nois, 0),
    baseNoi: Number(baseScenario.summary.firstYearNetOperatingIncome || 0),
    upsideNoi: Math.max(...nois, 0),
    downsideEquity: Math.min(...equities, 0),
    baseEquity: Number(baseScenario.summary.horizonEndingEquity || 0),
    upsideEquity: Math.max(...equities, 0),
  };
}

export function buildPlanningSensitivity(args: {
  today: string;
  propertyId?: string;
  properties: Property[];
  transactions: Transaction[];
  leases: Lease[];
  loans: Loan[];
  usePeriods: UsePeriod[];
  units: Unit[];
  assumptions: PlanningAssumptions;
  scenarioOverrides?: PlanningScenarioUnitOverride[];
  scenarioEvents?: PlanningScenarioEvent[];
  rentStrategies?: PlanningRentStrategyInput[];
  turnoverInputs?: PlanningTurnoverInput[];
  forecastOptions?: PlanningForecastOptions;
}): PlanningSensitivityRow[] {
  const baseAssumptions = {
    horizonMonths: Number(args.assumptions.horizonMonths || 12),
    annualRentGrowthPct: Number(args.assumptions.annualRentGrowthPct || 0) / 100,
    annualExpenseGrowthPct: Number(args.assumptions.annualExpenseGrowthPct || 0) / 100,
    annualValueGrowthPct: Number(args.assumptions.annualValueGrowthPct || 0) / 100,
    vacancyRatePct: Number(args.assumptions.vacancyRatePct || 0) / 100,
    monthlyCapexReserve: Number(args.assumptions.monthlyCapexReserve || 0),
    includedUtilitiesMonthly: Number(args.assumptions.includedUtilitiesMonthly || 0),
  };
  const commonArgs = {
    today: args.today,
    propertyId: args.propertyId,
    properties: args.properties,
    transactions: args.transactions,
    leases: args.leases,
    loans: args.loans,
    usePeriods: args.usePeriods,
    units: args.units,
    scenarioOverrides: args.scenarioOverrides,
    scenarioEvents: args.scenarioEvents,
    rentStrategies: args.rentStrategies,
    turnoverInputs: args.turnoverInputs,
    forecastOptions: args.forecastOptions,
  };
  const baseProjection = buildPlanningProjection({
    ...commonArgs,
    assumptions: baseAssumptions,
  });
  const variants = [
    {
      id: "vacancy-plus-1pt",
      label: "Vacancy sensitivity",
      adjustmentLabel: "Vacancy +1.0 pt",
      note: "How much worse the plan gets if vacancy / credit loss runs one point higher.",
      assumptions: { ...baseAssumptions, vacancyRatePct: baseAssumptions.vacancyRatePct + 0.01 },
    },
    {
      id: "opex-plus-1pt",
      label: "Expense sensitivity",
      adjustmentLabel: "OpEx growth +1.0 pt",
      note: "How much worse the plan gets if expense growth runs one point hotter.",
      assumptions: { ...baseAssumptions, annualExpenseGrowthPct: baseAssumptions.annualExpenseGrowthPct + 0.01 },
    },
    {
      id: "rent-plus-1pt",
      label: "Rent sensitivity",
      adjustmentLabel: "Rent growth +1.0 pt",
      note: "How much the plan improves if rent growth lands one point stronger.",
      assumptions: { ...baseAssumptions, annualRentGrowthPct: baseAssumptions.annualRentGrowthPct + 0.01 },
    },
    {
      id: "value-plus-1pt",
      label: "Value sensitivity",
      adjustmentLabel: "Value growth +1.0 pt",
      note: "How much ending equity changes if value growth lands one point stronger.",
      assumptions: { ...baseAssumptions, annualValueGrowthPct: baseAssumptions.annualValueGrowthPct + 0.01 },
    },
  ];

  return variants
    .map((variant) => {
      const projection = buildPlanningProjection({
        ...commonArgs,
        assumptions: variant.assumptions,
      });
      const deltaCashFlow = Math.round((Number(projection.summary.firstYearCashFlow || 0) - Number(baseProjection.summary.firstYearCashFlow || 0)) * 100) / 100;
      const deltaNoi = Math.round((Number(projection.summary.firstYearNetOperatingIncome || 0) - Number(baseProjection.summary.firstYearNetOperatingIncome || 0)) * 100) / 100;
      const deltaEquity = Math.round((Number(projection.summary.horizonEndingEquity || 0) - Number(baseProjection.summary.horizonEndingEquity || 0)) * 100) / 100;
      return {
        id: variant.id,
        label: variant.label,
        adjustmentLabel: variant.adjustmentLabel,
        direction: deltaCashFlow > 0 || deltaEquity > 0 ? "positive" : "negative",
        deltaCashFlow,
        deltaNoi,
        deltaEquity,
        note: variant.note,
      } satisfies PlanningSensitivityRow;
    })
    .sort((left, right) => Math.max(Math.abs(right.deltaCashFlow), Math.abs(right.deltaEquity)) - Math.max(Math.abs(left.deltaCashFlow), Math.abs(left.deltaEquity)));
}

export function planningProjectionCsv(args: {
  scopeLabel: string;
  generatedAt?: string;
  assumptions: PlanningAssumptions;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  rows: PlanningProjectionRow[];
}) {
  const horizonLabel = `${args.assumptions.horizonMonths}-mo`;
  const horizonTotals = args.rows.reduce((sum, row) => ({
    effectiveRent: sum.effectiveRent + Number(row.effectiveRent || 0),
    netOperatingIncome: sum.netOperatingIncome + Number(row.netOperatingIncome || 0),
    cashFlow: sum.cashFlow + Number(row.cashFlow || 0),
  }), {
    effectiveRent: 0,
    netOperatingIncome: 0,
    cashFlow: 0,
  });
  const lines = [
    ["Planning report", args.scopeLabel, args.generatedAt || ""].map(csvCell).join(","),
    ["Assumption", "Value"].map(csvCell).join(","),
    ["Forecast horizon (months)", args.assumptions.horizonMonths].map(csvCell).join(","),
    ["Annual rent growth %", args.assumptions.annualRentGrowthPct].map(csvCell).join(","),
    ["Annual OpEx growth %", args.assumptions.annualExpenseGrowthPct].map(csvCell).join(","),
    ["Annual value growth %", args.assumptions.annualValueGrowthPct].map(csvCell).join(","),
    ["Vacancy / credit loss %", args.assumptions.vacancyRatePct].map(csvCell).join(","),
    ["Monthly CapEx reserve", args.assumptions.monthlyCapexReserve].map(csvCell).join(","),
    ["Included utilities / mo", args.assumptions.includedUtilitiesMonthly || 0].map(csvCell).join(","),
    "",
    ["Summary metric", "Value"].map(csvCell).join(","),
    ["Current monthly rent", args.summary.currentMonthlyRent].map(csvCell).join(","),
    ["Trailing monthly OpEx", args.summary.trailingMonthlyOperatingExpenses].map(csvCell).join(","),
    ["Adjusted monthly debt service", args.summary.adjustedMonthlyDebtService].map(csvCell).join(","),
    ["Current rental use %", args.summary.currentRentalUsePct].map(csvCell).join(","),
    [`Next ${horizonLabel} effective rent`, Math.round(horizonTotals.effectiveRent * 100) / 100].map(csvCell).join(","),
    [`Next ${horizonLabel} NOI`, Math.round(horizonTotals.netOperatingIncome * 100) / 100].map(csvCell).join(","),
    [`Next ${horizonLabel} cash flow`, Math.round(horizonTotals.cashFlow * 100) / 100].map(csvCell).join(","),
    ["Horizon-end equity", args.summary.horizonEndingEquity].map(csvCell).join(","),
    ["6-mo cushion target", args.reserve.sixMonthCushionTarget].map(csvCell).join(","),
    ["First-year reserve contribution", args.reserve.firstYearReserveContribution].map(csvCell).join(","),
    "",
    [
      "Month",
      "Scheduled rent",
      "Vacancy loss",
      "Effective rent",
      "OpEx",
      "Utilities-included adjustment",
      "NOI",
      "Debt service",
      "CapEx reserve",
      "Cash flow",
      "Projected value",
      "Projected loan balance",
      "Projected equity",
      "Driver",
      "Driver detail",
    ].map(csvCell).join(","),
    ...args.rows.map((row) =>
      [
        row.month,
        row.scheduledRent,
        row.vacancyLoss,
        row.effectiveRent,
        row.operatingExpenses,
        row.utilityIncludedAdjustment,
        row.netOperatingIncome,
        row.debtService,
        row.capexReserve,
        row.cashFlow,
        row.projectedValue,
        row.projectedLoanBalance,
        row.projectedEquity,
        row.driverLabel || "",
        row.driverDetail || "",
      ].map(csvCell).join(","),
    ),
  ];

  return lines.join("\n");
}
