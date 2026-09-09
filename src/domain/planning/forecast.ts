import type { Unit, Lease, Property, Transaction, Loan, UsePeriod } from "../../models.ts";
import type { PlanningForecastRerentAssumption, PlanningRentStrategyInput, PlanningTurnoverInput, PlanningForecastOptions, PlanningAssumptions, PlanningScenarioUnitOverride, PlanningScenarioEvent, PlanningProjectionResult, PlanningProjectionRow } from "./types.ts";
import { currentAdjustedDebtService, projectLoanBalance } from "./financing.ts";
import { matchesPropertyScope, leaseIsActiveByDate, addDays, addMonths, clampPct, sumCurrentValue, sumLoanBalance, scheduledRentForDate, trailingMonthlyOperatingExpenses, trailingMonthlyOperatingExpenseProfile, utilitiesIncludedLeaseCountForDate, firstDayOfNextMonth, monthKey, monthMidpointIso, usePeriodIsActiveByDate } from "./shared.ts";
import { normalizeLeaseAgreementType } from "../leaseTerms.js";
import { buildPlanningScenarioStateAtDate, applyPlanningScenarioOverrides, overrideKey } from "./scenarios.ts";
import { getRentalUsePctForDate, loanBreakdown } from "../accounting.ts";
import { formatUnitLabel } from "../unitLabels.js";

export function buildPlanningForecastRerentAssumptions(args: {
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
