import type { DocumentWorkspaceControllerDependencies, SilentOptions, OcrFieldCorrections } from "./documentWorkspaceTypes.ts";
import type { DocumentItem } from "../models.ts";
import { buildDocumentTagsUpdate, buildDocumentExtractedTextUpdate } from "./documentRecordUpdates.ts";

export function createDocumentRecordActions({
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
  vendors = [],
}: Pick<DocumentWorkspaceControllerDependencies, "actions" | "addAuditEntry" | "appConfirmDestructiveActions" | "desktopDocumentOpenApi" | "getDocumentExpenseSuggestion" | "getDocumentExtractedFields" | "getDocumentSuggestedTags" | "loadDocumentDataUrl" | "normalizeExtractedDocumentText" | "openConfirmDialog" | "prefetchDialog" | "requirePermission" | "setNotice" | "setSelectedDocument" | "transactionById" | "vendors">) {
  const openDocumentPreview = async (document: DocumentItem) => {
    prefetchDialog("documentPreview");
    const documentWithFile = await loadDocumentDataUrl(document);
    if (!documentWithFile?.dataUrl) {
      setNotice("This document has no previewable file attached.");
      return;
    }
    setSelectedDocument(documentWithFile);
  };

  const loadDocumentForReview = (document: DocumentItem) => loadDocumentDataUrl(document);

  const openDocumentExternally = async (document: DocumentItem) => {
    const documentWithFile = await loadDocumentDataUrl(document);
    if (!documentWithFile?.dataUrl) {
      setNotice("This document has no previewable file attached.");
      return;
    }

    if (desktopDocumentOpenApi?.openExternal) {
      const result = await desktopDocumentOpenApi.openExternal({
        name: documentWithFile.name,
        mimeType: documentWithFile.mimeType,
        dataUrl: documentWithFile.dataUrl,
      });
      if (result?.ok === false) {
        setNotice(result?.message || "Could not open this file externally.");
      }
      return;
    }

    const opened = window.open(documentWithFile.dataUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      setNotice("Could not open this file in a new tab.");
    }
  };

  const confirmAndDeleteDocument = (document: DocumentItem) => {
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

  const saveDocumentTags = (document: DocumentItem, rawTags: unknown, options: SilentOptions = {}) => {
    const silent = Boolean(options?.silent);
    const update = buildDocumentTagsUpdate(document, rawTags);
    if (!update) return;
    actions.updateDocument(document.id, update);
    if (!silent) setNotice("Document tags updated.");
  };

  const applySuggestedDocumentTags = (document: DocumentItem, options: SilentOptions = {}) => {
    const existingTags = Array.isArray(document.tags) ? document.tags : [];
    const suggestedTags = getDocumentSuggestedTags(document);
    if (suggestedTags.length === 0) {
      if (!options?.silent) setNotice("No suggested tags to apply.");
      return;
    }
    saveDocumentTags(document, [...existingTags, ...suggestedTags.map((suggestion: any) => suggestion.tag)].join(", "), options);
  };

  const saveDocumentExtractedText = (document: DocumentItem, rawText: unknown) => {
    const update = buildDocumentExtractedTextUpdate(document, rawText, normalizeExtractedDocumentText);
    if (!update) return;
    actions.updateDocument(document.id, update);
    setNotice("Extracted text updated.");
  };

  const saveDocumentOcrFieldCorrections = (document: DocumentItem, corrections: OcrFieldCorrections = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot correct OCR fields.")) return;
    if (!document) return;

    const currentFields = getDocumentExtractedFields?.(document) || {};
    const vendorName = String(corrections.vendorName || "").trim();
    const totalAmountText = String(corrections.totalAmount || "").trim();
    const totalAmount = totalAmountText ? Number(totalAmountText) : undefined;
    const servicePeriodStart = String(corrections.servicePeriodStart || "").trim();
    const servicePeriodEnd = String(corrections.servicePeriodEnd || "").trim();
    const unit = String(corrections.unit || document.unit || "Shared").trim() || "Shared";

    if (totalAmountText && (!Number.isFinite(totalAmount) || totalAmount! < 0)) {
      setNotice("Enter a valid non-negative total amount.");
      return;
    }
    if (servicePeriodStart && servicePeriodEnd && servicePeriodEnd < servicePeriodStart) {
      setNotice("Service period end must be on or after its start date.");
      return;
    }

    const currentOverrides = document.ocrFieldOverrides || {};
    const nextOverrides = {
      ...currentOverrides,
      vendorName: vendorName || undefined,
      totalAmount: totalAmountText ? Math.round(totalAmount! * 100) / 100 : undefined,
      servicePeriodStart: servicePeriodStart || undefined,
      servicePeriodEnd: servicePeriodEnd || undefined,
    };

    actions.updateDocument(document.id, {
      ocrFieldOverrides: nextOverrides,
      unit,
      unitScopeOverride: true,
      reviewedWarningKeys: undefined,
      reviewedWarningsAt: undefined,
      expenseReviewDismissedAt: undefined,
      workOrderReviewDismissedAt: undefined,
    });

    const originalVendorName = String(currentFields.vendorName || "").trim();
    if (vendorName && vendorName.toLowerCase() !== originalVendorName.toLowerCase()) {
      const normalizedVendorName = vendorName.toLowerCase();
      const matchedVendor = vendors.find((vendor) => {
        const names = [vendor.name, ...(Array.isArray(vendor.aliases) ? vendor.aliases : [])]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean);
        return names.includes(normalizedVendorName);
      });
      const alias = originalVendorName && originalVendorName.toLowerCase() !== normalizedVendorName ? originalVendorName : "";
      if (matchedVendor) {
        actions.addOrUpdateVendor({
          ...matchedVendor,
          aliases: Array.from(new Set([...(matchedVendor.aliases || []), alias].filter(Boolean))),
        });
      } else {
        actions.addOrUpdateVendor({
          id: `vendor-${Date.now()}`,
          name: vendorName,
          aliases: alias ? [alias] : [],
          phone: "",
          email: "",
          defaultCategory: getDocumentExpenseSuggestion?.(document)?.category || "Other expenses",
          notes: "Created from a confirmed OCR vendor correction.",
          active: true,
        });
      }
    }

    setNotice(`OCR corrections saved for ${document.name}.`);
  };

  const markDocumentWarningsReviewed = (document: DocumentItem, warningKeys: string[] = []) => {
    if (!requirePermission("review_documents", "This access profile cannot resolve document warnings.")) return;
    if (!document) return;
    const keys = Array.from(new Set(
      (Array.isArray(warningKeys) ? warningKeys : [])
        .map((key) => String(key || "").trim())
        .filter(Boolean),
    ));
    if (keys.length === 0) {
      setNotice("No document warnings are available to mark reviewed.");
      return;
    }
    actions.updateDocument(document.id, {
      reviewedWarningKeys: keys,
      reviewedWarningsAt: new Date().toISOString(),
    });
    setNotice(`Marked ${keys.length} document warning${keys.length === 1 ? "" : "s"} reviewed for ${document.name}.`);
  };

  const updateLinkedTransactionFromDocumentOcr = (document: DocumentItem, warningKeys: string[] = []) => {
    if (!requirePermission("create_edit_records", "This access profile cannot update transactions from OCR.")) return false;
    const linkedTransaction = document?.transactionId ? transactionById[document.transactionId] : null;
    if (!document || !linkedTransaction) {
      setNotice("Link this document to a transaction before updating the ledger from OCR.");
      return false;
    }
    const extractedFields = getDocumentExtractedFields?.(document);
    const expenseSuggestion = getDocumentExpenseSuggestion?.(document);
    if (!extractedFields && !expenseSuggestion) {
      setNotice("No OCR fields are available to update the linked transaction.");
      return false;
    }

    const nextAmount = Number(extractedFields?.totalAmount ?? expenseSuggestion?.amount ?? linkedTransaction.amount);
    const nextDate = extractedFields?.invoiceDate || extractedFields?.serviceDate || expenseSuggestion?.date || linkedTransaction.date;
    const nextPropertyId = extractedFields?.propertyId || expenseSuggestion?.propertyId || linkedTransaction.propertyId;
    const nextUnit = extractedFields?.unit || expenseSuggestion?.unit || linkedTransaction.unit;
    const preview = actions.computeTransactionPreview({
      amount: nextAmount,
      type: linkedTransaction.type,
      capitalImprovement: Boolean(linkedTransaction.capitalImprovement),
      propertyId: nextPropertyId,
      unit: nextUnit,
      date: nextDate,
      ownerUsePct: Number(linkedTransaction.ownerUsePct || 0),
      ownerUsePctOverride: Boolean(linkedTransaction.ownerUsePctOverride),
      servicePeriodStart: extractedFields?.servicePeriodStart || expenseSuggestion?.servicePeriodStart || linkedTransaction.servicePeriodStart || "",
      servicePeriodEnd: extractedFields?.servicePeriodEnd || expenseSuggestion?.servicePeriodEnd || linkedTransaction.servicePeriodEnd || "",
    });

    const nextTransaction = {
      ...linkedTransaction,
      date: nextDate,
      propertyId: nextPropertyId,
      unit: nextUnit,
      category: expenseSuggestion?.category || linkedTransaction.category,
      description: expenseSuggestion?.description || linkedTransaction.description,
      amount: nextAmount,
      rentalUsePct: preview.rentalUsePct,
      deductibleAmount: preview.deductibleAmount,
      vendor: extractedFields?.vendorName || expenseSuggestion?.vendor || linkedTransaction.vendor,
      invoiceRef: extractedFields?.invoiceRef || expenseSuggestion?.invoiceRef || linkedTransaction.invoiceRef || "",
      invoiceAmount: nextAmount,
      servicePeriodStart: extractedFields?.servicePeriodStart || expenseSuggestion?.servicePeriodStart || linkedTransaction.servicePeriodStart,
      servicePeriodEnd: extractedFields?.servicePeriodEnd || expenseSuggestion?.servicePeriodEnd || linkedTransaction.servicePeriodEnd,
      taxChecked: false,
    };
    actions.addOrUpdateTransaction(nextTransaction);
    actions.updateDocument(document.id, {
      propertyId: nextPropertyId,
      unit: nextUnit,
      reviewedWarningKeys: undefined,
      reviewedWarningsAt: undefined,
      expenseReviewDismissedAt: undefined,
    });
    addAuditEntry({
      action: "ocr-update-transaction",
      entityType: "transaction",
      entityId: linkedTransaction.id,
      propertyId: nextPropertyId,
      unit: nextUnit,
      summary: `Updated transaction from OCR document ${document.name}.`,
      details: `Fields reviewed from ${document.name}.`,
      category: "document",
    });
    if (Array.isArray(warningKeys) && warningKeys.length > 0) {
      markDocumentWarningsReviewed(document, warningKeys.filter((key) => key !== "amount_mismatch"));
    }
    setNotice(`Updated linked transaction from OCR for ${document.name}.`);
    return true;
  };

  return { openDocumentPreview, loadDocumentForReview, openDocumentExternally, confirmAndDeleteDocument, saveDocumentTags, applySuggestedDocumentTags, saveDocumentExtractedText, saveDocumentOcrFieldCorrections, markDocumentWarningsReviewed, updateLinkedTransactionFromDocumentOcr };
}
