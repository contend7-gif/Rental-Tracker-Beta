import type { DocumentItem, Lease, Property, Transaction, Unit, Vendor, WorkOrder } from "../models.ts";

export type DocumentTagSuggestionSource = "name" | "context" | "ocr" | "ocr_match";
export type DocumentTagSuggestion = {
  tag: string;
  sources: DocumentTagSuggestionSource[];
};

export type DocumentLinkSuggestionKind = "lease" | "transaction" | "workOrder";
export type DocumentLinkSuggestion = {
  kind: DocumentLinkSuggestionKind;
  id: string;
  label: string;
  propertyId?: string;
  unit?: string;
  confidence: "high" | "medium";
  sources: DocumentTagSuggestionSource[];
};

export type DocumentExpenseSuggestion = {
  propertyId?: string;
  unit?: string;
  vendor: string;
  vendorId?: string;
  category: string;
  description: string;
  amount?: number;
  date?: string;
  invoiceRef?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  confidence: "high" | "medium";
  sources: DocumentTagSuggestionSource[];
  reasons?: string[];
};

export type DocumentExtractedFields = {
  propertyId?: string;
  propertyAddress?: string;
  unit?: string;
  vendorName?: string;
  vendorId?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  invoiceRef?: string;
  invoiceDate?: string;
  serviceDate?: string;
  dueDate?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  serviceSummary?: string;
  confidence: "high" | "medium";
  sources: DocumentTagSuggestionSource[];
  reasons?: string[];
};

export type DocumentUtilitySection = {
  key: string;
  address: string;
  propertyId?: string;
  propertyLabel?: string;
  unit?: string;
  vendor: string;
  category: string;
  description: string;
  amount?: number;
  date?: string;
  invoiceRef?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  accountRef?: string;
  confidence: "high" | "medium";
  sources: DocumentTagSuggestionSource[];
  reasons?: string[];
  external: boolean;
};

export type DocumentWorkOrderSuggestion = {
  propertyId?: string;
  unit?: string;
  title: string;
  description: string;
  priority: WorkOrder["priority"];
  vendor: string;
  vendorId?: string;
  estimatedCost?: number;
  reportedOn?: string;
  confidence: "high" | "medium";
  sources: DocumentTagSuggestionSource[];
  reasons?: string[];
};

type InferDocumentTagsArgs = {
  document: Pick<DocumentItem, "name" | "type" | "tags" | "extractedText"> & Partial<Pick<DocumentItem, "propertyId" | "unit" | "unitScopeOverride" | "ocrFieldOverrides">>;
  property?: Pick<Property, "id" | "name" | "address"> | null;
  lease?: Pick<Lease, "id" | "tenantName" | "unit" | "propertyId"> | null;
  transaction?: Pick<Transaction, "id" | "type" | "category" | "description" | "vendor" | "unit" | "propertyId" | "date" | "amount" | "invoiceRef"> | null;
  workOrder?: Pick<WorkOrder, "id" | "title" | "description" | "priority" | "unit" | "propertyId" | "reportedOn" | "completedAt"> | null;
  vendor?: Pick<Vendor, "id" | "name" | "aliases" | "phone" | "email" | "defaultCategory"> | null;
  candidateVendors?: Array<Pick<Vendor, "id" | "name" | "aliases" | "phone" | "email" | "defaultCategory">>;
  candidateLeases?: Array<Pick<Lease, "id" | "tenantName" | "unit" | "propertyId">>;
  candidateProperties?: Array<Pick<Property, "id" | "name" | "address">>;
  candidateUnits?: Array<Pick<Unit, "name" | "propertyId">>;
  candidateTransactions?: Array<Pick<Transaction, "id" | "type" | "category" | "description" | "vendor" | "unit" | "propertyId" | "date" | "amount" | "invoiceRef">>;
  candidateWorkOrders?: Array<(Pick<WorkOrder, "id" | "title" | "description" | "priority" | "unit" | "propertyId" | "reportedOn" | "completedAt"> & { vendorName?: string })>;
};

export type DocumentOcrStatus = "not_needed" | "pending" | "completed";

const SUGGESTION_SOURCE_ORDER: DocumentTagSuggestionSource[] = ["name", "context", "ocr", "ocr_match"];
const ENTITY_STOP_WORDS = new Set(["llc", "inc", "the", "and", "for", "property", "street", "drive", "road", "avenue", "lane", "court", "place"]);
const GENERIC_UTILITY_VENDOR_WORDS = new Set(["utility", "utilities", "water", "sewer", "electric", "electricity", "gas", "internet", "telecom", "communications", "services"]);
const ADDRESS_TOKEN_PATTERN = "(?:[a-z][a-z0-9.'-]*|\\d{1,4}(?:st|nd|rd|th))";
const ADDRESS_PATTERN = new RegExp(
  `\\b\\d{2,6}(?:-\\d{2,6})?\\s+(?:[nsew]\\s+)?${ADDRESS_TOKEN_PATTERN}(?:\\s+${ADDRESS_TOKEN_PATTERN}){0,4}\\s+(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|place|pl|boulevard|blvd|way)\\b`,
  "gi",
);

function normalizeTag(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeSearchText(value: unknown) {
  return normalizeTag(value)
    .replace(/[^a-z0-9# ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function spacedOcrWordPattern(word: string) {
  return new RegExp(`\\b${word.split("").map((letter) => escapeRegExp(letter)).join("\\s*")}\\b`, "gi");
}

function normalizeLooseOcrText(value: unknown) {
  let text = String(value || "");
  [
    "account",
    "activity",
    "amount",
    "auto",
    "balance",
    "billing",
    "by",
    "charges",
    "current",
    "date",
    "due",
    "from",
    "number",
    "pay",
    "period",
    "previous",
    "remaining",
    "service",
    "statement",
    "spectrum",
    "total",
    "january",
    "february",
    "march",
    "april",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
  ].forEach((word) => {
    text = text.replace(spacedOcrWordPattern(word), word);
  });
  return text.replace(/[ \t]{2,}/g, " ");
}

function textWords(value: unknown) {
  return normalizeSearchText(value)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !ENTITY_STOP_WORDS.has(word));
}

function normalizeUnitValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^unit\s*/i, "")
    .replace(/^apt\.?\s*/i, "")
    .replace(/^apartment\s*/i, "")
    .replace(/^suite\s*/i, "")
    .replace(/^#\s*/, "")
    .replace(/[^a-z0-9-]/g, "");
}

function escapeRegExp(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectKnownUnits(args: InferDocumentTagsArgs, propertyId = "") {
  const found = new Set<string>();
  const push = (value: unknown, itemPropertyId = "") => {
    if (propertyId && itemPropertyId && itemPropertyId !== propertyId) return;
    const unit = normalizeUnitValue(value);
    if (unit) found.add(unit);
  };

  push(args.document?.unit, String(args.document?.propertyId || ""));
  push(args.lease?.unit, String(args.lease?.propertyId || ""));
  push(args.transaction?.unit, String(args.transaction?.propertyId || ""));
  push(args.workOrder?.unit, String(args.workOrder?.propertyId || ""));

  (args.candidateUnits || []).forEach((candidateUnit) => push(candidateUnit?.name, String(candidateUnit?.propertyId || "")));
  (args.candidateLeases || []).forEach((candidateLease) => push(candidateLease?.unit, String(candidateLease?.propertyId || "")));
  (args.candidateTransactions || []).forEach((candidateTransaction) => push(candidateTransaction?.unit, String(candidateTransaction?.propertyId || "")));
  (args.candidateWorkOrders || []).forEach((candidateWorkOrder) => push(candidateWorkOrder?.unit, String(candidateWorkOrder?.propertyId || "")));

  return [...found];
}

function pickPreferredUnit(...values: unknown[]) {
  const units = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return units.find((unit) => normalizeUnitValue(unit) !== "shared") || units[0] || "";
}

function documentScopeOverride(document: InferDocumentTagsArgs["document"]) {
  if (!document?.unitScopeOverride) return "";
  return String(document.unit || "").trim();
}

function extractPossibleUnits(text: string, knownUnits: string[] = []) {
  const found = new Map<string, number>();
  const push = (value: unknown, score: number) => {
    const unit = normalizeUnitValue(value);
    if (!unit) return;
    const currentScore = found.get(unit) || 0;
    if (score > currentScore) {
      found.set(unit, score);
    }
  };
  const patterns = [
    /\bunit\s*#?\s*([a-z0-9-]{1,12})\b/gi,
    /\bapt\.?\s*#?\s*([a-z0-9-]{1,12})\b/gi,
    /\bapartment\s*#?\s*([a-z0-9-]{1,12})\b/gi,
    /\bsuite\s*#?\s*([a-z0-9-]{1,12})\b/gi,
    /(?:^|\s)#\s*([a-z0-9-]{1,12})(?=\b)/gi,
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const unit = normalizeUnitValue(match[1]);
      if (!unit) continue;
      push(unit, unit === "shared" ? 1 : 3);
    }
  });

  knownUnits
    .map((unit) => normalizeUnitValue(unit))
    .filter((unit, index, collection) => unit && collection.indexOf(unit) === index && unit !== "shared")
    .forEach((unit) => {
      const addressPattern = new RegExp(
        `\\b${escapeRegExp(unit)}\\b\\s+(?:[nsew]\\b\\s+)?[a-z][a-z0-9.'-]+(?:\\s+[a-z][a-z0-9.'-]+){0,3}\\s+(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|place|pl|boulevard|blvd|way)\\b`,
        "i",
      );
      if (addressPattern.test(text)) {
        push(unit, 4);
      }
    });

  return [...found.entries()]
    .sort((left, right) => {
      const scoreDelta = right[1] - left[1];
      if (scoreDelta !== 0) return scoreDelta;
      const sharedDelta = Number(left[0] === "shared") - Number(right[0] === "shared");
      if (sharedDelta !== 0) return sharedDelta;
      return left[0].localeCompare(right[0]);
    })
    .map(([unit]) => unit);
}

function pushSuggestion(suggestions: Map<string, Set<DocumentTagSuggestionSource>>, value: unknown, source: DocumentTagSuggestionSource) {
  const normalized = normalizeTag(value);
  if (!normalized) return;
  if (!suggestions.has(normalized)) suggestions.set(normalized, new Set());
  suggestions.get(normalized)?.add(source);
}

function pushUnitSuggestion(suggestions: Map<string, Set<DocumentTagSuggestionSource>>, value: unknown, source: DocumentTagSuggestionSource) {
  const unit = normalizeUnitValue(value);
  if (!unit) return;
  pushSuggestion(suggestions, `unit-${unit}`, source);
}

function pushKeywordSuggestions(
  suggestions: Map<string, Set<DocumentTagSuggestionSource>>,
  text: string,
  patterns: Array<[RegExp, string[]]>,
  source: DocumentTagSuggestionSource,
) {
  for (const [pattern, values] of patterns) {
    if (!pattern.test(text)) continue;
    values.forEach((value) => pushSuggestion(suggestions, value, source));
  }
}

function matchNamedEntity(text: string, value: unknown) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  if (text.includes(normalized)) return true;

  const compactText = compactSearchText(text);
  const compactValue = compactSearchText(value);
  if (compactValue.length >= 6 && compactText.includes(compactValue)) return true;

  const words = textWords(value);
  if (words.length >= 2) {
    return words.every((word) => text.includes(word));
  }

  return words.length === 1 ? words[0].length >= 6 && text.includes(words[0]) : false;
}

function matchVendorName(text: string, value: unknown) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  if (text.includes(normalized)) return true;

  const words = textWords(value);
  const distinctiveWords = words.filter((word) => !GENERIC_UTILITY_VENDOR_WORDS.has(word));
  if (words.length >= 2 && distinctiveWords.length <= 1 && distinctiveWords.length < words.length) {
    return false;
  }
  return matchNamedEntity(text, value);
}

function vendorMatchValues(vendor: InferDocumentTagsArgs["vendor"]) {
  if (!vendor) return [];
  return [
    String(vendor.name || "").trim(),
    ...(Array.isArray(vendor.aliases) ? vendor.aliases.map((alias) => String(alias || "").trim()) : []),
  ].filter(Boolean);
}

function findVendorMatchedValue(text: string, vendor: InferDocumentTagsArgs["vendor"]) {
  return vendorMatchValues(vendor).find((value) => matchVendorName(text, value)) || "";
}

function vendorHeaderSearchText(text: string) {
  const lines = normalizeExtractedDocumentText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLines: string[] = [];
  for (const line of lines.slice(0, 16)) {
    if (headerLines.length >= 8) break;
    if (/^\s*(?:invoice|receipt|statement|bill|estimate|page\s+\d+|account|date|due|total|amount|balance)\b/i.test(line)) continue;
    headerLines.push(line);
  }
  return normalizeSearchText(normalizeLooseOcrText(headerLines.join(" ")));
}

function scoreVendorCandidate(text: string, headerText: string, vendor: InferDocumentTagsArgs["vendor"]) {
  let bestScore = 0;
  let bestValue = "";
  vendorMatchValues(vendor).forEach((value) => {
    if (!matchVendorName(text, value)) return;
    const normalizedValue = normalizeSearchText(value);
    const compactText = compactSearchText(text);
    const compactValue = compactSearchText(value);
    const headerMatched = Boolean(headerText && matchVendorName(headerText, value));
    let score = overlapWordCount(text, value) + 2;
    if (normalizedValue && text.includes(normalizedValue)) score += 3;
    if (compactValue.length >= 6 && compactText.includes(compactValue)) score += 2;
    if (headerMatched) score += 4;
    if (GENERIC_UTILITY_VENDOR_WORDS.has(textWords(value).at(-1) || "") && !headerMatched && !text.includes(normalizedValue)) score -= 2;
    if (score > bestScore) {
      bestScore = score;
      bestValue = value;
    }
  });
  return { score: bestScore, matchedValue: bestValue };
}

function cleanOcrVendorLine(value: string) {
  return String(value || "")
    .replace(/\b(?:hi|hello|dear)\b[,:!]?.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9&'. -]+$/gi, "")
    .trim();
}

function looksLikeOcrVendorLine(value: string) {
  const line = cleanOcrVendorLine(value);
  if (!line) return false;
  const searchLine = normalizeSearchText(line);
  if (!/[a-z]/i.test(line)) return false;
  if (parseDateText(line) || pickAddressLine(line) || pickVendorPhone(line) || pickVendorEmail(line)) return false;
  if (/\$|(?:^|\s)-?\d+\.\d{2}\b/.test(line)) return false;
  if (/\b(?:invoice|receipt|statement|bill|estimate|account|acct|date|time|store|phone|tel|fax|cashier|register|terminal|auth|approval|subtotal|total|amount|balance|tax|visa|mastercard|discover|amex|debit|credit|card|change|qty|sku|upc|barcode|thank you)\b/i.test(line)) return false;
  if (/^\d+[\d\s#-]*$/.test(line)) return false;
  const words = searchLine.split(" ").filter(Boolean);
  return words.length >= 1 && words.length <= 6 && line.length >= 3 && line.length <= 60;
}

function pickOcrVendorName(text: string) {
  const lines = normalizeExtractedDocumentText(text)
    .split("\n")
    .map((line) => cleanOcrVendorLine(line))
    .filter(Boolean);
  const candidate = lines.slice(0, 12).find((line) => looksLikeOcrVendorLine(line));
  return candidate || "";
}

function isGenericUtilityVendorName(value: string) {
  return textWords(value).some((word) => GENERIC_UTILITY_VENDOR_WORDS.has(word));
}

function uniqueReasons(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function overlapWordCount(text: string, value: unknown) {
  const words = textWords(value);
  return words.filter((word) => text.includes(word)).length;
}

function normalizeAddressForMatch(value: unknown) {
  return normalizeSearchText(value)
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bplace\b/g, "pl")
    .replace(/\bapartment\b/g, "apt")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAddressNumberTokens(value: unknown) {
  const normalized = normalizeAddressForMatch(value);
  const found = new Set<string>();
  for (const match of normalized.matchAll(/\b(\d{2,6})(?:-(\d{2,6}))?\b/g)) {
    if (match[1]) found.add(match[1]);
    if (match[2]) found.add(match[2]);
  }
  return [...found];
}

function extractAddressStreetWords(value: unknown) {
  const ignored = new Set(["n", "s", "e", "w", "north", "south", "east", "west", "st", "ave", "dr", "rd", "ln", "ct", "pl", "blvd", "way"]);
  return normalizeAddressForMatch(value)
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !/^\d{2,6}(?:-\d{2,6})?$/.test(word))
    .filter((word) => !ignored.has(word));
}

function matchAddress(text: string, value: unknown) {
  const normalizedText = normalizeAddressForMatch(text);
  const normalized = normalizeAddressForMatch(value);
  if (!normalized) return false;
  if (normalizedText.includes(normalized)) return true;

  const numberTokens = extractAddressNumberTokens(normalized);
  const streetWords = extractAddressStreetWords(normalized);
  if (numberTokens.length === 0 || streetWords.length === 0) return false;
  if (!streetWords.slice(0, Math.min(2, streetWords.length)).every((word) => normalizedText.includes(word))) return false;
  return numberTokens.some((number) => normalizedText.includes(number));
}

function sortSuggestionSources(sources: Set<DocumentTagSuggestionSource>) {
  return [...sources].sort((left, right) => SUGGESTION_SOURCE_ORDER.indexOf(left) - SUGGESTION_SOURCE_ORDER.indexOf(right));
}

function pushLinkSuggestion(
  suggestions: Map<string, { suggestion: DocumentLinkSuggestion; score: number; sourceSet: Set<DocumentTagSuggestionSource> }>,
  suggestion: Omit<DocumentLinkSuggestion, "sources" | "confidence">,
  score: number,
  sources: DocumentTagSuggestionSource[],
) {
  if (score <= 0) return;
  const key = `${suggestion.kind}:${suggestion.id}`;
  const existing = suggestions.get(key);
  if (!existing || score > existing.score) {
    suggestions.set(key, {
      suggestion: { ...suggestion, confidence: score >= 5 ? "high" : "medium", sources: [] },
      score,
      sourceSet: new Set(sources),
    });
    return;
  }
  sources.forEach((source) => existing.sourceSet.add(source));
  existing.score = Math.max(existing.score, score);
  existing.suggestion.confidence = existing.score >= 5 ? "high" : "medium";
}

export function normalizeDocumentOcrStatus(status: unknown, extractedText: unknown = ""): DocumentOcrStatus {
  const normalized = String(status || "").trim().toLowerCase();
  const hasExtractedText = Boolean(String(extractedText || "").trim());
  if (hasExtractedText) return "completed";
  if (normalized === "pending") return "pending";
  return "not_needed";
}

export function documentNeedsTags(document: Pick<DocumentItem, "tags">) {
  return !Array.isArray(document.tags) || document.tags.length === 0;
}

export function documentNeedsIndexing(document: Pick<DocumentItem, "extractedText">) {
  return !String(document.extractedText || "").trim();
}

export function documentNeedsOcr(document: Pick<DocumentItem, "ocrStatus" | "extractedText">) {
  return normalizeDocumentOcrStatus(document.ocrStatus, document.extractedText) === "pending";
}

export function suggestDocumentType(name: unknown, mimeType: unknown = "") {
  const fileName = String(name || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();

  if (fileName.includes("lease")) return "Lease PDF";
  if (fileName.includes("invoice")) return "Invoice";
  if (fileName.includes("receipt")) return "Receipt";
  if (fileName.includes("inspection")) return "Inspection";
  if (fileName.includes("policy") || fileName.includes("insurance")) return "Policy";
  if (fileName.includes("tax")) return "Tax Bill";
  if (fileName.includes("estimate") || fileName.includes("bid")) return "Estimate";
  if (mime.startsWith("image/")) return "Scanned Image";
  return "Scanned PDF";
}

export function documentSupportsAutomaticOcr(name: unknown, mimeType: unknown = "") {
  const fileName = String(name || "").trim().toLowerCase();
  const mime = String(mimeType || "").trim().toLowerCase();

  if (mime === "application/pdf") return true;
  if (mime.startsWith("image/")) {
    return /^(image\/(png|jpe?g|bmp|gif|tiff?|webp))$/.test(mime);
  }

  return /\.(pdf|png|jpe?g|bmp|gif|tiff?|webp)$/i.test(fileName);
}

export function normalizeExtractedDocumentText(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u000c/g, "\n")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/(\d{1,2}\s*[\/-]\s*\d{1,2})\s+[\/-]\s*(\d{2,4})/g, "$1/$2")
    .replace(/(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{2,4})/g, "$1/$2/$3")
    .replace(/\b(page\s+\d+\s+of\s+\d+)\b/gi, "\n$1\n")
    .replace(/\b(total\s+for\s*:?\s*\d{2,6}(?:-\d{2,6})?(?:\s+[nsew])?(?:\s+[a-z0-9.'-]+){1,6}\s+(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|place|pl|boulevard|blvd|way))\b/gi, "\n$1\n")
    .replace(/\b(account\s*(?:#|number)?\s*:?\s*[0-9-]{4,})\b/gi, "\n$1\n")
    .replace(/\b(billing\s+date\s*:?\s*\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{2,4})\b/gi, "\n$1\n")
    .replace(/\b(amount\s+due\s*\$?\s*[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\b/gi, "\n$1\n")
    .replace(/\b(charge(?:\s+-?\d+\.\d{2,3}){2,20})\b/gi, "\n$1\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseCurrencyAmount(value: string) {
  const normalized = String(value || "").replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 100) / 100;
}

function pickBestExpenseAmount(text: string) {
  const normalizedText = normalizeLooseOcrText(text);
  const candidates: Array<{ amount: number; score: number }> = [];
  const receiptAmount = pickReceiptPaymentAmount(normalizedText);
  const looksReceiptLike = /\b(?:receipt|visa|mastercard|master card|discover|amex|debit|credit|card|tender|cashier|register|terminal|approval)\b/i.test(normalizedText);
  if (looksReceiptLike && receiptAmount != null) return receiptAmount;

  const labeledPatterns = [
    /\b(?:invoice total|grand total|total due|amount due|balance due|payment due|total amount|amount paid|amount)\b\s*[:#-]?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/gi,
    /\b(?:remit amount|total sale|total)\b\s*[:#-]?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/gi,
  ];

  labeledPatterns.forEach((pattern, index) => {
    for (const match of normalizedText.matchAll(pattern)) {
      const amount = parseCurrencyAmount(match[1]);
      if (amount == null) continue;
      candidates.push({ amount, score: index === 0 ? 4 : 3 });
    }
  });

  if (candidates.length > 0) {
    return candidates.sort((left, right) => right.score - left.score || right.amount - left.amount)[0]?.amount;
  }

  if (receiptAmount != null) return receiptAmount;

  const genericAmounts = [...normalizedText.matchAll(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/g)]
    .map((match) => parseCurrencyAmount(match[1]))
    .filter((amount): amount is number => amount != null && amount <= 999999.99);

  if (genericAmounts.length === 0) return undefined;
  return genericAmounts.sort((left, right) => right - left)[0];
}

function parseReceiptLineAmount(value: string) {
  if (/-\s*(?:\$|\busd\b)?\s*[0-9]/i.test(String(value || ""))) return undefined;
  const match = String(value || "").match(/(?:\$|\busd\b)?\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]{1,4})\b(?!\s*%)/i);
  if (!match) return undefined;
  const amount = parseCurrencyAmount(match[1]);
  if (amount == null || amount > 20000) return undefined;
  return amount;
}

function pickReceiptPaymentAmount(text: string) {
  const lines = normalizeExtractedDocumentText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: Array<{ amount: number; score: number; lineIndex: number }> = [];
  const paymentLabel = /\b(?:total|sale|amount|balance|visa|mastercard|master card|discover|amex|debit|credit|card|tender|paid|charge)\b/i;
  const rejectLabel = /\b(?:subtotal|sub total|tax|change|cash back|savings|discount|coupon|points|rewards|qty|item|sku|upc|phone|auth|approval)\b/i;

  lines.forEach((line, lineIndex) => {
    if (!paymentLabel.test(line) || rejectLabel.test(line)) return;
    const amount = parseReceiptLineAmount(line);
    if (amount == null) return;
    const lowerLine = line.toLowerCase();
    let score = 2;
    if (/\b(?:total|amount|balance)\b/.test(lowerLine)) score += 2;
    if (/\b(?:visa|mastercard|master card|discover|amex|debit|credit|card|paid|tender|sale)\b/.test(lowerLine)) score += 1;
    if (lineIndex > lines.length * 0.45) score += 1;
    candidates.push({ amount, score, lineIndex });
  });

  if (candidates.length > 0) {
    return candidates.sort((left, right) => right.score - left.score || right.lineIndex - left.lineIndex || right.amount - left.amount)[0]?.amount;
  }

  const tailLines = lines.slice(Math.max(0, Math.floor(lines.length * 0.55)));
  const tailAmounts = tailLines
    .map((line, lineIndex) => {
      if (rejectLabel.test(line)) return null;
      const amount = parseReceiptLineAmount(line);
      return amount == null ? null : { amount, lineIndex };
    })
    .filter((item): item is { amount: number; lineIndex: number } => Boolean(item));
  return tailAmounts.length > 0 ? tailAmounts.sort((left, right) => right.lineIndex - left.lineIndex)[0]?.amount : undefined;
}

function normalizeYear(year: string) {
  if (year.length === 2) {
    const numericYear = Number.parseInt(year, 10);
    return String(numericYear >= 70 ? 1900 + numericYear : 2000 + numericYear);
  }
  return year;
}

function toIsoDate(year: string, month: string, day: string) {
  const numericYear = Number.parseInt(normalizeYear(year), 10);
  const numericMonth = Number.parseInt(month, 10);
  const numericDay = Number.parseInt(day, 10);
  if (!Number.isFinite(numericYear) || !Number.isFinite(numericMonth) || !Number.isFinite(numericDay)) return "";
  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) return "";
  return `${String(numericYear).padStart(4, "0")}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`;
}

function parseDateText(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return toIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);

  const slashMatch = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (slashMatch) return toIsoDate(slashMatch[3], slashMatch[1], slashMatch[2]);

  const compactNumericMatch = raw.match(/\b(\d{1,2})(\d{2})(\d{4})\b/);
  if (compactNumericMatch) return toIsoDate(compactNumericMatch[3], compactNumericMatch[1], compactNumericMatch[2]);

  const monthMap: Record<string, string> = {
    january: "01", jan: "01",
    february: "02", feb: "02",
    march: "03", mar: "03",
    april: "04", apr: "04",
    may: "05",
    june: "06", jun: "06",
    july: "07", jul: "07",
    august: "08", aug: "08",
    september: "09", sep: "09", sept: "09",
    october: "10", oct: "10",
    november: "11", nov: "11",
    december: "12", dec: "12",
  };
  const namedMonthMatch = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (namedMonthMatch) {
    const month = monthMap[namedMonthMatch[1].toLowerCase()] || "";
    return toIsoDate(namedMonthMatch[3], month, namedMonthMatch[2]);
  }

  return "";
}

function pickContextYear(text: string) {
  const namedYearMatch = String(text || "").match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+(\d{4})\b/i);
  if (namedYearMatch) return namedYearMatch[1];
  const numericYearMatch = String(text || "").match(/\b\d{1,2}[\/-]\d{1,2}[\/-](\d{4})\b/);
  if (numericYearMatch) return numericYearMatch[1];
  const isoYearMatch = String(text || "").match(/\b(\d{4})-\d{2}-\d{2}\b/);
  return isoYearMatch?.[1] || "";
}

function isoDateDayDiff(left: string, right: string) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const leftTime = Date.parse(`${left.slice(0, 10)}T00:00:00Z`);
  const rightTime = Date.parse(`${right.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86400000));
}

function isMeterReadDateLine(value: string) {
  return /\b(?:next\s+meter\s+read|next\s+read|meter\s+read|read\s+date|previous\s+read|current\s+read)\b/i.test(String(value || ""));
}

function pickFirstNonMeterReadDateLine(text: string) {
  const lines = normalizeLooseOcrText(text).split(/\r?\n/);
  const datePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi,
  ];

  for (const line of lines) {
    if (isMeterReadDateLine(line)) continue;
    for (const pattern of datePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      const parsed = parseDateText(match?.[0] || "");
      if (parsed) return parsed;
    }
  }

  return "";
}

function pickBestExpenseDate(text: string) {
  const labeledPatterns = [
    /\b(?:bill(?:ing)? date|invoice date|statement date|transaction date|purchase date|receipt date|order date|date issued|issued on|completed on)\b\s*[:#-]?\s*([^\n]+)/i,
    /\b(?:due date|payment due|pay by|due on|balance due by)\b\s*[:#-]?\s*([^\n]+)/i,
    /\b(?:service date|date of service|service performed|completed on|performed on)\b\s*[:#-]?\s*([^\n]+)/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    const parsed = parseDateText(match?.[1] || "");
    if (parsed) return parsed;
  }

  return pickFirstNonMeterReadDateLine(text);
}

function pickLabeledDate(text: string, labelPattern: RegExp) {
  const match = normalizeLooseOcrText(text).match(labelPattern);
  return parseDateText(match?.[1] || "");
}

function pickMeterReadServicePeriod(text: string) {
  const datePattern = String.raw`((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{8})|(?:\d{4}-\d{2}-\d{2}))`;
  const previousReadDate = pickLabeledDate(text, new RegExp(String.raw`\bprevious read\b[\s\S]{0,80}?${datePattern}`, "i"));
  const currentReadDate = pickLabeledDate(text, new RegExp(String.raw`\bcurrent read\b[\s\S]{0,80}?${datePattern}`, "i"));
  if (previousReadDate && currentReadDate && currentReadDate >= previousReadDate) {
    return { startDate: previousReadDate, endDate: currentReadDate };
  }
  return { startDate: "", endDate: "" };
}

function pickServicePeriod(text: string) {
  const normalizedText = normalizeLooseOcrText(text);
  const patterns = [
    /\b(?:bill(?:ing)?|service|usage)\s*period\b[^a-z0-9]{0,10}([^\n]+?)\s*(?:to|through|thru|-)\s*([^\n]+)/i,
    /\bfrom\s+((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:[a-z]{3,9}\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2}))\s*(?:to|through|thru|-)\s*((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:[a-z]{3,9}\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2}))/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const startDate = parseDateText(match?.[1] || "");
    const endDate = parseDateText(match?.[2] || "");
    if (startDate && endDate && endDate >= startDate) {
      return { startDate, endDate };
    }
  }

  const shortNamedMonthMatch = normalizedText.match(/\b(?:bill(?:ing)?\s+period|service\s+period|usage\s+period|service\s+from|from)\b\s*[:#-]?\s*([a-z]{3,9}\s+\d{1,2})\s*(?:to|through|thru|-)\s*([a-z]{3,9}\s+\d{1,2})\b/i);
  if (shortNamedMonthMatch) {
    const year = pickContextYear(normalizedText);
    const startDate = year ? parseDateText(`${shortNamedMonthMatch[1]}, ${year}`) : "";
    let endDate = year ? parseDateText(`${shortNamedMonthMatch[2]}, ${year}`) : "";
    if (startDate && endDate && endDate < startDate) {
      const nextYear = String(Number.parseInt(year, 10) + 1);
      endDate = parseDateText(`${shortNamedMonthMatch[2]}, ${nextYear}`);
    }
    if (startDate && endDate && endDate >= startDate) {
      return { startDate, endDate };
    }
  }

  const meterReadPeriod = pickMeterReadServicePeriod(normalizedText);
  if (meterReadPeriod.startDate && meterReadPeriod.endDate) {
    return meterReadPeriod;
  }

  return { startDate: "", endDate: "" };
}

function pickLabeledAmount(text: string, labelPattern: RegExp) {
  const match = normalizeLooseOcrText(text).match(labelPattern);
  return parseCurrencyAmount(match?.[1] || "");
}

function pickTrailingUtilitySectionAmount(text: string) {
  const matches = [...String(text || "").matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/g)]
    .map((match) => parseCurrencyAmount(match[1]))
    .filter((amount): amount is number => amount != null && amount <= 999999.99);
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}

function pickTotalForSectionAmount(text: string, address: string) {
  const normalizedAddress = normalizeAddressForMatch(address);
  if (!normalizedAddress) return undefined;
  const addressPattern = normalizedAddress
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => escapeRegExp(token))
    .join("\\W+");
  const rawText = String(text || "");
  const anchorMatch = rawText.match(new RegExp(`total\\W+for\\W*:??\\W*${addressPattern}`, "i"));
  if (!anchorMatch || typeof anchorMatch.index !== "number") return undefined;
  const tail = rawText.slice(Math.max(0, anchorMatch.index), Math.min(rawText.length, anchorMatch.index + 1200));
  const chargeRuns = [...tail.matchAll(/\bcharge\b((?:\s+-?\d+\.\d{2,3}){2,16})/gi)];
  for (let index = chargeRuns.length - 1; index >= 0; index -= 1) {
    const values = [...String(chargeRuns[index]?.[1] || "").matchAll(/-?\d+\.\d{2,3}\b/g)]
      .map((match) => parseCurrencyAmount(match[0]))
      .filter((amount): amount is number => amount != null && amount > 0);
    if (values.length > 0) {
      return values.sort((left, right) => right - left)[0];
    }
  }
  const chargeBlock = tail.match(/\bcharge\b([\s\S]{0,220}?)(?:usage history|page\s+\d+\s+of\s+\d+|total for:|keep this portion|$)/i);
  const fallbackValues = [...String(chargeBlock?.[1] || tail).matchAll(/-?\d+\.\d{2}\b/g)]
    .map((match) => parseCurrencyAmount(match[0]))
    .filter((amount): amount is number => amount != null && amount > 0);
  if (fallbackValues.length === 0) return undefined;
  return fallbackValues.sort((left, right) => right - left)[0];
}

function pickInvoiceReference(text: string) {
  const patterns = [
    /\b(?:invoice|inv)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([a-z0-9][a-z0-9 -]{2,40})\b/i,
    /\b(?:receipt|transaction|trans|order|reference|ref)\s*(?:no\.?|number|#|id)?\s*[:#-]?\s*([a-z0-9][a-z0-9 -]{2,40})\b/i,
    /\b(?:account|acct\.?)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([a-z0-9][a-z0-9 -]{2,40})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = normalizeReferenceValue(match?.[1] || "");
    if (value) return value;
  }
  return "";
}

function normalizeReferenceValue(value: string) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\b(?:invoice|receipt|statement|date|due|amount|total|service|address)\b.*$/i, "")
    .replace(/[^a-z0-9 -]/gi, "")
    .trim();
  if (!cleaned || !/\d/.test(cleaned) || parseDateText(cleaned)) return "";
  return cleaned.length > 32 ? cleaned.slice(0, 32).trim() : cleaned;
}

function normalizePhoneNumber(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(value || "").trim();
}

function pickVendorEmail(text: string) {
  const match = text.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
  return String(match?.[1] || "").trim();
}

function pickVendorPhone(text: string) {
  const match = text.match(/(?:\+?1[\s.-]*)?(?:\(?(\d{3})\)?[\s.-]*)?(\d{3})[\s.-]*(\d{4})/);
  if (!match) return "";
  const joined = `${match[1] || ""}${match[2] || ""}${match[3] || ""}`;
  return normalizePhoneNumber(joined);
}

function pickAddressLine(text: string) {
  const match = text.match(new RegExp(ADDRESS_PATTERN.source, "i"));
  return String(match?.[0] || "").trim();
}

function looksLikeUtilityOfficeAnchorContext(text: string, index: number) {
  const context = normalizeSearchText(String(text || "").slice(Math.max(0, index - 80), Math.min(String(text || "").length, index + 140)));
  if (!context) return false;
  return (
    context.includes("for payments") ||
    context.includes("for questions") ||
    context.includes("office hours") ||
    context.includes("return this portion") ||
    context.includes("amount enclosed") ||
    context.includes("quick pay option") ||
    context.includes("keep this top portion for your records") ||
    context.includes("please share any changes above")
  );
}

function findAddressAnchors(text: string) {
  const found: Array<{ address: string; index: number }> = [];
  for (const match of text.matchAll(new RegExp(ADDRESS_PATTERN.source, "gi"))) {
    const address = String(match[0] || "").trim();
    const index = match.index || 0;
    if (!address) continue;
    if (looksLikeUtilityOfficeAnchorContext(text, match.index || 0)) continue;
    const duplicateNearby = found.some(
      (existing) => normalizeSearchText(existing.address) === normalizeSearchText(address) && Math.abs(existing.index - index) < 80,
    );
    if (duplicateNearby) continue;
    found.push({ address, index });
  }
  return found
    .sort((left, right) => left.index - right.index)
    .filter((anchor, index, anchors) => {
      const previousAnchor = anchors[index - 1];
      if (!previousAnchor) return true;
      if (anchor.index - previousAnchor.index > 80) return true;
      const leadingText = normalizeSearchText(String(text || "").slice(Math.max(0, anchor.index - 80), anchor.index));
      const localContext = normalizeSearchText(String(text || "").slice(anchor.index, Math.min(String(text || "").length, anchor.index + 140)));
      const looksLikeTrailingRecipientLine =
        leadingText.includes("total for") &&
        !localContext.includes("page") &&
        !localContext.includes("account") &&
        !localContext.includes("billing date") &&
        !localContext.includes("amount due") &&
        !localContext.includes("current charges") &&
        !localContext.includes("total for");
      return !looksLikeTrailingRecipientLine;
    });
}

function pickUtilityHeaderContext(text: string, index: number, previousIndex = 0) {
  const rawText = String(text || "");
  const windowStart = Math.max(0, previousIndex, index - 260);
  const windowEnd = Math.min(rawText.length, index + 90);
  const windowText = rawText.slice(windowStart, windowEnd);
  const pageAnchors = [...windowText.matchAll(/page\s+\d+\s+of\s+\d+/gi)];
  const lastPageAnchor = pageAnchors[pageAnchors.length - 1];
  if (lastPageAnchor && typeof lastPageAnchor.index === "number") {
    return windowText.slice(lastPageAnchor.index);
  }
  return rawText.slice(Math.max(windowStart, index - 90), windowEnd);
}

function pickAccountReference(text: string) {
  const match = text.match(/\b(?:account|acct\.?)\s*(?:#|number)?\s*[:#-]?\s*([0-9-]{4,})\b/i);
  return String(match?.[1] || "").trim();
}

function inferSectionProperty(
  text: string,
  address: string,
  property: InferDocumentTagsArgs["property"],
  candidateProperties: InferDocumentTagsArgs["candidateProperties"] = [],
) {
  const searchText = normalizeSearchText(`${address}\n${text}`);
  if (property?.address && matchAddress(searchText, property.address)) return property;
  return candidateProperties.find((candidateProperty) => candidateProperty?.address && matchAddress(searchText, candidateProperty.address)) || null;
}

function inferSectionUnit(args: InferDocumentTagsArgs, text: string, address: string, propertyId = "") {
  const knownUnits = collectKnownUnits(args, propertyId);
  const detectedUnits = extractPossibleUnits(`${address}\n${text}`, knownUnits);
  const addressText = normalizeSearchText(address);
  const explicitAddressUnits = knownUnits.filter((unit) => addressText.includes(normalizeSearchText(unit)));
  if (explicitAddressUnits.length >= 2) return "Shared";
  return pickPreferredUnit(explicitAddressUnits[0], detectedUnits[0], args.document.unit) || "Shared";
}

function looksUtilityDocument(text: string) {
  const normalizedText = normalizeLooseOcrText(text);
  return /\butilit(?:y|ies)\b|\bwater\b|\bsewer\b|\belectric\b|\belectricity\b|\bgas\b|\bamount due\b|\bbill(?:ing)? statement\b|\bspectrum\b/.test(normalizedText);
}

function utilitySectionHasSignal(section: DocumentUtilitySection) {
  return Boolean(
    section.propertyId ||
    section.amount != null ||
    section.date ||
    section.servicePeriodStart ||
    section.servicePeriodEnd ||
    section.accountRef
  );
}

function utilitySectionHasBoundarySignal(section: DocumentUtilitySection) {
  return Boolean(section.date || section.accountRef || section.servicePeriodStart || section.servicePeriodEnd);
}

export function inferDocumentUtilitySections(args: InferDocumentTagsArgs): DocumentUtilitySection[] {
  const { document, property, candidateProperties = [], candidateVendors = [] } = args;
  const extractedText = normalizeExtractedDocumentText(document.extractedText);
  const combinedText = `${document.name || ""}\n${document.type || ""}\n${extractedText}`.toLowerCase();
  if (!extractedText || !looksUtilityDocument(combinedText)) return [];

  const addressAnchors = findAddressAnchors(extractedText);
  if (addressAnchors.length === 0) return [];

  const extractedSearchText = normalizeSearchText(normalizeLooseOcrText(extractedText));
  const { vendorName, matchedVendorId } = inferVendorContext({
    extractedSearchText,
    extractedText,
    vendor: args.vendor,
    transaction: args.transaction,
    candidateVendors,
  });

  const sections: Array<DocumentUtilitySection & { __sortScore?: number }> = addressAnchors.map((anchor, index) => {
    const previousAnchor = addressAnchors[index - 1];
    const nextAnchor = addressAnchors[index + 1];
    const sectionStart = previousAnchor ? Math.max(0, Math.floor((previousAnchor.index + anchor.index) / 2)) : Math.max(0, anchor.index - 220);
    const sectionEnd = nextAnchor ? Math.min(extractedText.length, nextAnchor.index) : Math.min(extractedText.length, anchor.index + 1600);
    const sectionText = extractedText.slice(sectionStart, sectionEnd);
    const matchedProperty = inferSectionProperty(sectionText, anchor.address, property, candidateProperties);
    const propertyId = String(matchedProperty?.id || "").trim() || undefined;
    const servicePeriod = pickServicePeriod(sectionText);
    const totalForAmount = pickTotalForSectionAmount(sectionText, anchor.address);
    const amount =
      totalForAmount ??
      pickLabeledAmount(sectionText, /\b(?:amount due|current charges|total amount|total due|balance due)\b\s*[:#-]?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/i) ??
      pickBestExpenseAmount(sectionText) ??
      pickTrailingUtilitySectionAmount(sectionText);
    const headerContext = pickUtilityHeaderContext(extractedText, anchor.index, previousAnchor?.index || 0);
    const date =
      pickLabeledDate(sectionText, /\b(?:bill(?:ing)? date|statement date|invoice date|date issued)\b\s*[:#-]?\s*([^\n]+)/i) ||
      pickLabeledDate(headerContext, /\b(?:bill(?:ing)? date|statement date|invoice date|date issued)\b\s*[:#-]?\s*([^\n]+)/i) ||
      pickBestExpenseDate(sectionText);
    const accountRef = pickAccountReference(sectionText) || pickAccountReference(headerContext);
    const unit = inferSectionUnit(args, sectionText, anchor.address, propertyId);
    const reasons = uniqueReasons([
      propertyId ? `Property matched from service address ${anchor.address}.` : `Address ${anchor.address} is outside saved properties.`,
      vendorName ? `Vendor matched saved vendor ${vendorName}.` : "Vendor treated as a utility bill from OCR context.",
      amount != null ? `Amount selected from the utility section near ${anchor.address}.` : "",
      date ? "Bill date selected from the utility section or nearby header." : "",
      servicePeriod.startDate && servicePeriod.endDate ? "Service period selected from the utility section text." : "",
      accountRef ? "Account reference selected from the utility section or nearby header." : "",
      unit ? `Unit scope resolved as ${unit}.` : "",
    ]);
    const confidenceScore =
      (propertyId ? 2 : 0) +
      (amount != null ? 2 : 0) +
      (date ? 1 : 0) +
      (servicePeriod.startDate && servicePeriod.endDate ? 1 : 0) +
      (totalForAmount != null ? 2 : 0);
    return {
      key: `${normalizeSearchText(anchor.address)}:${accountRef || ""}`,
      address: anchor.address,
      propertyId,
      propertyLabel: matchedProperty?.name || undefined,
      unit,
      vendor: vendorName || "Utility bill",
      category: "Utilities",
      description: `${vendorName || "Utility"} utilities`,
      amount,
      date: date || undefined,
      invoiceRef: "",
      servicePeriodStart: servicePeriod.startDate || undefined,
      servicePeriodEnd: servicePeriod.endDate || undefined,
      accountRef: accountRef || undefined,
      confidence: confidenceScore >= 4 ? "high" : "medium",
      sources: propertyId || matchedVendorId ? ["ocr", "ocr_match"] : ["ocr"],
      reasons,
      external: !propertyId,
      __sortScore: confidenceScore + (totalForAmount != null ? 3 : 0),
    };
  });

  const deduped = Array.from(
    sections.reduce((map, section) => {
      const existing = map.get(section.key);
      if (!existing || Number(section.__sortScore || 0) >= Number(existing.__sortScore || 0)) {
        map.set(section.key, section);
      }
      return map;
    }, new Map<string, DocumentUtilitySection & { __sortScore?: number }>() ).values(),
  );

  return deduped
    .filter((section) => !section.external || utilitySectionHasSignal(section))
    .filter((section, _, collection) => {
      if (section.external || utilitySectionHasBoundarySignal(section)) return true;
      const sectionStreetWords = extractAddressStreetWords(section.address);
      if (sectionStreetWords.length === 0) return true;
      const shadowedByNeighbor = collection.some((candidate) => {
        if (candidate === section) return false;
        if (candidate.external || candidate.propertyId !== section.propertyId) return false;
        if (!utilitySectionHasBoundarySignal(candidate)) return false;
        const candidateStreetWords = extractAddressStreetWords(candidate.address);
        if (candidateStreetWords.length === 0) return false;
        return sectionStreetWords.every((word) => candidateStreetWords.includes(word));
      });
      return !shadowedByNeighbor;
    })
    .map(({ __sortScore, ...section }) => section);
}

function pickServiceSummary(text: string, vendorName = "") {
  const lines = normalizeExtractedDocumentText(text)
    .split("\n")
    .map((line) => sanitizeWorkOrderLine(line, vendorName))
    .filter(Boolean)
    .filter((line) => !/\b(invoice|receipt|estimate|proposal|quote|bill)\b/i.test(line))
    .filter((line) => !/\b(total due|amount due|balance due|payment due|subtotal|tax)\b/i.test(line))
    .filter((line) => !/\b(?:billing|service|usage)\s+period\b/i.test(line))
    .filter((line) => !parseDateText(line))
    .filter((line) => !pickAddressLine(line));

  const candidate =
    lines.find((line) => /\b(repair|replace|replacement|service|install|inspection|issue|problem|leak|clog|backup|maintenance|clean|turnover)\b/i.test(line)) ||
    lines.find((line) => line.split(" ").length >= 3 && line.split(" ").length <= 12) ||
    "";

  return candidate || "";
}

function inferExpenseCategory(text: string, vendorDefaultCategory: unknown = "", workOrder: InferDocumentTagsArgs["workOrder"] = null) {
  const normalizedDefault = String(vendorDefaultCategory || "").trim();
  if (normalizedDefault) return normalizedDefault;
  if (workOrder) return "Repairs";
  if (/\bproperty tax\b|\bassessor\b|\bcounty tax\b|\btax bill\b/.test(text)) return "Taxes";
  if (/\binsurance\b|\bpremium\b|\bpolicy\b|\bcoverage\b/.test(text)) return "Insurance";
  if (/\butility\b|\bwater\b|\bsewer\b|\belectric\b|\belectricity\b|\bgas service\b|\btrash\b|\brecycling\b/.test(text)) return "Utilities";
  if (/\blegal\b|\battorney\b|\bcpa\b|\baccounting\b|\bbookkeeping\b/.test(text)) return "Legal and other professional fees";
  if (/\bmanagement fee\b|\bproperty management\b/.test(text)) return "Management fees";
  if (/\badvertising\b|\bmarketing\b|\blisting\b/.test(text)) return "Advertising";
  if (/\bcleaning\b|\bjanitorial\b|\bturnover clean\b/.test(text)) return "Cleaning and maintenance";
  if (/\bsuppl(?:y|ies)\b|\bmaterials?\b|\bfilter\b|\bpaint\b/.test(text)) return "Supplies";
  if (/\binterest\b|\bfinance charge\b|\blate charge\b/.test(text)) return "Other interest";
  if (/\bcommission\b/.test(text)) return "Commissions";
  if (/\bplumb(?:ing)?\b|\belectrical\b|\bhvac\b|\bleak\b|\brepair\b|\bmaintenance\b|\bwork order\b|\brooter\b/.test(text)) return "Repairs";
  return "Other expenses";
}

function buildExpenseDescription(args: {
  category: string;
  vendorName: string;
  documentType: string;
  workOrder?: InferDocumentTagsArgs["workOrder"];
  invoiceRef?: string;
}) {
  const category = String(args.category || "Expense");
  const vendorName = String(args.vendorName || "").trim();
  const documentType = String(args.documentType || "").trim().toLowerCase();
  const invoiceRef = String(args.invoiceRef || "").trim();

  if (args.workOrder?.title) return `Work order: ${args.workOrder.title}`;
  if (documentType.includes("estimate")) return vendorName ? `${vendorName} estimate` : "Estimate";
  if (documentType.includes("receipt")) return vendorName ? `${vendorName} receipt` : "Receipt";
  if (documentType.includes("invoice")) {
    if (vendorName && invoiceRef) return `${vendorName} invoice ${invoiceRef}`;
    if (vendorName) return `${vendorName} invoice`;
    if (invoiceRef) return `Invoice ${invoiceRef}`;
    return "Invoice";
  }
  if (vendorName) return `${vendorName} ${category.toLowerCase()}`;
  return category;
}

function inferVendorContext(args: {
  extractedSearchText: string;
  extractedText?: string;
  vendor?: InferDocumentTagsArgs["vendor"];
  transaction?: InferDocumentTagsArgs["transaction"];
  candidateVendors?: InferDocumentTagsArgs["candidateVendors"];
}) {
  let vendorName = String(args.vendor?.name || args.transaction?.vendor || "").trim();
  let vendorDefaultCategory = String(args.vendor?.defaultCategory || "").trim();
  let vendorSource: DocumentTagSuggestionSource = vendorName ? "context" : "ocr";
  let matchedVendorId = String(args.vendor?.id || "").trim();
  let matchedVendorScore = matchedVendorId ? 2 : 0;
  const headerText = vendorHeaderSearchText(args.extractedText || args.extractedSearchText);

  if (args.extractedSearchText) {
    (args.candidateVendors || []).forEach((candidateVendor) => {
      if (!candidateVendor?.name) return;
      const { matchedValue, score } = scoreVendorCandidate(args.extractedSearchText, headerText, candidateVendor);
      if (!matchedValue) return;
      if (score <= matchedVendorScore) return;
      matchedVendorScore = score;
      matchedVendorId = String(candidateVendor.id || "");
      vendorName = candidateVendor.name;
      vendorDefaultCategory = String(candidateVendor.defaultCategory || "");
      vendorSource = "ocr_match";
    });
  }

  const ocrVendorName = pickOcrVendorName(args.extractedText || "");
  if (ocrVendorName && (!vendorName || (isGenericUtilityVendorName(vendorName) && !matchVendorName(ocrVendorName, vendorName)))) {
    vendorName = ocrVendorName;
    vendorSource = "ocr";
    matchedVendorId = "";
  }

  return {
    vendorName,
    vendorDefaultCategory,
    vendorSource,
    matchedVendorId,
    vendorPhone: String(args.vendor?.phone || "").trim(),
    vendorEmail: String(args.vendor?.email || "").trim(),
  };
}

export function inferDocumentExtractedFields(args: InferDocumentTagsArgs): DocumentExtractedFields | null {
  const { document, property, lease, transaction, workOrder, vendor, candidateVendors = [] } = args;
  const extractedText = normalizeExtractedDocumentText(document.extractedText);
  if (!extractedText) return null;
  const propertyId =
    String(workOrder?.propertyId || transaction?.propertyId || lease?.propertyId || property?.id || document.propertyId || "").trim() || undefined;
  const knownUnits = collectKnownUnits(args, propertyId);

  const extractedSearchText = normalizeSearchText(normalizeLooseOcrText(extractedText));
  const {
    vendorName,
    vendorSource,
    matchedVendorId,
    vendorPhone: contextualVendorPhone,
    vendorEmail: contextualVendorEmail,
  } = inferVendorContext({
    extractedSearchText,
    extractedText,
    vendor,
    transaction,
    candidateVendors,
  });

  const genericDate = pickBestExpenseDate(extractedText);
  const invoiceDate =
    pickLabeledDate(extractedText, /\b(?:bill(?:ing)? date|invoice date|statement date|transaction date|purchase date|receipt date|order date|date issued|issued on)\b\s*[:#-]?\s*([^\n]+)/i) ||
    genericDate ||
    "";
  const serviceDate =
    pickLabeledDate(extractedText, /\b(?:service date|date of service|service performed|completed on|performed on)\b\s*[:#-]?\s*([^\n]+)/i) ||
    "";
  const dueDate =
    pickLabeledDate(extractedText, /\b(?:due date|payment due|pay by|due on|balance due by)\b\s*[:#-]?\s*([^\n]+)/i) ||
    "";
  const servicePeriod = pickServicePeriod(extractedText);
  const subtotal =
    pickLabeledAmount(extractedText, /\b(?:subtotal|sub total|sub-total)\b\s*[:#-]?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/i);
  const taxAmount =
    pickLabeledAmount(extractedText, /\b(?:sales tax|tax)\b\s*[:#-]?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/i);
  const totalAmount = pickBestExpenseAmount(extractedText);
  const invoiceRef = pickInvoiceReference(extractedText) || String(transaction?.invoiceRef || "").trim();
  const detectedUnits = extractPossibleUnits(extractedText, knownUnits);
  const manualDocumentUnit = documentScopeOverride(document);
  const explicitDocumentUnit = normalizeUnitValue(document.unit) !== "shared" ? String(document.unit || "").trim() : "";
  const unit = manualDocumentUnit || pickPreferredUnit(workOrder?.unit, transaction?.unit, lease?.unit, explicitDocumentUnit, detectedUnits[0], document.unit) || undefined;
  const propertyAddress =
    (property?.address && matchAddress(extractedSearchText, property.address) ? String(property.address).trim() : "") ||
    pickAddressLine(extractedText);
  const vendorEmail = pickVendorEmail(extractedText) || contextualVendorEmail;
  const vendorPhone = pickVendorPhone(extractedText) || contextualVendorPhone;
  const serviceSummary = pickServiceSummary(extractedText, vendorName);
  const overrides = document.ocrFieldOverrides || {};
  const correctedVendorName = String(overrides.vendorName || "").trim();
  const correctedTotalAmount = Number(overrides.totalAmount);
  const correctedServicePeriodStart = String(overrides.servicePeriodStart || "").trim();
  const correctedServicePeriodEnd = String(overrides.servicePeriodEnd || "").trim();
  const resolvedVendorName = correctedVendorName || vendorName;
  const resolvedTotalAmount = Number.isFinite(correctedTotalAmount) && correctedTotalAmount >= 0 ? correctedTotalAmount : totalAmount;
  const resolvedServicePeriodStart = correctedServicePeriodStart || servicePeriod.startDate;
  const resolvedServicePeriodEnd = correctedServicePeriodEnd || servicePeriod.endDate;

  const score =
    (resolvedVendorName ? 2 : 0) +
    (invoiceRef ? 1 : 0) +
    ((invoiceDate || serviceDate || dueDate) ? 2 : 0) +
    ((subtotal != null || taxAmount != null || resolvedTotalAmount != null) ? 2 : 0) +
    (propertyId || propertyAddress ? 1 : 0) +
    (unit ? 1 : 0) +
    ((vendorEmail || vendorPhone) ? 1 : 0) +
    (serviceSummary ? 1 : 0);

  if (score < 3) return null;

  const sources = new Set<DocumentTagSuggestionSource>();
  sources.add("ocr");
  if (resolvedVendorName) sources.add(vendorSource);
  if (property || lease || transaction || workOrder || matchedVendorId) {
    sources.add("context");
  }
  const reasons = uniqueReasons([
    correctedVendorName ? `Vendor was corrected as ${correctedVendorName}.` : resolvedVendorName ? (matchedVendorId ? `Vendor matched saved vendor ${resolvedVendorName}.` : `Vendor came from ${vendorSource === "context" ? "linked context" : "OCR text"}.`) : "",
    resolvedTotalAmount != null ? (Number.isFinite(correctedTotalAmount) ? "Total amount was corrected." : "Total amount was selected from amount/total due text.") : "",
    invoiceDate ? "Invoice date was selected from bill, invoice, or statement date text." : "",
    dueDate ? "Due date was selected from due/payment date text." : "",
    correctedServicePeriodStart || correctedServicePeriodEnd ? "Service period was corrected." : servicePeriod.startDate && servicePeriod.endDate ? "Service period was selected from billing/service period text." : "",
    manualDocumentUnit ? `Unit scope was manually set as ${manualDocumentUnit}.` : unit ? `Unit scope resolved as ${unit}.` : "",
    propertyAddress ? "Location was selected from a matched property or address line." : "",
    invoiceRef ? "Reference was selected from invoice/reference text." : "",
  ]);

  return {
    propertyId,
    propertyAddress: propertyAddress || undefined,
    unit: unit || undefined,
    vendorName: resolvedVendorName || undefined,
    vendorId: matchedVendorId || undefined,
    vendorPhone: vendorPhone || undefined,
    vendorEmail: vendorEmail || undefined,
    invoiceRef: invoiceRef || undefined,
    invoiceDate: invoiceDate || undefined,
    serviceDate: serviceDate || undefined,
    dueDate: dueDate || undefined,
    servicePeriodStart: resolvedServicePeriodStart || undefined,
    servicePeriodEnd: resolvedServicePeriodEnd || undefined,
    subtotal,
    taxAmount,
    totalAmount: resolvedTotalAmount,
    serviceSummary: serviceSummary || undefined,
    confidence: score >= 6 ? "high" : "medium",
    sources: sortSuggestionSources(sources),
    reasons,
  };
}

function inferWorkOrderPriority(text: string) {
  if (/\burgent\b|\bemergency\b|\bimmediate\b|\bno heat\b|\bno water\b|\bflood\b|\bfire\b/.test(text)) return "Urgent";
  if (/\bleak\b|\bclog(?:ged)?\b|\bbackup\b|\bnot working\b|\boutage\b|\bmold\b|\bbroken\b|\bfailed\b/.test(text)) return "High";
  if (/\binspection\b|\bestimate\b|\bquote\b|\bbid\b/.test(text)) return "Low";
  return "Medium";
}

function buildFallbackWorkOrderTitle(text: string) {
  if (/\bplumb(?:ing)?\b|\bleak\b|\bdrain\b|\btoilet\b|\bsink\b|\brooter\b/.test(text)) return "Plumbing repair";
  if (/\belectrical\b|\bbreaker\b|\boutlet\b|\blight\b|\bpanel\b/.test(text)) return "Electrical repair";
  if (/\bhvac\b|\bfurnace\b|\bair conditioner\b|\bac unit\b|\bheat\b/.test(text)) return "HVAC service";
  if (/\binspection\b/.test(text)) return "Inspection follow-up";
  if (/\bpaint\b|\bdrywall\b|\bturnover\b/.test(text)) return "Turnover repair";
  return "Maintenance request";
}

function sanitizeWorkOrderLine(value: string, vendorName = "") {
  let line = String(value || "").trim();
  if (!line) return "";
  const escapedVendor = vendorName ? vendorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  if (escapedVendor) {
    line = line.replace(new RegExp(`^${escapedVendor}\\s*[:-]?\\s*`, "i"), "");
  }
  line = line
    .replace(/^(invoice|receipt|estimate|proposal|quote|bill)\b[:#-]?\s*/i, "")
    .replace(/\b(?:invoice|receipt|estimate)\s*#?\s*[a-z0-9-]+\b/gi, "")
    .replace(/\b(total due|amount due|balance due|payment due)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line || line.length < 4) return "";
  return line.length > 80 ? `${line.slice(0, 77).trim()}...` : line;
}

function pickWorkOrderTitle(text: string, vendorName = "") {
  const lines = normalizeExtractedDocumentText(text)
    .split("\n")
    .map((line) => sanitizeWorkOrderLine(line, vendorName))
    .filter(Boolean);

  const candidate =
    lines.find((line) => /\b(leak|repair|replace|replacement|service|maintenance|inspect|inspection|clog|backup|plumbing|electrical|hvac|furnace|drain|paint|light)\b/i.test(line)) ||
    lines.find((line) => line.split(" ").length >= 2 && line.split(" ").length <= 10);

  return candidate || buildFallbackWorkOrderTitle(String(text || "").toLowerCase());
}

function buildWorkOrderDescription(args: {
  title: string;
  extractedText: string;
  vendorName: string;
  documentType: string;
  invoiceRef?: string;
}) {
  const lines = normalizeExtractedDocumentText(args.extractedText)
    .split("\n")
    .map((line) => sanitizeWorkOrderLine(line, args.vendorName))
    .filter(Boolean)
    .filter((line) => line.toLowerCase() !== args.title.toLowerCase());

  const detailLine =
    lines.find((line) => /\b(repair|replace|service|install|inspection|issue|problem|leak|clog|backup)\b/i.test(line)) ||
    lines[0] ||
    "";

  const details = [detailLine];
  if (args.vendorName) details.push(`Vendor: ${args.vendorName}`);
  if (args.invoiceRef) details.push(`Ref: ${args.invoiceRef}`);
  if (String(args.documentType || "").toLowerCase().includes("estimate")) details.push("Source: Estimate");
  return details.filter(Boolean).join(" | ") || args.title;
}

function looksLikeSupportOnlyDocument(text: string) {
  return /\b(lease (?:summary|extension|renewal|packet|addendum)|seller lease|servicing summary|mortgage statement|closing (?:package|summary)|inspection (?:report|summary)|property inspection|personal property(?: schedule)?|furnishings schedule)\b/.test(text);
}

export function inferDocumentExpenseSuggestion(args: InferDocumentTagsArgs): DocumentExpenseSuggestion | null {
  const { document, property, lease, transaction, workOrder, vendor, candidateVendors = [] } = args;
  const extractedText = normalizeExtractedDocumentText(document.extractedText);
  const extractedSearchText = normalizeSearchText(normalizeLooseOcrText(extractedText));
  const nameText = String(document.name || "").toLowerCase();
  const typeText = String(document.type || "").toLowerCase();
  const combinedText = `${nameText}\n${typeText}\n${extractedText}`.toLowerCase();
  const supportOnlyDocument = looksLikeSupportOnlyDocument(combinedText);

  const looksExpenseLike =
    /\binvoice\b|\breceipt\b|\bestimate\b|\bbill\b|\btotal due\b|\bamount due\b|\bpayment due\b|\bpremium\b|\bproperty tax\b|\butility\b|\brepair\b|\bmaintenance\b/.test(combinedText) ||
    /\$[0-9]/.test(extractedText);

  if (supportOnlyDocument && !transaction && !workOrder) return null;
  if (!looksExpenseLike && !transaction && !workOrder) return null;

  const utilitySections = inferDocumentUtilitySections(args);
  const internalUtilitySections = utilitySections.filter((section) => !section.external);
  if (internalUtilitySections.length > 1) return null;
  const utilitySection = internalUtilitySections.length === 1 ? internalUtilitySections[0] : null;

  const {
    vendorName,
    vendorDefaultCategory,
    vendorSource,
    matchedVendorId,
  } = inferVendorContext({
    extractedSearchText,
    extractedText,
    vendor,
    transaction,
    candidateVendors,
  });
  const extractedFields = inferDocumentExtractedFields(args);
  const hasCorrectedAmount = Number.isFinite(Number(document.ocrFieldOverrides?.totalAmount));
  const amount = hasCorrectedAmount
    ? extractedFields?.totalAmount
    : utilitySection?.amount ?? extractedFields?.totalAmount ?? pickBestExpenseAmount(extractedText);
  const date =
    utilitySection?.date ||
    extractedFields?.invoiceDate ||
    extractedFields?.serviceDate ||
    pickBestExpenseDate(extractedText) ||
    String(transaction?.date || workOrder?.completedAt || workOrder?.reportedOn || "").trim();
  const invoiceRef = extractedFields?.invoiceRef || pickInvoiceReference(extractedText) || String(transaction?.invoiceRef || "").trim();
  const resolvedPropertyId =
    String(utilitySection?.propertyId || extractedFields?.propertyId || workOrder?.propertyId || transaction?.propertyId || lease?.propertyId || property?.id || document.propertyId || "").trim() || undefined;
  const knownUnits = collectKnownUnits(args, resolvedPropertyId);
  const detectedUnits = extractPossibleUnits(extractedText, knownUnits);
  const manualDocumentUnit = documentScopeOverride(document);
  const explicitDocumentUnit = normalizeUnitValue(document.unit) !== "shared" ? String(document.unit || "").trim() : "";
  const resolvedUnit =
    manualDocumentUnit ||
    utilitySection?.unit ||
    pickPreferredUnit(extractedFields?.unit, workOrder?.unit, transaction?.unit, lease?.unit, explicitDocumentUnit, detectedUnits[0], document.unit) ||
    "Shared";
  const category = utilitySection?.category || inferExpenseCategory(combinedText, vendorDefaultCategory, workOrder);
  const description = buildExpenseDescription({
    category,
    vendorName: extractedFields?.vendorName || utilitySection?.vendor || vendorName,
    documentType: String(document.type || document.name || ""),
    workOrder,
    invoiceRef,
  });

  const score =
    (amount != null ? 2 : 0) +
    (vendorName ? 2 : 0) +
    (date ? 1 : 0) +
    (invoiceRef ? 1 : 0) +
    (category !== "Other expenses" ? 1 : 0) +
    (resolvedPropertyId ? 1 : 0);

  if (score < 3) return null;

  const sources = new Set<DocumentTagSuggestionSource>();
  if (amount != null || date || invoiceRef) sources.add("ocr");
  if (utilitySection?.sources?.length) utilitySection.sources.forEach((source) => sources.add(source));
  if (extractedFields?.sources?.length) extractedFields.sources.forEach((source) => sources.add(source));
  if (vendorName) sources.add(vendorSource);
  if (workOrder || transaction || lease || property || matchedVendorId) sources.add("context");
  const reasons = uniqueReasons([
    utilitySection ? `Draft based on matched utility section ${utilitySection.address}.` : "",
    utilitySection?.reasons || [],
    extractedFields?.reasons || [],
    amount != null ? "Expense amount was selected from OCR total/amount due text." : "",
    date ? "Transaction date was selected from bill, invoice, statement, or service date text." : "",
    category !== "Other expenses" ? `Category resolved as ${category}.` : "",
    resolvedUnit ? `Unit scope resolved as ${resolvedUnit}.` : "",
  ].flat());

  return {
    propertyId: resolvedPropertyId,
    unit: resolvedUnit,
    vendor: extractedFields?.vendorName || utilitySection?.vendor || vendorName,
    vendorId: extractedFields?.vendorId || matchedVendorId || undefined,
    category,
    description: utilitySection?.description || description,
    amount,
    date: date || undefined,
    invoiceRef: invoiceRef || undefined,
    servicePeriodStart: extractedFields?.servicePeriodStart || utilitySection?.servicePeriodStart || undefined,
    servicePeriodEnd: extractedFields?.servicePeriodEnd || utilitySection?.servicePeriodEnd || undefined,
    confidence: score >= 6 ? "high" : "medium",
    sources: sortSuggestionSources(sources),
    reasons,
  };
}

export function inferDocumentWorkOrderSuggestion(args: InferDocumentTagsArgs): DocumentWorkOrderSuggestion | null {
  const { document, property, lease, transaction, workOrder, vendor, candidateVendors = [] } = args;
  const extractedText = normalizeExtractedDocumentText(document.extractedText);
  const extractedSearchText = normalizeSearchText(extractedText);
  const nameText = String(document.name || "").toLowerCase();
  const typeText = String(document.type || "").toLowerCase();
  const combinedText = `${nameText}\n${typeText}\n${extractedText}`.toLowerCase();
  const supportOnlyDocument = looksLikeSupportOnlyDocument(combinedText);

  const looksMaintenanceLike =
    /\b(estimate|proposal|quote|bid|repair|replace|service call|maintenance|work order|inspection|leak|clog|plumb(?:ing)?|electrical|hvac|furnace|drain|toilet|sink|water heater|light)\b/.test(combinedText);

  if (supportOnlyDocument) return null;
  if (!looksMaintenanceLike || workOrder) return null;

  const {
    vendorName,
    vendorSource,
    matchedVendorId,
  } = inferVendorContext({
    extractedSearchText,
    extractedText,
    vendor,
    transaction,
    candidateVendors,
  });
  const extractedFields = inferDocumentExtractedFields(args);
  const contextualTransactionAmount = Number(transaction?.amount || 0) || undefined;
  const estimatedCost = extractedFields?.totalAmount ?? pickBestExpenseAmount(extractedText) ?? contextualTransactionAmount;
  const reportedOn = extractedFields?.serviceDate || extractedFields?.invoiceDate || pickBestExpenseDate(extractedText) || String(transaction?.date || "").trim();
  const title = extractedFields?.serviceSummary || pickWorkOrderTitle(extractedText || `${document.name}\n${document.type}`, extractedFields?.vendorName || vendorName);
  const invoiceRef = extractedFields?.invoiceRef || pickInvoiceReference(extractedText) || String(transaction?.invoiceRef || "").trim();
  const description = buildWorkOrderDescription({
    title,
    extractedText: extractedText || `${document.name}\n${document.type}`,
    vendorName: extractedFields?.vendorName || vendorName,
    documentType: document.type,
    invoiceRef,
  });
  const resolvedPropertyId =
    String(extractedFields?.propertyId || transaction?.propertyId || lease?.propertyId || property?.id || document.propertyId || "").trim() || undefined;
  const knownUnits = collectKnownUnits(args, resolvedPropertyId);
  const detectedUnits = extractPossibleUnits(extractedText, knownUnits);
  const manualDocumentUnit = documentScopeOverride(document);
  const explicitDocumentUnit = normalizeUnitValue(document.unit) !== "shared" ? String(document.unit || "").trim() : "";
  const resolvedUnit =
    manualDocumentUnit ||
    pickPreferredUnit(extractedFields?.unit, transaction?.unit, lease?.unit, explicitDocumentUnit, detectedUnits[0], document.unit) ||
    "Shared";
  const priority = inferWorkOrderPriority(combinedText);

  const score =
    (title ? 2 : 0) +
    (description ? 1 : 0) +
    (vendorName ? 1 : 0) +
    (estimatedCost != null ? 1 : 0) +
    (reportedOn ? 1 : 0) +
    (resolvedPropertyId ? 1 : 0) +
    (resolvedUnit && resolvedUnit !== "Shared" ? 1 : 0) +
    (/\bestimate\b|\bproposal\b|\bquote\b|\brepair\b|\bmaintenance\b|\bservice call\b|\bwork order\b/.test(combinedText) ? 1 : 0);

  if (score < 4 || !title || !resolvedPropertyId) return null;

  const sources = new Set<DocumentTagSuggestionSource>();
  if (extractedText) sources.add("ocr");
  if (extractedFields?.sources?.length) extractedFields.sources.forEach((source) => sources.add(source));
  if (vendorName) sources.add(vendorSource);
  if (transaction || lease || property) sources.add("context");

  return {
    propertyId: resolvedPropertyId,
    unit: resolvedUnit,
    title,
    description,
    priority,
    vendor: extractedFields?.vendorName || vendorName,
    vendorId: extractedFields?.vendorId || matchedVendorId || undefined,
    estimatedCost,
    reportedOn: reportedOn || undefined,
    confidence: score >= 6 ? "high" : "medium",
    sources: sortSuggestionSources(sources),
  };
}

export function inferDocumentTagSuggestions(args: InferDocumentTagsArgs): DocumentTagSuggestion[] {
  const { document, lease, transaction, workOrder, vendor, candidateLeases = [], candidateProperties = [], candidateVendors = [] } = args;
  const suggestions = new Map<string, Set<DocumentTagSuggestionSource>>();
  const fileName = String(document.name || "").toLowerCase();
  const docType = String(document.type || "").toLowerCase();
  const extractedText = normalizeExtractedDocumentText(document.extractedText).toLowerCase();
  const extractedSearchText = normalizeSearchText(extractedText);
  const existing = Array.isArray(document.tags) ? document.tags : [];
  const propertyId = String(workOrder?.propertyId || transaction?.propertyId || lease?.propertyId || args.property?.id || document.propertyId || "").trim();
  const detectedUnits = extractPossibleUnits(extractedText, collectKnownUnits(args, propertyId));

  existing.forEach((tag) => pushSuggestion(suggestions, tag, "context"));
  pushSuggestion(suggestions, docType, "name");

  if (fileName.includes("lease") || docType.includes("lease")) pushSuggestion(suggestions, "lease", "name");
  if (fileName.includes("receipt") || docType.includes("receipt")) pushSuggestion(suggestions, "receipt", "name");
  if (fileName.includes("invoice") || docType.includes("invoice")) pushSuggestion(suggestions, "invoice", "name");
  if (fileName.includes("inspection") || docType.includes("inspection")) pushSuggestion(suggestions, "inspection", "name");
  if (fileName.includes("policy") || fileName.includes("insurance") || docType.includes("policy")) pushSuggestion(suggestions, "insurance", "name");
  if (fileName.includes("tax") || docType.includes("tax")) pushSuggestion(suggestions, "tax", "name");
  if (fileName.includes("closing") || docType.includes("closing")) pushSuggestion(suggestions, "closing", "name");
  if (fileName.includes("bid") || fileName.includes("estimate") || docType.includes("estimate")) pushSuggestion(suggestions, "estimate", "name");
  if (fileName.includes("photo") || fileName.includes("image") || docType.includes("scanned image")) {
    pushSuggestion(suggestions, "photo", "name");
    pushSuggestion(suggestions, "scan", "name");
  }
  if (docType.includes("scanned pdf")) pushSuggestion(suggestions, "scan", "name");

  if (extractedText) {
    pushKeywordSuggestions(suggestions, extractedText, [
      [/\blease\b|\blessor\b|\blessee\b|\bmonthly rent\b/, ["lease"]],
      [/\brenewal\b|\brenewed\b/, ["renewal"]],
      [/\breceipt\b/, ["receipt"]],
      [/\binvoice\b|\binvoice number\b|\btotal due\b/, ["invoice"]],
      [/\bestimate\b|\bproposal\b|\bbid\b/, ["estimate"]],
      [/\binspection\b|\bmove[- ]?in inspection\b|\bmove[- ]?out inspection\b/, ["inspection"]],
      [/\bpolicy\b|\bcoverage\b|\bpremium\b/, ["insurance"]],
      [/\btax bill\b|\bparcel\b|\bassessor\b|\bproperty tax\b/, ["tax"]],
      [/\bsecurity deposit\b/, ["security deposit"]],
      [/\blate fee\b/, ["late fee"]],
      [/\brent\b|\brental payment\b/, ["rent"]],
      [/\bmaintenance\b|\brepair\b|\bwork order\b/, ["maintenance"]],
      [/\bplumb(?:ing)?\b|\bleak\b|\brooter\b/, ["plumbing"]],
      [/\belectrical\b|\bpanel\b|\boutlet\b|\bbreaker\b/, ["electrical"]],
      [/\bhvac\b|\bfurnace\b|\bair conditioner\b|\bac unit\b/, ["hvac"]],
      [/\bnotice to vacate\b|\beviction\b|\bpay or quit\b/, ["notice"]],
    ], "ocr");

    detectedUnits.forEach((unit) => pushUnitSuggestion(suggestions, unit, "ocr"));

    for (const candidateVendor of candidateVendors) {
      if (!candidateVendor?.name) continue;
      if (!findVendorMatchedValue(extractedSearchText, candidateVendor)) continue;
      pushSuggestion(suggestions, candidateVendor.name, "ocr_match");
      pushSuggestion(suggestions, "vendor", "ocr_match");
    }

    for (const candidateLease of candidateLeases) {
      if (!candidateLease?.tenantName) continue;
      if (!matchNamedEntity(extractedSearchText, candidateLease.tenantName)) continue;
      pushSuggestion(suggestions, candidateLease.tenantName, "ocr_match");
      pushSuggestion(suggestions, "tenant", "ocr_match");
      pushUnitSuggestion(suggestions, candidateLease.unit, "ocr_match");
    }

    for (const candidateProperty of candidateProperties) {
      const matchedName = candidateProperty?.name && matchNamedEntity(extractedSearchText, candidateProperty.name);
      const matchedAddress = candidateProperty?.address && matchAddress(extractedSearchText, candidateProperty.address);
      if (!matchedName && !matchedAddress) continue;
      pushSuggestion(suggestions, candidateProperty.name, "ocr_match");
    }
  }

  if (lease) {
    pushSuggestion(suggestions, "tenant", "context");
    pushSuggestion(suggestions, lease.tenantName, "context");
    pushUnitSuggestion(suggestions, lease.unit, "context");
  }

  if (transaction) {
    pushSuggestion(suggestions, transaction.type, "context");
    pushSuggestion(suggestions, transaction.category, "context");
    pushSuggestion(suggestions, transaction.vendor, "context");
    pushUnitSuggestion(suggestions, transaction.unit, "context");

    if (String(transaction.description || "").toLowerCase().includes("security deposit")) {
      pushSuggestion(suggestions, "security deposit", "context");
    }
    if (String(transaction.description || "").toLowerCase().includes("rent")) {
      pushSuggestion(suggestions, "rent", "context");
    }
  }

  if (workOrder) {
    pushSuggestion(suggestions, "maintenance", "context");
    pushSuggestion(suggestions, "work order", "context");
    pushSuggestion(suggestions, workOrder.priority, "context");
    pushSuggestion(suggestions, workOrder.title, "context");
    pushUnitSuggestion(suggestions, workOrder.unit, "context");
  }

  if (vendor) {
    pushSuggestion(suggestions, vendor.name, "context");
    pushSuggestion(suggestions, "vendor", "context");
  }

  return [...suggestions.entries()].map(([tag, sources]) => ({
    tag,
    sources: sortSuggestionSources(sources),
  }));
}

export function inferDocumentLinkSuggestions(args: InferDocumentTagsArgs): DocumentLinkSuggestion[] {
  const { document, candidateLeases = [], candidateProperties = [], candidateTransactions = [], candidateWorkOrders = [] } = args;
  const extractedText = normalizeExtractedDocumentText(document.extractedText).toLowerCase();
  const extractedSearchText = normalizeSearchText(extractedText);
  if (!extractedSearchText) return [];

  const propertyId = String(document.propertyId || args.property?.id || "").trim();
  const detectedUnits = extractPossibleUnits(extractedText, collectKnownUnits(args, propertyId));
  const extractedFields = inferDocumentExtractedFields(args);
  const extractedInvoiceRef = normalizeSearchText(extractedFields?.invoiceRef || "");
  const extractedInvoiceDate = String(extractedFields?.invoiceDate || extractedFields?.serviceDate || "").trim();
  const extractedServicePeriodEnd = String(extractedFields?.servicePeriodEnd || "").trim();
  const extractedAmount = Number(extractedFields?.totalAmount);
  const extractedPropertyId = String(extractedFields?.propertyId || propertyId).trim();
  const utilitySections = inferDocumentUtilitySections(args);
  const hasMultipleUtilitySections = utilitySections.length > 1;
  const internalUtilitySections = utilitySections.filter((section) => !section.external && utilitySectionHasSignal(section));
  const linkSuggestions = new Map<string, { suggestion: DocumentLinkSuggestion; score: number; sourceSet: Set<DocumentTagSuggestionSource> }>();
  const propertyById = Object.fromEntries(candidateProperties.map((property) => [property.id, property]));

  candidateLeases.forEach((candidateLease) => {
    const tenantMatched = matchNamedEntity(extractedSearchText, candidateLease.tenantName);
    const unitMatched = Boolean(candidateLease.unit && detectedUnits.includes(normalizeUnitValue(candidateLease.unit)));
    const candidateProperty = propertyById[candidateLease.propertyId];
    const propertyMatched = Boolean(
      (candidateProperty?.name && matchNamedEntity(extractedSearchText, candidateProperty.name)) ||
      (candidateProperty?.address && matchAddress(extractedSearchText, candidateProperty.address))
    );
    const score = (tenantMatched ? 4 : 0) + (unitMatched ? 2 : 0) + (propertyMatched ? 1 : 0);
    if (score < 4) return;
    pushLinkSuggestion(linkSuggestions, {
      kind: "lease",
      id: candidateLease.id,
      label: `${candidateLease.tenantName} | Unit ${candidateLease.unit}`,
      propertyId: candidateLease.propertyId,
      unit: candidateLease.unit,
    }, score, ["ocr_match", ...(unitMatched ? ["ocr"] : [])] as DocumentTagSuggestionSource[]);
  });

  candidateWorkOrders.forEach((candidateWorkOrder) => {
    const vendorMatched = candidateWorkOrder.vendorName ? matchNamedEntity(extractedSearchText, candidateWorkOrder.vendorName) : false;
    const titleOverlap = overlapWordCount(extractedSearchText, candidateWorkOrder.title);
    const descOverlap = overlapWordCount(extractedSearchText, candidateWorkOrder.description);
    const unitMatched = Boolean(candidateWorkOrder.unit && detectedUnits.includes(normalizeUnitValue(candidateWorkOrder.unit)));
    const score = (vendorMatched ? 3 : 0) + (titleOverlap >= 2 ? 2 : 0) + (descOverlap >= 2 ? 1 : 0) + (unitMatched ? 2 : 0);
    if (score < 4) return;
    pushLinkSuggestion(linkSuggestions, {
      kind: "workOrder",
      id: candidateWorkOrder.id,
      label: `${candidateWorkOrder.title} | Unit ${candidateWorkOrder.unit}`,
      propertyId: candidateWorkOrder.propertyId,
      unit: candidateWorkOrder.unit,
    }, score, ["ocr_match", ...(unitMatched ? ["ocr"] : [])] as DocumentTagSuggestionSource[]);
  });

  candidateTransactions.forEach((candidateTransaction) => {
    const vendorMatched = candidateTransaction.vendor ? matchNamedEntity(extractedSearchText, candidateTransaction.vendor) : false;
    const descriptionOverlap = overlapWordCount(extractedSearchText, candidateTransaction.description);
    const categoryOverlap = overlapWordCount(extractedSearchText, candidateTransaction.category);
    const unitMatched = Boolean(candidateTransaction.unit && detectedUnits.includes(normalizeUnitValue(candidateTransaction.unit)));
    const propertyMatched = Boolean(extractedPropertyId && candidateTransaction.propertyId && candidateTransaction.propertyId === extractedPropertyId);
    const baseContextScore =
      (vendorMatched ? 3 : 0) +
      (descriptionOverlap >= 2 ? 2 : 0) +
      (categoryOverlap >= 1 ? 1 : 0) +
      (unitMatched ? 2 : 0) +
      (propertyMatched ? 2 : 0);
    const amountMatched =
      Number.isFinite(extractedAmount) &&
      Number.isFinite(Number(candidateTransaction.amount)) &&
      Math.abs(Number(candidateTransaction.amount) - extractedAmount) < 0.005;
    const invoiceRefMatched =
      extractedInvoiceRef &&
      normalizeSearchText(candidateTransaction.invoiceRef || "") === extractedInvoiceRef;
    const candidateDate = String(candidateTransaction.date || "").trim();
    const exactDateMatched = Boolean(extractedInvoiceDate && candidateDate === extractedInvoiceDate);
    const closeDateMatched = Boolean(!exactDateMatched && extractedInvoiceDate && candidateDate && isoDateDayDiff(extractedInvoiceDate, candidateDate) <= 3);
    const sameMonthDateMatched = Boolean(
      !exactDateMatched &&
      !closeDateMatched &&
      amountMatched &&
      extractedInvoiceDate &&
      candidateDate &&
      extractedInvoiceDate.slice(0, 7) === candidateDate.slice(0, 7)
    );
    const servicePeriodEndMatched = Boolean(
      extractedServicePeriodEnd &&
      candidateDate === extractedServicePeriodEnd
    );
    const preciseDocumentScore =
      (amountMatched ? 4 : 0) +
      (invoiceRefMatched ? 4 : 0) +
      (exactDateMatched ? 4 : 0) +
      (closeDateMatched ? 3 : 0) +
      (sameMonthDateMatched ? 1 : 0) +
      (servicePeriodEndMatched ? 1 : 0);
    const sectionScore = internalUtilitySections.reduce((best, section) => {
      const sectionUnitMatched = Boolean(section.unit && candidateTransaction.unit && normalizeUnitValue(candidateTransaction.unit) === normalizeUnitValue(section.unit));
      const sectionPropertyMatched = Boolean(section.propertyId && candidateTransaction.propertyId && candidateTransaction.propertyId === section.propertyId);
      const sectionAmountMatched =
        section.amount != null &&
        Number.isFinite(Number(candidateTransaction.amount)) &&
        Math.abs(Number(candidateTransaction.amount) - Number(section.amount)) < 0.005;
      const sectionDateMatched = Boolean(section.date && String(candidateTransaction.date || "").trim() === section.date);
      const sectionServicePeriodEndMatched = Boolean(section.servicePeriodEnd && String(candidateTransaction.date || "").trim() === section.servicePeriodEnd);
      const sectionAccountRefMatched =
        section.accountRef &&
        normalizeSearchText(candidateTransaction.invoiceRef || "") === normalizeSearchText(section.accountRef);
      const sectionCategoryMatched = overlapWordCount(normalizeSearchText(`${section.category} ${section.description}`), candidateTransaction.category) >= 1;
      const nextScore =
        (sectionPropertyMatched ? 3 : 0) +
        (sectionUnitMatched ? 3 : 0) +
        (sectionAmountMatched ? 4 : 0) +
        (sectionDateMatched ? 4 : 0) +
        (sectionServicePeriodEndMatched ? 1 : 0) +
        (sectionAccountRefMatched ? 8 : 0) +
        (sectionCategoryMatched ? 1 : 0);
      return Math.max(best, nextScore);
    }, 0);
    const finalScore = hasMultipleUtilitySections
      ? Math.max(baseContextScore, sectionScore)
      : Math.max(baseContextScore + preciseDocumentScore, sectionScore);
    if (finalScore < 4) return;
    pushLinkSuggestion(linkSuggestions, {
      kind: "transaction",
      id: candidateTransaction.id,
      label: `${candidateTransaction.date} | ${candidateTransaction.vendor || candidateTransaction.category || candidateTransaction.description || "Transaction"}${candidateTransaction.unit ? ` | Unit ${candidateTransaction.unit}` : ""}`,
      propertyId: candidateTransaction.propertyId,
      unit: candidateTransaction.unit,
    }, finalScore, [
      ...(vendorMatched || invoiceRefMatched ? ["ocr_match"] : []),
      ...((unitMatched || amountMatched || exactDateMatched || closeDateMatched || sameMonthDateMatched || servicePeriodEndMatched || sectionScore > 0) ? ["ocr"] : []),
    ] as DocumentTagSuggestionSource[]);
  });

  return [...linkSuggestions.values()]
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      const leftDate = left.suggestion.kind === "transaction" ? String(left.suggestion.label || "").split(" | ")[0] : "";
      const rightDate = right.suggestion.kind === "transaction" ? String(right.suggestion.label || "").split(" | ")[0] : "";
      if (leftDate && rightDate && leftDate !== rightDate) return rightDate.localeCompare(leftDate);
      return left.suggestion.label.localeCompare(right.suggestion.label);
    })
    .map((entry): DocumentLinkSuggestion => ({
      ...entry.suggestion,
      confidence: entry.score >= 5 ? "high" : "medium",
      sources: sortSuggestionSources(entry.sourceSet),
    }))
    .slice(0, 5);
}

export function inferDocumentTags(args: InferDocumentTagsArgs) {
  return inferDocumentTagSuggestions(args).map((suggestion) => suggestion.tag);
}
