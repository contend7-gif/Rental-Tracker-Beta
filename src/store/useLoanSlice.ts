import { useCallback, useMemo, useRef, useState } from "react";
import type { Loan, LoanPayment } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createLoanActions } from "./loanStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useLoanSlice({ appendActivityLog }: { appendActivityLog: AppendActivityLog }) {
  const [loans, setLoanState] = useState<Loan[]>([]);
  const [loanPayments, setLoanPaymentState] = useState<LoanPayment[]>([]);
  const loansRef = useRef(loans);
  const loanPaymentsRef = useRef(loanPayments);
  loansRef.current = loans;
  loanPaymentsRef.current = loanPayments;

  const setLoans = useCallback((updater: StateUpdater<Loan>) => setLoanState(updater), []);
  const setLoanPayments = useCallback((updater: StateUpdater<LoanPayment>) => setLoanPaymentState(updater), []);
  const actions = useMemo(() => createLoanActions({
    getLoans: () => loansRef.current,
    getLoanPayments: () => loanPaymentsRef.current,
    setLoans,
    setLoanPayments,
    appendActivityLog,
  }), [appendActivityLog, setLoanPayments, setLoans]);

  return { loans, setLoans, loanPayments, setLoanPayments, actions };
}
