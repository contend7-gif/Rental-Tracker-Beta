import type { Loan, LoanPayment, Transaction } from "../models.ts";

type EscrowDisbursementLike = {
  amount?: number;
  category?: string;
  date?: string;
  loanId?: string;
  propertyId?: string;
};

type EscrowEstimateSource =
  | "none"
  | "property_history"
  | "portfolio_history"
  | "equal_split"
  | "residual_after_taxes"
  | "residual_after_insurance";

export type EscrowAllocationEstimate = {
  escrowTotal: number;
  taxesEstimate: number;
  insuranceEstimate: number;
  taxesSource: EscrowEstimateSource;
  insuranceSource: EscrowEstimateSource;
};

function roundCurrency(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function scopeLoanIds(loans: Loan[], propertyFilter: string) {
  return new Set(
    loans
      .filter((loan) => propertyFilter === "all" || loan.propertyId === propertyFilter)
      .map((loan) => loan.id),
  );
}

function sumEscrowPaymentsForYear(loanPayments: LoanPayment[], loanIds: Set<string>, year: string) {
  return roundCurrency(
    loanPayments.reduce((sum, payment) => {
      if (!loanIds.has(payment.loanId)) return sum;
      if (!String(payment.paymentDate || "").startsWith(year)) return sum;
      return sum + Number(payment.escrow || 0);
    }, 0),
  );
}

function sumEscrowYtdFallback(loans: Loan[], propertyFilter: string) {
  return roundCurrency(
    loans.reduce((sum, loan) => {
      if (propertyFilter !== "all" && loan.propertyId !== propertyFilter) return sum;
      return sum + Number(loan.escrowYTD || 0);
    }, 0),
  );
}

function supportTotalsFromHistory(args: {
  propertyFilter: string;
  loansById: Record<string, Loan>;
  transactions: Transaction[];
  escrowDisbursements: EscrowDisbursementLike[];
}) {
  const matchesProperty = (propertyId: string) => args.propertyFilter === "all" || propertyId === args.propertyFilter;

  const transactionTotals = args.transactions.reduce(
    (acc, transaction) => {
      if (transaction.type !== "Expense") return acc;
      if (!matchesProperty(transaction.propertyId)) return acc;
      if (transaction.category === "Taxes") acc.taxes += Number(transaction.amount || 0);
      if (transaction.category === "Insurance") acc.insurance += Number(transaction.amount || 0);
      return acc;
    },
    { taxes: 0, insurance: 0 },
  );

  const disbursementTotals = args.escrowDisbursements.reduce(
    (acc, entry) => {
      const propertyId = String(entry.propertyId || args.loansById[String(entry.loanId || "")]?.propertyId || "");
      if (!matchesProperty(propertyId)) return acc;
      if (entry.category === "Taxes") acc.taxes += Number(entry.amount || 0);
      if (entry.category === "Insurance") acc.insurance += Number(entry.amount || 0);
      return acc;
    },
    { taxes: 0, insurance: 0 },
  );

  return {
    taxes: roundCurrency(transactionTotals.taxes + disbursementTotals.taxes),
    insurance: roundCurrency(transactionTotals.insurance + disbursementTotals.insurance),
  };
}

function pickRatioBasis(propertyHistory: { taxes: number; insurance: number }, portfolioHistory: { taxes: number; insurance: number }) {
  const propertyTotal = propertyHistory.taxes + propertyHistory.insurance;
  if (propertyTotal > 0 && propertyHistory.taxes > 0 && propertyHistory.insurance > 0) {
    return {
      taxesRatio: propertyHistory.taxes / propertyTotal,
      insuranceRatio: propertyHistory.insurance / propertyTotal,
      source: "property_history" as const,
    };
  }

  const portfolioTotal = portfolioHistory.taxes + portfolioHistory.insurance;
  if (portfolioTotal > 0 && portfolioHistory.taxes > 0 && portfolioHistory.insurance > 0) {
    return {
      taxesRatio: portfolioHistory.taxes / portfolioTotal,
      insuranceRatio: portfolioHistory.insurance / portfolioTotal,
      source: "portfolio_history" as const,
    };
  }

  return {
    taxesRatio: 0.5,
    insuranceRatio: 0.5,
    source: "equal_split" as const,
  };
}

export function buildEscrowAllocationEstimate(args: {
  currentYear: string;
  directInsuranceAmount: number;
  directTaxesAmount: number;
  escrowDisbursements: EscrowDisbursementLike[];
  insuranceOverridden: boolean;
  loanPayments: LoanPayment[];
  loans: Loan[];
  propertyFilter: string;
  taxesOverridden: boolean;
  transactions: Transaction[];
  unitFilter: string;
  year: string;
}): EscrowAllocationEstimate {
  if (args.unitFilter !== "all" && args.unitFilter !== "Shared") {
    return { escrowTotal: 0, taxesEstimate: 0, insuranceEstimate: 0, taxesSource: "none", insuranceSource: "none" };
  }

  const scopedLoanIds = scopeLoanIds(args.loans, args.propertyFilter);
  if (scopedLoanIds.size === 0) {
    return { escrowTotal: 0, taxesEstimate: 0, insuranceEstimate: 0, taxesSource: "none", insuranceSource: "none" };
  }

  const paymentEscrowTotal = sumEscrowPaymentsForYear(args.loanPayments, scopedLoanIds, args.year);
  const escrowYtdFallback = args.year === args.currentYear ? sumEscrowYtdFallback(args.loans, args.propertyFilter) : 0;
  const escrowTotal = roundCurrency(Math.max(paymentEscrowTotal, escrowYtdFallback));

  if (escrowTotal <= 0) {
    return { escrowTotal: 0, taxesEstimate: 0, insuranceEstimate: 0, taxesSource: "none", insuranceSource: "none" };
  }

  const needsTaxesEstimate = !args.taxesOverridden && Math.abs(Number(args.directTaxesAmount || 0)) < 0.005;
  const needsInsuranceEstimate = !args.insuranceOverridden && Math.abs(Number(args.directInsuranceAmount || 0)) < 0.005;

  if (!needsTaxesEstimate && !needsInsuranceEstimate) {
    return { escrowTotal, taxesEstimate: 0, insuranceEstimate: 0, taxesSource: "none", insuranceSource: "none" };
  }

  if (needsTaxesEstimate && !needsInsuranceEstimate) {
    return {
      escrowTotal,
      taxesEstimate: roundCurrency(Math.max(0, escrowTotal - Number(args.directInsuranceAmount || 0))),
      insuranceEstimate: 0,
      taxesSource: "residual_after_insurance",
      insuranceSource: "none",
    };
  }

  if (!needsTaxesEstimate && needsInsuranceEstimate) {
    return {
      escrowTotal,
      taxesEstimate: 0,
      insuranceEstimate: roundCurrency(Math.max(0, escrowTotal - Number(args.directTaxesAmount || 0))),
      taxesSource: "none",
      insuranceSource: "residual_after_taxes",
    };
  }

  const loansById = Object.fromEntries(args.loans.map((loan) => [loan.id, loan]));
  const propertyHistory = supportTotalsFromHistory({
    propertyFilter: args.propertyFilter,
    loansById,
    transactions: args.transactions,
    escrowDisbursements: args.escrowDisbursements,
  });
  const portfolioHistory = args.propertyFilter === "all"
    ? propertyHistory
    : supportTotalsFromHistory({
      propertyFilter: "all",
      loansById,
      transactions: args.transactions,
      escrowDisbursements: args.escrowDisbursements,
    });
  const ratio = pickRatioBasis(propertyHistory, portfolioHistory);

  return {
    escrowTotal,
    taxesEstimate: roundCurrency(escrowTotal * ratio.taxesRatio),
    insuranceEstimate: roundCurrency(escrowTotal * ratio.insuranceRatio),
    taxesSource: ratio.source,
    insuranceSource: ratio.source,
  };
}
