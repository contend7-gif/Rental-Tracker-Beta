import { planningProjectionCsv } from "../domain/planning.ts";

export function usePlanningReportActions({
  addAuditEntry,
  copyTextToClipboard,
  desktopStatementPdfApi,
  downloadTextAsFile,
  planningAssumptions,
  planningMemoHtml,
  planningMemoText,
  planningReserveSummary,
  planningRows,
  planningScopeLabel,
  planningSummary,
  printHtmlDocument,
  propertyFilter,
  sanitizeFileNamePart,
  setNotice,
  yearFilter,
}) {
  const planningReportEntityId = `${yearFilter}-${propertyFilter}-${planningAssumptions.horizonMonths}`;
  const planningReportPropertyId = propertyFilter === "all" ? undefined : propertyFilter;
  const planningReportDetails = `Scope ${planningScopeLabel} | Horizon ${planningAssumptions.horizonMonths} months.`;

  const exportPlanningReport = () => {
    try {
      const csv = planningProjectionCsv({
        scopeLabel: planningScopeLabel,
        generatedAt: new Date().toISOString(),
        assumptions: {
          horizonMonths: Number(planningAssumptions.horizonMonths || 12),
          annualRentGrowthPct: Number(planningAssumptions.annualRentGrowthPct || 0),
          annualExpenseGrowthPct: Number(planningAssumptions.annualExpenseGrowthPct || 0),
          annualValueGrowthPct: Number(planningAssumptions.annualValueGrowthPct || 0),
          vacancyRatePct: Number(planningAssumptions.vacancyRatePct || 0),
          monthlyCapexReserve: Number(planningAssumptions.monthlyCapexReserve || 0),
          includedUtilitiesMonthly: Number(planningAssumptions.includedUtilitiesMonthly || 0),
        },
        summary: planningSummary,
        reserve: planningReserveSummary,
        rows: planningRows,
      });
      const scope = ["planning", yearFilter, propertyFilter, planningAssumptions.horizonMonths]
        .map(sanitizeFileNamePart)
        .filter(Boolean)
        .join("-");
      downloadTextAsFile(csv, `${scope || "planning-report"}.csv`, "text/csv;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "planning-report",
        entityId: planningReportEntityId,
        propertyId: planningReportPropertyId,
        summary: "Exported planning projection CSV.",
        details: planningReportDetails,
        category: "reporting",
      });
      setNotice("Planning CSV exported.");
    } catch {
      setNotice("Could not export planning CSV.");
    }
  };

  const copyPlanningMemo = async () => {
    const copied = await copyTextToClipboard(planningMemoText);
    setNotice(copied ? "Planning memo copied." : "Could not copy planning memo.");
  };

  const exportPlanningMemoText = () => {
    try {
      const scope = ["planning-memo", yearFilter, propertyFilter, planningAssumptions.horizonMonths]
        .map(sanitizeFileNamePart)
        .filter(Boolean)
        .join("-");
      downloadTextAsFile(planningMemoText, `${scope || "planning-memo"}.txt`, "text/plain;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "planning-memo",
        entityId: planningReportEntityId,
        propertyId: planningReportPropertyId,
        summary: "Exported planning memo text.",
        details: planningReportDetails,
        category: "reporting",
      });
      setNotice("Planning memo exported.");
    } catch {
      setNotice("Could not export planning memo.");
    }
  };

  const printPlanningMemo = () => {
    if (!printHtmlDocument(planningMemoHtml)) {
      setNotice("Could not initialize planning memo print preview.");
      return;
    }
    addAuditEntry({
      action: "print",
      entityType: "planning-memo",
      entityId: planningReportEntityId,
      propertyId: planningReportPropertyId,
      summary: "Opened planning memo print preview.",
      details: planningReportDetails,
      category: "reporting",
    });
    setNotice("Planning memo sent to printer.");
  };

  const exportPlanningMemoPdf = async () => {
    const scope = ["planning-memo", yearFilter, propertyFilter, planningAssumptions.horizonMonths]
      .map(sanitizeFileNamePart)
      .filter(Boolean)
      .join("-");
    if (!desktopStatementPdfApi?.savePdf) {
      setNotice("PDF export is available in installed desktop builds. In the browser, use Print and choose Save as PDF.");
      return;
    }

    try {
      const result = await desktopStatementPdfApi.savePdf({
        html: planningMemoHtml,
        suggestedFileName: `${scope || "planning-memo"}.pdf`,
      });
      if (result?.ok) {
        addAuditEntry({
          action: "export",
          entityType: "planning-memo",
          entityId: planningReportEntityId,
          propertyId: planningReportPropertyId,
          summary: "Exported planning memo PDF.",
          details: planningReportDetails,
          category: "reporting",
        });
        setNotice("Planning memo PDF saved.");
        return;
      }
      if (!result?.canceled) {
        setNotice(result?.message || "Could not export planning memo PDF.");
      }
    } catch {
      setNotice("Could not export planning memo PDF.");
    }
  };

  return {
    copyPlanningMemo,
    exportPlanningMemoPdf,
    exportPlanningMemoText,
    exportPlanningReport,
    printPlanningMemo,
  };
}
