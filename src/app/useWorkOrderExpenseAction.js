import { useCallback } from "react";

import {
  categoryForMaintenanceAccountingTreatment,
  resolveWorkOrderCost,
} from "../domain/maintenance.ts";

export function useWorkOrderExpenseAction({
  actions,
  openTransaction,
  setNotice,
  todayIso,
  transactionById,
  vendorById,
}) {
  return useCallback((workOrder) => {
    if (workOrder.transactionId && transactionById[workOrder.transactionId]) {
      openTransaction(transactionById[workOrder.transactionId]);
      return;
    }

    const amount = resolveWorkOrderCost(workOrder, transactionById);
    if (amount <= 0) {
      setNotice("Add an estimated or actual cost before creating an expense.");
      return;
    }

    const expenseDate = workOrder.completedAt || workOrder.dueDate || workOrder.reportedOn || todayIso;
    const vendorName = workOrder.vendorId ? vendorById[workOrder.vendorId]?.name || "" : "";
    const vendorDefaultCategory = workOrder.vendorId ? vendorById[workOrder.vendorId]?.defaultCategory || "" : "";
    const expenseCategory = categoryForMaintenanceAccountingTreatment(workOrder.accountingTreatment, vendorDefaultCategory || "Repairs");
    const isCapitalImprovement = workOrder.accountingTreatment === "capital_improvement";
    const preview = actions.computeTransactionPreview({
      amount,
      type: "Expense",
      capitalImprovement: isCapitalImprovement,
      propertyId: workOrder.propertyId,
      unit: workOrder.unit || "Shared",
      date: expenseDate,
      ownerUsePct: 0,
    });

    const txnId = `t-workorder-${Date.now()}`;
    actions.addOrUpdateTransaction({
      id: txnId,
      date: expenseDate,
      propertyId: workOrder.propertyId,
      unit: workOrder.unit || "Shared",
      type: "Expense",
      category: expenseCategory,
      description: `Work order: ${workOrder.title}`,
      amount,
      ownerUsePct: 0,
      rentalUsePct: preview.rentalUsePct,
      deductibleAmount: preview.deductibleAmount,
      paidFrom: "Operating account",
      paymentMethod: "ACH",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: isCapitalImprovement,
      vendor: vendorName,
      receiptName: "",
      notes: `Created from work order ${workOrder.id}.${isCapitalImprovement ? " Review asset creation for this capital improvement." : ""}`,
      taxChecked: false,
      reconciled: false,
      workOrderId: workOrder.id,
      status: "active",
    });

    actions.linkWorkOrderTransaction(workOrder.id, txnId);
    setNotice(isCapitalImprovement ? "Expense created and marked as capital improvement. Create an asset next." : "Expense created from work order.");
  }, [actions, openTransaction, setNotice, todayIso, transactionById, vendorById]);
}
