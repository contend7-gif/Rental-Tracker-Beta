import type { Lease } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";

function normalizeLeaseLateFeeType(value: unknown): "flat" | "percent" {
  return value === "percent" ? "percent" : "flat";
}

export function leaseIsEndedByDate(lease: Lease, asOfDate: string) {
  if (!asOfDate || lease.startDate > asOfDate) return false;
  if (lease.actualEndDate) return lease.actualEndDate < asOfDate;
  if (lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm) return false;
  return lease.endDate < asOfDate;
}

export function normalizeLease(lease: Lease): Lease {
  const monthlyRent = Number(lease.monthlyRent);
  const securityDeposit = Number(lease.securityDeposit);
  const extensionTermMonths = Number(lease.extensionTermMonths);
  const rentDueDay = Number(lease.rentDueDay);
  const reminderDaysBefore = Number(lease.reminderDaysBefore);
  const lateFeeGraceDays = Number(lease.lateFeeGraceDays);
  const lateFeeValue = Number(lease.lateFeeValue);

  return {
    ...lease,
    id: String(lease.id || `lease-${Date.now()}`),
    propertyId: String(lease.propertyId || "").trim(),
    unit: String(lease.unit || "Shared").trim() || "Shared",
    tenantName: String(lease.tenantName || "").trim(),
    startDate: String(lease.startDate || toLocalIsoDate()).slice(0, 10),
    endDate: String(lease.endDate || toLocalIsoDate()).slice(0, 10),
    actualEndDate: String(lease.actualEndDate || "").trim(),
    monthlyRent: Number.isFinite(monthlyRent) ? Math.max(0, monthlyRent) : 0,
    securityDeposit: Number.isFinite(securityDeposit) ? Math.max(0, securityDeposit) : 0,
    rentalType: lease.rentalType || "Long-term",
    utilitiesIncluded: Boolean(lease.utilitiesIncluded),
    monthToMonthAfterTerm: lease.monthToMonthAfterTerm !== false,
    extensionTermMonths: Number.isFinite(extensionTermMonths) ? Math.max(0, Math.round(extensionTermMonths)) : 0,
    status: lease.status || "Active",
    notes: String(lease.notes || "").trim(),
    rentDueDay: Number.isFinite(rentDueDay) ? Math.max(1, Math.min(28, Math.round(rentDueDay))) : 1,
    reminderDaysBefore: Number.isFinite(reminderDaysBefore) ? Math.max(0, Math.min(14, Math.round(reminderDaysBefore))) : 3,
    lateFeeGraceDays: Number.isFinite(lateFeeGraceDays) ? Math.max(0, Math.min(30, Math.round(lateFeeGraceDays))) : 5,
    lateFeeType: normalizeLeaseLateFeeType(lease.lateFeeType),
    lateFeeValue: Number.isFinite(lateFeeValue) ? Math.max(0, lateFeeValue) : 50,
    autoLateFeeEnabled: lease.autoLateFeeEnabled === true,
  };
}
