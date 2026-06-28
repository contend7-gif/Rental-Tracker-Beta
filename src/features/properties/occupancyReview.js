import { toLocalIsoDate } from "../../lib/localDate.ts";

const ISSUE_LABELS = {
  coverage_gap: "Coverage gap",
  coverage_overlap: "Coverage overlap",
  in_service_without_coverage: "In service without coverage",
  lease_missing_actual_end_date: "Lease missing actual end date",
  owner_period_open_ended: "Owner period open-ended",
  vacancy_period_open_ended: "Vacancy period open-ended",
  owner_period_unreviewed: "Owner period unreviewed",
  vacancy_period_unreviewed: "Vacancy period unreviewed",
  service_period_transactions_depend_on_incomplete_occupancy: "Service-period transactions need occupancy",
  asset_depreciation_depends_on_incomplete_occupancy: "Asset depreciation needs occupancy",
  loan_interest_depends_on_incomplete_occupancy: "Loan interest needs occupancy",
};

const ISSUE_HELP = {
  coverage_gap: "In-service units should have lease, owner, or vacancy coverage for every allocation day.",
  coverage_overlap: "Overlapping lease or owner/vacancy periods can distort rental-use allocation.",
  in_service_without_coverage: "This unit is in service but has no lease, owner, or vacancy coverage in scope.",
  lease_missing_actual_end_date: "Ended leases should have an actual end date for clean occupancy history.",
  owner_period_open_ended: "Open-ended owner use should be reviewed when it affects the selected year.",
  vacancy_period_open_ended: "Open-ended vacancy should be reviewed when it affects the selected year.",
  owner_period_unreviewed: "Owner-use periods affecting allocation should be reviewed.",
  vacancy_period_unreviewed: "Vacancy periods affecting allocation should be reviewed.",
  service_period_transactions_depend_on_incomplete_occupancy: "Shared service-period transactions depend on complete occupancy coverage.",
  asset_depreciation_depends_on_incomplete_occupancy: "Depreciation allocation depends on complete occupancy coverage.",
  loan_interest_depends_on_incomplete_occupancy: "Mortgage interest allocation depends on complete occupancy coverage.",
};

function issue(key, field) {
  return { key, label: ISSUE_LABELS[key] || key, help: ISSUE_HELP[key] || "", field };
}

function selectedYear(context) {
  return String(context.yearFilter || new Date().getFullYear());
}

function yearRange(context) {
  const year = selectedYear(context);
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function overlapsYear(startDate, endDate, context) {
  const range = yearRange(context);
  const end = endDate || "9999-12-31";
  return String(startDate || "") <= range.end && end >= range.start;
}

function propertyMatches(row, item) {
  return !item?.propertyId || item.propertyId === row?.property?.id || item.propertyId === row?.propertyId || item.propertyId === row?.unit?.propertyId;
}

function unitMatches(row, item) {
  const rowUnit = row?.unit?.name || row?.unit || "Shared";
  return !item?.unit || item.unit === rowUnit || item.unit === "Shared";
}

function rowHasIncompleteCoverage(row) {
  if (!row?.inServiceForYear) return false;
  return (row.gaps || []).length > 0 || (row.overlaps || []).length > 0 || Number(row.coveredDays || 0) === 0;
}

function sharedServicePeriodDependsOnRow(row, transaction, context) {
  if (!transaction || transaction.type !== "Expense" || transaction.unit !== "Shared") return false;
  if (!transaction.servicePeriodStart || !transaction.servicePeriodEnd) return false;
  if (!propertyMatches(row, transaction)) return false;
  const range = yearRange(context);
  return transaction.servicePeriodStart <= range.end && transaction.servicePeriodEnd >= range.start;
}

function assetDependsOnRow(row, asset, context) {
  if (!asset || !propertyMatches(row, asset) || !unitMatches(row, asset)) return false;
  const range = yearRange(context);
  return String(asset.placedInService || "") <= range.end;
}

export function getOccupancyReviewIssues(unitCoverageRow, context = {}) {
  if (!unitCoverageRow) return [];
  if (!unitCoverageRow.inServiceForYear) return [];

  const issues = [];
  const gaps = unitCoverageRow.gaps || [];
  const overlaps = unitCoverageRow.overlaps || [];
  const occupancyForUnit = unitCoverageRow.occupancyForUnit || [];
  const leasesForUnit = unitCoverageRow.leasesForUnit || [];
  const incomplete = rowHasIncompleteCoverage(unitCoverageRow);

  if (gaps.length > 0) issues.push(issue("coverage_gap", "gaps"));
  if (overlaps.length > 0) issues.push(issue("coverage_overlap", "overlaps"));
  if (Number(unitCoverageRow.coveredDays || 0) === 0) issues.push(issue("in_service_without_coverage", "coverage"));

  leasesForUnit.forEach((lease) => {
    const ended = lease.status === "Ended" || (lease.endDate && lease.endDate < (context.todayIso || toLocalIsoDate()));
    if (ended && !String(lease.actualEndDate || "").trim()) {
      issues.push(issue("lease_missing_actual_end_date", "actualEndDate"));
    }
  });

  occupancyForUnit.forEach((period) => {
    if (!overlapsYear(period.startDate, period.endDate, context)) return;
    const isOwner = period.useType === "Owner-Occupied";
    const isVacant = period.useType === "Vacant";
    if (!isOwner && !isVacant) return;

    if (!period.endDate && !period.reviewed) {
      issues.push(issue(isOwner ? "owner_period_open_ended" : "vacancy_period_open_ended", "endDate"));
    }
    if (!period.reviewed) {
      issues.push(issue(isOwner ? "owner_period_unreviewed" : "vacancy_period_unreviewed", "reviewed"));
    }
  });

  if (incomplete && (context.transactions || []).some((transaction) => sharedServicePeriodDependsOnRow(unitCoverageRow, transaction, context))) {
    issues.push(issue("service_period_transactions_depend_on_incomplete_occupancy", "transactions"));
  }

  if (incomplete && (context.assets || []).some((asset) => assetDependsOnRow(unitCoverageRow, asset, context))) {
    issues.push(issue("asset_depreciation_depends_on_incomplete_occupancy", "assets"));
  }

  if (incomplete && (context.loans || []).some((loan) => propertyMatches(unitCoverageRow, loan))) {
    issues.push(issue("loan_interest_depends_on_incomplete_occupancy", "loans"));
  }

  return issues.filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);
}

export function getOccupancyReadiness(unitCoverageRow, context = {}) {
  if (!unitCoverageRow?.inServiceForYear) return { key: "not_in_service", label: "Not in service", issues: [] };
  const issues = getOccupancyReviewIssues(unitCoverageRow, context);
  if (issues.length > 0) return { key: "needs_review", label: "Needs occupancy review", issues };
  return { key: "ready", label: "Ready for allocation", issues };
}

function primaryActionForIssues(issues) {
  const keys = new Set(issues.map((item) => item.key));
  if (keys.has("coverage_gap") || keys.has("in_service_without_coverage")) return "review_gap";
  if (keys.has("coverage_overlap")) return "review_overlap";
  if (keys.has("lease_missing_actual_end_date")) return "add_lease";
  if (keys.has("owner_period_unreviewed") || keys.has("vacancy_period_unreviewed")) return "mark_reviewed";
  return "manage_occupancy";
}

export function buildOccupancyReviewInbox(leaseCoverageByProperty = [], context = {}) {
  const records = leaseCoverageByProperty
    .flatMap(({ property, unitRows }) =>
      (unitRows || []).map((row) => {
        const reviewRow = { ...row, property };
        const issues = getOccupancyReviewIssues(reviewRow, context);
        return {
          property,
          unit: row.unit,
          row: reviewRow,
          issues,
          readiness: getOccupancyReadiness(reviewRow, context),
          primaryAction: primaryActionForIssues(issues),
        };
      }),
    )
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => right.issues.length - left.issues.length || String(left.property?.name || "").localeCompare(String(right.property?.name || "")));

  const countIssue = (key) => records.filter((record) => record.issues.some((issue) => issue.key === key)).length;
  const downstreamKeys = new Set([
    "service_period_transactions_depend_on_incomplete_occupancy",
    "asset_depreciation_depends_on_incomplete_occupancy",
    "loan_interest_depends_on_incomplete_occupancy",
  ]);

  return {
    records,
    counts: {
      total: records.length,
      coverageGaps: countIssue("coverage_gap"),
      coverageOverlaps: countIssue("coverage_overlap"),
      openEndedPeriods: countIssue("owner_period_open_ended") + countIssue("vacancy_period_open_ended"),
      downstreamWarnings: records.filter((record) => record.issues.some((issue) => downstreamKeys.has(issue.key))).length,
    },
  };
}

export function summarizeOccupancyReadiness(leaseCoverageByProperty = [], context = {}) {
  const rows = leaseCoverageByProperty.flatMap(({ property, unitRows }) => (unitRows || []).map((row) => ({ ...row, property })));
  const readinessRows = rows.map((row) => getOccupancyReadiness(row, context));
  return {
    ready: readinessRows.filter((item) => item.key === "ready").length,
    needsReview: readinessRows.filter((item) => item.key === "needs_review").length,
    notInService: readinessRows.filter((item) => item.key === "not_in_service").length,
  };
}
