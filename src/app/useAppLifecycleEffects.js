import { useEffect } from "react";

export function useAppLifecycleEffects({
  actions,
  appSettings,
  applyLeaseAutomation,
  isDataHydrated,
  leaseAutomationDefaults,
  leases,
  notice,
  propertyFilter,
  recurringThroughDate,
  setNotice,
  setPendingDocumentExpenseSource,
  setPendingDocumentWorkOrderSource,
  setUnitFilter,
  tenantLedgerEntries,
  todayIso,
  units,
  view,
}) {
  useEffect(() => {
    setUnitFilter("all");
  }, [propertyFilter, setUnitFilter]);

  useEffect(() => {
    if (!appSettings.autoMaterializeRecurring) return;
    actions.materializeRecurringTransactions(recurringThroughDate);
  }, [appSettings.autoMaterializeRecurring, actions, recurringThroughDate]);

  useEffect(() => {
    void applyLeaseAutomation();
  }, [
    appSettings.leaseAutomationEnabled,
    appSettings.leaseDesktopNotifications,
    isDataHydrated,
    leaseAutomationDefaults,
    leases,
    tenantLedgerEntries,
    actions,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [notice, setNotice]);

  useEffect(() => {
    actions.syncLeaseStatuses(todayIso);
  }, [actions, leases, todayIso, units]);

  useEffect(() => {
    if (view !== "quickAdd") {
      setPendingDocumentExpenseSource(null);
    }
  }, [view, setPendingDocumentExpenseSource]);

  useEffect(() => {
    if (view !== "maintenance") {
      setPendingDocumentWorkOrderSource(null);
    }
  }, [view, setPendingDocumentWorkOrderSource]);
}
