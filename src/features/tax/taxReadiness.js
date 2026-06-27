const SECTION_DEFS = [
  { key: "transactions", label: "Transactions", primaryActionLabel: "Go to Ledger", targetView: "ledger" },
  { key: "documents", label: "Documents", primaryActionLabel: "Review Documents", targetView: "documents" },
  { key: "assets", label: "Assets", primaryActionLabel: "Review Assets", targetView: "assets" },
  { key: "maintenance", label: "Maintenance", primaryActionLabel: "Review Maintenance", targetView: "maintenance" },
  { key: "occupancy", label: "Occupancy", primaryActionLabel: "Review Occupancy", targetView: "leaseHistory" },
  { key: "tenantLedger", label: "Tenant Ledger", primaryActionLabel: "Review Ledger", targetView: "leaseHistory" },
  { key: "loans", label: "Loans", primaryActionLabel: "Review Loans", targetView: "loans" },
];

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function documentNeedsReview(document) {
  const text = [document?.name, document?.type, Array.isArray(document?.tags) ? document.tags.join(" ") : ""].join(" ").toLowerCase();
  if (document?.ocrStatus === "pending" || document?.ocrStatus === "queued") return true;
  if (!document?.transactionId && !document?.leaseId && !document?.workOrderId && !text.includes("supporting-only")) return true;
  return false;
}

function buildSection({ key, reviewCount, readyCount = 0, blockingCount = reviewCount, helperText }) {
  const def = SECTION_DEFS.find((item) => item.key === key);
  const status = reviewCount > 0 ? "needs_review" : "ready";
  return {
    ...def,
    status,
    readyCount,
    reviewCount,
    blockingCount,
    helperText: helperText || (status === "ready" ? `${def.label} source records look ready.` : `${def.label} has source records to clean up.`),
  };
}

export function buildTaxReadinessSummary({
  transactionReviewInbox = [],
  assetReviewInbox = {},
  maintenanceReviewInbox = {},
  occupancyReviewInbox = {},
  tenantLedgerReviewInbox = {},
  loanReviewInbox = {},
  documents = [],
  yearFilter,
  propertyFilter,
} = {}) {
  const assetReviewCount = countArray(assetReviewInbox.transactionCandidates) + countArray(assetReviewInbox.assetRecords);
  const documentReviewCount = documents.filter(documentNeedsReview).length;
  const sections = [
    buildSection({
      key: "transactions",
      reviewCount: countArray(transactionReviewInbox),
      helperText: "Ledger review items, receipt gaps, service-period issues, and capital-improvement decisions.",
    }),
    buildSection({
      key: "documents",
      reviewCount: documentReviewCount,
      readyCount: Math.max(0, documents.length - documentReviewCount),
      helperText: "Pending OCR, unlinked files, and document queues that should be settled at the source.",
    }),
    buildSection({
      key: "assets",
      reviewCount: assetReviewCount,
      readyCount: assetReviewInbox.counts?.readyAssets || 0,
      helperText: "Asset candidates, depreciation setup warnings, and source transaction links.",
    }),
    buildSection({
      key: "maintenance",
      reviewCount: maintenanceReviewInbox.counts?.total || countArray(maintenanceReviewInbox.records),
      helperText: "Work-order accounting treatment, linked expenses, documents, and capital assets.",
    }),
    buildSection({
      key: "occupancy",
      reviewCount: occupancyReviewInbox.counts?.total || countArray(occupancyReviewInbox.records),
      helperText: "Lease coverage, owner/vacancy periods, and allocation dependencies.",
    }),
    buildSection({
      key: "tenantLedger",
      reviewCount: tenantLedgerReviewInbox.counts?.total || countArray(tenantLedgerReviewInbox.records),
      helperText: "Security deposits, fees, payments, refunds, credits, and ended-lease balances.",
    }),
    buildSection({
      key: "loans",
      reviewCount: loanReviewInbox.counts?.total || countArray(loanReviewInbox.records),
      helperText: "1098, escrow, PMI, missing payment months, and occupancy-dependent interest.",
    }),
  ];

  const reviewCount = sections.reduce((sum, section) => sum + Number(section.reviewCount || 0), 0);
  return {
    yearFilter,
    propertyFilter,
    status: reviewCount > 0 ? "needs_review" : "ready",
    label: reviewCount > 0 ? "Needs source-record cleanup" : "Ready for Tax Center",
    reviewCount,
    sections,
  };
}
