import { useMemo, useState } from "react";

export function useTransactionWorkflowController({
  actions,
  addAuditEntry,
  attachDocumentToTransaction,
  createBlankForm,
  currency,
  documents,
  formatPercentInput,
  prefetchDialog,
  readOnlyView,
  requirePermission,
  selectedTxnSourceView,
  setEditingTxnId,
  setForm,
  setNotice,
  setPendingDocumentExpenseSource,
  setPendingTxnAttachment,
  setSearch,
  setView,
  setRentAmountTouched,
  startView,
  transactionById,
  txnAttachmentInputRef,
  txnInlineAttachmentInputRef,
  workOrders,
}) {
  const [editReturnView, setEditReturnView] = useState("ledger");
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [selectedTxnReviewFocusKey, setSelectedTxnReviewFocusKey] = useState("");
  const [txnToDelete, setTxnToDelete] = useState(null);

  const selectedTransactionDocuments = useMemo(() => {
    if (!selectedTxn) return [];
    return documents.filter(
      (doc) =>
        doc.transactionId === selectedTxn.id ||
        (Array.isArray(doc.relatedTransactionIds) && doc.relatedTransactionIds.includes(selectedTxn.id)),
    );
  }, [documents, selectedTxn]);

  const selectedTxnLinkedWorkOrder = useMemo(() => {
    if (!selectedTxn) return null;
    const linkedId = String(selectedTxn.workOrderId || "").trim();
    if (linkedId) {
      const directMatch = workOrders.find((workOrder) => workOrder.id === linkedId);
      if (directMatch) return directMatch;
    }
    return workOrders.find((workOrder) => workOrder.transactionId === selectedTxn.id) || null;
  }, [selectedTxn, workOrders]);

  const selectedTxnReconcileWarning = Boolean(
    selectedTxn &&
      !selectedTxn.reconciled &&
      selectedTxnLinkedWorkOrder &&
      selectedTxnLinkedWorkOrder.status !== "Completed",
  );
  const selectedTxnReconcileWarningText = "Mark it Completed before reconciling this transaction.";
  const selectedTxnToggleReconcileDisabled = Boolean(selectedTxnReconcileWarning);

  const startEdit = (txn, returnView = "ledger") => {
    setEditingTxnId(txn.id);
    setPendingDocumentExpenseSource(null);
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setForm({
      ...createBlankForm(txn.propertyId, txn.unit),
      ...txn,
      ownerUsePct: formatPercentInput((txn.ownerUsePct || 0) * 100),
      ownerUsePctOverride: Boolean(txn.ownerUsePctOverride),
      amount: String(txn.amount),
      invoiceAmount: String(txn.invoiceAmount ?? txn.amount ?? ""),
      mileageMiles: String(txn.mileageMiles ?? ""),
      mileageRate: String(txn.mileageRate ?? ""),
      invoiceRef: txn.invoiceRef || "",
      servicePeriodStart: txn.servicePeriodStart || "",
      servicePeriodEnd: txn.servicePeriodEnd || "",
      rentPeriod: txn.rentPeriod || "",
      rentLeaseId: txn.rentLeaseId || "",
      deMinimisTreatment: txn.deMinimisTreatment || "auto",
      capitalImprovement: txn.capitalImprovement ? "Yes" : "No",
      taxChecked: txn.taxChecked ? "Yes" : "No",
      recurringMonthly: txn.recurringTemplateId ? "Yes" : "No",
    });
    setRentAmountTouched(true);
    setEditReturnView(returnView);
    setView("quickAdd");
    setSelectedTxn(null);
    globalThis.requestAnimationFrame?.(() => {
      globalThis.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      globalThis.document?.querySelector("main")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
  };

  const openTransaction = (txn, sourceView = readOnlyView, openInLedger = false, reviewFocusKey = "") => {
    prefetchDialog("transactionDetails");
    if (openInLedger) {
      setView("ledger");
      setSearch(txn.description);
      setEditReturnView(sourceView);
    } else {
      setEditReturnView(sourceView);
    }
    setSelectedTxnReviewFocusKey(reviewFocusKey || "");
    setSelectedTxn(txn);
  };

  const onTransactionInlineAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    await attachDocumentToTransaction(selectedTxn, file);
    event.target.value = "";
  };

  const openTransactionInlineAttachmentPicker = () => {
    txnInlineAttachmentInputRef.current?.click();
  };

  const handleEditSelectedTxn = () => {
    if (!selectedTxn) return;
    startEdit(selectedTxn, editReturnView || selectedTxnSourceView || startView);
  };

  const handleDuplicateSelectedTxn = () => {
    if (!selectedTxn) return;
    actions.duplicateTransaction(selectedTxn);
  };

  const handleToggleSelectedTxnReconciled = () => {
    if (!selectedTxn) return;
    const nextReconciled = !Boolean(selectedTxn.reconciled);
    if (nextReconciled && selectedTxnLinkedWorkOrder && selectedTxnLinkedWorkOrder.status !== "Completed") {
      setNotice(`Complete work order "${selectedTxnLinkedWorkOrder.title}" before marking this transaction accepted.`);
      return;
    }
    if (!requirePermission("reconcile_records", "This access profile cannot mark transactions as matched or accepted.")) {
      return;
    }
    actions.setTransactionReconciled(selectedTxn.id, nextReconciled);
    addAuditEntry({
      action: nextReconciled ? "reconcile" : "unreconcile",
      entityType: "transaction",
      entityId: selectedTxn.id,
      propertyId: selectedTxn.propertyId,
      unit: selectedTxn.unit,
      summary: nextReconciled ? "Marked transaction matched or accepted." : "Marked transaction not accepted.",
      details: `${selectedTxn.description} | ${selectedTxn.date} | ${currency(selectedTxn.amount)}.`,
      category: "workflow",
    });
    setSelectedTxn((prev) => (prev ? { ...prev, reconciled: nextReconciled } : prev));
    setNotice(nextReconciled ? "Transaction marked matched or accepted." : "Transaction marked not accepted.");
  };

  const handleToggleSelectedTxnTaxChecked = () => {
    if (!selectedTxn) return;
    actions.setTransactionTaxChecked(selectedTxn.id, !selectedTxn.taxChecked);
    setSelectedTxn((prev) => (prev ? { ...prev, taxChecked: !prev.taxChecked } : prev));
  };

  const quickUpdateSelectedTxn = (fields, message) => {
    if (!selectedTxn) return;
    const nextTxn = { ...selectedTxn, ...fields };
    actions.addOrUpdateTransaction(nextTxn);
    setSelectedTxn(nextTxn);
    if (message) setNotice(message);
  };

  const handleMarkSelectedTxnTaxReviewed = () => {
    if (!selectedTxn) return;
    quickUpdateSelectedTxn({ taxChecked: true }, "Transaction marked reviewed for tax.");
  };

  const handleUseSelectedTxnDateAsServicePeriod = () => {
    if (!selectedTxn?.date) return;
    const preview = actions.computeTransactionPreview({
      amount: Number(selectedTxn.amount || 0),
      type: selectedTxn.type,
      capitalImprovement: Boolean(selectedTxn.capitalImprovement),
      propertyId: selectedTxn.propertyId,
      unit: selectedTxn.unit,
      date: selectedTxn.date,
      ownerUsePct: Number(selectedTxn.ownerUsePct || 0),
      ownerUsePctOverride: Boolean(selectedTxn.ownerUsePctOverride),
      servicePeriodStart: selectedTxn.date,
      servicePeriodEnd: selectedTxn.date,
    });
    quickUpdateSelectedTxn(
      {
        servicePeriodStart: selectedTxn.date,
        servicePeriodEnd: selectedTxn.date,
        rentalUsePct: preview.rentalUsePct,
        deductibleAmount: preview.deductibleAmount,
        taxChecked: false,
      },
      "Service period set to the transaction date. Review owner-use before marking tax checked.",
    );
  };

  const handleClearSelectedTxnOwnerUseOverride = () => {
    if (!selectedTxn) return;
    quickUpdateSelectedTxn(
      {
        ownerUsePctOverride: false,
        taxChecked: false,
      },
      "Owner-use override cleared. Reopen the edit form to review the auto percentage.",
    );
  };

  const handleVoidSelectedTxn = () => {
    if (!selectedTxn) return;
    actions.voidTransaction(selectedTxn.id);
    setSelectedTxn(null);
  };

  const handleDeleteSelectedTxn = () => {
    if (!selectedTxn) return;
    setTxnToDelete(selectedTxn);
  };

  const confirmDeleteTransaction = () => {
    if (!txnToDelete) return;
    if (!requirePermission("delete_records", "Admin access is required to delete transactions.")) return;
    const deletingTxn = txnToDelete;
    setTxnToDelete(null);
    setSelectedTxn(null);
    globalThis.setTimeout(() => {
      actions.deleteTransaction(deletingTxn.id);
      addAuditEntry({
        action: "delete",
        entityType: "transaction",
        entityId: deletingTxn.id,
        propertyId: deletingTxn.propertyId,
        unit: deletingTxn.unit,
        summary: "Deleted transaction.",
        details: `${deletingTxn.description} | ${deletingTxn.date} | ${currency(deletingTxn.amount)}.`,
        category: "record",
      });
      setNotice("Transaction deleted.");
    }, 0);
  };

  return {
    confirmDeleteTransaction,
    editReturnView,
    handleDeleteSelectedTxn,
    handleDuplicateSelectedTxn,
    handleClearSelectedTxnOwnerUseOverride,
    handleMarkSelectedTxnTaxReviewed,
    handleEditSelectedTxn,
    handleToggleSelectedTxnReconciled,
    handleToggleSelectedTxnTaxChecked,
    handleUseSelectedTxnDateAsServicePeriod,
    handleVoidSelectedTxn,
    onTransactionInlineAttachmentChange,
    openTransaction,
    openTransactionInlineAttachmentPicker,
    selectedTransactionDocuments,
    selectedTxn,
    selectedTxnReviewFocusKey,
    selectedTxnLinkedWorkOrder,
    selectedTxnReconcileWarning,
    selectedTxnReconcileWarningText,
    selectedTxnToggleReconcileDisabled,
    setEditReturnView,
    setSelectedTxn,
    setTxnToDelete,
    startEdit,
    txnToDelete,
  };
}
