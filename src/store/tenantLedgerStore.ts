import { normalizeTenantLedgerAccountingTreatment } from "../domain/tenantLedgerPosting.ts";
import type { Lease, TenantLedgerEntry } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { normalizeStringArray } from "./storeUtils.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

const TENANT_LEDGER_ENTRY_KINDS = ["charge", "payment", "credit", "refund", "adjustment"] as const;

type TenantLedgerEntryKind = (typeof TENANT_LEDGER_ENTRY_KINDS)[number];

function normalizeTenantLedgerEntryKind(kind: unknown): TenantLedgerEntryKind {
  const value = String(kind || "").trim();
  return TENANT_LEDGER_ENTRY_KINDS.includes(value as TenantLedgerEntryKind)
    ? (value as TenantLedgerEntryKind)
    : "charge";
}

export function normalizeTenantLedgerEntry(entry: TenantLedgerEntry): TenantLedgerEntry {
  const normalizedKind = normalizeTenantLedgerEntryKind(entry.kind);
  const rawAmount = Number(entry.amount);
  const amount =
    normalizedKind === "adjustment"
      ? (Number.isFinite(rawAmount) ? rawAmount : 0)
      : Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0);
  const transactionId = String(entry.transactionId || "").trim();
  const linkedWorkOrderId = String(entry.linkedWorkOrderId || "").trim();
  const automationKey = String(entry.automationKey || "").trim();

  return {
    ...entry,
    id: String(entry.id || `tle-${Date.now()}`),
    leaseId: String(entry.leaseId || "").trim(),
    date: String(entry.date || toLocalIsoDate()).slice(0, 10),
    kind: normalizedKind,
    amount,
    memo: String(entry.memo || "").trim(),
    accountingTreatment: normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment),
    transactionId: transactionId || undefined,
    reviewed: Boolean(entry.reviewed),
    reviewedAt: String(entry.reviewedAt || "").trim(),
    reviewNotes: String(entry.reviewNotes || "").trim(),
    linkedWorkOrderId: linkedWorkOrderId || undefined,
    linkedDocumentIds: normalizeStringArray(entry.linkedDocumentIds),
    automationKey: automationKey || undefined,
    createdAt: String(entry.createdAt || new Date().toISOString()),
  };
}

export function createTenantLedgerActions({
  getEntries,
  getLeases,
  setEntries,
  appendActivityLog,
}: {
  getEntries: () => TenantLedgerEntry[];
  getLeases: () => Lease[];
  setEntries: StateSetter<TenantLedgerEntry>;
  appendActivityLog: AppendActivityLog;
}) {
  const linkedLeaseFor = (entry?: TenantLedgerEntry) => getLeases().find((lease) => lease.id === entry?.leaseId);
  return {
    addOrUpdateTenantLedgerEntry(entry: TenantLedgerEntry) {
      const normalized = normalizeTenantLedgerEntry(entry);
      if (!normalized.leaseId) return;
      const existsBefore = getEntries().some((item) => item.id === normalized.id);
      const linkedLease = linkedLeaseFor(normalized);
      setEntries((previous) => {
        const exists = previous.some((item) => item.id === normalized.id);
        return exists
          ? previous.map((item) => item.id === normalized.id ? normalized : item)
          : [normalized, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "tenant-ledger",
        entityId: normalized.id,
        propertyId: linkedLease?.propertyId,
        unit: linkedLease?.unit,
        summary: existsBefore ? "Tenant ledger entry updated." : "Tenant ledger entry created.",
        details: normalized.memo,
      });
    },
    deleteTenantLedgerEntry(id: string) {
      const existingEntry = getEntries().find((entry) => entry.id === id);
      const linkedLease = linkedLeaseFor(existingEntry);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      appendActivityLog({
        action: "delete",
        entityType: "tenant-ledger",
        entityId: id,
        propertyId: linkedLease?.propertyId,
        unit: linkedLease?.unit,
        summary: "Tenant ledger entry deleted.",
        details: existingEntry?.memo,
      });
    },
    updateTenantLedgerEntryReview(id: string, patch: Partial<Pick<TenantLedgerEntry, "reviewed" | "reviewedAt" | "reviewNotes" | "linkedWorkOrderId" | "linkedDocumentIds">>) {
      const existingEntry = getEntries().find((entry) => entry.id === id);
      const linkedLease = linkedLeaseFor(existingEntry);
      const reviewed = patch.reviewed ?? existingEntry?.reviewed ?? false;
      setEntries((previous) => previous.map((entry) => entry.id === id
        ? normalizeTenantLedgerEntry({
            ...entry,
            reviewed,
            reviewedAt: patch.reviewedAt ?? (reviewed ? (entry.reviewedAt || new Date().toISOString()) : ""),
            reviewNotes: patch.reviewNotes ?? entry.reviewNotes,
            linkedWorkOrderId: patch.linkedWorkOrderId ?? entry.linkedWorkOrderId,
            linkedDocumentIds: patch.linkedDocumentIds ?? entry.linkedDocumentIds,
          })
        : entry));
      if (!existingEntry) return;
      appendActivityLog({
        action: "review",
        entityType: "tenant-ledger",
        entityId: id,
        propertyId: linkedLease?.propertyId,
        unit: linkedLease?.unit,
        summary: reviewed ? "Tenant ledger entry reviewed." : "Tenant ledger entry review reopened.",
        details: existingEntry.memo,
      });
    },
  };
}
