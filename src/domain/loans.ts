import { deductibleMortgageInterest } from "./accounting.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";

function monthKey(dateStr: string) {
  return String(dateStr || "").slice(0, 7);
}

function addMonths(dateStr: string, monthsToAdd: number) {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function normalizeLoan(loan: Record<string, unknown>) {
  return {
    ...loan,
    loanType: loan.loanType || "Primary Mortgage",
    lienPosition: Number(loan.lienPosition || 1),
    originatedOn: loan.originatedOn || loan.nextPayment || toLocalIsoDate(),
    scheduledMortgageInsurance: Number(loan.scheduledMortgageInsurance || 0),
  };
}

function isSupplementalPrincipalOnlyPayment(payment: Record<string, unknown>) {
  return Number(payment.interest || 0) === 0
    && Number(payment.escrow || 0) === 0
    && Number(payment.mortgageInsurance || 0) === 0
    && Number(payment.extraPrincipal || 0) === 0
    && Number(payment.principal || 0) > 0
    && Math.abs(Number(payment.totalPayment || 0) - Number(payment.principal || 0)) <= 0.01;
}

function isScheduledAmortizingPayment(payment: Record<string, unknown>) {
  return !isSupplementalPrincipalOnlyPayment(payment)
    && Number(payment.scheduledPI || 0) > 0
    && (
      Number(payment.interest || 0) > 0
      || Number(payment.principal || 0) > 0
      || Number(payment.mortgageInsurance || 0) > 0
    );
}

const MATERIAL_LOAN_REPAIR_TOLERANCE = 5;

function defaultLoanPaymentDate(candidate: unknown, todayIso: string) {
  const normalizedCandidate = String(candidate || "").slice(0, 10);
  if (!normalizedCandidate) return todayIso;
  return normalizedCandidate > todayIso ? todayIso : normalizedCandidate;
}

export function loanIdsMatch(left: unknown, right: unknown) {
  const leftId = String(left ?? "");
  const rightId = String(right ?? "");
  return leftId.length > 0 && leftId === rightId;
}

export function findLoanById(loans: Array<Record<string, unknown>> = [], loanId: unknown) {
  return loans.find((loan) => loanIdsMatch(loan?.id, loanId));
}

export function buildLoanSelectorOptions(loans: Array<Record<string, unknown>> = []) {
  return loans.map((loan, index) => {
    return {
      loan,
      value: `__loan_index_${index}`,
    };
  });
}

export function findLoanBySelectorValue(options: Array<{ loan: Record<string, unknown>; value: string }> = [], value: unknown) {
  const selectorValue = String(value ?? "");
  return options.find((option) => option.value === selectorValue)?.loan;
}

export function projectedAmortizationRows(loanInput: Record<string, unknown>, months = 24) {
  const loan = normalizeLoan(loanInput);
  const rows = [];
  let balance = Number(loan.currentBalance || 0);
  const annualRate = Number(loan.rate || 0) / 100;
  const monthlyRate = annualRate / 12;
  const monthlyPI = Number(loan.scheduledPI || 0);
  const monthlyExtraPrincipal = Math.max(0, Number(loan.defaultExtraPrincipal || 0));
  const startDate = String(loan.nextPayment || toLocalIsoDate());

  for (let i = 0; i < months && balance > 0; i += 1) {
    const paymentDate = addMonths(startDate, i);
    const interest = balance * monthlyRate;
    const scheduledPrincipal = Math.max(0, Math.min(balance, monthlyPI - interest));
    const extraPrincipal = Math.max(0, Math.min(balance - scheduledPrincipal, monthlyExtraPrincipal));
    const principal = scheduledPrincipal + extraPrincipal;
    balance = Math.max(0, balance - principal);
    rows.push({
      paymentDate,
      month: monthKey(paymentDate),
      beginningBalance: Math.round((balance + principal) * 100) / 100,
      projectedInterest: Math.round(interest * 100) / 100,
      projectedPrincipal: Math.round(principal * 100) / 100,
      projectedScheduledPrincipal: Math.round(scheduledPrincipal * 100) / 100,
      projectedExtraPrincipal: Math.round(extraPrincipal * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
    });
  }

  return rows;
}

export function projectedCurrentPaymentComponents(loanInput: Record<string, unknown>) {
  const loan = normalizeLoan(loanInput);
  const balance = Number(loan.currentBalance || 0);
  const annualRate = Number(loan.rate || 0) / 100;
  const monthlyRate = annualRate / 12;
  const scheduledPI = Number(loan.scheduledPI || 0);
  const interest = Math.round(balance * monthlyRate * 100) / 100;
  const principal = Math.round(Math.max(0, Math.min(balance, scheduledPI - interest)) * 100) / 100;
  return { interest, principal };
}

export function deriveLoanBalanceFromPayments(loanInput: Record<string, unknown>, payments: Array<Record<string, unknown>>) {
  const loan = normalizeLoan(loanInput);
  const relevantPayments = payments
    .filter((payment) => loanIdsMatch(payment.loanId, loan.id))
    .sort((left, right) => String(left.paymentDate || "").localeCompare(String(right.paymentDate || "")));
  const trackedPrincipalReduction = relevantPayments.reduce(
    (sum, payment) => sum + Number(payment.principal || 0) + Number(payment.extraPrincipal || 0),
    0,
  );
  const earliestPaymentDate = String(relevantPayments[0]?.paymentDate || "");
  const daysFromOrigination = earliestPaymentDate && loan.originatedOn ? daysBetween(String(loan.originatedOn), earliestPaymentDate) : null;
  const historyStartsNearOrigination = daysFromOrigination != null && daysFromOrigination >= 0 && daysFromOrigination <= 90;
  const derivedBalance = Math.max(0, Number(loan.originalBalance || 0) - trackedPrincipalReduction);
  const discrepancy = Math.abs(Number(loan.currentBalance || 0) - derivedBalance);
  const useDerivedBalance = historyStartsNearOrigination && relevantPayments.length > 0 && discrepancy >= 1;

  return {
    derivedBalance,
    trackedPrincipalReduction,
    paymentCount: relevantPayments.length,
    earliestPaymentDate,
    historyStartsNearOrigination,
    discrepancy,
    useDerivedBalance,
  };
}

export function reconcileLoanPaymentsAgainstSchedule(args: {
  loan: Record<string, unknown>;
  payments: Array<Record<string, unknown>>;
  usePeriods: Array<Record<string, unknown>>;
  leases: Array<Record<string, unknown>>;
  units: Array<Record<string, unknown>>;
}) {
  const loan = normalizeLoan(args.loan);
  const monthlyRate = Number(loan.rate || 0) / 100 / 12;
  let runningBalance = Number(loan.originalBalance || 0);
  let totalRepairDifference = 0;

  const sortedPayments = args.payments
    .slice()
    .sort((left, right) => {
      const dateCompare = String(left.paymentDate || "").localeCompare(String(right.paymentDate || ""));
      if (dateCompare !== 0) return dateCompare;
      const leftSupplemental = isSupplementalPrincipalOnlyPayment(left);
      const rightSupplemental = isSupplementalPrincipalOnlyPayment(right);
      if (leftSupplemental !== rightSupplemental) return leftSupplemental ? 1 : -1;
      return String(left.id || "").localeCompare(String(right.id || ""));
    });

  const updatedPayments = sortedPayments.map((payment) => {
    const normalizedPayment = { ...payment };
    if (isScheduledAmortizingPayment(payment)) {
      const scheduledPI = Number(payment.scheduledPI || loan.scheduledPI || 0);
      const expectedInterest = Math.round(runningBalance * monthlyRate * 100) / 100;
      const expectedPrincipal = Math.round(Math.max(0, Math.min(runningBalance, scheduledPI - expectedInterest)) * 100) / 100;
      const expectedDeductibleInterest = Math.round(
        deductibleMortgageInterest({
          interest: expectedInterest,
          propertyId: String(loan.propertyId || ""),
          date: String(payment.paymentDate || ""),
          usePeriods: args.usePeriods,
          leases: args.leases,
          units: args.units,
        }) * 100,
      ) / 100;
      const repairDifference =
        Math.abs(Number(payment.interest || 0) - expectedInterest) +
        Math.abs(Number(payment.principal || 0) - expectedPrincipal) +
        Math.abs(Number(payment.deductibleInterest || 0) - expectedDeductibleInterest);
      if (repairDifference >= 0.01) {
        totalRepairDifference += repairDifference;
        normalizedPayment.interest = expectedInterest;
        normalizedPayment.principal = expectedPrincipal;
        normalizedPayment.deductibleInterest = expectedDeductibleInterest;
      }
    }
    runningBalance = Math.max(0, runningBalance - Number(normalizedPayment.principal || 0) - Number(normalizedPayment.extraPrincipal || 0));
    return normalizedPayment;
  });

  const derivedBalance = Math.round(runningBalance * 100) / 100;
  const balanceMismatch = Math.abs(Number(loan.currentBalance || 0) - derivedBalance) > MATERIAL_LOAN_REPAIR_TOLERANCE;
  const hasRepairableDifferences = totalRepairDifference > MATERIAL_LOAN_REPAIR_TOLERANCE;

  return {
    updatedPayments,
    derivedBalance,
    hasRepairableDifferences,
    balanceMismatch,
  };
}

export function actualLoanPaymentsByMonth(
  loanPayments: Array<Record<string, unknown>>,
  loanId: string,
  getDeductibleInterest = (payment: Record<string, unknown>) => Number(payment.deductibleInterest || 0),
) {
  const map: Record<string, Record<string, number>> = {};
  loanPayments
    .filter((p) => p.loanId === loanId)
    .forEach((p) => {
      const key = monthKey(String(p.paymentDate || ""));
      if (!map[key]) {
        map[key] = {
          interest: 0,
          principal: 0,
          escrow: 0,
          mortgageInsurance: 0,
          extraPrincipal: 0,
          totalPayment: 0,
          deductibleInterest: 0,
        };
      }
      map[key].interest += Number(p.interest || 0);
      map[key].principal += Number(p.principal || 0);
      map[key].escrow += Number(p.escrow || 0);
      map[key].mortgageInsurance += Number(p.mortgageInsurance || 0);
      map[key].extraPrincipal += Number(p.extraPrincipal || 0);
      map[key].totalPayment += Number(p.totalPayment || 0);
      map[key].deductibleInterest += Number(getDeductibleInterest(p) || 0);
    });
  return map;
}

export function groupLoanPaymentsForDisplay(
  loanPayments: Array<Record<string, unknown>>,
  getDeductibleInterest = (payment: Record<string, unknown>) => Number(payment.deductibleInterest || 0),
) {
  const groups = new Map<string, Array<Record<string, unknown>>>();

  loanPayments
    .slice()
    .sort((left, right) => {
      const dateCompare = String(right.paymentDate || "").localeCompare(String(left.paymentDate || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(left.id || "").localeCompare(String(right.id || ""));
    })
    .forEach((payment) => {
      const key = String(payment.paymentDate || "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(payment);
    });

  return Array.from(groups.entries()).map(([paymentDate, entries]) => {
    const shouldFoldSupplementalPrincipal = entries.length > 1;
    const supplementalPrincipalEntries = shouldFoldSupplementalPrincipal
      ? entries.filter(
        (payment) =>
          Number(payment.interest || 0) === 0 &&
          Number(payment.escrow || 0) === 0 &&
          Number(payment.mortgageInsurance || 0) === 0 &&
          Number(payment.extraPrincipal || 0) === 0 &&
          Number(payment.principal || 0) > 0,
      )
      : [];
    const supplementalPrincipalIds = new Set(supplementalPrincipalEntries.map((payment) => payment.id));

    const summary = entries.reduce(
      (acc, payment) => {
        acc.interest += Number(payment.interest || 0);
        acc.deductibleInterest += Number(getDeductibleInterest(payment) || 0);
        acc.escrow += Number(payment.escrow || 0);
        acc.mortgageInsurance += Number(payment.mortgageInsurance || 0);
        acc.totalPayment += Number(payment.totalPayment || 0);
        acc.principal += supplementalPrincipalIds.has(payment.id) ? 0 : Number(payment.principal || 0);
        acc.extraPrincipal += Number(payment.extraPrincipal || 0) + (supplementalPrincipalIds.has(payment.id) ? Number(payment.principal || 0) : 0);
        return acc;
      },
      { interest: 0, deductibleInterest: 0, principal: 0, escrow: 0, mortgageInsurance: 0, extraPrincipal: 0, totalPayment: 0 },
    );

    return {
      paymentDate,
      entries,
      summary,
    };
  });
}

export function deriveObservedLoanDefaults(
  loan: Record<string, unknown>,
  loanPayments: Array<Record<string, unknown>>,
  getDeductibleInterest = (payment: Record<string, unknown>) => Number(payment.deductibleInterest || 0),
) {
  const groups = groupLoanPaymentsForDisplay(loanPayments, getDeductibleInterest);
  const latestObservedGroup = groups.find((group) =>
    group.entries.some((payment) =>
      Number(payment.interest || 0) > 0 ||
      Number(payment.escrow || 0) > 0 ||
      Number(payment.mortgageInsurance || 0) > 0,
    ),
  );

  if (!latestObservedGroup) {
    return {
      scheduledEscrow: Number(loan.scheduledEscrow || 0),
      scheduledMortgageInsurance: Number(loan.scheduledMortgageInsurance || 0),
      nextPayment: String(loan.nextPayment || toLocalIsoDate()),
    };
  }

  return {
    scheduledEscrow: Number(latestObservedGroup.summary.escrow || 0),
    scheduledMortgageInsurance: Number(latestObservedGroup.summary.mortgageInsurance || 0),
    nextPayment: addMonths(latestObservedGroup.paymentDate, 1),
  };
}

export function buildLoanPaymentDraft(
  loan: Record<string, unknown> | null | undefined,
  observedDefaults: Record<string, unknown> = {},
  todayIso: string,
  overrides: Record<string, unknown> = {},
) {
  const calc = projectedCurrentPaymentComponents(loan || {});
  const loanId = String(overrides.loanId ?? loan?.id ?? "");
  return {
    loanId,
    loanSelectorValue: String(overrides.loanSelectorValue ?? loanId),
    paymentDate: overrides.paymentDate ?? defaultLoanPaymentDate(observedDefaults.nextPayment || loan?.nextPayment || todayIso, todayIso),
    interest: String(overrides.interest ?? calc.interest ?? 0),
    principal: String(overrides.principal ?? calc.principal ?? 0),
    escrow: String(overrides.escrow ?? observedDefaults.scheduledEscrow ?? loan?.scheduledEscrow ?? 0),
    mortgageInsurance: String(overrides.mortgageInsurance ?? observedDefaults.scheduledMortgageInsurance ?? loan?.scheduledMortgageInsurance ?? 0),
    extraPrincipal: String(overrides.extraPrincipal ?? loan?.defaultExtraPrincipal ?? 0),
  };
}

export function loanPaymentDraftTotalAmount(draft: Record<string, unknown>) {
  return Number(draft.interest || 0) +
    Number(draft.principal || 0) +
    Number(draft.escrow || 0) +
    Number(draft.mortgageInsurance || 0) +
    Number(draft.extraPrincipal || 0);
}

export function formatLoanPaymentDraftTotal(value: unknown) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isFinite(rounded) ? String(rounded) : "0";
}
