import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Home,
  ListChecks,
  Minus,
  ReceiptText,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  countUpcomingLeaseExpirations,
  deriveCashflowSummary,
  deriveDashboardActionStatus,
  derivePropertySnapshotMode,
  deriveRentCollectionSummary,
  deriveTransactionBadges,
  formatDashboardPlanningConcern,
  formatDashboardUnitLabel,
} from "./dashboardDerived.js";
import { formatRentReportingMonth, getTransactionVisual } from "../transactions/transactionPresentation.js";

const DASHBOARD_PREVIEW_LIMITS = {
  compact: 3,
  comfortable: 5,
  detailed: 6,
};

const DASHBOARD_PANEL_CLASS = "rounded-lg border border-slate-200 bg-white shadow-sm";
const DASHBOARD_MUTED_TILE_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80";

function Stat({ title, value, subtitle, trend, icon: Icon, onClick }) {
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const valueText = String(value ?? "");
  const valueClassName = valueText.length > 10 ? "text-base" : "text-lg";
  return (
    <Card className={`h-full shadow-sm ${onClick ? "cursor-pointer transition hover:border-blue-200 hover:bg-blue-50/30" : ""}`} onClick={onClick}>
      <CardContent className="flex min-h-[118px] flex-col px-3 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-7 items-start justify-between gap-2">
            <div className="min-w-0 text-[10px] font-semibold uppercase leading-4 text-slate-500">
              <span className="line-clamp-2">{title}</span>
            </div>
            {Icon ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-700"><Icon className="h-3.5 w-3.5" /></span> : null}
          </div>
          <div className={`mt-1 max-w-full truncate whitespace-nowrap font-semibold leading-tight text-slate-900 ${valueClassName}`}>{value}</div>
          {subtitle && <div className="mt-0.5 line-clamp-2 max-w-[12rem] text-[11px] leading-4 text-slate-500">{subtitle}</div>}
        </div>
          {trend ? (
            <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${trend.tone === "positive" ? "text-emerald-700" : "text-rose-700"}`}>
              <TrendIcon className="h-3 w-3" />
              <span>{trend.text}</span>
            </div>
          ) : <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400"><Minus className="h-3 w-3" /><span>vs last year</span></div>}
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function formatChartAmount(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absolute >= 1000000) return `${sign}$${(absolute / 1000000).toFixed(absolute >= 10000000 ? 0 : 1)}m`;
  if (absolute >= 1000) return `${sign}$${(absolute / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(absolute)}`;
}

function chartTickStep(value) {
  const roughStep = Math.max(1, Math.abs(Number(value || 0)));
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / power;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * power;
}

function MiniTrendChart({ rows }) {
  const width = 460;
  const height = 152;
  const padLeft = 48;
  const padRight = 22;
  const padY = 18;
  const series = ["income", "expenses", "cashflow"];
  const values = rows.flatMap((row) => series.map((key) => Number(row[key] || 0)));
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
  const tickStep = chartTickStep((rawMax - rawMin) / 3);
  const minValue = Math.floor(rawMin / tickStep) * tickStep;
  const maxValue = Math.ceil(rawMax / tickStep) * tickStep;
  const range = Math.max(1, maxValue - minValue);
  const xForIndex = (index) => (rows.length === 1 ? (padLeft + width - padRight) / 2 : padLeft + (index * (width - padLeft - padRight)) / (rows.length - 1));
  const yForValue = (value) => height - padY - ((Number(value || 0) - minValue) / range) * (height - padY * 2);
  const pathFor = (key) => rows.map((row, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(row[key])}`).join(" ");
  const colors = {
    income: "#16a34a",
    expenses: "#ef4444",
    cashflow: "#2563eb",
  };

  return (
    <div className="mt-2 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Cashflow trend chart">
        {[0, 1, 2, 3].map((line) => {
          const y = padY + (line * (height - padY * 2)) / 3;
          const value = maxValue - (line * range) / 3;
          return (
            <g key={`grid-${line}`}>
              <text x={padLeft - 7} y={y + 4} textAnchor="end" fontSize="13" fontWeight="500" fill="#64748b">{formatChartAmount(value)}</text>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#dbe5ee" strokeDasharray="3 5" />
            </g>
          );
        })}
        {series.map((key) => (
          <path key={key} d={pathFor(key)} fill="none" stroke={colors[key]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        ))}
        {rows.map((row, index) => (
          <g key={row.key}>
            <circle cx={xForIndex(index)} cy={yForValue(row.cashflow)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
            <text x={xForIndex(index)} y={height - 2} textAnchor="middle" fontSize="12" fill="#64748b">
              {formatMonthLabel(row.key)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CashflowPanel({ cashflowSummary, currency, monthMode, onMonthModeChange, seeAllTransactions }) {
  return (
    <Card className={DASHBOARD_PANEL_CLASS}>
      <CardHeader className="px-4 pb-1.5 pt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Cashflow</CardTitle>
            <CardDescription className="mt-0.5 text-xs">{monthMode === "rent" ? "Rent income by rent month; expenses by posted date." : "Income and expenses by posted date."}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-medium">
              <button type="button" className={`rounded px-2 py-1 ${monthMode === "rent" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => onMonthModeChange("rent")}>Rent month</button>
              <button type="button" className={`rounded px-2 py-1 ${monthMode === "cash" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => onMonthModeChange("cash")}>Cash date</button>
            </div>
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline" onClick={seeAllTransactions}>Open ledger <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-2 pt-0">
        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
          <div><div className="font-semibold text-emerald-700">{currency(cashflowSummary.totals.income)}</div><div className="text-slate-500">Income</div></div>
          <div><div className="font-semibold text-rose-700">{currency(cashflowSummary.totals.expenses)}</div><div className="text-slate-500">Expenses</div></div>
          <div><div className={`font-semibold ${cashflowSummary.totals.cashflow >= 0 ? "text-blue-700" : "text-rose-700"}`}>{currency(cashflowSummary.totals.cashflow)}</div><div className="text-slate-500">Net cashflow</div></div>
        </div>
        {cashflowSummary.hasMeaningfulTrend ? (
          <>
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Income</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" /> Net</span>
            </div>
            <MiniTrendChart rows={cashflowSummary.rows} />
          </>
        ) : (
          <div className="mt-2 flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-3 py-1.5 text-center">
            <div>
              <div className="text-sm font-semibold text-slate-800">{cashflowSummary.hasData ? "Not enough monthly variation yet" : "No cashflow data for this scope"}</div>
              <div className="mt-0.5 text-xs text-slate-500">{cashflowSummary.hasData ? "Add another month of income or expenses to unlock a useful trend." : "Record rent and expenses to start the cashflow view."}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RentCollectionPanel({ currency, rentSummary, seeAllLeases }) {
  const visibleRows = rentSummary.rows.slice(0, 4);
  return (
    <Card className={DASHBOARD_PANEL_CLASS}>
      <CardHeader className="px-4 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">Rent Collection</CardTitle>
          <button type="button" className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline" onClick={seeAllLeases}>Manage leases <ArrowRight className="h-3 w-3" /></button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-2">
          <div><div className="text-base font-semibold text-slate-950">{currency(rentSummary.collectedYtd)}</div><div className="text-[11px] text-slate-500">Rent recorded YTD</div></div>
          <div><div className="text-base font-semibold text-slate-950">{currency(rentSummary.expectedYtd)}</div><div className="text-[11px] text-slate-500">Rent scheduled YTD</div></div>
          <div><div className="text-sm font-semibold text-slate-900">{currency(rentSummary.outstanding)}</div><div className="text-[11px] text-slate-500">Open balance</div></div>
          <div><div className="text-sm font-semibold text-slate-900">{rentSummary.showCollectionRate ? `${rentSummary.collectionRatePct}%` : "Partial"}</div><div className="text-[11px] text-slate-500">{rentSummary.showCollectionRate ? "Collection rate" : "Schedule coverage"}</div></div>
        </div>
        {rentSummary.hasLeaseSchedule ? (
          <div className="mt-2">
            {rentSummary.showCollectionRate ? <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600" style={{ width: `${rentSummary.progressPct}%` }} /></div> : null}
            {rentSummary.scheduleCoveragePartial ? <div className="text-[10px] leading-4 text-slate-400">Lease schedule is partial for this scope, so recorded rent may exceed visible scheduled rent. Collection rate is not shown.</div> : null}
          </div>
        ) : (
          <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">Lease schedule is partial for this scope, so recorded rent may exceed visible scheduled rent. Collection rate is not shown.</div>
        )}
        <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
          {visibleRows.length === 0 ? <div className="py-4 text-center text-xs text-slate-500">No units or properties match the selected scope.</div> : visibleRows.map((row) => (
            <button key={row.id} type="button" className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5 text-left hover:bg-slate-50/80" onClick={seeAllLeases}>
              <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{row.label}</span><span className="block text-[11px] text-slate-500">{rentSummary.mode === "units" ? `${row.status === "Owner" ? "Owner occupied" : row.status}${row.leaseEndDate ? ` - Lease ends ${row.leaseEndDate}` : ""}` : `${row.occupiedUnits}/${row.units} occupied - ${row.occupancyPct}%`}</span></span>
              <span className="text-right"><span className="block text-xs font-semibold text-slate-800">{row.status === "Owner" || row.status === "Vacant" ? "No current rent scheduled" : currency(row.collectedYtd)}</span><span className={`block text-[10px] ${row.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>{row.status === "Owner" ? (row.collectedYtd > 0 ? `${currency(row.collectedYtd)} recorded YTD` : "Owner occupied") : row.status === "Vacant" ? "Vacant" : row.outstanding > 0 ? `${currency(row.outstanding)} open` : "Recorded"}</span></span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCenter({ actionStatus, allClearLabel, healthyAction, rows }) {
  const primaryIssue = rows.find((row) => row.recommendation) || healthyAction;
  const nextMoveTitle = primaryIssue.recommendation;
  const nextMoveDetail = primaryIssue.detail;
  const toneClass = actionStatus.tone === "destructive" ? "border-rose-200 bg-rose-50 text-rose-800" : actionStatus.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : actionStatus.tone === "watch" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <Card className={DASHBOARD_PANEL_CLASS}>
      <CardHeader className="px-4 pb-1 pt-3">
        <div className="flex items-start justify-between gap-3"><CardTitle className="text-base">Action Center</CardTitle><span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${toneClass}`}>{actionStatus.label}</span></div>
      </CardHeader>
      <CardContent className="px-4 pb-2.5 pt-0">
        <div className="border-t border-slate-100 pt-1.5 text-xs leading-4 text-slate-600">{actionStatus.explanation}</div>
        {rows.length ? <div className="mt-1.5 divide-y divide-slate-100 border-y border-slate-100">
          {rows.map(({ Icon, label, rowDetail, value, onClick, tone }) => (
            <button key={label} type="button" className="flex w-full items-center gap-2 py-1.5 text-left hover:text-teal-800" onClick={onClick}><Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium">{label}</span>{rowDetail ? <span className="mt-0.5 block line-clamp-1 text-[10px] leading-3.5 text-slate-500">{rowDetail}</span> : null}</span><span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>{value}</span></button>
          ))}
        </div> : null}
        {allClearLabel ? <div className="flex items-center gap-1.5 border-b border-slate-100 py-1 text-[10px] font-medium text-slate-400"><CheckCircle2 className="h-3 w-3 shrink-0" />{allClearLabel}</div> : null}
        <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Best next move</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-950">{nextMoveTitle}</div>
          <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{nextMoveDetail}</div>
          <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline" onClick={primaryIssue.onClick}>{primaryIssue.actionLabel}<ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, description, icon: Icon, actionLabel, onAction }) {
  return (
    <CardHeader className="px-4 pb-1.5 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? (
            <div className="mt-0.5 rounded border border-slate-200 bg-slate-50 p-1 text-slate-500">
              <Icon className="h-3.5 w-3.5" />
            </div>
          ) : null}
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription className="mt-0.5 text-xs">{description}</CardDescription> : null}
          </div>
        </div>
        {actionLabel ? (
          <button type="button" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-teal-700 underline-offset-2 hover:underline" onClick={onAction}>
            {actionLabel}<ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </CardHeader>
  );
}

function SetupChecklistPanel({
  navigateWithDashboardContext,
  setupChecklist,
  setupChecklistShowDismissed,
  setupChecklistShowFull,
  toggleSetupChecklistDismissed,
  toggleSetupChecklistItemOverride,
  toggleSetupChecklistShowDismissed,
  toggleSetupChecklistShowFull,
}) {
  if (!setupChecklist || (setupChecklist.status === "complete" && !setupChecklistShowFull)) return null;
  return (
    <Card className={DASHBOARD_PANEL_CLASS}>
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2"><ListChecks className="h-4 w-4 shrink-0 text-teal-700" /><span><span className="block text-sm font-semibold text-slate-900">Setup progress</span><span className="block text-xs text-slate-500">{setupChecklist.completeCount || 0} complete, {setupChecklist.needsSetupCount || 0} need setup, {setupChecklist.needsReviewCount || 0} need review</span></span></span>
          <Badge variant={setupChecklist.status === "complete" ? "outline" : "secondary"} className={setupChecklist.status === "complete" ? "!bg-emerald-50 !text-emerald-700" : "!bg-blue-50 !text-blue-700"}>{setupChecklist.label || "Setup checklist"}</Badge>
        </summary>
        <CardContent className="border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={Boolean(setupChecklistShowDismissed)} onChange={(event) => toggleSetupChecklistShowDismissed?.(event.target.checked)} /><span>Show completed / dismissed items</span></label>
            {setupChecklist.status === "complete" ? <Button size="sm" variant="ghost" onClick={toggleSetupChecklistShowFull}>Hide from dashboard</Button> : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {(setupChecklist.items || []).map((item) => (
              <div key={`setup-check-${item.key}`} className={`${DASHBOARD_MUTED_TILE_CLASS} p-3`}>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{item.status === "complete" || item.status === "not_applicable" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ClipboardList className="h-4 w-4 text-slate-500" />}<span className="truncate">{item.label}</span></div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.explanation}</div>{item.overrideNote ? <div className="mt-1 text-xs text-slate-500">Note: {item.overrideNote}</div> : null}</div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <Badge variant="secondary">{item.statusLabel}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => navigateWithDashboardContext(item.targetView)}>Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleSetupChecklistItemOverride?.(item.key, item.status === "not_applicable" ? "" : "not_applicable")}>{item.status === "not_applicable" ? "Undo" : "N/A"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => item.status === "dismissed" ? toggleSetupChecklistItemOverride?.(item.key, "") : toggleSetupChecklistDismissed?.(item.key)}>{item.status === "dismissed" ? "Undo" : "Dismiss"}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </details>
    </Card>
  );
}

const TRANSACTION_BADGE_CLASSES = {
  teal: "!border-teal-200 !bg-teal-50 !text-teal-700",
  amber: "!border-amber-200 !bg-amber-50 !text-amber-800",
  slate: "!border-slate-200 !bg-slate-50 !text-slate-600",
  blue: "!border-blue-200 !bg-blue-50 !text-blue-700",
};

function RecentTransactionsPanel({ currency, dashboardTransactions, dashboardDensity, documents, openTransaction, prefetchTransactionDialog, propertyNameById, seeAllTransactions, transactionReviewById }) {
  const previewLimit = DASHBOARD_PREVIEW_LIMITS[dashboardDensity] || DASHBOARD_PREVIEW_LIMITS.comfortable;
  const visibleTransactions = dashboardTransactions.slice(0, previewLimit);
  return (
    <Card className={DASHBOARD_PANEL_CLASS}>
      <SectionTitle title="Recent Transactions" icon={ReceiptText} actionLabel="See all" onAction={seeAllTransactions} />
      <CardContent className="px-4 pb-2 pt-0">
        {visibleTransactions.length === 0 ? <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">No transactions for the current filters.</div> : (
          <div className="border-t border-slate-100">
            {visibleTransactions.map((transaction) => {
              const { Icon, iconClass, amountClass } = getTransactionVisual(transaction);
              const badges = deriveTransactionBadges(transaction, transactionReviewById?.[transaction.id], documents);
              const rentPeriodLabel = formatRentReportingMonth(transaction);
              return (
                <button key={transaction.id} className="flex w-full items-start gap-2.5 border-b border-slate-100 py-2 text-left transition hover:bg-slate-50/80" onClick={() => openTransaction(transaction)} onMouseEnter={prefetchTransactionDialog} onFocus={prefetchTransactionDialog} onTouchStart={prefetchTransactionDialog}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${iconClass}`}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1"><span className="block line-clamp-1 text-xs font-semibold text-slate-900">{transaction.description}</span><span className="block line-clamp-1 text-[11px] text-slate-500">{transaction.category} - {propertyNameById[transaction.propertyId] || transaction.propertyId} - {formatDashboardUnitLabel(transaction.unit)}{rentPeriodLabel ? ` - ${rentPeriodLabel}` : ""}</span>{badges.length ? <span className="mt-1 flex flex-wrap gap-1">{badges.map((badge) => <Badge key={badge.key} variant="outline" className={`h-4 px-1 py-0 text-[9px] ${TRANSACTION_BADGE_CLASSES[badge.tone]}`}>{badge.label}</Badge>)}</span> : null}</span>
                  <span className="shrink-0 text-right"><span className="block text-[10px] text-slate-500">{transaction.date}</span><span className={`block text-xs font-semibold ${amountClass}`}>{currency(transaction.amount)}</span></span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertySnapshotPanel({ currency, dashboardOpenReviewItems, dashboardPropertySnapshot, openPropertyFromSnapshot, rentSummary, seeAllProperties }) {
  const mode = derivePropertySnapshotMode(dashboardPropertySnapshot);
  const reviewCountMaps = useMemo(() => {
    const byProperty = new Map();
    const byUnit = new Map();
    (dashboardOpenReviewItems || []).forEach((item) => {
      if (!item?.propertyId) return;
      byProperty.set(item.propertyId, (byProperty.get(item.propertyId) || 0) + 1);
      if (item.unit) {
        const unitKey = `${item.propertyId}::${item.unit}`;
        byUnit.set(unitKey, (byUnit.get(unitKey) || 0) + 1);
      }
    });
    return { byProperty, byUnit };
  }, [dashboardOpenReviewItems]);
  const reviewCountFor = (propertyId, unit) => (
    unit
      ? reviewCountMaps.byUnit.get(`${propertyId}::${unit}`) || 0
      : reviewCountMaps.byProperty.get(propertyId) || 0
  );
  if (mode === "empty") {
    return <Card className={DASHBOARD_PANEL_CLASS}><SectionTitle title="Property Snapshot" icon={Building2} actionLabel="Add property" onAction={seeAllProperties} /><CardContent className="px-4 pb-3 pt-0"><div className="rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-center text-xs text-slate-500">Add a property and units to start the operating snapshot.</div></CardContent></Card>;
  }
  if (mode === "units") {
    const property = dashboardPropertySnapshot[0].property;
    return (
      <Card className={DASHBOARD_PANEL_CLASS}><SectionTitle title="Unit Snapshot" description={property.name} icon={Home} actionLabel="Manage property" onAction={() => openPropertyFromSnapshot(property.id)} /><CardContent className="px-4 pb-2 pt-0"><div className="border-t border-slate-100">{rentSummary.rows.map((row) => { const reviewCount = reviewCountFor(row.propertyId, row.unitName); const isOwner = row.status === "Owner"; const statusLabel = isOwner ? "Owner occupied" : row.status; const rentLabel = row.monthlyRent > 0 ? currency(row.monthlyRent) : isOwner ? "No rent scheduled" : "Not set"; const statusTone = isOwner ? "!border-slate-200 !bg-slate-50 !text-slate-600" : row.status === "Occupied" ? "!border-emerald-200 !bg-emerald-50 !text-emerald-700" : "!border-amber-200 !bg-amber-50 !text-amber-700"; return <button key={row.id} type="button" className="grid w-full gap-1.5 border-b border-slate-100 py-2 text-left sm:grid-cols-[minmax(0,1fr)_112px_92px] sm:items-center" onClick={() => openPropertyFromSnapshot(row.propertyId)}><span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-semibold text-slate-900">{row.label}</span><Badge variant="outline" className={`h-4 px-1 py-0 text-[9px] ${statusTone}`}>{statusLabel}</Badge></span>{row.leaseEndDate ? <span className="block text-[10px] text-slate-500">Lease ends {row.leaseEndDate}</span> : null}</span><span className="text-left sm:text-right"><span className="block text-xs font-semibold text-slate-800">{rentLabel}</span>{row.monthlyRent > 0 ? <span className="block text-[10px] text-slate-500">Monthly rent</span> : null}</span>{reviewCount > 0 ? <span className="flex items-center sm:justify-end"><Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{reviewCount} open</Badge></span> : <span className="whitespace-nowrap text-[10px] text-slate-400 sm:text-right">No open items</span>}</button>; })}</div></CardContent></Card>
    );
  }
  const rentByProperty = Object.fromEntries(rentSummary.rows.map((row) => [row.propertyId, row]));
  return (
    <Card className={DASHBOARD_PANEL_CLASS}><SectionTitle title="Property Summary" icon={Building2} actionLabel="See all" onAction={seeAllProperties} /><CardContent className="px-5 pb-3 pt-0"><div className="overflow-x-auto border-t border-slate-100"><div className="min-w-[640px]"><div className="grid grid-cols-[1.5fr_.55fr_.7fr_1fr_.65fr] gap-3 py-2 text-[11px] font-semibold uppercase text-slate-500"><span>Property</span><span>Units</span><span>Occupancy</span><span>Rent recorded</span><span>Alerts</span></div>{dashboardPropertySnapshot.map((snapshot) => { const rent = rentByProperty[snapshot.property.id]; const alerts = reviewCountFor(snapshot.property.id); return <button key={snapshot.property.id} type="button" className="grid w-full grid-cols-[1.5fr_.55fr_.7fr_1fr_.65fr] gap-3 border-t border-slate-100 py-3 text-left text-sm hover:bg-slate-50/80" onClick={() => openPropertyFromSnapshot(snapshot.property.id)}><span><span className="block font-semibold text-slate-900">{snapshot.property.name}</span><span className="block truncate text-xs text-slate-500">{snapshot.property.address}</span></span><span>{snapshot.unitCount}</span><span>{snapshot.occupancyPct}%</span><span>{currency(rent?.collectedYtd || 0)}</span><span className={alerts > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}>{alerts || "None"}</span></button>; })}</div></div></CardContent></Card>
  );
}

export function DashboardWorkspace({
  currency,
  dashboardAsOfDate,
  dashboardLeases,
  dashboardOpenReviewItems,
  dashboardScopedLeases,
  dashboardScopedTransactions,
  dashboardDensity,
  dashboardPlanningWatch,
  dashboardPropertySnapshot,
  dashboardRentTransactions,
  dashboardStatCards,
  dashboardTransactions,
  documents,
  leases,
  maintenanceStatusSummary,
  navigateWithDashboardContext,
  openPlanningWorkspace,
  openPropertyFromSnapshot,
  openTransaction,
  prefetchTransactionDialog,
  properties,
  propertyFilter,
  propertyNameById,
  seeAllLeases,
  seeAllNeedsReview,
  seeAllProperties,
  seeAllTransactions,
  setupChecklist,
  setupChecklistShowDismissed,
  setupChecklistShowFull,
  taxPacketSummary,
  taxReadinessSummary,
  taxReviewOpenCount,
  tenantLedgerEntries,
  transactionReviewById,
  toggleSetupChecklistDismissed,
  toggleSetupChecklistItemOverride,
  toggleSetupChecklistShowDismissed,
  toggleSetupChecklistShowFull,
  unitFilter,
  units,
  yearFilter,
}) {
  const scopedTransactions = dashboardScopedTransactions || dashboardTransactions;
  const scopedLeases = dashboardScopedLeases || dashboardLeases || leases;
  const [cashflowMonthMode, setCashflowMonthMode] = useState("rent");
  const cashflowSummary = deriveCashflowSummary(scopedTransactions, { useRentPeriod: cashflowMonthMode === "rent" });
  const rentSummary = deriveRentCollectionSummary({ transactions: dashboardRentTransactions || scopedTransactions, leases, tenantLedgerEntries, properties, units, yearFilter, propertyFilter, unitFilter, asOfDate: dashboardAsOfDate });
  const upcomingLeaseCount = countUpcomingLeaseExpirations(scopedLeases, dashboardAsOfDate, 120);
  const openMaintenanceCount = (maintenanceStatusSummary || []).filter((row) => ["Open", "In Progress", "Waiting on Parts"].includes(row.status)).reduce((sum, row) => sum + Number(row.count || 0), 0);
  const actionStatus = deriveDashboardActionStatus({ openReviewCount: taxReviewOpenCount, upcomingLeaseCount, openMaintenanceCount, setupChecklist, planningHealth: dashboardPlanningWatch.health, taxReadinessSummary, taxPacketSummary });
  const setupOpenCount = Number(setupChecklist?.needsSetupCount || 0) + Number(setupChecklist?.needsReviewCount || 0);
  const openTaxReviewCount = Number(taxReviewOpenCount || 0);
  const planningHealthStatus = String(dashboardPlanningWatch?.health?.status || dashboardPlanningWatch?.health?.label || "").toLowerCase();
  const planningAtRisk = /fragile|at_risk|at risk|critical/.test(planningHealthStatus);
  const planningNeedsReview = /needs_review|needs review/.test(planningHealthStatus);
  const planningOnWatch = planningAtRisk || planningNeedsReview || /watch/.test(planningHealthStatus);
  const planningStatusLabel = planningAtRisk ? "At risk" : planningNeedsReview ? "Needs review" : "Watch";
  const planningConcern = formatDashboardPlanningConcern(dashboardPlanningWatch?.health?.primaryConcern || dashboardPlanningWatch?.rows?.[0]?.detail || "Review current assumptions before relying on projections.");
  const taxPackageReady = taxReadinessSummary?.status === "ready";
  const taxPackageStatus = taxPackageReady ? "Ready" : openTaxReviewCount > 0 ? "Preliminary" : "In progress";
  const actionRows = [
    openTaxReviewCount > 0 ? { Icon: AlertTriangle, label: "Open tax review items", value: openTaxReviewCount, onClick: seeAllNeedsReview, actionLabel: "Open Tax Review", tone: "bg-amber-50 text-amber-800", recommendation: "Resolve open tax review items", detail: "Clear source-record issues before relying on Schedule E estimates." } : null,
    planningOnWatch ? { Icon: ChartNoAxesCombined, label: "Planning status", rowDetail: planningConcern, value: planningStatusLabel, onClick: () => openPlanningWorkspace("overview"), actionLabel: "Go to Planning", tone: planningAtRisk ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700", recommendation: "Review the working plan", detail: "Update assumptions before relying on projections." } : null,
    setupOpenCount > 0 ? { Icon: ListChecks, label: "Setup items", value: setupOpenCount, onClick: () => navigateWithDashboardContext("settings"), actionLabel: "Open settings", tone: "bg-blue-50 text-blue-700", recommendation: "Finish the remaining setup items", detail: "Complete required records to improve dashboard reliability." } : null,
    upcomingLeaseCount > 0 ? { Icon: CalendarClock, label: "Lease expirations (120 days)", value: upcomingLeaseCount, onClick: seeAllLeases, actionLabel: "Manage leases", tone: "bg-blue-50 text-blue-700", recommendation: "Review upcoming lease expirations", detail: "Confirm renewals, notice dates, and turnover plans." } : null,
    openMaintenanceCount > 0 ? { Icon: Wrench, label: "Open maintenance", value: openMaintenanceCount, onClick: () => navigateWithDashboardContext("maintenance"), actionLabel: "Open maintenance", tone: "bg-blue-50 text-blue-700", recommendation: "Review open maintenance work", detail: "Confirm owners, due dates, and next actions for active work orders." } : null,
    { Icon: FileCheck2, label: "Tax package", value: taxPackageStatus, onClick: seeAllNeedsReview, actionLabel: "Open Tax Review", tone: taxPackageReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700", ...(!taxPackageReady && openTaxReviewCount === 0 ? { recommendation: "Review the tax package", detail: "Confirm remaining source records before treating Schedule E estimates as final." } : {}) },
  ].filter(Boolean);
  const clearAreas = [upcomingLeaseCount === 0 ? "leases" : null, openMaintenanceCount === 0 ? "maintenance" : null].filter(Boolean);
  const allClearLabel = clearAreas.length ? `All clear: ${clearAreas.join(" and ")}` : "";
  const healthyAction = {
    recommendation: "Keep records current",
    detail: "Continue categorizing transactions monthly.",
    actionLabel: "Open ledger",
    onClick: seeAllTransactions,
  };

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
        {dashboardStatCards.map((card) => (
          <Stat
            key={card.id}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            trend={card.trend}
            icon={card.icon}
            onClick={() => navigateWithDashboardContext(card.nextView)}
          />
        ))}
        {dashboardStatCards.length === 0 && (
          <Card className="shadow-none md:col-span-2 xl:col-span-6">
            <CardContent className="p-4 text-sm text-slate-500">No dashboard metric cards selected. Enable cards in Settings.</CardContent>
          </Card>
        )}
      </div>

      <div className="grid items-start gap-2.5 xl:grid-cols-[.9fr_1.1fr_1fr]">
        <CashflowPanel cashflowSummary={cashflowSummary} currency={currency} monthMode={cashflowMonthMode} onMonthModeChange={setCashflowMonthMode} seeAllTransactions={seeAllTransactions} />
        <RentCollectionPanel currency={currency} rentSummary={rentSummary} seeAllLeases={seeAllLeases} />
        <ActionCenter actionStatus={actionStatus} allClearLabel={allClearLabel} healthyAction={healthyAction} rows={actionRows} />
      </div>

      <SetupChecklistPanel
        navigateWithDashboardContext={navigateWithDashboardContext}
        setupChecklist={setupChecklist}
        setupChecklistShowDismissed={setupChecklistShowDismissed}
        setupChecklistShowFull={setupChecklistShowFull}
        toggleSetupChecklistDismissed={toggleSetupChecklistDismissed}
        toggleSetupChecklistItemOverride={toggleSetupChecklistItemOverride}
        toggleSetupChecklistShowDismissed={toggleSetupChecklistShowDismissed}
        toggleSetupChecklistShowFull={toggleSetupChecklistShowFull}
      />

      <div className="grid items-start gap-2.5 border-t border-slate-200/70 pt-2.5 xl:grid-cols-2">
        <RecentTransactionsPanel currency={currency} dashboardDensity={dashboardDensity} dashboardTransactions={dashboardTransactions} documents={documents} openTransaction={openTransaction} prefetchTransactionDialog={prefetchTransactionDialog} propertyNameById={propertyNameById} seeAllTransactions={seeAllTransactions} transactionReviewById={transactionReviewById} />
        <PropertySnapshotPanel currency={currency} dashboardOpenReviewItems={dashboardOpenReviewItems} dashboardPropertySnapshot={dashboardPropertySnapshot} openPropertyFromSnapshot={openPropertyFromSnapshot} rentSummary={rentSummary} seeAllProperties={seeAllProperties} />
      </div>
    </div>
  );
}
