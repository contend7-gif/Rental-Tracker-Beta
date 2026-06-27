import React from "react";

import { Badge } from "@/components/ui/badge";

export function PlanningScenarioProbabilityPanel({
  range,
  diffRows,
  baselineName,
  currency,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Diff + probability view</div>
          <div className="mt-1 text-xs text-slate-500">Baseline plus conservative/base/growth bands.</div>
        </div>
        <Badge variant="outline">{baselineName}</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
          <div className="text-xs uppercase tracking-wide text-rose-700">Downside cash flow</div>
          <div className="mt-1 text-base font-semibold text-rose-900">{currency(range.downsideCashFlow)}</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
          <div className="text-xs uppercase tracking-wide text-blue-700">Base cash flow</div>
          <div className="mt-1 text-base font-semibold text-blue-900">{currency(range.baseCashFlow)}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Upside cash flow</div>
          <div className="mt-1 text-base font-semibold text-emerald-900">{currency(range.upsideCashFlow)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          <div className="uppercase tracking-wide text-slate-500">NOI band</div>
          <div className="mt-1 font-semibold text-slate-900">{currency(range.downsideNoi)} to {currency(range.upsideNoi)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          <div className="uppercase tracking-wide text-slate-500">Equity band</div>
          <div className="mt-1 font-semibold text-slate-900">{currency(range.downsideEquity)} to {currency(range.upsideEquity)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          <div className="uppercase tracking-wide text-slate-500">Compare baseline</div>
          <div className="mt-1 font-semibold text-slate-900">{baselineName}</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {diffRows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">No meaningful differences from the selected baseline yet.</div>
        ) : (
          diffRows.slice(0, 8).map((row) => (
            <div key={`planning-diff-${row.field}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.field}</div>
              <div className="mt-1 text-xs text-slate-600">{row.baselineValue} {"->"} <span className="font-medium text-slate-900">{row.scenarioValue}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
