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

declare global {
  interface Window {
    desktopDiagnostics?: { run: () => Promise<DesktopDiagnosticsResult> };
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
