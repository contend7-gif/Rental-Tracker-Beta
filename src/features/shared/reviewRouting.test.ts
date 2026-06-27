import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReviewRoute, routeForReviewSection, routeForTransactionReview, runReviewRoute } from "./reviewRouting.js";

test("review routes normalize section destinations", () => {
  assert.deepEqual(routeForReviewSection("transactions"), {
    view: "ledger",
    sectionKey: "transactions",
    entityType: "",
    entityId: "",
    issueKey: "",
    propertyFilter: undefined,
    unitFilter: undefined,
    yearFilter: undefined,
    record: undefined,
  });
  assert.equal(normalizeReviewRoute("tax").view, "tax");
});

test("transaction review route carries record and issue focus", () => {
  const transaction = { id: "txn-1", description: "Utility bill" };
  const route = routeForTransactionReview(transaction, "missing_receipt");

  assert.equal(route.view, "ledger");
  assert.equal(route.entityType, "transaction");
  assert.equal(route.entityId, "txn-1");
  assert.equal(route.issueKey, "missing_receipt");
  assert.equal(route.record, transaction);
});

test("runReviewRoute opens transaction focus when a record is present", () => {
  const calls = [];
  const route = routeForTransactionReview({ id: "txn-1" }, "tax_open");
  runReviewRoute(route, {
    openTransaction: (...args) => calls.push(args),
    navigate: () => calls.push(["navigate"]),
  });

  assert.deepEqual(calls, [[{ id: "txn-1" }, "review", false, "tax_open"]]);
});
