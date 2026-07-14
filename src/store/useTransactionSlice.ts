import { useCallback, useMemo, useRef, useState } from "react";
import type { Asset, DocumentItem, Lease, TenantLedgerEntry, Transaction, Unit, UsePeriod, WorkOrder } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createTransactionActions } from "./transactionStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useTransactionSlice({
  usePeriods,
  leases,
  units,
  setDocuments,
  setWorkOrders,
  setTenantLedgerEntries,
  setAssets,
  appendActivityLog,
}: {
  usePeriods: UsePeriod[];
  leases: Lease[];
  units: Unit[];
  setDocuments: (updater: StateUpdater<DocumentItem>) => void;
  setWorkOrders: (updater: StateUpdater<WorkOrder>) => void;
  setTenantLedgerEntries: (updater: StateUpdater<TenantLedgerEntry>) => void;
  setAssets: (updater: StateUpdater<Asset>) => void;
  appendActivityLog: AppendActivityLog;
}) {
  const [transactions, setTransactionState] = useState<Transaction[]>([]);
  const transactionsRef = useRef(transactions);
  const usePeriodsRef = useRef(usePeriods);
  const leasesRef = useRef(leases);
  const unitsRef = useRef(units);
  transactionsRef.current = transactions;
  usePeriodsRef.current = usePeriods;
  leasesRef.current = leases;
  unitsRef.current = units;

  const setTransactions = useCallback((updater: StateUpdater<Transaction>) => setTransactionState(updater), []);
  const actions = useMemo(() => createTransactionActions({
    getTransactions: () => transactionsRef.current,
    getUsePeriods: () => usePeriodsRef.current,
    getLeases: () => leasesRef.current,
    getUnits: () => unitsRef.current,
    setTransactions,
    setDocuments,
    setWorkOrders,
    setTenantLedgerEntries,
    setAssets,
    appendActivityLog,
  }), [appendActivityLog, setAssets, setDocuments, setTenantLedgerEntries, setTransactions, setWorkOrders]);

  return { transactions, setTransactions, actions };
}
