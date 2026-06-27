export function usePrimaryAction({
  openDashboardQuickAdd,
  openNewLeaseForUnit,
  propertyFilter,
  setPropertyQuickAddOpen,
  startAddAsset,
  startAddLoan,
  unitFilter,
  view,
}) {
  if (view === "loans") {
    return { label: "Add Loan", onClick: startAddLoan, prefetchKey: "loanEditor" };
  }
  if (view === "assets") {
    return { label: "Add Asset", onClick: startAddAsset, prefetchKey: "assetEditor" };
  }
  if (view === "properties") {
    return { label: "Add Property", onClick: () => setPropertyQuickAddOpen(true), prefetchKey: "propertyQuickAdd" };
  }
  if (view === "leaseHistory" && propertyFilter !== "all" && unitFilter !== "all") {
    return { label: "Add Lease", onClick: () => openNewLeaseForUnit(propertyFilter, unitFilter), prefetchKey: "leaseEditor" };
  }
  if (view === "dashboard") {
    return { label: "Quick Add", onClick: openDashboardQuickAdd, prefetchKey: "dashboardQuickAdd" };
  }
  return null;
}
