import { buildDashboardNavigationTarget } from "../store/dashboardContext.ts";

export function useDashboardNavigationController({
  applyDashboardContext,
  dashboardContext,
  openLease,
  setPlanningSubtab,
  setView,
}) {
  const navigateWithDashboardContext = (nextTarget) => {
    const targetInput = typeof nextTarget === "string" ? { view: nextTarget } : (nextTarget || {});
    const target = {
      ...buildDashboardNavigationTarget(targetInput.view || "dashboard", dashboardContext),
      ...Object.fromEntries(
        Object.entries({
          yearFilter: targetInput.yearFilter,
          propertyFilter: targetInput.propertyFilter,
          unitFilter: targetInput.unitFilter,
        }).filter(([, value]) => value != null && value !== ""),
      ),
    };
    setView(target.view);
    applyDashboardContext(target);
  };

  const openLeaseDetail = (lease) => {
    navigateWithDashboardContext("leaseHistory");
    openLease(lease);
  };

  const seeAllLeases = () => {
    navigateWithDashboardContext("leaseHistory");
  };

  const seeAllProperties = () => {
    navigateWithDashboardContext("properties");
  };

  const seeAllTransactions = () => {
    navigateWithDashboardContext("ledger");
  };

  const seeAllNeedsReview = () => {
    navigateWithDashboardContext("tax");
  };

  const openPlanningWorkspace = (subtab = "overview") => {
    setPlanningSubtab(subtab);
    navigateWithDashboardContext("planning");
  };

  const openPropertyFromSnapshot = (propertyId) => {
    const target = buildDashboardNavigationTarget("properties", {
      ...dashboardContext,
      propertyFilter: propertyId,
      unitFilter: "all",
    });
    setView(target.view);
    applyDashboardContext(target);
  };

  return {
    navigateWithDashboardContext,
    openLeaseDetail,
    openPlanningWorkspace,
    openPropertyFromSnapshot,
    seeAllLeases,
    seeAllNeedsReview,
    seeAllProperties,
    seeAllTransactions,
  };
}
