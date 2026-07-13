import { useEffect } from "react";
import type { AppSettings } from "../store/appSettings.ts";

type LifecycleActions = {
  materializeRecurringTransactions: (throughDate: string) => void;
  syncLeaseStatuses: (todayIso: string) => void;
};

type UseAppLifecycleEffectsArgs = {
  actions: LifecycleActions;
  appSettings: Pick<AppSettings, "autoMaterializeRecurring" | "leaseAutomationEnabled" | "leaseDesktopNotifications">;
  applyLeaseAutomation: () => Promise<unknown> | unknown;
  isDataHydrated: boolean;
  leaseAutomationDefaults: unknown;
  leases: unknown[];
  notice: string;
  propertyFilter: string;
  recurringThroughDate: string;
  setNotice: (notice: string) => void;
  setPendingDocumentExpenseSource: (source: unknown) => void;
  setPendingDocumentWorkOrderSource: (source: unknown) => void;
  setUnitFilter: (unit: string) => void;
  tenantLedgerEntries: unknown[];
  todayIso: string;
  units: unknown[];
  view: string;
};

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
}: UseAppLifecycleEffectsArgs) {
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
