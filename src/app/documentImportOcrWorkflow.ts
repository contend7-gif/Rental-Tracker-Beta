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
    setMessage("Automatic reading supports PDFs, JPG, PNG, WebP, BMP, GIF and TIFF. For HEIC photos, export as JPG and try again. You can still save this file or enter an expense manually.");
    return;
  }

  if (!automaticDocumentOcrAvailable) {
    setBusy(false);
    setMessage("Automatic reading is available in the Windows desktop app. You can still save this file or enter an expense manually.");
    return;
  }

  setBusy(true);
  setMessage("Reading text on this computer. Large files can take up to two minutes.");

  try {
    const result = await runAutomaticDocumentOcr(draft);
    if (requestIdRef.current !== requestId) return;

    if (!result.ok) {
      setMessage("We could not read this file. Try reading again, save the document, or enter the expense manually.");
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
        ? `Read the first ${result.processedPages} pages only. Check the original for any remaining pages before entering amounts.`
        : "Found searchable text. Check the amount, date and vendor against the original before recording an expense.");
      return;
    }

    setDraft((previous) => previous.dataUrl !== draft.dataUrl ? previous : {
      ...previous,
      ocrStatus: "pending",
    });
    setMessage("We found no readable text. Try a brighter, upright photo cropped around the receipt, or enter the expense manually. You can still save this file.");
  } catch (error) {
    if (requestIdRef.current !== requestId) return;
    setMessage("We could not read this file. Try a JPG or PNG photo, retry reading, or enter the expense manually. Your selected file is still here.");
  } finally {
    if (requestIdRef.current === requestId) setBusy(false);
  }
}
