import React, { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AlertTriangle, ArrowLeftRight, Banknote, FileSearch, Filter, ReceiptText, Repeat2, Upload, WalletCards } from "lucide-react";
import { canRunSafeBulkReview } from "../shared/auditBadges.js";
import { ResponsiveTableFrame } from "../shared/uiHelpers.jsx";
import {
  buildTransactionWorkspaceModes,
  formatRentReportingMonth,
  formatTransactionUnitLabel,
  getTransactionVisual,
  isFutureDatedTransaction,
  ledgerViewForTransactionWorkspaceMode,
  summarizeLedgerTransactions,
  transactionCategoryStatusLabel,
  transactionPostingStatusLabel,
  transactionReconciliationStatusLabel,
  transactionSupportStatusLabel,
  transactionScheduleLabel,
  transactionTaxStatusLabel,
} from "./transactionPresentation.js";

const LEDGER_PANEL_CLASS = "rounded-xl border border-slate-200 bg-white shadow-none";
const LEDGER_MUTED_PANEL_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80";
const TRANSACTION_MODE_ICONS = {
  activity: FileSearch,
  attention: AlertTriangle,
  recurring: Repeat2,
  imports: Upload,
};

export function LedgerWorkspace({
  activeProperties,
  BANK_IMPORT_MATCH_RULE_OPTIONS,
  WORKSPACE_MUTED_PANEL_CLASS,
  applyBankImportMatches,
  bankImportDefaults,
  bankImportFileName,
  bankImportImportedCount,
  bankImportInputRef,
  bankImportMatchCount,
  bankImportMatchRule,
  bankImportMatches,
  bankImportRows,
  bankImportSkippedRows,
  bankImportUnitOptions,
  bankImportUnmatchedRows,
  categories,
  clearBankImportPreview,
  currency,
  documents = [],
  expectedRecurringTransactions,
  isTaxReviewRelevantTransaction,
  ledgerCategories,
  ledgerCategoryFilter,
  ledgerReconciliationFilter,
  ledgerSort,
  ledgerTransactions,
  markTransactionCapitalImprovement,
  onBankImportInputChange,
  onBankImportMatchRuleChange,
  openBankImportPicker,
  openBankImportReview,
  openReviewCenter,
  openTransaction,
  markTransactionsTaxReviewed,
  postDueRecurringTransactions,
  prefetchBankImportReviewDialog,
  prefetchTransactionDialog,
  properties,
  propertyNameById,
  reconcileTransactions,
  search,
  selectedTxn,
  setBankImportDefaults,
  setLedgerCategoryFilter,
  setLedgerReconciliationFilter,
  setLedgerSort,
  setSearch,
  transactionById,
  transactionReviewById,
  transactionReviewInbox,
  startCreateAssetFromTransaction,
  todayIso,
  useTransactionDatesAsServicePeriods,
}) {
  const propertyOptions = activeProperties || properties;
  const [ledgerView, setLedgerView] = useState("all");
  const [workspaceMode, setWorkspaceMode] = useState("activity");
  const [reviewReasonFilter, setReviewReasonFilter] = useState("all");
  const [summaryView, setSummaryView] = useState("posted");
  const [selectedReviewIds, setSelectedReviewIds] = useState([]);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [matchingRulesOpen, setMatchingRulesOpen] = useState(false);
  const reviewReasonOptions = useMemo(() => {
    const byKey = new Map();
    transactionReviewInbox.forEach((record) => {
      record.issues.forEach((issue) => {
        if (!byKey.has(issue.key)) byKey.set(issue.key, issue.label);
      });
    });
    return Array.from(byKey.entries()).map(([key, label]) => ({ key, label }));
  }, [transactionReviewInbox]);
  const receiptGapRecords = useMemo(
    () => transactionReviewInbox.filter((record) => record.issues.some((issue) => issue.key === "missing_receipt")),
    [transactionReviewInbox],
  );
  const taxOpenRecords = useMemo(
    () => transactionReviewInbox.filter((record) => record.issues.some((issue) => issue.key === "tax_open")),
    [transactionReviewInbox],
  );
  const futureTransactions = useMemo(
    () => ledgerTransactions.filter((transaction) => isFutureDatedTransaction(transaction, todayIso)),
    [ledgerTransactions, todayIso],
  );
  const unreconciledTransactions = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.bankImportId && !transaction.reconciled),
    [ledgerTransactions],
  );
  const recurringTransactions = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.recurringTemplateId),
    [ledgerTransactions],
  );
  const importedTransactions = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.bankImportId),
    [ledgerTransactions],
  );
  const filteredReviewRecords = useMemo(
    () =>
      transactionReviewInbox.filter((record) => {
        if (reviewReasonFilter === "all") return true;
        return record.issues.some((issue) => issue.key === reviewReasonFilter);
      }),
    [reviewReasonFilter, transactionReviewInbox],
  );
  const displayedTransactions = ledgerView === "review"
    ? filteredReviewRecords.map((record) => record.transaction)
    : ledgerView === "receipts"
      ? receiptGapRecords.map((record) => record.transaction)
      : ledgerView === "unreconciled"
        ? unreconciledTransactions
        : ledgerView === "imported"
          ? importedTransactions
          : ledgerView === "recurring"
            ? recurringTransactions
        : ledgerView === "tax_open"
          ? taxOpenRecords.map((record) => record.transaction)
          : ledgerView === "future"
            ? futureTransactions
            : ledgerTransactions;
  const visibleFutureTransactionCount = displayedTransactions.filter((transaction) => isFutureDatedTransaction(transaction, todayIso)).length;
  const showFutureNotice = ledgerView === "future" || visibleFutureTransactionCount > 0;
  const ledgerSummary = useMemo(() => {
    const summary = summarizeLedgerTransactions(ledgerTransactions, {
      includeFuture: summaryView === "full_year",
      todayIso,
    });
    const summaryModeHelper = summaryView === "full_year" ? "Includes future-dated transactions" : "Posted to date only";

    return [
      { label: "Income", value: currency(summary.income), helper: summaryModeHelper, tone: "text-emerald-700", icon: Banknote, iconTone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
      { label: "Expenses", value: currency(summary.expenses), helper: summaryModeHelper, tone: "text-rose-700", icon: WalletCards, iconTone: "border-rose-200 bg-rose-50 text-rose-700" },
      { label: "Net cashflow", value: currency(summary.netCashflow), helper: summaryModeHelper, tone: summary.netCashflow >= 0 ? "text-emerald-700" : "text-rose-700", icon: ArrowLeftRight, iconTone: summary.netCashflow >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700" },
      { label: "Transactions", value: summary.transactionCount, helper: summaryModeHelper, icon: FileSearch, iconTone: "border-blue-200 bg-blue-50 text-blue-700" },
    ];
  }, [currency, ledgerTransactions, summaryView, todayIso]);
  const workspaceModes = buildTransactionWorkspaceModes({
    attentionCount: transactionReviewInbox.length,
    bankMatchOpenCount: unreconciledTransactions.length + bankImportUnmatchedRows.length,
    expectedRecurringCount: expectedRecurringTransactions.length,
    importedCount: importedTransactions.length,
    recurringCount: recurringTransactions.length,
    transactionCount: ledgerTransactions.length,
  });
  const quickFilters = {
    activity: [
      { key: "all", label: "All activity", count: ledgerTransactions.length },
      { key: "future", label: "Future-dated", count: futureTransactions.length },
    ],
    attention: [
      { key: "review", label: "All flagged", count: transactionReviewInbox.length },
      { key: "receipts", label: "Receipt gaps", count: receiptGapRecords.length },
      { key: "tax_open", label: "Tax review open", count: taxOpenRecords.length },
    ],
    recurring: [
      { key: "recurring", label: "Recurring history", count: recurringTransactions.length },
    ],
    imports: [
      { key: "imported", label: "All imported", count: importedTransactions.length },
      { key: "unreconciled", label: "Needs bank match", count: unreconciledTransactions.length },
    ],
  }[workspaceMode];
  const modeListPresentation = {
    activity: { title: "Transaction activity", helper: "Browse or edit every transaction in the selected scope." },
    attention: { title: "Transactions needing attention", helper: "Inspect the exact records behind each flag. Use Work Queue for guided cleanup." },
    recurring: { title: "Recurring activity", helper: "Review transactions created from recurring templates and monitor the next expected posting." },
    imports: { title: "Imported activity", helper: "Review statement-sourced transactions and anything still waiting for a bank match." },
  }[workspaceMode];
  const changeWorkspaceMode = (mode) => {
    setWorkspaceMode(mode);
    setLedgerView(ledgerViewForTransactionWorkspaceMode(mode));
    setReviewReasonFilter("all");
    setSelectedReviewIds([]);
    if (mode === "imports") setImportPanelOpen(true);
  };
  const displayedReviewIds = new Set(displayedTransactions.map((transaction) => transaction.id));
  const selectedDisplayedReviewIds = selectedReviewIds.filter((id) => displayedReviewIds.has(id));
  const selectedDisplayedReviewRecords = selectedDisplayedReviewIds.map((id) => transactionReviewById[id]).filter(Boolean);
  const selectedBulkReviewIsSafe = canRunSafeBulkReview(selectedDisplayedReviewRecords);
  const toggleSelectedReviewId = (id) => {
    setSelectedReviewIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };
  const clearSelectedReviewIds = () => setSelectedReviewIds([]);
  const describeBankRowStatus = (row, match, matchedTxn) => {
    if (row.importedTransactionId) {
      if (row.alreadyImported) return "Existing FITID already belongs to a ledger transaction.";
      if (row.matchedApplied) return "Duplicate match was applied and the ledger transaction was bank matched.";
      return "This row has already been imported from the current preview.";
    }
    if (matchedTxn) {
      const dateText = match.dayDiff === 0 ? "same date" : `${match.dayDiff} day${match.dayDiff === 1 ? "" : "s"} apart`;
      return `Matched on amount plus ${dateText}; score ${Math.round(match.score)}.`;
    }
    return "No confident duplicate match yet; review before importing.";
  };
  const linkedDocumentCountByTransactionId = useMemo(() => {
    const counts = new Map();
    (documents || []).forEach((document) => {
      const linkedIds = new Set([
        String(document.transactionId || "").trim(),
        ...(Array.isArray(document.relatedTransactionIds) ? document.relatedTransactionIds.map((id) => String(id || "").trim()) : []),
      ].filter(Boolean));
      linkedIds.forEach((transactionId) => {
        counts.set(transactionId, (counts.get(transactionId) || 0) + 1);
      });
    });
    return counts;
  }, [documents]);
  const linkedDocumentCount = (transaction) => linkedDocumentCountByTransactionId.get(transaction.id) || 0;
  const hasBankImportActivity = bankImportRows.length > 0 || bankImportUnmatchedRows.length > 0 || bankImportMatchCount > 0 || Boolean(bankImportFileName);

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 !p-4">
        <div role="tablist" aria-label="Transaction workspace modes" className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {workspaceModes.map((mode) => {
            const ModeIcon = TRANSACTION_MODE_ICONS[mode.key];
            const selected = workspaceMode === mode.key;
            return (
              <button
                key={`transaction-mode-${mode.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`rounded-xl border p-3 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"}`}
                onClick={() => changeWorkspaceMode(mode.key)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ModeIcon className={`h-4 w-4 ${selected ? "text-white" : "text-slate-600"}`} aria-hidden="true" />
                    {mode.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{mode.count}</span>
                </div>
                <div className={`mt-2 text-xs leading-4 ${selected ? "text-slate-200" : "text-slate-500"}`}>{mode.description}</div>
              </button>
            );
          })}
        </div>

        {workspaceMode === "activity" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <div className="text-xs text-slate-500">
                Choose whether activity totals stop at today or include every entry in the selected year.
              </div>
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
                <Button size="sm" variant={summaryView === "posted" ? "default" : "ghost"} onClick={() => setSummaryView("posted")}>
                  Posted to date
                </Button>
                <Button size="sm" variant={summaryView === "full_year" ? "default" : "ghost"} onClick={() => setSummaryView("full_year")}>
                  Full selected year
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ledgerSummary.map((card) => {
                const SummaryIcon = card.icon;
                return (
                  <div key={`ledger-summary-${card.label}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs uppercase text-slate-500">{card.label}</div>
                        <div className={`mt-1 text-base font-semibold leading-tight text-slate-900 ${card.tone || ""}`}>{card.value}</div>
                        {card.helper ? <div className="mt-1 text-[11px] leading-4 text-slate-500">{card.helper}</div> : null}
                      </div>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${card.iconTone}`}>
                        <SummaryIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className={LEDGER_MUTED_PANEL_CLASS + " p-3"}>
          <div className="mb-2 flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <Button key={`ledger-quick-${filter.key}`} size="sm" variant={ledgerView === filter.key ? "default" : "secondary"} onClick={() => setLedgerView(filter.key)}>
                {filter.label} ({filter.count})
              </Button>
            ))}
          </div>
          {showFutureNotice ? (
            <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Future-dated transactions are in the selected year but occur after the current as-of date. They remain visible in Full-year view and may be excluded from posted-to-date cashflow.
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={ledgerCategoryFilter} onValueChange={setLedgerCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ledgerCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ledgerSort} onValueChange={setLedgerSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount high to low</SelectItem>
                <SelectItem value="amount_asc">Amount low to high</SelectItem>
                <SelectItem value="category_asc">Category A-Z</SelectItem>
              </SelectContent>
            </Select>
            {workspaceMode === "activity" || workspaceMode === "imports" ? (
              <Select value={ledgerReconciliationFilter} onValueChange={setLedgerReconciliationFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bank-match states</SelectItem>
                  <SelectItem value="unreconciled">Needs bank match</SelectItem>
                  <SelectItem value="reconciled">Bank matched / accepted</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {workspaceMode === "attention" ? (
              <Select value={reviewReasonFilter} onValueChange={setReviewReasonFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All review reasons</SelectItem>
                  {reviewReasonOptions.map((option) => (
                    <SelectItem key={`review-reason-${option.key}`} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              variant="secondary"
              className="whitespace-nowrap xl:justify-self-start"
              onClick={() => {
                setSearch("");
                setLedgerCategoryFilter("all");
                setLedgerReconciliationFilter("all");
                setLedgerSort("date_desc");
                setReviewReasonFilter("all");
                setLedgerView(ledgerViewForTransactionWorkspaceMode(workspaceMode));
              }}
            >
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        </div>

        {workspaceMode === "attention" ? <div className={`rounded-xl border p-3 ${transactionReviewInbox.length > 0 ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${transactionReviewInbox.length > 0 ? "text-amber-700" : "text-emerald-700"}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{transactionReviewInbox.length > 0 ? `${transactionReviewInbox.length} transactions have open flags` : "No transaction flags are open"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {transactionReviewInbox.length > 0
                    ? `${receiptGapRecords.length} receipt gap${receiptGapRecords.length === 1 ? "" : "s"} · ${taxOpenRecords.length} tax sign-off${taxOpenRecords.length === 1 ? "" : "s"}. Inspect records here or use Work Queue for guided cleanup.`
                    : "This view will collect transaction-level receipt, category, service-period, bank-match, and tax flags."}
                </div>
              </div>
            </div>
            {transactionReviewInbox.length > 0 && openReviewCenter ? <Button size="sm" onClick={openReviewCenter}>Open Work Queue</Button> : null}
          </div>
        </div> : null}

        {workspaceMode === "recurring" ? (
          <div className={`rounded-xl border p-3 ${expectedRecurringTransactions.length > 0 ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Recurring schedule</div>
                <div className="mt-1 text-xs text-slate-600">{expectedRecurringTransactions.length > 0 ? "Expected transactions that have not posted yet." : "Every recurring template due in this scope has posted."}</div>
              </div>
              {expectedRecurringTransactions.length > 0 ? <Button size="sm" variant="secondary" onClick={postDueRecurringTransactions}>Post due recurring</Button> : null}
            </div>
            {expectedRecurringTransactions.length > 0 ? (
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                {expectedRecurringTransactions.slice(0, 4).map((template) => (
                  <div key={`expected-recurring-${template.id}`} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
                    <div className="font-medium text-slate-900">{template.description}</div>
                    <div className="mt-1 text-xs text-slate-500">{template.nextDueDate} | {propertyNameById[template.propertyId] || template.propertyId} | {formatTransactionUnitLabel(template.unit)} | {template.category}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {workspaceMode === "imports" ? <div className={LEDGER_PANEL_CLASS + " p-3"}>
          <input ref={bankImportInputRef} type="file" accept=".csv,.qbo,.ofx,text/csv,application/x-ofx,application/ofx" className="hidden" onChange={onBankImportInputChange} />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <Upload className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Import / Reconcile</div>
                <div className="text-xs text-slate-500">Upload CSV, QBO, or OFX and review unmatched bank rows.</div>
                {hasBankImportActivity && (
                  <div className="mt-1 text-xs text-slate-500">
                    {bankImportFileName ? `File: ${bankImportFileName} | ` : ""}
                    Rows: {bankImportRows.length} | Matched: {bankImportMatchCount} | Imported: {bankImportImportedCount} | Unmatched: {bankImportUnmatchedRows.length}
                    {bankImportSkippedRows > 0 ? ` | Skipped: ${bankImportSkippedRows}` : ""}
                  </div>
                )}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasBankImportActivity && (
                <Badge variant="secondary">{bankImportMatchRule === "standard" ? "Recommended matching" : `Matching rule: ${BANK_IMPORT_MATCH_RULE_OPTIONS[bankImportMatchRule]?.label || bankImportMatchRule}`}</Badge>
              )}
              <Button variant="secondary" onClick={openBankImportPicker}>Import statement</Button>
              {hasBankImportActivity ? (
                <Button variant="secondary" onClick={applyBankImportMatches} disabled={bankImportMatchCount === 0}>Apply matches</Button>
              ) : null}
              {hasBankImportActivity ? (
                <Button
                  variant="secondary"
                  onClick={openBankImportReview}
                  onMouseEnter={prefetchBankImportReviewDialog}
                  onFocus={prefetchBankImportReviewDialog}
                  onTouchStart={prefetchBankImportReviewDialog}
                  disabled={bankImportUnmatchedRows.length === 0}
                >
                  Review unmatched
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setImportPanelOpen((prev) => !prev)}>
                {importPanelOpen ? "Hide workflow" : "Show workflow"}
              </Button>
              {bankImportRows.length > 0 && <Button variant="secondary" onClick={clearBankImportPreview}>Clear</Button>}
            </div>
          </div>
          {importPanelOpen || hasBankImportActivity ? (
            <div className="mt-2 text-xs text-slate-500">
              Recommended matching works for most bank imports. Adjust matching rules only if too many or too few matches are suggested.
              {bankImportUnmatchedRows.length === 0 && !bankImportRows.length ? " No unmatched imported rows." : ""}
            </div>
          ) : null}
          {(importPanelOpen || hasBankImportActivity) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMatchingRulesOpen((prev) => !prev)}>
                {matchingRulesOpen ? "Hide matching rules" : "Matching rules"}
              </Button>
            </div>
          )}
          {(importPanelOpen || hasBankImportActivity) && matchingRulesOpen ? (
            <div className={LEDGER_MUTED_PANEL_CLASS + " mt-3 p-3"}>
              <Label className="text-xs text-slate-600">Matching rules</Label>
              <Select value={bankImportMatchRule} onValueChange={onBankImportMatchRuleChange}>
                <SelectTrigger className="mt-1 h-9 w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BANK_IMPORT_MATCH_RULE_OPTIONS).map(([value, rule]) => (
                    <SelectItem key={`bank-match-rule-${value}`} value={value}>
                      {rule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {(importPanelOpen || hasBankImportActivity) && bankImportRows.length > 0 && (
            <>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-slate-600">Property for imported rows</Label>
                  <Select value={bankImportDefaults.propertyId || "none"} onValueChange={(value) => setBankImportDefaults((prev) => ({ ...prev, propertyId: value === "none" ? "" : value, unit: "Shared" }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select property</SelectItem>
                      {propertyOptions.map((property) => (
                        <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Unit</Label>
                  <Select value={bankImportDefaults.unit || "Shared"} onValueChange={(value) => setBankImportDefaults((prev) => ({ ...prev, unit: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bankImportUnitOptions.map((unitName) => (
                        <SelectItem key={`bank-import-unit-${unitName}`} value={unitName}>{unitName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Paid from</Label>
                  <Input className="mt-1" value={bankImportDefaults.paidFrom} onChange={(event) => setBankImportDefaults((prev) => ({ ...prev, paidFrom: event.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Payment method</Label>
                  <Input className="mt-1" value={bankImportDefaults.paymentMethod} onChange={(event) => setBankImportDefaults((prev) => ({ ...prev, paymentMethod: event.target.value }))} />
                </div>
              </div>

              <ResponsiveTableFrame
                className="mt-3"
                minWidthClass="min-w-[560px]"
                hint="Swipe to review imported rows, matched status, and amounts."
                mobileCards={bankImportRows.slice(0, 20).map((row) => {
                  const match = bankImportMatches[row.id];
                  const matchedTxn = match ? transactionById[match.transactionId] : null;
                  const statusLabel = row.importedTransactionId
                    ? (row.alreadyImported ? "Already imported (FITID)" : row.matchedApplied ? "Matched" : "Imported")
                    : matchedTxn
                      ? `Matched (${match.confidence})`
                      : "Unmatched";
                  const statusReason = describeBankRowStatus(row, match, matchedTxn);
                  return (
                    <div key={`bank-preview-card-${row.id}`} className={WORKSPACE_MUTED_PANEL_CLASS}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">{row.description}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.date} | Source line {row.sourceLine}</div>
                        </div>
                        <div className={`text-sm font-semibold ${row.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {row.amount < 0 ? "-" : "+"}{currency(Math.abs(row.amount))}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={matchedTxn && match?.confidence === "high" ? "!bg-blue-100 !text-blue-700" : ""}>{statusLabel}</Badge>
                        {matchedTxn ? <span className="text-[11px] text-slate-500">{matchedTxn.date} | {matchedTxn.description || "(no description)"}</span> : null}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{statusReason}</div>
                    </div>
                  );
                })}
              >
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankImportRows.slice(0, 20).map((row) => {
                      const match = bankImportMatches[row.id];
                      const matchedTxn = match ? transactionById[match.transactionId] : null;
                      const statusReason = describeBankRowStatus(row, match, matchedTxn);
                      return (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-2 py-1">{row.date}</td>
                          <td className="px-2 py-1">
                            <div className="font-medium text-slate-900">{row.description}</div>
                            <div className="text-[11px] text-slate-500">Source line {row.sourceLine}</div>
                          </td>
                          <td className={`px-2 py-1 text-right font-semibold ${row.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            {row.amount < 0 ? "-" : "+"}{currency(Math.abs(row.amount))}
                          </td>
                          <td className="px-2 py-1">
                            {row.importedTransactionId ? (
                              row.alreadyImported ? (
                                <Badge variant="secondary" className="!bg-amber-100 !text-amber-800">Already imported (FITID)</Badge>
                              ) : row.matchedApplied ? (
                                <Badge variant="secondary" className="!bg-blue-100 !text-blue-700">Bank matched</Badge>
                              ) : (
                                <Badge variant="secondary" className="!bg-emerald-100 !text-emerald-700">Imported</Badge>
                              )
                            ) : matchedTxn ? (
                              <div>
                                <Badge variant="secondary" className={match.confidence === "high" ? "!bg-blue-100 !text-blue-700" : ""}>Matched ({match.confidence})</Badge>
                                <div className="mt-1 text-[11px] text-slate-500">{matchedTxn.date} | {matchedTxn.description || "(no description)"}</div>
                              </div>
                            ) : (
                              <Badge variant="secondary">Unmatched</Badge>
                            )}
                            <div className="mt-1 text-[11px] text-slate-500">{statusReason}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
              {bankImportRows.length > 20 && <div className="mt-2 text-xs text-slate-500">Showing first 20 rows in preview.</div>}
            </>
          )}
        </div> : null}

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{modeListPresentation.title}</h2>
            <div className="mt-0.5 text-xs text-slate-500">{modeListPresentation.helper}</div>
          </div>
          <Badge variant="secondary">{displayedTransactions.length} shown</Badge>
        </div>

        {selectedDisplayedReviewIds.length > 0 ? (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-900">{selectedDisplayedReviewIds.length} selected</span>
            {workspaceMode === "attention" ? <Button size="sm" variant="secondary" onClick={() => markTransactionsTaxReviewed(selectedDisplayedReviewIds)} disabled={!selectedBulkReviewIsSafe}>Mark tax reviewed</Button> : null}
            {workspaceMode === "attention" ? <Button size="sm" variant="secondary" onClick={() => useTransactionDatesAsServicePeriods(selectedDisplayedReviewIds)} disabled={!selectedBulkReviewIsSafe}>Use date as service period</Button> : null}
            {workspaceMode === "imports" ? <Button size="sm" variant="secondary" onClick={() => reconcileTransactions(selectedDisplayedReviewIds)} disabled={!selectedBulkReviewIsSafe}>Mark bank matched</Button> : null}
            <Button size="sm" variant="ghost" onClick={clearSelectedReviewIds}>Clear</Button>
            {!selectedBulkReviewIsSafe ? <span className="text-[11px] text-amber-700">Resolve blocking issues before using bulk actions.</span> : null}
          </div>
        ) : null}

        {displayedTransactions.length === 0 ? (
          <div className={LEDGER_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>
            {ledgerView === "review"
              ? "No transactions need review in this scope."
              : ledgerView === "receipts"
                ? "No receipt gaps in this scope."
            : ledgerView === "unreconciled"
              ? "No imported transactions need a bank match in this scope."
              : ledgerView === "imported"
                ? "No statement-sourced transactions are in this scope yet."
                : ledgerView === "recurring"
                  ? "No transactions from recurring templates are in this scope yet."
                  : ledgerView === "tax_open"
                    ? "No tax-open transactions in this scope."
                    : ledgerView === "future"
                      ? "No future-dated transactions in this scope."
                      : "No transactions in this view."}
          </div>
        ) : (
          displayedTransactions.map((t) => (
            (() => {
              const review = transactionReviewById[t.id] || { issues: [], readiness: { key: "ready", label: "Ready" } };
              const { Icon, iconClass, amountClass } = getTransactionVisual(t);
              const rentPeriodLabel = formatRentReportingMonth(t);
              const docCount = linkedDocumentCount(t);
              const issueKeys = new Set(review.issues.map((issue) => issue.key));
              const missingReceipt = issueKeys.has("missing_receipt");
              const needsAsset = issueKeys.has("capital_improvement_needs_asset");
              const isTaxRelevant = isTaxReviewRelevantTransaction(t);
              const taxStatusLabel = transactionTaxStatusLabel(t, review.readiness, isTaxRelevant);
              const scheduleLabel = transactionScheduleLabel(t);
              const categoryStatusLabel = transactionCategoryStatusLabel(t);
              const isFuture = isFutureDatedTransaction(t, todayIso);
              const postingStatusLabel = transactionPostingStatusLabel(t, todayIso);
              const reconciliationStatusLabel = transactionReconciliationStatusLabel(t, todayIso);
              const supportLabel = transactionSupportStatusLabel(t, { missingReceipt, documentCount: docCount });
              const propertyLabel = propertyNameById[t.propertyId] || t.propertyId;
              const counterpartyLabel = t.vendor || t.paidFrom || "";
              return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              className={`w-full rounded-xl border p-3 text-left transition ${selectedTxn?.id === t.id ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"}`}
              onClick={() => openTransaction(t, "ledger", false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openTransaction(t, "ledger", false);
                }
              }}
              onMouseEnter={prefetchTransactionDialog}
              onFocus={prefetchTransactionDialog}
              onTouchStart={prefetchTransactionDialog}
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.1fr)_minmax(360px,1.25fr)_minmax(180px,auto)]">
                <div className="flex min-w-0 gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${iconClass}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      {workspaceMode === "attention" || workspaceMode === "imports" ? (
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={selectedReviewIds.includes(t.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleSelectedReviewId(t.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${t.description || "transaction"} for bulk review`}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{t.description || "(No description)"}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {[counterpartyLabel, t.date, propertyLabel, formatTransactionUnitLabel(t.unit)].filter(Boolean).join(" / ")}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{t.type}</Badge>
                      {t.recurringTemplateId ? <Badge variant="secondary">Recurring</Badge> : null}
                      {isFuture ? <Badge variant="secondary" className="!bg-amber-100 !text-amber-800">Future-dated</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-1.5 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                    <div className="font-medium uppercase text-slate-500">Source</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className={reconciliationStatusLabel === "Bank matched" || reconciliationStatusLabel === "Accepted" ? "!bg-emerald-100 !text-emerald-700" : reconciliationStatusLabel === "Needs bank match" ? "!bg-amber-100 !text-amber-800" : "!bg-blue-100 !text-blue-700"}>
                        {reconciliationStatusLabel}
                      </Badge>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                    <div className="font-medium uppercase text-slate-500">Support</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className={missingReceipt ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-100 !text-emerald-700"}>{supportLabel}</Badge>
                      {docCount > 0 ? <Badge variant="secondary">{docCount} doc{docCount === 1 ? "" : "s"}</Badge> : null}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                    <div className="font-medium uppercase text-slate-500">Tax</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className={taxStatusLabel === "Needs tax review" ? "!bg-amber-100 !text-amber-800" : taxStatusLabel === "Review open" ? "!bg-blue-100 !text-blue-700" : "!bg-blue-100 !text-blue-700"}>
                        {taxStatusLabel}
                      </Badge>
                      {scheduleLabel && taxStatusLabel !== scheduleLabel ? <Badge variant="secondary">{scheduleLabel}</Badge> : null}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                    <div className="font-medium uppercase text-slate-500">Category</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className={postingStatusLabel === "Posted" ? "!bg-blue-100 !text-blue-700" : "!bg-amber-100 !text-amber-800"}>{postingStatusLabel}</Badge>
                      <Badge variant="secondary">{categoryStatusLabel}</Badge>
                      {rentPeriodLabel ? <Badge variant="secondary">{rentPeriodLabel}</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 xl:items-end">
                  <div className={`text-left text-base font-semibold xl:text-right ${t.type === "Expense" ? "text-rose-700" : amountClass}`}>{currency(t.amount)}</div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {needsAsset ? (
                      <Button size="sm" onClick={(event) => { event.stopPropagation(); startCreateAssetFromTransaction(t); }}>
                        Create asset
                      </Button>
                    ) : missingReceipt ? (
                      <Button size="sm" onClick={(event) => { event.stopPropagation(); openTransaction(t, "ledger", false, "missing_receipt"); }}>
                        Attach receipt
                      </Button>
                    ) : (
                      <Button size="sm" onClick={(event) => { event.stopPropagation(); openTransaction(t, "ledger", false); }}>
                        View/Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {review.issues.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                  {review.issues.slice(0, 4).map((issue) => (
                    <button
                      key={`${t.id}-card-${issue.key}`}
                      type="button"
                      className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        openTransaction(t, "ledger", false, issue.key);
                      }}
                    >
                      {issue.label}
                    </button>
                  ))}
                  {review.issues.length > 4 ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">+{review.issues.length - 4}</span> : null}
                  {issueKeys.has("possible_improvement") ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); markTransactionCapitalImprovement(t.id, false); }}>
                        Mark as repair
                      </Button>
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); markTransactionCapitalImprovement(t.id, true); }}>
                        Mark capital improvement
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
              );
            })()
          ))
        )}
      </CardContent>
    </Card>
  );
}
