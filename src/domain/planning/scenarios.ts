import type { PlanningScenarioEvent, PlanningScenarioUnitOverride } from "./types.ts";
import type { Lease, UsePeriod, Unit } from "../../models.ts";
import { addMonths } from "./shared.ts";

export function overrideKey(propertyId: string, unit: string) {
  return `${propertyId}::${unit}`;
}

export function normalizeScenarioOverrideMode(mode?: string) {
  if (mode === "rented" || mode === "owner" || mode === "vacant") return mode;
  return "auto";
}

export function normalizeScenarioEvent(args: {
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

export function buildPlanningScenarioStateAtDate(args: {
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

export function applyPlanningScenarioOverrides(args: {
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
