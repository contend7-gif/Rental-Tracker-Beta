import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
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
import { Input } from "../../components/ui/input";
import { readinessBadgeClass } from "../shared/auditBadges.js";
import { routeForReviewSection, routeForTransactionReview, runReviewRoute } from "../shared/reviewRouting.js";
import { getLoanYearEndReview } from "../loans/loanReview.js";
import { sortReviewItems, splitDoFirstItems, summarizeIssueLabels, summarizeReviewSections, visibleReviewItemsForSection } from "./reviewCenterPresentation.js";

function inboxRecords(inbox) {
  if (Array.isArray(inbox)) return inbox;
  if (Array.isArray(inbox?.records)) return inbox.records;
  return [];
}

function statusClass(count) {
  return readinessBadgeClass(count > 0 ? { key: "needs_review", issueCount: count } : { key: "ready" });
}

const REVIEW_PANEL_CLASS = "rounded-xl border border-slate-200 bg-white shadow-none";
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
  if (keys.has("missing_receipt")) return "Receipt/support missing.";
  if (keys.has("missing_service_period")) return "Service period missing.";
  if (keys.has("unclear_category")) return "Category needs review.";
  if (keys.has("possible_improvement")) return "Repair vs capital decision.";
  if (keys.has("capital_improvement_needs_asset")) return "Asset link needed.";
  if (keys.has("unreconciled_import")) return "Bank match open.";
  if (keys.has("tax_open")) return "Tax review open.";
  return "Source record needs review.";
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
  if (urgency === "critical") return "Critical";
  if (urgency === "high") return "High";
  if (urgency === "medium") return "Normal";
  if (urgency === "low") return "Low";
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

function transactionUrgency(issues = []) {
  const keys = new Set(issues.map((issue) => issue.key));
  if (keys.has("capital_improvement_needs_asset") || keys.has("missing_service_period")) return "critical";
  if (keys.has("missing_receipt") || keys.has("unclear_category") || keys.has("possible_improvement")) return "high";
  if (keys.has("unreconciled_import") || keys.has("tax_open")) return "medium";
  return "normal";
}

function ReviewSection({ sectionKey, activeSection, title, helper, count, badges = [], actionLabel, onAction, children }) {
  if (activeSection !== sectionKey) return null;
  const Icon = REVIEW_SECTION_ICONS[sectionKey] || ListChecks;
  const iconTone = REVIEW_SECTION_TONES[sectionKey] || REVIEW_SECTION_TONES.all;
  return (
    <div className={`${REVIEW_MUTED_PANEL_CLASS} p-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className={`mt-0.5 rounded-lg border p-1.5 ${iconTone}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <Badge variant="secondary" className={statusClass(count)}>
                {count > 0 ? `${count} open` : "Clear"}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500">{count > 0 ? helper : `${title} clear`}</div>
          </div>
        </div>
        {onAction ? (
          <Button size="sm" variant="secondary" className="shrink-0 gap-2" onClick={onAction}>
            <Icon className="h-4 w-4" />
            {actionLabel || "Open"}
          </Button>
        ) : null}
      </div>
      {badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge key={badge} variant="secondary" className="text-[11px]">
              {badge}
            </Badge>
          ))}
        </div>
      ) : null}
      {children ? <div className="mt-3 space-y-2">{children}</div> : null}
    </div>
  );
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
              <span className="font-semibold text-slate-700">Fix: </span>
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.secondaryActions.map((action) => (
            <Button key={action.key} size="sm" variant={action.variant || "secondary"} className="h-7 px-2 text-xs" onClick={action.onAction}>
              {action.label}
            </Button>
          ))}
        </div>
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
  taxReadinessSummary,
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

  const transactionRecords = inboxRecords(transactionReviewInbox);
  const assetTransactionCandidates = assetReviewInbox?.transactionCandidates || [];
  const assetWarningRecords = assetReviewInbox?.assetRecords || [];
  const maintenanceRecords = inboxRecords(maintenanceReviewInbox);
  const occupancyRecords = inboxRecords(occupancyReviewInbox);
  const tenantLedgerRecords = inboxRecords(tenantLedgerReviewInbox);
  const loanRecords = inboxRecords(loanReviewInbox);
  const assetReviewCount = assetTransactionCandidates.length + assetWarningRecords.length;
  const documentReviewCount = Number(pendingExpenseReviewCount || 0) + Number(pendingWorkOrderReviewCount || 0) + visibleDocumentsMissingIndex.length + Number(visibleSafeSuggestionCount || 0);
  const leaseReviewCount = occupancyRecords.length + tenantLedgerRecords.length;
  const totalOpen =
    transactionRecords.length +
    documentReviewCount +
    assetReviewCount +
    maintenanceRecords.length +
    leaseReviewCount +
    loanRecords.length +
    Number(taxReviewOpenCount || 0);

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
      : issueKeys.has("missing_receipt")
        ? { label: "Add receipt", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "missing_receipt")) }
        : issueKeys.has("missing_service_period") && useTransactionDatesAsServicePeriods
          ? { label: "Set service period", onAction: () => useTransactionDatesAsServicePeriods?.([transaction.id]) }
        : issueKeys.has("tax_open")
            ? { label: "Review tax", onAction: () => executeReviewRoute(routeForTransactionReview(transaction, "tax_open")) }
            : { label: "Open transaction", onAction: () => executeReviewRoute(openTransactionRoute) };
    const secondaryActions = [
      issueKeys.has("missing_service_period")
        ? primaryTransactionAction.label === "Set service period" ? null : { key: "date-service-period", label: "Set date as period", onAction: () => useTransactionDatesAsServicePeriods?.([transaction.id]) }
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
      sectionKey: "transactions",
      title: transaction.vendor || transaction.description || transaction.category || "Transaction",
      subtitle: `${transaction.date || "No date"}${transaction.unit ? ` | Unit ${transaction.unit}` : ""} | ${currency?.(Number(transaction.amount || 0))}`,
      what: issueSummary(record.issues),
      issueLabels: summarizeIssueLabels(record.issues),
      why: firstIssueHelp(record.issues, "This ledger row is not ready for source-record confidence yet."),
      fix: transactionFixHint(record.issues),
      urgency: transactionUrgency(record.issues),
      actionLabel: primaryTransactionAction.label,
      onAction: primaryTransactionAction.onAction,
      route: openTransactionRoute,
      primary: true,
      secondaryActions,
    };
  });

  const documentItems = [
    pendingExpenseReviewCount > 0
      ? { key: "doc-expense", sectionKey: "documents", title: "Bills ready for transaction review", subtitle: `${pendingExpenseReviewCount} draft${pendingExpenseReviewCount === 1 ? "" : "s"} waiting`, what: "Bills or receipts have OCR-filled transaction drafts waiting.", why: "Reviewing the draft before posting keeps dates, categories, service periods, and document links clean.", fix: "Bill draft ready for posting.", urgency: "critical", actionLabel: "Review next bill", onAction: reviewNextExpenseQueueItem, primary: true }
      : null,
    pendingWorkOrderReviewCount > 0
      ? { key: "doc-work-order", sectionKey: "documents", title: "Work-order drafts from documents", subtitle: `${pendingWorkOrderReviewCount} draft${pendingWorkOrderReviewCount === 1 ? "" : "s"} waiting`, what: "Maintenance documents look like work-order drafts.", why: "Work orders need the right accounting treatment before they become source support.", fix: "Work-order draft ready.", urgency: "high", actionLabel: "Review next", onAction: reviewNextWorkOrderQueueItem }
      : null,
    visibleDocumentsMissingIndex.length > 0
      ? { key: "doc-ocr", sectionKey: "documents", title: "Documents need OCR/text", subtitle: `${visibleDocumentsMissingIndex.length} file${visibleDocumentsMissingIndex.length === 1 ? "" : "s"} need extraction`, what: "Uploaded files do not have searchable text yet.", why: "OCR text powers draft suggestions, matching, and later audit search.", fix: "OCR/text extraction pending.", urgency: "medium", actionLabel: "Open Documents", onAction: () => setView?.("documents") }
      : null,
    visibleSafeSuggestionCount > 0
      ? { key: "doc-safe", sectionKey: "documents", title: "Safe document suggestions", subtitle: `${visibleSafeSuggestionCount} suggested update${visibleSafeSuggestionCount === 1 ? "" : "s"}`, what: "The app found low-risk tags or links to apply.", why: "Applying safe suggestions reduces loose support documents.", fix: "Suggested tags/links ready.", urgency: "low", actionLabel: "Open Documents", onAction: () => setView?.("documents") }
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
    urgency: record.primaryAction === "add_lease" ? "critical" : "high",
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
      urgency: record.primaryAction === "fill_missing_payments" ? "critical" : isOccupancyAction ? "high" : "medium",
      actionLabel: record.primaryAction === "fill_missing_payments" ? "Add payment" : record.primaryAction === "mark_reviewed" ? "Mark reviewed" : isOccupancyAction ? "Review occupancy" : undefined,
      onAction: isReviewFieldAction ? undefined : () => runLoanAction(record),
      primary: record.primaryAction === "fill_missing_payments" || record.primaryAction === "mark_reviewed",
      extraContent: <LoanYearEndReviewFields currency={currency} record={record} updateLoanYearEndReview={updateLoanYearEndReview} yearFilter={yearFilter} />,
    };
  });

  const taxItems = Number(taxReviewOpenCount || 0) > 0
    ? [{
        key: "tax-open",
        sectionKey: "tax",
        title: "Tax Center source readiness",
        subtitle: `${taxReviewOpenCount} source cleanup item${taxReviewOpenCount === 1 ? "" : "s"} still open`,
        what: "Tax Center still sees source cleanup before totals should be relied on.",
        why: "The Tax Overview is the final cross-check across documents, ledger, assets, leases, and loans.",
        fix: "Tax readiness open.",
        urgency: "medium",
        actionLabel: "Open Tax Overview",
        onAction: () => executeReviewRoute(routeForReviewSection("tax")),
      }]
    : [];

  const allItems = useMemo(
    () => [
      ...documentItems,
      ...transactionItems,
      ...assetItems,
      ...maintenanceItems,
      ...occupancyItems,
      ...tenantLedgerItems,
      ...loanItems,
      ...taxItems,
    ],
    [documentItems, transactionItems, assetItems, maintenanceItems, occupancyItems, tenantLedgerItems, loanItems, taxItems],
  );
  const sortedAllItems = useMemo(() => sortReviewItems(allItems), [allItems]);
  const { doFirstItems, remainingItems } = useMemo(() => splitDoFirstItems(sortedAllItems, 3), [sortedAllItems]);

  const sectionTabs = [
    { key: "all", label: "All", count: totalOpen },
    { key: "documents", label: "Documents", count: documentReviewCount },
    { key: "transactions", label: "Transactions", count: transactionRecords.length },
    { key: "assets", label: "Assets", count: assetReviewCount },
    { key: "maintenance", label: "Maintenance", count: maintenanceRecords.length },
    { key: "leases", label: "Leases", count: leaseReviewCount },
    { key: "loans", label: "Loans", count: loanRecords.length },
    { key: "tax", label: "Tax", count: Number(taxReviewOpenCount || 0) },
  ];

  const activeTab = sectionTabs.find((tab) => tab.key === activeSection) || sectionTabs[0];
  const sectionInsight = summarizeReviewSections(sectionTabs);
  const nextActionItem = doFirstItems[0] || sortedAllItems[0] || null;
  const visibleNextItems = activeSection === "all"
    ? remainingItems.slice(0, 8)
    : visibleReviewItemsForSection(allItems, activeSection, doFirstItems, 10);

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 !p-3">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.55fr)_minmax(220px,0.55fr)_auto]">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {totalOpen > 0 ? `${totalOpen} open checks` : "Review complete"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {totalOpen > 0
                ? "Work this list before relying on year-end totals. The highest-risk items stay at the top."
                : "All selected records are ready for this review scope."}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-slate-500">Main driver</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sectionInsight.primarySection ? sectionInsight.primarySection.label : "Nothing open"}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {sectionInsight.primarySection ? `${sectionInsight.primarySection.count} item${sectionInsight.primarySection.count === 1 ? "" : "s"} in this area` : `${sectionInsight.clearSectionCount} areas clear`}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-slate-500">Workspace health</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {sectionInsight.openSectionCount} open / {sectionInsight.clearSectionCount} clear
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Across the selected scope</div>
          </div>
          {nextActionItem?.onAction ? (
            <Button className="self-center justify-self-start xl:justify-self-end" onClick={nextActionItem.onAction}>
              {nextActionItem.actionLabel || "Start next"}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {sectionTabs.map((tab) => {
            const TabIcon = REVIEW_SECTION_ICONS[tab.key] || ListChecks;
            const tabActive = activeSection === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`flex min-h-10 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${tabActive ? "border-slate-900 bg-slate-900 text-white shadow-none" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"}`}
                onClick={() => setActiveSection(tab.key)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${tabActive ? "border-white/20 bg-white/10 text-white" : REVIEW_SECTION_TONES[tab.key] || REVIEW_SECTION_TONES.all}`}>
                    <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{tab.label}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${tabActive ? "bg-white/15 text-white" : tab.count > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{tab.count > 0 ? tab.count : "Clear"}</span>
              </button>
            );
          })}
        </div>

        {activeSection === "all" && doFirstItems.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <div className="mt-0.5 rounded-lg border border-amber-200 bg-white p-1.5 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                <div className="text-sm font-semibold text-slate-900">Do first</div>
                <div className="mt-1 text-xs text-amber-900">Highest priority open checks.</div>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
                Top {doFirstItems.length} priority item{doFirstItems.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 xl:grid-cols-3">
              <ActionRows items={doFirstItems} />
            </div>
          </div>
        ) : null}

        {visibleNextItems.length > 0 || activeSection !== "all" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <div className="mt-0.5 rounded-lg border border-blue-200 bg-white p-1.5 text-blue-700">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div>
              <div className="text-sm font-semibold text-slate-900">{activeSection === "all" ? "Remaining open checks" : `${activeTab.label} open checks`}</div>
              <div className="mt-1 text-xs text-slate-600">{activeSection === "all" ? "Excludes the Do first items above." : "Filtered by selected area."}</div>
              </div>
            </div>
            {activeSection !== "all" ? <Button size="sm" variant="secondary" onClick={() => setActiveSection("all")}>Show all</Button> : null}
          </div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            <ActionRows items={visibleNextItems} emptyText="No open actions for this section." />
          </div>
        </div>
        ) : null}

        {activeSection !== "all" ? (
          <>
            <div className="grid gap-3 xl:grid-cols-2">
              <ReviewSection
                sectionKey="transactions"
                activeSection={activeSection}
                title="Transactions"
                helper="Ledger cleanup checks."
                count={transactionRecords.length}
                actionLabel="Open Ledger"
                onAction={() => setView?.("ledger")}
              />

              <ReviewSection
                sectionKey="documents"
                activeSection={activeSection}
                title="Documents"
                helper="Document review checks."
                count={documentReviewCount}
                actionLabel="Open Documents"
                onAction={() => setView?.("documents")}
                badges={[`Expense drafts: ${pendingExpenseReviewCount}`, `Work orders: ${pendingWorkOrderReviewCount}`, `Needs OCR/text: ${visibleDocumentsMissingIndex.length}`, `Safe suggestions: ${visibleSafeSuggestionCount}`]}
              />

              <ReviewSection
                sectionKey="assets"
                activeSection={activeSection}
                title="Assets"
                helper="Asset readiness checks."
                count={assetReviewCount}
                actionLabel="Open Assets"
                onAction={() => setView?.("assets")}
                badges={[`Transaction candidates: ${assetTransactionCandidates.length}`, `Asset warnings: ${assetWarningRecords.length}`]}
              />

              <ReviewSection
                sectionKey="maintenance"
                activeSection={activeSection}
                title="Maintenance"
                helper="Work order checks."
                count={maintenanceRecords.length}
                actionLabel="Open Maintenance"
                onAction={() => setView?.("maintenance")}
              />

              <ReviewSection
                sectionKey="leases"
                activeSection={activeSection}
                title="Leases & Occupancy"
                helper="Lease and occupancy checks."
                count={leaseReviewCount}
                actionLabel="Open Leases"
                onAction={() => setView?.("leaseHistory")}
                badges={[`Occupancy: ${occupancyRecords.length}`, `Tenant ledger: ${tenantLedgerRecords.length}`]}
              />

              <ReviewSection
                sectionKey="loans"
                activeSection={activeSection}
                title="Loans"
                helper="Loan review checks."
                count={loanRecords.length}
                actionLabel="Open Loans"
                onAction={() => setView?.("loans")}
              />
            </div>

            <ReviewSection
              sectionKey="tax"
              activeSection={activeSection}
              title="Tax Center"
              helper="Tax readiness checks."
              count={Number(taxReviewOpenCount || 0)}
              actionLabel="Open Tax Overview"
              onAction={() => setView?.("tax")}
              badges={[`Tax readiness: ${taxReadinessSummary?.label || taxReadinessSummary?.status || "Unknown"}`]}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
