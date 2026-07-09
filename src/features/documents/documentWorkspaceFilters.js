export function selectDocumentsForWorkspaceTab({
  documentStatusFilter = "all",
  documentsTab = "inbox",
  inboxDocuments = [],
  linkedDocuments = [],
  needsReviewDocuments = [],
  reviewedDocuments = [],
  supportingDocuments = [],
  visibleDocuments = [],
} = {}) {
  if (documentStatusFilter !== "all") return visibleDocuments;
  if (documentsTab === "reviewed") return reviewedDocuments;
  if (documentsTab === "all") return visibleDocuments;
  if (documentsTab === "needs_review") return needsReviewDocuments;
  if (documentsTab === "linked") return linkedDocuments;
  if (documentsTab === "supporting") return supportingDocuments;
  return inboxDocuments;
}
