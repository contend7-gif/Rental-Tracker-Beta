import {
  documentNeedsIndexing,
  documentNeedsOcr,
  normalizeExtractedDocumentText,
} from "../../domain/documentIntelligence.ts";

export const SUPPORTING_ONLY_TAG = "supporting-only";

function hasSupportingOnlyTag(document) {
  return Array.isArray(document?.tags) && document.tags.some((tag) => String(tag || "").trim().toLowerCase() === SUPPORTING_ONLY_TAG);
}

export function removeSupportingOnlyTag(tags = []) {
  return (Array.isArray(tags) ? tags : []).filter((tag) => String(tag || "").trim().toLowerCase() !== SUPPORTING_ONLY_TAG);
}

function getLinkedWorkOrder(document, context = {}) {
  return context.getDocumentLinkedWorkOrder?.(document) || (document?.workOrderId ? { id: document.workOrderId } : null);
}

function hasLinkedRecord(document, context = {}) {
  return Boolean(document?.transactionId || document?.leaseId || document?.workOrderId || getLinkedWorkOrder(document, context));
}

function getReviewWarnings(document, context = {}) {
  const warnings = context.getDocumentQualityWarnings?.(document);
  return Array.isArray(warnings) ? warnings : [];
}

function getExpenseRecord(document, context = {}) {
  return context.documentExpenseReviewRecordById?.[document?.id] || null;
}

function getWorkOrderRecord(document, context = {}) {
  return context.documentWorkOrderReviewRecordById?.[document?.id] || null;
}

export function getDocumentWorkflowStatus(document, context = {}) {
  if (getReviewWarnings(document, context).length > 0) return "needs_review";
  if (hasLinkedRecord(document, context)) return "reviewed";
  if (hasSupportingOnlyTag(document)) return "supporting_only";

  const canExtractText = Boolean(document?.dataUrl && context.documentSupportsAutomaticOcr?.(document.name, document.mimeType));
  if ((documentNeedsOcr(document || {}) || documentNeedsIndexing(document || {})) && canExtractText) return "needs_ocr";

  const expenseRecord = getExpenseRecord(document, context);
  const expenseSuggestion = expenseRecord?.suggestion || context.getDocumentExpenseSuggestion?.(document);
  if (expenseSuggestion && !expenseRecord?.dismissed) return "needs_expense_review";

  const workOrderRecord = getWorkOrderRecord(document, context);
  const workOrderSuggestion = workOrderRecord?.suggestion || context.getDocumentWorkOrderSuggestion?.(document);
  if (workOrderSuggestion && !workOrderRecord?.dismissed) return "needs_work_order_review";

  const safeLinkSuggestion = context.getSafeDocumentLinkSuggestion?.(document);
  if (safeLinkSuggestion || !hasSupportingOnlyTag(document)) return "needs_attachment";

  return "reviewed";
}

export function isDocumentReviewed(document, context = {}) {
  const status = getDocumentWorkflowStatus(document, context);
  return status === "reviewed" || status === "supporting_only";
}

export function getDocumentPrimaryAction(document, context = {}) {
  const status = getDocumentWorkflowStatus(document, context);
  const expenseRecord = getExpenseRecord(document, context);
  const workOrderRecord = getWorkOrderRecord(document, context);
  const safeLinkSuggestion = context.getSafeDocumentLinkSuggestion?.(document);
  const linked = hasLinkedRecord(document, context);

  if (status === "needs_review") {
    return { key: "review", label: "Review details" };
  }
  if (status === "needs_ocr") {
    return { key: "extract_text", label: "Extract text" };
  }
  if (status === "needs_expense_review") {
    return { key: "review_expense", label: "Review expense draft", suggestion: expenseRecord?.suggestion || context.getDocumentExpenseSuggestion?.(document) };
  }
  if (status === "needs_work_order_review") {
    return { key: "review_work_order", label: "Review work order draft", suggestion: workOrderRecord?.suggestion || context.getDocumentWorkOrderSuggestion?.(document) };
  }
  if (linked) {
    return { key: "view_linked", label: "View linked record" };
  }
  if (safeLinkSuggestion) {
    return { key: "review_attachment", label: "Review attachment", suggestion: safeLinkSuggestion };
  }
  if (status === "supporting_only") {
    return { key: "review", label: "Review details" };
  }
  if (normalizeExtractedDocumentText(document?.extractedText || "")) {
    return { key: "choose_next_step", label: "Attach or mark supporting" };
  }
  return { key: "choose_next_step", label: "Choose next step" };
}

export function getDocumentSecondaryActions(document, context = {}) {
  const actions = [{ key: "review", label: "Review details" }];
  actions.push({ key: "remove", label: "Remove" });
  return actions;
}

export function getDocumentReviewSummary(document, context = {}) {
  const status = getDocumentWorkflowStatus(document, context);
  const extractedText = normalizeExtractedDocumentText(document?.extractedText || "");
  const expenseRecord = getExpenseRecord(document, context);
  const workOrderRecord = getWorkOrderRecord(document, context);
  const expenseSuggestion = expenseRecord?.suggestion || context.getDocumentExpenseSuggestion?.(document);
  const workOrderSuggestion = workOrderRecord?.suggestion || context.getDocumentWorkOrderSuggestion?.(document);
  const linkSuggestion = context.getSafeDocumentLinkSuggestion?.(document) || context.getDocumentLinkSuggestions?.(document)?.[0];
  const linkedSummary = context.getDocumentLinkedSummary?.(document);
  const reviewWarnings = getReviewWarnings(document, context);

  if (status === "needs_review") {
    if (reviewWarnings.length === 1) return reviewWarnings[0].detail || "Review this document before applying recommendations.";
    if (reviewWarnings.length > 1) return `${reviewWarnings.length} review warnings need attention.`;
    return "Review this document before applying recommendations.";
  }
  if (status === "needs_ocr") return "Extract text so this file becomes searchable and can suggest a next step.";
  if (status === "needs_expense_review" && expenseSuggestion) {
    return `Suggested expense: ${expenseSuggestion.category}${expenseSuggestion.amount != null ? ` for ${context.currency?.(expenseSuggestion.amount) || expenseSuggestion.amount}` : ""}.`;
  }
  if (status === "needs_work_order_review" && workOrderSuggestion) {
    return `Suggested work order: ${workOrderSuggestion.title}${workOrderSuggestion.estimatedCost != null ? ` for ${context.currency?.(workOrderSuggestion.estimatedCost) || workOrderSuggestion.estimatedCost}` : ""}.`;
  }
  if (status === "reviewed") return linkedSummary || "Linked to a rental record and searchable from the archive.";
  if (linkSuggestion) return `Possible ${context.documentLinkSuggestionKindLabel?.(linkSuggestion.kind)?.toLowerCase() || linkSuggestion.kind} match: ${linkSuggestion.label}.`;
  if (status === "supporting_only") return "Saved as supporting documentation with searchable text and tags.";
  if (extractedText) return "Text has been extracted. Attach it to a record or keep it as supporting documentation.";
  return "No recommendation yet. Add text, attach a record, or save it as supporting documentation.";
}

export function documentWorkflowStatusLabel(status) {
  return {
    needs_ocr: "Needs text extraction",
    needs_expense_review: "Expense drafts",
    needs_work_order_review: "Work order drafts",
    needs_attachment: "Needs attachment",
    needs_review: "Needs review",
    reviewed: "Reviewed",
    supporting_only: "Supporting only",
  }[status] || "Needs review";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function optionDateValue(option) {
  return option?.date || option?.reportedOn || option?.startDate || option?.leaseStart || "";
}

function documentSearchText(document) {
  return normalizeText([
    document?.name,
    document?.type,
    document?.extractedText,
  ].filter(Boolean).join(" "));
}

export function getDocumentAttachOptionScore(document, option) {
  if (!document || !option) return 0;
  const documentUnit = normalizeText(document.unit || "Shared");
  const optionUnit = normalizeText(option.unit || "Shared");
  const text = documentSearchText(document);
  const optionDate = normalizeText(optionDateValue(option));
  const optionVendor = normalizeText(option.vendor || option.description || option.title || option.tenantName || "");
  let score = 0;

  if (document.propertyId && option.propertyId && document.propertyId === option.propertyId) score += 1000;
  if (documentUnit && optionUnit && documentUnit === optionUnit) score += 120;
  if (documentUnit === "shared" || optionUnit === "shared") score += 15;
  if (optionDate && text.includes(optionDate)) score += 60;
  if (optionVendor && text.includes(optionVendor)) score += 50;

  return score;
}

export function sortDocumentAttachOptions(document, options = []) {
  return [...options].sort((left, right) => {
    const scoreDelta = getDocumentAttachOptionScore(document, right) - getDocumentAttachOptionScore(document, left);
    if (scoreDelta !== 0) return scoreDelta;
    const dateDelta = String(optionDateValue(right)).localeCompare(String(optionDateValue(left)));
    if (dateDelta !== 0) return dateDelta;
    return String(left.label || "").localeCompare(String(right.label || ""));
  });
}
