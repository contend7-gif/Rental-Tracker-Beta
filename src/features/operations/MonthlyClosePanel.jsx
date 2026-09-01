import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, RotateCcw } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { buildMonthlyCloseReview } from "../../domain/monthlyClose.ts";
import { buildRecurringExpenseChecks } from "../../domain/recurringExpenseChecks.ts";
import { shiftCalendarMonth } from "../../domain/operationsMonth.ts";

function monthLabel(month) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`));
}

export function MonthlyClosePanel({
  appSettings,
  backupValidationResult,
  bankImportUnmatchedRows,
  currency,
  leases,
  loanPayments,
  loans,
  month,
  onMonthChange,
  onOpenIssue,
  persistenceHealth,
  propertyFilter,
  propertyNameById,
  recurringTemplates,
  setNotice,
  setSetting,
  tenantLedgerEntries,
  todayIso,
  transactions,
  workOrders,
}) {
  const recurringExpenseChecks = useMemo(() => buildRecurringExpenseChecks({
    acknowledgements: appSettings.recurringExpenseCheckAcknowledgements,
    recurringTemplates,
    todayIso,
    transactions,
  }), [appSettings.recurringExpenseCheckAcknowledgements, recurringTemplates, todayIso, transactions]);
  const backupStatus = backupValidationResult?.status || persistenceHealth?.lastBackupValidationStatus || "";
  const backupValidated = backupStatus === "valid" || backupStatus === "valid_with_warnings";
  const review = useMemo(() => buildMonthlyCloseReview({
    backupValidated,
    leases,
    loanPayments,
    loans,
    month,
    propertyFilter,
    recurringExpenseChecks,
    tenantLedgerEntries,
    todayIso,
    transactions,
    unmatchedBankImportCount: bankImportUnmatchedRows?.length || 0,
    workOrders,
  }), [backupValidated, bankImportUnmatchedRows, leases, loanPayments, loans, month, propertyFilter, recurringExpenseChecks, tenantLedgerEntries, todayIso, transactions, workOrders]);
  if (!review) return null;

  const scopeKey = propertyFilter === "all" ? "all" : propertyFilter;
  const closeKey = `${month}::${scopeKey}`;
  const closeRecord = appSettings.monthlyCloseRecords?.[closeKey];
  const isClosed = closeRecord?.signature === review.signature;
  const changedSinceClose = Boolean(closeRecord && !isClosed);
  const isFutureMonth = month > todayIso.slice(0, 7);
  const propertyLabel = propertyFilter === "all" ? "Portfolio" : (propertyNameById[propertyFilter] || "Selected property");

  const closeMonth = () => {
    setSetting("monthlyCloseRecords", {
      ...appSettings.monthlyCloseRecords,
      [closeKey]: {
        closedAt: new Date().toISOString(),
        signature: review.signature,
        issueCount: review.issues.length,
      },
    });
    setNotice(`${monthLabel(month)} closed for ${propertyLabel}${review.issues.length ? ` with ${review.issues.length} open checks recorded` : ""}.`);
  };
  const reopenMonth = () => {
    const next = { ...appSettings.monthlyCloseRecords };
    delete next[closeKey];
    setSetting("monthlyCloseRecords", next);
    setNotice(`${monthLabel(month)} reopened for ${propertyLabel}.`);
  };

  const status = isClosed ? "Closed" : changedSinceClose ? "Changed since close" : review.issues.length === 0 ? "Ready to close" : "Needs review";
  const statusTone = isClosed ? "bg-emerald-100 text-emerald-800" : changedSinceClose ? "bg-amber-100 text-amber-800" : review.issues.length === 0 ? "bg-teal-100 text-teal-800" : "bg-rose-100 text-rose-800";
  const summaryCards = [
    ["Transactions", review.summary.transactionCount],
    ["Income", currency(review.summary.income)],
    ["Expenses", currency(review.summary.expenses)],
    ["Rent charged / paid", `${currency(review.summary.rentCharged)} / ${currency(review.summary.rentPaid)}`],
  ];

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><ClipboardCheck className="h-5 w-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-slate-900">{monthLabel(month)} close</div>
                  <Badge className={statusTone}>{status}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{propertyLabel} · Review the source records, then save a reversible month-end snapshot.</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" aria-label="Previous close month" onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => onMonthChange(todayIso.slice(0, 7))}>Current</Button>
              <Button size="sm" variant="outline" aria-label="Next close month" onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>)}
          </div>
        </CardContent>
      </Card>

      {changedSinceClose ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Records changed after this month was closed. Review the current checks and close it again to refresh the snapshot.</div> : null}

      <div className="space-y-2">
        {review.issues.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5" /><div><div className="font-semibold">No open checks found</div><div className="mt-1 text-sm">The records currently available to Rental Tracker are ready for a month-end snapshot.</div></div></div>
        ) : review.issues.map((issue) => (
          <div key={issue.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${issue.severity === "attention" ? "text-rose-600" : "text-amber-600"}`} />
              <div><div className="font-semibold text-slate-900">{issue.title}</div><div className="mt-1 text-xs text-slate-600">{issue.detail}</div></div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onOpenIssue(issue.kind)}>Review</Button>
          </div>
        ))}
      </div>

      <Card className="border-slate-200 bg-slate-50 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-xs leading-5 text-slate-600">
            {isClosed
              ? `Closed ${new Date(closeRecord.closedAt).toLocaleString()}. This is a review snapshot, not a permanent accounting lock.`
              : isFutureMonth
                ? "Future months can be reviewed but not closed."
                : review.issues.length > 0
                  ? "Closing with open checks records that they were visible; it does not mark them fixed or create transactions."
                  : "Closing saves the current review signature so later record changes remain visible."}
          </div>
          {isClosed ? <Button size="sm" variant="outline" onClick={reopenMonth}><RotateCcw className="mr-1.5 h-4 w-4" />Reopen month</Button> : <Button size="sm" disabled={isFutureMonth} onClick={closeMonth}>{changedSinceClose ? "Refresh close snapshot" : review.issues.length ? "Close with open checks" : "Close month"}</Button>}
        </CardContent>
      </Card>
    </div>
  );
}

