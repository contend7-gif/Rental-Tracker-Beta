import { formatUnitLabel } from "../../domain/unitLabels.js";
import { normalizeExtractedDocumentText } from "../../domain/documentIntelligence.ts";
import { SUPPORTING_ONLY_TAG, getDocumentWorkflowStatus } from "./documentWorkflow.js";

export function isSupportingOnlyDocument(document) {
  return Array.isArray(document?.tags) && document.tags.some((tag) => String(tag || "").trim().toLowerCase() === SUPPORTING_ONLY_TAG);
}

export function formatDocumentUnitLabel(unitName) {
  const value = String(unitName || "").trim();
  if (!value || value === "Shared") return "Shared";
  return formatUnitLabel(value);
}

export function formatDocumentScope(document, propertyLabel) {
  return [
    propertyLabel || document?.propertyId || "No property",
    formatDocumentUnitLabel(document?.unit || "Shared"),
  ].filter(Boolean).join(" | ");
}

export function formatDocumentDate(document) {
  const value = document?.documentDate || document?.date || document?.uploadedAt;
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(currency, value) {
  return value != null ? (currency?.(Number(value)) || String(value)) : "";
}

function normalizeComparableText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateLike(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : "";
}

function amountLike(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) / 100 : undefined;
}

function linkedDocumentTargetKey(document) {
  if (document?.transactionId) return `transaction:${document.transactionId}`;
  if (document?.leaseId) return `lease:${document.leaseId}`;
  if (document?.workOrderId) return `workOrder:${document.workOrderId}`;
  const related = Array.isArray(document?.relatedTransactionIds) ? document.relatedTransactionIds[0] : "";
  return related ? `transaction:${related}` : "";
}

export function buildLinkedRecordSummary(document, {
  currency,
  getDocumentLinkedWorkOrder,
  leaseById = {},
  transactionById = {},
} = {}) {
  const linkedTxn = document?.transactionId ? transactionById[document.transactionId] : null;
  if (linkedTxn) {
    const detail = [
      linkedTxn.date || "No date",
      linkedTxn.vendor || linkedTxn.category || linkedTxn.description || "Transaction",
      formatAmount(currency, linkedTxn.amount),
      formatDocumentUnitLabel(linkedTxn.unit || document.unit || "Shared"),
    ].filter(Boolean).join(" | ");
    return {
      kind: "transaction",
      label: `Linked transaction: ${detail}`,
    };
  }

  const relatedTransactions = (document?.relatedTransactionIds || [])
    .map((transactionId) => transactionById[transactionId])
    .filter(Boolean);
  if (relatedTransactions.length > 0) {
    const firstRelated = relatedTransactions[0];
    const detail = [
      firstRelated.date || "No date",
      firstRelated.vendor || firstRelated.category || firstRelated.description || "Transaction",
      formatAmount(currency, firstRelated.amount),
      relatedTransactions.length > 1 ? `plus ${relatedTransactions.length - 1} more` : "",
    ].filter(Boolean).join(" | ");
    return {
      kind: "transaction",
      label: `Related transaction${relatedTransactions.length === 1 ? "" : "s"}: ${detail}`,
    };
  }

  const linkedLease = document?.leaseId ? leaseById[document.leaseId] : null;
  if (linkedLease) {
    const detail = [
      linkedLease.tenantName || "Tenant",
      formatDocumentUnitLabel(linkedLease.unit || document.unit || "Shared"),
      linkedLease.startDate && linkedLease.endDate ? `${linkedLease.startDate} to ${linkedLease.endDate}` : "",
    ].filter(Boolean).join(" | ");
    return {
      kind: "lease",
      label: `Linked lease: ${detail}`,
    };
  }

  const linkedWorkOrder = getDocumentLinkedWorkOrder?.(document);
  if (linkedWorkOrder) {
    const detail = [
      linkedWorkOrder.title || "Work order",
      linkedWorkOrder.reportedOn || linkedWorkOrder.completedAt || "",
      formatDocumentUnitLabel(linkedWorkOrder.unit || document?.unit || "Shared"),
    ].filter(Boolean).join(" | ");
    return {
      kind: "workOrder",
      label: `Linked work order: ${detail}`,
    };
  }

  if (isSupportingOnlyDocument(document)) {
    return {
      kind: "supporting",
      label: "Supporting only: saved for documentation, not transaction creation.",
    };
  }

  return null;
}

export function buildDocumentQualityWarnings(document, {
  currency,
  duplicateCandidates = [],
  extractedFields,
  linkedTransaction,
} = {}) {
  const warnings = [];
  if (!document) return warnings;
  const reviewedWarningKeys = new Set(
    (Array.isArray(document.reviewedWarningKeys) ? document.reviewedWarningKeys : [])
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );
  const extractedText = normalizeExtractedDocumentText(document.extractedText || "");
  const extractedAmount = Number(extractedFields?.totalAmount ?? extractedFields?.amount ?? NaN);
  const linkedAmount = linkedTransaction ? Math.abs(Number(linkedTransaction.amount || 0)) : NaN;

  if (extractedFields?.confidence && extractedFields.confidence !== "high") {
    warnings.push({ key: "low_confidence", label: "Low confidence", detail: "Review extracted fields before applying changes." });
  }
  if (duplicateCandidates.length > 0) {
    const firstDuplicate = duplicateCandidates[0];
    warnings.push({
      key: "duplicate_document",
      label: "Possible duplicate file",
      detail: `Looks similar to ${firstDuplicate.document?.name || "another document"}. Review before creating or linking another record.`,
    });
  }
  if (Number.isFinite(extractedAmount) && Number.isFinite(linkedAmount) && Math.abs(extractedAmount - linkedAmount) > 0.01) {
    warnings.push({
      key: "amount_mismatch",
      label: "Amount mismatch",
      detail: `OCR total ${formatAmount(currency, extractedAmount)} does not match linked transaction ${formatAmount(currency, linkedAmount)}.`,
    });
  }
  if (extractedFields && !extractedFields.vendorName && !extractedFields.vendorEmail && !extractedFields.vendorPhone) {
    warnings.push({ key: "missing_vendor", label: "Vendor missing", detail: "Vendor was not confidently extracted." });
  }
  if (extractedFields && !extractedFields.invoiceDate && !extractedFields.serviceDate) {
    warnings.push({ key: "missing_date", label: "Date missing", detail: "Invoice or service date needs review." });
  }
  if (extractedFields && !Number.isFinite(extractedAmount)) {
    warnings.push({ key: "missing_amount", label: "Amount missing", detail: "Total amount was not confidently extracted." });
  }
  if (extractedFields?.serviceSummary && /\b(amount|total|due|balance)\b[\s:]*\$?\d[\d,]*(?:\.\d{2})?/i.test(extractedFields.serviceSummary)) {
    warnings.push({ key: "service_amount_text", label: "Service text includes amount", detail: "Review the service description so amount text is not treated as clean work detail." });
  }
  if (!extractedText && getDocumentWorkflowStatus(document, {
    documentSupportsAutomaticOcr: () => true,
    getDocumentLinkedWorkOrder: () => null,
  }) !== "reviewed") {
    warnings.push({ key: "no_text", label: "No extracted text", detail: "Run OCR or add text so this file can be searched and matched." });
  }
  return warnings.filter((warning) => !reviewedWarningKeys.has(warning.key));
}

export function buildDocumentDuplicateCandidates(document, {
  documents = [],
  getDocumentExtractedFields,
  transactionById = {},
} = {}) {
  if (!document || !Array.isArray(documents) || documents.length === 0) return [];
  const currentFields = getDocumentExtractedFields?.(document) || null;
  const currentLinkedTxn = document.transactionId ? transactionById[document.transactionId] : null;
  const currentName = normalizeComparableText(document.name);
  const currentVendor = normalizeComparableText(currentFields?.vendorName || currentLinkedTxn?.vendor || "");
  const currentDate = dateLike(currentFields?.invoiceDate || currentFields?.serviceDate || currentLinkedTxn?.date || document.uploadedAt);
  const currentAmount = amountLike(currentFields?.totalAmount ?? currentLinkedTxn?.amount);
  const currentTargetKey = linkedDocumentTargetKey(document);

  return documents
    .filter((candidate) => candidate && candidate.id !== document.id)
    .map((candidate) => {
      const candidateFields = getDocumentExtractedFields?.(candidate) || null;
      const candidateLinkedTxn = candidate.transactionId ? transactionById[candidate.transactionId] : null;
      const reasons = [];
      let score = 0;

      const candidateTargetKey = linkedDocumentTargetKey(candidate);
      if (currentTargetKey && candidateTargetKey && currentTargetKey === candidateTargetKey) {
        score += 6;
        reasons.push("same linked record");
      }

      const candidateName = normalizeComparableText(candidate.name);
      if (currentName && candidateName && currentName === candidateName) {
        score += 4;
        reasons.push("same file name");
      }

      const candidateAmount = amountLike(candidateFields?.totalAmount ?? candidateLinkedTxn?.amount);
      if (currentAmount != null && candidateAmount != null && Math.abs(currentAmount - candidateAmount) < 0.01) {
        score += 2;
        reasons.push("same amount");
      }

      const candidateDate = dateLike(candidateFields?.invoiceDate || candidateFields?.serviceDate || candidateLinkedTxn?.date || candidate.uploadedAt);
      if (currentDate && candidateDate && currentDate === candidateDate) {
        score += 2;
        reasons.push("same date");
      }

      const candidateVendor = normalizeComparableText(candidateFields?.vendorName || candidateLinkedTxn?.vendor || "");
      if (currentVendor && candidateVendor && (currentVendor.includes(candidateVendor) || candidateVendor.includes(currentVendor))) {
        score += 2;
        reasons.push("same vendor");
      }

      return {
        document: candidate,
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score >= 4)
    .sort((left, right) => right.score - left.score || String(right.document?.uploadedAt || "").localeCompare(String(left.document?.uploadedAt || "")))
    .slice(0, 5);
}

export function buildDocumentHealthBadges(document, context = {}) {
  if (!document) return [];
  const warnings = context.getDocumentQualityWarnings?.(document) || [];
  const warningBadges = warnings.map((warning) => {
    if (warning.key === "duplicate_document") return { key: "duplicate", label: "Duplicate?", tone: "amber" };
    if (warning.key === "amount_mismatch") return { key: "linked_mismatch", label: "Linked mismatch", tone: "amber" };
    if (warning.key === "missing_amount") return { key: "missing_amount", label: "Missing amount", tone: "amber" };
    if (warning.key === "missing_vendor") return { key: "missing_vendor", label: "Missing vendor", tone: "amber" };
    if (warning.key === "missing_date") return { key: "missing_date", label: "Missing date", tone: "amber" };
    if (warning.key === "no_text") return { key: "needs_text", label: "Needs OCR", tone: "blue" };
    return { key: warning.key, label: warning.label || "Needs review", tone: "amber" };
  });

  const extracted = document.ocrStatus === "completed" || Boolean(String(document.extractedText || "").trim());
  const status = getDocumentWorkflowStatus(document, context);
  const badges = [...warningBadges];
  if (!extracted) badges.push({ key: "needs_text_status", label: document.ocrStatus === "pending" ? "OCR pending" : "Needs OCR", tone: "blue" });
  if (status === "needs_expense_review") badges.push({ key: "expense_draft", label: "Expense draft", tone: "emerald" });
  if (status === "needs_work_order_review") badges.push({ key: "work_order_draft", label: "Work order draft", tone: "sky" });
  if (context.getSafeDocumentLinkSuggestion?.(document)) badges.push({ key: "suggested_link", label: "Suggested link", tone: "indigo" });
  if (status === "needs_attachment" && extracted) badges.push({ key: "ready_to_attach", label: "Ready to attach", tone: "teal" });
  if (status === "reviewed") badges.push({ key: "reviewed", label: "Reviewed", tone: "slate" });
  if (status === "supporting_only") badges.push({ key: "supporting", label: "Supporting", tone: "slate" });

  const seen = new Set();
  return badges.filter((badge) => {
    const key = badge.key || badge.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}
