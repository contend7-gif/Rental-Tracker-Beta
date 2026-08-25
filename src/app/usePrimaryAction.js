export function usePrimaryAction({
  openDocumentImportPicker,
  openNewLeaseForUnit,
  propertyFilter,
  setPropertyQuickAddOpen,
  setView,
  startAddAsset,
  startAddLoan,
  startNewWorkOrder,
  unitFilter,
}) {
  const hasUnitScope = propertyFilter !== "all" && unitFilter !== "all";

  return {
    label: "New",
    items: [
      {
        key: "transaction",
        label: "Transaction",
        detail: "Record rent, income, or an expense.",
        onClick: () => setView("quickAdd"),
      },
      {
        key: "lease",
        label: "Lease",
        detail: hasUnitScope ? "Add a lease for the selected unit." : "Open leases and choose a unit.",
        onClick: () => hasUnitScope ? openNewLeaseForUnit(propertyFilter, unitFilter) : setView("leaseHistory"),
        prefetchKey: hasUnitScope ? "leaseEditor" : "",
      },
      {
        key: "workOrder",
        label: "Work order",
        detail: "Track a repair or maintenance task.",
        onClick: startNewWorkOrder,
      },
      {
        key: "document",
        label: "Document",
        detail: "Upload a receipt, lease, or supporting file.",
        onClick: openDocumentImportPicker,
        prefetchKey: "documentImport",
      },
      {
        key: "property",
        label: "Property",
        detail: "Add a property to the portfolio.",
        onClick: () => setPropertyQuickAddOpen(true),
        prefetchKey: "propertyQuickAdd",
      },
      {
        key: "asset",
        label: "Depreciation asset",
        detail: "Add an asset and its tax basis.",
        onClick: startAddAsset,
        prefetchKey: "assetEditor",
      },
      {
        key: "loan",
        label: "Loan",
        detail: "Add mortgage or other property debt.",
        onClick: startAddLoan,
        prefetchKey: "loanEditor",
      },
    ],
  };
}
