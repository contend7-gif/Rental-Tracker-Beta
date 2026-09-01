import { ACCESS_ROLE_OPTIONS } from "../store/appSettings.ts";
import type { AccessRole, AppSettings } from "../store/appSettings.ts";

export type AccessCapability =
  | "manage_personal_settings"
  | "manage_operational_settings"
  | "manage_financial_settings"
  | "manage_statement_branding"
  | "manage_access_profile"
  | "manage_data_admin"
  | "create_edit_records"
  | "delete_records"
  | "run_imports"
  | "review_documents"
  | "reconcile_records"
  | "export_reports"
  | "run_desktop_diagnostics";

export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = ACCESS_ROLE_OPTIONS.reduce<Record<AccessRole, string>>((map, option) => {
  map[option.value] = option.label;
  return map;
}, {} as Record<AccessRole, string>);

export const ACCESS_CAPABILITY_MATRIX: Record<AccessRole, AccessCapability[]> = {
  admin: [
    "manage_personal_settings",
    "manage_operational_settings",
    "manage_financial_settings",
    "manage_statement_branding",
    "manage_access_profile",
    "manage_data_admin",
    "create_edit_records",
    "delete_records",
    "run_imports",
    "review_documents",
    "reconcile_records",
    "export_reports",
    "run_desktop_diagnostics",
  ],
  manager: [
    "manage_personal_settings",
    "manage_operational_settings",
    "manage_financial_settings",
    "manage_statement_branding",
    "create_edit_records",
    "run_imports",
    "review_documents",
    "reconcile_records",
    "export_reports",
    "run_desktop_diagnostics",
  ],
  bookkeeper: [
    "manage_personal_settings",
    "manage_operational_settings",
    "create_edit_records",
    "run_imports",
    "review_documents",
    "reconcile_records",
    "export_reports",
    "run_desktop_diagnostics",
  ],
  read_only: ["manage_personal_settings", "export_reports", "run_desktop_diagnostics"],
};

export const ACCESS_CAPABILITY_LABELS: Record<AccessCapability, string> = {
  manage_personal_settings: "personal preferences",
  manage_operational_settings: "automation settings",
  manage_financial_settings: "financial safeguards",
  manage_statement_branding: "statement branding",
  manage_access_profile: "access profile",
  manage_data_admin: "backup and restore tools",
  create_edit_records: "record changes",
  delete_records: "delete actions",
  run_imports: "imports",
  review_documents: "OCR review actions",
  reconcile_records: "reconciliation",
  export_reports: "exports and printing",
  run_desktop_diagnostics: "desktop diagnostics",
};

export const SETTING_CAPABILITY_BY_KEY: Partial<Record<keyof AppSettings, AccessCapability>> = {
  theme: "manage_personal_settings",
  defaultView: "manage_personal_settings",
  sidebarCollapsedByDefault: "manage_personal_settings",
  ledgerDefaultSort: "manage_personal_settings",
  autoMaterializeRecurring: "manage_operational_settings",
  leaseAutomationEnabled: "manage_operational_settings",
  leaseDefaultRentDueDay: "manage_operational_settings",
  leaseReminderDaysBefore: "manage_operational_settings",
  leaseAutoLateFeeEnabled: "manage_operational_settings",
  leaseLateFeeGraceDays: "manage_operational_settings",
  leaseLateFeeType: "manage_operational_settings",
  leaseLateFeeValue: "manage_operational_settings",
  leaseDesktopNotifications: "manage_operational_settings",
  operationsDesktopNotifications: "manage_operational_settings",
  monthlyCloseRecords: "reconcile_records",
  statementBusinessName: "manage_statement_branding",
  statementBusinessAddress: "manage_statement_branding",
  statementBusinessEmail: "manage_statement_branding",
  statementBusinessPhone: "manage_statement_branding",
  statementLogoDataUrl: "manage_statement_branding",
  statementPreparedBy: "manage_statement_branding",
  statementOwnerRecipient: "manage_statement_branding",
  statementOwnerEmail: "manage_statement_branding",
  statementOwnerPhone: "manage_statement_branding",
  statementOwnerNote: "manage_statement_branding",
  statementTenantNote: "manage_statement_branding",
  deMinimisElectionEnabled: "manage_financial_settings",
  deMinimisHasAFS: "manage_financial_settings",
  deMinimisStatementPrepared: "manage_financial_settings",
  confirmDestructiveActions: "manage_personal_settings",
  aiDocumentCopilotEnabled: "manage_personal_settings",
  aiOpenAiApiKey: "manage_personal_settings",
  aiOpenAiModel: "manage_personal_settings",
  accessRole: "manage_access_profile",
  operatorName: "manage_access_profile",
};

export function accessRoleHasCapability(role: AccessRole, capability: AccessCapability) {
  const allowed = ACCESS_CAPABILITY_MATRIX[role] || ACCESS_CAPABILITY_MATRIX.read_only;
  return allowed.includes(capability);
}
