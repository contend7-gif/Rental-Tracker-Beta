import React from "react";

import { Badge } from "@/components/ui/badge";

export function PlanningScenarioTimelineComparePanel({
  rows,
  comparisons,
  dashboard,
  sensitivityRows,
  months,
  TableFrame,
  currency,
}) {
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.05fr,0.95fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Scenario timeline compare</div>
            <div className="mt-1 text-xs text-slate-500">Monthly cash-flow and rent comparison.</div>
          </div>
          <Badge variant="outline">{months} months</Badge>
        </div>
        <TableFrame className="mt-3" minWidthClass="min-w-[760px]" hint="Swipe to compare monthly differences across scenarios.">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-1 text-left">Month</th>
                {comparisons.slice(0, 3).map((scenario) => (
                  <th key={`planning-timeline-head-${scenario.key}`} className="px-2 py-1 text-right">{scenario.label} cash flow</th>
                ))}
                <th className="px-2 py-1 text-right">Spread</th>
                <th className="px-2 py-1 text-left">Drivers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`planning-timeline-row-${row.month}`} className="border-t border-slate-100">
                  <td className="px-2 py-2 text-slate-900">{row.month}</td>
                  {row.cells.map((cell) => (
                    <td key={`planning-timeline-cell-${row.month}-${cell.key}`} className={`px-2 py-2 text-right font-medium ${cell.cashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {currency(cell.cashFlow)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right text-slate-900">{currency(row.deltaCashFlow)}</td>
                  <td className="px-2 py-2 text-slate-500">
                    {row.cells.filter((cell) => cell.driverLabel).map((cell) => `${cell.label}: ${cell.driverLabel}`).join(" | ") || "No major driver shift"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Confidence + sensitivity</div>
            <div className="mt-1 text-xs text-slate-500">Confidence and sensitivity.</div>
          </div>
          <Badge variant="secondary">{dashboard.confidence.label}</Badge>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Confidence read</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{dashboard.confidence.label}</div>
          <div className="mt-1 text-xs text-slate-500">{dashboard.confidence.detail}</div>
        </div>
        <div className="mt-3 space-y-2">
          {sensitivityRows.map((row) => (
            <div key={`planning-sensitivity-${row.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.adjustmentLabel}</div>
                </div>
                <Badge variant={row.direction === "negative" ? "destructive" : "outline"}>
                  {row.direction === "negative" ? "Downside" : "Upside"}
                </Badge>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-600">
                <div>Cash flow <span className={`font-medium ${row.deltaCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.deltaCashFlow)}</span></div>
                <div>NOI <span className={`font-medium ${row.deltaNoi >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.deltaNoi)}</span></div>
                <div>End equity <span className={`font-medium ${row.deltaEquity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(row.deltaEquity)}</span></div>
              </div>
              <div className="mt-1 text-xs text-slate-500">{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlanningScenarioAuditNarrative({
  auditRows,
  diffRows,
  baselineName,
}) {
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[0.95fr,1.05fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Assumption audit</div>
            <div className="mt-1 text-xs text-slate-500">Model inputs.</div>
          </div>
          <Badge variant="outline">{auditRows.length} rows</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {auditRows.map((row) => (
            <div key={`planning-audit-${row.category}-${row.label}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{row.category}</div>
                  <div className="text-sm font-medium text-slate-900">{row.label}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">{row.value}</div>
              </div>
              {row.note ? <div className="mt-1 text-xs text-slate-500">{row.note}</div> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Narrative compare</div>
            <div className="mt-1 text-xs text-slate-500">Working plan vs baseline.</div>
          </div>
          <Badge variant="outline">{baselineName}</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {diffRows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">
              Current workspace is materially aligned with {baselineName} right now.
            </div>
          ) : (
            diffRows.slice(0, 10).map((row) => (
              <div key={`planning-narrative-diff-${row.field}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-sm font-semibold text-slate-900">{row.field}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {baselineName}: <span className="font-medium text-slate-900">{row.baselineValue}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Current workspace: <span className="font-medium text-slate-900">{row.scenarioValue}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function PlanningScenarioComparePanel({ scenarios, TableFrame, currency }) {
  const maxCashFlow = Math.max(1, ...scenarios.map((scenario) => Math.abs(scenario.summary.firstYearCashFlow || 0)));
  const maxNoi = Math.max(1, ...scenarios.map((scenario) => Math.abs(scenario.summary.firstYearNetOperatingIncome || 0)));
  const maxEquity = Math.max(1, ...scenarios.map((scenario) => Math.abs(scenario.summary.horizonEndingEquity || 0)));

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scenario compare</div>
          <div className="mt-1 text-xs text-slate-500">Current, saved, and base views.</div>
        </div>
        <Badge variant="outline">{scenarios.length} views</Badge>
      </div>
      <TableFrame className="mt-3" minWidthClass="min-w-[700px]" hint="Swipe to compare saved and current planning views.">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1 text-left">Scenario</th>
              <th className="px-2 py-1 text-left">Scope</th>
              <th className="px-2 py-1 text-right">Year-1 NOI</th>
              <th className="px-2 py-1 text-right">Year-1 cash flow</th>
              <th className="px-2 py-1 text-right">End equity</th>
              <th className="px-2 py-1 text-right">Reserve</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={`planning-compare-${scenario.key}`} className="border-t border-slate-100">
                <td className="px-2 py-2">
                  <div className="font-medium text-slate-900">{scenario.label}</div>
                  {scenario.notes ? <div className="mt-1 text-[11px] text-slate-500">{scenario.notes}</div> : null}
                </td>
                <td className="px-2 py-2 text-slate-600">{scenario.scopeLabel}</td>
                <td className="px-2 py-2 text-right text-slate-900">{currency(scenario.summary.firstYearNetOperatingIncome)}</td>
                <td className={`px-2 py-2 text-right font-medium ${scenario.summary.firstYearCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(scenario.summary.firstYearCashFlow)}</td>
                <td className="px-2 py-2 text-right text-slate-900">{currency(scenario.summary.horizonEndingEquity)}</td>
                <td className="px-2 py-2 text-right text-slate-600">{currency(Number(scenario.assumptions.monthlyCapexReserve || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {scenarios.map((scenario) => (
          <div key={`planning-chart-${scenario.key}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-sm font-medium text-slate-900">{scenario.label}</div>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span>Cash flow</span>
                  <span className={scenario.summary.firstYearCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}>{currency(scenario.summary.firstYearCashFlow)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-200">
                  <div className={`h-2 rounded-full ${scenario.summary.firstYearCashFlow >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${Math.max(6, Math.round((Math.abs(scenario.summary.firstYearCashFlow || 0) / maxCashFlow) * 100))}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span>NOI</span>
                  <span className="text-slate-900">{currency(scenario.summary.firstYearNetOperatingIncome)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.max(6, Math.round((Math.abs(scenario.summary.firstYearNetOperatingIncome || 0) / maxNoi) * 100))}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span>End equity</span>
                  <span className="text-slate-900">{currency(scenario.summary.horizonEndingEquity)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(6, Math.round((Math.abs(scenario.summary.horizonEndingEquity || 0) / maxEquity) * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
