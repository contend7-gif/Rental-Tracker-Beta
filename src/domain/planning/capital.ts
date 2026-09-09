import type { PlanningProjectionSummary, PlanningReserveSummary, PlanningCapitalTarget, PlanningManualCapitalProject } from "./types.ts";
import type { Property, Asset } from "../../models.ts";
import { clampPct, matchesPropertyScope, addYears, monthDifference } from "./shared.ts";

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
