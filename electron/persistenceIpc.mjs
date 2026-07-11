import { ipcMain, shell } from "electron";
import { createPersistenceService, setMeta } from "./db.mjs";
import { createSecretStore } from "./secrets.mjs";

export const PERSISTENCE_CHANNELS = {
  isAvailable: "persistence:is-available",
  loadAppData: "persistence:load-app-data",
  loadDeferredCollections: "persistence:load-deferred-collections",
  queryActivityLogPage: "persistence:query-activity-log-page",
  readDocumentDataUrl: "persistence:read-document-data-url",
  saveAppData: "persistence:save-app-data",
  createRestorePoint: "persistence:create-restore-point",
  importLegacyLocalStorageData: "persistence:import-legacy-local-storage-data",
  exportBackup: "persistence:export-backup",
  exportBackupArchive: "persistence:export-backup-archive",
  importBackupArchive: "persistence:import-backup-archive",
  getHealth: "persistence:get-health",
  validateLatestBackup: "persistence:validate-latest-backup",
  openDataFolder: "persistence:open-data-folder",
};

export const SECRET_CHANNELS = {
  isEncryptionAvailable: "secrets:is-encryption-available",
  get: "secrets:get",
  set: "secrets:set",
  delete: "secrets:delete",
};

const MAX_PERSISTENCE_ERRORS = 12;

function getErrorMessage(error) {
  if (!error) return "Unknown persistence error.";
  if (error instanceof Error) return error.message || "Unknown persistence error.";
  if (typeof error === "string") return error;
  return String(error);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordPersistenceError(service, recordDesktopHealthEvent, message, error) {
  const entry = {
    at: new Date().toISOString(),
    level: "error",
    message,
    detail: getErrorMessage(error),
  };
  if (typeof recordDesktopHealthEvent === "function") {
    recordDesktopHealthEvent("error", message, entry.detail);
  }
  try {
    if (service?.db) {
      const existing = JSON.parse(service.db.prepare("SELECT value FROM app_meta WHERE key = 'recentPersistenceErrors'").get()?.value || "[]");
      const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_PERSISTENCE_ERRORS);
      setMeta(service.db, "recentPersistenceErrors", JSON.stringify(next));
    }
  } catch {
    // Diagnostics should never make the original persistence error worse.
  }
  return entry;
}

async function safely(label, servicePromise, recordDesktopHealthEvent, operation) {
  let service = null;
  try {
    service = await servicePromise;
    return await operation(service);
  } catch (error) {
    recordPersistenceError(service, recordDesktopHealthEvent, label, error);
    return { ok: false, message: getErrorMessage(error) };
  }
}

export function registerPersistenceIpc({ app, recordDesktopHealthEvent } = {}) {
  const appVersion = typeof app?.getVersion === "function" ? app.getVersion() : "";
  const userDataPath = typeof app?.getPath === "function" ? app.getPath("userData") : "";
  const servicePromise = createPersistenceService({ userDataPath, appVersion });

  ipcMain.handle(PERSISTENCE_CHANNELS.isAvailable, async () =>
    safely("Persistence availability check failed.", servicePromise, recordDesktopHealthEvent, async (service) => ({
      ok: true,
      available: true,
      databasePath: service.paths.databasePath,
      userDataPath,
    })),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.loadAppData, async (_event, options) =>
    safely("SQLite app data load failed.", servicePromise, recordDesktopHealthEvent, (service) => service.loadAppData(isPlainObject(options) ? options : {})),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.loadDeferredCollections, async (_event, collectionKeys) =>
    safely("Deferred SQLite data load failed.", servicePromise, recordDesktopHealthEvent, (service) => service.loadDeferredCollections(Array.isArray(collectionKeys) ? collectionKeys : [])),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.queryActivityLogPage, async (_event, options) =>
    safely("Activity history query failed.", servicePromise, recordDesktopHealthEvent, (service) => service.queryActivityLogPage(isPlainObject(options) ? options : {})),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.readDocumentDataUrl, async (_event, document) =>
    safely("Document file read failed.", servicePromise, recordDesktopHealthEvent, async (service) => {
      if (!isPlainObject(document)) return { ok: false, message: "Invalid document reference." };
      const dataUrl = await service.readDocumentDataUrl(document);
      return { ok: true, dataUrl };
    }),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.saveAppData, async (_event, payload) =>
    safely("SQLite app data save failed.", servicePromise, recordDesktopHealthEvent, (service) => {
      if (!isPlainObject(payload)) return { ok: false, message: "Invalid app data payload." };
      return service.saveAppData(payload);
    }),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.createRestorePoint, async (_event, payload) =>
    safely("SQLite restore point creation failed.", servicePromise, recordDesktopHealthEvent, (service) => {
      if (!isPlainObject(payload)) return { ok: false, message: "Invalid restore point payload." };
      return service.createRestorePoint(payload);
    }),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.importLegacyLocalStorageData, async (_event, payload) =>
    safely("Legacy localStorage migration failed.", servicePromise, recordDesktopHealthEvent, (service) => {
      if (!isPlainObject(payload)) return { ok: false, message: "Invalid legacy data payload." };
      return service.importLegacyLocalStorageData(payload);
    }),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.exportBackup, async () =>
    safely("SQLite backup export failed.", servicePromise, recordDesktopHealthEvent, (service) => service.exportBackup()),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.exportBackupArchive, async () =>
    safely("Zip backup export failed.", servicePromise, recordDesktopHealthEvent, (service) => service.exportBackupArchive()),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.importBackupArchive, async (_event, archiveBuffer) =>
    safely("Zip backup import failed.", servicePromise, recordDesktopHealthEvent, (service) => service.importBackupArchive(archiveBuffer)),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.getHealth, async () =>
    safely("Persistence health check failed.", servicePromise, recordDesktopHealthEvent, (service) => service.getHealth()),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.validateLatestBackup, async () =>
    safely("Backup validation failed.", servicePromise, recordDesktopHealthEvent, (service) => service.validateLatestBackup()),
  );

  ipcMain.handle(PERSISTENCE_CHANNELS.openDataFolder, async () =>
    safely("Open data folder failed.", servicePromise, recordDesktopHealthEvent, async (service) => {
      const message = await shell.openPath(service.paths.rootDir);
      if (message) return { ok: false, message };
      return { ok: true, path: service.paths.rootDir };
    }),
  );

  return servicePromise;
}

export function registerSecretsIpc({ paths, recordDesktopHealthEvent } = {}) {
  const store = createSecretStore({ secretsDir: paths.secretsDir });

  ipcMain.handle(SECRET_CHANNELS.isEncryptionAvailable, () => ({
    ok: true,
    available: store.isEncryptionAvailable(),
    backend: store.getBackend(),
  }));

  ipcMain.handle(SECRET_CHANNELS.get, async (_event, key) => {
    try {
      return await store.getSecret(key);
    } catch (error) {
      if (typeof recordDesktopHealthEvent === "function") {
        recordDesktopHealthEvent("error", "Secret read failed.", getErrorMessage(error));
      }
      return { ok: false, value: "", hasValue: false, message: getErrorMessage(error) };
    }
  });

  ipcMain.handle(SECRET_CHANNELS.set, async (_event, payload) => {
    try {
      if (!isPlainObject(payload)) return { ok: false, message: "Invalid secret payload." };
      return await store.setSecret(payload.key, payload.value);
    } catch (error) {
      if (typeof recordDesktopHealthEvent === "function") {
        recordDesktopHealthEvent("error", "Secret write failed.", getErrorMessage(error));
      }
      return { ok: false, message: getErrorMessage(error) };
    }
  });

  ipcMain.handle(SECRET_CHANNELS.delete, async (_event, key) => {
    try {
      return await store.deleteSecret(key);
    } catch (error) {
      if (typeof recordDesktopHealthEvent === "function") {
        recordDesktopHealthEvent("error", "Secret delete failed.", getErrorMessage(error));
      }
      return { ok: false, message: getErrorMessage(error) };
    }
  });

  return store;
}
