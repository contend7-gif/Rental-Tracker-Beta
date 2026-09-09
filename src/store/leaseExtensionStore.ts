import type { DocumentItem, Lease, TenantLedgerEntry, Transaction } from "../models.ts";
import { normalizeDocument } from "./documentStore.ts";
import { normalizeLease } from "./leaseStore.ts";
import { normalizeTenantLedgerEntry } from "./tenantLedgerStore.ts";
import { normalizeTransaction } from "./transactionStore.ts";
import { previewLeaseExtension, type LeaseExtensionDraft } from "../domain/leaseExtensionWorkflow.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

export function createLeaseExtensionActions({
  getLeases,
  getLedgerEntries,
  getTransactions,
  getDocuments,
  setLeases,
  setLedgerEntries,
  setTransactions,
  setDocuments,
  appendActivityLog,
}: {
  getLeases: () => Lease[];
  getLedgerEntries: () => TenantLedgerEntry[];
  getTransactions: () => Transaction[];
  getDocuments: () => DocumentItem[];
  setLeases: StateSetter<Lease>;
  setLedgerEntries: StateSetter<TenantLedgerEntry>;
  setTransactions: StateSetter<Transaction>;
  setDocuments: StateSetter<DocumentItem>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    previewLeaseExtension(leaseId: string, draft: LeaseExtensionDraft) {
      const lease = getLeases().find((item) => item.id === leaseId);
      if (!lease) return { ok: false, message: "Lease was not found." };
      return previewLeaseExtension({ lease, draft, existingLedgerEntries: getLedgerEntries(), existingTransactions: getTransactions(), otherLeases: getLeases() });
    },
    applyLeaseExtension(leaseId: string, draft: LeaseExtensionDraft, document?: DocumentItem) {
      const leasesBefore = getLeases();
      const ledgerBefore = getLedgerEntries();
      const transactionsBefore = getTransactions();
      const documentsBefore = getDocuments();
      const lease = leasesBefore.find((item) => item.id === leaseId);
      if (!lease) return { ok: false, message: "Lease was not found." };
      const preview = previewLeaseExtension({ lease, draft, existingLedgerEntries: ledgerBefore, existingTransactions: transactionsBefore, otherLeases: leasesBefore });
      if (!preview.ok || !preview.extension || !preview.charge) return preview;

      const extension = document
        ? { ...preview.extension, documentIds: [...new Set([...(preview.extension.documentIds || []), document.id])] }
        : preview.extension;
      const charge = preview.charge;
      const previousExtension = lease.extensions?.find((item) => item.id === extension.id);
      const revisions = lease.extensionRevisions || [];
      const sameRevision = previousExtension && JSON.stringify({ ...previousExtension, updatedAt: "" }) === JSON.stringify({ ...extension, updatedAt: "" });
      const priorExtensions = (lease.extensions || []).filter((item) => item.id !== extension.id);
      const originalTerm = lease.originalTerm || {
        startDate: lease.startDate,
        endDate: draft.originalEndDate || lease.endDate,
        actualEndDate: lease.actualEndDate || undefined,
        rentAmount: Number(lease.rentAmount || lease.monthlyRent || 0),
        billingCadence: lease.billingCadence,
        recordedAt: new Date().toISOString(),
      };
      const nextLease = normalizeLease({
        ...lease,
        originalTerm,
        endDate: [...priorExtensions.filter((item) => !item.canceledAt).map((item) => item.endDate), extension.endDate, originalTerm.endDate].sort().at(-1)!,
        actualEndDate: lease.actualEndDate || "",
        extensions: [...priorExtensions, extension],
        extensionRevisions: previousExtension && !sameRevision ? [...revisions, {
          extension: previousExtension,
          ledgerEntries: ledgerBefore.filter((item) => item.leaseExtensionId === extension.id),
          transactions: transactionsBefore.filter((item) => item.rentLeaseExtensionId === extension.id),
          recordedAt: new Date().toISOString(),
        }] : revisions,
      });
      const nowIso = new Date().toISOString();
      const nextLedger = ledgerBefore
        .filter((entry) => entry.id !== charge.id && entry.id !== extension.paymentEntryId)
        .map((entry) => entry.leaseExtensionId === extension.id && entry.kind === "payment" && !preview.payment ? { ...entry, voidedAt: nowIso } : entry)
        .concat(normalizeTenantLedgerEntry(charge))
        .concat(preview.payment ? normalizeTenantLedgerEntry(preview.payment) : []);


      const nextTransactions = transactionsBefore
        .filter((transaction) => transaction.id !== preview.paymentTransaction?.id)
        .map((transaction) => transaction.rentLeaseExtensionId === extension.id && !preview.paymentTransaction ? { ...transaction, status: "voided" as const } : transaction)
        .concat(preview.paymentTransaction ? normalizeTransaction(preview.paymentTransaction) : []);

      const nextDocuments = document
        ? documentsBefore.filter((item) => item.id !== document.id).concat(normalizeDocument({ ...document, leaseId, leaseExtensionId: extension.id, propertyId: lease.propertyId, unit: lease.unit }))
        : documentsBefore;

      try {
        setLeases(nextLeases => nextLeases.map((item) => item.id === lease.id ? nextLease : item));
        setLedgerEntries(nextLedger);
        setTransactions(nextTransactions);
        setDocuments(nextDocuments);
      } catch (error) {
        setLeases(leasesBefore);
        setLedgerEntries(ledgerBefore);
        setTransactions(transactionsBefore);
        setDocuments(documentsBefore);
        return { ok: false, message: error instanceof Error ? error.message : "Extension could not be saved; no changes were kept." };
      }
      appendActivityLog({
        action: draft.id ? "update" : "create",
        entityType: "lease-extension",
        entityId: extension.id,
        propertyId: lease.propertyId,
        unit: lease.unit,
        summary: draft.id ? "Lease extension updated." : "Lease extension recorded.",
        details: `${extension.startDate} to ${extension.endDate}; ${extension.paymentStatus}`,
      });
      return { ok: true, extension, preview, lease: nextLease };
    },
    cancelLeaseExtension(leaseId: string, extensionId: string) {
      const lease = getLeases().find((item) => item.id === leaseId);
      const extension = lease?.extensions?.find((item) => item.id === extensionId);
      if (!lease || !extension) return { ok: false, message: "Extension was not found." };
      if (extension.canceledAt) return { ok: true, lease };
      if (lease.extensions?.some((item) => !item.canceledAt && item.startDate >= extension.endDate && item.id !== extensionId)) return { ok: false, message: "Cancel the latest extension first so the agreement keeps continuous coverage." };
      const canceledAt = new Date().toISOString();
      const nextExtensions = (lease.extensions || []).map((item) => item.id === extensionId ? { ...item, canceledAt, updatedAt: canceledAt } : item);
      const nextEndDate = nextExtensions.filter((item) => !item.canceledAt).map((item) => item.endDate).concat([lease.originalTerm?.endDate || lease.endDate]).sort((a, b) => b.localeCompare(a))[0];
      const nextLease = normalizeLease({ ...lease, extensions: nextExtensions, endDate: nextEndDate });
      setLeases((previous) => previous.map((item) => item.id === leaseId ? nextLease : item));
      setLedgerEntries((previous) => previous.map((entry) => entry.leaseExtensionId === extensionId && entry.kind === "charge" ? { ...entry, voidedAt: canceledAt } : entry));
      // Cancellation reverses the rent obligation; actual cash received remains a tenant credit until refunded.
      appendActivityLog({ action: "update", entityType: "lease-extension", entityId: extensionId, propertyId: lease.propertyId, unit: lease.unit, summary: "Lease extension canceled.", details: `${extension.startDate} to ${extension.endDate}` });
      return { ok: true, lease: nextLease };
    },
  };
}
