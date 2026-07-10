import React, { useCallback, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { FileCheck2, FileWarning, Inbox, Link2, ReceiptText, Upload, Wrench } from "lucide-react";
import { DocumentCard } from "./DocumentCard.jsx";
import { DocumentReviewDialog } from "./DocumentReviewDialog.jsx";
import {
  buildDocumentDuplicateCandidates,
  buildDocumentQualityWarnings,
  buildLinkedRecordSummary,
  isSupportingOnlyDocument,
} from "./documentPresentation.js";
import {
  SUPPORTING_ONLY_TAG,
  isDocumentReviewed,
} from "./documentWorkflow.js";
import { selectDocumentsForWorkspaceTab } from "./documentWorkspaceFilters.js";

const DOCUMENT_MUTED_PANEL_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80";
const OCR_FIELD_WARNING_KEYS = new Set(["low_confidence", "missing_vendor", "missing_date", "missing_amount", "service_amount_text"]);
const DOCUMENT_STAT_ICON_TONES = {
  inbox: "border-blue-200 bg-blue-50 text-blue-700",
  text: "border-sky-200 bg-sky-50 text-sky-700",
  expense: "border-emerald-200 bg-emerald-50 text-emerald-700",
  workOrder: "border-orange-200 bg-orange-50 text-orange-700",
  linked: "border-indigo-200 bg-indigo-50 text-indigo-700",
  supporting: "border-teal-200 bg-teal-50 text-teal-700",
};

function normalizeDocumentMatchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountLike(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) / 100 : undefined;
}

function isoDayDiff(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const leftTime = Date.parse(`${String(left).slice(0, 10)}T00:00:00Z`);
  const rightTime = Date.parse(`${String(right).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86400000));
}

function documentGroupLabel(document, mode, context) {
  if (mode === "workflow") return context.workflowLabel(document);
  if (mode === "property") return context.propertyLabel(document);
  if (mode === "vendor") return context.vendorLabel(document);
  if (mode === "month") return context.monthLabel(document);
  return "";
}

function groupDocumentsForDisplay(documents, mode, context) {
  if (mode === "none") return [{ label: "", documents }];
  const groups = new Map();
  documents.forEach((document) => {
    const label = documentGroupLabel(document, mode, context) || "Unsorted";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(document);
  });
  return [...groups.entries()].map(([label, groupedDocuments]) => ({ label, documents: groupedDocuments }));
}

function DocumentStatIcon({ icon: Icon, tone }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${DOCUMENT_STAT_ICON_TONES[tone] || DOCUMENT_STAT_ICON_TONES.inbox}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function DocumentsWorkspace({
  WORKSPACE_FILTER_PANEL_CLASS,
  WORKSPACE_STAT_TILE_CLASS,
  acceptVisibleSafeSuggestions,
  aiDocumentCopilotConfigured,
  aiDocumentCopilotReady,
  applyDocumentLinkSuggestion,
  applySafeSuggestionsToDocument,
  applySuggestedDocumentTags,
  automaticDocumentOcrAvailable,
  canAutoCreateExpenseFromSuggestion,
  canAutoCreateWorkOrderFromSuggestion,
  canReviewDocuments,
  confirmAndDeleteDocument,
  createExpenseTransactionsFromUtilitySections,
  currency,
  describeDocumentOwnership,
  dismissDocumentExpenseReview,
  dismissDocumentWorkOrderReview,
  dismissVisibleExpenseQueue,
  dismissedExpenseReviewCount,
  dismissedWorkOrderReviewCount,
  documentAiActionLabel,
  documentAiBusyById,
  documentBatchOcrBusy,
  documentExpenseReviewRecordById = {},
  documentImportInputRef,
  documentLinkSuggestionKindLabel,
  documentNeedsIndexing,
  documentOcrBusyById,
  documentSearch,
  documentSort,
  documentStatusFilter,
  documentSupportsAutomaticOcr,
  documentTagSuggestionSourceLabel,
  documentWorkOrderReviewRecordById = {},
  expenseQueueShowDismissed,
  expenseSuggestionConfidenceLabel,
  expenseSuggestionReasonSummary,
  filteredDocuments,
  getDocumentExpenseSuggestion,
  getDocumentExtractedFields,
  getDocumentLinkSuggestions,
  getDocumentLinkedWorkOrder,
  getDocumentSuggestedTags,
  getDocumentUtilitySections,
  getDocumentWorkOrderSuggestion,
  getSafeDocumentLinkSuggestion,
  getSafeDocumentTagSuggestions,
  leaseById = {},
  leases,
  markDocumentWarningsReviewed,
  updateLinkedTransactionFromDocumentOcr,
  markVisibleDocumentsPendingOcr,
  onDocumentImportInputChange,
  openDocumentImportPicker,
  openDocumentLinkedRecord,
  openDocumentPreview,
  openExpenseDraftFromDocument,
  openExpenseDraftFromUtilitySection,
  openWorkOrderDraftFromDocument,
  pendingExpenseReviewCount,
  pendingHighConfidenceExpenseReviewCount,
  pendingHighConfidenceWorkOrderReviewCount,
  pendingWorkOrderReviewCount,
  prefetchDocumentImportDialog,
  queueDocumentForOcr,
  reopenDocumentExpenseReview,
  reopenDocumentWorkOrderReview,
  removeDocumentRecordLink,
  reviewNextExpenseQueueItem,
  reviewNextWorkOrderQueueItem,
  runDocumentAiAnalysis,
  runVisibleDocumentOcr,
  saveDocumentExtractedText,
  saveDocumentOcrFieldCorrections,
  saveDocumentTags,
  selectExpenseQueueFilter,
  selectWorkOrderQueueFilter,
  setDocumentSearch,
  setDocumentSort,
  setDocumentStatusFilter,
  setExpenseQueueShowDismissed,
  transactionById = {},
  transactionReviewInbox = [],
  transactions,
  units = [],
  visibleAutomaticOcrDocuments,
  visibleDocuments,
  visibleDocumentsMissingIndex,
  visibleExpenseReviewRecords,
  visibleSafeSuggestionCount,
  workOrderSuggestionConfidenceLabel,
  workOrderSuggestionReasonSummary,
  workOrders,
  propertyNameById,
}) {
  const [documentsTab, setDocumentsTab] = useState("inbox");
  const [documentGroupMode, setDocumentGroupMode] = useState("none");
  const [reviewDocument, setReviewDocument] = useState(null);

  const getDocumentLinkedSummary = (document) => {
    return buildLinkedRecordSummary(document, {
      currency,
      getDocumentLinkedWorkOrder,
      leaseById,
      transactionById,
    })?.label || "";
  };

  const documentQualityWarningsById = useMemo(() => new Map(), [currency, filteredDocuments, getDocumentExtractedFields, transactionById]);
  const safeSuggestionByDocumentId = useMemo(() => new Map(), [
    canAutoCreateExpenseFromSuggestion,
    canAutoCreateWorkOrderFromSuggestion,
    documentExpenseReviewRecordById,
    documentWorkOrderReviewRecordById,
    getDocumentExpenseSuggestion,
    getDocumentWorkOrderSuggestion,
    getSafeDocumentLinkSuggestion,
    getSafeDocumentTagSuggestions,
  ]);

  const getDocumentQualityWarnings = useCallback((document) => {
    const cacheKey = document?.id;
    if (cacheKey && documentQualityWarningsById.has(cacheKey)) {
      return documentQualityWarningsById.get(cacheKey);
    }
    const warnings = buildDocumentQualityWarnings(document, {
      currency,
      duplicateCandidates: buildDocumentDuplicateCandidates(document, {
        documents: filteredDocuments,
        getDocumentExtractedFields,
        transactionById,
      }),
      extractedFields: getDocumentExtractedFields(document),
      linkedTransaction: document?.transactionId ? transactionById[document.transactionId] : null,
    });
    if (cacheKey) documentQualityWarningsById.set(cacheKey, warnings);
    return warnings;
  }, [currency, documentQualityWarningsById, filteredDocuments, getDocumentExtractedFields, transactionById]);

  const workflowContext = useMemo(() => ({
    currency,
    documentExpenseReviewRecordById,
    documentLinkSuggestionKindLabel,
    documentSupportsAutomaticOcr,
    documentWorkOrderReviewRecordById,
    getDocumentExpenseSuggestion,
    getDocumentLinkedWorkOrder,
    getDocumentLinkedSummary,
    getDocumentLinkSuggestions,
    getDocumentQualityWarnings,
    getDocumentSuggestedTags,
    getDocumentWorkOrderSuggestion,
    getSafeDocumentLinkSuggestion,
    leaseById,
    transactionById,
    hasSafeSuggestion: (document) => {
      const cacheKey = document?.id;
      if (cacheKey && safeSuggestionByDocumentId.has(cacheKey)) {
        return safeSuggestionByDocumentId.get(cacheKey);
      }
      const expenseRecord = documentExpenseReviewRecordById[document.id];
      const workOrderRecord = documentWorkOrderReviewRecordById[document.id];
      const expenseSuggestion = expenseRecord?.suggestion || getDocumentExpenseSuggestion(document);
      const workOrderSuggestion = workOrderRecord?.suggestion || getDocumentWorkOrderSuggestion(document);
      const hasSuggestion = (
        getSafeDocumentTagSuggestions(document).length > 0 ||
        Boolean(getSafeDocumentLinkSuggestion(document)) ||
        canAutoCreateExpenseFromSuggestion(document, expenseSuggestion) ||
        canAutoCreateWorkOrderFromSuggestion(document, workOrderSuggestion)
      );
      if (cacheKey) safeSuggestionByDocumentId.set(cacheKey, hasSuggestion);
      return hasSuggestion;
    },
  }), [
    canAutoCreateExpenseFromSuggestion,
    canAutoCreateWorkOrderFromSuggestion,
    currency,
    documentExpenseReviewRecordById,
    documentLinkSuggestionKindLabel,
    documentSupportsAutomaticOcr,
    documentWorkOrderReviewRecordById,
    getDocumentExpenseSuggestion,
    getDocumentLinkedWorkOrder,
    getDocumentLinkSuggestions,
    getDocumentSuggestedTags,
    getDocumentQualityWarnings,
    getDocumentWorkOrderSuggestion,
    getSafeDocumentLinkSuggestion,
    getSafeDocumentTagSuggestions,
    leaseById,
    safeSuggestionByDocumentId,
    transactionById,
  ]);

  const recommendationSummary = useMemo(
    () => visibleDocuments.reduce((summary, document) => {
      if (!workflowContext.hasSafeSuggestion(document)) return summary;
      if (getDocumentQualityWarnings(document).length > 0) {
        summary.flagged += 1;
      } else {
        summary.safe += 1;
      }
      return summary;
    }, { safe: 0, flagged: 0 }),
    [getDocumentQualityWarnings, visibleDocuments, workflowContext],
  );

  const inboxDocuments = useMemo(
    () => visibleDocuments.filter((document) => !isDocumentReviewed(document, workflowContext)),
    [visibleDocuments, workflowContext],
  );
  const needsReviewDocuments = useMemo(
    () => visibleDocuments.filter((document) => getDocumentQualityWarnings(document).length > 0),
    [getDocumentQualityWarnings, visibleDocuments],
  );
  const ocrQualityDocuments = useMemo(
    () => visibleDocuments.filter((document) => getDocumentQualityWarnings(document).some((warning) => OCR_FIELD_WARNING_KEYS.has(warning.key))),
    [getDocumentQualityWarnings, visibleDocuments],
  );
  const reviewedDocuments = useMemo(
    () => visibleDocuments.filter((document) => isDocumentReviewed(document, workflowContext)),
    [visibleDocuments, workflowContext],
  );
  const linkedDocuments = useMemo(
    () => visibleDocuments.filter((document) => {
      const linkedSummary = buildLinkedRecordSummary(document, {
        currency,
        getDocumentLinkedWorkOrder,
        leaseById,
        transactionById,
      });
      return Boolean(linkedSummary && linkedSummary.kind !== "supporting");
    }),
    [currency, getDocumentLinkedWorkOrder, leaseById, transactionById, visibleDocuments],
  );
  const supportingDocuments = useMemo(
    () => visibleDocuments.filter((document) => isSupportingOnlyDocument(document)),
    [visibleDocuments],
  );
  const documentsForTab = selectDocumentsForWorkspaceTab({
    documentStatusFilter,
    documentsTab,
    inboxDocuments,
    linkedDocuments,
    needsReviewDocuments,
    ocrQualityDocuments,
    reviewedDocuments,
    supportingDocuments,
    visibleDocuments,
  });
  const documentGroupContext = useMemo(() => ({
    monthLabel: (document) => {
      const fields = getDocumentExtractedFields(document);
      const date = fields?.invoiceDate || fields?.serviceDate || document.documentDate || document.date || document.uploadedAt || "";
      return date ? String(date).slice(0, 7) : "No date";
    },
    propertyLabel: (document) => propertyNameById[document.propertyId] || document.propertyId || "No property",
    vendorLabel: (document) => {
      const fields = getDocumentExtractedFields(document);
      const suggestion = getDocumentExpenseSuggestion(document);
      const linkedTxn = document.transactionId ? transactionById[document.transactionId] : null;
      return fields?.vendorName || suggestion?.vendor || linkedTxn?.vendor || "No vendor";
    },
    workflowLabel: (document) => {
      const status = workflowContext.getDocumentQualityWarnings(document).length > 0
        ? "Needs review"
        : workflowContext.hasSafeSuggestion(document)
          ? "Suggestions"
          : buildLinkedRecordSummary(document, { currency, getDocumentLinkedWorkOrder, leaseById, transactionById })?.kind === "transaction"
            ? "Linked"
            : isDocumentReviewed(document, workflowContext)
              ? "Reviewed"
              : "Inbox";
      return status;
    },
  }), [currency, getDocumentExpenseSuggestion, getDocumentExtractedFields, getDocumentLinkedWorkOrder, leaseById, propertyNameById, transactionById, workflowContext]);

  const missingReceiptGapRecords = useMemo(
    () => transactionReviewInbox.filter((record) => record.issues?.some((issue) => issue.key === "missing_receipt")),
    [transactionReviewInbox],
  );

  const missingReceiptRecords = useMemo(() => {
    if (documentsTab !== "receipt_gaps") return [];
    return missingReceiptGapRecords.map((record) => {
      const transaction = record.transaction;
      const transactionAmount = amountLike(transaction?.amount);
      const transactionText = normalizeDocumentMatchText([transaction?.vendor, transaction?.category, transaction?.description].filter(Boolean).join(" "));
      const candidates = filteredDocuments
        .filter((document) => {
          if (!document || document.transactionId === transaction.id) return false;
          if (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.includes(transaction.id)) return false;
          return true;
        })
        .map((document) => {
          const fields = getDocumentExtractedFields(document);
          const suggestion = getDocumentExpenseSuggestion(document);
          const linkSuggestion = getDocumentLinkSuggestions(document).find((suggestedLink) => suggestedLink.kind === "transaction" && suggestedLink.id === transaction.id);
          const documentAmount = amountLike(fields?.totalAmount ?? suggestion?.amount);
          const documentDate = fields?.invoiceDate || fields?.serviceDate || suggestion?.date || document.documentDate || document.date || document.uploadedAt || "";
          const documentText = normalizeDocumentMatchText([document.name, document.type, document.extractedText, fields?.vendorName, suggestion?.vendor].filter(Boolean).join(" "));
          let score = linkSuggestion ? 100 : 0;
          const reasons = [];
          if (linkSuggestion) reasons.push("suggested link");
          if (transactionAmount != null && documentAmount != null && Math.abs(transactionAmount - documentAmount) < 0.01) {
            score += 35;
            reasons.push("same amount");
          }
          const dayDiff = isoDayDiff(transaction.date, documentDate);
          if (dayDiff <= 3) {
            score += 25;
            reasons.push(dayDiff === 0 ? "same date" : "near date");
          } else if (documentDate && transaction.date && String(documentDate).slice(0, 7) === String(transaction.date).slice(0, 7)) {
            score += 10;
            reasons.push("same month");
          }
          if (transaction.propertyId && document.propertyId && transaction.propertyId === document.propertyId) {
            score += 15;
            reasons.push("same property");
          }
          if (normalizeDocumentMatchText(transaction.unit || "Shared") === normalizeDocumentMatchText(document.unit || "Shared")) {
            score += 8;
            reasons.push("same unit");
          }
          if (transactionText && documentText && transactionText.split(" ").filter((word) => word.length >= 4).some((word) => documentText.includes(word))) {
            score += 12;
            reasons.push("text match");
          }
          return { document, reasons, score };
        })
        .filter((candidate) => candidate.score >= 25)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
      return { ...record, candidates };
    });
  }, [documentsTab, filteredDocuments, getDocumentExpenseSuggestion, getDocumentExtractedFields, getDocumentLinkSuggestions, missingReceiptGapRecords]);

  const attachDocumentToReceiptGap = (transaction, document) => {
    applyDocumentLinkSuggestion(document, {
      kind: "transaction",
      id: transaction.id,
      label: `${transaction.date || "No date"} | ${transaction.vendor || transaction.category || transaction.description || "Transaction"}${transaction.unit ? ` | Unit ${transaction.unit}` : ""}`,
      propertyId: transaction.propertyId,
      unit: transaction.unit,
      confidence: "high",
      sources: ["context"],
    });
  };
  const currentReviewDocument = reviewDocument
    ? visibleDocuments.find((document) => document.id === reviewDocument.id) || reviewDocument
    : null;
  const currentReviewDuplicateCandidates = currentReviewDocument
    ? buildDocumentDuplicateCandidates(currentReviewDocument, {
        documents: filteredDocuments,
        getDocumentExtractedFields,
        transactionById,
      })
    : [];
  const nextInboxDocument = currentReviewDocument
    ? inboxDocuments.find((document) => document.id !== currentReviewDocument.id) || null
    : inboxDocuments[0] || null;
  const nextExpenseReviewRecord = visibleExpenseReviewRecords[0] || null;
  const startNextBillFromDocument = () => {
    if (nextExpenseReviewRecord?.document) {
      return openExpenseDraftFromDocument(
        nextExpenseReviewRecord.document,
        nextExpenseReviewRecord.suggestion || getDocumentExpenseSuggestion(nextExpenseReviewRecord.document),
      );
    }
    return reviewNextExpenseQueueItem?.();
  };

  const markSupportingOnly = (document) => {
    if (document.transactionId || document.leaseId || document.workOrderId || getDocumentLinkedWorkOrder(document)) return;
    const tags = Array.isArray(document.tags) ? document.tags : [];
    if (tags.some((tag) => String(tag || "").toLowerCase() === SUPPORTING_ONLY_TAG)) return;
    saveDocumentTags(document, [...tags, SUPPORTING_ONLY_TAG].join(", "));
  };

  const viewLinkedRecord = (document) => {
    if (document.transactionId) return openDocumentLinkedRecord(document, "transaction");
    if (document.leaseId) return openDocumentLinkedRecord(document, "lease");
    if (document.workOrderId || getDocumentLinkedWorkOrder(document)) return openDocumentLinkedRecord(document, "workOrder");
    return setReviewDocument(document);
  };

  const showInboxStatus = (status) => {
    setDocumentsTab("inbox");
    setDocumentStatusFilter(status);
  };

  const handleStatusFilterChange = (status) => {
    setDocumentStatusFilter(status);
    if (["needs_indexing", "ocr_queue", "expense_queue", "work_order_queue"].includes(status)) {
      setDocumentsTab("inbox");
    }
  };

  const runAction = (document, action) => {
    if (action.key === "extract_text") return queueDocumentForOcr(document);
    if (action.key === "review_expense") return openExpenseDraftFromDocument(document, action.suggestion || getDocumentExpenseSuggestion(document));
    if (action.key === "review_work_order") return openWorkOrderDraftFromDocument(document, action.suggestion || getDocumentWorkOrderSuggestion(document));
    if (action.key === "view_linked") return viewLinkedRecord(document);
    if (action.key === "preview") return openDocumentPreview(document);
    if (action.key === "apply_tags") return applySuggestedDocumentTags(document);
    if (action.key === "apply_safe") return applySafeSuggestionsToDocument(document);
    if (action.key === "not_expense") return dismissDocumentExpenseReview(document);
    if (action.key === "not_work_order") return dismissDocumentWorkOrderReview(document);
    if (action.key === "supporting_only") return markSupportingOnly(document);
    if (action.key === "remove") return confirmAndDeleteDocument(document);
    return setReviewDocument(document);
  };

  const renderDocumentCards = (documents) => {
    const groups = groupDocumentsForDisplay(documents, documentGroupMode, documentGroupContext);
    return groups.map((group) => (
      <div key={`document-group-${group.label || "all"}`} className="space-y-2">
        {group.label ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-semibold text-slate-900">{group.label}</div>
            <Badge variant="secondary">{group.documents.length}</Badge>
          </div>
        ) : null}
        {group.documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            context={workflowContext}
            propertyLabel={propertyNameById[document.propertyId] || document.propertyId}
            ownershipLabel={describeDocumentOwnership(document)}
            onPrimaryAction={runAction}
            onSecondaryAction={runAction}
          />
        ))}
      </div>
    ));
  };

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 !p-4">
        <input ref={documentImportInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onDocumentImportInputChange} />
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
          <Badge variant="secondary">{visibleDocuments.length} file{visibleDocuments.length === 1 ? "" : "s"}</Badge>
          <Button
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={openDocumentImportPicker}
            onMouseEnter={prefetchDocumentImportDialog}
            onFocus={prefetchDocumentImportDialog}
            onTouchStart={prefetchDocumentImportDialog}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Upload document
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => setDocumentsTab("inbox")}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={Inbox} tone="inbox" />
              <span>Inbox</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{inboxDocuments.length}</div>
            <div className="mt-1 text-xs text-slate-500">Files needing OCR, review, or attachment.</div>
          </button>
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => showInboxStatus("needs_indexing")}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={FileWarning} tone="text" />
              <span>Needs text extraction</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{visibleDocumentsMissingIndex.length}</div>
            <div className="mt-1 text-xs text-slate-500">Files that still need searchable text.</div>
          </button>
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => { setDocumentsTab("inbox"); selectExpenseQueueFilter(); }}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={ReceiptText} tone="expense" />
              <span>Expense drafts</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{pendingExpenseReviewCount}</div>
            <div className="mt-1 text-xs text-slate-500">OCR expense suggestions waiting for review.</div>
          </button>
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => { setDocumentsTab("inbox"); selectWorkOrderQueueFilter(); }}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={Wrench} tone="workOrder" />
              <span>Work order drafts</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{pendingWorkOrderReviewCount}</div>
            <div className="mt-1 text-xs text-slate-500">Maintenance suggestions waiting for review.</div>
          </button>
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => { setDocumentsTab("linked"); setDocumentStatusFilter("linked"); }}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={Link2} tone="linked" />
              <span>Linked documents</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{linkedDocuments.length}</div>
            <div className="mt-1 text-xs text-slate-500">Files already supporting records.</div>
          </button>
          <button type="button" className={`${WORKSPACE_STAT_TILE_CLASS} text-left transition hover:border-blue-300 hover:bg-blue-50/50`} onClick={() => { setDocumentsTab("supporting"); setDocumentStatusFilter("all"); }}>
            <div className="flex min-h-8 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <DocumentStatIcon icon={FileCheck2} tone="supporting" />
              <span>Supporting only</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">{supportingDocuments.length}</div>
            <div className="mt-1 text-xs text-slate-500">Reference files that do not create ledger records.</div>
          </button>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Document workflows</div>
                <div className="mt-1 text-xs text-slate-600">
                  Flagged recommendations need review before bulk apply.
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">Expense drafts: {pendingExpenseReviewCount}</Badge>
                  <Badge variant="secondary">Work orders: {pendingWorkOrderReviewCount}</Badge>
                  {recommendationSummary.safe > 0 ? <Badge variant="secondary">Safe recommendations: {recommendationSummary.safe}</Badge> : null}
                  {recommendationSummary.flagged > 0 ? <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-800">Flagged recommendations: {recommendationSummary.flagged}</Badge> : null}
                  {nextExpenseReviewRecord?.document?.name ? <Badge variant="secondary">Next bill: {nextExpenseReviewRecord.document.name}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={openDocumentImportPicker}
                onMouseEnter={prefetchDocumentImportDialog}
                onFocus={prefetchDocumentImportDialog}
                onTouchStart={prefetchDocumentImportDialog}
              >
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                Upload bill
              </Button>
              {pendingExpenseReviewCount > 0 ? (
                <Button size="sm" className="w-full sm:w-auto" onClick={startNextBillFromDocument}>
                  Review next bill
                </Button>
              ) : null}
              {recommendationSummary.safe > 0 ? (
                <Button size="sm" className="w-full sm:w-auto" onClick={acceptVisibleSafeSuggestions} disabled={!canReviewDocuments}>
                  Apply {recommendationSummary.safe} safe recommendations
                </Button>
              ) : null}
              {ocrQualityDocuments.length > 0 ? (
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setDocumentsTab("ocr_quality")}>
                  Review OCR fixes ({ocrQualityDocuments.length})
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={WORKSPACE_FILTER_PANEL_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-900">Workflow actions</div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              {visibleDocumentsMissingIndex.length > 0 ? (
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={markVisibleDocumentsPendingOcr} disabled={documentBatchOcrBusy}>
                  Queue visible OCR ({visibleDocumentsMissingIndex.length})
                </Button>
              ) : null}
              {visibleAutomaticOcrDocuments.length > 0 ? (
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => void runVisibleDocumentOcr()} disabled={documentBatchOcrBusy}>
                  {documentBatchOcrBusy ? "Running visible OCR..." : "Run visible OCR (" + visibleAutomaticOcrDocuments.length + ")"}
                </Button>
              ) : null}
              {pendingExpenseReviewCount > 0 ? (
                <Button size="sm" className="w-full sm:w-auto" variant={documentStatusFilter === "expense_queue" ? "default" : "secondary"} onClick={() => { setDocumentsTab("inbox"); selectExpenseQueueFilter(); }}>
                  Expense drafts ({pendingExpenseReviewCount})
                </Button>
              ) : null}
              {pendingWorkOrderReviewCount > 0 ? (
                <Button size="sm" className="w-full sm:w-auto" variant={documentStatusFilter === "work_order_queue" ? "default" : "secondary"} onClick={() => { setDocumentsTab("inbox"); selectWorkOrderQueueFilter(); }}>
                  Work order drafts ({pendingWorkOrderReviewCount})
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {(pendingExpenseReviewCount > 0 || pendingWorkOrderReviewCount > 0 || dismissedExpenseReviewCount > 0 || dismissedWorkOrderReviewCount > 0) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Review queues</div>
                <div className="mt-1 text-xs text-slate-600">Step through OCR-created expense and work-order drafts before posting them.</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                  <Badge variant="secondary">Expense drafts: {pendingExpenseReviewCount}</Badge>
                  <Badge variant="secondary">High confidence: {pendingHighConfidenceExpenseReviewCount}</Badge>
                  <Badge variant="secondary">Work order drafts: {pendingWorkOrderReviewCount}</Badge>
                  {pendingHighConfidenceWorkOrderReviewCount > 0 ? <Badge variant="secondary">High-confidence work orders: {pendingHighConfidenceWorkOrderReviewCount}</Badge> : null}
                  {dismissedExpenseReviewCount > 0 ? <Badge variant="secondary">Not expenses: {dismissedExpenseReviewCount}</Badge> : null}
                  {dismissedWorkOrderReviewCount > 0 ? <Badge variant="secondary">Not work orders: {dismissedWorkOrderReviewCount}</Badge> : null}
                </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                {pendingExpenseReviewCount > 0 ? <Button size="sm" variant="secondary" onClick={reviewNextExpenseQueueItem}>Review next bill</Button> : null}
                {pendingWorkOrderReviewCount > 0 ? <Button size="sm" variant="secondary" onClick={reviewNextWorkOrderQueueItem}>Review next work order</Button> : null}
                {(dismissedExpenseReviewCount > 0 || dismissedWorkOrderReviewCount > 0) ? (
                  <Button size="sm" variant="secondary" onClick={() => setExpenseQueueShowDismissed((prev) => !prev)}>
                    {expenseQueueShowDismissed ? "Hide reviewed later" : "Show reviewed later"}
                  </Button>
                ) : null}
                {visibleExpenseReviewRecords.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={dismissVisibleExpenseQueue}>
                    Mark visible not expenses ({visibleExpenseReviewRecords.length})
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className={WORKSPACE_FILTER_PANEL_CLASS}>
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <Label className="text-xs text-slate-600">Search</Label>
              <Input className="mt-1" placeholder="Search files, tags, extracted text, tenant, vendor, work order, property, or unit" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Status filter</Label>
              <Select value={documentStatusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All documents</SelectItem>
                  <SelectItem value="needs_attention">Needs attention</SelectItem>
                  <SelectItem value="needs_tags">Needs tags</SelectItem>
                  <SelectItem value="needs_indexing">Needs text extraction</SelectItem>
                  <SelectItem value="ocr_queue">Needs OCR</SelectItem>
                  <SelectItem value="expense_queue">Expense drafts</SelectItem>
                  <SelectItem value="work_order_queue">Work order drafts</SelectItem>
                  <SelectItem value="linked">Linked records</SelectItem>
                  <SelectItem value="unlinked">Unlinked only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Sort</Label>
              <Select value={documentSort} onValueChange={setDocumentSort}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uploaded_desc">Newest upload first</SelectItem>
                  <SelectItem value="uploaded_asc">Oldest upload first</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                  <SelectItem value="type_asc">Type A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Group</Label>
              <Select value={documentGroupMode} onValueChange={setDocumentGroupMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Tabs value={documentsTab} onValueChange={setDocumentsTab}>
          <TabsList className={DOCUMENT_MUTED_PANEL_CLASS + " h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto"}>
            <Inbox className="ml-1 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <TabsTrigger value="inbox">Inbox ({inboxDocuments.length})</TabsTrigger>
            <TabsTrigger value="ocr_quality"><FileWarning className="mr-1 h-3.5 w-3.5 text-amber-700" />OCR fixes ({ocrQualityDocuments.length})</TabsTrigger>
            <TabsTrigger value="needs_review"><FileWarning className="mr-1 h-3.5 w-3.5 text-amber-700" />Needs Review ({needsReviewDocuments.length})</TabsTrigger>
            <TabsTrigger value="linked"><Link2 className="mr-1 h-3.5 w-3.5 text-indigo-700" />Linked ({linkedDocuments.length})</TabsTrigger>
            <TabsTrigger value="receipt_gaps">Missing Receipts ({missingReceiptGapRecords.length})</TabsTrigger>
            <TabsTrigger value="supporting"><FileCheck2 className="mr-1 h-3.5 w-3.5 text-emerald-700" />Supporting ({supportingDocuments.length})</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed ({reviewedDocuments.length})</TabsTrigger>
            <TabsTrigger value="all">All Files ({visibleDocuments.length})</TabsTrigger>
          </TabsList>
          {["inbox", "ocr_quality", "needs_review", "linked", "supporting", "reviewed", "all"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-2">
              {filteredDocuments.length === 0 ? (
                <div className={DOCUMENT_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>No documents for the current property/unit filter.</div>
              ) : documentsForTab.length === 0 ? (
                <div className={DOCUMENT_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>
                  {tab === "inbox"
                    ? "No documents need review in the current search/filter."
                    : tab === "ocr_quality"
                      ? "No OCR field corrections are waiting in the current search/filter."
                    : tab === "needs_review"
                      ? "No flagged documents match the current search/filter."
                      : tab === "linked"
                        ? "No linked documents match the current search/filter."
                        : tab === "supporting"
                          ? "No supporting-only documents match the current search/filter."
                          : tab === "reviewed"
                            ? "No reviewed documents match the current search/filter."
                            : "No documents match the current search."}
                </div>
              ) : (
                renderDocumentCards(documentsForTab)
              )}
            </TabsContent>
          ))}
          <TabsContent value="receipt_gaps" className="space-y-2">
            {missingReceiptRecords.length === 0 ? (
              <div className={DOCUMENT_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>No transactions are missing receipt support in the current review set.</div>
            ) : (
              missingReceiptRecords.map((record) => (
                <div key={`receipt-gap-${record.transaction.id}`} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {record.transaction.date || "No date"} | {record.transaction.vendor || record.transaction.category || record.transaction.description || "Transaction"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {[record.transaction.category, record.transaction.amount != null ? currency(record.transaction.amount) : "", record.transaction.unit || "Shared"].filter(Boolean).join(" | ")}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => openDocumentLinkedRecord({ transactionId: record.transaction.id }, "transaction")}>
                      Open transaction
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {record.candidates.length > 0 ? (
                      record.candidates.map((candidate) => (
                        <div key={`receipt-gap-${record.transaction.id}-${candidate.document.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{candidate.document.name}</div>
                            <div className="mt-0.5 text-xs text-slate-600">{candidate.reasons.join(", ") || "possible support match"}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setReviewDocument(candidate.document)}>Review</Button>
                            <Button size="sm" onClick={() => attachDocumentToReceiptGap(record.transaction, candidate.document)}>Attach</Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded border border-dashed border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
                        No document candidates found for this transaction.
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <DocumentReviewDialog
          aiDocumentCopilotConfigured={aiDocumentCopilotConfigured}
          aiDocumentCopilotReady={aiDocumentCopilotReady}
          applyDocumentLinkSuggestion={applyDocumentLinkSuggestion}
          applySafeSuggestionsToDocument={applySafeSuggestionsToDocument}
          applySuggestedDocumentTags={applySuggestedDocumentTags}
          automaticDocumentOcrAvailable={automaticDocumentOcrAvailable}
          currency={currency}
          document={currentReviewDocument}
          documentAiActionLabel={documentAiActionLabel}
          documentAiBusyById={documentAiBusyById}
          documentLinkSuggestionKindLabel={documentLinkSuggestionKindLabel}
          documentOcrBusyById={documentOcrBusyById}
          documentTagSuggestionSourceLabel={documentTagSuggestionSourceLabel}
          expenseSuggestionConfidenceLabel={expenseSuggestionConfidenceLabel}
          expenseSuggestionReasonSummary={expenseSuggestionReasonSummary}
          createExpenseTransactionsFromUtilitySections={createExpenseTransactionsFromUtilitySections}
          duplicateCandidates={currentReviewDuplicateCandidates}
          getDocumentExpenseSuggestion={getDocumentExpenseSuggestion}
          getDocumentExtractedFields={getDocumentExtractedFields}
          getDocumentLinkSuggestions={getDocumentLinkSuggestions}
          getDocumentLinkedWorkOrder={getDocumentLinkedWorkOrder}
          getDocumentLinkedSummary={getDocumentLinkedSummary}
          getDocumentSuggestedTags={getDocumentSuggestedTags}
          getDocumentUtilitySections={getDocumentUtilitySections}
          getDocumentWorkOrderSuggestion={getDocumentWorkOrderSuggestion}
          getSafeDocumentTagSuggestions={getSafeDocumentTagSuggestions}
          onClose={() => setReviewDocument(null)}
          onNextDocument={() => nextInboxDocument && setReviewDocument(nextInboxDocument)}
          openDocumentPreview={openDocumentPreview}
          openDocumentLinkedRecord={openDocumentLinkedRecord}
          openExpenseDraftFromDocument={openExpenseDraftFromDocument}
          openExpenseDraftFromUtilitySection={openExpenseDraftFromUtilitySection}
          openWorkOrderDraftFromDocument={openWorkOrderDraftFromDocument}
          queueDocumentForOcr={queueDocumentForOcr}
          reopenDocumentExpenseReview={reopenDocumentExpenseReview}
          reopenDocumentWorkOrderReview={reopenDocumentWorkOrderReview}
          markDocumentWarningsReviewed={markDocumentWarningsReviewed}
          updateLinkedTransactionFromDocumentOcr={updateLinkedTransactionFromDocumentOcr}
          onReviewDuplicateDocument={(duplicateDocument) => duplicateDocument && setReviewDocument(duplicateDocument)}
          removeDocumentRecordLink={removeDocumentRecordLink}
          runDocumentAiAnalysis={runDocumentAiAnalysis}
          saveDocumentExtractedText={saveDocumentExtractedText}
          saveDocumentOcrFieldCorrections={saveDocumentOcrFieldCorrections}
          saveDocumentTags={saveDocumentTags}
          markSupportingOnly={markSupportingOnly}
          nextDocumentName={nextInboxDocument?.name || ""}
          transactionById={transactionById}
          transactions={transactions}
          units={units}
          leaseById={leaseById}
          leases={leases}
          workOrderSuggestionConfidenceLabel={workOrderSuggestionConfidenceLabel}
          workOrderSuggestionReasonSummary={workOrderSuggestionReasonSummary}
          workOrders={workOrders}
        />
      </CardContent>
    </Card>
  );
}
