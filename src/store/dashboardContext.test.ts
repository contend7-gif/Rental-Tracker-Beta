import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DASHBOARD_CONTEXT,
  buildDashboardFiltersSummary,
  buildDashboardNavigationTarget,
  buildTrendDescriptor,
  getDefaultDashboardYear,
  getLeaseExpirationPill,
  shouldExpandNeedsReview,
} from "./dashboardContext.ts";

test("default dashboard year follows the current system year", () => {
  const expected = new Date().getFullYear().toString();
  assert.equal(getDefaultDashboardYear(), expected);
  assert.equal(DEFAULT_DASHBOARD_CONTEXT.yearFilter, expected);
});

test("filters summary renders selected labels", () => {
  const summary = buildDashboardFiltersSummary("2026", "All properties", "Unit 1");
  assert.equal(summary, "Year: 2026 | Properties: All properties | Units: Unit 1");
});

test("metric/section navigation target preserves dashboard context", () => {
  const target = buildDashboardNavigationTarget("properties", {
    yearFilter: "2026",
    propertyFilter: "p2",
    unitFilter: "Unit B",
  });

  assert.deepEqual(target, {
    view: "properties",
    yearFilter: "2026",
    propertyFilter: "p2",
    unitFilter: "Unit B",
  });
});

test("lease expiration pill color rules apply by day range and MTM", () => {
  assert.deepEqual(getLeaseExpirationPill(45, false), { label: "45d left", tone: "critical" });
  assert.deepEqual(getLeaseExpirationPill(90, false), { label: "90d left", tone: "warning" });
  assert.deepEqual(getLeaseExpirationPill(150, false), { label: "150d left", tone: "neutral" });
  assert.deepEqual(getLeaseExpirationPill(20, true), { label: "MTM", tone: "neutral" });
  assert.deepEqual(getLeaseExpirationPill(-10, false, true), { label: "Ended", tone: "neutral" });
});

test("needs review collapses when no items are open", () => {
  assert.equal(shouldExpandNeedsReview(0), false);
  assert.equal(shouldExpandNeedsReview(3), true);
});

test("trend indicator is computed when comparison data is present", () => {
  const rentTrend = buildTrendDescriptor(1082, 1000, true);
  assert.ok(rentTrend);
  assert.equal(rentTrend?.text, "+8.2% vs last year");
  assert.equal(rentTrend?.tone, "positive");

  const expenseTrend = buildTrendDescriptor(1082, 1000, false);
  assert.ok(expenseTrend);
  assert.equal(expenseTrend?.tone, "negative");

  assert.equal(buildTrendDescriptor(1000, 0, true), null);
});
