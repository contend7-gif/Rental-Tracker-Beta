import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocumentImportDraft } from "./draftFactories.js";
import { buildDocumentImportPickerDraft, hasDocumentImportContext } from "./documentImportDraft.ts";

test("document import drafts start from the active workspace scope", () => {
  const draft = buildDocumentImportPickerDraft(null, {}, {
    propertyFilter: "p2",
    unitFilter: "Unit 2",
    defaultPropertyId: "p1",
  });
  assert.equal(draft.propertyId, "p2");
  assert.equal(draft.unit, "Unit 2");
  assert.equal(draft.type, "Scanned PDF");
});

test("document import context merges scope and preserves cross-source tag casing", () => {
  const previous = {
    ...createBlankDocumentImportDraft("p1", "Shared"),
    type: "Invoice",
    tags: "Utility, Tax",
  };
  const draft = buildDocumentImportPickerDraft(previous, {
    propertyId: "p2",
    unit: "Unit 1",
    tags: "utility, Maintenance",
    linkType: "workOrder",
    linkedId: "wo1",
  }, {
    propertyFilter: "all",
    unitFilter: "all",
    defaultPropertyId: "p1",
  });
  assert.equal(draft.propertyId, "p2");
  assert.equal(draft.unit, "Unit 1");
  assert.equal(draft.type, "Invoice");
  assert.equal(draft.tags, "Utility, Tax, utility, Maintenance");
  assert.equal(draft.linkType, "workOrder");
  assert.equal(draft.linkedId, "wo1");
});

test("document import context detection ignores empty context", () => {
  assert.equal(hasDocumentImportContext({}), false);
  assert.equal(hasDocumentImportContext({ type: "Lease" }), true);
  assert.equal(hasDocumentImportContext(null), false);
});
