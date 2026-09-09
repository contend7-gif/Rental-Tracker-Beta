import type { Property, Unit, Lease } from "../../models.ts";
import type { PlanningScenarioUnitOverride, PlanningRentStrategyInput, PlanningRentStrategyRow, PlanningRentStrategySummary, PlanningTurnoverInput, PlanningTurnoverRow, PlanningTurnoverSummary } from "./types.ts";
import { overrideKey, applyPlanningScenarioOverrides } from "./scenarios.ts";
import { matchesPropertyScope, leaseIsActiveByDate, bestKnownRentForUnit, monthDifference } from "./shared.ts";

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
