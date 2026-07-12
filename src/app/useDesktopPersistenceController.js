import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeAndMigrateBackup, BACKUP_SCHEMA_VERSION } from "../domain/backupMigrations.ts";
import { buildLeaseAutomationPlan, findStaleAutomatedRentChargeIds } from "../domain/leaseAutomation.ts";
import { findReleaseNotesEntry, getRecentReleaseNotes } from "../domain/releaseNotes.ts";
import { APP_SETTINGS_STORAGE_KEY, sanitizeAppSettingsForExport } from "../store/appSettings.ts";
import { applyDesktopPersistenceBackup, loadAndApplyDesktopPersistenceData } from "./desktopPersistenceHydration.js";
import { createDesktopSaveQueue } from "./desktopSaveQueue.ts";
import {
  readLastAutoBackupAt,
  readLeaseReminderNotificationMap,
  readStoredAutoBackups,
} from "../lib/appSupport.ts";
import {
  APP_DATA_STORAGE_KEY,
  AUTO_BACKUP_INTERVAL_MS,
  AUTO_BACKUP_MAX_ENTRIES,
  AUTO_BACKUP_META_STORAGE_KEY,
  AUTO_BACKUP_STORAGE_KEY,
  LEASE_REMINDER_NOTIFICATION_STORAGE_KEY,
  RELEASE_NOTES_SEEN_STORAGE_KEY,
} from "./appStorageKeys.js";
import {
  DEFAULT_DESKTOP_UPDATE_STATE,
  DESKTOP_UPDATE_STATUS_LABELS,
  normalizeReleaseNotesLines,
} from "./desktopUpdateShared.js";
import { toLocalIsoDate } from "../lib/localDate.ts";

const SQLITE_MIGRATION_STORAGE_KEY = "rental-tracker:sqlite-migrated:v1";

export function useDesktopPersistenceController({
  activityLog,
  addAuditEntry,
  actions,
  appSettings,
  desktopUpdaterAvailable,
  documents,
  escrowDisbursements,
  formatDesktopUpdateDate,
  hasAnyData,
  assets,
  loans,
  loanPayments,
  planningActionItems,
  planningActiveScenarioId,
  planningAssumptions,
  planningBaselineScenarioId,
  planningDebtPayoffPlan,
  planningEventDraft,
  planningExitPlan,
  planningForecastOptions,
  planningGoals,
  planningManualProjects,
  planningProjectDraft,
  planningRentStrategies,
  planningSavedScenarios,
  planningScenarioEvents,
  planningScenarioOverrides,
  planningTriggers,
  planningTurnoverInputs,
  openConfirmDialog,
  properties,
  recurringDrafts,
  recurringTemplates,
  replaceSettings,
  requirePermission,
  restorePlanningWorkspaceFromBackupData,
  restoreTaxWorkspaceFromBackupData,
  setNotice,
  taxCarryoverByScope,
  taxDayOverrides,
  taxFiledAmountOverrides,
  tenantLedgerEntries,
  leases,
  transactions,
  units,
  usePeriods,
  vendors,
  workOrders,
  bundledAppVersion,
}) {
  const [desktopUpdateState, setDesktopUpdateState] = useState(() => ({
    ...DEFAULT_DESKTOP_UPDATE_STATE,
    status: desktopUpdaterAvailable ? "idle" : "unavailable",
    message: desktopUpdaterAvailable
      ? "Waiting to check for updates."
      : "Update checks are available in installed desktop builds.",
  }));
  const [desktopUpdateBusy, setDesktopUpdateBusy] = useState(false);
  const [releaseNotesDialog, setReleaseNotesDialog] = useState({ open: false, mode: "current" });
  const releaseNotesAutoShownVersionRef = useRef("");
  const [lastAutoBackupAt, setLastAutoBackupAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return readLastAutoBackupAt(window.localStorage.getItem(AUTO_BACKUP_META_STORAGE_KEY));
  });
  const [isDataHydrated, setIsDataHydrated] = useState(false);
  const [isDeferredDataHydrated, setIsDeferredDataHydrated] = useState(false);
  const [leaseAutomationReminders, setLeaseAutomationReminders] = useState([]);
  const [leaseAutomationLastRunAt, setLeaseAutomationLastRunAt] = useState("");
  const [persistenceHealth, setPersistenceHealth] = useState(null);
  const [persistenceLastError, setPersistenceLastError] = useState("");
  const [restorePointBusy, setRestorePointBusy] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({ initialDataLoadMs: null, deferredActivityLoadMs: null });
  const leaseReminderSignatureRef = useRef("");
  const hydrationStartedRef = useRef(false);
  const hydrationInputsRef = useRef({});
  const desktopSaveQueueRef = useRef(null);

  const desktopUpdateStatusKey = desktopUpdateState.status || "idle";
  const desktopUpdateStatusLabel = DESKTOP_UPDATE_STATUS_LABELS[desktopUpdateStatusKey] || "Unknown";
  const desktopUpdateCheckedAtLabel = formatDesktopUpdateDate(desktopUpdateState.checkedAt);
  const desktopUpdateReleaseDateLabel = formatDesktopUpdateDate(desktopUpdateState.releaseDate);
  const desktopUpdateProgress = Number(desktopUpdateState.progressPercent || 0);
  const desktopUpdateCanRestart = desktopUpdaterAvailable && desktopUpdateStatusKey === "downloaded";
  const desktopUpdateMessage = desktopUpdateState.error
    ? `${desktopUpdateState.message || "Update issue."} (${desktopUpdateState.error})`
    : desktopUpdateState.message || "No updater status yet.";
  const leaseAutomationLastRunLabel = formatDesktopUpdateDate(leaseAutomationLastRunAt);
  const leaseAutomationDefaults = useMemo(() => ({
    rentDueDay: Number(appSettings.leaseDefaultRentDueDay || 1),
    reminderDaysBefore: Number(appSettings.leaseReminderDaysBefore || 0),
    lateFeeGraceDays: Number(appSettings.leaseLateFeeGraceDays || 0),
    lateFeeType: appSettings.leaseLateFeeType === "percent" ? "percent" : "flat",
    lateFeeValue: Number(appSettings.leaseLateFeeValue || 0),
    autoLateFeeEnabled: appSettings.leaseAutoLateFeeEnabled === true,
  }), [
    appSettings.leaseAutoLateFeeEnabled,
    appSettings.leaseDefaultRentDueDay,
    appSettings.leaseLateFeeGraceDays,
    appSettings.leaseLateFeeType,
    appSettings.leaseLateFeeValue,
    appSettings.leaseReminderDaysBefore,
  ]);
  const currentAppVersion = String(desktopUpdateState.currentVersion || bundledAppVersion || "");
  const updateTargetVersion = String(desktopUpdateState.downloadedVersion || desktopUpdateState.availableVersion || "");
  const currentReleaseNotesEntry = findReleaseNotesEntry(currentAppVersion);
  const updateReleaseNotesEntry = findReleaseNotesEntry(updateTargetVersion);
  const currentReleaseHistory = getRecentReleaseNotes(5);
  const remoteUpdateReleaseNotes = normalizeReleaseNotesLines(desktopUpdateState.releaseNotes);
  const effectiveUpdateReleaseNotes = (updateReleaseNotesEntry?.changes && updateReleaseNotesEntry.changes.length > 0)
    ? updateReleaseNotesEntry.changes
    : remoteUpdateReleaseNotes;
  const releaseNotesDialogVersion = releaseNotesDialog.mode === "update"
    ? (updateTargetVersion || currentAppVersion)
    : currentAppVersion;
  const releaseNotesDialogEntry = releaseNotesDialog.mode === "update"
    ? (updateReleaseNotesEntry || findReleaseNotesEntry(releaseNotesDialogVersion))
    : currentReleaseNotesEntry;
  const releaseNotesDialogLines = releaseNotesDialog.mode === "update"
    ? (effectiveUpdateReleaseNotes.length > 0 ? effectiveUpdateReleaseNotes : (releaseNotesDialogEntry?.changes || []))
    : (releaseNotesDialogEntry?.changes || []);
  const releaseNotesDialogTitle = releaseNotesDialog.mode === "update"
    ? (`What changed in ${releaseNotesDialogVersion || "this update"}`)
    : (`What's new in ${releaseNotesDialogVersion || "this version"}`);
  const releaseNotesDialogSummary = releaseNotesDialog.mode === "update"
    ? (releaseNotesDialogEntry?.summary
      || (updateTargetVersion ? `Review the release notes for ${updateTargetVersion} before you install or restart.` : ""))
    : (releaseNotesDialogEntry?.summary || "");
  const releaseNotesDialogDateLabel = formatDesktopUpdateDate(
    releaseNotesDialog.mode === "update"
      ? (desktopUpdateState.releaseDate || releaseNotesDialogEntry?.releaseDate || "")
      : (releaseNotesDialogEntry?.releaseDate || ""),
  );

  const openCurrentReleaseNotesDialog = () => {
    if (!currentAppVersion) {
      setNotice("Release notes are not available for this build yet.");
      return;
    }
    setReleaseNotesDialog({ open: true, mode: "current" });
  };

  const openUpdateReleaseNotesDialog = () => {
    if (!updateTargetVersion && !currentReleaseNotesEntry) {
      setNotice("Release notes are not available yet.");
      return;
    }
    setReleaseNotesDialog({ open: true, mode: updateTargetVersion ? "update" : "current" });
  };

  const closeReleaseNotesDialog = () => {
    setReleaseNotesDialog((prev) => ({ ...prev, open: false }));
    if (typeof window !== "undefined" && currentAppVersion) {
      window.localStorage.setItem(RELEASE_NOTES_SEEN_STORAGE_KEY, currentAppVersion);
    }
  };

  const buildBackupSnapshot = (exportedAt = new Date().toISOString()) => ({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: desktopUpdateState.currentVersion || "",
    exportedAt,
    settings: sanitizeAppSettingsForExport(appSettings),
    data: {
      transactions,
      assets,
      documents,
      leases,
      tenantLedgerEntries,
      loans,
      loanPayments,
      usePeriods,
      recurringTemplates,
      recurringDrafts,
      vendors,
      workOrders,
      properties,
      units,
      activityLog,
      escrowDisbursements,
      taxDayOverrides,
      taxCarryoverByScope,
      taxFiledAmountOverrides,
      planningAssumptions,
      planningSavedScenarios,
      planningActiveScenarioId,
      planningBaselineScenarioId,
      planningScenarioOverrides,
      planningScenarioEvents,
      planningRentStrategies,
      planningForecastOptions,
      planningExitPlan,
      planningGoals,
      planningTriggers,
      planningDebtPayoffPlan,
      planningTurnoverInputs,
      planningActionItems,
      planningManualProjects,
      planningEventDraft,
      planningProjectDraft,
    },
  });

  const getDesktopSaveQueue = (desktopPersistence) => {
    if (!desktopPersistence?.saveAppData) return null;
    if (!desktopSaveQueueRef.current) {
      desktopSaveQueueRef.current = createDesktopSaveQueue({
        saveSnapshot: (queuedSnapshot) => desktopPersistence.saveAppData(queuedSnapshot),
        onSuccess: async () => {
          setPersistenceLastError("");
          if (desktopPersistence.getHealth) {
            const health = await desktopPersistence.getHealth();
            if (health?.ok !== false) {
              setPersistenceHealth(health);
              setLastAutoBackupAt(health?.lastBackupAt || "");
            }
          }
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error || "SQLite save failed.");
          setPersistenceLastError(message);
        },
      });
    }
    return desktopSaveQueueRef.current;
  };

  const flushCurrentDesktopSave = async () => {
    const desktopPersistence = typeof window !== "undefined" ? window.desktopPersistence : null;
    const saveQueue = getDesktopSaveQueue(desktopPersistence);
    if (!saveQueue) return { ok: true };

    saveQueue.enqueue(buildBackupSnapshot());
    const result = await saveQueue.flush();
    if (result?.ok === false) {
      const message = result.message || "SQLite save failed.";
      setPersistenceLastError(message);
      throw new Error(message);
    }
    return result || { ok: true };
  };

  const saveCurrentDesktopSnapshotNow = async () => {
    const desktopPersistence = typeof window !== "undefined" ? window.desktopPersistence : null;
    if (!desktopPersistence?.saveAppData) return { ok: true };
    const result = await desktopPersistence.saveAppData(buildBackupSnapshot());
    if (result?.ok === false) {
      const message = result.message || "SQLite save failed.";
      setPersistenceLastError(message);
      throw new Error(message);
    }
    return result || { ok: true };
  };

  const restoreBackupEnvelope = (backup) => {
    restoreTaxWorkspaceFromBackupData(backup.data);
    restorePlanningWorkspaceFromBackupData(backup.data);
    actions.restoreBackupData(backup.data);
  };

  const loadLegacyLocalStorageBackup = () => {
    const raw = window.localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const migration = normalizeAndMigrateBackup(parsed);
    const legacySettingsRaw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const legacySettings = legacySettingsRaw ? JSON.parse(legacySettingsRaw) : undefined;
    return {
      ...migration,
      backup: {
        ...migration.backup,
        settings: migration.backup.settings || legacySettings || appSettings,
      },
    };
  };

  hydrationInputsRef.current = {
    actions,
    appSettings,
    loadLegacyLocalStorageBackup,
    replaceSettings,
    restoreBackupEnvelope,
    setNotice,
  };

  const reloadDesktopPersistenceData = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to reload desktop data from SQLite.")) return;
    if (typeof window === "undefined" || !window.desktopPersistence?.loadAppData) {
      setNotice("SQLite desktop persistence is not available in this environment.");
      return;
    }

    try {
      await loadAndApplyDesktopPersistenceData({
        desktopPersistence: window.desktopPersistence,
        restoreBackupEnvelope,
        replaceSettings,
        setPersistenceHealth,
        setLastAutoBackupAt,
        setPersistenceLastError,
        setNotice,
        manual: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "SQLite data reload failed.");
      setPersistenceLastError(message);
      setNotice(`Could not reload SQLite data: ${message}`);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentAppVersion || !currentReleaseNotesEntry) return;
    const seenVersion = window.localStorage.getItem(RELEASE_NOTES_SEEN_STORAGE_KEY) || "";
    if (seenVersion === currentAppVersion) return;
    if (releaseNotesAutoShownVersionRef.current === currentAppVersion) return;
    releaseNotesAutoShownVersionRef.current = currentAppVersion;
    setReleaseNotesDialog({ open: true, mode: "current" });
  }, [currentAppVersion, currentReleaseNotesEntry]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.desktopUpdater?.getState || !window.desktopUpdater?.onStatus) {
      return;
    }

    let cancelled = false;

    const applyUpdateState = (payload) => {
      if (!payload || typeof payload !== "object" || cancelled) return;
      setDesktopUpdateState((prev) => ({
        ...prev,
        ...payload,
        releaseNotes: normalizeReleaseNotesLines(payload.releaseNotes),
      }));
      setDesktopUpdateBusy(false);
    };

    async function hydrateDesktopUpdateState() {
      try {
        const state = await window.desktopUpdater.getState();
        applyUpdateState(state);
      } catch {
        // Leave defaults in place if updater bridge is unavailable.
      }
    }

    void hydrateDesktopUpdateState();
    const unsubscribe = window.desktopUpdater.onStatus(applyUpdateState);

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const checkForDesktopUpdates = async () => {
    if (typeof window === "undefined" || !window.desktopUpdater) {
      setNotice("Update checks are available in installed desktop builds.");
      return;
    }

    setDesktopUpdateBusy(true);
    try {
      const result = await window.desktopUpdater.check();
      if (result?.ok === false && result.reason === "not-packaged") {
        setNotice("Update checks run in the installed desktop app.");
      } else if (result?.ok === false && result.reason === "error" && result.error) {
        setNotice(`Update check failed: ${result.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown updater error.");
      setDesktopUpdateState((prev) => ({
        ...prev,
        status: "error",
        message: "Update check failed.",
        error: message,
      }));
      setNotice(`Update check failed: ${message}`);
    } finally {
      setDesktopUpdateBusy(false);
    }
  };

  const installDesktopUpdateNow = async () => {
    if (typeof window === "undefined" || !window.desktopUpdater) {
      setNotice("Update install is available in installed desktop builds.");
      return;
    }

    try {
      const result = await window.desktopUpdater.installNow();
      if (result?.ok === false && result.reason === "not-ready") {
        setNotice("No downloaded update is ready yet.");
      } else if (result?.ok === false && result.reason === "not-packaged") {
        setNotice("Update install runs in the installed desktop app.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown updater error.");
      setNotice(`Unable to restart for update: ${message}`);
    }
  };

  const sendSingleLeaseReminderNotification = async (reminder) => {
    if (typeof window === "undefined") return false;

    try {
      if (window.desktopNotifications?.notify) {
        const supported =
          typeof window.desktopNotifications.isSupported === "function"
            ? await window.desktopNotifications.isSupported()
            : true;
        if (supported !== false) {
          const result = await window.desktopNotifications.notify({
            title: reminder.title,
            body: reminder.message,
            silent: false,
          });
          if (result?.ok !== false) return true;
        }
      }
    } catch {
      // Fallback to browser notifications.
    }

    if (!("Notification" in window)) return false;
    try {
      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== "granted") return false;
      new window.Notification(reminder.title, { body: reminder.message });
      return true;
    } catch {
      return false;
    }
  };

  const notifyLeaseRemindersIfNeeded = async (reminders) => {
    if (!appSettings.leaseDesktopNotifications || typeof window === "undefined" || reminders.length === 0) return;

    const todayKey = toLocalIsoDate();
    const sentByReminderId = readLeaseReminderNotificationMap(window.localStorage.getItem(LEASE_REMINDER_NOTIFICATION_STORAGE_KEY));
    let changed = false;

    for (const reminder of reminders) {
      if (sentByReminderId[reminder.id] === todayKey) continue;
      const delivered = await sendSingleLeaseReminderNotification(reminder);
      if (!delivered) continue;
      sentByReminderId[reminder.id] = todayKey;
      changed = true;
    }

    if (changed) {
      window.localStorage.setItem(LEASE_REMINDER_NOTIFICATION_STORAGE_KEY, JSON.stringify(sentByReminderId));
    }
  };

  const applyLeaseAutomation = async () => {
    if (!isDataHydrated) {
      return { createdCount: 0, reminders: [] };
    }

    const today = toLocalIsoDate();
    const currentYearStart = `${today.slice(0, 4)}-01-01`;
    let automationEntries = tenantLedgerEntries;
    const priorYearAutoEntryIds = automationEntries
      .filter((entry) => {
        const key = String(entry.automationKey || "").trim();
        const id = String(entry.id || "").trim();
        const memo = String(entry.memo || "").trim().toLowerCase();
        const isAutoLeaseCharge =
          key.startsWith("auto-rent:") ||
          key.startsWith("auto-late-fee:") ||
          id.startsWith("tle-auto-rent-") ||
          id.startsWith("tle-auto-late-fee-") ||
          memo.startsWith("auto rent charge (") ||
          memo.startsWith("auto late fee");
        if (!isAutoLeaseCharge) return false;
        return String(entry.date || "") < currentYearStart;
      })
      .map((entry) => entry.id);
    if (priorYearAutoEntryIds.length > 0) {
      const priorYearAutoEntryIdSet = new Set(priorYearAutoEntryIds);
      priorYearAutoEntryIds.forEach((entryId) => {
        actions.deleteTenantLedgerEntry(entryId);
      });
      automationEntries = automationEntries.filter((entry) => !priorYearAutoEntryIdSet.has(entry.id));
    }

    const staleAutomatedRentEntryIds = findStaleAutomatedRentChargeIds(automationEntries);
    if (staleAutomatedRentEntryIds.length > 0) {
      const staleAutomatedRentEntryIdSet = new Set(staleAutomatedRentEntryIds);
      staleAutomatedRentEntryIds.forEach((entryId) => {
        actions.deleteTenantLedgerEntry(entryId);
      });
      automationEntries = automationEntries.filter((entry) => !staleAutomatedRentEntryIdSet.has(entry.id));
    }

    if (!appSettings.leaseAutomationEnabled) {
      if (leaseReminderSignatureRef.current !== "") {
        leaseReminderSignatureRef.current = "";
        setLeaseAutomationReminders([]);
      }
      setLeaseAutomationLastRunAt(new Date().toISOString());
      return { createdCount: 0, reminders: [] };
    }

    const plan = buildLeaseAutomationPlan({
      leases,
      tenantLedgerEntries: automationEntries,
      todayIso: today,
      defaults: leaseAutomationDefaults,
    });

    if (plan.entries.length > 0) {
      plan.entries.forEach((entry) => {
        actions.addOrUpdateTenantLedgerEntry(entry);
      });
    }

    const reminderSignature = plan.reminders.map((reminder) => `${reminder.id}:${reminder.amount}`).join("|");
    if (reminderSignature !== leaseReminderSignatureRef.current) {
      leaseReminderSignatureRef.current = reminderSignature;
      setLeaseAutomationReminders(plan.reminders);
    }

    setLeaseAutomationLastRunAt(new Date().toISOString());
    await notifyLeaseRemindersIfNeeded(plan.reminders);

    return {
      createdCount: plan.entries.length,
      reminders: plan.reminders,
    };
  };

  const runLeaseAutomationNow = async () => {
    const result = await applyLeaseAutomation();
    if (!appSettings.leaseAutomationEnabled) {
      setNotice("Lease automation is turned off in Settings.");
      return;
    }
    if (result.createdCount > 0) {
      setNotice(`Lease automation added ${result.createdCount} ledger entr${result.createdCount === 1 ? "y" : "ies"}. ${result.reminders.length} reminder${result.reminders.length === 1 ? "" : "s"} active.`);
      return;
    }
    setNotice(`Lease automation is up to date. ${result.reminders.length} reminder${result.reminders.length === 1 ? "" : "s"} active.`);
  };

  useEffect(() => {
    if (hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;

    let mounted = true;

    async function hydrateData() {
      const hydrationInputs = hydrationInputsRef.current;
      setIsDeferredDataHydrated(false);
      if (typeof window === "undefined") {
        if (mounted) {
          setIsDataHydrated(true);
          setIsDeferredDataHydrated(true);
        }
        return;
      }

      try {
        const desktopPersistence = window.desktopPersistence;
        if (desktopPersistence?.loadAppData) {
          const loadStartedAt = performance.now();
          const loaded = await desktopPersistence.loadAppData({ deferredCollectionKeys: ["activityLog"] });
          setPerformanceMetrics((previous) => ({ ...previous, initialDataLoadMs: Math.round(performance.now() - loadStartedAt) }));
          if (!mounted) return;

          if (loaded?.ok && loaded.hasData && loaded.backup) {
            await applyDesktopPersistenceBackup({
              loaded,
              desktopPersistence,
              restoreBackupEnvelope: hydrationInputs.restoreBackupEnvelope,
              replaceSettings: hydrationInputs.replaceSettings,
              setPersistenceHealth,
              setLastAutoBackupAt,
              setPersistenceLastError,
            });
            const deferredKeys = Array.isArray(loaded?.meta?.deferredCollectionKeys) ? loaded.meta.deferredCollectionKeys : [];
            if (deferredKeys.includes("activityLog") && (desktopPersistence.queryActivityLogPage || desktopPersistence.loadDeferredCollections)) {
              const loadDeferredActivity = async () => {
                try {
                  const deferredStartedAt = performance.now();
                  const result = desktopPersistence.queryActivityLogPage
                    ? await desktopPersistence.queryActivityLogPage({ limit: 500 })
                    : await desktopPersistence.loadDeferredCollections(["activityLog"]);
                  if (!mounted || result?.ok === false) return;
                  hydrationInputs.actions.mergeActivityLog?.(result.rows || result.collections?.activityLog || []);
                  setPerformanceMetrics((previous) => ({ ...previous, deferredActivityLoadMs: Math.round(performance.now() - deferredStartedAt) }));
                } finally {
                  if (mounted) setIsDeferredDataHydrated(true);
                }
              };
              if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => { void loadDeferredActivity(); }, { timeout: 1500 });
              else window.setTimeout(() => { void loadDeferredActivity(); }, 250);
            } else {
              setIsDeferredDataHydrated(true);
            }
          } else {
            const legacyMigration = hydrationInputs.loadLegacyLocalStorageBackup();
            if (legacyMigration?.backup) {
              const importResult = desktopPersistence.importLegacyLocalStorageData
                ? await desktopPersistence.importLegacyLocalStorageData(legacyMigration.backup)
                : { ok: false, message: "Migration bridge unavailable." };
              if (importResult?.ok === false) {
                throw new Error(importResult.message || "Could not migrate legacy local data to SQLite.");
              }
              window.localStorage.setItem(SQLITE_MIGRATION_STORAGE_KEY, new Date().toISOString());
              hydrationInputs.restoreBackupEnvelope(legacyMigration.backup);
              if (legacyMigration.backup.settings !== undefined && typeof hydrationInputs.replaceSettings === "function") {
                hydrationInputs.replaceSettings(legacyMigration.backup.settings);
              }
              const health = desktopPersistence.getHealth ? await desktopPersistence.getHealth() : null;
              if (mounted) {
                setPersistenceHealth(health?.ok === false ? null : health);
                setLastAutoBackupAt(health?.lastBackupAt || "");
              }
            } else {
              await hydrationInputs.actions.loadDemoData();
            }
          }
          if (!loaded?.ok || !loaded.hasData || !loaded.backup) setIsDeferredDataHydrated(true);
        } else {
          const legacyMigration = hydrationInputs.loadLegacyLocalStorageBackup();
          if (legacyMigration?.backup) {
            hydrationInputs.restoreBackupEnvelope(legacyMigration.backup);
            if (legacyMigration.backup.settings !== undefined && typeof hydrationInputs.replaceSettings === "function") {
              hydrationInputs.replaceSettings(legacyMigration.backup.settings);
            }
          } else {
            await hydrationInputs.actions.loadDemoData();
          }
          setIsDeferredDataHydrated(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Could not load saved data.");
        setPersistenceLastError(message);
        hydrationInputs.setNotice(`Could not load saved data: ${message}`);
        await hydrationInputs.actions.loadDemoData();
        setIsDeferredDataHydrated(true);
      } finally {
        if (mounted) setIsDataHydrated(true);
      }
    }

    void hydrateData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isDataHydrated || !isDeferredDataHydrated || typeof window === "undefined") return;
    if (!hasAnyData) return;

    const snapshot = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: desktopUpdateState.currentVersion || "",
      exportedAt: new Date().toISOString(),
      settings: sanitizeAppSettingsForExport(appSettings),
      data: {
        transactions,
        assets,
        documents,
        leases,
        tenantLedgerEntries,
        loans,
        loanPayments,
        usePeriods,
        recurringTemplates,
        recurringDrafts,
        vendors,
        workOrders,
        properties,
        units,
        activityLog,
        escrowDisbursements,
        taxDayOverrides,
        taxCarryoverByScope,
        taxFiledAmountOverrides,
        planningAssumptions,
        planningSavedScenarios,
        planningActiveScenarioId,
        planningBaselineScenarioId,
        planningScenarioOverrides,
        planningScenarioEvents,
        planningRentStrategies,
        planningForecastOptions,
        planningExitPlan,
        planningGoals,
        planningTriggers,
        planningDebtPayoffPlan,
        planningTurnoverInputs,
        planningActionItems,
        planningManualProjects,
        planningEventDraft,
        planningProjectDraft,
      },
    };

    const desktopPersistence = window.desktopPersistence;
    if (desktopPersistence?.saveAppData) {
      getDesktopSaveQueue(desktopPersistence)?.enqueue(snapshot);
      return;
    }

    try {
      window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      setPersistenceLastError("Browser localStorage save failed.");
    }
  }, [
    activityLog,
    appSettings,
    assets,
    desktopUpdateState.currentVersion,
    documents,
    escrowDisbursements,
    hasAnyData,
    isDataHydrated,
    isDeferredDataHydrated,
    leases,
    loanPayments,
    loans,
    planningActionItems,
    planningActiveScenarioId,
    planningAssumptions,
    planningBaselineScenarioId,
    planningDebtPayoffPlan,
    planningEventDraft,
    planningExitPlan,
    planningForecastOptions,
    planningGoals,
    planningManualProjects,
    planningProjectDraft,
    planningRentStrategies,
    planningSavedScenarios,
    planningScenarioEvents,
    planningScenarioOverrides,
    planningTriggers,
    planningTurnoverInputs,
    properties,
    recurringDrafts,
    recurringTemplates,
    taxCarryoverByScope,
    taxDayOverrides,
    taxFiledAmountOverrides,
    tenantLedgerEntries,
    transactions,
    units,
    usePeriods,
    vendors,
    workOrders,
  ]);

  const saveBackupSnapshot = async (snapshot, fileNamePrefix) => {
    const json = JSON.stringify(snapshot, null, 2);
    const dateSuffix = String(snapshot.exportedAt || new Date().toISOString()).slice(0, 10);
    const fileName = `${fileNamePrefix}-${dateSuffix}.json`;

    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "JSON backup", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const saveBackupArchive = async (archive, fileNamePrefix) => {
    const dateSuffix = String(archive?.exportedAt || new Date().toISOString()).slice(0, 10);
    const fileName = String(archive?.fileName || `${fileNamePrefix}-${dateSuffix}.zip`);
    const blob = new Blob([archive.buffer], { type: "application/zip" });

    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "Zip backup", accept: { "application/zip": [".zip"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportDataBackup = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to export full data backups.")) return;
    try {
      if (window.desktopPersistence?.exportBackupArchive) {
        await saveCurrentDesktopSnapshotNow();
        const archive = await window.desktopPersistence.exportBackupArchive();
        if (archive?.ok !== false && archive?.buffer) {
          await saveBackupArchive(archive, "rental-tracker-backup");
          const missingCount = Array.isArray(archive.missingDocumentFiles) ? archive.missingDocumentFiles.length : 0;
          setNotice(missingCount > 0
            ? `Backup exported as zip. ${missingCount} document file${missingCount === 1 ? "" : "s"} could not be embedded.`
            : "Backup exported as zip with document files.");
          return;
        }
      }
      if (window.desktopPersistence?.exportBackup) {
        await saveCurrentDesktopSnapshotNow();
      }
      const desktopBackup = window.desktopPersistence?.exportBackup ? await window.desktopPersistence.exportBackup() : null;
      await saveBackupSnapshot(desktopBackup?.schemaVersion ? desktopBackup : buildBackupSnapshot(), "rental-tracker-backup");
      setNotice("Backup exported.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setNotice("Backup export canceled.");
        return;
      }
      const message = error instanceof Error ? error.message : "Could not export backup.";
      setPersistenceLastError(message);
      setNotice(`Could not export backup: ${message}`);
    }
  };

  const autoBackupStatusLabel = useMemo(() => {
    if (!lastAutoBackupAt) return "Not yet";
    const parsedDate = Date.parse(lastAutoBackupAt);
    if (Number.isNaN(parsedDate)) return lastAutoBackupAt;
    return new Date(parsedDate).toLocaleString();
  }, [lastAutoBackupAt]);

  const exportLatestAutoBackup = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to export restore points.")) return;
    if (typeof window === "undefined") {
      setNotice("Auto-backup is unavailable in this environment.");
      return;
    }

    if (window.desktopPersistence?.exportBackupArchive) {
      try {
        await flushCurrentDesktopSave();
        const archive = await window.desktopPersistence.exportBackupArchive();
        if (archive?.buffer) {
          await saveBackupArchive(archive, "rental-tracker-auto-backup");
          setNotice("Latest SQLite backup exported as zip.");
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not flush the latest SQLite save before export.";
        setPersistenceLastError(message);
        setNotice(`Could not export latest SQLite backup: ${message}`);
        return;
      }
    }

    const backups = readStoredAutoBackups(window.localStorage.getItem(AUTO_BACKUP_STORAGE_KEY));
    const latestBackup = backups[0];
    if (!latestBackup) {
      setNotice("No auto-backup available yet.");
      return;
    }

    try {
      await saveBackupSnapshot(latestBackup, "rental-tracker-auto-backup");
      addAuditEntry({
        action: "export",
        entityType: "auto-backup",
        entityId: latestBackup.exportedAt || "latest-auto-backup",
        summary: "Exported latest auto-backup.",
        details: `Auto-backup timestamp: ${latestBackup.exportedAt || "unknown"}.`,
        category: "data",
      });
      setNotice("Latest auto-backup exported.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setNotice("Auto-backup export canceled.");
        return;
      }
      setNotice("Could not export latest auto-backup.");
    }
  };

  const createAutoBackupNow = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to create restore points.")) return;
    if (restorePointBusy) return;
    if (typeof window === "undefined") {
      setNotice("Auto-backup is unavailable in this environment.");
      return;
    }

    if (!hasAnyData) {
      setNotice("Add data first, then create a restore point.");
      return;
    }

    try {
      setRestorePointBusy(true);
      setNotice("Creating restore point...");
      const snapshot = buildBackupSnapshot();
      if (window.desktopPersistence?.createRestorePoint || window.desktopPersistence?.saveAppData) {
        const result = window.desktopPersistence?.createRestorePoint
          ? await window.desktopPersistence.createRestorePoint(snapshot)
          : await window.desktopPersistence.saveAppData(snapshot);
        if (result?.ok === false) {
          throw new Error(result.message || "SQLite save failed.");
        }
        const health = window.desktopPersistence?.getHealth ? await window.desktopPersistence.getHealth() : null;
        const savedAt = result?.backedUpAt || health?.lastBackupAt || snapshot.exportedAt;
        if (health?.ok !== false) {
          setPersistenceHealth(health);
          setLastAutoBackupAt(savedAt);
        }
        window.localStorage.setItem(AUTO_BACKUP_META_STORAGE_KEY, JSON.stringify({ lastAutoBackupAt: savedAt }));
        addAuditEntry({
          action: "backup",
          entityType: "restore-point",
          entityId: savedAt,
          summary: "Created restore point.",
          details: `Stored SQLite restore point at ${savedAt}.`,
          category: "data",
        });
        setPersistenceLastError("");
        setNotice("Restore point created.");
        return;
      }
      const existingBackups = readStoredAutoBackups(window.localStorage.getItem(AUTO_BACKUP_STORAGE_KEY));
      const nextBackups = [snapshot, ...existingBackups].slice(0, AUTO_BACKUP_MAX_ENTRIES);
      window.localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(nextBackups));
      window.localStorage.setItem(AUTO_BACKUP_META_STORAGE_KEY, JSON.stringify({ lastAutoBackupAt: snapshot.exportedAt }));
      setLastAutoBackupAt(snapshot.exportedAt);
      addAuditEntry({
        action: "backup",
        entityType: "restore-point",
        entityId: snapshot.exportedAt,
        summary: "Created restore point.",
        details: `Stored local restore point at ${snapshot.exportedAt}.`,
        category: "data",
      });
      setNotice("Restore point created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create restore point.";
      setPersistenceLastError(message);
      setNotice(`Could not create restore point: ${message}`);
    } finally {
      setRestorePointBusy(false);
    }
  };

  const openDesktopDataFolder = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to open the data folder.")) return;
    if (typeof window === "undefined" || !window.desktopPersistence?.openDataFolder) {
      setNotice("Open data folder is available in the desktop app.");
      return;
    }
    const result = await window.desktopPersistence.openDataFolder();
    if (result?.ok === false) {
      const message = result.message || "Could not open the data folder.";
      setPersistenceLastError(message);
      setNotice(message);
      return;
    }
    setNotice("Opened the Rental Tracker data folder.");
  };

  useEffect(() => {
    if (typeof window === "undefined" || !hasAnyData) return;
    if (window.desktopPersistence?.saveAppData) return;

    const nowMs = Date.now();
    const lastBackupMs = Date.parse(lastAutoBackupAt || "");
    if (!Number.isNaN(lastBackupMs) && nowMs - lastBackupMs < AUTO_BACKUP_INTERVAL_MS) {
      return;
    }

    const snapshot = buildBackupSnapshot();
    try {
      const existingBackups = readStoredAutoBackups(window.localStorage.getItem(AUTO_BACKUP_STORAGE_KEY));
      const nextBackups = [snapshot, ...existingBackups].slice(0, AUTO_BACKUP_MAX_ENTRIES);
      window.localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(nextBackups));
      window.localStorage.setItem(AUTO_BACKUP_META_STORAGE_KEY, JSON.stringify({ lastAutoBackupAt: snapshot.exportedAt }));
      setLastAutoBackupAt(snapshot.exportedAt);
    } catch {
      // Ignore storage write errors.
    }
  }, [buildBackupSnapshot, hasAnyData, lastAutoBackupAt]);

  return {
    applyLeaseAutomation,
    autoBackupStatusLabel,
    checkForDesktopUpdates,
    closeReleaseNotesDialog,
    createAutoBackupNow,
    currentAppVersion,
    currentReleaseHistory,
    currentReleaseNotesEntry,
    desktopUpdateBusy,
    desktopUpdateCanRestart,
    desktopUpdateCheckedAtLabel,
    desktopUpdateMessage,
    desktopUpdateProgress,
    desktopUpdateReleaseDateLabel,
    desktopUpdateState,
    desktopUpdateStatusKey,
    desktopUpdateStatusLabel,
    effectiveUpdateReleaseNotes,
    exportDataBackup,
    exportLatestAutoBackup,
    installDesktopUpdateNow,
    isDataHydrated,
    leaseAutomationDefaults,
    leaseAutomationLastRunAt,
    leaseAutomationLastRunLabel,
    leaseAutomationReminders,
    openCurrentReleaseNotesDialog,
    openDesktopDataFolder,
    openUpdateReleaseNotesDialog,
    persistenceHealth,
    persistenceLastError,
    performanceMetrics,
    reloadDesktopPersistenceData,
    releaseNotesDialog,
    restorePointBusy,
    releaseNotesDialogDateLabel,
    releaseNotesDialogEntry,
    releaseNotesDialogLines,
    releaseNotesDialogSummary,
    releaseNotesDialogTitle,
    releaseNotesDialogVersion,
    runLeaseAutomationNow,
    updateReleaseNotesEntry,
    updateTargetVersion,
  };
}
