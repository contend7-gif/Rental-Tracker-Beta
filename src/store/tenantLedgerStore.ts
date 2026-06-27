import { normalizeTenantLedgerAccountingTreatment } from "../domain/tenantLedgerPosting.ts";
import type { TenantLedgerEntry } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import { normalizeStringArray } from "./storeUtils.ts";

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
