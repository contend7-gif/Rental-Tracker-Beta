import {
  inferDocumentExpenseSuggestion,
  inferDocumentExtractedFields,
  inferDocumentLinkSuggestions,
  inferDocumentTagSuggestions,
  inferDocumentUtilitySections,
  inferDocumentWorkOrderSuggestion,
  type DocumentExpenseSuggestion,
  type DocumentExtractedFields,
  type DocumentLinkSuggestion,
  type DocumentTagSuggestion,
  type DocumentUtilitySection,
  type DocumentWorkOrderSuggestion,
  type InferDocumentTagsArgs,
} from "../domain/documentIntelligence.ts";

export type DocumentAnalysisEntry = {
  id: string;
  context: InferDocumentTagsArgs;
};

export type DocumentAnalysisResult = {
  utilitySections: DocumentUtilitySection[];
  tagSuggestions: DocumentTagSuggestion[];
  linkSuggestions: DocumentLinkSuggestion[];
  expenseSuggestion: DocumentExpenseSuggestion | null;
  workOrderSuggestion: DocumentWorkOrderSuggestion | null;
  extractedFields: DocumentExtractedFields | null;
};

export type DocumentAnalysisResultById = Record<string, DocumentAnalysisResult>;

function analyzeDocument(context: InferDocumentTagsArgs): DocumentAnalysisResult {
  return {
    utilitySections: inferDocumentUtilitySections(context),
    tagSuggestions: inferDocumentTagSuggestions(context),
    linkSuggestions: inferDocumentLinkSuggestions(context),
    expenseSuggestion: inferDocumentExpenseSuggestion(context),
    workOrderSuggestion: inferDocumentWorkOrderSuggestion(context),
    extractedFields: inferDocumentExtractedFields(context),
  };
}

export function analyzeDocumentBatch(entries: DocumentAnalysisEntry[]): DocumentAnalysisResultById {
  return Object.fromEntries(entries.map(({ id, context }) => [id, analyzeDocument(context)]));
}
