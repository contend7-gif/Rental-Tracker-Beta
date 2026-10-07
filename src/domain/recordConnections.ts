import type { DocumentItem, Lease, TenantLedgerEntry } from "../models.ts";

export function leasesForTransaction(transactionId: string, entries: TenantLedgerEntry[], leases: Lease[]) {
  if (!transactionId) return [];
  const leaseIds = new Set(entries.filter((entry) => !entry.voidedAt && entry.transactionId === transactionId).map((entry) => entry.leaseId));
  return leases.filter((lease) => leaseIds.has(lease.id));
}

export function documentsForLease(leaseId: string, entries: TenantLedgerEntry[], documents: DocumentItem[]) {
  if (!leaseId) return [];
  const relatedEntries = entries.filter((entry) => entry.leaseId === leaseId && !entry.voidedAt);
  const transactionIds = new Set(relatedEntries.map((entry) => entry.transactionId).filter(Boolean));
  const documentIds = new Set(relatedEntries.flatMap((entry) => entry.linkedDocumentIds || []));
  return documents.filter((document) => document.leaseId === leaseId || (!document.leaseId && (
    Boolean(document.transactionId && transactionIds.has(document.transactionId)) || documentIds.has(document.id)
  )));
}
