import { createFullYearDemoScenario } from "./demoScenario.ts";

const MEANINGFUL_DATA_KEYS = [
  "properties",
  "units",
  "transactions",
  "leases",
  "tenantLedgerEntries",
  "documents",
  "assets",
  "loans",
  "workOrders",
  "vendors",
  "loanPayments",
  "usePeriods",
] as const;

function collectionHasRows(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export function isAppDataEmpty(state: Record<string, unknown> | null | undefined) {
  const source = state && typeof state === "object" ? state : {};
  return !MEANINGFUL_DATA_KEYS.some((key) => collectionHasRows(source[key]));
}

export function getMeaningfulDataCounts(state: Record<string, unknown> | null | undefined) {
  const source = state && typeof state === "object" ? state : {};
  const counts = Object.fromEntries(
    MEANINGFUL_DATA_KEYS.map((key) => [key, Array.isArray(source[key]) ? source[key].length : 0]),
  ) as Record<(typeof MEANINGFUL_DATA_KEYS)[number], number>;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { ...counts, total };
}

function recordLooksLikeDemo(record: unknown) {
  if (!record || typeof record !== "object") return false;
  const values = Object.values(record as Record<string, unknown>)
    .filter((value) => typeof value === "string")
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    value.includes("sample duplex") ||
    value.includes("fictional") ||
    value.includes("demo-") ||
    value.includes("demo "),
  );
}

export function detectDataStatus(state: Record<string, unknown> | null | undefined) {
  const source = state && typeof state === "object" ? state : {};
  const counts = getMeaningfulDataCounts(source);
  const meaningfulRows = MEANINGFUL_DATA_KEYS.flatMap((key) => (Array.isArray(source[key]) ? source[key] : []));
  const demoRecordCount = meaningfulRows.filter(recordLooksLikeDemo).length;
  const demoDataLoaded = meaningfulRows.length > 0 && demoRecordCount >= Math.max(1, Math.ceil(meaningfulRows.length * 0.25));
  const realDataPresent = counts.total > 0 && !demoDataLoaded;
  const status = counts.total === 0 ? "empty" : demoDataLoaded ? "demo_loaded" : "real_data_present";
  return {
    status,
    label: status === "empty" ? "No app records yet" : status === "demo_loaded" ? "Fictional sample data loaded" : "Real data present",
    demoDataLoaded,
    realDataPresent,
    counts,
  };
}

export function buildDemoLoadWarning(state: Record<string, unknown> | null | undefined) {
  const dataStatus = detectDataStatus(state);
  if (dataStatus.counts.total === 0) {
    return {
      severity: "simple",
      requiresTypedConfirmation: false,
      message: "This loads the fictional Sample Duplex dataset into an empty local workspace.",
    };
  }
  return {
    severity: "destructive",
    requiresTypedConfirmation: true,
    message: "This will replace current local app data with fictional sample data. Export a backup first.",
  };
}

export function buildCurrentDataStatusPanel({
  state,
  persistenceHealth,
  backupValidationResult,
}: {
  state: Record<string, unknown> | null | undefined;
  persistenceHealth?: Record<string, unknown> | null;
  backupValidationResult?: Record<string, unknown> | null;
}) {
  const dataStatus = detectDataStatus(state);
  const lastValidationStatus = backupValidationResult?.label || persistenceHealth?.lastBackupValidationLabel || "";
  return {
    ...dataStatus,
    lastBackupAt: String(persistenceHealth?.lastBackupAt || ""),
    backupCount: Number(persistenceHealth?.backupCount || 0),
    lastValidationAt: String(backupValidationResult?.checkedAt || persistenceHealth?.lastBackupValidationAt || ""),
    lastValidationStatus: String(lastValidationStatus || "Not validated"),
    databaseIntegrityOk: persistenceHealth?.databaseIntegrityOk !== false,
    databaseIntegrityLabel: persistenceHealth?.databaseIntegrityOk === false
      ? String(persistenceHealth?.databaseIntegrityResult || "Needs attention")
      : persistenceHealth?.persistenceAvailable
        ? "ok"
        : "Unavailable",
    documentFileCount: Number(persistenceHealth?.documentStorageFileCount || 0),
    missingDocumentFileCount: Number(persistenceHealth?.missingDocumentFileCount || 0),
    orphanDocumentFileCount: Number(persistenceHealth?.orphanDocumentFileCount || 0),
  };
}

export function createSampleDatasetReplacement() {
  const demo = createFullYearDemoScenario();
  return {
    ...demo,
    activityLog: [{
      id: `activity-demo-${Date.now()}`,
      at: new Date().toISOString(),
      action: "restore",
      category: "data-admin",
      entityType: "dataset",
      entityId: "fictional-sample-duplex",
      summary: "Loaded fictional sample dataset",
      details: "Replaced local app records with the fictional Sample Duplex dataset.",
    }],
  };
}

export function prepareDemoScenarioForLoad(_currentState: Record<string, unknown> | null | undefined = {}) {
  const demo = createSampleDatasetReplacement();
  const { appSettings: _appSettings, aiOpenAiApiKey: _apiKey, hasAiOpenAiApiKey: _hasKey, ...safeDemo } = demo as Record<string, unknown>;
  return safeDemo;
}
