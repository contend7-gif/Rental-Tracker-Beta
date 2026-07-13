import type { DesktopDiagnosticsResult, DesktopDocumentOcrSupport } from "../types/desktop.d.ts";

type UseDesktopRuntimeStatusArgs = {
  desktopDiagnosticsReport?: DesktopDiagnosticsResult | null;
  desktopDocumentOcrApi?: { extract?: (payload: Record<string, unknown>) => Promise<unknown> } | null;
  desktopDocumentOcrState?: DesktopDocumentOcrSupport | null;
  formatDesktopUpdateDate: (dateText: unknown) => string;
};

export function useDesktopRuntimeStatus({
  desktopDiagnosticsReport,
  desktopDocumentOcrApi,
  desktopDocumentOcrState,
  formatDesktopUpdateDate,
}: UseDesktopRuntimeStatusArgs) {
  return {
    automaticDocumentOcrAvailable: Boolean(desktopDocumentOcrState?.supported && desktopDocumentOcrApi?.extract),
    desktopDiagnosticsCheckedAtLabel: formatDesktopUpdateDate(desktopDiagnosticsReport?.checkedAt || ""),
    desktopDiagnosticsRecentEvents: Array.isArray(desktopDiagnosticsReport?.recentEvents) ? desktopDiagnosticsReport.recentEvents : [],
  };
}
