import React from "react";
import { CalendarDays, CircleDollarSign, LineChart, PieChart, WalletCards, Lightbulb } from "lucide-react";

import {
  PlanningDecisionDashboard,
  PlanningOverviewJumpCards,
  PlanningOverviewMetrics,
  PlanningRecommendedMoves,
} from "./PlanningSharedPanels.jsx";

function PlanningSimpleMetrics({ currency, horizonMetrics, horizonShortLabel, statTileClass, summary }) {
  const cashFlowPositive = Number(horizonMetrics.cashFlow || 0) >= 0;
  const iconBoxClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700";
  return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className={statTileClass}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Signed rent roll now</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.currentMonthlyRent)}</div>
          </div>
          <span className={iconBoxClass}><CircleDollarSign className="h-4 w-4" aria-hidden="true" /></span>
        </div>
        <div className="mt-1 text-xs text-slate-500">Signed monthly rent.</div>
      </div>
      <div className={`rounded-xl border p-3 shadow-none ${cashFlowPositive ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className={`text-xs uppercase tracking-wide ${cashFlowPositive ? "text-emerald-800" : "text-rose-800"}`}>{horizonShortLabel} cash flow</div>
            <div className={`mt-1 text-base font-semibold ${cashFlowPositive ? "text-emerald-900" : "text-rose-900"}`}>{currency(horizonMetrics.cashFlow)}</div>
          </div>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cashFlowPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            <LineChart className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className={`mt-1 text-xs ${cashFlowPositive ? "text-emerald-900/80" : "text-rose-900/80"}`}>After debt and reserves.</div>
      </div>
      <div className={statTileClass}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{horizonShortLabel} NOI</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{currency(horizonMetrics.netOperatingIncome)}</div>
          </div>
          <span className={iconBoxClass}><PieChart className="h-4 w-4" aria-hidden="true" /></span>
        </div>
        <div className="mt-1 text-xs text-slate-500">Projected NOI.</div>
      </div>
      <div className={statTileClass}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Equity at horizon</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.horizonEndingEquity)}</div>
          </div>
          <span className={iconBoxClass}><WalletCards className="h-4 w-4" aria-hidden="true" /></span>
        </div>
        <div className="mt-1 text-xs text-slate-500">Value less loans.</div>
      </div>
    </div>
  );
}

function PlanningCurrentVsPlannedSummary({
  currency,
  horizonMetrics,
  horizonMonths,
  monthlyCapexReserve,
  planningRows,
  summary,
}) {
  const rows = Array.isArray(planningRows) ? planningRows : [];
  const currentCashFlow =
    Number(summary.currentMonthlyRent || 0) -
    Number(summary.trailingMonthlyOperatingExpenses || 0) -
    Number(summary.adjustedMonthlyDebtService || 0) -
    Number(monthlyCapexReserve || 0);
  const plannedAverageCashFlow = Number(horizonMetrics.cashFlow || 0) / Math.max(1, Number(horizonMonths || 1));
  const cashFlowChange = plannedAverageCashFlow - currentCashFlow;
  const primaryDriver = rows.find((row) => row.driverLabel && row.driverLabel !== "Signed leases + assumptions") || rows[0];
  const changeTone = cashFlowChange >= 0 ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Current vs planned</div>
          <div className="mt-1 text-xs text-slate-500">Monthly cash-flow baseline compared with the selected horizon average.</div>
        </div>
        <div className={`text-sm font-semibold ${changeTone}`}>
          Change vs current: {cashFlowChange >= 0 ? "+" : ""}{currency(cashFlowChange)}/mo
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current monthly cash flow</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(currentCashFlow)}</div>
          <div className="mt-1 text-xs text-slate-500">Rent less trailing OpEx, adjusted debt, and reserve.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Planned monthly average</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{currency(plannedAverageCashFlow)}</div>
            </div>
            <CalendarDays className="h-5 w-5 text-teal-600" aria-hidden="true" />
          </div>
          <div className="mt-1 text-xs text-slate-500">Average across the active planning horizon.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Main driver</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{primaryDriver?.driverLabel || "Signed leases + assumptions"}</div>
            </div>
            <Lightbulb className="h-5 w-5 text-teal-600" aria-hidden="true" />
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{primaryDriver?.driverDetail || "Forecast follows current leases and assumptions."}</div>
        </div>
      </div>
    </div>
  );
}

export function PlanningOverviewTab({
  currency,
  dashboard,
  horizonMetrics,
  horizonMonths,
  horizonShortLabel,
  jumpCards,
  monthlyCapexReserve,
  onAddActionItem,
  onApplyMove,
  onMoveAdded,
  onOpenSubtab,
  planningRows,
  propertyFilter,
  recommendedMoves,
  statTileClass,
  summary,
  toPctDisplay,
}) {
  const addMoveToPlan = (item) => {
    onAddActionItem({
      title: item.title,
      priority: item.priority,
      notes: `${item.detail} Next move: ${item.actionLabel}`,
      sourceType: "recommendation",
      sourceKey: item.id ? `recommended-move:${item.id}` : "",
      propertyId: propertyFilter === "all" ? "" : propertyFilter,
    });
    onMoveAdded?.();
    onOpenSubtab("actions");
  };

  return (
    <>
      <PlanningSimpleMetrics
        currency={currency}
        horizonMetrics={horizonMetrics}
        horizonShortLabel={horizonShortLabel}
        statTileClass={statTileClass}
        summary={summary}
      />

      <PlanningCurrentVsPlannedSummary
        currency={currency}
        horizonMetrics={horizonMetrics}
        horizonMonths={horizonMonths}
        monthlyCapexReserve={monthlyCapexReserve}
        planningRows={planningRows}
        summary={summary}
      />

      <PlanningDecisionDashboard dashboard={dashboard} />

      <PlanningRecommendedMoves
        moves={recommendedMoves}
        onApplyMove={onApplyMove}
        onAddMove={addMoveToPlan}
      />

      <details className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">More planning detail</summary>
        <div className="mt-3 space-y-3">
          <PlanningOverviewMetrics
            summary={summary}
            horizonMetrics={horizonMetrics}
            horizonShortLabel={horizonShortLabel}
            statTileClass={statTileClass}
            currency={currency}
            toPctDisplay={toPctDisplay}
          />
          <PlanningOverviewJumpCards cards={jumpCards} onOpenSubtab={onOpenSubtab} />
        </div>
      </details>
    </>
  );
}
