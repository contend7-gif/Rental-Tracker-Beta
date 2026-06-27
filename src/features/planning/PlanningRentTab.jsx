import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUnitLabel } from "../../domain/unitLabels.js";

export function PlanningRentTab({
  rentStrategy,
  turnoverPlanner,
  getRentStrategy,
  getTurnoverInput,
  onApplyTargetRent,
  onUpdateRentStrategy,
  onUpdateTurnoverInput,
  renderField,
  currency,
  toPctDisplay,
}) {
  const unitUseLabel = (status) => (/owner/i.test(String(status || "")) ? "Owner-occupied hypothetical" : "Live rental unit");
  const unitUseClass = (status) => (/owner/i.test(String(status || ""))
    ? "border-blue-200 bg-blue-50/70 text-blue-900"
    : "border-emerald-200 bg-emerald-50/70 text-emerald-900");

  return (
    <>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Rent strategy</div>
            <div className="mt-1 text-xs text-slate-500">Market and target rents by unit.</div>
          </div>
          <Badge variant="secondary">{rentStrategy.summary.pricedUnitCount} priced</Badge>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Annual upside</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{currency(rentStrategy.summary.totalAnnualUpside)}</div>
            <div className="mt-1 text-xs text-slate-500">Includes owner-occupied hypotheticals when target rent is modeled.</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Avg increase</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{toPctDisplay(rentStrategy.summary.averageIncreasePct)}</div>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {rentStrategy.rows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">No rentable units are available in this scope yet.</div>
          ) : (
            rentStrategy.rows.map((row) => {
              const strategy = getRentStrategy(row.propertyId, row.unit);
              const ownerOccupied = /owner/i.test(String(row.currentStatus || ""));
              return (
                <div key={`planning-rent-strategy-${row.propertyId}-${row.unit}`} className={`rounded-lg border p-3 ${ownerOccupied ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/80"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{row.propertyName} | {formatUnitLabel(row.unit)}</div>
                        <Badge variant="outline" className={unitUseClass(row.currentStatus)}>{unitUseLabel(row.currentStatus)}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Current {currency(row.currentRent)} | Market {currency(row.marketRent)} | Target {currency(row.targetRent)} | Upside {currency(row.annualizedUpside)}/yr</div>
                      {ownerOccupied ? (
                        <div className="mt-1 text-xs text-blue-800">Not in the current rent roll unless converted to a rental or scenario override.</div>
                      ) : null}
                    </div>
                    <Button size="sm" variant="secondary" className="h-7" onClick={() => onApplyTargetRent(row)}>
                      {ownerOccupied ? "Model conversion" : "Use target in override"}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {renderField("Market rent", <Input className="mt-1" type="number" step="0.01" value={strategy.marketRent} onChange={(e) => onUpdateRentStrategy(row.propertyId, row.unit, { marketRent: e.target.value })} />)}
                    {renderField("Target rent", <Input className="mt-1" type="number" step="0.01" value={strategy.targetRent} onChange={(e) => onUpdateRentStrategy(row.propertyId, row.unit, { targetRent: e.target.value })} />)}
                    {renderField("Renewal start", <Input className="mt-1" type="date" value={strategy.renewalStart} onChange={(e) => onUpdateRentStrategy(row.propertyId, row.unit, { renewalStart: e.target.value })} />)}
                    {renderField("Renewal term", <Input className="mt-1" type="number" step="1" value={strategy.renewalTermMonths} onChange={(e) => onUpdateRentStrategy(row.propertyId, row.unit, { renewalTermMonths: e.target.value })} />)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Vacancy / turnover planner</div>
            <div className="mt-1 text-xs text-slate-500">Make-ready, downtime, and concessions.</div>
          </div>
          <Badge variant="secondary">{turnoverPlanner.summary.pricedUnitCount} units</Badge>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Projected turnover cost</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{currency(turnoverPlanner.summary.totalProjectedCost)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Avg downtime</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{turnoverPlanner.summary.averageDowntimeDays} days</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Soonest turnover</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{turnoverPlanner.summary.soonestTurnoverDate || "Not scheduled"}</div>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {turnoverPlanner.rows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">Add rentable units or rent strategy assumptions to unlock turnover planning.</div>
          ) : (
            turnoverPlanner.rows.map((row) => {
              const turnover = getTurnoverInput(row.propertyId, row.unit);
              const isNext616 = String(row.unit).replace(/^unit\s+/i, "") === "616" && row.nextTurnoverDate === "2026-08-09";
              return (
                <div key={`planning-turnover-${row.propertyId}-${row.unit}`} className={`rounded-lg border p-3 ${isNext616 ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50/80"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{row.propertyName} | {formatUnitLabel(row.unit)}</div>
                        {isNext616 ? <Badge variant="secondary">Next tracked milestone</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Rent {currency(row.monthlyRent)} | Next turnover {row.nextTurnoverDate || "n/a"} | Recovery {row.recoveryMonths.toFixed(1)} months</div>
                    </div>
                    <Badge variant="outline">{currency(row.totalTurnoverCost)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-5">
                    {renderField("Make-ready", <Input className="mt-1" type="number" step="0.01" value={turnover.makeReadyCost} onChange={(e) => onUpdateTurnoverInput(row.propertyId, row.unit, { makeReadyCost: e.target.value })} />)}
                    {renderField("Downtime days", <Input className="mt-1" type="number" step="1" value={turnover.downtimeDays} onChange={(e) => onUpdateTurnoverInput(row.propertyId, row.unit, { downtimeDays: e.target.value })} />)}
                    {renderField("Leasing fee %", <Input className="mt-1" type="number" step="0.1" value={turnover.leasingFeePct} onChange={(e) => onUpdateTurnoverInput(row.propertyId, row.unit, { leasingFeePct: e.target.value })} />)}
                    {renderField("Concession weeks", <Input className="mt-1" type="number" step="0.5" value={turnover.concessionWeeks} onChange={(e) => onUpdateTurnoverInput(row.propertyId, row.unit, { concessionWeeks: e.target.value })} />)}
                    {renderField("Notes", <Input className="mt-1" value={turnover.notes} onChange={(e) => onUpdateTurnoverInput(row.propertyId, row.unit, { notes: e.target.value })} />)}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-2">Lost rent <span className="font-medium text-slate-900">{currency(row.lostRent)}</span></div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2">Leasing fee <span className="font-medium text-slate-900">{currency(row.leasingFeeCost)}</span></div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2">Concession <span className="font-medium text-slate-900">{currency(row.concessionCost)}</span></div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2">Total <span className="font-medium text-slate-900">{currency(row.totalTurnoverCost)}</span></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
