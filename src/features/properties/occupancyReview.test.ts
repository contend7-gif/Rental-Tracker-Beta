import assert from "node:assert/strict";
import test from "node:test";

import {
  getOccupancyReadiness,
  getOccupancyReviewIssues,
} from "./occupancyReview.js";

const baseRow = {
  property: { id: "p1", name: "Example Duplex" },
  unit: { id: "u1", propertyId: "p1", name: "101" },
  auditStart: "2026-01-01",
  auditEnd: "2026-12-31",
  inServiceForYear: true,
  gaps: [],
  overlaps: [],
  coveredDays: 365,
  totalDays: 365,
  leasesForUnit: [{ id: "lease-1", propertyId: "p1", unit: "101", tenantName: "Jordan Lee", startDate: "2026-01-01", endDate: "2026-12-31", actualEndDate: "", status: "Active" }],
  occupancyForUnit: [],
};

const context = { yearFilter: "2026", todayIso: "2026-07-01", transactions: [], assets: [], loans: [] };

test("unit with coverage gap returns coverage_gap", () => {
  const issues = getOccupancyReviewIssues({ ...baseRow, gaps: [{ start: "2026-03-01", end: "2026-03-10" }], coveredDays: 355 }, context);

  assert.ok(issues.some((issue) => issue.key === "coverage_gap"));
});

test("unit with overlap returns coverage_overlap", () => {
  const issues = getOccupancyReviewIssues({ ...baseRow, overlaps: [{ start: "2026-04-01", end: "2026-04-15" }] }, context);

  assert.ok(issues.some((issue) => issue.key === "coverage_overlap"));
});

test("in-service unit with no coverage returns in_service_without_coverage", () => {
  const issues = getOccupancyReviewIssues({ ...baseRow, coveredDays: 0, leasesForUnit: [] }, context);

  assert.ok(issues.some((issue) => issue.key === "in_service_without_coverage"));
});

test("open-ended owner period affecting selected year returns owner_period_open_ended unless reviewed", () => {
  const period = { id: "up-1", propertyId: "p1", unit: "101", useType: "Owner-Occupied", startDate: "2026-02-01", endDate: "", reviewed: false };
  const issues = getOccupancyReviewIssues({ ...baseRow, leasesForUnit: [], occupancyForUnit: [period] }, context);
  const reviewedIssues = getOccupancyReviewIssues({ ...baseRow, leasesForUnit: [], occupancyForUnit: [{ ...period, reviewed: true }] }, context);

  assert.ok(issues.some((issue) => issue.key === "owner_period_open_ended"));
  assert.ok(!reviewedIssues.some((issue) => issue.key === "owner_period_open_ended"));
});

test("open-ended vacancy period affecting selected year returns vacancy_period_open_ended unless reviewed", () => {
  const period = { id: "up-2", propertyId: "p1", unit: "101", useType: "Vacant", startDate: "2026-02-01", endDate: "", reviewed: false };
  const issues = getOccupancyReviewIssues({ ...baseRow, leasesForUnit: [], occupancyForUnit: [period] }, context);
  const reviewedIssues = getOccupancyReviewIssues({ ...baseRow, leasesForUnit: [], occupancyForUnit: [{ ...period, reviewed: true }] }, context);

  assert.ok(issues.some((issue) => issue.key === "vacancy_period_open_ended"));
  assert.ok(!reviewedIssues.some((issue) => issue.key === "vacancy_period_open_ended"));
});

test("shared service-period transaction with incomplete occupancy returns dependency warning", () => {
  const issues = getOccupancyReviewIssues(
    { ...baseRow, gaps: [{ start: "2026-05-01", end: "2026-05-03" }], coveredDays: 362 },
    { ...context, transactions: [{ id: "t1", propertyId: "p1", unit: "Shared", type: "Expense", servicePeriodStart: "2026-05-01", servicePeriodEnd: "2026-05-31" }] },
  );

  assert.ok(issues.some((issue) => issue.key === "service_period_transactions_depend_on_incomplete_occupancy"));
});

test("asset with incomplete occupancy returns depreciation dependency warning", () => {
  const issues = getOccupancyReviewIssues(
    { ...baseRow, gaps: [{ start: "2026-05-01", end: "2026-05-03" }], coveredDays: 362 },
    { ...context, assets: [{ id: "a1", propertyId: "p1", unit: "101", placedInService: "2026-01-01" }] },
  );

  assert.ok(issues.some((issue) => issue.key === "asset_depreciation_depends_on_incomplete_occupancy"));
});

test("complete unit coverage returns readiness key ready", () => {
  assert.equal(getOccupancyReadiness(baseRow, context).key, "ready");
});

test("not-in-service unit returns readiness key not_in_service", () => {
  assert.equal(getOccupancyReadiness({ ...baseRow, inServiceForYear: false }, context).key, "not_in_service");
});
