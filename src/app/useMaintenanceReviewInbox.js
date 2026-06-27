import { useMemo } from "react";
import { buildMaintenanceReviewInbox } from "../features/maintenance/maintenanceReview.js";

export function useMaintenanceReviewInbox({
  assets,
  documents,
  maintenanceVisibleWorkOrders,
  todayIso,
  transactions,
  vendors,
}) {
  return useMemo(
    () => buildMaintenanceReviewInbox(maintenanceVisibleWorkOrders, {
      transactions,
      documents,
      assets,
      vendors,
      todayIso,
    }),
    [maintenanceVisibleWorkOrders, transactions, documents, assets, vendors, todayIso],
  );
}
