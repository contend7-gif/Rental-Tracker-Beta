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
  extractedFields,
  linkedTransaction,
} = {}) {
  const warnings = [];
  if (!document) return warnings;
  const extractedText = normalizeExtractedDocumentText(document.extractedText || "");
  const extractedAmount = Number(extractedFields?.totalAmount ?? extractedFields?.amount ?? NaN);
  const linkedAmount = linkedTransaction ? Math.abs(Number(linkedTransaction.amount || 0)) : NaN;

  if (extractedFields?.confidence && extractedFields.confidence !== "high") {
    warnings.push({ key: "low_confidence", label: "Low confidence", detail: "Review extracted fields before applying changes." });
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
  return warnings;
}
