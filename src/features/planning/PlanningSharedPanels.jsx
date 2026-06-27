import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarClock, ChevronDown, CircleDollarSign, Flag, ShieldCheck, TriangleAlert } from "lucide-react";

function priorityVariant(priority) {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "secondary";
  return "outline";
}

function jumpCardToneClass(tone) {
  if (tone === "risk") return "border-rose-200 bg-rose-50/70 hover:border-rose-300";
  if (tone === "warn") return "border-amber-200 bg-amber-50/70 hover:border-amber-300";
  if (tone === "good") return "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300";
  return "border-slate-200 bg-white hover:border-blue-200";
}

function priorityPanelClass(priority) {
  if (priority === "high") return "border-rose-200 bg-rose-50/70";
  if (priority === "medium") return "border-amber-200 bg-amber-50/70";
  return "border-slate-200 bg-slate-50/80";
}

function priorityLabel(priority) {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

function moveIconForId(id) {
  if (id === "cash-flow-gap") return TriangleAlert;
  if (id === "rent-roll-upside") return CircleDollarSign;
  if (id === "turnover-plan" || id === "next-milestone") return CalendarClock;
  if (String(id || "").startsWith("trigger-")) return Flag;
  return BarChart3;
}

export function PlanningOverviewJumpCards({ cards, onOpenSubtab }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={`planning-overview-jump-${card.id}`}
          type="button"
          className={`rounded-xl border p-3 text-left shadow-none transition hover:border-blue-300 ${jumpCardToneClass(card.tone)}`}
          onClick={() => onOpenSubtab(card.subtab)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">{card.title}</div>
            <span className="text-xs font-medium text-blue-700">Open</span>
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">{card.value}</div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{card.detail}</div>
        </button>
      ))}
    </div>
  );
}

export function PlanningOverviewMetrics({ summary, horizonMetrics, horizonShortLabel, statTileClass, currency, toPctDisplay }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={statTileClass}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Signed current rent roll</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.currentMonthlyRent)}</div>
          <div className="mt-1 text-xs text-slate-500">Signed leases.</div>
        </div>
        <div className={statTileClass}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Trailing monthly OpEx</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.trailingMonthlyOperatingExpenses)}</div>
          <div className="mt-1 text-xs text-slate-500">12-month average.</div>
        </div>
        <div className={statTileClass}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Adjusted debt service</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.adjustedMonthlyDebtService)}</div>
          <div className="mt-1 text-xs text-slate-500">Current rental share {toPctDisplay(summary.currentRentalUsePct)}.</div>
        </div>
        <div className={statTileClass}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Current equity</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.currentEquity)}</div>
          <div className="mt-1 text-xs text-slate-500">Value {currency(summary.currentMarketValue)} less loans {currency(summary.currentLoanBalance)}.</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="text-xs uppercase tracking-wide text-emerald-800">Next {horizonShortLabel} effective rent</div>
          <div className="mt-1 text-base font-semibold text-emerald-900">{currency(horizonMetrics.effectiveRent)}</div>
          <div className="mt-1 text-xs text-emerald-900/80">After vacancy assumption.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
          <div className="text-xs uppercase tracking-wide text-slate-500">Next {horizonShortLabel} NOI</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(horizonMetrics.netOperatingIncome)}</div>
          <div className="mt-1 text-xs text-slate-500">Income less projected operating expenses.</div>
        </div>
        <div className={`rounded-xl border p-3 shadow-none ${horizonMetrics.cashFlow >= 0 ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
          <div className={`text-xs uppercase tracking-wide ${horizonMetrics.cashFlow >= 0 ? "text-emerald-800" : "text-rose-800"}`}>Next {horizonShortLabel} cash flow</div>
          <div className={`mt-1 text-base font-semibold ${horizonMetrics.cashFlow >= 0 ? "text-emerald-900" : "text-rose-900"}`}>{currency(horizonMetrics.cashFlow)}</div>
          <div className={`mt-1 text-xs ${horizonMetrics.cashFlow >= 0 ? "text-emerald-900/80" : "text-rose-900/80"}`}>After debt and reserve target.</div>
        </div>
        <div className={statTileClass}>
          <div className="text-xs uppercase tracking-wide text-slate-500">Horizon-end equity</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(summary.horizonEndingEquity)}</div>
          <div className="mt-1 text-xs text-slate-500">Value {currency(summary.horizonEndingValue)} less loans {currency(summary.horizonEndingLoanBalance)}.</div>
        </div>
      </div>
    </>
  );
}

export function PlanningScenarioCharts({ charts, months }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scenario charts</div>
          <div className="mt-1 text-xs text-slate-500">First 12 months.</div>
        </div>
        <Badge variant="outline">{months} months</Badge>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {charts.map((chart) => (
          <div key={`planning-scenario-chart-${chart.key}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{chart.label}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Range {chart.format(chart.min)} to {chart.format(chart.max)}
                </div>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-2">
              <svg viewBox="0 0 320 120" className="h-32 w-full">
                <line x1="12" x2="308" y1="108" y2="108" stroke="#e2e8f0" strokeWidth="1" />
                {chart.axisY != null ? <line x1="12" x2="308" y1={chart.axisY} y2={chart.axisY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" /> : null}
                {chart.scenarios.map((series) => (
                  series.points ? (
                    <polyline
                      key={`planning-chart-line-${chart.key}-${series.key}`}
                      fill="none"
                      stroke={series.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={series.points}
                    />
                  ) : null
                ))}
              </svg>
            </div>
            <div className="mt-3 space-y-2">
              {chart.scenarios.map((series) => (
                <div key={`planning-chart-legend-${chart.key}-${series.key}`} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
                    <span className="truncate text-slate-700">{series.label}</span>
                  </div>
                  <span className="shrink-0 font-medium text-slate-900">{chart.format(series.latestValue)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanningDecisionDashboard({ dashboard }) {
  const firstWeakFactor = dashboard.health.factors.find((item) => item.status !== "strong");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Decision dashboard</div>
        </div>
        <Badge variant={dashboard.health.status === "fragile" ? "destructive" : dashboard.health.status === "watch" ? "secondary" : "outline"}>
          {dashboard.health.label}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Plan health</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{dashboard.health.score}/100</div>
            </div>
            <ShieldCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />
          </div>
          <div className="mt-1 text-xs text-slate-500">{dashboard.health.label}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Confidence</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{dashboard.confidence.label}</div>
          <div className="mt-1 text-xs text-slate-500">{dashboard.confidence.detail}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Main risk</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{firstWeakFactor?.label || "No major stress point"}</div>
          <div className="mt-1 text-xs text-slate-500">{dashboard.health.primaryConcern}</div>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Best next move</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{dashboard.nextMove?.title || "Keep the current plan updated"}</div>
          <div className="mt-1 text-xs text-slate-500">{dashboard.nextMove?.actionLabel || "No action suggested yet"}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.health.factors.map((factor) => (
          <div key={`planning-health-factor-${factor.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-slate-900">{factor.label}</div>
              <Badge variant={factor.status === "weak" ? "destructive" : factor.status === "watch" ? "secondary" : "outline"}>
                {factor.status === "weak" ? "Weak" : factor.status === "watch" ? "Watch" : "Strong"}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500">{factor.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanningRecommendedMoveRow({ item, onAddMove, onApplyMove }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = moveIconForId(item.id);
  const iconTone = item.priority === "high"
    ? "border border-rose-200 bg-rose-50 text-rose-700"
    : item.priority === "medium"
      ? "border border-amber-200 bg-amber-50 text-amber-700"
      : "border border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-none">
      <div className="grid gap-2 p-2 sm:grid-cols-[auto,1fr,auto] sm:items-center">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{item.title}</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.detail}</div>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge>
          <span className="max-w-[18rem] truncate text-xs font-medium text-slate-700">{item.actionLabel}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" className="h-7" onClick={() => onApplyMove(item)}>
            Apply move
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => onAddMove(item)}>
            Add task
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${item.title}`}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-900">Why it matters:</span> {item.detail}
        </div>
      ) : null}
    </div>
  );
}

export function PlanningRecommendedMoves({ moves, onApplyMove, onAddMove }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Recommended moves</div>
        </div>
        <Badge variant="secondary">{moves.length} moves</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {moves.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
            No urgent moves right now. Keep assumptions current as leases, reserve targets, and scenario events change.
          </div>
        ) : (
          moves.map((item) => (
            <PlanningRecommendedMoveRow
              key={`planning-move-${item.id}`}
              item={item}
              onApplyMove={onApplyMove}
              onAddMove={onAddMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function PlanningReviewInbox({ items, onOpenItem }) {
  const typeLabels = {
    capital: "Risk",
    data: "Data",
    decision: "Decision",
    scenario: "Decision",
    trigger: "Trigger",
    action: "Task",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Review inbox</div>
          <div className="mt-1 text-xs text-slate-500">Generated planning warnings, triggers, and decisions needing a response.</div>
        </div>
        <Badge variant="secondary">{items.length} items</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">Planning review is clear. Recheck after rent, reserve, lease, or horizon changes.</div>
        ) : (
          items.map((item) => (
            <div key={`planning-review-item-${item.id}`} className={`rounded-lg border p-3 ${priorityPanelClass(item.priority)}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{item.detail}</div>
                </div>
                <div className="ml-auto flex w-full shrink-0 justify-end gap-2 sm:w-auto">
                  <Badge variant="outline">{typeLabels[item.category] || "Decision"}</Badge>
                  {item.dueDate ? <Badge variant="outline">Due {item.dueDate}</Badge> : null}
                  <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.category}</div>
                <Button size="sm" variant="secondary" className="h-7" onClick={() => onOpenItem(item)}>
                  {item.actionLabel}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
