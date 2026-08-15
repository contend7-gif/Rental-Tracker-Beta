import { useEffect } from "react";
import { normalizeTenantLedgerAccountingTreatment } from "../domain/tenantLedgerPosting.ts";
import { isRentIncomeTransaction, leaseIsActiveByDate, rentTxnAutomationKey, rentTxnIdFromAutomationKey } from "./leaseShared.js";

export function useRentTransactionLedgerSync({
  actions,
  isDataHydrated,
  leases,
  tenantLedgerEntries,
  transactions,
}) {
  useEffect(() => {
    if (!isDataHydrated) return;

    const eligibleByTxnId = new Map();
    transactions
      .filter((txn) => isRentIncomeTransaction(txn) && !String(txn.tenantLedgerEntryId || "").trim())
      .forEach((txn) => {
        const explicitlyLinkedLease = String(txn.rentLeaseId || "").trim()
          ? leases.find(
              (candidate) =>
                candidate.id === String(txn.rentLeaseId || "").trim() &&
                candidate.propertyId === txn.propertyId &&
                candidate.unit === txn.unit,
            )
          : null;
        const lease = explicitlyLinkedLease || leases
          .filter(
            (candidate) =>
              candidate.propertyId === txn.propertyId &&
              candidate.unit === txn.unit &&
              leaseIsActiveByDate(candidate, txn.date),
          )
          .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

        if (!lease) return;
        eligibleByTxnId.set(txn.id, { txn, lease });
      });

    const syncedEntries = tenantLedgerEntries.filter((entry) => String(entry.automationKey || "").startsWith("txn-rent:"));

    syncedEntries.forEach((entry) => {
      const txnId = rentTxnIdFromAutomationKey(entry.automationKey);
      if (!txnId || !eligibleByTxnId.has(txnId)) {
        actions.deleteTenantLedgerEntry(entry.id);
      }
    });

    eligibleByTxnId.forEach(({ txn, lease }, txnId) => {
      const amount = Math.abs(Number(txn.amount || 0));
      if (!Number.isFinite(amount) || amount <= 0) return;

      const automationKey = rentTxnAutomationKey(txnId);
      const accountingTreatment = "rent_income";
      const memo = String(txn.description || "").trim() || "Rent payment";
      const entryShape = {
        leaseId: lease.id,
        date: txn.date,
        kind: "payment",
        amount,
        memo,
        accountingTreatment,
        transactionId: txnId,
        automationKey,
      };

      const isSameAsDesired = (entry) =>
        entry &&
        entry.leaseId === entryShape.leaseId &&
        entry.date === entryShape.date &&
        entry.kind === entryShape.kind &&
        Math.abs(Number(entry.amount || 0) - entryShape.amount) < 0.01 &&
        String(entry.memo || "").trim() === entryShape.memo &&
        normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment) === entryShape.accountingTreatment &&
        String(entry.transactionId || "") === entryShape.transactionId &&
        String(entry.automationKey || "") === entryShape.automationKey;

      const existingSynced = syncedEntries.find((entry) => String(entry.automationKey || "") === automationKey);
      if (existingSynced) {
        if (!isSameAsDesired(existingSynced)) {
          actions.addOrUpdateTenantLedgerEntry({
            ...existingSynced,
            ...entryShape,
            createdAt: existingSynced.createdAt || new Date().toISOString(),
          });
        }
        return;
      }

      const linkedExisting = tenantLedgerEntries.find((entry) => String(entry.transactionId || "") === txnId);
      if (linkedExisting) {
        if (!isSameAsDesired(linkedExisting)) {
          actions.addOrUpdateTenantLedgerEntry({
            ...linkedExisting,
            ...entryShape,
            createdAt: linkedExisting.createdAt || new Date().toISOString(),
          });
        }
        return;
      }

      const matchedManual = tenantLedgerEntries.find((entry) => {
        if (String(entry.transactionId || "").trim()) return false;
        if (String(entry.automationKey || "").trim()) return false;
        if (entry.leaseId !== lease.id) return false;
        if (entry.kind !== "payment") return false;
        if (entry.date !== txn.date) return false;
        if (Math.abs(Number(entry.amount || 0) - amount) >= 0.01) return false;
        const treatment = normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment);
        return treatment === "none" || treatment === "rent_income";
      });

      if (matchedManual) {
        actions.addOrUpdateTenantLedgerEntry({
          ...matchedManual,
          ...entryShape,
          createdAt: matchedManual.createdAt || new Date().toISOString(),
        });
        return;
      }

      actions.addOrUpdateTenantLedgerEntry({
        id: `tle-${automationKey}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120),
        ...entryShape,
        createdAt: new Date().toISOString(),
      });
    });
  }, [actions, isDataHydrated, leases, tenantLedgerEntries, transactions]);
}
