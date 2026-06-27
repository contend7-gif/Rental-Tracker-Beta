export function parseDocumentTags(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[;,\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function formatDocumentTags(tags) {
  if (Array.isArray(tags)) {
    return parseDocumentTags(tags.map((tag) => (typeof tag === "string" ? tag : tag?.tag || "")).join(", ")).join(", ");
  }
  return parseDocumentTags(tags).join(", ");
}

export function documentTagSuggestionSourceLabel(suggestion) {
  const sourceLabels = {
    name: "Name",
    context: "Context",
    ocr: "OCR",
    ocr_match: "OCR match",
  };
  const sources = Array.isArray(suggestion?.sources) ? suggestion.sources : [];
  return sources.map((source) => sourceLabels[source] || source).join(" + ");
}

export function documentLinkSuggestionKindLabel(kind) {
  if (kind === "lease") return "Lease";
  if (kind === "transaction") return "Transaction";
  return "Work order";
}

export function expenseSuggestionConfidenceLabel(confidence) {
  return confidence === "high" ? "High confidence" : "Review suggested fields";
}

export function expenseSuggestionReasonSummary(suggestion) {
  if (!suggestion) return "";
  const parts = [];
  if (suggestion.vendor) parts.push("vendor");
  if (suggestion.amount != null) parts.push("amount");
  if (suggestion.date) parts.push("date");
  if (suggestion.invoiceRef) parts.push("reference");
  if (suggestion.category) parts.push("category");
  const sourceLabel = documentTagSuggestionSourceLabel(suggestion);
  if (parts.length === 0) return sourceLabel ? `Matched using ${sourceLabel}.` : "";
  return `Matched using ${sourceLabel}. Filled ${parts.join(", ")}.`;
}

export function workOrderSuggestionConfidenceLabel(confidence) {
  return confidence === "high" ? "High confidence" : "Review before creating";
}

export function workOrderSuggestionReasonSummary(suggestion) {
  if (!suggestion) return "";
  const parts = [];
  if (suggestion.vendor) parts.push("vendor");
  if (suggestion.estimatedCost != null) parts.push("cost");
  if (suggestion.reportedOn) parts.push("date");
  if (suggestion.unit && suggestion.unit !== "Shared") parts.push("unit");
  if (suggestion.priority) parts.push("priority");
  const sourceLabel = documentTagSuggestionSourceLabel(suggestion);
  if (parts.length === 0) return sourceLabel ? `Matched using ${sourceLabel}.` : "";
  return `Matched using ${sourceLabel}. Filled ${parts.join(", ")}.`;
}

export function suggestedFieldHint(label) {
  return `${label} was prefilled from OCR/document context. Review before saving.`;
}

export const DOCUMENT_OCR_STATUS_OPTIONS = [
  { value: "pending", label: "Pending OCR" },
  { value: "completed", label: "OCR text entered" },
  { value: "not_needed", label: "No OCR needed" },
];

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function canAttachToTransaction(file) {
  if (!file) return false;
  const mime = (file.type || "").toLowerCase();
  if (!mime) return true;
  if (mime === "application/pdf") return true;
  return mime.startsWith("image/");
}
