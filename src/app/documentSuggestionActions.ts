import type { DocumentWorkspaceControllerDependencies, SilentOptions } from "./documentWorkspaceTypes.ts";
import type { DocumentItem } from "../models.ts";
import { buildDocumentQualityWarnings } from "../features/documents/documentPresentation.js";
import { canAutoCreateExpenseSuggestion, canAutoCreateWorkOrderSuggestion, findMatchingUtilitySectionTransaction, canCreateUtilitySectionTransaction } from "./documentAutomationSafety.ts";

export function createDocumentSuggestionActions({
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
}: Pick<DocumentWorkspaceControllerDependencies, "actions" | "addAuditEntry" | "applyDocumentLinkSuggestion" | "documentSearch" | "documentStatusFilter" | "getDocumentExpenseSuggestion" | "getDocumentExtractedFields" | "getDocumentLinkSuggestions" | "getDocumentLinkedWorkOrder" | "getDocumentSuggestedTags" | "getDocumentWorkOrderSuggestion" | "requirePermission" | "saveDocumentTags" | "setNotice" | "todayIso" | "transactionById" | "transactions" | "visibleDocuments">) {
  const getSafeDocumentTagSuggestions = (document: DocumentItem) =>
    getDocumentSuggestedTags(document).filter((suggestion: any) => {
      const sources = Array.isArray(suggestion.sources) ? suggestion.sources : [];
      return sources.includes("context") || sources.includes("ocr_match") || sources.length > 1;
    });

  const getSafeDocumentLinkSuggestion = (document: DocumentItem) =>
    getDocumentLinkSuggestions(document).find((suggestion: any) => {
      if (suggestion.confidence !== "high") return false;
      if (suggestion.kind === "lease") return !document.leaseId;
      if (suggestion.kind === "transaction") return !document.transactionId;
      return !getDocumentLinkedWorkOrder(document);
    }) || null;

  const getDocumentQualityWarningCount = (document: DocumentItem) => buildDocumentQualityWarnings(document, {
    extractedFields: getDocumentExtractedFields?.(document),
    linkedTransaction: document?.transactionId ? transactionById[document.transactionId] : null,
  } as any).length;

  const canAutoCreateExpenseFromSuggestion = (document: DocumentItem, suggestion: any) =>
    canAutoCreateExpenseSuggestion(document, suggestion);

  const canAutoCreateWorkOrderFromSuggestion = (document: DocumentItem, suggestion: any) =>
    canAutoCreateWorkOrderSuggestion(document, suggestion, {
      hasLinkedWorkOrder: Boolean(getDocumentLinkedWorkOrder(document)),
      expenseSuggestion: getDocumentExpenseSuggestion(document),
    });

  const createWorkOrderFromDocumentSuggestion = (document: DocumentItem, suggestion: any, options: SilentOptions = {}) => {
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

  const createExpenseFromDocumentSuggestion = (document: DocumentItem, suggestion: any, options: SilentOptions = {}) => {
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
        propertyId: nextPropertyId,
        unit: nextUnit,
        reviewedWarningKeys: undefined,
        reviewedWarningsAt: undefined,
        expenseReviewDismissedAt: undefined,
      });
    if (linkedWorkOrder?.id) {
      actions.linkWorkOrderTransaction(linkedWorkOrder.id, txnId);
    }
    if (!silent) setNotice(`Created expense transaction from ${document.name}.`);
    return txnId;
  };

  const findMatchingUtilitySectionTransactionForWorkspace = (section: any) =>
    findMatchingUtilitySectionTransaction(section, transactions, transactionById);

  const createExpenseTransactionsFromUtilitySections = (document: DocumentItem, sections: any[], options: SilentOptions = {}) => {
    if (!requirePermission("create_edit_records", "This access profile cannot create utility transactions from OCR sections.")) return { created: 0, skipped: 0 };
    const silent = Boolean(options?.silent);
    const readySections = (Array.isArray(sections) ? sections : []).filter(canCreateUtilitySectionTransaction);
    if (!document || readySections.length === 0) {
      if (!silent) setNotice("No matched utility sections are ready to create.");
      return { created: 0, skipped: 0 };
    }

    const createdIds: string[] = [];
    const matchedExistingIds: string[] = [];
    let skipped = 0;
    readySections.forEach((section, index) => {
      const duplicate = findMatchingUtilitySectionTransactionForWorkspace(section);
      if (duplicate) {
        if (duplicate.id) matchedExistingIds.push(duplicate.id);
        skipped += 1;
        return;
      }
      const nextPropertyId = section.propertyId || document.propertyId;
      const nextUnit = section.unit || "Shared";
      const preview = actions.computeTransactionPreview({
        amount: section.amount,
        type: "Expense",
        capitalImprovement: false,
        propertyId: nextPropertyId,
        unit: nextUnit,
        date: section.date,
        ownerUsePct: 0,
        servicePeriodStart: section.servicePeriodStart || "",
        servicePeriodEnd: section.servicePeriodEnd || "",
      });
      const txnId = `t-ocr-section-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
      actions.addOrUpdateTransaction({
        id: txnId,
        date: section.date,
        propertyId: nextPropertyId,
        unit: nextUnit,
        type: "Expense",
        category: section.category || "Utilities",
        description: section.description || `${section.vendor || "Utility"} bill`,
        amount: Number(section.amount),
        ownerUsePct: 0,
        rentalUsePct: preview.rentalUsePct,
        deductibleAmount: preview.deductibleAmount,
        paidFrom: "Operating account",
        paymentMethod: "ACH",
        reimbursable: false,
        reimbursed: false,
        capitalImprovement: false,
        vendor: section.vendor || "",
        receiptName: document.name || "",
        notes: `Created from OCR utility section in ${document.name}.`,
        taxChecked: false,
        reconciled: false,
        invoiceRef: section.invoiceRef || section.accountRef || "",
        invoiceAmount: Number(section.amount),
        servicePeriodStart: section.servicePeriodStart || undefined,
        servicePeriodEnd: section.servicePeriodEnd || undefined,
        status: "active",
      });
      createdIds.push(txnId);
    });

    if (createdIds.length + matchedExistingIds.length > 0) {
      const relatedTransactionIds = [
        ...new Set([...(document.relatedTransactionIds || []), ...createdIds, ...matchedExistingIds]),
      ];
      const propertyIds = Array.from(new Set(readySections.map((section) => section.propertyId).filter(Boolean)));
      const unitsCreated = Array.from(new Set(readySections.map((section) => section.unit || "Shared").filter(Boolean)));
      actions.updateDocument(document.id, {
        relatedTransactionIds,
        propertyId: propertyIds.length === 1 ? propertyIds[0] : document.propertyId,
        unit: unitsCreated.length === 1 ? unitsCreated[0] : "Shared",
        reviewedWarningKeys: undefined,
        reviewedWarningsAt: undefined,
        expenseReviewDismissedAt: undefined,
      });
      if (createdIds.length > 0) {
        addAuditEntry({
          action: "utility-section-batch",
          entityType: "document",
          entityId: document.id,
          propertyId: propertyIds.length === 1 ? propertyIds[0] : document.propertyId,
          unit: unitsCreated.length === 1 ? unitsCreated[0] : "Shared",
          summary: `Created ${createdIds.length} utility transaction${createdIds.length === 1 ? "" : "s"} from ${document.name}.`,
          details: `${createdIds.length} created | ${skipped} linked to existing matches.`,
          category: "document",
        });
      }
    }

    if (!silent) {
      if (createdIds.length > 0) {
        setNotice(`Created ${createdIds.length} related utility transaction${createdIds.length === 1 ? "" : "s"} from ${document.name}.${skipped ? ` Linked ${skipped} existing match${skipped === 1 ? "" : "es"}.` : ""}`);
      } else {
        setNotice(`No new utility transactions created.${skipped ? ` Linked ${skipped} existing matching transaction${skipped === 1 ? "" : "s"}.` : ""}`);
      }
    }
    return { created: createdIds.length, skipped };
  };

  const applySafeSuggestionsToDocument = (document: DocumentItem, options: SilentOptions = {}) => {
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
      saveDocumentTags(document, [...existingTags, ...safeTags.map((suggestion: any) => suggestion.tag)].join(", "), { silent: true });
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

    const summary: string[] = [];
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

  return { getSafeDocumentTagSuggestions, getSafeDocumentLinkSuggestion, getDocumentQualityWarningCount, canAutoCreateExpenseFromSuggestion, canAutoCreateWorkOrderFromSuggestion, createWorkOrderFromDocumentSuggestion, createExpenseFromDocumentSuggestion, findMatchingUtilitySectionTransactionForWorkspace, createExpenseTransactionsFromUtilitySections, applySafeSuggestionsToDocument, acceptVisibleSafeSuggestions };
}
