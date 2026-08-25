export function selectDocumentsForWorkspaceTab({
  documentStatusFilter = "all",
  documentSubview = "all",
  documentsTab = "inbox",
  inboxDocuments = [],
  linkedDocuments = [],
  needsReviewDocuments = [],
  ocrQualityDocuments = [],
  reviewedDocuments = [],
  supportingDocuments = [],
  unlinkedDocuments = [],
  visibleDocuments = [],
} = {}) {
  if (documentStatusFilter !== "all") return visibleDocuments;
  if (documentsTab === "library") {
    if (documentSubview === "linked") return linkedDocuments;
    if (documentSubview === "unlinked") return unlinkedDocuments;
    if (documentSubview === "supporting") return supportingDocuments;
    if (documentSubview === "reviewed") return reviewedDocuments;
    return visibleDocuments;
  }
  if (documentSubview === "needs_review") return needsReviewDocuments;
  if (documentSubview === "ocr_quality") return ocrQualityDocuments;
  return inboxDocuments;
}
