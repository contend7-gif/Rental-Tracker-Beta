import type { DocumentAiAnalysis, DocumentAiSuggestedAction } from "../models.ts";

const DOCUMENT_AI_ACTIONS: DocumentAiSuggestedAction[] = [
  "create_expense_draft",
  "create_work_order_draft",
  "attach_to_lease",
  "supporting_doc",
  "review_only",
];

function sanitizeShortText(value: unknown, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeLongText(value: unknown, maxLength = 1200) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function sanitizeActionItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  value.forEach((item) => {
    const normalized = sanitizeShortText(item, 160);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(normalized);
  });
  return items.slice(0, 6);
}

function normalizeSuggestedAction(value: unknown): DocumentAiSuggestedAction | undefined {
  const normalized = sanitizeShortText(value, 80).toLowerCase();
  return DOCUMENT_AI_ACTIONS.includes(normalized as DocumentAiSuggestedAction)
    ? (normalized as DocumentAiSuggestedAction)
    : undefined;
}

export function documentAiActionLabel(value: unknown) {
  switch (normalizeSuggestedAction(value)) {
    case "create_expense_draft":
      return "Create expense draft";
    case "create_work_order_draft":
      return "Create work order draft";
    case "attach_to_lease":
      return "Attach to lease";
    case "supporting_doc":
      return "Keep as supporting document";
    default:
      return "Review only";
  }
}

export function normalizeDocumentAiAnalysis(value: unknown): DocumentAiAnalysis | undefined {
  if (!value || typeof value !== "object") return undefined;
  const analysis = value as Record<string, unknown>;
  const summary = sanitizeLongText(analysis.summary, 1500);
  if (!summary) return undefined;

  const totalAmount = Number(analysis.totalAmount);
  const normalized: DocumentAiAnalysis = {
    summary,
    actionItems: sanitizeActionItems(analysis.actionItems),
    suggestedAction: normalizeSuggestedAction(analysis.suggestedAction),
    suggestedActionReason: sanitizeLongText(analysis.suggestedActionReason, 400) || undefined,
    documentType: sanitizeShortText(analysis.documentType, 80) || undefined,
    vendorName: sanitizeShortText(analysis.vendorName, 120) || undefined,
    invoiceRef: sanitizeShortText(analysis.invoiceRef, 80) || undefined,
    invoiceDate: sanitizeShortText(analysis.invoiceDate, 40) || undefined,
    dueDate: sanitizeShortText(analysis.dueDate, 40) || undefined,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
    propertyAddress: sanitizeShortText(analysis.propertyAddress, 180) || undefined,
    unit: sanitizeShortText(analysis.unit, 40) || undefined,
    serviceSummary: sanitizeLongText(analysis.serviceSummary, 240) || undefined,
    model: sanitizeShortText(analysis.model, 80) || undefined,
    analyzedAt: sanitizeShortText(analysis.analyzedAt, 40) || undefined,
  };

  if (!normalized.actionItems || normalized.actionItems.length === 0) {
    delete normalized.actionItems;
  }

  return normalized;
}
