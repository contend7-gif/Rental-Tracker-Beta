import { useCallback, useMemo, useRef, useState } from "react";
import type { DocumentItem, Vendor, WorkOrder } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createMaintenanceActions } from "./maintenanceStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);
type StateSetter<T> = (updater: StateUpdater<T>) => void;

export function useMaintenanceSlice({
  setDocuments,
  appendActivityLog,
}: {
  setDocuments: StateSetter<DocumentItem>;
  appendActivityLog: AppendActivityLog;
}) {
  const [vendors, setVendorState] = useState<Vendor[]>([]);
  const [workOrders, setWorkOrderState] = useState<WorkOrder[]>([]);
  const vendorsRef = useRef(vendors);
  const workOrdersRef = useRef(workOrders);
  vendorsRef.current = vendors;
  workOrdersRef.current = workOrders;

  const setVendors = useCallback((updater: StateUpdater<Vendor>) => setVendorState(updater), []);
  const setWorkOrders = useCallback((updater: StateUpdater<WorkOrder>) => setWorkOrderState(updater), []);
  const actions = useMemo(() => createMaintenanceActions({
    getVendors: () => vendorsRef.current,
    getWorkOrders: () => workOrdersRef.current,
    setVendors,
    setWorkOrders,
    setDocuments,
    appendActivityLog,
  }), [appendActivityLog, setDocuments, setVendors, setWorkOrders]);

  return { vendors, setVendors, workOrders, setWorkOrders, actions };
}
