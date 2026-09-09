import type { DocumentWorkspaceControllerDependencies, SilentOptions } from "./documentWorkspaceTypes.ts";
import type { DocumentItem } from "../models.ts";

export function createDocumentAiActions({
  actions,
  addAuditEntry,
  aiDocumentCopilotEnabled,
  aiOpenAiApiKey,
  aiOpenAiModel,
  buildDocumentAiContext,
  desktopDocumentAiApi,
  normalizeExtractedDocumentText,
  queueDocumentForOcr,
  requirePermission,
  setDocumentAiBusyById,
  setNotice,
}: Pick<DocumentWorkspaceControllerDependencies, "actions" | "addAuditEntry" | "aiDocumentCopilotEnabled" | "aiOpenAiApiKey" | "aiOpenAiModel" | "buildDocumentAiContext" | "desktopDocumentAiApi" | "normalizeExtractedDocumentText" | "queueDocumentForOcr" | "requirePermission" | "setDocumentAiBusyById" | "setNotice">) {
  const runDocumentAiAnalysis = async (document: DocumentItem, options: SilentOptions = {}) => {
    if (!requirePermission("review_documents", "This access profile cannot run AI document review actions.")) return false;
    if (!aiDocumentCopilotEnabled) {
      setNotice("Enable AI document copilot in Settings first.");
      return false;
    }
    if (!String(aiOpenAiApiKey || "").trim()) {
      setNotice("Add an OpenAI API key in Settings first.");
      return false;
    }
    if (!desktopDocumentAiApi?.analyze) {
      setNotice("AI document actions run in the installed desktop app.");
      return false;
    }

    let workingDocument = document;
    let extractedText = normalizeExtractedDocumentText(document.extractedText || "");
    if (!extractedText) {
      const ocrResult = await queueDocumentForOcr(document, { silent: true });
      if (ocrResult?.ok && ocrResult?.completed && ocrResult?.text) {
        extractedText = normalizeExtractedDocumentText(ocrResult.text);
        workingDocument = {
          ...document,
          extractedText,
          ocrStatus: "completed",
        };
      } else if (ocrResult?.queued) {
        setNotice("This document needs OCR or manual extracted text before AI can analyze it.");
        return false;
      } else if (!ocrResult?.ok) {
        return false;
      }
    }

    const context = buildDocumentAiContext(workingDocument);

    setDocumentAiBusyById((prev: Record<string, boolean>) => ({ ...prev, [document.id]: true }));
    try {
      const result = await desktopDocumentAiApi.analyze({
        apiKey: aiOpenAiApiKey,
        model: aiOpenAiModel,
        context,
      });
      if (!result?.ok || !result?.analysis) {
        setNotice(result?.error || "AI could not analyze this document.");
        return false;
      }
      actions.updateDocument(document.id, { aiAnalysis: result.analysis });
      addAuditEntry({
        action: "ai-analyze",
        entityType: "document",
        entityId: workingDocument.id,
        propertyId: workingDocument.propertyId,
        unit: workingDocument.unit,
        summary: "Ran AI document analysis.",
        details: `Model ${result.analysis.model || aiOpenAiModel || "default"} on ${workingDocument.name}.`,
        category: "document",
      });
      if (!options.silent) {
        setNotice("AI analysis saved on the document.");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown AI error.");
      setNotice(`AI analysis failed: ${message}`);
      return false;
    } finally {
      setDocumentAiBusyById((prev: Record<string, boolean>) => {
        const next = { ...prev };
        delete next[document.id];
        return next;
      });
    }
  };

  return { runDocumentAiAnalysis };
}
