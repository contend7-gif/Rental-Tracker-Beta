import React from "react";

const lazyNamed = (loader, exportName) =>
  React.lazy(() => loader().then((module) => ({ default: module[exportName] })));

const loadDashboardWorkspace = () => import("../features/dashboard/DashboardWorkspace.jsx");
const loadQuickAddWorkspace = () => import("../features/transactions/QuickAddWorkspace.jsx");
const loadLedgerWorkspace = () => import("../features/transactions/LedgerWorkspace.jsx");
const loadReviewCenterWorkspace = () => import("../features/review/ReviewCenterWorkspace.jsx");
const loadOperationsCalendarWorkspace = () => import("../features/operations/OperationsCalendarWorkspace.jsx");
const loadActivityWorkspace = () => import("../features/activity/ActivityWorkspace.jsx");
const loadPropertiesWorkspace = () => import("../features/properties/PropertiesWorkspace.jsx");
const loadLeaseHistoryWorkspace = () => import("../features/properties/LeaseHistoryWorkspace.jsx");
const loadMaintenanceWorkspace = () => import("../features/maintenance/MaintenanceWorkspace.jsx");
const loadAssetsWorkspace = () => import("../features/assets/AssetsWorkspace.jsx");
const loadLoansWorkspace = () => import("../features/loans/LoansWorkspace.jsx");
const loadPlanningWorkspace = () => import("../features/planning/PlanningWorkspace.jsx");
const loadTaxWorkspace = () => import("../features/tax/TaxWorkspace.jsx");
const loadDocumentsWorkspace = () => import("../features/documents/DocumentsWorkspace.jsx");
const loadSettingsWorkspace = () => import("../features/settings/SettingsWorkspace.jsx");

export const DashboardWorkspace = lazyNamed(loadDashboardWorkspace, "DashboardWorkspace");
export const QuickAddWorkspace = lazyNamed(loadQuickAddWorkspace, "QuickAddWorkspace");
export const LedgerWorkspace = lazyNamed(loadLedgerWorkspace, "LedgerWorkspace");
export const ReviewCenterWorkspace = lazyNamed(loadReviewCenterWorkspace, "ReviewCenterWorkspace");
export const OperationsCalendarWorkspace = lazyNamed(loadOperationsCalendarWorkspace, "OperationsCalendarWorkspace");
export const ActivityWorkspace = lazyNamed(loadActivityWorkspace, "ActivityWorkspace");
export const PropertiesWorkspace = lazyNamed(loadPropertiesWorkspace, "PropertiesWorkspace");
export const LeaseHistoryWorkspace = lazyNamed(loadLeaseHistoryWorkspace, "LeaseHistoryWorkspace");
export const MaintenanceWorkspace = lazyNamed(loadMaintenanceWorkspace, "MaintenanceWorkspace");
export const AssetsWorkspace = lazyNamed(loadAssetsWorkspace, "AssetsWorkspace");
export const LoansWorkspace = lazyNamed(loadLoansWorkspace, "LoansWorkspace");
export const PlanningWorkspace = lazyNamed(loadPlanningWorkspace, "PlanningWorkspace");
export const TaxWorkspace = lazyNamed(loadTaxWorkspace, "TaxWorkspace");
export const DocumentsWorkspace = lazyNamed(loadDocumentsWorkspace, "DocumentsWorkspace");
export const SettingsWorkspace = lazyNamed(loadSettingsWorkspace, "SettingsWorkspace");

const loadAssetEditorDialog = () => import("../features/assets/AssetEditorDialog.jsx");
const loadDocumentDialogs = () => import("../features/documents/DocumentDialogs.jsx");
const loadLeaseEditorDialog = () => import("../features/properties/LeaseEditorDialog.jsx");
const loadTransactionDialogs = () => import("../features/transactions/TransactionDialogs.jsx");
const loadCommonDialogs = () => import("../features/shared/CommonDialogs.jsx");
const loadEditorDialogs = () => import("../features/shared/EditorDialogs.jsx");

export const AssetEditorDialog = lazyNamed(loadAssetEditorDialog, "AssetEditorDialog");
export const DocumentImportDialog = lazyNamed(loadDocumentDialogs, "DocumentImportDialog");
export const DocumentPreviewDialog = lazyNamed(loadDocumentDialogs, "DocumentPreviewDialog");
export const LeaseEditorDialog = lazyNamed(loadLeaseEditorDialog, "LeaseEditorDialog");
export const BankImportReviewDialog = lazyNamed(loadTransactionDialogs, "BankImportReviewDialog");
export const DeleteTransactionDialog = lazyNamed(loadTransactionDialogs, "DeleteTransactionDialog");
export const TaxPrintDialog = lazyNamed(loadTransactionDialogs, "TaxPrintDialog");
export const TransactionDetailsDialog = lazyNamed(loadTransactionDialogs, "TransactionDetailsDialog");
export const ConfirmActionDialog = lazyNamed(loadCommonDialogs, "ConfirmActionDialog");
export const LeaseValidationDialog = lazyNamed(loadCommonDialogs, "LeaseValidationDialog");
export const ReleaseNotesDialog = lazyNamed(loadCommonDialogs, "ReleaseNotesDialog");
export const DashboardQuickAddDialog = lazyNamed(loadEditorDialogs, "DashboardQuickAddDialog");
export const LoanEditorDialog = lazyNamed(loadEditorDialogs, "LoanEditorDialog");
export const PropertyQuickAddDialog = lazyNamed(loadEditorDialogs, "PropertyQuickAddDialog");

const prefetchedChunks = new Set();

const workspacePrefetchLoaders = {
  dashboard: loadDashboardWorkspace,
  quickAdd: loadQuickAddWorkspace,
  ledger: loadLedgerWorkspace,
  review: loadReviewCenterWorkspace,
  operations: loadOperationsCalendarWorkspace,
  activity: loadActivityWorkspace,
  properties: loadPropertiesWorkspace,
  leaseHistory: loadLeaseHistoryWorkspace,
  maintenance: loadMaintenanceWorkspace,
  assets: loadAssetsWorkspace,
  loans: loadLoansWorkspace,
  planning: loadPlanningWorkspace,
  tax: loadTaxWorkspace,
  documents: loadDocumentsWorkspace,
  settings: loadSettingsWorkspace,
};

const dialogPrefetchLoaders = {
  assetEditor: ["asset-editor", loadAssetEditorDialog],
  bankImportReview: ["transaction-dialogs", loadTransactionDialogs],
  confirmAction: ["common-dialogs", loadCommonDialogs],
  dashboardQuickAdd: ["editor-dialogs", loadEditorDialogs],
  deleteTransaction: ["transaction-dialogs", loadTransactionDialogs],
  documentImport: ["document-dialogs", loadDocumentDialogs],
  documentPreview: ["document-dialogs", loadDocumentDialogs],
  leaseEditor: ["lease-editor", loadLeaseEditorDialog],
  leaseValidation: ["common-dialogs", loadCommonDialogs],
  loanEditor: ["editor-dialogs", loadEditorDialogs],
  propertyQuickAdd: ["editor-dialogs", loadEditorDialogs],
  releaseNotes: ["common-dialogs", loadCommonDialogs],
  taxPrint: ["transaction-dialogs", loadTransactionDialogs],
  transactionDetails: ["transaction-dialogs", loadTransactionDialogs],
};

export const likelyNextViewsByView = {
  dashboard: ["quickAdd", "ledger", "operations", "planning", "properties"],
  quickAdd: ["ledger", "documents", "dashboard"],
  ledger: ["quickAdd", "documents", "tax"],
  activity: ["dashboard", "properties"],
  properties: ["leaseHistory", "maintenance", "dashboard"],
  leaseHistory: ["properties", "dashboard", "documents"],
  maintenance: ["documents", "quickAdd", "properties"],
  assets: ["planning", "tax", "loans"],
  loans: ["planning", "tax", "assets"],
  planning: ["loans", "assets", "tax"],
  tax: ["planning", "ledger", "documents"],
  documents: ["review", "quickAdd", "maintenance", "ledger"],
  review: ["ledger", "documents", "tax"],
  operations: ["leaseHistory", "maintenance", "documents", "planning"],
  settings: ["dashboard", "planning"],
};

function prefetchChunk(key, loader) {
  if (!loader || prefetchedChunks.has(key)) return;
  prefetchedChunks.add(key);
  void loader();
}

export function prefetchWorkspace(viewKey) {
  const loader = workspacePrefetchLoaders[viewKey];
  if (!loader) return;
  prefetchChunk(`workspace:${viewKey}`, loader);
}

export function prefetchDialog(dialogKey) {
  const entry = dialogPrefetchLoaders[dialogKey];
  if (!entry) return;
  const [chunkKey, loader] = entry;
  prefetchChunk(`dialog:${chunkKey}`, loader);
}
