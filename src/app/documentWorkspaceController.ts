import type { DocumentWorkspaceControllerDependencies, SilentOptions, UnlinkOptions, SaveImportedDocumentOptions, ExpenseDraftOptions } from "./documentWorkspaceTypes.ts";
import { createDocumentRecordActions } from "./documentRecordActions.ts";
import { createDocumentSuggestionActions } from "./documentSuggestionActions.ts";
import { createDocumentAiActions } from "./documentAiActions.ts";
import { buildDocumentQualityWarnings } from "../features/documents/documentPresentation.js";
import { loadDocumentDataUrlFromDesktop } from "./documentFileAccess.ts";
import { runDesktopDocumentOcr } from "./documentOcrRunner.ts";
import { queueDocumentForOcrWorkflow } from "./documentOcrQueue.ts";
import { markVisibleDocumentsPendingOcrWorkflow, runVisibleDocumentOcrWorkflow } from "./documentOcrBatch.ts";
import { runDocumentImportOcrWorkflow } from "./documentImportOcrWorkflow.ts";
import { buildDocumentImportFileDraft, buildDocumentImportPickerDraft, hasDocumentImportContext, type DocumentImportDraft } from "./documentImportDraft.ts";
import { applyDocumentImportLinkSuggestionToDraft, buildDocumentLinkUpdate, buildDocumentUnlinkUpdate, type DocumentLinkSuggestion } from "./documentLinkUpdates.ts";
import { buildDocumentExtractedTextUpdate, buildDocumentTagsUpdate, buildImportedDocumentRecord } from "./documentRecordUpdates.ts";
import { canAutoCreateExpenseSuggestion, canAutoCreateWorkOrderSuggestion, canCreateUtilitySectionTransaction, findMatchingUtilitySectionTransaction } from "./documentAutomationSafety.ts";
import { applyTransactionVendorMemoryToDraft, findTransactionVendorMemoryForDraft } from "../features/transactions/transactionVendorMemory.js";
import type { DocumentItem, Property, Transaction, Unit, Vendor } from "../models.ts";
import type { CompanionSubmission, DesktopCompanionApi } from "../types/desktop.d.ts";
import { buildMobileCompanionImportContext } from "./mobileCompanionImport.ts";
import type { ChangeEvent } from "react";

export type { DocumentWorkspaceControllerDependencies } from "./documentWorkspaceTypes.ts";

export function createDocumentWorkspaceController({
  actions,
  addAuditEntry,
  aiDocumentCopilotEnabled,
  aiOpenAiApiKey,
  aiOpenAiModel,
  appConfirmDestructiveActions,
  automaticDocumentOcrAvailable,
  buildDocumentAiContext,
  canAttachToTransaction,
  categories,
  createBlankDocumentImportDraft,
  createBlankForm,
  desktopDocumentAiApi,
  desktopCompanionApi,
  desktopDocumentOcrApi,
  desktopDocumentOpenApi,
  desktopPersistenceApi,
  documentExpenseReviewRecords,
  documents,
  documentImportDraft,
  documentImportExpenseSuggestion,
  documentImportInputRef,
  documentImportWorkOrderSuggestion,
  documentImportOcrRequestIdRef,
  documentLinkSuggestionKindLabel,
  documentSearch,
  documentStatusFilter,
  documentSupportsAutomaticOcr,
  documentWorkOrderReviewRecords,
  expenseQueueFocusDocumentId,
  expenseSuggestionReasonSummary,
  formatDocumentTags,
  getDocumentExpenseSuggestion,
  getDocumentExtractedFields,
  getDocumentImportLinkSuggestions,
  getDocumentImportSuggestedTags,
  getDocumentLinkSuggestions,
  getDocumentLinkedWorkOrder,
  getDocumentSuggestedTags,
  getDocumentUtilitySections,
  getDocumentWorkOrderSuggestion,
  getNextExpenseQueueRecord,
  getNextWorkOrderQueueRecord,
  leaseById,
  normalizeDocumentOcrStatus,
  normalizeExtractedDocumentText,
  openConfirmDialog,
  openLease,
  openTransaction,
  prefetchDialog,
  properties,
  propertyFilter,
  readFileAsDataUrl,
  requirePermission,
  selectExpenseQueueFilter,
  selectWorkOrderQueueFilter,
  setDocumentAiBusyById,
  setDocumentBatchOcrBusy,
  setDocumentImportDialogOpen,
  setDocumentImportDraft,
  setDocumentImportOcrBusy,
  setDocumentImportOcrMessage,
  setDocumentOcrBusyById,
  setEditReturnView,
  setEditingTxnId,
  setExpenseQueueFocusDocumentId,
  setExpenseQueueShowDismissed,
  setForm,
  setNotice,
  setPendingDocumentExpenseSource,
  setPendingDocumentWorkOrderSource,
  setPendingTxnAttachment,
  setPropertyFilter,
  setRentAmountTouched,
  setSelectedDocument,
  setSelectedTxn,
  setUnitFilter,
  setView,
  setWorkOrderDraft,
  suggestDocumentType,
  todayIso,
  transactionById,
  transactions,
  transactionVendorMemories,
  txnAttachmentInputRef,
  unitFilter,
  units,
  visibleAutomaticOcrDocuments,
  visibleDocuments,
  visibleDocumentsMissingIndex,
  visibleExpenseReviewRecords,
  visibleWorkOrderReviewRecords,
  vendors = [],
  workOrderById,
  workOrderSuggestionReasonSummary,
}: DocumentWorkspaceControllerDependencies) {
  const loadDocumentDataUrl = (document: DocumentItem) => loadDocumentDataUrlFromDesktop({
    document,
    desktopPersistenceApi,
    setNotice,
  });

  const closeDocumentImportDialog = () => {
    documentImportOcrRequestIdRef.current += 1;
    setDocumentImportOcrBusy(false);
    setDocumentImportOcrMessage("");
    setDocumentImportDialogOpen(false);
    setDocumentImportDraft(createBlankDocumentImportDraft(propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || ""), unitFilter !== "all" ? unitFilter : "Shared"));
  };

  const openDocumentImportPicker = (context = {}) => {
    prefetchDialog("documentImport");
    const scope = {
      propertyFilter,
      unitFilter,
      defaultPropertyId: properties[0]?.id || "",
    };
    if (hasDocumentImportContext(context)) {
      setDocumentImportDraft((prev: DocumentImportDraft) => buildDocumentImportPickerDraft(prev, context, scope));
    } else {
      setDocumentImportDraft(buildDocumentImportPickerDraft(null, context, scope));
    }
    documentImportInputRef.current?.click();
  };

  const runAutomaticDocumentOcr = (documentLike: DocumentItem | DocumentImportDraft) => runDesktopDocumentOcr({
    documentLike,
    automaticDocumentOcrAvailable,
    desktopDocumentOcrApi,
    documentSupportsAutomaticOcr,
  });

  const queueDocumentForOcr = (document: DocumentItem, options: SilentOptions = {}) => queueDocumentForOcrWorkflow({
    document,
    silent: Boolean(options?.silent),
    requirePermission,
    loadDocumentDataUrl,
    documentSupportsAutomaticOcr,
    automaticDocumentOcrAvailable,
    updateDocument: actions.updateDocument,
    setNotice,
    setDocumentOcrBusyById,
    runAutomaticDocumentOcr,
    normalizeExtractedDocumentText,
  });

  const applyAutomaticOcrToImportDraft = (draft: DocumentImportDraft) => runDocumentImportOcrWorkflow({
    draft,
    requestIdRef: documentImportOcrRequestIdRef,
    documentSupportsAutomaticOcr,
    automaticDocumentOcrAvailable,
    setBusy: setDocumentImportOcrBusy,
    setMessage: setDocumentImportOcrMessage,
    runAutomaticDocumentOcr,
    normalizeExtractedDocumentText,
    setDraft: setDocumentImportDraft,
    getSuggestedTags: getDocumentImportSuggestedTags,
    formatTags: formatDocumentTags,
  });

  const onDocumentImportInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!canAttachToTransaction(file)) {
      setNotice("Import a PDF or image file for scanned document intake.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const draft = buildDocumentImportFileDraft({
        previous: documentImportDraft,
        file,
        dataUrl,
        propertyFilter,
        unitFilter,
        defaultPropertyId: properties[0]?.id || "",
        suggestDocumentType,
        getSuggestedTags: getDocumentImportSuggestedTags,
        formatTags: formatDocumentTags,
      });
      setDocumentImportDraft(draft);
      setDocumentImportDialogOpen(true);
      setDocumentImportOcrMessage("");
      void applyAutomaticOcrToImportDraft(draft);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import this file.");
    } finally {
      event.target.value = "";
    }
  };

  const openMobileCompanionImport = async (submission: CompanionSubmission) => {
    if (!requirePermission("review_documents", "This access profile cannot import mobile captures.")) return false;
    if (!desktopCompanionApi?.download || !submission?.id) {
      setNotice("The Mobile Companion is available in the installed desktop app.");
      return false;
    }

    const alreadyImported = documents.find((document) =>
      document.sourceRef?.provider === "rental-tracker-companion" &&
      document.sourceRef.submissionId === submission.id,
    );
    if (alreadyImported) {
      void desktopCompanionApi.complete(submission.id);
      setNotice(`${submission.originalFileName} is already in Documents.`);
      return true;
    }

    try {
      const claimed = await desktopCompanionApi.claim(submission.id);
      if (claimed?.ok === false) throw new Error(claimed.message || claimed.error || "Could not claim this mobile capture.");
      const downloaded = await desktopCompanionApi.download(submission.id);
      if (downloaded?.ok === false || !downloaded?.dataUrl) {
        throw new Error(downloaded?.message || downloaded?.error || "Could not download this mobile capture.");
      }
      const remote = downloaded.submission || submission;
      const companionContext = buildMobileCompanionImportContext(remote);
      const propertyLabel = String(remote.propertyLabel || "").trim();
      const normalizedPropertyLabel = propertyLabel.toLowerCase();
      const matchedProperty = normalizedPropertyLabel
        ? properties.find((property) =>
            [property.name, property.address].some((value) => String(value || "").trim().toLowerCase() === normalizedPropertyLabel),
          )
        : null;
      const propertyId = matchedProperty?.id || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || "");
      const unit = String(remote.unitLabel || "").trim() || (unitFilter !== "all" ? unitFilter : "Shared");
      const prior = createBlankDocumentImportDraft(propertyId, unit);
      let draft = buildDocumentImportFileDraft({
        previous: prior,
        file: { name: remote.originalFileName, type: remote.contentType },
        dataUrl: downloaded.dataUrl,
        propertyFilter: propertyId || propertyFilter,
        unitFilter: unit,
        defaultPropertyId: properties[0]?.id || "",
        suggestDocumentType,
        getSuggestedTags: getDocumentImportSuggestedTags,
        formatTags: formatDocumentTags,
      });
      draft = {
        ...draft,
        propertyId,
        unit,
        type: companionContext.documentType,
        extractedText: companionContext.extractedText,
        ocrStatus: companionContext.ocrStatus,
        tags: formatDocumentTags([
          ...String(draft.tags || "").split(",").filter(Boolean).map((tag) => ({ tag: tag.trim(), sources: ["context"] })),
          { tag: companionContext.contextTag, sources: ["context"] },
          { tag: "Mobile capture", sources: ["context"] },
        ]),
        sourceRef: {
          provider: "rental-tracker-companion",
          submissionId: remote.id,
          kind: companionContext.kind,
          sha256: remote.sha256,
          capturedAt: remote.capturedAt,
          propertyLabel: propertyLabel || undefined,
          unitLabel: String(remote.unitLabel || "").trim() || undefined,
          note: String(remote.note || "").trim() || undefined,
        },
      };
      setDocumentImportDraft(draft);
      setDocumentImportDialogOpen(true);
      setDocumentImportOcrMessage(companionContext.message);
      if (companionContext.shouldRunOcr) void applyAutomaticOcrToImportDraft(draft);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import this mobile capture.");
      return false;
    }
  };

  const markVisibleDocumentsPendingOcr = () => markVisibleDocumentsPendingOcrWorkflow({
    documents: visibleDocumentsMissingIndex,
    documentStatusFilter,
    requirePermission,
    updateDocument: actions.updateDocument,
    addAuditEntry,
    setNotice,
  });

  const runVisibleDocumentOcr = () => runVisibleDocumentOcrWorkflow({
    documents: visibleAutomaticOcrDocuments,
    requirePermission,
    setBusy: setDocumentBatchOcrBusy,
    queueDocument: queueDocumentForOcr,
    addAuditEntry,
    setNotice,
  });

  const applyDocumentLinkSuggestion = (document: DocumentItem, suggestion: DocumentLinkSuggestion, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document || !suggestion?.id) {
      if (!silent) setNotice("That suggested link is no longer available.");
      return;
    }
    const nextFields = buildDocumentLinkUpdate(document, suggestion);
    actions.updateDocument(document.id, nextFields);
    if (!silent) {
      setNotice(`Linked ${document.name} to ${documentLinkSuggestionKindLabel(suggestion.kind).toLowerCase()} ${suggestion.label}.`);
    }
  };

  const removeDocumentRecordLink = (document: DocumentItem, kind: "lease" | "transaction" | "workOrder", options: UnlinkOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    const nextFields = buildDocumentUnlinkUpdate(document, kind, options?.relatedTransactionId);
    if (!nextFields) return;
    actions.updateDocument(document.id, nextFields);
    if (!silent) setNotice("Document link removed.");
  };

  const applyDocumentImportLinkSuggestion = (suggestion: DocumentLinkSuggestion) => {
    if (!suggestion?.id) {
      setNotice("That suggested link is no longer available.");
      return;
    }

    setDocumentImportDraft((prev: DocumentImportDraft) => applyDocumentImportLinkSuggestionToDraft(prev, suggestion));
    setNotice(`Applied suggested ${documentLinkSuggestionKindLabel(suggestion.kind).toLowerCase()} link.`);
  };

  const saveImportedDocument = (options: SaveImportedDocumentOptions = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot save imported documents.")) return;
    const name = String(documentImportDraft.name || "").trim();
    const type = String(documentImportDraft.type || "").trim() || "Scanned PDF";
    if (!name || !documentImportDraft.dataUrl) {
      setNotice("Choose a scanned PDF or image before saving.");
      return;
    }

    const extractedText = normalizeExtractedDocumentText(documentImportDraft.extractedText);
    const autoLinkSuggestion =
      documentImportDraft.linkType === "none" &&
      !options.reviewUtilitySection &&
      !options.reviewExpenseDraft &&
      !options.reviewWorkOrderDraft
        ? getDocumentImportLinkSuggestions?.(documentImportDraft, extractedText).find((suggestion: any) => suggestion.confidence === "high") || null
        : null;
    const effectiveLinkType = autoLinkSuggestion
      ? (autoLinkSuggestion.kind === "workOrder" ? "workOrder" : autoLinkSuggestion.kind)
      : documentImportDraft.linkType;
    const effectiveLinkedId = autoLinkSuggestion?.id || documentImportDraft.linkedId;
    const ocrStatus = normalizeDocumentOcrStatus(documentImportDraft.ocrStatus, extractedText);
    const importedDocument = buildImportedDocumentRecord({
      draft: documentImportDraft,
      effectiveLinkType,
      effectiveLinkedId,
      extractedText,
      leaseById,
      transactionById,
      workOrderById,
      id: `d${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      ocrStatus,
    });
    if (!importedDocument) {
      setNotice("Select a property before saving the imported document.");
      return;
    }
    actions.addDocument(importedDocument);
    if (importedDocument.sourceRef?.provider === "rental-tracker-companion") {
      void desktopCompanionApi?.complete?.(importedDocument.sourceRef.submissionId).then((result) => {
        if (result?.ok === false) {
          setNotice(`Imported ${name}. The mobile inbox will retry its completion status later.`);
        }
      });
    }

    addAuditEntry({
      action: "import",
      entityType: "document",
      entityId: name,
      propertyId: importedDocument.propertyId,
      unit: importedDocument.unit,
      summary: ocrStatus === "completed" ? `Imported ${name} with searchable text.` : `Imported ${name} for OCR review.`,
      details: `Type ${type} | Link ${effectiveLinkType || "none"}.`,
      category: "document",
    });
    closeDocumentImportDialog();
    if (options.reviewUtilitySection) {
      openExpenseDraftFromDocument(importedDocument, options.reviewUtilitySection, { linkMode: "related" });
      return;
    }
    if (options.createUtilitySectionTransactions) {
      createExpenseTransactionsFromUtilitySections(importedDocument, getDocumentUtilitySections(importedDocument));
      return;
    }
    if (options.reviewExpenseDraft && documentImportExpenseSuggestion) {
      openExpenseDraftFromDocument(importedDocument, documentImportExpenseSuggestion);
      return;
    }
    if (options.reviewWorkOrderDraft && documentImportWorkOrderSuggestion) {
      openWorkOrderDraftFromDocument(importedDocument, documentImportWorkOrderSuggestion);
      return;
    }
    if (autoLinkSuggestion) {
      setNotice(`Imported ${name} and linked the suggested ${documentLinkSuggestionKindLabel(autoLinkSuggestion.kind).toLowerCase()}.`);
    } else {
      setNotice(ocrStatus === "completed" ? `Imported ${name} with searchable text.` : `Imported ${name}. OCR is queued.`);
    }
  };

  const openDocumentLinkedRecord = (document: DocumentItem, target: "transaction" | "lease" | "workOrder") => {
    if (target === "transaction") {
      if (!document.transactionId || !transactionById[document.transactionId]) {
        setNotice("Linked transaction was not found.");
        return;
      }
      openTransaction(transactionById[document.transactionId], "documents", false);
      return;
    }
    if (target === "lease") {
      if (!document.leaseId || !leaseById[document.leaseId]) {
        setNotice("Linked lease was not found.");
        return;
      }
      openLease(leaseById[document.leaseId]);
      return;
    }

    const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
    if (!linkedWorkOrder) {
      setNotice("Linked work order was not found.");
      return;
    }
    setPropertyFilter(linkedWorkOrder.propertyId);
    setUnitFilter(linkedWorkOrder.unit || "all");
    setView("maintenance");
    setNotice(`Showing work order ${linkedWorkOrder.title}.`);
  };

  const openExpenseDraftFromDocument = (doc: DocumentItem, suggestion: any, options: ExpenseDraftOptions = {}) => {
    if (!doc || !suggestion) {
      setNotice("No expense draft suggestion is available for this document yet.");
      return;
    }

    const nextPropertyId = suggestion.propertyId || doc.propertyId;
    const propertyExists = properties.some((property) => property.id === nextPropertyId);
    if (!propertyExists) {
      setNotice("Select or import the document under a valid property before opening an expense draft.");
      return;
    }

    const unitOptions = new Set(["Shared", ...units.filter((unit) => unit.propertyId === nextPropertyId).map((unit) => unit.name)]);
    const nextUnit = unitOptions.has(suggestion.unit || doc.unit || "Shared") ? (suggestion.unit || doc.unit || "Shared") : "Shared";
    const linkedWorkOrder = getDocumentLinkedWorkOrder(doc);
    const nextQueueRecord = getNextExpenseQueueRecord(doc.id);
    const baseDraft = {
      ...createBlankForm(nextPropertyId, nextUnit),
      date: suggestion.date || todayIso,
      propertyId: nextPropertyId,
      unit: nextUnit,
      type: "Expense",
      category: suggestion.category || "Other expenses",
      amount: suggestion.amount != null ? String(suggestion.amount) : "",
      description: suggestion.description || doc.type || doc.name,
      vendor: suggestion.vendor || "",
      receiptName: doc.name || "",
      notes: `OCR draft from ${doc.name}. Review before saving.`,
      invoiceRef: suggestion.invoiceRef || "",
      invoiceAmount: suggestion.amount != null ? String(suggestion.amount) : "",
      servicePeriodStart: suggestion.servicePeriodStart || "",
      servicePeriodEnd: suggestion.servicePeriodEnd || "",
      workOrderId: linkedWorkOrder?.id || "",
    };
    const matchedVendorMemory = findTransactionVendorMemoryForDraft(baseDraft, transactionVendorMemories);
    const vendorMemory = matchedVendorMemory?.type === "Expense" ? matchedVendorMemory : null;
    const memoryDraft = applyTransactionVendorMemoryToDraft(baseDraft, vendorMemory, categories);
    const nextDraft = vendorMemory
      ? {
          ...memoryDraft,
          propertyId: nextPropertyId,
          unit: vendorMemory.propertyId === nextPropertyId ? memoryDraft.unit : nextUnit,
        }
      : baseDraft;
    const prefilledFields = [
      "date",
      "propertyId",
      "unit",
      "type",
      "category",
      suggestion.amount != null ? "amount" : "",
      "description",
      suggestion.vendor ? "vendor" : "",
      suggestion.invoiceRef ? "invoiceRef" : "",
      suggestion.amount != null ? "invoiceAmount" : "",
      suggestion.servicePeriodStart ? "servicePeriodStart" : "",
      suggestion.servicePeriodEnd ? "servicePeriodEnd" : "",
      linkedWorkOrder?.id ? "workOrderId" : "",
      vendorMemory ? "vendorMemory" : "",
    ].filter(Boolean);
    if (doc.expenseReviewDismissedAt) {
      actions.updateDocument(doc.id, { expenseReviewDismissedAt: undefined });
    }
    if (documentStatusFilter === "expense_queue") {
      setExpenseQueueFocusDocumentId(nextQueueRecord?.document.id || "");
      setExpenseQueueShowDismissed(false);
    }
    const possibleDuplicateTransaction = getDocumentLinkSuggestions(doc).find((linkSuggestion: any) => (
      linkSuggestion.kind === "transaction" &&
      linkSuggestion.confidence === "high" &&
      String(linkSuggestion.id || "") !== String(doc.transactionId || "")
    )) || null;

    setEditingTxnId("");
    setEditReturnView("documents");
    setPendingTxnAttachment(null);
    setPendingDocumentExpenseSource({
      documentId: doc.id,
      documentName: doc.name,
      confidence: suggestion.confidence,
      reasonSummary: expenseSuggestionReasonSummary(suggestion),
      prefilledFields,
      linkMode: options.linkMode || "primary",
      possibleDuplicateTransaction,
      nextDocumentId: nextQueueRecord?.document.id || "",
      nextDocumentName: nextQueueRecord?.document.name || "",
    });
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setForm(nextDraft);
    setRentAmountTouched(true);
    setSelectedTxn(null);
    setView("quickAdd");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      globalThis.document?.querySelector("main")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
    setNotice(
      `${vendorMemory ? "Expense draft opened with vendor defaults. " : "Expense draft opened from OCR suggestion. "}` +
        (nextQueueRecord ? "Next OCR draft is ready after this one." : "Review before saving."),
    );
  };

  const openExpenseDraftFromUtilitySection = (document: DocumentItem, section: any) => {
    openExpenseDraftFromDocument(document, section, { linkMode: "related" });
  };

  const dismissDocumentExpenseReview = (document: DocumentItem, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    if (document.transactionId) {
      if (!silent) setNotice("This document is already linked to a transaction.");
      return;
    }
    const nextRecord = getNextExpenseQueueRecord(document.id);
    if (documentStatusFilter === "expense_queue") {
      setExpenseQueueFocusDocumentId(nextRecord?.document.id || "");
    }
    actions.updateDocument(document.id, { expenseReviewDismissedAt: new Date().toISOString() });
    if (!silent) setNotice(`Expense suggestion dismissed for ${document.name}.${nextRecord ? ` Next up: ${nextRecord.document.name}.` : ""}`);
  };

  const reopenDocumentExpenseReview = (document: DocumentItem, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    if (documentStatusFilter === "expense_queue") {
      setExpenseQueueFocusDocumentId(document.id);
    }
    actions.updateDocument(document.id, { expenseReviewDismissedAt: undefined });
    if (!silent) setNotice("Expense suggestion reopened for review.");
  };

  const dismissDocumentWorkOrderReview = (document: DocumentItem, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    if (getDocumentLinkedWorkOrder(document)) {
      if (!silent) setNotice("This document is already linked to a work order.");
      return;
    }
    actions.updateDocument(document.id, { workOrderReviewDismissedAt: new Date().toISOString() });
    if (!silent) setNotice(`Work order suggestion dismissed for ${document.name}.`);
  };

  const reopenDocumentWorkOrderReview = (document: DocumentItem, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    actions.updateDocument(document.id, { workOrderReviewDismissedAt: undefined });
    if (!silent) setNotice("Work order suggestion reopened for review.");
  };

  const dismissVisibleExpenseQueue = () => {
    if (visibleExpenseReviewRecords.length === 0) {
      setNotice("No visible OCR expense suggestions are waiting for review.");
      return;
    }

    const runDismiss = () => {
      visibleExpenseReviewRecords.forEach((record: any) => {
        dismissDocumentExpenseReview(record.document, { silent: true });
      });
      setNotice(`Dismissed ${visibleExpenseReviewRecords.length} visible expense suggestion${visibleExpenseReviewRecords.length === 1 ? "" : "s"}.`);
    };

    if (!appConfirmDestructiveActions) {
      runDismiss();
      return;
    }

    openConfirmDialog({
      title: "Mark visible suggestions as not expenses?",
      message: `Mark ${visibleExpenseReviewRecords.length} visible OCR expense suggestion${visibleExpenseReviewRecords.length === 1 ? "" : "s"} as not expenses? You can reopen any document from the Documents list later.`,
      confirmLabel: "Not an expense",
      onConfirm: runDismiss,
    });
  };

  const reviewNextExpenseQueueItem = () => {
    const focusedRecord = visibleExpenseReviewRecords.find((record: any) => record.document.id === expenseQueueFocusDocumentId) || null;
    const nextRecord = focusedRecord || visibleExpenseReviewRecords[0] || documentExpenseReviewRecords.find((record: any) => !record.dismissed) || null;
    if (!nextRecord) {
      setNotice("No OCR expense suggestions are waiting for review.");
      return;
    }
    selectExpenseQueueFilter();
    openExpenseDraftFromDocument(nextRecord.document, nextRecord.suggestion);
  };

  const openWorkOrderDraftFromDocument = (doc: DocumentItem, suggestion: any) => {
    if (!doc || !suggestion?.propertyId || !suggestion?.title) {
      setNotice("No work order draft suggestion is available for this document yet.");
      return;
    }

    const nextQueueRecord = getNextWorkOrderQueueRecord(doc.id);
    if (doc.workOrderReviewDismissedAt) {
      actions.updateDocument(doc.id, { workOrderReviewDismissedAt: undefined });
    }

    setPendingDocumentWorkOrderSource({
      documentId: doc.id,
      documentName: doc.name,
      confidence: suggestion.confidence,
      reasonSummary: workOrderSuggestionReasonSummary(suggestion),
      nextDocumentId: nextQueueRecord?.document.id || "",
      nextDocumentName: nextQueueRecord?.document.name || "",
    });
    setPropertyFilter(suggestion.propertyId);
    setUnitFilter(suggestion.unit || "all");
    setWorkOrderDraft({
      propertyId: suggestion.propertyId,
      unit: suggestion.unit || "Shared",
      title: suggestion.title || "",
      description: suggestion.description || "",
      priority: suggestion.priority || "Medium",
      status: "Open",
      reportedOn: suggestion.reportedOn || todayIso,
      dueDate: "",
      vendorId: suggestion.vendorId || "",
      estimatedCost: suggestion.estimatedCost != null ? String(suggestion.estimatedCost) : "",
      actualCost: "",
      notes: `OCR draft from ${doc.name}. Review before creating.`,
    });
    setView("maintenance");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      globalThis.document?.querySelector("main")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
    setNotice(nextQueueRecord ? "Work order draft opened. Next OCR work order is ready after this one." : "Work order draft opened from OCR suggestion. Review before creating.");
  };

  const reviewNextWorkOrderQueueItem = () => {
    const nextRecord = visibleWorkOrderReviewRecords[0] || documentWorkOrderReviewRecords.find((record: any) => !record.dismissed) || null;
    if (!nextRecord) {
      setNotice("No OCR work order suggestions are waiting for review.");
      return;
    }
    selectWorkOrderQueueFilter();
    openWorkOrderDraftFromDocument(nextRecord.document, nextRecord.suggestion);
  };

  const { openDocumentPreview, loadDocumentForReview, openDocumentExternally, confirmAndDeleteDocument, saveDocumentTags, applySuggestedDocumentTags, saveDocumentExtractedText, saveDocumentOcrFieldCorrections, markDocumentWarningsReviewed, updateLinkedTransactionFromDocumentOcr } = createDocumentRecordActions({
    actions,
    addAuditEntry,
    appConfirmDestructiveActions,
    desktopDocumentOpenApi,
    getDocumentExpenseSuggestion,
    getDocumentExtractedFields,
    getDocumentSuggestedTags,
    loadDocumentDataUrl,
    normalizeExtractedDocumentText,
    openConfirmDialog,
    prefetchDialog,
    requirePermission,
    setNotice,
    setSelectedDocument,
    transactionById,
    vendors,
  });

  const { getSafeDocumentTagSuggestions, getSafeDocumentLinkSuggestion, canAutoCreateExpenseFromSuggestion, canAutoCreateWorkOrderFromSuggestion, createWorkOrderFromDocumentSuggestion, createExpenseFromDocumentSuggestion, createExpenseTransactionsFromUtilitySections, applySafeSuggestionsToDocument, acceptVisibleSafeSuggestions } = createDocumentSuggestionActions({
    actions,
    addAuditEntry,
    applyDocumentLinkSuggestion,
    documentSearch,
    documentStatusFilter,
    getDocumentExpenseSuggestion,
    getDocumentExtractedFields,
    getDocumentLinkSuggestions,
    getDocumentLinkedWorkOrder,
    getDocumentSuggestedTags,
    getDocumentWorkOrderSuggestion,
    requirePermission,
    saveDocumentTags,
    setNotice,
    todayIso,
    transactionById,
    transactions,
    visibleDocuments,
  });

  const { runDocumentAiAnalysis } = createDocumentAiActions({
    actions,
    addAuditEntry,
    aiDocumentCopilotEnabled,
    aiOpenAiApiKey,
    aiOpenAiModel,
    buildDocumentAiContext,
    desktopDocumentAiApi,
    normalizeExtractedDocumentText,
    queueDocumentForOcr,
    requirePermission,
    setDocumentAiBusyById,
    setNotice,
  });

  return {
    acceptVisibleSafeSuggestions,
    applyAutomaticOcrToImportDraft,
    applyDocumentImportLinkSuggestion,
    applyDocumentLinkSuggestion,
    applySafeSuggestionsToDocument,
    applySuggestedDocumentTags,
    canAutoCreateExpenseFromSuggestion,
    canAutoCreateWorkOrderFromSuggestion,
    closeDocumentImportDialog,
    confirmAndDeleteDocument,
    createExpenseFromDocumentSuggestion,
    createExpenseTransactionsFromUtilitySections,
    createWorkOrderFromDocumentSuggestion,
    dismissDocumentExpenseReview,
    dismissDocumentWorkOrderReview,
    dismissVisibleExpenseQueue,
    getSafeDocumentLinkSuggestion,
    getSafeDocumentTagSuggestions,
    markVisibleDocumentsPendingOcr,
    markDocumentWarningsReviewed,
    updateLinkedTransactionFromDocumentOcr,
    onDocumentImportInputChange,
    openMobileCompanionImport,
    openDocumentExternally,
    openDocumentImportPicker,
    openDocumentLinkedRecord,
    loadDocumentForReview,
    openDocumentPreview,
    openExpenseDraftFromDocument,
    openExpenseDraftFromUtilitySection,
    openWorkOrderDraftFromDocument,
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
    saveImportedDocument,
  };
}
