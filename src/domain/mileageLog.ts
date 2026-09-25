import type { Lease, MileageEntry, Transaction, Unit, UsePeriod } from "../models.ts";
import { getRentalUsePctForDate } from "./accounting.ts";
import { isValidIsoDate } from "./isoDate.ts";

export function mileageTripAmount(entry: MileageEntry) {
  return Math.round(Number(entry.miles) * Number(entry.rate) * 100) / 100;
}

export function validateMileageEntry(entry: MileageEntry) {
  return isValidIsoDate(entry.date)
    && Boolean(entry.propertyId && entry.purpose.trim() && entry.destination.trim())
    && Number.isFinite(entry.miles) && entry.miles > 0
    && Number.isFinite(entry.rate) && entry.rate > 0;
}

export function postedMileageEntryIds(transactions: Transaction[]) {
  return new Set(transactions
    .filter((transaction) => transaction.status === "active")
    .flatMap((transaction) => transaction.mileageEntryIds || []));
}

export function buildMileagePosting(entries: MileageEntry[], context: {
  transactions: Transaction[];
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
  todayIso: string;
}) {
  if (entries.length === 0 || entries.some((entry) => !validateMileageEntry(entry))) return null;
  const first = entries[0];
  const month = first.date.slice(0, 7);
  if (entries.some((entry) => entry.date.slice(0, 7) !== month || entry.propertyId !== first.propertyId || entry.unit !== first.unit)) return null;
  const postingDate = new Date(`${month}-01T00:00:00.000Z`);
  postingDate.setUTCMonth(postingDate.getUTCMonth() + 1, 0);
  const date = postingDate.toISOString().slice(0, 10);
  if (date >= context.todayIso) return null;
  const postedIds = postedMileageEntryIds(context.transactions);
  if (entries.some((entry) => postedIds.has(entry.id))) return null;
  const amount = Math.round(entries.reduce((sum, entry) => sum + mileageTripAmount(entry), 0) * 100) / 100;
  const deductibleAmount = Math.round(entries.reduce((sum, entry) => {
    const rentalUsePct = getRentalUsePctForDate({
      propertyId: entry.propertyId, unit: entry.unit, date: entry.date,
      usePeriods: context.usePeriods, leases: context.leases, units: context.units,
    });
    return sum + mileageTripAmount(entry) * rentalUsePct;
  }, 0) * 100) / 100;
  const rentalUsePct = amount > 0 ? deductibleAmount / amount : 0;
  return {
    date, propertyId: first.propertyId, unit: first.unit,
    type: "Expense" as const, category: "Auto and travel", description: `Mileage log: ${month}`,
    amount, deductibleAmount, rentalUsePct, ownerUsePct: 1 - rentalUsePct,
    paidFrom: "Mileage log", paymentMethod: "Mileage log", reimbursable: false, reimbursed: false,
    capitalImprovement: false, vendor: "", receiptName: "", notes: `${entries.length} recorded business trip${entries.length === 1 ? "" : "s"}.`,
    taxChecked: false, reconciled: false, status: "active" as const,
    mileageMiles: entries.reduce((sum, entry) => sum + entry.miles, 0),
    mileageEntryIds: entries.map((entry) => entry.id),
  };
}
