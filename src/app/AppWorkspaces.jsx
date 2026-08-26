import React, { Suspense } from "react";
import { currency, toPctDisplay } from "../domain/accounting.ts";
import { adjustedAssetDepreciationForYear } from "../domain/assetDepreciation.ts";
import {
  buildChartPointX,
  buildChartPolyline,
  formatDateTime,
  leaseReminderKindLabel,
  leaseReminderToneClass,
} from "../lib/appSupport.ts";
import { documentNeedsIndexing, documentNeedsTags, documentSupportsAutomaticOcr, normalizeDocumentOcrStatus, normalizeExtractedDocumentText } from "../domain/documentIntelligence.ts";
import { isTenantLedgerKindAllowedForTreatment, normalizeTenantLedgerAccountingTreatment, recommendedTenantLedgerAccountingTreatment, recommendedTenantLedgerKindForTreatment } from "../domain/tenantLedgerPosting.ts";
import { getLeaseExpirationPill, leaseExpirationToneClass, shouldExpandNeedsReview } from "../store/dashboardContext.ts";
import { LEASE_AUTOMATION_HELPER_TEXT } from "../store/appSettings.ts";
import { useStableActions } from "../store/useStableActions.ts";
import { field } from "../features/shared/uiHelpers.jsx";
import { assetSchedule, categories, normalizeBonusRate } from "./accountingShared.js";
import { daysUntil } from "./dateHelpers.js";
import {
  documentLinkSuggestionKindLabel,
  documentTagSuggestionSourceLabel,
  expenseSuggestionConfidenceLabel,
  expenseSuggestionReasonSummary,
  workOrderSuggestionConfidenceLabel,
  workOrderSuggestionReasonSummary,
} from "./documentShared.ts";
import { createBlankWorkOrderDraft } from "./draftFactories.js";
import { formatPercentInput, formatUsPhone } from "./formatHelpers.js";
import { leaseActualEndLabel, leaseIsActiveByDate, leaseStatusForDate, leaseTypeLabel } from "./leaseShared.js";
import { navItems } from "./navigationShared.js";
import {
  WORKSPACE_FILTER_PANEL_CLASS,
  WORKSPACE_MUTED_PANEL_CLASS,
  WORKSPACE_PANEL_CLASS,
  WORKSPACE_STAT_TILE_CLASS,
} from "./workspaceUi.js";
import {
  ActivityWorkspace,
  AssetsWorkspace,
  DashboardWorkspace,
  DocumentsWorkspace,
  LeaseHistoryWorkspace,
  LedgerWorkspace,
  LoansWorkspace,
  MaintenanceWorkspace,
  PlanningWorkspace,
  PropertiesWorkspace,
  QuickAddWorkspace,
  ReviewCenterWorkspace,
  SettingsWorkspace,
  TaxWorkspace,
  prefetchDialog,
} from "./lazyRegistry.js";
import { WorkspaceLoadingState } from "./WorkspaceLoadingState.jsx";

const MemoizedDocumentsWorkspace = React.memo(DocumentsWorkspace);

const LEDGER_WORKSPACE_PROP_KEYS = [
  "activeProperties",
  "applyBankImportMatches",
  "bankImportDefaults",
  "bankImportFileName",
  "bankImportImportedCount",
  "bankImportInputRef",
  "bankImportMatchCount",
  "bankImportMatchRule",
  "bankImportMatches",
  "bankImportRows",
  "bankImportSkippedRows",
  "bankImportUnitOptions",
  "bankImportUnmatchedRows",
  "clearBankImportPreview",
  "expectedRecurringTransactions",
  "isTaxReviewRelevantTransaction",
  "ledgerCategories",
  "ledgerTransactions",
  "markTransactionCapitalImprovement",
  "markTransactionsTaxReviewed",
  "onBankImportInputChange",
  "onBankImportMatchRuleChange",
  "openBankImportPicker",
  "openBankImportReview",
  "openTransaction",
  "postDueRecurringTransactions",
  "properties",
  "propertyNameById",
  "reconcileTransactions",
  "selectedTxn",
  "startCreateAssetFromTransaction",
  "transactionById",
  "transactionReviewById",
  "transactionReviewInbox",
  "useTransactionDatesAsServicePeriods",
];

const REVIEW_WORKSPACE_PROP_KEYS = [
  "assetReviewInbox",
  "createWorkOrderExpense",
  "loanReviewInbox",
  "maintenanceReviewInbox",
  "markTransactionCapitalImprovement",
  "markTransactionSupportUnavailable",
  "markTransactionsTaxReviewed",
  "navigateWithDashboardContext",
  "occupancyReviewInbox",
  "openAssetEditor",
  "openLease",
  "openNewLeaseForUnit",
  "openOccupancyEditor",
  "openTransaction",
  "openWorkOrderAttachmentPicker",
  "pendingExpenseReviewCount",
  "pendingWorkOrderReviewCount",
  "propertyNameById",
  "resetLoanPaymentDraftForLoan",
  "reviewNextExpenseQueueItem",
  "reviewNextWorkOrderQueueItem",
  "startCreateAssetFromTransaction",
  "startCreateAssetFromWorkOrder",
  "taxReadinessSummary",
  "taxReviewOpenCount",
  "tenantLedgerReviewInbox",
  "transactionReviewInbox",
  "useTransactionDatesAsServicePeriods",
  "vendorById",
  "visibleDocumentsMissingIndex",
  "visibleSafeSuggestionCount",
  "yearFilter",
];

const DOCUMENTS_WORKSPACE_PROP_KEYS = [
  "acceptVisibleSafeSuggestions",
  "aiDocumentCopilotConfigured",
  "aiDocumentCopilotReady",
  "applyDocumentLinkSuggestion",
  "applySafeSuggestionsToDocument",
  "applySuggestedDocumentTags",
  "automaticDocumentOcrAvailable",
  "canAutoCreateExpenseFromSuggestion",
  "canAutoCreateWorkOrderFromSuggestion",
  "canReviewDocuments",
  "confirmAndDeleteDocument",
  "createExpenseTransactionsFromUtilitySections",
  "describeDocumentOwnership",
  "dismissDocumentExpenseReview",
  "dismissDocumentWorkOrderReview",
  "dismissVisibleExpenseQueue",
  "dismissedExpenseReviewCount",
  "dismissedWorkOrderReviewCount",
  "documentAiActionLabel",
  "documentAiBusyById",
  "desktopCompanionApi",
  "documentBatchOcrBusy",
  "documentExpenseReviewRecordById",
  "documentImportInputRef",
  "documentOcrBusyById",
  "documentWorkOrderReviewRecordById",
  "filteredDocuments",
  "getDocumentExpenseSuggestion",
  "getDocumentExtractedFields",
  "getDocumentLinkedWorkOrder",
  "getDocumentLinkSuggestions",
  "getDocumentSuggestedTags",
  "getDocumentUtilitySections",
  "getDocumentWorkOrderSuggestion",
  "getSafeDocumentLinkSuggestion",
  "getSafeDocumentTagSuggestions",
  "leaseById",
  "leases",
  "loadDocumentForReview",
  "markVisibleDocumentsPendingOcr",
  "markDocumentWarningsReviewed",
  "updateLinkedTransactionFromDocumentOcr",
  "onDocumentImportInputChange",
  "openMobileCompanionImport",
  "openDocumentImportPicker",
  "openDocumentLinkedRecord",
  "openDocumentPreview",
  "openExpenseDraftFromDocument",
  "openExpenseDraftFromUtilitySection",
  "openWorkOrderDraftFromDocument",
  "pendingExpenseReviewCount",
  "pendingHighConfidenceExpenseReviewCount",
  "pendingHighConfidenceWorkOrderReviewCount",
  "pendingWorkOrderReviewCount",
  "propertyNameById",
  "queueDocumentForOcr",
  "removeDocumentRecordLink",
  "reopenDocumentExpenseReview",
  "reopenDocumentWorkOrderReview",
  "reviewNextExpenseQueueItem",
  "reviewNextWorkOrderQueueItem",
  "runDocumentAiAnalysis",
  "runVisibleDocumentOcr",
  "saveDocumentExtractedText",
  "saveDocumentOcrFieldCorrections",
  "saveDocumentTags",
  "selectExpenseQueueFilter",
  "selectWorkOrderQueueFilter",
  "transactionById",
  "transactionReviewInbox",
  "transactions",
  "units",
  "visibleAutomaticOcrDocuments",
  "visibleDocuments",
  "visibleDocumentsMissingIndex",
  "visibleExpenseReviewRecords",
  "visibleSafeSuggestionCount",
  "workOrders",
];

const TAX_WORKSPACE_PROP_KEYS = [
  "actions",
  "applyOwnerStatementNoteTemplate",
  "carryoverInputValue",
  "carryoverScope",
  "clearEscrowDisbursementDraft",
  "clearTaxFiledAmountOverride",
  "confirmResetTaxDayOverride",
  "copyOwnerStatementBody",
  "copyOwnerStatementSubject",
  "copyTaxReviewNotes",
  "createEscrowTransaction",
  "defaultEscrowLoanOptions",
  "deleteEscrowDisbursement",
  "editingEscrowDisbursementId",
  "escrowDisbursementDraft",
  "escrowDisbursementRows",
  "exportOwnerCommunicationBundle",
  "exportOwnerReport",
  "exportOwnerStatement",
  "exportOwnerStatementPdf",
  "exportScheduleEFilledPdf",
  "exportScheduleEFormFdf",
  "exportScheduleEReport",
  "exportTaxDetailCsv",
  "formatPropertyLabel",
  "formatScheduleAmount",
  "formatUnitLabel",
  "getScheduleAmountTone",
  "linkEscrowDisbursementToTransaction",
  "navigateWithDashboardContext",
  "openTransaction",
  "ownerMonthlyRows",
  "ownerMonthlyTotals",
  "ownerStatementCustomEnd",
  "ownerStatementCustomStart",
  "ownerStatementEmailDraftBody",
  "ownerStatementEmailDraftSubject",
  "ownerStatementNoteDraft",
  "ownerStatementNoteTemplate",
  "ownerStatementPeriodLabel",
  "ownerStatementPreparedBy",
  "ownerStatementPreset",
  "ownerStatementRange",
  "ownerStatementRecipient",
  "ownerStatementRecipientEmail",
  "ownerStatementRecipientPhone",
  "printOwnerStatement",
  "printTaxPacket",
  "propertyFilter",
  "propertyNameById",
  "saveEscrowDisbursement",
  "selectedOwnerProperty",
  "setCarryoverForScope",
  "setEscrowDisbursementDraft",
  "setOwnerStatementCustomEnd",
  "setOwnerStatementCustomStart",
  "setOwnerStatementNoteDraft",
  "setOwnerStatementNoteMode",
  "setOwnerStatementNoteTemplate",
  "setOwnerStatementPreset",
  "setTaxDayOverride",
  "setTaxFiledAmountOverride",
  "setTaxFiledAmountOverrideNote",
  "setTaxPrintDialogOpen",
  "setTaxPrintProperty",
  "setTaxPrintScope",
  "setTaxPrintUnit",
  "setTaxReviewCollapsed",
  "setTaxReviewMode",
  "setTaxReviewNotesCollapsed",
  "startEditEscrowDisbursement",
  "taxByPropertySchedule",
  "taxByUnitSchedule",
  "taxEscrowWarnings",
  "taxFiledAmountOverrideInput",
  "taxPacketSummary",
  "taxReadinessSummary",
  "taxReportingSummary",
  "taxReviewCollapsed",
  "taxReviewCpaNotes",
  "taxReviewMode",
  "taxReviewNotesCollapsed",
  "taxReviewOpenCount",
  "taxReviewSections",
  "taxScheduleBreakdown",
  "taxSnapshot",
  "unitFilter",
  "yearFilter",
];

const SETTINGS_WORKSPACE_PROP_KEYS = [
  "activeAccessRoleOption",
  "aiDocumentCopilotReady",
  "appSettings",
  "autoBackupStatusLabel",
  "backupImportInputRef",
  "backupValidationBusy",
  "backupValidationResult",
  "canManageAccessProfile",
  "canManageDataAdmin",
  "checkForDesktopUpdates",
  "createAutoBackupNow",
  "currentAppVersion",
  "currentDataStatus",
  "currentReleaseHistory",
  "currentReleaseNotesEntry",
  "desktopDiagnosticsApi",
  "desktopDiagnosticsBusy",
  "desktopDiagnosticsCheckedAtLabel",
  "desktopDiagnosticsRecentEvents",
  "desktopDiagnosticsReport",
  "desktopCompanionApi",
  "desktopDocumentAiApi",
  "desktopUpdateBusy",
  "desktopUpdateCanRestart",
  "desktopUpdateCheckedAtLabel",
  "desktopUpdateMessage",
  "desktopUpdateProgress",
  "desktopUpdateReleaseDateLabel",
  "desktopUpdateState",
  "desktopUpdateStatusKey",
  "desktopUpdateStatusLabel",
  "desktopUpdaterAvailable",
  "deMinimisThreshold",
  "effectiveUpdateReleaseNotes",
  "exportDataBackup",
  "exportLatestAutoBackup",
  "installDesktopUpdateNow",
  "loadDemoData",
  "onBackupImportInputChange",
  "onStatementLogoInputChange",
  "openBackupImportPicker",
  "openCurrentReleaseNotesDialog",
  "openDesktopDataFolder",
  "openUpdateReleaseNotesDialog",
  "persistenceHealth",
  "persistenceLastError",
  "performanceMetrics",
  "realDataChecklist",
  "reloadDesktopPersistenceData",
  "restorePointBusy",
  "resetToDefaults",
  "restoreLocalAdminAccess",
  "roleAccessSummary",
  "runDesktopDiagnostics",
  "setSetting",
  "setSettingsSectionCollapsed",
  "setView",
  "settingsSectionCollapsed",
  "setupChecklist",
  "statementLogoInputRef",
  "toggleDashboardCardSetting",
  "updateReleaseNotesEntry",
  "updateTargetVersion",
  "validateLatestBackup",
];

function pickProps(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function flattenWorkspaceContract(contract) {
  return Object.assign({}, ...Object.values(contract));
}

function buildLedgerWorkspaceContract(props, { bankImportMatchRuleOptions }) {
  return {
    formatting: { currency, formatUsPhone, toPctDisplay },
    filters: props.ledgerFilters,
    data: pickProps(props, [
      "expectedRecurringTransactions",
      "documents",
      "ledgerCategories",
      "ledgerTransactions",
      "properties",
      "propertyNameById",
      "selectedTxn",
      "todayIso",
      "transactionById",
    ]),
    imports: pickProps(props, [
      "applyBankImportMatches",
      "bankImportDefaults",
      "bankImportFileName",
      "bankImportImportedCount",
      "bankImportInputRef",
      "bankImportMatchCount",
      "bankImportMatchRule",
      "bankImportMatches",
      "bankImportRows",
      "bankImportSkippedRows",
      "bankImportUnitOptions",
      "bankImportUnmatchedRows",
      "clearBankImportPreview",
      "onBankImportInputChange",
      "onBankImportMatchRuleChange",
      "openBankImportPicker",
      "openBankImportReview",
    ]),
    review: pickProps(props, [
      "isTaxReviewRelevantTransaction",
      "postDueRecurringTransactions",
      "transactionReviewById",
      "transactionReviewInbox",
    ]),
    actions: pickProps(props, [
      "markTransactionCapitalImprovement",
      "markTransactionsTaxReviewed",
      "reconcileTransactions",
      "startCreateAssetFromTransaction",
      "useTransactionDatesAsServicePeriods",
    ]),
    navigation: {
      openReviewCenter: props.openReviewCenter,
      openTransaction: props.openTransaction,
      prefetchBankImportReviewDialog: () => prefetchDialog("bankImportReview"),
      prefetchTransactionDialog: () => prefetchDialog("transactionDetails"),
    },
    workspaceUi: {
      BANK_IMPORT_MATCH_RULE_OPTIONS: bankImportMatchRuleOptions,
      WORKSPACE_MUTED_PANEL_CLASS,
      categories,
    },
  };
}

function buildTaxWorkspaceContract(props, { taxWorkspaceUiProps }) {
  return {
    formatting: {
      currency,
      formatPropertyLabel: props.formatPropertyLabel,
      formatScheduleAmount: props.formatScheduleAmount,
      formatUnitLabel: props.formatUnitLabel,
      getScheduleAmountTone: props.getScheduleAmountTone,
    },
    filters: pickProps(props, [
      "carryoverScope",
      "propertyFilter",
      "unitFilter",
      "yearFilter",
    ]),
    data: pickProps(props, [
      "defaultEscrowLoanOptions",
      "escrowDisbursementRows",
      "effectiveLoanPaymentDeductibleInterest",
      "effectiveLoanPaymentRentalUsePct",
      "loanPayments",
      "ownerMonthlyRows",
      "ownerMonthlyTotals",
      "propertyNameById",
      "selectedOwnerProperty",
      "taxByPropertySchedule",
      "taxByUnitSchedule",
      "taxEscrowWarnings",
      "taxReviewSections",
      "taxScheduleBreakdown",
      "taxSnapshot",
      "visibleLoans",
    ]),
    summary: pickProps(props, [
      "taxPacketSummary",
      "taxReadinessSummary",
      "taxReportingSummary",
    ]),
    readiness: pickProps(props, [
      "taxReviewCollapsed",
      "taxReviewCpaNotes",
      "taxReviewMode",
      "taxReviewNotesCollapsed",
      "taxReviewOpenCount",
    ]),
    ownerReporting: pickProps(props, [
      "applyOwnerStatementNoteTemplate",
      "copyOwnerStatementBody",
      "copyOwnerStatementSubject",
      "exportOwnerCommunicationBundle",
      "exportOwnerReport",
      "exportOwnerStatement",
      "exportOwnerStatementPdf",
      "ownerStatementCustomEnd",
      "ownerStatementCustomStart",
      "ownerStatementEmailDraftBody",
      "ownerStatementEmailDraftSubject",
      "ownerStatementNoteDraft",
      "ownerStatementNoteTemplate",
      "ownerStatementPeriodLabel",
      "ownerStatementPreparedBy",
      "ownerStatementPreset",
      "ownerStatementRange",
      "ownerStatementRecipient",
      "ownerStatementRecipientEmail",
      "ownerStatementRecipientPhone",
      "printOwnerStatement",
      "setOwnerStatementCustomEnd",
      "setOwnerStatementCustomStart",
      "setOwnerStatementNoteDraft",
      "setOwnerStatementNoteMode",
      "setOwnerStatementNoteTemplate",
      "setOwnerStatementPreset",
    ]),
    packet: pickProps(props, [
      "clearTaxFiledAmountOverride",
      "confirmResetTaxDayOverride",
      "copyTaxReviewNotes",
      "exportScheduleEFilledPdf",
      "printTaxPacket",
      "setTaxDayOverride",
      "setTaxFiledAmountOverride",
      "setTaxFiledAmountOverrideNote",
      "taxFiledAmountOverrideInput",
    ]),
    escrow: pickProps(props, [
      "clearEscrowDisbursementDraft",
      "createEscrowTransaction",
      "deleteEscrowDisbursement",
      "editingEscrowDisbursementId",
      "escrowDisbursementDraft",
      "linkEscrowDisbursementToTransaction",
      "saveEscrowDisbursement",
      "setEscrowDisbursementDraft",
      "startEditEscrowDisbursement",
    ]),
    actions: {
      actions: props.actions,
      exportScheduleEFilledPdf: props.exportScheduleEFilledPdf,
      exportScheduleEFormFdf: props.exportScheduleEFormFdf,
      exportScheduleEReport: props.exportScheduleEReport,
      exportTaxDetailCsv: props.exportTaxDetailCsv,
      navigateWithDashboardContext: props.navigateWithDashboardContext,
      openTransaction: props.openTransaction,
      setCarryoverForScope: props.setCarryoverForScope,
      setTaxPrintDialogOpen: props.setTaxPrintDialogOpen,
      setTaxPrintProperty: props.setTaxPrintProperty,
      setTaxPrintScope: props.setTaxPrintScope,
      setTaxPrintUnit: props.setTaxPrintUnit,
      setTaxReviewCollapsed: props.setTaxReviewCollapsed,
      setTaxReviewMode: props.setTaxReviewMode,
      setTaxReviewNotesCollapsed: props.setTaxReviewNotesCollapsed,
      updateLoanYearEndReview: props.actions.updateLoanYearEndReview,
    },
    state: {
      carryoverInputValue: props.carryoverInputValue,
      editingEscrowDisbursementId: props.editingEscrowDisbursementId,
    },
    ui: {
      ...taxWorkspaceUiProps,
      WORKSPACE_FILTER_PANEL_CLASS,
      WORKSPACE_MUTED_PANEL_CLASS,
      WORKSPACE_PANEL_CLASS,
      WORKSPACE_STAT_TILE_CLASS,
    },
  };
}

export function AppWorkspaces(props) {
  const {
    actions,
    appSettings,
    bankImportMatchRuleOptions,
    setNotice,
    setPropertyFilter,
    setSetting,
    setSetupChecklistOverride,
    setView,
    taxWorkspaceUiProps,
    toggleSetupChecklistShowFull,
    view,
  } = props;

  const commonProps = {
    ...props,
    currency,
    formatUsPhone,
    toPctDisplay,
  };
  const formattingProps = { currency, formatUsPhone, toPctDisplay };
  const ledgerWorkspaceContract = buildLedgerWorkspaceContract(props, { bankImportMatchRuleOptions });
  const ledgerWorkspaceProps = flattenWorkspaceContract(ledgerWorkspaceContract);
  const reviewWorkspaceProps = {
    currency,
    ...pickProps(props, REVIEW_WORKSPACE_PROP_KEYS),
    actions,
    markLoanYearReviewed: actions.markLoanYearReviewed,
    updateLoanYearEndReview: actions.updateLoanYearEndReview,
    setView,
  };
  const documentsWorkspaceProps = {
    currency,
    ...props.documentFilters,
    ...pickProps(props, DOCUMENTS_WORKSPACE_PROP_KEYS),
    WORKSPACE_FILTER_PANEL_CLASS,
    WORKSPACE_STAT_TILE_CLASS,
    documentLinkSuggestionKindLabel,
    documentNeedsIndexing,
    documentNeedsTags,
    documentSupportsAutomaticOcr,
    documentTagSuggestionSourceLabel,
    expenseSuggestionConfidenceLabel,
    expenseSuggestionReasonSummary,
    normalizeDocumentOcrStatus,
    normalizeExtractedDocumentText,
    mobileCompanionEnabled: appSettings.mobileCompanionEnabled,
    openMobileCompanionSettings: () => setView("settings"),
    prefetchDocumentImportDialog: () => prefetchDialog("documentImport"),
    prefetchDocumentPreviewDialog: () => prefetchDialog("documentPreview"),
    workOrderSuggestionConfidenceLabel,
    workOrderSuggestionReasonSummary,
  };
  const stableDocumentCallbacks = useStableActions(Object.fromEntries(
    Object.entries(documentsWorkspaceProps).filter(([, value]) => typeof value === "function"),
  ));
  const stableDocumentsWorkspaceProps = {
    ...documentsWorkspaceProps,
    ...stableDocumentCallbacks,
  };
  const taxWorkspaceContract = buildTaxWorkspaceContract(props, { taxWorkspaceUiProps });
  const taxWorkspaceProps = flattenWorkspaceContract(taxWorkspaceContract);
  const settingsWorkspaceProps = {
    ...formattingProps,
    ...pickProps(props, SETTINGS_WORKSPACE_PROP_KEYS),
    desktopDiagnosticEventClass: props.desktopDiagnosticEventClass,
    desktopDiagnosticPillClass: props.desktopDiagnosticPillClass,
    desktopUpdateBadgeClass: props.desktopUpdateBadgeClass,
    formatDesktopUpdateDate: props.formatDesktopUpdateDate,
    navItems,
    setupChecklistShowDismissed: appSettings.setupChecklistShowDismissed,
    toggleSetupChecklistDismissed: (itemKey) => setSetupChecklistOverride(itemKey, "dismissed"),
    toggleSetupChecklistShowDismissed: (checked) => setSetting("setupChecklistShowDismissed", checked),
    toggleSetupChecklistItemOverride: setSetupChecklistOverride,
  };

  return (
    <Suspense fallback={<WorkspaceLoadingState />}>
      {view === "dashboard" && (
        <DashboardWorkspace
          {...commonProps}
          daysUntil={daysUntil}
          getLeaseExpirationPill={getLeaseExpirationPill}
          leaseExpirationToneClass={leaseExpirationToneClass}
          prefetchLeaseEditorDialog={() => prefetchDialog("leaseEditor")}
          prefetchTransactionDialog={() => prefetchDialog("transactionDetails")}
          shouldExpandNeedsReview={shouldExpandNeedsReview}
          setupChecklistShowDismissed={appSettings.setupChecklistShowDismissed}
          toggleSetupChecklistDismissed={(itemKey) => setSetupChecklistOverride(itemKey, "dismissed")}
          toggleSetupChecklistShowDismissed={(checked) => setSetting("setupChecklistShowDismissed", checked)}
          toggleSetupChecklistItemOverride={setSetupChecklistOverride}
          toggleSetupChecklistShowFull={toggleSetupChecklistShowFull}
        />
      )}
      {view === "quickAdd" && (
        <QuickAddWorkspace
          {...commonProps}
          categories={categories}
          expenseSuggestionConfidenceLabel={expenseSuggestionConfidenceLabel}
          formatPercentInput={formatPercentInput}
        />
      )}
      {view === "ledger" && (
        <LedgerWorkspace
          {...ledgerWorkspaceProps}
          openReviewCenter={() => setView("review")}
        />
      )}
      {view === "review" && (
        <ReviewCenterWorkspace
          {...reviewWorkspaceProps}
        />
      )}
      {view === "activity" && <ActivityWorkspace {...commonProps} />}
      {view === "properties" && (
        <PropertiesWorkspace
          {...commonProps}
          leaseIsActiveByDate={leaseIsActiveByDate}
        />
      )}
      {view === "leaseHistory" && (
        <LeaseHistoryWorkspace
          {...commonProps}
          LEASE_AUTOMATION_HELPER_TEXT={LEASE_AUTOMATION_HELPER_TEXT}
          leaseActualEndLabel={leaseActualEndLabel}
          leaseReminderKindLabel={leaseReminderKindLabel}
          leaseReminderToneClass={leaseReminderToneClass}
          leaseStatusForDate={leaseStatusForDate}
          leaseTypeLabel={leaseTypeLabel}
          openReviewCenter={() => setView("review")}
        />
      )}
      {view === "maintenance" && (
        <MaintenanceWorkspace
          {...commonProps}
          WORKSPACE_FILTER_PANEL_CLASS={WORKSPACE_FILTER_PANEL_CLASS}
          WORKSPACE_MUTED_PANEL_CLASS={WORKSPACE_MUTED_PANEL_CLASS}
          WORKSPACE_PANEL_CLASS={WORKSPACE_PANEL_CLASS}
          WORKSPACE_STAT_TILE_CLASS={WORKSPACE_STAT_TILE_CLASS}
          createBlankWorkOrderDraft={createBlankWorkOrderDraft}
          openReviewCenter={() => setView("review")}
          workOrderPriorityOptions={props.WORK_ORDER_PRIORITY_OPTIONS}
          workOrderSuggestionConfidenceLabel={workOrderSuggestionConfidenceLabel}
        />
      )}
      {view === "assets" && (
        <AssetsWorkspace
          {...commonProps}
          adjustedAssetDepreciationForYear={adjustedAssetDepreciationForYear}
          assetSchedule={assetSchedule}
          normalizeBonusRate={normalizeBonusRate}
          openReviewCenter={() => setView("review")}
          prefetchAssetEditorDialog={() => prefetchDialog("assetEditor")}
        />
      )}
      {view === "loans" && (
        <LoansWorkspace
          {...commonProps}
          openPropertyValuation={(propertyId) => {
            setPropertyFilter(propertyId);
            setView("properties");
            setNotice("Update current property value from Properties so valuation support stays attached.");
          }}
          openReviewCenter={() => setView("review")}
          prefetchLoanEditorDialog={() => prefetchDialog("loanEditor")}
        />
      )}
      {view === "planning" && (
        <PlanningWorkspace
          {...commonProps}
          buildChartPointX={buildChartPointX}
          buildChartPolyline={buildChartPolyline}
          formatDateTime={formatDateTime}
          renderField={field}
          workspaceMutedPanelClass={WORKSPACE_MUTED_PANEL_CLASS}
          workspaceStatTileClass={WORKSPACE_STAT_TILE_CLASS}
        />
      )}
      {view === "tax" && (
        <TaxWorkspace
          {...taxWorkspaceProps}
        />
      )}
      {view === "documents" && (
        <MemoizedDocumentsWorkspace
          {...stableDocumentsWorkspaceProps}
        />
      )}
      {view === "settings" && (
        <SettingsWorkspace
          {...settingsWorkspaceProps}
        />
      )}
    </Suspense>
  );
}
