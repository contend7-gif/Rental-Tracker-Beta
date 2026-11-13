import React from "react";
import { Badge } from "../../../components/ui/badge";
import { buildYearEndChecklist } from "../yearEndChecklist.js";

export function YearEndChecklistPanel({ onAction, ...context }) {
  const checklist = buildYearEndChecklist(context);
  return (
    <section aria-label="Year-end tax checklist" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Year-end tax checklist</h2>
      <p className="mt-1 text-sm text-slate-600">Receipt support, payment verification, and tax review are separate checks. Waiting items remain open and do not count as tax ready.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {[
          { key: "now", title: "Resolve now", rows: checklist.resolveNow, empty: "No current cleanup items found in this scope." },
          { key: "waiting", title: "Awaiting annual documents", rows: checklist.awaitingDocuments, empty: checklist.beforeYearEnd ? "No outstanding annual-document items identified." : "For a completed tax year, outstanding annual-document reviews appear under Resolve now." },
        ].map((group) => (
          <div key={group.key} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
            {group.rows.length ? <div className="mt-2 space-y-2">{group.rows.map((row) => (
              <button type="button" key={row.key} onClick={() => onAction(row.action)} className="flex w-full items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{row.label}</span><span className="mt-1 block text-xs text-slate-600">{row.helper}</span></span>
                <Badge variant="secondary">{row.count}</Badge>
              </button>
            ))}</div> : <p className="mt-2 text-xs text-slate-500">{group.empty}</p>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Counts describe checks and may overlap. Mileage uses trip records rather than a cash-payment match.</p>
    </section>
  );
}
