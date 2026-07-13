import type { DocumentItem } from "../models.ts";
import type { DocumentOcrQueueResult } from "./documentOcrQueue.ts";

type DocumentAuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  details: string;
  category: string;
};

type SharedBatchDependencies = {
  requirePermission: (capability: string, deniedMessage?: string) => boolean;
  setNotice: (notice: string) => void;
  addAuditEntry: (entry: DocumentAuditEntry) => void;
};

type MarkVisibleDocumentsPendingArgs = SharedBatchDependencies & {
  documents: DocumentItem[];
  documentStatusFilter: string;
  updateDocument: (id: string, update: Partial<DocumentItem>) => void;
};

export function markVisibleDocumentsPendingOcrWorkflow({
  documents,
  documentStatusFilter,
  requirePermission,
  updateDocument,
  addAuditEntry,
  setNotice,
}: MarkVisibleDocumentsPendingArgs): number {
  if (!requirePermission("review_documents", "This access profile cannot queue OCR review actions.")) return 0;
  if (documents.length === 0) {
    setNotice("No visible documents need OCR review.");
    return 0;
  }

  documents.forEach((document) => updateDocument(document.id, { ocrStatus: "pending" }));
  const summary = `Queued ${documents.length} visible document${documents.length === 1 ? "" : "s"} for OCR review.`;
  addAuditEntry({
    action: "queue-ocr",
    entityType: "document-batch",
    entityId: `visible-${documents.length}`,
    summary,
    details: `Current search/filter scope: ${documentStatusFilter}.`,
    category: "document",
  });
  setNotice(summary);
  return documents.length;
}

type RunVisibleDocumentOcrArgs = SharedBatchDependencies & {
  documents: DocumentItem[];
  setBusy: (busy: boolean) => void;
  queueDocument: (document: DocumentItem, options: { silent: true }) => Promise<DocumentOcrQueueResult>;
};

export async function runVisibleDocumentOcrWorkflow({
  documents,
  requirePermission,
  setBusy,
  queueDocument,
  addAuditEntry,
  setNotice,
}: RunVisibleDocumentOcrArgs): Promise<number> {
  if (!requirePermission("review_documents", "This access profile cannot run OCR review actions.")) return 0;
  if (documents.length === 0) {
    setNotice("No visible OCR-ready documents are available.");
    return 0;
  }

  setBusy(true);
  try {
    let completedCount = 0;
    for (const document of documents) {
      const result = await queueDocument(document, { silent: true });
      if (result.ok && result.completed) completedCount += 1;
    }
    if (completedCount > 0) {
      addAuditEntry({
        action: "run-ocr",
        entityType: "document-batch",
        entityId: `visible-${documents.length}`,
        summary: `Ran automatic OCR on ${documents.length} visible document${documents.length === 1 ? "" : "s"}.`,
        details: `${completedCount} extracted text result${completedCount === 1 ? "" : "s"}.`,
        category: "document",
      });
    }
    setNotice(completedCount > 0
      ? `Automatic OCR finished for ${completedCount} visible document${completedCount === 1 ? "" : "s"}.`
      : "Automatic OCR ran, but no readable text was found in the visible documents.");
    return completedCount;
  } finally {
    setBusy(false);
  }
}
