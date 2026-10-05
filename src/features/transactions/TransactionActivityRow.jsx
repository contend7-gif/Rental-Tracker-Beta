import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { formatRentReportingMonth, formatTransactionUnitLabel, getTransactionVisual, transactionReconciliationStatusLabel, transactionSupportStatusLabel, transactionPostingStatusLabel } from "./transactionPresentation.js";

export function TransactionActivityRow({ transaction, review, documentCount, propertyLabel, todayIso, currency, onOpen, onPrefetch }) {
  const { Icon, iconClass, amountClass } = getTransactionVisual(transaction);
  const issues = review?.issues || [];
  const rentMonth = formatRentReportingMonth(transaction);
  const posting = transactionPostingStatusLabel(transaction, todayIso);
  return <div className="rt-transaction-activity-row rounded-lg border border-slate-200 bg-white p-3 transition hover:border-teal-200 hover:bg-teal-50/30">
    <div className="flex min-w-0 items-start gap-2">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconClass}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0">
        <button type="button" className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-teal-700" onClick={() => onOpen(transaction, "ledger", false)} onMouseEnter={onPrefetch} onFocus={onPrefetch} title={transaction.description || transaction.vendor}>{transaction.description || transaction.vendor || "Transaction"}</button>
        <div className="mt-0.5 truncate text-xs text-slate-500">{[transaction.vendor || transaction.paidFrom, transaction.date, propertyLabel, formatTransactionUnitLabel(transaction.unit)].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
    <div className="min-w-0 text-xs text-slate-600">
      <div className="truncate font-medium text-slate-800">{transaction.category || "Uncategorized"}</div>
      <div className="mt-1">{rentMonth || transactionReconciliationStatusLabel(transaction, todayIso)}</div>
    </div>
    <div className="flex min-w-0 flex-col items-start gap-1 text-xs">
      {issues.length ? <button type="button" className="text-left font-medium text-amber-700 hover:underline" onClick={() => onOpen(transaction, "ledger", false, issues[0].key)} title={issues.map((issue) => issue.label).join("; ")}>{issues.length} check{issues.length === 1 ? "" : "s"} · {issues[0].label}</button> : <span className="text-slate-500">{transactionSupportStatusLabel(transaction, { documentCount, missingReceipt: false })}</span>}
      {posting !== "Posted" ? <Badge variant="secondary" className="mt-1 block w-fit border-amber-200 bg-amber-50 text-amber-800">{posting}</Badge> : null}
    </div>
    <div className="flex items-center justify-end gap-3">
      <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === "Expense" ? "text-rose-700" : amountClass}`}>{currency(transaction.amount)}</span>
      <Button size="sm" variant="secondary" onClick={() => onOpen(transaction, "ledger", false)}>Open</Button>
    </div>
  </div>;
}
