import type { Property, Lease, Loan, UsePeriod, Unit } from "../../models.ts";
import type { PlanningScenarioUnitOverride, PlanningPropertySnapshot, PlanningScenarioEvent, PlanningRentStrategyInput, PlanningTurnoverInput, PlanningForecastOptions, PlanningMilestone } from "./types.ts";
import { applyPlanningScenarioOverrides, normalizeScenarioEvent } from "./scenarios.ts";
import { matchesPropertyScope, sumLoanBalance, scheduledRentForDate, clampPct, addMonths } from "./shared.ts";
import { currentAdjustedDebtService } from "./financing.ts";
import { formatUnitLabel } from "../unitLabels.js";
import { buildPlanningForecastRerentAssumptions } from "./forecast.ts";

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
