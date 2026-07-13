import type { DocumentItem } from "../models.ts";
import type { DocumentImportDraft } from "./documentImportDraft.ts";

const SUPPORTING_ONLY_TAG = "supporting-only";

function removeSupportingOnlyTag(tags: unknown): string[] {
  return (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || ""))
    .filter((tag) => tag.trim().toLowerCase() !== SUPPORTING_ONLY_TAG);
}

type DocumentLinkKind = "lease" | "transaction" | "workOrder";

export type DocumentLinkSuggestion = {
  id: string;
  kind: DocumentLinkKind;
  label?: string;
  propertyId?: string;
  unit?: string;
};

export function buildDocumentLinkUpdate(
  document: DocumentItem,
  suggestion: DocumentLinkSuggestion,
): Partial<DocumentItem> {
  const nextFields: Partial<DocumentItem> = {
    reviewedWarningKeys: undefined,
    reviewedWarningsAt: undefined,
  };
  if (suggestion.kind === "lease") {
    nextFields.leaseId = suggestion.id;
    nextFields.expenseReviewDismissedAt = undefined;
    nextFields.workOrderReviewDismissedAt = undefined;
  } else if (suggestion.kind === "transaction") {
    nextFields.transactionId = suggestion.id;
    nextFields.expenseReviewDismissedAt = undefined;
  } else {
    nextFields.workOrderId = suggestion.id;
    nextFields.workOrderReviewDismissedAt = undefined;
  }
  if (suggestion.propertyId) nextFields.propertyId = suggestion.propertyId;
  if (suggestion.unit) nextFields.unit = suggestion.unit;
  const nextTags = removeSupportingOnlyTag(document.tags);
  if (nextTags.length !== (Array.isArray(document.tags) ? document.tags.length : 0)) {
    nextFields.tags = nextTags;
  }
  return nextFields;
}

export function buildDocumentUnlinkUpdate(
  document: DocumentItem,
  kind: string,
  relatedTransactionIdValue?: unknown,
): Partial<DocumentItem> | null {
  if (kind === "lease") {
    return { leaseId: undefined };
  }
  if (kind === "transaction") {
    const relatedTransactionId = String(relatedTransactionIdValue || "").trim();
    return {
      ...(relatedTransactionId
        ? { relatedTransactionIds: (document.relatedTransactionIds || []).filter((id) => id !== relatedTransactionId) }
        : { transactionId: undefined }),
      expenseReviewDismissedAt: undefined,
    };
  }
  if (kind === "workOrder") {
    return {
      workOrderId: undefined,
      workOrderReviewDismissedAt: undefined,
    };
  }
  return null;
}

export function applyDocumentImportLinkSuggestionToDraft(
  previous: DocumentImportDraft,
  suggestion: DocumentLinkSuggestion,
): DocumentImportDraft {
  return {
    ...previous,
    linkType: suggestion.kind,
    linkedId: suggestion.id,
    propertyId: suggestion.propertyId || previous.propertyId,
    unit: suggestion.unit || previous.unit,
  };
}
