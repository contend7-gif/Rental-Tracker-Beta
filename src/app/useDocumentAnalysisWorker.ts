import { useEffect, useRef, useState } from "react";
import {
  analyzeDocumentBatch,
  type DocumentAnalysisEntry,
  type DocumentAnalysisResultById,
} from "./documentAnalysisBatch.ts";
import { publishPerformanceMetric } from "./performanceMetrics.ts";

const EMPTY_RESULTS: DocumentAnalysisResultById = {};

type WorkerResponse = {
  requestId: number;
  results?: DocumentAnalysisResultById;
};

export function useDocumentAnalysisWorker(active: boolean, entries: DocumentAnalysisEntry[]) {
  const [completed, setCompleted] = useState<{
    entries: DocumentAnalysisEntry[] | null;
    resultsById: DocumentAnalysisResultById;
  }>({ entries: null, resultsById: {} });
  const latestRequestId = useRef(0);
  const completedEntries = useRef<DocumentAnalysisEntry[] | null>(null);

  useEffect(() => {
    if (!active || entries.length === 0) {
      latestRequestId.current += 1;
      return undefined;
    }
    if (completedEntries.current === entries) {
      return undefined;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const startedAt = performance.now();
    let worker: Worker | null = null;
    let cancelled = false;
    let fallbackTimer: number | null = null;

    const finish = (results: DocumentAnalysisResultById) => {
      if (cancelled || latestRequestId.current !== requestId) return;
      completedEntries.current = entries;
      setCompleted({ entries, resultsById: results });
      publishPerformanceMetric("documentAnalysisMs", performance.now() - startedAt);
    };

    const scheduleFallback = () => {
      if (fallbackTimer != null) return;
      fallbackTimer = window.setTimeout(() => finish(analyzeDocumentBatch(entries)), 0);
    };

    if (typeof Worker === "undefined") {
      scheduleFallback();
      return () => {
        cancelled = true;
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      };
    }

    try {
      worker = new Worker(new URL("../workers/documentAnalysisWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== requestId) return;
        if (event.data.results) {
          worker?.terminate();
          worker = null;
          finish(event.data.results);
        } else {
          worker?.terminate();
          worker = null;
          scheduleFallback();
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        scheduleFallback();
      };
      worker.postMessage({ requestId, entries });
    } catch {
      worker?.terminate();
      worker = null;
      scheduleFallback();
    }

    return () => {
      cancelled = true;
      worker?.terminate();
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [active, entries]);

  const resultsById = completed.entries === entries ? completed.resultsById : EMPTY_RESULTS;
  return { resultsById };
}
