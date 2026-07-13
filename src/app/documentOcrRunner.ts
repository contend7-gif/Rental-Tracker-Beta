import type { DesktopResult } from "../types/desktop.d.ts";

type DocumentOcrInput = {
  name?: string;
  mimeType?: string;
  dataUrl?: string;
};

export type DocumentOcrRunResult = DesktopResult & {
  supported?: boolean;
  reason?: "unsupported-file" | "desktop-unavailable" | "ocr-failed";
  text?: string;
  truncated?: boolean;
  processedPages?: number;
};

type RunDesktopDocumentOcrArgs = {
  documentLike?: DocumentOcrInput | null;
  automaticDocumentOcrAvailable: boolean;
  desktopDocumentOcrApi?: Window["desktopDocumentOcr"] | null;
  documentSupportsAutomaticOcr: (name?: string, mimeType?: string) => boolean;
};

export async function runDesktopDocumentOcr({
  documentLike,
  automaticDocumentOcrAvailable,
  desktopDocumentOcrApi,
  documentSupportsAutomaticOcr,
}: RunDesktopDocumentOcrArgs): Promise<DocumentOcrRunResult> {
  if (!documentSupportsAutomaticOcr(documentLike?.name, documentLike?.mimeType)) {
    return {
      ok: false,
      supported: false,
      reason: "unsupported-file",
      message: "Automatic OCR currently supports PDFs and common image files.",
    };
  }

  if (!automaticDocumentOcrAvailable || !desktopDocumentOcrApi?.extract) {
    return {
      ok: false,
      supported: false,
      reason: "desktop-unavailable",
      message: "Automatic OCR runs in the Windows desktop app.",
    };
  }

  return desktopDocumentOcrApi.extract({
    name: documentLike?.name || "document",
    mimeType: documentLike?.mimeType || "application/octet-stream",
    dataUrl: documentLike?.dataUrl || "",
  });
}
