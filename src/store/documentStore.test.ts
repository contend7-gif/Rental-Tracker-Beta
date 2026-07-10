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

test("normalizeDocument preserves OCR field corrections", () => {
  const document = normalizeDocument({
    id: "doc-4",
    propertyId: "p1",
    name: "internet.pdf",
    type: "Scanned PDF",
    ocrFieldOverrides: {
      vendorName: " Spectrum ",
      totalAmount: 42.505,
      servicePeriodStart: "2026-06-18",
      servicePeriodEnd: "2026-07-17",
    },
  });

  assert.deepEqual(document.ocrFieldOverrides, {
    vendorName: "Spectrum",
    totalAmount: 42.51,
    servicePeriodStart: "2026-06-18",
    servicePeriodEnd: "2026-07-17",
  });
});
