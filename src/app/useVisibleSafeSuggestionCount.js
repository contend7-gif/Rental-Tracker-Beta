import { useMemo } from "react";
import { buildDocumentQualityWarnings } from "../features/documents/documentPresentation.js";

export function documentHasSafeSuggestion({
  canAutoCreateExpenseFromSuggestion,
  canAutoCreateWorkOrderFromSuggestion,
  document,
  getDocumentExpenseSuggestion,
  getDocumentWorkOrderSuggestion,
  getSafeDocumentLinkSuggestion,
  getSafeDocumentTagSuggestions,
}) {
  const safeTags = getSafeDocumentTagSuggestions(document);
  const safeLink = getSafeDocumentLinkSuggestion(document);
  const expenseSuggestion = getDocumentExpenseSuggestion(document);
  const workOrderSuggestion = getDocumentWorkOrderSuggestion(document);
  return (
    safeTags.length > 0 ||
    Boolean(safeLink) ||
    canAutoCreateExpenseFromSuggestion(document, expenseSuggestion) ||
    canAutoCreateWorkOrderFromSuggestion(document, workOrderSuggestion)
  );
}

export function countVisibleSafeSuggestions({
  canAutoCreateExpenseFromSuggestion,
  canAutoCreateWorkOrderFromSuggestion,
  currency,
  getDocumentExpenseSuggestion,
  getDocumentExtractedFields,
  getDocumentWorkOrderSuggestion,
  getSafeDocumentLinkSuggestion,
  getSafeDocumentTagSuggestions,
  transactionById = {},
  visibleDocuments = [],
}) {
  return visibleDocuments.filter((document) => {
    const warnings = buildDocumentQualityWarnings(document, {
      currency,
      extractedFields: getDocumentExtractedFields?.(document),
      linkedTransaction: document?.transactionId ? transactionById[document.transactionId] : null,
    });
    if (warnings.length > 0) return false;
    return documentHasSafeSuggestion({
      canAutoCreateExpenseFromSuggestion,
      canAutoCreateWorkOrderFromSuggestion,
      document,
      getDocumentExpenseSuggestion,
      getDocumentWorkOrderSuggestion,
      getSafeDocumentLinkSuggestion,
      getSafeDocumentTagSuggestions,
    });
  }).length;
}

export function useVisibleSafeSuggestionCount({
  canAutoCreateExpenseFromSuggestion,
  canAutoCreateWorkOrderFromSuggestion,
  currency,
  getDocumentExpenseSuggestion,
  getDocumentExtractedFields,
  getDocumentWorkOrderSuggestion,
  getSafeDocumentLinkSuggestion,
  getSafeDocumentTagSuggestions,
  transactionById,
  visibleDocuments,
}) {
  return useMemo(
    () =>
      countVisibleSafeSuggestions({
        canAutoCreateExpenseFromSuggestion,
        canAutoCreateWorkOrderFromSuggestion,
        currency,
        getDocumentExpenseSuggestion,
        getDocumentExtractedFields,
        getDocumentWorkOrderSuggestion,
        getSafeDocumentLinkSuggestion,
        getSafeDocumentTagSuggestions,
        transactionById,
        visibleDocuments,
      }),
    [
      canAutoCreateExpenseFromSuggestion,
      canAutoCreateWorkOrderFromSuggestion,
      currency,
      getDocumentExpenseSuggestion,
      getDocumentExtractedFields,
      getDocumentWorkOrderSuggestion,
      getSafeDocumentLinkSuggestion,
      getSafeDocumentTagSuggestions,
      transactionById,
      visibleDocuments,
    ],
  );
}
