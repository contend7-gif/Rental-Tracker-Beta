import { useMemo } from "react";
import { buildAssetReviewInbox } from "../features/assets/assetReview.js";
import { buildLoanReviewInbox, summarizeLoanReadiness } from "../features/loans/loanReview.js";
import { buildOccupancyReviewInbox, summarizeOccupancyReadiness } from "../features/properties/occupancyReview.js";
import { buildSetupChecklist, shouldShowFullSetupChecklist } from "../features/setup/setupChecklist.js";
import { buildTaxReadinessSummary } from "../features/tax/taxReadiness.js";
import { buildTenantLedgerReviewInbox, summarizeTenantLedgerReadiness } from "../features/leases/tenantLedgerReview.js";

export function useReviewReadinessModel({
  activeTx,
  appSettings,
  assets,
  documents,
  effectiveLoanPaymentDeductibleInterest,
  filteredDocuments,
  isTaxReviewRelevantTransaction,
  leaseCoverageByProperty,
  leases,
  loanPayments,
  loans,
  maintenanceReviewInbox,
  persistenceHealth,
  properties,
  propertyFilter,
  tenantLedgerEntries,
  todayIso,
  transactionReviewInbox,
  units,
  usePeriods,
  workOrders,
  yearFilter,
}) {
  const occupancyReviewContext = useMemo(
    () => ({
      yearFilter,
      todayIso,
      transactions: activeTx,
      assets,
      loans,
    }),
    [activeTx, assets, loans, todayIso, yearFilter],
  );

  const occupancyReviewInbox = useMemo(
    () => buildOccupancyReviewInbox(leaseCoverageByProperty, occupancyReviewContext),
    [leaseCoverageByProperty, occupancyReviewContext],
  );

  const occupancyReadinessSummary = useMemo(
    () => summarizeOccupancyReadiness(leaseCoverageByProperty, occupancyReviewContext),
    [leaseCoverageByProperty, occupancyReviewContext],
  );

  const tenantLedgerReviewArgs = useMemo(
    () => ({
      leases,
      tenantLedgerEntries,
      transactions: activeTx,
      documents,
      workOrders,
      yearFilter,
      propertyFilter,
      todayIso,
    }),
    [activeTx, documents, leases, propertyFilter, tenantLedgerEntries, todayIso, workOrders, yearFilter],
  );

  const tenantLedgerReviewInbox = useMemo(
    () => buildTenantLedgerReviewInbox(tenantLedgerReviewArgs),
    [tenantLedgerReviewArgs],
  );

  const tenantLedgerReadinessSummary = useMemo(
    () => summarizeTenantLedgerReadiness(tenantLedgerReviewArgs),
    [tenantLedgerReviewArgs],
  );

  const loanReviewArgs = useMemo(
    () => ({
      loans,
      loanPayments,
      transactions: activeTx,
      documents,
      occupancyReviewInbox,
      yearFilter,
      propertyFilter,
      todayIso,
      getDeductibleInterest: effectiveLoanPaymentDeductibleInterest,
    }),
    [activeTx, documents, effectiveLoanPaymentDeductibleInterest, loanPayments, loans, occupancyReviewInbox, propertyFilter, todayIso, yearFilter],
  );

  const loanReviewInbox = useMemo(
    () => buildLoanReviewInbox(loanReviewArgs),
    [loanReviewArgs],
  );

  const loanReadinessSummary = useMemo(
    () => summarizeLoanReadiness(loanReviewArgs),
    [loanReviewArgs],
  );

  const assetListForView = useMemo(
    () => assets.filter((asset) => propertyFilter === "all" || asset.propertyId === propertyFilter),
    [assets, propertyFilter],
  );

  const assetReviewInbox = useMemo(
    () => buildAssetReviewInbox({
      assets: assetListForView,
      transactions: activeTx.filter((transaction) => propertyFilter === "all" || transaction.propertyId === propertyFilter),
      documents,
      properties,
      units,
      leases,
      usePeriods,
      yearFilter,
      isTaxReviewRelevantTransaction,
    }),
    [activeTx, assetListForView, documents, properties, units, leases, usePeriods, yearFilter, propertyFilter, isTaxReviewRelevantTransaction],
  );

  const taxReadinessSummary = useMemo(
    () => buildTaxReadinessSummary({
      transactionReviewInbox,
      assetReviewInbox,
      maintenanceReviewInbox,
      occupancyReviewInbox,
      tenantLedgerReviewInbox,
      loanReviewInbox,
      documents: filteredDocuments,
      yearFilter,
      propertyFilter,
    }),
    [transactionReviewInbox, assetReviewInbox, maintenanceReviewInbox, occupancyReviewInbox, tenantLedgerReviewInbox, loanReviewInbox, filteredDocuments, yearFilter, propertyFilter],
  );

  const setupChecklist = useMemo(
    () => buildSetupChecklist({
      properties,
      units,
      leases,
      usePeriods,
      loans,
      assets,
      transactions: activeTx,
      documents,
      tenantLedgerEntries,
      desktopHealth: persistenceHealth,
      propertyFilter,
      taxReadinessSummary,
      overrides: appSettings.setupChecklistOverrides,
      showDismissed: appSettings.setupChecklistShowDismissed,
    }),
    [properties, units, leases, usePeriods, loans, assets, activeTx, documents, tenantLedgerEntries, persistenceHealth, propertyFilter, taxReadinessSummary, appSettings.setupChecklistOverrides, appSettings.setupChecklistShowDismissed],
  );

  const setupChecklistShowFull = shouldShowFullSetupChecklist(setupChecklist, appSettings);

  return {
    assetListForView,
    assetReviewInbox,
    loanReadinessSummary,
    loanReviewInbox,
    occupancyReadinessSummary,
    occupancyReviewInbox,
    setupChecklist,
    setupChecklistShowFull,
    taxReadinessSummary,
    tenantLedgerReadinessSummary,
    tenantLedgerReviewInbox,
  };
}
