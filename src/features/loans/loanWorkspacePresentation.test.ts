import assert from "node:assert/strict";
import test from "node:test";
import { combinedLtvPresentation, loanPaymentTiming, loanReviewSummary } from "./loanWorkspacePresentation.js";

test("combined LTV prefers complete estimated current values", () => {
  const result = combinedLtvPresentation(150000, [
    { estimatedCurrentValue: 300000, property: {} },
  ]);

  assert.equal(result.basis, "current");
  assert.equal(result.value, 50);
  assert.equal(result.helper, "Based on estimated current value");
});

test("combined LTV falls back to purchase support when current values are incomplete", () => {
  const result = combinedLtvPresentation(180000, [
    { estimatedCurrentValue: 0, property: { purchasePrice: 300000 } },
  ]);

  assert.equal(result.basis, "purchase");
  assert.equal(result.value, 60);
});

test("loan review summary uses useful ready and attention wording", () => {
  assert.deepEqual(loanReviewSummary({ loanCount: 1 }), { headline: "All loans ready", badge: "Ready" });
  assert.deepEqual(
    loanReviewSummary({ loanCount: 1, needsReviewLoanCount: 1, reviewAreaCount: 2 }),
    { headline: "1 of 1 loan needs review", badge: "2 review areas" },
  );
});

test("loan payment timing never treats a future record as the last payment", () => {
  const result = loanPaymentTiming([
    { paymentDate: "2026-05-01" },
    { paymentDate: "2026-07-01" },
    { paymentDate: "2026-12-01" },
  ], "2026-06-14", "2026-06-01");

  assert.equal(result.lastRecordedDate, "2026-05-01");
  assert.equal(result.nextScheduledDate, "2026-07-01");
  assert.equal(result.status, "Missing payment");
});

test("loan payment timing reports future schedule when no actual payment exists", () => {
  const result = loanPaymentTiming([], "2026-06-14", "2026-07-01");

  assert.equal(result.lastRecordedDate, "");
  assert.equal(result.nextScheduledDate, "2026-07-01");
  assert.equal(result.status, "Future scheduled");
});
