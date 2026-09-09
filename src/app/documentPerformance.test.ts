import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { analyzeDocumentBatch, type DocumentAnalysisEntry } from "./documentAnalysisBatch.ts";
import { buildDocumentSearchIndex, matchesDocumentSearch } from "./documentSearchIndex.ts";
import {
  inferDocumentUtilitySections, inferDocumentExtractedFields, inferDocumentTagSuggestions,
  inferDocumentLinkSuggestions, inferDocumentExpenseSuggestion, inferDocumentWorkOrderSuggestion,
} from "../domain/documentIntelligence.ts";

const ANALYSIS_DOCUMENT_COUNT = 150;
const ANALYSIS_BUDGET_MS = 3_000;
const SEARCH_DOCUMENT_COUNT = 2_000;
const SEARCH_ITERATIONS = 40;
const SEARCH_BUDGET_MS = 300;

function createAnalysisEntries(count: number): DocumentAnalysisEntry[] {
  const candidateProperties = Array.from({ length: 30 }, (_, index) => ({
    id: `property-${index}`,
    name: `Property ${index}`,
    address: `${100 + index} Main Street`,
  }));
  const candidateVendors = Array.from({ length: 40 }, (_, index) => ({
    id: `vendor-${index}`,
    name: `Vendor ${index}`,
    aliases: [`Service Company ${index}`],
    phone: "",
    email: "",
    defaultCategory: "Repairs",
  }));
  const candidateTransactions = Array.from({ length: 80 }, (_, index) => ({
    id: `transaction-${index}`,
    type: "Expense" as const,
    category: "Repairs",
    description: `Plumbing repair invoice ${index}`,
    vendor: `Vendor ${index % candidateVendors.length}`,
    unit: String((index % 4) + 1),
    propertyId: `property-${index % candidateProperties.length}`,
    date: "2026-06-15",
    amount: 120 + index,
    invoiceRef: `INV-${index}`,
  }));

  return Array.from({ length: count }, (_, index) => ({
    id: `document-${index}`,
    context: {
      document: {
        name: `Vendor ${index % candidateVendors.length} invoice INV-${index}.pdf`,
        type: "Invoice",
        tags: ["invoice", "repair"],
        extractedText: `Invoice INV-${index}. Vendor ${index % candidateVendors.length}. Plumbing repair at ${100 + (index % candidateProperties.length)} Main Street. Total $${120 + index}.00. Date 06/15/2026.`,
        propertyId: `property-${index % candidateProperties.length}`,
        unit: String((index % 4) + 1),
      },
      property: candidateProperties[index % candidateProperties.length],
      candidateProperties,
      candidateVendors,
      candidateTransactions,
      candidateLeases: [],
      candidateUnits: [],
      candidateWorkOrders: [],
    },
  }));
}

test("shared extraction preserves the independent document-analysis results and refreshes after edits", () => {
  const entries = createAnalysisEntries(6);
  entries[1].context.document.extractedText = "";
  entries[2].context.document.extractedText = "Lease summary. Monthly rent $1000.00.";
  entries[3].context.document.extractedText = "Plumbing estimate. Replace leaking valve. Total $425.32. Date 06/15/2026.";
  entries[4].context.document.ocrFieldOverrides = { totalAmount: 0 };
  const verify = () => {
    const results = analyzeDocumentBatch(entries);
    for (const { id, context } of entries) {
      assert.deepEqual(results[id], {
        utilitySections: inferDocumentUtilitySections(context),
        extractedFields: inferDocumentExtractedFields(context),
        tagSuggestions: inferDocumentTagSuggestions(context),
        linkSuggestions: inferDocumentLinkSuggestions(context),
        expenseSuggestion: inferDocumentExpenseSuggestion(context),
        workOrderSuggestion: inferDocumentWorkOrderSuggestion(context),
      });
    }
  };
  verify();
  entries[0].context.document.extractedText = "Corrected invoice. Total $950.00. Date 06/16/2026.";
  verify();
});

test("document analysis batch stays below the regression budget", () => {
  const entries = createAnalysisEntries(ANALYSIS_DOCUMENT_COUNT);
  const startedAt = performance.now();
  const results = analyzeDocumentBatch(entries);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(Object.keys(results).length, ANALYSIS_DOCUMENT_COUNT);
  assert.ok(
    elapsedMs < ANALYSIS_BUDGET_MS,
    `Analyzing ${ANALYSIS_DOCUMENT_COUNT} documents took ${elapsedMs.toFixed(1)} ms (budget ${ANALYSIS_BUDGET_MS} ms).`,
  );
});

test("document search reuses its index and stays below the regression budget", () => {
  const documents = Array.from({ length: SEARCH_DOCUMENT_COUNT }, (_, index) => ({
    id: `document-${index}`,
    name: `Invoice ${index}`,
    extractedText: `Vendor ${index % 50} repair at Property ${index % 30} unit ${index % 4}`,
  }));
  let indexedDocumentCount = 0;
  const index = buildDocumentSearchIndex(documents, (document) => {
    indexedDocumentCount += 1;
    return [document.name, document.extractedText];
  });

  const startedAt = performance.now();
  for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration += 1) {
    const query = `vendor ${iteration % 50}`;
    documents.filter((document) => matchesDocumentSearch(index, document.id, query));
  }
  const elapsedMs = performance.now() - startedAt;

  assert.equal(indexedDocumentCount, SEARCH_DOCUMENT_COUNT, "Search/filter changes must not rebuild indexed document text.");
  assert.ok(
    elapsedMs < SEARCH_BUDGET_MS,
    `${SEARCH_ITERATIONS} searches across ${SEARCH_DOCUMENT_COUNT} documents took ${elapsedMs.toFixed(1)} ms (budget ${SEARCH_BUDGET_MS} ms).`,
  );
});
