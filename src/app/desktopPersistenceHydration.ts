import { normalizeAndMigrateBackup, type BackupEnvelope } from "../domain/backupMigrations.ts";
import type {
  DesktopPersistenceApi,
  DesktopPersistenceHealth,
  DesktopPersistenceLoadResult,
} from "../types/desktop";

type HydrationCallbacks = {
  restoreBackupEnvelope?: (backup: BackupEnvelope) => void;
  replaceSettings?: (settings: unknown) => void;
  setPersistenceHealth?: (health: DesktopPersistenceHealth | null) => void;
  setLastAutoBackupAt?: (value: string) => void;
  setPersistenceLastError?: (value: string) => void;
  setNotice?: (message: string) => void;
  manual?: boolean;
};

type ApplyDesktopPersistenceBackupArgs = HydrationCallbacks & {
  loaded?: DesktopPersistenceLoadResult;
  desktopPersistence?: Pick<DesktopPersistenceApi, "getHealth">;
};

export async function applyDesktopPersistenceBackup({
  loaded,
  desktopPersistence,
  restoreBackupEnvelope,
  replaceSettings,
  setPersistenceHealth,
  setLastAutoBackupAt,
  setPersistenceLastError,
  setNotice,
  manual = false,
}: ApplyDesktopPersistenceBackupArgs = {}): Promise<boolean> {
  if (!loaded?.ok || !loaded.hasData || !loaded.backup) {
    if (manual) setNotice?.("SQLite database does not have saved rental records to reload yet.");
    return false;
  }

  const migration = normalizeAndMigrateBackup(loaded.backup);
  restoreBackupEnvelope?.(migration.backup);
  if (migration.backup.settings !== undefined && typeof replaceSettings === "function") {
    replaceSettings(migration.backup.settings);
  }

  const health = desktopPersistence?.getHealth ? await desktopPersistence.getHealth() : null;
  setPersistenceHealth?.(health?.ok === false ? null : health);
  setLastAutoBackupAt?.(health?.lastBackupAt || loaded.meta?.lastBackupAt || "");
  setPersistenceLastError?.("");

  if (manual) {
    const recordCount = Number(health?.structuredDataRecordCount || 0);
    setNotice?.(recordCount > 0 ? `Reloaded SQLite data (${recordCount} saved records).` : "Reloaded SQLite data.");
  }
  return true;
}

type LoadAndApplyDesktopPersistenceDataArgs = HydrationCallbacks & {
  desktopPersistence?: Pick<DesktopPersistenceApi, "loadAppData" | "getHealth">;
};

export async function loadAndApplyDesktopPersistenceData({
  desktopPersistence,
  ...callbacks
}: LoadAndApplyDesktopPersistenceDataArgs = {}): Promise<boolean> {
  if (!desktopPersistence?.loadAppData) {
    callbacks.setNotice?.("SQLite desktop persistence is not available in this environment.");
    return false;
  }

  const loaded = await desktopPersistence.loadAppData();
  if (loaded?.ok === false) {
    throw new Error(loaded.message || "SQLite data reload failed.");
  }

  return applyDesktopPersistenceBackup({ loaded, desktopPersistence, ...callbacks });
}
