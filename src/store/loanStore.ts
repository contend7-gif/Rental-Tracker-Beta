import type { Loan, LoanPayment, LoanYearEndReview } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { isRecord } from "./storeUtils.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

function addMonths(dateStr: string, monthsToAdd: number) {
  const parts = String(dateStr || "").split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return dateStr;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

function loanPaymentPrincipalImpact(payment: LoanPayment) {
  return Number(payment.principal || 0) + Number(payment.extraPrincipal || 0);
}

function loanPaymentYearAmount(payment: LoanPayment, field: "interest" | "principal" | "escrow", year: string) {
  if (!String(payment.paymentDate || "").startsWith(year)) return 0;
  if (field === "principal") return loanPaymentPrincipalImpact(payment);
  return Number(payment[field] || 0);
}

function nextLoanPaymentDate(payments: LoanPayment[], loanId: string, fallback: string) {
  const latestPayment = payments
    .filter((payment) => payment.loanId === loanId)
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];
  return latestPayment ? addMonths(latestPayment.paymentDate, 1) : fallback;
}

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

export function createLoanActions({
  getLoans,
  getLoanPayments,
  setLoans,
  setLoanPayments,
  appendActivityLog,
}: {
  getLoans: () => Loan[];
  getLoanPayments: () => LoanPayment[];
  setLoans: StateSetter<Loan>;
  setLoanPayments: StateSetter<LoanPayment>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    addOrUpdateLoan(loan: Loan) {
      const normalizedLoan = normalizeLoan(loan);
      const existsBefore = getLoans().some((item) => item.id === normalizedLoan.id);
      setLoans((previous) => {
        const exists = previous.some((item) => item.id === normalizedLoan.id);
        return exists
          ? previous.map((item) => (item.id === normalizedLoan.id ? normalizedLoan : item))
          : [normalizedLoan, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "loan",
        entityId: normalizedLoan.id,
        propertyId: normalizedLoan.propertyId,
        unit: "Shared",
        summary: existsBefore ? "Loan updated." : "Loan created.",
        details: normalizedLoan.lender,
      });
    },
    repairLoanIdentityCollisions() {
      const loans = getLoans();
      if (!loanIdsNeedRepair(loans)) return false;
      setLoans(normalizeLoansWithUniqueIds(loans));
      appendActivityLog({
        action: "update",
        entityType: "loan",
        entityId: "loan-id-repair",
        unit: "Shared",
        summary: "Loan identities repaired.",
        details: "Duplicate or blank loan ids were made unique so payments can attach to the selected loan.",
      });
      return true;
    },
    updateLoanYearEndReview(loanId: string, review: LoanYearEndReview) {
      const normalizedReview = normalizeLoanYearEndReview(review);
      if (!normalizedReview) return;
      const loanRecord = getLoans().find((loan) => loan.id === loanId);
      setLoans((previous) => previous.map((loan) => {
        if (loan.id !== loanId) return loan;
        const existingReviews = Array.isArray(loan.yearEndReviews) ? loan.yearEndReviews : [];
        const withoutYear = existingReviews.filter((item) => item.year !== normalizedReview.year);
        return normalizeLoan({
          ...loan,
          yearEndReviews: [normalizedReview, ...withoutYear].sort((left, right) => String(right.year).localeCompare(String(left.year))),
        });
      }));
      appendActivityLog({
        action: "update",
        entityType: "loan",
        entityId: loanId,
        propertyId: loanRecord?.propertyId,
        unit: "Shared",
        summary: "Loan year-end review updated.",
        details: normalizedReview.year,
      });
    },
    markLoanYearReviewed(loanId: string, year: string) {
      const loanRecord = getLoans().find((loan) => loan.id === loanId);
      const existingReview = loanRecord?.yearEndReviews?.find((review) => review.year === year) || { year };
      const normalizedReview = normalizeLoanYearEndReview({ ...existingReview, year, reviewed: true, reviewedAt: new Date().toISOString() });
      if (!normalizedReview) return;
      setLoans((previous) => previous.map((loan) => {
        if (loan.id !== loanId) return loan;
        const existingReviews = Array.isArray(loan.yearEndReviews) ? loan.yearEndReviews : [];
        const withoutYear = existingReviews.filter((item) => item.year !== year);
        return normalizeLoan({
          ...loan,
          yearEndReviews: [normalizedReview, ...withoutYear].sort((left, right) => String(right.year).localeCompare(String(left.year))),
        });
      }));
      appendActivityLog({
        action: "update",
        entityType: "loan",
        entityId: loanId,
        propertyId: loanRecord?.propertyId,
        unit: "Shared",
        summary: "Loan year-end review marked complete.",
        details: year,
      });
    },
    saveLoanPayment(payment: LoanPayment) {
      setLoanPayments((previous) => [payment, ...previous]);
      setLoans((previous) => previous.map((loan) => {
        if (loan.id !== payment.loanId) return loan;
        const nextBalance = Math.max(0, loan.currentBalance - payment.principal - payment.extraPrincipal);
        const isSameYear = payment.paymentDate.startsWith(new Date().toISOString().slice(0, 4));
        return {
          ...loan,
          currentBalance: nextBalance,
          interestYTD: isSameYear ? loan.interestYTD + payment.interest : loan.interestYTD,
          principalYTD: isSameYear ? loan.principalYTD + payment.principal + payment.extraPrincipal : loan.principalYTD,
          escrowYTD: isSameYear ? loan.escrowYTD + payment.escrow : loan.escrowYTD,
          nextPayment: addMonths(payment.paymentDate, 1),
        };
      }));
      const loanRecord = getLoans().find((loan) => loan.id === payment.loanId);
      appendActivityLog({
        action: "create",
        entityType: "loan-payment",
        entityId: payment.id,
        propertyId: loanRecord?.propertyId,
        unit: "Shared",
        summary: "Loan payment recorded.",
        details: `Payment date ${payment.paymentDate}`,
      });
    },
    updateLoanPayment(updatedPayment: LoanPayment) {
      const loanPayments = getLoanPayments();
      const existingPayment = loanPayments.find((payment) => payment.id === updatedPayment.id);
      if (!existingPayment) return;
      const updatedPayments = loanPayments.map((payment) => (payment.id === updatedPayment.id ? updatedPayment : payment));
      const currentYear = new Date().toISOString().slice(0, 4);
      setLoanPayments(updatedPayments);
      setLoans((previous) => previous.map((loan) => {
        const touchesExistingLoan = loan.id === existingPayment.loanId;
        const touchesUpdatedLoan = loan.id === updatedPayment.loanId;
        if (!touchesExistingLoan && !touchesUpdatedLoan) return loan;

        let currentBalance = loan.currentBalance;
        let interestYTD = loan.interestYTD;
        let principalYTD = loan.principalYTD;
        let escrowYTD = loan.escrowYTD;
        if (touchesExistingLoan) {
          currentBalance += loanPaymentPrincipalImpact(existingPayment);
          interestYTD = Math.max(0, interestYTD - loanPaymentYearAmount(existingPayment, "interest", currentYear));
          principalYTD = Math.max(0, principalYTD - loanPaymentYearAmount(existingPayment, "principal", currentYear));
          escrowYTD = Math.max(0, escrowYTD - loanPaymentYearAmount(existingPayment, "escrow", currentYear));
        }
        if (touchesUpdatedLoan) {
          currentBalance = Math.max(0, currentBalance - loanPaymentPrincipalImpact(updatedPayment));
          interestYTD += loanPaymentYearAmount(updatedPayment, "interest", currentYear);
          principalYTD += loanPaymentYearAmount(updatedPayment, "principal", currentYear);
          escrowYTD += loanPaymentYearAmount(updatedPayment, "escrow", currentYear);
        }
        return {
          ...loan,
          currentBalance,
          interestYTD,
          principalYTD,
          escrowYTD,
          nextPayment: nextLoanPaymentDate(updatedPayments, loan.id, loan.nextPayment),
        };
      }));
      const loanRecord = getLoans().find((loan) => loan.id === updatedPayment.loanId)
        || getLoans().find((loan) => loan.id === existingPayment.loanId);
      appendActivityLog({
        action: "update",
        entityType: "loan-payment",
        entityId: updatedPayment.id,
        propertyId: loanRecord?.propertyId,
        unit: "Shared",
        summary: "Loan payment updated.",
        details: `Payment date ${updatedPayment.paymentDate}`,
      });
    },
    deleteLoanPayment(id: string) {
      const loanPayments = getLoanPayments();
      const removedPayment = loanPayments.find((payment) => payment.id === id);
      if (!removedPayment) return;
      const remainingPayments = loanPayments.filter((payment) => payment.id !== id);
      setLoanPayments(remainingPayments);
      setLoans((previous) => previous.map((loan) => {
        if (loan.id !== removedPayment.loanId) return loan;
        const revertedBalance = loan.currentBalance + removedPayment.principal + removedPayment.extraPrincipal;
        const isSameYear = removedPayment.paymentDate.startsWith(new Date().toISOString().slice(0, 4));
        const latestRemainingPayment = remainingPayments
          .filter((payment) => payment.loanId === removedPayment.loanId)
          .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];
        return {
          ...loan,
          currentBalance: revertedBalance,
          interestYTD: isSameYear ? Math.max(0, loan.interestYTD - removedPayment.interest) : loan.interestYTD,
          principalYTD: isSameYear ? Math.max(0, loan.principalYTD - removedPayment.principal - removedPayment.extraPrincipal) : loan.principalYTD,
          escrowYTD: isSameYear ? Math.max(0, loan.escrowYTD - removedPayment.escrow) : loan.escrowYTD,
          nextPayment: latestRemainingPayment ? addMonths(latestRemainingPayment.paymentDate, 1) : removedPayment.paymentDate,
        };
      }));
      const loanRecord = getLoans().find((loan) => loan.id === removedPayment.loanId);
      appendActivityLog({
        action: "delete",
        entityType: "loan-payment",
        entityId: id,
        propertyId: loanRecord?.propertyId,
        unit: "Shared",
        summary: "Loan payment deleted.",
        details: `Payment date ${removedPayment.paymentDate}`,
      });
    },
  };
}
