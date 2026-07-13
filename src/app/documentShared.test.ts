import assert from "node:assert/strict";
import test from "node:test";
import {
  canAttachToTransaction,
  documentTagSuggestionSourceLabel,
  formatDocumentTags,
  parseDocumentTags,
} from "./documentShared.ts";

test("document tags are trimmed and deduplicated without changing first-seen casing", () => {
  assert.deepEqual(parseDocumentTags("Lease, utility; lease\nTax"), ["Lease", "utility", "Tax"]);
  assert.equal(formatDocumentTags(["Lease", { tag: "Utility" }, "lease"]), "Lease, Utility");
});

test("document suggestion source labels preserve known and custom sources", () => {
  assert.equal(documentTagSuggestionSourceLabel({ sources: ["ocr_match", "context"] }), "OCR match + Context");
  assert.equal(documentTagSuggestionSourceLabel({ sources: ["manual"] }), "manual");
});

test("transaction attachments accept PDFs and images only when a MIME type is present", () => {
  assert.equal(canAttachToTransaction({ type: "application/pdf" }), true);
  assert.equal(canAttachToTransaction({ type: "image/png" }), true);
  assert.equal(canAttachToTransaction({ type: "text/plain" }), false);
  assert.equal(canAttachToTransaction({ type: "" }), true);
  assert.equal(canAttachToTransaction(null), false);
});
