import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem } from "../models.ts";
import { createBlankDocumentImportDraft } from "./draftFactories.js";
import {
  applyDocumentImportLinkSuggestionToDraft,
  buildDocumentLinkUpdate,
  buildDocumentUnlinkUpdate,
} from "./documentLinkUpdates.ts";

const document: DocumentItem = {
  id: "d1",
  propertyId: "p1",
  unit: "Shared",
  name: "invoice.pdf",
  type: "Invoice",
  transactionId: "t1",
  relatedTransactionIds: ["t2", "t3"],
  tags: ["utility", "supporting-only"],
  expenseReviewDismissedAt: "2026-07-01T00:00:00.000Z",
  workOrderReviewDismissedAt: "2026-07-01T00:00:00.000Z",
};

test("linking a transaction updates scope and removes supporting-only state", () => {
  const update = buildDocumentLinkUpdate(document, {
    id: "t9",
    kind: "transaction",
    propertyId: "p2",
    unit: "Unit 2",
  });
  assert.equal(update.transactionId, "t9");
  assert.equal(update.propertyId, "p2");
  assert.equal(update.unit, "Unit 2");
  assert.deepEqual(update.tags, ["utility"]);
  assert.equal(update.expenseReviewDismissedAt, undefined);
});

test("linking a lease reopens both expense and work-order review state", () => {
  const update = buildDocumentLinkUpdate(document, { id: "l1", kind: "lease" });
  assert.equal(update.leaseId, "l1");
  assert.equal(update.expenseReviewDismissedAt, undefined);
  assert.equal(update.workOrderReviewDismissedAt, undefined);
});

test("unlinking related transactions preserves the primary transaction", () => {
  const update = buildDocumentUnlinkUpdate(document, "transaction", "t2");
  assert.deepEqual(update?.relatedTransactionIds, ["t3"]);
  assert.equal(Object.hasOwn(update || {}, "transactionId"), false);

  const primaryUpdate = buildDocumentUnlinkUpdate(document, "transaction");
  assert.equal(primaryUpdate?.transactionId, undefined);
  assert.equal(Object.hasOwn(primaryUpdate || {}, "transactionId"), true);
});

test("unknown unlink targets are ignored", () => {
  assert.equal(buildDocumentUnlinkUpdate(document, "property"), null);
});

test("import link suggestions update the draft scope without clearing other fields", () => {
  const draft = { ...createBlankDocumentImportDraft("p1", "Shared"), tags: "Invoice" };
  const next = applyDocumentImportLinkSuggestionToDraft(draft, {
    id: "wo1",
    kind: "workOrder",
    propertyId: "p2",
    unit: "Unit 1",
  });
  assert.equal(next.linkType, "workOrder");
  assert.equal(next.linkedId, "wo1");
  assert.equal(next.propertyId, "p2");
  assert.equal(next.unit, "Unit 1");
  assert.equal(next.tags, "Invoice");
});
