import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Plus, ReceiptText } from "lucide-react";
import {
  actualLoanPaymentsByMonth,
  deriveLoanBalanceFromPayments,
  groupLoanPaymentsForDisplay,
  loanIdsMatch,
  projectedAmortizationRows,
  reconcileLoanPaymentsAgainstSchedule,
} from "../../domain/loans.ts";
import { loanPaymentTiming } from "./loanWorkspacePresentation.js";

function formatDate(value) {
  if (!value) return "No payment recorded";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function issueLabel(issue) {
  if (issue?.key === "missing_monthly_payments" && issue.detail?.length) return `${issue.detail.length} payment month${issue.detail.length === 1 ? "" : "s"} missing`;
  return issue?.label || "Review needed";
}

export function LoanCardsPanel({
  asOfDate,
  currency,
  deleteLoanPayment,
  effectiveLoanPaymentDeductibleInterest,
  leases,
  loanPayments,
  loanPropertySummaries = [],
  loanReviewInbox,
  observedLoanDefaultsById,
  onRecordPayment,
  prefetchLoanEditorDialog,
  properties,
  propertyNameById,
  repairLoanFromHistory,
  startEditLoan,
  startEditLoanPayment,
  syncLoanBalanceFromHistory,
  units,
  usePeriods,
  visibleLoans,
  yearFilter,
  yearScopedLoanPayments,
}) {
  const [expandedById, setExpandedById] = useState({});
  const [amortizationById, setAmortizationById] = useState({});
  const reviewById = Object.fromEntries((loanReviewInbox?.records || []).map((record) => [record.loan.id, record]));
  const propertySummaryById = Object.fromEntries(loanPropertySummaries.map((summary) => [summary.property.id, summary]));

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-2 !p-3">
        {visibleLoans.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">No loans in this scope. Use Add Loan to create the first loan.</div>}
        {visibleLoans.map((loan) => {
          const property = properties.find((item) => item.id === loan.propertyId);
          const propertySummary = propertySummaryById[loan.propertyId];
          const payments = loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan.id)).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
          const recordedPayments = payments.filter((payment) => !asOfDate || String(payment.paymentDate || "").slice(0, 10) <= asOfDate);
          const futurePaymentCount = Math.max(0, payments.length - recordedPayments.length);
          const reviewRecord = reviewById[loan.id];
          const expanded = expandedById[loan.id] ?? false;
          const repairInsight = reconcileLoanPaymentsAgainstSchedule({ loan, payments: recordedPayments, usePeriods, leases, units });
          const balanceInsight = deriveLoanBalanceFromPayments(loan, recordedPayments);
          const effectiveBalance = repairInsight.balanceMismatch ? repairInsight.derivedBalance : (balanceInsight.useDerivedBalance ? balanceInsight.derivedBalance : Number(loan.currentBalance || 0));
          const defaults = observedLoanDefaultsById?.[loan.id] || {};
          const escrow = Number(defaults.scheduledEscrow ?? loan.scheduledEscrow ?? 0);
          const pmi = Number(defaults.scheduledMortgageInsurance ?? loan.scheduledMortgageInsurance ?? 0);
          const outlay = Number(loan.scheduledPI || 0) + escrow + pmi + Number(loan.defaultExtraPrincipal || 0);
          const value = Number(propertySummary?.estimatedCurrentValue || property?.currentValue || 0);
          const ltv = value > 0 ? (effectiveBalance / value) * 100 : null;
          const paymentTiming = loanPaymentTiming(payments, asOfDate, defaults.nextPayment || loan.nextPayment);
          const groups = groupLoanPaymentsForDisplay(recordedPayments, effectiveLoanPaymentDeductibleInterest).slice(0, 8);
          const scopedActualPayments = yearScopedLoanPayments.filter((payment) => !asOfDate || String(payment.paymentDate || "").slice(0, 10) <= asOfDate);
          const actualRows = Object.entries(actualLoanPaymentsByMonth(scopedActualPayments, loan.id, effectiveLoanPaymentDeductibleInterest)).sort(([a], [b]) => b.localeCompare(a));
          const projectedRows = projectedAmortizationRows({ ...loan, currentBalance: effectiveBalance }, 12);
          const needsBalanceReview = balanceInsight.useDerivedBalance || repairInsight.hasRepairableDifferences || repairInsight.balanceMismatch;
          const reviewStatusLabel = needsBalanceReview ? "Balance needs review" : (reviewRecord ? "Tax review needed" : "Ready");

          return (
            <div key={loan.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid gap-3 px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(190px,1.35fr)_70px_105px_95px_105px_105px_155px_minmax(185px,auto)] xl:items-center">
                <div className="min-w-0">
                  <div className="rt-row-title">{loan.loanType || "Mortgage"}</div>
                  <div className="text-xs text-slate-500">{loan.lender || "Lender not entered"}</div>
                  <div className="mt-1 text-xs text-slate-500">{propertyNameById[loan.propertyId] || "Property not entered"} | Lien {loan.lienPosition || "-"}</div>
                </div>
                <div><div className="text-[10px] uppercase text-slate-400">Rate</div><div className="text-sm font-medium">{Number(loan.rate || 0).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">Balance</div><div className="text-sm font-medium">{currency(effectiveBalance)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">P&amp;I</div><div className="text-sm font-medium">{currency(loan.scheduledPI)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">Escrow / PMI</div><div className="text-sm font-medium">{currency(escrow + pmi)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">Total outlay</div><div className="text-sm font-medium">{currency(outlay)}</div></div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Payment activity</div>
                  <div className="text-xs font-medium">{paymentTiming.lastRecordedDate ? formatDate(paymentTiming.lastRecordedDate) : "No recorded payment yet"}</div>
                  {paymentTiming.nextScheduledDate ? <div className="text-[11px] text-slate-500">Next: {formatDate(paymentTiming.nextScheduledDate)}</div> : null}
                  <div className={paymentTiming.missingPayment ? "text-[11px] font-medium text-rose-700" : "text-[11px] font-medium text-emerald-700"}>{paymentTiming.status}</div>
                  {futurePaymentCount > 0 ? <div className="text-[11px] font-medium text-blue-700">{futurePaymentCount} future {futurePaymentCount === 1 ? "payment" : "payments"} hidden by as-of date</div> : null}
                  <div className="text-[11px] text-slate-500">{ltv == null ? "LTV needs valuation" : `${ltv.toFixed(1)}% LTV`}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                  <Badge className={reviewRecord || needsBalanceReview ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>{reviewStatusLabel}</Badge>
                  <Button size="sm" onClick={() => onRecordPayment(loan)}><Plus className="mr-1 h-3.5 w-3.5" />Record payment</Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedById((current) => ({ ...current, [loan.id]: !expanded }))}>
                    {expanded ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                    {expanded ? "Hide details" : "View details"}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
                    <div className="space-y-4">
                      <section aria-labelledby={`loan-overview-${loan.id}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 id={`loan-overview-${loan.id}`} className="text-sm font-semibold">Overview</h3>
                          <Button size="sm" variant="secondary" onClick={() => startEditLoan(loan)} onMouseEnter={prefetchLoanEditorDialog}>Edit loan</Button>
                        </div>
                        <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <div><span className="text-slate-500">Original balance</span><div className="mt-0.5 font-medium text-slate-800">{currency(loan.originalBalance)}</div></div>
                          <div><span className="text-slate-500">Current balance</span><div className="mt-0.5 font-medium text-slate-800">{currency(effectiveBalance)}</div></div>
                          <div><span className="text-slate-500">Scheduled outlay</span><div className="mt-0.5 font-medium text-slate-800">{currency(outlay)}</div></div>
                          <div><span className="text-slate-500">Current-value LTV</span><div className="mt-0.5 font-medium text-slate-800">{ltv == null ? "Valuation needed" : `${ltv.toFixed(1)}%`}</div></div>
                        </div>
                      </section>

                      <section aria-labelledby={`loan-review-${loan.id}`}>
                        <h3 id={`loan-review-${loan.id}`} className="mb-2 text-sm font-semibold">Review and tax status</h3>
                        <div className="flex flex-wrap gap-2">
                        {(reviewRecord?.issues || []).map((issue) => <Badge key={issue.key} variant="outline" className="!border-amber-200 !bg-amber-50 !text-amber-800" title={issue.help}>{issueLabel(issue)}</Badge>)}
                        {!reviewRecord && !needsBalanceReview && <Badge variant="outline" className="!border-emerald-200 !bg-emerald-50 !text-emerald-700">Payment and tax checks ready</Badge>}
                        {needsBalanceReview && <Badge variant="outline" className="!border-amber-200 !bg-amber-50 !text-amber-800">Balance review needed</Badge>}
                        <Badge variant="outline">Current value {value > 0 ? currency(value) : "not set"}</Badge>
                        <Badge variant="outline">Monthly outlay {currency(outlay)}</Badge>
                      </div>
                      </section>

                      {needsBalanceReview && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          <span>{repairInsight.hasRepairableDifferences ? `Payment history can be repaired. Derived balance: ${currency(repairInsight.derivedBalance)}.` : `Payment history implies a balance of ${currency(balanceInsight.derivedBalance)}.`}</span>
                          <div className="flex gap-2">
                            {repairInsight.hasRepairableDifferences && <Button size="sm" variant="secondary" onClick={() => repairLoanFromHistory(loan)}>Repair history</Button>}
                            <Button size="sm" variant="secondary" onClick={() => syncLoanBalanceFromHistory(loan, repairInsight.balanceMismatch ? repairInsight.derivedBalance : balanceInsight.derivedBalance)}>Sync balance</Button>
                          </div>
                        </div>
                      )}

                      <section aria-labelledby={`loan-history-${loan.id}`}>
                        <div className="mb-2 flex items-center justify-between"><h3 id={`loan-history-${loan.id}`} className="text-sm font-semibold">Payment history</h3><span className="text-xs text-slate-500">{recordedPayments.length} recorded through {formatDate(asOfDate)}</span></div>
                        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-right">Total</th><th className="px-2 py-2 text-right">Interest</th><th className="px-2 py-2 text-right">Deductible</th><th className="px-2 py-2 text-right">Principal</th><th className="px-2 py-2 text-right">Escrow</th><th className="px-2 py-2 text-right">PMI</th><th className="px-2 py-2 text-right">Extra</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
                            <tbody>
                              {groups.length === 0 && <tr><td colSpan={9} className="px-2 py-3 text-slate-500">No payments recorded.</td></tr>}
                              {groups.map((group) => <tr key={group.paymentDate} className="border-t border-slate-100"><td className="px-2 py-2">{formatDate(group.paymentDate)}{group.entries.length > 1 && <span className="ml-1 text-slate-400">({group.entries.length})</span>}</td><td className="px-2 py-2 text-right font-medium">{currency(group.summary.totalPayment)}</td><td className="px-2 py-2 text-right">{currency(group.summary.interest)}</td><td className="px-2 py-2 text-right">{currency(group.summary.deductibleInterest)}</td><td className="px-2 py-2 text-right">{currency(group.summary.principal)}</td><td className="px-2 py-2 text-right">{currency(group.summary.escrow)}</td><td className="px-2 py-2 text-right">{currency(group.summary.mortgageInsurance)}</td><td className="px-2 py-2 text-right">{currency(group.summary.extraPrincipal)}</td><td className="whitespace-nowrap px-2 py-1 text-right">{group.entries.length === 1 ? <><Button size="sm" variant="ghost" onClick={() => startEditLoanPayment(group.entries[0])}>Edit</Button><Button size="sm" variant="ghost" onClick={() => deleteLoanPayment(group.entries[0])}>Delete</Button></> : <details className="text-left"><summary className="cursor-pointer text-teal-700">View {group.entries.length} parts</summary><div className="mt-2 min-w-56 space-y-2">{group.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2"><span>{currency(entry.totalPayment)}</span><span><Button size="sm" variant="ghost" onClick={() => startEditLoanPayment(entry)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => deleteLoanPayment(entry)}>Delete</Button></span></div>)}</div></details>}</td></tr>)}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>

                    <div className="space-y-4">
                      <section aria-labelledby={`loan-summary-${loan.id}`}>
                        <h3 id={`loan-summary-${loan.id}`} className="mb-2 text-sm font-semibold">Payment summary ({yearFilter})</h3>
                        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                          <table className="min-w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-2 text-left">Month</th><th className="px-2 py-2 text-right">Interest</th><th className="px-2 py-2 text-right">Principal</th><th className="px-2 py-2 text-right">Total</th></tr></thead><tbody>{actualRows.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-slate-500">No payments in {yearFilter}.</td></tr>}{actualRows.map(([month, summary]) => <tr key={month} className="border-t border-slate-100"><td className="px-2 py-2">{month}</td><td className="px-2 py-2 text-right">{currency(summary.interest)}</td><td className="px-2 py-2 text-right">{currency(Number(summary.principal || 0) + Number(summary.extraPrincipal || 0))}</td><td className="px-2 py-2 text-right font-medium">{currency(summary.totalPayment)}</td></tr>)}</tbody></table>
                        </div>
                      </section>
                      <section aria-labelledby={`loan-amortization-${loan.id}`}>
                        <h3 id={`loan-amortization-${loan.id}`} className="mb-2 text-sm font-semibold">Amortization forecast</h3>
                        <Button variant="secondary" size="sm" onClick={() => setAmortizationById((current) => ({ ...current, [loan.id]: !current[loan.id] }))}><ReceiptText className="mr-1.5 h-4 w-4" />{amortizationById[loan.id] ? "Hide" : "Show"} next 12 payments</Button>
                        {amortizationById[loan.id] && <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-white"><table className="min-w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-2 text-left">Month</th><th className="px-2 py-2 text-right">Interest</th><th className="px-2 py-2 text-right">Principal</th><th className="px-2 py-2 text-right">End balance</th></tr></thead><tbody>{projectedRows.map((row, index) => <tr key={`${row.month}-${index}`} className="border-t border-slate-100"><td className="px-2 py-2">{row.month}</td><td className="px-2 py-2 text-right">{currency(row.projectedInterest)}</td><td className="px-2 py-2 text-right">{currency(row.projectedPrincipal)}</td><td className="px-2 py-2 text-right">{currency(row.endingBalance)}</td></tr>)}</tbody></table></div>}
                      </section>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
