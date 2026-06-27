const { contextBridge, ipcRenderer } = require("electron");

const UPDATE_STATUS_CHANNEL = "app-update:status";
const NOTIFICATION_SEND_CHANNEL = "app-notify:send";
const NOTIFICATION_SUPPORTED_CHANNEL = "app-notify:supported";
const DOCUMENT_OCR_SUPPORTED_CHANNEL = "document-ocr:supported";
const DOCUMENT_OCR_EXTRACT_CHANNEL = "document-ocr:extract";
const DOCUMENT_AI_ANALYZE_CHANNEL = "document-ai:analyze";
const DOCUMENT_OPEN_EXTERNAL_CHANNEL = "document-open:external";
const STATEMENT_PDF_SAVE_CHANNEL = "statement-pdf:save";
const DESKTOP_DIAGNOSTICS_RUN_CHANNEL = "desktop-diagnostics:run";
const PERSISTENCE_IS_AVAILABLE_CHANNEL = "persistence:is-available";
const PERSISTENCE_LOAD_APP_DATA_CHANNEL = "persistence:load-app-data";
const PERSISTENCE_SAVE_APP_DATA_CHANNEL = "persistence:save-app-data";
const PERSISTENCE_IMPORT_LEGACY_LOCAL_STORAGE_DATA_CHANNEL = "persistence:import-legacy-local-storage-data";
const PERSISTENCE_EXPORT_BACKUP_CHANNEL = "persistence:export-backup";
const PERSISTENCE_EXPORT_BACKUP_ARCHIVE_CHANNEL = "persistence:export-backup-archive";
const PERSISTENCE_IMPORT_BACKUP_ARCHIVE_CHANNEL = "persistence:import-backup-archive";
const PERSISTENCE_GET_HEALTH_CHANNEL = "persistence:get-health";
const PERSISTENCE_VALIDATE_LATEST_BACKUP_CHANNEL = "persistence:validate-latest-backup";
const PERSISTENCE_OPEN_DATA_FOLDER_CHANNEL = "persistence:open-data-folder";
const SECRETS_IS_ENCRYPTION_AVAILABLE_CHANNEL = "secrets:is-encryption-available";
const SECRETS_GET_CHANNEL = "secrets:get";
const SECRETS_SET_CHANNEL = "secrets:set";
const SECRETS_DELETE_CHANNEL = "secrets:delete";

contextBridge.exposeInMainWorld("desktopUpdater", {
  check: () => ipcRenderer.invoke("app-update:check"),
  installNow: () => ipcRenderer.invoke("app-update:install"),
  getState: () => ipcRenderer.invoke("app-update:get-state"),
  onStatus: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const handler = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on(UPDATE_STATUS_CHANNEL, handler);

    return () => {
      ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, handler);
    };
  },
});

contextBridge.exposeInMainWorld("desktopNotifications", {
  isSupported: () => ipcRenderer.invoke(NOTIFICATION_SUPPORTED_CHANNEL),
  notify: (payload) => ipcRenderer.invoke(NOTIFICATION_SEND_CHANNEL, payload),
});

contextBridge.exposeInMainWorld("desktopDocumentOcr", {
  isSupported: () => ipcRenderer.invoke(DOCUMENT_OCR_SUPPORTED_CHANNEL),
  extract: (payload) => ipcRenderer.invoke(DOCUMENT_OCR_EXTRACT_CHANNEL, payload),
});

contextBridge.exposeInMainWorld("desktopDocumentAi", {
  analyze: (payload) => ipcRenderer.invoke(DOCUMENT_AI_ANALYZE_CHANNEL, payload),
});

contextBridge.exposeInMainWorld("desktopDocumentOpen", {
  openExternal: (payload) => ipcRenderer.invoke(DOCUMENT_OPEN_EXTERNAL_CHANNEL, payload),
});

contextBridge.exposeInMainWorld("desktopStatementPdf", {
  savePdf: (payload) => ipcRenderer.invoke(STATEMENT_PDF_SAVE_CHANNEL, payload),
});

contextBridge.exposeInMainWorld("desktopDiagnostics", {
  run: () => ipcRenderer.invoke(DESKTOP_DIAGNOSTICS_RUN_CHANNEL),
});

contextBridge.exposeInMainWorld("desktopPersistence", {
  isAvailable: () => ipcRenderer.invoke(PERSISTENCE_IS_AVAILABLE_CHANNEL),
  loadAppData: () => ipcRenderer.invoke(PERSISTENCE_LOAD_APP_DATA_CHANNEL),
  saveAppData: (payload) => ipcRenderer.invoke(PERSISTENCE_SAVE_APP_DATA_CHANNEL, payload),
  importLegacyLocalStorageData: (payload) => ipcRenderer.invoke(PERSISTENCE_IMPORT_LEGACY_LOCAL_STORAGE_DATA_CHANNEL, payload),
  exportBackup: () => ipcRenderer.invoke(PERSISTENCE_EXPORT_BACKUP_CHANNEL),
  exportBackupArchive: () => ipcRenderer.invoke(PERSISTENCE_EXPORT_BACKUP_ARCHIVE_CHANNEL),
  importBackupArchive: (archiveBuffer) => ipcRenderer.invoke(PERSISTENCE_IMPORT_BACKUP_ARCHIVE_CHANNEL, archiveBuffer),
  getHealth: () => ipcRenderer.invoke(PERSISTENCE_GET_HEALTH_CHANNEL),
  validateLatestBackup: () => ipcRenderer.invoke(PERSISTENCE_VALIDATE_LATEST_BACKUP_CHANNEL),
  openDataFolder: () => ipcRenderer.invoke(PERSISTENCE_OPEN_DATA_FOLDER_CHANNEL),
});

contextBridge.exposeInMainWorld("desktopSecrets", {
  isEncryptionAvailable: () => ipcRenderer.invoke(SECRETS_IS_ENCRYPTION_AVAILABLE_CHANNEL),
  getSecret: (key) => ipcRenderer.invoke(SECRETS_GET_CHANNEL, key),
  setSecret: (key, value) => ipcRenderer.invoke(SECRETS_SET_CHANNEL, { key, value }),
  deleteSecret: (key) => ipcRenderer.invoke(SECRETS_DELETE_CHANNEL, key),
});
