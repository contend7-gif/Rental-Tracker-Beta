import { useCallback, useState } from "react";

export type DashboardContextState = {
  yearFilter: string;
  propertyFilter: string;
  unitFilter: string;
};

export type DashboardNavigationTarget = DashboardContextState & {
  view: string;
};

export type LeaseExpirationTone = "critical" | "warning" | "neutral";

export type LeaseExpirationPill = {
  label: string;
  tone: LeaseExpirationTone;
};

export type TrendDescriptor = {
  text: string;
  direction: "up" | "down";
  tone: "positive" | "negative";
} | null;

export function getDefaultDashboardYear(): string {
  return new Date().getFullYear().toString();
}

export const DEFAULT_DASHBOARD_CONTEXT: DashboardContextState = {
  yearFilter: getDefaultDashboardYear(),
  propertyFilter: "all",
  unitFilter: "all",
};

export function buildDashboardFiltersSummary(yearFilter: string, propertyFilterLabel: string, unitFilterLabel: string) {
  return `Year: ${yearFilter} | Properties: ${propertyFilterLabel} | Units: ${unitFilterLabel}`;
}

export function buildDashboardNavigationTarget(view: string, context: DashboardContextState): DashboardNavigationTarget {
  return {
    view,
    yearFilter: context.yearFilter,
    propertyFilter: context.propertyFilter,
    unitFilter: context.unitFilter,
  };
}

export function getLeaseExpirationPill(daysRemaining: number, isMonthToMonth: boolean, historicalSnapshot = false): LeaseExpirationPill {
  if (isMonthToMonth) {
    return { label: "MTM", tone: "neutral" };
  }

  if (Number.isNaN(daysRemaining)) {
    return { label: "Unknown", tone: "neutral" };
  }

  if (historicalSnapshot && daysRemaining < 0) {
    return { label: "Ended", tone: "neutral" };
  }

  if (daysRemaining < 0) {
    return { label: `${Math.abs(daysRemaining)}d overdue`, tone: "critical" };
  }

  if (daysRemaining === 0) {
    return { label: "Due today", tone: "critical" };
  }

  if (daysRemaining < 60) {
    return { label: `${daysRemaining}d left`, tone: "critical" };
  }

  if (daysRemaining <= 120) {
    return { label: `${daysRemaining}d left`, tone: "warning" };
  }

  return { label: `${daysRemaining}d left`, tone: "neutral" };
}

export function leaseExpirationToneClass(tone: LeaseExpirationTone) {
  if (tone === "critical") return "border !border-rose-300 !bg-rose-100 !text-rose-800";
  if (tone === "warning") return "border !border-amber-300 !bg-amber-100 !text-amber-800";
  return "border !border-slate-300 !bg-slate-100 !text-slate-700";
}

export function shouldExpandNeedsReview(openCount: number) {
  return openCount > 0;
}

export function buildTrendDescriptor(currentValue: number, previousValue: number, higherIsBetter: boolean): TrendDescriptor {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue <= 0) {
    return null;
  }

  const delta = currentValue - previousValue;
  const pct = (delta / Math.abs(previousValue)) * 100;
  const rounded = Math.round(pct * 10) / 10;

  return {
    text: `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}% vs last year`,
    direction: rounded >= 0 ? "up" : "down",
    tone: higherIsBetter ? (rounded >= 0 ? "positive" : "negative") : (rounded >= 0 ? "negative" : "positive"),
  };
}

export function useDashboardContext(initial: DashboardContextState = DEFAULT_DASHBOARD_CONTEXT) {
  const [dashboardContext, setDashboardContext] = useState<DashboardContextState>(initial);

  const setYearFilter = useCallback((yearFilter: string) => {
    setDashboardContext((prev) => ({ ...prev, yearFilter }));
  }, []);

  const setPropertyFilter = useCallback((propertyFilter: string) => {
    setDashboardContext((prev) => ({ ...prev, propertyFilter }));
  }, []);

  const setUnitFilter = useCallback((unitFilter: string) => {
    setDashboardContext((prev) => ({ ...prev, unitFilter }));
  }, []);

  const applyDashboardContext = useCallback((context: DashboardContextState) => {
    setDashboardContext({
      yearFilter: context.yearFilter,
      propertyFilter: context.propertyFilter,
      unitFilter: context.unitFilter,
    });
  }, []);

  return {
    dashboardContext,
    yearFilter: dashboardContext.yearFilter,
    propertyFilter: dashboardContext.propertyFilter,
    unitFilter: dashboardContext.unitFilter,
    setYearFilter,
    setPropertyFilter,
    setUnitFilter,
    applyDashboardContext,
  };
}
