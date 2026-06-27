import {
  ACCESS_CAPABILITY_LABELS,
  ACCESS_CAPABILITY_MATRIX,
  ACCESS_ROLE_LABELS,
  SETTING_CAPABILITY_BY_KEY,
  accessRoleHasCapability,
} from "./accessControl.js";
import { ACCESS_ROLE_OPTIONS } from "../store/appSettings.ts";

export function useAccessSettingsController({
  accessRole,
  accessRoleLabel,
  actions,
  appSettings,
  desktopDocumentAiApi,
  persistDashboardCardSetting,
  persistSetting,
  resetStoredSettings,
  setNotice,
}) {
  const activeAccessRoleOption = ACCESS_ROLE_OPTIONS.find((option) => option.value === accessRole) || ACCESS_ROLE_OPTIONS[0];
  const roleAccessSummary = (ACCESS_CAPABILITY_MATRIX[accessRole] || []).map((capability) => ACCESS_CAPABILITY_LABELS[capability]).filter(Boolean);
  const canManageAccessProfile = accessRoleHasCapability(accessRole, "manage_access_profile");
  const canManageDataAdmin = accessRoleHasCapability(accessRole, "manage_data_admin");
  const canCreateEditRecords = accessRoleHasCapability(accessRole, "create_edit_records");
  const canDeleteRecords = accessRoleHasCapability(accessRole, "delete_records");
  const canReviewDocuments = accessRoleHasCapability(accessRole, "review_documents");
  const canReconcileRecords = accessRoleHasCapability(accessRole, "reconcile_records");
  const aiDocumentCopilotConfigured = Boolean(appSettings.aiDocumentCopilotEnabled && String(appSettings.aiOpenAiApiKey || "").trim());
  const aiDocumentCopilotReady = Boolean(aiDocumentCopilotConfigured && desktopDocumentAiApi?.analyze);

  const permissionDeniedMessage = (capability) => {
    const capabilityLabel = ACCESS_CAPABILITY_LABELS[capability] || "that action";
    return `${accessRoleLabel} access cannot change ${capabilityLabel}.`;
  };

  const requirePermission = (capability, deniedMessage) => {
    if (accessRoleHasCapability(accessRole, capability)) return true;
    setNotice(deniedMessage || permissionDeniedMessage(capability));
    return false;
  };

  const addAuditEntry = ({ action, entityType, entityId, propertyId, unit, summary, details, category }) => {
    actions.addActivityLogEntry({ action, entityType, entityId, propertyId, unit, summary, details, category });
  };

  const setSetting = (key, value) => {
    const capability = SETTING_CAPABILITY_BY_KEY[key] || "manage_personal_settings";
    if (!requirePermission(capability)) return;
    const previousValue = appSettings[key];
    persistSetting(key, value);
    if (key === "accessRole" && value !== previousValue) {
      addAuditEntry({
        action: "access-role",
        entityType: "settings",
        entityId: "access-profile",
        summary: `Access profile changed to ${ACCESS_ROLE_LABELS[value] || value}.`,
        details: `Previous role: ${ACCESS_ROLE_LABELS[previousValue] || previousValue || "Unknown"}. Operator: ${appSettings.operatorName || "Local admin"}.`,
        category: "security",
      });
    }
  };

  const setDashboardCardSetting = (cardId, checked) => {
    if (!requirePermission("manage_personal_settings")) return;
    persistDashboardCardSetting(cardId, checked);
  };

  const restoreLocalAdminAccess = () => {
    const previousValue = appSettings.accessRole || "admin";
    if (previousValue === "admin") {
      setNotice("Admin access is already active.");
      return;
    }
    persistSetting("accessRole", "admin");
    addAuditEntry({
      action: "access-recovery",
      entityType: "settings",
      entityId: "access-profile",
      summary: "Restored local admin access.",
      details: `Previous role: ${ACCESS_ROLE_LABELS[previousValue] || previousValue || "Unknown"}. Operator: ${appSettings.operatorName || "Local admin"}.`,
      category: "security",
    });
    setNotice("Local admin access restored.");
  };

  const resetToDefaults = () => {
    if (!requirePermission("manage_access_profile")) return;
    resetStoredSettings();
    addAuditEntry({
      action: "reset",
      entityType: "settings",
      entityId: "defaults",
      summary: "Reset app settings to defaults.",
      details: `Triggered by ${appSettings.operatorName || "Local admin"}.`,
      category: "settings",
    });
    setNotice("Settings reset to defaults.");
  };

  const toggleDashboardCardSetting = (cardId, checked) => {
    setDashboardCardSetting(cardId, checked);
  };

  return {
    activeAccessRoleOption,
    addAuditEntry,
    aiDocumentCopilotConfigured,
    aiDocumentCopilotReady,
    canCreateEditRecords,
    canDeleteRecords,
    canManageAccessProfile,
    canManageDataAdmin,
    canReconcileRecords,
    canReviewDocuments,
    requirePermission,
    resetToDefaults,
    restoreLocalAdminAccess,
    roleAccessSummary,
    setSetting,
    toggleDashboardCardSetting,
  };
}
