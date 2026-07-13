import type { DocumentItem } from "../models.ts";
import type { DesktopPersistenceApi } from "../types/desktop.d.ts";
import { publishPerformanceMetric } from "./performanceMetrics.ts";

type LoadDocumentDataUrlArgs = {
  document?: DocumentItem | null;
  desktopPersistenceApi?: Pick<DesktopPersistenceApi, "readDocumentDataUrl"> | null;
  setNotice: (notice: string) => void;
};

export async function loadDocumentDataUrlFromDesktop({
  document,
  desktopPersistenceApi,
  setNotice,
}: LoadDocumentDataUrlArgs): Promise<DocumentItem | null | undefined> {
  if (!document || document.dataUrl || !desktopPersistenceApi?.readDocumentDataUrl) return document;
  try {
    const readStartedAt = performance.now();
    const result = await desktopPersistenceApi.readDocumentDataUrl(document);
    publishPerformanceMetric("documentFileReadMs", performance.now() - readStartedAt);
    if (result?.ok && result.dataUrl) return { ...document, dataUrl: result.dataUrl };
    setNotice(result?.message || "This document file could not be read.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Document file read failed.");
    setNotice(`Could not read this document: ${message}`);
  }
  return document;
}
