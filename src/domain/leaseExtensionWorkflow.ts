import type { Lease, LeaseExtension, TenantLedgerEntry, Transaction } from "../models.ts";
import { normalizeLeaseExtension, normalizeLeaseExtensions } from "./leaseExtensions.ts";

export type LeaseExtensionDraft = {
  id?: string;
  startDate: string;
  endDate: string;
  endTime?: string;
  rentAmount: number | string;
  amountPaid: number | string;
  paymentReceivedDate?: string;
  signedDate?: string;
  notes?: string;
  correctionOfExtensionId?: string;
  originalEndDate?: string;
  reuseExistingEntries?: boolean;
};

export type LeaseExtensionPreview = {
  ok: boolean;
  message?: string;
  extension?: LeaseExtension;
  charge?: TenantLedgerEntry;
  payment?: TenantLedgerEntry;
  paymentTransaction?: Transaction;
  previousEndDate?: string;
  combinedRent?: number;
  existingEntryNotice?: string;
};

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(Math.max(0, parsed) * 100) / 100 : 0;
}

function date(value: unknown) {
  return String(value || "").trim().slice(0, 10);
}

function dateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function leaseExtensionPreviousEndDate(lease: Pick<Lease, "endDate" | "extensions">) {
  return normalizeLeaseExtensions(lease.extensions)
    .filter((extension) => !extension.canceledAt)
    .map((extension) => extension.endDate)
    .concat([lease.endDate])
    .sort((left, right) => right.localeCompare(left))[0] || lease.endDate;
}

export function previewLeaseExtension(args: {
  lease: Lease;
  draft: LeaseExtensionDraft;
  existingLedgerEntries?: TenantLedgerEntry[];
  existingTransactions?: Transaction[];
  otherLeases?: Lease[];
  nowIso?: string;
}): LeaseExtensionPreview {
  const lease = args.lease;
  const startDate = date(args.draft.startDate);
  const endDate = date(args.draft.endDate);
  const endTime = String(args.draft.endTime || "").trim();
  const rentAmount = money(args.draft.rentAmount);
  const amountPaid = money(args.draft.amountPaid);
  const originalEndDate = lease.originalTerm?.endDate || date(args.draft.originalEndDate) || lease.endDate;
  const previousEndDate = leaseExtensionPreviousEndDate(lease);
  const existingExtensions = normalizeLeaseExtensions(lease.extensions);
  const extensionId = String(args.draft.id || `lease-extension-${lease.id}-${startDate}-${endDate}`).trim();
  const editing = existingExtensions.find((extension) => extension.id === extensionId);
  const paymentReceivedDate = date(args.draft.paymentReceivedDate);
  const chargeMatches = args.existingLedgerEntries?.filter((entry) => entry.leaseId === lease.id && !entry.leaseExtensionId && !entry.voidedAt && entry.kind === "charge" && entry.date === startDate && Math.abs(Number(entry.amount || 0) - rentAmount) < 0.01);
  const paymentMatches = amountPaid > 0
    ? args.existingLedgerEntries?.filter((entry) => entry.leaseId === lease.id && !entry.leaseExtensionId && !entry.voidedAt && entry.kind === "payment" && entry.date === paymentReceivedDate && Math.abs(Number(entry.amount || 0) - amountPaid) < 0.01)
    : [];
  if ((chargeMatches?.length || 0) > 1 || (paymentMatches?.length || 0) > 1) return { ok: false, message: "Multiple matching entries exist. Review those entries before recording the extension." };
  const existingCharge = chargeMatches?.[0];
  const existingPayment = paymentMatches?.[0];
  const existingEntryNotice = [existingCharge && `Charge ${existingCharge.id}: ${existingCharge.memo}`, existingPayment && `Payment ${existingPayment.id}: ${existingPayment.memo}`].filter(Boolean).join("; ");
  if (existingEntryNotice && !args.draft.reuseExistingEntries) return { ok: false, message: "Matching entries already exist. Confirm that they belong to this extension before saving.", existingEntryNotice };
  if (lease.billingCadence !== "full_term" || lease.agreementType !== "fixed_term") return { ok: false, message: "Guided extensions currently support fixed-term leases billed as one full-term amount. Monthly and recurring leases keep their existing billing workflow." };
  if (editing?.canceledAt) return { ok: false, message: "A canceled extension cannot be edited. Create a new extension instead." };
  if (!dateValid(originalEndDate) || originalEndDate < lease.startDate || originalEndDate > lease.endDate) return { ok: false, message: "Enter the original agreement end date, within the recorded lease dates." };
  if (![args.draft.rentAmount, args.draft.amountPaid].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) return { ok: false, message: "Rent and payments must be valid, non-negative amounts." };

  if (!dateValid(startDate) || !dateValid(endDate)) return { ok: false, message: "Enter valid extension start and end dates." };
  if (endTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return { ok: false, message: "Enter a valid departure time or leave it blank." };
  const precedingEnd = existingExtensions.filter((item) => !item.canceledAt && item.id !== extensionId && item.startDate < startDate).map((item) => item.endDate).concat(originalEndDate).sort().at(-1)!;
  if (startDate !== precedingEnd) return { ok: false, message: `Extension must start at the preceding agreement boundary (${precedingEnd}).` };
  if (endDate <= startDate) return { ok: false, message: "Extension end date must be after its start date." };
  if (lease.actualEndDate && lease.actualEndDate < endDate) return { ok: false, message: "The recorded actual move-out is before this extension ends. Correct the move-out record before extending the lease." };
  if (rentAmount <= 0) return { ok: false, message: "Additional extension rent must be greater than 0." };
  if (amountPaid > rentAmount) return { ok: false, message: "Amount paid cannot exceed the extension rent." };
  if (amountPaid > 0 && !dateValid(paymentReceivedDate)) {
    return { ok: false, message: "Enter the actual payment-received date when any payment has been received." };
  }
  if (args.draft.signedDate && !dateValid(date(args.draft.signedDate))) return { ok: false, message: "Enter a valid signed date." };
  const nextExtension = existingExtensions.filter((item) => !item.canceledAt && item.id !== extensionId && item.startDate > startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (nextExtension && endDate !== nextExtension.startDate) return { ok: false, message: "This correction must keep the boundary with the following extension." };
  if (args.otherLeases?.some((other) => other.id !== lease.id && other.propertyId === lease.propertyId && other.unit === lease.unit && other.startDate <= endDate && (other.actualEndDate || (other.agreementType === "fixed_term" ? other.endDate : "9999-12-31")) >= startDate)) return { ok: false, message: "This extension overlaps another tenant on this unit. Review the occupancy dates first." };
  const overlap = existingExtensions.some((extension) => {
    if (extension.id === extensionId || extension.canceledAt) return false;
    return startDate < extension.endDate && extension.startDate < endDate;
  });
  if (overlap) return { ok: false, message: "This extension overlaps another active extension." };

  const nowIso = args.nowIso || new Date().toISOString();
  const extension = normalizeLeaseExtension({
    ...(editing || {}),
    id: extensionId,
    startDate,
    endDate,
    endTime: endTime || undefined,
    rentAmount,
    amountPaid,
    paymentStatus: amountPaid >= rentAmount ? "paid" : amountPaid > 0 ? "partially_paid" : "unpaid",
    paymentReceivedDate: amountPaid > 0 ? paymentReceivedDate : undefined,
    signedDate: date(args.draft.signedDate) || undefined,
    notes: String(args.draft.notes || "").trim() || undefined,
    correctionOfExtensionId: args.draft.correctionOfExtensionId || editing?.correctionOfExtensionId,
    createdAt: editing?.createdAt || nowIso,
    updatedAt: nowIso,
  });
  const chargeEntryId = extension.chargeEntryId || existingCharge?.id || `tle-extension-charge-${extension.id}`;
  const recordingAnotherReceipt = Boolean(editing && editing.amountPaid > 0 && amountPaid > editing.amountPaid && paymentReceivedDate !== editing.paymentReceivedDate);
  const paymentEntryId = recordingAnotherReceipt ? `tle-extension-payment-${extension.id}-${paymentReceivedDate}` : extension.paymentEntryId || existingPayment?.id || `tle-extension-payment-${extension.id}`;
  const linkedExistingPaymentTransaction = existingPayment?.transactionId || (existingPayment ? args.existingTransactions?.find((transaction) => transaction.tenantLedgerEntryId === existingPayment.id)?.id : undefined);
  const paymentTransactionId = recordingAnotherReceipt ? `t-extension-payment-${extension.id}-${paymentReceivedDate}` : extension.paymentTransactionId || linkedExistingPaymentTransaction || `t-extension-payment-${extension.id}`;
  const previousReceipts = (args.existingLedgerEntries || []).filter((entry) => entry.leaseExtensionId === extension.id && entry.kind === "payment" && !entry.voidedAt && entry.id !== paymentEntryId);
  const previousReceiptTotal = previousReceipts.reduce((sum, entry) => sum + entry.amount, 0);
  const receiptAmount = money(amountPaid - previousReceiptTotal);
  if (amountPaid > 0 && amountPaid <= previousReceiptTotal) return { ok: false, message: "This correction would erase an earlier receipt. Correct the latest receipt or review the recorded payment history first." };
  extension.chargeEntryId = chargeEntryId;
  extension.paymentEntryId = amountPaid > 0 ? paymentEntryId : undefined;
  extension.paymentTransactionId = amountPaid > 0 ? paymentTransactionId : undefined;

  const priorCharge = args.existingLedgerEntries?.find((entry) => entry.id === chargeEntryId);
  const priorPayment = args.existingLedgerEntries?.find((entry) => entry.id === paymentEntryId);
  const priorTransaction = args.existingTransactions?.find((transaction) => transaction.id === paymentTransactionId);
  if (priorTransaction?.reconciled && (priorTransaction.amount !== receiptAmount || priorTransaction.date !== paymentReceivedDate)) return { ok: false, message: "Reopen the linked bank reconciliation before correcting this payment." };
  const charge: TenantLedgerEntry = {
    ...priorCharge,
    id: chargeEntryId,
    leaseId: lease.id,
    leaseExtensionId: extension.id,
    date: startDate,
    kind: "charge",
    amount: rentAmount,
    memo: `Lease extension rent (${startDate} to ${endDate})`,
    accountingTreatment: "none",
    coverageStartDate: startDate,
    coverageEndDate: endDate,
    createdAt: priorCharge?.createdAt || nowIso,
  };
  const payment = amountPaid > 0 ? {
    ...priorPayment,
    automationKey: undefined,
    voidedAt: undefined,
    id: paymentEntryId,
    leaseId: lease.id,
    leaseExtensionId: extension.id,
    date: paymentReceivedDate,
    kind: "payment" as const,
    amount: receiptAmount,
    memo: `Lease extension payment (${startDate} to ${endDate})`,
    accountingTreatment: "rent_income" as const,
    coverageStartDate: startDate,
    coverageEndDate: endDate,
    paymentReceivedDate,
    transactionId: paymentTransactionId,
    createdAt: priorPayment?.createdAt || nowIso,
  } : undefined;
  const paymentTransaction = payment ? {
    propertyId: lease.propertyId,
    unit: lease.unit,
    type: "Income" as const,
    category: "Rents received",
    description: `Lease extension payment - ${lease.tenantName || lease.unit}`,
    ownerUsePct: 0,
    rentalUsePct: 1,
    deductibleAmount: 0,
    paidFrom: "Tenant",
    paymentMethod: "Other",
    reimbursable: false,
    reimbursed: false,
    capitalImprovement: false,
    vendor: lease.tenantName || "Tenant",
    receiptName: "",
    notes: `Linked lease extension ${extension.id}.`,
    taxChecked: false,
    reconciled: args.existingTransactions?.find((transaction) => transaction.id === paymentTransactionId)?.reconciled === true,
    invoiceAmount: receiptAmount,
    ...priorTransaction,
    id: paymentTransactionId,
    amount: receiptAmount,
    date: paymentReceivedDate,
    rentLeaseId: lease.id,
    rentLeaseExtensionId: extension.id,
    tenantLedgerEntryId: paymentEntryId,
    status: "active" as const,
  } : undefined;

  return {
    ok: true,
    extension,
    charge,
    payment,
    paymentTransaction,
    previousEndDate,
    existingEntryNotice,
    combinedRent: Math.round((Number(lease.rentAmount || lease.monthlyRent || 0) + existingExtensions.filter((item) => item.id !== extension.id && !item.canceledAt).reduce((sum, item) => sum + item.rentAmount, 0) + rentAmount) * 100) / 100,
  };
}
