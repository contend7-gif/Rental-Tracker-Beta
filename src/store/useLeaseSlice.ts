import { useCallback, useMemo, useRef, useState } from "react";
import type { DocumentItem, Lease, TenantLedgerEntry, Unit, UsePeriod } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createLeaseActions } from "./leaseStore.ts";
import { createTenantLedgerActions } from "./tenantLedgerStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useLeaseSlice({
  usePeriods,
  setDocuments,
  setUnits,
  appendActivityLog,
}: {
  usePeriods: UsePeriod[];
  setDocuments: (updater: StateUpdater<DocumentItem>) => void;
  setUnits: (updater: StateUpdater<Unit>) => void;
  appendActivityLog: AppendActivityLog;
}) {
  const [leases, setLeaseState] = useState<Lease[]>([]);
  const [tenantLedgerEntries, setTenantLedgerEntryState] = useState<TenantLedgerEntry[]>([]);
  const leasesRef = useRef(leases);
  const tenantLedgerEntriesRef = useRef(tenantLedgerEntries);
  const usePeriodsRef = useRef(usePeriods);
  leasesRef.current = leases;
  tenantLedgerEntriesRef.current = tenantLedgerEntries;
  usePeriodsRef.current = usePeriods;

  const setLeases = useCallback((updater: StateUpdater<Lease>) => setLeaseState(updater), []);
  const setTenantLedgerEntries = useCallback((updater: StateUpdater<TenantLedgerEntry>) => setTenantLedgerEntryState(updater), []);
  const actions = useMemo(() => ({
    ...createLeaseActions({
      getLeases: () => leasesRef.current,
      getUsePeriods: () => usePeriodsRef.current,
      setLeases,
      setDocuments,
      setTenantLedgerEntries,
      setUnits,
      appendActivityLog,
    }),
    ...createTenantLedgerActions({
      getEntries: () => tenantLedgerEntriesRef.current,
      getLeases: () => leasesRef.current,
      setEntries: setTenantLedgerEntries,
      appendActivityLog,
    }),
  }), [appendActivityLog, setDocuments, setLeases, setTenantLedgerEntries, setUnits]);

  return { leases, setLeases, tenantLedgerEntries, setTenantLedgerEntries, actions };
}
