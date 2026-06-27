import assert from "node:assert/strict";
import { test } from "node:test";

import { auditBadgeClass, auditStatusFromIssues, canRunSafeBulkReview, normalizeAuditStatus, normalizeReadiness, readinessSummaryFromRecords } from "./auditBadges.js";

test("audit badge helpers normalize readiness statuses", () => {
  assert.equal(normalizeAuditStatus({ key: "ready", label: "Ready for Tax Center" }).label, "Ready for Tax Center");
  assert.match(auditBadgeClass("needs_review"), /amber/);
  assert.match(auditBadgeClass("ready"), /emerald/);
});

test("audit status from issues reports review counts", () => {
  assert.deepEqual(auditStatusFromIssues([], "All clear"), { key: "ready", label: "All clear", issueCount: 0 });
  assert.equal(auditStatusFromIssues([{ key: "missing" }, { key: "open" }]).label, "2 review items");
});

test("shared readiness normalizes tone and actionability", () => {
  assert.deepEqual(
    normalizeReadiness({ key: "needs_review", issues: [{ key: "missing_receipt" }] }),
    {
      key: "needs_review",
      label: "Needs review",
      issueCount: 1,
      blockingCount: 1,
      tone: "warning",
      isReady: false,
      isActionable: true,
    },
  );
  assert.equal(normalizeReadiness({ key: "not_tax_relevant" }).isReady, true);
});

test("readiness summaries count ready open and blocking records", () => {
  const summary = readinessSummaryFromRecords([
    { readiness: { key: "ready" } },
    { readiness: { key: "needs_review", issues: [{ key: "missing" }] } },
    { readiness: { key: "invalid", issues: [{ key: "broken" }] } },
  ]);

  assert.equal(summary.readyCount, 1);
  assert.equal(summary.openCount, 2);
  assert.equal(summary.blockingCount, 2);
  assert.equal(summary.key, "blocking");
});

test("safe bulk review is only allowed without blocking issues", () => {
  assert.equal(canRunSafeBulkReview([{ issues: [] }]), true);
  assert.equal(canRunSafeBulkReview([{ issues: [{ key: "needs_source" }] }]), false);
  assert.equal(canRunSafeBulkReview([{ issues: [{ key: "minor", blocking: false }] }]), true);
});
