import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Building2, ClipboardCheck, Landmark, ReceiptText, Settings2, ShieldCheck, X } from "lucide-react";
import {
  deriveLoanBalanceFromPayments,
  formatLoanPaymentDraftTotal,
  loanIdsMatch,
  loanPaymentDraftTotalAmount,
  projectedCurrentPaymentComponents,
  reconcileLoanPaymentsAgainstSchedule,
} from "../../domain/loans.ts";
import { LoanCardsPanel } from "./LoanCardsPanel.jsx";
import { LoanPaymentEntryPanel } from "./LoanPaymentEntryPanel.jsx";
import { LoanPropertySummaryPanel } from "./LoanPropertySummaryPanel.jsx";
import { buildLoanWorkspaceModes, combinedLtvPresentation, loanReviewSummary } from "./loanWorkspacePresentation.js";

function sumVisibleLoanValues({ visibleLoans, observedLoanDefaultsById, loanPayments, leases, units, usePeriods, asOfDate }) {
  return visibleLoans.reduce((summary, loan) => {
    const observed = observedLoanDefaultsById?.[loan.id] || {};
    const payments = loanPayments.filter((payment) => (
      loanIdsMatch(payment.loanId, loan.id)
      && (!asOfDate || String(payment.paymentDate || "").slice(0, 10) <= asOfDate)
    ));
    const repairInsight = reconcileLoanPaymentsAgainstSchedule({ loan, payments, usePeriods, leases, units });
    const balanceInsight = deriveLoanBalanceFromPayments(loan, payments);
    const effectiveBalance = repairInsight.balanceMismatch
      ? repairInsight.derivedBalance
      : (balanceInsight.useDerivedBalance ? balanceInsight.derivedBalance : Number(loan.currentBalance || 0));
    if (repairInsight.balanceMismatch || repairInsight.hasRepairableDifferences || balanceInsight.useDerivedBalance) {
      summary.balanceReviewLoanIds.push(loan.id);
    }
    const escrow = Number(observed.scheduledEscrow ?? loan.scheduledEscrow ?? 0);
    const pmi = Number(observed.scheduledMortgageInsurance ?? loan.scheduledMortgageInsurance ?? 0);
    summary.balance += effectiveBalance;
    summary.balanceByPropertyId[loan.propertyId] = (summary.balanceByPropertyId[loan.propertyId] || 0) + effectiveBalance;
    summary.outlay += Number(loan.scheduledPI || 0) + escrow + pmi + Number(loan.defaultExtraPrincipal || 0);
    return summary;
  }, { balance: 0, outlay: 0, balanceByPropertyId: {}, balanceReviewLoanIds: [] });
}

function cleanupGroups(loanReviewInbox) {
  const records = loanReviewInbox?.records || [];
  const countIssues = (...keys) => records.reduce(
    (count, record) => count + (record.issues || []).filter((issue) => keys.includes(issue.key)).length,
    0,
  );
  return [
    { label: "1098 & interest", count: countIssues("missing_1098_review", "interest_mismatch", "deductible_interest_mismatch") },
    { label: "Escrow", count: countIssues("escrow_not_reviewed", "escrow_unallocated_difference", "property_tax_escrow_missing", "insurance_escrow_missing") },
    { label: "PMI", count: countIssues("pmi_review_needed") },
    { label: "Missing months", count: countIssues("missing_monthly_payments") },
    { label: "Balance review", count: countIssues("loan_balance_mismatch") },
  ];
}

const loanWorkspaceModeIcons = {
  overview: Landmark,
  payments: ReceiptText,
  tax: ShieldCheck,
  details: Settings2,
};

export function LoansWorkspace({
  cancelLoanPaymentEdit,
  currency,
  deleteLoanPayment,
  editingLoanPaymentId,
  effectiveLoanForDraft,
  effectiveLoanPaymentDeductibleInterest,
  leases,
  loanPaymentDraft,
  loanPaymentDraftTotalInput,
  loanPayments,
  loanPropertySummaries = [],
  loanReviewInbox,
  loans,
  observedLoanDefaultsById,
  openPropertyValuation,
  openReviewCenter,
  prefetchLoanEditorDialog,
  properties,
  propertyNameById,
  recordLoanPayment,
  recurringThroughDate,
  repairLoanFromHistory,
  resetLoanPaymentDraftForLoan,
  setEditingLoanPaymentId,
  setIsEditingLoanPaymentTotal,
  setLoanPaymentDraft,
  setLoanPaymentDraftTotalInput,
  startEditLoan,
  startEditLoanPayment,
  syncLoanBalanceFromHistory,
  units,
  usePeriods,
  visibleLoans = [],
  yearFilter,
  yearScopedLoanPayments,
}) {
  const [workspaceMode, setWorkspaceMode] = useState("overview");
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const inboxReviewCount = loanReviewInbox?.counts?.total || 0;
  const debtTotals = useMemo(
    () => sumVisibleLoanValues({ visibleLoans, observedLoanDefaultsById, loanPayments, leases, units, usePeriods, asOfDate: recurringThroughDate }),
    [visibleLoans, observedLoanDefaultsById, loanPayments, leases, units, usePeriods, recurringThroughDate],
  );
  const combinedLtv = combinedLtvPresentation(debtTotals.balance, loanPropertySummaries);
  const inboxBalanceLoanIds = new Set((loanReviewInbox?.records || [])
    .filter((record) => (record.issues || []).some((issue) => issue.key === "loan_balance_mismatch"))
    .map((record) => record.loan.id));
  const additionalBalanceReviewCount = debtTotals.balanceReviewLoanIds.filter((loanId) => !inboxBalanceLoanIds.has(loanId)).length;
  const loanReviewCount = inboxReviewCount + additionalBalanceReviewCount;
  const reviewGroups = cleanupGroups(loanReviewInbox).map((group) => (
    group.label === "Balance review" ? { ...group, count: group.count + additionalBalanceReviewCount } : group
  ));
  const needsReviewLoanIds = new Set([
    ...(loanReviewInbox?.records || []).map((record) => record.loan.id),
    ...debtTotals.balanceReviewLoanIds,
  ]);
  const reviewAreaCount = reviewGroups.filter((group) => group.count > 0).length;
  const reviewSummary = loanReviewSummary({
    loanCount: visibleLoans.length,
    needsReviewLoanCount: needsReviewLoanIds.size,
    reviewAreaCount,
  });
  const selectedYearLoanSummary = useMemo(
    () => yearScopedLoanPayments
      .filter((payment) => !recurringThroughDate || String(payment.paymentDate || "").slice(0, 10) <= recurringThroughDate)
      .reduce((summary, payment) => {
        summary.paymentCount += 1;
        summary.interest += Number(payment.interest || 0);
        summary.deductibleInterest += Number(effectiveLoanPaymentDeductibleInterest(payment) || 0);
        summary.principal += Number(payment.principal || 0);
        summary.extraPrincipal += Number(payment.extraPrincipal || 0);
        summary.escrow += Number(payment.escrow || 0);
        summary.pmi += Number(payment.mortgageInsurance || 0);
        summary.total += Number(payment.totalPayment || 0);
        return summary;
      }, { paymentCount: 0, interest: 0, deductibleInterest: 0, principal: 0, extraPrincipal: 0, escrow: 0, pmi: 0, total: 0 }),
    [effectiveLoanPaymentDeductibleInterest, recurringThroughDate, yearScopedLoanPayments],
  );

  useEffect(() => {
    if (editingLoanPaymentId) {
      setWorkspaceMode("payments");
      setPaymentPanelOpen(true);
    }
  }, [editingLoanPaymentId]);

  const openPaymentForLoan = (loan) => {
    resetLoanPaymentDraftForLoan(loan);
    setWorkspaceMode("payments");
    setPaymentPanelOpen(true);
  };

  const closePaymentPanel = () => {
    if (editingLoanPaymentId) cancelLoanPaymentEdit();
    setPaymentPanelOpen(false);
  };

  const workspaceModes = buildLoanWorkspaceModes({
    loanCount: visibleLoans.length,
    paymentCount: selectedYearLoanSummary.paymentCount,
    reviewCount: loanReviewCount,
  });
  const summaryByMode = {
    overview: [
      { label: "Total loan balance", value: currency(debtTotals.balance), helper: "Current balance", icon: Landmark },
      { label: "Scheduled monthly outlay", value: currency(debtTotals.outlay), helper: "Current schedule", icon: ReceiptText },
      {
        label: "Combined LTV",
        value: combinedLtv.value == null ? "Add valuation" : `${combinedLtv.value.toFixed(1)}%`,
        helper: combinedLtv.helper,
        icon: Building2,
      },
      { label: "Loans in scope", value: String(visibleLoans.length), helper: "Across selected properties", icon: Landmark },
    ],
    payments: [
      { label: "Scheduled monthly outlay", value: currency(debtTotals.outlay), helper: "Current schedule", icon: ReceiptText },
      { label: `${yearFilter} payments`, value: currency(selectedYearLoanSummary.total), helper: `${selectedYearLoanSummary.paymentCount} recorded`, icon: ClipboardCheck },
      { label: "Principal paid", value: currency(selectedYearLoanSummary.principal + selectedYearLoanSummary.extraPrincipal), helper: "Regular and extra principal", icon: Landmark },
      { label: "Interest paid", value: currency(selectedYearLoanSummary.interest), helper: "Recorded in selected year", icon: ReceiptText },
    ],
    tax: [
      { label: `${yearFilter} interest`, value: currency(selectedYearLoanSummary.interest), helper: "Recorded interest", icon: ReceiptText },
      { label: "Deductible interest", value: currency(selectedYearLoanSummary.deductibleInterest), helper: "Tax-deductible estimate", icon: ShieldCheck },
      { label: "Escrow paid", value: currency(selectedYearLoanSummary.escrow), helper: "Selected-year deposits", icon: ClipboardCheck },
      { label: "PMI paid", value: currency(selectedYearLoanSummary.pmi), helper: "Selected-year mortgage insurance", icon: ShieldCheck },
    ],
    details: [
      { label: "Loans in scope", value: String(visibleLoans.length), helper: "Loan records", icon: Landmark },
      { label: "Current balance", value: currency(debtTotals.balance), helper: "Across visible loans", icon: Landmark },
      { label: "Balance reviews", value: String(debtTotals.balanceReviewLoanIds.length), helper: debtTotals.balanceReviewLoanIds.length ? "Needs attention" : "Balances aligned", icon: ClipboardCheck },
      { label: "Property valuations", value: String(loanPropertySummaries.length), helper: "Used for leverage", icon: Building2 },
    ],
  };
  const summaryItems = summaryByMode[workspaceMode] || summaryByMode.overview;
  const summaryHeading = {
    overview: "Debt overview",
    payments: "Payment activity",
    tax: `${yearFilter} tax and escrow totals`,
    details: "Loan record status",
  }[workspaceMode];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Loan workspace modes" className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {workspaceModes.map((mode) => {
          const modeSelected = workspaceMode === mode.key;
          const ModeIcon = loanWorkspaceModeIcons[mode.key] || Landmark;
          return (
            <button
              key={`loan-mode-${mode.key}`}
              type="button"
              role="tab"
              aria-selected={modeSelected}
              className={`rounded-xl border p-3 text-left transition ${modeSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"}`}
              onClick={() => setWorkspaceMode(mode.key)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold"><ModeIcon className={`h-4 w-4 ${modeSelected ? "text-white" : "text-slate-600"}`} aria-hidden="true" />{mode.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modeSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{mode.badge}</span>
              </div>
              <div className={`mt-2 text-xs leading-4 ${modeSelected ? "text-slate-200" : "text-slate-500"}`}>{mode.description}</div>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="debt-summary-title">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 id="debt-summary-title" className="text-base font-semibold text-slate-950">{summaryHeading}</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map(({ label, value, helper, icon: Icon }) => (
            <Card key={label} className="shadow-none">
              <CardContent className="flex min-h-28 items-start gap-3 !px-4 !py-4">
                <div className="mt-1 rounded-md border border-teal-100 bg-teal-50 p-1.5 text-teal-700"><Icon className="h-4 w-4" aria-hidden="true" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-h-10 items-start text-[11px] font-medium uppercase leading-4 text-slate-500">{label}</div>
                  <div className="mt-1 text-base font-semibold leading-tight text-slate-950" title={value}>{value}</div>
                  {helper ? <div className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</div> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {workspaceMode === "tax" && <Card className="shadow-none">
        <CardContent className="flex h-full flex-col !p-4">
          <div className="min-w-0">
          <div className="flex items-center gap-2">
            {loanReviewCount > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
            <h2 className="font-semibold text-slate-950">Loan review status</h2>
            <Badge className={loanReviewCount > 0 ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-100 !text-emerald-700"}>
              {reviewSummary.badge}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-700">{reviewSummary.headline}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {reviewGroups.map((group) => (
              <div key={group.label} className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-2 text-xs">
                <span className="text-slate-600">{group.label}</span>
                <span className={group.count ? "font-semibold text-amber-700" : "font-medium text-emerald-700"}>{group.count ? `Needs review - ${group.count}` : "Ready"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-end gap-2 pt-4">
          <Button size="sm" variant={loanReviewCount > 0 ? "default" : "secondary"} onClick={openReviewCenter}>Open Work Queue</Button>
        </div>
        </CardContent>
      </Card>}

      {workspaceMode === "overview" && (
        <LoanPropertySummaryPanel
          balanceByPropertyId={debtTotals.balanceByPropertyId}
          currency={currency}
          loanPropertySummaries={loanPropertySummaries}
          openPropertyValuation={openPropertyValuation}
        />
      )}

      {workspaceMode === "payments" && paymentPanelOpen && (
        <Card className="h-full shadow-none">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-200 py-3">
            <CardTitle className="text-base">{editingLoanPaymentId ? "Edit loan payment" : "Record loan payment"}</CardTitle>
            <Button size="icon" variant="ghost" onClick={closePaymentPanel} title="Close payment form"><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="pt-4">
            <LoanPaymentEntryPanel
              cancelLoanPaymentEdit={cancelLoanPaymentEdit}
              editingLoanPaymentId={editingLoanPaymentId}
              effectiveLoanForDraft={effectiveLoanForDraft}
              formatLoanPaymentDraftTotal={formatLoanPaymentDraftTotal}
              loanPaymentDraft={loanPaymentDraft}
              loanPaymentDraftTotalAmount={loanPaymentDraftTotalAmount}
              loanPaymentDraftTotalInput={loanPaymentDraftTotalInput}
              loans={loans}
              propertyNameById={propertyNameById}
              projectedCurrentPaymentComponents={projectedCurrentPaymentComponents}
              recordLoanPayment={recordLoanPayment}
              resetLoanPaymentDraftForLoan={resetLoanPaymentDraftForLoan}
              onPaymentRecorded={() => setPaymentPanelOpen(false)}
              setEditingLoanPaymentId={setEditingLoanPaymentId}
              setIsEditingLoanPaymentTotal={setIsEditingLoanPaymentTotal}
              setLoanPaymentDraft={setLoanPaymentDraft}
              setLoanPaymentDraftTotalInput={setLoanPaymentDraftTotalInput}
              visibleLoans={visibleLoans}
            />
          </CardContent>
        </Card>
      )}

      <LoanCardsPanel
        currency={currency}
        deleteLoanPayment={deleteLoanPayment}
        effectiveLoanPaymentDeductibleInterest={effectiveLoanPaymentDeductibleInterest}
        leases={leases}
        loanPayments={loanPayments}
        loanPropertySummaries={loanPropertySummaries}
        loanReviewInbox={loanReviewInbox}
        loans={loans}
        observedLoanDefaultsById={observedLoanDefaultsById}
        asOfDate={recurringThroughDate}
        onRecordPayment={openPaymentForLoan}
        prefetchLoanEditorDialog={prefetchLoanEditorDialog}
        properties={properties}
        propertyNameById={propertyNameById}
        repairLoanFromHistory={repairLoanFromHistory}
        startEditLoan={startEditLoan}
        startEditLoanPayment={startEditLoanPayment}
        syncLoanBalanceFromHistory={syncLoanBalanceFromHistory}
        units={units}
        usePeriods={usePeriods}
        visibleLoans={visibleLoans}
        yearFilter={yearFilter}
        yearScopedLoanPayments={yearScopedLoanPayments}
        workspaceMode={workspaceMode}
        onOpenWorkspaceMode={setWorkspaceMode}
      />

    </div>
  );
}
