import type { Lease, UsePeriod, Property, Loan, Transaction } from "../../models.ts";
import { leaseIsOpenEnded } from "../leaseTerms.js";
import { leaseMonthlyEquivalent } from "../leaseTerms.js";

export function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function csvCell(value: string | number) {
  const asText = String(value ?? "");
  if (/[,"\n]/.test(asText)) {
    return `"${asText.replace(/"/g, '""')}"`;
  }
  return asText;
}

export function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function firstDayOfNextMonth(dateText: string) {
  const [year, month] = String(dateText || "").slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

export function isoDateFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthMidpointIso(date: Date) {
  return isoDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, 15);
}

export function addYears(dateText: string, years: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

export function addDays(dateText: string, offset: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function monthDifference(startDateText: string, endDateText: string) {
  const [startYear, startMonth, startDay] = String(startDateText || "").split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endDateText || "").split("-").map(Number);
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return 0;
  let months = ((endYear - startYear) * 12) + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  return months;
}

export function dayDifference(startDateText: string, endDateText: string) {
  const start = new Date(`${String(startDateText || "").slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(endDateText || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function addMonths(dateText: string, offset: number) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

export function amortizedPayment(balance: number, annualRatePct: number, termYears: number) {
  const principal = Math.max(0, Number(balance || 0));
  const years = Math.max(1, Number(termYears || 0));
  const monthlyRate = Math.max(0, Number(annualRatePct || 0)) / 100 / 12;
  const totalPayments = Math.max(1, Math.round(years * 12));
  if (!principal) return 0;
  if (!monthlyRate) return principal / totalPayments;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalPayments));
}

export function leaseIsActiveByDate(lease: Lease, dateText: string) {
  if (!dateText) return false;
  if (lease.startDate > dateText) return false;
  if (lease.actualEndDate) return lease.actualEndDate >= dateText;
  if (leaseIsOpenEnded(lease)) return true;
  return lease.endDate >= dateText;
}

export function usePeriodIsActiveByDate(period: UsePeriod, dateText: string) {
  if (!dateText) return false;
  if (period.startDate > dateText) return false;
  if (!period.endDate) return true;
  return period.endDate >= dateText;
}

export function matchesPropertyScope(propertyId: string, scopePropertyId?: string) {
  return !scopePropertyId || scopePropertyId === "all" || propertyId === scopePropertyId;
}

export function sumCurrentValue(properties: Property[], scopePropertyId?: string) {
  return properties
    .filter((property) => matchesPropertyScope(property.id, scopePropertyId))
    .reduce((sum, property) => sum + Number(property.currentValue || property.purchasePrice || 0), 0);
}

export function sumLoanBalance(loans: Loan[], scopePropertyId?: string) {
  return loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => sum + Number(loan.currentBalance || 0), 0);
}

export function trailingMonthlyOperatingExpenses(args: {
  today: string;
  transactions: Transaction[];
  scopePropertyId?: string;
}) {
  return trailingMonthlyOperatingExpenseProfile(args).monthlyTotal;
}

export function transactionIsOperatingExpense(txn: Transaction, scopePropertyId?: string) {
  if (txn.type !== "Expense" || txn.capitalImprovement) return false;
  if (!matchesPropertyScope(txn.propertyId, scopePropertyId)) return false;
  if (txn.category === "Escrow" || txn.category === "Mortgage Interest" || txn.category === "Mortgage interest paid to banks") return false;
  return true;
}

export function transactionIsUtilityExpense(txn: Transaction) {
  return String(txn.category || "").toLowerCase() === "utilities";
}

export function trailingMonthlyOperatingExpenseProfile(args: {
  today: string;
  transactions: Transaction[];
  scopePropertyId?: string;
}) {
  const end = new Date(`${args.today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 12);
  const startIso = start.toISOString().slice(0, 10);

  const utilityMonths = new Set<string>();
  const totals = args.transactions.reduce((sum, txn) => {
    if (!transactionIsOperatingExpense(txn, args.scopePropertyId)) return sum;
    if (!txn.date || txn.date < startIso || txn.date > args.today) return sum;
    const amount = Number(txn.amount || 0);
    sum.total += amount;
    if (transactionIsUtilityExpense(txn)) {
      sum.utilities += amount;
      utilityMonths.add(txn.date.slice(0, 7));
    }
    return sum;
  }, { total: 0, utilities: 0 });

  const monthlyTotal = totals.total / 12;
  const utilityBaselineMonthly = totals.utilities / 12;
  const monthlyUtilityEstimate = utilityMonths.size > 0 ? totals.utilities / utilityMonths.size : 0;

  return {
    monthlyTotal,
    utilityBaselineMonthly,
    monthlyUtilityEstimate,
    utilitySampleMonths: utilityMonths.size,
  };
}

export function utilitiesIncludedLeaseCountForDate(args: {
  date: string;
  leases: Lease[];
  scopePropertyId?: string;
}) {
  return args.leases.reduce((count, lease) => {
    if (!lease.utilitiesIncluded) return count;
    if (!matchesPropertyScope(lease.propertyId, args.scopePropertyId)) return count;
    if (!leaseIsActiveByDate(lease, args.date)) return count;
    return count + 1;
  }, 0);
}

export function scheduledRentForDate(args: {
  date: string;
  leases: Lease[];
  scopePropertyId?: string;
}) {
  return args.leases.reduce((sum, lease) => {
    if (!matchesPropertyScope(lease.propertyId, args.scopePropertyId)) return sum;
    if (!leaseIsActiveByDate(lease, args.date)) return sum;
    return sum + (lease.extensions?.some((item) => !item.canceledAt) ? leaseMonthlyEquivalent(lease) : Number(lease.monthlyRent || 0));
  }, 0);
}

export function bestKnownRentForUnit(args: {
  propertyId: string;
  unitName: string;
  leases: Lease[];
  today: string;
}) {
  const scoped = args.leases.filter((lease) => lease.propertyId === args.propertyId && lease.unit === args.unitName);
  const active = scoped.find((lease) => leaseIsActiveByDate(lease, args.today));
  if (active) return Number(active.monthlyRent || 0);

  const next = scoped
    .filter((lease) => lease.startDate >= args.today)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
  if (next) return Number(next.monthlyRent || 0);

  const previous = scoped
    .slice()
    .sort((left, right) => {
      const leftEnd = left.actualEndDate || left.endDate || left.startDate;
      const rightEnd = right.actualEndDate || right.endDate || right.startDate;
      return rightEnd.localeCompare(leftEnd);
    })[0];
  return Number(previous?.monthlyRent || 0);
}
