import type { Loan, LoanPayment } from "../models.ts";
import { loanIdsMatch } from "./loans.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";

function addMonths(dateStr: string, monthsToAdd: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

function firstMortgageDueDateAfterOrigination(dateStr: string) {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + (day === 1 ? 1 : 2));
  return date.toISOString().slice(0, 10);
}

export function coveredLoanPaymentMonths(paymentDate: string) {
  const normalized = String(paymentDate || "").slice(0, 10);
  const month = normalized.slice(0, 7);
  if (!month) return [];
  const months = [month];
  // Preserve the Loans workspace convention for payments made near month-end.
  if (Number(normalized.slice(8, 10)) >= 25) {
    const nextMonth = addMonths(`${month}-01`, 1).slice(0, 7);
    if (nextMonth) months.push(nextMonth);
  }
  return months;
}

type ReviewContext = { yearFilter?: string | number; todayIso?: string };

export function getExpectedLoanPaymentMonths(loan: Loan, context: ReviewContext = {}) {
  const year = String(context.yearFilter || new Date().getFullYear());
  const todayIso = context.todayIso || toLocalIsoDate();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const cappedEnd = todayIso < yearEnd ? todayIso : yearEnd;
  const originatedOn = String(loan?.originatedOn || yearStart).slice(0, 10);
  const firstDueDate = firstMortgageDueDateAfterOrigination(originatedOn) || originatedOn;
  if (!loan || firstDueDate > cappedEnd || yearStart > cappedEnd) return [];

  let cursor = `${(firstDueDate > yearStart ? firstDueDate : yearStart).slice(0, 7)}-01`;
  const months: string[] = [];
  while (cursor && cursor <= cappedEnd) {
    months.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function getMissingLoanPaymentMonths(loan: Loan, loanPayments: LoanPayment[] = [], context: ReviewContext = {}) {
  // Coverage crosses year boundaries; cash totals remain scoped to the payment year.
  const recordedMonths = new Set(loanPayments
    .filter((payment) => loanIdsMatch(payment.loanId, loan?.id))
    .flatMap((payment) => coveredLoanPaymentMonths(payment.paymentDate)));
  return getExpectedLoanPaymentMonths(loan, context).filter((month) => !recordedMonths.has(month));
}
