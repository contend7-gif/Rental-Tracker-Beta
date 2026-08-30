import type { DocumentItem } from "../models.ts";

export type DesktopResult = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export type DesktopDocumentOcrSupport = DesktopResult & {
  supported?: boolean;
  platform?: string;
  engine?: string;
};

export type DesktopDiagnosticsResult = DesktopResult & {
  checkedAt?: string;
  recentEvents?: unknown[];
};

export type DesktopPersistenceLoadResult = DesktopResult & {
  hasData?: boolean;
  backup?: unknown;
  meta?: { lastBackupAt?: string; [key: string]: unknown };
};

export type DesktopPersistenceHealth = DesktopResult & {
  lastBackupAt?: string;
  structuredDataRecordCount?: number;
  [key: string]: unknown;
};

export type DesktopPersistenceApi = {
  isAvailable: () => Promise<DesktopResult & { available?: boolean; databasePath?: string; userDataPath?: string }>;
  loadAppData: (options?: Record<string, unknown>) => Promise<DesktopPersistenceLoadResult>;
  loadDeferredCollections: (collectionKeys: string[]) => Promise<DesktopResult & Record<string, unknown>>;
  queryActivityLogPage: (options?: Record<string, unknown>) => Promise<DesktopResult & Record<string, unknown>>;
  readDocumentDataUrl: (document: Pick<DocumentItem, "id" | "relativePath" | "filePath" | "dataUrl"> | Record<string, unknown>) => Promise<DesktopResult & { dataUrl?: string }>;
  saveAppData: (payload: Record<string, unknown>) => Promise<DesktopResult & Record<string, unknown>>;
  createRestorePoint: (payload: Record<string, unknown>) => Promise<DesktopResult & Record<string, unknown>>;
  importLegacyLocalStorageData: (payload: Record<string, unknown>) => Promise<DesktopResult & Record<string, unknown>>;
  exportBackup: () => Promise<DesktopResult & Record<string, unknown>>;
  exportBackupArchive: () => Promise<DesktopResult & { buffer?: ArrayBuffer; missingDocumentFiles?: string[]; exportedAt?: string; fileName?: string }>;
  importBackupArchive: (archiveBuffer: ArrayBuffer) => Promise<DesktopResult & Record<string, unknown>>;
  getHealth: () => Promise<DesktopPersistenceHealth>;
  validateLatestBackup: () => Promise<DesktopResult & Record<string, unknown>>;
  openDataFolder: () => Promise<DesktopResult & { path?: string }>;
};

export type CompanionSubmission = {
  id: string;
  status: "pending" | "claimed" | "imported";
  kind: "receipt" | "maintenance";
  propertyLabel?: string | null;
  unitLabel?: string | null;
  note?: string | null;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanionMileageEntry = {
  id: string;
  status: "pending" | "claimed" | "imported";
  propertyLabel: string;
  unitLabel?: string | null;
  tripDate: string;
  businessMiles: number;
  purpose: string;
  startLocation?: string | null;
  endLocation?: string | null;
  note?: string | null;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DesktopCompanionApi = {
  getStatus: () => Promise<DesktopResult & { configured?: boolean; siteUrl?: string; hasSyncSecret?: boolean; hasSitesBypassToken?: boolean }>;
  configure: (payload: { siteUrl: string; syncSecret: string; sitesBypassToken?: string }) => Promise<DesktopResult & { configured?: boolean; siteUrl?: string }>;
  disconnect: () => Promise<DesktopResult & { configured?: boolean; siteUrl?: string }>;
  list: () => Promise<DesktopResult & { submissions?: CompanionSubmission[] }>;
  syncPropertyCatalog: (catalog: {
    version: 1;
    properties: Array<{
      id: string;
      label: string;
      addressLabel: string;
      units: Array<{ id: string; label: string }>;
    }>;
  }) => Promise<DesktopResult & { propertyCount?: number; unitCount?: number; updatedAt?: string }>;
  listMileage: () => Promise<DesktopResult & { mileageEntries?: CompanionMileageEntry[] }>;
  claimMileage: (id: string) => Promise<DesktopResult & { mileageEntry?: CompanionMileageEntry }>;
  completeMileage: (id: string) => Promise<DesktopResult & { mileageEntry?: CompanionMileageEntry }>;
  claim: (id: string) => Promise<DesktopResult & { submission?: CompanionSubmission }>;
  download: (id: string) => Promise<DesktopResult & { submission?: CompanionSubmission; dataUrl?: string }>;
  remove: (id: string) => Promise<DesktopResult>;
  complete: (id: string) => Promise<DesktopResult & { submission?: CompanionSubmission }>;
};

declare global {
  interface Window {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  }

  interface IdleDeadline {
    didTimeout: boolean;
    timeRemaining: () => number;
  }

  type IdleRequestCallback = (deadline: IdleDeadline) => void;
  type IdleRequestOptions = { timeout?: number };

  interface Window {
    desktopDiagnostics?: { run: () => Promise<DesktopDiagnosticsResult> };
    desktopCompanion?: DesktopCompanionApi;
    desktopDocumentAi?: { analyze: (payload: Record<string, unknown>) => Promise<DesktopResult & { analysis?: unknown }> };
    desktopDocumentOcr?: {
      isSupported: () => Promise<DesktopDocumentOcrSupport>;
      extract: (payload: Record<string, unknown>) => Promise<DesktopResult & { text?: string; truncated?: boolean; processedPages?: number }>;
    };
    desktopDocumentOpen?: { openExternal: (payload: Record<string, unknown>) => Promise<DesktopResult> };
    desktopPersistence?: DesktopPersistenceApi;
    desktopStatementPdf?: { savePdf: (payload: Record<string, unknown>) => Promise<DesktopResult & { path?: string }> };
    desktopSecrets?: {
      isEncryptionAvailable: () => Promise<DesktopResult & { available?: boolean; backend?: string }>;
      getSecret: (key: string) => Promise<DesktopResult & { value?: string; hasValue?: boolean }>;
      setSecret: (key: string, value: string) => Promise<DesktopResult & { hasValue?: boolean }>;
      deleteSecret: (key: string) => Promise<DesktopResult>;
    };
    desktopUpdater?: {
      check: () => Promise<DesktopResult & Record<string, unknown>>;
      installNow: () => Promise<DesktopResult & Record<string, unknown>>;
      getState: () => Promise<Record<string, unknown>>;
      onStatus: (callback: (payload: Record<string, unknown>) => void) => () => void;
    };
  }
}
