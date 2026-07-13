import type { DocumentItem } from "../models.ts";
import type { DocumentOcrRunResult } from "./documentOcrRunner.ts";

export type DocumentOcrQueueResult = {
  ok: boolean;
  queued?: boolean;
  completed?: boolean;
  text?: string;
  reason?: string;
};

type BusyMap = Record<string, boolean>;
type QueueDocumentForOcrArgs = {
  document?: DocumentItem | null;
  silent: boolean;
  requirePermission: (capability: string, deniedMessage?: string) => boolean;
  loadDocumentDataUrl: (document: DocumentItem) => Promise<DocumentItem | null | undefined>;
  documentSupportsAutomaticOcr: (name?: string, mimeType?: string) => boolean;
  automaticDocumentOcrAvailable: boolean;
  updateDocument: (id: string, update: Partial<DocumentItem>) => void;
  setNotice: (notice: string) => void;
  setDocumentOcrBusyById: (updater: (previous: BusyMap) => BusyMap) => void;
  runAutomaticDocumentOcr: (document: DocumentItem) => Promise<DocumentOcrRunResult>;
  normalizeExtractedDocumentText: (value: unknown) => string;
};

export async function queueDocumentForOcrWorkflow({
  document,
  silent,
  requirePermission,
  loadDocumentDataUrl,
  documentSupportsAutomaticOcr,
  automaticDocumentOcrAvailable,
  updateDocument,
  setNotice,
  setDocumentOcrBusyById,
  runAutomaticDocumentOcr,
  normalizeExtractedDocumentText,
}: QueueDocumentForOcrArgs): Promise<DocumentOcrQueueResult> {
  if (!requirePermission("review_documents", "This access profile cannot queue OCR review actions.")) return { ok: false };
  if (!document) return { ok: false };

  const documentWithFile = await loadDocumentDataUrl(document);
  if (!documentWithFile?.dataUrl) {
    if (!silent) setNotice("This document has no file attached for OCR.");
    return { ok: false, reason: "missing-file" };
  }

  if (!documentSupportsAutomaticOcr(documentWithFile.name, documentWithFile.mimeType)) {
    updateDocument(document.id, { ocrStatus: "pending" });
    if (!silent) setNotice("OCR review queued. Automatic OCR is only available for PDFs and images.");
    return { ok: true, queued: true, completed: false };
  }

  if (!automaticDocumentOcrAvailable) {
    updateDocument(document.id, { ocrStatus: "pending" });
    if (!silent) setNotice("OCR review queued. Open the Windows desktop app to run automatic OCR.");
    return { ok: true, queued: true, completed: false };
  }

  setDocumentOcrBusyById((previous) => ({ ...previous, [document.id]: true }));
  try {
    const result = await runAutomaticDocumentOcr(documentWithFile);
    if (!result?.ok) {
      updateDocument(document.id, { ocrStatus: "pending" });
      if (!silent) setNotice(result?.message || "Automatic OCR could not start.");
      return { ok: false, queued: true, completed: false, reason: result?.reason || "ocr-failed" };
    }

    const normalizedText = normalizeExtractedDocumentText(result.text);
    if (normalizedText) {
      updateDocument(document.id, {
        extractedText: normalizedText,
        ocrStatus: "completed",
        reviewedWarningKeys: undefined,
        reviewedWarningsAt: undefined,
        expenseReviewDismissedAt: undefined,
        workOrderReviewDismissedAt: undefined,
      });
      if (!silent) {
        setNotice(
          result.truncated
            ? `Automatic OCR extracted text from the first ${result.processedPages} pages. Review before saving.`
            : "Automatic OCR extracted searchable text.",
        );
      }
      return { ok: true, queued: false, completed: true, text: normalizedText };
    }

    updateDocument(document.id, { ocrStatus: "pending" });
    if (!silent) setNotice("Automatic OCR ran, but no readable text was found. The document remains in Needs OCR.");
    return { ok: true, queued: true, completed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Automatic OCR failed.");
    updateDocument(document.id, { ocrStatus: "pending" });
    if (!silent) setNotice(`Automatic OCR failed: ${message}`);
    return { ok: false, queued: true, completed: false, reason: "ocr-failed" };
  } finally {
    setDocumentOcrBusyById((previous) => {
      const next = { ...previous };
      delete next[document.id];
      return next;
    });
  }
}
