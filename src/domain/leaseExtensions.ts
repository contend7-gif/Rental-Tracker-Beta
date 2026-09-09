import type { Lease, LeaseExtension, LeaseExtensionPaymentStatus } from "../models.ts";

function cleanDate(value: unknown) {
  return String(value || "").trim().slice(0, 10);
}

function roundMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(Math.max(0, parsed) * 100) / 100 : 0;
}

function normalizeStatus(value: unknown, rentAmount: number, amountPaid: number): LeaseExtensionPaymentStatus {
  if (amountPaid >= rentAmount && rentAmount > 0) return "paid";
  if (amountPaid > 0) return "partially_paid";
  return "unpaid";
}

export function normalizeLeaseExtension(extension: LeaseExtension): LeaseExtension {
  const rentAmount = roundMoney(extension.rentAmount);
  const amountPaid = Math.min(rentAmount, roundMoney(extension.amountPaid));
  const documentIds = Array.isArray(extension.documentIds)
    ? [...new Set(extension.documentIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  return {
    ...extension,
    id: String(extension.id || `lease-extension-${Date.now()}`).trim(),
    startDate: cleanDate(extension.startDate),
    endDate: cleanDate(extension.endDate),
    endTime: String(extension.endTime || "").trim() || undefined,
    rentAmount,
    amountPaid,
    paymentStatus: normalizeStatus(extension.paymentStatus, rentAmount, amountPaid),
    paymentReceivedDate: cleanDate(extension.paymentReceivedDate) || undefined,
    signedDate: cleanDate(extension.signedDate) || undefined,
    documentIds: documentIds.length ? documentIds : undefined,
    chargeEntryId: String(extension.chargeEntryId || "").trim() || undefined,
    paymentEntryId: String(extension.paymentEntryId || "").trim() || undefined,
    chargeTransactionId: String(extension.chargeTransactionId || "").trim() || undefined,
    paymentTransactionId: String(extension.paymentTransactionId || "").trim() || undefined,
    canceledAt: cleanDate(extension.canceledAt) || undefined,
    correctionOfExtensionId: String(extension.correctionOfExtensionId || "").trim() || undefined,
    notes: String(extension.notes || "").trim() || undefined,
    createdAt: String(extension.createdAt || new Date().toISOString()),
    updatedAt: String(extension.updatedAt || extension.createdAt || new Date().toISOString()),
  };
}

export function normalizeLeaseExtensions(value: unknown): LeaseExtension[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is LeaseExtension => Boolean(item) && typeof item === "object")
    .map((item) => normalizeLeaseExtension(item));
}

export function leaseExtensionDurationDays(extension: Pick<LeaseExtension, "startDate" | "endDate">) {
  const start = new Date(`${extension.startDate}T00:00:00.000Z`);
  const end = new Date(`${extension.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

export function activeLeaseExtensions(lease: Pick<Lease, "extensions">) {
  return normalizeLeaseExtensions(lease.extensions).filter((extension) => !extension.canceledAt);
}

export function leaseExtensionRentTotal(lease: Pick<Lease, "extensions">) {
  return Math.round(activeLeaseExtensions(lease).reduce((sum, extension) => sum + extension.rentAmount, 0) * 100) / 100;
}

export function leaseCombinedRentTotal(lease: Pick<Lease, "rentAmount" | "monthlyRent" | "extensions">) {
  const base = Number(lease.rentAmount || lease.monthlyRent || 0);
  return Math.round((Math.max(0, Number.isFinite(base) ? base : 0) + leaseExtensionRentTotal(lease)) * 100) / 100;
}

export function leaseExtensionCoverageLabel(extension: Pick<LeaseExtension, "startDate" | "endDate" | "endTime">) {
  const departure = extension.endTime ? `${extension.endDate} at ${extension.endTime}` : extension.endDate;
  return `${extension.startDate} to ${departure} (${leaseExtensionDurationDays(extension)} days)`;
}
