import assert from "node:assert/strict";
import test from "node:test";

import { selectDocumentsForWorkspaceTab } from "./documentWorkspaceFilters.js";

test("status filters show their direct visible results even when the active tab is inbox", () => {
  const linkedNeedingText = { id: "doc-1", transactionId: "txn-1" };

  const documents = selectDocumentsForWorkspaceTab({
    documentStatusFilter: "needs_indexing",
    documentsTab: "inbox",
    inboxDocuments: [],
    linkedDocuments: [linkedNeedingText],
    reviewedDocuments: [linkedNeedingText],
    visibleDocuments: [linkedNeedingText],
  });

  assert.deepEqual(documents, [linkedNeedingText]);
});

test("library reviewed view selects reviewed documents", () => {
  const inbox = { id: "doc-inbox" };
  const reviewed = { id: "doc-reviewed" };

  assert.deepEqual(
    selectDocumentsForWorkspaceTab({
      documentStatusFilter: "all",
      documentsTab: "library",
      documentSubview: "reviewed",
      inboxDocuments: [inbox],
      reviewedDocuments: [reviewed],
      visibleDocuments: [inbox, reviewed],
    }),
    [reviewed],
  );
});

test("Inbox OCR view selects only documents needing field corrections", () => {
  const qualityDocument = { id: "doc-ocr-quality" };

  assert.deepEqual(
    selectDocumentsForWorkspaceTab({
      documentStatusFilter: "all",
      documentsTab: "inbox",
      documentSubview: "ocr_quality",
      inboxDocuments: [],
      ocrQualityDocuments: [qualityDocument],
      visibleDocuments: [qualityDocument],
    }),
    [qualityDocument],
  );
});

test("library defaults to every visible document", () => {
  const inbox = { id: "doc-inbox" };
  const reviewed = { id: "doc-reviewed" };

  assert.deepEqual(
    selectDocumentsForWorkspaceTab({
      documentStatusFilter: "all",
      documentsTab: "library",
      documentSubview: "all",
      inboxDocuments: [inbox],
      reviewedDocuments: [reviewed],
      visibleDocuments: [inbox, reviewed],
    }),
    [inbox, reviewed],
  );
});

test("library unlinked view stays local to the Library", () => {
  const unlinked = { id: "doc-unlinked" };

  assert.deepEqual(
    selectDocumentsForWorkspaceTab({
      documentStatusFilter: "all",
      documentsTab: "library",
      documentSubview: "unlinked",
      unlinkedDocuments: [unlinked],
      visibleDocuments: [unlinked, { id: "doc-linked" }],
    }),
    [unlinked],
  );
});
