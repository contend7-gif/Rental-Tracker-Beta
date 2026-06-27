import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlanningNotesPanel({ horizonMonths, horizonCashFlow }) {
  const cashFlowPositive = horizonCashFlow >= 0;

  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Planning notes</div>
      <div className="mt-2 space-y-2 text-xs text-slate-600">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Current values use each property&apos;s saved current value when available, with purchase price as the fallback.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Debt service follows current and future mixed-use rental share, so owner-occupancy changes flow into the forecast automatically.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Future rent is driven by signed leases first. Growth and vacancy assumptions then adjust that baseline rather than replacing it.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Utilities-included leases can add a forecast utility burden from recent utility history, instead of waiting for a full trailing year to catch up.
        </div>
        <div className={`rounded-lg border p-2 ${cashFlowPositive ? "border-emerald-200 bg-emerald-50/70 text-emerald-900" : "border-rose-200 bg-rose-50/70 text-rose-900"}`}>
          {cashFlowPositive
            ? `Positive cash flow over ${horizonMonths} months.`
            : `Negative cash flow over ${horizonMonths} months.`}
        </div>
      </div>
    </div>
  );
}

export function PlanningForecastMonthlyOutlook({ rows, TableFrame, mutedPanelClass, currency }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalCashFlow = safeRows.reduce((sum, row) => sum + Number(row.cashFlow || 0), 0);
  const averageCashFlow = totalCashFlow / Math.max(1, safeRows.length);
  const worstMonth = safeRows.slice().sort((left, right) => Number(left.cashFlow || 0) - Number(right.cashFlow || 0))[0] || null;
  const endingEquity = safeRows[safeRows.length - 1]?.projectedEquity || 0;
  const largestDriver = safeRows.find((row) => row.driverLabel && row.driverLabel !== "Signed leases + assumptions") || safeRows[0] || null;

  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Projected monthly outlook</div>
      <div className="mt-1 text-xs text-slate-500">Monthly rent, occupancy, debt, and reserve drivers.</div>
      {safeRows.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-500">
          No forecast rows yet. Set a planning horizon and confirm the property scope to generate the month-by-month forecast.
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ForecastSummaryCard label="Worst month" value={worstMonth ? `${worstMonth.month} ${currency(worstMonth.cashFlow)}` : "n/a"} tone={Number(worstMonth?.cashFlow || 0) < 0 ? "risk" : "neutral"} />
          <ForecastSummaryCard label="Avg monthly cash flow" value={currency(averageCashFlow)} tone={averageCashFlow < 0 ? "risk" : "good"} />
          <ForecastSummaryCard label="Total cash flow" value={currency(totalCashFlow)} tone={totalCashFlow < 0 ? "risk" : "good"} />
          <ForecastSummaryCard label="Ending equity" value={currency(endingEquity)} tone="neutral" />
          <ForecastSummaryCard label="Largest driver" value={largestDriver?.driverLabel || "Signed leases"} tone="neutral" />
        </div>
      )}
      <TableFrame
        className="mt-2"
        minWidthClass="min-w-[1120px]"
        hint="Swipe to compare rent, expenses, debt, reserve, cash flow, equity, and the forecast driver by month."
        mobileCards={safeRows.map((row) => (
          <div key={`planning-card-${row.month}`} className={mutedPanelClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-900">{row.month}</div>
              <div className={`text-sm font-semibold ${row.cashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.cashFlow)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>Eff. rent: <span className="font-medium text-slate-900">{currency(row.effectiveRent)}</span></div>
              <div>OpEx: <span className="font-medium text-slate-900">{currency(row.operatingExpenses)}</span></div>
              {Math.abs(Number(row.utilityIncludedAdjustment || 0)) >= 0.01 && (
                <div>Utilities adj.: <span className="font-medium text-slate-900">{currency(row.utilityIncludedAdjustment)}</span></div>
              )}
              <div>Debt: <span className="font-medium text-slate-900">{currency(row.debtService)}</span></div>
              <div>Reserve: <span className="font-medium text-slate-900">{currency(row.capexReserve)}</span></div>
              <div>NOI: <span className="font-medium text-slate-900">{currency(row.netOperatingIncome)}</span></div>
              <div>Equity: <span className="font-medium text-slate-900">{currency(row.projectedEquity)}</span></div>
            </div>
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
              <div className="font-medium text-slate-900">{row.driverLabel || "Signed leases + assumptions"}</div>
              <div className="mt-1">{row.driverDetail || "Monthly forecast follows the current planning inputs."}</div>
            </div>
          </div>
        ))}
      >
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-2 py-1 text-left">Month</th>
              <th className="px-2 py-1 text-right">Scheduled rent</th>
              <th className="px-2 py-1 text-right">Vacancy loss</th>
              <th className="px-2 py-1 text-right">Effective rent</th>
              <th className="px-2 py-1 text-right">OpEx</th>
              <th className="px-2 py-1 text-right">NOI</th>
              <th className="px-2 py-1 text-right">Debt service</th>
              <th className="px-2 py-1 text-right">CapEx reserve</th>
              <th className="px-2 py-1 text-right">Cash flow</th>
              <th className="px-2 py-1 text-right">Equity</th>
              <th className="px-2 py-1 text-left">Driver</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row) => (
              <tr key={`planning-row-${row.month}`} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white px-2 py-1 font-medium text-slate-900">{row.month}</td>
                <td className="px-2 py-1 text-right text-slate-900">{currency(row.scheduledRent)}</td>
                <td className="px-2 py-1 text-right text-rose-700">{currency(row.vacancyLoss)}</td>
                <td className="px-2 py-1 text-right text-emerald-700">{currency(row.effectiveRent)}</td>
                <td className="px-2 py-1 text-right text-rose-700">
                  <div>{currency(row.operatingExpenses)}</div>
                  {Math.abs(Number(row.utilityIncludedAdjustment || 0)) >= 0.01 && (
                    <div className="text-[11px] font-normal text-slate-500">
                      {row.utilityIncludedAdjustment > 0 ? "+" : ""}{currency(row.utilityIncludedAdjustment)} utilities
                    </div>
                  )}
                </td>
                <td className={`px-2 py-1 text-right font-medium ${row.netOperatingIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.netOperatingIncome)}</td>
                <td className="px-2 py-1 text-right text-rose-700">{currency(row.debtService)}</td>
                <td className="px-2 py-1 text-right text-rose-700">{currency(row.capexReserve)}</td>
                <td className={`px-2 py-1 text-right font-semibold ${row.cashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.cashFlow)}</td>
                <td className="px-2 py-1 text-right text-slate-900">{currency(row.projectedEquity)}</td>
                <td className="px-2 py-1 align-top">
                  <div className="font-medium text-slate-900">{row.driverLabel || "Signed leases + assumptions"}</div>
                  <div className="mt-0.5 text-slate-500">{row.driverDetail || "Monthly forecast follows the current planning inputs."}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}

function ForecastSummaryCard({ label, tone, value }) {
  const toneClass = tone === "risk"
    ? "border-rose-200 bg-rose-50/70 text-rose-900"
    : tone === "good"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : "border-slate-200 bg-slate-50/80 text-slate-900";

  return (
    <div className={`rounded-lg border p-2 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

export function PlanningForecastSetupPanel({ forecastOptions, onForecastOptionsChange, onOpenSubtab, renderField }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Forecast setup</div>
          <div className="mt-1 text-xs text-slate-500">Lease-only or re-rent forecast mode.</div>
        </div>
        <Badge variant={forecastOptions.assumeRerentAfterTurnover ? "secondary" : "outline"}>
          {forecastOptions.assumeRerentAfterTurnover ? "Assumed re-rent on" : "Signed leases only"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {renderField(
          "Future lease handling",
          <Select
            value={forecastOptions.assumeRerentAfterTurnover ? "assume_rerent" : "signed_only"}
            onValueChange={(value) => onForecastOptionsChange((prev) => ({
              ...prev,
              assumeRerentAfterTurnover: value === "assume_rerent",
            }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assume_rerent">Assume re-rent after turnover</SelectItem>
              <SelectItem value="signed_only">Only signed leases</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {forecastOptions.assumeRerentAfterTurnover && renderField(
          "Re-rent rent source",
          <Select
            value={forecastOptions.rerentRentSource}
            onValueChange={(value) => onForecastOptionsChange((prev) => ({ ...prev, rerentRentSource: value }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="target">Rent tab target rent</SelectItem>
              <SelectItem value="market">Rent tab market rent</SelectItem>
              <SelectItem value="current">Last/current signed rent</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {forecastOptions.assumeRerentAfterTurnover && renderField(
          "Assumed term (months)",
          <Input
            className="mt-1"
            type="number"
            min="1"
            step="1"
            value={forecastOptions.rerentTermMonths}
            onChange={(e) => onForecastOptionsChange((prev) => ({ ...prev, rerentTermMonths: e.target.value }))}
          />,
        )}
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-600">
        {forecastOptions.assumeRerentAfterTurnover
          ? "Downtime days and target rent come from the Rent tab. Forecast-only re-rents never change live leases or occupancy."
          : "The forecast will let rent fall dark after the last signed lease unless you add a scenario event or override."}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenSubtab("rent")}>Open Rent tab</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenSubtab("scenarios")}>Open Scenarios tab</Button>
      </div>
    </div>
  );
}

export function PlanningForecastPortfolioSnapshotPanel({ snapshots, TableFrame, mutedPanelClass, currency, toPctDisplay }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Portfolio snapshot</div>
      <div className="mt-1 text-xs text-slate-500">Values, debt, rent, and rental-use share.</div>
      <TableFrame className="mt-2" minWidthClass="min-w-[620px]" hint="Swipe to compare properties." mobileCards={snapshots.map((row) => (
        <div key={`planning-property-card-${row.propertyId}`} className={mutedPanelClass}>
          <div className="text-sm font-medium text-slate-900">{row.propertyName}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>Equity: <span className="font-medium text-slate-900">{currency(row.currentEquity)}</span></div>
            <div>Rent roll: <span className="font-medium text-slate-900">{currency(row.currentMonthlyRent)}</span></div>
            <div>Debt: <span className="font-medium text-slate-900">{currency(row.adjustedMonthlyDebtService)}</span></div>
            <div>Rental share: <span className="font-medium text-slate-900">{toPctDisplay(row.currentRentalUsePct)}</span></div>
          </div>
        </div>
      ))}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1 text-left">Property</th>
              <th className="px-2 py-1 text-right">Value</th>
              <th className="px-2 py-1 text-right">Loan balance</th>
              <th className="px-2 py-1 text-right">Equity</th>
              <th className="px-2 py-1 text-right">Rent roll</th>
              <th className="px-2 py-1 text-right">Adj. debt</th>
              <th className="px-2 py-1 text-right">Rental share</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((row) => (
              <tr key={`planning-property-row-${row.propertyId}`} className="border-t border-slate-100">
                <td className="px-2 py-1">{row.propertyName}</td>
                <td className="px-2 py-1 text-right">{currency(row.currentMarketValue)}</td>
                <td className="px-2 py-1 text-right">{currency(row.currentLoanBalance)}</td>
                <td className="px-2 py-1 text-right font-medium">{currency(row.currentEquity)}</td>
                <td className="px-2 py-1 text-right">{currency(row.currentMonthlyRent)}</td>
                <td className="px-2 py-1 text-right">{currency(row.adjustedMonthlyDebtService)}</td>
                <td className="px-2 py-1 text-right">{toPctDisplay(row.currentRentalUsePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}

export function PlanningUpcomingChangesPanel({ changes }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Upcoming changes</div>
      <div className="mt-1 text-xs text-slate-500">Lease milestones and forecast changes.</div>
      <div className="mt-2 space-y-2">
        {changes.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900">No tracked lease or forecast changes fall inside this window. Keep the horizon current as new leases or scenario events are added.</div>
        ) : (
          changes.map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                </div>
                <Badge variant={item.source === "forecast" ? "secondary" : "outline"}>{item.badge}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
