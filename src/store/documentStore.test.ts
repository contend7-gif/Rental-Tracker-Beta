import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDocument } from "./documentStore.ts";

test("normalizeDocument preserves a trimmed renewal date", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Insurance declaration",
    type: "Insurance",
    expiresOn: " 2026-09-30 ",
  });

  assert.equal(document.expiresOn, "2026-09-30");
});

test("normalizeDocument removes an empty renewal date", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Deed",
    type: "Deed",
    expiresOn: "   ",
  });

  assert.equal(document.expiresOn, undefined);
});

test("normalizeDocument preserves reviewed warning acknowledgements", () => {
  const document = normalizeDocument({
    id: "doc-1",
    propertyId: "p1",
    name: "Receipt",
    type: "Transaction Receipt",
    reviewedWarningKeys: [" missing_amount ", "missing_amount", "low_confidence"],
    reviewedWarningsAt: " 2026-07-08T12:00:00.000Z ",
  });

  assert.deepEqual(document.reviewedWarningKeys, ["missing_amount", "low_confidence"]);
  assert.equal(document.reviewedWarningsAt, "2026-07-08T12:00:00.000Z");
});
