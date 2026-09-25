import { useCallback, useMemo, useRef, useState } from "react";
import type { MileageEntry, Transaction } from "../models.ts";
import { createDemoDataState, normalizeBackupData, type RentalStoreData } from "./rentalStoreData.ts";
import { createUnitActions } from "./unitStore.ts";
import { createLeaseExtensionActions } from "./leaseExtensionStore.ts";
import { useActivitySlice } from "./useActivitySlice.ts";
import { useAssetSlice } from "./useAssetSlice.ts";
import { useDocumentSlice } from "./useDocumentSlice.ts";
import { useLeaseSlice } from "./useLeaseSlice.ts";
import { useLoanSlice } from "./useLoanSlice.ts";
import { useMaintenanceSlice } from "./useMaintenanceSlice.ts";
import { usePropertySlice } from "./usePropertySlice.ts";
import { useRecurringSlice } from "./useRecurringSlice.ts";
import { useStableActions } from "./useStableActions.ts";
import { useTransactionSlice } from "./useTransactionSlice.ts";
import { useUsePeriodSlice } from "./useUsePeriodSlice.ts";

export function useRentalStore(auditContext: { actorName?: string; actorRole?: string } = {}) {
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const {
    activityLog,
    setActivityLog,
    actions: activityActions,
  } = useActivitySlice(auditContext);
  const { appendActivityLog } = activityActions;
  const {
    usePeriods,
    setUsePeriods,
    actions: usePeriodActions,
  } = useUsePeriodSlice({ appendActivityLog });
  const {
    documents,
    setDocuments,
    actions: documentActions,
  } = useDocumentSlice({ appendActivityLog });
  const {
    vendors,
    setVendors,
    workOrders,
    setWorkOrders,
    actions: maintenanceActions,
  } = useMaintenanceSlice({ setDocuments, appendActivityLog });
  const transactionsRef = useRef<Transaction[]>([]);
  const getTransactions = useCallback(() => transactionsRef.current, []);
  const {
    assets,
    setAssets,
    actions: assetActions,
  } = useAssetSlice({ getTransactions, setWorkOrders, appendActivityLog });
  const {
    properties,
    setProperties,
    units,
    setUnits,
    actions: propertyActions,
  } = usePropertySlice({ setAssets, appendActivityLog });
  const {
    leases,
    setLeases,
    tenantLedgerEntries,
    setTenantLedgerEntries,
    actions: leaseActions,
  } = useLeaseSlice({ usePeriods, setDocuments, setUnits, appendActivityLog });
  const {
    loans,
    setLoans,
    loanPayments,
    setLoanPayments,
    actions: loanActions,
  } = useLoanSlice({ appendActivityLog });
  const {
    transactions,
    setTransactions,
    actions: transactionActions,
  } = useTransactionSlice({
    usePeriods,
    leases,
    units,
    setDocuments,
    setWorkOrders,
    setTenantLedgerEntries,
    setAssets,
    appendActivityLog,
  });
  transactionsRef.current = transactions;
  const {
    recurringTemplates,
    setRecurringTemplates,
    recurringDrafts,
    setRecurringDrafts,
    actions: recurringActions,
  } = useRecurringSlice({ transactions, usePeriods, setTransactions });

  const applyStoreData = (data: RentalStoreData) => {
    setTransactions(data.transactions);
    setMileageEntries(data.mileageEntries);
    setAssets(data.assets);
    setDocuments(data.documents);
    setLoans(data.loans);
    setLoanPayments(data.loanPayments);
    setUsePeriods(data.usePeriods);
    setRecurringTemplates(data.recurringTemplates);
    setRecurringDrafts(data.recurringDrafts);
    setTenantLedgerEntries(data.tenantLedgerEntries);
    setActivityLog(data.activityLog);
    setLeases(data.leases);
    setVendors(data.vendors);
    setWorkOrders(data.workOrders);
    setProperties(data.properties);
    setUnits(data.units);
  };

  const unitActions = useMemo(() => createUnitActions({
    getProperties: () => properties,
    getUnits: () => units,
    getTransactions: () => transactions,
    getLeases: () => leases,
    getDocuments: () => documents,
    getWorkOrders: () => workOrders,
    getAssets: () => assets,
    getUsePeriods: () => usePeriods,
    getRecurringTemplates: () => recurringTemplates,
    getRecurringDrafts: () => recurringDrafts,
    setUnits,
    setLeases,
    appendActivityLog,
  }), [appendActivityLog, assets, documents, leases, properties, recurringDrafts, recurringTemplates, setLeases, setUnits, transactions, units, usePeriods, workOrders]);

  const actionImplementations = useMemo(
    () => ({
      async loadDemoData() {
        const demo = await createDemoDataState();
        applyStoreData(demo);
      },
      restoreBackupData(rawData: unknown) {
        const backup = normalizeBackupData(rawData);
        applyStoreData(backup);
      },
      saveMileageEntry(entry: MileageEntry) {
        setMileageEntries((previous) => previous.some((item) => item.id === entry.id)
          ? previous.map((item) => item.id === entry.id ? entry : item)
          : [entry, ...previous]);
        appendActivityLog({ action: "update", entityType: "mileage", entityId: entry.id, propertyId: entry.propertyId, unit: entry.unit, summary: "Mileage trip saved.", details: entry.purpose });
      },
      deleteMileageEntry(id: string) {
        if (transactions.some((transaction) => transaction.status === "active" && transaction.mileageEntryIds?.includes(id))) return false;
        setMileageEntries((previous) => previous.filter((item) => item.id !== id));
        appendActivityLog({ action: "delete", entityType: "mileage", entityId: id, summary: "Unposted mileage trip deleted." });
        return true;
      },
      ...activityActions,
      ...transactionActions,
      ...recurringActions,
      ...loanActions,
      ...leaseActions,
      ...createLeaseExtensionActions({
        getLeases: () => leases,
        getLedgerEntries: () => tenantLedgerEntries,
        getTransactions: () => transactions,
        getDocuments: () => documents,
        setLeases,
        setLedgerEntries: setTenantLedgerEntries,
        setTransactions,
        setDocuments,
        appendActivityLog,
      }),
      ...maintenanceActions,
      ...assetActions,
      ...documentActions,
      ...propertyActions,
      ...unitActions,
      ...usePeriodActions,
    }),
    [activityActions, appendActivityLog, assetActions, documentActions, documents, leaseActions, leases, loanActions, maintenanceActions, properties, recurringActions, setDocuments, setLeases, setTenantLedgerEntries, setTransactions, tenantLedgerEntries, transactions, unitActions, usePeriodActions],
  );
  const actions = useStableActions(actionImplementations);

  return { transactions, mileageEntries, assets, documents, leases, tenantLedgerEntries, vendors, workOrders, loans, loanPayments, usePeriods, recurringTemplates, recurringDrafts, properties, units, activityLog, actions };
}
