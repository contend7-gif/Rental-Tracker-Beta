import test from "node:test";
import assert from "node:assert/strict";
import { accountReviewKey, bookkeepingSignature, buildAccountCoverage, ownerDrawMonthReview } from "./bookkeepingCoverage.js";
import { sanitizeAppSettings } from "../store/appSettings.ts";

const tx = { id: "example-draw", propertyId: "example-property", unit: "B", type: "Owner Draw", category: "Owner Draw", date: "2026-10-20", amount: 500, paidFrom: "Example bank 1234", status: "active" };
const todayIso = "2026-10-31";

test("manual entries and bank matches do not imply source-account coverage", () => {
  const [coverage] = buildAccountCoverage({ transactions: [{ ...tx, reconciled: true }], todayIso });
  assert.equal(coverage.closed, undefined);
  assert.equal(coverage.review, undefined);
  assert.equal(coverage.unchanged, false);
});

test("source account review persists and changes reopen it without changing bank snapshots", () => {
  const key = accountReviewKey(tx.propertyId, tx.paidFrom);
  const review = { throughDate: todayIso, reviewedAt: "2026-10-31T19:00:00Z", signature: bookkeepingSignature([tx]) };
  const settings = sanitizeAppSettings(JSON.parse(JSON.stringify({ accountActivityReviews: { [key]: review } })));
  const args = { transactions: [tx], reviews: settings.accountActivityReviews, todayIso };
  assert.equal(buildAccountCoverage(args)[0].unchanged, true);
  assert.equal(buildAccountCoverage({ ...args, transactions: [{ ...tx, amount: 600 }] })[0].unchanged, false);
  const closed = { accountLabel: tx.paidFrom, propertyId: tx.propertyId, periodEnd: "2026-09-30" };
  assert.equal(buildAccountCoverage({ ...args, reconciliations: [closed] })[0].closed.periodEnd, "2026-09-30");
  assert.equal(buildAccountCoverage({ ...args, reconciliations: [{ ...closed, propertyId: "another-property" }], propertyFilter: tx.propertyId })[0].closed, undefined);
});

test("voided and future entries do not establish current account activity", () => {
  assert.equal(buildAccountCoverage({ transactions: [{ ...tx, status: "voided" }, { ...tx, date: "2026-11-01" }], todayIso }).length, 0);
});

test("zero draws requires a manual check and new or changed cash movements reopen it", () => {
  const args = { transactions: [], month: "2026-10", propertyFilter: "example-property" };
  const empty = ownerDrawMonthReview(args);
  assert.equal(empty.count, 0);
  assert.equal(empty.reviewed, false);
  const review = { signature: empty.signature, throughDate: todayIso, reviewedAt: "2026-10-31T19:00:00Z" };
  assert.equal(ownerDrawMonthReview({ ...args, review }).reviewed, true);
  assert.equal(ownerDrawMonthReview({ ...args, review, transactions: [tx] }).reviewed, false);
  assert.equal(ownerDrawMonthReview({ ...args, transactions: [{ ...tx, type: "Transfer" }] }).count, 0);
  const settings = sanitizeAppSettings(JSON.parse(JSON.stringify({ ownerDrawMonthlyReviews: { "2026-10::example-property": review } })));
  assert.equal(settings.ownerDrawMonthlyReviews["2026-10::example-property"].signature, empty.signature);
  assert.equal(ownerDrawMonthReview({ ...args, review: { ...review, throughDate: "2026-10-20" }, todayIso }).reviewed, false);
  assert.equal(ownerDrawMonthReview({ ...args, transactions: [{ ...tx, date: "2026-10-31" }], todayIso: "2026-10-20" }).count, 0);
  const allReview = { ...review, signature: bookkeepingSignature([tx]) };
  assert.equal(ownerDrawMonthReview({ transactions: [{ ...tx, propertyId: "another-property" }], month: "2026-10", review: allReview }).reviewed, false);
});
