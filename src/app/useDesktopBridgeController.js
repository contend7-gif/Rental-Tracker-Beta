import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_DOCUMENT_OCR_STATE = { supported: false, platform: "", engine: "" };

export function useDesktopBridgeController({ setNotice }) {
  const desktopApis = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        desktopDiagnosticsApi: null,
        desktopDocumentAiApi: null,
        desktopDocumentOcrApi: null,
        desktopDocumentOpenApi: null,
        desktopPersistenceApi: null,
        desktopStatementPdfApi: null,
        desktopUpdaterAvailable: false,
      };
    }

    return {
      desktopDiagnosticsApi: window.desktopDiagnostics || null,
      desktopDocumentAiApi: window.desktopDocumentAi || null,
      desktopDocumentOcrApi: window.desktopDocumentOcr || null,
      desktopDocumentOpenApi: window.desktopDocumentOpen || null,
      desktopPersistenceApi: window.desktopPersistence || null,
      desktopStatementPdfApi: window.desktopStatementPdf || null,
      desktopUpdaterAvailable: Boolean(window.desktopUpdater),
    };
  }, []);

  const {
    desktopDiagnosticsApi,
    desktopDocumentAiApi,
    desktopDocumentOcrApi,
    desktopDocumentOpenApi,
    desktopPersistenceApi,
    desktopStatementPdfApi,
    desktopUpdaterAvailable,
  } = desktopApis;

  const [desktopDocumentOcrState, setDesktopDocumentOcrState] = useState(DEFAULT_DOCUMENT_OCR_STATE);
  const [desktopDiagnosticsBusy, setDesktopDiagnosticsBusy] = useState(false);
  const [desktopDiagnosticsReport, setDesktopDiagnosticsReport] = useState(null);

  const runDesktopDiagnostics = useCallback(async (showNotice = true) => {
    if (!desktopDiagnosticsApi?.run) {
      setDesktopDiagnosticsReport(null);
      if (showNotice) {
        setNotice("Desktop self-check runs in installed desktop builds.");
      }
      return false;
    }

    setDesktopDiagnosticsBusy(true);
    try {
      const result = await desktopDiagnosticsApi.run();
      setDesktopDiagnosticsReport(result || null);
      if (result?.ok === false) {
        if (showNotice) {
          setNotice(result?.error || result?.message || "Desktop self-check failed.");
        }
        return false;
      }
      if (showNotice) {
        setNotice("Desktop self-check complete.");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown diagnostics error.");
      setDesktopDiagnosticsReport({
        ok: false,
        error: message,
        checkedAt: new Date().toISOString(),
        recentEvents: [],
      });
      if (showNotice) {
        setNotice(`Desktop self-check failed: ${message}`);
      }
      return false;
    } finally {
      setDesktopDiagnosticsBusy(false);
    }
  }, [desktopDiagnosticsApi, setNotice]);

  useEffect(() => {
    if (!desktopDiagnosticsApi?.run) {
      setDesktopDiagnosticsReport(null);
      return;
    }
    void runDesktopDiagnostics(false);
  }, [desktopDiagnosticsApi, runDesktopDiagnostics]);

  useEffect(() => {
    let cancelled = false;

    async function loadDesktopDocumentOcrSupport() {
      if (!desktopDocumentOcrApi?.isSupported) {
        if (!cancelled) {
          setDesktopDocumentOcrState(DEFAULT_DOCUMENT_OCR_STATE);
        }
        return;
      }

      try {
        const result = await desktopDocumentOcrApi.isSupported();
        if (!cancelled) {
          setDesktopDocumentOcrState({
            supported: Boolean(result?.supported),
            platform: String(result?.platform || ""),
            engine: String(result?.engine || ""),
          });
        }
      } catch {
        if (!cancelled) {
          setDesktopDocumentOcrState(DEFAULT_DOCUMENT_OCR_STATE);
        }
      }
    }

    void loadDesktopDocumentOcrSupport();
    return () => {
      cancelled = true;
    };
  }, [desktopDocumentOcrApi]);

  return {
    desktopDiagnosticsApi,
    desktopDiagnosticsBusy,
    desktopDiagnosticsReport,
    desktopDocumentAiApi,
    desktopDocumentOcrApi,
    desktopDocumentOcrState,
    desktopDocumentOpenApi,
    desktopPersistenceApi,
    desktopStatementPdfApi,
    desktopUpdaterAvailable,
    runDesktopDiagnostics,
  };
}
