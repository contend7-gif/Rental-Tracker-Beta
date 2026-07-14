import { normalizeDocumentAiAnalysis } from "../domain/documentAi.ts";
import { normalizeDocumentOcrStatus } from "../domain/documentIntelligence.ts";
import type { DocumentItem } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type DocumentStateSetter = (updater: DocumentItem[] | ((previous: DocumentItem[]) => DocumentItem[])) => void;

export function createDocumentActions({
  getDocuments,
  setDocuments,
  appendActivityLog,
}: {
  getDocuments: () => DocumentItem[];
  setDocuments: DocumentStateSetter;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    addDocument(document: DocumentItem) {
      const normalized = normalizeDocument(document);
      const existsBefore = getDocuments().some((item) => item.id === normalized.id);
      setDocuments((previous) => [normalized, ...previous.filter((item) => item.id !== normalized.id)]);
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "document",
        entityId: normalized.id,
        propertyId: normalized.propertyId,
        unit: normalized.unit,
        summary: existsBefore ? "Document updated." : "Document added.",
        details: normalized.name,
      });
    },
    updateDocument(id: string, updates: Partial<DocumentItem>) {
      const existingDocument = getDocuments().find((document) => document.id === id);
      setDocuments((previous) =>
        previous.map((document) => {
          if (document.id !== id) return document;
          return normalizeDocument({ ...document, ...updates, id: document.id });
        }),
      );
      const propertyId = String(updates.propertyId || existingDocument?.propertyId || "").trim() || undefined;
      const unit = String(updates.unit || existingDocument?.unit || "").trim() || undefined;
      appendActivityLog({
        action: "update",
        entityType: "document",
        entityId: id,
        propertyId,
        unit,
        summary: "Document metadata updated.",
        details: String(updates.name || existingDocument?.name || "").trim() || undefined,
      });
    },
    deleteDocument(id: string) {
      const existingDocument = getDocuments().find((document) => document.id === id);
      setDocuments((previous) => previous.filter((document) => document.id !== id));
      appendActivityLog({
        action: "delete",
        entityType: "document",
        entityId: id,
        propertyId: existingDocument?.propertyId,
        unit: existingDocument?.unit,
        summary: "Document deleted.",
        details: existingDocument?.name,
      });
    },
  };
}

export function normalizeDocumentTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  value.forEach((item) => {
    const normalized = String(item || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(normalized);
  });
  return tags;
}

function normalizeDocumentOcrFieldOverrides(value: DocumentItem["ocrFieldOverrides"]) {
  const vendorName = String(value?.vendorName || "").trim();
  const totalAmount = Number(value?.totalAmount);
  const servicePeriodStart = String(value?.servicePeriodStart || "").trim();
  const servicePeriodEnd = String(value?.servicePeriodEnd || "").trim();
  const normalized = {
    vendorName: vendorName || undefined,
    totalAmount: Number.isFinite(totalAmount) && totalAmount >= 0 ? Math.round(totalAmount * 100) / 100 : undefined,
    servicePeriodStart: servicePeriodStart || undefined,
    servicePeriodEnd: servicePeriodEnd || undefined,
  };
  return Object.values(normalized).some((item) => item != null) ? normalized : undefined;
}

export function normalizeDocument(document: DocumentItem): DocumentItem {
  const leaseId = String(document.leaseId || "").trim();
  const transactionId = String(document.transactionId || "").trim();
  const relatedTransactionIds = Array.isArray(document.relatedTransactionIds)
    ? [...new Set(document.relatedTransactionIds.map((item) => String(item || "").trim()).filter(Boolean).filter((item) => item !== transactionId))]
    : [];
  const workOrderId = String(document.workOrderId || "").trim();
  const unit = String(document.unit || "").trim();
  const unitScopeOverride = Boolean(document.unitScopeOverride);
  const uploadedAt = String(document.uploadedAt || "").trim();
  const expiresOn = String(document.expiresOn || "").trim();
  const mimeType = String(document.mimeType || "").trim();
  const dataUrl = String(document.dataUrl || "").trim();
  const extractedText = String(document.extractedText || "").trim();
  const ocrFieldOverrides = normalizeDocumentOcrFieldOverrides(document.ocrFieldOverrides);
  const ocrStatus = normalizeDocumentOcrStatus(document.ocrStatus, extractedText);
  const reviewedWarningKeys = normalizeDocumentTags(document.reviewedWarningKeys);
  const reviewedWarningsAt = String(document.reviewedWarningsAt || "").trim();
  const expenseReviewDismissedAt = String(document.expenseReviewDismissedAt || "").trim();
  const workOrderReviewDismissedAt = String(document.workOrderReviewDismissedAt || "").trim();
  const aiAnalysis = normalizeDocumentAiAnalysis(document.aiAnalysis);

  return {
    ...document,
    id: String(document.id || "").trim(),
    propertyId: String(document.propertyId || "").trim(),
    name: String(document.name || "").trim(),
    type: String(document.type || "").trim(),
    leaseId: leaseId || undefined,
    transactionId: transactionId || undefined,
    relatedTransactionIds: relatedTransactionIds.length > 0 ? relatedTransactionIds : undefined,
    workOrderId: workOrderId || undefined,
    unit: unit || undefined,
    unitScopeOverride: unitScopeOverride || undefined,
    uploadedAt: uploadedAt || undefined,
    expiresOn: expiresOn || undefined,
    mimeType: mimeType || undefined,
    dataUrl: dataUrl || undefined,
    tags: normalizeDocumentTags(document.tags),
    extractedText: extractedText || undefined,
    ocrFieldOverrides,
    ocrStatus,
    reviewedWarningKeys: reviewedWarningKeys.length > 0 ? reviewedWarningKeys : undefined,
    reviewedWarningsAt: reviewedWarningsAt || undefined,
    expenseReviewDismissedAt: transactionId ? undefined : (expenseReviewDismissedAt || undefined),
    workOrderReviewDismissedAt: workOrderId ? undefined : (workOrderReviewDismissedAt || undefined),
    aiAnalysis,
  };
}
