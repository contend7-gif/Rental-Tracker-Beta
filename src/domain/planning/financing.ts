import type { Loan, UsePeriod, Lease, Unit } from "../../models.ts";
import { matchesPropertyScope, monthDifference, amortizedPayment, clampPct, addMonths } from "./shared.ts";
import { loanBreakdown, getRentalUsePctForDate } from "../accounting.ts";
import type { PlanningProjectionSummary, PlanningExitPlan, PlanningDebtPayoffPlan, PlanningFinancingComparison, PlanningDebtPayoffAnalysis } from "./types.ts";

export function currentAdjustedDebtService(args: {
  today: string;
  loans: Loan[];
  scopePropertyId?: string;
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
}) {
  const fullDebtService = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, args.scopePropertyId))
    .reduce((sum, loan) => sum + loanBreakdown(loan).totalMonthlyPayment, 0);

  const adjustedDebtService = args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, args.scopePropertyId))
    .reduce((sum, loan) => {
      const rentalUsePct = getRentalUsePctForDate({
        propertyId: loan.propertyId,
        unit: "Shared",
        date: args.today,
        usePeriods: args.usePeriods,
        leases: args.leases,
        units: args.units,
        fallbackOwnerUsePct: 0,
      });
      return sum + (loanBreakdown(loan).totalMonthlyPayment * rentalUsePct);
    }, 0);

  return {
    fullDebtService,
    adjustedDebtService,
    currentRentalUsePct: fullDebtService > 0 ? adjustedDebtService / fullDebtService : 1,
  };
}

export function projectLoanBalance(balance: number, loan: Loan) {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  const monthlyRate = Number(loan.rate || 0) / 100 / 12;
  const scheduledPI = Number(loan.scheduledPI || 0);
  const extraPrincipal = Number(loan.defaultExtraPrincipal || 0);
  const interest = balance * monthlyRate;
  const scheduledPrincipal = Math.max(0, scheduledPI - interest);
  const principalReduction = Math.min(balance, scheduledPrincipal + extraPrincipal);
  const nextBalance = balance - principalReduction;
  return Math.max(0, Math.round(nextBalance * 100) / 100);
}



export function projectLoanBalancesToDate(args: {
  today: string;
  targetDate: string;
  loans: Loan[];
  propertyId?: string;
}) {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const months = Math.max(0, monthDifference(args.today, args.targetDate || args.today));
  return args.loans
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => {
      let balance = Math.max(0, Number(loan.currentBalance || 0));
      for (let index = 0; index < months; index += 1) {
        balance = projectLoanBalance(balance, loan);
      }
      return sum + balance;
    }, 0);
}

export function buildPlanningFinancingComparison(args: {
  today: string;
  loans: Loan[];
  propertyId?: string;
  summary: PlanningProjectionSummary;
  exitPlan?: PlanningExitPlan;
  debtPayoffPlan?: PlanningDebtPayoffPlan;
}): PlanningFinancingComparison {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const scopedLoans = args.loans.filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId));
  const totalBalance = scopedLoans.reduce((sum, loan) => sum + Number(loan.currentBalance || 0), 0);
  const weightedCurrentRatePct = totalBalance > 0
    ? scopedLoans.reduce((sum, loan) => sum + (Number(loan.currentBalance || 0) * Number(loan.rate || 0)), 0) / totalBalance
    : 0;
  const currentPayoff = buildPlanningDebtPayoffAnalysis({
    today: args.today,
    loans: args.loans,
    propertyId: scopePropertyId,
    plan: {},
  });
  const acceleratedPayoff = buildPlanningDebtPayoffAnalysis({
    today: args.today,
    loans: args.loans,
    propertyId: scopePropertyId,
    plan: args.debtPayoffPlan,
  });
  const refiRatePct = Number(args.exitPlan?.targetRatePct || weightedCurrentRatePct || 0);
  const refiTermYears = Math.max(1, Number(args.exitPlan?.termYears || 30));
  const refiBalance = Math.max(0, totalBalance + Number(args.exitPlan?.cashOutAmount || 0));
  const currentCarryCostsMonthly = scopedLoans.reduce((sum, loan) => sum + Number(loan.scheduledEscrow || 0) + Number(loan.scheduledMortgageInsurance || 0), 0);
  const refiFullMonthlyOutlay = amortizedPayment(refiBalance, refiRatePct, refiTermYears) + currentCarryCostsMonthly;
  const refiPlanningMonthlyOutlay = refiFullMonthlyOutlay * clampPct(Number(args.summary.currentRentalUsePct || 1));
  const refiPayoffMonths = refiTermYears * 12;
  const refiTotalPayments = refiFullMonthlyOutlay * refiPayoffMonths;
  const refiInterestRemaining = Math.max(0, refiTotalPayments - refiBalance);

  return {
    weightedCurrentRatePct: Math.round(weightedCurrentRatePct * 100) / 100,
    currentLoanBalance: Math.round(totalBalance * 100) / 100,
    rows: [
      {
        id: "current",
        label: "Current financing",
        fullMonthlyOutlay: Math.round(Number(args.summary.fullMonthlyDebtService || 0) * 100) / 100,
        planningMonthlyOutlay: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
        payoffMonths: currentPayoff.currentMonthsToPayoff,
        payoffDate: currentPayoff.projectedPayoffDate,
        interestRemaining: currentPayoff.currentInterestRemaining,
        cashFlowImpact: 0,
        note: `Blended current rate about ${weightedCurrentRatePct.toFixed(2)}%. Planning outlay reflects the current rental-share mix.`,
      },
      {
        id: "refi",
        label: "Refi scenario",
        fullMonthlyOutlay: Math.round(refiFullMonthlyOutlay * 100) / 100,
        planningMonthlyOutlay: Math.round(refiPlanningMonthlyOutlay * 100) / 100,
        payoffMonths: refiPayoffMonths,
        payoffDate: addMonths(args.today, refiPayoffMonths),
        interestRemaining: Math.round(refiInterestRemaining * 100) / 100,
        cashFlowImpact: Math.round((Number(args.summary.adjustedMonthlyDebtService || 0) - refiPlanningMonthlyOutlay) * 100) / 100,
        note: `Rate ${refiRatePct.toFixed(2)}% | ${refiTermYears} years${Number(args.exitPlan?.cashOutAmount || 0) > 0 ? ` | Cash out ${Math.round(Number(args.exitPlan?.cashOutAmount || 0))}` : ""}.`,
      },
      {
        id: "accelerated",
        label: "Accelerated payoff",
        fullMonthlyOutlay: Math.round((Number(args.summary.fullMonthlyDebtService || 0) + acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        planningMonthlyOutlay: Math.round((Number(args.summary.adjustedMonthlyDebtService || 0) + acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        payoffMonths: acceleratedPayoff.acceleratedMonthsToPayoff,
        payoffDate: acceleratedPayoff.projectedPayoffDate,
        interestRemaining: acceleratedPayoff.acceleratedInterestRemaining,
        cashFlowImpact: Math.round((-acceleratedPayoff.monthlyExtraOutlay) * 100) / 100,
        note: `Saves about ${acceleratedPayoff.monthsSaved} months and ${Math.round(acceleratedPayoff.interestSaved)} of interest.`,
      },
    ],
  };
}

export function buildPlanningDebtPayoffAnalysis(args: {
  today: string;
  loans: Loan[];
  propertyId?: string;
  plan?: PlanningDebtPayoffPlan;
}): PlanningDebtPayoffAnalysis {
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const monthlyExtra = Math.max(0, Number(args.plan?.extraPrincipalMonthly || 0));
  const lumpSumAmount = Math.max(0, Number(args.plan?.lumpSumAmount || 0));
  const lumpSumDate = String(args.plan?.lumpSumDate || args.today);

  const simulate = (accelerated = false) => {
    const entries = args.loans
      .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
      .map((loan) => ({
        balance: Math.max(0, Number(loan.currentBalance || 0)),
        rate: Math.max(0, Number(loan.rate || 0)) / 100 / 12,
        scheduledPI: Math.max(0, Number(loan.scheduledPI || 0)),
        extraDefault: Math.max(0, Number(loan.defaultExtraPrincipal || 0)),
        nextPayment: String(loan.nextPayment || args.today),
      }));

    let months = 0;
    let interestTotal = 0;
    let cursor = args.today;
    let lumpSumApplied = false;
    while (entries.some((entry) => entry.balance > 0.01) && months < 720) {
      months += 1;
      cursor = addMonths(cursor, 1);
      entries.forEach((entry) => {
        if (entry.balance <= 0.01) {
          entry.balance = 0;
          return;
        }
        if (accelerated && !lumpSumApplied && cursor >= lumpSumDate && lumpSumAmount > 0) {
          entry.balance = Math.max(0, entry.balance - (lumpSumAmount / Math.max(1, entries.length)));
        }
        const interest = entry.balance * entry.rate;
        interestTotal += interest;
        const principal = Math.max(0, entry.scheduledPI - interest) + entry.extraDefault + (accelerated ? monthlyExtra : 0);
        entry.balance = Math.max(0, entry.balance - principal);
      });
      if (accelerated && !lumpSumApplied && cursor >= lumpSumDate && lumpSumAmount > 0) {
        lumpSumApplied = true;
      }
    }
    return {
      months,
      interestTotal: Math.round(interestTotal * 100) / 100,
      payoffDate: cursor,
    };
  };

  const current = simulate(false);
  const accelerated = simulate(true);

  return {
    currentMonthsToPayoff: current.months,
    acceleratedMonthsToPayoff: accelerated.months,
    monthsSaved: Math.max(0, current.months - accelerated.months),
    currentInterestRemaining: current.interestTotal,
    acceleratedInterestRemaining: accelerated.interestTotal,
    interestSaved: Math.max(0, Math.round((current.interestTotal - accelerated.interestTotal) * 100) / 100),
    projectedPayoffDate: accelerated.payoffDate,
    monthlyExtraOutlay: Math.round(monthlyExtra * 100) / 100,
  };
}
