import React from "react";

export function PlanningUtilityBillComparisons({ comparisons = [], currency, formatPropertyLabel }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-none" aria-label="Utility bill comparisons">
    <div className="font-medium text-slate-900">Expected vs recorded utilities</div>
    <p className="mt-1 text-xs text-slate-600">Latest three months of recorded provider totals, compared with earlier months. Above-estimate spending reduces cash available for that month. These recorded expenses are not added again to future forecasts; saved planning assumptions still apply.</p>
    <div className="mt-3 max-h-96 space-y-2 overflow-y-auto" role="region" aria-label="Utility comparisons list" tabIndex={0}>
      {!comparisons.length ? <p className="text-xs text-slate-500">No recent utility entries with a provider to compare. Add a provider to recorded utility expenses to build a history.</p> : comparisons.map(item => <article key={item.id} className={`rounded-lg border p-3 text-xs ${item.flagged && !item.explained ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50/70"}`}>
        <div className="flex flex-wrap justify-between gap-2 font-medium text-slate-900"><span>{item.vendor} · {item.month}{item.currentMonth ? " to date" : ""}</span><span>{item.explained ? "Amount explained" : item.flagged ? "Review amount in Calendar" : item.expected === undefined ? "Insufficient history" : item.confidence === "limited" ? "Limited history" : "No amount alert"}</span></div>
        <div className="mt-1 text-slate-500">{formatPropertyLabel(item.propertyId)} · {item.unit}</div>
        <div className="mt-2">Recorded {currency(item.actual)}{item.expected !== undefined ? `; expected ${currency(item.expected)}; ${currency(Math.abs(item.difference))} ${item.difference >= 0 ? "above" : "below"} estimate.` : "; estimate unavailable."}</div>
        {item.expected !== undefined ? <div className="mt-1">Planning range: {currency(item.low)}–{currency(item.high)}.</div> : null}
        <details className="mt-2 text-slate-600"><summary className="cursor-pointer">Comparison basis and entries</summary>
          <p className="mt-2">{item.basis} {item.currentMonth ? "This month is incomplete; more bills or credits may be recorded." : "Totals reflect recorded entries, which may not include every bill."} Estimates are spending allowances, not proof of payment or bank reconciliation.</p>
          <div className="mt-2 font-medium">Recorded this month</div>
          <ul>{item.records.map(record => <li key={record.id}>{record.date}: {currency(record.amount)}</li>)}</ul>
          {item.supportingRecords.length ? <><div className="mt-2 font-medium">Earlier supporting entries</div><ul>{item.supportingRecords.map(record => <li key={record.id}>{record.date}: {currency(record.amount)}</li>)}</ul></> : null}
        </details>
      </article>)}
    </div>
  </section>;
}
