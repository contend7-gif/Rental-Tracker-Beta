import type { ChangeEvent } from "react";
import { normalizeAndMigrateBackup } from "../domain/backupMigrations.ts";
import type { BackupMigrationResult } from "../domain/backupMigrations.ts";
import { createBlankForm } from "./draftFactories.js";

type InputRef = { current: HTMLInputElement | null };
type BackupImportMeta = {
  restoredDocumentFiles?: unknown;
  missingDocumentFiles?: unknown;
};
type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};
type UseDataReplacementWorkflowControllerArgs = {
  actions: {
    loadDemoData: () => Promise<void>;
    restoreBackupData: (data: Record<string, unknown>) => void;
  };
  appSettings: { confirmDestructiveActions: boolean };
  autoBackupStatusLabel: string;
  backupImportInputRef: InputRef;
  bankImportInputRef: InputRef;
  clearBankImportPreview: () => void;
  closeLeaseEditor: () => void;
  currentDataStatus?: { lastBackupAt?: string; lastValidationStatus?: string } | null;
  demoLoadWarning: { requiresTypedConfirmation: boolean; message: string };
  formatDesktopUpdateDate: (dateText: unknown) => string;
  hasAnyData: boolean;
  openConfirmDialog: (dialog: ConfirmDialog) => void;
  replaceSettings: (settings: unknown) => void;
  requirePermission: (capability: string, deniedMessage?: string) => boolean;
  resetMaintenanceWorkspaceState: () => void;
  restorePlanningWorkspaceFromBackupData: (data: Record<string, unknown>) => void;
  restoreTaxWorkspaceFromBackupData: (data: Record<string, unknown>) => void;
  setBackupValidationBusy: (busy: boolean) => void;
  setBackupValidationResult: (result: unknown) => void;
  setDashboardQuickAddOpen: (open: boolean) => void;
  setDocumentSearch: (search: string) => void;
  setDocumentStatusFilter: (filter: string) => void;
  setEditingTxnId: (id: string) => void;
  setExpenseQueueShowDismissed: (show: boolean) => void;
  setForm: (form: ReturnType<typeof createBlankForm>) => void;
  setNotice: (notice: string) => void;
  setPendingTxnAttachment: (attachment: unknown) => void;
  setPropertyFilter: (filter: string) => void;
  setPropertyQuickAddOpen: (open: boolean) => void;
  setSelectedDocument: (document: unknown) => void;
  setSelectedTxn: (transaction: unknown) => void;
  setUnitFilter: (filter: string) => void;
  setView: (view: string) => void;
  txnAttachmentInputRef: InputRef;
  txnInlineAttachmentInputRef: InputRef;
};

export function useDataReplacementWorkflowController({
  actions,
  appSettings,
  autoBackupStatusLabel,
  backupImportInputRef,
  bankImportInputRef,
  clearBankImportPreview,
  closeLeaseEditor,
  currentDataStatus,
  demoLoadWarning,
  formatDesktopUpdateDate,
  hasAnyData,
  openConfirmDialog,
  replaceSettings,
  requirePermission,
  resetMaintenanceWorkspaceState,
  restorePlanningWorkspaceFromBackupData,
  restoreTaxWorkspaceFromBackupData,
  setBackupValidationBusy,
  setBackupValidationResult,
  setDashboardQuickAddOpen,
  setDocumentSearch,
  setDocumentStatusFilter,
  setEditingTxnId,
  setExpenseQueueShowDismissed,
  setForm,
  setNotice,
  setPendingTxnAttachment,
  setPropertyFilter,
  setPropertyQuickAddOpen,
  setSelectedDocument,
  setSelectedTxn,
  setUnitFilter,
  setView,
  txnAttachmentInputRef,
  txnInlineAttachmentInputRef,
}: UseDataReplacementWorkflowControllerArgs) {
  const resetUiAfterDataReplace = () => {
    setPropertyFilter("all");
    setUnitFilter("all");
    setDocumentStatusFilter("all");
    setDocumentSearch("");
    setExpenseQueueShowDismissed(false);
    setForm(createBlankForm());
    setPendingTxnAttachment(null);
    if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
    if (txnInlineAttachmentInputRef.current) txnInlineAttachmentInputRef.current.value = "";
    if (backupImportInputRef.current) backupImportInputRef.current.value = "";
    if (bankImportInputRef.current) bankImportInputRef.current.value = "";
    clearBankImportPreview();
    setDashboardQuickAddOpen(false);
    setPropertyQuickAddOpen(false);
    setSelectedTxn(null);
    closeLeaseEditor();
    setSelectedDocument(null);
    setEditingTxnId("");
    resetMaintenanceWorkspaceState();
    setView("dashboard");
  };

  const runLoadDemoData = async () => {
    await actions.loadDemoData();
    restoreTaxWorkspaceFromBackupData({});
    restorePlanningWorkspaceFromBackupData({});
    resetUiAfterDataReplace();
    setNotice("Demo data loaded.");
  };

  const runImportBackup = (migration: BackupMigrationResult, importMeta: BackupImportMeta = {}) => {
    const { backup, migratedFromSchemaVersion, migrationsApplied } = migration;
    restoreTaxWorkspaceFromBackupData(backup.data);
    restorePlanningWorkspaceFromBackupData(backup.data);
    actions.restoreBackupData(backup.data);
    if (backup.settings !== undefined) {
      replaceSettings(backup.settings);
    }
    resetUiAfterDataReplace();
    if (migrationsApplied.length > 0) {
      setNotice(
        `Backup imported and migrated from schema v${migratedFromSchemaVersion} to v${backup.schemaVersion}.`,
      );
      return;
    }
    if (importMeta.restoredDocumentFiles !== undefined) {
      const restoredCount = Array.isArray(importMeta.restoredDocumentFiles) ? importMeta.restoredDocumentFiles.length : 0;
      const missingCount = Array.isArray(importMeta.missingDocumentFiles) ? importMeta.missingDocumentFiles.length : 0;
      setNotice(missingCount > 0
        ? `Warning: zip backup imported with ${restoredCount} document file${restoredCount === 1 ? "" : "s"} restored; ${missingCount} file${missingCount === 1 ? "" : "s"} missing from the archive. Review Documents for files that need reattachment.`
        : `Zip backup imported with ${restoredCount} document file${restoredCount === 1 ? "" : "s"} restored.`);
      return;
    }
    setNotice("Backup imported.");
  };

  const onBackupImportInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!requirePermission("manage_data_admin", "Admin access is required to import backup files.")) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const isZipBackup = /\.zip$/i.test(file.name || "") || String(file.type || "").toLowerCase().includes("zip");
      let migration: BackupMigrationResult;
      const importMeta: BackupImportMeta = {};

      if (isZipBackup) {
        const desktopPersistence = window.desktopPersistence;
        if (!desktopPersistence?.importBackupArchive) {
          throw new Error("Zip backup import is available in the desktop app.");
        }
        const archiveBuffer = await file.arrayBuffer();
        const importZipBackup = async () => {
          try {
            const archiveResult = await desktopPersistence.importBackupArchive(archiveBuffer);
            if (archiveResult?.ok === false) {
              throw new Error(archiveResult.message || "Could not import zip backup.");
            }
            runImportBackup(normalizeAndMigrateBackup(archiveResult.backup), {
              restoredDocumentFiles: archiveResult.restoredDocumentFiles || [],
              missingDocumentFiles: archiveResult.missingDocumentFiles || [],
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            setNotice(message || "Could not import zip backup.");
          }
        };

        if (!hasAnyData || !appSettings.confirmDestructiveActions) {
          await importZipBackup();
          return;
        }

        openConfirmDialog({
          title: "Import backup?",
          message: "This will replace your current app data with the selected zip backup and restore embedded document files.",
          confirmLabel: "Import backup",
          onConfirm: () => void importZipBackup(),
        });
        return;
      }

      const text = await file.text();
      const parsedBackup = JSON.parse(text);
      migration = normalizeAndMigrateBackup(parsedBackup);

      if (!hasAnyData || !appSettings.confirmDestructiveActions) {
        runImportBackup(migration, importMeta);
        return;
      }

      openConfirmDialog({
        title: "Import backup?",
        message: "This will replace your current app data with the selected backup file.",
        confirmLabel: "Import backup",
        onConfirm: () => runImportBackup(migration, importMeta),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setNotice(message || "Could not import backup.");
    } finally {
      if (backupImportInputRef.current) backupImportInputRef.current.value = "";
    }
  };

  const openBackupImportPicker = () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to import backup files.")) return;
    backupImportInputRef.current?.click();
  };

  const loadDemoData = () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to load demo data.")) return;
    const warning = demoLoadWarning;
    const backupCheckpoint = `Last backup: ${formatDesktopUpdateDate(currentDataStatus?.lastBackupAt || "") || autoBackupStatusLabel}. Last validation: ${currentDataStatus?.lastValidationStatus || "Not validated"}.`;
    if (!warning.requiresTypedConfirmation) {
      const confirmed = window.confirm(`${warning.message}\n\n${backupCheckpoint}\n\nLoad the fictional Sample Duplex dataset now?`);
      if (!confirmed) {
        setNotice("Sample dataset load canceled.");
        return;
      }
      void runLoadDemoData();
      return;
    }

    openConfirmDialog({
      title: "Load fictional sample data?",
      message: `${warning.message} ${backupCheckpoint} To continue, type SAMPLE in the next prompt.`,
      confirmLabel: "Continue",
      onConfirm: () => {
        const typed = window.prompt("Type SAMPLE to replace current local app data with the fictional sample dataset.");
        if (typed !== "SAMPLE") {
          setNotice("Sample dataset load canceled.");
          return;
        }
        void runLoadDemoData();
      },
    });
  };

  const validateLatestBackup = async () => {
    if (!requirePermission("manage_data_admin", "Admin access is required to validate backups.")) return;
    if (!window.desktopPersistence?.validateLatestBackup) {
      setNotice("Backup validation is available in the desktop app.");
      return;
    }
    setBackupValidationBusy(true);
    try {
      const result = await window.desktopPersistence.validateLatestBackup();
      if (result?.ok === false) throw new Error(result.message || "Could not validate latest backup.");
      setBackupValidationResult(result);
      setNotice(`Backup validation: ${result?.label || result?.status || "complete"}.`);
      if (window.desktopPersistence?.getHealth) {
        const health = await window.desktopPersistence.getHealth();
        if (health?.ok !== false) {
          // The persistence controller will refresh this on the next save as well; this immediate notice keeps Settings current enough for the panel.
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setBackupValidationResult({ status: "invalid", label: "Invalid", errors: [message || "Could not validate latest backup."], warnings: [] });
      setNotice(message || "Could not validate latest backup.");
    } finally {
      setBackupValidationBusy(false);
    }
  };

  return {
    loadDemoData,
    onBackupImportInputChange,
    openBackupImportPicker,
    validateLatestBackup,
  };
}
