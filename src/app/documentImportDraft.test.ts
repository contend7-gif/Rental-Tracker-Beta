import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocumentImportDraft } from "./draftFactories.js";
import { buildDocumentImportFileDraft, buildDocumentImportPickerDraft, hasDocumentImportContext } from "./documentImportDraft.ts";

test("selecting or replacing an upload file retains a manually chosen unit", () => {
  for (const unit of ["616", "Shared"]) {
    const draft = buildDocumentImportFileDraft({
      previous: { ...createBlankDocumentImportDraft("p1", unit), unitScopeOverride: true },
      file: { name: "utility-reupload.pdf", type: "application/pdf" }, dataUrl: "data:pdf",
      propertyFilter: "p1", unitFilter: "614", defaultPropertyId: "p1",
      suggestDocumentType: () => "Invoice", getSuggestedTags: () => [], formatTags: () => "",
    });
    assert.equal(draft.unit, unit);
    assert.equal(draft.unitScopeOverride, true);
  }
});

test("a button event cannot become document metadata or retain a previous import link", () => {
  const previous = { ...createBlankDocumentImportDraft("old-property", "Unit A"), type: "Invoice", linkedId: "old-transaction", linkType: "transaction" };
  const clickEvent = { type: "click", target: {}, preventDefault() {} };
  assert.equal(hasDocumentImportContext(clickEvent), false);
  const draft = buildDocumentImportPickerDraft(previous, clickEvent, {
    propertyFilter: "new-property", unitFilter: "all", defaultPropertyId: "new-property",
  });
  assert.equal(draft.type, "Scanned PDF");
  assert.equal(draft.propertyId, "new-property");
  assert.equal(draft.linkedId, "");
});

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

test("document file drafts preserve context and add file-based suggestions", () => {
  const previous = {
    ...createBlankDocumentImportDraft("", ""),
    tags: "Tax",
    linkType: "transaction",
    linkedId: "t1",
  };
  const draft = buildDocumentImportFileDraft({
    previous,
    file: { name: "invoice.pdf", type: "application/pdf" },
    dataUrl: "data:pdf",
    propertyFilter: "all",
    unitFilter: "Unit 2",
    defaultPropertyId: "p1",
    suggestDocumentType: () => "Invoice",
    getSuggestedTags: () => [{ tag: "Invoice", sources: ["filename"] }],
    formatTags: (tags) => (tags as Array<{ tag: string }>).map(({ tag }) => tag).join(", "),
  });
  assert.equal(draft.propertyId, "p1");
  assert.equal(draft.unit, "Unit 2");
  assert.equal(draft.type, "Invoice");
  assert.equal(draft.tags, "Tax, Invoice");
  assert.equal(draft.linkedId, "t1");
  assert.equal(draft.dataUrl, "data:pdf");
});
