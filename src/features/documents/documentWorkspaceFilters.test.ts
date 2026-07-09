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

test("all-documents mode still respects the selected workspace tab", () => {
  const inbox = { id: "doc-inbox" };
  const reviewed = { id: "doc-reviewed" };

  assert.deepEqual(
    selectDocumentsForWorkspaceTab({
      documentStatusFilter: "all",
      documentsTab: "reviewed",
      inboxDocuments: [inbox],
      reviewedDocuments: [reviewed],
      visibleDocuments: [inbox, reviewed],
    }),
    [reviewed],
  );
});
