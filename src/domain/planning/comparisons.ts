import type { Unit, Lease, Loan, UsePeriod, Transaction, Property } from "../../models.ts";
import type { PlanningScenarioUnitOverride, PlanningDecisionComparison, PlanningAssumptions, PlanningProjectionSummary, PlanningScenarioEvent, PlanningGoalSet, PlanningDebtPayoffPlan, PlanningScenarioDiffRow, PlanningScenarioRange, PlanningRentStrategyInput, PlanningTurnoverInput, PlanningForecastOptions, PlanningSensitivityRow } from "./types.ts";
import { applyPlanningScenarioOverrides } from "./scenarios.ts";
import { matchesPropertyScope, scheduledRentForDate, trailingMonthlyOperatingExpenses, bestKnownRentForUnit, clampPct } from "./shared.ts";
import { currentAdjustedDebtService } from "./financing.ts";
import { buildPlanningProjection } from "./forecast.ts";

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
