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
  buildDocumentQualityWarnings,
  buildLinkedRecordSummary,
  isSupportingOnlyDocument,
} from "./documentPresentation.js";
import {
  SUPPORTING_ONLY_TAG,
  isDocumentReviewed,
} from "./documentWorkflow.js";

const DOCUMENT_MUTED_PANEL_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80";
const DOCUMENT_STAT_ICON_TONES = {
  inbox: "border-blue-200 bg-blue-50 text-blue-700",
  text: "border-sky-200 bg-sky-50 text-sky-700",
  expense: "border-emerald-200 bg-emerald-50 text-emerald-700",
  workOrder: "border-orange-200 bg-orange-50 text-orange-700",
  linked: "border-indigo-200 bg-indigo-50 text-indigo-700",
  supporting: "border-teal-200 bg-teal-50 text-teal-700",
};

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
  saveDocumentTags,
  selectExpenseQueueFilter,
  selectWorkOrderQueueFilter,
  setDocumentSearch,
  setDocumentSort,
  setDocumentStatusFilter,
  setExpenseQueueShowDismissed,
  transactionById = {},
  transactions,
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
  const [reviewDocument, setReviewDocument] = useState(null);

  const getDocumentLinkedSummary = (document) => {
    return buildLinkedRecordSummary(document, {
      currency,
      getDocumentLinkedWorkOrder,
      leaseById,
      transactionById,
    })?.label || "";
  };

  const getDocumentQualityWarnings = useCallback((document) => buildDocumentQualityWarnings(document, {
    currency,
    extractedFields: getDocumentExtractedFields(document),
    linkedTransaction: document?.transactionId ? transactionById[document.transactionId] : null,
  }), [currency, getDocumentExtractedFields, transactionById]);

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
      const expenseRecord = documentExpenseReviewRecordById[document.id];
      const workOrderRecord = documentWorkOrderReviewRecordById[document.id];
      const expenseSuggestion = expenseRecord?.suggestion || getDocumentExpenseSuggestion(document);
      const workOrderSuggestion = workOrderRecord?.suggestion || getDocumentWorkOrderSuggestion(document);
      return (
        getSafeDocumentTagSuggestions(document).length > 0 ||
        Boolean(getSafeDocumentLinkSuggestion(document)) ||
        canAutoCreateExpenseFromSuggestion(document, expenseSuggestion) ||
        canAutoCreateWorkOrderFromSuggestion(document, workOrderSuggestion)
      );
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
    getDocumentExtractedFields,
    getDocumentWorkOrderSuggestion,
    getSafeDocumentLinkSuggestion,
    getSafeDocumentTagSuggestions,
    leaseById,
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
  const documentsForTab = documentsTab === "reviewed"
    ? reviewedDocuments
    : documentsTab === "all"
      ? visibleDocuments
      : documentsTab === "needs_review"
        ? needsReviewDocuments
        : documentsTab === "linked"
          ? linkedDocuments
          : documentsTab === "supporting"
            ? supportingDocuments
            : inboxDocuments;
  const currentReviewDocument = reviewDocument
    ? visibleDocuments.find((document) => document.id === reviewDocument.id) || reviewDocument
    : null;
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
              {recommendationSummary.flagged > 0 ? (
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setDocumentsTab("needs_review")}>
                  Review {recommendationSummary.flagged} flagged
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
          <div className="grid gap-2 md:grid-cols-3">
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
          </div>
        </div>

        <Tabs value={documentsTab} onValueChange={setDocumentsTab}>
          <TabsList className={DOCUMENT_MUTED_PANEL_CLASS + " h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto"}>
            <Inbox className="ml-1 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <TabsTrigger value="inbox">Inbox ({inboxDocuments.length})</TabsTrigger>
            <TabsTrigger value="needs_review"><FileWarning className="mr-1 h-3.5 w-3.5 text-amber-700" />Needs Review ({needsReviewDocuments.length})</TabsTrigger>
            <TabsTrigger value="linked"><Link2 className="mr-1 h-3.5 w-3.5 text-indigo-700" />Linked ({linkedDocuments.length})</TabsTrigger>
            <TabsTrigger value="supporting"><FileCheck2 className="mr-1 h-3.5 w-3.5 text-emerald-700" />Supporting ({supportingDocuments.length})</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed ({reviewedDocuments.length})</TabsTrigger>
            <TabsTrigger value="all">All Files ({visibleDocuments.length})</TabsTrigger>
          </TabsList>
          {["inbox", "needs_review", "linked", "supporting", "reviewed", "all"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-2">
              {filteredDocuments.length === 0 ? (
                <div className={DOCUMENT_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>No documents for the current property/unit filter.</div>
              ) : documentsForTab.length === 0 ? (
                <div className={DOCUMENT_MUTED_PANEL_CLASS + " p-3 text-sm text-slate-600"}>
                  {tab === "inbox"
                    ? "No documents need review in the current search/filter."
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
                documentsForTab.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    context={workflowContext}
                    propertyLabel={propertyNameById[document.propertyId] || document.propertyId}
                    ownershipLabel={describeDocumentOwnership(document)}
                    onPrimaryAction={runAction}
                    onSecondaryAction={runAction}
                  />
                ))
              )}
            </TabsContent>
          ))}
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
          removeDocumentRecordLink={removeDocumentRecordLink}
          runDocumentAiAnalysis={runDocumentAiAnalysis}
          saveDocumentExtractedText={saveDocumentExtractedText}
          saveDocumentTags={saveDocumentTags}
          markSupportingOnly={markSupportingOnly}
          nextDocumentName={nextInboxDocument?.name || ""}
          transactionById={transactionById}
          transactions={transactions}
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
