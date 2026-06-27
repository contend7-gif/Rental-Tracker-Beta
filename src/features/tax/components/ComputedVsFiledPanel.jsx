import React from "react";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { ResponsiveTableFrame } from "../../shared/uiHelpers.jsx";

export function ComputedVsFiledPanel({
  carryoverScope,
  currency,
  rows = [],
  setTaxFiledAmountOverrideNote,
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Computed vs filed</div>
          <div className="mt-1 text-xs text-slate-500">Filed amounts stay separate from source records; notes explain material differences.</div>
        </div>
        <Badge variant="secondary">{rows.filter((row) => row.status === "needs_note").length} need notes</Badge>
      </div>
      <ResponsiveTableFrame className="mt-2" minWidthClass="min-w-[760px]" hint="Swipe to compare computed source totals with filed or override amounts.">
        <table className="min-w-full text-xs">
          <thead className="bg-white text-slate-600">
            <tr>
              <th className="px-2 py-1 text-left">Line</th>
              <th className="px-2 py-1 text-right">Computed</th>
              <th className="px-2 py-1 text-right">Filed / override</th>
              <th className="px-2 py-1 text-right">Difference</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`computed-filed-${row.field}`} className="border-t border-slate-100">
                <td className="px-2 py-1 font-medium text-slate-900">{row.label}</td>
                <td className="px-2 py-1 text-right">{currency(row.computedAmount)}</td>
                <td className="px-2 py-1 text-right">{row.filedAmount == null ? "-" : currency(row.filedAmount)}</td>
                <td className="px-2 py-1 text-right">{currency(row.difference || 0)}</td>
                <td className="px-2 py-1">
                  <Badge variant={row.status === "needs_note" ? "secondary" : "outline"} className={row.status === "needs_note" ? "!bg-amber-100 !text-amber-800" : row.status === "difference" ? "!bg-blue-50 !text-blue-700" : "!bg-emerald-50 !text-emerald-700"}>
                    {row.status === "needs_note" ? "Needs note" : row.status === "difference" ? "Difference" : "Match"}
                  </Badge>
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-8 min-w-[180px]"
                    value={row.note || ""}
                    placeholder={row.status === "needs_note" ? "Explain difference" : "Optional note"}
                    onChange={(event) => setTaxFiledAmountOverrideNote?.(carryoverScope, row.filedField || row.field, event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableFrame>
    </div>
  );
}
