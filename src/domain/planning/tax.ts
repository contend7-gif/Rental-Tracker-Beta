import type { Asset, UsePeriod, Lease, Unit, Loan } from "../../models.ts";
import { adjustedAssetDepreciationForYear } from "../assetDepreciation.ts";
import { dayDifference, firstDayOfNextMonth, matchesPropertyScope, monthMidpointIso } from "./shared.ts";
import type { PlanningProjectionRow, PlanningScenarioUnitOverride, PlanningScenarioEvent, PlanningTaxProjection } from "./types.ts";
import { buildPlanningScenarioStateAtDate, applyPlanningScenarioOverrides } from "./scenarios.ts";
import { deductibleMortgageInterest } from "../accounting.ts";
import { projectLoanBalance } from "./financing.ts";

export function adjustedAssetDepreciationThroughDate(args: {
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
