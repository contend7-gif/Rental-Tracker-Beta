import type { Loan, LoanYearEndReview } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import { isRecord } from "./storeUtils.ts";

function optionalNumber(value: unknown) {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeLoanYearEndReview(raw: unknown): LoanYearEndReview | null {
  if (!isRecord(raw)) return null;
  const year = String(raw.year || "").trim();
  if (!year) return null;

  return {
    year,
    form1098Received: Boolean(raw.form1098Received),
    form1098Interest: optionalNumber(raw.form1098Interest),
    form1098MortgageInsurance: optionalNumber(raw.form1098MortgageInsurance),
    form1098Points: optionalNumber(raw.form1098Points),
    form1098PropertyTaxPaid: optionalNumber(raw.form1098PropertyTaxPaid),
    form1098InsurancePaid: optionalNumber(raw.form1098InsurancePaid),
    escrowPropertyTaxPaid: optionalNumber(raw.escrowPropertyTaxPaid),
    escrowInsurancePaid: optionalNumber(raw.escrowInsurancePaid),
    escrowOtherPaid: optionalNumber(raw.escrowOtherPaid),
    deductibleInterestOverride: optionalNumber(raw.deductibleInterestOverride),
    pmiOverride: optionalNumber(raw.pmiOverride),
    reviewNotes: String(raw.reviewNotes || ""),
    reviewed: Boolean(raw.reviewed),
    reviewedAt: String(raw.reviewedAt || ""),
  };
}

export function normalizeLoan(loan: Loan): Loan {
  const reviews = Array.isArray(loan.yearEndReviews)
    ? loan.yearEndReviews.map((review) => normalizeLoanYearEndReview(review)).filter((review): review is LoanYearEndReview => Boolean(review))
    : [];

  return {
    ...loan,
    loanType: loan.loanType || "Primary Mortgage",
    lienPosition: Number(loan.lienPosition || 1),
    originatedOn: loan.originatedOn || loan.nextPayment || toLocalIsoDate(),
    scheduledPI: Number(loan.scheduledPI || 0),
    scheduledEscrow: Number(loan.scheduledEscrow || 0),
    scheduledMortgageInsurance: Number(loan.scheduledMortgageInsurance || 0),
    defaultExtraPrincipal: Number(loan.defaultExtraPrincipal || 0),
    interestYTD: Number(loan.interestYTD || 0),
    principalYTD: Number(loan.principalYTD || 0),
    escrowYTD: Number(loan.escrowYTD || 0),
    yearEndReviews: reviews,
  };
}

function uniqueLoanId(baseId: string, index: number, usedIds: Set<string>) {
  const safeBase = baseId || "loan";
  let candidate = `${safeBase}-duplicate-${index + 1}`;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${safeBase}-duplicate-${index + 1}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function normalizeLoansWithUniqueIds(loans: Loan[]): Loan[] {
  const usedIds = new Set<string>();
  return loans.map((loan, index) => {
    const normalizedLoan = normalizeLoan(loan);
    const id = String(normalizedLoan.id || "").trim();
    if (id && !usedIds.has(id)) {
      usedIds.add(id);
      return { ...normalizedLoan, id };
    }

    const repairedId = uniqueLoanId(id, index, usedIds);
    usedIds.add(repairedId);
    return {
      ...normalizedLoan,
      id: repairedId,
    };
  });
}

export function loanIdsNeedRepair(loans: Loan[]) {
  const seen = new Set<string>();
  return loans.some((loan) => {
    const id = String(loan?.id || "").trim();
    if (!id) return true;
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
}
