import { useMemo } from "react";
import { isAppDataEmpty } from "../domain/dataSafety.ts";

export function useAppDataSnapshot({
  assets,
  documents,
  leases,
  loanPayments,
  loans,
  properties,
  recurringDrafts,
  recurringTemplates,
  tenantLedgerEntries,
  transactions,
  units,
  usePeriods,
  vendors,
  workOrders,
}) {
  const currentAppDataSnapshot = useMemo(
    () => ({
      transactions,
      assets,
      documents,
      leases,
      tenantLedgerEntries,
      loans,
      loanPayments,
      usePeriods,
      recurringTemplates,
      recurringDrafts,
      vendors,
      workOrders,
      properties,
      units,
    }),
    [
      assets,
      documents,
      leases,
      loanPayments,
      loans,
      properties,
      recurringDrafts,
      recurringTemplates,
      tenantLedgerEntries,
      transactions,
      units,
      usePeriods,
      vendors,
      workOrders,
    ],
  );

  return {
    currentAppDataSnapshot,
    hasAnyData: !isAppDataEmpty(currentAppDataSnapshot),
  };
}
