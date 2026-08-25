import { getAssetReadiness } from "./assetReview.js";

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function buildAssetWorkspaceModes({ assetCount = 0, cleanupCount = 0, year } = {}) {
  const assetLabel = `${assetCount} ${assetCount === 1 ? "asset" : "assets"}`;
  return [
    {
      key: "overview",
      label: "Overview",
      badge: assetLabel,
      description: "See basis, current-year depreciation, readiness, and source coverage.",
    },
    {
      key: "register",
      label: "Asset register",
      badge: assetLabel,
      description: "Maintain buildings, improvements, equipment, and placed-in-service details.",
    },
    {
      key: "schedules",
      label: "Schedules",
      badge: year ? `${year} tax year` : assetLabel,
      description: "Inspect depreciation by asset and preview prior and future schedule years.",
    },
    {
      key: "cleanup",
      label: "Cleanup & sources",
      badge: cleanupCount > 0 ? `${cleanupCount} open` : "Clear",
      description: "Resolve missing sources, basis issues, mixed-use review, and candidates.",
    },
  ];
}

export function assetSourceTransactionIds(asset) {
  return Array.from(new Set([
    asset?.sourceTransactionId,
    ...(Array.isArray(asset?.sourceTransactionIds) ? asset.sourceTransactionIds : []),
  ].filter(Boolean).map(String)));
}

export function getAssetSourceStatus(asset, { transactionById = {}, workOrderById = {} } = {}) {
  const transactionIds = assetSourceTransactionIds(asset);
  const workOrderId = asset?.sourceWorkOrderId ? String(asset.sourceWorkOrderId) : "";
  const documentIds = Array.isArray(asset?.sourceDocumentIds) ? asset.sourceDocumentIds.filter(Boolean).map(String) : [];
  const sourceCount = transactionIds.length + (workOrderId ? 1 : 0) + documentIds.length;
  const missingTransactionCount = transactionIds.filter((id) => !transactionById?.[id]).length;
  const workOrderMissing = Boolean(workOrderId && !workOrderById?.[workOrderId]);

  if (missingTransactionCount || workOrderMissing) {
    return {
      key: "missing_source",
      label: "Missing source",
      tone: "warning",
      sourceCount,
      missingCount: missingTransactionCount + (workOrderMissing ? 1 : 0),
    };
  }
  if (sourceCount > 1) {
    return { key: "multiple_sources", label: "Multiple sources", tone: "ready", sourceCount, missingCount: 0 };
  }
  if (sourceCount === 1) {
    return { key: "source_linked", label: "Source linked", tone: "ready", sourceCount, missingCount: 0 };
  }
  return { key: "missing_source", label: "Missing source", tone: "muted", sourceCount: 0, missingCount: 0 };
}

export function buildAssetSummary({
  adjustedAssetDepreciationForYear,
  assets = [],
  leases = [],
  reviewContext = {},
  transactionById = {},
  units = [],
  usePeriods = [],
  workOrderById = {},
  year,
} = {}) {
  const selectedYear = Number(year);
  return assets.reduce((summary, asset) => {
    const depreciation = Number.isFinite(selectedYear) && adjustedAssetDepreciationForYear
      ? adjustedAssetDepreciationForYear({ asset, year: selectedYear, usePeriods, leases, units })
      : 0;
    const sourceStatus = getAssetSourceStatus(asset, { transactionById, workOrderById });
    const readiness = getAssetReadiness(asset, reviewContext);

    summary.totalCost += numberValue(asset.cost);
    summary.totalBasis += numberValue(asset.basis);
    summary.selectedYearDepreciation += numberValue(depreciation);
    summary.assetCount += 1;
    if (readiness.key === "needs_review" || sourceStatus.key === "missing_source") summary.needsReviewCount += 1;
    if (sourceStatus.key === "source_linked" || sourceStatus.key === "multiple_sources") summary.sourceLinkedCount += 1;
    return summary;
  }, {
    totalCost: 0,
    totalBasis: 0,
    selectedYearDepreciation: 0,
    assetCount: 0,
    needsReviewCount: 0,
    sourceLinkedCount: 0,
  });
}

export function buildAssetReviewGroups({ assetReviewInbox = {}, assets = [], transactionById = {}, workOrderById = {} } = {}) {
  const assetRecords = assetReviewInbox.assetRecords || [];
  const transactionCandidates = assetReviewInbox.transactionCandidates || [];
  const issueKeys = assetRecords.flatMap((record) => record.issues || []).map((issue) => issue.key);
  const hasIssue = (...keys) => issueKeys.some((key) => keys.includes(key));
  const sourceStatuses = assets.map((asset) => getAssetSourceStatus(asset, { transactionById, workOrderById }));
  const missingSourceCount = sourceStatuses.filter((status) => status.key === "missing_source").length;
  const calculationIssueCount = assetRecords.reduce((sum, record) => sum + (record.issues || []).length, 0);

  return [
    {
      key: "transaction_candidates",
      label: "Capital-improvement candidates",
      count: transactionCandidates.length,
      status: transactionCandidates.length ? "Needs review" : "Ready",
    },
    {
      key: "asset_warnings",
      label: "Asset warnings",
      count: calculationIssueCount,
      status: calculationIssueCount ? "Needs review" : "Ready",
    },
    {
      key: "missing_sources",
      label: "Source documentation missing",
      count: missingSourceCount,
      status: missingSourceCount ? "Needs source" : "Ready",
    },
    {
      key: "mixed_use",
      label: "Mixed-use review",
      count: issueKeys.filter((key) => key === "mixed_use_review_needed").length,
      status: hasIssue("mixed_use_review_needed") ? "Needs review" : "Ready",
    },
    {
      key: "basis_source",
      label: "Basis/source review",
      count: issueKeys.filter((key) => [
        "asset_missing_cost",
        "asset_missing_basis",
        "building_missing_land_value",
        "source_transaction_amount_mismatch",
        "source_transaction_not_capitalized",
      ].includes(key)).length,
      status: hasIssue(
        "asset_missing_cost",
        "asset_missing_basis",
        "building_missing_land_value",
        "source_transaction_amount_mismatch",
        "source_transaction_not_capitalized",
      ) ? "Needs review" : "Ready",
    },
    {
      key: "ready_assets",
      label: "Tax-ready assets",
      count: assetReviewInbox.counts?.readyAssets || assetReviewInbox.readyAssets?.length || 0,
      status: "Ready",
    },
  ];
}
