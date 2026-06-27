import assert from "node:assert/strict";
import test from "node:test";
import { splitDoFirstItems, summarizeIssueLabels, summarizeReviewSections, visibleReviewItemsForSection } from "./reviewCenterPresentation.js";

const reviewItems = [
  { key: "normal-tax", sectionKey: "tax", title: "Tax readiness", urgency: "medium" },
  { key: "critical-service", sectionKey: "transactions", title: "Missing service period", urgency: "critical" },
  { key: "high-lease", sectionKey: "leases", title: "Tenant ledger", urgency: "high" },
  { key: "low-doc", sectionKey: "documents", title: "Safe document suggestion", urgency: "low" },
  { key: "critical-bill", sectionKey: "documents", title: "Bill draft", urgency: "critical" },
];

test("Review Center summarizes open and clear sections", () => {
  const summary = summarizeReviewSections([
    { key: "all", label: "All", count: 9 },
    { key: "documents", label: "Documents", count: 2 },
    { key: "transactions", label: "Transactions", count: 5 },
    { key: "assets", label: "Assets", count: 0 },
  ]);

  assert.equal(summary.openSectionCount, 2);
  assert.equal(summary.clearSectionCount, 1);
  assert.equal(summary.primarySection?.key, "transactions");
});

test("Review Center selects the top three Do First items by priority", () => {
  const { doFirstItems } = splitDoFirstItems(reviewItems);

  assert.deepEqual(doFirstItems.map((item) => item.key), [
    "critical-bill",
    "critical-service",
    "high-lease",
  ]);
});

test("remaining Review Center items exclude Do First items", () => {
  const { doFirstItems, remainingItems } = splitDoFirstItems(reviewItems);
  const doFirstKeys = new Set(doFirstItems.map((item) => item.key));

  assert.equal(remainingItems.some((item) => doFirstKeys.has(item.key)), false);
  assert.deepEqual(remainingItems.map((item) => item.key), ["normal-tax", "low-doc"]);
});

test("Review Center category filters return matching open checks", () => {
  const { doFirstItems } = splitDoFirstItems(reviewItems);
  const documentItems = visibleReviewItemsForSection(reviewItems, "documents", doFirstItems, 10);

  assert.deepEqual(documentItems.map((item) => item.key), ["critical-bill", "low-doc"]);
});

test("Review Center groups duplicate issue labels with related-check counts", () => {
  const labels = summarizeIssueLabels([
    { key: "carryforward-1", label: "Prepayment carryforward unreviewed" },
    { key: "carryforward-2", label: "Prepayment carryforward unreviewed" },
    { key: "carryforward-3", label: "Prepayment carryforward unreviewed" },
    { key: "balance-1", label: "Rent balance review needed" },
    { key: "balance-2", label: "Rent balance review needed" },
    { key: "deposit", label: "Security deposit review needed" },
  ]);

  assert.deepEqual(labels, [
    "Prepayment carryforward unreviewed · 3 related checks",
    "Rent balance review needed · 2 related checks",
    "Security deposit review needed",
  ]);
});

test("Review Center duplicate issue grouping keeps overflow count distinct", () => {
  const labels = summarizeIssueLabels([
    { label: "A" },
    { label: "A" },
    { label: "B" },
    { label: "C" },
    { label: "D" },
  ], 2);

  assert.deepEqual(labels, ["A · 2 related checks", "B", "+2 more"]);
});
