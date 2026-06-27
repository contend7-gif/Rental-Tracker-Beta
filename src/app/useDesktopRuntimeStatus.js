export function useDesktopRuntimeStatus({
  desktopDiagnosticsReport,
  desktopDocumentOcrApi,
  desktopDocumentOcrState,
  formatDesktopUpdateDate,
}) {
  return {
    automaticDocumentOcrAvailable: Boolean(desktopDocumentOcrState.supported && desktopDocumentOcrApi?.extract),
    desktopDiagnosticsCheckedAtLabel: formatDesktopUpdateDate(desktopDiagnosticsReport?.checkedAt || ""),
    desktopDiagnosticsRecentEvents: Array.isArray(desktopDiagnosticsReport?.recentEvents) ? desktopDiagnosticsReport.recentEvents : [],
  };
}
