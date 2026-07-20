import { useCallback, useEffect, useMemo, useState } from "react";

type NoticeSetter = (message: string) => void;
type DocumentOcrState = { supported: boolean; platform: string; engine: string };
type DesktopDiagnosticsReport = Awaited<ReturnType<NonNullable<Window["desktopDiagnostics"]>["run"]>>;
type DesktopApis = {
  desktopCompanionApi: Window["desktopCompanion"] | null;
  desktopDiagnosticsApi: Window["desktopDiagnostics"] | null;
  desktopDocumentAiApi: Window["desktopDocumentAi"] | null;
  desktopDocumentOcrApi: Window["desktopDocumentOcr"] | null;
  desktopDocumentOpenApi: Window["desktopDocumentOpen"] | null;
  desktopPersistenceApi: Window["desktopPersistence"] | null;
  desktopStatementPdfApi: Window["desktopStatementPdf"] | null;
  desktopUpdaterAvailable: boolean;
};

const DEFAULT_DOCUMENT_OCR_STATE: DocumentOcrState = { supported: false, platform: "", engine: "" };

export function useDesktopBridgeController({ setNotice }: { setNotice: NoticeSetter }) {
  const desktopApis = useMemo<DesktopApis>(() => {
    if (typeof window === "undefined") {
      return {
        desktopCompanionApi: null,
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
      desktopCompanionApi: window.desktopCompanion || null,
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
    desktopCompanionApi,
    desktopDiagnosticsApi,
    desktopDocumentAiApi,
    desktopDocumentOcrApi,
    desktopDocumentOpenApi,
    desktopPersistenceApi,
    desktopStatementPdfApi,
    desktopUpdaterAvailable,
  } = desktopApis;

  const [desktopDocumentOcrState, setDesktopDocumentOcrState] = useState<DocumentOcrState>(DEFAULT_DOCUMENT_OCR_STATE);
  const [desktopDiagnosticsBusy, setDesktopDiagnosticsBusy] = useState(false);
  const [desktopDiagnosticsReport, setDesktopDiagnosticsReport] = useState<DesktopDiagnosticsReport | null>(null);

  const runDesktopDiagnostics = useCallback(async (showNotice = true): Promise<boolean> => {
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
    desktopCompanionApi,
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
