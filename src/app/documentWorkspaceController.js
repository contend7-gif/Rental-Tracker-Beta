import { removeSupportingOnlyTag } from "../features/documents/documentWorkflow.js";
import { buildDocumentQualityWarnings } from "../features/documents/documentPresentation.js";
import {
  applyTransactionVendorMemoryToDraft,
  findTransactionVendorMemoryForDraft,
} from "../features/transactions/transactionVendorMemory.js";

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
  closeConfirmDialog,
  createBlankDocumentImportDraft,
  createBlankForm,
  desktopDocumentAiApi,
  desktopDocumentOpenApi,
  documentExpenseReviewRecords,
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
  parseDocumentTags,
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
  transactionVendorMemories,
  txnAttachmentInputRef,
  unitFilter,
  units,
  visibleAutomaticOcrDocuments,
  visibleDocuments,
  visibleDocumentsMissingIndex,
  visibleExpenseReviewRecords,
  visibleWorkOrderReviewRecords,
  workOrderById,
  workOrderSuggestionReasonSummary,
}) {
  const closeDocumentImportDialog = () => {
    documentImportOcrRequestIdRef.current += 1;
    setDocumentImportOcrBusy(false);
    setDocumentImportOcrMessage("");
    setDocumentImportDialogOpen(false);
    setDocumentImportDraft(createBlankDocumentImportDraft(propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || ""), unitFilter !== "all" ? unitFilter : "Shared"));
  };

  const openDocumentImportPicker = (context = {}) => {
    prefetchDialog("documentImport");
    if (context && Object.keys(context).length > 0) {
      setDocumentImportDraft((prev) => {
        const base = createBlankDocumentImportDraft(
          context.propertyId || prev.propertyId || (propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || "")),
          context.unit || prev.unit || (unitFilter !== "all" ? unitFilter : "Shared"),
        );
        const tags = Array.from(new Set([
          ...parseDocumentTags(prev.tags),
          ...parseDocumentTags(context.tags || ""),
        ]));
        return {
          ...base,
          ...prev,
          propertyId: context.propertyId || prev.propertyId || base.propertyId,
          unit: context.unit || prev.unit || base.unit,
          type: context.type || prev.type || base.type,
          tags: tags.join(", "),
          linkType: context.linkType || prev.linkType || "none",
          linkedId: context.linkedId || prev.linkedId || "",
        };
      });
    } else {
      setDocumentImportDraft(createBlankDocumentImportDraft(
        propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || ""),
        unitFilter !== "all" ? unitFilter : "Shared",
      ));
    }
    documentImportInputRef.current?.click();
  };

  const runAutomaticDocumentOcr = async (documentLike) => {
    if (!documentSupportsAutomaticOcr(documentLike?.name, documentLike?.mimeType)) {
      return {
        ok: false,
        supported: false,
        reason: "unsupported-file",
        message: "Automatic OCR currently supports PDFs and common image files.",
      };
    }

    if (!automaticDocumentOcrAvailable) {
      return {
        ok: false,
        supported: false,
        reason: "desktop-unavailable",
        message: "Automatic OCR runs in the Windows desktop app.",
      };
    }

    return window.desktopDocumentOcr.extract({
      name: documentLike?.name || "document",
      mimeType: documentLike?.mimeType || "application/octet-stream",
      dataUrl: documentLike?.dataUrl || "",
    });
  };

  const queueDocumentForOcr = async (document, options = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot queue OCR review actions.")) return { ok: false };
    const silent = Boolean(options?.silent);
    if (!document) return { ok: false };

    if (!document.dataUrl) {
      if (!silent) setNotice("This document has no file attached for OCR.");
      return { ok: false, reason: "missing-file" };
    }

    if (!documentSupportsAutomaticOcr(document.name, document.mimeType)) {
      actions.updateDocument(document.id, { ocrStatus: "pending" });
      if (!silent) setNotice("OCR review queued. Automatic OCR is only available for PDFs and images.");
      return { ok: true, queued: true, completed: false };
    }

    if (!automaticDocumentOcrAvailable) {
      actions.updateDocument(document.id, { ocrStatus: "pending" });
      if (!silent) setNotice("OCR review queued. Open the Windows desktop app to run automatic OCR.");
      return { ok: true, queued: true, completed: false };
    }

    setDocumentOcrBusyById((prev) => ({ ...prev, [document.id]: true }));
    try {
      const result = await runAutomaticDocumentOcr(document);
      if (!result?.ok) {
        actions.updateDocument(document.id, { ocrStatus: "pending" });
        if (!silent) setNotice(result?.message || "Automatic OCR could not start.");
        return { ok: false, queued: true, completed: false, reason: result?.reason || "ocr-failed" };
      }

      const normalizedText = normalizeExtractedDocumentText(result.text);
      if (normalizedText) {
        actions.updateDocument(document.id, {
          extractedText: normalizedText,
          ocrStatus: "completed",
          expenseReviewDismissedAt: undefined,
          workOrderReviewDismissedAt: undefined,
        });
        if (!silent) {
          setNotice(
            result.truncated
              ? `Automatic OCR extracted text from the first ${result.processedPages} pages. Review before saving.`
              : "Automatic OCR extracted searchable text.",
          );
        }
        return { ok: true, queued: false, completed: true, text: normalizedText };
      }

      actions.updateDocument(document.id, { ocrStatus: "pending" });
      if (!silent) setNotice("Automatic OCR ran, but no readable text was found. The document remains in Needs OCR.");
      return { ok: true, queued: true, completed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Automatic OCR failed.");
      actions.updateDocument(document.id, { ocrStatus: "pending" });
      if (!silent) setNotice(`Automatic OCR failed: ${message}`);
      return { ok: false, queued: true, completed: false, reason: "ocr-failed" };
    } finally {
      setDocumentOcrBusyById((prev) => {
        const next = { ...prev };
        delete next[document.id];
        return next;
      });
    }
  };

  const runDocumentAiAnalysis = async (document, options = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot run AI document review actions.")) return false;
    if (!aiDocumentCopilotEnabled) {
      setNotice("Enable AI document copilot in Settings first.");
      return false;
    }
    if (!String(aiOpenAiApiKey || "").trim()) {
      setNotice("Add an OpenAI API key in Settings first.");
      return false;
    }
    if (!desktopDocumentAiApi?.analyze) {
      setNotice("AI document actions run in the installed desktop app.");
      return false;
    }

    let workingDocument = document;
    let extractedText = normalizeExtractedDocumentText(document.extractedText || "");
    if (!extractedText) {
      const ocrResult = await queueDocumentForOcr(document, { silent: true });
      if (ocrResult?.ok && ocrResult?.completed && ocrResult?.text) {
        extractedText = normalizeExtractedDocumentText(ocrResult.text);
        workingDocument = {
          ...document,
          extractedText,
          ocrStatus: "completed",
        };
      } else if (ocrResult?.queued) {
        setNotice("This document needs OCR or manual extracted text before AI can analyze it.");
        return false;
      } else if (!ocrResult?.ok) {
        return false;
      }
    }

    const context = buildDocumentAiContext(workingDocument);

    setDocumentAiBusyById((prev) => ({ ...prev, [document.id]: true }));
    try {
      const result = await desktopDocumentAiApi.analyze({
        apiKey: aiOpenAiApiKey,
        model: aiOpenAiModel,
        context,
      });
      if (!result?.ok || !result?.analysis) {
        setNotice(result?.error || "AI could not analyze this document.");
        return false;
      }
      actions.updateDocument(document.id, { aiAnalysis: result.analysis });
      addAuditEntry({
        action: "ai-analyze",
        entityType: "document",
        entityId: workingDocument.id,
        propertyId: workingDocument.propertyId,
        unit: workingDocument.unit,
        summary: "Ran AI document analysis.",
        details: `Model ${result.analysis.model || aiOpenAiModel || "default"} on ${workingDocument.name}.`,
        category: "document",
      });
      if (!options.silent) {
        setNotice("AI analysis saved on the document.");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown AI error.");
      setNotice(`AI analysis failed: ${message}`);
      return false;
    } finally {
      setDocumentAiBusyById((prev) => {
        const next = { ...prev };
        delete next[document.id];
        return next;
      });
    }
  };

  const applyAutomaticOcrToImportDraft = async (draft) => {
    documentImportOcrRequestIdRef.current += 1;
    const requestId = documentImportOcrRequestIdRef.current;

    if (!documentSupportsAutomaticOcr(draft?.name, draft?.mimeType)) {
      setDocumentImportOcrBusy(false);
      setDocumentImportOcrMessage("Automatic OCR currently supports PDFs and common image files.");
      return;
    }

    if (!automaticDocumentOcrAvailable) {
      setDocumentImportOcrBusy(false);
      setDocumentImportOcrMessage("Automatic OCR runs when you open the Windows desktop app.");
      return;
    }

    setDocumentImportOcrBusy(true);
    setDocumentImportOcrMessage("Running automatic OCR...");

    try {
      const result = await runAutomaticDocumentOcr(draft);
      if (documentImportOcrRequestIdRef.current !== requestId) return;

      if (!result?.ok) {
        setDocumentImportOcrMessage(result?.message || "Automatic OCR could not start.");
        return;
      }

      const normalizedText = normalizeExtractedDocumentText(result.text);
      if (normalizedText) {
        setDocumentImportDraft((prev) => {
          if (prev.dataUrl !== draft.dataUrl) return prev;
          return {
            ...prev,
            extractedText: normalizedText,
            ocrStatus: "completed",
            tags: formatDocumentTags(getDocumentImportSuggestedTags(prev, normalizedText)),
          };
        });
        setDocumentImportOcrMessage(
          result.truncated
            ? `Automatic OCR extracted text from the first ${result.processedPages} pages. Review before saving.`
            : "Automatic OCR extracted searchable text. Review before saving.",
        );
      } else {
        setDocumentImportDraft((prev) => {
          if (prev.dataUrl !== draft.dataUrl) return prev;
          return {
            ...prev,
            ocrStatus: "pending",
          };
        });
        setDocumentImportOcrMessage("Automatic OCR ran, but no readable text was found. You can still save this as pending OCR.");
      }
    } catch (error) {
      if (documentImportOcrRequestIdRef.current !== requestId) return;
      const message = error instanceof Error ? error.message : String(error || "Automatic OCR failed.");
      setDocumentImportOcrMessage(`Automatic OCR failed: ${message}`);
    } finally {
      if (documentImportOcrRequestIdRef.current === requestId) {
        setDocumentImportOcrBusy(false);
      }
    }
  };

  const onDocumentImportInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!canAttachToTransaction(file)) {
      setNotice("Import a PDF or image file for scanned document intake.");
      event.target.value = "";
      return;
    }

    try {
      const nextPropertyId = documentImportDraft.propertyId || (propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || ""));
      const nextUnit = documentImportDraft.unit || (unitFilter !== "all" ? unitFilter : "Shared");
      const suggestedType = suggestDocumentType(file.name, file.type);
      const type = documentImportDraft.type && documentImportDraft.type !== "Scanned PDF" ? documentImportDraft.type : suggestedType;
      const dataUrl = await readFileAsDataUrl(file);
      const draft = {
        name: file.name,
        type,
        propertyId: nextPropertyId,
        unit: nextUnit,
        linkType: documentImportDraft.linkType || "none",
        linkedId: documentImportDraft.linkedId || "",
        tags: documentImportDraft.tags || "",
        extractedText: "",
        ocrStatus: "pending",
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      };
      draft.tags = formatDocumentTags([
        ...parseDocumentTags(draft.tags).map((tag) => ({ tag, sources: ["context"] })),
        ...getDocumentImportSuggestedTags(draft),
      ]);
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

  const markVisibleDocumentsPendingOcr = () => {
    if (!requirePermission("review_documents", "This access profile cannot queue OCR review actions.")) return;
    if (visibleDocumentsMissingIndex.length === 0) {
      setNotice("No visible documents need OCR review.");
      return;
    }

    visibleDocumentsMissingIndex.forEach((document) => {
      actions.updateDocument(document.id, { ocrStatus: "pending" });
    });
    addAuditEntry({
      action: "queue-ocr",
      entityType: "document-batch",
      entityId: `visible-${visibleDocumentsMissingIndex.length}`,
      summary: `Queued ${visibleDocumentsMissingIndex.length} visible document${visibleDocumentsMissingIndex.length === 1 ? "" : "s"} for OCR review.`,
      details: `Current search/filter scope: ${documentStatusFilter}.`,
      category: "document",
    });
    setNotice(`Queued ${visibleDocumentsMissingIndex.length} visible document${visibleDocumentsMissingIndex.length === 1 ? "" : "s"} for OCR review.`);
  };

  const runVisibleDocumentOcr = async () => {
    if (!requirePermission("review_documents", "This access profile cannot run OCR review actions.")) return;
    if (visibleAutomaticOcrDocuments.length === 0) {
      setNotice("No visible OCR-ready documents are available.");
      return;
    }

    setDocumentBatchOcrBusy(true);
    try {
      let completedCount = 0;
      for (const document of visibleAutomaticOcrDocuments) {
        const result = await queueDocumentForOcr(document, { silent: true });
        if (result?.ok && result?.completed) {
          completedCount += 1;
        }
      }
      if (completedCount > 0) {
        addAuditEntry({
          action: "run-ocr",
          entityType: "document-batch",
          entityId: `visible-${visibleAutomaticOcrDocuments.length}`,
          summary: `Ran automatic OCR on ${visibleAutomaticOcrDocuments.length} visible document${visibleAutomaticOcrDocuments.length === 1 ? "" : "s"}.`,
          details: `${completedCount} extracted text result${completedCount === 1 ? "" : "s"}.`,
          category: "document",
        });
      }
      setNotice(
        completedCount > 0
          ? `Automatic OCR finished for ${completedCount} visible document${completedCount === 1 ? "" : "s"}.`
          : "Automatic OCR ran, but no readable text was found in the visible documents.",
      );
    } finally {
      setDocumentBatchOcrBusy(false);
    }
  };

  const applyDocumentLinkSuggestion = (document, suggestion, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!document || !suggestion?.id) {
      if (!silent) setNotice("That suggested link is no longer available.");
      return;
    }
    const nextFields = {};
    if (suggestion.kind === "lease") {
      nextFields.leaseId = suggestion.id;
      nextFields.expenseReviewDismissedAt = undefined;
      nextFields.workOrderReviewDismissedAt = undefined;
    } else if (suggestion.kind === "transaction") {
      nextFields.transactionId = suggestion.id;
      nextFields.expenseReviewDismissedAt = undefined;
    } else {
      nextFields.workOrderId = suggestion.id;
      nextFields.workOrderReviewDismissedAt = undefined;
    }
    if (suggestion.propertyId) nextFields.propertyId = suggestion.propertyId;
    if (suggestion.unit) nextFields.unit = suggestion.unit;
    const nextTags = removeSupportingOnlyTag(document.tags);
    if (nextTags.length !== (Array.isArray(document.tags) ? document.tags.length : 0)) {
      nextFields.tags = nextTags;
    }
    actions.updateDocument(document.id, nextFields);
    if (!silent) {
      setNotice(`Linked ${document.name} to ${documentLinkSuggestionKindLabel(suggestion.kind).toLowerCase()} ${suggestion.label}.`);
    }
  };

  const removeDocumentRecordLink = (document, kind, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    const nextFields = {};
    if (kind === "lease") {
      nextFields.leaseId = undefined;
    } else if (kind === "transaction") {
      const relatedTransactionId = String(options?.relatedTransactionId || "").trim();
      if (relatedTransactionId) {
        nextFields.relatedTransactionIds = (document.relatedTransactionIds || []).filter((id) => id !== relatedTransactionId);
      } else {
        nextFields.transactionId = undefined;
      }
      nextFields.expenseReviewDismissedAt = undefined;
    } else if (kind === "workOrder") {
      nextFields.workOrderId = undefined;
      nextFields.workOrderReviewDismissedAt = undefined;
    } else {
      return;
    }
    actions.updateDocument(document.id, nextFields);
    if (!silent) setNotice("Document link removed.");
  };


  const applyDocumentImportLinkSuggestion = (suggestion) => {
    if (!suggestion?.id) {
      setNotice("That suggested link is no longer available.");
      return;
    }

    const nextLinkType = suggestion.kind === "workOrder" ? "workOrder" : suggestion.kind;
    setDocumentImportDraft((prev) => ({
      ...prev,
      linkType: nextLinkType,
      linkedId: suggestion.id,
      propertyId: suggestion.propertyId || prev.propertyId,
      unit: suggestion.unit || prev.unit,
    }));
    setNotice(`Applied suggested ${documentLinkSuggestionKindLabel(suggestion.kind).toLowerCase()} link.`);
  };

  const saveImportedDocument = (options = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot save imported documents.")) return;
    const name = String(documentImportDraft.name || "").trim();
    const type = String(documentImportDraft.type || "").trim() || "Scanned PDF";
    if (!name || !documentImportDraft.dataUrl) {
      setNotice("Choose a scanned PDF or image before saving.");
      return;
    }

    const linkedLease = documentImportDraft.linkType === "lease" ? leaseById[documentImportDraft.linkedId] : null;
    const linkedTxn = documentImportDraft.linkType === "transaction" ? transactionById[documentImportDraft.linkedId] : null;
    const linkedWorkOrder = documentImportDraft.linkType === "workOrder" ? workOrderById[documentImportDraft.linkedId] : null;
    const nextPropertyId = linkedLease?.propertyId || linkedTxn?.propertyId || linkedWorkOrder?.propertyId || documentImportDraft.propertyId;
    const nextUnit = linkedLease?.unit || linkedTxn?.unit || linkedWorkOrder?.unit || documentImportDraft.unit || "Shared";
    const extractedText = normalizeExtractedDocumentText(documentImportDraft.extractedText);
    const ocrStatus = normalizeDocumentOcrStatus(documentImportDraft.ocrStatus, extractedText);

    if (!nextPropertyId) {
      setNotice("Select a property before saving the imported document.");
      return;
    }

    const importedDocument = {
      id: `d${Date.now()}`,
      propertyId: nextPropertyId,
      unit: nextUnit,
      name,
      type,
      leaseId: linkedLease?.id,
      transactionId: linkedTxn?.id,
      workOrderId: linkedWorkOrder?.id,
      mimeType: documentImportDraft.mimeType || undefined,
      uploadedAt: new Date().toISOString(),
      dataUrl: documentImportDraft.dataUrl,
      tags: parseDocumentTags(documentImportDraft.tags),
      extractedText: extractedText || undefined,
      ocrStatus,
    };
    actions.addDocument(importedDocument);

    addAuditEntry({
      action: "import",
      entityType: "document",
      entityId: name,
      propertyId: nextPropertyId,
      unit: nextUnit,
      summary: ocrStatus === "completed" ? `Imported ${name} with searchable text.` : `Imported ${name} for OCR review.`,
      details: `Type ${type} | Link ${documentImportDraft.linkType || "none"}.`,
      category: "document",
    });
    closeDocumentImportDialog();
    if (options.reviewUtilitySection) {
      openExpenseDraftFromDocument(importedDocument, options.reviewUtilitySection, { linkMode: "related" });
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
    setNotice(ocrStatus === "completed" ? `Imported ${name} with searchable text.` : `Imported ${name}. OCR is queued.`);
  };

  const openDocumentLinkedRecord = (document, target) => {
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

  const openExpenseDraftFromDocument = (doc, suggestion, options = {}) => {
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

  const openDocumentPreview = (document) => {
    prefetchDialog("documentPreview");
    if (!document.dataUrl) {
      setNotice("This document has no previewable file attached.");
      return;
    }
    setSelectedDocument(document);
  };

  const openExpenseDraftFromUtilitySection = (document, section) => {
    openExpenseDraftFromDocument(document, section, { linkMode: "related" });
  };

  const openDocumentExternally = async (document) => {
    if (!document?.dataUrl) {
      setNotice("This document has no previewable file attached.");
      return;
    }

    if (desktopDocumentOpenApi?.openExternal) {
      const result = await desktopDocumentOpenApi.openExternal({
        name: document.name,
        mimeType: document.mimeType,
        dataUrl: document.dataUrl,
      });
      if (result?.ok === false) {
        setNotice(result?.message || "Could not open this file externally.");
      }
      return;
    }

    const opened = window.open(document.dataUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      setNotice("Could not open this file in a new tab.");
    }
  };

  const confirmAndDeleteDocument = (document) => {
    if (!requirePermission("delete_records", "Admin access is required to delete documents.")) return;
    const runDelete = () => {
      actions.deleteDocument(document.id);
      setNotice("File removed.");
    };
    if (!appConfirmDestructiveActions) {
      runDelete();
      return;
    }
    openConfirmDialog({
      title: "Delete file?",
      message: `Delete file "${document.name}"? This cannot be undone.`,
      confirmLabel: "Delete file",
      onConfirm: runDelete,
    });
  };

  const saveDocumentTags = (document, rawTags, options = {}) => {
    const silent = Boolean(options?.silent);
    const nextTags = parseDocumentTags(rawTags);
    const priorTags = Array.isArray(document.tags) ? document.tags : [];
    const unchanged =
      priorTags.length === nextTags.length &&
      priorTags.every((tag, index) => String(tag || "").toLowerCase() === String(nextTags[index] || "").toLowerCase());
    if (unchanged) return;
    actions.updateDocument(document.id, { tags: nextTags });
    if (!silent) setNotice("Document tags updated.");
  };

  const applySuggestedDocumentTags = (document, options = {}) => {
    const existingTags = Array.isArray(document.tags) ? document.tags : [];
    const suggestedTags = getDocumentSuggestedTags(document);
    if (suggestedTags.length === 0) {
      if (!options?.silent) setNotice("No suggested tags to apply.");
      return;
    }
    saveDocumentTags(document, [...existingTags, ...suggestedTags.map((suggestion) => suggestion.tag)].join(", "), options);
  };

  const saveDocumentExtractedText = (document, rawText) => {
    const nextExtractedText = normalizeExtractedDocumentText(rawText);
    const priorExtractedText = String(document.extractedText || "").trim();
    if (nextExtractedText === priorExtractedText) return;
    actions.updateDocument(document.id, {
      extractedText: nextExtractedText,
      expenseReviewDismissedAt: nextExtractedText ? undefined : document.expenseReviewDismissedAt,
      workOrderReviewDismissedAt: nextExtractedText ? undefined : document.workOrderReviewDismissedAt,
    });
    setNotice("Extracted text updated.");
  };

  const getSafeDocumentTagSuggestions = (document) =>
    getDocumentSuggestedTags(document).filter((suggestion) => {
      const sources = Array.isArray(suggestion.sources) ? suggestion.sources : [];
      return sources.includes("context") || sources.includes("ocr_match") || sources.length > 1;
    });

  const getSafeDocumentLinkSuggestion = (document) =>
    getDocumentLinkSuggestions(document).find((suggestion) => {
      if (suggestion.confidence !== "high") return false;
      if (suggestion.kind === "lease") return !document.leaseId;
      if (suggestion.kind === "transaction") return !document.transactionId;
      return !getDocumentLinkedWorkOrder(document);
    }) || null;

  const getDocumentQualityWarningCount = (document) => buildDocumentQualityWarnings(document, {
    extractedFields: getDocumentExtractedFields?.(document),
    linkedTransaction: document?.transactionId ? transactionById[document.transactionId] : null,
  }).length;

  const documentLooksLikeEstimate = (document) => {
    const text = `${document?.name || ""} ${document?.type || ""} ${document?.extractedText || ""}`.toLowerCase();
    return /\bestimate\b|\bproposal\b|\bquote\b|\bbid\b/.test(text);
  };

  const documentLooksLikeInvoice = (document) => {
    const text = `${document?.name || ""} ${document?.type || ""} ${document?.extractedText || ""}`.toLowerCase();
    return /\binvoice\b|\breceipt\b|\bbill\b|\bamount due\b|\btotal due\b|\bpaid\b/.test(text);
  };

  const canAutoCreateExpenseFromSuggestion = (document, suggestion) =>
    Boolean(
      suggestion &&
      suggestion.confidence === "high" &&
      !document?.transactionId &&
      suggestion.propertyId &&
      suggestion.amount != null &&
      suggestion.date &&
      documentLooksLikeInvoice(document) &&
      !documentLooksLikeEstimate(document),
    );

  const canAutoCreateWorkOrderFromSuggestion = (document, suggestion) =>
    Boolean(
      suggestion &&
      suggestion.confidence === "high" &&
      !getDocumentLinkedWorkOrder(document) &&
      suggestion.propertyId &&
      suggestion.title &&
      (documentLooksLikeEstimate(document) || !canAutoCreateExpenseFromSuggestion(document, getDocumentExpenseSuggestion(document))),
    );

  const createWorkOrderFromDocumentSuggestion = (document, suggestion, options = {}) => {
    if (!requirePermission("create_edit_records", "This access profile cannot create work orders from OCR suggestions.")) return "";
    const silent = Boolean(options?.silent);
    if (!document || !suggestion?.propertyId || !String(suggestion.title || "").trim()) {
      if (!silent) setNotice("No work order draft suggestion is available for this document yet.");
      return "";
    }

    const workOrderId = `wo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    actions.addOrUpdateWorkOrder({
      id: workOrderId,
      propertyId: suggestion.propertyId,
      unit: suggestion.unit || document.unit || "Shared",
      title: String(suggestion.title || "").trim(),
      description: String(suggestion.description || suggestion.title || "").trim(),
      priority: suggestion.priority || "Medium",
      status: "Open",
      reportedOn: suggestion.reportedOn || todayIso,
      dueDate: "",
      vendorId: suggestion.vendorId || "",
      estimatedCost: Number(suggestion.estimatedCost || 0),
      actualCost: undefined,
      transactionId: "",
      createdAt: new Date().toISOString(),
      completedAt: "",
      notes: `Created from OCR document ${document.name}.`,
    });
    actions.updateDocument(document.id, {
      workOrderId,
      workOrderReviewDismissedAt: undefined,
    });
    if (!silent) setNotice(`Created work order from ${document.name}.`);
    return workOrderId;
  };

  const createExpenseFromDocumentSuggestion = (document, suggestion, options = {}) => {
    if (!requirePermission("create_edit_records", "This access profile cannot create expenses from OCR suggestions.")) return "";
    const silent = Boolean(options?.silent);
    if (!document || !suggestion?.propertyId || suggestion.amount == null || !suggestion.date) {
      if (!silent) setNotice("No safe expense draft is available for this document yet.");
      return "";
    }

    const nextPropertyId = suggestion.propertyId || document.propertyId;
    const nextUnit = suggestion.unit || document.unit || "Shared";
    const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
    const preview = actions.computeTransactionPreview({
      amount: suggestion.amount,
      type: "Expense",
      capitalImprovement: false,
      propertyId: nextPropertyId,
      unit: nextUnit,
      date: suggestion.date,
      ownerUsePct: 0,
      servicePeriodStart: suggestion.servicePeriodStart || "",
      servicePeriodEnd: suggestion.servicePeriodEnd || "",
    });
    const txnId = `t-ocr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    actions.addOrUpdateTransaction({
      id: txnId,
      date: suggestion.date,
      propertyId: nextPropertyId,
      unit: nextUnit,
      type: "Expense",
      category: suggestion.category || "Other expenses",
      description: suggestion.description || document.type || document.name,
      amount: suggestion.amount,
      ownerUsePct: 0,
      rentalUsePct: preview.rentalUsePct,
      deductibleAmount: preview.deductibleAmount,
      paidFrom: "Operating account",
      paymentMethod: "ACH",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: suggestion.vendor || "",
      receiptName: document.name || "",
      notes: `Auto-created from OCR document ${document.name}.`,
      taxChecked: false,
      reconciled: false,
      invoiceRef: suggestion.invoiceRef || "",
      invoiceAmount: suggestion.amount,
      servicePeriodStart: suggestion.servicePeriodStart || undefined,
      servicePeriodEnd: suggestion.servicePeriodEnd || undefined,
      workOrderId: linkedWorkOrder?.id || "",
      status: "active",
    });
    actions.updateDocument(document.id, {
      transactionId: txnId,
      expenseReviewDismissedAt: undefined,
    });
    if (linkedWorkOrder?.id) {
      actions.linkWorkOrderTransaction(linkedWorkOrder.id, txnId);
    }
    if (!silent) setNotice(`Created expense transaction from ${document.name}.`);
    return txnId;
  };

  const applySafeSuggestionsToDocument = (document, options = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot apply OCR suggestions.")) return { tags: 0, links: 0, expenses: 0, workOrders: 0, flagged: 0 };
    const silent = Boolean(options?.silent);
    if (getDocumentQualityWarningCount(document) > 0) {
      if (!silent) setNotice("Review flagged document warnings before applying recommendations.");
      return { tags: 0, links: 0, expenses: 0, workOrders: 0, flagged: 1 };
    }
    const safeTags = getSafeDocumentTagSuggestions(document);
    const safeLink = getSafeDocumentLinkSuggestion(document);
    const expenseSuggestion = getDocumentExpenseSuggestion(document);
    const workOrderSuggestion = getDocumentWorkOrderSuggestion(document);
    const result = { tags: 0, links: 0, expenses: 0, workOrders: 0, flagged: 0 };

    if (safeTags.length > 0) {
      const existingTags = Array.isArray(document.tags) ? document.tags : [];
      saveDocumentTags(document, [...existingTags, ...safeTags.map((suggestion) => suggestion.tag)].join(", "), { silent: true });
      result.tags = safeTags.length;
    }

    if (safeLink) {
      applyDocumentLinkSuggestion(document, safeLink, { silent: true });
      result.links = 1;
    } else if (canAutoCreateExpenseFromSuggestion(document, expenseSuggestion)) {
      if (createExpenseFromDocumentSuggestion(document, expenseSuggestion, { silent: true })) {
        result.expenses = 1;
      }
    } else if (canAutoCreateWorkOrderFromSuggestion(document, workOrderSuggestion)) {
      if (createWorkOrderFromDocumentSuggestion(document, workOrderSuggestion, { silent: true })) {
        result.workOrders = 1;
      }
    }

    if (result.tags + result.links + result.expenses + result.workOrders > 0) {
      addAuditEntry({
        action: "safe-apply",
        entityType: "document",
        entityId: document.id,
        propertyId: document.propertyId,
        unit: document.unit,
        summary: `Applied OCR suggestions for ${document.name}.`,
        details: `${result.tags} tags | ${result.links} links | ${result.expenses} expenses | ${result.workOrders} work orders.`,
        category: "document",
      });
    }
    if (!silent && result.tags + result.links + result.expenses + result.workOrders === 0) {
      setNotice("No safe OCR suggestions are ready to apply for this document.");
    }
    return result;
  };

  const acceptVisibleSafeSuggestions = () => {
    if (visibleDocuments.length === 0) {
      setNotice("No visible documents are available for safe OCR actions.");
      return;
    }

    const totals = visibleDocuments.reduce(
      (acc, document) => {
        const result = applySafeSuggestionsToDocument(document, { silent: true });
        acc.tags += result.tags;
        acc.links += result.links;
        acc.expenses += result.expenses;
        acc.workOrders += result.workOrders;
        acc.flagged += result.flagged || 0;
        return acc;
      },
      { tags: 0, links: 0, expenses: 0, workOrders: 0, flagged: 0 },
    );

    const summary = [];
    if (totals.tags > 0) summary.push(`${totals.tags} tag suggestions`);
    if (totals.links > 0) summary.push(`${totals.links} links`);
    if (totals.expenses > 0) summary.push(`${totals.expenses} expense transactions`);
    if (totals.workOrders > 0) summary.push(`${totals.workOrders} work orders`);
    if (summary.length > 0) {
      addAuditEntry({
        action: "safe-apply",
        entityType: "document-batch",
        entityId: `${visibleDocuments.length}-visible-documents`,
        summary: `Applied safe OCR suggestions: ${summary.join(", ")}.`,
        details: `Visible scope ${documentStatusFilter} | ${documentSearch || "no search"}.`,
        category: "document",
      });
    }
    const flaggedNote = totals.flagged > 0 ? ` ${totals.flagged} flagged recommendation${totals.flagged === 1 ? "" : "s"} still need review.` : "";
    setNotice(summary.length > 0 ? `Applied safe OCR suggestions: ${summary.join(", ")}.${flaggedNote}` : `No safe OCR suggestions were ready to apply.${flaggedNote}`);
  };

  const dismissDocumentExpenseReview = (document, options = {}) => {
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

  const reopenDocumentExpenseReview = (document, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    if (documentStatusFilter === "expense_queue") {
      setExpenseQueueFocusDocumentId(document.id);
    }
    actions.updateDocument(document.id, { expenseReviewDismissedAt: undefined });
    if (!silent) setNotice("Expense suggestion reopened for review.");
  };

  const dismissDocumentWorkOrderReview = (document, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!document) return;
    if (getDocumentLinkedWorkOrder(document)) {
      if (!silent) setNotice("This document is already linked to a work order.");
      return;
    }
    actions.updateDocument(document.id, { workOrderReviewDismissedAt: new Date().toISOString() });
    if (!silent) setNotice(`Work order suggestion dismissed for ${document.name}.`);
  };

  const reopenDocumentWorkOrderReview = (document, options = {}) => {
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
      visibleExpenseReviewRecords.forEach((record) => {
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
    const focusedRecord = visibleExpenseReviewRecords.find((record) => record.document.id === expenseQueueFocusDocumentId) || null;
    const nextRecord = focusedRecord || visibleExpenseReviewRecords[0] || documentExpenseReviewRecords.find((record) => !record.dismissed) || null;
    if (!nextRecord) {
      setNotice("No OCR expense suggestions are waiting for review.");
      return;
    }
    selectExpenseQueueFilter();
    openExpenseDraftFromDocument(nextRecord.document, nextRecord.suggestion);
  };

  const openWorkOrderDraftFromDocument = (doc, suggestion) => {
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
    const nextRecord = visibleWorkOrderReviewRecords[0] || documentWorkOrderReviewRecords.find((record) => !record.dismissed) || null;
    if (!nextRecord) {
      setNotice("No OCR work order suggestions are waiting for review.");
      return;
    }
    selectWorkOrderQueueFilter();
    openWorkOrderDraftFromDocument(nextRecord.document, nextRecord.suggestion);
  };

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
    createWorkOrderFromDocumentSuggestion,
    dismissDocumentExpenseReview,
    dismissDocumentWorkOrderReview,
    dismissVisibleExpenseQueue,
    documentLooksLikeEstimate,
    documentLooksLikeInvoice,
    getSafeDocumentLinkSuggestion,
    getSafeDocumentTagSuggestions,
    markVisibleDocumentsPendingOcr,
    onDocumentImportInputChange,
    openDocumentExternally,
    openDocumentImportPicker,
    openDocumentLinkedRecord,
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
    saveDocumentTags,
    saveImportedDocument,
  };
}
