import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Hammer,
  Landmark,
  ListChecks,
  ReceiptText,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { routeForReviewSection, routeForTransactionReview, runReviewRoute } from "../shared/reviewRouting.js";
import { getLoanYearEndReview } from "../loans/loanReview.js";
import { filterWorkQueue, groupRelatedReviewItems, isGroupedReviewItem, mergeReviewTransactionIssues, sortReviewSeriesMembers, summarizeIssueLabels, transactionReviewPriority } from "./reviewCenterPresentation.js";

function inboxRecords(inbox) {
  if (Array.isArray(inbox)) return inbox;
  if (Array.isArray(inbox?.records)) return inbox.records;
  return [];
}

const REVIEW_MUTED_PANEL_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80";

const REVIEW_SECTION_ICONS = {
  all: ListChecks,
  transactions: ReceiptText,
  documents: FileText,
  assets: Building2,
  maintenance: Hammer,
  leases: ClipboardCheck,
  loans: Landmark,
  tax: FileSearch,
};

const REVIEW_SECTION_TONES = {
  all: "border-slate-200 bg-white text-slate-600",
  transactions: "border-blue-200 bg-blue-50 text-blue-700",
  documents: "border-sky-200 bg-sky-50 text-sky-700",
  assets: "border-indigo-200 bg-indigo-50 text-indigo-700",
  maintenance: "border-orange-200 bg-orange-50 text-orange-700",
  leases: "border-violet-200 bg-violet-50 text-violet-700",
  loans: "border-cyan-200 bg-cyan-50 text-cyan-700",
  tax: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function issueSummary(issues = [], limit = 3) {
  return summarizeIssueLabels(issues, limit).join(", ");
}

function firstIssueHelp(issues = [], fallback = "") {
  return issues.find((issue) => issue.help)?.help || fallback;
}

function transactionFixHint(issues = []) {
  const keys = new Set(issues.map((issue) => issue.key));
  if (keys.has("capital_improvement_needs_asset")) return "Review the asset draft for this capital expense.";
  if (keys.has("unclear_category")) return "Choose the category that describes this transaction.";
  if (keys.has("possible_improvement")) return "Review whether this was a repair or an improvement.";
  if (keys.has("unreconciled_import")) return "Compare the imported payment with its bank record.";
  if (keys.has("missing_receipt")) return "Attach the receipt, or record that support is unavailable.";
  if (keys.has("missing_service_period")) return "Enter the dates this expense covers.";
  if (keys.has("tax_open")) return "Check the source details before marking this reviewed.";
  return "Open the source record and review the flagged details.";
}

function loanReviewSubtitle(record, propertyLabel, currency) {
  if (record.primaryAction === "fill_missing_payments") {
    const missingMonths = Array.isArray(record.missingMonths) ? record.missingMonths : [];
    const monthLabel = missingMonths.length > 0
      ? `Missing ${missingMonths.slice(0, 3).join(", ")}${missingMonths.length > 3 ? ` +${missingMonths.length - 3} more` : ""}`
      : "Missing payment month";
    return `${propertyLabel} | ${monthLabel}`;
  }
  return `${propertyLabel} | Interest ${currency?.(record.summary?.interest || 0)} | Deductible ${currency?.(record.summary?.deductibleInterest || 0)}`;
}

function itemUrgencyLabel(item) {
  const urgency = item?.urgency || "normal";
  if (urgency === "critical") return "Review first";
  if (urgency === "high") return "Review first";
  if (urgency === "medium") return "Complete details";
  if (urgency === "low") return "Final checks";
  return "Normal";
}

function itemUrgencyClass(item) {
  const urgency = item?.urgency || "normal";
  if (urgency === "critical") return "!bg-rose-100 !text-rose-800";
  if (urgency === "high") return "!bg-amber-100 !text-amber-800";
  if (urgency === "medium") return "!bg-blue-100 !text-blue-800";
  return "!bg-slate-100 !text-slate-700";
}

function itemUrgencyIconTone(item) {
  const urgency = item?.urgency || "normal";
  if (urgency === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (urgency === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (urgency === "medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return REVIEW_SECTION_TONES[item?.sectionKey] || REVIEW_SECTION_TONES.all;
}

function ActionRows({ items, emptyText = "No open items here." }) {
  if (!items.length) {
    return <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{emptyText}</div>;
  }
  return items.map((item) => {
    const ItemIcon = REVIEW_SECTION_ICONS[item.sectionKey] || ListChecks;
    return (
    <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${itemUrgencyIconTone(item)}`}>
            <ItemIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-slate-900">{item.title}</div>
              {item.urgency ? (
                <Badge variant="secondary" className={`text-[11px] ${itemUrgencyClass(item)}`}>
                  {itemUrgencyLabel(item)}
                </Badge>
              ) : null}
              {item.groupCount > 1 ? (
                <Badge variant="outline" className="border-slate-300 bg-white text-[11px] text-slate-700">
                  {item.groupCount} records
                </Badge>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{item.subtitle}</div>
          </div>
        </div>
        {item.onAction ? (
          <Button size="sm" variant={item.primary ? "default" : "secondary"} className="shrink-0 gap-2" onClick={item.onAction}>
            <ItemIcon className="h-4 w-4" aria-hidden="true" />
            {item.actionLabel || "Open"}
          </Button>
        ) : null}
      </div>
      {item.what || item.detail ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Array.isArray(item.issueLabels) ? item.issueLabels : String(item.what || item.detail).split(", ")).filter(Boolean).map((label) => (
            <Badge key={label} variant="secondary" className="text-[11px]">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
      {item.fix || item.why ? (
        <div className="mt-2 grid gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {item.fix ? (
            <div>
              <span className="font-semibold text-slate-700">Next step: </span>
              {item.fix}
            </div>
          ) : null}
          {item.why ? (
            <div>
              <span className="font-semibold text-slate-700">Why: </span>
              {item.why}
            </div>
          ) : null}
        </div>
      ) : null}
      {item.secondaryActions?.length > 0 ? (
        <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">Other actions</summary><div className="mt-2 flex flex-wrap gap-1.5">
          {item.secondaryActions.map((action) => (
            <Button key={action.key} size="sm" variant={action.variant || "secondary"} className="h-7 px-2 text-xs" onClick={action.onAction}>
              {action.label}
            </Button>
          ))}
        </div></details>
      ) : null}
      {item.extraContent ? <div className="mt-2">{item.extraContent}</div> : null}
    </div>
    );
  });
}

function LoanYearEndReviewFields({ currency, record, updateLoanYearEndReview, yearFilter }) {
  const loan = record.loan || {};
  const review = getLoanYearEndReview(loan, yearFilter);
  const reviewedEscrowTotal = Number(review.escrowPropertyTaxPaid || 0) + Number(review.escrowInsurancePaid || 0) + Number(review.escrowOtherPaid || 0);
  const escrowDifference = Number(record.summary?.escrow || 0) - reviewedEscrowTotal;
  const updateReviewField = (fieldName, value) => {
    updateLoanYearEndReview?.(loan.id, {
      ...review,
      [fieldName]: value,
      reviewedAt: fieldName === "reviewed" && value ? new Date().toISOString() : review.reviewedAt || "",
    });
  };

  if (!updateLoanYearEndReview || !loan.id) return null;

  const reviewInput = (label, fieldName, placeholder = label) => (
    <label className="min-w-0 text-xs font-medium text-slate-600">
      <span className="mb-1 block truncate">{label}</span>
      <Input
        type="number"
        className="h-9 min-w-0"
        placeholder={placeholder}
        value={review[fieldName] ?? ""}
        onChange={(event) => updateReviewField(fieldName, event.target.value)}
      />
    </label>
  );

  return (
    <details className={`${REVIEW_MUTED_PANEL_CLASS} px-3 py-2`}>
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>1098 / escrow fields</span>
          <span className="font-normal text-slate-500">Escrow difference {currency?.(escrowDifference)}</span>
        </span>
      </summary>
      <div className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
        <label className="flex min-h-9 min-w-0 items-center gap-2 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <input type="checkbox" checked={Boolean(review.form1098Received)} onChange={(event) => updateReviewField("form1098Received", event.target.checked)} />
          <span className="truncate">1098 received</span>
        </label>
        {reviewInput("1098 interest", "form1098Interest")}
        {reviewInput("1098 PMI", "form1098MortgageInsurance")}
        {reviewInput("Points", "form1098Points")}
        {reviewInput("Escrow tax", "escrowPropertyTaxPaid", "Property tax")}
        {reviewInput("Escrow insurance", "escrowInsurancePaid", "Insurance")}
        {reviewInput("Other escrow", "escrowOtherPaid", "Other")}
        {reviewInput("Deductible override", "deductibleInterestOverride", "Deductible interest")}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input className="min-w-0" placeholder="Review notes" value={review.reviewNotes || ""} onChange={(event) => updateReviewField("reviewNotes", event.target.value)} />
        <label className="flex min-h-9 min-w-0 items-center gap-2 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <input type="checkbox" checked={Boolean(review.reviewed)} onChange={(event) => updateReviewField("reviewed", event.target.checked)} />
          <span className="truncate">Reviewed</span>
        </label>
      </div>
    </details>
  );
}

export function ReviewCenterWorkspace({
  actions,
  assetReviewInbox,
  createWorkOrderExpense,
  currency,
  loanReviewInbox,
  maintenanceReviewInbox,
  markTransactionsTaxReviewed,
  markTransactionCapitalImprovement,
  markTransactionSupportUnavailable,
  markLoanYearReviewed,
  navigateWithDashboardContext,
  updateLoanYearEndReview,
  occupancyReviewInbox,
  openAssetEditor,
  openLease,
  openNewLeaseForUnit,
  openOccupancyEditor,
  openTransaction,
  openWorkOrderAttachmentPicker,
  pendingExpenseReviewCount = 0,
  pendingWorkOrderReviewCount = 0,
  propertyNameById = {},
  resetLoanPaymentDraftForLoan,
  reviewNextExpenseQueueItem,
  reviewNextWorkOrderQueueItem,
  setView,
  startCreateAssetFromTransaction,
  startCreateAssetFromWorkOrder,
  taxReviewOpenCount = 0,
  tenantLedgerReviewInbox,
  transactionReviewInbox = [],
  useTransactionDatesAsServicePeriods,
  vendorById = {},
  visibleDocumentsMissingIndex = [],
  visibleSafeSuggestionCount = 0,
  yearFilter,
}) {
  const [activeSection, setActiveSection] = useState("all");
  const [batchPreview, setBatchPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [selectedKey, setSelectedKey] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [trackedReview, setTrackedReview] = useState(null);
  const [reviewNotice, setReviewNotice] = useState("");

  const transactionRecords = mergeReviewTransactionIssues(inboxRecords(transactionReviewInbox), assetReviewInbox?.transactionCandidates || []);
  const transactionReviewIds = new Set(transactionRecords.map((record) => record.transaction?.id).filter(Boolean));
  const assetTransactionCandidates = (assetReviewInbox?.transactionCandidates || []).filter((record) => !transactionReviewIds.has(record.transaction?.id));
  const assetWarningRecords = assetReviewInbox?.assetRecords || [];
  const maintenanceRecords = inboxRecords(maintenanceReviewInbox);
  const occupancyRecords = inboxRecords(occupancyReviewInbox);
  const tenantLedgerRecords = inboxRecords(tenantLedgerReviewInbox);
  const loanRecords = inboxRecords(loanReviewInbox);
  const taxCrossCheckCount = Number(taxReviewOpenCount || 0);

  const runMaintenanceAction = (record) => {
    if (record.primaryAction === "create_expense" || record.primaryAction === "view_expense") return createWorkOrderExpense?.(record.workOrder);
    if (record.primaryAction === "create_asset") return startCreateAssetFromWorkOrder?.(record.workOrder);
    if (record.primaryAction === "attach_file") return openWorkOrderAttachmentPicker?.(record.workOrder);
    return actions?.updateWorkOrderAccounting?.(record.workOrder.id, { accountingReviewed: true });
  };

  const maintenanceActionLabel = (record) => {
    if (record.primaryAction === "create_expense") return record.workOrder.transactionId ? "View expense" : "Create expense";
    if (record.primaryAction === "create_asset") return "Create asset";
    if (record.primaryAction === "attach_file") return "Attach file";
    return "Mark reviewed";
  };

  const runOccupancyAction = (record) => {
    if (record.primaryAction === "add_lease") return openNewLeaseForUnit?.(record.property.id, record.unit.name);
    if (record.primaryAction === "mark_reviewed") {
      (record?.row?.occupancyForUnit || [])
        .filter((period) => !period.reviewed)
        .forEach((period) => actions?.updateUsePeriodReview?.(period.id, { reviewed: true }));
      return;
    }
    return openOccupancyEditor?.(record.property.id, record.unit.name);
  };

  const runLoanAction = (record) => {
    if (record.primaryAction === "fill_missing_payments") {
      setView?.("loans");
      return resetLoanPaymentDraftForLoan?.(record.loan, { paymentDate: `${record.missingMonths?.[0] || `${yearFilter}-01`}-01` });
    }
    if (record.primaryAction === "review_occupancy") return setView?.("leaseHistory");
    if (record.primaryAction === "mark_reviewed") return markLoanYearReviewed?.(record.loan.id, yearFilter);
    return setView?.("loans");
  };

  const executeReviewRoute = (route) => runReviewRoute(route, {
    navigate: (target) => navigateWithDashboardContext ? navigateWithDashboardContext(target) : setView?.(target.view || target),
    openTransaction,
  });

  const transactionItems = transactionRecords.map((record) => {
    const transaction = record.transaction || {};
    const issueKeys = new Set((record.issues || []).map((issue) => issue.key));
    const firstIssueKey = record.issues?.[0]?.key || "";
    const onlyNeedsTaxReview = issueKeys.has("tax_open") && issueKeys.size === 1;
    const openTransactionRoute = routeForTransactionReview(transaction, firstIssueKey);
    const primaryTransactionAction = issueKeys.has("capital_improvement_needs_asset") && startCreateAssetFromTransaction
      ? { label: "Create asset", onAction: () => startCreateAssetFromTransaction?.(transaction) }
      : issueKeys.has("unclear_category")
        ? { label: "Choose category", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "unclear_category")) }
      : issueKeys.has("possible_improvement")
        ? { label: "Review repair or improvement", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "possible_improvement")) }
      : issueKeys.has("unreconciled_import")
        ? { label: "Review bank match", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "unreconciled_import")) }
      : issueKeys.has("missing_receipt")
        ? { label: "Add receipt", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "missing_receipt")) }
        : issueKeys.has("missing_service_period") && useTransactionDatesAsServicePeriods
          ? { label: "Set service period", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "missing_service_period")) }
        : issueKeys.has("tax_open")
            ? { label: "Review tax", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "tax_open")) }
            : { label: "Open transaction", onAction: () => executeReviewRoute(openTransactionRoute) };
    const secondaryActions = [
      issueKeys.has("missing_service_period")
        ? { key: "date-service-period", label: "Use transaction date as service period", onAction: () => setBatchPreview({
            title: "Use the transaction date as its service period?",
            description: `This uses ${transaction.date || "the posted date"} as both the start and end. For a bill covering multiple days, edit the service period instead.`,
            confirmLabel: "Use this date", members: [{ key: `txn-${transaction.id}`, transaction, issueLabels: summarizeIssueLabels(record.issues) }],
            onConfirm: () => useTransactionDatesAsServicePeriods?.([transaction.id]),
          }) }
        : null,
      issueKeys.has("tax_open") && primaryTransactionAction.label !== "Review tax"
        ? { key: "review-tax", label: "Review tax", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "tax_open")) }
        : null,
      issueKeys.has("possible_improvement")
        ? { key: "mark-repair", label: "Mark repair", onAction: () => markTransactionCapitalImprovement?.(transaction.id, false) }
        : null,
      issueKeys.has("possible_improvement")
        ? { key: "mark-capital", label: "Mark capital", onAction: () => markTransactionCapitalImprovement?.(transaction.id, true) }
        : null,
      issueKeys.has("capital_improvement_needs_asset")
        ? primaryTransactionAction.label === "Create asset" ? null : { key: "create-asset", label: "Create asset", variant: "default", onAction: () => startCreateAssetFromTransaction?.(transaction) }
        : null,
      primaryTransactionAction.label !== "Open transaction"
        ? { key: "open-transaction", label: "Open transaction", onAction: () => executeReviewRoute(openTransactionRoute) }
        : null,
      onlyNeedsTaxReview
        ? { key: "mark-reviewed", label: "Mark reviewed", onAction: () => markTransactionsTaxReviewed?.([transaction.id]) }
        : null,
      issueKeys.has("missing_receipt")
        ? { key: "support-unavailable", label: "Mark support unavailable", variant: "ghost", onAction: () => markTransactionSupportUnavailable?.(transaction.id) }
        : null,
    ].filter(Boolean);
    return {
      key: `txn-${transaction.id}`,
      groupKey: transaction.recurringTemplateId ? `recurring:${transaction.recurringTemplateId}:${transaction.propertyId || ""}:${transaction.unit || ""}` : "",
      groupTitle: transaction.description || transaction.vendor || transaction.category || "Recurring transactions",
      groupActionLabel: "Review first",
      sectionKey: "transactions",
      title: transaction.vendor || transaction.description || transaction.category || "Transaction",
      subtitle: `${propertyNameById[transaction.propertyId] || "Property not set"} | ${transaction.date || "No date"}${transaction.unit ? ` | Unit ${transaction.unit}` : ""} | ${currency?.(Number(transaction.amount || 0))}`,
      what: issueSummary(record.issues),
      issueLabels: summarizeIssueLabels(record.issues),
      issueKeys: [...issueKeys],
      checkCount: Math.max(1, record.issues?.length || 0),
      transaction,
      why: firstIssueHelp(record.issues, "This ledger row is not ready for source-record confidence yet."),
      fix: primaryTransactionAction.label === "Set service period" ? "Enter the dates this expense covers." : transactionFixHint(record.issues),
      urgency: transactionReviewPriority(record.issues),
      actionLabel: primaryTransactionAction.label,
      onAction: primaryTransactionAction.onAction,
      route: openTransactionRoute,
      primary: true,
      secondaryActions,
    };
  });

  const documentItems = [
    pendingExpenseReviewCount > 0
      ? { key: "doc-expense", sectionKey: "documents", title: "Bills ready for transaction review", subtitle: `${pendingExpenseReviewCount} draft${pendingExpenseReviewCount === 1 ? "" : "s"} waiting`, what: "Bills or receipts have OCR-filled transaction drafts waiting.", why: "Reviewing the draft before posting keeps dates, categories, service periods, and document links clean.", fix: "Check the original and confirm the expense details.", urgency: "medium", actionLabel: "Review next bill", onAction: reviewNextExpenseQueueItem, primary: true }
      : null,
    pendingWorkOrderReviewCount > 0
      ? { key: "doc-work-order", sectionKey: "documents", title: "Work-order drafts from documents", subtitle: `${pendingWorkOrderReviewCount} draft${pendingWorkOrderReviewCount === 1 ? "" : "s"} waiting`, what: "Maintenance documents look like work-order drafts.", why: "Work orders need the right accounting treatment before they become source support.", fix: "Work-order draft ready.", urgency: "high", actionLabel: "Review next", onAction: reviewNextWorkOrderQueueItem }
      : null,
    visibleDocumentsMissingIndex.length > 0
      ? { key: "doc-ocr", sectionKey: "documents", title: "Documents need readable text", subtitle: `${visibleDocumentsMissingIndex.length} file${visibleDocumentsMissingIndex.length === 1 ? "" : "s"} need extraction`, what: "Uploaded files do not have searchable text yet.", why: "OCR text powers draft suggestions, matching, and later audit search.", fix: "OCR/text extraction pending.", urgency: "medium", actionLabel: "Open Documents", onAction: () => setView?.("documents") }
      : null,
    visibleSafeSuggestionCount > 0
      ? { key: "doc-safe", sectionKey: "documents", title: "Document suggestions to review", subtitle: `${visibleSafeSuggestionCount} suggested update${visibleSafeSuggestionCount === 1 ? "" : "s"}`, what: "The app found low-risk tags or links to apply.", why: "Applying safe suggestions reduces loose support documents.", fix: "Suggested tags/links ready.", urgency: "low", actionLabel: "Open Documents", onAction: () => setView?.("documents") }
      : null,
  ].filter(Boolean);

  const assetItems = [
    ...assetTransactionCandidates.map((record) => ({
      key: `asset-txn-${record.transaction.id}`,
      sectionKey: "assets",
      title: record.transaction.vendor || record.transaction.description || "Capital-improvement candidate",
      subtitle: `${record.transaction.date || "No date"} | ${propertyNameById[record.transaction.propertyId] || record.transaction.propertyId} | ${currency?.(Number(record.transaction.amount || 0))}`,
      what: issueSummary(record.issues),
      why: firstIssueHelp(record.issues, "Capital-improvement source support should tie to an asset before depreciation review."),
      fix: "Asset link needed.",
      urgency: "high",
      actionLabel: "Create asset",
      onAction: () => startCreateAssetFromTransaction?.(record.transaction),
      primary: true,
    })),
    ...assetWarningRecords.map((record) => ({
      key: `asset-warning-${record.asset.id}`,
      sectionKey: "assets",
      title: record.asset.description || "Asset warning",
      subtitle: `${propertyNameById[record.asset.propertyId] || record.asset.propertyId} | Service ${record.asset.placedInService || "Missing"}`,
      what: issueSummary(record.issues),
      why: firstIssueHelp(record.issues, "Asset depreciation support needs complete source fields."),
      fix: "Asset fields incomplete.",
      urgency: "medium",
      actionLabel: "Edit asset",
      onAction: () => openAssetEditor?.(record.asset),
    })),
  ];

  const maintenanceItems = maintenanceRecords.map((record) => {
    const workOrder = record.workOrder || {};
    const vendorLabel = workOrder.vendorId ? (vendorById[workOrder.vendorId]?.name || "Unknown vendor") : "Unassigned";
    return {
      key: `maintenance-${workOrder.id}`,
      sectionKey: "maintenance",
      title: workOrder.title || "Work order",
      subtitle: `${propertyNameById[workOrder.propertyId] || workOrder.propertyId} | Unit ${workOrder.unit || "Shared"} | ${workOrder.status || "Open"} | ${vendorLabel}`,
      what: issueSummary(record.issues),
      why: firstIssueHelp(record.issues, "Maintenance records need support and accounting treatment before they are reliable source records."),
      fix: maintenanceActionLabel(record),
      urgency: record.primaryAction === "create_expense" || record.primaryAction === "create_asset" ? "high" : "medium",
      actionLabel: maintenanceActionLabel(record),
      onAction: () => runMaintenanceAction(record),
      primary: true,
    };
  });

  const occupancyItems = occupancyRecords.map((record) => ({
    key: `occupancy-${record.property?.id}-${record.unit?.name}`,
    sectionKey: "leases",
    title: `${record.property?.name || "Property"} | Unit ${record.unit?.name || ""}`,
    subtitle: `${record.row?.auditStart || yearFilter} to ${record.row?.auditEnd || yearFilter} | Occupancy coverage`,
    what: issueSummary(record.issues),
    why: firstIssueHelp(record.issues, "Occupancy coverage drives owner/rental allocation for mixed-use periods."),
    fix: record.primaryAction === "add_lease" ? "Lease missing." : record.primaryAction === "mark_reviewed" ? "Owner/vacancy review open." : "Occupancy period review.",
    urgency: record.primaryAction === "add_lease" ? "high" : "high",
    actionLabel: record.primaryAction === "add_lease" ? "Add lease" : record.primaryAction === "mark_reviewed" ? "Mark reviewed" : "Manage",
    onAction: () => runOccupancyAction(record),
    primary: true,
  }));

  const tenantLedgerItems = tenantLedgerRecords.map((record) => ({
    key: `tenant-ledger-${record.lease?.id}`,
    sectionKey: "leases",
    title: record.lease?.tenantName || "Tenant ledger",
    subtitle: `Unit ${record.lease?.unit || ""} | Balance ${currency?.(record.summary?.totalDue || 0)} | Credit ${currency?.(record.summary?.tenantCredit || 0)}`,
    what: issueSummary(record.issues),
    why: firstIssueHelp(record.issues, "Tenant ledger cleanup prevents income, deposit, and credit confusion."),
    fix: "Tenant ledger posting review.",
    urgency: "high",
    actionLabel: "Open lease",
    onAction: () => openLease?.(record.lease),
  }));

  const loanItems = loanRecords.map((record) => {
    const isReviewFieldAction = record.primaryAction === "review_1098" || record.primaryAction === "review_escrow";
    const isOccupancyAction = record.primaryAction === "review_occupancy";
    const propertyLabel = propertyNameById[record.loan?.propertyId] || record.loan?.propertyId || "Property";
    return {
      key: `loan-${record.loan?.id}`,
      sectionKey: "loans",
      title: record.loan?.lender || record.loan?.name || "Loan",
      subtitle: loanReviewSubtitle(record, propertyLabel, currency),
      what: issueSummary(record.issues),
      why: firstIssueHelp(record.issues, "Loan review keeps interest, escrow, PMI, and principal from being mixed together."),
      fix: record.primaryAction === "fill_missing_payments"
        ? "Payment month missing."
        : record.primaryAction === "mark_reviewed"
          ? "Loan year review open."
          : isOccupancyAction
            ? "Occupancy dependency open."
            : "Year-end loan fields open.",
      urgency: record.primaryAction === "fill_missing_payments" ? "high" : isOccupancyAction ? "high" : "medium",
      actionLabel: record.primaryAction === "fill_missing_payments" ? "Add payment" : record.primaryAction === "mark_reviewed" ? "Mark reviewed" : isOccupancyAction ? "Review occupancy" : undefined,
      onAction: isReviewFieldAction ? undefined : () => runLoanAction(record),
      primary: record.primaryAction === "fill_missing_payments" || record.primaryAction === "mark_reviewed",
      extraContent: <LoanYearEndReviewFields currency={currency} record={record} updateLoanYearEndReview={updateLoanYearEndReview} yearFilter={yearFilter} />,
    };
  });

  const allItems = useMemo(
    () => [
      ...documentItems,
      ...transactionItems,
      ...assetItems,
      ...maintenanceItems,
      ...occupancyItems,
      ...tenantLedgerItems,
      ...loanItems,
    ],
    [documentItems, transactionItems, assetItems, maintenanceItems, occupancyItems, tenantLedgerItems, loanItems],
  );
  const groupedAllItems = useMemo(() => groupRelatedReviewItems(allItems).map((item) => {
    if (!isGroupedReviewItem(item) || item.sectionKey !== "transactions") return item;
    const members = sortReviewSeriesMembers(item.memberItems || []);
    const transactionIds = members.map((member) => member.transaction?.id).filter(Boolean);
    const dates = members.map((member) => String(member.transaction?.date || "")).filter(Boolean).sort();
    const totalAmount = members.reduce((sum, member) => sum + Number(member.transaction?.amount || 0), 0);
    const allHaveIssue = (issueKey) => members.every((member) => member.issueKeys?.includes(issueKey));
    const onlyTaxReview = members.every((member) => member.issueKeys?.length === 1 && member.issueKeys[0] === "tax_open");
    const batchActions = [
      allHaveIssue("missing_receipt") && markTransactionSupportUnavailable
        ? {
            key: "series-support-unavailable",
            label: "Review support for series",
            onAction: () => setBatchPreview({
              title: "Mark support unavailable for this series?",
              description: "This records that a receipt or document is unavailable for every listed transaction. It does not mark the tax review complete.",
              confirmLabel: `Apply to ${transactionIds.length} transactions`,
              members,
              onConfirm: () => transactionIds.forEach((id) => markTransactionSupportUnavailable(id)),
            }),
          }
        : null,
      allHaveIssue("missing_service_period") && useTransactionDatesAsServicePeriods
        ? {
            key: "series-service-period",
            label: "Set dates for series",
            onAction: () => setBatchPreview({
              title: "Use each transaction date as its service period?",
              description: "Each listed transaction will use its own posted date as both the service-period start and end.",
              confirmLabel: `Apply to ${transactionIds.length} transactions`,
              members,
              onConfirm: () => useTransactionDatesAsServicePeriods(transactionIds),
            }),
          }
        : null,
      onlyTaxReview && markTransactionsTaxReviewed
        ? {
            key: "series-tax-reviewed",
            label: "Review series",
            onAction: () => setBatchPreview({
              title: "Mark this recurring series reviewed?",
              description: "Every listed transaction has only the final tax-review check open.",
              confirmLabel: `Mark ${transactionIds.length} reviewed`,
              members,
              onConfirm: () => markTransactionsTaxReviewed(transactionIds),
            }),
          }
        : null,
    ].filter(Boolean);
    const dateRange = dates.length > 1 ? `${dates[0]} to ${dates.at(-1)}` : dates[0] || "Dates not set";

    return {
      ...item,
      subtitle: `${members.length} recurring transactions | ${dateRange} | ${currency?.(totalAmount)} total`,
      fix: `${members.length} related records can be reviewed as one series.`,
      why: "Grouping keeps repeated monthly issues together without assuming unrelated transactions are the same.",
      secondaryActions: batchActions,
      extraContent: (
        <details className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Preview {members.length} transactions</summary>
          <div className="mt-2 divide-y divide-slate-200">
            {members.map((member) => (
              <div key={member.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{member.transaction?.date || "No date"} | {currency?.(Number(member.transaction?.amount || 0))}</div>
                  <div className="truncate text-slate-500">{member.issueLabels?.join(", ") || "Review open"}</div>
                </div>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={member.onAction}>Review</Button>
              </div>
            ))}
          </div>
        </details>
      ),
    };
  }), [allItems, currency, markTransactionSupportUnavailable, markTransactionsTaxReviewed, useTransactionDatesAsServicePeriods]);
  const sectionTabs = [
    { key: "all", label: "All tasks" },
    { key: "transactions", label: "Transactions" },
    { key: "documents", label: "Documents" },
    { key: "assets", label: "Assets" },
    { key: "maintenance", label: "Maintenance" },
    { key: "leases", label: "Leases" },
    { key: "loans", label: "Loans" },
  ].map((tab) => ({ ...tab, count: groupedAllItems.filter((item) => tab.key === "all" || item.sectionKey === tab.key).length }));
  const filteredItems = filterWorkQueue(groupedAllItems, { section: activeSection, priority, query });
  const visibleItems = filteredItems.slice(0, visibleLimit);
  const selectedItem = filteredItems.find((item) => item.key === selectedKey) || visibleItems[0] || null;
  const priorityCount = groupedAllItems.filter((item) => item.urgency === "high").length;
  const selectedSignature = (item) => JSON.stringify(item?.memberItems
    ? item.memberItems.map((member) => [member.key, member.what])
    : [item?.what, item?.subtitle]);

  useEffect(() => { setVisibleLimit(20); setSelectedKey(""); }, [activeSection, priority, query]);
  useEffect(() => { setTrackedReview(null); setReviewNotice(""); setSelectedKey(""); }, [yearFilter]);
  useEffect(() => {
    if (!trackedReview || trackedReview.year !== yearFilter) return;
    const current = groupedAllItems.find((item) => item.key === trackedReview.key);
    if (!current) {
      // A shrinking series can become one ungrouped record; that is progress, not completion.
      const remaining = groupedAllItems.some((item) => [item, ...(item.memberItems || [])].some((member) => trackedReview.memberKeys.includes(member.key)));
      setReviewNotice(remaining ? `${trackedReview.title}: fewer records need review.` : `${trackedReview.title}: no open checks remain in this queue.`);
      setTrackedReview(null);
    } else if (selectedSignature(current) !== trackedReview.signature) {
      setReviewNotice(`${trackedReview.title}: updated. Check the remaining items below.`);
      setTrackedReview(null);
    }
  }, [groupedAllItems, trackedReview, yearFilter]);

  const trackAction = (item, action) => async () => {
    setReviewNotice("");
    setTrackedReview({ key: item.key, title: item.title, signature: selectedSignature(item), year: yearFilter,
      memberKeys: (item.memberItems || [item]).map((member) => member.key) });
    try { await action?.(); }
    catch { setTrackedReview(null); setReviewNotice("That action did not finish. Your task is still available; try again or open the source record."); }
  };
  const detailItem = selectedItem ? { ...selectedItem,
    onAction: selectedItem.onAction ? trackAction(selectedItem, selectedItem.onAction) : undefined,
    secondaryActions: selectedItem.secondaryActions?.map((action) => ({ ...action, onAction: trackAction(selectedItem, action.onAction) })),
  } : null;

  return (
    <>
      <Card className="overflow-hidden shadow-none">
        <CardContent className="space-y-4 !p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{groupedAllItems.length ? `${groupedAllItems.length} task${groupedAllItems.length === 1 ? "" : "s"} to work through` : "Your work queue is clear"}</h2>
              <p className="mt-1 text-sm text-slate-600">Choose a task, review the issue, and fix its source record. Completed checks leave the queue automatically.</p>
              <p className="mt-1 text-xs text-slate-500">{priorityCount} to review first · Related recurring records stay together. Counts show tasks, not individual checks.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span>Tax Center has {taxCrossCheckCount} cross-check{taxCrossCheckCount === 1 ? "" : "s"}. These summarize your records separately.</span>
            <Button variant="ghost" size="sm" onClick={() => executeReviewRoute(routeForReviewSection("tax"))}>Open Tax Overview</Button>
          </div>
          {reviewNotice ? <div role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{reviewNotice}</div> : null}
          <div className="flex flex-wrap gap-2" aria-label="Task areas">
            {sectionTabs.map((tab) => (
              <Button key={tab.key} size="sm" variant={activeSection === tab.key ? "default" : "secondary"}
                aria-pressed={activeSection === tab.key} onClick={() => setActiveSection(tab.key)}>
                {tab.label} ({tab.count})
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
            <label className="text-xs font-medium text-slate-600">Find a task
              <Input className="mt-1" placeholder="Search vendor, property, date, or issue" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="text-xs font-medium text-slate-600">Priority
              <select aria-label="Priority" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="all">All priorities</option><option value="high">Review first</option><option value="medium">Complete details</option><option value="low">Final checks</option>
              </select>
            </label>
          </div>
          <div className="text-xs text-slate-500">Review first covers accounting decisions and missing records. It does not mean a payment is overdue.</div>
          {filteredItems.length ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
              <section aria-label="Open tasks" className="space-y-2">
                <div className="text-xs text-slate-500">Showing {visibleItems.length} of {filteredItems.length} tasks</div>
                <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                  {visibleItems.map((item) => (
                    <button type="button" key={item.key} aria-pressed={selectedItem?.key === item.key} onClick={() => setSelectedKey(item.key)}
                      className={`w-full rounded-lg border p-3 text-left ${selectedItem?.key === item.key ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900">{item.title}</span><span className="shrink-0 text-xs text-slate-600">{itemUrgencyLabel(item)}</span></div>
                      <div className="mt-1 text-xs text-slate-500">{item.subtitle}</div>
                      <div className="mt-2 text-sm text-slate-700">{item.what}</div>
                    </button>
                  ))}
                </div>
                {visibleItems.length < filteredItems.length ? <Button variant="secondary" onClick={() => setVisibleLimit((count) => count + 20)}>Show more tasks ({filteredItems.length - visibleItems.length} remaining)</Button> : null}
              </section>
              <section aria-label="Selected task" className="min-w-0 space-y-2 lg:sticky lg:top-4">
                <h3 className="text-sm font-semibold text-slate-700">Review and resolve</h3>
                <ActionRows items={[detailItem]} />
                <p className="text-xs text-slate-500">Opening a record does not complete this task. Save the correction, then check what remains.</p>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <div className="font-semibold text-slate-800">{groupedAllItems.length ? "No tasks match these filters" : "No open source-record tasks"}</div>
              <p className="mt-1 text-sm text-slate-500">{groupedAllItems.length ? "Try another area or clear your search and priority filter." : "Tax cross-checks remain available above. This view reflects the selected property, unit, and year."}</p>
              {groupedAllItems.length ? <Button className="mt-3" variant="secondary" onClick={() => { setQuery(""); setPriority("all"); setActiveSection("all"); }}>Reset filters</Button> : null}
            </div>
          )}
        </CardContent>
      </Card>
    <Dialog open={Boolean(batchPreview)} onOpenChange={(open) => { if (!open) setBatchPreview(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{batchPreview?.title || "Review recurring series"}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600">{batchPreview?.description}</div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          {(batchPreview?.members || []).map((member) => (
            <div key={member.key} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
              <div>
                <div className="font-medium text-slate-800">{member.transaction?.date || "No date"}</div>
                <div className="text-xs text-slate-500">{member.issueLabels?.join(", ") || "Review open"}</div>
              </div>
              <div className="font-semibold text-slate-800">{currency?.(Number(member.transaction?.amount || 0))}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setBatchPreview(null)}>Cancel</Button>
          <Button onClick={() => {
            const action = batchPreview?.onConfirm;
            setBatchPreview(null);
            action?.();
          }}>{batchPreview?.confirmLabel || "Apply"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
