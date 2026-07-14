import { deductibleAmountForTransaction, getRentalUsePctForDate, getRentalUsePctForRange } from "../domain/accounting.ts";
import type { Asset, DocumentItem, Lease, TenantLedgerEntry, Transaction, Unit, UsePeriod, WorkOrder } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { normalizeDocument } from "./documentStore.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;
type AssetPayload = Omit<Asset, "id" | "currentYearDep" | "basis"> & { basis: number; life: number };

export function normalizeTransaction(transaction: Transaction): Transaction {
  const rentPeriod = String(transaction.rentPeriod || "").trim();
  return {
    ...transaction,
    reconciled: transaction.reconciled === true,
    servicePeriodStart: String(transaction.servicePeriodStart || "").trim() || undefined,
    servicePeriodEnd: String(transaction.servicePeriodEnd || "").trim() || undefined,
    rentPeriod: /^\d{4}-\d{2}$/.test(rentPeriod) ? rentPeriod : undefined,
  };
}

export function createTransactionActions({
  getTransactions,
  getUsePeriods,
  getLeases,
  getUnits,
  setTransactions,
  setDocuments,
  setWorkOrders,
  setTenantLedgerEntries,
  setAssets,
  appendActivityLog,
}: {
  getTransactions: () => Transaction[];
  getUsePeriods: () => UsePeriod[];
  getLeases: () => Lease[];
  getUnits: () => Unit[];
  setTransactions: StateSetter<Transaction>;
  setDocuments: StateSetter<DocumentItem>;
  setWorkOrders: StateSetter<WorkOrder>;
  setTenantLedgerEntries: StateSetter<TenantLedgerEntry>;
  setAssets: StateSetter<Asset>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    addOrUpdateTransaction(transaction: Transaction, assetPayload?: AssetPayload) {
      const normalizedTransaction = normalizeTransaction(transaction);
      const existsBefore = getTransactions().some((existing) => existing.id === normalizedTransaction.id);
      const normalizedAmount = Number(normalizedTransaction.amount);
      const linkedWorkOrderId = String(normalizedTransaction.workOrderId || "").trim();
      const linkedTenantLedgerEntryId = String(normalizedTransaction.tenantLedgerEntryId || "").trim();
      setTransactions((previous) => {
        const exists = previous.some((existing) => existing.id === normalizedTransaction.id);
        return exists
          ? previous.map((existing) => (existing.id === normalizedTransaction.id ? normalizedTransaction : existing))
          : [normalizedTransaction, ...previous];
      });
      setWorkOrders((previous) => previous.map((workOrder) => {
        const hasTransactionLink = workOrder.transactionId === normalizedTransaction.id;
        const isDirectLink = linkedWorkOrderId !== "" && workOrder.id === linkedWorkOrderId;
        if (!hasTransactionLink && !isDirectLink) return workOrder;
        if (isDirectLink) {
          return {
            ...workOrder,
            transactionId: normalizedTransaction.id,
            actualCost: Number.isFinite(normalizedAmount) ? normalizedAmount : workOrder.actualCost,
          };
        }
        return linkedWorkOrderId ? { ...workOrder, transactionId: "" } : {
          ...workOrder,
          actualCost: Number.isFinite(normalizedAmount) ? normalizedAmount : workOrder.actualCost,
        };
      }));
      setTenantLedgerEntries((previous) => previous.map((entry) => {
        const hasTransactionLink = entry.transactionId === normalizedTransaction.id;
        const isDirectLink = linkedTenantLedgerEntryId !== "" && entry.id === linkedTenantLedgerEntryId;
        if (!hasTransactionLink && !isDirectLink) return entry;
        if (isDirectLink) return { ...entry, transactionId: normalizedTransaction.id };
        return linkedTenantLedgerEntryId ? { ...entry, transactionId: undefined } : entry;
      }));
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "transaction",
        entityId: normalizedTransaction.id,
        propertyId: normalizedTransaction.propertyId,
        unit: normalizedTransaction.unit,
        summary: existsBefore ? "Transaction updated." : "Transaction created.",
        details: normalizedTransaction.description,
      });
      if (assetPayload) {
        setAssets((previous) => [{
          id: `a${Date.now()}`,
          ...assetPayload,
          currentYearDep: assetPayload.basis / assetPayload.life,
          bonusEligible: false,
          bonusElected: false,
          bonusRate: 0,
        }, ...previous]);
      }
    },
    setTransactionTaxChecked(id: string, checked: boolean) {
      setTransactions((previous) => previous.map((transaction) => transaction.id === id ? { ...transaction, taxChecked: checked } : transaction));
    },
    setTransactionReconciled(id: string, reconciled: boolean) {
      const existingTransaction = getTransactions().find((transaction) => transaction.id === id);
      setTransactions((previous) => previous.map((transaction) => transaction.id === id ? { ...transaction, reconciled } : transaction));
      if (!existingTransaction || Boolean(existingTransaction.reconciled) === reconciled) return;
      appendActivityLog({
        action: reconciled ? "reconcile" : "unreconcile",
        entityType: "transaction",
        entityId: id,
        propertyId: existingTransaction.propertyId,
        unit: existingTransaction.unit,
        summary: reconciled ? "Transaction marked reconciled." : "Transaction marked unreconciled.",
        details: existingTransaction.description,
      });
    },
    deleteTransaction(id: string) {
      const existingTransaction = getTransactions().find((transaction) => transaction.id === id);
      setTransactions((previous) => previous.filter((transaction) => transaction.id !== id));
      setDocuments((previous) => previous.map((document) => {
        const relatedTransactionIds = Array.isArray(document.relatedTransactionIds)
          ? document.relatedTransactionIds.filter((transactionId) => transactionId !== id)
          : [];
        if (document.transactionId !== id) return normalizeDocument({ ...document, relatedTransactionIds });
        const promotedTransactionId = relatedTransactionIds[0] || "";
        return normalizeDocument({
          ...document,
          transactionId: promotedTransactionId || undefined,
          relatedTransactionIds: promotedTransactionId ? relatedTransactionIds.slice(1) : relatedTransactionIds,
        });
      }));
      setWorkOrders((previous) => previous.map((workOrder) => workOrder.transactionId === id ? { ...workOrder, transactionId: "" } : workOrder));
      setTenantLedgerEntries((previous) => previous.map((entry) => entry.transactionId === id ? { ...entry, transactionId: undefined } : entry));
      appendActivityLog({
        action: "delete",
        entityType: "transaction",
        entityId: id,
        propertyId: existingTransaction?.propertyId,
        unit: existingTransaction?.unit,
        summary: "Transaction deleted.",
        details: existingTransaction?.description,
      });
    },
    voidTransaction(id: string) {
      const existingTransaction = getTransactions().find((transaction) => transaction.id === id);
      setTransactions((previous) => previous.map((transaction) => transaction.id === id ? { ...transaction, status: "voided" } : transaction));
      if (!existingTransaction) return;
      appendActivityLog({
        action: "void",
        entityType: "transaction",
        entityId: id,
        propertyId: existingTransaction.propertyId,
        unit: existingTransaction.unit,
        summary: "Transaction voided.",
        details: existingTransaction.description,
      });
    },
    duplicateTransaction(transaction: Transaction) {
      const clone: Transaction = {
        ...transaction,
        id: `t${Date.now()}`,
        description: `${transaction.description} (copy)`,
        taxChecked: false,
        reconciled: false,
        recurringTemplateId: undefined,
        tenantLedgerEntryId: undefined,
        status: "active",
      };
      setTransactions((previous) => [clone, ...previous]);
      appendActivityLog({
        action: "create",
        entityType: "transaction",
        entityId: clone.id,
        propertyId: clone.propertyId,
        unit: clone.unit,
        summary: "Transaction duplicated.",
        details: clone.description,
      });
    },
    markTransactionCapitalImprovement(id: string, isCapitalImprovement: boolean) {
      const existingTransaction = getTransactions().find((transaction) => transaction.id === id);
      setTransactions((previous) => previous.map((transaction) => transaction.id === id ? {
        ...transaction,
        capitalImprovement: isCapitalImprovement,
        taxChecked: false,
        reviewOverrides: {
          ...(transaction.reviewOverrides || {}),
          possible_improvement: isCapitalImprovement ? "capitalized" : "repair_confirmed",
        },
      } : transaction));
      if (!existingTransaction || Boolean(existingTransaction.capitalImprovement) === isCapitalImprovement) return;
      appendActivityLog({
        action: "update",
        entityType: "transaction",
        entityId: id,
        propertyId: existingTransaction.propertyId,
        unit: existingTransaction.unit,
        summary: isCapitalImprovement ? "Transaction marked as capital improvement." : "Transaction marked as repair.",
        details: existingTransaction.description,
      });
    },
    computeTransactionPreview(args: { amount: number; type: Transaction["type"]; capitalImprovement: boolean; propertyId: string; unit: string; date: string; ownerUsePct: number; ownerUsePctOverride?: boolean; servicePeriodStart?: string; servicePeriodEnd?: string }) {
      const hasServiceRange = String(args.servicePeriodStart || "").trim()
        && String(args.servicePeriodEnd || "").trim()
        && String(args.servicePeriodEnd || "") >= String(args.servicePeriodStart || "");
      const allocationArgs = {
        propertyId: args.propertyId,
        unit: args.unit,
        usePeriods: getUsePeriods(),
        leases: getLeases(),
        units: getUnits(),
        fallbackOwnerUsePct: args.ownerUsePct,
        ownerUsePctOverride: Boolean(args.ownerUsePctOverride),
      };
      const rentalUsePct = hasServiceRange
        ? getRentalUsePctForRange({ ...allocationArgs, startDate: String(args.servicePeriodStart), endDate: String(args.servicePeriodEnd) })
        : getRentalUsePctForDate({ ...allocationArgs, date: args.date });
      return {
        rentalUsePct,
        deductibleAmount: deductibleAmountForTransaction({ amount: args.amount, type: args.type, capitalImprovement: args.capitalImprovement, rentalUsePct }),
      };
    },
  };
}
