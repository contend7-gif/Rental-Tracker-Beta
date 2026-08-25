export function buildTaxWorkspaceModes({ packageStatus = "Preliminary", reviewCount = 0, sourceRowCount = 0 } = {}) {
  return [
    {
      key: "summary",
      label: "Summary",
      badge: packageStatus,
      description: "See computed results, readiness, and the most useful next actions.",
      tabs: ["overview"],
    },
    {
      key: "schedule",
      label: "Schedule E",
      badge: `${sourceRowCount} source row${sourceRowCount === 1 ? "" : "s"}`,
      description: "Review line totals and the source records behind each amount.",
      tabs: ["schedule", "details"],
    },
    {
      key: "review",
      label: "Review & support",
      badge: reviewCount > 0 ? `${reviewCount} open` : "Ready",
      description: "Resolve tax checks, depreciation, loan, escrow, and support items.",
      tabs: ["review", "depreciation", "loans", "tools"],
    },
    {
      key: "filing",
      label: "Filing package",
      badge: packageStatus,
      description: "Prepare exports, printouts, and the tax-preparer handoff packet.",
      tabs: ["packet"],
    },
  ];
}

export function groupByLabel(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = item?.key || item?.label || item?.description || "item";
    const label = item?.label || item?.description || key;
    const existing = grouped.get(key) || {
      ...item,
      key,
      label,
      reviewCount: 0,
      entries: [],
    };
    existing.reviewCount += Number(item?.reviewCount || 1);
    existing.entries.push(item);
    grouped.set(key, existing);
  });
  return [...grouped.values()];
}

export function supportStatusForTaxDetail(detail = {}) {
  if (detail.lineKey === "rentalIncome") {
    if (detail.documentCount > 0) return { key: "lease_backed", label: "Lease-backed" };
    if (detail.reviewStatus === "reviewed") return { key: "rent_roll_supported", label: "Rent-roll supported" };
    return { key: "income_support_missing", label: "Income support review" };
  }
  if (detail.sourceType === "loan" || detail.sourceType === "loan_review" || detail.sourceType === "override") {
    return detail.documentCount > 0
      ? { key: "loan_documented", label: "Loan document linked" }
      : { key: "loan_document_gap", label: "Loan/tax document gap" };
  }
  if (detail.sourceType === "asset") {
    return detail.documentCount > 0
      ? { key: "asset_source_linked", label: "Asset source linked" }
      : { key: "asset_source_gap", label: "Asset source gap" };
  }
  if (detail.documentCount > 0) return { key: "document_linked", label: "Receipt/document linked" };
  return { key: "document_gap", label: "Receipt/document gap" };
}

export function readinessForScheduleLine({ line = {}, rows = [], filedRow } = {}) {
  if (filedRow?.status === "needs_note") return { key: "needs_review", label: "Needs review", helper: "Filed amount difference needs a note." };
  if (filedRow?.filedAmount != null && filedRow?.status === "difference") return { key: "override", label: "Override active", helper: "Filed amount differs from computed sources." };
  if (!rows.length) return { key: "no_sources", label: "No sources", helper: "No source rows currently feed this line." };
  if (rows.some((row) => row.reviewStatus === "open" || supportStatusForTaxDetail(row).key.endsWith("_gap"))) {
    return { key: "needs_review", label: "Needs review", helper: "One or more source rows need review or support." };
  }
  return { key: "ready", label: "Ready", helper: `${line.label || "Line"} source rows look ready.` };
}

export function readinessCounts({ taxPacketSummary = {}, taxReadinessSummary = {}, taxReportingSummary = {} } = {}) {
  const blockingIssues = Number(taxPacketSummary.openItems?.length || 0) +
    Number((taxReportingSummary.computedFiledRows || []).filter((row) => row.status === "needs_note").length);
  const sourceWarnings = Number(taxReadinessSummary.reviewCount || 0);
  const supportWarnings = Number(taxPacketSummary.documentChecklist?.missingSupportCount || 0) +
    Number(taxPacketSummary.documentChecklist?.rentIncomeSupportWarnings?.length || 0);
  const packageStatus = blockingIssues > 0
    ? "Needs review"
    : supportWarnings > 0
      ? "Preliminary"
      : "Ready";
  return { blockingIssues, sourceWarnings, supportWarnings, packageStatus };
}

export function supportBuckets(documentChecklist = {}) {
  return [
    { key: "expense", label: "Expense receipt/document gaps", rows: documentChecklist.expenseSupportGaps || [] },
    { key: "loan", label: "Loan/tax document gaps", rows: documentChecklist.loanDocumentGaps || [] },
    { key: "asset", label: "Asset source gaps", rows: documentChecklist.assetSourceGaps || [] },
    { key: "rent", label: "Rent income support warnings", rows: documentChecklist.rentIncomeSupportWarnings || [] },
  ];
}
