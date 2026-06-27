import { detectDataStatus } from "./dataSafety.ts";

export type RealDataChecklistStatus = "complete" | "needs_setup" | "needs_review" | "optional";

export type RealDataChecklistItem = {
  key: string;
  label: string;
  status: RealDataChecklistStatus;
  helperText: string;
  targetView?: string;
};

function item(key: string, label: string, status: RealDataChecklistStatus, helperText: string, targetView?: string): RealDataChecklistItem {
  return { key, label, status, helperText, targetView };
}

function hasRows(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export function buildRealDataChecklist({
  state,
  persistenceHealth,
  backupValidationResult,
}: {
  state: Record<string, unknown> | null | undefined;
  persistenceHealth?: Record<string, unknown> | null;
  backupValidationResult?: Record<string, unknown> | null;
}) {
  const source = state && typeof state === "object" ? state : {};
  const dataStatus = detectDataStatus(source);
  const validationStatus = String(backupValidationResult?.status || persistenceHealth?.lastBackupValidationStatus || "").toLowerCase();
  const backupValidated = ["valid", "valid_with_warnings", "warning"].includes(validationStatus);
  const databaseOk = persistenceHealth?.persistenceAvailable ? persistenceHealth.databaseIntegrityOk !== false : false;
  const documentsHealthy = Number(persistenceHealth?.missingDocumentFileCount || 0) === 0;
  const items: RealDataChecklistItem[] = [
    item(
      "fictional-data-awareness",
      "Know whether this workspace is sample or real",
      dataStatus.demoDataLoaded ? "needs_review" : "complete",
      dataStatus.demoDataLoaded
        ? "Fictional sample data is loaded. Export or replace it before relying on real records."
        : "The workspace is not currently dominated by the fictional sample dataset.",
      "settings",
    ),
    item(
      "backup-before-real-records",
      "Create and validate a backup",
      backupValidated ? "complete" : hasRows(source.properties) ? "needs_review" : "needs_setup",
      backupValidated
        ? "Latest backup validation is available for restore confidence."
        : "Create a restore point and validate it before entering real rental records.",
      "settings",
    ),
    item(
      "database-health",
      "Confirm local database and document storage health",
      databaseOk && documentsHealthy ? "complete" : "needs_review",
      databaseOk && documentsHealthy
        ? "SQLite integrity and document file checks look healthy."
        : "Review Settings data status before adding more real records.",
      "settings",
    ),
    item(
      "first-property",
      "Add the first real property and unit",
      hasRows(source.properties) && hasRows(source.units) ? "complete" : "needs_setup",
      "Create the real property and unit shell before transactions, leases, loans, or documents.",
      "properties",
    ),
    item(
      "first-source-record",
      "Add the first real source record",
      hasRows(source.transactions) || hasRows(source.documents) || hasRows(source.workOrders) ? "complete" : "needs_setup",
      "Start with an imported statement row, uploaded source document, or maintenance work order.",
      "transactions",
    ),
    item(
      "supporting-workflows",
      "Open supporting workflows only when applicable",
      hasRows(source.leases) || hasRows(source.loans) || hasRows(source.assets) || hasRows(source.tenantLedgerEntries) ? "complete" : "optional",
      "Leases, loans, assets, and tenant ledger entries can wait until they apply.",
      "leases",
    ),
  ];
  const blockingItems = items.filter((entry) => entry.status === "needs_setup" || entry.status === "needs_review");
  return {
    status: blockingItems.length === 0 ? "complete" : "needs_setup",
    label: blockingItems.length === 0 ? "Ready for real records" : `${blockingItems.length} real-data setup item${blockingItems.length === 1 ? "" : "s"}`,
    items,
    counts: {
      complete: items.filter((entry) => entry.status === "complete").length,
      needsSetup: items.filter((entry) => entry.status === "needs_setup").length,
      needsReview: items.filter((entry) => entry.status === "needs_review").length,
      optional: items.filter((entry) => entry.status === "optional").length,
    },
  };
}
