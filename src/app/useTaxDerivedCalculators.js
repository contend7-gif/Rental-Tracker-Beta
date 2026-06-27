import { useMemo } from "react";
import {
  deductibleAmountForTransaction,
  deductibleMortgageInterest,
  getRentalUsePctForDate,
  getRentalUsePctForRange,
} from "../domain/accounting.ts";
import { deriveObservedLoanDefaults, loanIdsMatch } from "../domain/loans.ts";

export function useTaxDerivedCalculators({
  leases,
  loanById,
  loanPayments,
  loans,
  units,
  usePeriods,
}) {
  const effectiveTransactionRentalUsePct = (txn) =>
    (String(txn.servicePeriodStart || "").trim() && String(txn.servicePeriodEnd || "").trim() && String(txn.servicePeriodEnd || "") >= String(txn.servicePeriodStart || ""))
      ? getRentalUsePctForRange({
          propertyId: txn.propertyId,
          unit: txn.unit,
          startDate: String(txn.servicePeriodStart || ""),
          endDate: String(txn.servicePeriodEnd || ""),
          usePeriods,
          leases,
          units,
          fallbackOwnerUsePct: Number(txn.ownerUsePct || 0),
          ownerUsePctOverride: Boolean(txn.ownerUsePctOverride),
        })
      : getRentalUsePctForDate({
          propertyId: txn.propertyId,
          unit: txn.unit,
          date: txn.date,
          usePeriods,
          leases,
          units,
          fallbackOwnerUsePct: Number(txn.ownerUsePct || 0),
          ownerUsePctOverride: Boolean(txn.ownerUsePctOverride),
        });

  const effectiveTransactionDeductibleAmount = (txn) =>
    deductibleAmountForTransaction({
      amount: Number(txn.amount || 0),
      type: txn.type,
      capitalImprovement: Boolean(txn.capitalImprovement),
      rentalUsePct: effectiveTransactionRentalUsePct(txn),
    });

  const effectiveLoanPaymentDeductibleInterest = (payment) => {
    const loan = loanById[payment.loanId];
    if (!loan) return Number(payment.deductibleInterest || 0);
    return deductibleMortgageInterest({
      interest: Number(payment.interest || 0),
      propertyId: loan.propertyId,
      date: payment.paymentDate,
      usePeriods,
      leases,
      units,
      sharedUnit: "Shared",
    });
  };

  const effectiveLoanPaymentRentalUsePct = (payment) => {
    const loan = loanById[payment.loanId];
    if (!loan) return 1;
    return getRentalUsePctForDate({
      propertyId: loan.propertyId,
      unit: "Shared",
      date: payment.paymentDate,
      usePeriods,
      leases,
      units,
      fallbackOwnerUsePct: 0,
    });
  };

  const observedLoanDefaultsById = useMemo(
    () =>
      Object.fromEntries(
        loans.map((loan) => [
          loan.id,
          deriveObservedLoanDefaults(
            loan,
            loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan.id)),
            effectiveLoanPaymentDeductibleInterest,
          ),
        ]),
      ),
    [loans, loanPayments, loanById, usePeriods, leases, units],
  );

  return {
    effectiveLoanPaymentDeductibleInterest,
    effectiveLoanPaymentRentalUsePct,
    effectiveTransactionDeductibleAmount,
    observedLoanDefaultsById,
  };
}
