import type { DocumentImportDraft } from "./documentImportDraft.ts";
import type { DocumentOcrRunResult } from "./documentOcrRunner.ts";

type DocumentImportDraftUpdater = (previous: DocumentImportDraft) => DocumentImportDraft;

type RunDocumentImportOcrWorkflowArgs = {
  draft: DocumentImportDraft;
  requestIdRef: { current: number };
  documentSupportsAutomaticOcr: (name?: string, mimeType?: string) => boolean;
  automaticDocumentOcrAvailable: boolean;
  setBusy: (busy: boolean) => void;
  setMessage: (message: string) => void;
  runAutomaticDocumentOcr: (draft: DocumentImportDraft) => Promise<DocumentOcrRunResult>;
  normalizeExtractedDocumentText: (text: unknown) => string;
  setDraft: (updater: DocumentImportDraftUpdater) => void;
  getSuggestedTags: (draft: DocumentImportDraft, extractedText?: string) => unknown;
  formatTags: (tags: unknown) => string;
};

export async function runDocumentImportOcrWorkflow({
  draft,
  requestIdRef,
  documentSupportsAutomaticOcr,
  automaticDocumentOcrAvailable,
  setBusy,
  setMessage,
  runAutomaticDocumentOcr,
  normalizeExtractedDocumentText,
  setDraft,
  getSuggestedTags,
  formatTags,
}: RunDocumentImportOcrWorkflowArgs): Promise<void> {
  requestIdRef.current += 1;
  const requestId = requestIdRef.current;

  if (!documentSupportsAutomaticOcr(draft.name, draft.mimeType)) {
    setBusy(false);
    setMessage("Automatic OCR currently supports PDFs and common image files.");
    return;
  }

  if (!automaticDocumentOcrAvailable) {
    setBusy(false);
    setMessage("Automatic OCR runs when you open the Windows desktop app.");
    return;
  }

  setBusy(true);
  setMessage("Running automatic OCR...");

  try {
    const result = await runAutomaticDocumentOcr(draft);
    if (requestIdRef.current !== requestId) return;

    if (!result.ok) {
      setMessage(result.message || "Automatic OCR could not start.");
      return;
    }

    const normalizedText = normalizeExtractedDocumentText(result.text);
    if (normalizedText) {
      setDraft((previous) => previous.dataUrl !== draft.dataUrl ? previous : {
        ...previous,
        extractedText: normalizedText,
        ocrStatus: "completed",
        tags: formatTags(getSuggestedTags(previous, normalizedText)),
      });
      setMessage(result.truncated
        ? `Automatic OCR extracted text from the first ${result.processedPages} pages. Review before saving.`
        : "Automatic OCR extracted searchable text. Review before saving.");
      return;
    }

    setDraft((previous) => previous.dataUrl !== draft.dataUrl ? previous : {
      ...previous,
      ocrStatus: "pending",
    });
    setMessage("Automatic OCR ran, but no readable text was found. You can still save this as pending OCR.");
  } catch (error) {
    if (requestIdRef.current !== requestId) return;
    const message = error instanceof Error ? error.message : String(error || "Automatic OCR failed.");
    setMessage(`Automatic OCR failed: ${message}`);
  } finally {
    if (requestIdRef.current === requestId) setBusy(false);
  }
}
