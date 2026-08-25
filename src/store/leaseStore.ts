import type { DocumentItem, Lease, TenantLedgerEntry, Unit, UsePeriod } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import {
  leaseBillingAmount,
  leaseBillingIntervalDays,
  leaseMonthlyEquivalent,
  normalizeLeaseAgreementType,
  normalizeLeaseBillingCadence,
  normalizeLeaseDurationType,
} from "../domain/leaseTerms.js";
import type { AppendActivityLog } from "./activityStore.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

function normalizeLeaseLateFeeType(value: unknown): "flat" | "percent" {
  return value === "percent" ? "percent" : "flat";
}

export function leaseIsEndedByDate(lease: Lease, asOfDate: string) {
  if (!asOfDate || lease.startDate > asOfDate) return false;
  if (lease.actualEndDate) return lease.actualEndDate < asOfDate;
  if (normalizeLeaseAgreementType(lease) !== "fixed_term") return false;
  return lease.endDate < asOfDate;
}

export function normalizeLease(lease: Lease): Lease {
  const monthlyRent = Number(lease.monthlyRent);
  const rentAmount = Number(lease.rentAmount);
  const securityDeposit = Number(lease.securityDeposit);
  const extensionTermMonths = Number(lease.extensionTermMonths);
  const rentDueDay = Number(lease.rentDueDay);
  const reminderDaysBefore = Number(lease.reminderDaysBefore);
  const lateFeeGraceDays = Number(lease.lateFeeGraceDays);
  const lateFeeValue = Number(lease.lateFeeValue);

  const baseLease = {
    ...lease,
    id: String(lease.id || `lease-${Date.now()}`),
    propertyId: String(lease.propertyId || "").trim(),
    unit: String(lease.unit || "Shared").trim() || "Shared",
    tenantName: String(lease.tenantName || "").trim(),
    startDate: String(lease.startDate || toLocalIsoDate()).slice(0, 10),
    endDate: String(lease.endDate || toLocalIsoDate()).slice(0, 10),
    actualEndDate: String(lease.actualEndDate || "").trim(),
    monthlyRent: Number.isFinite(monthlyRent) ? Math.max(0, monthlyRent) : 0,
    rentAmount: Number.isFinite(rentAmount) && rentAmount > 0
      ? rentAmount
      : Number.isFinite(monthlyRent) ? Math.max(0, monthlyRent) : 0,
    securityDeposit: Number.isFinite(securityDeposit) ? Math.max(0, securityDeposit) : 0,
    rentalType: normalizeLeaseDurationType(lease),
    agreementType: normalizeLeaseAgreementType(lease),
    billingCadence: normalizeLeaseBillingCadence(lease),
    billingIntervalDays: leaseBillingIntervalDays(lease),
    firstRentDueDate: String(lease.firstRentDueDate || lease.startDate || toLocalIsoDate()).slice(0, 10),
    prorationMethod: lease.prorationMethod === "none" ? "none" : "thirty_day",
    utilitiesIncluded: Boolean(lease.utilitiesIncluded),
    monthToMonthAfterTerm: normalizeLeaseAgreementType(lease) !== "fixed_term",
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
  return {
    ...baseLease,
    rentAmount: leaseBillingAmount(baseLease),
    monthlyRent: leaseMonthlyEquivalent(baseLease),
  } as Lease;
}

export function createLeaseActions({
  getLeases,
  getUsePeriods,
  setLeases,
  setDocuments,
  setTenantLedgerEntries,
  setUnits,
  appendActivityLog,
}: {
  getLeases: () => Lease[];
  getUsePeriods: () => UsePeriod[];
  setLeases: StateSetter<Lease>;
  setDocuments: StateSetter<DocumentItem>;
  setTenantLedgerEntries: StateSetter<TenantLedgerEntry>;
  setUnits: StateSetter<Unit>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    updateLease(lease: Lease) {
      const normalizedLease = normalizeLease(lease);
      const existsBefore = getLeases().some((existing) => existing.id === normalizedLease.id);
      setLeases((previous) => {
        const exists = previous.some((existing) => existing.id === normalizedLease.id);
        return exists
          ? previous.map((existing) => (existing.id === normalizedLease.id ? normalizedLease : existing))
          : [normalizedLease, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "lease",
        entityId: normalizedLease.id,
        propertyId: normalizedLease.propertyId,
        unit: normalizedLease.unit,
        summary: existsBefore ? "Lease updated." : "Lease created.",
        details: normalizedLease.tenantName,
      });
    },
    deleteLease(id: string) {
      const existingLease = getLeases().find((lease) => lease.id === id);
      setLeases((previous) => previous.filter((lease) => lease.id !== id));
      setDocuments((previous) => previous.filter((document) => document.leaseId !== id));
      setTenantLedgerEntries((previous) => previous.filter((entry) => entry.leaseId !== id));
      appendActivityLog({
        action: "delete",
        entityType: "lease",
        entityId: id,
        propertyId: existingLease?.propertyId,
        unit: existingLease?.unit,
        summary: "Lease deleted.",
        details: existingLease?.tenantName,
      });
    },
    syncLeaseStatuses(asOfDate: string) {
      const leases = getLeases();
      setLeases((previous) => {
        let changed = false;
        const next = previous.map((lease) => {
          const shouldEnd = leaseIsEndedByDate(lease, asOfDate);
          if (shouldEnd && lease.status !== "Ended") {
            changed = true;
            return { ...lease, status: "Ended" as const };
          }
          if (!shouldEnd && lease.status === "Ended" && lease.startDate <= asOfDate) {
            changed = true;
            return { ...lease, status: "Active" as const };
          }
          return lease;
        });
        return changed ? next : previous;
      });

      const activeLeaseKeys = new Set(
        leases
          .filter((lease) => !leaseIsEndedByDate(lease, asOfDate) && lease.startDate <= asOfDate)
          .map((lease) => `${lease.propertyId}:${lease.unit}`),
      );
      const ownerOccupiedKeys = new Set(
        getUsePeriods()
          .filter((period) => period.useType === "Owner-Occupied"
            && period.startDate <= asOfDate
            && (!period.endDate || period.endDate >= asOfDate))
          .map((period) => `${period.propertyId}:${period.unit}`),
      );
      setUnits((previous) => {
        let changed = false;
        const next = previous.map((unit) => {
          const unitKey = `${unit.propertyId}:${unit.name}`;
          const status: Unit["status"] = activeLeaseKeys.has(unitKey)
            ? "Rental"
            : ownerOccupiedKeys.has(unitKey)
              ? "Owner-Occupied"
              : "Vacant";
          if (unit.status === status) return unit;
          changed = true;
          return { ...unit, status };
        });
        return changed ? next : previous;
      });
    },
  };
}
