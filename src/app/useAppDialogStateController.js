import { useCallback, useState } from "react";
import { toLocalIsoDate } from "../lib/localDate.ts";

function createBlankPropertyDraft() {
  return {
    name: "",
    address: "",
    type: "Duplex",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    purchasedOn: toLocalIsoDate(),
    purchasePrice: "",
    landValue: "",
    currentValue: "",
    unitsText: "",
  };
}

function createBlankAssetDraft() {
  return {
    propertyId: "",
    unit: "Shared",
    description: "",
    type: "Capital Improvement",
    placedInService: toLocalIsoDate(),
    cost: "",
    landValue: "",
    basis: "",
    life: "27.5",
    bonusElected: "No",
    bonusRate: "1",
  };
}

export function useAppDialogStateController({ prefetchDialog }) {
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: "", message: "", confirmLabel: "Confirm", onConfirm: null });
  const [propertyQuickAddOpen, setPropertyQuickAddOpen] = useState(false);
  const [dashboardQuickAddOpen, setDashboardQuickAddOpen] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState(() => createBlankPropertyDraft());
  const [settingsSectionCollapsed, setSettingsSectionCollapsed] = useState({
    access: false,
    ai: true,
    workspace: false,
    automation: false,
    branding: true,
    accounting: false,
    desktop: false,
    backup: true,
  });
  const [backupValidationResult, setBackupValidationResult] = useState(null);
  const [backupValidationBusy, setBackupValidationBusy] = useState(false);
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  const [assetEditorDraft, setAssetEditorDraft] = useState(null);
  const [assetDraft, setAssetDraft] = useState(() => createBlankAssetDraft());

  const openConfirmDialog = useCallback(({ title, message, confirmLabel = "Delete", onConfirm }) => {
    prefetchDialog("confirmAction");
    setConfirmDialog({ open: true, title, message, confirmLabel, onConfirm });
  }, [prefetchDialog]);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, title: "", message: "", confirmLabel: "Confirm", onConfirm: null });
  }, []);

  const resetPropertyDraft = useCallback(() => {
    setPropertyDraft(createBlankPropertyDraft());
  }, []);

  return {
    assetDraft,
    assetEditorDraft,
    assetEditorOpen,
    backupValidationBusy,
    backupValidationResult,
    closeConfirmDialog,
    confirmDialog,
    dashboardQuickAddOpen,
    openConfirmDialog,
    propertyDraft,
    propertyQuickAddOpen,
    resetPropertyDraft,
    setAssetDraft,
    setAssetEditorDraft,
    setAssetEditorOpen,
    setBackupValidationBusy,
    setBackupValidationResult,
    setDashboardQuickAddOpen,
    setPropertyDraft,
    setPropertyQuickAddOpen,
    setSettingsSectionCollapsed,
    settingsSectionCollapsed,
  };
}
