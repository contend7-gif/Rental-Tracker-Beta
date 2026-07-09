import { useEffect, useMemo } from "react";
import {
  clampPercentInput,
  formatPercentInput,
} from "./formatHelpers.js";
import { nextMonthSameDay } from "./dateHelpers.js";
import {
  applyTransactionVendorMemoryToDraft,
  findTransactionVendorMemoryForDraft,
} from "../features/transactions/transactionVendorMemory.js";

export function useTransactionEntryController({
  actions,
  appSettings,
  attachDocumentToTransaction,
  canAttachToTransaction,
  categories,
  createBlankForm,
  currency,
  deMinimisThreshold,
  documents,
  editReturnView,
  editingTxnId,
  form,
  getRentalUsePctForDate,
  getRentalUsePctForRange,
  isDeMinimisCategoryEligible,
  isTaxReviewRelevantTransaction,
  leases,
  pendingDocumentExpenseSource,
  pendingTxnAttachment,
  prefetchDialog,
  properties,
  recurringThroughDate,
  requirePermission,
  setDashboardQuickAddOpen,
  setDocumentStatusFilter,
  setEditingTxnId,
  setExpenseQueueFocusDocumentId,
  setExpenseQueueShowDismissed,
  setForm,
  setNotice,
  setPendingDocumentExpenseSource,
  setPendingTxnAttachment,
  setPropertyQuickAddOpen,
  setRentAmountTouched,
  setEditReturnView,
  setView,
  transactionVendorMemories,
  txnAttachmentInputRef,
  units,
  usePeriods,
}) {
  const autoOwnerUsePct = useMemo(() => {
    if (!form.propertyId) return 0;
    const hasServiceRange =
      String(form.servicePeriodStart || "").trim() &&
      String(form.servicePeriodEnd || "").trim() &&
      String(form.servicePeriodEnd || "") >= String(form.servicePeriodStart || "");
    const rentalUsePct = hasServiceRange
      ? getRentalUsePctForRange({
          propertyId: form.propertyId,
          unit: form.unit,
          startDate: String(form.servicePeriodStart || ""),
          endDate: String(form.servicePeriodEnd || ""),
          usePeriods,
          leases,
          units,
          fallbackOwnerUsePct: 0,
        })
      : getRentalUsePctForDate({
          propertyId: form.propertyId,
          unit: form.unit,
          date: form.date,
          usePeriods,
          leases,
          units,
          fallbackOwnerUsePct: 0,
        });
    return clampPercentInput((1 - rentalUsePct) * 100);
  }, [form.propertyId, form.unit, form.date, form.servicePeriodStart, form.servicePeriodEnd, usePeriods, leases, units, getRentalUsePctForDate, getRentalUsePctForRange]);

  useEffect(() => {
    if (form.ownerUsePctOverride) return;
    const nextValue = formatPercentInput(autoOwnerUsePct);
    if (form.ownerUsePct !== nextValue) {
      setForm((prev) => ({ ...prev, ownerUsePct: nextValue }));
    }
  }, [autoOwnerUsePct, form.ownerUsePct, form.ownerUsePctOverride, setForm]);

  const effectiveOwnerUsePct = form.ownerUsePctOverride
    ? clampPercentInput(Number(form.ownerUsePct || 0)) / 100
    : autoOwnerUsePct / 100;
  const mileageMiles = Number(form.mileageMiles || 0);
  const mileageRate = Number(form.mileageRate || 0);
  const mileageAmount = form.type === "Expense" && form.category === "Auto and travel" && mileageMiles > 0 && mileageRate > 0
    ? Number((mileageMiles * mileageRate).toFixed(2))
    : 0;
  const transactionAmount = Number(form.amount || 0) > 0 ? Number(form.amount || 0) : mileageAmount;

  const preview = actions.computeTransactionPreview({
    amount: transactionAmount,
    type: form.type,
    capitalImprovement: form.capitalImprovement === "Yes",
    propertyId: form.propertyId,
    unit: form.unit,
    date: form.date,
    ownerUsePct: effectiveOwnerUsePct,
    ownerUsePctOverride: Boolean(form.ownerUsePctOverride),
    servicePeriodStart: form.servicePeriodStart || "",
    servicePeriodEnd: form.servicePeriodEnd || "",
  });
  const mileagePreview = {
    amount: mileageAmount,
    miles: Number.isFinite(mileageMiles) ? mileageMiles : 0,
    rate: Number.isFinite(mileageRate) ? mileageRate : 0,
  };
  const vendorMemorySuggestion = useMemo(
    () => findTransactionVendorMemoryForDraft(form, transactionVendorMemories),
    [form.vendor, form.description, transactionVendorMemories],
  );
  const applyVendorMemoryToForm = () => {
    if (!vendorMemorySuggestion) return;
    setForm((prev) => applyTransactionVendorMemoryToDraft(prev, vendorMemorySuggestion, categories));
    setRentAmountTouched(true);
    setNotice(`Applied ${vendorMemorySuggestion.label || vendorMemorySuggestion.vendor || "vendor"} defaults.`);
  };

  const deMinimisCategoryEligible = isDeMinimisCategoryEligible(form.type, form.category);
  const showDeMinimisControls =
    appSettings.deMinimisElectionEnabled &&
    deMinimisCategoryEligible &&
    form.capitalImprovement === "No";
  const deMinimisPreview = useMemo(() => {
    const invoiceAmount = Number(form.invoiceAmount || form.amount || 0);
    const qualifies =
      deMinimisCategoryEligible &&
      form.capitalImprovement === "No" &&
      invoiceAmount > 0 &&
      invoiceAmount <= deMinimisThreshold;
    const treatment = form.deMinimisTreatment || "auto";
    const applied =
      appSettings.deMinimisElectionEnabled &&
      (treatment === "yes" ? qualifies : treatment === "no" ? false : qualifies);
    return { invoiceAmount, qualifies, applied };
  }, [
    deMinimisCategoryEligible,
    form.capitalImprovement,
    form.invoiceAmount,
    form.amount,
    form.deMinimisTreatment,
    deMinimisThreshold,
    appSettings.deMinimisElectionEnabled,
  ]);

  const saveTransaction = async (keepOpen = false) => {
    if (!requirePermission("create_edit_records", "This access profile cannot save transactions.")) return;
    const amount = transactionAmount;
    const ownerUsePct = effectiveOwnerUsePct;
    const ownerUsePctOverride = Boolean(form.ownerUsePctOverride);
    const invoiceAmount = Number(form.invoiceAmount || amount || 0);
    const deMinimisTreatment = form.deMinimisTreatment || "auto";
    const deMinimisCategoryEligibleOnSave = isDeMinimisCategoryEligible(form.type, form.category);
    const deMinimisQualifies =
      deMinimisCategoryEligibleOnSave &&
      form.capitalImprovement === "No" &&
      invoiceAmount > 0 &&
      invoiceAmount <= deMinimisThreshold;
    const deMinimisCandidate = appSettings.deMinimisElectionEnabled && deMinimisQualifies;
    const deMinimisApplied =
      appSettings.deMinimisElectionEnabled &&
      (deMinimisTreatment === "yes"
        ? deMinimisQualifies
        : deMinimisTreatment === "no"
          ? false
          : deMinimisCandidate);
    const deMinimisReason = !appSettings.deMinimisElectionEnabled
      ? "Election off"
      : form.type !== "Expense"
        ? "Not an expense"
        : !deMinimisCategoryEligibleOnSave
          ? "Category not eligible"
          : form.capitalImprovement === "Yes"
            ? "Capitalized improvement"
            : invoiceAmount <= 0
              ? "Missing invoice/item amount"
              : invoiceAmount > deMinimisThreshold
                ? `Exceeds threshold (${currency(deMinimisThreshold)})`
                : deMinimisTreatment === "no"
                  ? "Manually excluded"
                  : "Within threshold";

    const propertyExists = properties.some((property) => property.id === form.propertyId);
    if (!propertyExists) {
      setNotice("Add or select a property before saving a transaction.");
      setView("properties");
      return;
    }

    const validUnitNames = new Set([
      "Shared",
      ...units.filter((unit) => unit.propertyId === form.propertyId).map((unit) => unit.name),
    ]);
    if (!form.unit || !validUnitNames.has(form.unit)) {
      setNotice("Select a valid unit before saving a transaction.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter an amount greater than zero before saving a transaction.");
      return;
    }

    const txId = editingTxnId || `t${Date.now()}`;
    const receiptName = form.receiptName || (pendingTxnAttachment?.name || "");
    const txnTaxReviewRelevant = isTaxReviewRelevantTransaction({
      type: form.type,
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: form.capitalImprovement === "Yes",
      unit: form.unit,
      receiptName,
    });
    const txn = {
      id: txId,
      date: form.date,
      propertyId: form.propertyId,
      unit: form.unit,
      type: form.type,
      category: form.category,
      description: form.description,
      amount,
      ownerUsePct,
      ownerUsePctOverride,
      rentalUsePct: preview.rentalUsePct,
      deductibleAmount: preview.deductibleAmount,
      paidFrom: form.paidFrom,
      paymentMethod: form.paymentMethod,
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: form.capitalImprovement === "Yes",
      vendor: form.vendor,
      receiptName,
      notes: form.notes,
      taxChecked: txnTaxReviewRelevant ? form.taxChecked === "Yes" : true,
      reconciled: editingTxnId ? Boolean(form.reconciled) : false,
      invoiceRef: form.invoiceRef || "",
      invoiceAmount,
      mileageMiles: form.type === "Expense" && form.category === "Auto and travel" && mileageMiles > 0 ? mileageMiles : undefined,
      mileageRate: form.type === "Expense" && form.category === "Auto and travel" && mileageRate > 0 ? mileageRate : undefined,
      servicePeriodStart: form.servicePeriodStart || undefined,
      servicePeriodEnd: form.servicePeriodEnd || undefined,
      rentPeriod: form.type === "Income" && /\brents?\b/i.test(form.category) ? (form.rentPeriod || form.date.slice(0, 7)) : undefined,
      deMinimisTreatment,
      deMinimisCandidate,
      deMinimisApplied,
      deMinimisReason,
      recurringTemplateId: editingTxnId ? form.recurringTemplateId : undefined,
      bankImportId: editingTxnId ? form.bankImportId : undefined,
      workOrderId: form.type === "Expense" ? (form.workOrderId || undefined) : undefined,
      status: "active",
    };

    const assetPayload =
      form.capitalImprovement === "Yes"
        ? {
            propertyId: form.propertyId,
            unit: form.unit,
            description: form.description || form.category,
            type: "Improvement",
            placedInService: form.date,
            cost: amount,
            basis: amount * preview.rentalUsePct,
            life: 27.5,
          }
        : undefined;

    actions.addOrUpdateTransaction(txn, assetPayload);

    if (pendingDocumentExpenseSource?.documentId) {
      const sourceDocument = documents.find(
        (document) => document.id === pendingDocumentExpenseSource.documentId,
      );
      if (pendingDocumentExpenseSource.linkMode === "related") {
        const relatedTransactionIds = [
          ...new Set([...(sourceDocument?.relatedTransactionIds || []), txn.id]),
        ];
        actions.updateDocument(pendingDocumentExpenseSource.documentId, {
          relatedTransactionIds,
          propertyId: txn.propertyId,
          unit: txn.unit,
        });
      } else {
        actions.updateDocument(pendingDocumentExpenseSource.documentId, {
          transactionId: txn.id,
          propertyId: txn.propertyId,
          unit: txn.unit,
        });
      }
    }

    let attachmentMessage = pendingDocumentExpenseSource?.documentId ? " Receipt attached." : "";
    if (pendingTxnAttachment) {
      await attachDocumentToTransaction(txn, pendingTxnAttachment);
      attachmentMessage = " Receipt attached.";
    }

    let recurringMessage = "";
    if (form.recurringMonthly === "Yes" && !txn.recurringTemplateId) {
      const template = actions.createRecurringTemplate(txn, {
        frequency: "Monthly",
        nextDueDate: nextMonthSameDay(txn.date),
        reviewRequired: true,
      });
      const generated = actions.materializeRecurringTransactions(recurringThroughDate);
      recurringMessage = ` Recurring monthly enabled (${template.description}); ${generated} entries auto-added.`;
    }

    const nextQueueName = String(pendingDocumentExpenseSource?.nextDocumentName || "").trim();
    if (pendingDocumentExpenseSource?.nextDocumentId) {
      setExpenseQueueFocusDocumentId(pendingDocumentExpenseSource.nextDocumentId);
      setDocumentStatusFilter("expense_queue");
      setExpenseQueueShowDismissed(false);
    }
    setNotice(
      (editingTxnId ? "Transaction updated." : "Transaction created.") +
        attachmentMessage +
        recurringMessage +
        (nextQueueName ? ` Next up: ${nextQueueName}.` : ""),
    );
    setEditingTxnId("");
    if (!keepOpen) setView(editReturnView);
    setForm(createBlankForm(form.propertyId, form.unit || "Shared"));
    setPendingDocumentExpenseSource(null);
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setRentAmountTouched(false);
  };

  const onTransactionAttachmentInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!canAttachToTransaction(file)) {
      setNotice("Attach a PDF or image file for transaction receipts.");
      event.target.value = "";
      return;
    }
    setPendingTxnAttachment(file);
    setForm((prev) => ({ ...prev, receiptName: prev.receiptName || file.name }));
  };

  const openTransactionAttachmentPicker = () => {
    txnAttachmentInputRef.current?.click();
  };

  const clearTransactionForm = () => {
    setEditingTxnId("");
    setPendingDocumentExpenseSource(null);
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setRentAmountTouched(false);
    setForm(createBlankForm(form.propertyId, form.unit || "Shared"));
  };

  const openDashboardQuickAdd = () => {
    prefetchDialog("dashboardQuickAdd");
    if (properties.length === 0) {
      prefetchDialog("propertyQuickAdd");
      setNotice("Add your first property before adding a transaction.");
      setPropertyQuickAddOpen(true);
      return;
    }
    setEditingTxnId("");
    setEditReturnView("dashboard");
    setRentAmountTouched(false);
    setPendingDocumentExpenseSource(null);
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setForm(createBlankForm(form.propertyId, form.unit || "Shared"));
    setDashboardQuickAddOpen(true);
  };

  const openDashboardQuickAddForScope = (propertyId, unit = "Shared") => {
    prefetchDialog("dashboardQuickAdd");
    if (!properties.some((property) => property.id === propertyId)) {
      openDashboardQuickAdd();
      return;
    }
    setEditingTxnId("");
    setEditReturnView("properties");
    setRentAmountTouched(false);
    setPendingDocumentExpenseSource(null);
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    setForm(createBlankForm(propertyId, unit || "Shared"));
    setDashboardQuickAddOpen(true);
  };

  return {
    autoOwnerUsePct,
    applyVendorMemoryToForm,
    clearTransactionForm,
    deMinimisPreview,
    mileagePreview,
    onTransactionAttachmentInputChange,
    openDashboardQuickAdd,
    openDashboardQuickAddForScope,
    openTransactionAttachmentPicker,
    preview,
    saveTransaction,
    showDeMinimisControls,
    vendorMemorySuggestion,
  };
}
