import type { Frequency, Lease, Loan, LoanPayment, RecurringDraft, RecurringTemplate, Transaction, Unit, UsePeriod } from "../models.ts";

export function currency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

export function toPctDisplay(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function addDays(date: string, offset: number) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + offset);
  return next.toISOString().slice(0, 10);
}

function leaseIsActiveByDate(lease: Lease, date: string) {
  if (!date) return false;
  if (lease.startDate > date) return false;
  if (lease.actualEndDate) return lease.actualEndDate >= date;
  if (lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm) return true;
  return lease.endDate >= date;
}

function rentalUsePctFromUsePeriod(period?: UsePeriod) {
  if (!period) return null;
  if (Number.isFinite(Number(period.rentalUsePct))) return Number(period.rentalUsePct);
  const useType = String(period.useType || "").toLowerCase();
  if (useType.includes("owner") || useType.includes("vacant")) return 0;
  return 1;
}

function findMatchingUsePeriod(usePeriods: UsePeriod[], propertyId: string, unit: string, date: string) {
  return usePeriods
    .filter((period) => period.propertyId === propertyId && period.unit === unit && date >= period.startDate && (!period.endDate || date <= period.endDate))
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];
}

function getRentalUsePctForPropertyUnitOnDate(args: {
  propertyId: string;
  unitName: string;
  date: string;
  usePeriods: UsePeriod[];
  leases: Lease[];
}) {
  const { propertyId, unitName, date, usePeriods, leases } = args;
  const leaseActive = leases.some((lease) => lease.propertyId === propertyId && lease.unit === unitName && leaseIsActiveByDate(lease, date));
  if (leaseActive) return 1;

  const matchedUsePct = rentalUsePctFromUsePeriod(findMatchingUsePeriod(usePeriods, propertyId, unitName, date));
  if (matchedUsePct != null) return matchedUsePct;
  return 1;
}

function propertyHasTrackedUnitLevelUse(args: {
  propertyId: string;
  units: Unit[];
  usePeriods: UsePeriod[];
  leases: Lease[];
}) {
  const { propertyId, units, usePeriods, leases } = args;
  const propertyUnits = units.filter((candidate) => candidate.propertyId === propertyId && candidate.name !== "Shared");
  if (propertyUnits.length === 0) return false;

  return propertyUnits.some((candidate) =>
    usePeriods.some((period) => period.propertyId === propertyId && period.unit === candidate.name) ||
    leases.some((lease) => lease.propertyId === propertyId && lease.unit === candidate.name)
  );
}

export function getRentalUsePctForDate(args: {
  propertyId: string;
  unit: string;
  date: string;
  usePeriods: UsePeriod[];
  fallbackOwnerUsePct?: number;
  ownerUsePctOverride?: boolean;
  leases?: Lease[];
  units?: Unit[];
}) {
  const { propertyId, unit, date, usePeriods, fallbackOwnerUsePct = 0, ownerUsePctOverride = false, leases = [], units = [] } = args;
  const normalizedUnit = String(unit || "").trim() || "Shared";
  if (ownerUsePctOverride) return clampPct(1 - fallbackOwnerUsePct);
  const directMatch = findMatchingUsePeriod(usePeriods, propertyId, normalizedUnit, date);
  const directUsePct = rentalUsePctFromUsePeriod(directMatch);

  if (normalizedUnit !== "Shared") {
    if (directUsePct != null) return directUsePct;
    return 1;
  }

  const propertyUnits = units.filter((candidate) => candidate.propertyId === propertyId && candidate.name !== "Shared");
  if (propertyUnits.length > 0 && propertyHasTrackedUnitLevelUse({ propertyId, units, usePeriods, leases })) {
    const totalPct = propertyUnits.reduce(
      (sum, candidate) => sum + getRentalUsePctForPropertyUnitOnDate({ propertyId, unitName: candidate.name, date, usePeriods, leases }),
      0,
    );
    return totalPct / propertyUnits.length;
  }

  if (directUsePct != null) return directUsePct;
  if (normalizedUnit === "Shared") return 1 - fallbackOwnerUsePct;
  return 1;
}

export function getRentalUsePctForRange(args: {
  propertyId: string;
  unit: string;
  startDate: string;
  endDate: string;
  usePeriods: UsePeriod[];
  fallbackOwnerUsePct?: number;
  ownerUsePctOverride?: boolean;
  leases?: Lease[];
  units?: Unit[];
}) {
  const { propertyId, unit, startDate, endDate, usePeriods, fallbackOwnerUsePct = 0, ownerUsePctOverride = false, leases = [], units = [] } = args;
  if (!startDate || !endDate || endDate < startDate) {
    return getRentalUsePctForDate({
      propertyId,
      unit,
      date: startDate || endDate,
      usePeriods,
      fallbackOwnerUsePct,
      ownerUsePctOverride,
      leases,
      units,
    });
  }

  let weightedTotal = 0;
  let dayCount = 0;
  let cursor = startDate;
  while (cursor && cursor <= endDate && dayCount < 3700) {
    weightedTotal += getRentalUsePctForDate({
      propertyId,
      unit,
      date: cursor,
      usePeriods,
      fallbackOwnerUsePct,
      ownerUsePctOverride,
      leases,
      units,
    });
    dayCount += 1;
    cursor = addDays(cursor, 1);
  }

  if (dayCount === 0) {
    return getRentalUsePctForDate({
      propertyId,
      unit,
      date: startDate || endDate,
      usePeriods,
      fallbackOwnerUsePct,
      ownerUsePctOverride,
      leases,
      units,
    });
  }

  return weightedTotal / dayCount;
}

export function deductibleAmountForTransaction(args: {
  amount: number;
  type: Transaction["type"];
  capitalImprovement: boolean;
  rentalUsePct: number;
}) {
  const { amount, type, capitalImprovement, rentalUsePct } = args;
  if (type === "Income") return amount;
  if (type !== "Expense") return 0;
  if (capitalImprovement) return 0;
  return amount * rentalUsePct;
}

export function allocateAmountToYearByServicePeriod(args: {
  amount: number;
  year: number | string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
}) {
  const year = Number(args.year);
  const amount = Number(args.amount || 0);
  const start = String(args.servicePeriodStart || "").trim();
  const end = String(args.servicePeriodEnd || "").trim();

  if (!Number.isFinite(year) || !start || !end || end < start) {
    return amount;
  }

  const periodStart = new Date(`${start}T00:00:00Z`);
  const periodEnd = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(periodStart.valueOf()) || Number.isNaN(periodEnd.valueOf()) || periodEnd < periodStart) {
    return amount;
  }

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const overlapStart = periodStart > yearStart ? periodStart : yearStart;
  const overlapEnd = periodEnd < yearEnd ? periodEnd : yearEnd;

  if (overlapEnd < overlapStart) {
    return 0;
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY) + 1;
  const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY) + 1;
  if (totalDays <= 0 || overlapDays <= 0) {
    return 0;
  }

  return amount * (overlapDays / totalDays);
}

export function loanBreakdown(loan: Loan) {
  const totalMonthlyPayment = loan.scheduledPI + loan.scheduledEscrow + (loan.scheduledMortgageInsurance || 0) + loan.defaultExtraPrincipal;
  return {
    totalMonthlyPayment,
    scheduledPI: loan.scheduledPI,
    scheduledEscrow: loan.scheduledEscrow,
    mortgageInsurance: loan.scheduledMortgageInsurance || 0,
    extraPrincipal: loan.defaultExtraPrincipal,
  };
}

export function deductibleMortgageInterest(args: { interest: number; propertyId: string; date: string; usePeriods: UsePeriod[]; leases?: Lease[]; units?: Unit[]; sharedUnit?: string }) {
  const rentalPct = getRentalUsePctForDate({
    propertyId: args.propertyId,
    unit: args.sharedUnit || "Shared",
    date: args.date,
    usePeriods: args.usePeriods,
    leases: args.leases,
    units: args.units,
    fallbackOwnerUsePct: 0,
  });
  return args.interest * rentalPct;
}

export function createLoanPayment(args: {
  loan: Loan;
  paymentDate: string;
  interest: number;
  principal: number;
  escrow?: number;
  mortgageInsurance?: number;
  extraPrincipal?: number;
  deductibleInterest: number;
}): LoanPayment {
  const escrow = args.escrow ?? args.loan.scheduledEscrow;
  const mortgageInsurance = args.mortgageInsurance ?? args.loan.scheduledMortgageInsurance ?? 0;
  const extraPrincipal = args.extraPrincipal ?? args.loan.defaultExtraPrincipal;
  return {
    id: `lp-${Date.now()}`,
    loanId: args.loan.id,
    paymentDate: args.paymentDate,
    scheduledPI: args.loan.scheduledPI,
    interest: args.interest,
    principal: args.principal,
    escrow,
    mortgageInsurance,
    extraPrincipal,
    totalPayment: args.interest + args.principal + escrow + mortgageInsurance + extraPrincipal,
    deductibleInterest: args.deductibleInterest,
  };
}

export function createRecurringTemplateFromTxn(txn: Transaction): RecurringTemplate {
  return {
    id: `r${Date.now()}`,
    description: txn.description,
    propertyId: txn.propertyId,
    unit: txn.unit,
    type: txn.type,
    category: txn.category,
    amount: txn.amount,
    frequency: "Monthly",
    nextDueDate: txn.date,
    reviewRequired: true,
    ownerUsePct: Math.round(txn.ownerUsePct * 100),
    ownerUsePctOverride: Boolean(txn.ownerUsePctOverride),
    active: true,
  };
}

function addByFrequency(dateStr: string, frequency: Frequency) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "Weekly") dt.setUTCDate(dt.getUTCDate() + 7);
  if (frequency === "Monthly") dt.setUTCMonth(dt.getUTCMonth() + 1);
  if (frequency === "Quarterly") dt.setUTCMonth(dt.getUTCMonth() + 3);
  if (frequency === "Yearly") dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  return dt.toISOString().slice(0, 10);
}

export function generateRecurringDrafts(args: { template: RecurringTemplate; throughDate: string; usePeriods: UsePeriod[] }): RecurringDraft[] {
  const drafts: RecurringDraft[] = [];
  if (!args.template.active) return drafts;

  let cursor = args.template.nextDueDate;
  while (cursor <= args.throughDate) {
    const dueDate = cursor;
    const rentalUsePct = getRentalUsePctForDate({
      propertyId: args.template.propertyId,
      unit: args.template.unit,
      date: dueDate,
      usePeriods: args.usePeriods,
      fallbackOwnerUsePct: args.template.ownerUsePct / 100,
      ownerUsePctOverride: Boolean(args.template.ownerUsePctOverride),
    });

    drafts.push({
      id: `rd-${args.template.id}-${dueDate}`,
      templateId: args.template.id,
      dueDate,
      status: "draft",
      transactionSeed: {
        date: dueDate,
        propertyId: args.template.propertyId,
        unit: args.template.unit,
        type: args.template.type,
        category: args.template.category,
        description: `${args.template.description} (recurring)`,
        amount: args.template.amount,
        ownerUsePct: args.template.ownerUsePct / 100,
        ownerUsePctOverride: Boolean(args.template.ownerUsePctOverride),
        rentalUsePct,
        deductibleAmount: deductibleAmountForTransaction({ amount: args.template.amount, type: args.template.type, capitalImprovement: false, rentalUsePct }),
        paidFrom: "Duplex bank",
        paymentMethod: "ACH",
        reimbursable: false,
        reimbursed: false,
        capitalImprovement: false,
        vendor: "",
        receiptName: "",
        notes: args.template.reviewRequired ? "Draft from recurring template - review required" : "Draft from recurring template",
        taxChecked: false,
        recurringTemplateId: args.template.id,
        reconciled: false,
      },
    });

    cursor = addByFrequency(cursor, args.template.frequency);
  }

  return drafts;
}

export function generateRecurringTransactions(args: {
  template: RecurringTemplate;
  throughDate: string;
  usePeriods: UsePeriod[];
  existingTransactionKeys: Set<string>;
}): { transactions: Transaction[]; nextDueDate: string } {
  const transactions: Transaction[] = [];
  if (!args.template.active) return { transactions, nextDueDate: args.template.nextDueDate };

  let cursor = args.template.nextDueDate;
  while (cursor <= args.throughDate) {
    const uniqueKey = `${args.template.id}:${cursor}`;
    if (!args.existingTransactionKeys.has(uniqueKey)) {
      const rentalUsePct = getRentalUsePctForDate({
        propertyId: args.template.propertyId,
        unit: args.template.unit,
        date: cursor,
        usePeriods: args.usePeriods,
        fallbackOwnerUsePct: args.template.ownerUsePct / 100,
        ownerUsePctOverride: Boolean(args.template.ownerUsePctOverride),
      });

      transactions.push({
        id: `t-rec-${args.template.id}-${cursor}`,
        date: cursor,
        propertyId: args.template.propertyId,
        unit: args.template.unit,
        type: args.template.type,
        category: args.template.category,
        description: `${args.template.description} (recurring)`,
        amount: args.template.amount,
        ownerUsePct: args.template.ownerUsePct / 100,
        ownerUsePctOverride: Boolean(args.template.ownerUsePctOverride),
        rentalUsePct,
        deductibleAmount: deductibleAmountForTransaction({ amount: args.template.amount, type: args.template.type, capitalImprovement: false, rentalUsePct }),
        paidFrom: "Duplex bank",
        paymentMethod: "ACH",
        reimbursable: false,
        reimbursed: false,
        capitalImprovement: false,
        vendor: "",
        receiptName: "",
        notes: args.template.reviewRequired ? "Auto-added recurring transaction - review for taxes." : "Auto-added recurring transaction.",
        taxChecked: false,
        recurringTemplateId: args.template.id,
        reconciled: false,
        status: "active",
      });
      args.existingTransactionKeys.add(uniqueKey);
    }

    cursor = addByFrequency(cursor, args.template.frequency);
  }

  return { transactions, nextDueDate: cursor };
}
