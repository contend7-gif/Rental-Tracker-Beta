/// <reference lib="webworker" />

import { analyzeDocumentBatch, type DocumentAnalysisEntry } from "../app/documentAnalysisBatch.ts";

type DocumentAnalysisRequest = {
  requestId: number;
  entries: DocumentAnalysisEntry[];
};

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<DocumentAnalysisRequest>) => {
  const { requestId, entries } = event.data;
  try {
    workerScope.postMessage({ requestId, results: analyzeDocumentBatch(entries) });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Document analysis failed.",
    });
  }
};

export {};
