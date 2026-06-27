export const PROPERTY_OPERATION_NOTE_CATEGORIES = [
  "Access",
  "Utilities",
  "Emergency",
  "Appliances",
  "Smart devices",
  "Tenant handoff",
  "Vendor instructions",
  "Other",
];

export const DEFAULT_PROPERTY_OPERATION_NOTE_CATEGORY = "Access";

export const PROPERTY_VALUATION_SOURCES = [
  "Manual estimate",
  "Appraisal",
  "Tax assessment",
  "Refinance",
  "Purchase / closing",
  "Broker opinion",
  "Other",
];

export const PROPERTY_DOCUMENT_TYPES = [
  "Closing statement",
  "Deed",
  "Purchase agreement",
  "Appraisal",
  "Inspection",
  "Tax assessment",
  "Insurance declaration",
  "Refinance / loan closing",
  "Other property document",
];

export const DEFAULT_PROPERTY_VALUATION_SOURCE = "Manual estimate";
export const DEFAULT_PROPERTY_DOCUMENT_TYPE = "Closing statement";
export const PROPERTY_PURCHASE_VALUATION_SOURCE = "Purchase / closing";

export function normalizePropertyOperationNote(note, fallback = {}) {
  const category = PROPERTY_OPERATION_NOTE_CATEGORIES.includes(note?.category)
    ? note.category
    : DEFAULT_PROPERTY_OPERATION_NOTE_CATEGORY;
  const now = fallback.now || new Date().toISOString();
  const body = String(note?.body || "").trim();
  const title = String(note?.title || "").trim() || (body ? body.split(/\s+/).slice(0, 6).join(" ") : "Property note");

  return {
    id: String(note?.id || fallback.id || `pon-${Date.now()}`).trim(),
    title,
    category,
    unit: String(note?.unit || fallback.unit || "Shared").trim() || "Shared",
    body,
    sensitive: Boolean(note?.sensitive),
    createdAt: String(note?.createdAt || now),
    updatedAt: String(note?.updatedAt || now),
  };
}

export function normalizePropertyOperationNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => normalizePropertyOperationNote(note))
    .filter((note) => note.title || note.body)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

export function operationNoteScopeLabel(note) {
  const unit = String(note?.unit || "Shared").trim() || "Shared";
  return unit === "Shared" ? "Property" : `Unit ${unit}`;
}

export function normalizePropertyValuation(valuation, fallback = {}) {
  const now = fallback.now || new Date().toISOString();
  const value = Number(valuation?.value);
  const date = String(valuation?.date || fallback.date || now.slice(0, 10)).trim();
  const source = PROPERTY_VALUATION_SOURCES.includes(valuation?.source)
    ? valuation.source
    : DEFAULT_PROPERTY_VALUATION_SOURCE;
  const documentId = String(valuation?.documentId || "").trim();
  const notes = String(valuation?.notes || "").trim();

  return {
    id: String(valuation?.id || fallback.id || `pv-${Date.now()}`).trim(),
    date,
    value: Number.isFinite(value) && value >= 0 ? value : 0,
    source,
    documentId: documentId || undefined,
    notes: notes || undefined,
    createdAt: String(valuation?.createdAt || now),
    updatedAt: String(valuation?.updatedAt || now),
  };
}

export function normalizePropertyValuations(valuations) {
  if (!Array.isArray(valuations)) return [];
  return valuations
    .map((valuation) => normalizePropertyValuation(valuation))
    .filter((valuation) => Number(valuation.value || 0) > 0)
    .sort((left, right) => {
      const dateCompare = String(right.date || "").localeCompare(String(left.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
}

export function getPropertyPurchaseValueSupport(property = {}) {
  const purchaseValuation = (property.propertyValuations || []).find((valuation) => {
    const value = Number(valuation?.value || 0);
    return valuation?.source === PROPERTY_PURCHASE_VALUATION_SOURCE && Number.isFinite(value) && value > 0;
  });
  if (purchaseValuation) {
    return {
      value: Number(purchaseValuation.value),
      source: PROPERTY_PURCHASE_VALUATION_SOURCE,
      date: purchaseValuation.date || property.purchasedOn || "",
      usesValuation: true,
    };
  }

  const fallbackValue = Number(property.purchasePrice || 0);
  if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
    return {
      value: fallbackValue,
      source: "Property purchase/cost field",
      date: property.purchasedOn || "",
      usesValuation: false,
    };
  }

  return {
    value: 0,
    source: "",
    date: "",
    usesValuation: false,
  };
}

export function projectPropertyValue(currentValue, annualAppreciationPct, months) {
  const value = Number(currentValue || 0);
  const annualRate = Number(annualAppreciationPct || 0) / 100;
  const horizonMonths = Math.max(0, Number(months || 0));
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(annualRate)) return value;
  return Math.round(value * Math.pow(1 + annualRate, horizonMonths / 12) * 100) / 100;
}

export function estimatePropertyValueAtDate(currentValue, annualAppreciationPct, valuationDate, asOfDate) {
  const value = Number(currentValue || 0);
  const annualRate = Number(annualAppreciationPct || 0) / 100;
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(annualRate) || annualRate === 0) return Math.round(value * 100) / 100;

  const start = new Date(`${String(valuationDate || "").slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(asOfDate || "").slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return Math.round(value * 100) / 100;
  }

  const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.2425);
  return Math.round(value * Math.pow(1 + annualRate, years) * 100) / 100;
}
