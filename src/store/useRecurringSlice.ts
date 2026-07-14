import { useCallback, useMemo, useRef, useState } from "react";
import type { RecurringDraft, RecurringTemplate, Transaction, UsePeriod } from "../models.ts";
import { createRecurringActions } from "./recurringStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useRecurringSlice({
  transactions,
  usePeriods,
  setTransactions,
}: {
  transactions: Transaction[];
  usePeriods: UsePeriod[];
  setTransactions: (updater: StateUpdater<Transaction>) => void;
}) {
  const [recurringTemplates, setTemplateState] = useState<RecurringTemplate[]>([]);
  const [recurringDrafts, setDraftState] = useState<RecurringDraft[]>([]);
  const templatesRef = useRef(recurringTemplates);
  const draftsRef = useRef(recurringDrafts);
  const transactionsRef = useRef(transactions);
  const usePeriodsRef = useRef(usePeriods);
  templatesRef.current = recurringTemplates;
  draftsRef.current = recurringDrafts;
  transactionsRef.current = transactions;
  usePeriodsRef.current = usePeriods;
  const setRecurringTemplates = useCallback((updater: StateUpdater<RecurringTemplate>) => setTemplateState(updater), []);
  const setRecurringDrafts = useCallback((updater: StateUpdater<RecurringDraft>) => setDraftState(updater), []);
  const actions = useMemo(() => createRecurringActions({
    getTemplates: () => templatesRef.current,
    getDrafts: () => draftsRef.current,
    getTransactions: () => transactionsRef.current,
    getUsePeriods: () => usePeriodsRef.current,
    setTemplates: setRecurringTemplates,
    setDrafts: setRecurringDrafts,
    setTransactions,
  }), [setRecurringDrafts, setRecurringTemplates, setTransactions]);
  return { recurringTemplates, setRecurringTemplates, recurringDrafts, setRecurringDrafts, actions };
}
