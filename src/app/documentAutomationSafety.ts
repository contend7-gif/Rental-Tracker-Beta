import type { DocumentItem, Transaction } from "../models.ts";

export type DocumentAutomationSuggestion = {
  confidence?: string;
  propertyId?: string;
  amount?: number | null;
  date?: string;
  title?: string;
};

export type UtilitySectionCandidate = {
  external?: boolean;
  propertyId?: string;
  unit?: string;
  amount?: number | null;
  date?: string;
  invoiceRef?: string;
  accountRef?: string;
  vendor?: string;
};

type AutomationDocument = Pick<DocumentItem, "name" | "type" | "extractedText" | "transactionId">;

export function documentLooksLikeEstimate(document?: Partial<AutomationDocument> | null): boolean {
  const text = `${document?.name || ""} ${document?.type || ""} ${document?.extractedText || ""}`.toLowerCase();
  return /\bestimate\b|\bproposal\b|\bquote\b|\bbid\b/.test(text);
}

export function documentLooksLikeInvoice(document?: Partial<AutomationDocument> | null): boolean {
  const text = `${document?.name || ""} ${document?.type || ""} ${document?.extractedText || ""}`.toLowerCase();
  return /\binvoice\b|\breceipt\b|\bbill\b|\bamount due\b|\btotal due\b|\bpaid\b/.test(text);
}

export function canAutoCreateExpenseSuggestion(
  document?: Partial<AutomationDocument> | null,
  suggestion?: DocumentAutomationSuggestion | null,
): boolean {
  return Boolean(
    suggestion &&
    suggestion.confidence === "high" &&
    !document?.transactionId &&
    suggestion.propertyId &&
    suggestion.amount != null &&
    suggestion.date &&
    documentLooksLikeInvoice(document) &&
    !documentLooksLikeEstimate(document),
  );
}

export function canAutoCreateWorkOrderSuggestion(
  document: Partial<AutomationDocument> | null | undefined,
  suggestion: DocumentAutomationSuggestion | null | undefined,
  options: { hasLinkedWorkOrder: boolean; expenseSuggestion?: DocumentAutomationSuggestion | null },
): boolean {
  return Boolean(
    suggestion &&
    suggestion.confidence === "high" &&
    !options.hasLinkedWorkOrder &&
    suggestion.propertyId &&
    suggestion.title &&
    (documentLooksLikeEstimate(document) || !canAutoCreateExpenseSuggestion(document, options.expenseSuggestion)),
  );
}

export function canCreateUtilitySectionTransaction(section?: UtilitySectionCandidate | null): boolean {
  return Boolean(
    section &&
    !section.external &&
    section.propertyId &&
    section.amount != null &&
    section.date,
  );
}

export function findMatchingUtilitySectionTransaction(
  section: UtilitySectionCandidate,
  transactions: Transaction[] | null | undefined,
  transactionById: Record<string, Transaction> = {},
): Transaction | null {
  if (!canCreateUtilitySectionTransaction(section)) return null;
  const sectionUnit = String(section.unit || "Shared").trim() || "Shared";
  const sectionInvoice = String(section.invoiceRef || section.accountRef || "").trim().toLowerCase();
  const sectionVendor = String(section.vendor || "").trim().toLowerCase();
  const existingTransactions = Array.isArray(transactions) ? transactions : Object.values(transactionById || {});
  return existingTransactions.find((transaction) => {
    if (!transaction || String(transaction.status || "") === "deleted") return false;
    if (transaction.type !== "Expense") return false;
    if (String(transaction.propertyId || "") !== String(section.propertyId || "")) return false;
    if (String(transaction.unit || "Shared").trim() !== sectionUnit) return false;
    if (String(transaction.date || "") !== String(section.date || "")) return false;
    if (Math.abs(Number(transaction.amount || 0) - Number(section.amount || 0)) >= 0.005) return false;
    const transactionInvoice = String(transaction.invoiceRef || "").trim().toLowerCase();
    if (sectionInvoice && transactionInvoice && transactionInvoice === sectionInvoice) return true;
    const transactionVendor = String(transaction.vendor || transaction.description || "").trim().toLowerCase();
    return Boolean(sectionVendor && transactionVendor.includes(sectionVendor));
  }) || null;
}
