import { useMemo } from "react";

export function useLedgerTransactionActions({
  actions,
  activeTx,
  propertyFilter,
  recurringTemplates,
  recurringThroughDate,
  requirePermission,
  setNotice,
  transactionById,
  unitFilter,
  yearFilter,
}) {
  const expectedRecurringTransactions = useMemo(
    () =>
      recurringTemplates
        .filter((template) => {
          if (!template.active) return false;
          if (!template.nextDueDate || template.nextDueDate > recurringThroughDate) return false;
          if (propertyFilter !== "all" && template.propertyId !== propertyFilter) return false;
          if (unitFilter !== "all" && template.unit !== unitFilter) return false;
          if (!String(template.nextDueDate).startsWith(yearFilter)) return false;
          return !activeTx.some((transaction) => transaction.recurringTemplateId === template.id && transaction.date === template.nextDueDate);
        })
        .sort((left, right) => String(left.nextDueDate || "").localeCompare(String(right.nextDueDate || ""))),
    [activeTx, propertyFilter, recurringTemplates, recurringThroughDate, unitFilter, yearFilter],
  );

  const postDueRecurringTransactions = () => {
    const generated = actions.materializeRecurringTransactions(recurringThroughDate);
    setNotice(`Posted ${generated} due recurring transaction${generated === 1 ? "" : "s"}.`);
  };

  const markTransactionsTaxReviewed = (ids) => {
    const selectedIds = Array.from(new Set(ids || [])).filter(Boolean);
    selectedIds.forEach((id) => actions.setTransactionTaxChecked(id, true));
    setNotice(`Marked ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"} reviewed for tax.`);
  };

  const reconcileTransactions = (ids) => {
    if (!requirePermission("reconcile_records", "This access profile cannot mark ledger transactions as matched or accepted.")) return;
    const selectedIds = Array.from(new Set(ids || [])).filter(Boolean);
    selectedIds.forEach((id) => actions.setTransactionReconciled(id, true));
    setNotice(`Marked ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"} bank matched or accepted.`);
  };

  const useTransactionDatesAsServicePeriods = (ids) => {
    const selectedIds = Array.from(new Set(ids || [])).filter(Boolean);
    selectedIds.forEach((id) => {
      const transaction = transactionById[id];
      if (!transaction?.date) return;
      const preview = actions.computeTransactionPreview({
        amount: Number(transaction.amount || 0),
        type: transaction.type,
        capitalImprovement: Boolean(transaction.capitalImprovement),
        propertyId: transaction.propertyId,
        unit: transaction.unit,
        date: transaction.date,
        ownerUsePct: Number(transaction.ownerUsePct || 0),
        ownerUsePctOverride: Boolean(transaction.ownerUsePctOverride),
        servicePeriodStart: transaction.date,
        servicePeriodEnd: transaction.date,
      });
      actions.addOrUpdateTransaction({
        ...transaction,
        servicePeriodStart: transaction.date,
        servicePeriodEnd: transaction.date,
        rentalUsePct: preview.rentalUsePct,
        deductibleAmount: preview.deductibleAmount,
        taxChecked: false,
      });
    });
    setNotice(`Set transaction date as service period on ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"}.`);
  };

  const markTransactionSupportUnavailable = (transactionId) => {
    if (!requirePermission("create_edit_records", "This access profile cannot update transactions.")) return;
    const transaction = transactionById[transactionId];
    if (!transaction) {
      setNotice("Transaction was not found.");
      return;
    }
    actions.addOrUpdateTransaction({
      ...transaction,
      taxChecked: false,
      reviewOverrides: {
        ...(transaction.reviewOverrides || {}),
        missing_receipt: "not_available",
      },
    });
    setNotice("Marked receipt/document support as unavailable for this transaction.");
  };

  return {
    expectedRecurringTransactions,
    markTransactionsTaxReviewed,
    markTransactionSupportUnavailable,
    postDueRecurringTransactions,
    reconcileTransactions,
    useTransactionDatesAsServicePeriods,
  };
}
