import React, { Suspense } from "react";
import { buildAppDialogGroups } from "./buildAppDialogProps.js";
import {
  AssetEditorDialog,
  BankImportReviewDialog,
  ConfirmActionDialog,
  DashboardQuickAddDialog,
  DeleteTransactionDialog,
  DocumentImportDialog,
  DocumentPreviewDialog,
  LeaseEditorDialog,
  LeaseValidationDialog,
  LoanEditorDialog,
  PropertyQuickAddDialog,
  ReleaseNotesDialog,
  TaxPrintDialog,
  TransactionDetailsDialog,
} from "./lazyRegistry.js";

export function AppDialogs(props) {
  const {
    assetEditorOpen,
    bankImportReviewOpen,
    confirmDialog,
    dashboardQuickAddOpen,
    documentImportDialogOpen,
    leaseEditorMode,
    leaseValidationDialog,
    loanEditorOpen,
    propertyQuickAddOpen,
    releaseNotesDialog,
    selectedDocument,
    selectedTxn,
    taxPrintDialogOpen,
    txnToDelete,
  } = props;

  const {
    transactionDialogs,
    documentDialogs,
    leaseDialogs,
    loanDialogs,
    assetDialogs,
    taxDialogs,
    releaseNotesDialog: releaseNotesDialogs,
    confirmDialog: confirmationDialogs,
    propertyDialogs,
  } = buildAppDialogGroups(props);

  return (
    <Suspense fallback={null}>
      {bankImportReviewOpen && (
        <BankImportReviewDialog
          {...transactionDialogs.bankImportReview}
        />
      )}
      {Boolean(selectedTxn) && (
        <TransactionDetailsDialog
          {...transactionDialogs.details}
        />
      )}
      {Boolean(txnToDelete) && (
        <DeleteTransactionDialog
          {...transactionDialogs.deleteTransaction}
        />
      )}
      {taxPrintDialogOpen && (
        <TaxPrintDialog
          {...taxDialogs.print}
        />
      )}
      {propertyQuickAddOpen && (
        <PropertyQuickAddDialog
          {...propertyDialogs.quickAdd}
        />
      )}
      {dashboardQuickAddOpen && (
        <DashboardQuickAddDialog
          {...transactionDialogs.quickAdd}
        />
      )}
      {loanEditorOpen && (
        <LoanEditorDialog
          {...loanDialogs.editor}
        />
      )}
      {assetEditorOpen && (
        <AssetEditorDialog
          {...assetDialogs.editor}
        />
      )}
      {Boolean(leaseEditorMode) && (
        <LeaseEditorDialog
          {...leaseDialogs.editor}
        />
      )}
      {Boolean(leaseValidationDialog) && (
        <LeaseValidationDialog
          {...leaseDialogs.validation}
        />
      )}
      {Boolean(confirmDialog?.open) && (
        <ConfirmActionDialog
          {...confirmationDialogs.confirmAction}
        />
      )}
      {Boolean(releaseNotesDialog?.open) && (
        <ReleaseNotesDialog
          {...releaseNotesDialogs.current}
        />
      )}
      {documentImportDialogOpen && (
        <DocumentImportDialog
          {...documentDialogs.import}
        />
      )}
      {Boolean(selectedDocument) && (
        <DocumentPreviewDialog
          {...documentDialogs.preview}
        />
      )}
    </Suspense>
  );
}
