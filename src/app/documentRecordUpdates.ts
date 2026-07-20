import type { DocumentItem, DocumentOcrStatus, Lease, Transaction, WorkOrder } from "../models.ts";
import { parseDocumentTags } from "./documentShared.ts";
import type { DocumentImportDraft } from "./documentImportDraft.ts";

type LinkedLease = Pick<Lease, "id" | "propertyId" | "unit">;
type LinkedTransaction = Pick<Transaction, "id" | "propertyId" | "unit">;
type LinkedWorkOrder = Pick<WorkOrder, "id" | "propertyId" | "unit">;

type BuildImportedDocumentRecordArgs = {
  draft: DocumentImportDraft;
  effectiveLinkType: string;
  effectiveLinkedId: string;
  extractedText: string;
  leaseById: Record<string, LinkedLease>;
  transactionById: Record<string, LinkedTransaction>;
  workOrderById: Record<string, LinkedWorkOrder>;
  id: string;
  uploadedAt: string;
  ocrStatus: DocumentOcrStatus;
};

export function buildImportedDocumentRecord({
  draft,
  effectiveLinkType,
  effectiveLinkedId,
  extractedText,
  leaseById,
  transactionById,
  workOrderById,
  id,
  uploadedAt,
  ocrStatus,
}: BuildImportedDocumentRecordArgs): DocumentItem | null {
  const linkedLease = effectiveLinkType === "lease" ? leaseById[effectiveLinkedId] : null;
  const linkedTransaction = effectiveLinkType === "transaction" ? transactionById[effectiveLinkedId] : null;
  const linkedWorkOrder = effectiveLinkType === "workOrder" ? workOrderById[effectiveLinkedId] : null;
  const propertyId = linkedLease?.propertyId || linkedTransaction?.propertyId || linkedWorkOrder?.propertyId || draft.propertyId;
  if (!propertyId) return null;
  const unit = draft.unitScopeOverride
    ? draft.unit || "Shared"
    : linkedLease?.unit || linkedTransaction?.unit || linkedWorkOrder?.unit || draft.unit || "Shared";

  return {
    id,
    propertyId,
    unit,
    name: String(draft.name || "").trim(),
    type: String(draft.type || "").trim() || "Scanned PDF",
    leaseId: linkedLease?.id,
    transactionId: linkedTransaction?.id,
    workOrderId: linkedWorkOrder?.id,
    unitScopeOverride: Boolean(draft.unitScopeOverride),
    mimeType: draft.mimeType || undefined,
    uploadedAt,
    dataUrl: draft.dataUrl,
    tags: parseDocumentTags(draft.tags),
    extractedText: extractedText || undefined,
    ocrStatus,
    ...(draft.sourceRef ? { sourceRef: draft.sourceRef } : {}),
  };
}

export function buildDocumentTagsUpdate(document: DocumentItem, rawTags: unknown): Pick<DocumentItem, "tags"> | null {
  const nextTags = parseDocumentTags(rawTags);
  const priorTags = Array.isArray(document.tags) ? document.tags : [];
  const unchanged =
    priorTags.length === nextTags.length &&
    priorTags.every((tag, index) => String(tag || "").toLowerCase() === String(nextTags[index] || "").toLowerCase());
  return unchanged ? null : { tags: nextTags };
}

export function buildDocumentExtractedTextUpdate(
  document: DocumentItem,
  rawText: unknown,
  normalizeExtractedDocumentText: (value: unknown) => string,
): Partial<DocumentItem> | null {
  const nextExtractedText = normalizeExtractedDocumentText(rawText);
  const priorExtractedText = String(document.extractedText || "").trim();
  if (nextExtractedText === priorExtractedText) return null;
  return {
    extractedText: nextExtractedText,
    reviewedWarningKeys: undefined,
    reviewedWarningsAt: undefined,
    expenseReviewDismissedAt: nextExtractedText ? undefined : document.expenseReviewDismissedAt,
    workOrderReviewDismissedAt: nextExtractedText ? undefined : document.workOrderReviewDismissedAt,
  };
}
